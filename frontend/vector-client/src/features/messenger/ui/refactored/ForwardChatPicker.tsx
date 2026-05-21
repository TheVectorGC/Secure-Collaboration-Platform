import { Search, Star, X } from 'lucide-react';
import type { ChatResponseDto, MessageResponseDto, ProfileResponseDto } from '../../../../shared/types/api';
import { buildChatPreviewFromMessage, getAccountAvatarUrl, getChatPresentation, getLastTimelineMessage, getPreviewTextColorClass, getVisibleChatMessages, type LocalChatState, UserAvatar } from '../../../../pages/MessengerPageSupport';

type ForwardChatPickerProps = {
  isOpen: boolean;
  query: string;
  currentProfile: ProfileResponseDto | null;
  profilesById: Record<string, ProfileResponseDto>;
  messagesByChatId: Record<string, MessageResponseDto[]>;
  decryptedMessagesById: Record<string, string>;
  localChatState: LocalChatState;
  targetChats: ChatResponseDto[];
  onQueryChange: (value: string) => void;
  onClose: () => void;
  onSelectChat: (chat: ChatResponseDto) => void;
};

export function ForwardChatPicker({
  isOpen,
  query,
  currentProfile,
  profilesById,
  messagesByChatId,
  decryptedMessagesById,
  localChatState,
  targetChats,
  onQueryChange,
  onClose,
  onSelectChat,
}: ForwardChatPickerProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[75] flex items-center justify-center bg-black/60 p-5 backdrop-blur-md" onClick={onClose}>
      <div className="vector-surface-card flex max-h-[78vh] w-full max-w-md flex-col overflow-hidden p-0" onClick={(event) => event.stopPropagation()}>
        <div className="border-b border-white/10 p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-lg font-semibold text-white">Куда переслать?</div>
              <div className="mt-1 text-sm text-zinc-500">Выберите чат. Перед отправкой можно будет добавить текст.</div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-zinc-400 transition hover:bg-white/[0.07] hover:text-white"
              title="Закрыть"
            >
              <X size={18} />
            </button>
          </div>
          <div className="vector-glass-subtle mt-4 flex items-center gap-3 rounded-3xl px-4 py-3 text-zinc-500 shadow-inner shadow-black/20">
            <Search size={17} />
            <input
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              className="w-full bg-transparent text-sm text-zinc-300 outline-none placeholder:text-zinc-600"
              placeholder="Найти чат"
              autoFocus
            />
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          {targetChats.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-white/10 p-8 text-center text-sm text-zinc-500">Чаты не найдены</div>
          ) : targetChats.map((chat) => {
            const presentation = getChatPresentation(chat, currentProfile, profilesById);
            const chatMessages = getVisibleChatMessages(messagesByChatId[chat.chatId] ?? [], localChatState.clearedAtByChatId[chat.chatId]);
            const lastTimelineMessage = getLastTimelineMessage(chatMessages);
            const preview = buildChatPreviewFromMessage(lastTimelineMessage, decryptedMessagesById, profilesById);

            return (
              <button
                type="button"
                key={chat.chatId}
                onClick={() => onSelectChat(chat)}
                className="flex w-full items-center gap-3 rounded-[1.5rem] px-3 py-3 text-left transition hover:bg-white/[0.065] hover:shadow-lg hover:shadow-black/10"
              >
                {chat.type === 'SELF' ? (
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-lg shadow-black/20">
                    <Star size={18} />
                  </div>
                ) : (
                  <UserAvatar label={presentation.avatarLabel} imageUrl={chat.type === 'GROUP' ? chat.avatarDataUrl : getAccountAvatarUrl(presentation.companionProfile)} />
                )}
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-zinc-100">{presentation.title}</div>
                  <div className={`mt-1 truncate text-xs ${getPreviewTextColorClass(preview.accent)}`}>{preview.text}</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
