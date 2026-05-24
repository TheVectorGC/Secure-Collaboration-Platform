import { messagingHttpClient } from '../../../shared/api/httpClient';
import type { MessageReactionResponseDto, SetMessageReactionRequestDto } from '../../../shared/types/api';

export async function setMessageReaction(chatId: string, messageId: string, request: SetMessageReactionRequestDto): Promise<MessageReactionResponseDto> {
  const response = await messagingHttpClient.put<MessageReactionResponseDto>(`/api/v1/chats/${chatId}/messages/${messageId}/reaction`, request);
  return response.data;
}

export async function removeMessageReaction(chatId: string, messageId: string): Promise<void> {
  await messagingHttpClient.delete(`/api/v1/chats/${chatId}/messages/${messageId}/reaction`);
}
