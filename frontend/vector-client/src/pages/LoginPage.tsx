import { FormEvent, useState } from 'react';
import { KeyRound, Lock, MessageCircle, Sparkles, WandSparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { login, getCurrentProfile } from '../features/auth/api/authApi';
import { useAuthStore } from '../features/auth/model/authStore';
import { useDirectoryStore } from '../features/directory/model/directoryStore';
import { GlowButton } from '../shared/ui/GlowButton';
import { TextInput } from '../shared/ui/TextInput';

export function LoginPage() {
  const navigate = useNavigate();
  const setAuthentication = useAuthStore((state) => state.setAuthentication);
  const setProfile = useAuthStore((state) => state.setProfile);
  const upsertProfile = useDirectoryStore((state) => state.upsertProfile);

  const [loginValue, setLoginValue] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  function fillAdminCredentials() {
    setLoginValue('admin');
    setPassword('InitialPassword123!');
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoading(true);
    setErrorMessage(null);

    try {
      if (!window.vectorCrypto) {
        throw new Error('Vector desktop crypto bridge is unavailable. Run the Electron client, not a regular browser tab.');
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
      setErrorMessage('Не удалось войти. Проверь логин, пароль и запущенные backend сервисы.');
    }
    finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="relative flex h-screen overflow-hidden bg-[#111214] text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_10%_10%,rgba(168,85,247,0.2),transparent_26rem),radial-gradient(circle_at_80%_80%,rgba(217,70,239,0.14),transparent_28rem)]" />

      <section className="relative hidden flex-1 flex-col justify-between border-r border-white/10 bg-white/[0.03] p-14 lg:flex">
        <div>
          <div className="inline-flex items-center gap-3 rounded-full border border-violet-300/20 bg-violet-400/10 px-4 py-2 text-sm text-violet-200">
            <Sparkles size={16} />
            Premium secure desktop messenger
          </div>

          <div className="mt-24 max-w-2xl">
            <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-br from-violet-500 to-fuchsia-500 shadow-2xl shadow-violet-950/40">
              <MessageCircle size={32} />
            </div>
            <h1 className="text-6xl font-semibold tracking-tight text-zinc-50">
              Vector
            </h1>
            <p className="mt-6 text-xl leading-8 text-zinc-400">
              Лаконичный desktop-клиент в духе Telegram: тёмный, быстрый и ориентированный на realtime коммуникацию.
            </p>
          </div>
        </div>

        <div className="grid gap-4 text-sm text-zinc-500">
          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
            <div className="mb-2 text-zinc-300">Что уже работает</div>
            <div>Identity, refresh token, messaging REST, Kafka events, realtime gateway, WebSocket updates.</div>
          </div>
        </div>
      </section>

      <section className="relative flex w-full items-center justify-center px-6 lg:w-[500px]">
        <form
          onSubmit={handleSubmit}
          className="w-full max-w-md rounded-[2rem] border border-white/10 bg-[#191a1f]/92 p-8 shadow-2xl shadow-black/40 backdrop-blur-xl"
        >
          <div className="mb-8 flex items-start justify-between gap-4">
            <div>
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/[0.06] text-violet-300">
                <Lock size={22} />
              </div>
              <h2 className="text-3xl font-semibold tracking-tight">Вход</h2>
              <p className="mt-2 text-sm leading-6 text-zinc-500">
                Введи данные пользователя или быстро подставь initial admin для проверки системы.
              </p>
            </div>

            <button
              type="button"
              onClick={fillAdminCredentials}
              className="inline-flex items-center gap-2 rounded-2xl border border-violet-300/20 bg-violet-400/10 px-3 py-2 text-xs font-medium text-violet-200 transition hover:border-violet-300/40 hover:bg-violet-400/15"
            >
              <WandSparkles size={14} />
              Admin
            </button>
          </div>

          <div className="space-y-5">
            <TextInput
              label="Login"
              value={loginValue}
              onChange={(event) => setLoginValue(event.target.value)}
              placeholder="admin или username"
              autoComplete="username"
            />

            <TextInput
              label="Password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Введите пароль"
              type="password"
              autoComplete="current-password"
            />

            {errorMessage && (
              <div className="rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                {errorMessage}
              </div>
            )}

            <GlowButton className="w-full" disabled={isLoading || !loginValue.trim() || !password.trim()}>
              {isLoading ? 'Подключаемся...' : 'Войти'}
            </GlowButton>
          </div>

          <div className="mt-6 rounded-2xl border border-white/8 bg-black/20 p-4 text-xs text-zinc-500">
            <div className="mb-2 flex items-center gap-2 text-zinc-300">
              <KeyRound size={14} />
              Быстрый доступ для разработки
            </div>
            <div>admin / InitialPassword123!</div>
          </div>
        </form>
      </section>
    </div>
  );
}
