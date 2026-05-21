import type { MutableRefObject, RefObject } from 'react';
import { Check, CheckCheck, Download, FileText } from 'lucide-react';
import { getDisplayName } from '../../../../shared/lib/profile';
import { formatFileSize, parseDocumentAttachmentMessageContent, parseFileAttachmentMessageContent } from '../../../media/lib/fileCrypto';
import { DocumentAttachmentPreview, ImageAttachmentPreview } from '../MessageAttachments';
import type { ChatResponseDto, DocumentAttachmentMessageContent, FileAttachmentMessageContent, MessageResponseDto, ProfileResponseDto } from '../../../../shared/types/api';
import {
  ForwardedMessageCard,
  ReplyReferenceBlock,
  UserAvatar,
  formatGroupSystemMessage,
  getAccountAvatarUrl,
  getOutgoingMessageStatus,
  getParticipantDisplayName,
  getReadReceiptDetails,
  isDecryptionPlaceholder,
  isForwardableMessage,
  isSameCalendarDate,
  parseGroupSystemMessagePayload,
  parseRichMessageContent,
} from '../../../../pages/MessengerPageSupport';
import { formatMessageDate, formatMessageTime } from '../../../../shared/lib/dateFormat';

type MessageTimelineProps = {
  selectedChat: ChatResponseDto;
  visibleSelectedMessages: MessageResponseDto[];
  currentAccountId: string | undefined;
  profilesById: Record<string, ProfileResponseDto>;
  decryptedMessagesById: Record<string, string>;
  readDetailsMessageId: string | null;
  highlightedMessageId: string | null;
  localReactionsByMessageId: Record<string, string>;
  forwardSelectionSelectedMessageIds: string[] | null;
  selectedTypingText: string | null;
  messageElementRefs: MutableRefObject<Record<string, HTMLDivElement | null>>;
  messagesEndRef: RefObject<HTMLDivElement | null>;
  onToggleForwardSelectedMessage: (message: MessageResponseDto) => void;
  onOpenMessageContextMenu: (event: React.MouseEvent<HTMLElement>, messageId: string) => void;
  onScrollToMessage: (messageId: string) => void;
  onDownloadAttachment: (attachment: FileAttachmentMessageContent | DocumentAttachmentMessageContent) => Promise<void>;
  onOpenProfile: (profile: ProfileResponseDto) => void;
  onSetReadDetailsMessageId: (messageId: string | null) => void;
  onSetLocalMessageReaction: (messageId: string, emoji: string) => void;
};

