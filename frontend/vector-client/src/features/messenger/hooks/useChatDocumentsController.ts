import { useEffect, useMemo, useState } from 'react';
import { cancelDocument, createDocument, getChatDocuments, getDocuments, hideDocument, registerDocumentSigningKey, rejectDocument, signDocument } from '../../documents/api/documentsApi';
import { downloadEncryptedMediaFile, uploadEncryptedMediaFile } from '../../media/api/mediaApi';
import { buildDocumentAttachmentContent, decryptDownloadedFile, encryptFileForUpload, parseDocumentAttachmentMessageContent } from '../../media/lib/fileCrypto';
import type { ChatResponseDto, DocumentAttachmentMessageContent, DocumentResponseDto, FileAttachmentMessageContent } from '../../../shared/types/api';

export type DocumentCreationDraft = {
  file: File;
  title: string;
  description: string;
  requiredSignerAccountIds: string[];
  observerAccountIds: string[];
};

type UseChatDocumentsControllerParams = {
  selectedChatId: string | null;
  selectedChat: ChatResponseDto | null;
  currentAccountId: string | undefined;
  deviceId: string | null;
  isSelectedChatWritable: boolean;
  decryptedMessagesById: Record<string, string>;
  setIsSending: (isSending: boolean) => void;
  setIsUploadingFile: (isUploading: boolean) => void;
  setIsAttachmentMenuOpen: (isOpen: boolean) => void;
  setErrorMessage: (message: string | null) => void;
  sendCurrentTypingState: (isTyping: boolean) => void;
  sendEncryptedChatContent: (plainText: string, messageType?: 'TEXT' | 'FILE') => Promise<unknown>;
};

