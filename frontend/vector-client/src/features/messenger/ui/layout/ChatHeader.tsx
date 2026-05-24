import { Ban, Eraser, LogOut, MoreVertical, Pin, PinOff, ShieldCheck, Star, Trash2, Users } from 'lucide-react';
import { getAccountAvatarUrl, type ChatPresentation, UserAvatar } from '../../lib/messengerCore';
import type { ChatResponseDto } from '../../../../shared/types/api';

type ChatHeaderProps = {
  selectedChat: ChatResponseDto;
  selectedChatPresentation: ChatPresentation;
  selectedChatSubtitle: string;
  isChatActionsMenuOpen: boolean;
  isPinned: boolean;
  canLeaveGroup: boolean;
  onOpenGroupManagement: () => void;
  onOpenDirectProfile: () => void;
  onToggleChatActionsMenu: () => void;
  onTogglePinned: () => void;
  onClearSelectedChatHistory: () => void;
  onOpenDeleteChatConfirm: () => void;
  onBlockDirectCompanion: () => void;
  onUnblockDirectCompanion: () => void;
  onLeaveGroup: () => void;
};

export function ChatHeader({
  selectedChat,
  selectedChatPresentation,
  selectedChatSubtitle,
  isChatActionsMenuOpen,
  isPinned,
  canLeaveGroup,
  onOpenGroupManagement,
  onOpenDirectProfile,
  onToggleChatActionsMenu,
  onTogglePinned,
  onClearSelectedChatHistory,
  onOpenDeleteChatConfirm,
  onBlockDirectCompanion,
  onUnblockDirectCompanion,
  onLeaveGroup,
}: ChatHeaderProps) {
  function handleOpenChatInfo() {
    if (selectedChat.type === 'GROUP') {
      onOpenGroupManagement();
    }
    else if (selectedChat.type === 'DIRECT') {
      onOpenDirectProfile();
    }
  }

  return (
    <header className="relative z-40 flex h-[86px] items-center justify-between border-b border-white/10 bg-[#11131b]/78 px-7 shadow-xl shadow-black/14 backdrop-blur-2xl">
      <div className="flex min-w-0 items-center gap-4">
        <button
          type="button"
          onClick={handleOpenChatInfo}
          className="group flex min-w-0 items-center gap-4 rounded-3xl px-2 py-2 text-left transition hover:bg-white/[0.045]"
          title={selectedChat.type === 'GROUP' ? 'Открыть участников группы' : 'Открыть профиль'}
        >
          {selectedChat.type === 'SELF'
            ? (
              <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-lg shadow-black/20">
                <Star size={20} />
              </div>
              )
            : <UserAvatar label={selectedChatPresentation.avatarLabel} imageUrl={selectedChat.type === 'GROUP' ? selectedChat.avatarDataUrl : getAccountAvatarUrl(selectedChatPresentation.companionProfile)} size="lg" />}

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
            className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.055] px-3.5 py-2 text-xs font-medium text-zinc-300 shadow-lg shadow-black/10 transition hover:border-violet-300/30 hover:bg-white/[0.075] hover:text-white"
            title="Участники группы"
          >
            <Users size={14} />
            Участники
          </button>
        )}
        <div className="relative">
          <button
            onClick={onToggleChatActionsMenu}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.055] text-zinc-300 shadow-lg shadow-black/10 transition hover:border-violet-300/30 hover:bg-white/[0.075] hover:text-white"
            title="Действия с чатом"
          >
            <MoreVertical size={16} />
          </button>

          {isChatActionsMenuOpen && (
            <div className="absolute right-0 top-12 z-[140] w-64 rounded-3xl border border-white/10 bg-[#171923] p-2 text-sm shadow-2xl shadow-black/60">
              {selectedChat.type !== 'SELF' && (
                <button
                  type="button"
                  onClick={onTogglePinned}
                  className="flex min-h-12 w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-zinc-200 transition hover:bg-white/[0.06]"
                >
                  {isPinned ? <PinOff size={17} className="text-zinc-400" /> : <Pin size={17} className="text-zinc-400" />}
                  {isPinned ? 'Открепить чат' : 'Закрепить чат'}
                </button>
              )}
              <button
                type="button"
                onClick={onClearSelectedChatHistory}
                className="flex min-h-12 w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-zinc-200 transition hover:bg-white/[0.06]"
              >
                <Eraser size={17} className="text-zinc-400" />
                Очистить историю
              </button>
              {selectedChat.type === 'GROUP' && canLeaveGroup && (
                <button
                  type="button"
                  onClick={onLeaveGroup}
                  className="flex min-h-12 w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-amber-100 transition hover:bg-amber-500/10"
                >
                  <LogOut size={17} />
                  Покинуть группу
                </button>
              )}
              {selectedChat.type === 'DIRECT' && !selectedChat.currentAccountBlockedCompanion && (
                <button
                  type="button"
                  onClick={onBlockDirectCompanion}
                  className="flex min-h-12 w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-amber-100 transition hover:bg-amber-500/10"
                >
                  <Ban size={17} />
                  Заблокировать пользователя
                </button>
              )}
              {selectedChat.type === 'DIRECT' && selectedChat.currentAccountBlockedCompanion && (
                <button
                  type="button"
                  onClick={onUnblockDirectCompanion}
                  className="flex min-h-12 w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-emerald-100 transition hover:bg-emerald-500/10"
                >
                  <ShieldCheck size={17} />
                  Разблокировать пользователя
                </button>
              )}
              {selectedChat.type !== 'SELF' && (
                <button
                  type="button"
                  onClick={onOpenDeleteChatConfirm}
                  className="flex min-h-12 w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-red-200 transition hover:bg-red-500/10"
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
