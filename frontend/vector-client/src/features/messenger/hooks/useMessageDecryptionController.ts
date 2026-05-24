import { useEffect, useRef, useState } from 'react';
import { getCurrentAccountGroupEpochKeyEnvelope } from '../../chats/api/chatsApi';
import type { MessageResponseDto } from '../../../shared/types/api';
import { DECRYPTION_PLACEHOLDER_TEXT, decryptDirectMessageWithAvailablePayloads, isDecryptionPlaceholder } from '../lib/messengerCore';
import { clientLogger } from '../../../shared/lib/clientLogger';

type UseMessageDecryptionControllerParams = {
  accountId: string | undefined;
  deviceId: string | null;
  loadedMessages: MessageResponseDto[];
  isCryptoReady: boolean;
};

type DecryptionStage =
  | 'ACCOUNT_ENVELOPE'
  | 'DEVICE_PAYLOAD'
  | 'CONTENT_AES_GCM'
  | 'GROUP_ENVELOPE_FETCH'
  | 'GROUP_ENVELOPE_DECRYPT'
  | 'GROUP_KEY_IMPORT'
  | 'GROUP_AES_GCM';

const MAX_DECRYPTION_ATTEMPTS = 5;
const RETRY_DELAYS_MS = [350, 900, 1800, 3500, 6000];

function requireContentMetadata(message: MessageResponseDto) {
  if (!message.encryptedPayload || !message.contentInitializationVectorBase64 || !message.contentAuthenticationTagBase64) {
    throw new Error('Encrypted message content metadata is incomplete.');
  }
}

function parseMessageKeyPackage(plainText: string): string {
  const parsedValue = JSON.parse(plainText) as { type?: string; keyBase64?: string };

  if (parsedValue.type !== 'VECTOR_MESSAGE_KEY' || !parsedValue.keyBase64) {
    throw new Error('Unsupported message key package.');
  }

  return parsedValue.keyBase64;
}

function isNotFoundError(error: unknown): boolean {
  return (error as { response?: { status?: number } })?.response?.status === 404;
}

function buildMessageDiagnostics(message: MessageResponseDto, accountId: string, deviceId: string | null) {
  return {
    messageId: message.messageId,
    chatId: message.chatId,
    senderAccountId: message.senderAccountId,
    senderDeviceId: message.senderDeviceId,
    currentAccountId: accountId,
    currentDeviceId: deviceId,
    encryptionType: message.encryptionType,
    groupKeyEpoch: message.groupKeyEpoch,
    accountEnvelopeCount: message.accountKeyEnvelopes.length,
    hasAccountEnvelopeForCurrentAccount: message.accountKeyEnvelopes.some((envelope) => envelope.targetAccountId === accountId),
    hasInlineGroupEpochEnvelope: Boolean(message.groupEpochKeyEnvelope),
    inlineGroupEpochEnvelopeTargetAccountId: message.groupEpochKeyEnvelope?.targetAccountId ?? null,
    payloadTargetDeviceIds: message.devicePayloads.map((devicePayload) => devicePayload.targetDeviceId),
    hasPayloadForCurrentDevice: Boolean(deviceId && message.devicePayloads.some((devicePayload) => devicePayload.targetDeviceId === deviceId)),
  };
}