export function useChatDocumentsController(params: UseChatDocumentsControllerParams) {
  const {
    selectedChatId,
    selectedChat,
    currentAccountId,
    deviceId,
    isSelectedChatWritable,
    decryptedMessagesById,
    setIsSending,
    setIsUploadingFile,
    setIsAttachmentMenuOpen,
    setErrorMessage,
    sendCurrentTypingState,
    sendEncryptedChatContent,
  } = params;
  const [isDocumentsPanelOpen, setIsDocumentsPanelOpen] = useState(false);
  const [chatDocuments, setChatDocuments] = useState<DocumentResponseDto[]>([]);
  const [isLoadingDocuments, setIsLoadingDocuments] = useState(false);
  const [pendingDocumentFile, setPendingDocumentFile] = useState<File | null>(null);
  const [documentsPanelScope, setDocumentsPanelScope] = useState<'CHAT' | 'WORKSPACE'>('WORKSPACE');
  const [documentNotificationCount, setDocumentNotificationCount] = useState(0);


  const visibleChatDocuments = useMemo(() => chatDocuments, [chatDocuments]);

  function calculatePendingDocumentCount(documents: DocumentResponseDto[]) {
    if (!currentAccountId) {
      return 0;
    }

    return documents.filter((documentItem) => {
      if (documentItem.status === 'REJECTED' || documentItem.status === 'CANCELLED' || documentItem.status === 'FULLY_SIGNED') {
        return false;
      }

      return (documentItem.signers ?? []).some((signer) => signer.signerAccountId === currentAccountId && signer.status === 'PENDING');
    }).length;
  }

  async function refreshWorkspaceDocumentsSilently() {
    if (!currentAccountId) {
      setDocumentNotificationCount(0);
      return;
    }

    try {
      const loadedDocuments = await getDocuments();
      setDocumentNotificationCount(calculatePendingDocumentCount(loadedDocuments));

      if (isDocumentsPanelOpen && documentsPanelScope === 'WORKSPACE') {
        setChatDocuments(loadedDocuments);
      }
    }
    catch (error) {
      console.warn(error);
    }
  }

  useEffect(() => {
    void refreshWorkspaceDocumentsSilently();
    const intervalId = window.setInterval(() => void refreshWorkspaceDocumentsSilently(), 7000);

    return () => window.clearInterval(intervalId);
  }, [currentAccountId, isDocumentsPanelOpen, documentsPanelScope]);

  async function loadChatDocuments() {
    setDocumentsPanelScope('CHAT');
    if (!selectedChatId) {
      setChatDocuments([]);
      return;
    }

    setIsLoadingDocuments(true);
    setErrorMessage(null);

    try {
      const loadedDocuments = await getChatDocuments(selectedChatId);
      setChatDocuments(loadedDocuments);
    }
    catch (error) {
      console.error(error);
      setErrorMessage('Не удалось загрузить документы чата.');
    }
    finally {
      setIsLoadingDocuments(false);
    }
  }

  async function openDocumentsPanel() {
    setDocumentsPanelScope('CHAT');
    setIsDocumentsPanelOpen(true);
    await loadChatDocuments();
  }

  async function loadWorkspaceDocuments() {
    setDocumentsPanelScope('WORKSPACE');
    setIsLoadingDocuments(true);
    setErrorMessage(null);

    try {
      const loadedDocuments = await getDocuments();
      setDocumentNotificationCount(calculatePendingDocumentCount(loadedDocuments));
      setChatDocuments(loadedDocuments);
    }
    catch (error) {
      console.error(error);
      setErrorMessage('Не удалось загрузить документы.');
    }
    finally {
      setIsLoadingDocuments(false);
    }
  }

  async function openDocumentsWorkspace() {
    setDocumentsPanelScope('WORKSPACE');
    setIsDocumentsPanelOpen(true);
    await loadWorkspaceDocuments();
  }

  async function handleAttachDocument(file: File | null | undefined) {
    if (!file) {
      return;
    }

    if (!selectedChatId || !selectedChat || !deviceId || !isSelectedChatWritable) {
      setErrorMessage(isSelectedChatWritable ? 'Сначала выбери чат для отправки документа.' : 'Вы исключены из группы и не можете отправлять документы.');
      return;
    }

    setIsAttachmentMenuOpen(false);
    setErrorMessage(null);
    setPendingDocumentFile(file);
  }

  function cancelPendingDocumentCreation() {
    setPendingDocumentFile(null);
  }

  async function confirmDocumentCreation(draft: DocumentCreationDraft) {
    if (!selectedChatId || !selectedChat || !deviceId || !isSelectedChatWritable) {
      setErrorMessage(isSelectedChatWritable ? 'Сначала выбери чат для отправки документа.' : 'Вы исключены из группы и не можете отправлять документы.');
      return;
    }

    if (draft.requiredSignerAccountIds.length === 0) {
      setErrorMessage('Выбери хотя бы одного подписанта документа.');
      return;
    }

    setIsSending(true);
    setIsUploadingFile(true);
    setErrorMessage(null);

    try {
      const encryptionResult = await encryptFileForUpload(draft.file);
      const uploadedFile = await uploadEncryptedMediaFile(
        selectedChatId,
        encryptionResult.encryptedBlob,
        encryptionResult.encryptedSha256Base64,
      );
      const documentItem = await createDocument({
        chatId: selectedChatId,
        mediaFileId: uploadedFile.id,
        title: draft.title.trim(),
        description: draft.description.trim() || null,
        fileName: draft.file.name,
        mimeType: draft.file.type || 'application/octet-stream',
        sizeBytes: draft.file.size,
        plaintextSha256Base64: encryptionResult.plaintextSha256Base64,
        encryptedSha256Base64: encryptionResult.encryptedSha256Base64,
        requiredSignerAccountIds: draft.requiredSignerAccountIds,
        observerAccountIds: draft.observerAccountIds,
      });
      const attachmentContent = buildDocumentAttachmentContent(
        draft.file,
        documentItem.documentId,
        uploadedFile.id,
        uploadedFile.encryptedSizeBytes,
        encryptionResult,
      );

      await sendEncryptedChatContent(JSON.stringify(attachmentContent), 'FILE');
      setChatDocuments((previousDocuments) => [documentItem, ...previousDocuments.filter((item) => item.documentId !== documentItem.documentId)]);
      setPendingDocumentFile(null);
      setDocumentsPanelScope('WORKSPACE');
      setIsDocumentsPanelOpen(true);
      void refreshWorkspaceDocumentsSilently();
      sendCurrentTypingState(false);
    }
    catch (error) {
      console.error(error);
      setErrorMessage('Не удалось создать и отправить документ.');
    }
    finally {
      setIsSending(false);
      setIsUploadingFile(false);
    }
  }

  async function handleDownloadAttachment(attachment: FileAttachmentMessageContent | DocumentAttachmentMessageContent) {
    setErrorMessage(null);

    try {
      const encryptedBytes = await downloadEncryptedMediaFile(attachment.mediaFileId);
      const decryptedBlob = await decryptDownloadedFile(encryptedBytes, attachment);

      if (window.vectorFile) {
        const decryptedBytes = new Uint8Array(await decryptedBlob.arrayBuffer());
        await window.vectorFile.saveToDownloads({
          fileName: attachment.fileName,
          bytes: decryptedBytes,
        });
        return;
      }

      const objectUrl = URL.createObjectURL(decryptedBlob);
      const downloadLink = document.createElement('a');
      downloadLink.href = objectUrl;
      downloadLink.download = attachment.fileName;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      downloadLink.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    }
    catch (error) {
      console.error(error);
      setErrorMessage('Не удалось скачать или расшифровать файл.');
    }
  }

  async function handleDownloadDocument(documentItem: DocumentResponseDto) {
    const matchingMessage = Object.entries(decryptedMessagesById)
      .map(([, plainText]) => parseDocumentAttachmentMessageContent(plainText))
      .find((attachment) => attachment?.documentId === documentItem.documentId);

    if (!matchingMessage) {
      setErrorMessage('Ключ документа доступен в сообщении чата. Открой сообщение с этим документом и попробуй снова.');
      return;
    }

    await handleDownloadAttachment(matchingMessage);
  }

  async function handleSignDocument(documentItem: DocumentResponseDto) {
    if (!currentAccountId || !deviceId || !window.vectorCrypto) {
      setErrorMessage('Локальная подпись документов недоступна.');
      return;
    }

    setErrorMessage(null);

    try {
      const signingKey = await window.vectorCrypto.getOrCreateDocumentSigningKey({
        accountId: currentAccountId,
        deviceId,
      });

      try {
        await registerDocumentSigningKey(deviceId, { publicKeyBase64: signingKey.publicKeyBase64 });
      }
      catch (registrationError) {
        console.warn(registrationError);
      }

      const signature = await window.vectorCrypto.signDocumentHash({
        accountId: currentAccountId,
        deviceId,
        documentHashBase64: documentItem.plaintextSha256Base64,
      });

      const updatedDocument = await signDocument(documentItem.documentId, {
        signerDeviceId: deviceId,
        signingKeyFingerprint: signature.signingKeyFingerprint,
        documentHashBase64: documentItem.plaintextSha256Base64,
        signatureBase64: signature.signatureBase64,
      });

      setChatDocuments((previousDocuments) => previousDocuments.map((item) => item.documentId === updatedDocument.documentId ? updatedDocument : item));
      void refreshWorkspaceDocumentsSilently();
    }
    catch (error) {
      console.error(error);
      setErrorMessage('Не удалось подписать документ.');
    }
  }

  async function handleRejectDocument(documentItem: DocumentResponseDto, reason: string | null) {
    setErrorMessage(null);

    try {
      const updatedDocument = await rejectDocument(documentItem.documentId, { reason });
      setChatDocuments((previousDocuments) => previousDocuments.map((item) => item.documentId === updatedDocument.documentId ? updatedDocument : item));
      void refreshWorkspaceDocumentsSilently();
    }
    catch (error) {
      console.error(error);
      setErrorMessage('Не удалось отклонить документ.');
    }
  }

  async function handleCancelDocument(documentItem: DocumentResponseDto, reason: string | null) {
    setErrorMessage(null);

    try {
      const updatedDocument = await cancelDocument(documentItem.documentId, { reason });
      setChatDocuments((previousDocuments) => previousDocuments.map((item) => item.documentId === updatedDocument.documentId ? updatedDocument : item));
      void refreshWorkspaceDocumentsSilently();
    }
    catch (error) {
      console.error(error);
      setErrorMessage('Не удалось отменить документ.');
    }
  }



  async function handleHideDocument(documentItem: DocumentResponseDto) {
    setErrorMessage(null);

    try {
      await hideDocument(documentItem.documentId);
      setChatDocuments((previousDocuments) => previousDocuments.filter((item) => item.documentId !== documentItem.documentId));
      void refreshWorkspaceDocumentsSilently();
    }
    catch (error) {
      console.error(error);
      setErrorMessage('Не удалось скрыть документ из списка.');
    }
  }

  async function verifyLocalDocumentFile(file: File): Promise<DocumentResponseDto | null> {
    setErrorMessage(null);

    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const hashBuffer = await crypto.subtle.digest('SHA-256', bytes);
      const hashBytes = new Uint8Array(hashBuffer);
      let binaryHash = '';

      hashBytes.forEach((byte) => {
        binaryHash += String.fromCharCode(byte);
      });

      const plaintextSha256Base64 = btoa(binaryHash);
      const loadedDocuments = await getDocuments();
      const matchingDocument = loadedDocuments.find((documentItem) => documentItem.plaintextSha256Base64 === plaintextSha256Base64) ?? null;

      if (!matchingDocument) {
        setErrorMessage('Документ с таким содержимым не найден среди доступных вам документов.');
      }

      return matchingDocument;
    }
    catch (error) {
      console.error(error);
      setErrorMessage('Не удалось проверить файл документа.');
      return null;
    }
  }

  return {
    isDocumentsPanelOpen,
    setIsDocumentsPanelOpen,
    chatDocuments: visibleChatDocuments,
    isLoadingDocuments,
    documentsPanelScope,
    documentNotificationCount,
    pendingDocumentFile,
    loadChatDocuments,
    openDocumentsPanel,
    openDocumentsWorkspace,
    loadWorkspaceDocuments,
    handleAttachDocument,
    cancelPendingDocumentCreation,
    confirmDocumentCreation,
    handleDownloadAttachment,
    handleDownloadDocument,
    handleSignDocument,
    handleRejectDocument,
    handleCancelDocument,
    handleHideDocument,
    verifyLocalDocumentFile,
  };
}
