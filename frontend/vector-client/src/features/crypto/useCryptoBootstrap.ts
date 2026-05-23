import { useEffect } from 'react';
import { updateCurrentDeviceMetadata } from '../auth/api/authApi';
import { useAuthStore } from '../auth/model/authStore';
import { ensureCryptoDeviceKeysRegistered } from './api/cryptoKeysApi';
import { ensureAccountBackupProfileUnlocked } from './lib/accountBackupProfileOperations';
import { useCryptoStore } from './model/cryptoStore';

function decodeBase64(value: string): Uint8Array {
  const binaryValue = window.atob(value);
  const bytes = new Uint8Array(binaryValue.length);

  for (let index = 0; index < binaryValue.length; index += 1) {
    bytes[index] = binaryValue.charCodeAt(index);
  }

  return bytes;
}

function toHex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();
}

async function calculateIdentityKeyFingerprint(publicKeyBase64: string): Promise<string> {
  const publicKeyBytes = decodeBase64(publicKeyBase64);
  const publicKeyBuffer = publicKeyBytes.buffer.slice(
    publicKeyBytes.byteOffset,
    publicKeyBytes.byteOffset + publicKeyBytes.byteLength,
  ) as ArrayBuffer;
  const digest = await window.crypto.subtle.digest('SHA-256', publicKeyBuffer);
  return toHex(digest);
}

export function useCryptoBootstrap() {
  const profile = useAuthStore((state) => state.profile);
  const deviceId = useAuthStore((state) => state.deviceId);
  const setStatus = useCryptoStore((state) => state.setStatus);
  const setReady = useCryptoStore((state) => state.setReady);
  const setUnavailable = useCryptoStore((state) => state.setUnavailable);
  const setError = useCryptoStore((state) => state.setError);
  const setLocked = useCryptoStore((state) => state.setLocked);
  const bootstrapVersion = useCryptoStore((state) => state.bootstrapVersion);

  useEffect(() => {
    if (!profile?.accountId || !deviceId) {
      setUnavailable();
      return;
    }

    if (!window.vectorCrypto) {
      setUnavailable();
      return;
    }

    const activeAccountId = profile.accountId;
    const activeDeviceId = deviceId;
    let cancelled = false;

    async function initializeCryptoStorage() {
      try {
        setStatus('initializing');

        const health = await window.vectorCrypto!.getHealth();

        if (!health.available) {
          if (!cancelled) {
            setUnavailable();
          }

          return;
        }

        const result = await window.vectorCrypto!.initializeLocalVault({
          accountId: activeAccountId,
          deviceId: activeDeviceId,
          oneTimePreKeyCount: 100,
        });

        if (cancelled) {
          return;
        }

        let accountBackupPrivateKeyUnlocked = await window.vectorCrypto!.hasUnlockedAccountBackupPrivateKey({
          accountId: activeAccountId,
        });

        if (!accountBackupPrivateKeyUnlocked) {
          try {
            await ensureAccountBackupProfileUnlocked(activeAccountId);
            accountBackupPrivateKeyUnlocked = await window.vectorCrypto!.hasUnlockedAccountBackupPrivateKey({
              accountId: activeAccountId,
            });
          }
          catch (error) {
            const message = error instanceof Error ? error.message : '';

            if (message.includes('Backup unlock key is not available') || message.includes('Sign in again') || message.includes('confirm your password')) {
              if (!cancelled) {
                setLocked('Подтвердите пароль, чтобы открыть защищённые сообщения.');
              }

              return;
            }

            throw error;
          }
        }

        if (!accountBackupPrivateKeyUnlocked) {
          if (!cancelled) {
            setLocked('Подтвердите пароль, чтобы открыть защищённые сообщения.');
          }

          return;
        }

        setStatus('registering');
        await ensureCryptoDeviceKeysRegistered(activeDeviceId, result.signalKeyBundle);

        const deviceEnvironment = await window.vectorCrypto!.getDeviceEnvironment();
        const deviceFingerprint = await calculateIdentityKeyFingerprint(result.signalKeyBundle.identityKey.publicKey);

        await updateCurrentDeviceMetadata(activeDeviceId, {
          deviceName: deviceEnvironment.deviceName,
          platform: deviceEnvironment.platform,
          clientVersion: deviceEnvironment.clientVersion,
          osName: deviceEnvironment.osName,
          osVersion: deviceEnvironment.osVersion,
          architecture: deviceEnvironment.architecture,
          hostname: deviceEnvironment.hostname,
          deviceFingerprint,
        });

        if (!cancelled) {
          setReady(result.registrationId, result.databasePath);
        }
      }
      catch (error) {
        console.error(error);

        if (!cancelled) {
          setError(error instanceof Error ? error.message : 'Failed to initialize crypto storage.');
        }
      }
    }

    initializeCryptoStorage();

    return () => {
      cancelled = true;
    };
  }, [bootstrapVersion, deviceId, profile?.accountId, setError, setLocked, setReady, setStatus, setUnavailable]);
}
