import type { DocumentAttachmentMessageContent, FileAttachmentMessageContent } from '../../../shared/types/api';

const AES_GCM_IV_BYTES = 12;
const AES_KEY_BYTES = 32;

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000;

  for (let index = 0; index < bytes.length; index += chunkSize) {
    const chunk = bytes.subarray(index, index + chunkSize);
    binary += String.fromCharCode(...chunk);
  }

  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index++) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

export async function sha256Base64(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', toArrayBuffer(bytes));
  return bytesToBase64(new Uint8Array(digest));
}

export type EncryptedFileResult = {
  encryptedBlob: Blob;
  encryptedBytes: Uint8Array;
  plaintextSha256Base64: string;
  encryptedSha256Base64: string;
  keyBase64: string;
  initializationVectorBase64: string;
};

export async function encryptFileForUpload(file: File): Promise<EncryptedFileResult> {
  const plaintextBytes = new Uint8Array(await file.arrayBuffer());
  const keyBytes = crypto.getRandomValues(new Uint8Array(AES_KEY_BYTES));
  const initializationVectorBytes = crypto.getRandomValues(new Uint8Array(AES_GCM_IV_BYTES));
  const cryptoKey = await crypto.subtle.importKey('raw', toArrayBuffer(keyBytes), 'AES-GCM', false, ['encrypt']);
  const encryptedBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: toArrayBuffer(initializationVectorBytes) },
    cryptoKey,
    toArrayBuffer(plaintextBytes),
  );
  const encryptedBytes = new Uint8Array(encryptedBuffer);

  return {
    encryptedBlob: new Blob([encryptedBytes], { type: 'application/octet-stream' }),
    encryptedBytes,
    plaintextSha256Base64: await sha256Base64(plaintextBytes),
    encryptedSha256Base64: await sha256Base64(encryptedBytes),
    keyBase64: bytesToBase64(keyBytes),
    initializationVectorBase64: bytesToBase64(initializationVectorBytes),
  };
}

export async function decryptDownloadedFile(
  encryptedBytes: ArrayBuffer,
  attachment: FileAttachmentMessageContent | DocumentAttachmentMessageContent,
): Promise<Blob> {
  const keyBytes = base64ToBytes(attachment.fileEncryption.keyBase64);
  const initializationVectorBytes = base64ToBytes(attachment.fileEncryption.initializationVectorBase64);
  const encryptedByteArray = new Uint8Array(encryptedBytes);
  const encryptedSha256Base64 = await sha256Base64(encryptedByteArray);

  if (encryptedSha256Base64 !== attachment.encryptedSha256Base64) {
    throw new Error('Encrypted file checksum mismatch.');
  }

  const cryptoKey = await crypto.subtle.importKey('raw', toArrayBuffer(keyBytes), 'AES-GCM', false, ['decrypt']);
  const plaintextBuffer = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: toArrayBuffer(initializationVectorBytes) },
    cryptoKey,
    toArrayBuffer(encryptedByteArray),
  );
  const plaintextBytes = new Uint8Array(plaintextBuffer);
  const plaintextSha256Base64 = await sha256Base64(plaintextBytes);

  if (plaintextSha256Base64 !== attachment.plaintextSha256Base64) {
    throw new Error('Decrypted file checksum mismatch.');
  }

  return new Blob([plaintextBytes], { type: attachment.mimeType || 'application/octet-stream' });
}

export function buildFileAttachmentContent(
  file: File,
  mediaFileId: string,
  encryptedSizeBytes: number,
  encryptionResult: EncryptedFileResult,
  attachmentDisplayMode: 'FILE' | 'IMAGE',
): FileAttachmentMessageContent {
  return {
    kind: 'FILE_ATTACHMENT',
    version: 1,
    attachmentDisplayMode,
    mediaFileId,
    fileName: file.name,
    mimeType: file.type || 'application/octet-stream',
    sizeBytes: file.size,
    encryptedSizeBytes,
    plaintextSha256Base64: encryptionResult.plaintextSha256Base64,
    encryptedSha256Base64: encryptionResult.encryptedSha256Base64,
    fileEncryption: {
      algorithm: 'AES-256-GCM',
      keyBase64: encryptionResult.keyBase64,
      initializationVectorBase64: encryptionResult.initializationVectorBase64,
    },
  };
}


