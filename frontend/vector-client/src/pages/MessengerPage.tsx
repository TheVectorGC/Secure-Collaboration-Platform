import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { logout as logoutRequest } from '../features/auth/api/authApi';
import { useAuthStore } from '../features/auth/model/authStore';
import { useCryptoBootstrap } from '../features/crypto/useCryptoBootstrap';
import { useCryptoStore } from '../features/crypto/model/cryptoStore';
import { BackupUnlockModal } from '../features/crypto/ui/BackupUnlockModal';
import { useDirectoryStore } from '../features/directory/model/directoryStore';
import { updateGroupChatAvatar } from '../features/chats/api/groupChatsApi';
import { useMessengerStore } from '../features/messenger/model/messengerStore';
import { useRealtimeConnection } from '../features/realtime/useRealtimeConnection';
import { useRealtimeStore } from '../features/realtime/model/realtimeStore';
import {
  buildAccountLastActivityMap,
  createLocalAvatarDataUrl,
  getDownloadableAttachmentFromPlainText,
  getLocalAvatarStorageKey,
  getMessageContentPreview,
  isDecryptionPlaceholder,
  parseRichMessageContent,
} from '../features/messenger/lib/messengerCore';
import { NewChatModal } from '../features/messenger/ui/modals/NewChatModal';
import { SettingsModal } from '../features/settings/ui/SettingsModal';
import { MiniProfileModal } from '../features/profile/ui/MiniProfileModal';
import { DocumentCreationModal, DocumentsPanel } from '../features/documents/ui/DocumentWorkflowModals';
import { MessengerOverlays } from '../features/messenger/ui/layout/MessengerOverlays';
import { GroupManagementModal } from '../features/messenger/ui/modals/GroupManagementModal';
import { ChatSidebar } from '../features/messenger/ui/layout/ChatSidebar';
import { ChatHeader } from '../features/messenger/ui/layout/ChatHeader';
import { EmptyChatState, ChatAlerts } from '../features/messenger/ui/layout/ChatStateBlocks';
import { MessageTimeline } from '../features/messenger/ui/layout/MessageTimeline';
import { ForwardChatPicker } from '../features/messenger/ui/layout/ForwardChatPicker';
import { MessageContextMenu } from '../features/messenger/ui/layout/MessageContextMenu';
import { ComposerDock } from '../features/messenger/ui/layout/ComposerDock';
import { usePersistentLocalChatState } from '../features/messenger/hooks/usePersistentLocalChatState';
import { useMessageReactionsController } from '../features/messenger/hooks/useMessageReactionsController';
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
import { useSelectedChatViewModel } from '../features/messenger/hooks/useSelectedChatViewModel';
import { useMessengerDirectoryController } from '../features/messenger/hooks/useMessengerDirectoryController';
import { useDirectChatBlockController } from '../features/messenger/hooks/useDirectChatBlockController';
import { useChatListsViewModel } from '../features/messenger/hooks/useChatListsViewModel';
import type { MessageResponseDto } from '../shared/types/api';

const MESSAGE_EDIT_WINDOW_MS = 15 * 60 * 1000;

function getEditableMessageText(plainText: string): string {
  const richMessageContent = parseRichMessageContent(plainText);
  return richMessageContent ? richMessageContent.text : plainText;
}

function isMessageEditable(message: MessageResponseDto | null, currentAccountId: string | undefined, plainText: string | undefined): boolean {
  if (!message || !currentAccountId || !plainText || isDecryptionPlaceholder(plainText) || plainText === 'Расшифровка…') {
    return false;
  }

  if (message.senderAccountId !== currentAccountId || message.messageType !== 'TEXT') {
    return false;
  }

  const createdAtMs = Date.parse(message.createdAt);

  if (!Number.isFinite(createdAtMs) || Date.now() - createdAtMs > MESSAGE_EDIT_WINDOW_MS) {
    return false;
  }

  if (getDownloadableAttachmentFromPlainText(plainText)) {
    return false;
  }

  const richMessageContent = parseRichMessageContent(plainText);

  if (richMessageContent) {
    return richMessageContent.text.trim().length > 0;
  }

  return plainText.trim().length > 0;
}

