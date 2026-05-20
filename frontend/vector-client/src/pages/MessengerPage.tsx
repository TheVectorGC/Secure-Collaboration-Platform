import { DragEvent, KeyboardEvent, useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  CheckCheck,
  Circle,
  LoaderCircle,
  LogOut,
  MessageCircle,
  Paperclip,
  FileText,
  Eraser,
  Download,
  Image as ImageIcon,
  Plus,
  Search,
  Smile,
  Send,
  Star,
  Users,
  Trash2,
  UserPlus,
  UserMinus,
  KeyRound,
  Clock3,
  Mail,
  MessageSquare,
  User,
  MoreVertical,
  LockKeyhole,
  Monitor,
  RefreshCw,
  Settings,
  ShieldCheck,
  Wifi,
  WifiOff,
  Wrench,
  X,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { addGroupParticipant, createDirectChat, createGroupChat, createSelfChat, getChat, getChats, removeGroupParticipant } from '../features/chats/api/chatsApi';
import { createDocument, getChatDocuments, registerDocumentSigningKey, rejectDocument, signDocument } from '../features/documents/api/documentsApi';
import { searchProfiles, updateCurrentProfileAvatar } from '../features/directory/api/profilesApi';
import { getActiveAccountDevices } from '../features/devices/api/devicesApi';
import { useDirectoryStore } from '../features/directory/model/directoryStore';
import { logout as logoutRequest } from '../features/auth/api/authApi';
import { useAuthStore } from '../features/auth/model/authStore';
import { getChatMessages, markChatRead, markMessageDelivered, sendMessage } from '../features/messages/api/messagesApi';
import { downloadEncryptedMediaFile, uploadEncryptedMediaFile } from '../features/media/api/mediaApi';
import { buildDocumentAttachmentContent, buildFileAttachmentContent, decryptDownloadedFile, encryptFileForUpload, formatFileSize, parseDocumentAttachmentMessageContent, parseFileAttachmentMessageContent } from '../features/media/lib/fileCrypto';
import { useMessengerStore } from '../features/messenger/model/messengerStore';
import { useRealtimeConnection } from '../features/realtime/useRealtimeConnection';
import { useRealtimeStore, type AccountPresenceState } from '../features/realtime/model/realtimeStore';
import { DevAccountPanel } from '../features/admin/ui/DevAccountPanel';
import { ChatComposer, type ChatAttachmentDisplayMode } from '../features/messenger/ui/ChatComposer';
import { DocumentAttachmentPreview, ImageAttachmentPreview } from '../features/messenger/ui/MessageAttachments';
import { useCryptoBootstrap } from '../features/crypto/useCryptoBootstrap';
import { useCryptoStore } from '../features/crypto/model/cryptoStore';
import { getPreKeyBundle } from '../features/crypto/api/cryptoKeysApi';
import { downloadKeyBackup, getKeyBackupStatus, uploadKeyBackup, type KeyBackupStatusResponseDto } from '../features/crypto/api/keyBackupApi';
import { formatChatTime, formatLastSeen, formatMessageDate, formatMessageTime } from '../shared/lib/dateFormat';
import { getAvatarGradient, getInitials } from '../shared/lib/avatar';
import { getDirectCompanionAccountId, getDisplayName } from '../shared/lib/profile';
import type { ActiveDeviceResponseDto, AddGroupParticipantRequestDto, ChatResponseDto, DocumentAttachmentMessageContent, DocumentResponseDto, FileAttachmentMessageContent, MessageResponseDto, ProfileResponseDto } from '../shared/types/api';


const IMAGE_FILE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'avif']);
const CHAT_LOCAL_STATE_PREFIX = 'vector.chatLocalState';
const EMOJI_ITEMS = ['😀', '😄', '😊', '😍', '😎', '🥳', '👍', '🙏', '🔥', '💪', '✅', '❤️', '😂', '🤝', '👀', '🚀', '📌', '📎', '📝', '🔒'];
const STICKER_ITEMS = ['🐱', '🐶', '🦊', '🐼', '🤖', '👻', '💥', '✨', '🎉', '🏆', '☕', '🌙'];

type LocalChatState = {
  readAtByChatId: Record<string, string>;
  clearedAtByChatId: Record<string, string>;
  hiddenChatIds: string[];
};

type ChatListPreview = {
  text: string;
  accent: 'default' | 'media' | 'system' | 'muted';
};

function getLocalAvatarStorageKey(accountId: string | undefined): string {
  return `vector.localAvatar.${accountId ?? 'anonymous'}`;
}

async function createLocalAvatarDataUrl(file: File): Promise<string> {
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const imageElement = new Image();

    imageElement.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(imageElement);
    };

    imageElement.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Cannot read avatar image.'));
    };

    imageElement.src = objectUrl;
  });

  const size = 320;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');

  if (!context) {
    throw new Error('Canvas is not available.');
  }

  const sourceSize = Math.min(image.width, image.height);
  const sourceX = Math.floor((image.width - sourceSize) / 2);
  const sourceY = Math.floor((image.height - sourceSize) / 2);
  context.drawImage(image, sourceX, sourceY, sourceSize, sourceSize, 0, 0, size, size);

  return canvas.toDataURL('image/jpeg', 0.86);
}


function getLocalChatStateStorageKey(accountId: string | undefined): string {
  return `${CHAT_LOCAL_STATE_PREFIX}.${accountId ?? 'anonymous'}`;
}

function createEmptyLocalChatState(): LocalChatState {
  return {
    readAtByChatId: {},
    clearedAtByChatId: {},
    hiddenChatIds: [],
  };
}

function readLocalChatState(accountId: string | undefined): LocalChatState {
  const serializedValue = localStorage.getItem(getLocalChatStateStorageKey(accountId));

  if (!serializedValue) {
    return createEmptyLocalChatState();
  }

  try {
    const parsedValue = JSON.parse(serializedValue) as Partial<LocalChatState>;

    return {
      readAtByChatId: parsedValue.readAtByChatId ?? {},
      clearedAtByChatId: parsedValue.clearedAtByChatId ?? {},
      hiddenChatIds: parsedValue.hiddenChatIds ?? [],
    };
  }
  catch {
    return createEmptyLocalChatState();
  }
}

function writeLocalChatState(accountId: string | undefined, localChatState: LocalChatState) {
  localStorage.setItem(getLocalChatStateStorageKey(accountId), JSON.stringify(localChatState));
}

function isSameCalendarDate(leftValue: string, rightValue: string): boolean {
  const leftDate = new Date(leftValue);
  const rightDate = new Date(rightValue);

  return leftDate.getFullYear() === rightDate.getFullYear()
    && leftDate.getMonth() === rightDate.getMonth()
    && leftDate.getDate() === rightDate.getDate();
}

function isImageFile(file: File): boolean {
  if (file.type.startsWith('image/')) {
    return true;
  }

  const extension = file.name.split('.').at(-1)?.toLowerCase();
  return extension ? IMAGE_FILE_EXTENSIONS.has(extension) : false;
}
function isStickerMessageText(value: string): boolean {
  return STICKER_ITEMS.includes(value.trim());
}


function getVisibleChatMessages(messages: MessageResponseDto[], clearedAt: string | null | undefined): MessageResponseDto[] {
  if (!clearedAt) {
    return messages;
  }

  const clearedAtTime = new Date(clearedAt).getTime();
  return messages.filter((message) => new Date(message.createdAt).getTime() > clearedAtTime);
}

function getLastTimelineMessage(messages: MessageResponseDto[]): MessageResponseDto | null {
  const visibleMessages = messages.filter((message) => message.messageType !== 'GROUP_KEY_DISTRIBUTION');
  return visibleMessages.at(-1) ?? null;
}

function buildChatPreviewFromMessage(
  message: MessageResponseDto | null,
  decryptedMessagesById: Record<string, string>,
  profilesById: Record<string, ProfileResponseDto>,
): ChatListPreview {
  if (!message) {
    return { text: 'Нет сообщений', accent: 'muted' };
  }

  const decryptedMessage = decryptedMessagesById[message.messageId];

  if (message.messageType === 'SYSTEM') {
    return {
      text: formatGroupSystemMessage(parseGroupSystemMessagePayload(decryptedMessage ?? message.encryptedPayload), profilesById),
      accent: 'system',
    };
  }

  const fileAttachment = parseFileAttachmentMessageContent(decryptedMessage ?? '');

  if (fileAttachment) {
    if (fileAttachment.attachmentDisplayMode === 'IMAGE') {
      return { text: 'Фотография', accent: 'media' };
    }

    return { text: `Файл: ${fileAttachment.fileName}`, accent: 'media' };
  }

  const documentAttachment = parseDocumentAttachmentMessageContent(decryptedMessage ?? '');

  if (documentAttachment) {
    return { text: `Документ: ${documentAttachment.fileName}`, accent: 'media' };
  }

  if (!decryptedMessage || isDecryptionPlaceholder(decryptedMessage) || decryptedMessage === 'Расшифровка…') {
    return { text: 'Зашифрованное сообщение', accent: 'muted' };
  }

  const compactText = decryptedMessage.replace(/\s+/g, ' ').trim();

  if (!compactText) {
    return { text: 'Сообщение', accent: 'muted' };
  }

  if (isStickerMessageText(compactText)) {
    return { text: 'Стикер', accent: 'media' };
  }

  return {
    text: compactText.length > 58 ? `${compactText.slice(0, 58)}…` : compactText,
    accent: 'default',
  };
}

function calculateUnreadCount(messages: MessageResponseDto[], currentAccountId: string | undefined, readAt: string | null | undefined): number {
  if (!currentAccountId) {
    return 0;
  }

  const readAtTime = readAt ? new Date(readAt).getTime() : 0;

  return messages.filter((message) => (
    message.senderAccountId !== currentAccountId
    && message.messageType !== 'SYSTEM'
    && message.messageType !== 'GROUP_KEY_DISTRIBUTION'
    && new Date(message.createdAt).getTime() > readAtTime
  )).length;
}

function getLastPeerActivityAt(messages: MessageResponseDto[], peerAccountId: string | null): string | null {
  if (!peerAccountId) {
    return null;
  }

  return [...messages].reverse().find((message) => message.senderAccountId === peerAccountId)?.createdAt ?? null;
}

function getPreviewTextColorClass(accent: ChatListPreview['accent']): string {
  if (accent === 'media') {
    return 'text-violet-300';
  }

  if (accent === 'system') {
    return 'text-zinc-400';
  }

  if (accent === 'muted') {
    return 'text-zinc-600';
  }

  return 'text-zinc-500';
}

