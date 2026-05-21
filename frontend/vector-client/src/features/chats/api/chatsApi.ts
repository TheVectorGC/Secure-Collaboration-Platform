import { messagingHttpClient } from '../../../shared/api/httpClient';
import type { AddGroupParticipantRequestDto, ChatResponseDto, CreateDirectChatRequestDto, CreateGroupChatRequestDto, UpdateGroupAvatarRequestDto } from '../../../shared/types/api';

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


export async function createGroupChat(request: CreateGroupChatRequestDto): Promise<ChatResponseDto> {
  const response = await messagingHttpClient.post<ChatResponseDto>('/api/v1/chats/groups', request);
  return response.data;
}

export async function addGroupParticipant(chatId: string, request: AddGroupParticipantRequestDto): Promise<ChatResponseDto> {
  const response = await messagingHttpClient.post<ChatResponseDto>(`/api/v1/chats/${chatId}/participants`, request);
  return response.data;
}

export async function removeGroupParticipant(chatId: string, participantAccountId: string): Promise<ChatResponseDto> {
  const response = await messagingHttpClient.delete<ChatResponseDto>(`/api/v1/chats/${chatId}/participants/${participantAccountId}`);
  return response.data;
}

export async function updateGroupChatAvatar(chatId: string, request: UpdateGroupAvatarRequestDto): Promise<ChatResponseDto> {
  const response = await messagingHttpClient.put<ChatResponseDto>(`/api/v1/chats/${chatId}/avatar`, request);
  return response.data;
}
