import type { RefObject } from 'react';
import { createPortal } from 'react-dom';
import { Download, MessageSquare, Send } from 'lucide-react';
import type { DocumentAttachmentMessageContent, FileAttachmentMessageContent, MessageResponseDto } from '../../../../shared/types/api';
import { QUICK_REACTION_ITEMS, type MessageContextMenuState } from '../../lib/messengerCore';

type MessageContextMenuProps = {
  contextMenu: MessageContextMenuState | null;
  contextMenuRef: RefObject<HTMLDivElement>;
  contextMessage: MessageResponseDto | null;
  currentReaction: string | null;
  downloadableAttachment: FileAttachmentMessageContent | DocumentAttachmentMessageContent | null;
  onReply: (message: MessageResponseDto | null) => void;
  onForward: (message: MessageResponseDto | null) => void;
  onDownload: (attachment: FileAttachmentMessageContent | DocumentAttachmentMessageContent) => void;
  onReact: (messageId: string, emoji: string) => void;
};

export function MessageContextMenu({
  contextMenu,
  contextMenuRef,
  contextMessage,
  currentReaction,
  downloadableAttachment,
  onReply,
  onForward,
  onDownload,
  onReact,
}: MessageContextMenuProps) {
  if (!contextMenu) {
    return null;
  }

  const menuElement = (
    <div
      ref={contextMenuRef}
      data-message-context-menu="true"
      className="fixed z-[9999] w-64 overflow-hidden rounded-3xl border border-white/10 bg-[#202128]/96 p-2 text-sm text-zinc-100 shadow-2xl shadow-black/55 backdrop-blur-xl"
      style={{
        left: contextMenu.x,
        top: contextMenu.y,
        visibility: contextMenu.isPositioned ? 'visible' : 'hidden',
      }}
      onClick={(event) => event.stopPropagation()}
      onContextMenu={(event) => event.preventDefault()}
    >
      <div
        className={`pointer-events-none absolute top-5 h-3 w-3 rotate-45 border border-white/10 bg-[#202128] ${
          contextMenu.placement === 'left'
            ? 'right-[-0.45rem]'
            : 'left-[-0.45rem]'
        }`}
      />
      <button
        type="button"
        onClick={() => onReply(contextMessage)}
        className="flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition hover:bg-white/[0.08]"
      >
        <MessageSquare size={17} className="text-violet-200" />
        <span>Ответить</span>
      </button>
      <button
        type="button"
        onClick={() => onForward(contextMessage)}
        className="flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition hover:bg-white/[0.08]"
      >
        <Send size={17} className="text-sky-200" />
        <span>Переслать</span>
      </button>
      {downloadableAttachment && (
        <button
          type="button"
          onClick={() => onDownload(downloadableAttachment)}
          className="flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition hover:bg-white/[0.08]"
        >
          <Download size={17} className="text-emerald-200" />
          <span>Скачать</span>
        </button>
      )}
      <div className="my-2 h-px bg-white/10" />
      <div className="px-2 pb-2 text-xs font-medium text-zinc-500">Реакция</div>
      <div className="grid grid-cols-6 gap-1 px-1 pb-1">
        {QUICK_REACTION_ITEMS.map((emoji) => (
          <button
            type="button"
            key={emoji}
            onClick={() => contextMessage && onReact(contextMessage.messageId, emoji)}
            className={`flex h-9 items-center justify-center rounded-2xl text-lg transition ${currentReaction === emoji ? 'bg-violet-500/30 ring-1 ring-violet-300/30' : 'hover:bg-white/[0.08]'}`}
            title={currentReaction === emoji ? 'Убрать реакцию' : 'Поставить реакцию'}
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );

  return createPortal(menuElement, document.body);
}