export function useMessageDecryptionController({
  accountId,
  deviceId,
  loadedMessages,
  isCryptoReady,
}: UseMessageDecryptionControllerParams) {
  const [decryptedMessagesById, setDecryptedMessagesById] = useState<Record<string, string>>({});
  const decryptingMessageIdsRef = useRef<Set<string>>(new Set());
  const failedMessageIdsRef = useRef<Set<string>>(new Set());
  const failedAttemptsByMessageIdRef = useRef<Map<string, number>>(new Map());
  const retryTimersByMessageIdRef = useRef<Map<string, number>>(new Map());
  const backupPrivateKeyUnlockedRef = useRef<boolean | null>(null);

  function clearRetryTimer(messageId: string) {
    const existingTimerId = retryTimersByMessageIdRef.current.get(messageId);

    if (existingTimerId !== undefined) {
      window.clearTimeout(existingTimerId);
      retryTimersByMessageIdRef.current.delete(messageId);
    }
  }

  function removePlaceholders(messageIds: string[]) {
    if (messageIds.length === 0) {
      return;
    }

    setDecryptedMessagesById((previousValue) => {
      const nextValue = { ...previousValue };
      let changed = false;

      messageIds.forEach((messageId) => {
        if (isDecryptionPlaceholder(nextValue[messageId])) {
          delete nextValue[messageId];
          changed = true;
        }
      });

      return changed ? nextValue : previousValue;
    });
  }

  function resetDecryptionState() {
    retryTimersByMessageIdRef.current.forEach((timerId) => window.clearTimeout(timerId));
    retryTimersByMessageIdRef.current.clear();
    failedAttemptsByMessageIdRef.current.clear();
    failedMessageIdsRef.current.clear();
    decryptingMessageIdsRef.current.clear();
    backupPrivateKeyUnlockedRef.current = null;
    setDecryptedMessagesById({});
  }

  function clearTemporarilyMissingGroupKeys() {
    failedAttemptsByMessageIdRef.current.clear();
    failedMessageIdsRef.current.clear();
    backupPrivateKeyUnlockedRef.current = null;
    retryTimersByMessageIdRef.current.forEach((timerId) => window.clearTimeout(timerId));
    retryTimersByMessageIdRef.current.clear();

    setDecryptedMessagesById((previousValue) => {
      const nextValue = { ...previousValue };
      let changed = false;

      Object.entries(nextValue).forEach(([messageId, plainText]) => {
        if (isDecryptionPlaceholder(plainText)) {
          delete nextValue[messageId];
          changed = true;
        }
      });

      return changed ? nextValue : previousValue;
    });
  }

  function releaseFailedGroupEpochMessages(chatId: string, epoch: number) {
    const messageIdsToRetry = loadedMessages
      .filter((message) => message.chatId === chatId && message.groupKeyEpoch === epoch)
      .map((message) => message.messageId);

    messageIdsToRetry.forEach((messageId) => {
      clearRetryTimer(messageId);
      failedMessageIdsRef.current.delete(messageId);
      failedAttemptsByMessageIdRef.current.delete(messageId);
    });
    removePlaceholders(messageIdsToRetry);
  }

  function scheduleDecryptionRetry(message: MessageResponseDto) {
    const messageId = message.messageId;
    const currentAttempt = (failedAttemptsByMessageIdRef.current.get(messageId) ?? 0) + 1;
    failedAttemptsByMessageIdRef.current.set(messageId, currentAttempt);

    if (currentAttempt >= MAX_DECRYPTION_ATTEMPTS || retryTimersByMessageIdRef.current.has(messageId)) {
      return;
    }

    const retryDelayMs = RETRY_DELAYS_MS[Math.min(currentAttempt - 1, RETRY_DELAYS_MS.length - 1)];
    const timerId = window.setTimeout(() => {
      retryTimersByMessageIdRef.current.delete(messageId);
      failedMessageIdsRef.current.delete(messageId);
      removePlaceholders([messageId]);
    }, retryDelayMs);

    retryTimersByMessageIdRef.current.set(messageId, timerId);
  }

  useEffect(() => {
    clearTemporarilyMissingGroupKeys();
  }, [accountId, deviceId, isCryptoReady]);

  useEffect(() => {
    return () => {
      retryTimersByMessageIdRef.current.forEach((timerId) => window.clearTimeout(timerId));
      retryTimersByMessageIdRef.current.clear();
    };
  }, []);

  useEffect(() => {
    function handleGroupEpochKeysAvailable(event: Event) {
      const payload = (event as CustomEvent<{ chatId?: string; epoch?: number; targetAccountId?: string }>).detail;

      if (!payload || payload.targetAccountId !== accountId || !payload.chatId || typeof payload.epoch !== 'number') {
        return;
      }

      releaseFailedGroupEpochMessages(payload.chatId, payload.epoch);
    }

    window.addEventListener('vector:groupEpochKeysAvailable', handleGroupEpochKeysAvailable);

    return () => {
      window.removeEventListener('vector:groupEpochKeysAvailable', handleGroupEpochKeysAvailable);
    };
  }, [accountId, loadedMessages]);

  useEffect(() => {
    const vectorCrypto = window.vectorCrypto;

    if (!accountId || !deviceId || !vectorCrypto || !isCryptoReady) {
      return;
    }

    const activeVectorCrypto = vectorCrypto;
    const activeAccountId = accountId;
    const activeDeviceId = deviceId;
    const localDecryptDeviceIds = new Set([activeDeviceId].filter(Boolean));

    async function getBackupPrivateKeyUnlocked(): Promise<boolean | null> {
      if (backupPrivateKeyUnlockedRef.current !== null) {
        return backupPrivateKeyUnlockedRef.current;
      }

      try {
        const unlocked = await activeVectorCrypto.hasUnlockedAccountBackupPrivateKey({ accountId: activeAccountId });
        backupPrivateKeyUnlockedRef.current = unlocked;
        return unlocked;
      }
      catch (error) {
        clientLogger.warn('Failed to read account backup unlock status.', {
          accountId: activeAccountId,
          error,
        }, {
          dedupeKey: `backup-unlock-status:${activeAccountId}`,
          throttleMs: 60000,
        });
        return null;
      }
    }

    async function decryptMessageKeyFromDevicePayload(message: MessageResponseDto): Promise<string | null> {
      const candidatePayloads = message.devicePayloads.filter((devicePayload) => localDecryptDeviceIds.has(devicePayload.targetDeviceId));

      if (candidatePayloads.length === 0) {
        clientLogger.debug('Direct device payload is not available for the current device.', buildMessageDiagnostics(message, activeAccountId, activeDeviceId), {
          dedupeKey: `direct-payload-missing:${message.chatId}:${message.senderDeviceId}:${activeDeviceId}`,
          throttleMs: 60000,
        });
        return null;
      }

      try {
        const decryptResponse = await decryptDirectMessageWithAvailablePayloads(message, candidatePayloads, activeAccountId, activeVectorCrypto);

        if (!decryptResponse.plainText) {
          return null;
        }

        return parseMessageKeyPackage(decryptResponse.plainText);
      }
      catch (error) {
        clientLogger.warn('Device payload decryption failed.', {
          stage: 'DEVICE_PAYLOAD' satisfies DecryptionStage,
          ...buildMessageDiagnostics(message, activeAccountId, activeDeviceId),
          candidatePayloadTargetDeviceIds: candidatePayloads.map((candidatePayload) => candidatePayload.targetDeviceId),
          error,
        }, {
          dedupeKey: `device-payload-decryption:${message.messageId}:${activeDeviceId}`,
          throttleMs: 60000,
        });
        return null;
      }
    }

    async function decryptMessageKeyFromAccountEnvelope(message: MessageResponseDto): Promise<string | null> {
      const accountEnvelope = message.accountKeyEnvelopes.find((envelope) => envelope.targetAccountId === activeAccountId);

      if (!accountEnvelope) {
        clientLogger.debug('Account key envelope is not available for the current account.', buildMessageDiagnostics(message, activeAccountId, activeDeviceId), {
          dedupeKey: `account-envelope-missing:${message.chatId}:${activeAccountId}`,
          throttleMs: 60000,
        });
        return null;
      }

      try {
        const backupPrivateKeyUnlocked = await getBackupPrivateKeyUnlocked();

        if (backupPrivateKeyUnlocked === false) {
          clientLogger.debug('Account backup key is locked. Account envelope decryption is postponed.', {
            stage: 'ACCOUNT_ENVELOPE' satisfies DecryptionStage,
            ...buildMessageDiagnostics(message, activeAccountId, activeDeviceId),
          }, {
            dedupeKey: `account-backup-locked:${activeAccountId}`,
            throttleMs: 60000,
          });
          return null;
        }

        const decryptResponse = await activeVectorCrypto.decryptAccountKeyEnvelope({
          accountId: activeAccountId,
          encryptedKeyBase64: accountEnvelope.encryptedKeyBase64,
          allowFailure: true,
        });

        if (decryptResponse.failed) {
          if (decryptResponse.errorCode === 'BACKUP_LOCKED') {
            backupPrivateKeyUnlockedRef.current = false;
            clientLogger.debug('Account backup key is locked. Account envelope decryption is postponed.', {
              stage: 'ACCOUNT_ENVELOPE' satisfies DecryptionStage,
              ...buildMessageDiagnostics(message, activeAccountId, activeDeviceId),
              errorCode: decryptResponse.errorCode,
            }, {
              dedupeKey: `account-backup-locked:${activeAccountId}`,
              throttleMs: 60000,
            });
            return null;
          }

          clientLogger.warn('Account envelope decryption failed.', {
            stage: 'ACCOUNT_ENVELOPE' satisfies DecryptionStage,
            ...buildMessageDiagnostics(message, activeAccountId, activeDeviceId),
            envelopeTargetAccountId: accountEnvelope.targetAccountId,
            errorCode: decryptResponse.errorCode,
            errorMessage: decryptResponse.errorMessage,
          }, {
            dedupeKey: `account-envelope-decryption:${message.messageId}:${activeAccountId}`,
            throttleMs: 60000,
          });
          return null;
        }

        return decryptResponse.keyBase64 ?? null;
      }
      catch (error) {
        clientLogger.warn('Account envelope decryption failed unexpectedly.', {
          stage: 'ACCOUNT_ENVELOPE' satisfies DecryptionStage,
          ...buildMessageDiagnostics(message, activeAccountId, activeDeviceId),
          envelopeTargetAccountId: accountEnvelope.targetAccountId,
          backupPrivateKeyUnlocked: backupPrivateKeyUnlockedRef.current,
          error,
        }, {
          dedupeKey: `account-envelope-unexpected:${message.messageId}:${activeAccountId}`,
          throttleMs: 60000,
        });
        return null;
      }
    }

    async function decryptContentMessage(message: MessageResponseDto): Promise<string> {
      requireContentMetadata(message);
      const messageKeyBase64 = await decryptMessageKeyFromAccountEnvelope(message)
        ?? await decryptMessageKeyFromDevicePayload(message);

      if (!messageKeyBase64) {
        throw new Error('Message key is not available for this account or device. Account envelope and current-device payload both failed or were absent.');
      }

      try {
        const decryptResponse = await activeVectorCrypto.decryptContentWithKey({
          keyBase64: messageKeyBase64,
          encryptedPayload: message.encryptedPayload!,
          initializationVectorBase64: message.contentInitializationVectorBase64!,
          authenticationTagBase64: message.contentAuthenticationTagBase64!,
        });

        if (!decryptResponse.plainText) {
          throw new Error('Message content was decrypted to an empty value.');
        }

        return decryptResponse.plainText;
      }
      catch (error) {
        clientLogger.warn('Content AES-GCM decryption failed.', {
          stage: 'CONTENT_AES_GCM' satisfies DecryptionStage,
          ...buildMessageDiagnostics(message, activeAccountId, activeDeviceId),
          error,
        }, {
          dedupeKey: `content-aes-gcm:${message.messageId}`,
          throttleMs: 60000,
        });
        throw error;
      }
    }

    async function fetchCurrentAccountGroupEpochEnvelope(message: MessageResponseDto) {
      if (message.groupEpochKeyEnvelope?.targetAccountId === activeAccountId) {
        return message.groupEpochKeyEnvelope;
      }

      try {
        return await getCurrentAccountGroupEpochKeyEnvelope(message.chatId, message.groupKeyEpoch ?? 1);
      }
      catch (error) {
        if (!isNotFoundError(error)) {
          clientLogger.warn('Group epoch envelope fetch failed.', {
            stage: 'GROUP_ENVELOPE_FETCH' satisfies DecryptionStage,
            ...buildMessageDiagnostics(message, activeAccountId, activeDeviceId),
            error,
          }, {
            dedupeKey: `group-envelope-fetch:${message.chatId}:${message.groupKeyEpoch}:${activeAccountId}`,
            throttleMs: 60000,
          });
        }

        return null;
      }
    }

    async function importGroupEpochKeyFromEnvelope(message: MessageResponseDto): Promise<boolean> {
      if (message.groupKeyEpoch === null || message.groupKeyEpoch === undefined) {
        throw new Error('Group key epoch is missing.');
      }

      const groupEpochEnvelope = await fetchCurrentAccountGroupEpochEnvelope(message);

      if (!groupEpochEnvelope || groupEpochEnvelope.targetAccountId !== activeAccountId) {
        clientLogger.debug('Group epoch envelope is not available for the current account.', {
          stage: 'GROUP_ENVELOPE_FETCH' satisfies DecryptionStage,
          ...buildMessageDiagnostics(message, activeAccountId, activeDeviceId),
        }, {
          dedupeKey: `group-envelope-missing:${message.chatId}:${message.groupKeyEpoch}:${activeAccountId}`,
          throttleMs: 60000,
        });
        return false;
      }

      try {
        const backupPrivateKeyUnlocked = await getBackupPrivateKeyUnlocked();

        if (backupPrivateKeyUnlocked === false) {
          clientLogger.debug('Account backup key is locked. Group epoch import is postponed.', {
            stage: 'GROUP_ENVELOPE_DECRYPT' satisfies DecryptionStage,
            ...buildMessageDiagnostics(message, activeAccountId, activeDeviceId),
          }, {
            dedupeKey: `group-backup-locked:${activeAccountId}:${message.chatId}:${message.groupKeyEpoch}`,
            throttleMs: 60000,
          });
          return false;
        }

        const decryptResponse = await activeVectorCrypto.decryptAccountKeyEnvelope({
          accountId: activeAccountId,
          encryptedKeyBase64: groupEpochEnvelope.encryptedKeyBase64,
          allowFailure: true,
        });

        if (decryptResponse.failed || !decryptResponse.keyBase64) {
          if (decryptResponse.errorCode === 'BACKUP_LOCKED') {
            backupPrivateKeyUnlockedRef.current = false;
            clientLogger.debug('Account backup key is locked. Group epoch import is postponed.', {
              stage: 'GROUP_ENVELOPE_DECRYPT' satisfies DecryptionStage,
              ...buildMessageDiagnostics(message, activeAccountId, activeDeviceId),
              errorCode: decryptResponse.errorCode,
            }, {
              dedupeKey: `group-backup-locked:${activeAccountId}:${message.chatId}:${message.groupKeyEpoch}`,
              throttleMs: 60000,
            });
            return false;
          }

          clientLogger.warn('Group epoch envelope decryption failed.', {
            stage: 'GROUP_ENVELOPE_DECRYPT' satisfies DecryptionStage,
            ...buildMessageDiagnostics(message, activeAccountId, activeDeviceId),
            envelopeTargetAccountId: groupEpochEnvelope.targetAccountId,
            errorCode: decryptResponse.errorCode,
            errorMessage: decryptResponse.errorMessage,
          }, {
            dedupeKey: `group-envelope-decryption:${message.chatId}:${message.groupKeyEpoch}:${activeAccountId}`,
            throttleMs: 60000,
          });
          return false;
        }

        await activeVectorCrypto.importGroupKeyFromBackupEnvelope({
          accountId: activeAccountId,
          chatId: message.chatId,
          epoch: message.groupKeyEpoch,
          senderDeviceId: groupEpochEnvelope.senderDeviceId || message.senderDeviceId || activeDeviceId,
          groupEpochKeyBase64: decryptResponse.keyBase64,
        });
        releaseFailedGroupEpochMessages(message.chatId, message.groupKeyEpoch);
        return true;
      }
      catch (error) {
        clientLogger.warn('Group epoch envelope import failed unexpectedly.', {
          stage: 'GROUP_KEY_IMPORT' satisfies DecryptionStage,
          ...buildMessageDiagnostics(message, activeAccountId, activeDeviceId),
          envelopeTargetAccountId: groupEpochEnvelope.targetAccountId,
          backupPrivateKeyUnlocked: backupPrivateKeyUnlockedRef.current,
          error,
        }, {
          dedupeKey: `group-envelope-import:${message.chatId}:${message.groupKeyEpoch}:${activeAccountId}`,
          throttleMs: 60000,
        });
        return false;
      }
    }

    async function decryptGroupMessage(message: MessageResponseDto): Promise<string> {
      requireContentMetadata(message);

      if (message.groupKeyEpoch === null || message.groupKeyEpoch === undefined) {
        throw new Error('Group key epoch is missing.');
      }

      await importGroupEpochKeyFromEnvelope(message);

      try {
        const groupDecryptResponse = await activeVectorCrypto.decryptGroupMessageV2({
          accountId: activeAccountId,
          deviceId: activeDeviceId,
          chatId: message.chatId,
          epoch: message.groupKeyEpoch,
          messageId: message.clientMessageId ?? message.messageId,
          encryptedPayload: message.encryptedPayload!,
          initializationVectorBase64: message.contentInitializationVectorBase64!,
          authenticationTagBase64: message.contentAuthenticationTagBase64!,
          allowFailure: true,
        });

        if (groupDecryptResponse.failed) {
          if (groupDecryptResponse.errorCode === 'GROUP_KEY_MISSING') {
            clientLogger.debug('Group message decryption is postponed because the group epoch key is not available locally.', {
              stage: 'GROUP_AES_GCM' satisfies DecryptionStage,
              ...buildMessageDiagnostics(message, activeAccountId, activeDeviceId),
              errorCode: groupDecryptResponse.errorCode,
            }, {
              dedupeKey: `group-key-missing:${message.chatId}:${message.groupKeyEpoch}:${activeAccountId}`,
              throttleMs: 60000,
            });
          }
          else {
            clientLogger.warn('Group AES-GCM decryption failed.', {
              stage: 'GROUP_AES_GCM' satisfies DecryptionStage,
              ...buildMessageDiagnostics(message, activeAccountId, activeDeviceId),
              errorCode: groupDecryptResponse.errorCode,
              errorMessage: groupDecryptResponse.errorMessage,
            }, {
              dedupeKey: `group-aes-gcm:${message.messageId}:${activeAccountId}`,
              throttleMs: 60000,
            });
          }

          throw new Error(groupDecryptResponse.errorCode ?? 'GROUP_DECRYPTION_FAILED');
        }

        if (!groupDecryptResponse.plainText) {
          throw new Error('Group message content was decrypted to an empty value.');
        }

        return groupDecryptResponse.plainText;
      }
      catch (error) {
        clientLogger.warn('Group AES-GCM decryption failed unexpectedly.', {
          stage: 'GROUP_AES_GCM' satisfies DecryptionStage,
          ...buildMessageDiagnostics(message, activeAccountId, activeDeviceId),
          error,
        }, {
          dedupeKey: `group-aes-gcm-unexpected:${message.messageId}:${activeAccountId}`,
          throttleMs: 60000,
        });
        throw error;
      }
    }

    loadedMessages.forEach((message) => {
      const messageId = message.messageId;
      const cachedPlainText = decryptedMessagesById[messageId];

      if (cachedPlainText && !isDecryptionPlaceholder(cachedPlainText)) {
        return;
      }

      if (decryptingMessageIdsRef.current.has(messageId) || failedMessageIdsRef.current.has(messageId)) {
        return;
      }

      if (message.messageType === 'SYSTEM') {
        setDecryptedMessagesById((previousValue) => ({
          ...previousValue,
          [messageId]: message.encryptedPayload ?? '',
        }));
        return;
      }

      decryptingMessageIdsRef.current.add(messageId);
      const decryptPromise = message.encryptionType === 'GROUP'
        ? decryptGroupMessage(message)
        : decryptContentMessage(message);

      decryptPromise
        .then((plainText) => {
          clearRetryTimer(messageId);
          failedAttemptsByMessageIdRef.current.delete(messageId);
          failedMessageIdsRef.current.delete(messageId);
          setDecryptedMessagesById((previousValue) => ({
            ...previousValue,
            [messageId]: plainText,
          }));
        })
        .catch((error) => {
          failedMessageIdsRef.current.add(messageId);
          scheduleDecryptionRetry(message);
          clientLogger.debug('Message decryption is pending.', {
            ...buildMessageDiagnostics(message, activeAccountId, activeDeviceId),
            attempt: failedAttemptsByMessageIdRef.current.get(messageId) ?? 1,
            maxAttempts: MAX_DECRYPTION_ATTEMPTS,
            error,
          }, {
            dedupeKey: `message-decryption-pending:${message.chatId}:${message.encryptionType}:${message.groupKeyEpoch ?? 'none'}:${activeAccountId}`,
            throttleMs: 60000,
          });
          setDecryptedMessagesById((previousValue) => ({
            ...previousValue,
            [messageId]: DECRYPTION_PLACEHOLDER_TEXT,
          }));
        })
        .finally(() => {
          decryptingMessageIdsRef.current.delete(messageId);
        });
    });
  }, [accountId, decryptedMessagesById, deviceId, isCryptoReady, loadedMessages]);

  return {
    decryptedMessagesById,
    setDecryptedMessagesById,
    resetDecryptionState,
    clearTemporarilyMissingGroupKeys,
  };
}
