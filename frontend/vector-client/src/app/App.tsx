import { useEffect, useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { refreshAuthenticationToken } from '../features/auth/api/authApi';
import { useAuthStore } from '../features/auth/model/authStore';
import { LoginPage } from '../pages/LoginPage';
import { MessengerPage } from '../pages/MessengerPage';

function isAccessTokenFresh(accessTokenExpiresAt: string | null): boolean {
  if (!accessTokenExpiresAt) {
    return false;
  }

  const expirationTime = new Date(accessTokenExpiresAt).getTime();

  if (Number.isNaN(expirationTime)) {
    return false;
  }

  return expirationTime - Date.now() > 30_000;
}

function AuthBootstrap({ children }: { children: React.ReactNode }) {
  const accessToken = useAuthStore((state) => state.accessToken);
  const refreshToken = useAuthStore((state) => state.refreshToken);
  const accessTokenExpiresAt = useAuthStore((state) => state.accessTokenExpiresAt);
  const clearAuthentication = useAuthStore((state) => state.clearAuthentication);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let isCancelled = false;

    async function validateStoredAuthentication() {
      if (!accessToken) {
        if (!isCancelled) {
          setIsReady(true);
        }

        return;
      }

      if (isAccessTokenFresh(accessTokenExpiresAt)) {
        if (!isCancelled) {
          setIsReady(true);
        }

        return;
      }

      if (!refreshToken) {
        clearAuthentication();

        if (!isCancelled) {
          setIsReady(true);
        }

        return;
      }

      try {
        await refreshAuthenticationToken();
      }
      catch (error) {
        console.warn(error);
        clearAuthentication();
      }
      finally {
        if (!isCancelled) {
          setIsReady(true);
        }
      }
    }

    setIsReady(false);
    void validateStoredAuthentication();

    return () => {
      isCancelled = true;
    };
  }, [accessToken, accessTokenExpiresAt, clearAuthentication, refreshToken]);

  if (!isReady) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#111214] text-sm text-zinc-400">
        Загрузка Vector…
      </div>
    );
  }

  return <>{children}</>;
}

function ProtectedRoute() {
  const accessToken = useAuthStore((state) => state.accessToken);

  if (!accessToken) {
    return <Navigate to="/login" replace />;
  }

  return <MessengerPage />;
}

export function App() {
  return (
    <AuthBootstrap>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/messenger" element={<ProtectedRoute />} />
        <Route path="*" element={<Navigate to="/messenger" replace />} />
      </Routes>
    </AuthBootstrap>
  );
}
