import { KeyboardEvent, useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  CheckCheck,
  LoaderCircle,
  LogOut,
  MessageCircle,
  Plus,
  Search,
  Send,
  Star,
  Wifi,
  WifiOff,
  Wrench,
  X,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { createDirectChat, createSelfChat, getChats } from '../features/chats/api/chatsApi';
import { searchProfiles } from '../features/directory/api/profilesApi';
import { getActiveAccountDevices } from '../features/devices/api/devicesApi';
import { useDirectoryStore } from '../features/directory/model/directoryStore';
import { logout as logoutRequest } from '../features/auth/api/authApi';
import { useAuthStore } from '../features/auth/model/authStore';
import { getChatMessages, markChatRead, markMessageDelivered, sendMessage } from '../features/messages/api/messagesApi';
import { useMessengerStore } from '../features/messenger/model/messengerStore';
import { useRealtimeConnection } from '../features/realtime/useRealtimeConnection';
import { useRealtimeStore } from '../features/realtime/model/realtimeStore';
import { DevAccountPanel } from '../features/admin/ui/DevAccountPanel';
import { useCryptoBootstrap } from '../features/crypto/useCryptoBootstrap';
import { useCryptoStore } from '../features/crypto/model/cryptoStore';
import { getPreKeyBundle } from '../features/crypto/api/cryptoKeysApi';
import { formatChatTime, formatMessageTime } from '../shared/lib/dateFormat';
import { getAvatarGradient, getInitials } from '../shared/lib/avatar';
import { getDirectCompanionAccountId, getDisplayName } from '../shared/lib/profile';
import type { ChatResponseDto, MessageResponseDto, ProfileResponseDto } from '../shared/types/api';

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
}: {
  isOpen: boolean;
  currentAccountId: string | undefined;
  onClose: () => void;
  onCreateChat: (profile: ProfileResponseDto) => Promise<void>;
}) {
  const upsertProfiles = useDirectoryStore((state) => state.upsertProfiles);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ProfileResponseDto[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [decryptedMessagesById, setDecryptedMessagesById] = useState<Record<string, string>>({});
  const [creatingAccountId, setCreatingAccountId] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setQuery('');
      setResults([]);
      setErrorMessage(null);
      setCreatingAccountId(null);
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
              Найди сотрудника по имени, username или email.
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

              return (
                <button
                  key={profile.accountId}
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
                  className="flex w-full items-center gap-4 rounded-3xl border border-white/8 bg-white/[0.03] px-4 py-3 text-left transition hover:border-violet-300/25 hover:bg-white/[0.05]"
                >
                  <Avatar label={displayName} />

                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold text-zinc-100">{displayName}</div>
                    <div className="mt-1 truncate text-xs text-zinc-500">@{profile.username} • {profile.email}</div>
                  </div>

                  <div className="rounded-full border border-violet-300/15 bg-violet-400/10 px-3 py-1 text-xs text-violet-200">
                    {isCreating ? 'Создаём…' : 'Открыть чат'}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

export function MessengerPage() {
  const navigate = useNavigate();
  const profile = useAuthStore((state) => state.profile);
  const deviceId = useAuthStore((state) => state.deviceId);
  const refreshToken = useAuthStore((state) => state.refreshToken);
  const clearAuthentication = useAuthStore((state) => state.clearAuthentication);
  const realtimeStatus = useRealtimeStore((state) => state.status);
  const cryptoStatus = useCryptoStore((state) => state.status);

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
  const [isCreateChatOpen, setIsCreateChatOpen] = useState(false);
  const [isDevToolsOpen, setIsDevToolsOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [decryptedMessagesById, setDecryptedMessagesById] = useState<Record<string, string>>({});

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const deliveredMarkersRef = useRef<Set<string>>(new Set());
  const readMarkersRef = useRef<Set<string>>(new Set());

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

  useEffect(() => {
    const vectorCrypto = window.vectorCrypto;

    if (!profile?.accountId || !deviceId || !vectorCrypto) {
      return;
    }

    selectedMessages.forEach((message) => {
      if (decryptedMessagesById[message.messageId]) {
        return;
      }

      const currentDevicePayload = message.devicePayloads.find((devicePayload) => devicePayload.targetDeviceId === deviceId);

      if (!currentDevicePayload) {
        setDecryptedMessagesById((previousValue) => ({
          ...previousValue,
          [message.messageId]: '[Сообщение недоступно для этого устройства]',
        }));
        return;
      }

      vectorCrypto.decryptMessage({
        accountId: profile.accountId,
        deviceId,
        remoteDeviceId: message.senderDeviceId,
        ciphertextType: currentDevicePayload.ciphertextType,
        encryptedPayload: currentDevicePayload.encryptedPayload,
      })
        .then((decryptResponse) => {
          setDecryptedMessagesById((previousValue) => ({
            ...previousValue,
            [message.messageId]: decryptResponse.plainText,
          }));
        })
        .catch((error) => {
          console.error(error);
          setDecryptedMessagesById((previousValue) => ({
            ...previousValue,
            [message.messageId]: '[Не удалось расшифровать сообщение]',
          }));
        });
    });
  }, [decryptedMessagesById, deviceId, profile?.accountId, selectedMessages]);

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

  async function handleSendCurrentMessage() {
    if (!selectedChatId || !messageText.trim() || !deviceId) {
      return;
    }

    setIsSending(true);
    setErrorMessage(null);

    try {
      const targetAccountIds = selectedChat?.participantAccountIds ?? [];
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

      if (!profile?.accountId || !vectorCrypto) {
        throw new Error('Local cryptography is not available.');
      }

      const trimmedMessageText = messageText.trim();
      const devicePayloads = await Promise.all(targetDevices.map(async (targetDevice) => {
        const encryptedMessage = targetDevice.targetDeviceId === deviceId
          ? await vectorCrypto.encryptLocalMessage({
            accountId: profile.accountId,
            deviceId,
            plainText: trimmedMessageText,
          })
          : await (async () => {
            const preKeyBundle = await getPreKeyBundle(targetDevice.targetDeviceId);

            return vectorCrypto.encryptMessage({
              accountId: profile.accountId,
              deviceId,
              targetDeviceId: targetDevice.targetDeviceId,
              plainText: trimmedMessageText,
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

      const savedMessage = await sendMessage(selectedChatId, {
        senderDeviceId: deviceId,
        clientMessageId: crypto.randomUUID(),
        messageType: 'TEXT',
        encryptionType: 'SIGNAL',
        devicePayloads,
      });

      upsertMessage(savedMessage);
      setDecryptedMessagesById((previousValue) => ({
        ...previousValue,
        [savedMessage.messageId]: trimmedMessageText,
      }));
      setMessageText('');
    }
    catch (error) {
      console.error(error);
      setErrorMessage('Не удалось отправить сообщение.');
    }
    finally {
      setIsSending(false);
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

  function handleTextareaKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void handleSendCurrentMessage();
    }
  }

  const selectedChatPresentation = selectedChat ? getChatPresentation(selectedChat, profile, profilesById) : null;
  const currentUserDisplayName = profile ? getDisplayName(profile) : 'Vector user';

  return (
    <div className="relative flex h-screen overflow-hidden bg-[#111214] text-zinc-100">
      <NewChatModal
        isOpen={isCreateChatOpen}
        currentAccountId={profile?.accountId}
        onClose={() => setIsCreateChatOpen(false)}
        onCreateChat={handleCreateDirectChat}
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
          <div className="flex items-center gap-3 rounded-[1.7rem] border border-white/10 bg-white/[0.035] p-3">
            <Avatar label={currentUserDisplayName} size="sm" />

            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold text-zinc-100">{currentUserDisplayName}</div>
              <div className="mt-1 flex items-center gap-2 text-xs text-zinc-500">
                {realtimeStatus === 'connected'
                  ? <Wifi size={13} className="text-emerald-300" />
                  : <WifiOff size={13} className="text-zinc-600" />}
                <span>@{profile?.username ?? 'user'} • {realtimeStatus} • crypto {cryptoStatus}</span>
              </div>
            </div>

            {profile?.username === 'admin' && (
              <button
                onClick={() => setIsDevToolsOpen(true)}
                className="rounded-2xl border border-white/10 bg-white/[0.04] p-2 text-zinc-400 transition hover:border-violet-300/30 hover:text-zinc-100"
                title="Dev tools"
              >
                <Wrench size={16} />
              </button>
            )}

            <button
              onClick={handleLogout}
              className="rounded-2xl border border-white/10 bg-white/[0.04] p-2 text-zinc-400 transition hover:border-violet-300/30 hover:text-zinc-100"
              title="Выйти"
            >
              <LogOut size={16} />
            </button>
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
                    {selectedChat.type === 'SELF' ? 'Личный чат' : selectedChatPresentation.subtitle}
                  </div>
                </div>
              </div>

              <div className="rounded-full border border-violet-300/20 bg-violet-400/10 px-3 py-1 text-xs text-violet-200">
                {realtimeStatus === 'connected' ? 'online' : realtimeStatus}
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
                          <div className="whitespace-pre-wrap text-sm leading-6">
                            {decryptedMessagesById[message.messageId] ?? 'Расшифровка…'}
                          </div>
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

                <div ref={messagesEndRef} />
              </div>
            </div>

            <div className="border-t border-white/10 bg-[#18191d]/85 p-5 backdrop-blur-xl">
              <div className="mx-auto max-w-4xl">
                <div className="flex items-end gap-3 rounded-[2rem] border border-white/10 bg-white/[0.04] px-4 py-3 shadow-xl shadow-black/20">
                  <textarea
                    value={messageText}
                    onChange={(event) => setMessageText(event.target.value)}
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
                    {isSending ? <LoaderCircle size={18} className="animate-spin" /> : <Send size={19} />}
                  </button>
                </div>

                <div className="mt-3 flex items-center justify-between px-2 text-xs text-zinc-600">
                  <span>Enter — отправить, Shift + Enter — новая строка</span>
                  <span>{selectedChat.type === 'SELF' ? 'Личный чат' : 'Direct chat'}</span>
                </div>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
