import { useEffect, useState } from 'react';
import { LoaderCircle, MessageCircle, Search, User, Users, X } from 'lucide-react';
import { searchProfiles } from '../../../directory/api/profilesApi';
import { useDirectoryStore } from '../../../directory/model/directoryStore';
import { getDisplayName } from '../../../../shared/lib/profile';
import type { ChatResponseDto, ProfileResponseDto } from '../../../../shared/types/api';
import { Avatar, getAccountAvatarUrl, UserAvatar } from '../../lib/messengerCore';

export function NewChatModal({
  isOpen,
  currentAccountId,
  onClose,
  onCreateChat,
  onCreateGroupChat,
  blockedAccountIds,
  onOpenProfile,
}: {
  isOpen: boolean;
  currentAccountId: string | undefined;
  onClose: () => void;
  onCreateChat: (profile: ProfileResponseDto) => Promise<void>;
  onCreateGroupChat: (name: string, profiles: ProfileResponseDto[]) => Promise<void>;
  blockedAccountIds: string[];
  onOpenProfile: (profile: ProfileResponseDto) => void;
}) {
  const upsertProfiles = useDirectoryStore((state) => state.upsertProfiles);
  const [query, setQuery] = useState('');
  const [groupName, setGroupName] = useState('');
  const [results, setResults] = useState<ProfileResponseDto[]>([]);
  const [selectedProfiles, setSelectedProfiles] = useState<ProfileResponseDto[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [creatingAccountId, setCreatingAccountId] = useState<string | null>(null);
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setQuery('');
      setGroupName('');
      setResults([]);
      setSelectedProfiles([]);
      setErrorMessage(null);
      setCreatingAccountId(null);
      setIsCreatingGroup(false);
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
        const filteredProfiles = profiles.filter((profile) => profile.accountId !== currentAccountId);
        upsertProfiles(filteredProfiles);
        setResults(filteredProfiles);
      }
      catch (error) {
        console.error(error);
        setErrorMessage('Не удалось выполнить поиск пользователей.');
      }
      finally {
        setIsSearching(false);
      }
    }, 250);

    return () => window.clearTimeout(timeoutId);
  }, [currentAccountId, isOpen, query, upsertProfiles]);

  function toggleSelectedProfile(profile: ProfileResponseDto) {
    setSelectedProfiles((previousProfiles) => {
      if (previousProfiles.some((selectedProfile) => selectedProfile.accountId === profile.accountId)) {
        return previousProfiles.filter((selectedProfile) => selectedProfile.accountId !== profile.accountId);
      }

      return [...previousProfiles, profile];
    });
  }

  async function handleCreateSelectedGroup() {
    const trimmedGroupName = groupName.trim();

    if (selectedProfiles.length === 0 || !trimmedGroupName) {
      setErrorMessage('Для группы нужно название и хотя бы один участник.');
      return;
    }

    setIsCreatingGroup(true);
    setErrorMessage(null);

    try {
      await onCreateGroupChat(trimmedGroupName, selectedProfiles);
    }
    catch (error) {
      console.error(error);
      setErrorMessage('Не удалось создать групповой чат.');
    }
    finally {
      setIsCreatingGroup(false);
    }
  }

  if (!isOpen) {
    return null;
  }

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xl">
      <div className="relative w-full max-w-3xl overflow-hidden rounded-[2rem] border border-white/10 bg-[#171820]/96 shadow-2xl shadow-black/60">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-[radial-gradient(circle_at_16%_0%,rgba(139,92,246,0.28),transparent_24rem),radial-gradient(circle_at_90%_0%,rgba(14,165,233,0.16),transparent_20rem)]" />
        <div className="relative flex items-start justify-between gap-4 border-b border-white/10 px-6 py-5">
          <div>
            <div className="text-2xl font-semibold tracking-tight text-zinc-50">Новый чат</div>
            <div className="mt-1 text-sm text-zinc-400">Найди коллегу для личного диалога или выбери несколько участников для группы.</div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl border border-white/10 bg-white/[0.045] p-2 text-zinc-400 transition hover:border-violet-300/30 hover:bg-white/[0.08] hover:text-zinc-100"
            title="Закрыть"
          >
            <X size={18} />
          </button>
        </div>

        <div className="relative grid gap-5 p-6 md:grid-cols-[1fr_18rem]">
          <div className="min-w-0">
            <div className="mb-4 flex items-center gap-3 rounded-[1.6rem] border border-white/10 bg-[#20212a] px-4 py-3 shadow-inner shadow-black/15 transition focus-within:border-violet-300/35 focus-within:bg-[#242633]">
              <Search size={18} className="text-zinc-500" />
              <input
                autoFocus
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="w-full bg-transparent text-sm text-zinc-100 outline-none placeholder:text-zinc-600"
                placeholder="Поиск по имени, username или email"
              />
              {isSearching && <LoaderCircle size={17} className="animate-spin text-violet-200" />}
            </div>

            <div className="max-h-[31rem] overflow-y-auto pr-1">
              {query.trim().length < 2 && (
                <div className="rounded-[1.75rem] border border-dashed border-white/10 bg-white/[0.025] px-6 py-10 text-center">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-3xl bg-violet-500/12 text-violet-200"><Search size={24} /></div>
                  <div className="mt-4 text-sm font-medium text-zinc-300">Начни вводить имя или логин</div>
                  <div className="mt-1 text-xs text-zinc-500">Достаточно двух символов, чтобы найти сотрудника.</div>
                </div>
              )}

              {!isSearching && query.trim().length >= 2 && results.length === 0 && !errorMessage && (
                <div className="rounded-[1.75rem] border border-white/10 bg-white/[0.03] px-6 py-10 text-center text-sm text-zinc-500">Никого не нашли по этому запросу.</div>
              )}

              {errorMessage && (
                <div className="rounded-[1.75rem] border border-red-400/20 bg-red-500/10 p-4 text-sm text-red-200">{errorMessage}</div>
              )}

              <div className="space-y-2">
                {results.map((profile) => {
                  const displayName = getDisplayName(profile);
                  const isCreating = creatingAccountId === profile.accountId;
                  const isSelected = selectedProfiles.some((selectedProfile) => selectedProfile.accountId === profile.accountId);
                  const isBlocked = blockedAccountIds.includes(profile.accountId);

                  return (
                    <div
                      key={profile.accountId}
                      className="group flex w-full items-center gap-3 rounded-[1.5rem] border border-white/8 bg-white/[0.035] px-3 py-3 text-left transition hover:border-violet-300/25 hover:bg-white/[0.06]"
                    >
                      <button
                        type="button"
                        onClick={() => toggleSelectedProfile(profile)}
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border text-sm font-semibold transition ${isSelected ? 'border-violet-300/35 bg-violet-500/22 text-violet-50' : 'border-white/10 bg-white/[0.045] text-zinc-500 hover:text-zinc-200'}`}
                        title={isSelected ? 'Убрать из группы' : 'Добавить в группу'}
                      >
                        {isSelected ? '✓' : '+'}
                      </button>
                      <button
                        type="button"
                        onClick={() => onOpenProfile(profile)}
                        className="rounded-2xl transition hover:brightness-110"
                        title="Открыть профиль"
                      >
                        <UserAvatar label={displayName} imageUrl={getAccountAvatarUrl(profile)} />
                      </button>

                      <button
                        type="button"
                        onClick={() => onOpenProfile(profile)}
                        className="min-w-0 flex-1 text-left"
                      >
                        <div className="truncate text-sm font-semibold text-zinc-100 transition hover:text-violet-100">{displayName}</div>
                        <div className="mt-1 flex min-w-0 items-center gap-2 text-xs text-zinc-500">
                          <span className="truncate">@{profile.username} · {profile.email}</span>
                          {isBlocked && <span className="shrink-0 rounded-full border border-red-300/15 bg-red-500/10 px-2 py-0.5 text-[10px] text-red-200">заблокирован</span>}
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={async () => {
                          setCreatingAccountId(profile.accountId);
                          setErrorMessage(null);

                          try {
                            await onCreateChat(profile);
                          }
                          catch (error) {
                            console.error(error);
                            setErrorMessage('Не удалось открыть личный чат.');
                          }
                          finally {
                            setCreatingAccountId(null);
                          }
                        }}
                        className="inline-flex items-center gap-2 rounded-2xl border border-violet-300/16 bg-violet-500/10 px-3 py-2 text-xs font-medium text-violet-100 transition hover:border-violet-300/30 hover:bg-violet-500/16"
                      >
                        {isCreating ? <LoaderCircle size={14} className="animate-spin" /> : <MessageCircle size={14} />}
                        Написать
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <aside className="rounded-[1.75rem] border border-white/10 bg-[#151721] p-4">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-violet-200/80">
              <Users size={15} />
              Группа
            </div>
            <input
              value={groupName}
              onChange={(event) => setGroupName(event.target.value)}
              className="mt-4 w-full rounded-2xl border border-white/10 bg-[#20212a] px-4 py-3 text-sm text-zinc-100 outline-none placeholder:text-zinc-600 transition focus:border-violet-300/35 focus:bg-[#242633]"
              placeholder="Название группы"
            />
            <div className="mt-4 min-h-24 rounded-2xl border border-white/8 bg-[#191b24] p-3">
              {selectedProfiles.length === 0 ? (
                <div className="flex h-full min-h-16 items-center justify-center text-center text-xs leading-5 text-zinc-500">Отметь сотрудников плюсом слева — они появятся здесь.</div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {selectedProfiles.map((profile) => (
                    <button
                      type="button"
                      key={profile.accountId}
                      onClick={() => toggleSelectedProfile(profile)}
                      className="inline-flex items-center gap-2 rounded-full border border-violet-300/20 bg-violet-500/12 py-1 pl-1 pr-3 text-xs text-violet-50 transition hover:bg-violet-500/18"
                    >
                      <UserAvatar label={getDisplayName(profile)} imageUrl={getAccountAvatarUrl(profile)} size="sm" />
                      <span className="max-w-32 truncate">{getDisplayName(profile)}</span>
                      <span className="text-violet-200/70">×</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => void handleCreateSelectedGroup()}
              disabled={isCreatingGroup || selectedProfiles.length === 0 || !groupName.trim()}
              className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-violet-500 to-fuchsia-500 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-violet-950/35 transition hover:from-violet-400 hover:to-fuchsia-400 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isCreatingGroup ? <LoaderCircle size={16} className="animate-spin" /> : <Users size={16} />}
              Создать группу
            </button>
          </aside>
        </div>
      </div>
    </div>
  );
}

