import { Send } from 'lucide-react';
import { ChatComposer, type ChatAttachmentDisplayMode, type ComposerForwardPreview, type ComposerPendingAttachment, type ComposerReplyPreview } from '../ChatComposer';
import type { ForwardSelectionState, PendingAttachmentDraft, ReplyDraft, ForwardedMessageSnapshot } from '../../../../pages/MessengerPageSupport';

type ComposerDockProps = {
  messageText: string;
  isSending: boolean;
  isUploadingFile: boolean;
  isWritable: boolean;
  forwardSelection: ForwardSelectionState | null;
  forwardDraftItems: ForwardedMessageSnapshot[];
  replyDraft: ReplyDraft | null;
  pendingAttachments: PendingAttachmentDraft[];
  onCancelForwardSelection: () => void;
  onOpenForwardChatPicker: () => void;
  onCancelReply: () => void;
  onCancelForwardDraft: () => void;
  onRemovePendingAttachment: (attachmentId: string) => void;
  onMessageTextChange: (value: string) => void;
  onMessageBlur: () => void;
  onTextareaKeyDown: (event: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onAttachFile: (file: File | null | undefined, attachmentDisplayMode: ChatAttachmentDisplayMode) => Promise<void>;
  onAttachDocument: (file: File | null | undefined) => Promise<void>;
  onOpenDocumentsPanel: () => Promise<void>;
  onAppendEmoji: (emoji: string) => void;
  onSendCurrentMessage: () => Promise<void>;
};

export function ComposerDock({
  messageText,
  isSending,
  isUploadingFile,
  isWritable,
  forwardSelection,
  forwardDraftItems,
  replyDraft,
  pendingAttachments,
  onCancelForwardSelection,
  onOpenForwardChatPicker,
  onCancelReply,
  onCancelForwardDraft,
  onRemovePendingAttachment,
  onMessageTextChange,
  onMessageBlur,
  onTextareaKeyDown,
  onAttachFile,
  onAttachDocument,
  onOpenDocumentsPanel,
  onAppendEmoji,
  onSendCurrentMessage,
}: ComposerDockProps) {
  if (forwardSelection) {
    return (
      <div className="border-t border-white/8 bg-[#10121a]/88 px-5 py-4 shadow-[0_-18px_60px_rgba(0,0,0,0.22)] backdrop-blur-2xl">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-4">
          <button
            type="button"
            onClick={onCancelForwardSelection}
            className="rounded-2xl border border-white/10 px-4 py-2 text-sm text-zinc-300 transition hover:bg-white/[0.06] hover:text-white"
          >
            Отмена
          </button>
          <div className="min-w-0 flex-1 text-center">
            <div className="text-sm font-semibold text-zinc-100">Выбрано: {forwardSelection.selectedMessageIds.length}</div>
            <div className="mt-0.5 text-xs text-zinc-500">Нажмите на сообщения, которые нужно переслать</div>
          </div>
          <button
            type="button"
            onClick={onOpenForwardChatPicker}
            disabled={forwardSelection.selectedMessageIds.length === 0}
            className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-br from-violet-500 via-fuchsia-500 to-pink-500 px-5 py-3 text-sm font-semibold text-white shadow-2xl shadow-violet-950/35 transition hover:brightness-110 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-45"
          >
            Переслать
            <Send size={16} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <ChatComposer
      messageText={messageText}
      placeholder={isWritable ? 'Напишите сообщение…' : 'Вы исключены из группы'}
      isSending={isSending}
      isUploadingFile={isUploadingFile}
      isWritable={isWritable}
      replyPreview={replyDraft ? ({ senderName: replyDraft.senderName, preview: replyDraft.preview } satisfies ComposerReplyPreview) : null}
      forwardPreview={forwardDraftItems.length > 0 ? ({ count: forwardDraftItems.length } satisfies ComposerForwardPreview) : null}
      pendingAttachments={pendingAttachments.map((attachment) => ({
        id: attachment.id,
        fileName: attachment.file.name,
        sizeBytes: attachment.file.size,
        attachmentDisplayMode: attachment.attachmentDisplayMode,
      } satisfies ComposerPendingAttachment))}
      canSendWithoutText={forwardDraftItems.length > 0 || pendingAttachments.length > 0}
      onCancelReply={onCancelReply}
      onCancelForward={onCancelForwardDraft}
      onRemovePendingAttachment={onRemovePendingAttachment}
      onMessageTextChange={onMessageTextChange}
      onMessageBlur={onMessageBlur}
      onTextareaKeyDown={onTextareaKeyDown}
      onAttachFile={onAttachFile}
      onAttachDocument={onAttachDocument}
      onOpenDocumentsPanel={onOpenDocumentsPanel}
      onAppendEmoji={onAppendEmoji}
      onSendCurrentMessage={onSendCurrentMessage}
    />
  );
}
