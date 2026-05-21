import { useEffect, useMemo, useState } from 'react';
import { LoaderCircle, Search, Settings, User, UserMinus, UserPlus, X } from 'lucide-react';
import { searchProfiles } from '../../../directory/api/profilesApi';
import { useDirectoryStore } from '../../../directory/model/directoryStore';
import { formatMessageTime } from '../../../../shared/lib/dateFormat';
import { getAccountDisplayName, getAccountUsernameLabel, getDisplayName } from '../../../../shared/lib/profile';
import type { AccountPresenceState } from '../../../realtime/model/realtimeStore';
import type { ChatResponseDto, ProfileResponseDto } from '../../../../shared/types/api';
import { Avatar, createLocalAvatarDataUrl, getAccountActivityLabel, getAccountAvatarUrl, getActiveGroupParticipants, type GroupHistoryAccessMode, UserAvatar } from '../../lib/messengerCore';

export function GroupManagementModal({
  isOpen,
  chat,
  currentAccountId,
  profilesById,
  presenceByAccountId,
  lastActivityByAccountId,
  onClose,
  onAddParticipant,
  onRemoveParticipant,
  onUpdateGroupAvatar,
  onOpenProfile,
}: {
  isOpen: boolean;
  chat: ChatResponseDto | null;
  currentAccountId: string | undefined;
  profilesById: Record<string, ProfileResponseDto>;
  presenceByAccountId: Record<string, AccountPresenceState>;
  lastActivityByAccountId: Record<string, string>;
  onClose: () => void;
  onAddParticipant: (profile: ProfileResponseDto, historyAccessMode: GroupHistoryAccessMode) => Promise<void>;
  onRemoveParticipant: (participantAccountId: string) => Promise<void>;
  onUpdateGroupAvatar: (chatId: string, file: File | null) => Promise<void>;
  onOpenProfile: (accountId: string) => void;
}) {
  const upsertProfiles = useDirectoryStore((state) => state.upsertProfiles);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ProfileResponseDto[]>([]);
  const [historyAccessMode, setHistoryAccessMode] = useState<GroupHistoryAccessMode>('NEW_MESSAGES_ONLY');
  const [isSearching, setIsSearching] = useState(false);
  const [busyAccountId, setBusyAccountId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isAvatarUploading, setIsAvatarUploading] = useState(false);

  const activeParticipantIds = useMemo(() => {
    if (!chat) {
      return new Set<string>();
    }

    const activeParticipants = getActiveGroupParticipants(chat).map((participant) => participant.accountId);
    return new Set(activeParticipants);
  }, [chat]);

  const activeParticipants = useMemo(() => {
    if (!chat) {
      return [];
    }

    return getActiveGroupParticipants(chat);
  }, [chat, currentAccountId]);

  const currentParticipant = activeParticipants.find((participant) => participant.accountId === currentAccountId);
  const canManageMembers = currentParticipant?.role === 'OWNER';

  useEffect(() => {
    if (!isOpen) {
      setQuery('');
      setResults([]);
      setHistoryAccessMode('NEW_MESSAGES_ONLY');
      setIsSearching(false);
      setBusyAccountId(null);
      setErrorMessage(null);
      setIsAvatarUploading(false);
      return;
    }

    const trimmedQuery = query.trim();

    if (trimmedQuery.length < 2) {
      setResults([]);
      setIsSearching(false);
      return;
    }

    const timeoutId = window.setTimeout(async () => {
      setIsSearching(true);
      setErrorMessage(null);

      try {
        const profiles = await searchProfiles(trimmedQuery);
        const filteredProfiles = profiles.filter((profile) => profile.accountId !== currentAccountId && !activeParticipantIds.has(profile.accountId));
        upsertProfiles(filteredProfiles);
        setResults(filteredProfiles);
      }
      catch (error) {
        console.error(error);
        setErrorMessage('Не удалось найти пользователей для группы.');
      }
      finally {
        setIsSearching(false);
      }
    }, 250);

    return () => window.clearTimeout(timeoutId);
  }, [activeParticipantIds, currentAccountId, isOpen, query, upsertProfiles]);

  if (!isOpen || !chat || chat.type !== 'GROUP') {
    return null;
  }

  async function handleAdd(profile: ProfileResponseDto) {
    setBusyAccountId(profile.accountId);
    setErrorMessage(null);

    try {
      await onAddParticipant(profile, historyAccessMode);
      setQuery('');
      setResults([]);
    }
    catch (error) {
      console.error(error);
      setErrorMessage('Не удалось добавить участника.');
    }
    finally {
      setBusyAccountId(null);
    }
  }

  async function handleGroupAvatarSelected(file: File | null) {
    if (!chat || !canManageMembers) {
      return;
    }

    setIsAvatarUploading(true);
    setErrorMessage(null);

    try {
      await onUpdateGroupAvatar(chat.chatId, file);
    }
    catch (error) {
      console.error(error);
      setErrorMessage('Не удалось обновить аватар группы.');
    }
    finally {
      setIsAvatarUploading(false);
    }
  }

  async function handleRemove(accountId: string) {
    setBusyAccountId(accountId);
    setErrorMessage(null);

    try {
      await onRemoveParticipant(accountId);
    }
    catch (error) {
      console.error(error);
      setErrorMessage('Не удалось удалить участника.');
    }
    finally {
      setBusyAccountId(null);
    }
  }

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm">
      <div className="grid max-h-[88vh] w-full max-w-4xl grid-cols-1 overflow-hidden rounded-[2rem] border border-white/10 bg-[#18191d] shadow-2xl shadow-black/50 md:grid-cols-[1fr_1fr]">
        <section className="border-b border-white/10 p-6 md:border-b-0 md:border-r">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-2xl font-semibold text-zinc-50">Участники группы</div>
              <p className="mt-2 text-sm leading-6 text-zinc-500">Управляй составом группы и доступом новых участников к истории.</p>
            </div>
            <button onClick={onClose} className="rounded-2xl border border-white/10 bg-white/[0.04] p-2 text-zinc-400 transition hover:text-white">
              <X size={18} />
            </button>
          </div>

          <div className="mt-6 rounded-3xl border border-white/10 bg-white/[0.03] p-4">
            <div className="flex items-center gap-4">
              <UserAvatar label={chat.name ?? 'Групповой чат'} imageUrl={chat.avatarDataUrl} size="lg" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold text-zinc-200">{chat.name ?? 'Групповой чат'}</div>
                <div className="mt-1 text-xs text-zinc-500">{activeParticipants.length} активных участников • защищённый чат</div>
                {canManageMembers && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <label className="inline-flex cursor-pointer items-center rounded-2xl border border-violet-300/20 bg-violet-500/10 px-3 py-1.5 text-xs text-violet-100 transition hover:bg-violet-500/15">
                      {isAvatarUploading ? 'Загрузка…' : 'Сменить аватар'}
                      <input
                        type="file"
                        accept="image/*"
                        disabled={isAvatarUploading}
                        className="hidden"
                        onChange={(event) => {
                          const file = event.target.files?.[0] ?? null;
                          event.target.value = '';
                          void handleGroupAvatarSelected(file);
                        }}
                      />
                    </label>
                    {chat.avatarDataUrl && (
                      <button
                        type="button"
                        onClick={() => void handleGroupAvatarSelected(null)}
                        disabled={isAvatarUploading}
                        className="rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-zinc-300 transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Убрать
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="mt-5 max-h-[48vh] space-y-3 overflow-y-auto pr-1">
            {activeParticipants.map((participant) => {
              const participantProfile = profilesById[participant.accountId] ?? null;
              const participantName = getAccountDisplayName(participant.accountId, profilesById);
              const participantPresence = presenceByAccountId[participant.accountId];
              const participantActivityLabel = getAccountActivityLabel(participantPresence, lastActivityByAccountId[participant.accountId]);
              const isCurrentUser = participant.accountId === currentAccountId;
              const canRemove = canManageMembers && !isCurrentUser && participant.role !== 'OWNER';

              return (
                <div key={participant.accountId} className="flex items-center gap-3 rounded-3xl border border-white/8 bg-white/[0.03] px-4 py-3 transition hover:bg-white/[0.05]">
                  <button
                    type="button"
                    onClick={() => onOpenProfile(participant.accountId)}
                    className="flex min-w-0 flex-1 items-center gap-3 text-left transition hover:brightness-110"
                  >
                    <div className="relative shrink-0">
                      <UserAvatar label={participantName} imageUrl={getAccountAvatarUrl(participantProfile)} />
                      <span className={`absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-[#1c1d22] ${participantPresence?.isOnline ? 'bg-emerald-400' : 'bg-zinc-600'}`} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold text-zinc-100">{participantName}{isCurrentUser ? ' • это вы' : ''}</div>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                        <span>{getAccountUsernameLabel(participant.accountId, profilesById)}</span>
                        <span>{participantActivityLabel}</span>
                        <span className="rounded-full border border-violet-300/15 bg-violet-400/10 px-2 py-0.5 text-violet-200">{participant.role === 'OWNER' ? 'Владелец' : 'Участник'}</span>
                        {participant.historyVisibleFromCreatedAt && <span>история с {formatMessageTime(participant.historyVisibleFromCreatedAt)}</span>}
                      </div>
                    </div>
                  </button>
                  {canRemove && (
                    <button
                      onClick={() => void handleRemove(participant.accountId)}
                      disabled={busyAccountId === participant.accountId}
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-red-300/15 bg-red-500/10 text-red-200 transition hover:border-red-300/30 hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                      title="Удалить из группы"
                    >
                      {busyAccountId === participant.accountId ? <LoaderCircle size={17} className="animate-spin" /> : <UserMinus size={17} />}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        <section className="p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-3xl bg-violet-500/15 text-violet-200">
              <UserPlus size={20} />
            </div>
            <div>
              <div className="text-lg font-semibold text-zinc-50">Добавить участника</div>
              <div className="text-xs text-zinc-500">Доступ к истории выбирается до добавления.</div>
            </div>
          </div>

          {!canManageMembers && (
            <div className="mt-5 rounded-3xl border border-amber-300/15 bg-amber-500/10 p-4 text-sm leading-6 text-amber-100">
              Добавлять и удалять участников может только владелец группы.
            </div>
          )}

          <div className="mt-5 space-y-3">
            <label className={`block rounded-3xl border p-4 transition ${historyAccessMode === 'NEW_MESSAGES_ONLY' ? 'border-violet-300/30 bg-violet-500/10' : 'border-white/10 bg-white/[0.03]'}`}>
              <div className="flex items-start gap-3">
                <input
                  type="radio"
                  name="group-history-mode"
                  checked={historyAccessMode === 'NEW_MESSAGES_ONLY'}
                  onChange={() => setHistoryAccessMode('NEW_MESSAGES_ONLY')}
                  className="mt-1"
                  disabled={!canManageMembers}
                />
                <div>
                  <div className="text-sm font-semibold text-zinc-100">Только новые сообщения</div>
                  <div className="mt-1 text-xs leading-5 text-zinc-500">Участник увидит только сообщения, которые появятся после добавления.</div>
                </div>
              </div>
            </label>
            <label className={`block rounded-3xl border p-4 transition ${historyAccessMode === 'FULL_HISTORY' ? 'border-violet-300/30 bg-violet-500/10' : 'border-white/10 bg-white/[0.03]'}`}>
              <div className="flex items-start gap-3">
                <input
                  type="radio"
                  name="group-history-mode"
                  checked={historyAccessMode === 'FULL_HISTORY'}
                  onChange={() => setHistoryAccessMode('FULL_HISTORY')}
                  className="mt-1"
                  disabled={!canManageMembers}
                />
                <div>
                  <div className="text-sm font-semibold text-zinc-100">Вся доступная история</div>
                  <div className="mt-1 text-xs leading-5 text-zinc-500">Участник сможет открыть всю доступную историю группы.</div>
                </div>
              </div>
            </label>
          </div>

          <div className="mt-5 rounded-[1.6rem] border border-white/10 bg-white/[0.045] px-4 py-3 shadow-inner shadow-black/15 transition focus-within:border-violet-300/35 focus-within:bg-white/[0.065]">
            <div className="flex items-center gap-3">
              <Search size={18} className="text-zinc-500" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                disabled={!canManageMembers}
                className="w-full bg-transparent text-sm text-zinc-100 outline-none placeholder:text-zinc-600 disabled:cursor-not-allowed"
                placeholder="Найти пользователя по имени, username или email"
              />
              {isSearching && <LoaderCircle size={16} className="animate-spin text-violet-200" />}
            </div>
          </div>

          {errorMessage && <div className="mt-3 rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">{errorMessage}</div>}

          <div className="mt-4 max-h-[28vh] space-y-3 overflow-y-auto pr-1">
            {isSearching && <div className="py-5 text-center text-sm text-zinc-500">Ищем пользователей…</div>}
            {!isSearching && query.trim().length >= 2 && results.length === 0 && <div className="py-5 text-center text-sm text-zinc-500">Новых пользователей не найдено.</div>}
            {results.map((profile) => {
              const displayName = getDisplayName(profile);

              return (
                <div key={profile.accountId} className="flex items-center gap-3 rounded-3xl border border-white/8 bg-white/[0.03] px-4 py-3">
                  <UserAvatar label={displayName} imageUrl={getAccountAvatarUrl(profile)} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold text-zinc-100">{displayName}</div>
                    <div className="mt-1 truncate text-xs text-zinc-500">@{profile.username} • {profile.email}</div>
                  </div>
                  <button
                    onClick={() => void handleAdd(profile)}
                    disabled={!canManageMembers || busyAccountId === profile.accountId}
                    className="rounded-full border border-violet-300/15 bg-violet-400/10 px-3 py-1.5 text-xs text-violet-100 transition hover:border-violet-300/30 hover:bg-violet-400/20 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {busyAccountId === profile.accountId ? 'Добавляем…' : 'Добавить'}
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}


