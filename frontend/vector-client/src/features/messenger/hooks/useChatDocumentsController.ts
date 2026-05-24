import { useCallback, useEffect, useMemo, useState } from 'react';
import { addDocumentObservers, cancelDocument, createDocument, getDocument, getDocuments, hideDocument, registerDocumentSigningKey, rejectDocument, restoreDocument, signDocument } from '../../documents/api/documentsApi';
import { getAccountBackupPublicKey } from '../../crypto/api/accountBackupProfileApi';
import { downloadEncryptedMediaFile, uploadEncryptedMediaFile } from '../../media/api/mediaApi';
import { decryptDownloadedFile, encryptFileForUpload, parseDocumentAttachmentMessageContent } from '../../media/lib/fileCrypto';
import type { DocumentAttachmentMessageContent, DocumentKeyEnvelopeRequestDto, DocumentResponseDto, FileAttachmentMessageContent } from '../../../shared/types/api';
import type { DocumentCreationDraft } from '../lib/messengerCore';

type UseChatDocumentsControllerParams = {
  currentAccountId: string | undefined;
  deviceId: string | null;
  decryptedMessagesById: Record<string, string>;
  setIsSending: (isSending: boolean) => void;
  setIsUploadingFile: (isUploading: boolean) => void;
  setErrorMessage: (message: string | null) => void;
};

const COMPLETED_DOCUMENT_STATUSES = new Set<DocumentResponseDto['status']>(['REJECTED', 'CANCELLED', 'FULLY_SIGNED']);

function calculatePendingDocumentCount(documents: DocumentResponseDto[], currentAccountId: string | undefined) {
  if (!currentAccountId) {
    return 0;
  }

  return documents.filter((documentItem) => {
    if (COMPLETED_DOCUMENT_STATUSES.has(documentItem.status)) {
      return false;
    }

    return (documentItem.signers ?? []).some((signer) => signer.signerAccountId === currentAccountId && signer.status === 'PENDING');
  }).length;
}

function upsertDocument(documents: DocumentResponseDto[], documentItem: DocumentResponseDto) {
  return [documentItem, ...documents.filter((item) => item.documentId !== documentItem.documentId)]
    .sort((firstDocument, secondDocument) => new Date(secondDocument.createdAt).getTime() - new Date(firstDocument.createdAt).getTime());
}

function hasUsableDocumentFileEncryption(documentItem: DocumentResponseDto): boolean {
  return Boolean(
    documentItem.fileEncryption
    && documentItem.fileEncryption.initializationVectorBase64
    && documentItem.fileEncryption.keyEnvelopes.length > 0,
  );
}

