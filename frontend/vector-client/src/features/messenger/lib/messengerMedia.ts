import { type DragEvent } from 'react';
import { IMAGE_FILE_EXTENSIONS } from './messengerTypes';
export function isSameCalendarDate(leftValue: string, rightValue: string): boolean {
  const leftDate = new Date(leftValue);
  const rightDate = new Date(rightValue);

  return leftDate.getFullYear() === rightDate.getFullYear()
    && leftDate.getMonth() === rightDate.getMonth()
    && leftDate.getDate() === rightDate.getDate();
}

export function dragEventContainsFiles(event: DragEvent<HTMLElement>): boolean {
  return Array.from(event.dataTransfer.types).includes('Files');
}

export function isImageFile(file: File): boolean {
  if (file.type.startsWith('image/')) {
    return true;
  }

  const extension = file.name.split('.').at(-1)?.toLowerCase();
  return extension ? IMAGE_FILE_EXTENSIONS.has(extension) : false;
}
export async function readImageElementFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const imageElement = new Image();

    imageElement.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(imageElement);
    };

    imageElement.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Cannot read image.'));
    };

    imageElement.src = objectUrl;
  });
}

export function buildCompressedImageFileName(fileName: string): string {
  const dotIndex = fileName.lastIndexOf('.');
  const baseName = dotIndex > 0 ? fileName.slice(0, dotIndex) : fileName;
  return `${baseName}.jpg`;
}

export async function compressImageForChat(file: File): Promise<File> {
  if (!file.type.startsWith('image/') || file.type === 'image/gif' || file.type === 'image/svg+xml') {
    return file;
  }

  const image = await readImageElementFromFile(file);
  const maximumSide = 1920;
  const scale = Math.min(1, maximumSide / Math.max(image.width, image.height));
  const targetWidth = Math.max(1, Math.round(image.width * scale));
  const targetHeight = Math.max(1, Math.round(image.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const context = canvas.getContext('2d');

  if (!context) {
    return file;
  }

  context.drawImage(image, 0, 0, targetWidth, targetHeight);

  const compressedBlob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, 'image/jpeg', 0.84);
  });

  if (!compressedBlob || compressedBlob.size >= file.size * 0.96) {
    return file;
  }

  return new File([compressedBlob], buildCompressedImageFileName(file.name), {
    type: 'image/jpeg',
    lastModified: Date.now(),
  });
}
