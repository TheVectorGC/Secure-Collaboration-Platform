export type DevicePlatform = 'WINDOWS' | 'MACOS' | 'LINUX' | 'ANDROID' | 'IOS' | 'WEB';

export type LoginRequestDto = {
  login: string;
  password: string;
  deviceId: string | null;
  clientInstallationId?: string | null;
  deviceName: string | null;
  platform: DevicePlatform | null;
  clientVersion: string | null;
};

export type RefreshTokenRequestDto = {
  refreshToken: string;
};

export type LogoutRequestDto = {
  refreshToken: string;
};

export type AuthenticationResponseDto = {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  accessTokenExpiresAt: string;
  sessionId: string;
  deviceId?: string | null;
};

export type DeviceResponseDto = {
  deviceId?: string;
  id?: string;
  deviceName: string;
  platform: DevicePlatform;
  status: string;
  clientVersion: string | null;
  lastSeenAt: string | null;
  createdAt: string;
};

export type ActiveDeviceResponseDto = {
  deviceId: string;
  accountId: string;
  deviceName: string;
  platform: DevicePlatform;
  lastSeenAt: string | null;
  status?: string | null;
  clientVersion?: string | null;
};

export type ProfileResponseDto = {
  accountId: string;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  middleName?: string | null;
  status?: string;
  avatarType?: string;
  avatarFileId?: string | null;
};

export type CreateAccountRegistrationRequestDto = {
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  middleName: string | null;
  expiresAt: string;
};

export type AccountRegistrationResponseDto = {
  registrationId: string;
  username: string;
  email: string;
  registrationToken: string;
  expiresAt: string;
};

export type CompleteRegistrationRequestDto = {
  registrationToken: string;
  password: string;
  passwordConfirmation: string;
};

export type CreateDirectChatRequestDto = {
  recipientAccountId: string;
};

export type CreateGroupChatRequestDto = {
  name: string;
  participantAccountIds: string[];
};

export type GroupHistoryAccessMode = 'FULL_HISTORY' | 'NEW_MESSAGES_ONLY' | 'FROM_MESSAGE';

export type AddGroupParticipantRequestDto = {
  accountId: string;
  historyAccessMode: GroupHistoryAccessMode;
  historyVisibleFromMessageId?: string | null;
};

export type ChatType = 'DIRECT' | 'SELF' | 'GROUP';
export type ChatParticipantRole = 'OWNER' | 'MEMBER';
export type ChatParticipantStatus = 'ACTIVE' | 'LEFT' | 'REMOVED';

export type ChatParticipantVisibilityWindowResponseDto = {
  visibleFromCreatedAt: string | null;
  visibleUntilCreatedAt: string | null;
};

export type ChatParticipantResponseDto = {
  accountId: string;
  role: ChatParticipantRole;
  status: ChatParticipantStatus;
  historyVisibleFromMessageId: string | null;
  historyVisibleFromCreatedAt: string | null;
  joinedAt: string;
  removedAt: string | null;
  visibilityWindows?: ChatParticipantVisibilityWindowResponseDto[];
};

