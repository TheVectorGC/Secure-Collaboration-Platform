import { messagingHttpClient } from '../../../shared/api/httpClient';
import type { ChatResponseDto, CreateDirectChatRequestDto } from '../../../shared/types/api';

export async function getChats(): Promise<ChatResponseDto[]> {
  const response = await messagingHttpClient.get<ChatResponseDto[]>('/api/v1/chats');
  return response.data;
}

export async function getChat(chatId: string): Promise<ChatResponseDto> {
  const response = await messagingHttpClient.get<ChatResponseDto>(`/api/v1/chats/${chatId}`);
  return response.data;
}

export async function createSelfChat(): Promise<ChatResponseDto> {
  const response = await messagingHttpClient.post<ChatResponseDto>('/api/v1/chats/self');
  return response.data;
}

export async function createDirectChat(request: CreateDirectChatRequestDto): Promise<ChatResponseDto> {
  const response = await messagingHttpClient.post<ChatResponseDto>('/api/v1/chats/direct', request);
  return response.data;
}
