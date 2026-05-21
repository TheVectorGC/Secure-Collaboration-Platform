import { useState } from 'react';
import type { ChatAttachmentDisplayMode } from '../ui/ChatComposer';
import { uploadEncryptedMediaFile } from '../../media/api/mediaApi';
import type { ChatResponseDto, FileAttachmentMessageContent } from '../../../shared/types/api';
import {
  buildCompressedImageFileName,
  compressImageForChat,
  PendingAttachmentDraft,
} from '../../../pages/MessengerPageSupport';
import {
  buildFileAttachmentContent,
  encryptFileForUpload,
} from '../../media/lib/fileCrypto';

type UsePendingAttachmentsControllerParams = {
  selectedChatId: string | null;
  selectedChat: ChatResponseDto | null;
  deviceId: string | null;
  isChatWritable: boolean;
  onErrorMessageChange: (message: string | null) => void;
};

export function usePendingAttachmentsController({
  selectedChatId,
  selectedChat,
  deviceId,
  isChatWritable,
  onErrorMessageChange,
}: UsePendingAttachmentsControllerParams) {
  const [isUploadingFile, setIsUploadingFile] = useState(false);
  const [pendingAttachments, setPendingAttachments] = useState<PendingAttachmentDraft[]>([]);

  async function handleAttachFile(file: File | null | undefined, attachmentDisplayMode: ChatAttachmentDisplayMode) {
    if (!file) {
      return;
    }

    if (!selectedChatId || !selectedChat || !deviceId || !isChatWritable) {
      onErrorMessageChange(isChatWritable ? 'Сначала выбери чат для отправки файла.' : 'Вы исключены из группы и не можете отправлять файлы.');
      return;
    }

    setPendingAttachments((previousValue) => [
      ...previousValue,
      {
        id: crypto.randomUUID(),
        file,
        attachmentDisplayMode,
      },
    ].slice(0, 8));
  }

  function removePendingAttachment(attachmentId: string) {
    setPendingAttachments((previousValue) => previousValue.filter((attachment) => attachment.id !== attachmentId));
  }

  async function uploadPendingAttachment(pendingAttachment: PendingAttachmentDraft): Promise<FileAttachmentMessageContent> {
    const preparedFile = pendingAttachment.attachmentDisplayMode === 'IMAGE'
      ? await compressImageForChat(pendingAttachment.file)
      : pendingAttachment.file;
    const effectiveFile = pendingAttachment.attachmentDisplayMode === 'IMAGE'
      ? new File([preparedFile], buildCompressedImageFileName(pendingAttachment.file.name), { type: preparedFile.type })
      : preparedFile;
    const encryptionResult = await encryptFileForUpload(effectiveFile);
    const uploadedFile = await uploadEncryptedMediaFile(
      selectedChatId!,
      encryptionResult.encryptedBlob,
      encryptionResult.encryptedSha256Base64,
    );

    return buildFileAttachmentContent(
      effectiveFile,
      uploadedFile.id,
      uploadedFile.encryptedSizeBytes,
      encryptionResult,
      pendingAttachment.attachmentDisplayMode,
    );
  }

  return {
    isUploadingFile,
    setIsUploadingFile,
    pendingAttachments,
    setPendingAttachments,
    handleAttachFile,
    removePendingAttachment,
    uploadPendingAttachment,
  };
}
