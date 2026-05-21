import { MessageCircle } from 'lucide-react';

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
};

export function ChatAlerts({ errorMessage, isGroupChatReadOnly }: ChatAlertsProps) {
  return (
    <>
      {errorMessage && (
        <div className="border-b border-red-400/20 bg-red-500/10 px-7 py-3 text-sm text-red-100 shadow-lg shadow-red-950/10">
          {errorMessage}
        </div>
      )}

      {isGroupChatReadOnly && (
        <div className="border-b border-amber-300/20 bg-amber-500/10 px-7 py-3 text-sm text-amber-100 shadow-lg shadow-amber-950/10">
          Вы исключены из группы. Вы можете читать доступную историю, но отправка сообщений, файлов, документов и typing отключены.
        </div>
      )}
    </>
  );
}