function Avatar({ label, size = 'md' }: { label: string; size?: 'sm' | 'md' | 'lg' }) {
  const dimensions = size === 'sm' ? 'h-10 w-10 text-sm' : size === 'lg' ? 'h-14 w-14 text-lg' : 'h-12 w-12 text-base';

  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-2xl font-semibold text-white shadow-lg shadow-black/20 ${dimensions}`}
      style={{ backgroundImage: getAvatarGradient(label) }}
    >
      {getInitials(label)}
    </div>
  );
}

function UserAvatar({ label, imageUrl, size = 'md' }: { label: string; imageUrl?: string | null; size?: 'sm' | 'md' | 'lg' }) {
  const dimensions = size === 'sm' ? 'h-10 w-10 text-sm' : size === 'lg' ? 'h-14 w-14 text-lg' : 'h-12 w-12 text-base';

  if (imageUrl) {
    return <img src={imageUrl} alt={label} className={`shrink-0 rounded-2xl object-cover shadow-lg shadow-black/20 ${dimensions}`} />;
  }

  return <Avatar label={label} size={size} />;
}

async function readImageElementFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const imageElement = new Image();

    imageElement.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(imageElement);
    };

    imageElement.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Cannot read image.'));
    };

    imageElement.src = objectUrl;
  });
}

function buildCompressedImageFileName(fileName: string): string {
  const dotIndex = fileName.lastIndexOf('.');
  const baseName = dotIndex > 0 ? fileName.slice(0, dotIndex) : fileName;
  return `${baseName}.jpg`;
}

async function compressImageForChat(file: File): Promise<File> {
  if (!file.type.startsWith('image/') || file.type === 'image/gif' || file.type === 'image/svg+xml') {
    return file;
  }

  const image = await readImageElementFromFile(file);
  const maximumSide = 1920;
  const scale = Math.min(1, maximumSide / Math.max(image.width, image.height));
  const targetWidth = Math.max(1, Math.round(image.width * scale));
  const targetHeight = Math.max(1, Math.round(image.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const context = canvas.getContext('2d');

  if (!context) {
    return file;
  }

  context.drawImage(image, 0, 0, targetWidth, targetHeight);

  const compressedBlob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, 'image/jpeg', 0.84);
  });

  if (!compressedBlob || compressedBlob.size >= file.size * 0.96) {
    return file;
  }

  return new File([compressedBlob], buildCompressedImageFileName(file.name), {
    type: 'image/jpeg',
    lastModified: Date.now(),
  });
}

function getAccountAvatarUrl(profile: ProfileResponseDto | null | undefined, fallbackAvatarDataUrl?: string | null): string | null {
  return profile?.avatarDataUrl ?? fallbackAvatarDataUrl ?? null;
}

function getAccountActivityLabel(
  presence: AccountPresenceState | null | undefined,
  fallbackLastActivityAt: string | null | undefined,
): string {
  if (presence?.isOnline) {
    return 'в сети';
  }

  if (presence?.lastSeenAt) {
    return formatLastSeen(presence.lastSeenAt);
  }

  if (fallbackLastActivityAt) {
    return formatLastSeen(fallbackLastActivityAt);
  }

  return 'активность пока неизвестна';
}

function buildAccountLastActivityMap(messagesByChatId: Record<string, MessageResponseDto[]>): Record<string, string> {
  const lastActivityByAccountId: Record<string, string> = {};

  Object.values(messagesByChatId).flat().forEach((message) => {
    if (message.messageType === 'GROUP_KEY_DISTRIBUTION') {
      return;
    }

    const previousActivityAt = lastActivityByAccountId[message.senderAccountId];

    if (!previousActivityAt || new Date(message.createdAt).getTime() > new Date(previousActivityAt).getTime()) {
      lastActivityByAccountId[message.senderAccountId] = message.createdAt;
    }
  });

  return lastActivityByAccountId;
}

function DocumentsPanel({
  isOpen,
  documents,
  isLoading,
  activeAccountId,
  onClose,
  onRefresh,
  onDownload,
  onSign,
  onReject,
}: {
  isOpen: boolean;
  documents: DocumentResponseDto[];
  isLoading: boolean;
  activeAccountId: string | undefined;
  onClose: () => void;
  onRefresh: () => Promise<void>;
  onDownload: (document: DocumentResponseDto) => Promise<void>;
  onSign: (document: DocumentResponseDto) => Promise<void>;
  onReject: (document: DocumentResponseDto) => Promise<void>;
}) {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm">
      <div className="flex max-h-[82vh] w-full max-w-3xl flex-col rounded-[2rem] border border-white/10 bg-[#18191d] shadow-2xl shadow-black/50">
        <div className="flex items-center justify-between gap-4 border-b border-white/10 p-6">
          <div>
            <div className="text-xl font-semibold text-zinc-50">Документооборот</div>
            <div className="mt-1 text-sm text-zinc-500">Зашифрованные документы выбранного чата и цифровые подписи.</div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => void onRefresh()}
              className="rounded-2xl border border-white/10 bg-white/[0.04] p-2 text-zinc-400 transition hover:text-zinc-100"
              title="Обновить"
            >
              <RefreshCw size={18} />
            </button>
            <button
              onClick={onClose}
              className="rounded-2xl border border-white/10 bg-white/[0.04] p-2 text-zinc-400 transition hover:text-zinc-100"
              title="Закрыть"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {isLoading ? (
            <div className="flex items-center justify-center gap-3 rounded-[1.7rem] border border-white/10 bg-white/[0.03] p-8 text-sm text-zinc-400">
              <LoaderCircle size={18} className="animate-spin" />
              Загружаем документы…
            </div>
          ) : documents.length === 0 ? (
            <div className="rounded-[1.7rem] border border-dashed border-white/10 bg-white/[0.02] p-8 text-center text-sm text-zinc-500">
              В этом чате пока нет документов. Прикрепи файл как документ через скрепку.
            </div>
          ) : (
            <div className="space-y-3">
              {documents.map((documentItem) => {
                const signedByCurrentAccount = documentItem.signatures.some((signature) => signature.signerAccountId === activeAccountId);
                const isRejected = documentItem.status === 'REJECTED';

                return (
                  <div key={documentItem.documentId} className="rounded-[1.5rem] border border-white/10 bg-white/[0.035] p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-zinc-100">{documentItem.fileName}</div>
                        <div className="mt-1 text-xs text-zinc-500">
                          {formatFileSize(documentItem.sizeBytes)} • {documentItem.mimeType} • подписей: {documentItem.signatures.length}
                        </div>
                        <div className="mt-2 text-xs text-zinc-600">SHA-256: {documentItem.plaintextSha256Base64.slice(0, 18)}…</div>
                      </div>
                      <div className={`shrink-0 rounded-full px-3 py-1 text-xs ${isRejected ? 'bg-red-500/15 text-red-200' : 'bg-emerald-500/15 text-emerald-200'}`}>
                        {isRejected ? 'Отклонён' : 'Активен'}
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        onClick={() => void onDownload(documentItem)}
                        className="rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-2 text-xs text-zinc-200 transition hover:bg-white/[0.08]"
                      >
                        Скачать
                      </button>
                      <button
                        onClick={() => void onSign(documentItem)}
                        disabled={isRejected || signedByCurrentAccount}
                        className="rounded-2xl border border-emerald-300/20 bg-emerald-500/10 px-4 py-2 text-xs text-emerald-100 transition hover:bg-emerald-500/15 disabled:cursor-not-allowed disabled:opacity-45"
                      >
                        {signedByCurrentAccount ? 'Подписано' : 'Подписать'}
                      </button>
                      <button
                        onClick={() => void onReject(documentItem)}
                        disabled={isRejected}
                        className="rounded-2xl border border-red-300/20 bg-red-500/10 px-4 py-2 text-xs text-red-100 transition hover:bg-red-500/15 disabled:cursor-not-allowed disabled:opacity-45"
                      >
                        Отклонить
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

type ChatPresentation = {
  title: string;
  subtitle: string;
  avatarLabel: string;
  companionProfile: ProfileResponseDto | null;
};


function getAllGroupParticipants(chat: ChatResponseDto | null): NonNullable<ChatResponseDto['participants']> {
  if (!chat || chat.type !== 'GROUP') {
    return [];
  }

  if (chat.participants && chat.participants.length > 0) {
    return chat.participants;
  }

  return chat.participantAccountIds.map((participantAccountId) => ({
    accountId: participantAccountId,
    role: 'MEMBER',
    status: 'ACTIVE',
    historyVisibleFromMessageId: null,
    historyVisibleFromCreatedAt: null,
    joinedAt: chat.createdAt,
    removedAt: null,
  }));
}

function getActiveGroupParticipants(chat: ChatResponseDto | null): NonNullable<ChatResponseDto['participants']> {
  return getAllGroupParticipants(chat).filter((participant) => participant.status === 'ACTIVE');
}

function getCurrentGroupParticipant(chat: ChatResponseDto | null, currentAccountId: string | undefined) {
  if (!chat || chat.type !== 'GROUP' || !currentAccountId) {
    return null;
  }

  return getAllGroupParticipants(chat).find((participant) => participant.accountId === currentAccountId) ?? null;
}

function isCurrentAccountActiveInChat(chat: ChatResponseDto | null, currentAccountId: string | undefined): boolean {
  if (!chat) {
    return false;
  }

  if (chat.type !== 'GROUP') {
    return true;
  }

  return getCurrentGroupParticipant(chat, currentAccountId)?.status === 'ACTIVE';
}

function getActiveGroupParticipantAccountIds(chat: ChatResponseDto | null): string[] {
  if (!chat) {
    return [];
  }

  if (chat.type !== 'GROUP') {
    return chat.participantAccountIds;
  }

  return getActiveGroupParticipants(chat).map((participant) => participant.accountId);
}

function isGroupMembershipChangedSystemText(value: string | undefined): boolean {
  return value === '[Ключ группы обновлён]' || value === '[Состав группы обновлён]' || value === '[История группы доступна]';
}

function getChatPresentation(
  chat: ChatResponseDto,
  currentProfile: ProfileResponseDto | null,
  profilesById: Record<string, ProfileResponseDto>,
): ChatPresentation {
  if (chat.type === 'SELF') {
    return {
      title: 'Избранное',
      subtitle: 'Личные заметки и сохранённые сообщения',
      avatarLabel: 'Избранное',
      companionProfile: currentProfile,
    };
  }

  if (chat.type === 'GROUP') {
    const activeParticipantsCount = getActiveGroupParticipants(chat).length;

    return {
      title: chat.name ?? 'Групповой чат',
      subtitle: `${activeParticipantsCount} участников • группа`,
      avatarLabel: chat.name ?? 'Группа',
      companionProfile: null,
    };
  }

  const companionAccountId = getDirectCompanionAccountId(chat, currentProfile?.accountId);
  const companionProfile = companionAccountId ? profilesById[companionAccountId] ?? null : null;

  if (companionProfile) {
    return {
      title: getDisplayName(companionProfile),
      subtitle: `@${companionProfile.username}`,
      avatarLabel: getDisplayName(companionProfile),
      companionProfile,
    };
  }

  const fallbackTitle = chat.name?.trim() || 'Собеседник';
  const shortId = companionAccountId ? `${companionAccountId.slice(0, 8)}…` : 'неизвестный контакт';
  return {
    title: fallbackTitle,
    subtitle: shortId,
    avatarLabel: fallbackTitle,
    companionProfile: null,
  };
}

function getOutgoingMessageStatus(message: MessageResponseDto, currentAccountId: string | undefined): 'SENT' | 'DELIVERED' | 'READ' {
  const relevantStates = message.deliveryStates.filter((deliveryState) => deliveryState.accountId !== currentAccountId);

  if (relevantStates.some((deliveryState) => deliveryState.status === 'READ')) {
    return 'READ';
  }

  if (relevantStates.some((deliveryState) => deliveryState.status === 'DELIVERED')) {
    return 'DELIVERED';
  }

  return 'SENT';
}


function getReadReceiptDetails(
  message: MessageResponseDto,
  chat: ChatResponseDto | null,
  profilesById: Record<string, ProfileResponseDto>,
  currentAccountId: string | undefined,
) {
  const recipients = chat?.type === 'GROUP'
    ? getActiveGroupParticipants(chat).filter((participant) => participant.accountId !== currentAccountId)
    : [];
  const readAccountIds = new Set(
    message.deliveryStates
      .filter((deliveryState) => deliveryState.status === 'READ')
      .map((deliveryState) => deliveryState.accountId),
  );
  const deliveredAccountIds = new Set(
    message.deliveryStates
      .filter((deliveryState) => deliveryState.status === 'DELIVERED' || deliveryState.status === 'READ')
      .map((deliveryState) => deliveryState.accountId),
  );

  const readParticipants = recipients.filter((participant) => readAccountIds.has(participant.accountId));
  const unreadParticipants = recipients.filter((participant) => !readAccountIds.has(participant.accountId));
  const deliveredParticipants = recipients.filter((participant) => deliveredAccountIds.has(participant.accountId));

  return {
    totalCount: recipients.length,
    readCount: readParticipants.length,
    deliveredCount: deliveredParticipants.length,
    readParticipants: readParticipants.map((participant) => profilesById[participant.accountId] ?? participant.accountId),
    unreadParticipants: unreadParticipants.map((participant) => profilesById[participant.accountId] ?? participant.accountId),
  };
}

function getParticipantDisplayName(profileOrAccountId: ProfileResponseDto | string): string {
  if (typeof profileOrAccountId === 'string') {
    return `${profileOrAccountId.slice(0, 8)}…`;
  }

  return getDisplayName(profileOrAccountId);
}

type GroupSystemEventType = 'GROUP_CREATED' | 'MEMBER_ADDED' | 'MEMBER_REMOVED';

type GroupSystemMessagePayload = {
  kind: 'GROUP_SYSTEM_EVENT';
  version: number;
  type: GroupSystemEventType;
  chatId: string;
  chatName: string | null;
  actorAccountId: string;
  targetAccountId: string | null;
};

function parseGroupSystemMessagePayload(value: string | null): GroupSystemMessagePayload | null {
  if (!value) {
    return null;
  }

  try {
    const parsedValue = JSON.parse(value) as Partial<GroupSystemMessagePayload>;

    if (parsedValue.kind !== 'GROUP_SYSTEM_EVENT' || parsedValue.version !== 1 || typeof parsedValue.type !== 'string') {
      return null;
    }

    if (typeof parsedValue.chatId !== 'string' || typeof parsedValue.actorAccountId !== 'string') {
      return null;
    }

    return {
      kind: 'GROUP_SYSTEM_EVENT',
      version: 1,
      type: parsedValue.type as GroupSystemEventType,
      chatId: parsedValue.chatId,
      chatName: typeof parsedValue.chatName === 'string' ? parsedValue.chatName : null,
      actorAccountId: parsedValue.actorAccountId,
      targetAccountId: typeof parsedValue.targetAccountId === 'string' ? parsedValue.targetAccountId : null,
    };
  }
  catch {
    return null;
  }
}

function getProfileDisplayNameById(accountId: string | null, profilesById: Record<string, ProfileResponseDto>): string {
  if (!accountId) {
    return 'Неизвестный пользователь';
  }

  const profile = profilesById[accountId];

  if (!profile) {
    return `${accountId.slice(0, 8)}…`;
  }

  return getDisplayName(profile);
}

function formatGroupSystemMessage(payload: GroupSystemMessagePayload | null, profilesById: Record<string, ProfileResponseDto>): string {
  if (!payload) {
    return 'Системное событие';
  }

  const actorDisplayName = getProfileDisplayNameById(payload.actorAccountId, profilesById);
  const targetDisplayName = getProfileDisplayNameById(payload.targetAccountId, profilesById);

  if (payload.type === 'GROUP_CREATED') {
    return `${actorDisplayName} создал(а) группу`;
  }

  if (payload.type === 'MEMBER_ADDED') {
    return `${actorDisplayName} добавил(а) ${targetDisplayName}`;
  }

  if (payload.type === 'MEMBER_REMOVED') {
    return `${actorDisplayName} удалил(а) ${targetDisplayName}`;
  }

  return 'Системное событие';
}

function NewChatModal({
  isOpen,
  currentAccountId,
  onClose,
  onCreateChat,
  onCreateGroupChat,
}: {
  isOpen: boolean;
  currentAccountId: string | undefined;
  onClose: () => void;
  onCreateChat: (profile: ProfileResponseDto) => Promise<void>;
  onCreateGroupChat: (name: string, profiles: ProfileResponseDto[]) => Promise<void>;
}) {
  const upsertProfiles = useDirectoryStore((state) => state.upsertProfiles);
  const [query, setQuery] = useState('');
  const [groupName, setGroupName] = useState('');
  const [results, setResults] = useState<ProfileResponseDto[]>([]);
  const [selectedProfiles, setSelectedProfiles] = useState<ProfileResponseDto[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [creatingAccountId, setCreatingAccountId] = useState<string | null>(null);
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setQuery('');
      setGroupName('');
      setResults([]);
      setSelectedProfiles([]);
      setErrorMessage(null);
      setCreatingAccountId(null);
      setIsCreatingGroup(false);
      return;
    }

    const trimmedQuery = query.trim();

    if (trimmedQuery.length < 2) {
      setResults([]);
      setIsSearching(false);
      return;
    }

    const timeoutId = window.setTimeout(async () => {
      setIsSearching(true);
      setErrorMessage(null);

      try {
        const profiles = await searchProfiles(trimmedQuery);
        const filteredProfiles = profiles.filter((profile) => profile.accountId !== currentAccountId);
        upsertProfiles(filteredProfiles);
        setResults(filteredProfiles);
      }
      catch (error) {
        console.error(error);
        setErrorMessage('Не удалось выполнить поиск пользователей.');
      }
      finally {
        setIsSearching(false);
      }
    }, 250);

    return () => window.clearTimeout(timeoutId);
  }, [currentAccountId, isOpen, query, upsertProfiles]);

  function toggleSelectedProfile(profile: ProfileResponseDto) {
    setSelectedProfiles((previousProfiles) => {
      if (previousProfiles.some((selectedProfile) => selectedProfile.accountId === profile.accountId)) {
        return previousProfiles.filter((selectedProfile) => selectedProfile.accountId !== profile.accountId);
      }

      return [...previousProfiles, profile];
    });
  }

  async function handleCreateSelectedGroup() {
    const trimmedGroupName = groupName.trim();

    if (selectedProfiles.length === 0 || !trimmedGroupName) {
      setErrorMessage('Для группы нужно название и хотя бы один участник.');
      return;
    }

    setIsCreatingGroup(true);
    setErrorMessage(null);

    try {
      await onCreateGroupChat(trimmedGroupName, selectedProfiles);
    }
    catch (error) {
      console.error(error);
      setErrorMessage('Не удалось создать групповой чат.');
    }
    finally {
      setIsCreatingGroup(false);
    }
  }

  if (!isOpen) {
    return null;
  }

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm">
      <div className="w-full max-w-xl rounded-[2rem] border border-white/10 bg-[#18191d] p-6 shadow-2xl shadow-black/50">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <div className="text-2xl font-semibold text-zinc-50">Новый чат</div>
            <div className="mt-2 text-sm text-zinc-500">
              Найди сотрудников для direct-чата или собери группу.
            </div>
          </div>

          <button
            onClick={onClose}
            className="rounded-2xl border border-white/10 bg-white/[0.04] p-2 text-zinc-400 transition hover:border-violet-300/30 hover:text-zinc-100"
            title="Закрыть"
          >
            <X size={18} />
          </button>
        </div>

        <div className="mb-4 rounded-3xl border border-white/10 bg-white/[0.035] p-3">
          <div className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.2em] text-zinc-500">
            <Users size={15} />
            Группа
          </div>
          <input
            value={groupName}
            onChange={(event) => setGroupName(event.target.value)}
            className="mb-3 w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-violet-300/35"
            placeholder="Название группы"
          />
          <div className="mb-3 flex flex-wrap gap-2">
            {selectedProfiles.length === 0 ? (
              <span className="text-xs text-zinc-500">Выбери участников ниже.</span>
            ) : selectedProfiles.map((profile) => (
              <button
                key={profile.accountId}
                onClick={() => toggleSelectedProfile(profile)}
                className="rounded-full border border-violet-300/20 bg-violet-500/10 px-3 py-1 text-xs text-violet-100"
              >
                {getDisplayName(profile)} ×
              </button>
            ))}
          </div>
          <button
            onClick={() => void handleCreateSelectedGroup()}
            disabled={isCreatingGroup || selectedProfiles.length === 0 || !groupName.trim()}
            className="inline-flex items-center gap-2 rounded-2xl border border-violet-300/20 bg-violet-500/10 px-4 py-2 text-sm font-medium text-violet-100 transition hover:bg-violet-500/15 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isCreatingGroup ? <LoaderCircle size={15} className="animate-spin" /> : <Users size={15} />}
            Создать группу
          </button>
        </div>

        <div className="mb-5 flex items-center gap-3 rounded-3xl border border-white/10 bg-white/[0.04] px-4 py-3 text-zinc-500">
          <Search size={17} />
          <input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="w-full bg-transparent text-sm text-zinc-200 outline-none placeholder:text-zinc-600"
            placeholder="Например: admin, ivan, ivan@company.local"
          />
        </div>

        <div className="max-h-[420px] overflow-y-auto">
          {query.trim().length < 2 && (
            <div className="rounded-3xl border border-dashed border-white/10 bg-white/[0.025] p-8 text-center text-sm text-zinc-500">
              Введи минимум 2 символа для поиска.
            </div>
          )}

          {isSearching && (
            <div className="flex items-center justify-center gap-3 rounded-3xl border border-white/10 bg-white/[0.03] p-8 text-sm text-zinc-400">
              <LoaderCircle size={18} className="animate-spin" />
              Ищем пользователей...
            </div>
          )}

          {!isSearching && query.trim().length >= 2 && results.length === 0 && !errorMessage && (
            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-8 text-center text-sm text-zinc-500">
              По запросу ничего не найдено.
            </div>
          )}

          {errorMessage && (
            <div className="rounded-3xl border border-red-400/20 bg-red-500/10 p-4 text-sm text-red-200">
              {errorMessage}
            </div>
          )}

          <div className="space-y-2">
            {results.map((profile) => {
              const displayName = getDisplayName(profile);
              const isCreating = creatingAccountId === profile.accountId;
              const isSelected = selectedProfiles.some((selectedProfile) => selectedProfile.accountId === profile.accountId);

              return (
                <div
                  key={profile.accountId}
                  className="flex w-full items-center gap-3 rounded-3xl border border-white/8 bg-white/[0.03] px-4 py-3 text-left transition hover:border-violet-300/25 hover:bg-white/[0.05]"
                >
                  <button
                    onClick={() => toggleSelectedProfile(profile)}
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border text-xs transition ${isSelected ? 'border-violet-300/30 bg-violet-500/20 text-violet-100' : 'border-white/10 bg-white/[0.04] text-zinc-500'}`}
                    title="Выбрать для группы"
                  >
                    {isSelected ? '✓' : '+'}
                  </button>
                  <Avatar label={displayName} />

                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold text-zinc-100">{displayName}</div>
                    <div className="mt-1 truncate text-xs text-zinc-500">@{profile.username} • {profile.email}</div>
                  </div>

                  <button
                    onClick={async () => {
                      setCreatingAccountId(profile.accountId);
                      setErrorMessage(null);

                      try {
                        await onCreateChat(profile);
                      }
                      catch (error) {
                        console.error(error);
                        setErrorMessage('Не удалось создать direct chat.');
                      }
                      finally {
                        setCreatingAccountId(null);
                      }
                    }}
                    className="rounded-full border border-violet-300/15 bg-violet-400/10 px-3 py-1 text-xs text-violet-200"
                  >
                    {isCreating ? 'Создаём…' : 'Direct'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}


