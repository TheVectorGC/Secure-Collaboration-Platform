import { mediaHttpClient } from '../../../shared/api/httpClient';
import type { MediaFileResponseDto } from '../../../shared/types/api';

export async function uploadEncryptedMediaFile(
  chatId: string | null,
  encryptedFile: Blob,
  encryptedSha256Base64: string,
  accessAccountIds: string[] = [],
): Promise<MediaFileResponseDto> {
  const formData = new FormData();
  formData.append('file', encryptedFile, 'encrypted-media.bin');
  formData.append(
    'metadata',
    new Blob([JSON.stringify({ chatId, encryptedSha256Base64, accessAccountIds })], { type: 'application/json' }),
  );

  const response = await mediaHttpClient.post<MediaFileResponseDto>('/api/v1/media/files', formData);
  return response.data;
}

export async function downloadEncryptedMediaFile(mediaFileId: string): Promise<ArrayBuffer> {
  const response = await mediaHttpClient.get<ArrayBuffer>(`/api/v1/media/files/${mediaFileId}/download`, {
    responseType: 'arraybuffer',
  });

  return response.data;
}
