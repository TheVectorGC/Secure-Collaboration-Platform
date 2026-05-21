import { DragEvent, useEffect, useMemo, useState } from 'react';
import {
  LoaderCircle,
  LogOut,
  MessageCircle,
  FileText,
  Download,
  Search,
  Users,
  UserPlus,
  UserMinus,
  KeyRound,
  Clock3,
  Mail,
  MessageSquare,
  User,
  LockKeyhole,
  Monitor,
  RefreshCw,
  Settings,
  ShieldCheck,
  Wifi,
  X,
} from 'lucide-react';
import { searchProfiles, updateCurrentProfileAvatar } from '../features/directory/api/profilesApi';
import { useDirectoryStore } from '../features/directory/model/directoryStore';
import { getActiveAccountDevices } from '../features/devices/api/devicesApi';
import { formatFileSize, parseDocumentAttachmentMessageContent, parseFileAttachmentMessageContent } from '../features/media/lib/fileCrypto';
import { DocumentAttachmentPreview, ImageAttachmentPreview } from '../features/messenger/ui/MessageAttachments';
import { type ChatAttachmentDisplayMode } from '../features/messenger/ui/ChatComposer';
import { downloadKeyBackup, getKeyBackupStatus, uploadKeyBackup, type KeyBackupStatusResponseDto } from '../features/crypto/api/keyBackupApi';
import { formatLastSeen, formatMessageTime } from '../shared/lib/dateFormat';
import { getAvatarGradient, getInitials } from '../shared/lib/avatar';
import { getAccountDisplayName, getAccountUsernameLabel, getDirectCompanionAccountId, getDisplayName } from '../shared/lib/profile';
import type { AccountPresenceState } from '../features/realtime/model/realtimeStore';
import type { ActiveDeviceResponseDto, AddGroupParticipantRequestDto, ChatResponseDto, DocumentAttachmentMessageContent, DocumentResponseDto, FileAttachmentMessageContent, MessageResponseDto, ProfileResponseDto } from '../shared/types/api';



export const IMAGE_FILE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'avif']);
export const CHAT_LOCAL_STATE_PREFIX = 'vector.chatLocalState';
export const EMOJI_ITEMS = ['😀', '😄', '😊', '😍', '😎', '🥳', '👍', '🙏', '🔥', '💪', '✅', '❤️', '😂', '🤝', '👀', '🚀', '📌', '📎', '📝', '🔒'];
export const QUICK_REACTION_ITEMS = ['👍', '❤️', '😂', '😮', '😢', '🔥'];
export const LOCAL_REACTIONS_PREFIX = 'vector.localMessageReactions';

export type MessageContextMenuPlacement = 'left' | 'right';

export type MessageContextMenuAnchorRect = {
  left: number;
  right: number;
  top: number;
  bottom: number;
  width: number;
  height: number;
};

export type MessageContextMenuState = {
  messageId: string;
  x: number;
  y: number;
  placement: MessageContextMenuPlacement;
  anchorRect: MessageContextMenuAnchorRect;
  anchorDomRect: DOMRect;
  isPositioned: boolean;
};

export type ReplyDraft = {
  messageId: string;
  chatId: string;
  senderAccountId: string;
  senderName: string;
  preview: string;
  createdAt: string;
};

export type ForwardedMessageSnapshot = {
  messageId: string;
  chatId: string;
  senderAccountId: string;
  senderName: string;
  createdAt: string;
  plainText: string;
};

export type PendingAttachmentDraft = {
  id: string;
  file: File;
  attachmentDisplayMode: ChatAttachmentDisplayMode;
};

export type ForwardSelectionState = {
  originChatId: string;
  selectedMessageIds: string[];
};

export type RichMessageContent = {
  kind: 'VECTOR_RICH_MESSAGE';
  version: 1;
  text: string;
  replyTo: ReplyDraft | null;
  forwardedMessages: ForwardedMessageSnapshot[];
  attachments: FileAttachmentMessageContent[];
};

export type LocalChatState = {
  readAtByChatId: Record<string, string>;
  clearedAtByChatId: Record<string, string>;
  hiddenChatIds: string[];
};

export type ChatListPreview = {
  text: string;
  accent: 'default' | 'media' | 'system' | 'muted';
};

export function getLocalAvatarStorageKey(accountId: string | undefined): string {
  return `vector.localAvatar.${accountId ?? 'anonymous'}`;
}

