import { Check, CheckCheck, Plus, Search, Star, Wifi, WifiOff, Wrench } from 'lucide-react';
import { formatChatTime } from '../../../../shared/lib/dateFormat';
import { getDirectCompanionAccountId, getDisplayName } from '../../../../shared/lib/profile';
import type { ChatResponseDto, MessageResponseDto, ProfileResponseDto } from '../../../../shared/types/api';
import type { AccountPresenceState } from '../../../realtime/model/realtimeStore';
import { getAccountAvatarUrl, getChatPresentation, getLastTimelineMessage, getOutgoingMessageStatus, getPreviewTextColorClass, getVisibleChatMessages, buildChatPreviewFromMessage, calculateUnreadCount, type LocalChatState, UserAvatar } from '../../../../pages/MessengerPageSupport';

type ChatSidebarProps = {
  chats: ChatResponseDto[];
  filteredChats: ChatResponseDto[];
  selectedChatId: string | null;
  currentProfile: ProfileResponseDto | null;
  profilesById: Record<string, ProfileResponseDto>;
  messagesByChatId: Record<string, MessageResponseDto[]>;
  decryptedMessagesById: Record<string, string>;
  localChatState: LocalChatState;
  chatSearchQuery: string;
  realtimeStatus: string;
  cryptoStatus: string;
  localAvatarDataUrl: string | null;
  presenceByAccountId: Record<string, AccountPresenceState>;
  onChatSearchQueryChange: (value: string) => void;
  onCreateChatOpen: () => void;
  onSelectChat: (chatId: string) => void;
  onCloseOpenedChatMenu: () => void;
  onOpenSettings: () => void;
  onOpenDevTools: () => void;
};

