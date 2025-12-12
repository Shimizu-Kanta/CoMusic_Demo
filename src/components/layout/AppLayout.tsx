import { ReactNode } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../contexts/AuthContext';
import { Home, Mail, Send, PenSquare, User, LogOut, Music } from 'lucide-react';

type Props = {
  children: ReactNode;
};

export const AppLayout = ({ children }: Props) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  const navItems = [
    { to: '/app', icon: Home, label: 'ホーム' },
    { to: '/letters/new', icon: PenSquare, label: '新規作成' },
    { to: '/letters/inbox', icon: Mail, label: '受信' },
    { to: '/letters/sent', icon: Send, label: '送信済み' },
    { to: '/settings/profile', icon: User, label: 'プロフィール' },
  ];

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <header className="border-b border-gray-200 bg-white sticky top-0 z-50 shadow-sm">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link 
              to="/app" 
              className="flex items-center gap-2 hover:opacity-80 transition-opacity"
              style={{ color: '#8fcccc' }}
            >
              <Music className="w-6 h-6" />
              <span className="text-lg font-semibold">CoMusic</span>
            </Link>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center gap-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.to;
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                      isActive
                        ? 'bg-[#8fcccc]/10 text-[#8fcccc]'
                        : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
              {user && (
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors ml-2"
                >
                  <LogOut className="w-4 h-4" />
                  <span>ログアウト</span>
                </button>
              )}
            </nav>

            {/* Mobile Navigation */}
            <div className="md:hidden flex items-center gap-2">
              <Link
                to="/letters/new"
                className="flex items-center gap-1 px-3 py-2 rounded-lg text-sm transition-colors shadow-sm"
                style={{ backgroundColor: '#8fcccc', color: 'white' }}
              >
                <PenSquare className="w-4 h-4" />
              </Link>
              {user && (
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-1 px-3 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-100"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Mobile Bottom Navigation */}
          <div className="md:hidden border-t border-gray-200 flex items-center justify-around py-2 bg-white">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.to;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`flex flex-col items-center gap-1 px-2 py-1 rounded-lg text-xs transition-colors ${
                    isActive ? 'text-[#8fcccc]' : 'text-gray-500'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-4 py-6">{children}</main>
    </div>
  );
};