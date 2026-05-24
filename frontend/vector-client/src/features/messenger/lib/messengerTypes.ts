import { type ChatAttachmentDisplayMode } from '../ui/ChatComposer';
import type { FileAttachmentMessageContent } from '../../../shared/types/api';
export const IMAGE_FILE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'avif']);
export const CHAT_LOCAL_STATE_PREFIX = 'vector.chatLocalState';
export const EMOJI_ITEMS = ['😀', '😄', '😊', '😍', '😎', '🥳', '👍', '🙏', '🔥', '💪', '✅', '❤️', '😂', '🤝', '👀', '🚀', '📌', '📎', '📝', '🔒'];
export const QUICK_REACTION_ITEMS = ['👍', '❤️', '😂', '😮', '😢', '🔥'];
export const LOCAL_REACTIONS_PREFIX = 'vector.localMessageReactions';

export type MessageContextMenuPlacement = 'left' | 'right';

export type MessageContextMenuAnchorRect = {
  left: number;
  right: number;
  top: number;
  bottom: number;
  width: number;
  height: number;
};

export type MessageContextMenuState = {
  messageId: string;
  x: number;
  y: number;
  placement: MessageContextMenuPlacement;
  anchorRect: MessageContextMenuAnchorRect;
  anchorDomRect: DOMRect;
  isPositioned: boolean;
};

export type ReplyDraft = {
  messageId: string;
  chatId: string;
  senderAccountId: string;
  senderName: string;
  preview: string;
  createdAt: string;
};

export type ForwardedMessageSnapshot = {
  messageId: string;
  chatId: string;
  senderAccountId: string;
  senderName: string;
  createdAt: string;
  plainText: string;
};

export type PendingAttachmentDraft = {
  id: string;
  file: File;
  attachmentDisplayMode: ChatAttachmentDisplayMode;
};

export type ForwardSelectionState = {
  originChatId: string;
  selectedMessageIds: string[];
};

export type RichMessageContent = {
  kind: 'VECTOR_RICH_MESSAGE';
  version: 1;
  text: string;
  replyTo: ReplyDraft | null;
  forwardedMessages: ForwardedMessageSnapshot[];
  attachments: FileAttachmentMessageContent[];
};

export type LocalChatState = {
  readAtByChatId: Record<string, string>;
  clearedAtByChatId: Record<string, string>;
  hiddenChatIds: string[];
  blockedAccountIds: string[];
  pinnedChatIds: string[];
};

export type ChatListPreview = {
  text: string;
  accent: 'default' | 'media' | 'system' | 'muted';
};

export type DocumentCreationDraft = {
  file: File;
  title: string;
  description: string;
  requiredSignerAccountIds: string[];
  observerAccountIds: string[];
};
