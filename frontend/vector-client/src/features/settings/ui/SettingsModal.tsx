import { useEffect, useState } from 'react';
import { LogOut, Monitor, RefreshCw, Settings, ShieldCheck, LockKeyhole, X } from 'lucide-react';
import { updateCurrentProfileAvatar } from '../../directory/api/profilesApi';
import { getActiveAccountDevices } from '../../devices/api/devicesApi';
import type { ActiveDeviceResponseDto, ProfileResponseDto } from '../../../shared/types/api';
import { getDisplayName } from '../../../shared/lib/profile';
import { createLocalAvatarDataUrl, getAccountAvatarUrl, getLocalAvatarStorageKey, UserAvatar } from '../../messenger/lib/messengerCore';

type SettingsTab = 'profile' | 'devices' | 'security';

function formatDeviceTime(value: string | null | undefined): string {
  if (!value) {
    return 'нет данных';
  }

  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}


function formatDevicePlatformLabel(platform: string | null | undefined): string {
  if (!platform) {
    return 'Неизвестная система';
  }

  const normalizedPlatform = platform.toUpperCase();

  if (normalizedPlatform === 'WINDOWS') {
    return 'Windows';
  }

  if (normalizedPlatform === 'MACOS') {
    return 'macOS';
  }

  if (normalizedPlatform === 'LINUX') {
    return 'Linux';
  }

  return platform;
}

function formatDeviceSystemLabel(device: ActiveDeviceResponseDto): string {
  const platformLabel = formatDevicePlatformLabel(device.platform);
  const details = [device.osName, device.osVersion, device.architecture]
    .filter(Boolean)
    .join(' • ');

  return details ? `${platformLabel} • ${details}` : platformLabel;
}

function formatConnectionStatusLabel(status: string): string {
  if (status === 'connected') {
    return 'Подключено';
  }

  if (status === 'connecting') {
    return 'Подключение…';
  }

  return 'Нет соединения';
}

function formatCryptoStatusLabel(status: string): string {
  if (status === 'ready') {
    return 'Активно';
  }

  if (status === 'locked') {
    return 'Требуется пароль';
  }

  if (status === 'error') {
    return 'Ошибка';
  }

  return 'Настройка…';
}

