import { messagingHttpClient } from '../../../shared/api/httpClient';
import type { ChatResponseDto, UpdateGroupAvatarRequestDto } from '../../../shared/types/api';

export async function updateGroupChatAvatar(chatId: string, request: UpdateGroupAvatarRequestDto): Promise<ChatResponseDto> {
  const response = await messagingHttpClient.put<ChatResponseDto>(`/api/v1/chats/${chatId}/avatar`, request);
  return response.data;
}