export function MessageTimeline({
  selectedChat,
  visibleSelectedMessages,
  currentAccountId,
  profilesById,
  decryptedMessagesById,
  readDetailsMessageId,
  highlightedMessageId,
  localReactionsByMessageId,
  forwardSelectionSelectedMessageIds,
  selectedTypingText,
  messageElementRefs,
  messagesEndRef,
  onToggleForwardSelectedMessage,
  onOpenMessageContextMenu,
  onScrollToMessage,
  onDownloadAttachment,
  onOpenProfile,
  onSetReadDetailsMessageId,
  onSetLocalMessageReaction,
}: MessageTimelineProps) {
  const renderedMessages = visibleSelectedMessages.filter((message) => message.messageType !== 'GROUP_KEY_DISTRIBUTION');

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-8 py-6">
      <div className="mx-auto flex max-w-4xl flex-col gap-3">
        {visibleSelectedMessages.length === 0 && (
          <div className="rounded-[1.8rem] border border-dashed border-white/10 bg-white/[0.02] p-8 text-center text-sm text-zinc-500">
            Пока сообщений нет. Напиши первое сообщение ниже.
          </div>
        )}

        {renderedMessages.map((message, messageIndex) => {
          const previousMessage = messageIndex > 0 ? renderedMessages[messageIndex - 1] : null;
          const shouldShowDateSeparator = !previousMessage || !isSameCalendarDate(previousMessage.createdAt, message.createdAt);
          const decryptedMessage = decryptedMessagesById[message.messageId] ?? 'Расшифровка…';

          if (message.messageType === 'SYSTEM') {
            const systemPayload = parseGroupSystemMessagePayload(decryptedMessage);
            return (
              <div key={message.messageId}>
                {shouldShowDateSeparator && <MessageDateSeparator createdAt={message.createdAt} />}
                <div className="flex justify-center py-1">
                  <div className="max-w-[80%] rounded-full border border-white/10 bg-white/[0.06] px-4 py-1.5 text-center text-xs text-zinc-400 shadow-sm shadow-black/10">
                    {formatGroupSystemMessage(systemPayload, profilesById)}
                  </div>
                </div>
              </div>
            );
          }

          const isOwnMessage = message.senderAccountId === currentAccountId;
          const messageStatus = getOutgoingMessageStatus(message, currentAccountId);
          const richMessageContent = parseRichMessageContent(decryptedMessage);
          const visibleMessageText = richMessageContent?.text ?? decryptedMessage;
          const richAttachments = richMessageContent?.attachments ?? [];
          const fileAttachment = richAttachments.length === 0 ? parseFileAttachmentMessageContent(visibleMessageText) : null;
          const documentAttachment = richAttachments.length === 0 ? parseDocumentAttachmentMessageContent(visibleMessageText) : null;
          const senderProfile = profilesById[message.senderAccountId] ?? null;
          const senderDisplayName = senderProfile ? getDisplayName(senderProfile) : `${message.senderAccountId.slice(0, 8)}…`;
          const readReceiptDetails = getReadReceiptDetails(message, selectedChat, profilesById, currentAccountId);
          const shouldShowGroupSender = selectedChat.type === 'GROUP' && !isOwnMessage;
          const shouldShowGroupReadDetails = selectedChat.type === 'GROUP' && readDetailsMessageId === message.messageId;
          const localReaction = localReactionsByMessageId[message.messageId];
          const isForwardSelectionActive = Boolean(forwardSelectionSelectedMessageIds);
          const isForwardSelected = Boolean(forwardSelectionSelectedMessageIds?.includes(message.messageId));
          const canSelectForForward = isForwardSelectionActive && isForwardableMessage(message);

          return (
            <div key={message.messageId}>
              {shouldShowDateSeparator && <MessageDateSeparator createdAt={message.createdAt} />}
              <div
                ref={(element) => {
                  messageElementRefs.current[message.messageId] = element;
                }}
                className={`group flex items-center gap-3 rounded-[1.75rem] transition ${isOwnMessage ? 'justify-end' : 'justify-start'} ${highlightedMessageId === message.messageId ? 'bg-violet-400/12 ring-1 ring-violet-300/20' : ''}`}
                onClick={() => {
                  if (canSelectForForward) {
                    onToggleForwardSelectedMessage(message);
                  }
                }}
              >
                {canSelectForForward && isOwnMessage && (
                  <ForwardSelectButton
                    isForwardSelected={isForwardSelected}
                    onClick={(event) => {
                      event.stopPropagation();
                      onToggleForwardSelectedMessage(message);
                    }}
                  />
                )}

                <div className={`flex max-w-[74%] items-end gap-3 ${isOwnMessage ? 'flex-row-reverse' : ''} ${canSelectForForward ? 'cursor-pointer' : ''}`}>
                  {!isOwnMessage && <UserAvatar label={senderDisplayName} imageUrl={getAccountAvatarUrl(senderProfile)} size="sm" />}

                  <div className="relative">
                    <div
                      data-message-bubble="true"
                      onContextMenu={(event) => {
                        if (!isForwardSelectionActive) {
                          onOpenMessageContextMenu(event, message.messageId);
                        }
                        else {
                          event.preventDefault();
                        }
                      }}
                      className={`rounded-[1.35rem] px-4 py-2.5 shadow-lg ${
                        isOwnMessage
                          ? 'rounded-br-md bg-gradient-to-br from-violet-500 via-fuchsia-600 to-pink-600 text-white shadow-violet-950/30'
                          : 'rounded-bl-md border border-white/10 bg-[#24262d]/96 text-zinc-100 shadow-black/20 backdrop-blur'
                      }`}
                    >
                      {shouldShowGroupSender && (
                        <div className="mb-1 text-xs font-semibold text-violet-200">
                          {senderDisplayName}
                        </div>
                      )}
                      {richMessageContent?.replyTo && (
                        <ReplyReferenceBlock replyTo={richMessageContent.replyTo} isOwnMessage={isOwnMessage} onOpenOriginalMessage={onScrollToMessage} />
                      )}
                      {visibleMessageText.trim() && !fileAttachment && !documentAttachment && !isDecryptionPlaceholder(visibleMessageText) && visibleMessageText !== 'Расшифровка…' && (
                        <div className="whitespace-pre-wrap text-sm leading-6">
                          {visibleMessageText}
                        </div>
                      )}
                      {documentAttachment ? (
                        <DocumentAttachmentPreview attachment={documentAttachment} isOwnMessage={isOwnMessage} onDownload={onDownloadAttachment} />
                      ) : fileAttachment ? (
                        fileAttachment.attachmentDisplayMode === 'IMAGE' ? (
                          <ImageAttachmentPreview attachment={fileAttachment} onDownload={onDownloadAttachment} />
                        ) : (
                          <FileAttachmentBlock attachment={fileAttachment} isOwnMessage={isOwnMessage} onDownload={onDownloadAttachment} />
                        )
                      ) : (!visibleMessageText.trim() || isDecryptionPlaceholder(visibleMessageText) || visibleMessageText === 'Расшифровка…') && !richMessageContent?.forwardedMessages.length && richAttachments.length === 0 ? (
                        <div className="whitespace-pre-wrap text-sm leading-6">
                          {visibleMessageText || 'Сообщение'}
                        </div>
                      ) : null}

                      {richAttachments.length > 0 && (
                        <div className={`${visibleMessageText.trim() ? 'mt-3' : ''} grid gap-2 ${richAttachments.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
                          {richAttachments.map((attachment) => (
                            <div key={attachment.mediaFileId} className={richAttachments.length > 1 ? 'min-w-0' : ''}>
                              {attachment.attachmentDisplayMode === 'IMAGE' ? (
                                <ImageAttachmentPreview attachment={attachment} onDownload={onDownloadAttachment} />
                              ) : (
                                <FileAttachmentBlock attachment={attachment} isOwnMessage={isOwnMessage} onDownload={onDownloadAttachment} />
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      {richMessageContent?.forwardedMessages.length ? (
                        <div className={`${visibleMessageText.trim() ? 'mt-3' : ''} space-y-2 border-l border-violet-300/25 pl-4`}>
                          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-violet-100/65">
                            {richMessageContent.forwardedMessages.length} пересланных сообщений
                          </div>
                          {richMessageContent.forwardedMessages.map((forwardedMessage) => (
                            <ForwardedMessageCard
                              key={`${forwardedMessage.chatId}-${forwardedMessage.messageId}`}
                              forwardedMessage={forwardedMessage}
                              profilesById={profilesById}
                              onOpenProfile={onOpenProfile}
                              onDownload={onDownloadAttachment}
                            />
                          ))}
                        </div>
                      ) : null}

                      <div className={`mt-2 flex items-center gap-2 text-[11px] ${isOwnMessage ? 'justify-end text-violet-100/80' : 'justify-end text-zinc-500'}`}>
                        <span>{formatMessageTime(message.createdAt)}</span>
                        {isOwnMessage && selectedChat.type !== 'GROUP' && (
                          <span className="inline-flex items-center gap-1">
                            {messageStatus === 'READ' ? <CheckCheck size={13} /> : messageStatus === 'DELIVERED' ? <CheckCheck size={13} /> : <Check size={13} />}
                            <span>
                              {messageStatus === 'READ' ? 'Прочитано' : messageStatus === 'DELIVERED' ? 'Доставлено' : 'Отправлено'}
                            </span>
                          </span>
                        )}
                        {selectedChat.type === 'GROUP' && (
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              onSetReadDetailsMessageId(readDetailsMessageId === message.messageId ? null : message.messageId);
                            }}
                            className="inline-flex items-center gap-1 rounded-full px-1 transition hover:bg-white/10"
                            title="Кто прочитал сообщение"
                          >
                            {readReceiptDetails.readCount > 0 ? <CheckCheck size={13} /> : <Check size={13} />}
                            <span>
                              {readReceiptDetails.readCount > 0
                                ? `Прочитано ${readReceiptDetails.readCount}/${readReceiptDetails.totalCount}`
                                : readReceiptDetails.deliveredCount > 0
                                  ? `Доставлено ${readReceiptDetails.deliveredCount}/${readReceiptDetails.totalCount}`
                                  : 'Отправлено'}
                            </span>
                          </button>
                        )}
                      </div>
                    </div>
                    {localReaction && (
                      <div className={`mt-1 flex ${isOwnMessage ? 'justify-end' : 'justify-start'}`}>
                        <button
                          type="button"
                          onClick={() => onSetLocalMessageReaction(message.messageId, localReaction)}
                          className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-sm shadow-sm transition ${isOwnMessage ? 'border-violet-200/25 bg-violet-950/35 text-white hover:bg-violet-900/45' : 'border-white/10 bg-white/[0.06] text-zinc-100 hover:bg-white/[0.1]'}`}
                          title="Убрать реакцию"
                        >
                          <span>{localReaction}</span>
                          <span className="text-[11px] opacity-70">1</span>
                        </button>
                      </div>
                    )}
                    {shouldShowGroupReadDetails && (
                      <GroupReadDetailsPopover
                        readReceiptDetails={readReceiptDetails}
                        onOpenProfile={onOpenProfile}
                      />
                    )}
                  </div>
                </div>

                {canSelectForForward && !isOwnMessage && (
                  <ForwardSelectButton
                    isForwardSelected={isForwardSelected}
                    onClick={(event) => {
                      event.stopPropagation();
                      onToggleForwardSelectedMessage(message);
                    }}
                  />
                )}
              </div>
            </div>
          );
        })}

        {selectedTypingText && (
          <div className="flex justify-start">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-xs text-zinc-400">
              <span className="flex gap-1">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-violet-300" />
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-violet-300 [animation-delay:120ms]" />
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-violet-300 [animation-delay:240ms]" />
              </span>
              {selectedTypingText}
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>
    </div>
  );
}

function MessageDateSeparator({ createdAt }: { createdAt: string }) {
  return (
    <div className="sticky top-3 z-10 my-3 flex justify-center">
      <div className="rounded-full border border-white/10 bg-[#22242a]/90 px-3 py-1 text-xs text-zinc-400 shadow-lg shadow-black/20 backdrop-blur">
        {formatMessageDate(createdAt)}
      </div>
    </div>
  );
}

function ForwardSelectButton({ isForwardSelected, onClick }: { isForwardSelected: boolean; onClick: (event: React.MouseEvent<HTMLButtonElement>) => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border transition ${isForwardSelected ? 'border-violet-300 bg-violet-500 text-white shadow-lg shadow-violet-950/25' : 'border-white/20 bg-white/[0.04] text-transparent hover:border-violet-300/40'}`}
      title={isForwardSelected ? 'Убрать из пересылки' : 'Выбрать для пересылки'}
    >
      <Check size={15} />
    </button>
  );
}

function FileAttachmentBlock({ attachment, isOwnMessage, onDownload }: { attachment: FileAttachmentMessageContent; isOwnMessage: boolean; onDownload: (attachment: FileAttachmentMessageContent) => Promise<void> }) {
  return (
    <div className="min-w-[240px] max-w-[360px]">
      <div className={`flex items-center gap-3 rounded-2xl border p-3 ${isOwnMessage ? 'border-white/20 bg-white/10' : 'border-white/10 bg-black/15'}`}>
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-black/20 text-white">
          <FileText size={20} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold">{attachment.fileName}</div>
          <div className={`mt-1 text-xs ${isOwnMessage ? 'text-violet-100/75' : 'text-zinc-500'}`}>
            {formatFileSize(attachment.sizeBytes)} • защищённый файл
          </div>
        </div>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onDownload(attachment);
          }}
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition ${isOwnMessage ? 'bg-white/15 hover:bg-white/25' : 'bg-white/[0.06] hover:bg-white/[0.1]'}`}
          title="Скачать"
        >
          <Download size={17} />
        </button>
      </div>
    </div>
  );
}

