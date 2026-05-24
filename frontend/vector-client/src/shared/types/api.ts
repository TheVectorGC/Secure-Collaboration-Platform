export type DevicePlatform = 'WINDOWS' | 'MACOS' | 'LINUX' | 'ANDROID' | 'IOS' | 'WEB';

export type LoginRequestDto = {
  login: string;
  password: string;
  deviceId: string | null;
  clientInstallationId?: string | null;
  deviceName: string | null;
  platform: DevicePlatform | null;
  clientVersion: string | null;
  osName?: string | null;
  osVersion?: string | null;
  architecture?: string | null;
  hostname?: string | null;
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

export type DeviceRevokedPayload = {
  accountId: string;
  deviceId: string;
};

export type DeviceResponseDto = {
  deviceId?: string;
  id?: string;
  deviceName: string;
  platform: DevicePlatform;
  status: string;
  clientVersion: string | null;
  osName: string | null;
  osVersion: string | null;
  architecture: string | null;
  hostname: string | null;
  deviceFingerprint: string | null;
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
  osName?: string | null;
  osVersion?: string | null;
  architecture?: string | null;
  hostname?: string | null;
  deviceFingerprint?: string | null;
};

export type UpdateDeviceMetadataRequestDto = {
  deviceName?: string | null;
  platform?: DevicePlatform | null;
  clientVersion?: string | null;
  osName?: string | null;
  osVersion?: string | null;
  architecture?: string | null;
  hostname?: string | null;
  deviceFingerprint?: string | null;
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
  avatarDataUrl?: string | null;
};


export type BlockAccountRequestDto = {
  blockedAccountId: string;
};

export type AccountBlockResponseDto = {
  blockId: string;
  blockerAccountId: string;
  blockedAccountId: string;
  createdAt: string;
};

export type UpdateProfileAvatarRequestDto = {
  avatarDataUrl: string | null;
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

export type UpdateGroupAvatarRequestDto = {
  avatarDataUrl: string | null;
};


export type UpsertGroupEpochKeyEnvelopeRequestDto = {
  epoch: number;
  targetAccountId: string;
  senderDeviceId: string;
  algorithm: string;
  encryptedKeyBase64: string;
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
  avatarDataUrl?: string | null;
  currentKeyEpoch: number;
  participantAccountIds: string[];
  participants: ChatParticipantResponseDto[];
  lastMessageId: string | null;
  lastMessageCreatedAt: string | null;
  createdAt: string;
  updatedAt: string;
  currentAccountBlockedCompanion: boolean;
  companionBlockedCurrentAccount: boolean;
};

export type MessageCiphertextType = 'PRE_KEY' | 'SIGNAL' | 'LOCAL';
export type MessageEncryptionType = 'CONTENT' | 'GROUP' | 'NONE';
export type MessageType = 'TEXT' | 'FILE' | 'IMAGE' | 'DOCUMENT' | 'SYSTEM';

export type DeviceMessagePayloadRequestDto = {
  targetAccountId: string;
  targetDeviceId: string;
  ciphertextType: MessageCiphertextType;
  encryptedPayload: string;
};

export type AccountKeyEnvelopeRequestDto = {
  targetAccountId: string;
  algorithm: string;
  encryptedKeyBase64: string;
};

export type SendMessageRequestDto = {
  senderDeviceId: string;
  clientMessageId: string;
  messageType: MessageType;
  encryptionType: MessageEncryptionType;
  encryptedPayload: string;
  contentAlgorithm: 'AES-256-GCM';
  contentInitializationVectorBase64: string;
  contentAuthenticationTagBase64: string;
  groupKeyEpoch?: number | null;
  devicePayloads: DeviceMessagePayloadRequestDto[];
  accountKeyEnvelopes: AccountKeyEnvelopeRequestDto[];
};

export type MessageDeliveryStatus = 'SENT' | 'DELIVERED' | 'READ';

export type MessageDeliveryStateResponseDto = {
  accountId: string;
  status: MessageDeliveryStatus;
  deliveredAt: string | null;
  readAt: string | null;
};

export type MessageReactionResponseDto = {
  messageId: string;
  accountId: string;
  emoji: string;
  createdAt: string;
  updatedAt: string;
};

export type SetMessageReactionRequestDto = {
  emoji: string;
};

export type MessageDevicePayloadResponseDto = {
  targetAccountId: string;
  targetDeviceId: string;
  ciphertextType: MessageCiphertextType;
  encryptedPayload: string;
};

export type AccountKeyEnvelopeResponseDto = {
  targetAccountId: string;
  senderDeviceId?: string | null;
  algorithm: string;
  encryptedKeyBase64: string;
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
  contentAlgorithm: 'AES-256-GCM' | null;
  contentInitializationVectorBase64: string | null;
  contentAuthenticationTagBase64: string | null;
  groupKeyEpoch: number | null;
  devicePayloads: MessageDevicePayloadResponseDto[];
  accountKeyEnvelopes: AccountKeyEnvelopeResponseDto[];
  groupEpochKeyEnvelope: AccountKeyEnvelopeResponseDto | null;
  createdAt: string;
  deliveryStates: MessageDeliveryStateResponseDto[];
  reactions: MessageReactionResponseDto[];
};

export type MediaFileResponseDto = {
  id: string;
  chatId: string | null;
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

export type DocumentKeyEnvelopeRequestDto = {
  targetAccountId: string;
  targetDeviceId: string | null;
  algorithm: 'RSA-OAEP-SHA256';
  encryptedKeyBase64: string;
};

export type DocumentKeyEnvelopeResponseDto = {
  envelopeId: string;
  documentId: string;
  targetAccountId: string;
  targetDeviceId: string | null;
  algorithm: 'RSA-OAEP-SHA256';
  encryptedKeyBase64: string;
};

export type DocumentFileEncryptionRequestDto = {
  algorithm: 'AES-256-GCM';
  initializationVectorBase64: string;
  keyEnvelopes: DocumentKeyEnvelopeRequestDto[];
};

export type DocumentFileEncryptionResponseDto = {
  algorithm: 'AES-256-GCM';
  initializationVectorBase64: string;
  keyEnvelopes: DocumentKeyEnvelopeResponseDto[];
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
  chatId: string | null;
  mediaFileId: string;
  title: string;
  description: string | null;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  plaintextSha256Base64: string;
  encryptedSha256Base64: string;
  requiredSignerAccountIds: string[];
  observerAccountIds: string[];
  fileEncryption: DocumentFileEncryptionRequestDto;
};

export type DocumentStatus = 'ACTIVE' | 'PENDING_SIGNATURES' | 'PARTIALLY_SIGNED' | 'FULLY_SIGNED' | 'REJECTED' | 'CANCELLED';
export type DocumentSignerStatus = 'PENDING' | 'SIGNED' | 'REJECTED';
export type DocumentObserverRole = 'OBSERVER';
export type SignatureAlgorithm = 'ED25519';
export type DocumentSigningKeyStatus = 'ACTIVE' | 'REVOKED';

export type DocumentSignerResponseDto = {
  signerId?: string;
  signerAccountId: string;
  status: DocumentSignerStatus;
  signedAt: string | null;
  rejectedAt: string | null;
  rejectionReason: string | null;
};

export type DocumentObserverResponseDto = {
  observerId?: string;
  observerAccountId: string;
  role: DocumentObserverRole;
  addedAt: string;
};

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
  chatId: string | null;
  mediaFileId: string;
  ownerAccountId: string;
  title: string;
  description: string | null;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  plaintextSha256Base64: string;
  encryptedSha256Base64: string;
  fileEncryption: DocumentFileEncryptionResponseDto | null;
  status: DocumentStatus;
  rejectedByAccountId: string | null;
  rejectedAt: string | null;
  rejectionReason: string | null;
  cancelledByAccountId?: string | null;
  cancelledAt?: string | null;
  cancellationReason?: string | null;
  hiddenForCurrentAccount: boolean;
  createdAt: string;
  updatedAt: string;
  signers: DocumentSignerResponseDto[];
  observers: DocumentObserverResponseDto[];
  signatures: DocumentSignatureResponseDto[];
};

export type RejectDocumentRequestDto = {
  reason: string | null;
};

export type AddDocumentObserversRequestDto = {
  observerAccountIds: string[];
  keyEnvelopes: DocumentKeyEnvelopeRequestDto[];
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

export type RealtimeEventType = 'MESSAGE_CREATED' | 'MESSAGE_DELIVERED' | 'MESSAGE_READ' | 'MESSAGE_REACTION_UPDATED' | 'GROUP_EPOCH_KEYS_AVAILABLE' | 'CHAT_UPDATED' | 'TYPING' | 'PRESENCE_UPDATED' | 'PRESENCE_SNAPSHOT' | 'DOCUMENT_CREATED' | 'DOCUMENT_UPDATED' | 'DOCUMENT_SIGNED' | 'DOCUMENT_REJECTED' | 'DOCUMENT_CANCELLED' | 'DOCUMENT_HIDDEN' | 'DOCUMENT_OBSERVERS_ADDED' | 'PROFILE_UPDATED' | 'DEVICE_REVOKED';

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
  clientMessageId?: string | null;
  messageType: MessageType;
  encryptionType: MessageEncryptionType;
  encryptedPayload?: string | null;
  contentAlgorithm?: 'AES-256-GCM' | null;
  contentInitializationVectorBase64?: string | null;
  contentAuthenticationTagBase64?: string | null;
  groupKeyEpoch?: number | null;
  devicePayloads?: MessageDevicePayloadResponseDto[];
  accountKeyEnvelopes?: AccountKeyEnvelopeResponseDto[];
  groupEpochKeyEnvelope?: AccountKeyEnvelopeResponseDto | null;
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
  readMessageIds: string[];
  readByAccountId: string;
  readAt: string;
};


export type GroupEpochKeysAvailablePayload = {
  chatId: string;
  epoch: number;
  targetAccountId: string;
};

export type MessageReactionUpdatedPayload = {
  chatId: string;
  messageId: string;
  accountId: string;
  emoji: string | null;
  updatedAt: string;
};

export type ChatUpdatedPayload = {
  chat: ChatResponseDto;
};

export type DocumentChangedPayload = {
  documentId: string;
  document?: DocumentResponseDto | null;
};

export type TypingPayload = {
  chatId: string;
  typingAccountId: string;
  username: string;
  isTyping: boolean;
};

export type AccountPresencePayload = {
  accountId: string;
  online: boolean;
  lastSeenAt: string | null;
};

export type PresenceSnapshotPayload = {
  accounts: AccountPresencePayload[];
};

export type ProfileUpdatedPayload = ProfileResponseDto;
