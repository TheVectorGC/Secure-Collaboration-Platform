import type { ChatResponseDto, ProfileResponseDto } from '../types/api';

export function getFullName(profile: Pick<ProfileResponseDto, 'firstName' | 'lastName' | 'middleName'>): string {
  return [profile.firstName, profile.lastName].filter(Boolean).join(' ').trim();
}

export function getDisplayName(profile: ProfileResponseDto): string {
  const fullName = getFullName(profile);
  return fullName || profile.username || profile.email;
}

export function getDirectCompanionAccountId(chat: ChatResponseDto, currentAccountId: string | undefined): string | null {
  if (chat.type !== 'DIRECT') {
    return null;
  }

  return chat.participantAccountIds.find((participantAccountId) => participantAccountId !== currentAccountId) ?? null;
}