type GroupReadDetailsPopoverProps = {
  readReceiptDetails: ReturnType<typeof getReadReceiptDetails>;
  onOpenProfile: (profile: ProfileResponseDto) => void;
};

function GroupReadDetailsPopover({ readReceiptDetails, onOpenProfile }: GroupReadDetailsPopoverProps) {
  return (
    <div className="absolute right-0 top-full z-20 mt-2 w-72 rounded-3xl border border-white/10 bg-[#202127] p-4 text-left shadow-2xl shadow-black/50">
      <div className="text-sm font-semibold text-zinc-100">Статус прочтения</div>
      <div className="mt-3 grid gap-3 text-xs">
        <div>
          <div className="mb-2 text-zinc-500">Прочитали</div>
          <div className="flex flex-wrap gap-1.5">
            {readReceiptDetails.readParticipants.length > 0 ? readReceiptDetails.readParticipants.map((participant) => {
              const participantName = getParticipantDisplayName(participant);
              return typeof participant === 'string' ? (
                <span key={participantName} className="rounded-full bg-emerald-400/10 px-2 py-1 text-emerald-200">{participantName}</span>
              ) : (
                <button
                  type="button"
                  key={participant.accountId}
                  onClick={() => onOpenProfile(participant)}
                  className="rounded-full bg-emerald-400/10 px-2 py-1 text-emerald-200 transition hover:bg-emerald-400/18"
                >
                  {participantName}
                </button>
              );
            }) : <span className="text-zinc-500">Пока никто</span>}
          </div>
        </div>
        <div>
          <div className="mb-2 text-zinc-500">Ещё не прочитали</div>
          <div className="flex flex-wrap gap-1.5">
            {readReceiptDetails.unreadParticipants.length > 0 ? readReceiptDetails.unreadParticipants.map((participant) => {
              const participantName = getParticipantDisplayName(participant);
              return typeof participant === 'string' ? (
                <span key={participantName} className="rounded-full bg-white/[0.06] px-2 py-1 text-zinc-300">{participantName}</span>
              ) : (
                <button
                  type="button"
                  key={participant.accountId}
                  onClick={() => onOpenProfile(participant)}
                  className="rounded-full bg-white/[0.06] px-2 py-1 text-zinc-300 transition hover:bg-white/[0.1]"
                >
                  {participantName}
                </button>
              );
            }) : <span className="text-zinc-500">Все прочитали</span>}
          </div>
        </div>
      </div>
    </div>
  );
}
