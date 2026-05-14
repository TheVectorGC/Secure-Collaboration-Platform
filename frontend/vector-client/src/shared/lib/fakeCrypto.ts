export function fakeEncryptMessage(plainText: string): string {
  return window.btoa(unescape(encodeURIComponent(plainText)));
}

export function fakeDecryptMessage(encryptedPayload: string): string {
  try {
    return decodeURIComponent(escape(window.atob(encryptedPayload)));
  }
  catch {
    return encryptedPayload;
  }
}
