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

  const [maxDailyLetters, setMaxDailyLetters] = useState<number>(5);
  const [maxInboxLetters, setMaxInboxLetters] = useState<number>(10);
  const [sentToday, setSentToday] = useState<number>(0);
  const [unreadInbox, setUnreadInbox] = useState<number>(0);
  const [loadingCounts, setLoadingCounts] = useState(true);

  useEffect(() => {
    if (!user) return;

    const fetchAll = async () => {
      setLoadingCounts(true);

      // プロフィール
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single<Profile>();

      if (profileError) {
        console.error(profileError);
      } else {
        setProfile(profileData);
      }

      // 設定値（app_settings）
      const { data: settings, error: settingsError } = await supabase
        .from('app_settings')
        .select('key, value_int');

      if (settingsError) {
        console.warn('app_settings 読み込みエラー:', settingsError);
      } else if (settings) {
        for (const row of settings) {
          if (row.key === 'max_daily_letters' && row.value_int != null) {
            setMaxDailyLetters(row.value_int);
          }
          if (row.key === 'max_inbox_letters' && row.value_int != null) {
            setMaxInboxLetters(row.value_int);
          }
        }
      }

      // 今日送ったソングレター数
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(today.getDate() + 1);

      const { count: sentCount, error: sentError } = await supabase
        .from('song_letters')
        .select('id', { count: 'exact', head: true })
        .eq('sender_id', user.id)
        .gte('created_at', today.toISOString())
        .lt('created_at', tomorrow.toISOString());

      if (sentError) {
        console.error(sentError);
      } else {
        setSentToday(sentCount ?? 0);
      }

      // 自分宛ての「未読」レター数（上限判定と同じ条件）
      const { count: inboxCount, error: inboxError } = await supabase
        .from('song_letters')
        .select('id', { count: 'exact', head: true })
        .eq('receiver_id', user.id)
        .in('status', ['delivered', 'replied'])
        .is('archived_at', null)
        .is('read_at', null);

      if (inboxError) {
        console.error(inboxError);
      } else {
        setUnreadInbox(inboxCount ?? 0);
      }

      setLoadingCounts(false);
    };

    fetchAll();
  }, [user]);

  if (!user) return null;

  const remainingLetters = Math.max(maxDailyLetters - sentToday, 0);

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

      <div className="grid gap-4 sm:grid-cols-2">
        {/* 今日送れるソングレター */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <p className="text-xs text-slate-400 mb-1">今日送れるソングレター</p>
          {loadingCounts ? (
            <p className="text-sm text-slate-500">計算中…</p>
          ) : (
            <>
              <p className="text-2xl font-semibold">
                {remainingLetters} 通
              </p>
              <p className="mt-1 text-xs text-slate-500">
                （本日 {sentToday} / {maxDailyLetters} 通 送信済み）
              </p>
            </>
          )}
        </div>

        {/* 受信ボックス（未読） */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <p className="text-xs text-slate-400 mb-1">受信ボックス（未読）</p>
          {loadingCounts ? (
            <p className="text-sm text-slate-500">計算中…</p>
          ) : (
            <>
              <p className="text-2xl font-semibold">{unreadInbox} 通</p>
              <p className="mt-1 text-xs text-slate-500">
                受信枠: {unreadInbox} / {maxInboxLetters}
              </p>
            </>
          )}
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
