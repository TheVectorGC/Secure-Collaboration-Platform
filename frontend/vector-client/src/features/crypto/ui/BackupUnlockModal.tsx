import { FormEvent, useState } from 'react';
import { LockKeyhole } from 'lucide-react';
import { unlockAccountBackupProfileWithPassword } from '../lib/accountBackupProfileOperations';
import { useCryptoStore } from '../model/cryptoStore';
import type { ProfileResponseDto } from '../../../shared/types/api';
import { GlowButton } from '../../../shared/ui/GlowButton';

export function BackupUnlockModal({ profile }: { profile: ProfileResponseDto | null }) {
  const cryptoStatus = useCryptoStore((state) => state.status);
  const requestBootstrapRetry = useCryptoStore((state) => state.requestBootstrapRetry);
  const setError = useCryptoStore((state) => state.setError);
  const [password, setPassword] = useState('');
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (cryptoStatus !== 'locked' || !profile?.accountId) {
    return null;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!profile?.accountId || !password.trim()) {
      return;
    }

    setIsUnlocking(true);
    setErrorMessage(null);

    try {
      await unlockAccountBackupProfileWithPassword(profile.accountId, password);
      setPassword('');
      requestBootstrapRetry();
    }
    catch (error) {
      console.warn('Account backup unlock failed.', error);
      setError('Не удалось открыть защищённые сообщения.');
      setErrorMessage('Пароль не подошёл или локальная криптография недоступна.');
    }
    finally {
      setIsUnlocking(false);
    }
  }

  return (
    <div className="absolute inset-0 z-[120] flex items-center justify-center bg-black/62 p-4 backdrop-blur-xl">
      <form onSubmit={handleSubmit} className="w-full max-w-md rounded-[2rem] border border-white/10 bg-[#171820] p-6 shadow-2xl shadow-black/60">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-violet-500/14 text-violet-200">
            <LockKeyhole size={22} />
          </div>
          <div className="min-w-0">
            <div className="text-xl font-semibold text-zinc-50">Подтвердите пароль</div>
            <div className="mt-2 text-sm leading-6 text-zinc-400">
              Сессия восстановлена, но ключи сообщений нужно открыть повторно.
            </div>
          </div>
        </div>

        <input
          autoFocus
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          type="password"
          autoComplete="current-password"
          placeholder="Пароль аккаунта"
          className="mt-6 w-full rounded-2xl border border-white/10 bg-[#101116] px-4 py-3 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-violet-300/35"
        />

        {errorMessage && (
          <div className="mt-4 rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {errorMessage}
          </div>
        )}

        <GlowButton className="mt-5 w-full" disabled={isUnlocking || !password.trim()}>
          {isUnlocking ? 'Открываем…' : 'Продолжить'}
        </GlowButton>
      </form>
    </div>
  );
}
