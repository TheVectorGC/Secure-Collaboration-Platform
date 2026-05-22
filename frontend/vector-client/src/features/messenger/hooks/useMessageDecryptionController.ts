import { useEffect, useRef, useState } from 'react';
import type { MessageResponseDto } from '../../../shared/types/api';
import { decryptDirectMessageWithAvailablePayloads, isDecryptionPlaceholder } from '../lib/messengerCore';

type UseMessageDecryptionControllerParams = {
  accountId: string | undefined;
  deviceId: string | null;
  loadedMessages: MessageResponseDto[];
  isCryptoReady: boolean;
};

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

export function useMessageDecryptionController({
  accountId,
  deviceId,
  loadedMessages,
  isCryptoReady,
}: UseMessageDecryptionControllerParams) {
  const [decryptedMessagesById, setDecryptedMessagesById] = useState<Record<string, string>>({});
  const decryptingMessageIdsRef = useRef<Set<string>>(new Set());
  const failedMessageIdsRef = useRef<Set<string>>(new Set());

  function resetDecryptionState() {
    failedMessageIdsRef.current.clear();
    decryptingMessageIdsRef.current.clear();
    setDecryptedMessagesById({});
  }

  function clearTemporarilyMissingGroupKeys() {
    failedMessageIdsRef.current.clear();

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

  useEffect(() => {
    failedMessageIdsRef.current.clear();
  }, [deviceId, isCryptoReady]);

  useEffect(() => {
    const vectorCrypto = window.vectorCrypto;

    if (!accountId || !deviceId || !vectorCrypto || !isCryptoReady) {
      return;
    }

    const activeVectorCrypto = vectorCrypto;
    const activeAccountId = accountId;
    const activeDeviceId = deviceId;
    const localDecryptDeviceIds = new Set([activeDeviceId]);

    async function decryptMessageKeyFromDevicePayload(message: MessageResponseDto): Promise<string | null> {
      const candidatePayloads = message.devicePayloads.filter((devicePayload) => localDecryptDeviceIds.has(devicePayload.targetDeviceId));

      if (candidatePayloads.length === 0) {
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
        console.warn('Device payload decryption failed. Account envelope fallback will be used when available.', {
          messageId: message.messageId,
          chatId: message.chatId,
          senderAccountId: message.senderAccountId,
          senderDeviceId: message.senderDeviceId,
          candidatePayloadTargetDeviceIds: candidatePayloads.map((candidatePayload) => candidatePayload.targetDeviceId),
          error,
        });
        return null;
      }
    }

    async function decryptMessageKeyFromAccountEnvelope(message: MessageResponseDto): Promise<string | null> {
      const accountEnvelope = message.accountKeyEnvelopes.find((envelope) => envelope.targetAccountId === activeAccountId);

      if (!accountEnvelope) {
        return null;
      }

      try {
        const decryptResponse = await activeVectorCrypto.decryptAccountKeyEnvelope({
          accountId: activeAccountId,
          encryptedKeyBase64: accountEnvelope.encryptedKeyBase64,
        });

        return decryptResponse.keyBase64;
      }
      catch (error) {
        console.warn('Account envelope decryption failed. Device payload fallback will be used when available.', {
          messageId: message.messageId,
          chatId: message.chatId,
          envelopeTargetAccountId: accountEnvelope.targetAccountId,
          activeAccountId,
          error,
        });
        return null;
      }
    }

    async function decryptContentMessage(message: MessageResponseDto): Promise<string> {
      requireContentMetadata(message);
      const messageKeyBase64 = await decryptMessageKeyFromAccountEnvelope(message)
        ?? await decryptMessageKeyFromDevicePayload(message);

      if (!messageKeyBase64) {
        throw new Error('Message key is not available for this account or device.');
      }

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

    async function decryptGroupMessage(message: MessageResponseDto): Promise<string> {
      requireContentMetadata(message);

      if (message.groupKeyEpoch === null || message.groupKeyEpoch === undefined) {
        throw new Error('Group key epoch is missing.');
      }

      const groupEpochEnvelope = message.groupEpochKeyEnvelope?.targetAccountId === activeAccountId
        ? message.groupEpochKeyEnvelope
        : message.accountKeyEnvelopes.find((envelope) => envelope.targetAccountId === activeAccountId) ?? null;

      if (groupEpochEnvelope) {
        try {
          const decryptResponse = await activeVectorCrypto.decryptAccountKeyEnvelope({
            accountId: activeAccountId,
            encryptedKeyBase64: groupEpochEnvelope.encryptedKeyBase64,
          });
          await activeVectorCrypto.importGroupKeyFromBackupEnvelope({
            accountId: activeAccountId,
            chatId: message.chatId,
            epoch: message.groupKeyEpoch,
            senderDeviceId: message.senderDeviceId,
            groupEpochKeyBase64: decryptResponse.keyBase64,
          });
        }
        catch (error) {
          console.warn('Group epoch envelope decryption failed.', {
            messageId: message.messageId,
            chatId: message.chatId,
            envelopeTargetAccountId: groupEpochEnvelope.targetAccountId,
            activeAccountId,
            error,
          });
        }
      }

      const groupDecryptResponse = await activeVectorCrypto.decryptGroupMessageV2({
        accountId: activeAccountId,
        deviceId: activeDeviceId,
        chatId: message.chatId,
        epoch: message.groupKeyEpoch,
        messageId: message.clientMessageId ?? message.messageId,
        encryptedPayload: message.encryptedPayload!,
        initializationVectorBase64: message.contentInitializationVectorBase64!,
        authenticationTagBase64: message.contentAuthenticationTagBase64!,
      });

      if (!groupDecryptResponse.plainText) {
        throw new Error('Group message content was decrypted to an empty value.');
      }

      return groupDecryptResponse.plainText;
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
          failedMessageIdsRef.current.delete(messageId);
          setDecryptedMessagesById((previousValue) => ({
            ...previousValue,
            [messageId]: plainText,
          }));
        })
        .catch((error) => {
          failedMessageIdsRef.current.add(messageId);
          console.warn('Message decryption failed.', {
            messageId,
            chatId: message.chatId,
            senderAccountId: message.senderAccountId,
            senderDeviceId: message.senderDeviceId,
            currentDeviceId: deviceId,
            encryptionType: message.encryptionType,
            accountEnvelopeCount: message.accountKeyEnvelopes.length,
            hasGroupEpochEnvelope: Boolean(message.groupEpochKeyEnvelope),
            payloadTargetDeviceIds: message.devicePayloads.map((devicePayload) => devicePayload.targetDeviceId),
            error,
          });
          setDecryptedMessagesById((previousValue) => ({
            ...previousValue,
            [messageId]: '[Не удалось расшифровать сообщение]',
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
