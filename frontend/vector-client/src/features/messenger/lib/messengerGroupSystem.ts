import { getDisplayName } from '../../../shared/lib/profile';
import type { ProfileResponseDto } from '../../../shared/types/api';
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
