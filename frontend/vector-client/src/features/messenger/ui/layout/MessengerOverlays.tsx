import { useState } from 'react';
import { X, Image as ImageIcon, FileText } from 'lucide-react';
import { DevAccountPanel } from '../../../admin/ui/DevAccountPanel';
import type { ChatAttachmentDisplayMode } from '../ChatComposer';
import type { ChatResponseDto } from '../../../../shared/types/api';
import { getDirectCompanionAccountId } from '../../../../shared/lib/profile';

type MessengerOverlaysProps = {
  selectedChat: ChatResponseDto | null;
  currentAccountId: string | undefined;
  isDeleteChatConfirmOpen: boolean;
  isBlockUserConfirmOpen: boolean;
  isClearHistoryConfirmOpen: boolean;
  droppedImageFiles: File[];
  isDraggingFileOverChat: boolean;
  isSelectedChatWritable: boolean;
  isDevToolsOpen: boolean;
  isAdmin: boolean;
  onCloseDeleteChatConfirm: () => void;
  onCloseBlockUserConfirm: () => void;
  onCloseClearHistoryConfirm: () => void;
  onClearSelectedChatHistory: () => void;
  onDeleteSelectedChatLocally: (options?: { blockedAccountId?: string | null }) => void | Promise<void>;
  onBlockDirectCompanion: () => void | Promise<void>;
  onSendDroppedImages: (attachmentDisplayMode: ChatAttachmentDisplayMode) => void;
  onClearDroppedImageFiles: () => void;
  onCloseDraggingFileOverlay: () => void;
  onCloseDevTools: () => void;
};

