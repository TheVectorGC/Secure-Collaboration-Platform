export type DevicePlatform = 'WINDOWS' | 'MACOS' | 'LINUX' | 'ANDROID' | 'IOS' | 'WEB';

export type LoginRequestDto = {
  login: string;
  password: string;
  deviceId: string | null;
  clientInstallationId: string | null;
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
  deviceId: string;
};

export type DeviceResponseDto = {
  deviceId?: string;
  id?: string;
  deviceName: string;
  platform: DevicePlatform;
  status: string;
  clientVersion: string | null;
  lastSeenAt: string;
  createdAt: string;
};

export type ActiveDeviceResponseDto = {
  deviceId: string;
  accountId: string;
  deviceName: string;
  platform: DevicePlatform;
  lastSeenAt: string | null;
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

export type ChatResponseDto = {
  chatId: string;
  type: 'DIRECT' | 'SELF';
  participantAccountIds: string[];
  lastMessageId: string | null;
  lastMessageCreatedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type MessageCiphertextType = 'PRE_KEY' | 'SIGNAL' | 'LOCAL';

export type DeviceMessagePayloadRequestDto = {
  targetAccountId: string;
  targetDeviceId: string;
  ciphertextType: MessageCiphertextType;
  encryptedPayload: string;
};

export type SendMessageRequestDto = {
  senderDeviceId: string;
  clientMessageId: string;
  messageType: 'TEXT';
  encryptionType: 'SIGNAL';
  devicePayloads: DeviceMessagePayloadRequestDto[];
};

export type MessageDeliveryStateResponseDto = {
  accountId: string;
  status: 'SENT' | 'DELIVERED' | 'READ';
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
  messageType: 'TEXT';
  encryptionType: 'SIGNAL';
  devicePayloads: MessageDevicePayloadResponseDto[];
  createdAt: string;
  deliveryStates: MessageDeliveryStateResponseDto[];
};

export type RealtimeEventType = 'MESSAGE_CREATED' | 'MESSAGE_DELIVERED' | 'MESSAGE_READ';

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
  messageType: 'TEXT';
  encryptionType: 'SIGNAL';
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
