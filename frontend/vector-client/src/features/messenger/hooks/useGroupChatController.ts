import { type Dispatch, type SetStateAction } from 'react';
import { addGroupParticipant, createDirectChat, createGroupChat, getCurrentAccountGroupEpochKeyEnvelope, removeGroupParticipant, upsertGroupEpochKeyEnvelope } from '../../chats/api/chatsApi';
import { getAccountBackupPublicKey } from '../../crypto/api/accountBackupProfileApi';
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
    await shareCurrentGroupEpochKeyWithAccounts(chat, getActiveGroupParticipantAccountIds(chat));
  }

  async function getAuthoritativeCurrentGroupEpochKey(chat: ChatResponseDto) {
    if (!currentAccountId || !deviceId || !window.vectorCrypto) {
      throw new Error('Current account, local device or cryptography is not available.');
    }

    const epoch = chat.currentKeyEpoch ?? 1;

    try {
      const envelope = await getCurrentAccountGroupEpochKeyEnvelope(chat.chatId, epoch);
      const decryptResponse = await window.vectorCrypto.decryptAccountKeyEnvelope({
        accountId: currentAccountId,
        encryptedKeyBase64: envelope.encryptedKeyBase64,
      });
      await window.vectorCrypto.importGroupKeyFromBackupEnvelope({
        accountId: currentAccountId,
        chatId: chat.chatId,
        epoch,
        senderDeviceId: envelope.senderDeviceId || deviceId,
        groupEpochKeyBase64: decryptResponse.keyBase64,
      });

      return {
        chatId: chat.chatId,
        epoch,
        senderDeviceId: envelope.senderDeviceId || deviceId,
        groupEpochKeyBase64: decryptResponse.keyBase64,
      };
    }
    catch (error) {
      const status = (error as { response?: { status?: number } })?.response?.status;

      if (status !== 404) {
        console.warn('Unable to restore authoritative group epoch key before sharing. Local key will not be trusted silently.', {
          chatId: chat.chatId,
          epoch,
          currentAccountId,
          deviceId,
          error,
        });
        throw error;
      }
    }

    return window.vectorCrypto.getOrCreateGroupEpochKey({
      accountId: currentAccountId,
      deviceId,
      chatId: chat.chatId,
      epoch,
    });
  }

  async function shareCurrentGroupEpochKeyWithAccounts(chat: ChatResponseDto, targetAccountIds: string[]) {
    if (!currentAccountId || !deviceId || !window.vectorCrypto || targetAccountIds.length === 0) {
      return;
    }

    const epoch = chat.currentKeyEpoch ?? 1;
    const groupEpochKey = await getAuthoritativeCurrentGroupEpochKey(chat);

    await Promise.all(Array.from(new Set(targetAccountIds)).map(async (targetAccountId) => {
      const publicKey = await getAccountBackupPublicKey(targetAccountId);
      const encryptedEnvelope = await window.vectorCrypto!.encryptAccountKeyEnvelope({
        backupPublicKeyBase64: publicKey.backupPublicKeyBase64,
        keyBase64: groupEpochKey.groupEpochKeyBase64,
      });
      await upsertGroupEpochKeyEnvelope(chat.chatId, {
        epoch,
        targetAccountId,
        senderDeviceId: deviceId,
        algorithm: encryptedEnvelope.algorithm,
        encryptedKeyBase64: encryptedEnvelope.encryptedKeyBase64,
      });
    }));
  }

  async function shareHistoricalGroupKeysWithParticipant(participantAccountId: string) {
    if (!selectedChatId || !currentAccountId || !deviceId || !window.vectorCrypto) {
      return;
    }

    const exportedGroupKeys = await window.vectorCrypto.exportGroupKeyPackagesForChat({
      accountId: currentAccountId,
      chatId: selectedChatId,
    });
    const publicKey = await getAccountBackupPublicKey(participantAccountId);

    for (const groupKeyPackagePlainText of exportedGroupKeys.packages) {
      const groupKeyPackage = JSON.parse(groupKeyPackagePlainText) as { epoch: number; senderDeviceId: string; keyBase64: string };
      const encryptedEnvelope = await window.vectorCrypto.encryptAccountKeyEnvelope({
        backupPublicKeyBase64: publicKey.backupPublicKeyBase64,
        keyBase64: groupKeyPackage.keyBase64,
      });
      await upsertGroupEpochKeyEnvelope(selectedChatId, {
        epoch: groupKeyPackage.epoch,
        targetAccountId: participantAccountId,
        senderDeviceId: groupKeyPackage.senderDeviceId,
        algorithm: encryptedEnvelope.algorithm,
        encryptedKeyBase64: encryptedEnvelope.encryptedKeyBase64,
      });
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

    await shareCurrentGroupEpochKeyWithAccounts(updatedChat, getActiveGroupParticipantAccountIds(updatedChat));
  }

  async function handleRemoveGroupParticipant(participantAccountId: string) {
    if (!selectedChat || selectedChat.type !== 'GROUP') {
      return;
    }

    setErrorMessage(null);
    const updatedChat = await removeGroupParticipant(selectedChat.chatId, participantAccountId);
    upsertChat(updatedChat);
    clearTemporarilyMissingGroupKeys();
    await shareCurrentGroupEpochKeyWithAccounts(updatedChat, getActiveGroupParticipantAccountIds(updatedChat));
    setDecryptedMessagesById((previousValue) => ({ ...previousValue }));
  }

  return {
    handleCreateDirectChat,
    handleCreateGroupChat,
    handleAddGroupParticipant,
    handleRemoveGroupParticipant,
  };
}
