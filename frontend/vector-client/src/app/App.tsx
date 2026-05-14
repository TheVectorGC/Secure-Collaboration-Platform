import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuthStore } from '../features/auth/model/authStore';
import { LoginPage } from '../pages/LoginPage';
import { MessengerPage } from '../pages/MessengerPage';

function ProtectedRoute() {
  const accessToken = useAuthStore((state) => state.accessToken);

  if (!accessToken) {
    return <Navigate to="/login" replace />;
  }

  return <MessengerPage />;
}

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/messenger" element={<ProtectedRoute />} />
      <Route path="*" element={<Navigate to="/messenger" replace />} />
    </Routes>
  );
}