export function MessengerOverlays({
  selectedChat,
  currentAccountId,
  isDeleteChatConfirmOpen,
  isBlockUserConfirmOpen,
  isClearHistoryConfirmOpen,
  droppedImageFiles,
  isDraggingFileOverChat,
  isSelectedChatWritable,
  isDevToolsOpen,
  isAdmin,
  onCloseDeleteChatConfirm,
  onCloseBlockUserConfirm,
  onCloseClearHistoryConfirm,
  onClearSelectedChatHistory,
  onDeleteSelectedChatLocally,
  onBlockDirectCompanion,
  onSendDroppedImages,
  onClearDroppedImageFiles,
  onCloseDraggingFileOverlay,
  onCloseDevTools,
}: MessengerOverlaysProps) {
  const [shouldBlockUser, setShouldBlockUser] = useState(false);
  const directCompanionAccountId = selectedChat?.type === 'DIRECT' ? getDirectCompanionAccountId(selectedChat, currentAccountId) : null;

  function closeDeleteConfirmation() {
    setShouldBlockUser(false);
    onCloseDeleteChatConfirm();
  }

  function confirmDeleteChat() {
    void onDeleteSelectedChatLocally({
      blockedAccountId: shouldBlockUser ? directCompanionAccountId : null,
    });
    setShouldBlockUser(false);
  }

  function confirmBlockUser() {
    void onBlockDirectCompanion();
    onCloseBlockUserConfirm();
  }

  return (
    <>
      {isClearHistoryConfirmOpen && selectedChat && (
        <div className="absolute inset-0 z-[110] flex items-center justify-center bg-black/60 p-4 backdrop-blur-md">
          <div className="vector-surface-card w-full max-w-md p-5">
            <div className="text-lg font-semibold text-white">Очистить историю?</div>
            <div className="mt-2 text-sm leading-6 text-zinc-400">
              Сообщения будут скрыты только на этом устройстве. Новые сообщения продолжат появляться в чате.
            </div>
            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={onCloseClearHistoryConfirm}
                className="rounded-2xl border border-white/10 px-4 py-2 text-sm text-zinc-300 transition hover:bg-white/[0.06] hover:text-white"
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={onClearSelectedChatHistory}
                className="rounded-2xl bg-violet-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-violet-400"
              >
                Очистить
              </button>
            </div>
          </div>
        </div>
      )}


      {isBlockUserConfirmOpen && selectedChat?.type === 'DIRECT' && (
        <div className="absolute inset-0 z-[110] flex items-center justify-center bg-black/60 p-4 backdrop-blur-md">
          <div className="vector-surface-card w-full max-w-md p-5">
            <div className="text-lg font-semibold text-white">Заблокировать пользователя?</div>
            <div className="mt-2 text-sm leading-6 text-zinc-400">
              Пользователь не сможет писать вам в этот личный чат. Разблокировать его можно будет из меню чата.
            </div>
            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={onCloseBlockUserConfirm}
                className="rounded-2xl border border-white/10 px-4 py-2 text-sm text-zinc-300 transition hover:bg-white/[0.06] hover:text-white"
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={confirmBlockUser}
                className="rounded-2xl bg-amber-500/90 px-4 py-2 text-sm font-semibold text-white transition hover:bg-amber-400"
              >
                Заблокировать
              </button>
            </div>
          </div>
        </div>
      )}

      {isDeleteChatConfirmOpen && selectedChat && (
        <div className="absolute inset-0 z-[110] flex items-center justify-center bg-black/60 p-4 backdrop-blur-md">
          <div className="vector-surface-card w-full max-w-md p-5">
            <div className="text-lg font-semibold text-white">Удалить чат?</div>
            <div className="mt-2 text-sm leading-6 text-zinc-400">
              Чат исчезнет из списка на этом устройстве. История переписки не очищается и может снова появиться, если собеседник напишет новое сообщение.
            </div>
            {directCompanionAccountId && (
              <label className="mt-5 flex cursor-pointer items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.035] px-4 py-3 text-sm text-zinc-200 transition hover:bg-white/[0.055]">
                <input
                  type="checkbox"
                  checked={shouldBlockUser}
                  onChange={(event) => setShouldBlockUser(event.target.checked)}
                  className="h-4 w-4 accent-violet-500"
                />
                Заблокировать пользователя
              </label>
            )}
            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={closeDeleteConfirmation}
                className="rounded-2xl border border-white/10 px-4 py-2 text-sm text-zinc-300 transition hover:bg-white/[0.06] hover:text-white"
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={confirmDeleteChat}
                className="rounded-2xl bg-red-500/90 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-400"
              >
                Удалить чат
              </button>
            </div>
          </div>
        </div>
      )}

      {droppedImageFiles.length > 0 && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-md">
          <div className="vector-surface-card w-full max-w-md p-5">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-violet-500/15 text-violet-100">
                <ImageIcon size={22} />
              </div>
              <div className="min-w-0">
                <div className="text-lg font-semibold text-white">Как отправить изображения?</div>
                <div className="mt-1 truncate text-sm text-zinc-500">{droppedImageFiles.length === 1 ? droppedImageFiles[0].name : `${droppedImageFiles.length} изображений`}</div>
              </div>
            </div>
            <div className="mt-5 grid gap-3">
              <button
                type="button"
                onClick={() => onSendDroppedImages('IMAGE')}
                className="flex w-full items-center gap-3 rounded-2xl border border-violet-300/20 bg-violet-500/12 px-4 py-3 text-left text-sm text-violet-50 transition hover:bg-violet-500/18"
              >
                <ImageIcon size={18} />
                <span>
                  <span className="block font-semibold">Отправить как изображение</span>
                  <span className="block text-xs text-violet-100/60">Будет показано картинкой в ленте.</span>
                </span>
              </button>
              <button
                type="button"
                onClick={() => onSendDroppedImages('FILE')}
                className="flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.045] px-4 py-3 text-left text-sm text-zinc-100 transition hover:bg-white/[0.075]"
              >
                <FileText size={18} />
                <span>
                  <span className="block font-semibold">Отправить как файл</span>
                  <span className="block text-xs text-zinc-500">Сохранится как обычное вложение.</span>
                </span>
              </button>
            </div>
            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={onClearDroppedImageFiles}
                className="rounded-2xl border border-white/10 px-4 py-2 text-sm text-zinc-300 transition hover:bg-white/[0.06] hover:text-white"
              >
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}

      {isDraggingFileOverChat && isSelectedChatWritable && (
        <div className="absolute inset-4 z-50 flex items-center justify-center rounded-[2rem] border-2 border-dashed border-violet-300/45 bg-violet-500/12 text-lg font-semibold text-violet-100 shadow-2xl shadow-violet-950/30 backdrop-blur-xl">
          <button
            type="button"
            onClick={onCloseDraggingFileOverlay}
            className="absolute right-5 top-5 flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-black/25 text-zinc-300 transition hover:bg-white/10 hover:text-white"
            title="Закрыть"
          >
            <X size={18} />
          </button>
          <div className="pointer-events-none text-center">
            <div>Отпустите файл, чтобы прикрепить его к чату</div>
            <div className="mt-2 text-sm font-normal text-violet-100/65">Или нажмите крестик, чтобы закрыть подсказку</div>
          </div>
        </div>
      )}

      {isDevToolsOpen && isAdmin && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/55 p-4 backdrop-blur-md">
          <div className="vector-surface-card w-full max-w-lg p-6">
            <div className="mb-5 flex items-center justify-between gap-4">
              <div>
                <div className="text-xl font-semibold text-zinc-50">Инструменты разработки</div>
                <div className="mt-1 text-sm text-zinc-500">
                  Спрятано из основного интерфейса. Открывается по кнопке или Ctrl + Shift + D.
                </div>
              </div>
              <button
                onClick={onCloseDevTools}
                className="rounded-2xl border border-white/10 bg-white/[0.04] p-2 text-zinc-400 transition hover:text-zinc-100"
              >
                <X size={18} />
              </button>
            </div>
            <DevAccountPanel />
          </div>
        </div>
      )}
    </>
  );
}
