import { formatLastSeen } from '../../../shared/lib/dateFormat';
import { getAvatarGradient, getInitials } from '../../../shared/lib/avatar';
import type { AccountPresenceState } from '../../realtime/model/realtimeStore';
import type { MessageResponseDto, ProfileResponseDto } from '../../../shared/types/api';
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
    const previousActivityAt = lastActivityByAccountId[message.senderAccountId];

    if (!previousActivityAt || new Date(message.createdAt).getTime() > new Date(previousActivityAt).getTime()) {
      lastActivityByAccountId[message.senderAccountId] = message.createdAt;
    }
  });

  return lastActivityByAccountId;
}
