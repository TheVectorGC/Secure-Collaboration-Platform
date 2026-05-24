import { useEffect, useMemo, useState } from 'react';
import { getProfilesByAccountIds } from '../../directory/api/profilesApi';
import { getDirectCompanionAccountId } from '../../../shared/lib/profile';
import { parseRichMessageContent } from '../lib/messengerContent';
import type { ChatResponseDto, DocumentResponseDto, MessageResponseDto, ProfileResponseDto } from '../../../shared/types/api';


function collectForwardedSenderAccountIds(plainText: string | undefined, accountIds: Set<string>, depth = 0) {
  if (!plainText || depth > 4) {
    return;
  }

  const richMessageContent = parseRichMessageContent(plainText);

  if (!richMessageContent) {
    return;
  }

  richMessageContent.forwardedMessages.forEach((forwardedMessage) => {
    accountIds.add(forwardedMessage.senderAccountId);
    collectForwardedSenderAccountIds(forwardedMessage.plainText, accountIds, depth + 1);
  });
}

type UseMessengerDirectoryControllerParams = {
  currentAccountId: string | undefined;
  chats: ChatResponseDto[];
  messagesByChatId: Record<string, MessageResponseDto[]>;
  decryptedMessagesById: Record<string, string>;
  chatDocuments: DocumentResponseDto[];
  profilesById: Record<string, ProfileResponseDto>;
  upsertProfiles: (profiles: ProfileResponseDto[]) => void;
};

export function useMessengerDirectoryController(params: UseMessengerDirectoryControllerParams) {
  const {
    currentAccountId,
    chats,
    messagesByChatId,
    decryptedMessagesById,
    chatDocuments,
    profilesById,
    upsertProfiles,
  } = params;
  const [miniProfile, setMiniProfile] = useState<ProfileResponseDto | null>(null);

  useEffect(() => {
    if (!currentAccountId) {
      return;
    }

    const accountIds = new Set<string>();
    accountIds.add(currentAccountId);

    chats.forEach((chat) => {
      chat.participantAccountIds.forEach((accountId) => accountIds.add(accountId));
      chat.participants.forEach((participant) => accountIds.add(participant.accountId));
    });

    Object.values(messagesByChatId).forEach((messages) => {
      messages.forEach((message) => {
        accountIds.add(message.senderAccountId);
        message.deliveryStates.forEach((deliveryState) => accountIds.add(deliveryState.accountId));
        message.devicePayloads.forEach((devicePayload) => accountIds.add(devicePayload.targetAccountId));
        collectForwardedSenderAccountIds(decryptedMessagesById[message.messageId], accountIds);
      });
    });

    chatDocuments.forEach((documentItem) => {
      accountIds.add(documentItem.ownerAccountId);

      if (documentItem.rejectedByAccountId) {
        accountIds.add(documentItem.rejectedByAccountId);
      }

      documentItem.signers?.forEach((signer) => accountIds.add(signer.signerAccountId));
      documentItem.observers?.forEach((observer) => accountIds.add(observer.observerAccountId));
      documentItem.signatures?.forEach((signature) => accountIds.add(signature.signerAccountId));
    });

    const missingAccountIds = Array.from(accountIds).filter((accountId) => !profilesById[accountId]);

    if (missingAccountIds.length === 0) {
      return;
    }

    let cancelled = false;

    async function loadMissingProfiles() {
      try {
        const loadedProfiles = await getProfilesByAccountIds(missingAccountIds);

        if (!cancelled && loadedProfiles.length > 0) {
          upsertProfiles(loadedProfiles);
        }
      }
      catch (error) {
        console.warn('Не удалось загрузить профили аккаунтов.', error);
      }
    }

    void loadMissingProfiles();

    return () => {
      cancelled = true;
    };
  }, [chatDocuments, chats, currentAccountId, decryptedMessagesById, messagesByChatId, profilesById, upsertProfiles]);

  const documentContactAccountIds = useMemo(() => {
    if (!currentAccountId) {
      return [];
    }

    return chats
      .filter((chat) => chat.type === 'DIRECT')
      .map((chat) => getDirectCompanionAccountId(chat, currentAccountId))
      .filter((accountId): accountId is string => Boolean(accountId && profilesById[accountId]));
  }, [chats, currentAccountId, profilesById]);

  function openMiniProfileByAccountId(accountId: string) {
    const foundProfile = profilesById[accountId];

    if (foundProfile) {
      setMiniProfile(foundProfile);
      return;
    }

    void getProfilesByAccountIds([accountId])
      .then((loadedProfiles) => {
        const loadedProfile = loadedProfiles[0];

        if (!loadedProfile) {
          return;
        }

        upsertProfiles([loadedProfile]);
        setMiniProfile(loadedProfile);
      })
      .catch((error) => {
        console.warn('Не удалось загрузить профиль аккаунта.', error);
      });
  }

  return {
    miniProfile,
    setMiniProfile,
    documentContactAccountIds,
    openMiniProfileByAccountId,
  };
}
