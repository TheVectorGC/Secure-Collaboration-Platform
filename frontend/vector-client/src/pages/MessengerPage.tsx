import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { logout as logoutRequest } from '../features/auth/api/authApi';
import { useAuthStore } from '../features/auth/model/authStore';
import { useCryptoBootstrap } from '../features/crypto/useCryptoBootstrap';
import { useCryptoStore } from '../features/crypto/model/cryptoStore';
import { getProfilesByAccountIds } from '../features/directory/api/profilesApi';
import { useDirectoryStore } from '../features/directory/model/directoryStore';
import { getChatMessages } from '../features/messages/api/messagesApi';
import { updateGroupChatAvatar } from '../features/chats/api/chatsApi';
import { useMessengerStore } from '../features/messenger/model/messengerStore';
import { useRealtimeConnection } from '../features/realtime/useRealtimeConnection';
import { useRealtimeStore } from '../features/realtime/model/realtimeStore';
import { getDirectCompanionAccountId } from '../shared/lib/profile';
import type { ProfileResponseDto } from '../shared/types/api';
import {
  createLocalAvatarDataUrl,
  getLocalAvatarStorageKey,
  getVisibleChatMessages,
  getLastTimelineMessage,
  getDownloadableAttachmentFromPlainText,
  getLastPeerActivityAt,
  getAccountActivityLabel,
  buildAccountLastActivityMap,
  isCurrentAccountActiveInChat,
  getActiveGroupParticipantAccountIds,
  getChatPresentation,
} from '../features/messenger/lib/messengerCore';
import { DocumentCreationModal, DocumentsPanel } from '../features/documents/ui/DocumentWorkflowModals';
import { NewChatModal } from '../features/messenger/ui/modals/NewChatModal';
import { GroupManagementModal } from '../features/messenger/ui/modals/GroupManagementModal';
import { SettingsModal } from '../features/settings/ui/SettingsModal';
import { MiniProfileModal } from '../features/profile/ui/MiniProfileModal';
import { MessengerOverlays } from '../features/messenger/ui/refactored/MessengerOverlays';
import { ChatSidebar } from '../features/messenger/ui/refactored/ChatSidebar';
import { ChatHeader } from '../features/messenger/ui/refactored/ChatHeader';
import { EmptyChatState, ChatAlerts } from '../features/messenger/ui/refactored/ChatStateBlocks';
import { MessageTimeline } from '../features/messenger/ui/refactored/MessageTimeline';
import { ForwardChatPicker } from '../features/messenger/ui/refactored/ForwardChatPicker';
import { MessageContextMenu } from '../features/messenger/ui/refactored/MessageContextMenu';
import { ComposerDock } from '../features/messenger/ui/refactored/ComposerDock';
import { usePersistentLocalChatState } from '../features/messenger/hooks/usePersistentLocalChatState';
import { useLocalMessageReactions } from '../features/messenger/hooks/useLocalMessageReactions';
import { useMessageContextMenuController } from '../features/messenger/hooks/useMessageContextMenuController';
import { useReplyForwardController } from '../features/messenger/hooks/useReplyForwardController';
import { useChatDragAndDrop } from '../features/messenger/hooks/useChatDragAndDrop';
import { useChatTypingComposer } from '../features/messenger/hooks/useChatTypingComposer';
import { useLocalChatActions } from '../features/messenger/hooks/useLocalChatActions';
import { useMessageDecryptionController } from '../features/messenger/hooks/useMessageDecryptionController';
import { usePendingAttachmentsController } from '../features/messenger/hooks/usePendingAttachmentsController';
import { useChatDataController } from '../features/messenger/hooks/useChatDataController';
import { useMessageSendingController } from '../features/messenger/hooks/useMessageSendingController';
import { useChatDocumentsController } from '../features/messenger/hooks/useChatDocumentsController';
import { useGroupChatController } from '../features/messenger/hooks/useGroupChatController';
import { useMessageNavigationController } from '../features/messenger/hooks/useMessageNavigationController';
import { useChatViewportController } from '../features/messenger/hooks/useChatViewportController';

