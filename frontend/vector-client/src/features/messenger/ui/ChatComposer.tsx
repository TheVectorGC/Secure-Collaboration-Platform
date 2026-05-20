import { KeyboardEvent, useMemo, useState } from 'react';
import { FileText, Image as ImageIcon, LoaderCircle, Paperclip, Send, ShieldCheck, Smile, Sparkles } from 'lucide-react';

export type ChatAttachmentDisplayMode = 'FILE' | 'IMAGE';

type EmojiCategory = {
  id: string;
  title: string;
  icon: string;
  items: string[];
};

const EMOJI_CATEGORIES: EmojiCategory[] = [
  {
    id: 'recent',
    title: 'Частые',
    icon: '🕘',
    items: ['😀', '😄', '😁', '😊', '😉', '😍', '😘', '😎', '😂', '😅', '🥰', '😇', '🙂', '😌', '😋', '😜', '🤔', '😮', '😢', '😡'],
  },
  {
    id: 'people',
    title: 'Эмоции',
    icon: '🙂',
    items: ['😀', '😃', '😄', '😁', '😆', '😊', '😉', '😍', '😘', '😗', '😙', '😚', '😋', '😛', '😜', '😝', '😎', '😏', '😒', '😔', '😢', '😭', '😤', '😡', '😱', '😴', '😇', '🤓', '🤝', '👍', '👎', '👏', '🙏', '👌', '✌️', '👀'],
  },
  {
    id: 'work',
    title: 'Работа',
    icon: '💼',
    items: ['✅', '❌', '⚠️', '📌', '📎', '📝', '📄', '📁', '📊', '📈', '📉', '💼', '💻', '🖥️', '⌨️', '🖱️', '🔒', '🔑', '🛡️', '⚙️', '🚀', '🎯', '🏆', '💡'],
  },
  {
    id: 'objects',
    title: 'Объекты',
    icon: '⭐',
    items: ['❤️', '💜', '💙', '💚', '💛', '⭐', '✨', '🔥', '💥', '☕', '🍕', '🍔', '🍎', '🎁', '🎉', '🎵', '🎬', '📷', '🌙', '☀️', '☁️', '❄️', '⚡', '🌍'],
  },
];

