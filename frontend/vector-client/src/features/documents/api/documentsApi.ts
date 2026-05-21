import { documentHttpClient } from '../../../shared/api/httpClient';
import type {
  CreateDocumentRequestDto,
  DocumentResponseDto,
  DocumentSigningKeyResponseDto,
  RegisterDocumentSigningKeyRequestDto,
  RejectDocumentRequestDto,
  SignDocumentRequestDto,
} from '../../../shared/types/api';

export async function createDocument(request: CreateDocumentRequestDto): Promise<DocumentResponseDto> {
  const response = await documentHttpClient.post<DocumentResponseDto>('/api/v1/documents', request);
  return response.data;
}

export async function getDocuments(): Promise<DocumentResponseDto[]> {
  const response = await documentHttpClient.get<DocumentResponseDto[]>('/api/v1/documents');
  return response.data;
}

export async function getChatDocuments(chatId: string): Promise<DocumentResponseDto[]> {
  const response = await documentHttpClient.get<DocumentResponseDto[]>(`/api/v1/chats/${chatId}/documents`);
  return response.data;
}

export async function getDocument(documentId: string): Promise<DocumentResponseDto> {
  const response = await documentHttpClient.get<DocumentResponseDto>(`/api/v1/documents/${documentId}`);
  return response.data;
}

export async function registerDocumentSigningKey(
  deviceId: string,
  request: RegisterDocumentSigningKeyRequestDto,
): Promise<DocumentSigningKeyResponseDto> {
  const response = await documentHttpClient.post<DocumentSigningKeyResponseDto>(`/api/v1/document-signing/devices/${deviceId}/keys`, request);
  return response.data;
}

export async function signDocument(documentId: string, request: SignDocumentRequestDto): Promise<DocumentResponseDto> {
  const response = await documentHttpClient.post<DocumentResponseDto>(`/api/v1/documents/${documentId}/signatures`, request);
  return response.data;
}

export async function rejectDocument(documentId: string, request: RejectDocumentRequestDto): Promise<DocumentResponseDto> {
  const response = await documentHttpClient.patch<DocumentResponseDto>(`/api/v1/documents/${documentId}/reject`, request);
  return response.data;
}

export async function hideDocument(documentId: string): Promise<void> {
  await documentHttpClient.patch(`/api/v1/documents/${documentId}/hide`);
}

export async function cancelDocument(documentId: string, request: RejectDocumentRequestDto): Promise<DocumentResponseDto> {
  const response = await documentHttpClient.patch<DocumentResponseDto>(`/api/v1/documents/${documentId}/cancel`, request);
  return response.data;
}