export function MessengerPage() {
  const navigate = useNavigate();
  const profile = useAuthStore((state) => state.profile);
  const deviceId = useAuthStore((state) => state.deviceId);
  const refreshToken = useAuthStore((state) => state.refreshToken);
  const clearAuthentication = useAuthStore((state) => state.clearAuthentication);
  const setProfile = useAuthStore((state) => state.setProfile);
  const realtimeStatus = useRealtimeStore((state) => state.status);
  const [localAvatarDataUrl, setLocalAvatarDataUrl] = useState<string | null>(() => profile?.avatarDataUrl ?? localStorage.getItem(getLocalAvatarStorageKey(profile?.accountId)));
  const typingByChatId = useRealtimeStore((state) => state.typingByChatId);
  const presenceByAccountId = useRealtimeStore((state) => state.presenceByAccountId);
  const sendTypingEvent = useRealtimeStore((state) => state.sendTypingEvent);
  const clearRealtimeSessionState = useRealtimeStore((state) => state.clearSessionState);
  const cryptoStatus = useCryptoStore((state) => state.status);

  const chats = useMessengerStore((state) => state.chats);
  const selectedChatId = useMessengerStore((state) => state.selectedChatId);
  const messagesByChatId = useMessengerStore((state) => state.messagesByChatId);
  const setChats = useMessengerStore((state) => state.setChats);
  const upsertChat = useMessengerStore((state) => state.upsertChat);
  const selectChat = useMessengerStore((state) => state.selectChat);
  const setMessages = useMessengerStore((state) => state.setMessages);
  const upsertMessage = useMessengerStore((state) => state.upsertMessage);
  const applyMessageReaction = useMessengerStore((state) => state.applyMessageReaction);

  const profilesById = useDirectoryStore((state) => state.profilesById);
  const upsertProfile = useDirectoryStore((state) => state.upsertProfile);
  const upsertProfiles = useDirectoryStore((state) => state.upsertProfiles);

  const [chatSearchQuery, setChatSearchQuery] = useState('');
  const [isCreateChatOpen, setIsCreateChatOpen] = useState(false);
  const [isDevToolsOpen, setIsDevToolsOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isGroupManagementOpen, setIsGroupManagementOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [readDetailsMessageId, setReadDetailsMessageId] = useState<string | null>(null);
  const [, setOpenedChatMenuId] = useState<string | null>(null);
  const [isChatActionsMenuOpen, setIsChatActionsMenuOpen] = useState(false);
  const [isDeleteChatConfirmOpen, setIsDeleteChatConfirmOpen] = useState(false);
  const [isBlockUserConfirmOpen, setIsBlockUserConfirmOpen] = useState(false);
  const [isClearHistoryConfirmOpen, setIsClearHistoryConfirmOpen] = useState(false);
  const [isLeaveGroupConfirmOpen, setIsLeaveGroupConfirmOpen] = useState(false);
  const [editDraft, setEditDraft] = useState<{ message: MessageResponseDto; plainText: string } | null>(null);
  const { localChatState, updateLocalChatState } = usePersistentLocalChatState(profile?.accountId);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messageElementRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const deliveredMarkersRef = useRef<Set<string>>(new Set());
  const readMarkersRef = useRef<Set<string>>(new Set());
  const previousRealtimeAccountIdRef = useRef<string | null>(profile?.accountId ?? null);
  const { highlightedMessageId, scrollToMessage } = useMessageNavigationController(messageElementRefs);
  useRealtimeConnection();
  useCryptoBootstrap();

  useEffect(() => {
    const previousAccountId = previousRealtimeAccountIdRef.current;
    const nextAccountId = profile?.accountId ?? null;

    if (previousAccountId !== nextAccountId) {
      clearRealtimeSessionState();
      previousRealtimeAccountIdRef.current = nextAccountId;
    }
  }, [clearRealtimeSessionState, profile?.accountId]);

  useEffect(() => {
    if (profile) {
      upsertProfile(profile);
    }
  }, [profile, upsertProfile]);

  useEffect(() => {
    setLocalAvatarDataUrl(profile?.avatarDataUrl ?? localStorage.getItem(getLocalAvatarStorageKey(profile?.accountId)));
  }, [profile?.accountId]);

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

  const {
    selectedChat,
    visibleSelectedMessages,
    loadedMessages,
    hiddenChatIdSet,
    selectedDirectCompanionAccountId,
    isSelectedDirectChatBlockedByCurrentAccount,
    isSelectedChatWritable,
    isSelectedGroupChatLeft,
    selectedGroupParticipant,
    selectedChatPresentation,
    directBlockNotice,
    selectedTypingText,
    selectedChatSubtitle,
  } = useSelectedChatViewModel({
    chats,
    selectedChatId,
    messagesByChatId,
    localChatState,
    currentProfile: profile,
    profilesById,
    typingByChatId,
    presenceByAccountId,
  });

  const {
    decryptedMessagesById,
    setDecryptedMessagesById,
    resetDecryptionState,
    clearTemporarilyMissingGroupKeys,
  } = useMessageDecryptionController({
    accountId: profile?.accountId,
    deviceId,
    loadedMessages,
    isCryptoReady: cryptoStatus === 'ready',
  });
  const lastActivityByAccountId = useMemo(
    () => buildAccountLastActivityMap(messagesByChatId),
    [messagesByChatId],
  );

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

  useEffect(() => {
    setErrorMessage(null);
    setReadDetailsMessageId(null);
    closeMessageContextMenu();
    setIsChatActionsMenuOpen(false);
    setIsDeleteChatConfirmOpen(false);
    setIsBlockUserConfirmOpen(false);
    setIsLeaveGroupConfirmOpen(false);
    setEditDraft(null);
  }, [selectedChatId]);

  useEffect(() => {
    if (!errorMessage) {
      return;
    }

    const timeoutId = window.setTimeout(() => setErrorMessage(null), 7000);
    return () => window.clearTimeout(timeoutId);
  }, [errorMessage]);

  const {
    filteredChats,
    forwardTargetChats,
  } = useChatListsViewModel({
    chats,
    messagesByChatId,
    hiddenChatIdSet,
    localChatState,
    chatSearchQuery,
    forwardChatPickerQuery,
    currentProfile: profile,
    profilesById,
  });


  function startEditFromContextMenu(message: MessageResponseDto | null) {
    if (!message) {
      return;
    }

    const plainText = decryptedMessagesById[message.messageId];

    if (!isMessageEditable(message, profile?.accountId, plainText)) {
      closeMessageContextMenu();
      return;
    }

    setEditDraft({ message, plainText });
    setMessageText(getEditableMessageText(plainText));
    setReplyDraft(null);
    setForwardDraftItems([]);
    setPendingAttachments([]);
    closeMessageContextMenu();
  }

  const {
    handleClearSelectedChatHistory,
    handleDeleteSelectedChatLocally,
    handleToggleSelectedChatPinned,
    restoreChatLocally,
  } = useLocalChatActions({
    selectedChatId,
    filteredChats,
    selectChat,
    updateLocalChatState,
    setIsChatActionsMenuOpen,
    setIsDeleteChatConfirmOpen,
    setIsClearHistoryConfirmOpen,
  });

  const {
    handleDeleteSelectedChat,
    handleBlockSelectedDirectChat,
    handleUnblockSelectedDirectChat,
  } = useDirectChatBlockController({
    selectedChat,
    currentAccountId: profile?.accountId,
    selectedDirectCompanionAccountId,
    upsertChat,
    updateLocalChatState,
    handleDeleteSelectedChatLocally,
    sendCurrentTypingState,
    setErrorMessage,
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

  const {
    isSending,
    setIsSending,
    sendEncryptedChatContent,
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
  });


  const { setMessageReactionForChat } = useMessageReactionsController({
    currentAccountId: profile?.accountId,
    applyMessageReaction,
    closeMessageContextMenu,
    setErrorMessage,
  });

  function handleSetMessageReaction(messageId: string, emoji: string) {
    const message = visibleSelectedMessages.find((visibleMessage) => visibleMessage.messageId === messageId) ?? null;

    if (!message) {
      return;
    }

    const currentReaction = (message.reactions ?? []).find((reaction) => reaction.accountId === profile?.accountId)?.emoji ?? null;
    void setMessageReactionForChat(message.chatId, message.messageId, currentReaction, emoji);
  }

  const {
    isDocumentsPanelOpen,
    setIsDocumentsPanelOpen,
    chatDocuments,
    isLoadingDocuments,
    documentNotificationCount,
    includeHiddenDocuments,
    setIncludeHiddenDocuments,
    pendingDocumentFile,
    openDocumentsWorkspace,
    loadWorkspaceDocuments,
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
    handleRestoreDocument,
    verifyLocalDocumentFile,
  } = useChatDocumentsController({
    currentAccountId: profile?.accountId,
    deviceId,
    decryptedMessagesById,
    setIsSending,
    setIsUploadingFile,
    setErrorMessage,
  });

  const {
    miniProfile,
    setMiniProfile,
    documentContactAccountIds,
    openMiniProfileByAccountId,
  } = useMessengerDirectoryController({
    currentAccountId: profile?.accountId,
    chats,
    messagesByChatId,
    decryptedMessagesById,
    chatDocuments,
    profilesById,
    upsertProfiles,
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
      if (profile?.accountId && window.vectorCrypto) {
        try {
          await window.vectorCrypto.clearAccountBackupPassword({ accountId: profile.accountId });
        }
        catch (backupKeyError) {
          console.warn('Не удалось очистить ключ backup-сессии.', backupKeyError);
        }
      }

      clearAuthentication();
      navigate('/login');
    }
  }

  const {
    handleCreateDirectChat,
    handleCreateGroupChat,
    handleUnblockProfile,
    handleAddGroupParticipant,
    handleRemoveGroupParticipant,
    handleLeaveGroup,
    handleRejoinGroup,
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
    restoreChatLocally,
    updateLocalChatState,
  });

  const handleUpdateGroupAvatar = useCallback(async (chatId: string, file: File | null) => {
    setErrorMessage(null);

    try {
      const avatarDataUrl = file ? await createLocalAvatarDataUrl(file) : null;
      const updatedChat = await updateGroupChatAvatar(chatId, { avatarDataUrl });
      upsertChat(updatedChat);
    }
    catch (error) {
      console.error(error);
      setErrorMessage('Не удалось обновить аватар группы.');
      throw error;
    }
  }, [upsertChat]);

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
        blockedAccountIds={localChatState.blockedAccountIds ?? []}
        onOpenProfile={(foundProfile) => setMiniProfile(foundProfile)}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        profile={profile}
        deviceId={deviceId}
        cryptoStatus={cryptoStatus}
        realtimeStatus={realtimeStatus}
        onClose={() => setIsSettingsOpen(false)}
        onLogout={handleLogout}
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
        isBlockedByCurrentAccount={Boolean(miniProfile && (localChatState.blockedAccountIds ?? []).includes(miniProfile.accountId))}
        onUnblock={handleUnblockProfile}
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
        onOpenProfile={(accountId) => setMiniProfile(profilesById[accountId] ?? null)}
      />

      <DocumentsPanel
        isOpen={isDocumentsPanelOpen}
        documents={chatDocuments}
        isLoading={isLoadingDocuments}
        activeAccountId={profile?.accountId}
        profilesById={profilesById}
        contactAccountIds={documentContactAccountIds}
        onClose={() => setIsDocumentsPanelOpen(false)}
        onRefresh={loadWorkspaceDocuments}
        onCreateDocument={handleStartDocumentCreation}
        onDownload={handleDownloadDocument}
        onSign={handleSignDocument}
        onReject={handleRejectDocument}
        onCancel={handleCancelDocument}
        onHide={handleHideDocument}
        onRestore={handleRestoreDocument}
        onVerifyFile={verifyLocalDocumentFile}
        onAddObservers={handleAddDocumentObservers}
        showHiddenDocuments={includeHiddenDocuments}
        onShowHiddenDocumentsChange={setIncludeHiddenDocuments}
        onOpenProfile={openMiniProfileByAccountId}
      />

      <DocumentCreationModal
        file={pendingDocumentFile}
        profilesById={profilesById}
        contactAccountIds={documentContactAccountIds}
        currentAccountId={profile?.accountId}
        onClose={cancelPendingDocumentCreation}
        onConfirm={confirmDocumentCreation}
        onProfilesFound={upsertProfiles}
      />

      <MessengerOverlays
        selectedChat={selectedChat}
        currentAccountId={profile?.accountId}
        isDeleteChatConfirmOpen={isDeleteChatConfirmOpen}
        isBlockUserConfirmOpen={isBlockUserConfirmOpen}
        isClearHistoryConfirmOpen={isClearHistoryConfirmOpen}
        isLeaveGroupConfirmOpen={isLeaveGroupConfirmOpen}
        droppedImageFiles={droppedImageFiles}
        isDraggingFileOverChat={isDraggingFileOverChat}
        isSelectedChatWritable={isSelectedChatWritable}
        isDevToolsOpen={isDevToolsOpen}
        isAdmin={profile?.username === 'admin'}
        onCloseDeleteChatConfirm={() => setIsDeleteChatConfirmOpen(false)}
        onCloseBlockUserConfirm={() => setIsBlockUserConfirmOpen(false)}
        onCloseClearHistoryConfirm={() => setIsClearHistoryConfirmOpen(false)}
        onCloseLeaveGroupConfirm={() => setIsLeaveGroupConfirmOpen(false)}
        onClearSelectedChatHistory={handleClearSelectedChatHistory}
        onDeleteSelectedChatLocally={(options) => void handleDeleteSelectedChat(options)}
        onBlockDirectCompanion={() => void handleBlockSelectedDirectChat()}
        onLeaveGroup={() => void handleLeaveGroup()}
        onSendDroppedImages={(attachmentDisplayMode) => void sendDroppedImages(attachmentDisplayMode)}
        onClearDroppedImageFiles={() => setDroppedImageFiles([])}
        onCloseDraggingFileOverlay={() => setIsDraggingFileOverChat(false)}
        onCloseDevTools={() => setIsDevToolsOpen(false)}
      />

      <BackupUnlockModal profile={profile} />

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
        onOpenDocumentsWorkspace={() => void openDocumentsWorkspace()}
        pendingDocumentCount={documentNotificationCount}
      />

      <main className="relative z-10 flex min-w-0 flex-1 flex-col bg-[#101116]/74 backdrop-blur-sm">
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
              onOpenDirectProfile={() => selectedChatPresentation.companionProfile && setMiniProfile(selectedChatPresentation.companionProfile)}
              onToggleChatActionsMenu={() => setIsChatActionsMenuOpen((previousValue) => !previousValue)}
              isPinned={Boolean((localChatState.pinnedChatIds ?? []).includes(selectedChat.chatId))}
              canLeaveGroup={selectedChat.type === 'GROUP' && selectedGroupParticipant?.status === 'ACTIVE' && selectedGroupParticipant.role !== 'OWNER'}
              onTogglePinned={handleToggleSelectedChatPinned}
              onClearSelectedChatHistory={() => {
                setIsChatActionsMenuOpen(false);
                setIsClearHistoryConfirmOpen(true);
              }}
              onOpenDeleteChatConfirm={() => {
                setIsChatActionsMenuOpen(false);
                setIsDeleteChatConfirmOpen(true);
              }}
              onBlockDirectCompanion={() => {
                setIsChatActionsMenuOpen(false);
                setIsBlockUserConfirmOpen(true);
              }}
              onUnblockDirectCompanion={() => {
                setIsChatActionsMenuOpen(false);
                void handleUnblockSelectedDirectChat();
              }}
              onLeaveGroup={() => {
                setIsChatActionsMenuOpen(false);
                setIsLeaveGroupConfirmOpen(true);
              }}
            />

            <ChatAlerts
              errorMessage={errorMessage}
              isGroupChatReadOnly={selectedChat.type === 'GROUP' && !isSelectedChatWritable}
              isGroupChatLeft={isSelectedGroupChatLeft}
              onRejoinGroup={() => void handleRejoinGroup()}
              directBlockNotice={directBlockNotice}
              canUnblockDirectChat={isSelectedDirectChatBlockedByCurrentAccount}
              onUnblockDirectChat={() => void handleUnblockSelectedDirectChat()}
              onDismissError={() => setErrorMessage(null)}
            />

            <MessageTimeline
              selectedChat={selectedChat}
              visibleSelectedMessages={visibleSelectedMessages}
              currentAccountId={profile?.accountId}
              profilesById={profilesById}
              decryptedMessagesById={decryptedMessagesById}
              readDetailsMessageId={readDetailsMessageId}
              highlightedMessageId={highlightedMessageId}
              forwardSelectionSelectedMessageIds={forwardSelection?.selectedMessageIds ?? null}
              selectedTypingText={selectedTypingText}
              messageElementRefs={messageElementRefs}
              messagesEndRef={messagesEndRef}
              timelineScrollContainerRef={timelineScrollContainerRef}
              unreadIncomingCount={unreadIncomingCount}
              isJumpToBottomVisible={isJumpToBottomVisible}
              onTimelineScroll={handleTimelineScroll}
              onJumpToBottom={handleJumpToBottom}
              onToggleForwardSelectedMessage={toggleForwardSelectedMessage}
              onOpenMessageContextMenu={openMessageContextMenu}
              onScrollToMessage={scrollToMessage}
              onDownloadAttachment={handleDownloadAttachment}
              onOpenProfile={openMiniProfileByAccountId}
              onSetReadDetailsMessageId={setReadDetailsMessageId}
              onSetMessageReaction={handleSetMessageReaction}
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
              const currentReaction = contextMessage ? (contextMessage.reactions ?? []).find((reaction) => reaction.accountId === profile?.accountId)?.emoji ?? null : null;
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
                  onEdit={startEditFromContextMenu}
                  canEdit={isMessageEditable(contextMessage, profile?.accountId, contextMessage ? decryptedMessagesById[contextMessage.messageId] : undefined)}
                  onDownload={(attachment) => {
                    closeMessageContextMenu();
                    void handleDownloadAttachment(attachment);
                  }}
                  onReact={handleSetMessageReaction}
                />
              );
            })()}

            <ComposerDock
              messageText={messageText}
              isSending={isSending}
              isUploadingFile={isUploadingFile}
              isWritable={Boolean(selectedChat && isSelectedChatWritable)}
              lockedPlaceholder={directBlockNotice ?? undefined}
              forwardSelection={forwardSelection}
              forwardDraftItems={forwardDraftItems}
              replyDraft={replyDraft}
              editPreviewText={editDraft ? getMessageContentPreview(editDraft.plainText) : null}
              pendingAttachments={pendingAttachments}
              onCancelForwardSelection={cancelForwardSelection}
              onOpenForwardChatPicker={openForwardChatPicker}
              onCancelReply={() => setReplyDraft(null)}
              onCancelForwardDraft={() => setForwardDraftItems([])}
              onCancelEdit={() => {
                setEditDraft(null);
                setMessageText('');
              }}
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
