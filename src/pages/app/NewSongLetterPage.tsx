// src/pages/app/NewSongLetterPage.tsx
import { FormEvent, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../contexts/AuthContext';

type Provider = 'spotify' | 'youtube';

type Profile = {
  username: string;
};

export const NewSongLetterPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [provider, setProvider] = useState<Provider>('spotify');
  const [trackInput, setTrackInput] = useState('');
  const [title, setTitle] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [message, setMessage] = useState('');

  const [profileName, setProfileName] = useState<string | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!user) {
    // PrivateRoute でガードしているはずだけど念のため
    return null;
  }

  // プロフィール（ユーザ名）取得
  useEffect(() => {
    const fetchProfile = async () => {
      setProfileLoading(true);
      setProfileError(null);

      const { data, error } = await supabase
        .from('profiles')
        .select('username')
        .eq('id', user.id)
        .single<Profile>();

      if (error || !data) {
        console.error(error);
        setProfileError('プロフィールの取得に失敗しました。ページを再読み込みしてください。');
        setProfileName(null);
      } else {
        setProfileName(data.username);
      }

      setProfileLoading(false);
    };

    fetchProfile();
  }, [user]);

  const extractTrackId = (provider: Provider, input: string): string => {
    const trimmed = input.trim();
    if (!trimmed) return '';

    if (provider === 'spotify') {
      const match = trimmed.match(/spotify\.com\/track\/([a-zA-Z0-9]+)/);
      if (match) return match[1];
      return trimmed;
    }

    // youtube
    try {
      const url = new URL(trimmed);
      if (url.hostname.includes('youtu.be')) {
        return url.pathname.replace('/', '').split('/')[0];
      }
      if (url.hostname.includes('youtube.com')) {
        const v = url.searchParams.get('v');
        if (v) return v;
      }
      return trimmed;
    } catch {
      return trimmed;
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    const displayName = isAnonymous ? '匿名' : profileName;

    if (!displayName) {
      setError('送り主のユーザ名が取得できていません。ページを再読み込みしてからお試しください。');
      return;
    }

    if (!trackInput.trim()) {
      setError('曲のURLまたはIDを入力してください。');
      return;
    }
    if (!title.trim()) {
      setError('曲のタイトルを入力してください。');
      return;
    }
    if (!message.trim()) {
      setError('メッセージを入力してください。');
      return;
    }

    const trackId = extractTrackId(provider, trackInput);
    if (!trackId) {
      setError('曲のURL / ID の形式を確認してください。');
      return;
    }

    setLoading(true);

    try {
      // 1. songs を UPSERT 的に扱う（既存チェック → なければINSERT）
      const { data: existingSongs, error: selectSongError } = await supabase
        .from('songs')
        .select('id')
        .eq('provider', provider)
        .eq('provider_track_id', trackId)
        .limit(1);

      if (selectSongError) {
        console.error(selectSongError);
        throw new Error('楽曲情報の取得に失敗しました。');
      }

      let songId: string;

      if (existingSongs && existingSongs.length > 0) {
        songId = existingSongs[0].id;
      } else {
        const { data: insertedSong, error: insertSongError } = await supabase
          .from('songs')
          .insert({
            provider,
            provider_track_id: trackId,
            title,
            url: trackInput,
          })
          .select('id')
          .single();

        if (insertSongError || !insertedSong) {
          console.error(insertSongError);
          throw new Error('楽曲情報の保存に失敗しました。');
        }

        songId = insertedSong.id;
      }

      // 2. song_letters にINSERT（ひとまず receiver_id は null = queued 扱い）
      const { error: insertLetterError } = await supabase.from('song_letters').insert({
        sender_id: user.id,
        receiver_id: null, // マッチングロジックは後で実装
        song_id: songId,
        sender_name: displayName, // ユーザ名 or 匿名
        is_anonymous: isAnonymous,
        message,
        status: 'queued', // ひとまずキュー状態
      });

      if (insertLetterError) {
        console.error(insertLetterError);
        throw new Error('ソングレターの送信に失敗しました。');
      }

      // ひとまず完了したらホームへ
      navigate('/app', { replace: true });
    } catch (e: any) {
      setError(e.message ?? 'エラーが発生しました。');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold mb-1">ソングレターを書く</h1>
        <p className="text-sm text-slate-400">
          誰かに曲とメッセージを届けましょう。まずはあなたの名前を「ユーザ名」か「匿名」から選んでください。
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5 max-w-xl">
        {/* 送り主の表示名：ユーザ名 or 匿名 */}
        <div className="space-y-2">
          <label className="block text-sm">送り主として表示する名前</label>

          {profileLoading ? (
            <p className="text-xs text-slate-400">プロフィールを読み込み中です…</p>
          ) : profileError ? (
            <p className="text-xs text-red-400 bg-red-950/40 border border-red-900 rounded-md px-3 py-2">
              {profileError}
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                className={`rounded-md border px-3 py-2 text-sm text-left ${
                  !isAnonymous
                    ? 'border-sky-500 bg-sky-500/10'
                    : 'border-slate-700 bg-slate-950'
                }`}
                onClick={() => setIsAnonymous(false)}
                disabled={!profileName}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium">ユーザ名で送る</span>
                  <span
                    className={`h-4 w-4 rounded-full border ${
                      !isAnonymous ? 'border-sky-400 bg-sky-500/60' : 'border-slate-500'
                    }`}
                  />
                </div>
                <p className="mt-1 text-xs text-slate-400">
                  表示名：{profileName ?? '（取得できませんでした）'}
                </p>
              </button>

              <button
                type="button"
                className={`rounded-md border px-3 py-2 text-sm text-left ${
                  isAnonymous
                    ? 'border-sky-500 bg-sky-500/10'
                    : 'border-slate-700 bg-slate-950'
                }`}
                onClick={() => setIsAnonymous(true)}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium">匿名で送る</span>
                  <span
                    className={`h-4 w-4 rounded-full border ${
                      isAnonymous ? 'border-sky-400 bg-sky-500/60' : 'border-slate-500'
                    }`}
                  />
                </div>
                <p className="mt-1 text-xs text-slate-400">
                  表示名：匿名
                </p>
              </button>
            </div>
          )}

          <p className="mt-1 text-xs text-slate-500">
            相手にはここで選んだ名前だけが表示されます。匿名を選んだ場合、あなたのユーザ情報とは紐づけずに表示されます（実際の紐づけ方は今後の設計次第）。
          </p>
        </div>

        {/* 曲のサービス */}
        <div className="space-y-2">
          <label className="block text-sm">曲のサービス</label>
          <div className="flex gap-3">
            <button
              type="button"
              className={`flex-1 rounded-md border px-3 py-2 text-sm ${
                provider === 'spotify'
                  ? 'border-sky-500 bg-sky-500/10'
                  : 'border-slate-700 bg-slate-950'
              }`}
              onClick={() => setProvider('spotify')}
            >
              Spotify
            </button>
            <button
              type="button"
              className={`flex-1 rounded-md border px-3 py-2 text-sm ${
                provider === 'youtube'
                  ? 'border-sky-500 bg-sky-500/10'
                  : 'border-slate-700 bg-slate-950'
              }`}
              onClick={() => setProvider('youtube')}
            >
              YouTube
            </button>
          </div>
        </div>

        {/* 曲のURL / ID */}
        <div className="space-y-2">
          <label className="block text-sm">
            曲のURLまたはID{' '}
            <span className="text-xs text-slate-500">(後で検索UIに差し替え予定)</span>
          </label>
          <input
            className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
            placeholder={
              provider === 'spotify'
                ? 'https://open.spotify.com/track/… / トラックID'
                : 'https://youtu.be/… / 動画ID'
            }
            value={trackInput}
            onChange={(e) => setTrackInput(e.target.value)}
          />
        </div>

        {/* 曲タイトル */}
        <div className="space-y-2">
          <label className="block text-sm">曲のタイトル</label>
          <input
            className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
            placeholder="例: 夜に駆ける"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>

        {/* メッセージ */}
        <div className="space-y-2">
          <label className="block text-sm">メッセージ</label>
          <textarea
            className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm min-h-[120px]"
            placeholder="この曲に込めた気持ちや、伝えたいことを書いてみましょう。"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
        </div>

        {error && (
          <p className="text-xs text-red-400 bg-red-950/40 border border-red-900 rounded-md px-3 py-2">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading || profileLoading || (!profileName && !isAnonymous)}
          className="rounded-md bg-sky-500 px-4 py-2 text-sm font-medium text-white hover:bg-sky-400 disabled:opacity-50"
        >
          {loading ? '送信中…' : 'ソングレターを投函する'}
        </button>
      </form>
    </div>
  );
};
