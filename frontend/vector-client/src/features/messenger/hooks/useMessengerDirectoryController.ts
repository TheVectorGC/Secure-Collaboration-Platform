import { useEffect, useMemo, useState } from 'react';
import { getProfilesByAccountIds } from '../../directory/api/profilesApi';
import { getDirectCompanionAccountId } from '../../../shared/lib/profile';
import type { ChatResponseDto, DocumentResponseDto, MessageResponseDto, ProfileResponseDto } from '../../../shared/types/api';

type UseMessengerDirectoryControllerParams = {
  currentAccountId: string | undefined;
  chats: ChatResponseDto[];
  messagesByChatId: Record<string, MessageResponseDto[]>;
  chatDocuments: DocumentResponseDto[];
  profilesById: Record<string, ProfileResponseDto>;
  upsertProfiles: (profiles: ProfileResponseDto[]) => void;
};

export function useMessengerDirectoryController(params: UseMessengerDirectoryControllerParams) {
  const {
    currentAccountId,
    chats,
    messagesByChatId,
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
      });
    });

    chatDocuments.forEach((documentItem) => {
      accountIds.add(documentItem.ownerAccountId);

      if (documentItem.rejectedByAccountId) {
        accountIds.add(documentItem.rejectedByAccountId);
      }

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
  }, [chatDocuments, chats, currentAccountId, messagesByChatId, profilesById, upsertProfiles]);

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
    }
  }

  return {
    miniProfile,
    setMiniProfile,
    documentContactAccountIds,
    openMiniProfileByAccountId,
  };
}
