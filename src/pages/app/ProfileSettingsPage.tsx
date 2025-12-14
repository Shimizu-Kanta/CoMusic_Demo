import { FormEvent, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../contexts/AuthContext';
import { User, Save, Trash2 } from 'lucide-react';

export const ProfileSettingsPage = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

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

    const handleDeleteAccount = async () => {
    if (!user) return;

    const confirmed = window.confirm("本当にアカウントを削除しますか？この操作は取り消せません。");
    if (!confirmed) return;

    setLoading(true);
    setErrorMsg("");

    try {
      const { data, error } = await supabase.functions.invoke("delete-user", {
        body: { user_id: user.id },
      });

      if (error) {
        console.error("削除関数エラー:", error.message);
        setErrorMsg("アカウント削除に失敗しました");
        setLoading(false);
        return;
      }

      await supabase.auth.signOut();
      navigate("/login");
    } catch (e) {
      console.error("Edge Function呼び出しエラー:", e);
      setErrorMsg("アカウント削除処理に失敗しました");
      setLoading(false);
    }
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

      {/* アカウント削除セクション */}
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 space-y-4">
        <h3 className="flex items-center gap-2 text-red-700">
          <Trash2 className="w-5 h-5" />
          アカウント削除
        </h3>

        <div className="space-y-3">
          <p className="text-sm text-red-600">
            アカウントを削除すると、すべてのデータが完全に削除され、復元できません。
            送信した手紙や受信した手紙もすべて削除されます。
          </p>

          <button
            type="button"
            onClick={() => setShowDeleteConfirm(true)}
            className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm bg-red-600 text-white hover:bg-red-700 transition-colors"
            style={{ backgroundColor: '#ff5555' }}
          >
            <Trash2 className="w-4 h-4" />
            アカウントを削除する
          </button>
        </div>
      </div>

      {/* 削除確認ダイアログ */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full space-y-4">
            <h3 className="text-lg font-semibold text-red-700">
              アカウントを削除しますか？
            </h3>

            <p className="text-sm text-gray-600">
              この操作は取り消すことができません。すべてのデータが完全に削除されます。
            </p>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 rounded-lg px-4 py-2 text-sm border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
                disabled={deleting}
              >
                キャンセル
              </button>

              <button
                type="button"
                onClick={handleDeleteAccount}
                disabled={deleting}
                className="flex-1 rounded-lg px-4 py-2 text-sm bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
                style={{ backgroundColor: '#ff5555' }}
              >
                {deleting ? '削除中...' : '削除する'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};