type GroupHistoryAccessMode = AddGroupParticipantRequestDto['historyAccessMode'];

function GroupManagementModal({
  isOpen,
  chat,
  currentAccountId,
  profilesById,
  presenceByAccountId,
  lastActivityByAccountId,
  onClose,
  onAddParticipant,
  onRemoveParticipant,
  onOpenProfile,
}: {
  isOpen: boolean;
  chat: ChatResponseDto | null;
  currentAccountId: string | undefined;
  profilesById: Record<string, ProfileResponseDto>;
  presenceByAccountId: Record<string, AccountPresenceState>;
  lastActivityByAccountId: Record<string, string>;
  onClose: () => void;
  onAddParticipant: (profile: ProfileResponseDto, historyAccessMode: GroupHistoryAccessMode) => Promise<void>;
  onRemoveParticipant: (participantAccountId: string) => Promise<void>;
  onOpenProfile: (profile: ProfileResponseDto) => void;
}) {
  const upsertProfiles = useDirectoryStore((state) => state.upsertProfiles);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ProfileResponseDto[]>([]);
  const [historyAccessMode, setHistoryAccessMode] = useState<GroupHistoryAccessMode>('NEW_MESSAGES_ONLY');
  const [isSearching, setIsSearching] = useState(false);
  const [busyAccountId, setBusyAccountId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const activeParticipantIds = useMemo(() => {
    if (!chat) {
      return new Set<string>();
    }

    const activeParticipants = getActiveGroupParticipants(chat).map((participant) => participant.accountId);
    return new Set(activeParticipants);
  }, [chat]);

  const activeParticipants = useMemo(() => {
    if (!chat) {
      return [];
    }

    return getActiveGroupParticipants(chat);
  }, [chat, currentAccountId]);

  const currentParticipant = activeParticipants.find((participant) => participant.accountId === currentAccountId);
  const canManageMembers = currentParticipant?.role === 'OWNER';

  useEffect(() => {
    if (!isOpen) {
      setQuery('');
      setResults([]);
      setHistoryAccessMode('NEW_MESSAGES_ONLY');
      setIsSearching(false);
      setBusyAccountId(null);
      setErrorMessage(null);
      return;
    }

    const trimmedQuery = query.trim();

    if (trimmedQuery.length < 2) {
      setResults([]);
      setIsSearching(false);
      return;
    }

    const timeoutId = window.setTimeout(async () => {
      setIsSearching(true);
      setErrorMessage(null);

      try {
        const profiles = await searchProfiles(trimmedQuery);
        const filteredProfiles = profiles.filter((profile) => profile.accountId !== currentAccountId && !activeParticipantIds.has(profile.accountId));
        upsertProfiles(filteredProfiles);
        setResults(filteredProfiles);
      }
      catch (error) {
        console.error(error);
        setErrorMessage('Не удалось найти пользователей для группы.');
      }
      finally {
        setIsSearching(false);
      }
    }, 250);

    return () => window.clearTimeout(timeoutId);
  }, [activeParticipantIds, currentAccountId, isOpen, query, upsertProfiles]);

  if (!isOpen || !chat || chat.type !== 'GROUP') {
    return null;
  }

  async function handleAdd(profile: ProfileResponseDto) {
    setBusyAccountId(profile.accountId);
    setErrorMessage(null);

    try {
      await onAddParticipant(profile, historyAccessMode);
      setQuery('');
      setResults([]);
    }
    catch (error) {
      console.error(error);
      setErrorMessage('Не удалось добавить участника.');
    }
    finally {
      setBusyAccountId(null);
    }
  }

  async function handleRemove(accountId: string) {
    setBusyAccountId(accountId);
    setErrorMessage(null);

    try {
      await onRemoveParticipant(accountId);
    }
    catch (error) {
      console.error(error);
      setErrorMessage('Не удалось удалить участника.');
    }
    finally {
      setBusyAccountId(null);
    }
  }

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm">
      <div className="grid max-h-[88vh] w-full max-w-4xl grid-cols-1 overflow-hidden rounded-[2rem] border border-white/10 bg-[#18191d] shadow-2xl shadow-black/50 md:grid-cols-[1fr_1fr]">
        <section className="border-b border-white/10 p-6 md:border-b-0 md:border-r">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-2xl font-semibold text-zinc-50">Участники группы</div>
              <p className="mt-2 text-sm leading-6 text-zinc-500">Управляй составом группы и доступом новых участников к истории.</p>
            </div>
            <button onClick={onClose} className="rounded-2xl border border-white/10 bg-white/[0.04] p-2 text-zinc-400 transition hover:text-white">
              <X size={18} />
            </button>
          </div>

          <div className="mt-6 rounded-3xl border border-white/10 bg-white/[0.03] p-4">
            <div className="text-sm font-semibold text-zinc-200">{chat.name ?? 'Групповой чат'}</div>
            <div className="mt-1 text-xs text-zinc-500">{activeParticipants.length} активных участников • защищённый чат</div>
          </div>

          <div className="mt-5 max-h-[48vh] space-y-3 overflow-y-auto pr-1">
            {activeParticipants.map((participant) => {
              const participantProfile = profilesById[participant.accountId];
              const participantName = participantProfile ? getDisplayName(participantProfile) : `${participant.accountId.slice(0, 8)}…`;
              const participantPresence = presenceByAccountId[participant.accountId];
              const participantActivityLabel = getAccountActivityLabel(participantPresence, lastActivityByAccountId[participant.accountId]);
              const isCurrentUser = participant.accountId === currentAccountId;
              const canRemove = canManageMembers && !isCurrentUser && participant.role !== 'OWNER';

              return (
                <div key={participant.accountId} className="flex items-center gap-3 rounded-3xl border border-white/8 bg-white/[0.03] px-4 py-3 transition hover:bg-white/[0.05]">
                  <button
                    type="button"
                    onClick={() => participantProfile && onOpenProfile(participantProfile)}
                    disabled={!participantProfile}
                    className="flex min-w-0 flex-1 items-center gap-3 text-left disabled:cursor-default"
                  >
                    <div className="relative shrink-0">
                      <UserAvatar label={participantName} imageUrl={getAccountAvatarUrl(participantProfile)} />
                      <span className={`absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-[#1c1d22] ${participantPresence?.isOnline ? 'bg-emerald-400' : 'bg-zinc-600'}`} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold text-zinc-100">{participantName}{isCurrentUser ? ' • это вы' : ''}</div>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                        <span>{participantProfile ? `@${participantProfile.username}` : participant.accountId}</span>
                        <span>{participantActivityLabel}</span>
                        <span className="rounded-full border border-violet-300/15 bg-violet-400/10 px-2 py-0.5 text-violet-200">{participant.role === 'OWNER' ? 'Владелец' : 'Участник'}</span>
                        {participant.historyVisibleFromCreatedAt && <span>история с {formatMessageTime(participant.historyVisibleFromCreatedAt)}</span>}
                      </div>
                    </div>
                  </button>
                  {canRemove && (
                    <button
                      onClick={() => void handleRemove(participant.accountId)}
                      disabled={busyAccountId === participant.accountId}
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-red-300/15 bg-red-500/10 text-red-200 transition hover:border-red-300/30 hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                      title="Удалить из группы"
                    >
                      {busyAccountId === participant.accountId ? <LoaderCircle size={17} className="animate-spin" /> : <UserMinus size={17} />}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        <section className="p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-3xl bg-violet-500/15 text-violet-200">
              <UserPlus size={20} />
            </div>
            <div>
              <div className="text-lg font-semibold text-zinc-50">Добавить участника</div>
              <div className="text-xs text-zinc-500">Доступ к истории выбирается до добавления.</div>
            </div>
          </div>

          {!canManageMembers && (
            <div className="mt-5 rounded-3xl border border-amber-300/15 bg-amber-500/10 p-4 text-sm leading-6 text-amber-100">
              Добавлять и удалять участников может только владелец группы.
            </div>
          )}

          <div className="mt-5 space-y-3">
            <label className={`block rounded-3xl border p-4 transition ${historyAccessMode === 'NEW_MESSAGES_ONLY' ? 'border-violet-300/30 bg-violet-500/10' : 'border-white/10 bg-white/[0.03]'}`}>
              <div className="flex items-start gap-3">
                <input
                  type="radio"
                  name="group-history-mode"
                  checked={historyAccessMode === 'NEW_MESSAGES_ONLY'}
                  onChange={() => setHistoryAccessMode('NEW_MESSAGES_ONLY')}
                  className="mt-1"
                  disabled={!canManageMembers}
                />
                <div>
                  <div className="text-sm font-semibold text-zinc-100">Только новые сообщения</div>
                  <div className="mt-1 text-xs leading-5 text-zinc-500">Участник получит ключи новой эпохи и будет читать сообщения после добавления.</div>
                </div>
              </div>
            </label>
            <label className={`block rounded-3xl border p-4 transition ${historyAccessMode === 'FULL_HISTORY' ? 'border-violet-300/30 bg-violet-500/10' : 'border-white/10 bg-white/[0.03]'}`}>
              <div className="flex items-start gap-3">
                <input
                  type="radio"
                  name="group-history-mode"
                  checked={historyAccessMode === 'FULL_HISTORY'}
                  onChange={() => setHistoryAccessMode('FULL_HISTORY')}
                  className="mt-1"
                  disabled={!canManageMembers}
                />
                <div>
                  <div className="text-sm font-semibold text-zinc-100">Вся доступная история</div>
                  <div className="mt-1 text-xs leading-5 text-zinc-500">Клиент передаст новому участнику локально доступные group keys для старых сообщений.</div>
                </div>
              </div>
            </label>
          </div>

          <div className="mt-5 rounded-3xl border border-white/10 bg-black/15 px-4 py-3">
            <div className="flex items-center gap-3">
              <Search size={18} className="text-zinc-500" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                disabled={!canManageMembers}
                className="w-full bg-transparent text-sm text-zinc-100 outline-none placeholder:text-zinc-600 disabled:cursor-not-allowed"
                placeholder="Найти пользователя по имени, username или email"
              />
            </div>
          </div>

          {errorMessage && <div className="mt-3 rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">{errorMessage}</div>}

          <div className="mt-4 max-h-[28vh] space-y-3 overflow-y-auto pr-1">
            {isSearching && <div className="py-5 text-center text-sm text-zinc-500">Ищем пользователей…</div>}
            {!isSearching && query.trim().length >= 2 && results.length === 0 && <div className="py-5 text-center text-sm text-zinc-500">Новых пользователей не найдено.</div>}
            {results.map((profile) => {
              const displayName = getDisplayName(profile);

              return (
                <div key={profile.accountId} className="flex items-center gap-3 rounded-3xl border border-white/8 bg-white/[0.03] px-4 py-3">
                  <Avatar label={displayName} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold text-zinc-100">{displayName}</div>
                    <div className="mt-1 truncate text-xs text-zinc-500">@{profile.username} • {profile.email}</div>
                  </div>
                  <button
                    onClick={() => void handleAdd(profile)}
                    disabled={!canManageMembers || busyAccountId === profile.accountId}
                    className="rounded-full border border-violet-300/15 bg-violet-400/10 px-3 py-1.5 text-xs text-violet-100 transition hover:border-violet-300/30 hover:bg-violet-400/20 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {busyAccountId === profile.accountId ? 'Добавляем…' : 'Добавить'}
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}


type SettingsTab = 'profile' | 'devices' | 'security';

function isDecryptionPlaceholder(value: string | undefined): boolean {
  if (!value) {
    return false;
  }

  return value === '[Не удалось расшифровать сообщение]' || value === '[Сообщение недоступно для этого устройства]' || value === '[Ключ группы пока недоступен]';
}

function formatDeviceTime(value: string | null | undefined): string {
  if (!value) {
    return 'нет данных';
  }

  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function CryptoStatusBadge({ status }: { status: string }) {
  const isReady = status === 'ready';
  const isError = status === 'error';

  return (
    <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs ${
      isReady
        ? 'border-emerald-300/20 bg-emerald-400/10 text-emerald-200'
        : isError
          ? 'border-red-300/20 bg-red-400/10 text-red-200'
          : 'border-amber-300/20 bg-amber-400/10 text-amber-200'
    }`}
    >
      <ShieldCheck size={13} />
      {isReady ? 'Сквозное шифрование активно' : isError ? 'Ошибка ключей' : 'Настройка шифрования'}
    </span>
  );
}

function SettingsModal({
  isOpen,
  profile,
  deviceId,
  cryptoStatus,
  cryptoDatabasePath,
  realtimeStatus,
  onClose,
  onLogout,
  onBackupRestored,
  onProfileUpdated,
}: {
  isOpen: boolean;
  profile: ProfileResponseDto | null;
  deviceId: string | null;
  cryptoStatus: string;
  cryptoDatabasePath: string | null;
  realtimeStatus: string;
  onClose: () => void;
  onLogout: () => Promise<void>;
  onBackupRestored: () => Promise<void>;
  onProfileUpdated: (profile: ProfileResponseDto) => void;
}) {
  const [activeTab, setActiveTab] = useState<SettingsTab>('profile');
  const [devices, setDevices] = useState<ActiveDeviceResponseDto[]>([]);
  const [isLoadingDevices, setIsLoadingDevices] = useState(false);
  const [devicesError, setDevicesError] = useState<string | null>(null);
  const [backupStatus, setBackupStatus] = useState<KeyBackupStatusResponseDto | null>(null);
  const [backupPassword, setBackupPassword] = useState('');
  const [backupError, setBackupError] = useState<string | null>(null);
  const [backupSuccess, setBackupSuccess] = useState<string | null>(null);
  const [isBackupBusy, setIsBackupBusy] = useState(false);
  const [localAvatarDataUrl, setLocalAvatarDataUrl] = useState<string | null>(() => profile?.avatarDataUrl ?? localStorage.getItem(getLocalAvatarStorageKey(profile?.accountId)));
  const [avatarError, setAvatarError] = useState<string | null>(null);

  async function handleLocalAvatarSelected(file: File | null | undefined) {
    if (!file || !profile?.accountId) {
      return;
    }

    if (!file.type.startsWith('image/')) {
      setAvatarError('Выберите изображение для аватарки.');
      return;
    }

    setAvatarError(null);

    try {
      const dataUrl = await createLocalAvatarDataUrl(file);
      const updatedProfile = await updateCurrentProfileAvatar({ avatarDataUrl: dataUrl });
      localStorage.setItem(getLocalAvatarStorageKey(profile.accountId), dataUrl);
      setLocalAvatarDataUrl(dataUrl);
      onProfileUpdated(updatedProfile);
    }
    catch (error) {
      console.error(error);
      setAvatarError('Не удалось сохранить аватарку.');
    }
  }

  async function loadBackupStatus() {
    try {
      const loadedBackupStatus = await getKeyBackupStatus();
      setBackupStatus(loadedBackupStatus);
    }
    catch (error) {
      console.error(error);
      setBackupError('Не удалось загрузить статус резервной копии.');
    }
  }

  async function handleCreateKeyBackup() {
    if (!profile?.accountId || !window.vectorCrypto) {
      setBackupError('Локальная криптография недоступна.');
      return;
    }

    setIsBackupBusy(true);
    setBackupError(null);
    setBackupSuccess(null);

    try {
      const encryptedBackup = await window.vectorCrypto.exportEncryptedKeyBackup({
        accountId: profile.accountId,
        recoveryPassword: backupPassword,
      });

      await uploadKeyBackup({
        backupVersion: encryptedBackup.backupVersion,
        kdfAlgorithm: encryptedBackup.kdfAlgorithm,
        kdfSaltBase64: encryptedBackup.kdfSaltBase64,
        kdfParametersJson: encryptedBackup.kdfParametersJson,
        encryptionAlgorithm: encryptedBackup.encryptionAlgorithm,
        initializationVectorBase64: encryptedBackup.initializationVectorBase64,
        authenticationTagBase64: encryptedBackup.authenticationTagBase64,
        encryptedBackupBlobBase64: encryptedBackup.encryptedBackupBlobBase64,
      });

      setBackupPassword('');
      setBackupSuccess(`Резервная копия ключей обновлена. Устройств в backup: ${encryptedBackup.exportedDeviceIds.length}.`);
      await loadBackupStatus();
    }
    catch (error) {
      console.error(error);
      setBackupError('Не удалось создать резервную копию. Проверь пароль восстановления и локальный vault.');
    }
    finally {
      setIsBackupBusy(false);
    }
  }

  async function handleRestoreKeyBackup() {
    if (!profile?.accountId || !window.vectorCrypto) {
      setBackupError('Локальная криптография недоступна.');
      return;
    }

    setIsBackupBusy(true);
    setBackupError(null);
    setBackupSuccess(null);

    try {
      const encryptedBackup = await downloadKeyBackup();
      const restoreResult = await window.vectorCrypto.importEncryptedKeyBackup({
        accountId: profile.accountId,
        recoveryPassword: backupPassword,
        backup: encryptedBackup,
      });

      setBackupPassword('');
      setBackupSuccess(`Ключи восстановлены. Доступных device-контекстов: ${restoreResult.importedDeviceIds.length}.`);
      await onBackupRestored();
      await loadBackupStatus();
    }
    catch (error) {
      console.error(error);
      setBackupError('Не удалось восстановить ключи. Возможно, пароль восстановления неверный.');
    }
    finally {
      setIsBackupBusy(false);
    }
  }

  async function loadDevices() {
    if (!profile?.accountId) {
      return;
    }

    setIsLoadingDevices(true);
    setDevicesError(null);

    try {
      const loadedDevices = await getActiveAccountDevices(profile.accountId);
      setDevices(loadedDevices);
    }
    catch (error) {
      console.error(error);
      setDevicesError('Не удалось загрузить список устройств.');
    }
    finally {
      setIsLoadingDevices(false);
    }
  }

  useEffect(() => {
    setLocalAvatarDataUrl(profile?.avatarDataUrl ?? localStorage.getItem(getLocalAvatarStorageKey(profile?.accountId)));
  }, [profile?.accountId]);

  useEffect(() => {
    if (isOpen && activeTab === 'devices') {
      void loadDevices();
    }

    if (isOpen && activeTab === 'security') {
      void loadBackupStatus();
    }
  }, [activeTab, isOpen, profile?.accountId]);

  if (!isOpen || !profile) {
    return null;
  }

  const displayName = getDisplayName(profile);

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm">
      <div className="flex h-[720px] w-full max-w-5xl overflow-hidden rounded-[2rem] border border-white/10 bg-[#15161a] shadow-2xl shadow-black/60">
        <aside className="w-[300px] shrink-0 border-r border-white/10 bg-white/[0.025] p-5">
          <div className="flex items-center gap-4 rounded-[1.75rem] border border-white/10 bg-white/[0.04] p-4">
            <UserAvatar label={displayName} imageUrl={getAccountAvatarUrl(profile, localAvatarDataUrl)} size="lg" />
            <div className="min-w-0">
              <div className="truncate text-base font-semibold text-zinc-50">{displayName}</div>
              <div className="mt-1 truncate text-xs text-zinc-500">@{profile.username}</div>
            </div>
          </div>

          <div className="mt-5 space-y-2">
            {[
              { id: 'profile' as const, label: 'Профиль', icon: Settings },
              { id: 'devices' as const, label: 'Устройства', icon: Monitor },
              { id: 'security' as const, label: 'Безопасность', icon: LockKeyhole },
            ].map((item) => {
              const Icon = item.icon;

              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm transition ${
                    activeTab === item.id
                      ? 'bg-gradient-to-r from-violet-500/25 to-fuchsia-500/10 text-zinc-50 ring-1 ring-violet-300/20'
                      : 'text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-100'
                  }`}
                >
                  <Icon size={17} />
                  {item.label}
                </button>
              );
            })}
          </div>

          <div className="mt-auto pt-5">
            <button
              onClick={() => void onLogout()}
              className="mt-8 flex w-full items-center justify-center gap-2 rounded-2xl border border-red-300/15 bg-red-500/10 px-4 py-3 text-sm font-medium text-red-200 transition hover:bg-red-500/15"
            >
              <LogOut size={16} />
              Выйти
            </button>
          </div>
        </aside>

        <section className="flex min-w-0 flex-1 flex-col">
          <header className="flex h-20 items-center justify-between border-b border-white/10 px-7">
            <div>
              <div className="text-xl font-semibold text-zinc-50">
                {activeTab === 'profile' ? 'Настройки профиля' : activeTab === 'devices' ? 'Активные устройства' : 'Безопасность и шифрование'}
              </div>
              <div className="mt-1 text-sm text-zinc-500">Настройки аккаунта</div>
            </div>
            <button
              onClick={onClose}
              className="rounded-2xl border border-white/10 bg-white/[0.04] p-2 text-zinc-400 transition hover:text-zinc-100"
              title="Закрыть"
            >
              <X size={18} />
            </button>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto p-7">
            {activeTab === 'profile' && (
              <div className="grid gap-5 lg:grid-cols-[220px_1fr]">
                <div className="rounded-[2rem] border border-white/10 bg-white/[0.035] p-6 text-center">
                  <div className="mx-auto mb-4 w-max">
                    <UserAvatar label={displayName} imageUrl={getAccountAvatarUrl(profile, localAvatarDataUrl)} size="lg" />
                  </div>
                  <div className="text-lg font-semibold text-zinc-50">{displayName}</div>
                  <div className="mt-1 text-sm text-zinc-500">@{profile.username}</div>
                  <label className="mt-5 inline-flex cursor-pointer items-center justify-center rounded-2xl border border-violet-300/20 bg-violet-500/10 px-4 py-2 text-sm text-violet-100 transition hover:bg-violet-500/15">
                    Сменить аватар
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(event) => {
                        const file = event.target.files?.[0] ?? null;
                        event.target.value = '';
                        void handleLocalAvatarSelected(file);
                      }}
                    />
                  </label>
                  {avatarError && <div className="mt-3 rounded-2xl border border-red-400/20 bg-red-500/10 p-3 text-xs text-red-200">{avatarError}</div>}
                </div>

                <div className="space-y-3 rounded-[2rem] border border-white/10 bg-white/[0.035] p-6">
                  {[
                    ['Email', profile.email],
                    ['Имя', profile.firstName],
                    ['Фамилия', profile.lastName],
                    ['Статус аккаунта', profile.status === 'ACTIVE' ? 'Активен' : profile.status ?? 'Активен'],
                  ].map(([label, value]) => (
                    <div key={label} className="flex items-center justify-between gap-4 border-b border-white/5 py-3 last:border-b-0">
                      <span className="text-sm text-zinc-500">{label}</span>
                      <span className="max-w-[420px] truncate text-right text-sm text-zinc-200">{value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'devices' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-4 rounded-[2rem] border border-white/10 bg-white/[0.035] p-5">
                  <div>
                    <div className="text-base font-semibold text-zinc-50">Устройства аккаунта</div>
                    <div className="mt-1 text-sm text-zinc-500">Здесь показаны устройства, на которых выполнен вход.</div>
                  </div>
                  <button
                    onClick={() => void loadDevices()}
                    className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-zinc-300 transition hover:border-violet-300/25 hover:text-zinc-50"
                  >
                    <RefreshCw size={15} className={isLoadingDevices ? 'animate-spin' : ''} />
                    Обновить
                  </button>
                </div>

                {devicesError && (
                  <div className="rounded-2xl border border-red-400/20 bg-red-500/10 p-4 text-sm text-red-200">{devicesError}</div>
                )}

                <div className="space-y-3">
                  {isLoadingDevices && devices.length === 0 && (
                    <div className="rounded-[2rem] border border-white/10 bg-white/[0.025] p-8 text-center text-sm text-zinc-500">Загружаем устройства...</div>
                  )}

                  {!isLoadingDevices && devices.length === 0 && (
                    <div className="rounded-[2rem] border border-dashed border-white/10 bg-white/[0.025] p-8 text-center text-sm text-zinc-500">Устройства не найдены.</div>
                  )}

                  {devices.map((device) => {
                    const activeDeviceId = device.deviceId;
                    const isCurrentDevice = activeDeviceId === deviceId;

                    return (
                      <div key={activeDeviceId} className="rounded-[1.75rem] border border-white/10 bg-white/[0.035] p-5">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex min-w-0 items-center gap-4">
                            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white shadow-lg shadow-violet-950/30">
                              <Monitor size={19} />
                            </div>
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-semibold text-zinc-50">{device.deviceName}</span>
                                {isCurrentDevice && (
                                  <span className="rounded-full border border-emerald-300/20 bg-emerald-400/10 px-2 py-0.5 text-[11px] text-emerald-200">это устройство</span>
                                )}
                              </div>
                              <div className="mt-1 text-xs text-zinc-500">{device.platform} • версия {device.clientVersion ?? 'неизвестна'}</div>
                            </div>
                          </div>

                          <span className="rounded-full border border-emerald-300/20 bg-emerald-400/10 px-3 py-1 text-xs text-emerald-200">{device.status === 'ACTIVE' ? 'активно' : device.status}</span>
                        </div>

                        <div className="mt-4 grid gap-3 text-xs text-zinc-500 sm:grid-cols-2">
                          <div className="rounded-2xl bg-black/15 p-3">Последняя активность: <span className="text-zinc-300">{formatDeviceTime(device.lastSeenAt)}</span></div>
                          <div className="rounded-2xl bg-black/15 p-3">Статус: <span className="text-zinc-300">{isCurrentDevice ? 'сейчас используется' : 'другое устройство'}</span></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {activeTab === 'security' && (
              <div className="space-y-4">
                <div className="rounded-[2rem] border border-white/10 bg-white/[0.035] p-6">
                  <div className="mb-4 flex items-center justify-between gap-4">
                    <div>
                      <div className="text-base font-semibold text-zinc-50">End-to-end encryption</div>
                      <div className="mt-1 text-sm text-zinc-500">Ключи хранятся локально в зашифрованном vault этого устройства.</div>
                    </div>
                    <CryptoStatusBadge status={cryptoStatus} />
                  </div>

                  <div className="grid gap-3 text-sm sm:grid-cols-2">
                    <div className="rounded-2xl border border-white/8 bg-black/15 p-4">
                      <div className="mb-2 flex items-center gap-2 text-zinc-300"><KeyRound size={15} /> Локальный device</div>
                      <div className="break-all text-xs text-zinc-500">{deviceId ?? 'неизвестно'}</div>
                    </div>
                    <div className="rounded-2xl border border-white/8 bg-black/15 p-4">
                      <div className="mb-2 flex items-center gap-2 text-zinc-300"><Wifi size={15} /> Realtime</div>
                      <div className="text-xs text-zinc-500">{realtimeStatus}</div>
                    </div>
                    <div className="rounded-2xl border border-white/8 bg-black/15 p-4 sm:col-span-2">
                      <div className="mb-2 flex items-center gap-2 text-zinc-300"><LockKeyhole size={15} /> Локальное хранилище ключей</div>
                      <div className="break-all text-xs text-zinc-500">{cryptoDatabasePath ?? 'путь недоступен'}</div>
                    </div>
                  </div>
                </div>

                <div className="rounded-[2rem] border border-white/10 bg-white/[0.035] p-6">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <div className="text-base font-semibold text-zinc-50">Encrypted key backup</div>
                      <div className="mt-1 max-w-2xl text-sm leading-6 text-zinc-500">
                        Backup хранит на сервере только зашифрованный архив локальных ключей. Сервер не знает пароль восстановления и не может прочитать историю.
                      </div>
                    </div>
                    <button
                      onClick={() => void loadBackupStatus()}
                      className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-zinc-300 transition hover:border-violet-300/25 hover:text-zinc-50"
                    >
                      <RefreshCw size={15} />
                      Статус
                    </button>
                  </div>

                  <div className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
                    <div className="rounded-2xl border border-white/8 bg-black/15 p-4">
                      <div className="mb-2 text-zinc-300">Состояние</div>
                      <div className="text-xs text-zinc-500">
                        {backupStatus?.exists ? `Включён, версия ${backupStatus.backupVersion}` : 'Backup ещё не создан'}
                      </div>
                    </div>
                    <div className="rounded-2xl border border-white/8 bg-black/15 p-4">
                      <div className="mb-2 text-zinc-300">Последнее обновление</div>
                      <div className="text-xs text-zinc-500">{formatDeviceTime(backupStatus?.updatedAt)}</div>
                    </div>
                  </div>

                  <div className="mt-5 space-y-3">
                    <input
                      type="password"
                      value={backupPassword}
                      onChange={(event) => setBackupPassword(event.target.value)}
                      placeholder="Пароль восстановления, минимум 12 символов"
                      className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-violet-300/35"
                    />
                    <div className="flex flex-wrap gap-3">
                      <button
                        onClick={() => void handleCreateKeyBackup()}
                        disabled={isBackupBusy || backupPassword.length < 12}
                        className="inline-flex items-center gap-2 rounded-2xl border border-emerald-300/20 bg-emerald-500/10 px-4 py-2 text-sm font-medium text-emerald-200 transition hover:bg-emerald-500/15 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <ShieldCheck size={15} />
                        Создать / обновить backup
                      </button>
                      <button
                        onClick={() => void handleRestoreKeyBackup()}
                        disabled={isBackupBusy || backupPassword.length < 12 || backupStatus?.exists === false}
                        className="inline-flex items-center gap-2 rounded-2xl border border-violet-300/20 bg-violet-500/10 px-4 py-2 text-sm font-medium text-violet-200 transition hover:bg-violet-500/15 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <Download size={15} />
                        Восстановить ключи
                      </button>
                    </div>
                    {backupError && <div className="rounded-2xl border border-red-400/20 bg-red-500/10 p-3 text-sm text-red-200">{backupError}</div>}
                    {backupSuccess && <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-3 text-sm text-emerald-200">{backupSuccess}</div>}
                  </div>
                </div>

                <div className="rounded-[2rem] border border-violet-300/15 bg-violet-500/10 p-5 text-sm leading-6 text-violet-100/85">
                  Сервер хранит только зашифрованные payload'ы и encrypted backup. Без пароля восстановления резервная копия не раскрывает локальные Signal-секреты.
                </div>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}


function MiniProfileModal({
  profile,
  isCurrentAccount,
  lastActivityAt,
  presence,
  localAvatarDataUrl,
  onClose,
  onMessage,
}: {
  profile: ProfileResponseDto | null;
  isCurrentAccount: boolean;
  lastActivityAt: string | null | undefined;
  presence: AccountPresenceState | null | undefined;
  localAvatarDataUrl: string | null;
  onClose: () => void;
  onMessage: (profile: ProfileResponseDto) => Promise<void>;
}) {
  const [isOpeningChat, setIsOpeningChat] = useState(false);

  if (!profile) {
    return null;
  }

  const activeProfile = profile;
  const displayName = getDisplayName(activeProfile);
  const avatarUrl = getAccountAvatarUrl(activeProfile, isCurrentAccount ? localAvatarDataUrl : null);

  async function handleMessageClick() {
    setIsOpeningChat(true);

    try {
      await onMessage(activeProfile);
      onClose();
    }
    finally {
      setIsOpeningChat(false);
    }
  }

  return (
    <div className="absolute inset-0 z-[60] flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md overflow-hidden rounded-[2rem] border border-white/10 bg-[#18191d] shadow-2xl shadow-black/60">
        <div className="relative bg-gradient-to-br from-violet-500/25 via-fuchsia-500/10 to-transparent p-6">
          <button
            onClick={onClose}
            className="absolute right-4 top-4 rounded-2xl border border-white/10 bg-black/15 p-2 text-zinc-300 transition hover:text-white"
            title="Закрыть"
          >
            <X size={18} />
          </button>
          <div className="flex items-center gap-4">
            <UserAvatar label={displayName} imageUrl={avatarUrl} size="lg" />
            <div className="min-w-0 pr-10">
              <div className="truncate text-xl font-semibold text-zinc-50">{displayName}</div>
              <div className="mt-1 text-sm text-zinc-400">{getAccountActivityLabel(presence, lastActivityAt)}</div>
            </div>
          </div>
        </div>

        <div className="space-y-3 p-5">
          <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-4">
            <div className="flex items-center gap-3 text-sm text-zinc-300">
              <User size={16} className="text-violet-200" />
              <span>@{profile.username}</span>
            </div>
            <div className="mt-3 flex items-center gap-3 text-sm text-zinc-300">
              <Mail size={16} className="text-violet-200" />
              <span className="truncate">{profile.email}</span>
            </div>
            <div className="mt-3 flex items-center gap-3 text-sm text-zinc-300">
              <Clock3 size={16} className="text-violet-200" />
              <span>{getAccountActivityLabel(presence, lastActivityAt)}</span>
            </div>
          </div>

          {!isCurrentAccount && (
            <button
              onClick={() => void handleMessageClick()}
              disabled={isOpeningChat}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-violet-500 to-fuchsia-500 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-violet-950/30 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isOpeningChat ? <LoaderCircle size={17} className="animate-spin" /> : <MessageSquare size={17} />}
              Написать
            </button>
          )}
        </div>
      </div>
    </div>
  );
}


async function decryptDirectMessageWithAvailablePayloads(
  message: MessageResponseDto,
  currentDevicePayloads: MessageResponseDto['devicePayloads'],
  accountId: string,
  vectorCrypto: NonNullable<typeof window.vectorCrypto>,
) {
  const errors: unknown[] = [];

  for (const currentDevicePayload of currentDevicePayloads) {
    try {
      return await vectorCrypto.decryptMessage({
        accountId,
        deviceId: currentDevicePayload.targetDeviceId,
        messageId: message.messageId,
        remoteDeviceId: message.senderDeviceId,
        ciphertextType: currentDevicePayload.ciphertextType,
        encryptedPayload: currentDevicePayload.encryptedPayload,
      });
    }
    catch (error) {
      errors.push(error);
    }
  }

  throw errors.at(-1) ?? new Error('No decryptable payload is available for this message.');
}

export function MessengerPage() {
  const navigate = useNavigate();
  const profile = useAuthStore((state) => state.profile);
  const deviceId = useAuthStore((state) => state.deviceId);
  const refreshToken = useAuthStore((state) => state.refreshToken);
  const clearAuthentication = useAuthStore((state) => state.clearAuthentication);
  const setProfile = useAuthStore((state) => state.setProfile);
  const realtimeStatus = useRealtimeStore((state) => state.status);
  const [restoredDeviceIds, setRestoredDeviceIds] = useState<string[]>([]);
  const [localAvatarDataUrl, setLocalAvatarDataUrl] = useState<string | null>(() => profile?.avatarDataUrl ?? localStorage.getItem(getLocalAvatarStorageKey(profile?.accountId)));
  const [miniProfile, setMiniProfile] = useState<ProfileResponseDto | null>(null);
  const typingByChatId = useRealtimeStore((state) => state.typingByChatId);
  const presenceByAccountId = useRealtimeStore((state) => state.presenceByAccountId);
  const sendTypingEvent = useRealtimeStore((state) => state.sendTypingEvent);
  const cryptoStatus = useCryptoStore((state) => state.status);
  const cryptoDatabasePath = useCryptoStore((state) => state.databasePath);

  const chats = useMessengerStore((state) => state.chats);
  const selectedChatId = useMessengerStore((state) => state.selectedChatId);
  const messagesByChatId = useMessengerStore((state) => state.messagesByChatId);
  const setChats = useMessengerStore((state) => state.setChats);
  const upsertChat = useMessengerStore((state) => state.upsertChat);
  const selectChat = useMessengerStore((state) => state.selectChat);
  const setMessages = useMessengerStore((state) => state.setMessages);
  const upsertMessage = useMessengerStore((state) => state.upsertMessage);

  const profilesById = useDirectoryStore((state) => state.profilesById);
  const upsertProfile = useDirectoryStore((state) => state.upsertProfile);

  const [messageText, setMessageText] = useState('');
  const [chatSearchQuery, setChatSearchQuery] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isUploadingFile, setIsUploadingFile] = useState(false);
  const [isCreateChatOpen, setIsCreateChatOpen] = useState(false);
  const [isDevToolsOpen, setIsDevToolsOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAttachmentMenuOpen, setIsAttachmentMenuOpen] = useState(false);
  const [isDocumentsPanelOpen, setIsDocumentsPanelOpen] = useState(false);
  const [isGroupManagementOpen, setIsGroupManagementOpen] = useState(false);
  const [chatDocuments, setChatDocuments] = useState<DocumentResponseDto[]>([]);
  const [isLoadingDocuments, setIsLoadingDocuments] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [decryptedMessagesById, setDecryptedMessagesById] = useState<Record<string, string>>({});
  const [readDetailsMessageId, setReadDetailsMessageId] = useState<string | null>(null);
  const [localChatState, setLocalChatState] = useState<LocalChatState>(() => readLocalChatState(profile?.accountId));
  const [openedChatMenuId, setOpenedChatMenuId] = useState<string | null>(null);
  const [isChatActionsMenuOpen, setIsChatActionsMenuOpen] = useState(false);
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);
  const [isDraggingFileOverChat, setIsDraggingFileOverChat] = useState(false);

  const decryptingMessageIdsRef = useRef<Set<string>>(new Set());
  const permanentlyUnavailableMessageIdsRef = useRef<Set<string>>(new Set());
  const temporarilyMissingGroupKeyMessageIdsRef = useRef<Set<string>>(new Set());

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const documentInputRef = useRef<HTMLInputElement | null>(null);
  const deliveredMarkersRef = useRef<Set<string>>(new Set());
  const readMarkersRef = useRef<Set<string>>(new Set());
  const lastTypingSentAtRef = useRef(0);
  const typingStopTimeoutRef = useRef<number | null>(null);

  function updateLocalChatState(updater: (previousValue: LocalChatState) => LocalChatState) {
    setLocalChatState((previousValue) => {
      const nextValue = updater(previousValue);
      writeLocalChatState(profile?.accountId, nextValue);
      return nextValue;
    });
  }

  async function loadRestoredDeviceIds() {
    if (!profile?.accountId || !window.vectorCrypto) {
      setRestoredDeviceIds([]);
      return;
    }

    try {
      const loadedDeviceIds = await window.vectorCrypto.getRestoredDeviceIds({ accountId: profile.accountId });
      setRestoredDeviceIds(loadedDeviceIds);
    }
    catch (error) {
      console.warn(error);
      setRestoredDeviceIds([]);
    }
  }

  async function handleKeyBackupRestored() {
    permanentlyUnavailableMessageIdsRef.current.clear();
    temporarilyMissingGroupKeyMessageIdsRef.current.clear();
    decryptingMessageIdsRef.current.clear();
    setDecryptedMessagesById({});
    await loadRestoredDeviceIds();

    if (selectedChatId) {
      try {
        const loadedMessages = await getChatMessages(selectedChatId);
        setMessages(selectedChatId, loadedMessages);
      }
      catch (error) {
        console.error(error);
        setErrorMessage('Ключи восстановлены, но не удалось сразу обновить историю чата. Перезагрузите чат вручную.');
      }
    }
  }

  useEffect(() => {
    void loadRestoredDeviceIds();
  }, [profile?.accountId, deviceId]);

  useRealtimeConnection();
  useCryptoBootstrap();

  useEffect(() => {
    if (profile) {
      upsertProfile(profile);
    }
  }, [profile, upsertProfile]);

  useEffect(() => {
    setLocalChatState(readLocalChatState(profile?.accountId));
  }, [profile?.accountId]);

  useEffect(() => {
    setLocalAvatarDataUrl(profile?.avatarDataUrl ?? localStorage.getItem(getLocalAvatarStorageKey(profile?.accountId)));
  }, [profile?.accountId]);

  useEffect(() => {
    function handleKeyboardShortcut(event: globalThis.KeyboardEvent) {
      if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === 'd' && profile?.username === 'admin') {
        event.preventDefault();
        setIsDevToolsOpen((previousValue) => !previousValue);
      }
    }

    window.addEventListener('keydown', handleKeyboardShortcut);
    return () => window.removeEventListener('keydown', handleKeyboardShortcut);
  }, [profile?.username]);

  const selectedChat = useMemo(
    () => chats.find((chat) => chat.chatId === selectedChatId) ?? null,
    [chats, selectedChatId],
  );

  const selectedMessages = selectedChatId ? messagesByChatId[selectedChatId] ?? [] : [];
  const visibleSelectedMessages = useMemo(
    () => getVisibleChatMessages(selectedMessages, selectedChatId ? localChatState.clearedAtByChatId[selectedChatId] : null),
    [localChatState.clearedAtByChatId, selectedChatId, selectedMessages],
  );
  const loadedMessages = useMemo(
    () => Object.values(messagesByChatId).flat(),
    [messagesByChatId],
  );
  const lastActivityByAccountId = useMemo(
    () => buildAccountLastActivityMap(messagesByChatId),
    [messagesByChatId],
  );
  const hiddenChatIdSet = useMemo(() => new Set(localChatState.hiddenChatIds), [localChatState.hiddenChatIds]);
  const selectedChatActiveParticipantAccountIds = useMemo(
    () => getActiveGroupParticipantAccountIds(selectedChat),
    [selectedChat],
  );
  const selectedChatActiveParticipantAccountIdSet = useMemo(
    () => new Set(selectedChatActiveParticipantAccountIds),
    [selectedChatActiveParticipantAccountIds],
  );
  const selectedChatCurrentParticipant = useMemo(
    () => getCurrentGroupParticipant(selectedChat, profile?.accountId),
    [profile?.accountId, selectedChat],
  );
  const isSelectedChatWritable = isCurrentAccountActiveInChat(selectedChat, profile?.accountId);
  const selectedTypingStates = selectedChatId
    ? (typingByChatId[selectedChatId] ?? []).filter((typingState) => selectedChat?.type !== 'GROUP' || selectedChatActiveParticipantAccountIdSet.has(typingState.accountId))
    : [];

  useEffect(() => {
    const vectorCrypto = window.vectorCrypto;

    if (!profile?.accountId || !deviceId || !vectorCrypto) {
      return;
    }

    loadedMessages.forEach((message) => {
      const messageId = message.messageId;

      const cachedPlainText = decryptedMessagesById[messageId];

      if (cachedPlainText && !isDecryptionPlaceholder(cachedPlainText)) {
        return;
      }

      if (decryptingMessageIdsRef.current.has(messageId) || permanentlyUnavailableMessageIdsRef.current.has(messageId) || temporarilyMissingGroupKeyMessageIdsRef.current.has(messageId)) {
        return;
      }

      if (message.messageType === 'SYSTEM') {
        setDecryptedMessagesById((previousValue) => ({
          ...previousValue,
          [messageId]: message.encryptedPayload ?? '',
        }));
        return;
      }

      if (message.encryptionType === 'GROUP' && message.encryptedPayload) {
        decryptingMessageIdsRef.current.add(messageId);

        const localDecryptDeviceIds = new Set([deviceId, ...restoredDeviceIds].filter(Boolean));
        const currentDevicePayloads = message.devicePayloads.filter((devicePayload) => localDecryptDeviceIds.has(devicePayload.targetDeviceId));

        const decryptGroupMessageWithAvailableKey = async () => {
          const directDecryptErrors: unknown[] = [];

          try {
            const directDecryptResponse = await vectorCrypto.decryptGroupMessage({
              accountId: profile.accountId,
              deviceId,
              chatId: message.chatId,
              messageId,
              encryptedPayload: message.encryptedPayload!,
            });

            if (!directDecryptResponse.plainText) {
              throw new Error('Group key is not available on this device. Restore key backup or receive a key distribution package.');
            }

            return directDecryptResponse;
          }
          catch (firstError) {
            directDecryptErrors.push(firstError);
          }

          for (const currentDevicePayload of currentDevicePayloads) {
            try {
              const groupKeyPackage = await vectorCrypto.decryptMessage({
                accountId: profile.accountId,
                deviceId: currentDevicePayload.targetDeviceId,
                messageId: `${messageId}:group-key:${currentDevicePayload.targetDeviceId}`,
                remoteDeviceId: message.senderDeviceId,
                ciphertextType: currentDevicePayload.ciphertextType,
                encryptedPayload: currentDevicePayload.encryptedPayload,
              });

              await vectorCrypto.importGroupKey({
                accountId: profile.accountId,
                chatId: message.chatId,
                groupKeyPackagePlainText: groupKeyPackage.plainText,
              });

              const decryptResponseAfterImport = await vectorCrypto.decryptGroupMessage({
                accountId: profile.accountId,
                deviceId,
                chatId: message.chatId,
                messageId,
                encryptedPayload: message.encryptedPayload!,
              });

              if (!decryptResponseAfterImport.plainText) {
                throw new Error('Group key is not available on this device. Restore key backup or receive a key distribution package.');
              }

              return decryptResponseAfterImport;
            }
            catch (candidateError) {
              directDecryptErrors.push(candidateError);
            }
          }

          throw directDecryptErrors.at(-1) ?? new Error('Group key is not available on this device.');
        };

        decryptGroupMessageWithAvailableKey()
          .then((decryptResponse) => {
            const plainText = decryptResponse.plainText;

            if (!plainText) {
              throw new Error('Group key is not available on this device. Restore key backup or receive a key distribution package.');
            }

            temporarilyMissingGroupKeyMessageIdsRef.current.delete(messageId);
            setDecryptedMessagesById((previousValue) => ({
              ...previousValue,
              [messageId]: plainText,
            }));
          })
          .catch((error) => {
            const errorMessageText = error instanceof Error ? error.message : String(error);
            const isMissingGroupKey = errorMessageText.includes('Group key is not available');

            if (isMissingGroupKey) {
              temporarilyMissingGroupKeyMessageIdsRef.current.add(messageId);
              console.warn(errorMessageText);
            }
            else {
              console.error(error);
            }

            setDecryptedMessagesById((previousValue) => {
              const previousPlainText = previousValue[messageId];

              if (previousPlainText && !isDecryptionPlaceholder(previousPlainText)) {
                return previousValue;
              }

              return {
                ...previousValue,
                [messageId]: isMissingGroupKey ? '[Ключ группы пока недоступен]' : '[Не удалось расшифровать сообщение]',
              };
            });
          })
          .finally(() => {
            decryptingMessageIdsRef.current.delete(messageId);
          });
        return;
      }

      const localDecryptDeviceIds = new Set([deviceId, ...restoredDeviceIds].filter(Boolean));
      const currentDevicePayloads = message.devicePayloads.filter((devicePayload) => localDecryptDeviceIds.has(devicePayload.targetDeviceId));

      if (currentDevicePayloads.length === 0) {
        permanentlyUnavailableMessageIdsRef.current.add(messageId);
        setDecryptedMessagesById((previousValue) => {
          if (previousValue[messageId]) {
            return previousValue;
          }

          return {
            ...previousValue,
            [messageId]: '[Сообщение недоступно для этого устройства]',
          };
        });
        return;
      }

      decryptingMessageIdsRef.current.add(messageId);

      decryptDirectMessageWithAvailablePayloads(message, currentDevicePayloads, profile.accountId, vectorCrypto)
        .then(async (decryptResponse) => {
          if (message.messageType === 'GROUP_KEY_DISTRIBUTION') {
            await vectorCrypto.importGroupKey({
              accountId: profile.accountId,
              chatId: message.chatId,
              groupKeyPackagePlainText: decryptResponse.plainText,
            });

            temporarilyMissingGroupKeyMessageIdsRef.current.clear();
            setDecryptedMessagesById((previousValue) => {
              const nextValue = { ...previousValue, [messageId]: '[Ключ группы обновлён]' };

              Object.keys(nextValue).forEach((cachedMessageId) => {
                if (nextValue[cachedMessageId] === '[Ключ группы пока недоступен]' || nextValue[cachedMessageId] === '[Не удалось расшифровать сообщение]') {
                  delete nextValue[cachedMessageId];
                }
              });

              return nextValue;
            });
            return;
          }

          setDecryptedMessagesById((previousValue) => ({
            ...previousValue,
            [messageId]: decryptResponse.plainText,
          }));
        })
        .catch((error) => {
          console.error(error);
          setDecryptedMessagesById((previousValue) => {
            const previousPlainText = previousValue[messageId];

            if (previousPlainText && !isDecryptionPlaceholder(previousPlainText)) {
              return previousValue;
            }

            return {
              ...previousValue,
              [messageId]: '[Не удалось расшифровать сообщение]',
            };
          });
        })
        .finally(() => {
          decryptingMessageIdsRef.current.delete(messageId);
        });
    });
  }, [decryptedMessagesById, deviceId, loadedMessages, profile?.accountId, restoredDeviceIds]);

  const filteredChats = useMemo(() => {
    const normalizedQuery = chatSearchQuery.trim().toLowerCase();

    const visibleChats = chats.filter((chat) => {
      if (hiddenChatIdSet.has(chat.chatId)) {
        return false;
      }

      if (chat.type === 'DIRECT') {
        const chatMessages = messagesByChatId[chat.chatId] ?? [];
        const hasTimelineMessage = Boolean(getLastTimelineMessage(chatMessages));

        if (!chat.lastMessageId && !hasTimelineMessage) {
          return false;
        }
      }

      return true;
    });

    if (!normalizedQuery) {
      return visibleChats;
    }

    return visibleChats.filter((chat) => {
      const presentation = getChatPresentation(chat, profile, profilesById);
      return `${presentation.title} ${presentation.subtitle}`.toLowerCase().includes(normalizedQuery);
    });
  }, [chatSearchQuery, chats, hiddenChatIdSet, messagesByChatId, profile, profilesById]);

  async function refreshSelectedChat(options?: { silent?: boolean }) {
    if (!selectedChatId) {
      return null;
    }

    try {
      const refreshedChat = await getChat(selectedChatId);
      upsertChat(refreshedChat);
      return refreshedChat;
    }
    catch (error) {
      if (!options?.silent) {
        console.error(error);
      }
      return null;
    }
  }

  useEffect(() => {
    async function loadChats() {
      try {
        const loadedChats = await getChats();
        let nextChats = loadedChats;

        if (!loadedChats.some((chat) => chat.type === 'SELF')) {
          const selfChat = await createSelfChat();
          nextChats = [selfChat, ...loadedChats];
        }

        setChats(nextChats);

        if (nextChats.length > 0) {
          const activeChatStillExists = selectedChatId && nextChats.some((chat) => chat.chatId === selectedChatId);

          if (!activeChatStillExists) {
            const selfChat = nextChats.find((chat) => chat.type === 'SELF');
            selectChat(selfChat?.chatId ?? nextChats[0].chatId);
          }
        }
      }
      catch (error) {
        console.error(error);
        setErrorMessage('Не удалось загрузить чаты.');
      }
    }

    loadChats();
  }, [selectChat, selectedChatId, setChats]);

  useEffect(() => {
    async function loadMessages() {
      if (!selectedChatId) {
        return;
      }

      try {
        const loadedMessages = await getChatMessages(selectedChatId);
        setMessages(selectedChatId, loadedMessages);
      }
      catch (error) {
        console.error(error);
        setErrorMessage('Не удалось загрузить сообщения.');
      }
    }

    loadMessages();
  }, [selectedChatId, setMessages]);

  useEffect(() => {
    let isCancelled = false;

    async function loadMissingChatMessages() {
      const chatsWithoutMessages = chats.filter((chat) => (
        !hiddenChatIdSet.has(chat.chatId)
        && !messagesByChatId[chat.chatId]
      ));

      await Promise.all(chatsWithoutMessages.map(async (chat) => {
        try {
          const loadedMessagesForChat = await getChatMessages(chat.chatId);

          if (!isCancelled) {
            setMessages(chat.chatId, loadedMessagesForChat);
          }
        }
        catch (error) {
          console.warn('Failed to load chat messages for sidebar preview.', error);
        }
      }));
    }

    void loadMissingChatMessages();

    return () => {
      isCancelled = true;
    };
  }, [chats, hiddenChatIdSet, messagesByChatId, setMessages]);

  useEffect(() => {
    if (!profile?.accountId || localChatState.hiddenChatIds.length === 0) {
      return;
    }

    const hiddenChatIdsToRestore = localChatState.hiddenChatIds.filter((hiddenChatId) => {
      const chatMessages = messagesByChatId[hiddenChatId] ?? [];
      const clearedAt = localChatState.clearedAtByChatId[hiddenChatId];
      const clearedAtTime = clearedAt ? new Date(clearedAt).getTime() : 0;

      return chatMessages.some((message) => (
        message.senderAccountId !== profile.accountId
        && message.messageType !== 'GROUP_KEY_DISTRIBUTION'
        && new Date(message.createdAt).getTime() > clearedAtTime
      ));
    });

    if (hiddenChatIdsToRestore.length === 0) {
      return;
    }

    const hiddenChatIdRestoreSet = new Set(hiddenChatIdsToRestore);

    updateLocalChatState((previousValue) => ({
      ...previousValue,
      hiddenChatIds: previousValue.hiddenChatIds.filter((hiddenChatId) => !hiddenChatIdRestoreSet.has(hiddenChatId)),
    }));
  }, [localChatState.clearedAtByChatId, localChatState.hiddenChatIds, messagesByChatId, profile?.accountId]);

  useEffect(() => {
    if (!selectedChatId) {
      return;
    }

    let isCancelled = false;

    const refreshChat = async () => {
      if (isCancelled) {
        return;
      }

      await refreshSelectedChat({ silent: true });
    };

    void refreshChat();
    const intervalId = window.setInterval(refreshChat, 2500);

    return () => {
      isCancelled = true;
      window.clearInterval(intervalId);
    };
  }, [selectedChatId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
  }, [selectedChatId]);

  useEffect(() => {
    setReadDetailsMessageId(null);
  }, [selectedChatId]);

  useEffect(() => {
    if (!selectedChatId || visibleSelectedMessages.length === 0) {
      return;
    }

    const lastVisibleMessage = getLastTimelineMessage(visibleSelectedMessages);

    if (!lastVisibleMessage) {
      return;
    }

    updateLocalChatState((previousValue) => ({
      ...previousValue,
      readAtByChatId: {
        ...previousValue.readAtByChatId,
        [selectedChatId]: lastVisibleMessage.createdAt,
      },
    }));
  }, [selectedChatId, visibleSelectedMessages]);

  useEffect(() => {
    if (!selectedChatId || !profile?.accountId || visibleSelectedMessages.length === 0 || !isSelectedChatWritable) {
      return;
    }

    const incomingMessages = visibleSelectedMessages.filter((message) => (
      message.senderAccountId !== profile.accountId
      && message.messageType !== 'SYSTEM'
      && message.messageType !== 'GROUP_KEY_DISTRIBUTION'
    ));

    incomingMessages.forEach((message) => {
      const deliveredMarker = `${selectedChatId}:${message.messageId}:delivered`;

      if (deliveredMarkersRef.current.has(deliveredMarker)) {
        return;
      }

      deliveredMarkersRef.current.add(deliveredMarker);
      markMessageDelivered(selectedChatId, message.messageId).catch((error) => {
        console.error(error);
      });
    });

    const lastIncomingMessage = incomingMessages.at(-1);

    if (!lastIncomingMessage) {
      return;
    }

    const readMarker = `${selectedChatId}:${lastIncomingMessage.messageId}:read`;

    if (readMarkersRef.current.has(readMarker)) {
      return;
    }

    readMarkersRef.current.add(readMarker);
    markChatRead(selectedChatId, lastIncomingMessage.messageId).catch((error) => {
      console.error(error);
    });
  }, [isSelectedChatWritable, profile?.accountId, selectedChatId, visibleSelectedMessages]);

  async function buildEncryptedDevicePayloadsForAccounts(plainText: string, targetAccountIds: string[]) {
    if (!deviceId || !profile?.accountId) {
      throw new Error('Profile or local device is not available.');
    }

    const uniqueTargetAccountIds = Array.from(new Set(targetAccountIds));
    const activeDevicesByAccount = await Promise.all(
      uniqueTargetAccountIds.map(async (targetAccountId) => ({
        targetAccountId,
        devices: await getActiveAccountDevices(targetAccountId),
      })),
    );
    const targetDevices = activeDevicesByAccount.flatMap(({ targetAccountId, devices }) => devices.map((targetDevice) => ({
      targetAccountId,
      targetDeviceId: targetDevice.deviceId,
    })));

    if (targetDevices.length === 0) {
      throw new Error('No active devices are available for message recipients.');
    }

    const vectorCrypto = window.vectorCrypto;

    if (!vectorCrypto) {
      throw new Error('Local cryptography is not available.');
    }

    return Promise.all(targetDevices.map(async (targetDevice) => {
      const encryptedMessage = targetDevice.targetDeviceId === deviceId
        ? await vectorCrypto.encryptLocalMessage({
          accountId: profile.accountId,
          deviceId,
          plainText,
        })
        : await (async () => {
          const preKeyBundle = await getPreKeyBundle(targetDevice.targetDeviceId);

          return vectorCrypto.encryptMessage({
            accountId: profile.accountId,
            deviceId,
            targetDeviceId: targetDevice.targetDeviceId,
            plainText,
            preKeyBundle,
          });
        })();

      return {
        targetAccountId: targetDevice.targetAccountId,
        targetDeviceId: targetDevice.targetDeviceId,
        ciphertextType: encryptedMessage.ciphertextType,
        encryptedPayload: encryptedMessage.encryptedPayload,
      };
    }));
  }

  async function buildEncryptedDevicePayloads(plainText: string, chatForRecipients: ChatResponseDto | null = selectedChat) {
    if (!chatForRecipients) {
      throw new Error('Chat is not available.');
    }

    return buildEncryptedDevicePayloadsForAccounts(plainText, getActiveGroupParticipantAccountIds(chatForRecipients));
  }

  async function sendEncryptedChatContent(plainText: string, messageType: 'TEXT' | 'FILE' = 'TEXT') {
    if (!selectedChatId || !deviceId) {
      throw new Error('Chat or local device is not available.');
    }

    const currentChatState = selectedChat?.type === 'GROUP'
      ? await refreshSelectedChat({ silent: true }) ?? selectedChat
      : selectedChat;

    if (!isCurrentAccountActiveInChat(currentChatState, profile?.accountId)) {
      throw new Error('Current account is not an active participant of this chat.');
    }

    const groupEpoch = currentChatState?.currentKeyEpoch ?? 1;
    const groupEncryptedMessage = currentChatState?.type === 'GROUP' && window.vectorCrypto
      ? await window.vectorCrypto.encryptGroupMessage({
        accountId: profile?.accountId ?? '',
        deviceId,
        chatId: selectedChatId,
        epoch: groupEpoch,
        plainText,
      })
      : null;
    const devicePayloads = groupEncryptedMessage
      ? await buildEncryptedDevicePayloads(groupEncryptedMessage.groupKeyPackagePlainText, currentChatState)
      : await buildEncryptedDevicePayloads(plainText, currentChatState);

    const savedMessage = await sendMessage(selectedChatId, {
      senderDeviceId: deviceId,
      clientMessageId: crypto.randomUUID(),
      messageType,
      encryptionType: groupEncryptedMessage ? 'GROUP' : 'SIGNAL',
      encryptedPayload: groupEncryptedMessage?.encryptedPayload ?? null,
      devicePayloads,
    });

    upsertMessage(savedMessage);
    setDecryptedMessagesById((previousValue) => ({
      ...previousValue,
      [savedMessage.messageId]: plainText,
    }));

    return savedMessage;
  }

  async function handleSendCurrentMessage(overrideText?: string) {
    const trimmedMessageText = (overrideText ?? messageText).trim();

    if (!trimmedMessageText || !isSelectedChatWritable) {
      return;
    }

    setIsSending(true);
    setErrorMessage(null);

    try {
      await sendEncryptedChatContent(trimmedMessageText);
      setMessageText('');
      sendCurrentTypingState(false);
    }
    catch (error) {
      console.error(error);
      setErrorMessage('Не удалось отправить сообщение.');
    }
    finally {
      setIsSending(false);
    }
  }


  async function loadChatDocuments() {
    if (!selectedChatId) {
      setChatDocuments([]);
      return;
    }

    setIsLoadingDocuments(true);
    setErrorMessage(null);

    try {
      const loadedDocuments = await getChatDocuments(selectedChatId);
      setChatDocuments(loadedDocuments);
    }
    catch (error) {
      console.error(error);
      setErrorMessage('Не удалось загрузить документы чата.');
    }
    finally {
      setIsLoadingDocuments(false);
    }
  }

  async function openDocumentsPanel() {
    setIsDocumentsPanelOpen(true);
    await loadChatDocuments();
  }

  async function handleAttachFile(file: File | null | undefined, attachmentDisplayMode: ChatAttachmentDisplayMode) {
    if (!file) {
      return;
    }

    if (!selectedChatId || !selectedChat || !deviceId || !isSelectedChatWritable) {
      setErrorMessage(isSelectedChatWritable ? 'Сначала выбери чат для отправки файла.' : 'Вы исключены из группы и не можете отправлять файлы.');
      return;
    }

    setIsSending(true);
    setIsUploadingFile(true);
    setIsAttachmentMenuOpen(false);
    setErrorMessage(null);

    try {
      const preparedFile = attachmentDisplayMode === 'IMAGE' ? await compressImageForChat(file) : file;
      const encryptionResult = await encryptFileForUpload(preparedFile);
      const uploadedFile = await uploadEncryptedMediaFile(
        selectedChatId,
        encryptionResult.encryptedBlob,
        encryptionResult.encryptedSha256Base64,
      );
      const attachmentContent = buildFileAttachmentContent(
        preparedFile,
        uploadedFile.id,
        uploadedFile.encryptedSizeBytes,
        encryptionResult,
        attachmentDisplayMode,
      );

      await sendEncryptedChatContent(JSON.stringify(attachmentContent), 'FILE');
      sendCurrentTypingState(false);
    }
    catch (error) {
      console.error(error);
      setErrorMessage('Не удалось зашифровать и отправить файл.');
    }
    finally {
      setIsSending(false);
      setIsUploadingFile(false);
    }
  }


  async function handleAttachDocument(file: File | null | undefined) {
    if (!file) {
      return;
    }

    if (!selectedChatId || !selectedChat || !deviceId || !isSelectedChatWritable) {
      setErrorMessage(isSelectedChatWritable ? 'Сначала выбери чат для отправки документа.' : 'Вы исключены из группы и не можете отправлять документы.');
      return;
    }

    setIsSending(true);
    setIsUploadingFile(true);
    setIsAttachmentMenuOpen(false);
    setErrorMessage(null);

    try {
      const encryptionResult = await encryptFileForUpload(file);
      const uploadedFile = await uploadEncryptedMediaFile(
        selectedChatId,
        encryptionResult.encryptedBlob,
        encryptionResult.encryptedSha256Base64,
      );
      const documentItem = await createDocument({
        chatId: selectedChatId,
        mediaFileId: uploadedFile.id,
        fileName: file.name,
        mimeType: file.type || 'application/octet-stream',
        sizeBytes: file.size,
        plaintextSha256Base64: encryptionResult.plaintextSha256Base64,
        encryptedSha256Base64: encryptionResult.encryptedSha256Base64,
      });
      const attachmentContent = buildDocumentAttachmentContent(
        file,
        documentItem.documentId,
        uploadedFile.id,
        uploadedFile.encryptedSizeBytes,
        encryptionResult,
      );

      await sendEncryptedChatContent(JSON.stringify(attachmentContent), 'FILE');
      setChatDocuments((previousDocuments) => [documentItem, ...previousDocuments.filter((item) => item.documentId !== documentItem.documentId)]);
      sendCurrentTypingState(false);
    }
    catch (error) {
      console.error(error);
      setErrorMessage('Не удалось зашифровать и отправить документ.');
    }
    finally {
      setIsSending(false);
      setIsUploadingFile(false);
    }
  }

  async function handleDownloadAttachment(attachment: FileAttachmentMessageContent | DocumentAttachmentMessageContent) {
    setErrorMessage(null);

    try {
      const encryptedBytes = await downloadEncryptedMediaFile(attachment.mediaFileId);
      const decryptedBlob = await decryptDownloadedFile(encryptedBytes, attachment);
      const objectUrl = URL.createObjectURL(decryptedBlob);
      const downloadLink = document.createElement('a');
      downloadLink.href = objectUrl;
      downloadLink.download = attachment.fileName;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      downloadLink.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    }
    catch (error) {
      console.error(error);
      setErrorMessage('Не удалось скачать или расшифровать файл.');
    }
  }


  async function handleDownloadDocument(documentItem: DocumentResponseDto) {
    const matchingMessage = Object.entries(decryptedMessagesById)
      .map(([, plainText]) => parseDocumentAttachmentMessageContent(plainText))
      .find((attachment) => attachment?.documentId === documentItem.documentId);

    if (!matchingMessage) {
      setErrorMessage('Ключ документа доступен в сообщении чата. Открой сообщение с этим документом и попробуй снова.');
      return;
    }

    await handleDownloadAttachment(matchingMessage);
  }

  async function handleSignDocument(documentItem: DocumentResponseDto) {
    if (!profile?.accountId || !deviceId || !window.vectorCrypto) {
      setErrorMessage('Локальная подпись документов недоступна.');
      return;
    }

    setErrorMessage(null);

    try {
      const signingKey = await window.vectorCrypto.getOrCreateDocumentSigningKey({
        accountId: profile.accountId,
        deviceId,
      });

      try {
        await registerDocumentSigningKey(deviceId, { publicKeyBase64: signingKey.publicKeyBase64 });
      }
      catch (registrationError) {
        console.warn(registrationError);
      }

      const signature = await window.vectorCrypto.signDocumentHash({
        accountId: profile.accountId,
        deviceId,
        documentHashBase64: documentItem.plaintextSha256Base64,
      });

      const updatedDocument = await signDocument(documentItem.documentId, {
        signerDeviceId: deviceId,
        signingKeyFingerprint: signature.signingKeyFingerprint,
        documentHashBase64: documentItem.plaintextSha256Base64,
        signatureBase64: signature.signatureBase64,
      });

      setChatDocuments((previousDocuments) => previousDocuments.map((item) => item.documentId === updatedDocument.documentId ? updatedDocument : item));
    }
    catch (error) {
      console.error(error);
      setErrorMessage('Не удалось подписать документ.');
    }
  }

  async function handleRejectDocument(documentItem: DocumentResponseDto) {
    setErrorMessage(null);

    try {
      const updatedDocument = await rejectDocument(documentItem.documentId);
      setChatDocuments((previousDocuments) => previousDocuments.map((item) => item.documentId === updatedDocument.documentId ? updatedDocument : item));
    }
    catch (error) {
      console.error(error);
      setErrorMessage('Не удалось отклонить документ.');
    }
  }

  async function handleLogout() {
    try {
      if (refreshToken) {
        await logoutRequest({ refreshToken });
      }
    }
    catch (error) {
      console.warn(error);
    }
    finally {
      clearAuthentication();
      navigate('/login');
    }
  }

  async function handleCreateDirectChat(profileToChat: ProfileResponseDto) {
    const chat = await createDirectChat({ recipientAccountId: profileToChat.accountId });
    upsertProfile(profileToChat);
    upsertChat(chat);
    selectChat(chat.chatId);
    setIsCreateChatOpen(false);
  }

  async function handleCreateGroupChat(groupName: string, profilesToChat: ProfileResponseDto[]) {
    const chat = await createGroupChat({
      name: groupName,
      participantAccountIds: profilesToChat.map((profileToChat) => profileToChat.accountId),
    });

    profilesToChat.forEach(upsertProfile);
    upsertChat(chat);
    selectChat(chat.chatId);
    setIsCreateChatOpen(false);
  }


  async function sendGroupKeyDistributionPackage(targetAccountIds: string[], groupKeyPackagePlainText: string) {
    if (!selectedChatId || !deviceId || !profile?.accountId || targetAccountIds.length === 0) {
      return;
    }

    const devicePayloads = await buildEncryptedDevicePayloadsForAccounts(groupKeyPackagePlainText, targetAccountIds);

    await sendMessage(selectedChatId, {
      senderDeviceId: deviceId,
      clientMessageId: crypto.randomUUID(),
      messageType: 'GROUP_KEY_DISTRIBUTION',
      encryptionType: 'SIGNAL',
      encryptedPayload: null,
      devicePayloads,
    });
  }

  async function shareHistoricalGroupKeysWithParticipant(participantAccountId: string) {
    if (!selectedChatId || !profile?.accountId || !window.vectorCrypto) {
      return;
    }

    const exportedGroupKeys = await window.vectorCrypto.exportGroupKeyPackagesForChat({
      accountId: profile.accountId,
      chatId: selectedChatId,
    });

    for (const groupKeyPackagePlainText of exportedGroupKeys.packages) {
      await sendGroupKeyDistributionPackage([participantAccountId], groupKeyPackagePlainText);
    }
  }

  async function handleAddGroupParticipant(profileToAdd: ProfileResponseDto, historyAccessMode: GroupHistoryAccessMode) {
    if (!selectedChat || selectedChat.type !== 'GROUP') {
      return;
    }

    setErrorMessage(null);
    const updatedChat = await addGroupParticipant(selectedChat.chatId, {
      accountId: profileToAdd.accountId,
      historyAccessMode,
      historyVisibleFromMessageId: null,
    });

    upsertProfile(profileToAdd);
    upsertChat(updatedChat);

    if (historyAccessMode === 'FULL_HISTORY') {
      await shareHistoricalGroupKeysWithParticipant(profileToAdd.accountId);
    }
    else if (window.vectorCrypto && deviceId && profile?.accountId) {
      const currentGroupKeyPackage = await window.vectorCrypto.encryptGroupMessage({
        accountId: profile.accountId,
        deviceId,
        chatId: updatedChat.chatId,
        epoch: updatedChat.currentKeyEpoch ?? 1,
        plainText: '[Состав группы обновлён]',
      });
      await sendGroupKeyDistributionPackage([profileToAdd.accountId], currentGroupKeyPackage.groupKeyPackagePlainText);
    }
  }

  async function handleRemoveGroupParticipant(participantAccountId: string) {
    if (!selectedChat || selectedChat.type !== 'GROUP') {
      return;
    }

    setErrorMessage(null);
    const updatedChat = await removeGroupParticipant(selectedChat.chatId, participantAccountId);
    upsertChat(updatedChat);
    temporarilyMissingGroupKeyMessageIdsRef.current.clear();

    if (window.vectorCrypto && deviceId && profile?.accountId) {
      const activeRecipientAccountIds = getActiveGroupParticipantAccountIds(updatedChat).filter((accountId) => accountId !== profile.accountId);
      const currentGroupKeyPackage = await window.vectorCrypto.encryptGroupMessage({
        accountId: profile.accountId,
        deviceId,
        chatId: updatedChat.chatId,
        epoch: updatedChat.currentKeyEpoch ?? 1,
        plainText: '[Состав группы обновлён]',
      });
      await sendGroupKeyDistributionPackage(activeRecipientAccountIds, currentGroupKeyPackage.groupKeyPackagePlainText);
    }

    setDecryptedMessagesById((previousValue) => ({ ...previousValue }));
  }

  function sendCurrentTypingState(isTyping: boolean) {
    if (!selectedChat || !profile?.accountId || selectedChat.type === 'SELF') {
      return;
    }

    if (!isSelectedChatWritable) {
      return;
    }

    const recipientAccountIds = getActiveGroupParticipantAccountIds(selectedChat).filter((participantAccountId) => participantAccountId !== profile.accountId);

    if (recipientAccountIds.length === 0) {
      return;
    }

    sendTypingEvent({
      chatId: selectedChat.chatId,
      recipientAccountIds,
      isTyping,
    });
  }

  function handleMessageTextChange(value: string) {
    if (!isSelectedChatWritable) {
      setMessageText('');
      sendCurrentTypingState(false);
      return;
    }

    setMessageText(value);

    const now = Date.now();

    if (value.trim().length === 0) {
      sendCurrentTypingState(false);
      return;
    }

    if (now - lastTypingSentAtRef.current > 1600) {
      lastTypingSentAtRef.current = now;
      sendCurrentTypingState(true);
    }

    if (typingStopTimeoutRef.current !== null) {
      window.clearTimeout(typingStopTimeoutRef.current);
    }

    typingStopTimeoutRef.current = window.setTimeout(() => {
      sendCurrentTypingState(false);
      typingStopTimeoutRef.current = null;
    }, 2500);
  }

  function handleTextareaKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void handleSendCurrentMessage();
    }
  }

  function appendEmojiToMessage(emoji: string) {
    setMessageText((previousValue) => `${previousValue}${emoji}`);
    setIsEmojiPickerOpen(false);
  }

  function sendSticker(sticker: string) {
    setIsEmojiPickerOpen(false);
    void handleSendCurrentMessage(sticker);
  }

  function handleClearSelectedChatHistory() {
    if (!selectedChatId) {
      return;
    }

    const clearedAt = new Date().toISOString();

    updateLocalChatState((previousValue) => ({
      ...previousValue,
      clearedAtByChatId: {
        ...previousValue.clearedAtByChatId,
        [selectedChatId]: clearedAt,
      },
      readAtByChatId: {
        ...previousValue.readAtByChatId,
        [selectedChatId]: clearedAt,
      },
    }));

    setIsChatActionsMenuOpen(false);
  }

  function handleDeleteSelectedChatLocally() {
    if (!selectedChatId) {
      return;
    }

    const chatIdToHide = selectedChatId;

    updateLocalChatState((previousValue) => ({
      ...previousValue,
      clearedAtByChatId: {
        ...previousValue.clearedAtByChatId,
        [chatIdToHide]: new Date().toISOString(),
      },
      hiddenChatIds: Array.from(new Set([...previousValue.hiddenChatIds, chatIdToHide])),
    }));

    const nextChat = filteredChats.find((chat) => chat.chatId !== chatIdToHide && chat.type === 'SELF')
      ?? filteredChats.find((chat) => chat.chatId !== chatIdToHide)
      ?? null;

    if (nextChat) {
      selectChat(nextChat.chatId);
    }

    setIsChatActionsMenuOpen(false);
  }

  async function handleDroppedFiles(files: FileList | File[]) {
    const droppedFiles = Array.from(files).slice(0, 8);

    for (const droppedFile of droppedFiles) {
      await handleAttachFile(droppedFile, isImageFile(droppedFile) ? 'IMAGE' : 'FILE');
    }
  }

  function handleChatDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDraggingFileOverChat(false);

    if (!isSelectedChatWritable) {
      return;
    }

    void handleDroppedFiles(event.dataTransfer.files);
  }


  useEffect(() => {
    if (!isSelectedChatWritable) {
      setMessageText('');
      sendCurrentTypingState(false);
    }
  }, [isSelectedChatWritable, selectedChatId]);

  const selectedChatPresentation = selectedChat ? getChatPresentation(selectedChat, profile, profilesById) : null;
  const currentUserDisplayName = profile ? getDisplayName(profile) : 'Vector user';
  const selectedTypingText = isSelectedChatWritable && selectedTypingStates.length > 0
    ? selectedTypingStates.length === 1
      ? `${selectedTypingStates[0].username || 'Пользователь'} печатает…`
      : 'Несколько пользователей печатают…'
    : null;
  const selectedDirectCompanionAccountId = selectedChat?.type === 'DIRECT' ? getDirectCompanionAccountId(selectedChat, profile?.accountId) : null;
  const selectedDirectLastActivityAt = getLastPeerActivityAt(visibleSelectedMessages, selectedDirectCompanionAccountId);
  const selectedDirectPresence = selectedDirectCompanionAccountId ? presenceByAccountId[selectedDirectCompanionAccountId] : null;
  const selectedChatSubtitle = selectedTypingText
    ?? (selectedChat?.type === 'SELF'
      ? 'Личный чат'
      : selectedChat?.type === 'DIRECT'
        ? getAccountActivityLabel(selectedDirectPresence, selectedDirectLastActivityAt)
        : selectedChatPresentation?.subtitle ?? '');

  return (
    <div
      className="relative flex h-screen overflow-hidden bg-[#0d0e12] text-zinc-100 before:pointer-events-none before:absolute before:inset-0 before:bg-[radial-gradient(circle_at_16%_12%,rgba(139,92,246,0.20),transparent_30rem),radial-gradient(circle_at_92%_8%,rgba(236,72,153,0.14),transparent_26rem),radial-gradient(circle_at_60%_110%,rgba(14,165,233,0.10),transparent_32rem)] before:content-[\'\']"
      onDragOver={(event) => {
        if (!isSelectedChatWritable) {
          return;
        }

        event.preventDefault();
        setIsDraggingFileOverChat(true);
      }}
      onDragLeave={(event) => {
        if (event.currentTarget === event.target) {
          setIsDraggingFileOverChat(false);
        }
      }}
      onDrop={handleChatDrop}
    >
      <NewChatModal
        isOpen={isCreateChatOpen}
        currentAccountId={profile?.accountId}
        onClose={() => setIsCreateChatOpen(false)}
        onCreateChat={handleCreateDirectChat}
        onCreateGroupChat={handleCreateGroupChat}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        profile={profile}
        deviceId={deviceId}
        cryptoStatus={cryptoStatus}
        cryptoDatabasePath={cryptoDatabasePath}
        realtimeStatus={realtimeStatus}
        onClose={() => setIsSettingsOpen(false)}
        onLogout={handleLogout}
        onBackupRestored={handleKeyBackupRestored}
        onProfileUpdated={(updatedProfile) => {
          setProfile(updatedProfile);
          upsertProfile(updatedProfile);
          setLocalAvatarDataUrl(updatedProfile.avatarDataUrl ?? null);
        }}
      />



      <MiniProfileModal
        profile={miniProfile}
        isCurrentAccount={miniProfile?.accountId === profile?.accountId}
        lastActivityAt={miniProfile ? lastActivityByAccountId[miniProfile.accountId] : null}
        presence={miniProfile ? presenceByAccountId[miniProfile.accountId] : null}
        localAvatarDataUrl={localAvatarDataUrl}
        onClose={() => setMiniProfile(null)}
        onMessage={handleCreateDirectChat}
      />

      <GroupManagementModal
        isOpen={isGroupManagementOpen}
        chat={selectedChat}
        currentAccountId={profile?.accountId}
        profilesById={profilesById}
        presenceByAccountId={presenceByAccountId}
        lastActivityByAccountId={lastActivityByAccountId}
        onClose={() => setIsGroupManagementOpen(false)}
        onAddParticipant={handleAddGroupParticipant}
        onRemoveParticipant={handleRemoveGroupParticipant}
        onOpenProfile={setMiniProfile}
      />

      <DocumentsPanel
        isOpen={isDocumentsPanelOpen}
        documents={chatDocuments}
        isLoading={isLoadingDocuments}
        activeAccountId={profile?.accountId}
        onClose={() => setIsDocumentsPanelOpen(false)}
        onRefresh={loadChatDocuments}
        onDownload={handleDownloadDocument}
        onSign={handleSignDocument}
        onReject={handleRejectDocument}
      />

      {isDraggingFileOverChat && isSelectedChatWritable && (
        <div className="pointer-events-none absolute inset-4 z-50 flex items-center justify-center rounded-[2rem] border-2 border-dashed border-violet-300/45 bg-violet-500/12 text-lg font-semibold text-violet-100 shadow-2xl shadow-violet-950/30 backdrop-blur-xl">
          Отпустите файл, чтобы отправить его в чат
        </div>
      )}

      {isDevToolsOpen && profile?.username === 'admin' && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-[2rem] border border-white/10 bg-[#18191d] p-6 shadow-2xl shadow-black/50">
            <div className="mb-5 flex items-center justify-between gap-4">
              <div>
                <div className="text-xl font-semibold text-zinc-50">Dev tools</div>
                <div className="mt-1 text-sm text-zinc-500">
                  Спрятано из основного интерфейса. Открывается по кнопке или Ctrl + Shift + D.
                </div>
              </div>
              <button
                onClick={() => setIsDevToolsOpen(false)}
                className="rounded-2xl border border-white/10 bg-white/[0.04] p-2 text-zinc-400 transition hover:text-zinc-100"
              >
                <X size={18} />
              </button>
            </div>
            <DevAccountPanel />
          </div>
        </div>
      )}

      <aside className="relative z-10 flex w-[392px] shrink-0 flex-col border-r border-white/10 bg-[#15161b]/86 shadow-2xl shadow-black/30 backdrop-blur-2xl">
        <div className="border-b border-white/10 p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <div className="text-[11px] uppercase tracking-[0.18em] text-violet-300/70">Vector Messenger</div>
              <div className="mt-1 text-2xl font-semibold tracking-tight text-zinc-50">Чаты</div>
            </div>

            <button
              onClick={() => setIsCreateChatOpen(true)}
              className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white shadow-lg shadow-violet-950/40 transition hover:brightness-110"
              title="Новый чат"
            >
              <Plus size={18} />
            </button>
          </div>

          <div className="flex items-center gap-3 rounded-3xl border border-white/10 bg-black/18 px-4 py-3 text-zinc-500 shadow-inner shadow-black/20">
            <Search size={17} />
            <input
              value={chatSearchQuery}
              onChange={(event) => setChatSearchQuery(event.target.value)}
              className="w-full bg-transparent text-sm text-zinc-300 outline-none placeholder:text-zinc-600"
              placeholder="Поиск по чатам"
            />
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
          {filteredChats.length === 0 ? (
            <div className="mx-2 mt-4 rounded-[1.75rem] border border-dashed border-white/10 bg-white/[0.02] p-8 text-center text-sm text-zinc-500">
              {chats.length === 0
                ? 'Чаты появятся здесь. Создай новый диалог через кнопку сверху.'
                : 'Ничего не найдено по текущему запросу.'}
            </div>
          ) : (
            filteredChats.map((chat) => {
              const presentation = getChatPresentation(chat, profile, profilesById);
              const chatMessages = getVisibleChatMessages(messagesByChatId[chat.chatId] ?? [], localChatState.clearedAtByChatId[chat.chatId]);
              const lastTimelineMessage = getLastTimelineMessage(chatMessages);
              const preview = buildChatPreviewFromMessage(lastTimelineMessage, decryptedMessagesById, profilesById);
              const unreadCount = selectedChatId === chat.chatId ? 0 : calculateUnreadCount(chatMessages, profile?.accountId, localChatState.readAtByChatId[chat.chatId]);
              const isOwnLastMessage = Boolean(lastTimelineMessage && lastTimelineMessage.senderAccountId === profile?.accountId);
              const lastMessageStatus = lastTimelineMessage && isOwnLastMessage ? getOutgoingMessageStatus(lastTimelineMessage, profile?.accountId) : null;
              const companionAccountId = chat.type === 'DIRECT' ? getDirectCompanionAccountId(chat, profile?.accountId) : null;
              const companionPresence = companionAccountId ? presenceByAccountId[companionAccountId] : null;

              return (
                <button
                  key={chat.chatId}
                  onClick={() => {
                    selectChat(chat.chatId);
                    setOpenedChatMenuId(null);
                  }}
                  className={`mb-2 flex w-full items-center gap-3 rounded-[1.6rem] px-3 py-3 text-left transition ${
                    selectedChatId === chat.chatId
                      ? 'bg-gradient-to-r from-violet-500/25 via-fuchsia-500/10 to-transparent ring-1 ring-violet-300/20 shadow-lg shadow-violet-950/10'
                      : 'hover:bg-white/[0.05] hover:shadow-lg hover:shadow-black/10'
                  }`}
                >
                  <div className="relative shrink-0">
                    {chat.type === 'SELF' ? (
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-lg shadow-black/20">
                        <Star size={18} />
                      </div>
                    ) : (
                      <UserAvatar label={presentation.avatarLabel} imageUrl={getAccountAvatarUrl(presentation.companionProfile)} />
                    )}
                    {chat.type === 'DIRECT' && (
                      <span className={`absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-[#17181c] ${companionPresence?.isOnline ? 'bg-emerald-400' : 'bg-zinc-600'}`} />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-3">
                      <div className="truncate text-sm font-semibold text-zinc-100">{presentation.title}</div>
                      <div className="shrink-0 text-[11px] text-zinc-600">{formatChatTime(lastTimelineMessage?.createdAt ?? chat.lastMessageCreatedAt ?? chat.updatedAt)}</div>
                    </div>
                    <div className="mt-1 flex items-center gap-2">
                      {chat.type !== 'SELF' && isOwnLastMessage && lastMessageStatus && (
                        <span className="inline-flex shrink-0 text-violet-300">
                          {lastMessageStatus === 'READ' ? <CheckCheck size={13} /> : lastMessageStatus === 'DELIVERED' ? <CheckCheck size={13} /> : <Check size={13} />}
                        </span>
                      )}
                      <div className={`min-w-0 flex-1 truncate text-xs ${getPreviewTextColorClass(preview.accent)}`}>{preview.text}</div>
                      {unreadCount > 0 && (
                        <span className="flex min-w-5 shrink-0 items-center justify-center rounded-full bg-violet-500 px-1.5 py-0.5 text-[11px] font-semibold text-white shadow-lg shadow-violet-950/30">
                          {unreadCount > 99 ? '99+' : unreadCount}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>

        <div className="border-t border-white/10 p-4">
          <div className="flex items-center gap-2 rounded-[1.7rem] border border-white/10 bg-white/[0.035] p-2">
            <button
              onClick={() => setIsSettingsOpen(true)}
              className="flex min-w-0 flex-1 items-center gap-3 rounded-[1.35rem] p-2 text-left transition hover:bg-white/[0.05]"
              title="Открыть настройки"
            >
              <UserAvatar label={currentUserDisplayName} imageUrl={getAccountAvatarUrl(profile, localAvatarDataUrl)} size="sm" />

              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold text-zinc-100">{currentUserDisplayName}</div>
                <div className="mt-1 flex items-center gap-2 text-xs text-zinc-500">
                  {realtimeStatus === 'connected'
                    ? <Wifi size={13} className="text-emerald-300" />
                    : <WifiOff size={13} className="text-zinc-600" />}
                  <span>@{profile?.username ?? 'user'} • {cryptoStatus === 'ready' ? 'защищено' : 'настройка'}</span>
                </div>
              </div>
            </button>

            {profile?.username === 'admin' && (
              <button
                onClick={() => setIsDevToolsOpen(true)}
                className="rounded-2xl border border-white/10 bg-white/[0.04] p-2 text-zinc-400 transition hover:border-violet-300/30 hover:text-zinc-100"
                title="Dev tools"
              >
                <Wrench size={16} />
              </button>
            )}
          </div>
        </div>
      </aside>

      <main className="relative z-10 flex min-w-0 flex-1 flex-col bg-[#101116]/74 backdrop-blur-sm">
        {!selectedChat || !selectedChatPresentation ? (
          <div className="flex flex-1 items-center justify-center px-8">
            <div className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-10 text-center shadow-2xl shadow-black/30">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-br from-violet-500 to-fuchsia-500 shadow-lg shadow-violet-950/40">
                <MessageCircle size={28} />
              </div>
              <h2 className="mt-5 text-2xl font-semibold text-zinc-50">Выбери чат</h2>
              <p className="mt-2 max-w-md text-sm leading-6 text-zinc-500">
                Открой сохранённые сообщения или создай новый диалог через кнопку с плюсом в левой колонке.
              </p>
            </div>
          </div>
        ) : (
          <>
            <header className="flex h-[84px] items-center justify-between border-b border-white/10 bg-[#16171d]/82 px-7 shadow-lg shadow-black/10 backdrop-blur-2xl">
              <div className="flex min-w-0 items-center gap-4">
                <button
                  type="button"
                  onClick={() => {
                    if (selectedChat.type === 'GROUP') {
                      setIsGroupManagementOpen(true);
                    }
                    else if (selectedChat.type === 'DIRECT' && selectedChatPresentation.companionProfile) {
                      setMiniProfile(selectedChatPresentation.companionProfile);
                    }
                  }}
                  className="flex min-w-0 items-center gap-4 rounded-3xl px-1 py-1 text-left transition hover:bg-white/[0.04]"
                  title={selectedChat.type === 'GROUP' ? 'Открыть участников группы' : 'Открыть профиль'}
                >
                  {selectedChat.type === 'SELF'
                    ? (
                      <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-lg shadow-black/20">
                        <Star size={20} />
                      </div>
                      )
                    : <UserAvatar label={selectedChatPresentation.avatarLabel} imageUrl={getAccountAvatarUrl(selectedChatPresentation.companionProfile)} size="lg" />}

                  <div className="min-w-0">
                    <div className="truncate text-lg font-semibold text-zinc-50 transition group-hover:text-violet-100">
                      {selectedChatPresentation.title}
                    </div>
                    <div className="mt-1 truncate text-sm text-zinc-500">
                      {selectedChatSubtitle}
                    </div>
                  </div>
                </button>
              </div>

              <div className="flex items-center gap-2">
                {selectedChat.type === 'GROUP' && (
                  <button
                    onClick={() => setIsGroupManagementOpen(true)}
                    className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-zinc-300 transition hover:border-violet-300/25 hover:text-white"
                    title="Участники группы"
                  >
                    <Users size={14} />
                    Участники
                  </button>
                )}
                <button
                  onClick={() => void openDocumentsPanel()}
                  className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-zinc-300 transition hover:border-violet-300/25 hover:text-white"
                  title="Документооборот"
                >
                  <ShieldCheck size={14} />
                  Документы
                </button>
                <div className="relative">
                  <button
                    onClick={() => setIsChatActionsMenuOpen((previousValue) => !previousValue)}
                    className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-zinc-300 transition hover:border-violet-300/25 hover:text-white"
                    title="Действия с чатом"
                  >
                    <MoreVertical size={16} />
                  </button>

                  {isChatActionsMenuOpen && (
                    <div className="absolute right-0 top-11 z-30 w-64 rounded-3xl border border-white/10 bg-[#202127] p-2 text-sm shadow-2xl shadow-black/50">
                      <button
                        onClick={handleClearSelectedChatHistory}
                        className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left text-zinc-200 transition hover:bg-white/[0.06]"
                      >
                        <Eraser size={17} className="text-zinc-400" />
                        Очистить историю у меня
                      </button>
                      {selectedChat.type !== 'SELF' && (
                        <button
                          onClick={handleDeleteSelectedChatLocally}
                          className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left text-red-200 transition hover:bg-red-500/10"
                        >
                          <Trash2 size={17} />
                          Удалить чат у меня
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </header>

            {errorMessage && (
              <div className="border-b border-red-400/20 bg-red-500/10 px-7 py-3 text-sm text-red-200">
                {errorMessage}
              </div>
            )}

            {selectedChat.type === 'GROUP' && !isSelectedChatWritable && (
              <div className="border-b border-amber-300/20 bg-amber-500/10 px-7 py-3 text-sm text-amber-100">
                Вы исключены из группы. Вы можете читать доступную историю, но отправка сообщений, файлов, документов и typing отключены.
              </div>
            )}

            <div className="min-h-0 flex-1 overflow-y-auto px-8 py-6">
              <div className="mx-auto flex max-w-4xl flex-col gap-3">
                {visibleSelectedMessages.length === 0 && (
                  <div className="rounded-[1.8rem] border border-dashed border-white/10 bg-white/[0.02] p-8 text-center text-sm text-zinc-500">
                    Пока сообщений нет. Напиши первое сообщение ниже.
                  </div>
                )}

                {visibleSelectedMessages.filter((message) => message.messageType !== 'GROUP_KEY_DISTRIBUTION').map((message, messageIndex, renderedMessages) => {
                  const previousMessage = messageIndex > 0 ? renderedMessages[messageIndex - 1] : null;
                  const shouldShowDateSeparator = !previousMessage || !isSameCalendarDate(previousMessage.createdAt, message.createdAt);
                  const decryptedMessage = decryptedMessagesById[message.messageId] ?? 'Расшифровка…';

                  if (message.messageType === 'SYSTEM') {
                    const systemPayload = parseGroupSystemMessagePayload(decryptedMessage);
                    return (
                      <div key={message.messageId}>
                        {shouldShowDateSeparator && (
                          <div className="sticky top-3 z-10 my-3 flex justify-center">
                            <div className="rounded-full border border-white/10 bg-[#22242a]/90 px-3 py-1 text-xs text-zinc-400 shadow-lg shadow-black/20 backdrop-blur">
                              {formatMessageDate(message.createdAt)}
                            </div>
                          </div>
                        )}
                        <div className="flex justify-center py-1">
                          <div className="max-w-[80%] rounded-full border border-white/10 bg-white/[0.06] px-4 py-1.5 text-center text-xs text-zinc-400 shadow-sm shadow-black/10">
                            {formatGroupSystemMessage(systemPayload, profilesById)}
                          </div>
                        </div>
                      </div>
                    );
                  }

                  const isOwnMessage = message.senderAccountId === profile?.accountId;
                  const messageStatus = getOutgoingMessageStatus(message, profile?.accountId);
                  const fileAttachment = parseFileAttachmentMessageContent(decryptedMessage);
                  const documentAttachment = parseDocumentAttachmentMessageContent(decryptedMessage);
                  const senderProfile = profilesById[message.senderAccountId] ?? null;
                  const senderDisplayName = senderProfile ? getDisplayName(senderProfile) : `${message.senderAccountId.slice(0, 8)}…`;
                  const readReceiptDetails = getReadReceiptDetails(message, selectedChat, profilesById, profile?.accountId);
                  const shouldShowGroupSender = selectedChat.type === 'GROUP' && !isOwnMessage;
                  const shouldShowGroupReadDetails = selectedChat.type === 'GROUP' && readDetailsMessageId === message.messageId;

                  return (
                    <div key={message.messageId}>
                      {shouldShowDateSeparator && (
                        <div className="sticky top-3 z-10 my-3 flex justify-center">
                          <div className="rounded-full border border-white/10 bg-[#22242a]/90 px-3 py-1 text-xs text-zinc-400 shadow-lg shadow-black/20 backdrop-blur">
                            {formatMessageDate(message.createdAt)}
                          </div>
                        </div>
                      )}
                      <div className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'}`}>
                      <div className={`flex max-w-[74%] items-end gap-3 ${isOwnMessage ? 'flex-row-reverse' : ''}`}>
                        {!isOwnMessage && <UserAvatar label={senderDisplayName} imageUrl={getAccountAvatarUrl(senderProfile)} size="sm" />}

                        <div className="relative">
                          <div
                            className={`rounded-[1.5rem] px-4 py-3 shadow-lg ${
                            isOwnMessage
                              ? 'rounded-br-md bg-gradient-to-br from-violet-500 via-fuchsia-600 to-pink-600 text-white shadow-violet-950/30'
                              : 'rounded-bl-md border border-white/10 bg-[#24262d]/96 text-zinc-100 shadow-black/20 backdrop-blur'
                          }`}
                        >
                          {shouldShowGroupSender && (
                            <div className="mb-1 text-xs font-semibold text-violet-200">
                              {senderDisplayName}
                            </div>
                          )}
                          {documentAttachment ? (
                            <DocumentAttachmentPreview attachment={documentAttachment} isOwnMessage={isOwnMessage} onDownload={handleDownloadAttachment} />
                          ) : fileAttachment ? (
                            fileAttachment.attachmentDisplayMode === 'IMAGE' ? (
                              <ImageAttachmentPreview attachment={fileAttachment} onDownload={handleDownloadAttachment} />
                            ) : (
                              <div className="min-w-[280px] max-w-[360px]">
                                <div className={`flex items-center gap-3 rounded-2xl border p-3 ${isOwnMessage ? 'border-white/20 bg-white/10' : 'border-white/10 bg-black/15'}`}>
                                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-black/20 text-white">
                                    <FileText size={20} />
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <div className="truncate text-sm font-semibold">{fileAttachment.fileName}</div>
                                    <div className={`mt-1 text-xs ${isOwnMessage ? 'text-violet-100/75' : 'text-zinc-500'}`}>
                                      {formatFileSize(fileAttachment.sizeBytes)} • encrypted file
                                    </div>
                                  </div>
                                  <button
                                    onClick={() => void handleDownloadAttachment(fileAttachment)}
                                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition ${isOwnMessage ? 'bg-white/15 hover:bg-white/25' : 'bg-white/[0.06] hover:bg-white/[0.1]'}`}
                                    title="Скачать и расшифровать"
                                  >
                                    <Download size={17} />
                                  </button>
                                </div>
                              </div>
                            )
                          ) : (
                            isStickerMessageText(decryptedMessage) ? (
                              <div className="select-none px-2 py-1 text-6xl leading-none">
                                {decryptedMessage.trim()}
                              </div>
                            ) : (
                              <div className="whitespace-pre-wrap text-sm leading-6">
                                {decryptedMessage}
                              </div>
                            )
                          )}
                          <div className={`mt-2 flex items-center gap-2 text-[11px] ${isOwnMessage ? 'justify-end text-violet-100/80' : 'justify-end text-zinc-500'}`}>
                            <span>{formatMessageTime(message.createdAt)}</span>
                            {isOwnMessage && selectedChat.type !== 'GROUP' && (
                              <span className="inline-flex items-center gap-1">
                                {messageStatus === 'READ' ? <CheckCheck size={13} /> : messageStatus === 'DELIVERED' ? <CheckCheck size={13} /> : <Check size={13} />}
                                <span>
                                  {messageStatus === 'READ' ? 'Прочитано' : messageStatus === 'DELIVERED' ? 'Доставлено' : 'Отправлено'}
                                </span>
                              </span>
                            )}
                            {selectedChat.type === 'GROUP' && (
                              <button
                                type="button"
                                onClick={() => setReadDetailsMessageId((currentValue) => currentValue === message.messageId ? null : message.messageId)}
                                className="inline-flex items-center gap-1 rounded-full px-1 transition hover:bg-white/10"
                                title="Кто прочитал сообщение"
                              >
                                {readReceiptDetails.readCount > 0 ? <CheckCheck size={13} /> : <Check size={13} />}
                                <span>
                                  {readReceiptDetails.readCount > 0
                                    ? `Прочитано ${readReceiptDetails.readCount}/${readReceiptDetails.totalCount}`
                                    : readReceiptDetails.deliveredCount > 0
                                      ? `Доставлено ${readReceiptDetails.deliveredCount}/${readReceiptDetails.totalCount}`
                                      : 'Отправлено'}
                                </span>
                              </button>
                            )}
                          </div>
                          </div>
                          {shouldShowGroupReadDetails && (
                            <div className="absolute right-0 top-full z-20 mt-2 w-72 rounded-3xl border border-white/10 bg-[#202127] p-4 text-left shadow-2xl shadow-black/50">
                              <div className="text-sm font-semibold text-zinc-100">Статус прочтения</div>
                              <div className="mt-3 grid gap-3 text-xs">
                                <div>
                                  <div className="mb-2 text-zinc-500">Прочитали</div>
                                  <div className="flex flex-wrap gap-1.5">
                                    {readReceiptDetails.readParticipants.length > 0 ? readReceiptDetails.readParticipants.map((participant) => {
                                      const participantName = getParticipantDisplayName(participant);
                                      return typeof participant === 'string' ? (
                                        <span key={participantName} className="rounded-full bg-emerald-400/10 px-2 py-1 text-emerald-200">{participantName}</span>
                                      ) : (
                                        <button
                                          type="button"
                                          key={participant.accountId}
                                          onClick={() => setMiniProfile(participant)}
                                          className="rounded-full bg-emerald-400/10 px-2 py-1 text-emerald-200 transition hover:bg-emerald-400/18"
                                        >
                                          {participantName}
                                        </button>
                                      );
                                    }) : <span className="text-zinc-500">Пока никто</span>}
                                  </div>
                                </div>
                                <div>
                                  <div className="mb-2 text-zinc-500">Ещё не прочитали</div>
                                  <div className="flex flex-wrap gap-1.5">
                                    {readReceiptDetails.unreadParticipants.length > 0 ? readReceiptDetails.unreadParticipants.map((participant) => {
                                      const participantName = getParticipantDisplayName(participant);
                                      return typeof participant === 'string' ? (
                                        <span key={participantName} className="rounded-full bg-white/[0.06] px-2 py-1 text-zinc-300">{participantName}</span>
                                      ) : (
                                        <button
                                          type="button"
                                          key={participant.accountId}
                                          onClick={() => setMiniProfile(participant)}
                                          className="rounded-full bg-white/[0.06] px-2 py-1 text-zinc-300 transition hover:bg-white/[0.1]"
                                        >
                                          {participantName}
                                        </button>
                                      );
                                    }) : <span className="text-zinc-500">Все прочитали</span>}
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                  );
                })}

                {selectedTypingText && (
                  <div className="flex justify-start">
                    <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-xs text-zinc-400">
                      <span className="flex gap-1">
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-violet-300" />
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-violet-300 [animation-delay:120ms]" />
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-violet-300 [animation-delay:240ms]" />
                      </span>
                      {selectedTypingText}
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>
            </div>

            <ChatComposer
              messageText={messageText}
              placeholder={isSelectedChatWritable ? 'Напишите сообщение…' : 'Вы исключены из группы'}
              isSending={isSending}
              isUploadingFile={isUploadingFile}
              isWritable={Boolean(selectedChat && isSelectedChatWritable)}
              onMessageTextChange={handleMessageTextChange}
              onMessageBlur={() => sendCurrentTypingState(false)}
              onTextareaKeyDown={handleTextareaKeyDown}
              onAttachFile={handleAttachFile}
              onAttachDocument={handleAttachDocument}
              onOpenDocumentsPanel={openDocumentsPanel}
              onAppendEmoji={appendEmojiToMessage}
              onSendSticker={sendSticker}
              onSendCurrentMessage={() => handleSendCurrentMessage()}
            />
          </>
        )}
      </main>
    </div>
  );
}
