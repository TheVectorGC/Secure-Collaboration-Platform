import { parseDocumentAttachmentMessageContent, parseFileAttachmentMessageContent } from '../../media/lib/fileCrypto';
import type { MessageResponseDto, ProfileResponseDto } from '../../../shared/types/api';
import { type ChatListPreview } from './messengerTypes';
import { isDecryptionPlaceholder, parseRichMessageContent } from './messengerContent';
import { formatGroupSystemMessage, parseGroupSystemMessagePayload } from './messengerGroupSystem';
export function getVisibleChatMessages(messages: MessageResponseDto[], clearedAt: string | null | undefined): MessageResponseDto[] {
  if (!clearedAt) {
    return messages;
  }

  const clearedAtTime = new Date(clearedAt).getTime();
  return messages.filter((message) => new Date(message.createdAt).getTime() > clearedAtTime);
}

export function getLastTimelineMessage(messages: MessageResponseDto[]): MessageResponseDto | null {
  const visibleMessages = messages;
  return visibleMessages.at(-1) ?? null;
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