export function ChatSidebar({
  chats,
  filteredChats,
  selectedChatId,
  currentProfile,
  profilesById,
  messagesByChatId,
  decryptedMessagesById,
  localChatState,
  chatSearchQuery,
  realtimeStatus,
  cryptoStatus,
  localAvatarDataUrl,
  presenceByAccountId,
  onChatSearchQueryChange,
  onCreateChatOpen,
  onSelectChat,
  onCloseOpenedChatMenu,
  onOpenSettings,
  onOpenDevTools,
}: ChatSidebarProps) {
  const currentUserDisplayName = currentProfile ? getDisplayName(currentProfile) : 'Vector user';

  return (
    <aside className="relative z-10 flex w-[392px] shrink-0 flex-col border-r border-white/10 bg-[#15161b]/86 shadow-2xl shadow-black/30 backdrop-blur-2xl">
      <div className="border-b border-white/10 p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <div className="text-[11px] uppercase tracking-[0.18em] text-violet-300/70">Vector Messenger</div>
            <div className="mt-1 text-2xl font-semibold tracking-tight text-zinc-50">Чаты</div>
          </div>

          <button
            onClick={onCreateChatOpen}
            className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white shadow-lg shadow-violet-950/40 transition hover:brightness-110"
            title="Новый чат"
          >
            <Plus size={18} />
          </button>
        </div>

        <div className="flex items-center gap-3 rounded-3xl border border-white/10 bg-black/18 px-4 py-3 text-zinc-500 shadow-inner shadow-black/20">
          <Search size={17} />
          <input
            value={chatSearchQuery}
            onChange={(event) => onChatSearchQueryChange(event.target.value)}
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
            const presentation = getChatPresentation(chat, currentProfile, profilesById);
            const chatMessages = getVisibleChatMessages(messagesByChatId[chat.chatId] ?? [], localChatState.clearedAtByChatId[chat.chatId]);
            const lastTimelineMessage = getLastTimelineMessage(chatMessages);
            const preview = buildChatPreviewFromMessage(lastTimelineMessage, decryptedMessagesById, profilesById);
            const unreadCount = selectedChatId === chat.chatId ? 0 : calculateUnreadCount(chatMessages, currentProfile?.accountId, localChatState.readAtByChatId[chat.chatId]);
            const isOwnLastMessage = Boolean(lastTimelineMessage && lastTimelineMessage.senderAccountId === currentProfile?.accountId);
            const lastMessageStatus = lastTimelineMessage && isOwnLastMessage ? getOutgoingMessageStatus(lastTimelineMessage, currentProfile?.accountId) : null;
            const companionAccountId = chat.type === 'DIRECT' ? getDirectCompanionAccountId(chat, currentProfile?.accountId) : null;
            const companionPresence = companionAccountId ? presenceByAccountId[companionAccountId] : null;

            return (
              <button
                key={chat.chatId}
                onClick={() => {
                  onSelectChat(chat.chatId);
                  onCloseOpenedChatMenu();
                }}
                className={`mb-2 flex w-full items-center gap-3 rounded-[1.6rem] px-3 py-3 text-left transition ${
                  selectedChatId === chat.chatId
                    ? 'bg-gradient-to-r from-violet-500/25 via-fuchsia-500/10 to-transparent ring-1 ring-violet-300/20 shadow-lg shadow-violet-950/10'
                    : 'hover:bg-white/[0.05] hover:shadow-lg hover:shadow-black/10'
                }`}
              >
                <div className="relative shrink-0">
                  {chat.type === 'SELF' ? (
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-lg shadow-black/20">
                      <Star size={18} />
                    </div>
                  ) : (
                    <UserAvatar label={presentation.avatarLabel} imageUrl={getAccountAvatarUrl(presentation.companionProfile)} />
                  )}
                  {chat.type === 'DIRECT' && (
                    <span className={`absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-[#17181c] ${companionPresence?.isOnline ? 'bg-emerald-400' : 'bg-zinc-600'}`} />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-3">
                    <div className="truncate text-sm font-semibold text-zinc-100">{presentation.title}</div>
                    <div className="shrink-0 text-[11px] text-zinc-600">{formatChatTime(lastTimelineMessage?.createdAt ?? chat.lastMessageCreatedAt ?? chat.updatedAt)}</div>
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    {chat.type !== 'SELF' && isOwnLastMessage && lastMessageStatus && (
                      <span className="inline-flex shrink-0 text-violet-300">
                        {lastMessageStatus === 'READ' ? <CheckCheck size={13} /> : lastMessageStatus === 'DELIVERED' ? <CheckCheck size={13} /> : <Check size={13} />}
                      </span>
                    )}
                    <div className={`min-w-0 flex-1 truncate text-xs ${getPreviewTextColorClass(preview.accent)}`}>{preview.text}</div>
                    {unreadCount > 0 && (
                      <span className="flex min-w-5 shrink-0 items-center justify-center rounded-full bg-violet-500 px-1.5 py-0.5 text-[11px] font-semibold text-white shadow-lg shadow-violet-950/30">
                        {unreadCount > 99 ? '99+' : unreadCount}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>

      <div className="border-t border-white/10 p-4">
        <div className="flex items-center gap-2 rounded-[1.7rem] border border-white/10 bg-white/[0.035] p-2">
          <button
            onClick={onOpenSettings}
            className="flex min-w-0 flex-1 items-center gap-3 rounded-[1.35rem] p-2 text-left transition hover:bg-white/[0.05]"
            title="Открыть настройки"
          >
            <UserAvatar label={currentUserDisplayName} imageUrl={getAccountAvatarUrl(currentProfile, localAvatarDataUrl)} size="sm" />

            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold text-zinc-100">{currentUserDisplayName}</div>
              <div className="mt-1 flex items-center gap-2 text-xs text-zinc-500">
                {realtimeStatus === 'connected'
                  ? <Wifi size={13} className="text-emerald-300" />
                  : <WifiOff size={13} className="text-zinc-600" />}
                <span>@{currentProfile?.username ?? 'user'} • {cryptoStatus === 'ready' ? 'защищено' : 'настройка'}</span>
              </div>
            </div>
          </button>

          {currentProfile?.username === 'admin' && (
            <button
              onClick={onOpenDevTools}
              className="rounded-2xl border border-white/10 bg-white/[0.04] p-2 text-zinc-400 transition hover:border-violet-300/30 hover:text-zinc-100"
              title="Dev tools"
            >
              <Wrench size={16} />
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}