export function useChatDocumentsController(params: UseChatDocumentsControllerParams) {
  const {
    currentAccountId,
    deviceId,
    decryptedMessagesById,
    setIsSending,
    setIsUploadingFile,
    setErrorMessage,
  } = params;
  const [isDocumentsPanelOpen, setIsDocumentsPanelOpen] = useState(false);
  const [chatDocuments, setChatDocuments] = useState<DocumentResponseDto[]>([]);
  const [isLoadingDocuments, setIsLoadingDocuments] = useState(false);
  const [pendingDocumentFile, setPendingDocumentFile] = useState<File | null>(null);
  const [documentNotificationCount, setDocumentNotificationCount] = useState(0);
  const [includeHiddenDocuments, setIncludeHiddenDocuments] = useState(false);

  const visibleChatDocuments = useMemo(() => chatDocuments, [chatDocuments]);

  const loadWorkspaceDocuments = useCallback(async () => {
    if (!currentAccountId) {
      setChatDocuments([]);
      setDocumentNotificationCount(0);
      return;
    }

    setIsLoadingDocuments(true);
    setErrorMessage(null);

    try {
      const loadedDocuments = await getDocuments(includeHiddenDocuments);
      setDocumentNotificationCount(calculatePendingDocumentCount(loadedDocuments, currentAccountId));
      setChatDocuments(loadedDocuments);
    }
    catch (error) {
      console.error(error);
      setErrorMessage('Не удалось загрузить документы.');
    }
    finally {
      setIsLoadingDocuments(false);
    }
  }, [currentAccountId, includeHiddenDocuments, setErrorMessage]);

  const refreshDocumentById = useCallback(async (documentId: string) => {
    if (!currentAccountId) {
      return;
    }

    try {
      const loadedDocument = await getDocument(documentId);
      setChatDocuments((previousDocuments) => {
        const nextDocuments = upsertDocument(previousDocuments, loadedDocument);
        setDocumentNotificationCount(calculatePendingDocumentCount(nextDocuments, currentAccountId));
        return nextDocuments;
      });
    }
    catch (error) {
      console.warn(error);
      void loadWorkspaceDocuments();
    }
  }, [currentAccountId, loadWorkspaceDocuments]);

  useEffect(() => {
    void loadWorkspaceDocuments();
  }, [loadWorkspaceDocuments]);

  useEffect(() => {
    function handleDocumentChanged(event: Event) {
      const customEvent = event as CustomEvent<{ documentId?: string; eventType?: string }>;
      const documentId = customEvent.detail?.documentId;

      if (documentId) {
        if (customEvent.detail?.eventType === 'DOCUMENT_HIDDEN' && !includeHiddenDocuments) {
          setChatDocuments((previousDocuments) => previousDocuments.filter((documentItem) => documentItem.documentId !== documentId));
          setDocumentNotificationCount((previousCount) => Math.max(0, previousCount - 1));
          return;
        }

        void refreshDocumentById(documentId);
        return;
      }

      void loadWorkspaceDocuments();
    }

    window.addEventListener('vector:documentChanged', handleDocumentChanged);
    return () => window.removeEventListener('vector:documentChanged', handleDocumentChanged);
  }, [includeHiddenDocuments, loadWorkspaceDocuments, refreshDocumentById]);

  async function openDocumentsWorkspace() {
    setIsDocumentsPanelOpen(true);
    await loadWorkspaceDocuments();
  }

  function handleStartDocumentCreation(file: File | null | undefined) {
    if (!file) {
      return;
    }

    setErrorMessage(null);
    setPendingDocumentFile(file);
  }

  function cancelPendingDocumentCreation() {
    setPendingDocumentFile(null);
  }


  async function buildDocumentKeyEnvelopes(fileKeyBase64: string, targetAccountIds: string[]): Promise<DocumentKeyEnvelopeRequestDto[]> {
    if (!window.vectorCrypto) {
      throw new Error('Локальное шифрование недоступно.');
    }

    const uniqueTargetAccountIds = Array.from(new Set(targetAccountIds));

    return Promise.all(uniqueTargetAccountIds.map(async (targetAccountId) => {
      const publicKey = await getAccountBackupPublicKey(targetAccountId);
      const encryptedEnvelope = await window.vectorCrypto!.encryptAccountKeyEnvelope({
        backupPublicKeyBase64: publicKey.backupPublicKeyBase64,
        keyBase64: fileKeyBase64,
      });

      return {
        targetAccountId,
        targetDeviceId: null,
        algorithm: encryptedEnvelope.algorithm,
        encryptedKeyBase64: encryptedEnvelope.encryptedKeyBase64,
      };
    }));
  }

  async function buildAttachmentFromDocument(documentItem: DocumentResponseDto): Promise<DocumentAttachmentMessageContent | null> {
    if (!currentAccountId || !window.vectorCrypto || !hasUsableDocumentFileEncryption(documentItem) || !documentItem.fileEncryption) {
      return null;
    }

    const currentAccountEnvelope = documentItem.fileEncryption.keyEnvelopes.find((keyEnvelope) => keyEnvelope.targetAccountId === currentAccountId);

    if (!currentAccountEnvelope) {
      return null;
    }

    const decryptedEnvelope = await window.vectorCrypto.decryptAccountKeyEnvelope({
      accountId: currentAccountId,
      encryptedKeyBase64: currentAccountEnvelope.encryptedKeyBase64,
    });

    return {
      kind: 'DOCUMENT_ATTACHMENT',
      version: 1,
      documentId: documentItem.documentId,
      mediaFileId: documentItem.mediaFileId,
      fileName: documentItem.fileName,
      mimeType: documentItem.mimeType,
      sizeBytes: documentItem.sizeBytes,
      encryptedSizeBytes: 0,
      plaintextSha256Base64: documentItem.plaintextSha256Base64,
      encryptedSha256Base64: documentItem.encryptedSha256Base64,
      fileEncryption: {
        algorithm: 'AES-256-GCM',
        keyBase64: decryptedEnvelope.keyBase64,
        initializationVectorBase64: documentItem.fileEncryption.initializationVectorBase64,
      },
    };
  }

  async function confirmDocumentCreation(draft: DocumentCreationDraft) {
    if (!currentAccountId || !deviceId) {
      setErrorMessage('Локальное устройство не готово к созданию документа.');
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
      const accessAccountIds = Array.from(new Set([currentAccountId, ...draft.requiredSignerAccountIds, ...draft.observerAccountIds]));
      const encryptionResult = await encryptFileForUpload(draft.file);
      const keyEnvelopes = await buildDocumentKeyEnvelopes(encryptionResult.keyBase64, accessAccountIds);
      const uploadedFile = await uploadEncryptedMediaFile(
        null,
        encryptionResult.encryptedBlob,
        encryptionResult.encryptedSha256Base64,
        accessAccountIds,
      );
      const documentItem = await createDocument({
        chatId: null,
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
        fileEncryption: {
          algorithm: 'AES-256-GCM',
          initializationVectorBase64: encryptionResult.initializationVectorBase64,
          keyEnvelopes,
        },
      });

      setChatDocuments((previousDocuments) => {
        const nextDocuments = upsertDocument(previousDocuments, documentItem);
        setDocumentNotificationCount(calculatePendingDocumentCount(nextDocuments, currentAccountId));
        return nextDocuments;
      });
      setPendingDocumentFile(null);
      setIsDocumentsPanelOpen(true);
    }
    catch (error) {
      console.error(error);
      setErrorMessage('Не удалось создать документ.');
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
    try {
      const attachmentFromDocument = await buildAttachmentFromDocument(documentItem);
      const matchingMessage = attachmentFromDocument ?? Object.entries(decryptedMessagesById)
        .map(([, plainText]) => parseDocumentAttachmentMessageContent(plainText))
        .find((attachment) => attachment?.documentId === documentItem.documentId) ?? null;

      if (!matchingMessage) {
        setErrorMessage('Ключ документа недоступен. Проверьте доступ к документу или обратитесь к автору.');
        return;
      }

      await handleDownloadAttachment(matchingMessage);
    }
    catch (error) {
      console.error(error);
      setErrorMessage('Не удалось подготовить ключ документа.');
    }
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

      setChatDocuments((previousDocuments) => upsertDocument(previousDocuments, updatedDocument));
      setDocumentNotificationCount((previousCount) => calculatePendingDocumentCount(upsertDocument(chatDocuments, updatedDocument), currentAccountId));
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
      setChatDocuments((previousDocuments) => upsertDocument(previousDocuments, updatedDocument));
      setDocumentNotificationCount((previousCount) => calculatePendingDocumentCount(upsertDocument(chatDocuments, updatedDocument), currentAccountId));
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
      setChatDocuments((previousDocuments) => upsertDocument(previousDocuments, updatedDocument));
      setDocumentNotificationCount((previousCount) => calculatePendingDocumentCount(upsertDocument(chatDocuments, updatedDocument), currentAccountId));
    }
    catch (error) {
      console.error(error);
      setErrorMessage('Не удалось отменить документ.');
    }
  }

  async function handleAddDocumentObservers(documentItem: DocumentResponseDto, observerAccountIds: string[]) {
    if (!currentAccountId || !window.vectorCrypto || !hasUsableDocumentFileEncryption(documentItem) || !documentItem.fileEncryption) {
      setErrorMessage('Ключ документа недоступен. Наблюдателей добавить нельзя.');
      return;
    }

    const currentAccountEnvelope = documentItem.fileEncryption.keyEnvelopes.find((keyEnvelope) => keyEnvelope.targetAccountId === currentAccountId);

    if (!currentAccountEnvelope) {
      setErrorMessage('Ключ документа недоступен. Наблюдателей добавить нельзя.');
      return;
    }

    setErrorMessage(null);

    try {
      const decryptedEnvelope = await window.vectorCrypto.decryptAccountKeyEnvelope({
        accountId: currentAccountId,
        encryptedKeyBase64: currentAccountEnvelope.encryptedKeyBase64,
      });
      const keyEnvelopes = await buildDocumentKeyEnvelopes(decryptedEnvelope.keyBase64, observerAccountIds);
      const updatedDocument = await addDocumentObservers(documentItem.documentId, {
        observerAccountIds,
        keyEnvelopes,
      });
      setChatDocuments((previousDocuments) => upsertDocument(previousDocuments, updatedDocument));
    }
    catch (error) {
      console.error(error);
      setErrorMessage('Не удалось добавить наблюдателей.');
    }
  }

  async function handleHideDocument(documentItem: DocumentResponseDto) {
    setErrorMessage(null);

    try {
      await hideDocument(documentItem.documentId);
      setChatDocuments((previousDocuments) => previousDocuments.filter((item) => item.documentId !== documentItem.documentId));
      setDocumentNotificationCount((previousCount) => Math.max(0, previousCount - (documentItem.signers.some((signer) => signer.signerAccountId === currentAccountId && signer.status === 'PENDING') ? 1 : 0)));
    }
    catch (error) {
      console.error(error);
      setErrorMessage('Не удалось скрыть документ из списка.');
    }
  }



  async function handleRestoreDocument(documentItem: DocumentResponseDto) {
    setErrorMessage(null);

    try {
      await restoreDocument(documentItem.documentId);
      const restoredDocument = await getDocument(documentItem.documentId);
      setChatDocuments((previousDocuments) => {
        const nextDocuments = upsertDocument(previousDocuments, {
          ...restoredDocument,
          hiddenForCurrentAccount: false,
        });
        setDocumentNotificationCount(calculatePendingDocumentCount(nextDocuments, currentAccountId));
        return nextDocuments;
      });
    }
    catch (error) {
      console.error(error);
      setErrorMessage('Не удалось вернуть документ в список.');
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
      const loadedDocuments = await getDocuments(true);
      const matchingDocument = loadedDocuments.find((documentItem) => documentItem.plaintextSha256Base64 === plaintextSha256Base64) ?? null;

      if (!matchingDocument) {
        setErrorMessage('Документ с таким содержимым не найден среди доступных вам документов.');
      }
      else {
        setChatDocuments(loadedDocuments);
        setDocumentNotificationCount(calculatePendingDocumentCount(loadedDocuments, currentAccountId));
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
  };
}
