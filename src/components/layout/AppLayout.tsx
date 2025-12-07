// src/components/layout/AppLayout.tsx
import { ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../contexts/AuthContext';

type Props = {
  children: ReactNode;
};

export const AppLayout = ({ children }: Props) => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50">
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur">
        <div className="max-w-4xl mx-auto flex items-center justify-between px-4 py-3">
          <Link to="/app" className="font-semibold text-lg">
            SongLetter
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            <Link to="/letters/new" className="hover:text-sky-400">
              ソングレターを書く
            </Link>
            <Link to="/letters/inbox" className="hover:text-sky-400">
              受信ボックス
            </Link>
            <Link to="/settings/profile" className="hover:text-sky-400">
              プロフィール
            </Link>
            {user && (
              <button
                onClick={handleLogout}
                className="rounded-md border border-slate-700 px-3 py-1 text-xs hover:bg-slate-800"
              >
                ログアウト
              </button>
            )}
          </nav>
        </div>
      </header>
      <main className="max-w-4xl mx-auto px-4 py-6">{children}</main>
    </div>
  );
};
