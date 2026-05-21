import type { ChatResponseDto, ProfileResponseDto } from '../types/api';

export function getFullName(profile: Pick<ProfileResponseDto, 'firstName' | 'lastName' | 'middleName'>): string {
  return [profile.firstName, profile.lastName].filter(Boolean).join(' ').trim();
}

export function getDisplayName(profile: ProfileResponseDto): string {
  const fullName = getFullName(profile);
  return fullName || profile.username || profile.email || 'Пользователь';
}

export function getProfileDisplayName(profile: ProfileResponseDto | null | undefined, fallbackDisplayName = 'Профиль загружается'): string {
  if (!profile) {
    return fallbackDisplayName;
  }

  return getDisplayName(profile);
}

export function getAccountDisplayName(
  accountId: string | null | undefined,
  profilesById: Record<string, ProfileResponseDto>,
  fallbackDisplayName = 'Профиль загружается',
): string {
  if (!accountId) {
    return 'Неизвестный пользователь';
  }

  return getProfileDisplayName(profilesById[accountId], fallbackDisplayName);
}

export function getAccountUsernameLabel(
  accountId: string | null | undefined,
  profilesById: Record<string, ProfileResponseDto>,
): string {
  if (!accountId) {
    return 'профиль недоступен';
  }

  const profile = profilesById[accountId];

  if (!profile) {
    return 'загрузка профиля';
  }

  return `@${profile.username}`;
}

export function getDirectCompanionAccountId(chat: ChatResponseDto, currentAccountId: string | undefined): string | null {
  if (chat.type !== 'DIRECT') {
    return null;
  }

  return chat.participantAccountIds.find((participantAccountId) => participantAccountId !== currentAccountId) ?? null;
}
