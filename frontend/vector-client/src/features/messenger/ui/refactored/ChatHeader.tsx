import { Eraser, MoreVertical, ShieldCheck, Star, Trash2, Users } from 'lucide-react';
import { getAccountAvatarUrl, type ChatPresentation, UserAvatar } from '../../../../pages/MessengerPageSupport';
import type { ChatResponseDto } from '../../../../shared/types/api';

type ChatHeaderProps = {
  selectedChat: ChatResponseDto;
  selectedChatPresentation: ChatPresentation;
  selectedChatSubtitle: string;
  isChatActionsMenuOpen: boolean;
  onOpenGroupManagement: () => void;
  onOpenDirectProfile: () => void;
  onOpenDocumentsPanel: () => void;
  onToggleChatActionsMenu: () => void;
  onClearSelectedChatHistory: () => void;
  onOpenDeleteChatConfirm: () => void;
};

export function ChatHeader({
  selectedChat,
  selectedChatPresentation,
  selectedChatSubtitle,
  isChatActionsMenuOpen,
  onOpenGroupManagement,
  onOpenDirectProfile,
  onOpenDocumentsPanel,
  onToggleChatActionsMenu,
  onClearSelectedChatHistory,
  onOpenDeleteChatConfirm,
}: ChatHeaderProps) {
  function handleOpenChatInfo() {
    if (selectedChat.type === 'GROUP') {
      onOpenGroupManagement();
    }
    else if (selectedChat.type === 'DIRECT' && selectedChatPresentation.companionProfile) {
      onOpenDirectProfile();
    }
  }

  return (
    <header className="flex h-[84px] items-center justify-between border-b border-white/10 bg-[#16171d]/82 px-7 shadow-lg shadow-black/10 backdrop-blur-2xl">
      <div className="flex min-w-0 items-center gap-4">
        <button
          type="button"
          onClick={handleOpenChatInfo}
          className="flex min-w-0 items-center gap-4 rounded-3xl px-1 py-1 text-left transition hover:bg-white/[0.04]"
          title={selectedChat.type === 'GROUP' ? 'Открыть участников группы' : 'Открыть профиль'}
        >
          {selectedChat.type === 'SELF'
            ? (
              <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-lg shadow-black/20">
                <Star size={20} />
              </div>
              )
            : <UserAvatar label={selectedChatPresentation.avatarLabel} imageUrl={getAccountAvatarUrl(selectedChatPresentation.companionProfile)} size="lg" />}

          <div className="min-w-0">
            <div className="truncate text-lg font-semibold text-zinc-50 transition group-hover:text-violet-100">
              {selectedChatPresentation.title}
            </div>
            <div className="mt-1 truncate text-sm text-zinc-500">
              {selectedChatSubtitle}
            </div>
          </div>
        </button>
      </div>

      <div className="flex items-center gap-2">
        {selectedChat.type === 'GROUP' && (
          <button
            onClick={onOpenGroupManagement}
            className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-zinc-300 transition hover:border-violet-300/25 hover:text-white"
            title="Участники группы"
          >
            <Users size={14} />
            Участники
          </button>
        )}
        <button
          onClick={onOpenDocumentsPanel}
          className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-zinc-300 transition hover:border-violet-300/25 hover:text-white"
          title="Документооборот"
        >
          <ShieldCheck size={14} />
          Документы
        </button>
        <div className="relative">
          <button
            onClick={onToggleChatActionsMenu}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-zinc-300 transition hover:border-violet-300/25 hover:text-white"
            title="Действия с чатом"
          >
            <MoreVertical size={16} />
          </button>

          {isChatActionsMenuOpen && (
            <div className="absolute right-0 top-11 z-30 w-64 rounded-3xl border border-white/10 bg-[#202127] p-2 text-sm shadow-2xl shadow-black/50">
              <button
                type="button"
                onClick={onClearSelectedChatHistory}
                className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left text-zinc-200 transition hover:bg-white/[0.06]"
              >
                <Eraser size={17} className="text-zinc-400" />
                Очистить историю у меня
              </button>
              {selectedChat.type !== 'SELF' && (
                <button
                  type="button"
                  onClick={onOpenDeleteChatConfirm}
                  className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left text-red-200 transition hover:bg-red-500/10"
                >
                  <Trash2 size={17} />
                  Удалить чат
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
