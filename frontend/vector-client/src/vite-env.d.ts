/// <reference types="vite/client" />

import type { VectorCryptoApi } from './shared/types/vectorCrypto';

declare global {
  interface Window {
    vectorCrypto?: VectorCryptoApi;
  }
}

export {};
