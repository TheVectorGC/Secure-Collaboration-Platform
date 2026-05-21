import { getDisplayName } from '../../../shared/lib/profile';
import type { ChatResponseDto, MessageResponseDto, ProfileResponseDto } from '../../../shared/types/api';
import { getActiveGroupParticipants } from './messengerGroup';
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
