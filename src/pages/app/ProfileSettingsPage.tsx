// src/pages/app/ProfileSettingsPage.tsx
import { FormEvent, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../contexts/AuthContext';

type Profile = {
  id: string;
  username: string;
  user_id: string;
};

export const ProfileSettingsPage = () => {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [username, setUsername] = useState('');
  const [userId, setUserId] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!user) return;

    const fetchProfile = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('profiles')
        .select('id, username, user_id')
        .eq('id', user.id)
        .single();

      if (error) {
        console.error(error);
        setError('プロフィールの取得に失敗しました。');
      } else if (data) {
        setProfile(data);
        setUsername(data.username);
        setUserId(data.user_id);
      }

      setLoading(false);
    };

    fetchProfile();
  }, [user]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setError(null);
    setSaved(false);
    setSaving(true);

    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        username,
        user_id: userId,
      })
      .eq('id', user.id);

    setSaving(false);

    if (updateError) {
      console.error(updateError);
      setError(updateError.message);
      return;
    }

    setSaved(true);
  };

  if (!user) return null;

  if (loading) {
    return <p className="text-sm text-slate-400">プロフィールを読み込み中…</p>;
  }

  if (!profile) {
    return (
      <p className="text-sm text-red-400">
        プロフィール情報が見つかりませんでした。サインアップ処理を確認してください。
      </p>
    );
  }

  return (
    <div className="space-y-6 max-w-xl">
      <div>
        <h1 className="text-xl font-semibold mb-1">プロフィール設定</h1>
        <p className="text-sm text-slate-400">
          表示名やユーザIDを変更できます。
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm mb-1">ユーザ名（表示名）</label>
          <input
            className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
        </div>

        <div>
          <label className="block text-sm mb-1">ユーザID (@xxx)</label>
          <input
            className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
          />
          <p className="mt-1 text-xs text-slate-500">
            一意のIDになります。英数字と一部記号のみ許可するなどのバリデーションは後で追加できます。
          </p>
        </div>

        {error && (
          <p className="text-xs text-red-400 bg-red-950/40 border border-red-900 rounded-md px-3 py-2">
            {error}
          </p>
        )}
        {saved && (
          <p className="text-xs text-emerald-400 bg-emerald-950/40 border border-emerald-900 rounded-md px-3 py-2">
            プロフィールを保存しました。
          </p>
        )}

        <button
          type="submit"
          disabled={saving}
          className="rounded-md bg-sky-500 px-4 py-2 text-sm font-medium text-white hover:bg-sky-400 disabled:opacity-50"
        >
          {saving ? '保存中…' : '保存する'}
        </button>
      </form>
    </div>
  );
};
