// src/pages/app/NewSongLetterPage.tsx
import { FormEvent, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../contexts/AuthContext';

type Provider = 'spotify' | 'youtube';

type Profile = {
  username: string;
};

type SpotifyTrack = {
  id: string;
  name: string;
  artists: { id: string | null; name: string }[];
  url: string | null;
  imageUrl: string | null;
  durationMs: number;
};

export const NewSongLetterPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  // 共通
  const [provider, setProvider] = useState<Provider>('spotify');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [message, setMessage] = useState('');

  // プロフィール（ユーザ名）
  const [profileName, setProfileName] = useState<string | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);

  // Spotify 用
  const [spotifyQuery, setSpotifyQuery] = useState('');
  const [spotifyResults, setSpotifyResults] = useState<SpotifyTrack[]>([]);
  const [spotifyLoading, setSpotifyLoading] = useState(false);
  const [spotifyError, setSpotifyError] = useState<string | null>(null);
  const [selectedTrack, setSelectedTrack] = useState<SpotifyTrack | null>(null);

  // YouTube 用（暫定：手入力）
  const [ytInput, setYtInput] = useState('');
  const [ytTitle, setYtTitle] = useState('');

  // 送信まわり
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!user) {
    // PrivateRoute でガードしているはずだけど念のため
    return null;
  }

  // プロフィール取得
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
        setProfileError(
          'プロフィールの取得に失敗しました。ページを再読み込みしてください。'
        );
        setProfileName(null);
      } else {
        setProfileName(data.username);
      }

      setProfileLoading(false);
    };

    fetchProfile();
  }, [user]);

  // YouTube用の簡易ID抽出
  const extractYouTubeId = (input: string): string => {
    const trimmed = input.trim();
    if (!trimmed) return '';

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

  // Spotify 検索（ボタンクリックで実行）
  const handleSpotifySearch = async () => {
    setSpotifyError(null);
    setError(null);
    setSelectedTrack(null);

    const q = spotifyQuery.trim();
    if (!q) {
      setSpotifyError('検索キーワードを入力してください。');
      return;
    }

    setSpotifyLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke<{
        tracks: SpotifyTrack[];
      }>('spotify-search-tracks', {
        body: { q, limit: 8 },
      });

      if (error) {
        console.error(error);
        setSpotifyError(
          'Spotifyの検索に失敗しました。時間をおいて再度お試しください。'
        );
        setSpotifyResults([]);
      } else if (!data || !Array.isArray(data.tracks)) {
        setSpotifyError('検索結果の形式が不正です。');
        setSpotifyResults([]);
      } else {
        setSpotifyResults(data.tracks);
      }
    } catch (err) {
      console.error(err);
      setSpotifyError('Spotifyの検索中にエラーが発生しました。');
      setSpotifyResults([]);
    } finally {
      setSpotifyLoading(false);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    const displayName = isAnonymous ? '匿名' : profileName;

    if (!displayName) {
      setError(
        '送り主のユーザ名が取得できていません。ページを再読み込みしてからお試しください。'
      );
      return;
    }

    if (!message.trim()) {
      setError('メッセージを入力してください。');
      return;
    }

    setLoading(true);

    try {
      let songId: string | null = null;

      if (provider === 'spotify') {
        // Spotify の場合：曲を1つ選んでいること
        if (!selectedTrack) {
          setLoading(false);
          setError('Spotifyの検索結果から曲を1つ選択してください。');
          return;
        }

        // 1. songs を UPSERT 的に扱う
        const { data: existingSongs, error: selectSongError } = await supabase
          .from('songs')
          .select('id')
          .eq('provider', 'spotify')
          .eq('provider_track_id', selectedTrack.id)
          .limit(1);

        if (selectSongError) {
          console.error(selectSongError);
          throw new Error('楽曲情報の取得に失敗しました。');
        }

        if (existingSongs && existingSongs.length > 0) {
          songId = existingSongs[0].id;
        } else {
          const { data: insertedSong, error: insertSongError } = await supabase
            .from('songs')
            .insert({
              provider: 'spotify',
              provider_track_id: selectedTrack.id,
              title: selectedTrack.name,
              url: selectedTrack.url,
              thumbnail_url: selectedTrack.imageUrl,
              duration_ms: selectedTrack.durationMs,
            })
            .select('id')
            .single();

          if (insertSongError || !insertedSong) {
            console.error(insertSongError);
            throw new Error('楽曲情報の保存に失敗しました。');
          }

          songId = insertedSong.id;
        }

        // 2. artists / songs_artists を保存
        const artistIds: string[] = [];

        for (const artist of selectedTrack.artists) {
          if (!artist.name) continue;

          let artistId: string | null = null;

          if (artist.id) {
            const { data: existingArtists, error: selectArtistError } =
              await supabase
                .from('artists')
                .select('id')
                .eq('provider', 'spotify')
                .eq('provider_artist_id', artist.id)
                .limit(1);

            if (selectArtistError) {
              console.error(selectArtistError);
              throw new Error('アーティスト情報の取得に失敗しました。');
            }

            if (existingArtists && existingArtists.length > 0) {
              artistId = existingArtists[0].id;
            }
          }

          if (!artistId) {
            const { data: insertedArtist, error: insertArtistError } =
              await supabase
                .from('artists')
                .insert({
                  name: artist.name,
                  provider: 'spotify',
                  provider_artist_id: artist.id,
                })
                .select('id')
                .single();

            if (insertArtistError || !insertedArtist) {
              console.error(insertArtistError);
              throw new Error('アーティスト情報の保存に失敗しました。');
            }

            artistId = insertedArtist.id;
          }

          artistIds.push(artistId);
        }

        if (artistIds.length > 0 && songId) {
          const rows = artistIds.map((artistId) => ({
            song_id: songId!,
            artist_id: artistId,
          }));
          const { error: saError } = await supabase
            .from('songs_artists')
            .insert(rows);

          if (saError) {
            console.warn('songs_artists 挿入エラー:', saError);
          }
        }
      } else {
        // YouTube（手入力版）
        if (!ytInput.trim()) {
          setLoading(false);
          setError('YouTube の URL またはIDを入力してください。');
          return;
        }
        if (!ytTitle.trim()) {
          setLoading(false);
          setError('曲のタイトルを入力してください。');
          return;
        }

        const videoId = extractYouTubeId(ytInput);
        if (!videoId) {
          setLoading(false);
          setError('YouTube の URL / ID の形式を確認してください。');
          return;
        }

        const { data: existingSongs, error: selectSongError } = await supabase
          .from('songs')
          .select('id')
          .eq('provider', 'youtube')
          .eq('provider_track_id', videoId)
          .limit(1);

        if (selectSongError) {
          console.error(selectSongError);
          throw new Error('楽曲情報の取得に失敗しました。');
        }

        if (existingSongs && existingSongs.length > 0) {
          songId = existingSongs[0].id;
        } else {
          const { data: insertedSong, error: insertSongError } = await supabase
            .from('songs')
            .insert({
              provider: 'youtube',
              provider_track_id: videoId,
              title: ytTitle,
              url: ytInput,
            })
            .select('id')
            .single();

          if (insertSongError || !insertedSong) {
            console.error(insertSongError);
            throw new Error('楽曲情報の保存に失敗しました。');
          }

          songId = insertedSong.id;
        }
      }

      if (!songId) {
        throw new Error('楽曲情報の保存に失敗しました。');
      }

      // 3. song_letters に INSERT（マッチングは後で）
      const { error: insertLetterError } = await supabase
        .from('song_letters')
        .insert({
          sender_id: user.id,
          receiver_id: null,
          song_id: songId,
          sender_name: displayName,
          is_anonymous: isAnonymous,
          message,
          status: 'queued',
        });

      if (insertLetterError) {
        console.error(insertLetterError);
        throw new Error('ソングレターの送信に失敗しました。');
      }

      navigate('/app', { replace: true });
    } catch (err: any) {
      console.error(err);
      setError(err.message ?? 'エラーが発生しました。');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold mb-1">ソングレターを書く</h1>
        <p className="text-sm text-slate-400">
          誰かに曲とメッセージを届けましょう。
          今は Spotify 検索から曲を選ぶか、YouTube のURL/IDを直接入力できます。
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5 max-w-xl">
        {/* 送り主の表示名 */}
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
                <p className="mt-1 text-xs text-slate-400">表示名：匿名</p>
              </button>
            </div>
          )}

          <p className="mt-1 text-xs text-slate-500">
            相手にはここで選んだ名前だけが表示されます。
          </p>
        </div>

        {/* 曲のサービス選択 */}
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
              Spotify（検索）
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
              YouTube（URL/ID）
            </button>
          </div>
        </div>

        {/* Spotify 検索 UI */}
        {provider === 'spotify' && (
          <div className="space-y-3">
            <div className="space-y-2">
              <label className="block text-sm">Spotifyで曲を検索</label>
              <div className="flex gap-2">
                <input
                  className="flex-1 rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                  placeholder="曲名やアーティスト名で検索"
                  value={spotifyQuery}
                  onChange={(e) => setSpotifyQuery(e.target.value)}
                />
                <button
                  type="button"
                  onClick={handleSpotifySearch}
                  disabled={spotifyLoading}
                  className="rounded-md bg-sky-500 px-3 py-2 text-sm font-medium text-white hover:bg-sky-400 disabled:opacity-50"
                >
                  {spotifyLoading ? '検索中…' : '検索'}
                </button>
              </div>
            </div>

            {spotifyError && (
              <p className="text-xs text-red-400 bg-red-950/40 border border-red-900 rounded-md px-3 py-2">
                {spotifyError}
              </p>
            )}

            {spotifyResults.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs text-slate-400">
                  検索結果から1曲選択してください。
                </p>
                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {spotifyResults.map((track) => (
                    <button
                      type="button"
                      key={track.id}
                      onClick={() => setSelectedTrack(track)}
                      className={`w-full text-left rounded-md border px-3 py-2 text-sm flex gap-3 ${
                        selectedTrack?.id === track.id
                          ? 'border-sky-500 bg-sky-500/10'
                          : 'border-slate-700 bg-slate-950 hover:border-slate-500'
                      }`}
                    >
                      {track.imageUrl && (
                        <img
                          src={track.imageUrl}
                          alt={track.name}
                          className="h-10 w-10 rounded-md object-cover"
                        />
                      )}
                      <div className="flex-1">
                        <p className="font-medium">{track.name}</p>
                        <p className="text-xs text-slate-400">
                          {track.artists.map((a) => a.name).join(', ')}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {selectedTrack && (
              <div className="rounded-md border border-sky-500/60 bg-sky-500/5 p-3 flex gap-3 items-center">
                {selectedTrack.imageUrl && (
                  <img
                    src={selectedTrack.imageUrl}
                    alt={selectedTrack.name}
                    className="h-12 w-12 rounded-md object-cover"
                  />
                )}
                <div className="flex-1">
                  <p className="text-xs text-slate-400 mb-0.5">選択中の曲</p>
                  <p className="text-sm font-medium">{selectedTrack.name}</p>
                  <p className="text-xs text-slate-400">
                    {selectedTrack.artists.map((a) => a.name).join(', ')}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* YouTube 入力 UI */}
        {provider === 'youtube' && (
          <div className="space-y-3">
            <div className="space-y-2">
              <label className="block text-sm">YouTube のURLまたは動画ID</label>
              <input
                className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                placeholder="https://youtu.be/… / 動画ID"
                value={ytInput}
                onChange={(e) => setYtInput(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="block text-sm">曲のタイトル</label>
              <input
                className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                placeholder="例: 夜に駆ける"
                value={ytTitle}
                onChange={(e) => setYtTitle(e.target.value)}
              />
            </div>
          </div>
        )}

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
