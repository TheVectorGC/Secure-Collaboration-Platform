import { useEffect } from 'react';
import { useAuthStore } from '../auth/model/authStore';
import { ensureCryptoDeviceKeysRegistered } from './api/cryptoKeysApi';
import { useCryptoStore } from './model/cryptoStore';

export function useCryptoBootstrap() {
  const profile = useAuthStore((state) => state.profile);
  const deviceId = useAuthStore((state) => state.deviceId);
  const setStatus = useCryptoStore((state) => state.setStatus);
  const setReady = useCryptoStore((state) => state.setReady);
  const setUnavailable = useCryptoStore((state) => state.setUnavailable);
  const setError = useCryptoStore((state) => state.setError);

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

        setStatus('registering');
        await ensureCryptoDeviceKeysRegistered(activeDeviceId, result.signalKeyBundle);

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
  }, [deviceId, profile?.accountId, setError, setReady, setStatus, setUnavailable]);
}
