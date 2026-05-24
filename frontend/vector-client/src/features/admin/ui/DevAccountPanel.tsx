import { FormEvent, useMemo, useState } from 'react';
import { createAccountRegistration } from '../api/adminAccountApi';
import { completeRegistration } from '../../auth/api/authApi';

type CreatedDevAccount = {
  username: string;
  email: string;
  password: string;
};

export function DevAccountPanel() {
  const defaultUsername = useMemo(() => `user${Math.floor(Math.random() * 10000)}`, []);
  const [username, setUsername] = useState(defaultUsername);
  const [email, setEmail] = useState(`${defaultUsername}@company.local`);
  const [firstName, setFirstName] = useState('Тест');
  const [lastName, setLastName] = useState('Пользователь');
  const [password, setPassword] = useState('UserPassword123!');
  const [isLoading, setIsLoading] = useState(false);
  const [createdAccount, setCreatedAccount] = useState<CreatedDevAccount | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      const registration = await createAccountRegistration({
        username,
        email,
        firstName,
        lastName,
        middleName: null,
        expiresAt,
      });

      await completeRegistration({
        registrationToken: registration.registrationToken,
        password,
        passwordConfirmation: password,
      });

      setCreatedAccount({ username, email, password });
    }
    catch (error) {
      console.error(error);
      setErrorMessage('Не удалось создать тестового пользователя. Проверьте права администратора и уникальность логина/почты.');
    }
    finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-4">
      <div className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
        Тестовый пользователь
      </div>

      <form onSubmit={handleSubmit} className="space-y-2">
        <input
          value={username}
          onChange={(event) => {
            setUsername(event.target.value);
            setEmail(`${event.target.value}@company.local`);
          }}
          className="w-full rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-xs text-zinc-200 outline-none focus:border-violet-400/50"
          placeholder="Логин"
        />
        <input
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="w-full rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-xs text-zinc-200 outline-none focus:border-violet-400/50"
          placeholder="Почта"
        />
        <input
          value={firstName}
          onChange={(event) => setFirstName(event.target.value)}
          className="w-full rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-xs text-zinc-200 outline-none focus:border-violet-400/50"
          placeholder="Имя"
        />
        <input
          value={lastName}
          onChange={(event) => setLastName(event.target.value)}
          className="w-full rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-xs text-zinc-200 outline-none focus:border-violet-400/50"
          placeholder="Фамилия"
        />
        <input
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="w-full rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-xs text-zinc-200 outline-none focus:border-violet-400/50"
          placeholder="Пароль"
        />
        <button
          disabled={isLoading}
          className="w-full rounded-2xl bg-violet-500 px-3 py-2 text-xs font-semibold text-white transition hover:bg-violet-400 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isLoading ? 'Создание…' : 'Создать тестового пользователя'}
        </button>
      </form>

      {createdAccount && (
        <div className="mt-3 rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-3 text-xs text-emerald-100">
          <div>Создан: {createdAccount.username}</div>
          <div>Пароль: {createdAccount.password}</div>
        </div>
      )}

      {errorMessage && (
        <div className="mt-3 rounded-2xl border border-red-400/20 bg-red-500/10 p-3 text-xs text-red-100">
          {errorMessage}
        </div>
      )}
    </div>
  );
}
