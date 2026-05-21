import { KeyboardEvent, useMemo, useState } from 'react';
import { FileText, Image as ImageIcon, LoaderCircle, MessageSquare, Paperclip, Send, ShieldCheck, Smile, Sparkles, X } from 'lucide-react';

export type ChatAttachmentDisplayMode = 'FILE' | 'IMAGE';

export type ComposerReplyPreview = {
  senderName: string;
  preview: string;
};

export type ComposerForwardPreview = {
  count: number;
};

type EmojiCategory = {
  id: string;
  title: string;
  icon: string;
  items: string[];
};

const EMOJI_CATEGORIES: EmojiCategory[] = [
  {
    id: 'emotions',
    title: 'Эмоции',
    icon: '🙂',
    items: ['😀', '😃', '😄', '😁', '😆', '😊', '😉', '😍', '😘', '😎', '😂', '😅', '😌', '😋', '😜', '🤔', '😮', '😢', '😡', '😴', '😇'],
  },
  {
    id: 'gestures',
    title: 'Жесты',
    icon: '👍',
    items: ['👍', '👎', '👏', '🙏', '👌', '✌️', '🤝', '💪', '👀'],
  },
  {
    id: 'work',
    title: 'Работа',
    icon: '💼',
    items: ['✅', '❌', '⚠️', '📌', '📎', '📝', '📄', '📁', '📊', '📈', '📉', '💼', '💻', '🔒', '🔑', '🛡️', '⚙️', '🚀', '🎯', '🏆', '💡'],
  },
  {
    id: 'symbols',
    title: 'Символы',
    icon: '❤️',
    items: ['❤️', '💜', '💙', '💚', '💛', '⭐', '✨', '🔥', '💥', '☕', '🎁', '🎉', '🎵', '📷', '🌙', '☀️', '❄️', '⚡'],
  },
];

type ChatComposerProps = {
  messageText: string;
  placeholder: string;
  isSending: boolean;
  isUploadingFile: boolean;
  isWritable: boolean;
  onMessageTextChange: (value: string) => void;
  onMessageBlur: () => void;
  onTextareaKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
  onAttachFile: (file: File | null | undefined, attachmentDisplayMode: ChatAttachmentDisplayMode) => Promise<void>;
  onAttachDocument: (file: File | null | undefined) => Promise<void>;
  onOpenDocumentsPanel: () => Promise<void>;
  onAppendEmoji: (emoji: string) => void;
  replyPreview?: ComposerReplyPreview | null;
  forwardPreview?: ComposerForwardPreview | null;
  canSendWithoutText?: boolean;
  onCancelReply?: () => void;
  onCancelForward?: () => void;
  onSendCurrentMessage: () => Promise<void>;
};

function ComposerActionButton({
  title,
  disabled,
  children,
  onClick,
}: {
  title: string;
  disabled?: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.045] text-zinc-300 transition hover:border-violet-300/35 hover:bg-white/[0.08] hover:text-white disabled:cursor-not-allowed disabled:opacity-45"
      title={title}
    >
      {children}
    </button>
  );
}

