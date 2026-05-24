import { FileText } from 'lucide-react';
import { formatFileSize, parseDocumentAttachmentMessageContent, parseFileAttachmentMessageContent } from '../../media/lib/fileCrypto';
import { DocumentAttachmentPreview, DownloadActionButton, ImageAttachmentPreview } from '../ui/MessageAttachments';
import { formatMessageTime } from '../../../shared/lib/dateFormat';
import { getDisplayName } from '../../../shared/lib/profile';
import type { DocumentAttachmentMessageContent, FileAttachmentMessageContent, MessageResponseDto, ProfileResponseDto } from '../../../shared/types/api';
import { createMediaDownloadPersistenceKey, type DownloadActionResult } from '../../media/lib/downloadState';
import { UserAvatar, getAccountAvatarUrl } from './messengerProfileVisual';
import { type ForwardedMessageSnapshot, type ReplyDraft, type RichMessageContent } from './messengerTypes';

export const DECRYPTION_PLACEHOLDER_TEXT = 'Зашифрованное сообщение';

export function isDecryptionPlaceholder(value: string | undefined): boolean {
  if (!value) {
    return false;
  }

  return value === DECRYPTION_PLACEHOLDER_TEXT || value === '[Не удалось расшифровать сообщение]' || value === '[Сообщение недоступно для этого устройства]' || value === '[Ключ группы пока недоступен]';
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
      if (richMessageContent.attachments.length === 1) {
        return richMessageContent.attachments[0].attachmentDisplayMode === 'IMAGE' ? 'Фотография' : 'Файл';
      }

      return imageCount === richMessageContent.attachments.length
        ? 'Фотографии'
        : 'Файлы';
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

    return 'Файл';
  }

  const documentAttachment = parseDocumentAttachmentMessageContent(plainText);

  if (documentAttachment) {
    return `Документ: ${documentAttachment.fileName}`;
  }

  const compactText = plainText.replace(/\s+/g, ' ').trim();
  return compactText ? (compactText.length > 90 ? `${compactText.slice(0, 90)}…` : compactText) : fallback;
}

export function isForwardableMessage(message: MessageResponseDto): boolean {
  return message.messageType !== 'SYSTEM';
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
  onDownload: (attachment: FileAttachmentMessageContent | DocumentAttachmentMessageContent) => Promise<DownloadActionResult>;
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
                    <DownloadActionButton
                      onDownload={() => onDownload(attachment)}
                      persistenceKey={createMediaDownloadPersistenceKey(attachment.mediaFileId)}
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/[0.06] text-zinc-200 transition hover:bg-white/[0.1] disabled:cursor-wait disabled:opacity-70"
                    />
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
                    <DownloadActionButton
                      onDownload={() => onDownload(fileAttachment)}
                      persistenceKey={createMediaDownloadPersistenceKey(fileAttachment.mediaFileId)}
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/[0.06] text-zinc-200 transition hover:bg-white/[0.1] disabled:cursor-wait disabled:opacity-70"
                    />
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
