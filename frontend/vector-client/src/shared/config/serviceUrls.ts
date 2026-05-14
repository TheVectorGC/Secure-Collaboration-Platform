export const serviceUrls = {
  identityBaseUrl: import.meta.env.VITE_IDENTITY_BASE_URL ?? 'http://localhost:8085',
  messagingBaseUrl: import.meta.env.VITE_MESSAGING_BASE_URL ?? 'http://localhost:8087',
  cryptoBaseUrl: import.meta.env.VITE_CRYPTO_BASE_URL ?? 'http://localhost:8086',
  realtimeWebSocketUrl: import.meta.env.VITE_REALTIME_WS_URL ?? 'ws://localhost:8088/ws',
} as const;
