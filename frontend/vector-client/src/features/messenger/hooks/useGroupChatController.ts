import { type Dispatch, type SetStateAction } from 'react';
import { addGroupParticipant, createDirectChat, createGroupChat, removeGroupParticipant } from '../../chats/api/chatsApi';
import { sendMessage } from '../../messages/api/messagesApi';
import type { ChatResponseDto, DeviceMessagePayloadRequestDto, ProfileResponseDto } from '../../../shared/types/api';
import type { GroupHistoryAccessMode } from '../lib/messengerCore';
import { getActiveGroupParticipantAccountIds } from '../lib/messengerCore';

type UseGroupChatControllerParams = {
  selectedChatId: string | null;
  selectedChat: ChatResponseDto | null;
  currentAccountId: string | undefined;
  deviceId: string | null;
  upsertProfile: (profile: ProfileResponseDto) => void;
  upsertChat: (chat: ChatResponseDto) => void;
  selectChat: (chatId: string) => void;
  setIsCreateChatOpen: (isOpen: boolean) => void;
  setErrorMessage: (message: string | null) => void;
  clearTemporarilyMissingGroupKeys: () => void;
  setDecryptedMessagesById: Dispatch<SetStateAction<Record<string, string>>>;
  buildEncryptedDevicePayloadsForAccounts: (plainText: string, targetAccountIds: string[]) => Promise<DeviceMessagePayloadRequestDto[]>;
};

export function useGroupChatController(params: UseGroupChatControllerParams) {
  const {
    selectedChatId,
    selectedChat,
    currentAccountId,
    deviceId,
    upsertProfile,
    upsertChat,
    selectChat,
    setIsCreateChatOpen,
    setErrorMessage,
    clearTemporarilyMissingGroupKeys,
    setDecryptedMessagesById,
    buildEncryptedDevicePayloadsForAccounts,
  } = params;

  async function handleCreateDirectChat(profileToChat: ProfileResponseDto) {
    const chat = await createDirectChat({ recipientAccountId: profileToChat.accountId });
    upsertProfile(profileToChat);
    upsertChat(chat);
    selectChat(chat.chatId);
    setIsCreateChatOpen(false);
  }

  async function handleCreateGroupChat(groupName: string, profilesToChat: ProfileResponseDto[]) {
    const chat = await createGroupChat({
      name: groupName,
      participantAccountIds: profilesToChat.map((profileToChat) => profileToChat.accountId),
    });

    profilesToChat.forEach(upsertProfile);
    upsertChat(chat);
    selectChat(chat.chatId);
    setIsCreateChatOpen(false);
  }

  async function sendGroupKeyDistributionPackage(targetAccountIds: string[], groupKeyPackagePlainText: string) {
    if (!selectedChatId || !deviceId || !currentAccountId || targetAccountIds.length === 0) {
      return;
    }

    const devicePayloads = await buildEncryptedDevicePayloadsForAccounts(groupKeyPackagePlainText, targetAccountIds);

    await sendMessage(selectedChatId, {
      senderDeviceId: deviceId,
      clientMessageId: crypto.randomUUID(),
      messageType: 'GROUP_KEY_DISTRIBUTION',
      encryptionType: 'SIGNAL',
      encryptedPayload: null,
      devicePayloads,
    });
  }

  async function shareHistoricalGroupKeysWithParticipant(participantAccountId: string) {
    if (!selectedChatId || !currentAccountId || !window.vectorCrypto) {
      return;
    }

    const exportedGroupKeys = await window.vectorCrypto.exportGroupKeyPackagesForChat({
      accountId: currentAccountId,
      chatId: selectedChatId,
    });

    for (const groupKeyPackagePlainText of exportedGroupKeys.packages) {
      await sendGroupKeyDistributionPackage([participantAccountId], groupKeyPackagePlainText);
    }
  }

  async function handleAddGroupParticipant(profileToAdd: ProfileResponseDto, historyAccessMode: GroupHistoryAccessMode) {
    if (!selectedChat || selectedChat.type !== 'GROUP') {
      return;
    }

    setErrorMessage(null);
    const updatedChat = await addGroupParticipant(selectedChat.chatId, {
      accountId: profileToAdd.accountId,
      historyAccessMode,
      historyVisibleFromMessageId: null,
    });

    upsertProfile(profileToAdd);
    upsertChat(updatedChat);

    if (historyAccessMode === 'FULL_HISTORY') {
      await shareHistoricalGroupKeysWithParticipant(profileToAdd.accountId);
    }
    else if (window.vectorCrypto && deviceId && currentAccountId) {
      const currentGroupKeyPackage = await window.vectorCrypto.encryptGroupMessage({
        accountId: currentAccountId,
        deviceId,
        chatId: updatedChat.chatId,
        epoch: updatedChat.currentKeyEpoch ?? 1,
        plainText: '[Состав группы обновлён]',
      });
      await sendGroupKeyDistributionPackage([profileToAdd.accountId], currentGroupKeyPackage.groupKeyPackagePlainText);
    }
  }

  async function handleRemoveGroupParticipant(participantAccountId: string) {
    if (!selectedChat || selectedChat.type !== 'GROUP') {
      return;
    }

    setErrorMessage(null);
    const updatedChat = await removeGroupParticipant(selectedChat.chatId, participantAccountId);
    upsertChat(updatedChat);
    clearTemporarilyMissingGroupKeys();

    if (window.vectorCrypto && deviceId && currentAccountId) {
      const activeRecipientAccountIds = getActiveGroupParticipantAccountIds(updatedChat).filter((accountId) => accountId !== currentAccountId);
      const currentGroupKeyPackage = await window.vectorCrypto.encryptGroupMessage({
        accountId: currentAccountId,
        deviceId,
        chatId: updatedChat.chatId,
        epoch: updatedChat.currentKeyEpoch ?? 1,
        plainText: '[Состав группы обновлён]',
      });
      await sendGroupKeyDistributionPackage(activeRecipientAccountIds, currentGroupKeyPackage.groupKeyPackagePlainText);
    }

    setDecryptedMessagesById((previousValue) => ({ ...previousValue }));
  }

  return {
    handleCreateDirectChat,
    handleCreateGroupChat,
    handleAddGroupParticipant,
    handleRemoveGroupParticipant,
  };
}