export function buildDocumentAttachmentContent(
  file: File,
  documentId: string,
  mediaFileId: string,
  encryptedSizeBytes: number,
  encryptionResult: EncryptedFileResult,
): DocumentAttachmentMessageContent {
  return {
    kind: 'DOCUMENT_ATTACHMENT',
    version: 1,
    documentId,
    mediaFileId,
    fileName: file.name,
    mimeType: file.type || 'application/octet-stream',
    sizeBytes: file.size,
    encryptedSizeBytes,
    plaintextSha256Base64: encryptionResult.plaintextSha256Base64,
    encryptedSha256Base64: encryptionResult.encryptedSha256Base64,
    fileEncryption: {
      algorithm: 'AES-256-GCM',
      keyBase64: encryptionResult.keyBase64,
      initializationVectorBase64: encryptionResult.initializationVectorBase64,
    },
  };
}

export function parseDocumentAttachmentMessageContent(value: string): DocumentAttachmentMessageContent | null {
  try {
    const parsedValue = JSON.parse(value) as Partial<DocumentAttachmentMessageContent>;

    if (parsedValue.kind !== 'DOCUMENT_ATTACHMENT' || parsedValue.version !== 1) {
      return null;
    }

    if (
      typeof parsedValue.documentId !== 'string' ||
      typeof parsedValue.mediaFileId !== 'string' ||
      typeof parsedValue.fileName !== 'string' ||
      typeof parsedValue.mimeType !== 'string' ||
      typeof parsedValue.sizeBytes !== 'number' ||
      typeof parsedValue.encryptedSizeBytes !== 'number' ||
      typeof parsedValue.plaintextSha256Base64 !== 'string' ||
      typeof parsedValue.encryptedSha256Base64 !== 'string' ||
      parsedValue.fileEncryption?.algorithm !== 'AES-256-GCM' ||
      typeof parsedValue.fileEncryption.keyBase64 !== 'string' ||
      typeof parsedValue.fileEncryption.initializationVectorBase64 !== 'string'
    ) {
      return null;
    }

    return parsedValue as DocumentAttachmentMessageContent;
  }
  catch {
    return null;
  }
}

export function parseFileAttachmentMessageContent(value: string): FileAttachmentMessageContent | null {
  try {
    const parsedValue = JSON.parse(value) as Partial<FileAttachmentMessageContent>;

    if (parsedValue.kind !== 'FILE_ATTACHMENT' || parsedValue.version !== 1) {
      return null;
    }

    const attachmentDisplayMode = parsedValue.attachmentDisplayMode === 'IMAGE' ? 'IMAGE' : 'FILE';

    if (
      typeof parsedValue.mediaFileId !== 'string' ||
      typeof parsedValue.fileName !== 'string' ||
      typeof parsedValue.mimeType !== 'string' ||
      typeof parsedValue.sizeBytes !== 'number' ||
      typeof parsedValue.encryptedSizeBytes !== 'number' ||
      typeof parsedValue.plaintextSha256Base64 !== 'string' ||
      typeof parsedValue.encryptedSha256Base64 !== 'string' ||
      parsedValue.fileEncryption?.algorithm !== 'AES-256-GCM' ||
      typeof parsedValue.fileEncryption.keyBase64 !== 'string' ||
      typeof parsedValue.fileEncryption.initializationVectorBase64 !== 'string'
    ) {
      return null;
    }

    return {
      ...parsedValue,
      attachmentDisplayMode,
    } as FileAttachmentMessageContent;
  }
  catch {
    return null;
  }
}

export function formatFileSize(sizeBytes: number): string {
  if (sizeBytes < 1024) {
    return `${sizeBytes} B`;
  }

  if (sizeBytes < 1024 * 1024) {
    return `${(sizeBytes / 1024).toFixed(1)} KB`;
  }

  return `${(sizeBytes / 1024 / 1024).toFixed(1)} MB`;
}
