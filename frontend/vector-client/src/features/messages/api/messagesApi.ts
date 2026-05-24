import { messagingHttpClient } from '../../../shared/api/httpClient';
import type { EditMessageRequestDto, MessageResponseDto, SendMessageRequestDto } from '../../../shared/types/api';

export async function getChatMessages(chatId: string): Promise<MessageResponseDto[]> {
  const response = await messagingHttpClient.get<MessageResponseDto[]>(`/api/v1/chats/${chatId}/messages`);
  return response.data;
}

export async function sendMessage(chatId: string, request: SendMessageRequestDto): Promise<MessageResponseDto> {
  const response = await messagingHttpClient.post<MessageResponseDto>(`/api/v1/chats/${chatId}/messages`, request);
  return response.data;
}

export async function editMessage(chatId: string, messageId: string, request: EditMessageRequestDto): Promise<MessageResponseDto> {
  const response = await messagingHttpClient.patch<MessageResponseDto>(`/api/v1/chats/${chatId}/messages/${messageId}`, request);
  return response.data;
}

export async function markMessageDelivered(chatId: string, messageId: string): Promise<void> {
  await messagingHttpClient.patch(`/api/v1/chats/${chatId}/messages/${messageId}/delivered`);
}

export async function markChatRead(chatId: string, messageId: string): Promise<void> {
  await messagingHttpClient.patch(`/api/v1/chats/${chatId}/messages/read`, { messageId });
}
