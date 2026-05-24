import { useState, type Dispatch, type SetStateAction } from "react";
import { getActiveAccountDevices } from "../../devices/api/devicesApi";
import { getPreKeyBundle } from "../../crypto/api/cryptoKeysApi";
import { editMessage, sendMessage } from "../../messages/api/messagesApi";
import {
  getCurrentAccountGroupEpochKeyEnvelope,
  upsertGroupEpochKeyEnvelope,
} from "../../chats/api/chatsApi";
import { getAccountBackupPublicKey } from "../../crypto/api/accountBackupProfileApi";
import type {
  AccountKeyEnvelopeRequestDto,
  ChatResponseDto,
  DeviceMessagePayloadRequestDto,
  FileAttachmentMessageContent,
  MessageResponseDto,
} from "../../../shared/types/api";
import {
  buildRichMessageContent,
  getActiveGroupParticipantAccountIds,
  isCurrentAccountActiveInChat,
  parseRichMessageContent,
  type ForwardedMessageSnapshot,
  type PendingAttachmentDraft,
  type ReplyDraft,
} from "../lib/messengerCore";

type UseMessageSendingControllerParams = {
  selectedChatId: string | null;
  selectedChat: ChatResponseDto | null;
  currentAccountId: string | undefined;
  deviceId: string | null;
  messageText: string;
  replyDraft: ReplyDraft | null;
  forwardDraftItems: ForwardedMessageSnapshot[];
  pendingAttachments: PendingAttachmentDraft[];
  editDraft: { message: MessageResponseDto; plainText: string } | null;
  isSelectedChatWritable: boolean;
  setMessageText: (text: string) => void;
  setReplyDraft: (replyDraft: ReplyDraft | null) => void;
  setForwardDraftItems: (items: ForwardedMessageSnapshot[]) => void;
  setPendingAttachments: (attachments: PendingAttachmentDraft[]) => void;
  setEditDraft: (
    editDraft: { message: MessageResponseDto; plainText: string } | null,
  ) => void;
  setIsUploadingFile: (isUploading: boolean) => void;
  setErrorMessage: (message: string | null) => void;
  uploadPendingAttachment: (
    attachment: PendingAttachmentDraft,
  ) => Promise<FileAttachmentMessageContent>;
  sendCurrentTypingState: (isTyping: boolean) => void;
  refreshSelectedChat: (options?: {
    silent?: boolean;
  }) => Promise<ChatResponseDto | null>;
  upsertMessage: (message: MessageResponseDto) => void;
  setDecryptedMessagesById: Dispatch<SetStateAction<Record<string, string>>>;
};

