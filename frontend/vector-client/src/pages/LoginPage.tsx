import { FormEvent, useState } from 'react';
import { Lock, MessageCircle, ShieldCheck, UsersRound, FileText, WandSparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { login, getCurrentProfile } from '../features/auth/api/authApi';
import { getRememberedDeviceIdForLogin, useAuthStore } from '../features/auth/model/authStore';
import { useDirectoryStore } from '../features/directory/model/directoryStore';
import { prepareAccountBackupUnlockKey } from '../features/crypto/lib/accountBackupProfileOperations';
import { GlowButton } from '../shared/ui/GlowButton';
import { TextInput } from '../shared/ui/TextInput';

const LOGIN_FEATURES = [
  {
    title: 'Диалоги',
    description: 'Личные рабочие переписки',
    icon: MessageCircle,
  },
  {
    title: 'Группы',
    description: 'Командное общение',
    icon: UsersRound,
  },
  {
    title: 'Документы',
    description: 'Файлы и подписи',
    icon: FileText,
  },
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
      const deviceEnvironment = await window.vectorCrypto.getDeviceEnvironment();

      if (!clientInstallationId) {
        throw new Error('Client installation ID was not generated.');
      }

      const rememberedDeviceId = getRememberedDeviceIdForLogin(loginValue);
      const loginRequest = {
        login: loginValue,
        password,
        deviceId: rememberedDeviceId,
        clientInstallationId,
        deviceName: deviceEnvironment.deviceName,
        platform: deviceEnvironment.platform,
        clientVersion: deviceEnvironment.clientVersion,
        osName: deviceEnvironment.osName,
        osVersion: deviceEnvironment.osVersion,
        architecture: deviceEnvironment.architecture,
        hostname: deviceEnvironment.hostname,
      };
      let authenticationResponse: Awaited<ReturnType<typeof login>>;

      try {
        authenticationResponse = await login(loginRequest);
      }
      catch (error) {
        if (!rememberedDeviceId) {
          throw error;
        }

        console.warn('Remembered device login failed. Creating or resolving device by client installation instead.', {
          login: loginValue,
          rememberedDeviceId,
          error,
        });
        authenticationResponse = await login({
          ...loginRequest,
          deviceId: null,
        });
      }

      setAuthentication(authenticationResponse, rememberedDeviceId);

      const profile = await getCurrentProfile();
      await prepareAccountBackupUnlockKey(profile.accountId, password);
      setProfile(profile);
      upsertProfile(profile);
      setPassword('');

      navigate('/messenger');
    }
    catch (error) {
      console.error(error);
      setErrorMessage('Не удалось войти. Проверьте логин, пароль и запущенные серверные сервисы.');
    }
    finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="relative flex h-screen overflow-hidden bg-[#111214] text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_12%_18%,rgba(139,92,246,0.18),transparent_30rem),radial-gradient(circle_at_74%_88%,rgba(217,70,239,0.12),transparent_32rem)]" />

      <section className="relative hidden flex-1 flex-col justify-between border-r border-white/10 bg-white/[0.025] p-14 lg:flex">
        <div>
          <div className="inline-flex items-center gap-3 rounded-full border border-violet-300/18 bg-violet-400/10 px-4 py-2 text-sm text-violet-100">
            Защищённый desktop-мессенджер
          </div>

          <div className="mt-24 max-w-2xl">
            <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-br from-violet-500 to-fuchsia-500 shadow-2xl shadow-violet-950/40">
              <MessageCircle size={32} />
            </div>
            <h1 className="text-6xl font-semibold tracking-tight text-zinc-50">
              Vector
            </h1>
            <p className="mt-6 text-xl leading-8 text-zinc-400">
              Защищённое пространство для рабочих диалогов, групп и документов.
            </p>
          </div>

          <div className="mt-14 grid max-w-3xl gap-3 xl:grid-cols-3">
            {LOGIN_FEATURES.map((item) => {
              const Icon = item.icon;

              return (
                <div key={item.title} className="rounded-[1.5rem] border border-white/10 bg-white/[0.035] p-4 shadow-lg shadow-black/10">
                  <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-2xl bg-white/[0.06] text-violet-200">
                    <Icon size={18} />
                  </div>
                  <div className="text-sm font-semibold text-zinc-100">{item.title}</div>
                  <div className="mt-1 text-xs leading-5 text-zinc-500">{item.description}</div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex max-w-xl items-center gap-3 rounded-[1.5rem] border border-white/10 bg-black/15 px-4 py-3 text-sm text-zinc-500">
          <ShieldCheck size={17} className="shrink-0 text-violet-200" />
          <span>Вход выполняется на этом устройстве. Доступ защищён вашей учётной записью.</span>
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
                Введите данные пользователя.
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
              label="Логин"
              value={loginValue}
              onChange={(event) => setLoginValue(event.target.value)}
              placeholder="admin или username"
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
              <div className="rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                {errorMessage}
              </div>
            )}

            <GlowButton className="w-full" disabled={isLoading || !loginValue.trim() || !password.trim()}>
              {isLoading ? 'Подключаемся...' : 'Войти'}
            </GlowButton>
          </div>
        </form>
      </section>
    </div>
  );
}
