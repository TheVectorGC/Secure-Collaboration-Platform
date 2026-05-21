import { getAccountDisplayName, getAccountUsernameLabel, getDirectCompanionAccountId } from '../../../shared/lib/profile';
import type { AddGroupParticipantRequestDto, ChatResponseDto, ProfileResponseDto } from '../../../shared/types/api';
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

export type GroupHistoryAccessMode = AddGroupParticipantRequestDto['historyAccessMode'];

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

