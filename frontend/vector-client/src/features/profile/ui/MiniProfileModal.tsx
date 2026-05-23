import { useState } from 'react';
import { Clock3, LoaderCircle, Mail, MessageSquare, User, X } from 'lucide-react';
import { getDisplayName } from '../../../shared/lib/profile';
import type { ProfileResponseDto } from '../../../shared/types/api';
import type { AccountPresenceState } from '../../realtime/model/realtimeStore';
import { getAccountActivityLabel, getAccountAvatarUrl, UserAvatar } from '../../messenger/lib/messengerCore';

export function MiniProfileModal({
  profile,
  isCurrentAccount,
  lastActivityAt,
  presence,
  localAvatarDataUrl,
  onClose,
  onMessage,
}: {
  profile: ProfileResponseDto | null;
  isCurrentAccount: boolean;
  lastActivityAt: string | null | undefined;
  presence: AccountPresenceState | null | undefined;
  localAvatarDataUrl: string | null;
  onClose: () => void;
  onMessage: (profile: ProfileResponseDto) => Promise<void>;
}) {
  const [isOpeningChat, setIsOpeningChat] = useState(false);

  if (!profile) {
    return null;
  }

  const activeProfile = profile;
  const displayName = getDisplayName(activeProfile);
  const avatarUrl = getAccountAvatarUrl(activeProfile, isCurrentAccount ? localAvatarDataUrl : null);

  async function handleMessageClick() {
    setIsOpeningChat(true);

    try {
      await onMessage(activeProfile);
      onClose();
    }
    finally {
      setIsOpeningChat(false);
    }
  }

  return (
    <div className="absolute inset-0 z-[60] flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md overflow-hidden rounded-[2rem] border border-white/10 bg-[#18191d] shadow-2xl shadow-black/60">
        <div className="relative bg-gradient-to-br from-violet-500/25 via-fuchsia-500/10 to-transparent p-6">
          <button
            onClick={onClose}
            className="absolute right-4 top-4 rounded-2xl border border-white/10 bg-black/15 p-2 text-zinc-300 transition hover:text-white"
            title="Закрыть"
          >
            <X size={18} />
          </button>
          <div className="flex items-center gap-4">
            <UserAvatar label={displayName} imageUrl={avatarUrl} size="lg" />
            <div className="min-w-0 pr-10">
              <div className="truncate text-xl font-semibold text-zinc-50">{displayName}</div>
              <div className="mt-1 text-sm text-zinc-400">{getAccountActivityLabel(presence, lastActivityAt)}</div>
            </div>
          </div>
        </div>

        <div className="space-y-3 p-5">
          <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-4">
            <div className="flex items-center gap-3 text-sm text-zinc-300">
              <User size={16} className="text-violet-200" />
              <span>@{profile.username}</span>
            </div>
            <div className="mt-3 flex items-center gap-3 text-sm text-zinc-300">
              <Mail size={16} className="text-violet-200" />
              <span className="truncate">{profile.email}</span>
            </div>
            <div className="mt-3 flex items-center gap-3 text-sm text-zinc-300">
              <Clock3 size={16} className="text-violet-200" />
              <span>{getAccountActivityLabel(presence, lastActivityAt)}</span>
            </div>
          </div>

          {!isCurrentAccount && (
            <button
              onClick={() => void handleMessageClick()}
              disabled={isOpeningChat}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-violet-500 to-fuchsia-500 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-violet-950/30 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isOpeningChat ? <LoaderCircle size={17} className="animate-spin" /> : <MessageSquare size={17} />}
              Написать
            </button>
          )}
        </div>
      </div>
    </div>
  );
}


