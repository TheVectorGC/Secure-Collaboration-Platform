import { DragEvent, useEffect, useState } from 'react';
import type { ChatAttachmentDisplayMode } from '../ui/ChatComposer';
import {
  dragEventContainsFiles,
  isImageFile,
} from '../lib/messengerCore';

type UseChatDragAndDropParams = {
  isChatWritable: boolean;
  onAttachFile: (file: File, attachmentDisplayMode: ChatAttachmentDisplayMode) => Promise<void>;
};

export function useChatDragAndDrop({
  isChatWritable,
  onAttachFile,
}: UseChatDragAndDropParams) {
  const [isDraggingFileOverChat, setIsDraggingFileOverChat] = useState(false);
  const [droppedImageFiles, setDroppedImageFiles] = useState<File[]>([]);

  useEffect(() => {
    function resetDragOverlay() {
      setIsDraggingFileOverChat(false);
    }

    window.addEventListener('drop', resetDragOverlay);
    window.addEventListener('dragend', resetDragOverlay);
    window.addEventListener('blur', resetDragOverlay);

    return () => {
      window.removeEventListener('drop', resetDragOverlay);
      window.removeEventListener('dragend', resetDragOverlay);
      window.removeEventListener('blur', resetDragOverlay);
    };
  }, []);

  async function handleDroppedFiles(files: FileList | File[]) {
    const droppedFiles = Array.from(files).slice(0, 8);

    if (droppedFiles.length > 0 && droppedFiles.every(isImageFile)) {
      setDroppedImageFiles(droppedFiles);
      return;
    }

    for (const droppedFile of droppedFiles) {
      await onAttachFile(droppedFile, isImageFile(droppedFile) ? 'IMAGE' : 'FILE');
    }
  }

  async function sendDroppedImages(attachmentDisplayMode: ChatAttachmentDisplayMode) {
    const files = droppedImageFiles;
    setDroppedImageFiles([]);

    for (const file of files) {
      await onAttachFile(file, attachmentDisplayMode);
    }
  }

  function handleChatDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDraggingFileOverChat(false);

    if (!isChatWritable) {
      return;
    }

    void handleDroppedFiles(event.dataTransfer.files);
  }

  function handleChatDragOver(event: DragEvent<HTMLDivElement>) {
    if (!isChatWritable || !dragEventContainsFiles(event)) {
      return;
    }

    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
    setIsDraggingFileOverChat(true);
  }

  function handleChatDragEnter(event: DragEvent<HTMLDivElement>) {
    if (!isChatWritable || !dragEventContainsFiles(event)) {
      return;
    }

    event.preventDefault();
    setIsDraggingFileOverChat(true);
  }

  function handleChatDragLeave(event: DragEvent<HTMLDivElement>) {
    if (event.currentTarget.contains(event.relatedTarget as Node | null)) {
      return;
    }

    setIsDraggingFileOverChat(false);
  }

  return {
    isDraggingFileOverChat,
    droppedImageFiles,
    setDroppedImageFiles,
    setIsDraggingFileOverChat,
    sendDroppedImages,
    handleChatDrop,
    handleChatDragOver,
    handleChatDragEnter,
    handleChatDragLeave,
  };
}
