import { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabaseClient';
import { Link } from 'react-router-dom';
import { PenSquare, Mail, TrendingUp, Inbox } from 'lucide-react';
import Modal from '../app/TutorialModal';
import { Button } from '../../components/ui/button';

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
  const [isOpenTutorial, setIsOpenTutorial] = useState(false);
  const [hasSeenTutorial, setHasSeenTutorial] = useState<boolean | null>(null);

  useEffect(() => {
    if (!user) return;

    const fetchAll = async () => {
      setLoadingCounts(true);

      // プロフィール
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single<Profile & { has_seen_tutorial: boolean }>();

      if (profileError) {
        console.error(profileError);
      } else {
        setProfile(profileData);
        // has_seen_tutorial フラグをチェック
        if (profileData && profileData.has_seen_tutorial === false) {
          setIsOpenTutorial(true);
          setHasSeenTutorial(false);
        } else {
          setHasSeenTutorial(profileData?.has_seen_tutorial ?? true);
        }
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

  // モーダルを閉じた時に has_seen_tutorial を TRUE に更新
  const handleCloseTutorialModal = async (open: boolean) => {
    setIsOpenTutorial(open);

    // モーダルが閉じられた場合（open === false）
    if (!open && hasSeenTutorial === false && user) {
      try {
        const { error } = await supabase
          .from('profiles')
          .update({ has_seen_tutorial: true })
          .eq('id', user.id);

        if (!error) {
          setHasSeenTutorial(true);
        } else {
          console.error('has_seen_tutorial の更新に失敗:', error);
        }
      } catch (err) {
        console.error('更新中にエラーが発生:', err);
      }
    }
  };

  if (!user) return null;

  const remainingLetters = Math.max(maxDailyLetters - sentToday, 0);

  return (
    <>
      <Modal 
        isOpenModal={isOpenTutorial} 
        setIsOpenModal={handleCloseTutorialModal} 
      />
      
      <div className="space-y-8">
        {/* Welcome Section */}
        <div className="text-center py-8">
          <h1 className="text-3xl mb-2">
            こんにちは、<span style={{ color: '#8fcccc' }}>{profile?.username ?? 'ユーザー'}</span> さん
          </h1>
          <p className="text-sm text-gray-600">
            今日も誰かにソングレターを届けてみませんか?
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid gap-4 md:grid-cols-2">
          {/* 今日送れるソングレター */}
          <div className="group rounded-xl border border-gray-200 bg-white p-6 hover:border-[#8fcccc] hover:shadow-md transition-all">
            <div className="flex items-start justify-between mb-4">
              <div className="p-3 rounded-lg bg-[#8fcccc]/10">
                <TrendingUp className="w-6 h-6" style={{ color: '#8fcccc' }} />
              </div>
              <p className="text-xs text-gray-500">本日</p>
            </div>
            <p className="text-xs text-gray-600 mb-1">今日送れるソングレター</p>
            {loadingCounts ? (
              <p className="text-sm text-gray-400">計算中…</p>
            ) : (
              <>
                <p className="text-3xl mb-2" style={{ color: '#8fcccc' }}>
                  {remainingLetters} <span className="text-base text-gray-500">通</span>
                </p>
                <p className="text-xs text-gray-500">
                  本日 {sentToday} / {maxDailyLetters} 通 送信済み
                </p>
              </>
            )}
          </div>

          {/* 受信ボックス（未読） */}
          <div className="group rounded-xl border border-gray-200 bg-white p-6 hover:border-[#8fcccc] hover:shadow-md transition-all">
            <div className="flex items-start justify-between mb-4">
              <div className="p-3 rounded-lg bg-[#8fcccc]/10">
                <Inbox className="w-6 h-6" style={{ color: '#8fcccc' }} />
              </div>
              {unreadInbox > 0 && (
                <span className="px-2 py-1 rounded-full text-xs" style={{ backgroundColor: '#8fcccc', color: 'white' }}>
                  {unreadInbox}
                </span>
              )}
            </div>
            <p className="text-xs text-gray-600 mb-1">受信ボックス（未読）</p>
            {loadingCounts ? (
              <p className="text-sm text-gray-400">計算中…</p>
            ) : (
              <>
                <p className="text-3xl mb-2" style={{ color: '#8fcccc' }}>
                  {unreadInbox} <span className="text-base text-gray-500">通</span>
                </p>
                <p className="text-xs text-gray-500">
                  受信枠: {unreadInbox} / {maxInboxLetters}
                </p>
              </>
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid gap-4 md:grid-cols-2">
          <Link
            to="/letters/new"
            className="group flex items-center gap-4 rounded-xl border border-gray-200 bg-white p-6 hover:border-[#8fcccc] hover:shadow-md transition-all"
          >
            <div className="p-4 rounded-xl group-hover:scale-110 transition-transform" style={{ backgroundColor: '#8fcccc' }}>
              <PenSquare className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1">
              <h3 className="mb-1">ソングレターを書く</h3>
              <p className="text-xs text-gray-600">
                音楽と一緒に気持ちを届けよう
              </p>
            </div>
          </Link>

          <Link
            to="/letters/inbox"
            className="group flex items-center gap-4 rounded-xl border border-gray-200 bg-white p-6 hover:border-[#8fcccc] hover:shadow-md transition-all"
          >
            <div className="p-4 rounded-xl bg-gray-100 group-hover:bg-[#8fcccc]/10 group-hover:scale-110 transition-all">
              <Mail className="w-6 h-6" style={{ color: '#8fcccc' }} />
            </div>
            <div className="flex-1">
              <h3 className="mb-1">受信ボックスを開く</h3>
              <p className="text-xs text-gray-600">
                届いたソングレターを確認
              </p>
            </div>
          </Link>

        </div>

        <button 
          onClick={() => setIsOpenTutorial(true)}
          className="w-full group flex items-center gap-4 rounded-xl border border-gray-200 bg-white p-6 hover:border-[#8fcccc] hover:shadow-md transition-all"
        >
          <div className="p-4 rounded-xl group-hover:scale-110 transition-transform text-white font-semibold" style={{ backgroundColor: '#8fcccc' }}>
            ? 
          </div>
          <div className="flex-1 text-left">
            <h3 className="mb-1">使い方について</h3>
            <p className="text-xs text-gray-600">
              CoMusicの使い方を確認
            </p>
          </div>
        </button>

      </div>
    </>
  );
};