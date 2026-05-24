import { useMemo } from 'react';
import type { ChatResponseDto, MessageResponseDto, ProfileResponseDto } from '../../../shared/types/api';
import { getDirectCompanionAccountId } from '../../../shared/lib/profile';
import type { AccountPresenceState } from '../../realtime/model/realtimeStore';
import {
  getAccountActivityLabel,
  getActiveGroupParticipantAccountIds,
  getChatPresentation,
  getCurrentGroupParticipant,
  getLastPeerActivityAt,
  getVisibleChatMessages,
  isCurrentAccountActiveInChat,
  type LocalChatState,
} from '../lib/messengerCore';

type TypingState = {
  accountId: string;
  username: string;
  expiresAt: number;
};

type UseSelectedChatViewModelParams = {
  chats: ChatResponseDto[];
  selectedChatId: string | null;
  messagesByChatId: Record<string, MessageResponseDto[]>;
  localChatState: LocalChatState;
  currentProfile: ProfileResponseDto | null;
  profilesById: Record<string, ProfileResponseDto>;
  typingByChatId: Record<string, TypingState[]>;
  presenceByAccountId: Record<string, AccountPresenceState>;
};

export function useSelectedChatViewModel(params: UseSelectedChatViewModelParams) {
  const {
    chats,
    selectedChatId,
    messagesByChatId,
    localChatState,
    currentProfile,
    profilesById,
    typingByChatId,
    presenceByAccountId,
  } = params;

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
  const hiddenChatIdSet = useMemo(() => new Set(localChatState.hiddenChatIds), [localChatState.hiddenChatIds]);
  const selectedChatActiveParticipantAccountIds = useMemo(
    () => getActiveGroupParticipantAccountIds(selectedChat),
    [selectedChat],
  );
  const selectedChatActiveParticipantAccountIdSet = useMemo(
    () => new Set(selectedChatActiveParticipantAccountIds),
    [selectedChatActiveParticipantAccountIds],
  );
  const selectedDirectCompanionAccountId = selectedChat?.type === 'DIRECT'
    ? getDirectCompanionAccountId(selectedChat, currentProfile?.accountId)
    : null;
  const selectedGroupParticipant = selectedChat?.type === 'GROUP'
    ? getCurrentGroupParticipant(selectedChat, currentProfile?.accountId)
    : null;
  const isSelectedGroupChatLeft = selectedGroupParticipant?.status === 'LEFT';
  const isSelectedGroupChatRemoved = selectedGroupParticipant?.status === 'REMOVED';
  const isSelectedDirectChatBlockedByCurrentAccount = Boolean(selectedChat?.currentAccountBlockedCompanion);
  const isSelectedDirectChatBlockedByCompanion = Boolean(selectedChat?.companionBlockedCurrentAccount);
  const isSelectedDirectChatBlocked = selectedChat?.type === 'DIRECT'
    && (isSelectedDirectChatBlockedByCurrentAccount || isSelectedDirectChatBlockedByCompanion);
  const isSelectedChatWritable = isCurrentAccountActiveInChat(selectedChat, currentProfile?.accountId) && !isSelectedDirectChatBlocked;
  const selectedTypingStates = selectedChatId
    ? (typingByChatId[selectedChatId] ?? []).filter((typingState) => selectedChat?.type !== 'GROUP' || selectedChatActiveParticipantAccountIdSet.has(typingState.accountId))
    : [];
  const selectedChatPresentation = selectedChat ? getChatPresentation(selectedChat, currentProfile, profilesById) : null;
  const directBlockNotice = selectedChat?.type === 'DIRECT' && isSelectedDirectChatBlockedByCompanion
    ? 'Пользователь вас заблокировал. Отправка сообщений отключена.'
    : selectedChat?.type === 'DIRECT' && isSelectedDirectChatBlockedByCurrentAccount
      ? 'Вы заблокировали этого пользователя. Отправка сообщений отключена.'
      : null;
  const selectedTypingText = isSelectedChatWritable && selectedTypingStates.length > 0
    ? selectedTypingStates.length === 1
      ? `${selectedTypingStates[0].username || 'Пользователь'} печатает…`
      : 'Несколько пользователей печатают…'
    : null;
  const selectedDirectLastActivityAt = getLastPeerActivityAt(visibleSelectedMessages, selectedDirectCompanionAccountId);
  const selectedDirectPresence = selectedDirectCompanionAccountId ? presenceByAccountId[selectedDirectCompanionAccountId] : null;
  const selectedChatSubtitle = selectedTypingText
    ?? (selectedChat?.type === 'SELF'
      ? 'Личный чат'
      : selectedChat?.type === 'DIRECT'
        ? getAccountActivityLabel(selectedDirectPresence, selectedDirectLastActivityAt)
        : selectedChatPresentation?.subtitle ?? '');

  return {
    selectedChat,
    selectedMessages,
    visibleSelectedMessages,
    loadedMessages,
    hiddenChatIdSet,
    selectedDirectCompanionAccountId,
    isSelectedDirectChatBlockedByCurrentAccount,
    isSelectedChatWritable,
    isSelectedGroupChatLeft,
    isSelectedGroupChatRemoved,
    selectedGroupParticipant,
    selectedChatPresentation,
    directBlockNotice,
    selectedTypingText,
    selectedChatSubtitle,
  };
}
