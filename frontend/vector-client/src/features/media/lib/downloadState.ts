export type DownloadedFile = {
  filePath?: string;
  fileName?: string;
};

export type DownloadActionResult = DownloadedFile | null | undefined;

export type DownloadStatusValue = 'idle' | 'downloading' | 'downloaded' | 'failed';

const DOWNLOADED_FILES_STORAGE_KEY = 'vector.downloadedFilesByKey';

function readDownloadedFilesByKey(): Record<string, DownloadedFile> {
  try {
    const rawValue = localStorage.getItem(DOWNLOADED_FILES_STORAGE_KEY);

    if (!rawValue) {
      return {};
    }

    const parsedValue = JSON.parse(rawValue) as unknown;

    if (!parsedValue || typeof parsedValue !== 'object' || Array.isArray(parsedValue)) {
      return {};
    }

    const downloadedFilesByKey: Record<string, DownloadedFile> = {};

    Object.entries(parsedValue as Record<string, unknown>).forEach(([key, value]) => {
      if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return;
      }

      const fileValue = value as Record<string, unknown>;
      const filePath = typeof fileValue.filePath === 'string' ? fileValue.filePath : undefined;

      if (!filePath) {
        return;
      }

      downloadedFilesByKey[key] = {
        filePath,
        fileName: typeof fileValue.fileName === 'string' ? fileValue.fileName : undefined,
      };
    });

    return downloadedFilesByKey;
  }
  catch {
    return {};
  }
}

function writeDownloadedFilesByKey(downloadedFilesByKey: Record<string, DownloadedFile>) {
  localStorage.setItem(DOWNLOADED_FILES_STORAGE_KEY, JSON.stringify(downloadedFilesByKey));
}

export function createMediaDownloadPersistenceKey(mediaFileId: string): string {
  return `media:${mediaFileId}`;
}

export function getStoredDownloadedFile(persistenceKey: string | undefined): DownloadedFile | null {
  if (!persistenceKey) {
    return null;
  }

  const downloadedFile = readDownloadedFilesByKey()[persistenceKey];
  return downloadedFile?.filePath ? downloadedFile : null;
}

export function rememberDownloadedFile(persistenceKey: string | undefined, downloadedFile: DownloadedFile | null | undefined) {
  if (!persistenceKey || !downloadedFile?.filePath) {
    return;
  }

  writeDownloadedFilesByKey({
    ...readDownloadedFilesByKey(),
    [persistenceKey]: downloadedFile,
  });
}

export function forgetDownloadedFile(persistenceKey: string | undefined) {
  if (!persistenceKey) {
    return;
  }

  const downloadedFilesByKey = readDownloadedFilesByKey();
  delete downloadedFilesByKey[persistenceKey];
  writeDownloadedFilesByKey(downloadedFilesByKey);
}

export function getDownloadStatusLabel(status: DownloadStatusValue, hasFilePath: boolean): string {
  if (status === 'downloading') {
    return 'Скачивание…';
  }

  if (status === 'downloaded') {
    return hasFilePath ? 'Открыть' : 'Скачано';
  }

  if (status === 'failed') {
    return 'Повторить';
  }

  return 'Скачать';
}