export async function createLocalAvatarDataUrl(file: File): Promise<string> {
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


export function getLocalChatStateStorageKey(accountId: string | undefined): string {
  return `${CHAT_LOCAL_STATE_PREFIX}.${accountId ?? 'anonymous'}`;
}

export function createEmptyLocalChatState(): LocalChatState {
  return {
    readAtByChatId: {},
    clearedAtByChatId: {},
    hiddenChatIds: [],
  };
}

export function readLocalChatState(accountId: string | undefined): LocalChatState {
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

export function writeLocalChatState(accountId: string | undefined, localChatState: LocalChatState) {
  localStorage.setItem(getLocalChatStateStorageKey(accountId), JSON.stringify(localChatState));
}


export function getLocalReactionsStorageKey(accountId: string | undefined): string {
  return `${LOCAL_REACTIONS_PREFIX}.${accountId ?? 'anonymous'}`;
}

export function readLocalReactions(accountId: string | undefined): Record<string, string> {
  const serializedValue = localStorage.getItem(getLocalReactionsStorageKey(accountId));

  if (!serializedValue) {
    return {};
  }

  try {
    const parsedValue = JSON.parse(serializedValue) as Record<string, string>;
    return parsedValue && typeof parsedValue === 'object' ? parsedValue : {};
  }
  catch {
    return {};
  }
}

export function writeLocalReactions(accountId: string | undefined, reactionsByMessageId: Record<string, string>) {
  localStorage.setItem(getLocalReactionsStorageKey(accountId), JSON.stringify(reactionsByMessageId));
}

export function isSameCalendarDate(leftValue: string, rightValue: string): boolean {
  const leftDate = new Date(leftValue);
  const rightDate = new Date(rightValue);

  return leftDate.getFullYear() === rightDate.getFullYear()
    && leftDate.getMonth() === rightDate.getMonth()
    && leftDate.getDate() === rightDate.getDate();
}

export function dragEventContainsFiles(event: DragEvent<HTMLElement>): boolean {
  return Array.from(event.dataTransfer.types).includes('Files');
}

export function isImageFile(file: File): boolean {
  if (file.type.startsWith('image/')) {
    return true;
  }

  const extension = file.name.split('.').at(-1)?.toLowerCase();
  return extension ? IMAGE_FILE_EXTENSIONS.has(extension) : false;
}


export function getVisibleChatMessages(messages: MessageResponseDto[], clearedAt: string | null | undefined): MessageResponseDto[] {
  if (!clearedAt) {
    return messages;
  }

  const clearedAtTime = new Date(clearedAt).getTime();
  return messages.filter((message) => new Date(message.createdAt).getTime() > clearedAtTime);
}

export function getLastTimelineMessage(messages: MessageResponseDto[]): MessageResponseDto | null {
  const visibleMessages = messages.filter((message) => message.messageType !== 'GROUP_KEY_DISTRIBUTION');
  return visibleMessages.at(-1) ?? null;
}


export function parseRichMessageContent(value: string | null | undefined): RichMessageContent | null {
  if (!value) {
    return null;
  }

  try {
    const parsedValue = JSON.parse(value) as Partial<RichMessageContent>;

    if (parsedValue.kind !== 'VECTOR_RICH_MESSAGE' || parsedValue.version !== 1) {
      return null;
    }

    const forwardedMessages = Array.isArray(parsedValue.forwardedMessages)
      ? parsedValue.forwardedMessages.filter((item): item is ForwardedMessageSnapshot => (
        typeof item?.messageId === 'string'
        && typeof item.chatId === 'string'
        && typeof item.senderAccountId === 'string'
        && typeof item.senderName === 'string'
        && typeof item.createdAt === 'string'
        && typeof item.plainText === 'string'
      ))
      : [];

    const replyTo = parsedValue.replyTo
      && typeof parsedValue.replyTo.messageId === 'string'
      && typeof parsedValue.replyTo.chatId === 'string'
      && typeof parsedValue.replyTo.senderAccountId === 'string'
      && typeof parsedValue.replyTo.senderName === 'string'
      && typeof parsedValue.replyTo.preview === 'string'
      && typeof parsedValue.replyTo.createdAt === 'string'
      ? parsedValue.replyTo
      : null;

    const attachments = Array.isArray(parsedValue.attachments)
      ? parsedValue.attachments.filter((item): item is FileAttachmentMessageContent => (
        item?.kind === 'FILE_ATTACHMENT'
        && item.version === 1
        && (item.attachmentDisplayMode === 'FILE' || item.attachmentDisplayMode === 'IMAGE')
        && typeof item.mediaFileId === 'string'
        && typeof item.fileName === 'string'
        && typeof item.mimeType === 'string'
        && typeof item.sizeBytes === 'number'
        && typeof item.encryptedSizeBytes === 'number'
        && typeof item.plaintextSha256Base64 === 'string'
        && typeof item.encryptedSha256Base64 === 'string'
        && item.fileEncryption?.algorithm === 'AES-256-GCM'
        && typeof item.fileEncryption.keyBase64 === 'string'
        && typeof item.fileEncryption.initializationVectorBase64 === 'string'
      ))
      : [];

    return {
      kind: 'VECTOR_RICH_MESSAGE',
      version: 1,
      text: typeof parsedValue.text === 'string' ? parsedValue.text : '',
      replyTo,
      forwardedMessages,
      attachments,
    };
  }
  catch {
    return null;
  }
}

export function buildRichMessageContent(
  text: string,
  replyTo: ReplyDraft | null,
  forwardedMessages: ForwardedMessageSnapshot[],
  attachments: FileAttachmentMessageContent[] = [],
): string {
  return JSON.stringify({
    kind: 'VECTOR_RICH_MESSAGE',
    version: 1,
    text,
    replyTo,
    forwardedMessages,
    attachments,
  } satisfies RichMessageContent);
}

export function getMessageContentPreview(plainText: string | undefined, fallback = 'Сообщение'): string {
  if (!plainText || isDecryptionPlaceholder(plainText) || plainText === 'Расшифровка…') {
    return fallback;
  }

  const richMessageContent = parseRichMessageContent(plainText);

  if (richMessageContent) {
    const compactText = richMessageContent.text.replace(/\s+/g, ' ').trim();

    if (compactText) {
      return compactText.length > 90 ? `${compactText.slice(0, 90)}…` : compactText;
    }

    if (richMessageContent.attachments.length > 0) {
      const imageCount = richMessageContent.attachments.filter((attachment) => attachment.attachmentDisplayMode === 'IMAGE').length;
      return imageCount === richMessageContent.attachments.length
        ? `${richMessageContent.attachments.length} фото`
        : `${richMessageContent.attachments.length} вложений`;
    }

    if (richMessageContent.forwardedMessages.length > 0) {
      return `${richMessageContent.forwardedMessages.length} пересланных сообщений`;
    }
  }

  const fileAttachment = parseFileAttachmentMessageContent(plainText);

  if (fileAttachment) {
    if (fileAttachment.attachmentDisplayMode === 'IMAGE') {
      return 'Фотография';
    }

    return `Файл: ${fileAttachment.fileName}`;
  }

  const documentAttachment = parseDocumentAttachmentMessageContent(plainText);

  if (documentAttachment) {
    return `Документ: ${documentAttachment.fileName}`;
  }

  const compactText = plainText.replace(/\s+/g, ' ').trim();
  return compactText ? (compactText.length > 90 ? `${compactText.slice(0, 90)}…` : compactText) : fallback;
}

export function isForwardableMessage(message: MessageResponseDto): boolean {
  return message.messageType !== 'SYSTEM' && message.messageType !== 'GROUP_KEY_DISTRIBUTION';
}
export function getDownloadableAttachmentFromPlainText(plainText: string | null | undefined): FileAttachmentMessageContent | DocumentAttachmentMessageContent | null {
  if (!plainText || isDecryptionPlaceholder(plainText) || plainText === 'Расшифровка…') {
    return null;
  }

  const richMessageContent = parseRichMessageContent(plainText);

  if (richMessageContent?.attachments.length) {
    return richMessageContent.attachments[0];
  }

  return parseDocumentAttachmentMessageContent(plainText) ?? parseFileAttachmentMessageContent(plainText);
}


export function buildChatPreviewFromMessage(
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

  if (!decryptedMessage || isDecryptionPlaceholder(decryptedMessage) || decryptedMessage === 'Расшифровка…') {
    return { text: 'Зашифрованное сообщение', accent: 'muted' };
  }

  const fileAttachment = parseFileAttachmentMessageContent(decryptedMessage);

  if (fileAttachment) {
    if (fileAttachment.attachmentDisplayMode === 'IMAGE') {
      return { text: 'Фотография', accent: 'media' };
    }

    return { text: `Файл: ${fileAttachment.fileName}`, accent: 'media' };
  }

  const documentAttachment = parseDocumentAttachmentMessageContent(decryptedMessage);

  if (documentAttachment) {
    return { text: `Документ: ${documentAttachment.fileName}`, accent: 'media' };
  }

  const richMessageContent = parseRichMessageContent(decryptedMessage);

  if (richMessageContent) {
    const compactRichText = richMessageContent.text.replace(/\s+/g, ' ').trim();

    if (compactRichText) {
      return {
        text: compactRichText.length > 58 ? `${compactRichText.slice(0, 58)}…` : compactRichText,
        accent: 'default',
      };
    }

    if (richMessageContent.forwardedMessages.length > 0) {
      return { text: `${richMessageContent.forwardedMessages.length} пересланных сообщений`, accent: 'system' };
    }
  }

  const compactText = decryptedMessage.replace(/\s+/g, ' ').trim();

  if (!compactText) {
    return { text: 'Сообщение', accent: 'muted' };
  }

  return {
    text: compactText.length > 58 ? `${compactText.slice(0, 58)}…` : compactText,
    accent: 'default',
  };
}

export function calculateUnreadCount(messages: MessageResponseDto[], currentAccountId: string | undefined, readAt: string | null | undefined): number {
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

export function getLastPeerActivityAt(messages: MessageResponseDto[], peerAccountId: string | null): string | null {
  if (!peerAccountId) {
    return null;
  }

  return [...messages].reverse().find((message) => message.senderAccountId === peerAccountId)?.createdAt ?? null;
}

export function getPreviewTextColorClass(accent: ChatListPreview['accent']): string {
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

export function Avatar({ label, size = 'md' }: { label: string; size?: 'sm' | 'md' | 'lg' }) {
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

export function UserAvatar({ label, imageUrl, size = 'md' }: { label: string; imageUrl?: string | null; size?: 'sm' | 'md' | 'lg' }) {
  const dimensions = size === 'sm' ? 'h-10 w-10 text-sm' : size === 'lg' ? 'h-14 w-14 text-lg' : 'h-12 w-12 text-base';

  if (imageUrl) {
    return <img src={imageUrl} alt={label} className={`shrink-0 rounded-2xl object-cover shadow-lg shadow-black/20 ${dimensions}`} />;
  }

  return <Avatar label={label} size={size} />;
}

export async function readImageElementFromFile(file: File): Promise<HTMLImageElement> {
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

export function buildCompressedImageFileName(fileName: string): string {
  const dotIndex = fileName.lastIndexOf('.');
  const baseName = dotIndex > 0 ? fileName.slice(0, dotIndex) : fileName;
  return `${baseName}.jpg`;
}

export async function compressImageForChat(file: File): Promise<File> {
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

export function getAccountAvatarUrl(profile: ProfileResponseDto | null | undefined, fallbackAvatarDataUrl?: string | null): string | null {
  return profile?.avatarDataUrl ?? fallbackAvatarDataUrl ?? null;
}

export function getAccountActivityLabel(
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

export function buildAccountLastActivityMap(messagesByChatId: Record<string, MessageResponseDto[]>): Record<string, string> {
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

export function DocumentsPanel({
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

export type ChatPresentation = {
  title: string;
  subtitle: string;
  avatarLabel: string;
  companionProfile: ProfileResponseDto | null;
};


export function getAllGroupParticipants(chat: ChatResponseDto | null): NonNullable<ChatResponseDto['participants']> {
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

export function getActiveGroupParticipants(chat: ChatResponseDto | null): NonNullable<ChatResponseDto['participants']> {
  return getAllGroupParticipants(chat).filter((participant) => participant.status === 'ACTIVE');
}

export function getCurrentGroupParticipant(chat: ChatResponseDto | null, currentAccountId: string | undefined) {
  if (!chat || chat.type !== 'GROUP' || !currentAccountId) {
    return null;
  }

  return getAllGroupParticipants(chat).find((participant) => participant.accountId === currentAccountId) ?? null;
}

export function isCurrentAccountActiveInChat(chat: ChatResponseDto | null, currentAccountId: string | undefined): boolean {
  if (!chat) {
    return false;
  }

  if (chat.type !== 'GROUP') {
    return true;
  }

  return getCurrentGroupParticipant(chat, currentAccountId)?.status === 'ACTIVE';
}

export function getActiveGroupParticipantAccountIds(chat: ChatResponseDto | null): string[] {
  if (!chat) {
    return [];
  }

  if (chat.type !== 'GROUP') {
    return chat.participantAccountIds;
  }

  return getActiveGroupParticipants(chat).map((participant) => participant.accountId);
}

export function isGroupMembershipChangedSystemText(value: string | undefined): boolean {
  return value === '[Ключ группы обновлён]' || value === '[Состав группы обновлён]' || value === '[История группы доступна]';
}

export function getChatPresentation(
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
  const companionDisplayName = getAccountDisplayName(companionAccountId, profilesById);

  return {
    title: companionDisplayName,
    subtitle: getAccountUsernameLabel(companionAccountId, profilesById),
    avatarLabel: companionDisplayName,
    companionProfile,
  };
}


export function getOutgoingMessageStatus(message: MessageResponseDto, currentAccountId: string | undefined): 'SENT' | 'DELIVERED' | 'READ' {
  const relevantStates = message.deliveryStates.filter((deliveryState) => deliveryState.accountId !== currentAccountId);

  if (relevantStates.some((deliveryState) => deliveryState.status === 'READ')) {
    return 'READ';
  }

  return 'SENT';
}

export function getReadReceiptDetails(
  message: MessageResponseDto,
  chat: ChatResponseDto | null,
  profilesById: Record<string, ProfileResponseDto>,
  currentAccountId: string | undefined,
) {
  const activeRecipients = chat
    ? (chat.type === 'GROUP'
      ? getActiveGroupParticipants(chat)
      : chat.participantAccountIds.map((participantAccountId) => ({
        accountId: participantAccountId,
        role: 'MEMBER' as const,
        status: 'ACTIVE' as const,
        historyVisibleFromMessageId: null,
        historyVisibleFromCreatedAt: null,
        joinedAt: chat.createdAt,
        removedAt: null,
        visibilityWindows: [],
      })))
    .filter((participant) => participant.accountId !== message.senderAccountId)
    : [];
  const readAccountIds = new Set(
    message.deliveryStates
      .filter((deliveryState) => deliveryState.status === 'READ')
      .map((deliveryState) => deliveryState.accountId),
  );

  const readParticipants = activeRecipients.filter((participant) => readAccountIds.has(participant.accountId));
  const unreadParticipants = activeRecipients.filter((participant) => !readAccountIds.has(participant.accountId));

  return {
    totalCount: activeRecipients.length,
    readCount: readParticipants.length,
    readParticipants: readParticipants.map((participant) => ({
      accountId: participant.accountId,
      profile: profilesById[participant.accountId] ?? null,
    })),
    unreadParticipants: unreadParticipants.map((participant) => ({
      accountId: participant.accountId,
      profile: profilesById[participant.accountId] ?? null,
    })),
  };
}

export type ParticipantProfilePresentation = {
  accountId: string;
  profile: ProfileResponseDto | null;
};

export function getParticipantDisplayName(participant: ParticipantProfilePresentation): string {
  return participant.profile ? getDisplayName(participant.profile) : 'Профиль загружается';
}

export type GroupSystemEventType = 'GROUP_CREATED' | 'MEMBER_ADDED' | 'MEMBER_REMOVED';

export type GroupSystemMessagePayload = {
  kind: 'GROUP_SYSTEM_EVENT';
  version: number;
  type: GroupSystemEventType;
  chatId: string;
  chatName: string | null;
  actorAccountId: string;
  targetAccountId: string | null;
};

export function parseGroupSystemMessagePayload(value: string | null): GroupSystemMessagePayload | null {
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

export function getProfileDisplayNameById(accountId: string | null, profilesById: Record<string, ProfileResponseDto>): string {
  if (!accountId) {
    return 'Неизвестный пользователь';
  }

  const profile = profilesById[accountId];

  if (!profile) {
    return 'Профиль загружается';
  }

  return getDisplayName(profile);
}

export function formatGroupSystemMessage(payload: GroupSystemMessagePayload | null, profilesById: Record<string, ProfileResponseDto>): string {
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


export function ReplyReferenceBlock({
  replyTo,
  isOwnMessage,
  onOpenOriginalMessage,
}: {
  replyTo: ReplyDraft;
  isOwnMessage: boolean;
  onOpenOriginalMessage?: (messageId: string) => void;
}) {
  const isClickable = Boolean(onOpenOriginalMessage);

  return (
    <button
      type="button"
      onClick={() => onOpenOriginalMessage?.(replyTo.messageId)}
      disabled={!isClickable}
      className={`mb-2 block w-full rounded-2xl border-l-2 px-3 py-2 text-left transition ${isOwnMessage ? 'border-white/60 bg-white/12' : 'border-violet-300/70 bg-violet-400/10'} ${isClickable ? 'cursor-pointer hover:brightness-110' : 'cursor-default'}`}
      title={isClickable ? 'Перейти к сообщению' : undefined}
    >
      <div className={`text-xs font-semibold ${isOwnMessage ? 'text-white' : 'text-violet-200'}`}>{replyTo.senderName}</div>
      <div className={`mt-0.5 line-clamp-2 text-xs ${isOwnMessage ? 'text-violet-50/75' : 'text-zinc-400'}`}>{replyTo.preview}</div>
    </button>
  );
}

export function ForwardedMessageCard({
  forwardedMessage,
  profilesById,
  onOpenProfile,
  onDownload,
  depth = 0,
}: {
  forwardedMessage: ForwardedMessageSnapshot;
  profilesById: Record<string, ProfileResponseDto>;
  onOpenProfile: (accountId: string) => void;
  onDownload: (attachment: FileAttachmentMessageContent | DocumentAttachmentMessageContent) => Promise<void>;
  depth?: number;
}) {
  const senderProfile = profilesById[forwardedMessage.senderAccountId] ?? null;
  const senderName = senderProfile ? getDisplayName(senderProfile) : forwardedMessage.senderName;
  const richNestedContent = parseRichMessageContent(forwardedMessage.plainText);
  const visiblePlainText = richNestedContent?.text ?? forwardedMessage.plainText;
  const richAttachments = richNestedContent?.attachments ?? [];
  const fileAttachment = richAttachments.length === 0 ? parseFileAttachmentMessageContent(visiblePlainText) : null;
  const documentAttachment = richAttachments.length === 0 ? parseDocumentAttachmentMessageContent(visiblePlainText) : null;
  const nestedForwardedMessages = depth < 3 ? richNestedContent?.forwardedMessages ?? [] : [];

  return (
    <div className="relative rounded-2xl border border-white/10 bg-black/16 p-3">
      <div className="absolute -left-[18px] top-0 h-full w-px bg-violet-300/30" />
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onOpenProfile(forwardedMessage.senderAccountId)}
          className="flex min-w-0 items-center gap-2 rounded-xl transition hover:bg-white/[0.06]"
        >
          <UserAvatar label={senderName} imageUrl={getAccountAvatarUrl(senderProfile)} size="sm" />
          <span className="min-w-0 truncate text-xs font-semibold text-violet-100">{senderName}</span>
        </button>
        <span className="shrink-0 text-[11px] text-zinc-500">{formatMessageTime(forwardedMessage.createdAt)}</span>
        {depth > 0 && <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] text-zinc-500">переслано</span>}
      </div>
      <div className="mt-2 space-y-2">
        {visiblePlainText.trim() && !fileAttachment && !documentAttachment && (
          <div className="whitespace-pre-wrap text-sm leading-6 text-zinc-200">{visiblePlainText}</div>
        )}
        {richAttachments.length > 0 && (
          <div className={`grid gap-2 ${richAttachments.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
            {richAttachments.map((attachment) => (
              <div key={attachment.mediaFileId}>
                {attachment.attachmentDisplayMode === 'IMAGE' ? (
                  <ImageAttachmentPreview attachment={attachment} onDownload={onDownload} />
                ) : (
                  <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/[0.06] text-zinc-100">
                      <FileText size={18} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-zinc-100">{attachment.fileName}</div>
                      <div className="mt-0.5 text-xs text-zinc-500">{formatFileSize(attachment.sizeBytes)}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => void onDownload(attachment)}
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/[0.06] text-zinc-200 transition hover:bg-white/[0.1]"
                      title="Скачать"
                    >
                      <Download size={16} />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
        {documentAttachment ? (
          <DocumentAttachmentPreview attachment={documentAttachment} isOwnMessage={false} onDownload={onDownload} />
        ) : fileAttachment ? (
          fileAttachment.attachmentDisplayMode === 'IMAGE' ? (
            <ImageAttachmentPreview attachment={fileAttachment} onDownload={onDownload} />
          ) : (
            <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/[0.06] text-zinc-100">
                <FileText size={18} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-zinc-100">{fileAttachment.fileName}</div>
                <div className="mt-0.5 text-xs text-zinc-500">{formatFileSize(fileAttachment.sizeBytes)}</div>
              </div>
              <button
                type="button"
                onClick={() => void onDownload(fileAttachment)}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/[0.06] text-zinc-200 transition hover:bg-white/[0.1]"
                title="Скачать"
              >
                <Download size={16} />
              </button>
            </div>
          )
        ) : null}
        {nestedForwardedMessages.length > 0 && (
          <div className="space-y-2 border-l border-violet-300/20 pl-3">
            <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-violet-100/55">
              Переслано повторно · {nestedForwardedMessages.length}
            </div>
            {nestedForwardedMessages.map((nestedMessage) => (
              <ForwardedMessageCard
                key={`${nestedMessage.chatId}-${nestedMessage.messageId}-${depth}`}
                forwardedMessage={nestedMessage}
                profilesById={profilesById}
                onOpenProfile={onOpenProfile}
                onDownload={onDownload}
                depth={depth + 1}
              />
            ))}
          </div>
        )}
        {!visiblePlainText.trim() && richAttachments.length === 0 && !fileAttachment && !documentAttachment && nestedForwardedMessages.length === 0 && (
          <div className="whitespace-pre-wrap text-sm leading-6 text-zinc-200">Сообщение</div>
        )}
      </div>
    </div>
  );
}

export function NewChatModal({
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
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xl">
      <div className="relative w-full max-w-3xl overflow-hidden rounded-[2rem] border border-white/10 bg-[#171820]/96 shadow-2xl shadow-black/60">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-[radial-gradient(circle_at_16%_0%,rgba(139,92,246,0.28),transparent_24rem),radial-gradient(circle_at_90%_0%,rgba(14,165,233,0.16),transparent_20rem)]" />
        <div className="relative flex items-start justify-between gap-4 border-b border-white/10 px-6 py-5">
          <div>
            <div className="text-2xl font-semibold tracking-tight text-zinc-50">Новый чат</div>
            <div className="mt-1 text-sm text-zinc-400">Найди коллегу для личного диалога или выбери несколько участников для группы.</div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl border border-white/10 bg-white/[0.045] p-2 text-zinc-400 transition hover:border-violet-300/30 hover:bg-white/[0.08] hover:text-zinc-100"
            title="Закрыть"
          >
            <X size={18} />
          </button>
        </div>

        <div className="relative grid gap-5 p-6 md:grid-cols-[1fr_18rem]">
          <div className="min-w-0">
            <div className="mb-4 flex items-center gap-3 rounded-[1.6rem] border border-white/10 bg-white/[0.055] px-4 py-3 shadow-inner shadow-black/15 transition focus-within:border-violet-300/35 focus-within:bg-white/[0.075]">
              <Search size={18} className="text-zinc-500" />
              <input
                autoFocus
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="w-full bg-transparent text-sm text-zinc-100 outline-none placeholder:text-zinc-600"
                placeholder="Поиск по имени, username или email"
              />
              {isSearching && <LoaderCircle size={17} className="animate-spin text-violet-200" />}
            </div>

            <div className="max-h-[31rem] overflow-y-auto pr-1">
              {query.trim().length < 2 && (
                <div className="rounded-[1.75rem] border border-dashed border-white/10 bg-white/[0.025] px-6 py-10 text-center">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-3xl bg-violet-500/12 text-violet-200"><Search size={24} /></div>
                  <div className="mt-4 text-sm font-medium text-zinc-300">Начни вводить имя или логин</div>
                  <div className="mt-1 text-xs text-zinc-500">Достаточно двух символов, чтобы найти сотрудника.</div>
                </div>
              )}

              {!isSearching && query.trim().length >= 2 && results.length === 0 && !errorMessage && (
                <div className="rounded-[1.75rem] border border-white/10 bg-white/[0.03] px-6 py-10 text-center text-sm text-zinc-500">Никого не нашли по этому запросу.</div>
              )}

              {errorMessage && (
                <div className="rounded-[1.75rem] border border-red-400/20 bg-red-500/10 p-4 text-sm text-red-200">{errorMessage}</div>
              )}

              <div className="space-y-2">
                {results.map((profile) => {
                  const displayName = getDisplayName(profile);
                  const isCreating = creatingAccountId === profile.accountId;
                  const isSelected = selectedProfiles.some((selectedProfile) => selectedProfile.accountId === profile.accountId);

                  return (
                    <div
                      key={profile.accountId}
                      className="group flex w-full items-center gap-3 rounded-[1.5rem] border border-white/8 bg-white/[0.035] px-3 py-3 text-left transition hover:border-violet-300/25 hover:bg-white/[0.06]"
                    >
                      <button
                        type="button"
                        onClick={() => toggleSelectedProfile(profile)}
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border text-sm font-semibold transition ${isSelected ? 'border-violet-300/35 bg-violet-500/22 text-violet-50' : 'border-white/10 bg-white/[0.045] text-zinc-500 hover:text-zinc-200'}`}
                        title={isSelected ? 'Убрать из группы' : 'Добавить в группу'}
                      >
                        {isSelected ? '✓' : '+'}
                      </button>
                      <UserAvatar label={displayName} imageUrl={getAccountAvatarUrl(profile)} />

                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold text-zinc-100">{displayName}</div>
                        <div className="mt-1 truncate text-xs text-zinc-500">@{profile.username} · {profile.email}</div>
                      </div>

                      <button
                        type="button"
                        onClick={async () => {
                          setCreatingAccountId(profile.accountId);
                          setErrorMessage(null);

                          try {
                            await onCreateChat(profile);
                          }
                          catch (error) {
                            console.error(error);
                            setErrorMessage('Не удалось открыть личный чат.');
                          }
                          finally {
                            setCreatingAccountId(null);
                          }
                        }}
                        className="inline-flex items-center gap-2 rounded-2xl border border-violet-300/16 bg-violet-500/10 px-3 py-2 text-xs font-medium text-violet-100 transition hover:border-violet-300/30 hover:bg-violet-500/16"
                      >
                        {isCreating ? <LoaderCircle size={14} className="animate-spin" /> : <MessageCircle size={14} />}
                        Написать
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <aside className="rounded-[1.75rem] border border-white/10 bg-black/18 p-4">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-violet-200/80">
              <Users size={15} />
              Группа
            </div>
            <input
              value={groupName}
              onChange={(event) => setGroupName(event.target.value)}
              className="mt-4 w-full rounded-2xl border border-white/10 bg-white/[0.045] px-4 py-3 text-sm text-zinc-100 outline-none placeholder:text-zinc-600 transition focus:border-violet-300/35 focus:bg-white/[0.065]"
              placeholder="Название группы"
            />
            <div className="mt-4 min-h-24 rounded-2xl border border-white/8 bg-white/[0.025] p-3">
              {selectedProfiles.length === 0 ? (
                <div className="flex h-full min-h-16 items-center justify-center text-center text-xs leading-5 text-zinc-500">Отметь сотрудников плюсом слева — они появятся здесь.</div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {selectedProfiles.map((profile) => (
                    <button
                      type="button"
                      key={profile.accountId}
                      onClick={() => toggleSelectedProfile(profile)}
                      className="inline-flex items-center gap-2 rounded-full border border-violet-300/20 bg-violet-500/12 py-1 pl-1 pr-3 text-xs text-violet-50 transition hover:bg-violet-500/18"
                    >
                      <UserAvatar label={getDisplayName(profile)} imageUrl={getAccountAvatarUrl(profile)} size="sm" />
                      <span className="max-w-32 truncate">{getDisplayName(profile)}</span>
                      <span className="text-violet-200/70">×</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => void handleCreateSelectedGroup()}
              disabled={isCreatingGroup || selectedProfiles.length === 0 || !groupName.trim()}
              className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-violet-500 to-fuchsia-500 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-violet-950/35 transition hover:from-violet-400 hover:to-fuchsia-400 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isCreatingGroup ? <LoaderCircle size={16} className="animate-spin" /> : <Users size={16} />}
              Создать группу
            </button>
          </aside>
        </div>
      </div>
    </div>
  );
}

export type GroupHistoryAccessMode = AddGroupParticipantRequestDto['historyAccessMode'];

export function GroupManagementModal({
  isOpen,
  chat,
  currentAccountId,
  profilesById,
  presenceByAccountId,
  lastActivityByAccountId,
  onClose,
  onAddParticipant,
  onRemoveParticipant,
  onUpdateGroupAvatar,
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
  onUpdateGroupAvatar: (chatId: string, file: File | null) => Promise<void>;
  onOpenProfile: (accountId: string) => void;
}) {
  const upsertProfiles = useDirectoryStore((state) => state.upsertProfiles);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ProfileResponseDto[]>([]);
  const [historyAccessMode, setHistoryAccessMode] = useState<GroupHistoryAccessMode>('NEW_MESSAGES_ONLY');
  const [isSearching, setIsSearching] = useState(false);
  const [busyAccountId, setBusyAccountId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isAvatarUploading, setIsAvatarUploading] = useState(false);

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
      setIsAvatarUploading(false);
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

  async function handleGroupAvatarSelected(file: File | null) {
    if (!chat || !canManageMembers) {
      return;
    }

    setIsAvatarUploading(true);
    setErrorMessage(null);

    try {
      await onUpdateGroupAvatar(chat.chatId, file);
    }
    catch (error) {
      console.error(error);
      setErrorMessage('Не удалось обновить аватар группы.');
    }
    finally {
      setIsAvatarUploading(false);
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
            <div className="flex items-center gap-4">
              <UserAvatar label={chat.name ?? 'Групповой чат'} imageUrl={chat.avatarDataUrl} size="lg" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold text-zinc-200">{chat.name ?? 'Групповой чат'}</div>
                <div className="mt-1 text-xs text-zinc-500">{activeParticipants.length} активных участников • защищённый чат</div>
                {canManageMembers && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <label className="inline-flex cursor-pointer items-center rounded-2xl border border-violet-300/20 bg-violet-500/10 px-3 py-1.5 text-xs text-violet-100 transition hover:bg-violet-500/15">
                      {isAvatarUploading ? 'Загрузка…' : 'Сменить аватар'}
                      <input
                        type="file"
                        accept="image/*"
                        disabled={isAvatarUploading}
                        className="hidden"
                        onChange={(event) => {
                          const file = event.target.files?.[0] ?? null;
                          event.target.value = '';
                          void handleGroupAvatarSelected(file);
                        }}
                      />
                    </label>
                    {chat.avatarDataUrl && (
                      <button
                        type="button"
                        onClick={() => void handleGroupAvatarSelected(null)}
                        disabled={isAvatarUploading}
                        className="rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-zinc-300 transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Убрать
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="mt-5 max-h-[48vh] space-y-3 overflow-y-auto pr-1">
            {activeParticipants.map((participant) => {
              const participantProfile = profilesById[participant.accountId] ?? null;
              const participantName = getAccountDisplayName(participant.accountId, profilesById);
              const participantPresence = presenceByAccountId[participant.accountId];
              const participantActivityLabel = getAccountActivityLabel(participantPresence, lastActivityByAccountId[participant.accountId]);
              const isCurrentUser = participant.accountId === currentAccountId;
              const canRemove = canManageMembers && !isCurrentUser && participant.role !== 'OWNER';

              return (
                <div key={participant.accountId} className="flex items-center gap-3 rounded-3xl border border-white/8 bg-white/[0.03] px-4 py-3 transition hover:bg-white/[0.05]">
                  <button
                    type="button"
                    onClick={() => onOpenProfile(participant.accountId)}
                    className="flex min-w-0 flex-1 items-center gap-3 text-left transition hover:brightness-110"
                  >
                    <div className="relative shrink-0">
                      <UserAvatar label={participantName} imageUrl={getAccountAvatarUrl(participantProfile)} />
                      <span className={`absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-[#1c1d22] ${participantPresence?.isOnline ? 'bg-emerald-400' : 'bg-zinc-600'}`} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold text-zinc-100">{participantName}{isCurrentUser ? ' • это вы' : ''}</div>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                        <span>{getAccountUsernameLabel(participant.accountId, profilesById)}</span>
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
                  <div className="mt-1 text-xs leading-5 text-zinc-500">Участник увидит только сообщения, которые появятся после добавления.</div>
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
                  <div className="mt-1 text-xs leading-5 text-zinc-500">Участник сможет открыть всю доступную историю группы.</div>
                </div>
              </div>
            </label>
          </div>

          <div className="mt-5 rounded-[1.6rem] border border-white/10 bg-white/[0.045] px-4 py-3 shadow-inner shadow-black/15 transition focus-within:border-violet-300/35 focus-within:bg-white/[0.065]">
            <div className="flex items-center gap-3">
              <Search size={18} className="text-zinc-500" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                disabled={!canManageMembers}
                className="w-full bg-transparent text-sm text-zinc-100 outline-none placeholder:text-zinc-600 disabled:cursor-not-allowed"
                placeholder="Найти пользователя по имени, username или email"
              />
              {isSearching && <LoaderCircle size={16} className="animate-spin text-violet-200" />}
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
                  <UserAvatar label={displayName} imageUrl={getAccountAvatarUrl(profile)} />
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


export type SettingsTab = 'profile' | 'devices' | 'security';

export function isDecryptionPlaceholder(value: string | undefined): boolean {
  if (!value) {
    return false;
  }

  return value === '[Не удалось расшифровать сообщение]' || value === '[Сообщение недоступно для этого устройства]' || value === '[Ключ группы пока недоступен]';
}

export function formatDeviceTime(value: string | null | undefined): string {
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

export function CryptoStatusBadge({ status }: { status: string }) {
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

export function SettingsModal({
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
  }, [profile?.accountId, profile?.avatarDataUrl]);

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


export function MiniProfileModal({
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


export async function decryptDirectMessageWithAvailablePayloads(
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