export function useMessageSendingController(
  params: UseMessageSendingControllerParams,
) {
  const {
    selectedChatId,
    selectedChat,
    currentAccountId,
    deviceId,
    messageText,
    replyDraft,
    forwardDraftItems,
    pendingAttachments,
    editDraft,
    isSelectedChatWritable,
    setMessageText,
    setReplyDraft,
    setForwardDraftItems,
    setPendingAttachments,
    setEditDraft,
    setIsUploadingFile,
    setErrorMessage,
    uploadPendingAttachment,
    sendCurrentTypingState,
    refreshSelectedChat,
    upsertMessage,
    setDecryptedMessagesById,
  } = params;
  const [isSending, setIsSending] = useState(false);

  async function buildAccountKeyEnvelopesForAccounts(
    keyBase64: string,
    targetAccountIds: string[],
  ): Promise<AccountKeyEnvelopeRequestDto[]> {
    if (!window.vectorCrypto) {
      throw new Error("Local cryptography is not available.");
    }

    const uniqueTargetAccountIds = Array.from(new Set(targetAccountIds));

    return Promise.all(
      uniqueTargetAccountIds.map(async (targetAccountId) => {
        const publicKey = await getAccountBackupPublicKey(targetAccountId);
        const encryptedEnvelope =
          await window.vectorCrypto!.encryptAccountKeyEnvelope({
            backupPublicKeyBase64: publicKey.backupPublicKeyBase64,
            keyBase64,
          });

        return {
          targetAccountId,
          algorithm: encryptedEnvelope.algorithm,
          encryptedKeyBase64: encryptedEnvelope.encryptedKeyBase64,
        };
      }),
    );
  }

  async function buildEncryptedDevicePayloadsForAccounts(
    plainText: string,
    targetAccountIds: string[],
  ): Promise<DeviceMessagePayloadRequestDto[]> {
    if (!deviceId || !currentAccountId) {
      throw new Error("Profile or local device is not available.");
    }

    const uniqueTargetAccountIds = Array.from(new Set(targetAccountIds));
    const activeDevicesByAccount = await Promise.all(
      uniqueTargetAccountIds.map(async (targetAccountId) => ({
        targetAccountId,
        devices: await getActiveAccountDevices(targetAccountId),
      })),
    );
    const targetDevices = activeDevicesByAccount.flatMap(
      ({ targetAccountId, devices }) =>
        devices.map((targetDevice) => ({
          targetAccountId,
          targetDeviceId: targetDevice.deviceId,
        })),
    );

    if (targetDevices.length === 0) {
      throw new Error(
        "No active devices are available for message recipients.",
      );
    }

    const vectorCrypto = window.vectorCrypto;

    if (!vectorCrypto) {
      throw new Error("Local cryptography is not available.");
    }

    return Promise.all(
      targetDevices.map(async (targetDevice) => {
        const encryptedMessage =
          targetDevice.targetDeviceId === deviceId
            ? await vectorCrypto.encryptLocalMessage({
                accountId: currentAccountId,
                deviceId,
                plainText,
              })
            : await (async () => {
                const preKeyBundle = await getPreKeyBundle(
                  targetDevice.targetDeviceId,
                );

                return vectorCrypto.encryptMessage({
                  accountId: currentAccountId,
                  deviceId,
                  targetDeviceId: targetDevice.targetDeviceId,
                  plainText,
                  preKeyBundle,
                });
              })();

        return {
          targetAccountId: targetDevice.targetAccountId,
          targetDeviceId: targetDevice.targetDeviceId,
          ciphertextType: encryptedMessage.ciphertextType,
          encryptedPayload: encryptedMessage.encryptedPayload,
        };
      }),
    );
  }

  async function buildEncryptedDevicePayloads(
    plainText: string,
    chatForRecipients: ChatResponseDto | null = selectedChat,
  ): Promise<DeviceMessagePayloadRequestDto[]> {
    if (!chatForRecipients) {
      throw new Error("Chat is not available.");
    }

    return buildEncryptedDevicePayloadsForAccounts(
      plainText,
      getActiveGroupParticipantAccountIds(chatForRecipients),
    );
  }

  function isNotFoundError(error: unknown): boolean {
    return (
      (error as { response?: { status?: number } })?.response?.status === 404
    );
  }

  async function importCurrentGroupEpochKeyFromEnvelope(
    chatId: string,
    epoch: number,
  ): Promise<boolean> {
    if (!currentAccountId || !deviceId || !window.vectorCrypto) {
      return false;
    }

    try {
      const envelope = await getCurrentAccountGroupEpochKeyEnvelope(
        chatId,
        epoch,
      );
      const decryptResponse =
        await window.vectorCrypto.decryptAccountKeyEnvelope({
          accountId: currentAccountId,
          encryptedKeyBase64: envelope.encryptedKeyBase64,
        });
      await window.vectorCrypto.importGroupKeyFromBackupEnvelope({
        accountId: currentAccountId,
        chatId,
        epoch,
        senderDeviceId: envelope.senderDeviceId || deviceId,
        groupEpochKeyBase64: decryptResponse.keyBase64,
      });
      return true;
    } catch (error) {
      if (isNotFoundError(error)) {
        return false;
      }

      console.warn("Unable to import current group epoch key before sending.", {
        chatId,
        epoch,
        currentAccountId,
        error,
      });
      throw error;
    }
  }

  async function shareGroupEpochKeyWithAccounts(
    chatForRecipients: ChatResponseDto,
    epoch: number,
    groupEpochKeyBase64: string,
  ) {
    if (!deviceId) {
      throw new Error("Local device is not available.");
    }

    const targetAccountIds =
      getActiveGroupParticipantAccountIds(chatForRecipients);
    await Promise.all(
      Array.from(new Set(targetAccountIds)).map(async (targetAccountId) => {
        const publicKey = await getAccountBackupPublicKey(targetAccountId);
        const encryptedEnvelope =
          await window.vectorCrypto!.encryptAccountKeyEnvelope({
            backupPublicKeyBase64: publicKey.backupPublicKeyBase64,
            keyBase64: groupEpochKeyBase64,
          });

        await upsertGroupEpochKeyEnvelope(chatForRecipients.chatId, {
          epoch,
          targetAccountId,
          senderDeviceId: deviceId,
          algorithm: encryptedEnvelope.algorithm,
          encryptedKeyBase64: encryptedEnvelope.encryptedKeyBase64,
        });
      }),
    );
  }

  async function ensureCurrentGroupEpochKeyAvailable(
    chatForRecipients: ChatResponseDto,
    epoch: number,
  ): Promise<void> {
    if (!currentAccountId || !deviceId || !window.vectorCrypto) {
      throw new Error(
        "Profile, local device or cryptography is not available.",
      );
    }

    const groupEpochImported = await importCurrentGroupEpochKeyFromEnvelope(
      chatForRecipients.chatId,
      epoch,
    );

    if (groupEpochImported) {
      return;
    }

    const localGroupEpochKey =
      await window.vectorCrypto.getOrCreateGroupEpochKey({
        accountId: currentAccountId,
        deviceId,
        chatId: chatForRecipients.chatId,
        epoch,
      });
    await shareGroupEpochKeyWithAccounts(
      chatForRecipients,
      epoch,
      localGroupEpochKey.groupEpochKeyBase64,
    );

    const authoritativeKeyImported =
      await importCurrentGroupEpochKeyFromEnvelope(
        chatForRecipients.chatId,
        epoch,
      );

    if (!authoritativeKeyImported) {
      throw new Error(
        "Group epoch key was created but is not available for the current account.",
      );
    }
  }

  async function sendEncryptedChatContent(
    plainText: string,
    messageType: "TEXT" | "FILE" = "TEXT",
  ) {
    if (!selectedChatId || !currentAccountId || !deviceId || !window.vectorCrypto) {
      throw new Error("Chat, account, local device or cryptography is not available.");
    }

    const activeAccountId = currentAccountId;

    const currentChatState =
      selectedChat?.type === "GROUP"
        ? ((await refreshSelectedChat({ silent: true })) ?? selectedChat)
        : selectedChat;

    if (!isCurrentAccountActiveInChat(currentChatState, activeAccountId)) {
      throw new Error(
        "Current account is not an active participant of this chat.",
      );
    }

    const targetAccountIds =
      getActiveGroupParticipantAccountIds(currentChatState);
    const clientMessageId = crypto.randomUUID();

    if (currentChatState?.type === "GROUP") {
      const groupEpoch = currentChatState.currentKeyEpoch ?? 1;
      await ensureCurrentGroupEpochKeyAvailable(currentChatState, groupEpoch);

      const groupEncryptedMessage =
        await window.vectorCrypto.encryptGroupMessageV2({
          accountId: activeAccountId,
          deviceId,
          chatId: selectedChatId,
          epoch: groupEpoch,
          messageId: clientMessageId,
          plainText,
        });

      const savedMessage = await sendMessage(selectedChatId, {
        senderDeviceId: deviceId,
        clientMessageId,
        messageType,
        encryptionType: "GROUP",
        encryptedPayload: groupEncryptedMessage.encryptedPayload,
        contentAlgorithm: groupEncryptedMessage.algorithm,
        contentInitializationVectorBase64:
          groupEncryptedMessage.initializationVectorBase64,
        contentAuthenticationTagBase64:
          groupEncryptedMessage.authenticationTagBase64,
        groupKeyEpoch: groupEpoch,
        devicePayloads: [],
        accountKeyEnvelopes: [],
      });

      upsertMessage(savedMessage);
      setDecryptedMessagesById((previousValue) => ({
        ...previousValue,
        [savedMessage.messageId]: plainText,
      }));

      return savedMessage;
    }

    const encryptedContent = await window.vectorCrypto.encryptContentWithNewKey(
      { plainText },
    );
    const messageKeyPackagePlainText = JSON.stringify({
      type: "VECTOR_MESSAGE_KEY",
      version: 1,
      chatId: selectedChatId,
      clientMessageId,
      algorithm: encryptedContent.algorithm,
      keyBase64: encryptedContent.keyBase64,
    });
    const devicePayloads = await buildEncryptedDevicePayloads(
      messageKeyPackagePlainText,
      currentChatState,
    );
    const accountKeyEnvelopes = await buildAccountKeyEnvelopesForAccounts(
      encryptedContent.keyBase64,
      targetAccountIds,
    );

    const savedMessage = await sendMessage(selectedChatId, {
      senderDeviceId: deviceId,
      clientMessageId,
      messageType,
      encryptionType: "CONTENT",
      encryptedPayload: encryptedContent.encryptedPayload,
      contentAlgorithm: encryptedContent.algorithm,
      contentInitializationVectorBase64:
        encryptedContent.initializationVectorBase64,
      contentAuthenticationTagBase64: encryptedContent.authenticationTagBase64,
      groupKeyEpoch: null,
      devicePayloads,
      accountKeyEnvelopes,
    });

    upsertMessage(savedMessage);
    setDecryptedMessagesById((previousValue) => ({
      ...previousValue,
      [savedMessage.messageId]: plainText,
    }));

    return savedMessage;
  }

  function buildEditedPlainText(
    trimmedMessageText: string,
    originalPlainText: string,
  ): string {
    const richMessageContent = parseRichMessageContent(originalPlainText);

    if (!richMessageContent) {
      return trimmedMessageText;
    }

    return buildRichMessageContent(
      trimmedMessageText,
      richMessageContent.replyTo,
      richMessageContent.forwardedMessages,
      richMessageContent.attachments,
    );
  }

  async function buildEditRequest(
    plainText: string,
    messageToEdit: MessageResponseDto,
    chatForRecipients: ChatResponseDto,
  ) {
    if (!selectedChatId || !currentAccountId || !deviceId || !window.vectorCrypto) {
      throw new Error("Chat, account, local device or cryptography is not available.");
    }

    const activeAccountId = currentAccountId;

    if (chatForRecipients.type === "GROUP") {
      const groupEpoch =
        chatForRecipients.currentKeyEpoch ?? messageToEdit.groupKeyEpoch ?? 1;
      await ensureCurrentGroupEpochKeyAvailable(chatForRecipients, groupEpoch);
      const groupEncryptedMessage =
        await window.vectorCrypto.encryptGroupMessageV2({
          accountId: activeAccountId,
          deviceId,
          chatId: selectedChatId,
          epoch: groupEpoch,
          messageId: messageToEdit.clientMessageId ?? messageToEdit.messageId,
          plainText,
        });

      return {
        senderDeviceId: deviceId,
        encryptionType: "GROUP" as const,
        encryptedPayload: groupEncryptedMessage.encryptedPayload,
        contentAlgorithm: groupEncryptedMessage.algorithm,
        contentInitializationVectorBase64:
          groupEncryptedMessage.initializationVectorBase64,
        contentAuthenticationTagBase64:
          groupEncryptedMessage.authenticationTagBase64,
        groupKeyEpoch: groupEpoch,
        devicePayloads: [],
        accountKeyEnvelopes: [],
      };
    }

    const targetAccountIds =
      getActiveGroupParticipantAccountIds(chatForRecipients);
    const encryptedContent = await window.vectorCrypto.encryptContentWithNewKey(
      { plainText },
    );
    const messageKeyPackagePlainText = JSON.stringify({
      type: "VECTOR_MESSAGE_KEY",
      version: 1,
      chatId: selectedChatId,
      messageId: messageToEdit.messageId,
      clientMessageId: messageToEdit.clientMessageId,
      algorithm: encryptedContent.algorithm,
      keyBase64: encryptedContent.keyBase64,
    });
    const devicePayloads = await buildEncryptedDevicePayloads(
      messageKeyPackagePlainText,
      chatForRecipients,
    );
    const accountKeyEnvelopes = await buildAccountKeyEnvelopesForAccounts(
      encryptedContent.keyBase64,
      targetAccountIds,
    );

    return {
      senderDeviceId: deviceId,
      encryptionType: "CONTENT" as const,
      encryptedPayload: encryptedContent.encryptedPayload,
      contentAlgorithm: encryptedContent.algorithm,
      contentInitializationVectorBase64:
        encryptedContent.initializationVectorBase64,
      contentAuthenticationTagBase64: encryptedContent.authenticationTagBase64,
      groupKeyEpoch: null,
      devicePayloads,
      accountKeyEnvelopes,
    };
  }

  async function handleEditCurrentMessage(trimmedMessageText: string) {
    if (!editDraft || !selectedChatId || !selectedChat) {
      return;
    }

    const currentChatState =
      selectedChat.type === "GROUP"
        ? ((await refreshSelectedChat({ silent: true })) ?? selectedChat)
        : selectedChat;

    if (!isCurrentAccountActiveInChat(currentChatState, currentAccountId)) {
      throw new Error(
        "Current account is not an active participant of this chat.",
      );
    }

    const editedPlainText = buildEditedPlainText(
      trimmedMessageText,
      editDraft.plainText,
    );
    const editRequest = await buildEditRequest(
      editedPlainText,
      editDraft.message,
      currentChatState,
    );
    const savedMessage = await editMessage(
      selectedChatId,
      editDraft.message.messageId,
      editRequest,
    );

    upsertMessage(savedMessage);
    setDecryptedMessagesById((previousValue) => ({
      ...previousValue,
      [savedMessage.messageId]: editedPlainText,
    }));
    setMessageText("");
    setEditDraft(null);
    sendCurrentTypingState(false);
  }

  async function handleSendCurrentMessage(overrideText?: string) {
    const trimmedMessageText = (overrideText ?? messageText).trim();
    const hasPendingAttachments = pendingAttachments.length > 0;
    const hasRichMetadata = Boolean(
      replyDraft || forwardDraftItems.length > 0 || hasPendingAttachments,
    );

    if (editDraft) {
      if (!trimmedMessageText || !isSelectedChatWritable) {
        return;
      }

      setIsSending(true);
      setErrorMessage(null);

      try {
        await handleEditCurrentMessage(trimmedMessageText);
      } catch (error) {
        console.error(error);
        setErrorMessage("Не удалось отредактировать сообщение.");
      } finally {
        setIsSending(false);
      }

      return;
    }

    if ((!trimmedMessageText && !hasRichMetadata) || !isSelectedChatWritable) {
      return;
    }

    if (
      hasPendingAttachments &&
      (!selectedChatId || !selectedChat || !deviceId)
    ) {
      setErrorMessage("Сначала выбери чат для отправки вложений.");
      return;
    }

    setIsSending(true);
    setIsUploadingFile(hasPendingAttachments);
    setErrorMessage(null);

    try {
      const uploadedAttachments = hasPendingAttachments
        ? await Promise.all(pendingAttachments.map(uploadPendingAttachment))
        : [];
      const plainText = hasRichMetadata
        ? buildRichMessageContent(
            trimmedMessageText,
            replyDraft,
            forwardDraftItems,
            uploadedAttachments,
          )
        : trimmedMessageText;

      await sendEncryptedChatContent(
        plainText,
        uploadedAttachments.length > 0 ? "FILE" : "TEXT",
      );
      setMessageText("");
      setReplyDraft(null);
      setForwardDraftItems([]);
      setPendingAttachments([]);
      sendCurrentTypingState(false);
    } catch (error) {
      console.error(error);
      setErrorMessage(
        hasPendingAttachments
          ? "Не удалось зашифровать и отправить вложения."
          : "Не удалось отправить сообщение.",
      );
    } finally {
      setIsSending(false);
      setIsUploadingFile(false);
    }
  }

  return {
    isSending,
    setIsSending,
    sendEncryptedChatContent,
    buildEncryptedDevicePayloadsForAccounts,
    handleSendCurrentMessage,
  };
}
