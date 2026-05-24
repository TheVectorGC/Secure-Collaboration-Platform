import { MessageCircle, X } from 'lucide-react';

export function EmptyChatState() {
  return (
    <div className="flex flex-1 items-center justify-center px-8">
      <div className="vector-surface-card max-w-lg p-10 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-br from-violet-500 to-fuchsia-500 shadow-lg shadow-violet-950/40">
          <MessageCircle size={28} />
        </div>
        <h2 className="mt-5 text-2xl font-semibold text-zinc-50">Выбери чат</h2>
        <p className="mt-2 max-w-md text-sm leading-6 text-zinc-500">
          Открой сохранённые сообщения или создай новый диалог через кнопку с плюсом в левой колонке.
        </p>
      </div>
    </div>
  );
}

type ChatAlertsProps = {
  errorMessage: string | null;
  isGroupChatReadOnly: boolean;
  isGroupChatLeft?: boolean;
  onRejoinGroup?: () => void;
  directBlockNotice?: string | null;
  canUnblockDirectChat?: boolean;
  onUnblockDirectChat?: () => void;
  onDismissError?: () => void;
};

export function ChatAlerts({
  errorMessage,
  isGroupChatReadOnly,
  isGroupChatLeft = false,
  onRejoinGroup,
  directBlockNotice,
  canUnblockDirectChat = false,
  onUnblockDirectChat,
  onDismissError,
}: ChatAlertsProps) {
  return (
    <>
      {errorMessage && (
        <div className="flex items-center justify-between gap-4 border-b border-red-400/20 bg-red-500/10 px-7 py-3 text-sm text-red-100 shadow-lg shadow-red-950/10">
          <span>{errorMessage}</span>
          {onDismissError && (
            <button
              type="button"
              onClick={onDismissError}
              className="rounded-full p-1 text-red-100/70 transition hover:bg-red-100/10 hover:text-red-50"
              title="Скрыть уведомление"
            >
              <X size={15} />
            </button>
          )}
        </div>
      )}

      {isGroupChatReadOnly && (
        <div className="flex items-center justify-between gap-4 border-b border-amber-300/20 bg-amber-500/10 px-7 py-3 text-sm text-amber-100 shadow-lg shadow-amber-950/10">
          <span>
            {isGroupChatLeft
              ? 'Вы покинули группу. Новые сообщения недоступны, но вы можете вернуться в чат.'
              : 'Вы исключены из группы. Вы можете читать доступную историю, но отправка сообщений, файлов и документов отключена.'}
          </span>
          {isGroupChatLeft && onRejoinGroup && (
            <button
              type="button"
              onClick={onRejoinGroup}
              className="rounded-2xl border border-amber-200/20 px-3 py-1.5 text-xs font-semibold text-amber-50 transition hover:bg-amber-200/10"
            >
              Вернуться
            </button>
          )}
        </div>
      )}

      {directBlockNotice && (
        <div className="flex items-center justify-between gap-4 border-b border-amber-300/20 bg-amber-500/10 px-7 py-3 text-sm text-amber-100 shadow-lg shadow-amber-950/10">
          <span>{directBlockNotice}</span>
          {canUnblockDirectChat && onUnblockDirectChat && (
            <button
              type="button"
              onClick={onUnblockDirectChat}
              className="rounded-2xl border border-amber-200/20 px-3 py-1.5 text-xs font-semibold text-amber-50 transition hover:bg-amber-200/10"
            >
              Разблокировать
            </button>
          )}
        </div>
      )}
    </>
  );
}
