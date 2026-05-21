import { useEffect, useRef, useState } from 'react';
import type { MessageResponseDto } from '../../../shared/types/api';
import {
  decryptDirectMessageWithAvailablePayloads,
  isDecryptionPlaceholder,
} from '../lib/messengerCore';

type UseMessageDecryptionControllerParams = {
  accountId: string | undefined;
  deviceId: string | null;
  restoredDeviceIds: string[];
  loadedMessages: MessageResponseDto[];
};

export function useMessageDecryptionController({
  accountId,
  deviceId,
  restoredDeviceIds,
  loadedMessages,
}: UseMessageDecryptionControllerParams) {
  const [decryptedMessagesById, setDecryptedMessagesById] = useState<Record<string, string>>({});
  const decryptingMessageIdsRef = useRef<Set<string>>(new Set());
  const permanentlyUnavailableMessageIdsRef = useRef<Set<string>>(new Set());
  const failedDirectDecryptionMessageIdsRef = useRef<Set<string>>(new Set());
  const temporarilyMissingGroupKeyMessageIdsRef = useRef<Set<string>>(new Set());

  function resetDecryptionState() {
    permanentlyUnavailableMessageIdsRef.current.clear();
    failedDirectDecryptionMessageIdsRef.current.clear();
    temporarilyMissingGroupKeyMessageIdsRef.current.clear();
    decryptingMessageIdsRef.current.clear();
    setDecryptedMessagesById({});
  }

  function clearTemporarilyMissingGroupKeys() {
    temporarilyMissingGroupKeyMessageIdsRef.current.clear();
  }

  useEffect(() => {
    const vectorCrypto = window.vectorCrypto;

    if (!accountId || !deviceId || !vectorCrypto) {
      return;
    }

    loadedMessages.forEach((message) => {
      const messageId = message.messageId;
      const cachedPlainText = decryptedMessagesById[messageId];

      if (cachedPlainText && !isDecryptionPlaceholder(cachedPlainText)) {
        return;
      }

      if (
        decryptingMessageIdsRef.current.has(messageId)
        || permanentlyUnavailableMessageIdsRef.current.has(messageId)
        || failedDirectDecryptionMessageIdsRef.current.has(messageId)
        || temporarilyMissingGroupKeyMessageIdsRef.current.has(messageId)
      ) {
        return;
      }

      if (message.messageType === 'SYSTEM') {
        setDecryptedMessagesById((previousValue) => ({
          ...previousValue,
          [messageId]: message.encryptedPayload ?? '',
        }));
        return;
      }

      if (message.encryptionType === 'GROUP' && message.encryptedPayload) {
        decryptingMessageIdsRef.current.add(messageId);

        const localDecryptDeviceIds = new Set([deviceId, ...restoredDeviceIds].filter(Boolean));
        const currentDevicePayloads = message.devicePayloads.filter((devicePayload) => localDecryptDeviceIds.has(devicePayload.targetDeviceId));

        const decryptGroupMessageWithAvailableKey = async () => {
          const directDecryptErrors: unknown[] = [];

          try {
            const directDecryptResponse = await vectorCrypto.decryptGroupMessage({
              accountId,
              deviceId,
              chatId: message.chatId,
              messageId,
              encryptedPayload: message.encryptedPayload!,
            });

            if (!directDecryptResponse.plainText) {
              throw new Error('Group key is not available on this device. Restore key backup or receive a key distribution package.');
            }

            return directDecryptResponse;
          }
          catch (firstError) {
            directDecryptErrors.push(firstError);
          }

          for (const currentDevicePayload of currentDevicePayloads) {
            try {
              const groupKeyPackage = await vectorCrypto.decryptMessage({
                accountId,
                deviceId: currentDevicePayload.targetDeviceId,
                messageId: `${messageId}:group-key:${currentDevicePayload.targetDeviceId}`,
                remoteDeviceId: message.senderDeviceId,
                ciphertextType: currentDevicePayload.ciphertextType,
                encryptedPayload: currentDevicePayload.encryptedPayload,
              });

              await vectorCrypto.importGroupKey({
                accountId,
                chatId: message.chatId,
                groupKeyPackagePlainText: groupKeyPackage.plainText,
              });

              const decryptResponseAfterImport = await vectorCrypto.decryptGroupMessage({
                accountId,
                deviceId,
                chatId: message.chatId,
                messageId,
                encryptedPayload: message.encryptedPayload!,
              });

              if (!decryptResponseAfterImport.plainText) {
                throw new Error('Group key is not available on this device. Restore key backup or receive a key distribution package.');
              }

              return decryptResponseAfterImport;
            }
            catch (candidateError) {
              directDecryptErrors.push(candidateError);
            }
          }

          throw directDecryptErrors.at(-1) ?? new Error('Group key is not available on this device.');
        };

        decryptGroupMessageWithAvailableKey()
          .then((decryptResponse) => {
            const plainText = decryptResponse.plainText;

            if (!plainText) {
              throw new Error('Group key is not available on this device. Restore key backup or receive a key distribution package.');
            }

            temporarilyMissingGroupKeyMessageIdsRef.current.delete(messageId);
            setDecryptedMessagesById((previousValue) => ({
              ...previousValue,
              [messageId]: plainText,
            }));
          })
          .catch((error) => {
            const errorMessageText = error instanceof Error ? error.message : String(error);
            const isMissingGroupKey = errorMessageText.includes('Group key is not available');

            if (isMissingGroupKey) {
              temporarilyMissingGroupKeyMessageIdsRef.current.add(messageId);
              console.warn(errorMessageText);
            }
            else {
              failedDirectDecryptionMessageIdsRef.current.add(messageId);
              console.warn('Message decryption failed once and will not be retried automatically.', error);
            }

            setDecryptedMessagesById((previousValue) => {
              const previousPlainText = previousValue[messageId];

              if (previousPlainText && !isDecryptionPlaceholder(previousPlainText)) {
                return previousValue;
              }

              return {
                ...previousValue,
                [messageId]: isMissingGroupKey ? '[Ключ группы пока недоступен]' : '[Не удалось расшифровать сообщение]',
              };
            });
          })
          .finally(() => {
            decryptingMessageIdsRef.current.delete(messageId);
          });
        return;
      }

      const localDecryptDeviceIds = new Set([deviceId, ...restoredDeviceIds].filter(Boolean));
      const currentDevicePayloads = message.devicePayloads.filter((devicePayload) => localDecryptDeviceIds.has(devicePayload.targetDeviceId));

      if (currentDevicePayloads.length === 0) {
        permanentlyUnavailableMessageIdsRef.current.add(messageId);
        setDecryptedMessagesById((previousValue) => {
          if (previousValue[messageId]) {
            return previousValue;
          }

          return {
            ...previousValue,
            [messageId]: '[Сообщение недоступно для этого устройства]',
          };
        });
        return;
      }

      decryptingMessageIdsRef.current.add(messageId);

      decryptDirectMessageWithAvailablePayloads(message, currentDevicePayloads, accountId, vectorCrypto)
        .then(async (decryptResponse) => {
          if (message.messageType === 'GROUP_KEY_DISTRIBUTION') {
            await vectorCrypto.importGroupKey({
              accountId,
              chatId: message.chatId,
              groupKeyPackagePlainText: decryptResponse.plainText,
            });

            temporarilyMissingGroupKeyMessageIdsRef.current.clear();
            setDecryptedMessagesById((previousValue) => {
              const nextValue = { ...previousValue, [messageId]: '[Ключ группы обновлён]' };

              Object.keys(nextValue).forEach((cachedMessageId) => {
                if (nextValue[cachedMessageId] === '[Ключ группы пока недоступен]') {
                  delete nextValue[cachedMessageId];
                }
              });

              return nextValue;
            });
            return;
          }

          setDecryptedMessagesById((previousValue) => ({
            ...previousValue,
            [messageId]: decryptResponse.plainText,
          }));
        })
        .catch((error) => {
          failedDirectDecryptionMessageIdsRef.current.add(messageId);
          console.warn('Message decryption failed once and will not be retried automatically.', error);
          setDecryptedMessagesById((previousValue) => {
            const previousPlainText = previousValue[messageId];

            if (previousPlainText && !isDecryptionPlaceholder(previousPlainText)) {
              return previousValue;
            }

            return {
              ...previousValue,
              [messageId]: '[Не удалось расшифровать сообщение]',
            };
          });
        })
        .finally(() => {
          decryptingMessageIdsRef.current.delete(messageId);
        });
    });
  }, [accountId, decryptedMessagesById, deviceId, loadedMessages, restoredDeviceIds]);

  return {
    decryptedMessagesById,
    setDecryptedMessagesById,
    resetDecryptionState,
    clearTemporarilyMissingGroupKeys,
  };
}
