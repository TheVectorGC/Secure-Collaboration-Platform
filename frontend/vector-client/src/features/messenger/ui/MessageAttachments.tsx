import { useEffect, useState } from 'react';
import { Download, Image as ImageIcon, LoaderCircle, ShieldCheck } from 'lucide-react';
import { downloadEncryptedMediaFile } from '../../media/api/mediaApi';
import { decryptDownloadedFile, formatFileSize } from '../../media/lib/fileCrypto';
import type { DocumentAttachmentMessageContent, FileAttachmentMessageContent } from '../../../shared/types/api';

export function ImageAttachmentPreview({
  attachment,
  onDownload,
}: {
  attachment: FileAttachmentMessageContent;
  onDownload: (attachment: FileAttachmentMessageContent) => Promise<void>;
}) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  useEffect(() => {
    let isCancelled = false;
    let objectUrl: string | null = null;

    async function loadPreview() {
      setIsLoadingPreview(true);
      setPreviewError(null);

      try {
        const encryptedBytes = await downloadEncryptedMediaFile(attachment.mediaFileId);
        const decryptedBlob = await decryptDownloadedFile(encryptedBytes, attachment);
        objectUrl = URL.createObjectURL(decryptedBlob);

        if (!isCancelled) {
          setPreviewUrl(objectUrl);
        }
      }
      catch (error) {
        console.error(error);

        if (!isCancelled) {
          setPreviewError('Не удалось загрузить предпросмотр.');
        }
      }
      finally {
        if (!isCancelled) {
          setIsLoadingPreview(false);
        }
      }
    }

    void loadPreview();

    return () => {
      isCancelled = true;

      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [attachment]);

  return (
    <div
      className="max-w-[420px] overflow-hidden rounded-3xl bg-black/15 shadow-lg shadow-black/15"
      onContextMenu={(event) => {
        event.preventDefault();
        void onDownload(attachment);
      }}
      title="ПКМ — скачать изображение"
    >
      <div className="flex min-h-[180px] items-center justify-center bg-black/20">
        {previewUrl ? (
          <img src={previewUrl} alt={attachment.fileName} className="max-h-[430px] w-full object-contain" />
        ) : (
          <div className="flex flex-col items-center gap-3 px-6 py-10 text-center text-xs text-zinc-400">
            {isLoadingPreview ? <LoaderCircle size={22} className="animate-spin" /> : <ImageIcon size={24} />}
            <span>{previewError ?? 'Загружаем защищённое изображение…'}</span>
          </div>
        )}
      </div>
    </div>
  );
}

export function DocumentAttachmentPreview({
  attachment,
  isOwnMessage,
  onDownload,
}: {
  attachment: DocumentAttachmentMessageContent;
  isOwnMessage: boolean;
  onDownload: (attachment: DocumentAttachmentMessageContent) => Promise<void>;
}) {
  return (
    <div className="min-w-[280px] max-w-[380px]">
      <div className={`flex items-center gap-3 rounded-2xl border p-3 ${isOwnMessage ? 'border-white/20 bg-white/10' : 'border-white/10 bg-black/15'}`}>
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-black/20 text-white">
          <ShieldCheck size={20} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold">{attachment.fileName}</div>
          <div className={`mt-1 text-xs ${isOwnMessage ? 'text-violet-100/75' : 'text-zinc-500'}`}>
            {formatFileSize(attachment.sizeBytes)} • защищённый документ
          </div>
        </div>
        <button
          type="button"
          onClick={() => void onDownload(attachment)}
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition ${isOwnMessage ? 'bg-white/15 hover:bg-white/25' : 'bg-white/[0.06] hover:bg-white/[0.1]'}`}
          title="Скачать и расшифровать"
        >
          <Download size={17} />
        </button>
      </div>
    </div>
  );
}
