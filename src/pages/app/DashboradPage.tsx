// src/pages/app/DashboardPage.tsx
import { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabaseClient';
import { Link } from 'react-router-dom';

type Profile = {
  id: string;
  username: string;
  user_id: string;
};

export const DashboardPage = () => {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    if (!user) return;

    const fetchProfile = async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error) {
        console.error(error);
      } else {
        setProfile(data);
      }
    };

    fetchProfile();
  }, [user]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold mb-1">
          こんにちは、{profile?.username ?? 'ユーザー'} さん
        </h1>
        <p className="text-sm text-slate-400">
          今日も誰かにソングレターを届けてみませんか？
        </p>
      </div>

      {/* TODO: 実際のカウント系ロジックは後で実装 */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <p className="text-xs text-slate-400 mb-1">今日送れるソングレター</p>
          <p className="text-2xl font-semibold">5 通</p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <p className="text-xs text-slate-400 mb-1">受信ボックス</p>
          <p className="text-2xl font-semibold">0 通</p>
        </div>
      </div>

      <div className="flex gap-3">
        <Link
          to="/letters/new"
          className="rounded-md bg-sky-500 px-4 py-2 text-sm font-medium hover:bg-sky-400"
        >
          ソングレターを書く
        </Link>
        <Link
          to="/letters/inbox"
          className="rounded-md border border-slate-700 px-4 py-2 text-sm hover:bg-slate-900"
        >
          受信ボックスを開く
        </Link>
      </div>
    </div>
  );
};