export type ChatResponseDto = {
  chatId: string;
  type: ChatType;
  name: string | null;
  currentKeyEpoch: number;
  participantAccountIds: string[];
  participants: ChatParticipantResponseDto[];
  lastMessageId: string | null;
  lastMessageCreatedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type MessageCiphertextType = 'PRE_KEY' | 'SIGNAL' | 'LOCAL';
export type MessageEncryptionType = 'SIGNAL' | 'GROUP' | 'NONE';
export type MessageType = 'TEXT' | 'FILE' | 'IMAGE' | 'DOCUMENT' | 'GROUP_KEY_DISTRIBUTION' | 'SYSTEM';

export type DeviceMessagePayloadRequestDto = {
  targetAccountId: string;
  targetDeviceId: string;
  ciphertextType: MessageCiphertextType;
  encryptedPayload: string;
};

export type SendMessageRequestDto = {
  senderDeviceId: string;
  clientMessageId: string;
  messageType: MessageType;
  encryptionType: MessageEncryptionType;
  encryptedPayload?: string | null;
  devicePayloads: DeviceMessagePayloadRequestDto[];
};

export type MessageDeliveryStatus = 'SENT' | 'DELIVERED' | 'READ';

export type MessageDeliveryStateResponseDto = {
  accountId: string;
  status: MessageDeliveryStatus;
  deliveredAt: string | null;
  readAt: string | null;
};

export type MessageDevicePayloadResponseDto = {
  targetAccountId: string;
  targetDeviceId: string;
  ciphertextType: MessageCiphertextType;
  encryptedPayload: string;
};

export type MessageResponseDto = {
  messageId: string;
  chatId: string;
  senderAccountId: string;
  senderDeviceId: string;
  clientMessageId: string | null;
  messageType: MessageType;
  encryptionType: MessageEncryptionType;
  encryptedPayload: string | null;
  devicePayloads: MessageDevicePayloadResponseDto[];
  createdAt: string;
  deliveryStates: MessageDeliveryStateResponseDto[];
};

export type MediaFileResponseDto = {
  id: string;
  chatId: string;
  uploaderAccountId: string;
  encryptedSizeBytes: number;
  encryptedSha256Base64: string;
  createdAt: string;
};

export type UploadEncryptedMediaRequestDto = {
  chatId: string;
  encryptedSha256Base64: string;
};

export type FileEncryptionMetadata = {
  algorithm: 'AES-256-GCM';
  keyBase64: string;
  initializationVectorBase64: string;
};

export type FileAttachmentMessageContent = {
  kind: 'FILE_ATTACHMENT';
  version: 1;
  attachmentDisplayMode: 'FILE' | 'IMAGE';
  mediaFileId: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  encryptedSizeBytes: number;
  plaintextSha256Base64: string;
  encryptedSha256Base64: string;
  fileEncryption: FileEncryptionMetadata;
};

export type DocumentAttachmentMessageContent = {
  kind: 'DOCUMENT_ATTACHMENT';
  version: 1;
  documentId: string;
  mediaFileId: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  encryptedSizeBytes: number;
  plaintextSha256Base64: string;
  encryptedSha256Base64: string;
  fileEncryption: FileEncryptionMetadata;
};

export type CreateDocumentRequestDto = {
  chatId: string;
  mediaFileId: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  plaintextSha256Base64: string;
  encryptedSha256Base64: string;
};

export type DocumentStatus = 'ACTIVE' | 'REJECTED';
export type SignatureAlgorithm = 'ED25519';
export type DocumentSigningKeyStatus = 'ACTIVE' | 'REVOKED';

export type DocumentSignatureResponseDto = {
  signatureId: string;
  documentId: string;
  signerAccountId: string;
  signerDeviceId: string;
  signingKeyFingerprint: string;
  algorithm: SignatureAlgorithm;
  documentHashBase64: string;
  signatureBase64: string;
  signedAt: string;
};

export type DocumentResponseDto = {
  documentId: string;
  chatId: string;
  mediaFileId: string;
  ownerAccountId: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  plaintextSha256Base64: string;
  encryptedSha256Base64: string;
  status: DocumentStatus;
  rejectedByAccountId: string | null;
  rejectedAt: string | null;
  createdAt: string;
  updatedAt: string;
  signatures: DocumentSignatureResponseDto[];
};

export type RegisterDocumentSigningKeyRequestDto = {
  publicKeyBase64: string;
};

export type DocumentSigningKeyResponseDto = {
  keyId: string;
  accountId: string;
  deviceId: string;
  algorithm: SignatureAlgorithm;
  publicKeyBase64: string;
  fingerprint: string;
  status: DocumentSigningKeyStatus;
  createdAt: string;
};

export type SignDocumentRequestDto = {
  signerDeviceId: string;
  signingKeyFingerprint: string;
  documentHashBase64: string;
  signatureBase64: string;
};

export type RealtimeEventType = 'MESSAGE_CREATED' | 'MESSAGE_DELIVERED' | 'MESSAGE_READ' | 'CHAT_UPDATED' | 'TYPING';

export type RealtimeEventDto = {
  eventId: string;
  type: RealtimeEventType;
  occurredAt: string;
  payload: unknown;
};

export type MessageCreatedPayload = {
  chatId: string;
  messageId: string;
  senderAccountId: string;
  senderDeviceId: string;
  messageType: MessageType;
  encryptionType: MessageEncryptionType;
  encryptedPayload?: string | null;
  devicePayloads?: MessageDevicePayloadResponseDto[];
  createdAt: string;
};

export type MessageDeliveredPayload = {
  chatId: string;
  messageId: string;
  deliveredByAccountId: string;
  deliveredAt: string;
};

export type MessageReadPayload = {
  chatId: string;
  lastReadMessageId: string;
  readByAccountId: string;
  readAt: string;
};

export type ChatUpdatedPayload = {
  chat: ChatResponseDto;
};

export type TypingPayload = {
  chatId: string;
  typingAccountId: string;
  username: string;
  isTyping: boolean;
};
