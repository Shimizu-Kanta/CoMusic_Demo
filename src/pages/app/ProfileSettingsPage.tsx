import { FormEvent, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../contexts/AuthContext';
import { User, Save } from 'lucide-react';

export const ProfileSettingsPage = () => {
  const { user } = useAuth();
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;

    const fetchProfile = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('profiles')
        .select('username')
        .eq('id', user.id)
        .single();

      if (error) {
        console.error(error);
      } else if (data) {
        setUsername(data.username || '');
      }
      setLoading(false);
    };

    fetchProfile();
  }, [user]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setSaving(true);
    setMessage(null);

    const { error } = await supabase
      .from('profiles')
      .update({ username })
      .eq('id', user.id);

    if (error) {
      setMessage('保存に失敗しました: ' + error.message);
    } else {
      setMessage('プロフィールを更新しました！');
    }

    setSaving(false);
  };

  if (!user) return null;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="mb-1">プロフィール設定</h1>
        <p className="text-sm text-gray-600">
          あなたの情報を編集できます
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-gray-500">読み込み中…</p>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="rounded-xl border border-gray-200 bg-white p-6 space-y-4 shadow-sm">
            <h3 className="flex items-center gap-2">
              <User className="w-5 h-5" style={{ color: '#8fcccc' }} />
              基本情報
            </h3>

            <div>
              <label htmlFor="email" className="block text-sm mb-2 text-gray-700">
                メールアドレス
              </label>
              <input
                id="email"
                type="email"
                value={user.email || ''}
                disabled
                className="w-full rounded-lg border border-gray-300 bg-gray-100 px-4 py-2.5 text-sm text-gray-500 cursor-not-allowed"
              />
              <p className="text-xs text-gray-500 mt-1">
                メールアドレスは変更できません
              </p>
            </div>

            <div>
              <label htmlFor="username" className="block text-sm mb-2 text-gray-700">
                ユーザー名
              </label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm focus:border-[#8fcccc] focus:outline-none transition-colors"
                placeholder="あなたの名前"
              />
            </div>
          </div>

          {message && (
            <p
              className={`text-xs px-4 py-3 rounded-md ${
                message.includes('失敗')
                  ? 'text-red-600 bg-red-50 border border-red-200'
                  : 'bg-emerald-50 border border-emerald-200'
              }`}
              style={
                message.includes('失敗')
                  ? undefined
                  : { color: '#8fcccc' }
              }
            >
              {message}
            </p>
          )}

          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm transition-all disabled:opacity-50 text-white"
            style={{ backgroundColor: '#8fcccc' }}
          >
            <Save className="w-4 h-4" />
            {saving ? '保存中...' : '保存する'}
          </button>
        </form>
      )}
    </div>
  );
};