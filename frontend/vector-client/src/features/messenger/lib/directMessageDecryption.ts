import type { MessageResponseDto } from '../../../shared/types/api';
export async function decryptDirectMessageWithAvailablePayloads(
  message: MessageResponseDto,
  currentDevicePayloads: MessageResponseDto['devicePayloads'],
  accountId: string,
  vectorCrypto: NonNullable<typeof window.vectorCrypto>,
) {
  const errors: unknown[] = [];

  for (const currentDevicePayload of currentDevicePayloads) {
    try {
      const decryptResponse = await vectorCrypto.decryptMessage({
        accountId,
        deviceId: currentDevicePayload.targetDeviceId,
        messageId: message.messageId,
        remoteDeviceId: message.senderDeviceId,
        ciphertextType: currentDevicePayload.ciphertextType,
        encryptedPayload: currentDevicePayload.encryptedPayload,
        allowFailure: true,
      });

      if (!decryptResponse.plainText) {
        throw new Error(decryptResponse.errorMessage || 'Message payload cannot be decrypted by this local key.');
      }

      return decryptResponse;
    }
    catch (error) {
      errors.push(error);
    }
  }

  throw errors.at(-1) ?? new Error('No decryptable payload is available for this message.');
}