export function MessengerPage() {
  const navigate = useNavigate();
  const profile = useAuthStore((state) => state.profile);
  const deviceId = useAuthStore((state) => state.deviceId);
  const refreshToken = useAuthStore((state) => state.refreshToken);
  const clearAuthentication = useAuthStore((state) => state.clearAuthentication);
  const setProfile = useAuthStore((state) => state.setProfile);
  const realtimeStatus = useRealtimeStore((state) => state.status);
  const [restoredDeviceIds, setRestoredDeviceIds] = useState<string[]>([]);
  const [localAvatarDataUrl, setLocalAvatarDataUrl] = useState<string | null>(() => profile?.avatarDataUrl ?? localStorage.getItem(getLocalAvatarStorageKey(profile?.accountId)));
  const [miniProfile, setMiniProfile] = useState<ProfileResponseDto | null>(null);
  const typingByChatId = useRealtimeStore((state) => state.typingByChatId);
  const presenceByAccountId = useRealtimeStore((state) => state.presenceByAccountId);
  const sendTypingEvent = useRealtimeStore((state) => state.sendTypingEvent);
  const cryptoStatus = useCryptoStore((state) => state.status);
  const cryptoDatabasePath = useCryptoStore((state) => state.databasePath);

  const chats = useMessengerStore((state) => state.chats);
  const selectedChatId = useMessengerStore((state) => state.selectedChatId);
  const messagesByChatId = useMessengerStore((state) => state.messagesByChatId);
  const setChats = useMessengerStore((state) => state.setChats);
  const upsertChat = useMessengerStore((state) => state.upsertChat);
  const selectChat = useMessengerStore((state) => state.selectChat);
  const setMessages = useMessengerStore((state) => state.setMessages);
  const upsertMessage = useMessengerStore((state) => state.upsertMessage);

  const profilesById = useDirectoryStore((state) => state.profilesById);
  const upsertProfile = useDirectoryStore((state) => state.upsertProfile);
  const upsertProfiles = useDirectoryStore((state) => state.upsertProfiles);

  const [chatSearchQuery, setChatSearchQuery] = useState('');
  const [isCreateChatOpen, setIsCreateChatOpen] = useState(false);
  const [isDevToolsOpen, setIsDevToolsOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [, setIsAttachmentMenuOpen] = useState(false);
  const [isGroupManagementOpen, setIsGroupManagementOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [readDetailsMessageId, setReadDetailsMessageId] = useState<string | null>(null);
  const [, setOpenedChatMenuId] = useState<string | null>(null);
  const [isChatActionsMenuOpen, setIsChatActionsMenuOpen] = useState(false);
  const [isDeleteChatConfirmOpen, setIsDeleteChatConfirmOpen] = useState(false);
  const { localChatState, updateLocalChatState } = usePersistentLocalChatState(profile?.accountId);
  const { localReactionsByMessageId, setLocalMessageReaction: updateLocalMessageReaction } = useLocalMessageReactions(profile?.accountId);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const messageElementRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const deliveredMarkersRef = useRef<Set<string>>(new Set());
  const readMarkersRef = useRef<Set<string>>(new Set());
  const { highlightedMessageId, scrollToMessage } = useMessageNavigationController(messageElementRefs);
  async function loadRestoredDeviceIds() {
    if (!profile?.accountId || !window.vectorCrypto) {
      setRestoredDeviceIds([]);
      return;
    }

    try {
      const loadedDeviceIds = await window.vectorCrypto.getRestoredDeviceIds({ accountId: profile.accountId });
      setRestoredDeviceIds(loadedDeviceIds);
    }
    catch (error) {
      console.warn(error);
      setRestoredDeviceIds([]);
    }
  }

  async function handleKeyBackupRestored() {
    resetDecryptionState();
    await loadRestoredDeviceIds();

    if (selectedChatId) {
      try {
        const loadedMessages = await getChatMessages(selectedChatId);
        setMessages(selectedChatId, loadedMessages);
      }
      catch (error) {
        console.error(error);
        setErrorMessage('Ключи восстановлены, но не удалось сразу обновить историю чата. Перезагрузите чат вручную.');
      }
    }
  }

  useEffect(() => {
    void loadRestoredDeviceIds();
  }, [profile?.accountId, deviceId]);

  useRealtimeConnection();
  useCryptoBootstrap();

  useEffect(() => {
    if (profile) {
      upsertProfile(profile);
    }
  }, [profile, upsertProfile]);

  const knownProfileAccountIds = useMemo(() => {
    const accountIds = new Set<string>();

    if (profile?.accountId) {
      accountIds.add(profile.accountId);
    }

    chats.forEach((chat) => {
      chat.participantAccountIds.forEach((accountId) => accountIds.add(accountId));
      chat.participants?.forEach((participant) => accountIds.add(participant.accountId));
    });

    Object.values(messagesByChatId).forEach((messages) => {
      messages.forEach((message) => {
        accountIds.add(message.senderAccountId);
        message.deliveryStates.forEach((deliveryState) => accountIds.add(deliveryState.accountId));
      });
    });

    return Array.from(accountIds);
  }, [chats, messagesByChatId, profile?.accountId]);

  useEffect(() => {
    let isCancelled = false;

    async function refreshKnownProfiles() {
      if (knownProfileAccountIds.length === 0) {
        return;
      }

      try {
        const profiles = await getProfilesByAccountIds(knownProfileAccountIds);

        if (!isCancelled) {
          upsertProfiles(profiles);

          if (profile?.accountId) {
            const currentProfile = profiles.find((loadedProfile) => loadedProfile.accountId === profile.accountId);

            if (currentProfile) {
              setProfile(currentProfile);
            }
          }
        }
      }
      catch (error) {
        console.warn('Failed to refresh known profiles.', error);
      }
    }

    void refreshKnownProfiles();
    const intervalId = window.setInterval(refreshKnownProfiles, 10000);

    return () => {
      isCancelled = true;
      window.clearInterval(intervalId);
    };
  }, [knownProfileAccountIds, profile?.accountId, setProfile, upsertProfiles]);


  const openMiniProfileByAccountId = useCallback(async (accountId: string | null | undefined) => {
    if (!accountId) {
      return;
    }

    const cachedProfile = accountId === profile?.accountId ? profile : profilesById[accountId] ?? null;

    if (cachedProfile) {
      setMiniProfile(cachedProfile);
      return;
    }

    try {
      const loadedProfiles = await getProfilesByAccountIds([accountId]);
      const loadedProfile = loadedProfiles.find((candidateProfile) => candidateProfile.accountId === accountId) ?? null;

      if (loadedProfile) {
        upsertProfile(loadedProfile);
        setMiniProfile(loadedProfile);
      }
    }
    catch (error) {
      console.warn('Failed to open profile.', error);
      setErrorMessage('Не удалось загрузить профиль пользователя.');
    }
  }, [profile, profilesById, upsertProfile]);

  useEffect(() => {
    setLocalAvatarDataUrl(profile?.avatarDataUrl ?? localStorage.getItem(getLocalAvatarStorageKey(profile?.accountId)));
  }, [profile?.accountId, profile?.avatarDataUrl]);

  useEffect(() => {
    function handleKeyboardShortcut(event: globalThis.KeyboardEvent) {
      if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === 'd' && profile?.username === 'admin') {
        event.preventDefault();
        setIsDevToolsOpen((previousValue) => !previousValue);
      }
    }

    window.addEventListener('keydown', handleKeyboardShortcut);
    return () => window.removeEventListener('keydown', handleKeyboardShortcut);
  }, [profile?.username]);

  const selectedChat = useMemo(
    () => chats.find((chat) => chat.chatId === selectedChatId) ?? null,
    [chats, selectedChatId],
  );

  const selectedMessages = selectedChatId ? messagesByChatId[selectedChatId] ?? [] : [];
  const visibleSelectedMessages = useMemo(
    () => getVisibleChatMessages(selectedMessages, selectedChatId ? localChatState.clearedAtByChatId[selectedChatId] : null),
    [localChatState.clearedAtByChatId, selectedChatId, selectedMessages],
  );
  const loadedMessages = useMemo(
    () => Object.values(messagesByChatId).flat(),
    [messagesByChatId],
  );
  const {
    decryptedMessagesById,
    setDecryptedMessagesById,
    resetDecryptionState,
    clearTemporarilyMissingGroupKeys,
  } = useMessageDecryptionController({
    accountId: profile?.accountId,
    deviceId,
    restoredDeviceIds,
    loadedMessages,
  });
  const lastActivityByAccountId = useMemo(
    () => buildAccountLastActivityMap(messagesByChatId),
    [messagesByChatId],
  );
  const hiddenChatIdSet = useMemo(() => new Set(localChatState.hiddenChatIds), [localChatState.hiddenChatIds]);
  const selectedChatActiveParticipantAccountIds = useMemo(
    () => getActiveGroupParticipantAccountIds(selectedChat),
    [selectedChat],
  );
  const selectedChatActiveParticipantAccountIdSet = useMemo(
    () => new Set(selectedChatActiveParticipantAccountIds),
    [selectedChatActiveParticipantAccountIds],
  );
  const isSelectedChatWritable = isCurrentAccountActiveInChat(selectedChat, profile?.accountId);
  const selectedTypingStates = selectedChatId
    ? (typingByChatId[selectedChatId] ?? []).filter((typingState) => selectedChat?.type !== 'GROUP' || selectedChatActiveParticipantAccountIdSet.has(typingState.accountId))
    : [];

  const {
    messageContextMenu,
    messageContextMenuRef,
    openMessageContextMenu,
    closeMessageContextMenu,
  } = useMessageContextMenuController({
    currentAccountId: profile?.accountId,
    getMessageById: (messageId) => visibleSelectedMessages.find((message) => message.messageId === messageId) ?? null,
    onContextMenuOpen: () => setReadDetailsMessageId(null),
  });

  const {
    replyDraft,
    setReplyDraft,
    forwardSelection,
    forwardDraftItems,
    setForwardDraftItems,
    isForwardChatPickerOpen,
    setIsForwardChatPickerOpen,
    forwardChatPickerQuery,
    setForwardChatPickerQuery,
    startReplyFromContextMenu,
    startForwardFromContextMenu,
    toggleForwardSelectedMessage,
    cancelForwardSelection,
    openForwardChatPicker,
    selectForwardTargetChat,
  } = useReplyForwardController({
    selectedChatId,
    messagesByChatId,
    profilesById,
    decryptedMessagesById,
    onSelectChat: selectChat,
    onCloseContextMenu: closeMessageContextMenu,
  });

  const {
    isUploadingFile,
    setIsUploadingFile,
    pendingAttachments,
    setPendingAttachments,
    handleAttachFile,
    removePendingAttachment,
    uploadPendingAttachment,
  } = usePendingAttachmentsController({
    selectedChatId,
    selectedChat,
    deviceId,
    isChatWritable: isSelectedChatWritable,
    onErrorMessageChange: setErrorMessage,
  });

  const {
    isDraggingFileOverChat,
    droppedImageFiles,
    setDroppedImageFiles,
    setIsDraggingFileOverChat,
    sendDroppedImages,
    handleChatDrop,
    handleChatDragOver,
    handleChatDragEnter,
    handleChatDragLeave,
  } = useChatDragAndDrop({
    isChatWritable: isSelectedChatWritable,
    onAttachFile: handleAttachFile,
  });

  const {
    messageText,
    setMessageText,
    sendCurrentTypingState,
    handleMessageTextChange,
    handleTextareaKeyDown,
    appendEmojiToMessage,
  } = useChatTypingComposer({
    selectedChat,
    currentAccountId: profile?.accountId,
    isChatWritable: isSelectedChatWritable,
    sendTypingEvent,
    onSubmit: () => {
      void handleSendCurrentMessage();
    },
  });

  useEffect(() => {
    closeMessageContextMenu();
  }, [profile?.accountId]);

  function setLocalMessageReaction(messageId: string, emoji: string) {
    updateLocalMessageReaction(messageId, emoji);
    closeMessageContextMenu();
  }

  const filteredChats = useMemo(() => {
    const normalizedQuery = chatSearchQuery.trim().toLowerCase();

    const visibleChats = chats.filter((chat) => {
      if (hiddenChatIdSet.has(chat.chatId)) {
        return false;
      }

      if (chat.type === 'DIRECT') {
        const chatMessages = messagesByChatId[chat.chatId] ?? [];
        const hasTimelineMessage = Boolean(getLastTimelineMessage(chatMessages));

        if (!chat.lastMessageId && !hasTimelineMessage) {
          return false;
        }
      }

      return true;
    });

    if (!normalizedQuery) {
      return visibleChats;
    }

    return visibleChats.filter((chat) => {
      const presentation = getChatPresentation(chat, profile, profilesById);
      return `${presentation.title} ${presentation.subtitle}`.toLowerCase().includes(normalizedQuery);
    });
  }, [chatSearchQuery, chats, hiddenChatIdSet, messagesByChatId, profile, profilesById]);

  const forwardTargetChats = useMemo(() => {
    const normalizedQuery = forwardChatPickerQuery.trim().toLowerCase();

    return filteredChats.filter((chat) => {
      if (!normalizedQuery) {
        return true;
      }

      const presentation = getChatPresentation(chat, profile, profilesById);
      return `${presentation.title} ${presentation.subtitle}`.toLowerCase().includes(normalizedQuery);
    });
  }, [filteredChats, forwardChatPickerQuery, profile, profilesById]);

  const {
    handleClearSelectedChatHistory,
    handleDeleteSelectedChatLocally,
  } = useLocalChatActions({
    selectedChatId,
    filteredChats,
    selectChat,
    updateLocalChatState,
    setIsChatActionsMenuOpen,
    setIsDeleteChatConfirmOpen,
  });

  const {
    timelineScrollContainerRef,
    unreadIncomingCount,
    isJumpToBottomVisible,
    handleTimelineScroll,
    handleJumpToBottom,
  } = useChatViewportController({
    selectedChatId,
    currentAccountId: profile?.accountId,
    visibleSelectedMessages,
    localChatState,
    isSelectedChatWritable,
    updateLocalChatState,
    messagesEndRef,
    messageElementRefs,
    readMarkersRef,
  });

  const { refreshSelectedChat } = useChatDataController({
    selectedChatId,
    selectedChat,
    chats,
    hiddenChatIdSet,
    messagesByChatId,
    localChatState,
    currentAccountId: profile?.accountId,
    visibleSelectedMessages,
    isSelectedChatWritable,
    setChats,
    upsertChat,
    selectChat,
    setMessages,
    updateLocalChatState,
    setErrorMessage,
    setReadDetailsMessageId,
    deliveredMarkersRef,
  });

  const {
    isSending,
    setIsSending,
    sendEncryptedChatContent,
    buildEncryptedDevicePayloadsForAccounts,
    handleSendCurrentMessage,
  } = useMessageSendingController({
    selectedChatId,
    selectedChat,
    currentAccountId: profile?.accountId,
    deviceId,
    messageText,
    replyDraft,
    forwardDraftItems,
    pendingAttachments,
    isSelectedChatWritable,
    setMessageText,
    setReplyDraft,
    setForwardDraftItems,
    setPendingAttachments,
    setIsUploadingFile,
    setErrorMessage,
    uploadPendingAttachment,
    sendCurrentTypingState,
    refreshSelectedChat,
    upsertMessage,
    setDecryptedMessagesById,
  });

  const {
    isDocumentsPanelOpen,
    setIsDocumentsPanelOpen,
    chatDocuments,
    isLoadingDocuments,
    openDocumentsWorkspace,
    loadWorkspaceDocuments,
    documentNotificationCount,
    pendingDocumentFile,
    handleStartDocumentCreation,
    cancelPendingDocumentCreation,
    confirmDocumentCreation,
    handleDownloadAttachment,
    handleDownloadDocument,
    handleSignDocument,
    handleRejectDocument,
    handleCancelDocument,
    handleAddDocumentObservers,
    handleHideDocument,
    verifyLocalDocumentFile,
  } = useChatDocumentsController({
    currentAccountId: profile?.accountId,
    deviceId,
    decryptedMessagesById,
    setIsSending,
    setIsUploadingFile,
    setErrorMessage,
  });

  async function handleLogout() {
    try {
      if (refreshToken) {
        await logoutRequest({ refreshToken });
      }
    }
    catch (error) {
      console.warn(error);
    }
    finally {
      clearAuthentication();
      navigate('/login');
    }
  }

  async function handleUpdateGroupAvatar(chatId: string, file: File | null) {
    setErrorMessage(null);
    const avatarDataUrl = file ? await createLocalAvatarDataUrl(file) : null;
    const updatedChat = await updateGroupChatAvatar(chatId, { avatarDataUrl });
    upsertChat(updatedChat);
  }

  const {
    handleCreateDirectChat,
    handleCreateGroupChat,
    handleAddGroupParticipant,
    handleRemoveGroupParticipant,
  } = useGroupChatController({
    selectedChatId,
    selectedChat,
    currentAccountId: profile?.accountId,
    deviceId,
    upsertProfile,
    upsertChat,
    selectChat,
    setIsCreateChatOpen,
    setErrorMessage,
    clearTemporarilyMissingGroupKeys,
    setDecryptedMessagesById,
    buildEncryptedDevicePayloadsForAccounts,
  });

  const contactAccountIds = useMemo(() => {
    if (!profile?.accountId) {
      return [];
    }

    const accountIds = new Set<string>();

    chats.forEach((chat) => {
      if (chat.type !== 'DIRECT') {
        return;
      }

      const companionAccountId = getDirectCompanionAccountId(chat, profile.accountId);

      if (companionAccountId) {
        accountIds.add(companionAccountId);
      }
    });

    return Array.from(accountIds);
  }, [chats, profile?.accountId]);

  const selectedChatPresentation = selectedChat ? getChatPresentation(selectedChat, profile, profilesById) : null;
  const selectedTypingText = isSelectedChatWritable && selectedTypingStates.length > 0
    ? selectedTypingStates.length === 1
      ? `${selectedTypingStates[0].username || 'Пользователь'} печатает…`
      : 'Несколько пользователей печатают…'
    : null;
  const selectedDirectCompanionAccountId = selectedChat?.type === 'DIRECT' ? getDirectCompanionAccountId(selectedChat, profile?.accountId) : null;
  const selectedDirectLastActivityAt = getLastPeerActivityAt(visibleSelectedMessages, selectedDirectCompanionAccountId);
  const selectedDirectPresence = selectedDirectCompanionAccountId ? presenceByAccountId[selectedDirectCompanionAccountId] : null;
  const selectedChatSubtitle = selectedTypingText
    ?? (selectedChat?.type === 'SELF'
      ? 'Личный чат'
      : selectedChat?.type === 'DIRECT'
        ? getAccountActivityLabel(selectedDirectPresence, selectedDirectLastActivityAt)
        : selectedChatPresentation?.subtitle ?? '');

  return (
    <div
      className="relative flex h-screen overflow-hidden bg-[#0d0e12] text-zinc-100 before:pointer-events-none before:absolute before:inset-0 before:bg-[radial-gradient(circle_at_16%_12%,rgba(139,92,246,0.20),transparent_30rem),radial-gradient(circle_at_92%_8%,rgba(236,72,153,0.14),transparent_26rem),radial-gradient(circle_at_60%_110%,rgba(14,165,233,0.10),transparent_32rem)] before:content-[\'\']"
      onDragEnter={handleChatDragEnter}
      onDragOver={handleChatDragOver}
      onDragLeave={handleChatDragLeave}
      onDrop={handleChatDrop}
    >
      <NewChatModal
        isOpen={isCreateChatOpen}
        currentAccountId={profile?.accountId}
        onClose={() => setIsCreateChatOpen(false)}
        onCreateChat={handleCreateDirectChat}
        onCreateGroupChat={handleCreateGroupChat}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        profile={profile}
        deviceId={deviceId}
        cryptoStatus={cryptoStatus}
        cryptoDatabasePath={cryptoDatabasePath}
        realtimeStatus={realtimeStatus}
        onClose={() => setIsSettingsOpen(false)}
        onLogout={handleLogout}
        onBackupRestored={handleKeyBackupRestored}
        onProfileUpdated={(updatedProfile) => {
          setProfile(updatedProfile);
          upsertProfile(updatedProfile);
          setLocalAvatarDataUrl(updatedProfile.avatarDataUrl ?? null);
        }}
      />



      <MiniProfileModal
        profile={miniProfile}
        isCurrentAccount={miniProfile?.accountId === profile?.accountId}
        lastActivityAt={miniProfile ? lastActivityByAccountId[miniProfile.accountId] : null}
        presence={miniProfile ? presenceByAccountId[miniProfile.accountId] : null}
        localAvatarDataUrl={localAvatarDataUrl}
        onClose={() => setMiniProfile(null)}
        onMessage={handleCreateDirectChat}
      />

      <GroupManagementModal
        isOpen={isGroupManagementOpen}
        chat={selectedChat}
        currentAccountId={profile?.accountId}
        profilesById={profilesById}
        presenceByAccountId={presenceByAccountId}
        lastActivityByAccountId={lastActivityByAccountId}
        onClose={() => setIsGroupManagementOpen(false)}
        onAddParticipant={handleAddGroupParticipant}
        onRemoveParticipant={handleRemoveGroupParticipant}
        onUpdateGroupAvatar={handleUpdateGroupAvatar}
        onOpenProfile={(accountId) => void openMiniProfileByAccountId(accountId)}
      />

      <DocumentCreationModal
        file={pendingDocumentFile}
        currentAccountId={profile?.accountId}
        profilesById={profilesById}
        contactAccountIds={contactAccountIds}
        onClose={cancelPendingDocumentCreation}
        onConfirm={confirmDocumentCreation}
      />

      <DocumentsPanel
        isOpen={isDocumentsPanelOpen}
        documents={chatDocuments}
        isLoading={isLoadingDocuments}
        activeAccountId={profile?.accountId}
        profilesById={profilesById}
        onClose={() => setIsDocumentsPanelOpen(false)}
        onRefresh={loadWorkspaceDocuments}
        onDownload={handleDownloadDocument}
        onSign={handleSignDocument}
        onReject={handleRejectDocument}
        onCancel={handleCancelDocument}
        onHide={handleHideDocument}
        onVerifyFile={verifyLocalDocumentFile}
        onCreateDocument={handleStartDocumentCreation}
        onAddObservers={handleAddDocumentObservers}
        contactAccountIds={contactAccountIds}
      />

      <MessengerOverlays
        selectedChat={selectedChat}
        isDeleteChatConfirmOpen={isDeleteChatConfirmOpen}
        droppedImageFiles={droppedImageFiles}
        isDraggingFileOverChat={isDraggingFileOverChat}
        isSelectedChatWritable={isSelectedChatWritable}
        isDevToolsOpen={isDevToolsOpen}
        isAdmin={profile?.username === 'admin'}
        onCloseDeleteChatConfirm={() => setIsDeleteChatConfirmOpen(false)}
        onDeleteSelectedChatLocally={handleDeleteSelectedChatLocally}
        onSendDroppedImages={(attachmentDisplayMode) => void sendDroppedImages(attachmentDisplayMode)}
        onClearDroppedImageFiles={() => setDroppedImageFiles([])}
        onCloseDraggingFileOverlay={() => setIsDraggingFileOverChat(false)}
        onCloseDevTools={() => setIsDevToolsOpen(false)}
      />

      <ChatSidebar
        chats={chats}
        filteredChats={filteredChats}
        selectedChatId={selectedChatId}
        currentProfile={profile}
        profilesById={profilesById}
        messagesByChatId={messagesByChatId}
        decryptedMessagesById={decryptedMessagesById}
        localChatState={localChatState}
        chatSearchQuery={chatSearchQuery}
        realtimeStatus={realtimeStatus}
        cryptoStatus={cryptoStatus}
        localAvatarDataUrl={localAvatarDataUrl}
        presenceByAccountId={presenceByAccountId}
        onChatSearchQueryChange={setChatSearchQuery}
        onCreateChatOpen={() => setIsCreateChatOpen(true)}
        onSelectChat={selectChat}
        onCloseOpenedChatMenu={() => setOpenedChatMenuId(null)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenDevTools={() => setIsDevToolsOpen(true)}
        onOpenDocumentsWorkspace={openDocumentsWorkspace}
        pendingDocumentCount={documentNotificationCount}
      />

      <main className="vector-chat-wallpaper relative z-10 flex min-w-0 flex-1 flex-col overflow-hidden bg-[#0c0e14]/84 backdrop-blur-sm">
        {!selectedChat || !selectedChatPresentation ? (
          <EmptyChatState />
        ) : (
          <>
            <ChatHeader
              selectedChat={selectedChat}
              selectedChatPresentation={selectedChatPresentation}
              selectedChatSubtitle={selectedChatSubtitle}
              isChatActionsMenuOpen={isChatActionsMenuOpen}
              onOpenGroupManagement={() => setIsGroupManagementOpen(true)}
              onOpenDirectProfile={() => void openMiniProfileByAccountId(selectedDirectCompanionAccountId)}
              onToggleChatActionsMenu={() => setIsChatActionsMenuOpen((previousValue) => !previousValue)}
              onClearSelectedChatHistory={handleClearSelectedChatHistory}
              onOpenDeleteChatConfirm={() => {
                setIsChatActionsMenuOpen(false);
                setIsDeleteChatConfirmOpen(true);
              }}
            />

            <ChatAlerts
              errorMessage={errorMessage}
              isGroupChatReadOnly={selectedChat.type === 'GROUP' && !isSelectedChatWritable}
            />

            <MessageTimeline
              selectedChat={selectedChat}
              visibleSelectedMessages={visibleSelectedMessages}
              currentAccountId={profile?.accountId}
              profilesById={profilesById}
              decryptedMessagesById={decryptedMessagesById}
              readDetailsMessageId={readDetailsMessageId}
              highlightedMessageId={highlightedMessageId}
              localReactionsByMessageId={localReactionsByMessageId}
              forwardSelectionSelectedMessageIds={forwardSelection?.selectedMessageIds ?? null}
              selectedTypingText={selectedTypingText}
              messageElementRefs={messageElementRefs}
              messagesEndRef={messagesEndRef}
              timelineScrollContainerRef={timelineScrollContainerRef}
              unreadIncomingCount={unreadIncomingCount}
              isJumpToBottomVisible={isJumpToBottomVisible}
              onToggleForwardSelectedMessage={toggleForwardSelectedMessage}
              onTimelineScroll={handleTimelineScroll}
              onJumpToBottom={handleJumpToBottom}
              onOpenMessageContextMenu={openMessageContextMenu}
              onScrollToMessage={scrollToMessage}
              onDownloadAttachment={handleDownloadAttachment}
              onOpenProfile={(accountId) => void openMiniProfileByAccountId(accountId)}
              onSetReadDetailsMessageId={setReadDetailsMessageId}
              onSetLocalMessageReaction={setLocalMessageReaction}
            />

            <ForwardChatPicker
              isOpen={isForwardChatPickerOpen}
              query={forwardChatPickerQuery}
              currentProfile={profile}
              profilesById={profilesById}
              messagesByChatId={messagesByChatId}
              decryptedMessagesById={decryptedMessagesById}
              localChatState={localChatState}
              targetChats={forwardTargetChats}
              onQueryChange={setForwardChatPickerQuery}
              onClose={() => setIsForwardChatPickerOpen(false)}
              onSelectChat={selectForwardTargetChat}
            />

            {messageContextMenu && (() => {
              const contextMessage = visibleSelectedMessages.find((message) => message.messageId === messageContextMenu.messageId) ?? null;
              const currentReaction = contextMessage ? localReactionsByMessageId[contextMessage.messageId] : null;
              const contextDownloadableAttachment = contextMessage
                ? getDownloadableAttachmentFromPlainText(decryptedMessagesById[contextMessage.messageId])
                : null;

              return (
                <MessageContextMenu
                  contextMenu={messageContextMenu}
                  contextMenuRef={messageContextMenuRef}
                  contextMessage={contextMessage}
                  currentReaction={currentReaction}
                  downloadableAttachment={contextDownloadableAttachment}
                  onReply={startReplyFromContextMenu}
                  onForward={startForwardFromContextMenu}
                  onDownload={(attachment) => {
                    closeMessageContextMenu();
                    void handleDownloadAttachment(attachment);
                  }}
                  onReact={setLocalMessageReaction}
                />
              );
            })()}

            <ComposerDock
              messageText={messageText}
              isSending={isSending}
              isUploadingFile={isUploadingFile}
              isWritable={Boolean(selectedChat && isSelectedChatWritable)}
              forwardSelection={forwardSelection}
              forwardDraftItems={forwardDraftItems}
              replyDraft={replyDraft}
              pendingAttachments={pendingAttachments}
              onCancelForwardSelection={cancelForwardSelection}
              onOpenForwardChatPicker={openForwardChatPicker}
              onCancelReply={() => setReplyDraft(null)}
              onCancelForwardDraft={() => setForwardDraftItems([])}
              onRemovePendingAttachment={removePendingAttachment}
              onMessageTextChange={handleMessageTextChange}
              onMessageBlur={() => sendCurrentTypingState(false)}
              onTextareaKeyDown={handleTextareaKeyDown}
              onAttachFile={handleAttachFile}
              onAppendEmoji={appendEmojiToMessage}
              onSendCurrentMessage={handleSendCurrentMessage}
            />
          </>
        )}
      </main>
    </div>
  );
}
