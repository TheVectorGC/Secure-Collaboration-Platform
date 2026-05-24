import { useEffect, useState, type MouseEvent } from 'react';
import { Check, Download, FolderOpen, Image as ImageIcon, LoaderCircle, RotateCcw, ShieldCheck } from 'lucide-react';
import { downloadEncryptedMediaFile } from '../../media/api/mediaApi';
import { decryptDownloadedFile, formatFileSize } from '../../media/lib/fileCrypto';
import { createMediaDownloadPersistenceKey, forgetDownloadedFile, getDownloadStatusLabel, getStoredDownloadedFile, rememberDownloadedFile, type DownloadActionResult, type DownloadStatusValue, type DownloadedFile } from '../../media/lib/downloadState';
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

function getDownloadIcon(status: DownloadStatusValue) {
  if (status === 'downloading') {
    return <LoaderCircle size={16} className="animate-spin" />;
  }

  if (status === 'downloaded') {
    return <Check size={16} />;
  }

  if (status === 'failed') {
    return <RotateCcw size={16} />;
  }

  return <Download size={16} />;
}

export function DownloadActionButton({
  onDownload,
  className,
  showLabel = false,
  label,
  persistenceKey,
}: {
  onDownload: () => Promise<DownloadActionResult>;
  className: string;
  showLabel?: boolean;
  label?: string;
  persistenceKey?: string;
}) {
  const [downloadedFile, setDownloadedFile] = useState<DownloadedFile | null>(() => getStoredDownloadedFile(persistenceKey));
  const [status, setStatus] = useState<DownloadStatusValue>(() => downloadedFile?.filePath ? 'downloaded' : 'idle');
  const filePath = downloadedFile?.filePath;
  const buttonLabel = status === 'idle' && label ? label : getDownloadStatusLabel(status, Boolean(filePath));

  useEffect(() => {
    const storedDownloadedFile = getStoredDownloadedFile(persistenceKey);
    const storedFilePath = storedDownloadedFile?.filePath;

    if (!storedFilePath) {
      return;
    }

    const validatedStoredFilePath: string = storedFilePath;
    let isCancelled = false;

    async function validateStoredDownloadedFile() {
      const exists = window.vectorFile?.existsPath ? await window.vectorFile.existsPath(validatedStoredFilePath) : true;

      if (isCancelled) {
        return;
      }

      if (exists) {
        setDownloadedFile(storedDownloadedFile);
        setStatus('downloaded');
        return;
      }

      forgetDownloadedFile(persistenceKey);
      setDownloadedFile(null);
      setStatus('idle');
    }

    void validateStoredDownloadedFile();

    return () => {
      isCancelled = true;
    };
  }, [persistenceKey]);

  async function handleDownloadClick(event: MouseEvent<HTMLButtonElement>) {
    event.stopPropagation();

    if (status === 'downloading') {
      return;
    }

    if (status === 'downloaded' && filePath && window.vectorFile?.openPath) {
      await window.vectorFile.openPath(filePath);
      return;
    }

    setStatus('downloading');
    setDownloadedFile(null);

    try {
      const result = await onDownload();
      setDownloadedFile(result ?? null);
      rememberDownloadedFile(persistenceKey, result);
      setStatus('downloaded');
    }
    catch {
      setStatus('failed');
    }
  }

  return (
    <span className="inline-flex items-center gap-1.5">
      <button
        type="button"
        onClick={handleDownloadClick}
        disabled={status === 'downloading'}
        className={className}
        title={buttonLabel}
      >
        {getDownloadIcon(status)}
        {showLabel && <span>{buttonLabel}</span>}
      </button>
      {status === 'downloaded' && filePath && window.vectorFile?.showInFolder && (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            void window.vectorFile?.showInFolder?.(filePath);
          }}
          className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.05] text-zinc-200 transition hover:bg-white/[0.09]"
          title="Показать в папке"
        >
          <FolderOpen size={15} />
        </button>
      )}
    </span>
  );
}

export function ImageAttachmentPreview({
  attachment,
  onDownload,
}: {
  attachment: FileAttachmentMessageContent;
  onDownload: (attachment: FileAttachmentMessageContent) => Promise<DownloadActionResult>;
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
            <DownloadActionButton
              onDownload={() => onDownload(attachment)}
              persistenceKey={createMediaDownloadPersistenceKey(attachment.mediaFileId)}
              showLabel
              className="inline-flex h-10 items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.08] px-4 text-sm font-medium text-white transition hover:bg-white/[0.14] disabled:cursor-wait disabled:opacity-70"
            />
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
  onDownload: (attachment: DocumentAttachmentMessageContent) => Promise<DownloadActionResult>;
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
        <DownloadActionButton
          onDownload={() => onDownload(attachment)}
          persistenceKey={createMediaDownloadPersistenceKey(attachment.mediaFileId)}
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition ${isOwnMessage ? 'bg-white/15 hover:bg-white/25' : 'bg-white/[0.06] hover:bg-white/[0.1]'} disabled:cursor-wait disabled:opacity-70`}
        />
      </div>
    </div>
  );
}
