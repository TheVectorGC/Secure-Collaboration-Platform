import { useState } from 'react';
import { cancelDocument, createDocument, getChatDocuments, registerDocumentSigningKey, rejectDocument, signDocument } from '../../documents/api/documentsApi';
import { downloadEncryptedMediaFile, uploadEncryptedMediaFile } from '../../media/api/mediaApi';
import { buildDocumentAttachmentContent, decryptDownloadedFile, encryptFileForUpload, parseDocumentAttachmentMessageContent } from '../../media/lib/fileCrypto';
import type { ChatResponseDto, DocumentAttachmentMessageContent, DocumentResponseDto, FileAttachmentMessageContent } from '../../../shared/types/api';

export type DocumentCreationDraft = {
  file: File;
  title: string;
  description: string;
  requiredSignerAccountIds: string[];
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

  async function loadChatDocuments() {
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
    setIsDocumentsPanelOpen(true);
    await loadChatDocuments();
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
      setIsDocumentsPanelOpen(true);
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
    }
    catch (error) {
      console.error(error);
      setErrorMessage('Не удалось отменить документ.');
    }
  }

  return {
    isDocumentsPanelOpen,
    setIsDocumentsPanelOpen,
    chatDocuments,
    isLoadingDocuments,
    pendingDocumentFile,
    loadChatDocuments,
    openDocumentsPanel,
    handleAttachDocument,
    cancelPendingDocumentCreation,
    confirmDocumentCreation,
    handleDownloadAttachment,
    handleDownloadDocument,
    handleSignDocument,
    handleRejectDocument,
    handleCancelDocument,
  };
}
