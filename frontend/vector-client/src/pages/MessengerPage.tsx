import { KeyboardEvent, useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  CheckCheck,
  LoaderCircle,
  LogOut,
  MessageCircle,
  Paperclip,
  FileText,
  Download,
  Image as ImageIcon,
  Plus,
  Search,
  Send,
  Star,
  Users,
  KeyRound,
  LockKeyhole,
  Monitor,
  RefreshCw,
  Settings,
  ShieldCheck,
  Wifi,
  WifiOff,
  Wrench,
  X,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { createDirectChat, createGroupChat, createSelfChat, getChats } from '../features/chats/api/chatsApi';
import { createDocument, getChatDocuments, registerDocumentSigningKey, rejectDocument, signDocument } from '../features/documents/api/documentsApi';
import { searchProfiles } from '../features/directory/api/profilesApi';
import { getActiveAccountDevices } from '../features/devices/api/devicesApi';
import { useDirectoryStore } from '../features/directory/model/directoryStore';
import { logout as logoutRequest } from '../features/auth/api/authApi';
import { useAuthStore } from '../features/auth/model/authStore';
import { getChatMessages, markChatRead, markMessageDelivered, sendMessage } from '../features/messages/api/messagesApi';
import { downloadEncryptedMediaFile, uploadEncryptedMediaFile } from '../features/media/api/mediaApi';
import { buildDocumentAttachmentContent, buildFileAttachmentContent, decryptDownloadedFile, encryptFileForUpload, formatFileSize, parseDocumentAttachmentMessageContent, parseFileAttachmentMessageContent } from '../features/media/lib/fileCrypto';
import { useMessengerStore } from '../features/messenger/model/messengerStore';
import { useRealtimeConnection } from '../features/realtime/useRealtimeConnection';
import { useRealtimeStore } from '../features/realtime/model/realtimeStore';
import { DevAccountPanel } from '../features/admin/ui/DevAccountPanel';
import { useCryptoBootstrap } from '../features/crypto/useCryptoBootstrap';
import { useCryptoStore } from '../features/crypto/model/cryptoStore';
import { getPreKeyBundle } from '../features/crypto/api/cryptoKeysApi';
import { downloadKeyBackup, getKeyBackupStatus, uploadKeyBackup, type KeyBackupStatusResponseDto } from '../features/crypto/api/keyBackupApi';
import { formatChatTime, formatMessageTime } from '../shared/lib/dateFormat';
import { getAvatarGradient, getInitials } from '../shared/lib/avatar';
import { getDirectCompanionAccountId, getDisplayName } from '../shared/lib/profile';
import type { ActiveDeviceResponseDto, ChatResponseDto, DocumentAttachmentMessageContent, DocumentResponseDto, FileAttachmentMessageContent, MessageResponseDto, ProfileResponseDto } from '../shared/types/api';

function Avatar({ label, size = 'md' }: { label: string; size?: 'sm' | 'md' | 'lg' }) {
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

function ImageAttachmentPreview({
  attachment,
  onDownload,
}: {
  attachment: FileAttachmentMessageContent;
  onDownload: (attachment: FileAttachmentMessageContent) => Promise<void>;
}) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  useEffect(() => {
    let isCancelled = false;
    let objectUrl: string | null = null;

    async function loadPreview() {
      setIsLoadingPreview(true);
      setPreviewError(null);

      try {
        const encryptedBytes = await downloadEncryptedMediaFile(attachment.mediaFileId);
        const decryptedBlob = await decryptDownloadedFile(encryptedBytes, attachment);
        objectUrl = URL.createObjectURL(decryptedBlob);

        if (!isCancelled) {
          setPreviewUrl(objectUrl);
        }
      }
      catch (error) {
        console.error(error);

        if (!isCancelled) {
          setPreviewError('Не удалось загрузить предпросмотр.');
        }
      }
      finally {
        if (!isCancelled) {
          setIsLoadingPreview(false);
        }
      }
    }

    loadPreview();

    return () => {
      isCancelled = true;

      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [attachment]);

  return (
    <div className="min-w-[260px] max-w-[380px] overflow-hidden rounded-3xl border border-white/12 bg-black/15">
      <div className="flex min-h-[180px] items-center justify-center bg-black/20">
        {previewUrl ? (
          <img src={previewUrl} alt={attachment.fileName} className="max-h-[360px] w-full object-cover" />
        ) : (
          <div className="flex flex-col items-center gap-3 px-6 py-10 text-center text-xs text-zinc-400">
            {isLoadingPreview ? <LoaderCircle size={22} className="animate-spin" /> : <ImageIcon size={24} />}
            <span>{previewError ?? 'Загружаем защищённый предпросмотр...'}</span>
          </div>
        )}
      </div>
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold">{attachment.fileName}</div>
          <div className="mt-1 text-xs opacity-70">{formatFileSize(attachment.sizeBytes)} • encrypted image</div>
        </div>
        <button
          onClick={() => void onDownload(attachment)}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10 transition hover:bg-white/20"
          title="Скачать и расшифровать"
        >
          <Download size={17} />
        </button>
      </div>
    </div>
  );
}


function DocumentAttachmentPreview({
  attachment,
  isOwnMessage,
  onDownload,
}: {
  attachment: DocumentAttachmentMessageContent;
  isOwnMessage: boolean;
  onDownload: (attachment: DocumentAttachmentMessageContent) => Promise<void>;
}) {
  return (
    <div className="min-w-[280px] max-w-[380px]">
      <div className={`flex items-center gap-3 rounded-2xl border p-3 ${isOwnMessage ? 'border-white/20 bg-white/10' : 'border-white/10 bg-black/15'}`}>
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-black/20 text-white">
          <ShieldCheck size={20} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold">{attachment.fileName}</div>
          <div className={`mt-1 text-xs ${isOwnMessage ? 'text-violet-100/75' : 'text-zinc-500'}`}>
            {formatFileSize(attachment.sizeBytes)} • encrypted document
          </div>
        </div>
        <button
          onClick={() => void onDownload(attachment)}
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition ${isOwnMessage ? 'bg-white/15 hover:bg-white/25' : 'bg-white/[0.06] hover:bg-white/[0.1]'}`}
          title="Скачать и расшифровать"
        >
          <Download size={17} />
        </button>
      </div>
    </div>
  );
}

function DocumentsPanel({
  isOpen,
  documents,
  isLoading,
  activeAccountId,
  onClose,
  onRefresh,
  onDownload,
  onSign,
  onReject,
}: {
  isOpen: boolean;
  documents: DocumentResponseDto[];
  isLoading: boolean;
  activeAccountId: string | undefined;
  onClose: () => void;
  onRefresh: () => Promise<void>;
  onDownload: (document: DocumentResponseDto) => Promise<void>;
  onSign: (document: DocumentResponseDto) => Promise<void>;
  onReject: (document: DocumentResponseDto) => Promise<void>;
}) {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm">
      <div className="flex max-h-[82vh] w-full max-w-3xl flex-col rounded-[2rem] border border-white/10 bg-[#18191d] shadow-2xl shadow-black/50">
        <div className="flex items-center justify-between gap-4 border-b border-white/10 p-6">
          <div>
            <div className="text-xl font-semibold text-zinc-50">Документооборот</div>
            <div className="mt-1 text-sm text-zinc-500">Зашифрованные документы выбранного чата и цифровые подписи.</div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => void onRefresh()}
              className="rounded-2xl border border-white/10 bg-white/[0.04] p-2 text-zinc-400 transition hover:text-zinc-100"
              title="Обновить"
            >
              <RefreshCw size={18} />
            </button>
            <button
              onClick={onClose}
              className="rounded-2xl border border-white/10 bg-white/[0.04] p-2 text-zinc-400 transition hover:text-zinc-100"
              title="Закрыть"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {isLoading ? (
            <div className="flex items-center justify-center gap-3 rounded-[1.7rem] border border-white/10 bg-white/[0.03] p-8 text-sm text-zinc-400">
              <LoaderCircle size={18} className="animate-spin" />
              Загружаем документы…
            </div>
          ) : documents.length === 0 ? (
            <div className="rounded-[1.7rem] border border-dashed border-white/10 bg-white/[0.02] p-8 text-center text-sm text-zinc-500">
              В этом чате пока нет документов. Прикрепи файл как документ через скрепку.
            </div>
          ) : (
            <div className="space-y-3">
              {documents.map((documentItem) => {
                const signedByCurrentAccount = documentItem.signatures.some((signature) => signature.signerAccountId === activeAccountId);
                const isRejected = documentItem.status === 'REJECTED';

                return (
                  <div key={documentItem.documentId} className="rounded-[1.5rem] border border-white/10 bg-white/[0.035] p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-zinc-100">{documentItem.fileName}</div>
                        <div className="mt-1 text-xs text-zinc-500">
                          {formatFileSize(documentItem.sizeBytes)} • {documentItem.mimeType} • подписей: {documentItem.signatures.length}
                        </div>
                        <div className="mt-2 text-xs text-zinc-600">SHA-256: {documentItem.plaintextSha256Base64.slice(0, 18)}…</div>
                      </div>
                      <div className={`shrink-0 rounded-full px-3 py-1 text-xs ${isRejected ? 'bg-red-500/15 text-red-200' : 'bg-emerald-500/15 text-emerald-200'}`}>
                        {isRejected ? 'Отклонён' : 'Активен'}
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        onClick={() => void onDownload(documentItem)}
                        className="rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-2 text-xs text-zinc-200 transition hover:bg-white/[0.08]"
                      >
                        Скачать
                      </button>
                      <button
                        onClick={() => void onSign(documentItem)}
                        disabled={isRejected || signedByCurrentAccount}
                        className="rounded-2xl border border-emerald-300/20 bg-emerald-500/10 px-4 py-2 text-xs text-emerald-100 transition hover:bg-emerald-500/15 disabled:cursor-not-allowed disabled:opacity-45"
                      >
                        {signedByCurrentAccount ? 'Подписано' : 'Подписать'}
                      </button>
                      <button
                        onClick={() => void onReject(documentItem)}
                        disabled={isRejected}
                        className="rounded-2xl border border-red-300/20 bg-red-500/10 px-4 py-2 text-xs text-red-100 transition hover:bg-red-500/15 disabled:cursor-not-allowed disabled:opacity-45"
                      >
                        Отклонить
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

type ChatPresentation = {
  title: string;
  subtitle: string;
  avatarLabel: string;
  companionProfile: ProfileResponseDto | null;
};

function getChatPresentation(
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
    const activeParticipantsCount = chat.participantAccountIds.length;

    return {
      title: chat.name ?? 'Групповой чат',
      subtitle: `${activeParticipantsCount} участников • group E2EE`,
      avatarLabel: chat.name ?? 'Группа',
      companionProfile: null,
    };
  }

  const companionAccountId = getDirectCompanionAccountId(chat, currentProfile?.accountId);
  const companionProfile = companionAccountId ? profilesById[companionAccountId] ?? null : null;

  if (companionProfile) {
    return {
      title: getDisplayName(companionProfile),
      subtitle: `@${companionProfile.username}`,
      avatarLabel: getDisplayName(companionProfile),
      companionProfile,
    };
  }

  const shortId = companionAccountId ? `${companionAccountId.slice(0, 8)}…` : 'неизвестный контакт';
  return {
    title: 'Новый диалог',
    subtitle: shortId,
    avatarLabel: shortId,
    companionProfile: null,
  };
}

function getOutgoingMessageStatus(message: MessageResponseDto, currentAccountId: string | undefined): 'SENT' | 'DELIVERED' | 'READ' {
  const relevantStates = message.deliveryStates.filter((deliveryState) => deliveryState.accountId !== currentAccountId);

  if (relevantStates.some((deliveryState) => deliveryState.status === 'READ')) {
    return 'READ';
  }

  if (relevantStates.some((deliveryState) => deliveryState.status === 'DELIVERED')) {
    return 'DELIVERED';
  }

  return 'SENT';
}

function NewChatModal({
  isOpen,
  currentAccountId,
  onClose,
  onCreateChat,
  onCreateGroupChat,
}: {
  isOpen: boolean;
  currentAccountId: string | undefined;
  onClose: () => void;
  onCreateChat: (profile: ProfileResponseDto) => Promise<void>;
  onCreateGroupChat: (name: string, profiles: ProfileResponseDto[]) => Promise<void>;
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
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm">
      <div className="w-full max-w-xl rounded-[2rem] border border-white/10 bg-[#18191d] p-6 shadow-2xl shadow-black/50">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <div className="text-2xl font-semibold text-zinc-50">Новый чат</div>
            <div className="mt-2 text-sm text-zinc-500">
              Найди сотрудников для direct-чата или собери группу.
            </div>
          </div>

          <button
            onClick={onClose}
            className="rounded-2xl border border-white/10 bg-white/[0.04] p-2 text-zinc-400 transition hover:border-violet-300/30 hover:text-zinc-100"
            title="Закрыть"
          >
            <X size={18} />
          </button>
        </div>

        <div className="mb-4 rounded-3xl border border-white/10 bg-white/[0.035] p-3">
          <div className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.2em] text-zinc-500">
            <Users size={15} />
            Группа
          </div>
          <input
            value={groupName}
            onChange={(event) => setGroupName(event.target.value)}
            className="mb-3 w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-violet-300/35"
            placeholder="Название группы"
          />
          <div className="mb-3 flex flex-wrap gap-2">
            {selectedProfiles.length === 0 ? (
              <span className="text-xs text-zinc-500">Выбери участников ниже.</span>
            ) : selectedProfiles.map((profile) => (
              <button
                key={profile.accountId}
                onClick={() => toggleSelectedProfile(profile)}
                className="rounded-full border border-violet-300/20 bg-violet-500/10 px-3 py-1 text-xs text-violet-100"
              >
                {getDisplayName(profile)} ×
              </button>
            ))}
          </div>
          <button
            onClick={() => void handleCreateSelectedGroup()}
            disabled={isCreatingGroup || selectedProfiles.length === 0 || !groupName.trim()}
            className="inline-flex items-center gap-2 rounded-2xl border border-violet-300/20 bg-violet-500/10 px-4 py-2 text-sm font-medium text-violet-100 transition hover:bg-violet-500/15 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isCreatingGroup ? <LoaderCircle size={15} className="animate-spin" /> : <Users size={15} />}
            Создать группу
          </button>
        </div>

        <div className="mb-5 flex items-center gap-3 rounded-3xl border border-white/10 bg-white/[0.04] px-4 py-3 text-zinc-500">
          <Search size={17} />
          <input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="w-full bg-transparent text-sm text-zinc-200 outline-none placeholder:text-zinc-600"
            placeholder="Например: admin, ivan, ivan@company.local"
          />
        </div>

        <div className="max-h-[420px] overflow-y-auto">
          {query.trim().length < 2 && (
            <div className="rounded-3xl border border-dashed border-white/10 bg-white/[0.025] p-8 text-center text-sm text-zinc-500">
              Введи минимум 2 символа для поиска.
            </div>
          )}

          {isSearching && (
            <div className="flex items-center justify-center gap-3 rounded-3xl border border-white/10 bg-white/[0.03] p-8 text-sm text-zinc-400">
              <LoaderCircle size={18} className="animate-spin" />
              Ищем пользователей...
            </div>
          )}

          {!isSearching && query.trim().length >= 2 && results.length === 0 && !errorMessage && (
            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-8 text-center text-sm text-zinc-500">
              По запросу ничего не найдено.
            </div>
          )}

          {errorMessage && (
            <div className="rounded-3xl border border-red-400/20 bg-red-500/10 p-4 text-sm text-red-200">
              {errorMessage}
            </div>
          )}

          <div className="space-y-2">
            {results.map((profile) => {
              const displayName = getDisplayName(profile);
              const isCreating = creatingAccountId === profile.accountId;
              const isSelected = selectedProfiles.some((selectedProfile) => selectedProfile.accountId === profile.accountId);

              return (
                <div
                  key={profile.accountId}
                  className="flex w-full items-center gap-3 rounded-3xl border border-white/8 bg-white/[0.03] px-4 py-3 text-left transition hover:border-violet-300/25 hover:bg-white/[0.05]"
                >
                  <button
                    onClick={() => toggleSelectedProfile(profile)}
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border text-xs transition ${isSelected ? 'border-violet-300/30 bg-violet-500/20 text-violet-100' : 'border-white/10 bg-white/[0.04] text-zinc-500'}`}
                    title="Выбрать для группы"
                  >
                    {isSelected ? '✓' : '+'}
                  </button>
                  <Avatar label={displayName} />

                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold text-zinc-100">{displayName}</div>
                    <div className="mt-1 truncate text-xs text-zinc-500">@{profile.username} • {profile.email}</div>
                  </div>

                  <button
                    onClick={async () => {
                      setCreatingAccountId(profile.accountId);
                      setErrorMessage(null);

                      try {
                        await onCreateChat(profile);
                      }
                      catch (error) {
                        console.error(error);
                        setErrorMessage('Не удалось создать direct chat.');
                      }
                      finally {
                        setCreatingAccountId(null);
                      }
                    }}
                    className="rounded-full border border-violet-300/15 bg-violet-400/10 px-3 py-1 text-xs text-violet-200"
                  >
                    {isCreating ? 'Создаём…' : 'Direct'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}


type SettingsTab = 'profile' | 'devices' | 'security';

function isDecryptionPlaceholder(value: string | undefined): boolean {
  if (!value) {
    return false;
  }

  return value === '[Не удалось расшифровать сообщение]' || value === '[Сообщение недоступно для этого устройства]';
}

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
      {isReady ? 'E2EE активно' : isError ? 'Ошибка ключей' : 'Настройка E2EE'}
    </span>
  );
}

function SettingsModal({
  isOpen,
  profile,
  deviceId,
  cryptoStatus,
  cryptoDatabasePath,
  realtimeStatus,
  onClose,
  onLogout,
  onBackupRestored,
}: {
  isOpen: boolean;
  profile: ProfileResponseDto | null;
  deviceId: string | null;
  cryptoStatus: string;
  cryptoDatabasePath: string | null;
  realtimeStatus: string;
  onClose: () => void;
  onLogout: () => Promise<void>;
  onBackupRestored: () => Promise<void>;
}) {
  const [activeTab, setActiveTab] = useState<SettingsTab>('profile');
  const [devices, setDevices] = useState<ActiveDeviceResponseDto[]>([]);
  const [isLoadingDevices, setIsLoadingDevices] = useState(false);
  const [devicesError, setDevicesError] = useState<string | null>(null);
  const [backupStatus, setBackupStatus] = useState<KeyBackupStatusResponseDto | null>(null);
  const [backupPassword, setBackupPassword] = useState('');
  const [backupError, setBackupError] = useState<string | null>(null);
  const [backupSuccess, setBackupSuccess] = useState<string | null>(null);
  const [isBackupBusy, setIsBackupBusy] = useState(false);

  async function loadBackupStatus() {
    try {
      const loadedBackupStatus = await getKeyBackupStatus();
      setBackupStatus(loadedBackupStatus);
    }
    catch (error) {
      console.error(error);
      setBackupError('Не удалось загрузить статус резервной копии.');
    }
  }

  async function handleCreateKeyBackup() {
    if (!profile?.accountId || !window.vectorCrypto) {
      setBackupError('Локальная криптография недоступна.');
      return;
    }

    setIsBackupBusy(true);
    setBackupError(null);
    setBackupSuccess(null);

    try {
      const encryptedBackup = await window.vectorCrypto.exportEncryptedKeyBackup({
        accountId: profile.accountId,
        recoveryPassword: backupPassword,
      });

      await uploadKeyBackup({
        backupVersion: encryptedBackup.backupVersion,
        kdfAlgorithm: encryptedBackup.kdfAlgorithm,
        kdfSaltBase64: encryptedBackup.kdfSaltBase64,
        kdfParametersJson: encryptedBackup.kdfParametersJson,
        encryptionAlgorithm: encryptedBackup.encryptionAlgorithm,
        initializationVectorBase64: encryptedBackup.initializationVectorBase64,
        authenticationTagBase64: encryptedBackup.authenticationTagBase64,
        encryptedBackupBlobBase64: encryptedBackup.encryptedBackupBlobBase64,
      });

      setBackupPassword('');
      setBackupSuccess(`Резервная копия ключей обновлена. Устройств в backup: ${encryptedBackup.exportedDeviceIds.length}.`);
      await loadBackupStatus();
    }
    catch (error) {
      console.error(error);
      setBackupError('Не удалось создать резервную копию. Проверь пароль восстановления и локальный vault.');
    }
    finally {
      setIsBackupBusy(false);
    }
  }

  async function handleRestoreKeyBackup() {
    if (!profile?.accountId || !window.vectorCrypto) {
      setBackupError('Локальная криптография недоступна.');
      return;
    }

    setIsBackupBusy(true);
    setBackupError(null);
    setBackupSuccess(null);

    try {
      const encryptedBackup = await downloadKeyBackup();
      const restoreResult = await window.vectorCrypto.importEncryptedKeyBackup({
        accountId: profile.accountId,
        recoveryPassword: backupPassword,
        backup: encryptedBackup,
      });

      setBackupPassword('');
      setBackupSuccess(`Ключи восстановлены. Доступных device-контекстов: ${restoreResult.importedDeviceIds.length}.`);
      await onBackupRestored();
      await loadBackupStatus();
    }
    catch (error) {
      console.error(error);
      setBackupError('Не удалось восстановить ключи. Возможно, пароль восстановления неверный.');
    }
    finally {
      setIsBackupBusy(false);
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
    if (isOpen && activeTab === 'devices') {
      void loadDevices();
    }

    if (isOpen && activeTab === 'security') {
      void loadBackupStatus();
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
            <Avatar label={displayName} size="lg" />
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
              <div className="mt-1 text-sm text-zinc-500">Vector desktop client</div>
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
                    <Avatar label={displayName} size="lg" />
                  </div>
                  <div className="text-lg font-semibold text-zinc-50">{displayName}</div>
                  <div className="mt-1 text-sm text-zinc-500">@{profile.username}</div>
                </div>

                <div className="space-y-3 rounded-[2rem] border border-white/10 bg-white/[0.035] p-6">
                  {[
                    ['Email', profile.email],
                    ['Имя', profile.firstName],
                    ['Фамилия', profile.lastName],
                    ['Статус', profile.status ?? 'ACTIVE'],
                    ['Account ID', profile.accountId],
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
                    <div className="mt-1 text-sm text-zinc-500">Каждое устройство имеет собственные E2EE ключи.</div>
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
                              <div className="mt-1 text-xs text-zinc-500">{device.platform} • версия {device.clientVersion ?? 'unknown'}</div>
                            </div>
                          </div>

                          <span className="rounded-full border border-emerald-300/20 bg-emerald-400/10 px-3 py-1 text-xs text-emerald-200">{device.status}</span>
                        </div>

                        <div className="mt-4 grid gap-3 text-xs text-zinc-500 sm:grid-cols-2">
                          <div className="rounded-2xl bg-black/15 p-3">Последняя активность: <span className="text-zinc-300">{formatDeviceTime(device.lastSeenAt)}</span></div>
                          <div className="rounded-2xl bg-black/15 p-3">Device ID: <span className="text-zinc-300">{activeDeviceId.slice(0, 8)}…</span></div>
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
                  <div className="mb-4 flex items-center justify-between gap-4">
                    <div>
                      <div className="text-base font-semibold text-zinc-50">End-to-end encryption</div>
                      <div className="mt-1 text-sm text-zinc-500">Ключи хранятся локально в зашифрованном vault этого устройства.</div>
                    </div>
                    <CryptoStatusBadge status={cryptoStatus} />
                  </div>

                  <div className="grid gap-3 text-sm sm:grid-cols-2">
                    <div className="rounded-2xl border border-white/8 bg-black/15 p-4">
                      <div className="mb-2 flex items-center gap-2 text-zinc-300"><KeyRound size={15} /> Локальный device</div>
                      <div className="break-all text-xs text-zinc-500">{deviceId ?? 'неизвестно'}</div>
                    </div>
                    <div className="rounded-2xl border border-white/8 bg-black/15 p-4">
                      <div className="mb-2 flex items-center gap-2 text-zinc-300"><Wifi size={15} /> Realtime</div>
                      <div className="text-xs text-zinc-500">{realtimeStatus}</div>
                    </div>
                    <div className="rounded-2xl border border-white/8 bg-black/15 p-4 sm:col-span-2">
                      <div className="mb-2 flex items-center gap-2 text-zinc-300"><LockKeyhole size={15} /> Crypto database</div>
                      <div className="break-all text-xs text-zinc-500">{cryptoDatabasePath ?? 'путь недоступен'}</div>
                    </div>
                  </div>
                </div>

                <div className="rounded-[2rem] border border-white/10 bg-white/[0.035] p-6">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <div className="text-base font-semibold text-zinc-50">Encrypted key backup</div>
                      <div className="mt-1 max-w-2xl text-sm leading-6 text-zinc-500">
                        Backup хранит на сервере только зашифрованный архив локальных ключей. Сервер не знает пароль восстановления и не может прочитать историю.
                      </div>
                    </div>
                    <button
                      onClick={() => void loadBackupStatus()}
                      className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-zinc-300 transition hover:border-violet-300/25 hover:text-zinc-50"
                    >
                      <RefreshCw size={15} />
                      Статус
                    </button>
                  </div>

                  <div className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
                    <div className="rounded-2xl border border-white/8 bg-black/15 p-4">
                      <div className="mb-2 text-zinc-300">Состояние</div>
                      <div className="text-xs text-zinc-500">
                        {backupStatus?.exists ? `Включён, версия ${backupStatus.backupVersion}` : 'Backup ещё не создан'}
                      </div>
                    </div>
                    <div className="rounded-2xl border border-white/8 bg-black/15 p-4">
                      <div className="mb-2 text-zinc-300">Последнее обновление</div>
                      <div className="text-xs text-zinc-500">{formatDeviceTime(backupStatus?.updatedAt)}</div>
                    </div>
                  </div>

                  <div className="mt-5 space-y-3">
                    <input
                      type="password"
                      value={backupPassword}
                      onChange={(event) => setBackupPassword(event.target.value)}
                      placeholder="Пароль восстановления, минимум 12 символов"
                      className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-violet-300/35"
                    />
                    <div className="flex flex-wrap gap-3">
                      <button
                        onClick={() => void handleCreateKeyBackup()}
                        disabled={isBackupBusy || backupPassword.length < 12}
                        className="inline-flex items-center gap-2 rounded-2xl border border-emerald-300/20 bg-emerald-500/10 px-4 py-2 text-sm font-medium text-emerald-200 transition hover:bg-emerald-500/15 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <ShieldCheck size={15} />
                        Создать / обновить backup
                      </button>
                      <button
                        onClick={() => void handleRestoreKeyBackup()}
                        disabled={isBackupBusy || backupPassword.length < 12 || backupStatus?.exists === false}
                        className="inline-flex items-center gap-2 rounded-2xl border border-violet-300/20 bg-violet-500/10 px-4 py-2 text-sm font-medium text-violet-200 transition hover:bg-violet-500/15 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <Download size={15} />
                        Восстановить ключи
                      </button>
                    </div>
                    {backupError && <div className="rounded-2xl border border-red-400/20 bg-red-500/10 p-3 text-sm text-red-200">{backupError}</div>}
                    {backupSuccess && <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-3 text-sm text-emerald-200">{backupSuccess}</div>}
                  </div>
                </div>

                <div className="rounded-[2rem] border border-violet-300/15 bg-violet-500/10 p-5 text-sm leading-6 text-violet-100/85">
                  Сервер хранит только зашифрованные payload'ы и encrypted backup. Без пароля восстановления резервная копия не раскрывает локальные Signal-секреты.
                </div>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}


async function decryptDirectMessageWithAvailablePayloads(
  message: MessageResponseDto,
  currentDevicePayloads: MessageResponseDto['devicePayloads'],
  accountId: string,
  vectorCrypto: NonNullable<typeof window.vectorCrypto>,
) {
  const errors: unknown[] = [];

  for (const currentDevicePayload of currentDevicePayloads) {
    try {
      return await vectorCrypto.decryptMessage({
        accountId,
        deviceId: currentDevicePayload.targetDeviceId,
        messageId: message.messageId,
        remoteDeviceId: message.senderDeviceId,
        ciphertextType: currentDevicePayload.ciphertextType,
        encryptedPayload: currentDevicePayload.encryptedPayload,
      });
    }
    catch (error) {
      errors.push(error);
    }
  }

  throw errors.at(-1) ?? new Error('No decryptable payload is available for this message.');
}

export function MessengerPage() {
  const navigate = useNavigate();
  const profile = useAuthStore((state) => state.profile);
  const deviceId = useAuthStore((state) => state.deviceId);
  const refreshToken = useAuthStore((state) => state.refreshToken);
  const clearAuthentication = useAuthStore((state) => state.clearAuthentication);
  const realtimeStatus = useRealtimeStore((state) => state.status);
  const [restoredDeviceIds, setRestoredDeviceIds] = useState<string[]>([]);
  const typingByChatId = useRealtimeStore((state) => state.typingByChatId);
  const sendTypingEvent = useRealtimeStore((state) => state.sendTypingEvent);
  const cryptoStatus = useCryptoStore((state) => state.status);
  const cryptoDatabasePath = useCryptoStore((state) => state.databasePath);

  const chats = useMessengerStore((state) => state.chats);
  const selectedChatId = useMessengerStore((state) => state.selectedChatId);
  const messagesByChatId = useMessengerStore((state) => state.messagesByChatId);
  const setChats = useMessengerStore((state) => state.setChats);
  const upsertChat = useMessengerStore((state) => state.upsertChat);
  const selectChat = useMessengerStore((state) => state.selectChat);
  const setMessages = useMessengerStore((state) => state.setMessages);
  const upsertMessage = useMessengerStore((state) => state.upsertMessage);

  const profilesById = useDirectoryStore((state) => state.profilesById);
  const upsertProfile = useDirectoryStore((state) => state.upsertProfile);

  const [messageText, setMessageText] = useState('');
  const [chatSearchQuery, setChatSearchQuery] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isUploadingFile, setIsUploadingFile] = useState(false);
  const [isCreateChatOpen, setIsCreateChatOpen] = useState(false);
  const [isDevToolsOpen, setIsDevToolsOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAttachmentMenuOpen, setIsAttachmentMenuOpen] = useState(false);
  const [isDocumentsPanelOpen, setIsDocumentsPanelOpen] = useState(false);
  const [chatDocuments, setChatDocuments] = useState<DocumentResponseDto[]>([]);
  const [isLoadingDocuments, setIsLoadingDocuments] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [decryptedMessagesById, setDecryptedMessagesById] = useState<Record<string, string>>({});

  const decryptingMessageIdsRef = useRef<Set<string>>(new Set());
  const permanentlyUnavailableMessageIdsRef = useRef<Set<string>>(new Set());

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const documentInputRef = useRef<HTMLInputElement | null>(null);
  const deliveredMarkersRef = useRef<Set<string>>(new Set());
  const readMarkersRef = useRef<Set<string>>(new Set());
  const lastTypingSentAtRef = useRef(0);
  const typingStopTimeoutRef = useRef<number | null>(null);

  async function loadRestoredDeviceIds() {
    if (!profile?.accountId || !window.vectorCrypto) {
      setRestoredDeviceIds([]);
      return;
    }

    try {
      const loadedDeviceIds = await window.vectorCrypto.getRestoredDeviceIds({ accountId: profile.accountId });
      setRestoredDeviceIds(loadedDeviceIds);
    }
    catch (error) {
      console.warn(error);
      setRestoredDeviceIds([]);
    }
  }

  async function handleKeyBackupRestored() {
    permanentlyUnavailableMessageIdsRef.current.clear();
    decryptingMessageIdsRef.current.clear();
    setDecryptedMessagesById({});
    await loadRestoredDeviceIds();

    if (selectedChatId) {
      try {
        const loadedMessages = await getChatMessages(selectedChatId);
        setMessages(selectedChatId, loadedMessages);
      }
      catch (error) {
        console.error(error);
        setErrorMessage('Ключи восстановлены, но не удалось сразу обновить историю чата. Перезагрузите чат вручную.');
      }
    }
  }

  useEffect(() => {
    void loadRestoredDeviceIds();
  }, [profile?.accountId, deviceId]);

  useRealtimeConnection();
  useCryptoBootstrap();

  useEffect(() => {
    if (profile) {
      upsertProfile(profile);
    }
  }, [profile, upsertProfile]);

  useEffect(() => {
    function handleKeyboardShortcut(event: globalThis.KeyboardEvent) {
      if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === 'd' && profile?.username === 'admin') {
        event.preventDefault();
        setIsDevToolsOpen((previousValue) => !previousValue);
      }
    }

    window.addEventListener('keydown', handleKeyboardShortcut);
    return () => window.removeEventListener('keydown', handleKeyboardShortcut);
  }, [profile?.username]);

  const selectedChat = useMemo(
    () => chats.find((chat) => chat.chatId === selectedChatId) ?? null,
    [chats, selectedChatId],
  );

  const selectedMessages = selectedChatId ? messagesByChatId[selectedChatId] ?? [] : [];
  const selectedTypingStates = selectedChatId ? typingByChatId[selectedChatId] ?? [] : [];

  useEffect(() => {
    const vectorCrypto = window.vectorCrypto;

    if (!profile?.accountId || !deviceId || !vectorCrypto) {
      return;
    }

    selectedMessages.forEach((message) => {
      const messageId = message.messageId;

      const cachedPlainText = decryptedMessagesById[messageId];

      if (cachedPlainText && !isDecryptionPlaceholder(cachedPlainText)) {
        return;
      }

      if (decryptingMessageIdsRef.current.has(messageId) || permanentlyUnavailableMessageIdsRef.current.has(messageId)) {
        return;
      }

      if (message.encryptionType === 'GROUP' && message.encryptedPayload) {
        decryptingMessageIdsRef.current.add(messageId);

        const localDecryptDeviceIds = new Set([deviceId, ...restoredDeviceIds].filter(Boolean));
        const currentDevicePayloads = message.devicePayloads.filter((devicePayload) => localDecryptDeviceIds.has(devicePayload.targetDeviceId));

        const decryptGroupMessageWithAvailableKey = async () => {
          const directDecryptErrors: unknown[] = [];

          try {
            return await vectorCrypto.decryptGroupMessage({
              accountId: profile.accountId,
              deviceId,
              chatId: message.chatId,
              messageId,
              encryptedPayload: message.encryptedPayload!,
            });
          }
          catch (firstError) {
            directDecryptErrors.push(firstError);
          }

          for (const currentDevicePayload of currentDevicePayloads) {
            try {
              const groupKeyPackage = await vectorCrypto.decryptMessage({
                accountId: profile.accountId,
                deviceId: currentDevicePayload.targetDeviceId,
                messageId: `${messageId}:group-key:${currentDevicePayload.targetDeviceId}`,
                remoteDeviceId: message.senderDeviceId,
                ciphertextType: currentDevicePayload.ciphertextType,
                encryptedPayload: currentDevicePayload.encryptedPayload,
              });

              await vectorCrypto.importGroupKey({
                accountId: profile.accountId,
                chatId: message.chatId,
                groupKeyPackagePlainText: groupKeyPackage.plainText,
              });

              return await vectorCrypto.decryptGroupMessage({
                accountId: profile.accountId,
                deviceId,
                chatId: message.chatId,
                messageId,
                encryptedPayload: message.encryptedPayload!,
              });
            }
            catch (candidateError) {
              directDecryptErrors.push(candidateError);
            }
          }

          throw directDecryptErrors.at(-1) ?? new Error('Group key is not available on this device.');
        };

        decryptGroupMessageWithAvailableKey()
          .then((decryptResponse) => {
            setDecryptedMessagesById((previousValue) => ({
              ...previousValue,
              [messageId]: decryptResponse.plainText,
            }));
          })
          .catch((error) => {
            console.error(error);
            setDecryptedMessagesById((previousValue) => {
              const previousPlainText = previousValue[messageId];

              if (previousPlainText && !isDecryptionPlaceholder(previousPlainText)) {
                return previousValue;
              }

              return {
                ...previousValue,
                [messageId]: '[Не удалось расшифровать сообщение]',
              };
            });
          })
          .finally(() => {
            decryptingMessageIdsRef.current.delete(messageId);
          });
        return;
      }

      const localDecryptDeviceIds = new Set([deviceId, ...restoredDeviceIds].filter(Boolean));
      const currentDevicePayloads = message.devicePayloads.filter((devicePayload) => localDecryptDeviceIds.has(devicePayload.targetDeviceId));

      if (currentDevicePayloads.length === 0) {
        permanentlyUnavailableMessageIdsRef.current.add(messageId);
        setDecryptedMessagesById((previousValue) => {
          if (previousValue[messageId]) {
            return previousValue;
          }

          return {
            ...previousValue,
            [messageId]: '[Сообщение недоступно для этого устройства]',
          };
        });
        return;
      }

      decryptingMessageIdsRef.current.add(messageId);

      decryptDirectMessageWithAvailablePayloads(message, currentDevicePayloads, profile.accountId, vectorCrypto)
        .then((decryptResponse) => {
          setDecryptedMessagesById((previousValue) => ({
            ...previousValue,
            [messageId]: decryptResponse.plainText,
          }));
        })
        .catch((error) => {
          console.error(error);
          setDecryptedMessagesById((previousValue) => {
            const previousPlainText = previousValue[messageId];

            if (previousPlainText && !isDecryptionPlaceholder(previousPlainText)) {
              return previousValue;
            }

            return {
              ...previousValue,
              [messageId]: '[Не удалось расшифровать сообщение]',
            };
          });
        })
        .finally(() => {
          decryptingMessageIdsRef.current.delete(messageId);
        });
    });
  }, [decryptedMessagesById, deviceId, profile?.accountId, restoredDeviceIds, selectedMessages]);

  const filteredChats = useMemo(() => {
    const normalizedQuery = chatSearchQuery.trim().toLowerCase();

    if (!normalizedQuery) {
      return chats;
    }

    return chats.filter((chat) => {
      const presentation = getChatPresentation(chat, profile, profilesById);
      return `${presentation.title} ${presentation.subtitle}`.toLowerCase().includes(normalizedQuery);
    });
  }, [chatSearchQuery, chats, profile, profilesById]);

  useEffect(() => {
    async function loadChats() {
      try {
        const loadedChats = await getChats();
        let nextChats = loadedChats;

        if (!loadedChats.some((chat) => chat.type === 'SELF')) {
          const selfChat = await createSelfChat();
          nextChats = [selfChat, ...loadedChats];
        }

        setChats(nextChats);

        if (nextChats.length > 0) {
          const activeChatStillExists = selectedChatId && nextChats.some((chat) => chat.chatId === selectedChatId);

          if (!activeChatStillExists) {
            const selfChat = nextChats.find((chat) => chat.type === 'SELF');
            selectChat(selfChat?.chatId ?? nextChats[0].chatId);
          }
        }
      }
      catch (error) {
        console.error(error);
        setErrorMessage('Не удалось загрузить чаты.');
      }
    }

    loadChats();
  }, [selectChat, selectedChatId, setChats]);

  useEffect(() => {
    async function loadMessages() {
      if (!selectedChatId) {
        return;
      }

      try {
        const loadedMessages = await getChatMessages(selectedChatId);
        setMessages(selectedChatId, loadedMessages);
      }
      catch (error) {
        console.error(error);
        setErrorMessage('Не удалось загрузить сообщения.');
      }
    }

    loadMessages();
  }, [selectedChatId, setMessages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [selectedChatId, selectedMessages.length]);

  useEffect(() => {
    if (!selectedChatId || !profile?.accountId || selectedMessages.length === 0) {
      return;
    }

    const incomingMessages = selectedMessages.filter((message) => message.senderAccountId !== profile.accountId);

    incomingMessages.forEach((message) => {
      const deliveredMarker = `${selectedChatId}:${message.messageId}:delivered`;

      if (deliveredMarkersRef.current.has(deliveredMarker)) {
        return;
      }

      deliveredMarkersRef.current.add(deliveredMarker);
      markMessageDelivered(selectedChatId, message.messageId).catch((error) => {
        console.error(error);
      });
    });

    const lastIncomingMessage = incomingMessages.at(-1);

    if (!lastIncomingMessage) {
      return;
    }

    const readMarker = `${selectedChatId}:${lastIncomingMessage.messageId}:read`;

    if (readMarkersRef.current.has(readMarker)) {
      return;
    }

    readMarkersRef.current.add(readMarker);
    markChatRead(selectedChatId, lastIncomingMessage.messageId).catch((error) => {
      console.error(error);
    });
  }, [profile?.accountId, selectedChatId, selectedMessages]);

  async function buildEncryptedDevicePayloads(plainText: string) {
    if (!selectedChat || !deviceId || !profile?.accountId) {
      throw new Error('Chat, profile or local device is not available.');
    }

    const targetAccountIds = selectedChat.participantAccountIds;
    const activeDevicesByAccount = await Promise.all(
      targetAccountIds.map(async (targetAccountId) => ({
        targetAccountId,
        devices: await getActiveAccountDevices(targetAccountId),
      })),
    );
    const targetDevices = activeDevicesByAccount.flatMap(({ targetAccountId, devices }) => devices.map((targetDevice) => ({
      targetAccountId,
      targetDeviceId: targetDevice.deviceId,
    })));

    if (targetDevices.length === 0) {
      throw new Error('No active devices are available for message recipients.');
    }

    const vectorCrypto = window.vectorCrypto;

    if (!vectorCrypto) {
      throw new Error('Local cryptography is not available.');
    }

    return Promise.all(targetDevices.map(async (targetDevice) => {
      const encryptedMessage = targetDevice.targetDeviceId === deviceId
        ? await vectorCrypto.encryptLocalMessage({
          accountId: profile.accountId,
          deviceId,
          plainText,
        })
        : await (async () => {
          const preKeyBundle = await getPreKeyBundle(targetDevice.targetDeviceId);

          return vectorCrypto.encryptMessage({
            accountId: profile.accountId,
            deviceId,
            targetDeviceId: targetDevice.targetDeviceId,
            plainText,
            preKeyBundle,
          });
        })();

      return {
        targetAccountId: targetDevice.targetAccountId,
        targetDeviceId: targetDevice.targetDeviceId,
        ciphertextType: encryptedMessage.ciphertextType,
        encryptedPayload: encryptedMessage.encryptedPayload,
      };
    }));
  }

  async function sendEncryptedChatContent(plainText: string, messageType: 'TEXT' | 'FILE' = 'TEXT') {
    if (!selectedChatId || !deviceId) {
      throw new Error('Chat or local device is not available.');
    }

    const groupEpoch = selectedChat?.currentKeyEpoch ?? 1;
    const groupEncryptedMessage = selectedChat?.type === 'GROUP' && window.vectorCrypto
      ? await window.vectorCrypto.encryptGroupMessage({
        accountId: profile?.accountId ?? '',
        deviceId,
        chatId: selectedChatId,
        epoch: groupEpoch,
        plainText,
      })
      : null;
    const devicePayloads = groupEncryptedMessage
      ? await buildEncryptedDevicePayloads(groupEncryptedMessage.groupKeyPackagePlainText)
      : await buildEncryptedDevicePayloads(plainText);

    const savedMessage = await sendMessage(selectedChatId, {
      senderDeviceId: deviceId,
      clientMessageId: crypto.randomUUID(),
      messageType,
      encryptionType: groupEncryptedMessage ? 'GROUP' : 'SIGNAL',
      encryptedPayload: groupEncryptedMessage?.encryptedPayload ?? null,
      devicePayloads,
    });

    upsertMessage(savedMessage);
    setDecryptedMessagesById((previousValue) => ({
      ...previousValue,
      [savedMessage.messageId]: plainText,
    }));

    return savedMessage;
  }

  async function handleSendCurrentMessage() {
    if (!messageText.trim()) {
      return;
    }

    setIsSending(true);
    setErrorMessage(null);

    try {
      const trimmedMessageText = messageText.trim();
      await sendEncryptedChatContent(trimmedMessageText);
      setMessageText('');
      sendCurrentTypingState(false);
    }
    catch (error) {
      console.error(error);
      setErrorMessage('Не удалось отправить сообщение.');
    }
    finally {
      setIsSending(false);
    }
  }


  async function loadChatDocuments() {
    if (!selectedChatId) {
      setChatDocuments([]);
      return;
    }

    setIsLoadingDocuments(true);
    setErrorMessage(null);

    try {
      const loadedDocuments = await getChatDocuments(selectedChatId);
      setChatDocuments(loadedDocuments);
    }
    catch (error) {
      console.error(error);
      setErrorMessage('Не удалось загрузить документы чата.');
    }
    finally {
      setIsLoadingDocuments(false);
    }
  }

  async function openDocumentsPanel() {
    setIsDocumentsPanelOpen(true);
    await loadChatDocuments();
  }

  async function handleAttachFile(file: File | null | undefined, attachmentDisplayMode: 'FILE' | 'IMAGE') {
    if (!file) {
      return;
    }

    if (!selectedChatId || !selectedChat || !deviceId) {
      setErrorMessage('Сначала выбери чат для отправки файла.');
      return;
    }

    setIsSending(true);
    setIsUploadingFile(true);
    setIsAttachmentMenuOpen(false);
    setErrorMessage(null);

    try {
      const encryptionResult = await encryptFileForUpload(file);
      const uploadedFile = await uploadEncryptedMediaFile(
        selectedChatId,
        encryptionResult.encryptedBlob,
        encryptionResult.encryptedSha256Base64,
      );
      const attachmentContent = buildFileAttachmentContent(
        file,
        uploadedFile.id,
        uploadedFile.encryptedSizeBytes,
        encryptionResult,
        attachmentDisplayMode,
      );

      await sendEncryptedChatContent(JSON.stringify(attachmentContent), 'FILE');
      sendCurrentTypingState(false);
    }
    catch (error) {
      console.error(error);
      setErrorMessage('Не удалось зашифровать и отправить файл.');
    }
    finally {
      setIsSending(false);
      setIsUploadingFile(false);
    }
  }


  async function handleAttachDocument(file: File | null | undefined) {
    if (!file) {
      return;
    }

    if (!selectedChatId || !selectedChat || !deviceId) {
      setErrorMessage('Сначала выбери чат для отправки документа.');
      return;
    }

    setIsSending(true);
    setIsUploadingFile(true);
    setIsAttachmentMenuOpen(false);
    setErrorMessage(null);

    try {
      const encryptionResult = await encryptFileForUpload(file);
      const uploadedFile = await uploadEncryptedMediaFile(
        selectedChatId,
        encryptionResult.encryptedBlob,
        encryptionResult.encryptedSha256Base64,
      );
      const documentItem = await createDocument({
        chatId: selectedChatId,
        mediaFileId: uploadedFile.id,
        fileName: file.name,
        mimeType: file.type || 'application/octet-stream',
        sizeBytes: file.size,
        plaintextSha256Base64: encryptionResult.plaintextSha256Base64,
        encryptedSha256Base64: encryptionResult.encryptedSha256Base64,
      });
      const attachmentContent = buildDocumentAttachmentContent(
        file,
        documentItem.documentId,
        uploadedFile.id,
        uploadedFile.encryptedSizeBytes,
        encryptionResult,
      );

      await sendEncryptedChatContent(JSON.stringify(attachmentContent), 'FILE');
      setChatDocuments((previousDocuments) => [documentItem, ...previousDocuments.filter((item) => item.documentId !== documentItem.documentId)]);
      sendCurrentTypingState(false);
    }
    catch (error) {
      console.error(error);
      setErrorMessage('Не удалось зашифровать и отправить документ.');
    }
    finally {
      setIsSending(false);
      setIsUploadingFile(false);
    }
  }

  async function handleDownloadAttachment(attachment: FileAttachmentMessageContent | DocumentAttachmentMessageContent) {
    setErrorMessage(null);

    try {
      const encryptedBytes = await downloadEncryptedMediaFile(attachment.mediaFileId);
      const decryptedBlob = await decryptDownloadedFile(encryptedBytes, attachment);
      const objectUrl = URL.createObjectURL(decryptedBlob);
      const downloadLink = document.createElement('a');
      downloadLink.href = objectUrl;
      downloadLink.download = attachment.fileName;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      downloadLink.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    }
    catch (error) {
      console.error(error);
      setErrorMessage('Не удалось скачать или расшифровать файл.');
    }
  }


  async function handleDownloadDocument(documentItem: DocumentResponseDto) {
    const matchingMessage = Object.entries(decryptedMessagesById)
      .map(([, plainText]) => parseDocumentAttachmentMessageContent(plainText))
      .find((attachment) => attachment?.documentId === documentItem.documentId);

    if (!matchingMessage) {
      setErrorMessage('Ключ документа доступен в сообщении чата. Открой сообщение с этим документом и попробуй снова.');
      return;
    }

    await handleDownloadAttachment(matchingMessage);
  }

  async function handleSignDocument(documentItem: DocumentResponseDto) {
    if (!profile?.accountId || !deviceId || !window.vectorCrypto) {
      setErrorMessage('Локальная подпись документов недоступна.');
      return;
    }

    setErrorMessage(null);

    try {
      const signingKey = await window.vectorCrypto.getOrCreateDocumentSigningKey({
        accountId: profile.accountId,
        deviceId,
      });

      try {
        await registerDocumentSigningKey(deviceId, { publicKeyBase64: signingKey.publicKeyBase64 });
      }
      catch (registrationError) {
        console.warn(registrationError);
      }

      const signature = await window.vectorCrypto.signDocumentHash({
        accountId: profile.accountId,
        deviceId,
        documentHashBase64: documentItem.plaintextSha256Base64,
      });

      const updatedDocument = await signDocument(documentItem.documentId, {
        signerDeviceId: deviceId,
        signingKeyFingerprint: signature.signingKeyFingerprint,
        documentHashBase64: documentItem.plaintextSha256Base64,
        signatureBase64: signature.signatureBase64,
      });

      setChatDocuments((previousDocuments) => previousDocuments.map((item) => item.documentId === updatedDocument.documentId ? updatedDocument : item));
    }
    catch (error) {
      console.error(error);
      setErrorMessage('Не удалось подписать документ.');
    }
  }

  async function handleRejectDocument(documentItem: DocumentResponseDto) {
    setErrorMessage(null);

    try {
      const updatedDocument = await rejectDocument(documentItem.documentId);
      setChatDocuments((previousDocuments) => previousDocuments.map((item) => item.documentId === updatedDocument.documentId ? updatedDocument : item));
    }
    catch (error) {
      console.error(error);
      setErrorMessage('Не удалось отклонить документ.');
    }
  }

  async function handleLogout() {
    try {
      if (refreshToken) {
        await logoutRequest({ refreshToken });
      }
    }
    catch (error) {
      console.warn(error);
    }
    finally {
      clearAuthentication();
      navigate('/login');
    }
  }

  async function handleCreateDirectChat(profileToChat: ProfileResponseDto) {
    const chat = await createDirectChat({ recipientAccountId: profileToChat.accountId });
    upsertProfile(profileToChat);
    upsertChat(chat);
    selectChat(chat.chatId);
    setIsCreateChatOpen(false);
  }

  async function handleCreateGroupChat(groupName: string, profilesToChat: ProfileResponseDto[]) {
    const chat = await createGroupChat({
      name: groupName,
      participantAccountIds: profilesToChat.map((profileToChat) => profileToChat.accountId),
    });

    profilesToChat.forEach(upsertProfile);
    upsertChat(chat);
    selectChat(chat.chatId);
    setIsCreateChatOpen(false);
  }

  function sendCurrentTypingState(isTyping: boolean) {
    if (!selectedChat || !profile?.accountId || selectedChat.type === 'SELF') {
      return;
    }

    const recipientAccountIds = selectedChat.participantAccountIds.filter((participantAccountId) => participantAccountId !== profile.accountId);

    if (recipientAccountIds.length === 0) {
      return;
    }

    sendTypingEvent({
      chatId: selectedChat.chatId,
      recipientAccountIds,
      isTyping,
    });
  }

  function handleMessageTextChange(value: string) {
    setMessageText(value);

    const now = Date.now();

    if (value.trim().length === 0) {
      sendCurrentTypingState(false);
      return;
    }

    if (now - lastTypingSentAtRef.current > 1600) {
      lastTypingSentAtRef.current = now;
      sendCurrentTypingState(true);
    }

    if (typingStopTimeoutRef.current !== null) {
      window.clearTimeout(typingStopTimeoutRef.current);
    }

    typingStopTimeoutRef.current = window.setTimeout(() => {
      sendCurrentTypingState(false);
      typingStopTimeoutRef.current = null;
    }, 2500);
  }

  function handleTextareaKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void handleSendCurrentMessage();
    }
  }

  const selectedChatPresentation = selectedChat ? getChatPresentation(selectedChat, profile, profilesById) : null;
  const currentUserDisplayName = profile ? getDisplayName(profile) : 'Vector user';
  const selectedTypingText = selectedTypingStates.length > 0
    ? selectedTypingStates.length === 1
      ? `${selectedTypingStates[0].username || 'Пользователь'} печатает…`
      : 'Несколько пользователей печатают…'
    : null;

  return (
    <div className="relative flex h-screen overflow-hidden bg-[#111214] text-zinc-100">
      <NewChatModal
        isOpen={isCreateChatOpen}
        currentAccountId={profile?.accountId}
        onClose={() => setIsCreateChatOpen(false)}
        onCreateChat={handleCreateDirectChat}
        onCreateGroupChat={handleCreateGroupChat}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        profile={profile}
        deviceId={deviceId}
        cryptoStatus={cryptoStatus}
        cryptoDatabasePath={cryptoDatabasePath}
        realtimeStatus={realtimeStatus}
        onClose={() => setIsSettingsOpen(false)}
        onLogout={handleLogout}
        onBackupRestored={handleKeyBackupRestored}
      />


      <DocumentsPanel
        isOpen={isDocumentsPanelOpen}
        documents={chatDocuments}
        isLoading={isLoadingDocuments}
        activeAccountId={profile?.accountId}
        onClose={() => setIsDocumentsPanelOpen(false)}
        onRefresh={loadChatDocuments}
        onDownload={handleDownloadDocument}
        onSign={handleSignDocument}
        onReject={handleRejectDocument}
      />

      {isDevToolsOpen && profile?.username === 'admin' && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-[2rem] border border-white/10 bg-[#18191d] p-6 shadow-2xl shadow-black/50">
            <div className="mb-5 flex items-center justify-between gap-4">
              <div>
                <div className="text-xl font-semibold text-zinc-50">Dev tools</div>
                <div className="mt-1 text-sm text-zinc-500">
                  Спрятано из основного интерфейса. Открывается по кнопке или Ctrl + Shift + D.
                </div>
              </div>
              <button
                onClick={() => setIsDevToolsOpen(false)}
                className="rounded-2xl border border-white/10 bg-white/[0.04] p-2 text-zinc-400 transition hover:text-zinc-100"
              >
                <X size={18} />
              </button>
            </div>
            <DevAccountPanel />
          </div>
        </div>
      )}

      <aside className="flex w-[380px] shrink-0 flex-col border-r border-white/10 bg-[#17181c]/95">
        <div className="border-b border-white/10 p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <div className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Messenger</div>
              <div className="mt-1 text-2xl font-semibold tracking-tight text-zinc-50">Chats</div>
            </div>

            <button
              onClick={() => setIsCreateChatOpen(true)}
              className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white shadow-lg shadow-violet-950/40 transition hover:brightness-110"
              title="Новый чат"
            >
              <Plus size={18} />
            </button>
          </div>

          <div className="flex items-center gap-3 rounded-3xl border border-white/10 bg-white/[0.04] px-4 py-3 text-zinc-500">
            <Search size={17} />
            <input
              value={chatSearchQuery}
              onChange={(event) => setChatSearchQuery(event.target.value)}
              className="w-full bg-transparent text-sm text-zinc-300 outline-none placeholder:text-zinc-600"
              placeholder="Поиск по чатам"
            />
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
          {filteredChats.length === 0 ? (
            <div className="mx-2 mt-4 rounded-[1.75rem] border border-dashed border-white/10 bg-white/[0.02] p-8 text-center text-sm text-zinc-500">
              {chats.length === 0
                ? 'Чаты появятся здесь. Создай новый диалог через кнопку сверху.'
                : 'Ничего не найдено по текущему запросу.'}
            </div>
          ) : (
            filteredChats.map((chat) => {
              const presentation = getChatPresentation(chat, profile, profilesById);

              return (
                <button
                  key={chat.chatId}
                  onClick={() => selectChat(chat.chatId)}
                  className={`mb-2 flex w-full items-center gap-3 rounded-[1.6rem] px-3 py-3 text-left transition ${
                    selectedChatId === chat.chatId
                      ? 'bg-gradient-to-r from-violet-500/22 to-fuchsia-500/10 ring-1 ring-violet-300/20'
                      : 'hover:bg-white/[0.04]'
                  }`}
                >
                  {chat.type === 'SELF' ? (
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-lg shadow-black/20">
                      <Star size={18} />
                    </div>
                  ) : (
                    <Avatar label={presentation.avatarLabel} />
                  )}

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-3">
                      <div className="truncate text-sm font-semibold text-zinc-100">{presentation.title}</div>
                      <div className="text-[11px] text-zinc-600">{formatChatTime(chat.lastMessageCreatedAt ?? chat.updatedAt)}</div>
                    </div>
                    <div className="mt-1 truncate text-xs text-zinc-500">{presentation.subtitle}</div>
                  </div>
                </button>
              );
            })
          )}
        </div>

        <div className="border-t border-white/10 p-4">
          <div className="flex items-center gap-2 rounded-[1.7rem] border border-white/10 bg-white/[0.035] p-2">
            <button
              onClick={() => setIsSettingsOpen(true)}
              className="flex min-w-0 flex-1 items-center gap-3 rounded-[1.35rem] p-2 text-left transition hover:bg-white/[0.05]"
              title="Открыть настройки"
            >
              <Avatar label={currentUserDisplayName} size="sm" />

              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold text-zinc-100">{currentUserDisplayName}</div>
                <div className="mt-1 flex items-center gap-2 text-xs text-zinc-500">
                  {realtimeStatus === 'connected'
                    ? <Wifi size={13} className="text-emerald-300" />
                    : <WifiOff size={13} className="text-zinc-600" />}
                  <span>@{profile?.username ?? 'user'} • crypto {cryptoStatus}</span>
                </div>
              </div>
            </button>

            {profile?.username === 'admin' && (
              <button
                onClick={() => setIsDevToolsOpen(true)}
                className="rounded-2xl border border-white/10 bg-white/[0.04] p-2 text-zinc-400 transition hover:border-violet-300/30 hover:text-zinc-100"
                title="Dev tools"
              >
                <Wrench size={16} />
              </button>
            )}
          </div>
        </div>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col bg-[#111214]">
        {!selectedChat || !selectedChatPresentation ? (
          <div className="flex flex-1 items-center justify-center px-8">
            <div className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-10 text-center shadow-2xl shadow-black/30">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-br from-violet-500 to-fuchsia-500 shadow-lg shadow-violet-950/40">
                <MessageCircle size={28} />
              </div>
              <h2 className="mt-5 text-2xl font-semibold text-zinc-50">Выбери чат</h2>
              <p className="mt-2 max-w-md text-sm leading-6 text-zinc-500">
                Открой сохранённые сообщения или создай новый диалог через кнопку с плюсом в левой колонке.
              </p>
            </div>
          </div>
        ) : (
          <>
            <header className="flex h-[84px] items-center justify-between border-b border-white/10 bg-[#18191d]/72 px-7 backdrop-blur-xl">
              <div className="flex min-w-0 items-center gap-4">
                {selectedChat.type === 'SELF'
                  ? (
                    <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-lg shadow-black/20">
                      <Star size={20} />
                    </div>
                    )
                  : <Avatar label={selectedChatPresentation.avatarLabel} size="lg" />}

                <div className="min-w-0">
                  <div className="truncate text-lg font-semibold text-zinc-50">{selectedChatPresentation.title}</div>
                  <div className="mt-1 truncate text-sm text-zinc-500">
                    {selectedTypingText ?? (selectedChat.type === 'SELF' ? 'Личный чат' : selectedChatPresentation.subtitle)}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => void openDocumentsPanel()}
                  className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-zinc-300 transition hover:border-violet-300/25 hover:text-white"
                  title="Документооборот"
                >
                  <ShieldCheck size={14} />
                  Документы
                </button>
                <div className="rounded-full border border-violet-300/20 bg-violet-400/10 px-3 py-1 text-xs text-violet-200">
                  {realtimeStatus === 'connected' ? 'online' : realtimeStatus}
                </div>
              </div>
            </header>

            {errorMessage && (
              <div className="border-b border-red-400/20 bg-red-500/10 px-7 py-3 text-sm text-red-200">
                {errorMessage}
              </div>
            )}

            <div className="min-h-0 flex-1 overflow-y-auto px-8 py-6">
              <div className="mx-auto flex max-w-4xl flex-col gap-3">
                {selectedMessages.length === 0 && (
                  <div className="rounded-[1.8rem] border border-dashed border-white/10 bg-white/[0.02] p-8 text-center text-sm text-zinc-500">
                    Пока сообщений нет. Напиши первое сообщение ниже.
                  </div>
                )}

                {selectedMessages.map((message) => {
                  const isOwnMessage = message.senderAccountId === profile?.accountId;
                  const messageStatus = getOutgoingMessageStatus(message, profile?.accountId);
                  const decryptedMessage = decryptedMessagesById[message.messageId] ?? 'Расшифровка…';
                  const fileAttachment = parseFileAttachmentMessageContent(decryptedMessage);
                  const documentAttachment = parseDocumentAttachmentMessageContent(decryptedMessage);

                  return (
                    <div key={message.messageId} className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'}`}>
                      <div className={`flex max-w-[74%] items-end gap-3 ${isOwnMessage ? 'flex-row-reverse' : ''}`}>
                        {!isOwnMessage && <Avatar label={selectedChatPresentation.avatarLabel} size="sm" />}

                        <div
                          className={`rounded-[1.5rem] px-4 py-3 shadow-lg ${
                            isOwnMessage
                              ? 'rounded-br-md bg-gradient-to-br from-violet-500 to-fuchsia-600 text-white shadow-violet-950/25'
                              : 'rounded-bl-md border border-white/10 bg-[#24262d] text-zinc-100 shadow-black/20'
                          }`}
                        >
                          {documentAttachment ? (
                            <DocumentAttachmentPreview attachment={documentAttachment} isOwnMessage={isOwnMessage} onDownload={handleDownloadAttachment} />
                          ) : fileAttachment ? (
                            fileAttachment.attachmentDisplayMode === 'IMAGE' ? (
                              <ImageAttachmentPreview attachment={fileAttachment} onDownload={handleDownloadAttachment} />
                            ) : (
                              <div className="min-w-[280px] max-w-[360px]">
                                <div className={`flex items-center gap-3 rounded-2xl border p-3 ${isOwnMessage ? 'border-white/20 bg-white/10' : 'border-white/10 bg-black/15'}`}>
                                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-black/20 text-white">
                                    <FileText size={20} />
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <div className="truncate text-sm font-semibold">{fileAttachment.fileName}</div>
                                    <div className={`mt-1 text-xs ${isOwnMessage ? 'text-violet-100/75' : 'text-zinc-500'}`}>
                                      {formatFileSize(fileAttachment.sizeBytes)} • encrypted file
                                    </div>
                                  </div>
                                  <button
                                    onClick={() => void handleDownloadAttachment(fileAttachment)}
                                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition ${isOwnMessage ? 'bg-white/15 hover:bg-white/25' : 'bg-white/[0.06] hover:bg-white/[0.1]'}`}
                                    title="Скачать и расшифровать"
                                  >
                                    <Download size={17} />
                                  </button>
                                </div>
                              </div>
                            )
                          ) : (
                            <div className="whitespace-pre-wrap text-sm leading-6">
                              {decryptedMessage}
                            </div>
                          )}
                          <div className={`mt-2 flex items-center gap-2 text-[11px] ${isOwnMessage ? 'justify-end text-violet-100/80' : 'justify-end text-zinc-500'}`}>
                            <span>{formatMessageTime(message.createdAt)}</span>
                            {isOwnMessage && (
                              <span className="inline-flex items-center gap-1">
                                {messageStatus === 'READ' ? <CheckCheck size={13} /> : messageStatus === 'DELIVERED' ? <CheckCheck size={13} /> : <Check size={13} />}
                                <span>
                                  {messageStatus === 'READ' ? 'Прочитано' : messageStatus === 'DELIVERED' ? 'Доставлено' : 'Отправлено'}
                                </span>
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {selectedTypingText && (
                  <div className="flex justify-start">
                    <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-xs text-zinc-400">
                      <span className="flex gap-1">
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-violet-300" />
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-violet-300 [animation-delay:120ms]" />
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-violet-300 [animation-delay:240ms]" />
                      </span>
                      {selectedTypingText}
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>
            </div>

            <div className="border-t border-white/10 bg-[#18191d]/85 p-5 backdrop-blur-xl">
              <div className="mx-auto max-w-4xl">
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0] ?? null;
                    event.target.value = '';
                    void handleAttachFile(file, 'FILE');
                  }}
                />

                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0] ?? null;
                    event.target.value = '';
                    void handleAttachFile(file, 'IMAGE');
                  }}
                />


                <input
                  ref={documentInputRef}
                  type="file"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0] ?? null;
                    event.target.value = '';
                    void handleAttachDocument(file);
                  }}
                />

                <div className="flex items-end gap-3 rounded-[2rem] border border-white/10 bg-white/[0.04] px-4 py-3 shadow-xl shadow-black/20">
                  <div className="relative">
                    <button
                      onClick={() => setIsAttachmentMenuOpen((previousValue) => !previousValue)}
                      disabled={isSending || isUploadingFile || !selectedChat}
                      className="flex h-[52px] w-[52px] items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05] text-zinc-300 transition hover:border-violet-300/25 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                      title="Прикрепить"
                    >
                      {isUploadingFile ? <LoaderCircle size={18} className="animate-spin" /> : <Paperclip size={19} />}
                    </button>

                    {isAttachmentMenuOpen && (
                      <div className="absolute bottom-[62px] left-0 z-20 w-64 rounded-3xl border border-white/10 bg-[#202127] p-2 shadow-2xl shadow-black/40">
                        <button
                          onClick={() => imageInputRef.current?.click()}
                          className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left text-sm text-zinc-200 transition hover:bg-white/[0.06]"
                        >
                          <ImageIcon size={18} className="text-violet-200" />
                          <span>Отправить как изображение</span>
                        </button>
                        <button
                          onClick={() => fileInputRef.current?.click()}
                          className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left text-sm text-zinc-200 transition hover:bg-white/[0.06]"
                        >
                          <FileText size={18} className="text-violet-200" />
                          <span>Отправить как файл</span>
                        </button>
                        <button
                          onClick={() => documentInputRef.current?.click()}
                          className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left text-sm text-zinc-200 transition hover:bg-white/[0.06]"
                        >
                          <ShieldCheck size={18} className="text-violet-200" />
                          <span>Отправить как документ</span>
                        </button>
                        <button
                          onClick={() => void openDocumentsPanel()}
                          className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left text-sm text-zinc-200 transition hover:bg-white/[0.06]"
                        >
                          <FileText size={18} className="text-violet-200" />
                          <span>Открыть документы чата</span>
                        </button>
                      </div>
                    )}
                  </div>

                  <textarea
                    value={messageText}
                    onChange={(event) => handleMessageTextChange(event.target.value)}
                    onBlur={() => sendCurrentTypingState(false)}
                    onKeyDown={handleTextareaKeyDown}
                    onInput={(event) => {
                      const textarea = event.currentTarget;
                      textarea.style.height = '0px';
                      textarea.style.height = `${Math.min(textarea.scrollHeight, 160)}px`;
                    }}
                    placeholder="Напишите сообщение…"
                    rows={1}
                    className="max-h-40 min-h-[24px] flex-1 resize-none bg-transparent py-2 text-sm leading-6 text-zinc-100 outline-none placeholder:text-zinc-600"
                  />

                  <button
                    onClick={() => void handleSendCurrentMessage()}
                    disabled={isSending || !messageText.trim()}
                    className="flex h-[52px] w-[52px] items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white shadow-lg shadow-violet-950/40 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
                    title="Отправить"
                  >
                    {isSending && !isUploadingFile ? <LoaderCircle size={18} className="animate-spin" /> : <Send size={19} />}
                  </button>
                </div>

                <div className="mt-3 flex items-center justify-between px-2 text-xs text-zinc-600">
                  <span>Enter — отправить, Shift + Enter — новая строка. Файлы шифруются локально перед отправкой.</span>
                  <span>{selectedChat.type === 'SELF' ? 'Личный чат' : selectedChat.type === 'GROUP' ? 'Group sender-key E2EE' : 'Direct chat'}</span>
                </div>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
