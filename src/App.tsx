// src/App.tsx
import { Routes, Route, Navigate } from 'react-router-dom';
import { PrivateRoute } from './components/PrivateRoute';
import { LoginPage } from './pages/auth/LoginPage';
import { SignupPage } from './pages/auth/SignupPage';
import { DashboardPage } from './pages/app/DashboradPage';
import { NewSongLetterPage } from './pages/app/NewSongLetterPage';
import { InboxPage } from './pages/app/InboxPage';
import { LetterDetailPage } from './pages/app/LetterDetailPage';
import { ProfileSettingsPage } from './pages/app/ProfileSettingsPage';
import { AppLayout } from './components/layout/AppLayout';
import { SentLettersPage } from './pages/app/SentLettersPage';

function App() {
  return (
    <Routes>
      {/* 公開ルート */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />

      {/* ログイン必須ルート */}
      <Route
        path="/app"
        element={
          <PrivateRoute>
            <AppLayout>
              <DashboardPage />
            </AppLayout>
          </PrivateRoute>
        }
      />

      <Route
        path="/letters/new"
        element={
          <PrivateRoute>
            <AppLayout>
              <NewSongLetterPage />
            </AppLayout>
          </PrivateRoute>
        }
      />

      <Route
        path="/letters/inbox"
        element=
        {
          <PrivateRoute>
            <AppLayout>
              <InboxPage />
            </AppLayout>
          </PrivateRoute>
        }
      />

      <Route
        path="/letters/sent"
        element={
          <PrivateRoute>
            <AppLayout>
              <SentLettersPage />
            </AppLayout>
          </PrivateRoute>
        }
      />  
      
      <Route
        path="/letters/:id"
        element={
          <PrivateRoute>
            <AppLayout>
              <LetterDetailPage />
            </AppLayout>
          </PrivateRoute>
        }
      />

      <Route
        path="/settings/profile"
        element={
          <PrivateRoute>
            <AppLayout>
              <ProfileSettingsPage />
            </AppLayout>
          </PrivateRoute>
        }
      />

      {/* ルート無し → /app or /login にリダイレクト */}
      <Route path="/" element={<Navigate to="/app" replace />} />
      <Route path="*" element={<Navigate to="/app" replace />} />
    </Routes>
  );
}

export default App;
