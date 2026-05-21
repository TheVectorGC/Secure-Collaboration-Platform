/// <reference types="vite/client" />

import type { VectorCryptoApi } from './shared/types/vectorCrypto';

declare global {
  interface Window {
    vectorCrypto?: VectorCryptoApi;
    vectorFile?: {
      saveToDownloads: (request: { fileName: string; bytes: Uint8Array }) => Promise<{ filePath: string }>;
    };
  }
}

export {};