function CryptoStatusBadge({ status }: { status: string }) {
  const isReady = status === 'ready';
  const isError = status === 'error';

  return (
    <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs ${
      isReady
        ? 'border-emerald-300/20 bg-emerald-400/10 text-emerald-200'
        : isError
          ? 'border-red-300/20 bg-red-400/10 text-red-200'
          : 'border-amber-300/20 bg-amber-400/10 text-amber-200'
    }`}
    >
      <ShieldCheck size={13} />
      {isReady ? 'Сквозное шифрование активно' : isError ? 'Ошибка ключей' : 'Настройка шифрования'}
    </span>
  );
}

export function SettingsModal({
  isOpen,
  profile,
  deviceId,
  cryptoStatus,
  realtimeStatus,
  onClose,
  onLogout,
  onProfileUpdated,
}: {
  isOpen: boolean;
  profile: ProfileResponseDto | null;
  deviceId: string | null;
  cryptoStatus: string;
  realtimeStatus: string;
  onClose: () => void;
  onLogout: () => Promise<void>;
  onProfileUpdated: (profile: ProfileResponseDto) => void;
}) {
  const [activeTab, setActiveTab] = useState<SettingsTab>('profile');
  const [devices, setDevices] = useState<ActiveDeviceResponseDto[]>([]);
  const [isLoadingDevices, setIsLoadingDevices] = useState(false);
  const [devicesError, setDevicesError] = useState<string | null>(null);
  const [localAvatarDataUrl, setLocalAvatarDataUrl] = useState<string | null>(() => profile?.avatarDataUrl ?? localStorage.getItem(getLocalAvatarStorageKey(profile?.accountId)));
  const [avatarError, setAvatarError] = useState<string | null>(null);

  async function handleLocalAvatarSelected(file: File | null | undefined) {
    if (!file || !profile?.accountId) {
      return;
    }

    if (!file.type.startsWith('image/')) {
      setAvatarError('Выберите изображение для аватарки.');
      return;
    }

    setAvatarError(null);

    try {
      const dataUrl = await createLocalAvatarDataUrl(file);
      const updatedProfile = await updateCurrentProfileAvatar({ avatarDataUrl: dataUrl });
      localStorage.setItem(getLocalAvatarStorageKey(profile.accountId), dataUrl);
      setLocalAvatarDataUrl(dataUrl);
      onProfileUpdated(updatedProfile);
    }
    catch (error) {
      console.error(error);
      setAvatarError('Не удалось сохранить аватарку.');
    }
  }

  async function loadDevices() {
    if (!profile?.accountId) {
      return;
    }

    setIsLoadingDevices(true);
    setDevicesError(null);

    try {
      const loadedDevices = await getActiveAccountDevices(profile.accountId);
      setDevices(loadedDevices);
    }
    catch (error) {
      console.error(error);
      setDevicesError('Не удалось загрузить список устройств.');
    }
    finally {
      setIsLoadingDevices(false);
    }
  }

  useEffect(() => {
    setLocalAvatarDataUrl(profile?.avatarDataUrl ?? localStorage.getItem(getLocalAvatarStorageKey(profile?.accountId)));
  }, [profile?.accountId]);

  useEffect(() => {
    if (isOpen && activeTab === 'devices') {
      void loadDevices();
    }
  }, [activeTab, isOpen, profile?.accountId]);

  if (!isOpen || !profile) {
    return null;
  }

  const displayName = getDisplayName(profile);

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm">
      <div className="flex h-[720px] w-full max-w-5xl overflow-hidden rounded-[2rem] border border-white/10 bg-[#15161a] shadow-2xl shadow-black/60">
        <aside className="w-[300px] shrink-0 border-r border-white/10 bg-white/[0.025] p-5">
          <div className="flex items-center gap-4 rounded-[1.75rem] border border-white/10 bg-white/[0.04] p-4">
            <UserAvatar label={displayName} imageUrl={getAccountAvatarUrl(profile, localAvatarDataUrl)} size="lg" />
            <div className="min-w-0">
              <div className="truncate text-base font-semibold text-zinc-50">{displayName}</div>
              <div className="mt-1 truncate text-xs text-zinc-500">@{profile.username}</div>
            </div>
          </div>

          <div className="mt-5 space-y-2">
            {[
              { id: 'profile' as const, label: 'Профиль', icon: Settings },
              { id: 'devices' as const, label: 'Устройства', icon: Monitor },
              { id: 'security' as const, label: 'Безопасность', icon: LockKeyhole },
            ].map((item) => {
              const Icon = item.icon;

              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm transition ${
                    activeTab === item.id
                      ? 'bg-gradient-to-r from-violet-500/25 to-fuchsia-500/10 text-zinc-50 ring-1 ring-violet-300/20'
                      : 'text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-100'
                  }`}
                >
                  <Icon size={17} />
                  {item.label}
                </button>
              );
            })}
          </div>

          <div className="mt-auto pt-5">
            <button
              onClick={() => void onLogout()}
              className="mt-8 flex w-full items-center justify-center gap-2 rounded-2xl border border-red-300/15 bg-red-500/10 px-4 py-3 text-sm font-medium text-red-200 transition hover:bg-red-500/15"
            >
              <LogOut size={16} />
              Выйти
            </button>
          </div>
        </aside>

        <section className="flex min-w-0 flex-1 flex-col">
          <header className="flex h-20 items-center justify-between border-b border-white/10 px-7">
            <div>
              <div className="text-xl font-semibold text-zinc-50">
                {activeTab === 'profile' ? 'Настройки профиля' : activeTab === 'devices' ? 'Активные устройства' : 'Безопасность и шифрование'}
              </div>
              <div className="mt-1 text-sm text-zinc-500">Настройки аккаунта</div>
            </div>
            <button
              onClick={onClose}
              className="rounded-2xl border border-white/10 bg-white/[0.04] p-2 text-zinc-400 transition hover:text-zinc-100"
              title="Закрыть"
            >
              <X size={18} />
            </button>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto p-7">
            {activeTab === 'profile' && (
              <div className="grid gap-5 lg:grid-cols-[220px_1fr]">
                <div className="rounded-[2rem] border border-white/10 bg-white/[0.035] p-6 text-center">
                  <div className="mx-auto mb-4 w-max">
                    <UserAvatar label={displayName} imageUrl={getAccountAvatarUrl(profile, localAvatarDataUrl)} size="lg" />
                  </div>
                  <div className="text-lg font-semibold text-zinc-50">{displayName}</div>
                  <div className="mt-1 text-sm text-zinc-500">@{profile.username}</div>
                  <label className="mt-5 inline-flex cursor-pointer items-center justify-center rounded-2xl border border-violet-300/20 bg-violet-500/10 px-4 py-2 text-sm text-violet-100 transition hover:bg-violet-500/15">
                    Сменить аватар
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(event) => {
                        const file = event.target.files?.[0] ?? null;
                        event.target.value = '';
                        void handleLocalAvatarSelected(file);
                      }}
                    />
                  </label>
                  {avatarError && <div className="mt-3 rounded-2xl border border-red-400/20 bg-red-500/10 p-3 text-xs text-red-200">{avatarError}</div>}
                </div>

                <div className="space-y-3 rounded-[2rem] border border-white/10 bg-white/[0.035] p-6">
                  {[
                    ['Email', profile.email],
                    ['Имя', profile.firstName],
                    ['Фамилия', profile.lastName],
                    ['Статус аккаунта', profile.status === 'ACTIVE' ? 'Активен' : profile.status ?? 'Активен'],
                  ].map(([label, value]) => (
                    <div key={label} className="flex items-center justify-between gap-4 border-b border-white/5 py-3 last:border-b-0">
                      <span className="text-sm text-zinc-500">{label}</span>
                      <span className="max-w-[420px] truncate text-right text-sm text-zinc-200">{value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'devices' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-4 rounded-[2rem] border border-white/10 bg-white/[0.035] p-5">
                  <div>
                    <div className="text-base font-semibold text-zinc-50">Устройства аккаунта</div>
                    <div className="mt-1 text-sm text-zinc-500">Здесь показаны устройства, на которых выполнен вход.</div>
                  </div>
                  <button
                    onClick={() => void loadDevices()}
                    className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-zinc-300 transition hover:border-violet-300/25 hover:text-zinc-50"
                  >
                    <RefreshCw size={15} className={isLoadingDevices ? 'animate-spin' : ''} />
                    Обновить
                  </button>
                </div>

                {devicesError && (
                  <div className="rounded-2xl border border-red-400/20 bg-red-500/10 p-4 text-sm text-red-200">{devicesError}</div>
                )}

                <div className="space-y-3">
                  {isLoadingDevices && devices.length === 0 && (
                    <div className="rounded-[2rem] border border-white/10 bg-white/[0.025] p-8 text-center text-sm text-zinc-500">Загружаем устройства...</div>
                  )}

                  {!isLoadingDevices && devices.length === 0 && (
                    <div className="rounded-[2rem] border border-dashed border-white/10 bg-white/[0.025] p-8 text-center text-sm text-zinc-500">Устройства не найдены.</div>
                  )}

                  {devices.map((device) => {
                    const activeDeviceId = device.deviceId;
                    const isCurrentDevice = activeDeviceId === deviceId;

                    return (
                      <div key={activeDeviceId} className="rounded-[1.75rem] border border-white/10 bg-white/[0.035] p-5">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex min-w-0 items-center gap-4">
                            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white shadow-lg shadow-violet-950/30">
                              <Monitor size={19} />
                            </div>
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-semibold text-zinc-50">{device.deviceName}</span>
                                {isCurrentDevice && (
                                  <span className="rounded-full border border-emerald-300/20 bg-emerald-400/10 px-2 py-0.5 text-[11px] text-emerald-200">это устройство</span>
                                )}
                              </div>
                              <div className="mt-1 text-xs text-zinc-500">{formatDeviceSystemLabel(device)}</div>
                            </div>
                          </div>
                        </div>

                        <div className="mt-4 grid gap-3 text-xs text-zinc-500 sm:grid-cols-2">
                          <div className="rounded-2xl bg-black/15 p-3">Последняя активность: <span className="text-zinc-300">{formatDeviceTime(device.lastSeenAt)}</span></div>
                          <div className="rounded-2xl bg-black/15 p-3">Устройство: <span className="text-zinc-300">{isCurrentDevice ? 'текущее' : 'другое'}</span></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {activeTab === 'security' && (
              <div className="space-y-4">
                <div className="rounded-[2rem] border border-white/10 bg-white/[0.035] p-6">
                  <div className="flex items-center gap-3 text-base font-semibold text-zinc-50">
                    <ShieldCheck size={18} />
                    Сквозное шифрование
                  </div>
                  
                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl border border-white/10 bg-black/10 p-4">
                      <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">Статус шифрования</div>
                      <div className="mt-2 text-sm text-zinc-200">{formatCryptoStatusLabel(cryptoStatus)}</div>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-black/10 p-4">
                      <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">Соединение</div>
                      <div className="mt-2 text-sm text-zinc-200">{formatConnectionStatusLabel(realtimeStatus)}</div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