export function ChatComposer({
  messageText,
  placeholder,
  isSending,
  isUploadingFile,
  isWritable,
  onMessageTextChange,
  onMessageBlur,
  onTextareaKeyDown,
  onAttachFile,
  onAttachDocument,
  onOpenDocumentsPanel,
  onAppendEmoji,
  replyPreview,
  forwardPreview,
  canSendWithoutText = false,
  onCancelReply,
  onCancelForward,
  onSendCurrentMessage,
}: ChatComposerProps) {
  const [isAttachmentMenuOpen, setIsAttachmentMenuOpen] = useState(false);
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);
  const [activeEmojiCategoryId, setActiveEmojiCategoryId] = useState(EMOJI_CATEGORIES[0].id);
  const activeEmojiCategory = useMemo(() => (
    EMOJI_CATEGORIES.find((emojiCategory) => emojiCategory.id === activeEmojiCategoryId) ?? EMOJI_CATEGORIES[0]
  ), [activeEmojiCategoryId]);

  async function handleOpenDocumentsPanel() {
    setIsAttachmentMenuOpen(false);
    await onOpenDocumentsPanel();
  }

  function handleEmojiClick(emoji: string) {
    onAppendEmoji(emoji);
  }

  return (
    <div className="border-t border-white/8 bg-[#15161c]/92 px-5 py-4 backdrop-blur-2xl">
      <div className="mx-auto max-w-4xl">
        <input
          type="file"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0] ?? null;
            event.target.value = '';
            setIsAttachmentMenuOpen(false);
            void onAttachFile(file, 'FILE');
          }}
          id="vector-composer-file-input"
        />

        <input
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0] ?? null;
            event.target.value = '';
            setIsAttachmentMenuOpen(false);
            void onAttachFile(file, 'IMAGE');
          }}
          id="vector-composer-image-input"
        />

        <input
          type="file"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0] ?? null;
            event.target.value = '';
            setIsAttachmentMenuOpen(false);
            void onAttachDocument(file);
          }}
          id="vector-composer-document-input"
        />

        {(replyPreview || forwardPreview) && (
          <div className="mb-3 space-y-2">
            {replyPreview && (
              <div className="flex items-center gap-3 rounded-3xl border border-violet-300/18 bg-violet-500/10 px-4 py-3 shadow-lg shadow-violet-950/10">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-violet-400/15 text-violet-200">
                  <MessageSquare size={18} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-violet-200/80">Ответ</div>
                  <div className="mt-0.5 truncate text-sm font-medium text-zinc-100">{replyPreview.senderName}</div>
                  <div className="mt-0.5 truncate text-xs text-zinc-400">{replyPreview.preview}</div>
                </div>
                <button
                  type="button"
                  onClick={onCancelReply}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl text-zinc-400 transition hover:bg-white/[0.08] hover:text-white"
                  title="Убрать ответ"
                >
                  <X size={17} />
                </button>
              </div>
            )}
            {forwardPreview && (
              <div className="flex items-center gap-3 rounded-3xl border border-sky-300/16 bg-sky-500/10 px-4 py-3 shadow-lg shadow-sky-950/10">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-sky-400/15 text-sky-200">
                  <Send size={17} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-200/80">Пересылка</div>
                  <div className="mt-0.5 truncate text-sm text-zinc-100">{forwardPreview.count} {forwardPreview.count === 1 ? 'сообщение' : 'сообщений'} будет добавлено к отправке</div>
                </div>
                <button
                  type="button"
                  onClick={onCancelForward}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl text-zinc-400 transition hover:bg-white/[0.08] hover:text-white"
                  title="Убрать пересылку"
                >
                  <X size={17} />
                </button>
              </div>
            )}
          </div>
        )}

        <div className="relative flex items-end gap-3 rounded-[1.85rem] border border-white/10 bg-white/[0.052] px-4 py-3 shadow-2xl shadow-black/24">
          <div className="relative">
            <ComposerActionButton
              title="Прикрепить"
              disabled={isSending || isUploadingFile || !isWritable}
              onClick={() => setIsAttachmentMenuOpen((previousValue) => !previousValue)}
            >
              {isUploadingFile ? <LoaderCircle size={18} className="animate-spin" /> : <Paperclip size={19} />}
            </ComposerActionButton>

            {isAttachmentMenuOpen && (
              <div className="absolute bottom-[58px] left-0 z-20 w-72 overflow-hidden rounded-3xl border border-white/10 bg-[#202128]/95 p-2 shadow-2xl shadow-black/50 backdrop-blur-xl">
                <label htmlFor="vector-composer-image-input" className="flex w-full cursor-pointer items-center gap-3 rounded-2xl px-3 py-3 text-left text-sm text-zinc-200 transition hover:bg-white/[0.07]">
                  <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-violet-500/15 text-violet-200"><ImageIcon size={18} /></span>
                  <span>
                    <span className="block font-medium">Изображение</span>
                    <span className="block text-xs text-zinc-500">Показать картинкой в ленте</span>
                  </span>
                </label>
                <label htmlFor="vector-composer-file-input" className="flex w-full cursor-pointer items-center gap-3 rounded-2xl px-3 py-3 text-left text-sm text-zinc-200 transition hover:bg-white/[0.07]">
                  <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-sky-500/15 text-sky-200"><FileText size={18} /></span>
                  <span>
                    <span className="block font-medium">Файл</span>
                    <span className="block text-xs text-zinc-500">Отправить как вложение</span>
                  </span>
                </label>
                <label htmlFor="vector-composer-document-input" className="flex w-full cursor-pointer items-center gap-3 rounded-2xl px-3 py-3 text-left text-sm text-zinc-200 transition hover:bg-white/[0.07]">
                  <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-200"><ShieldCheck size={18} /></span>
                  <span>
                    <span className="block font-medium">Документ</span>
                    <span className="block text-xs text-zinc-500">Для подписи и согласования</span>
                  </span>
                </label>
                <button
                  type="button"
                  onClick={() => void handleOpenDocumentsPanel()}
                  className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left text-sm text-zinc-200 transition hover:bg-white/[0.07]"
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-fuchsia-500/15 text-fuchsia-200"><Sparkles size={18} /></span>
                  <span>
                    <span className="block font-medium">Документы чата</span>
                    <span className="block text-xs text-zinc-500">Открыть защищённые документы</span>
                  </span>
                </button>
              </div>
            )}
          </div>

          <div className="relative">
            <ComposerActionButton
              title="Эмодзи"
              disabled={!isWritable}
              onClick={() => setIsEmojiPickerOpen((previousValue) => !previousValue)}
            >
              <Smile size={19} />
            </ComposerActionButton>

            {isEmojiPickerOpen && (
              <div className="absolute bottom-[58px] left-0 z-30 w-[330px] overflow-hidden rounded-3xl border border-white/10 bg-[#202128]/96 shadow-2xl shadow-black/60 backdrop-blur-xl">
                <div className="flex gap-1 border-b border-white/10 p-2">
                  {EMOJI_CATEGORIES.map((emojiCategory) => (
                    <button
                      type="button"
                      key={emojiCategory.id}
                      onClick={() => setActiveEmojiCategoryId(emojiCategory.id)}
                      className={`flex h-10 flex-1 items-center justify-center rounded-xl text-lg transition ${activeEmojiCategoryId === emojiCategory.id ? 'bg-violet-500/25 ring-1 ring-violet-300/25' : 'hover:bg-white/[0.07]'}`}
                      title={emojiCategory.title}
                    >
                      {emojiCategory.icon}
                    </button>
                  ))}
                </div>
                <div className="flex items-center justify-between px-4 py-3">
                  <div className="text-sm font-semibold text-zinc-200">{activeEmojiCategory.title}</div>
                  <div className="text-xs text-zinc-500">{activeEmojiCategory.items.length}</div>
                </div>
                <div className="grid max-h-[260px] grid-cols-7 gap-1 overflow-y-auto px-3 pb-3">
                  {activeEmojiCategory.items.map((emojiItem, emojiIndex) => (
                    <button
                      type="button"
                      key={`${emojiItem}-${emojiIndex}`}
                      onClick={() => handleEmojiClick(emojiItem)}
                      className="flex h-10 items-center justify-center rounded-2xl text-[22px] transition hover:bg-white/[0.08]"
                      title="Добавить эмодзи"
                    >
                      {emojiItem}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <textarea
            value={messageText}
            onChange={(event) => onMessageTextChange(event.target.value)}
            onBlur={onMessageBlur}
            onKeyDown={onTextareaKeyDown}
            onInput={(event) => {
              const textarea = event.currentTarget;
              textarea.style.height = '0px';
              textarea.style.height = `${Math.min(textarea.scrollHeight, 160)}px`;
            }}
            placeholder={placeholder}
            rows={1}
            disabled={!isWritable}
            className="max-h-40 min-h-[24px] flex-1 resize-none bg-transparent py-2 text-[15px] leading-6 text-zinc-100 outline-none placeholder:text-zinc-600 disabled:cursor-not-allowed disabled:text-zinc-600"
          />

          <button
            type="button"
            onClick={() => void onSendCurrentMessage()}
            disabled={isSending || (!messageText.trim() && !canSendWithoutText) || !isWritable}
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 via-fuchsia-500 to-pink-500 text-white shadow-lg shadow-violet-950/40 transition hover:scale-[1.02] hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100"
            title="Отправить"
          >
            {isSending && !isUploadingFile ? <LoaderCircle size={18} className="animate-spin" /> : <Send size={19} />}
          </button>
        </div>
      </div>
    </div>
  );
}
