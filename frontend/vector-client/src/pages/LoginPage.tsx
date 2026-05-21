import { FormEvent, useState } from 'react';
import { ArrowRight, CheckCircle2, LockKeyhole, MessageCircle, ShieldCheck, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { login, getCurrentProfile } from '../features/auth/api/authApi';
import { useAuthStore } from '../features/auth/model/authStore';
import { useDirectoryStore } from '../features/directory/model/directoryStore';
import { GlowButton } from '../shared/ui/GlowButton';
import { TextInput } from '../shared/ui/TextInput';

const PRODUCT_HIGHLIGHTS = [
  'Сквозное шифрование сообщений и вложений',
  'Корпоративные чаты, документы и подписи',
  'Локальное защищённое хранилище ключей',
];

export function LoginPage() {
  const navigate = useNavigate();
  const setAuthentication = useAuthStore((state) => state.setAuthentication);
  const setProfile = useAuthStore((state) => state.setProfile);
  const upsertProfile = useDirectoryStore((state) => state.upsertProfile);

  const [loginValue, setLoginValue] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  function fillSystemAdministratorCredentials() {
    setLoginValue('admin');
    setPassword('InitialPassword123!');
    setErrorMessage(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoading(true);
    setErrorMessage(null);

    try {
      if (!window.vectorCrypto) {
        throw new Error('Vector desktop crypto bridge is unavailable.');
      }

      const clientInstallationId = await window.vectorCrypto.getOrCreateClientInstallationId();

      if (!clientInstallationId) {
        throw new Error('Client installation ID was not generated.');
      }

      const authenticationResponse = await login({
        login: loginValue,
        password,
        deviceId: null,
        clientInstallationId,
        deviceName: 'Vector Desktop',
        platform: 'WINDOWS',
        clientVersion: '0.2.0',
      });

      setAuthentication(authenticationResponse);

      const profile = await getCurrentProfile();
      setProfile(profile);
      upsertProfile(profile);

      navigate('/messenger');
    }
    catch (error) {
      console.error(error);
      setErrorMessage('Не удалось войти. Проверьте логин и пароль.');
    }
    finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="relative flex h-screen overflow-hidden bg-[#07080d] text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_16%_18%,rgba(124,58,237,0.34),transparent_30rem),radial-gradient(circle_at_82%_12%,rgba(14,165,233,0.16),transparent_28rem),radial-gradient(circle_at_68%_92%,rgba(236,72,153,0.18),transparent_34rem)]" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(120deg,rgba(255,255,255,0.075)_0_1px,transparent_1px_90px),linear-gradient(30deg,rgba(255,255,255,0.05)_0_1px,transparent_1px_110px)] opacity-25" />

      <section className="relative hidden flex-1 flex-col justify-between p-12 xl:flex">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/[0.08] shadow-2xl shadow-violet-950/40 ring-1 ring-white/10 backdrop-blur-xl">
            <MessageCircle size={24} className="text-violet-100" />
          </div>
          <div>
            <div className="text-lg font-semibold tracking-tight text-zinc-50">Vector</div>
            <div className="text-xs font-medium uppercase tracking-[0.26em] text-violet-200/60">Secure Workspace</div>
          </div>
        </div>

        <div className="max-w-3xl">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-4 py-2 text-sm text-zinc-300 shadow-2xl shadow-black/20 backdrop-blur-xl">
            <Sparkles size={15} className="text-violet-200" />
            Защищённая корпоративная коммуникация
          </div>
          <h1 className="max-w-3xl text-6xl font-semibold leading-[1.03] tracking-[-0.045em] text-zinc-50 2xl:text-7xl">
            Рабочие чаты, документы и подписи в одном защищённом клиенте.
          </h1>
          <p className="mt-7 max-w-2xl text-lg leading-8 text-zinc-400">
            Desktop-приложение для команд, которым важны приватность, контроль доступа и аккуратный рабочий процесс без лишней технической сложности.
          </p>

          <div className="mt-10 grid max-w-2xl gap-3">
            {PRODUCT_HIGHLIGHTS.map((highlight) => (
              <div key={highlight} className="flex items-center gap-3 rounded-3xl border border-white/10 bg-white/[0.045] px-4 py-3 shadow-xl shadow-black/10 backdrop-blur-xl">
                <CheckCircle2 size={18} className="shrink-0 text-emerald-300" />
                <span className="text-sm text-zinc-300">{highlight}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3 text-sm text-zinc-500">
          <ShieldCheck size={17} className="text-violet-300/70" />
          <span>Vector Desktop защищает рабочие данные на уровне устройства и канала связи.</span>
        </div>
      </section>

      <section className="relative flex w-full items-center justify-center px-6 py-10 xl:w-[540px] xl:border-l xl:border-white/10 xl:bg-black/10 xl:backdrop-blur-2xl">
        <form
          onSubmit={handleSubmit}
          className="vector-surface-card w-full max-w-md p-8"
        >
          <div className="mb-8 text-center">
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-[1.4rem] bg-gradient-to-br from-violet-500 via-fuchsia-500 to-pink-500 text-white shadow-2xl shadow-violet-950/45">
              <LockKeyhole size={27} />
            </div>
            <h2 className="text-3xl font-semibold tracking-[-0.03em] text-zinc-50">Вход в Vector</h2>
            <p className="mx-auto mt-3 max-w-xs text-sm leading-6 text-zinc-400">
              Используйте корпоративную учётную запись, чтобы продолжить работу в защищённом пространстве.
            </p>
          </div>

          <div className="space-y-5">
            <TextInput
              label="Логин или email"
              value={loginValue}
              onChange={(event) => setLoginValue(event.target.value)}
              placeholder="Введите логин"
              autoComplete="username"
            />

            <TextInput
              label="Пароль"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Введите пароль"
              type="password"
              autoComplete="current-password"
            />

            {errorMessage && (
              <div className="rounded-3xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-100 shadow-lg shadow-red-950/10">
                {errorMessage}
              </div>
            )}

            <GlowButton className="group w-full justify-center" disabled={isLoading || !loginValue.trim() || !password.trim()}>
              <span>{isLoading ? 'Выполняется вход…' : 'Войти'}</span>
              {!isLoading && <ArrowRight size={17} className="transition group-hover:translate-x-0.5" />}
            </GlowButton>

            <button
              type="button"
              onClick={fillSystemAdministratorCredentials}
              className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-medium text-zinc-300 transition hover:border-violet-300/30 hover:bg-white/[0.07] hover:text-white"
            >
              System Administrator
            </button>
          </div>

          <div className="mt-7 rounded-3xl border border-white/10 bg-white/[0.035] px-4 py-3 text-center text-xs leading-5 text-zinc-500">
            Доступ предоставляется только зарегистрированным сотрудникам организации.
          </div>
        </form>
      </section>
    </div>
  );
}
