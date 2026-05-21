import { useState } from 'react';
import { createDocument, getChatDocuments, registerDocumentSigningKey, rejectDocument, signDocument } from '../../documents/api/documentsApi';
import { downloadEncryptedMediaFile, uploadEncryptedMediaFile } from '../../media/api/mediaApi';
import { buildDocumentAttachmentContent, decryptDownloadedFile, encryptFileForUpload, parseDocumentAttachmentMessageContent } from '../../media/lib/fileCrypto';
import type { ChatResponseDto, DocumentAttachmentMessageContent, DocumentResponseDto, FileAttachmentMessageContent } from '../../../shared/types/api';

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

    setIsSending(true);
    setIsUploadingFile(true);
    setIsAttachmentMenuOpen(false);
    setErrorMessage(null);

    try {
      const encryptionResult = await encryptFileForUpload(file);
      const uploadedFile = await uploadEncryptedMediaFile(
        selectedChatId,
        encryptionResult.encryptedBlob,
        encryptionResult.encryptedSha256Base64,
      );
      const documentItem = await createDocument({
        chatId: selectedChatId,
        mediaFileId: uploadedFile.id,
        fileName: file.name,
        mimeType: file.type || 'application/octet-stream',
        sizeBytes: file.size,
        plaintextSha256Base64: encryptionResult.plaintextSha256Base64,
        encryptedSha256Base64: encryptionResult.encryptedSha256Base64,
      });
      const attachmentContent = buildDocumentAttachmentContent(
        file,
        documentItem.documentId,
        uploadedFile.id,
        uploadedFile.encryptedSizeBytes,
        encryptionResult,
      );

      await sendEncryptedChatContent(JSON.stringify(attachmentContent), 'FILE');
      setChatDocuments((previousDocuments) => [documentItem, ...previousDocuments.filter((item) => item.documentId !== documentItem.documentId)]);
      sendCurrentTypingState(false);
    }
    catch (error) {
      console.error(error);
      setErrorMessage('Не удалось зашифровать и отправить документ.');
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

  async function handleRejectDocument(documentItem: DocumentResponseDto) {
    setErrorMessage(null);

    try {
      const updatedDocument = await rejectDocument(documentItem.documentId);
      setChatDocuments((previousDocuments) => previousDocuments.map((item) => item.documentId === updatedDocument.documentId ? updatedDocument : item));
    }
    catch (error) {
      console.error(error);
      setErrorMessage('Не удалось отклонить документ.');
    }
  }

  return {
    isDocumentsPanelOpen,
    setIsDocumentsPanelOpen,
    chatDocuments,
    isLoadingDocuments,
    loadChatDocuments,
    openDocumentsPanel,
    handleAttachDocument,
    handleDownloadAttachment,
    handleDownloadDocument,
    handleSignDocument,
    handleRejectDocument,
  };
}
