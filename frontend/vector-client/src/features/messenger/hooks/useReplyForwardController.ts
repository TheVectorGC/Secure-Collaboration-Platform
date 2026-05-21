import { useState } from 'react';
import { getAccountDisplayName } from '../../../shared/lib/profile';
import type { ChatResponseDto, MessageResponseDto, ProfileResponseDto } from '../../../shared/types/api';
import {
  ForwardedMessageSnapshot,
  ForwardSelectionState,
  ReplyDraft,
  getMessageContentPreview,
  isForwardableMessage,
} from '../lib/messengerCore';

type UseReplyForwardControllerParams = {
  selectedChatId: string | null;
  messagesByChatId: Record<string, MessageResponseDto[]>;
  profilesById: Record<string, ProfileResponseDto>;
  decryptedMessagesById: Record<string, string>;
  onSelectChat: (chatId: string) => void;
  onCloseContextMenu: () => void;
};

export function useReplyForwardController({
  selectedChatId,
  messagesByChatId,
  profilesById,
  decryptedMessagesById,
  onSelectChat,
  onCloseContextMenu,
}: UseReplyForwardControllerParams) {
  const [replyDraft, setReplyDraft] = useState<ReplyDraft | null>(null);
  const [forwardSelection, setForwardSelection] = useState<ForwardSelectionState | null>(null);
  const [forwardDraftItems, setForwardDraftItems] = useState<ForwardedMessageSnapshot[]>([]);
  const [isForwardChatPickerOpen, setIsForwardChatPickerOpen] = useState(false);
  const [forwardChatPickerQuery, setForwardChatPickerQuery] = useState('');

  function buildReplyDraftFromMessage(message: MessageResponseDto): ReplyDraft {
    const decryptedMessage = decryptedMessagesById[message.messageId] ?? '';
    const senderName = getAccountDisplayName(message.senderAccountId, profilesById);

    return {
      messageId: message.messageId,
      chatId: message.chatId,
      senderAccountId: message.senderAccountId,
      senderName,
      preview: getMessageContentPreview(decryptedMessage, 'Вложение'),
      createdAt: message.createdAt,
    };
  }

  function buildForwardSnapshotFromMessage(message: MessageResponseDto): ForwardedMessageSnapshot {
    const senderName = getAccountDisplayName(message.senderAccountId, profilesById);

    return {
      messageId: message.messageId,
      chatId: message.chatId,
      senderAccountId: message.senderAccountId,
      senderName,
      createdAt: message.createdAt,
      plainText: decryptedMessagesById[message.messageId] ?? '',
    };
  }

  function startReplyFromContextMenu(message: MessageResponseDto | null) {
    if (!message || !isForwardableMessage(message)) {
      return;
    }

    setReplyDraft(buildReplyDraftFromMessage(message));
    setForwardSelection(null);
    onCloseContextMenu();
  }

  function startForwardFromContextMenu(message: MessageResponseDto | null) {
    if (!message || !selectedChatId || !isForwardableMessage(message)) {
      return;
    }

    setReplyDraft(null);
    setForwardDraftItems([]);
    setForwardSelection({
      originChatId: selectedChatId,
      selectedMessageIds: [message.messageId],
    });
    onCloseContextMenu();
  }

  function toggleForwardSelectedMessage(message: MessageResponseDto) {
    if (!forwardSelection || !isForwardableMessage(message)) {
      return;
    }

    setForwardSelection((previousValue) => {
      if (!previousValue) {
        return previousValue;
      }

      const selectedMessageIds = previousValue.selectedMessageIds.includes(message.messageId)
        ? previousValue.selectedMessageIds.filter((messageId) => messageId !== message.messageId)
        : [...previousValue.selectedMessageIds, message.messageId];

      return {
        ...previousValue,
        selectedMessageIds,
      };
    });
  }

  function cancelForwardSelection() {
    setForwardSelection(null);
    setIsForwardChatPickerOpen(false);
    setForwardChatPickerQuery('');
  }

  function openForwardChatPicker() {
    if (!forwardSelection || forwardSelection.selectedMessageIds.length === 0) {
      return;
    }

    setIsForwardChatPickerOpen(true);
    setForwardChatPickerQuery('');
  }

  function selectForwardTargetChat(chat: ChatResponseDto) {
    if (!forwardSelection) {
      return;
    }

    const originMessages = messagesByChatId[forwardSelection.originChatId] ?? [];
    const selectedMessageIdSet = new Set(forwardSelection.selectedMessageIds);
    const forwardedMessages = originMessages
      .filter((message) => selectedMessageIdSet.has(message.messageId) && isForwardableMessage(message))
      .sort((leftMessage, rightMessage) => new Date(leftMessage.createdAt).getTime() - new Date(rightMessage.createdAt).getTime())
      .map(buildForwardSnapshotFromMessage);

    if (forwardedMessages.length === 0) {
      cancelForwardSelection();
      return;
    }

    setForwardDraftItems(forwardedMessages);
    setForwardSelection(null);
    setIsForwardChatPickerOpen(false);
    setForwardChatPickerQuery('');
    onSelectChat(chat.chatId);
  }

  return {
    replyDraft,
    setReplyDraft,
    forwardSelection,
    forwardDraftItems,
    setForwardDraftItems,
    isForwardChatPickerOpen,
    setIsForwardChatPickerOpen,
    forwardChatPickerQuery,
    setForwardChatPickerQuery,
    startReplyFromContextMenu,
    startForwardFromContextMenu,
    toggleForwardSelectedMessage,
    cancelForwardSelection,
    openForwardChatPicker,
    selectForwardTargetChat,
  };
}
