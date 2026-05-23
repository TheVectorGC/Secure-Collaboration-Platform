import { useEffect, useState } from 'react';
import { Download, Image as ImageIcon, LoaderCircle, ShieldCheck } from 'lucide-react';
import { downloadEncryptedMediaFile } from '../../media/api/mediaApi';
import { decryptDownloadedFile, formatFileSize } from '../../media/lib/fileCrypto';
import type { DocumentAttachmentMessageContent, FileAttachmentMessageContent } from '../../../shared/types/api';

const imagePreviewUrlCache = new Map<string, string>();
const imagePreviewPromiseCache = new Map<string, Promise<string>>();

function buildPreviewCacheKey(attachment: FileAttachmentMessageContent): string {
  return `${attachment.mediaFileId}:${attachment.fileEncryption.keyBase64}:${attachment.fileEncryption.initializationVectorBase64}:${attachment.encryptedSha256Base64}`;
}

async function loadImagePreviewUrl(attachment: FileAttachmentMessageContent): Promise<string> {
  const cacheKey = buildPreviewCacheKey(attachment);
  const cachedPreviewUrl = imagePreviewUrlCache.get(cacheKey);

  if (cachedPreviewUrl) {
    return cachedPreviewUrl;
  }

  const existingPromise = imagePreviewPromiseCache.get(cacheKey);

  if (existingPromise) {
    return existingPromise;
  }

  const previewPromise = (async () => {
    const encryptedBytes = await downloadEncryptedMediaFile(attachment.mediaFileId);
    const decryptedBlob = await decryptDownloadedFile(encryptedBytes, attachment);
    const objectUrl = URL.createObjectURL(decryptedBlob);
    imagePreviewUrlCache.set(cacheKey, objectUrl);
    imagePreviewPromiseCache.delete(cacheKey);
    return objectUrl;
  })().catch((error) => {
    imagePreviewPromiseCache.delete(cacheKey);
    throw error;
  });

  imagePreviewPromiseCache.set(cacheKey, previewPromise);
  return previewPromise;
}

export function ImageAttachmentPreview({
  attachment,
  onDownload,
}: {
  attachment: FileAttachmentMessageContent;
  onDownload: (attachment: FileAttachmentMessageContent) => Promise<void>;
}) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(() => imagePreviewUrlCache.get(buildPreviewCacheKey(attachment)) ?? null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(!previewUrl);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [isViewerOpen, setIsViewerOpen] = useState(false);
  const previewCacheKey = buildPreviewCacheKey(attachment);

  useEffect(() => {
    let isCancelled = false;
    const cachedPreviewUrl = imagePreviewUrlCache.get(previewCacheKey);

    if (cachedPreviewUrl) {
      setPreviewUrl(cachedPreviewUrl);
      setPreviewError(null);
      setIsLoadingPreview(false);
      return () => {
        isCancelled = true;
      };
    }

    async function loadPreview() {
      setIsLoadingPreview(true);
      setPreviewError(null);

      try {
        const loadedPreviewUrl = await loadImagePreviewUrl(attachment);

        if (!isCancelled) {
          setPreviewUrl(loadedPreviewUrl);
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
    };
  }, [attachment, previewCacheKey]);

  return (
    <>
      <button
        type="button"
        className="block w-full max-w-[420px] overflow-hidden rounded-3xl bg-black/35 text-left shadow-lg shadow-black/15"
        onClick={(event) => {
          event.stopPropagation();

          if (previewUrl) {
            setIsViewerOpen(true);
          }
        }}
        title="Открыть изображение"
      >
        <div className="flex aspect-square max-h-[420px] min-h-[220px] w-full items-center justify-center bg-black">
          {previewUrl ? (
            <img src={previewUrl} alt={attachment.fileName} className="h-full w-full object-contain" draggable={false} />
          ) : (
            <div className="flex flex-col items-center gap-3 px-6 py-10 text-center text-xs text-zinc-400">
              {isLoadingPreview ? <LoaderCircle size={22} className="animate-spin" /> : <ImageIcon size={24} />}
              <span>{previewError ?? 'Загружаем защищённое изображение…'}</span>
            </div>
          )}
        </div>
      </button>

      {isViewerOpen && previewUrl && (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-black/82 p-6 backdrop-blur-xl"
          onClick={() => setIsViewerOpen(false)}
        >
          <div className="absolute right-5 top-5 flex gap-2">
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                void onDownload(attachment);
              }}
              className="rounded-2xl border border-white/10 bg-white/[0.08] px-4 py-2 text-sm font-medium text-white transition hover:bg-white/[0.14]"
            >
              Скачать
            </button>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                setIsViewerOpen(false);
              }}
              className="rounded-2xl border border-white/10 bg-white/[0.08] px-4 py-2 text-sm font-medium text-white transition hover:bg-white/[0.14]"
            >
              Закрыть
            </button>
          </div>
          <img
            src={previewUrl}
            alt={attachment.fileName}
            className="max-h-full max-w-full rounded-3xl object-contain shadow-2xl shadow-black/60"
            onClick={(event) => event.stopPropagation()}
            draggable={false}
          />
        </div>
      )}
    </>
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