const STICKER_PACKS = [
  {
    id: 'vector-cats',
    title: 'Коты',
    items: ['🐱', '😺', '😸', '😻', '🙀', '😿', '😾', '🐾'],
  },
  {
    id: 'work-energy',
    title: 'Рабочий вайб',
    items: ['🚀', '🔥', '✨', '💎', '🏆', '🎯', '💡', '⚡'],
  },
  {
    id: 'soft-reactions',
    title: 'Реакции',
    items: ['👍', '🤝', '❤️', '👏', '🙏', '👌', '✅', '⭐'],
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
  onSendSticker: (sticker: string) => void;
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
      className="group flex h-[52px] w-[52px] items-center justify-center rounded-2xl border border-white/10 bg-white/[0.055] text-zinc-300 shadow-inner shadow-white/[0.03] transition hover:border-violet-300/30 hover:bg-white/[0.08] hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
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
  onSendSticker,
  onSendCurrentMessage,
}: ChatComposerProps) {
  const [isAttachmentMenuOpen, setIsAttachmentMenuOpen] = useState(false);
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);
  const [emojiSearchQuery, setEmojiSearchQuery] = useState('');
  const [activeEmojiCategoryId, setActiveEmojiCategoryId] = useState(EMOJI_CATEGORIES[0].id);
  const [activeStickerPackId, setActiveStickerPackId] = useState(STICKER_PACKS[0].id);
  const activeStickerPack = STICKER_PACKS.find((stickerPack) => stickerPack.id === activeStickerPackId) ?? STICKER_PACKS[0];
  const activeEmojiCategory = EMOJI_CATEGORIES.find((emojiCategory) => emojiCategory.id === activeEmojiCategoryId) ?? EMOJI_CATEGORIES[0];
  const filteredEmojiItems = useMemo(() => {
    const normalizedQuery = emojiSearchQuery.trim().toLowerCase();

    if (!normalizedQuery) {
      return activeEmojiCategory.items;
    }

    const searchableItems = EMOJI_CATEGORIES.flatMap((emojiCategory) => emojiCategory.items);
    const uniqueItems = Array.from(new Set(searchableItems));

    return uniqueItems.filter((emojiItem) => emojiItem.includes(normalizedQuery));
  }, [activeEmojiCategory.items, emojiSearchQuery]);

  async function handleOpenDocumentsPanel() {
    setIsAttachmentMenuOpen(false);
    await onOpenDocumentsPanel();
  }

  return (
    <div className="border-t border-white/10 bg-[#15161c]/88 p-5 backdrop-blur-2xl">
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

        <div className="relative flex items-end gap-3 rounded-[2rem] border border-white/10 bg-white/[0.055] px-4 py-3 shadow-2xl shadow-black/25 ring-1 ring-white/[0.025]">
          <div className="pointer-events-none absolute inset-x-5 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent" />

          <div className="relative">
            <ComposerActionButton
              title="Прикрепить"
              disabled={isSending || isUploadingFile || !isWritable}
              onClick={() => setIsAttachmentMenuOpen((previousValue) => !previousValue)}
            >
              {isUploadingFile ? <LoaderCircle size={18} className="animate-spin" /> : <Paperclip size={19} />}
            </ComposerActionButton>

            {isAttachmentMenuOpen && (
              <div className="absolute bottom-[62px] left-0 z-20 w-72 overflow-hidden rounded-3xl border border-white/10 bg-[#202128]/95 p-2 shadow-2xl shadow-black/50 backdrop-blur-xl">
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
              title="Эмодзи и стикеры"
              disabled={!isWritable}
              onClick={() => setIsEmojiPickerOpen((previousValue) => !previousValue)}
            >
              <Smile size={19} />
            </ComposerActionButton>

            {isEmojiPickerOpen && (
              <div className="absolute bottom-[62px] left-0 z-30 w-[420px] overflow-hidden rounded-[1.75rem] border border-white/10 bg-[#1f2027]/95 shadow-2xl shadow-black/60 backdrop-blur-xl">
                <div className="grid h-[460px] grid-cols-[1fr_116px]">
                  <div className="flex min-w-0 flex-col border-r border-white/10">
                    <div className="p-3">
                      <input
                        value={emojiSearchQuery}
                        onChange={(event) => setEmojiSearchQuery(event.target.value)}
                        className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-violet-300/30"
                        placeholder="Поиск эмодзи"
                      />
                    </div>
                    <div className="flex gap-1 border-y border-white/10 px-3 py-2">
                      {EMOJI_CATEGORIES.map((emojiCategory) => (
                        <button
                          type="button"
                          key={emojiCategory.id}
                          onClick={() => {
                            setActiveEmojiCategoryId(emojiCategory.id);
                            setEmojiSearchQuery('');
                          }}
                          className={`flex h-10 flex-1 items-center justify-center rounded-xl text-lg transition ${activeEmojiCategoryId === emojiCategory.id && !emojiSearchQuery.trim() ? 'bg-violet-500/25 ring-1 ring-violet-300/25' : 'hover:bg-white/[0.07]'}`}
                          title={emojiCategory.title}
                        >
                          {emojiCategory.icon}
                        </button>
                      ))}
                    </div>
                    <div className="flex items-center justify-between px-4 py-3">
                      <div className="text-sm font-semibold text-zinc-200">{emojiSearchQuery.trim() ? 'Результаты поиска' : activeEmojiCategory.title}</div>
                      <div className="text-xs text-zinc-500">{filteredEmojiItems.length}</div>
                    </div>
                    <div className="grid flex-1 auto-rows-[42px] grid-cols-7 gap-1 overflow-y-auto px-3 pb-3">
                      {filteredEmojiItems.map((emojiItem, emojiIndex) => (
                        <button
                          type="button"
                          key={`${emojiItem}-${emojiIndex}`}
                          onClick={() => onAppendEmoji(emojiItem)}
                          className="flex items-center justify-center rounded-2xl text-2xl transition hover:bg-white/[0.08]"
                          title="Добавить эмодзи"
                        >
                          {emojiItem}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex min-w-0 flex-col bg-black/12">
                    <div className="border-b border-white/10 px-3 py-3">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">Стикеры</div>
                      <div className="mt-1 text-xs text-zinc-400">Быстрая отправка</div>
                    </div>
                    <div className="flex gap-1 border-b border-white/10 p-2">
                      {STICKER_PACKS.map((stickerPack) => (
                        <button
                          type="button"
                          key={stickerPack.id}
                          onClick={() => setActiveStickerPackId(stickerPack.id)}
                          className={`h-9 flex-1 rounded-xl text-lg transition ${activeStickerPackId === stickerPack.id ? 'bg-violet-500/25 ring-1 ring-violet-300/25' : 'hover:bg-white/[0.07]'}`}
                          title={stickerPack.title}
                        >
                          {stickerPack.items[0]}
                        </button>
                      ))}
                    </div>
                    <div className="grid grid-cols-2 gap-2 overflow-y-auto p-3">
                      {activeStickerPack.items.map((sticker) => (
                        <button
                          type="button"
                          key={sticker}
                          onClick={() => {
                            setIsEmojiPickerOpen(false);
                            onSendSticker(sticker);
                          }}
                          className="flex h-16 items-center justify-center rounded-2xl bg-white/[0.045] text-4xl transition hover:scale-[1.03] hover:bg-violet-500/15"
                          title="Отправить стикер"
                        >
                          {sticker}
                        </button>
                      ))}
                    </div>
                  </div>
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
            disabled={isSending || !messageText.trim() || !isWritable}
            className="flex h-[52px] w-[52px] items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 via-fuchsia-500 to-pink-500 text-white shadow-lg shadow-violet-950/40 transition hover:scale-[1.02] hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100"
            title="Отправить"
          >
            {isSending && !isUploadingFile ? <LoaderCircle size={18} className="animate-spin" /> : <Send size={19} />}
          </button>
        </div>
      </div>
    </div>
  );
}
