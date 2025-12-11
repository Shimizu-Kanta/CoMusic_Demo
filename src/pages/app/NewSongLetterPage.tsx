import { FormEvent, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../contexts/AuthContext';
import { Search, Music, AlertCircle, X } from 'lucide-react';

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

type YouTubeVideoMeta = {
  id: string;
  title: string;
  channelTitle: string;
  url: string;
  imageUrl: string | null;
  durationSec: number | null;
  // Supabase function now returns channel_url (e.g. https://www.youtube.com/channel/XYZ)
  channel_url?: string;
  // also accept camelCase just in case
  channelUrl?: string;
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

  // YouTube 用
  const [ytInput, setYtInput] = useState('');
  const [ytTitle, setYtTitle] = useState('');
  const [ytMeta, setYtMeta] = useState<YouTubeVideoMeta | null>(null);
  const [ytMetaLoading, setYtMetaLoading] = useState(false);
  const [ytMetaError, setYtMetaError] = useState<string | null>(null);

  // 送信まわり
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 制限設定用
  const [maxDailyLetters, setMaxDailyLetters] = useState<number>(5);
  const [maxInboxLetters, setMaxInboxLetters] = useState<number>(10);
  const [settingsLoaded, setSettingsLoaded] = useState(false);

  // 今日の送信状況
  const [sentToday, setSentToday] = useState(0);
  const [limitCheckLoading, setLimitCheckLoading] = useState(true);
  const [limitExceeded, setLimitExceeded] = useState(false);

  if (!user) {
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

  // app_settings から各種上限値取得
  useEffect(() => {
    const fetchSettings = async () => {
      const { data, error } = await supabase
        .from('app_settings')
        .select('key, value_int');

      if (error) {
        console.warn('app_settings 読み込みエラー:', error);
        setSettingsLoaded(true);
        return;
      }

      if (data) {
        for (const row of data) {
          if (row.key === 'max_daily_letters' && row.value_int != null) {
            setMaxDailyLetters(row.value_int);
          }
          if (row.key === 'max_inbox_letters' && row.value_int != null) {
            setMaxInboxLetters(row.value_int);
          }
        }
      }

      setSettingsLoaded(true);
    };

    fetchSettings();
  }, []);

  // 今日の送信通数をカウントして、上限に達しているかチェック
  useEffect(() => {
    if (!user) return;

    const checkDailyLimit = async () => {
      setLimitCheckLoading(true);

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(today.getDate() + 1);

      const { count, error } = await supabase
        .from('song_letters')
        .select('id', { count: 'exact', head: true })
        .eq('sender_id', user.id)
        .gte('created_at', today.toISOString())
        .lt('created_at', tomorrow.toISOString());

      if (error) {
        console.error('今日送った通数の取得に失敗しました:', error);
        setSentToday(0);
        setLimitExceeded(false);
      } else {
        const c = count ?? 0;
        setSentToday(c);
        setLimitExceeded(c >= maxDailyLetters);
      }

      setLimitCheckLoading(false);
    };

    checkDailyLimit();
  }, [user, maxDailyLetters]);

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

  // YouTube メタデータ取得
  const handleFetchYouTubeMeta = async () => {
    setYtMetaError(null);
    setError(null);
    setYtMeta(null);

    const input = ytInput.trim();
    if (!input) {
      setYtMetaError('YouTube の URL またはIDを入力してください。');
      return;
    }

    setYtMetaLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke<{
        video: YouTubeVideoMeta;
      }>('youtube-fetch-video', {
        body: { urlOrId: input },
      });

      if (error) {
        console.error(error);
        setYtMetaError(
          'YouTube の情報取得に失敗しました。もう一度お試しください。'
        );
      } else if (!data || !data.video) {
        setYtMetaError('動画情報が取得できませんでした。');
      } else {
        setYtMeta(data.video);

        if (!ytTitle) {
          setYtTitle(data.video.title ?? '');
        }
      }
    } catch (err) {
      console.error(err);
      setYtMetaError('YouTube の情報取得中にエラーが発生しました。');
    } finally {
      setYtMetaLoading(false);
    }
  };

  const assignRandomReceiver = async (
    letterId: string,
    maxInbox: number
  ): Promise<boolean> => {
    if (!user) return false;

    const { data: candidates, error: candidatesError } = await supabase
      .from('profiles')
      .select('id')
      .neq('id', user.id);

    if (candidatesError || !candidates || candidates.length === 0) {
      console.warn('候補ユーザー取得エラーまたは対象なし:', candidatesError);
      return false;
    }

    const receiverStats: { id: string; unreadCount: number }[] = [];

    for (const c of candidates) {
      const { count, error: countError } = await supabase
        .from('song_letters')
        .select('id', { count: 'exact', head: true })
        .eq('receiver_id', c.id)
        .in('status', ['delivered', 'replied'])
        .is('archived_at', null)
        .is('read_at', null);

      if (countError) {
        console.warn(`ユーザー ${c.id} の未読数取得エラー:`, countError);
        continue;
      }

      if ((count ?? 0) < maxInbox) {
        receiverStats.push({ id: c.id, unreadCount: count ?? 0 });
      }
    }

    if (receiverStats.length === 0) {
      console.log('未読上限を超えていないユーザーが見つからず、queued のままにします。');
      return false;
    }

    // 未読数が少ない順にソート
    receiverStats.sort((a, b) => a.unreadCount - b.unreadCount);

    const receiverId = receiverStats[0].id;

    const { error: updateError } = await supabase
      .from('song_letters')
      .update({
        receiver_id: receiverId,
        status: 'delivered',
        delivered_at: new Date().toISOString(),
      })
      .eq('id', letterId);

    if (updateError) {
      console.warn('配達失敗:', updateError);
      return false;
    }

    console.log(`未読数の少ないユーザー(${receiverId})に配達成功`);
    return true;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (limitCheckLoading) {
      setError('送信回数を確認しています。少し待ってから再度お試しください。');
      return;
    }

    if (limitExceeded) {
      setError(
        `本日の送信上限数(${maxDailyLetters}通)に達しました。また明日送りましょう！`
      );
      return;
    }

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
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tommorow = new Date(today);
      tommorow.setDate(tommorow.getDate() + 1);

      const { count: sentCount, error: sentcountError } = await supabase
        .from('song_letters')
        .select('id', { count: 'exact', head: true })
        .eq('sender_id', user.id)
        .gte('created_at', today.toISOString())
        .lt('created_at', tommorow.toISOString());

      if (sentcountError) {
        console.error(sentcountError);
        throw new Error('送信回数の確認に失敗しました。');
      }

      if ((sentCount ?? 0) >= maxDailyLetters) {
        throw new Error(
          `本日の送信上限数(${maxDailyLetters}通)に達しました。また明日送りましょう！`
        );
      }

      const { count: inboxCount, error: inboxError } = await supabase
        .from('song_letters')
        .select('id', { count: 'exact', head: true })
        .eq('receiver_id', user.id)
        .in('status', ['delivered', 'replied'])
        .is('archived_at', null)
        .is('read_at', null);

      if (inboxError) {
        console.error(inboxError);
        throw new Error('受信ボックスの確認に失敗しました。');
      }

      if ((inboxCount ?? 0) >= maxInboxLetters) {
        throw new Error(
          `受信ボックスの上限数(${maxInboxLetters}通)に達しているため、送信できません。`
        );
      }

      let songId: string | null = null;

      if (provider === 'spotify') {
        if (!selectedTrack) {
          setLoading(false);
          setError('Spotifyの検索結果から曲を1つ選択してください。');
          return;
        }

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
        // YouTube
        if (!ytInput.trim()) {
          setLoading(false);
          setError('YouTube の URL またはIDを入力してください。');
          return;
        }

        const videoId = ytMeta?.id ?? extractYouTubeId(ytInput);
        if (!videoId) {
          setLoading(false);
          setError('YouTube の URL / ID の形式を確認してください。');
          return;
        }

        const titleToUse =
          ytTitle.trim() || ytMeta?.title || 'YouTube video';

        const urlToUse = ytMeta?.url ?? ytInput.trim();
        const thumbnailToUse = ytMeta?.imageUrl || null;
        const durationMs = ytMeta?.durationSec != null ? ytMeta.durationSec * 1000 : null;

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
              title: titleToUse,
              url: urlToUse,
              thumbnail_url: thumbnailToUse,
              duration_ms: durationMs,
            })
            .select('id')
            .single();

          if (insertSongError || !insertedSong) {
            console.error(insertSongError);
            throw new Error('楽曲情報の保存に失敗しました。');
          }

          songId = insertedSong.id;
        }

        // YouTube の場合はチャンネルを artists テーブルに登録して songs_artists に紐づける
        try {
          const channelProviderId =
            (ytMeta && (ytMeta.channel_url ?? ytMeta.channelUrl)) || null;

          if (channelProviderId && songId) {
            let artistId: string | null = null;

            const { data: existingArtists, error: selectArtistError } =
              await supabase
                .from('artists')
                .select('id')
                .eq('provider', 'youtube')
                .eq('provider_artist_id', channelProviderId)
                .limit(1);

            if (selectArtistError) {
              console.error(selectArtistError);
              throw new Error('アーティスト情報の取得に失敗しました。');
            }

            if (existingArtists && existingArtists.length > 0) {
              artistId = existingArtists[0].id;
            } else {
              const { data: insertedArtist, error: insertArtistError } =
                await supabase
                  .from('artists')
                  .insert({
                    name: ytMeta?.channelTitle ?? 'YouTube Channel',
                    provider: 'youtube',
                    provider_artist_id: channelProviderId,
                  })
                  .select('id')
                  .single();

              if (insertArtistError || !insertedArtist) {
                console.error(insertArtistError);
                throw new Error('アーティスト情報の保存に失敗しました。');
              }

              artistId = insertedArtist.id;
            }

            if (artistId) {
              const rows = [
                {
                  song_id: songId,
                  artist_id: artistId,
                },
              ];

              const { error: saError } = await supabase
                .from('songs_artists')
                .insert(rows);

              if (saError) {
                console.warn('songs_artists 挿入エラー:', saError);
              }
            }
          }
        } catch (e) {
          // artist 周りで失敗しても致命的ではないので warn のみ
          console.warn('YouTube channel -> artist 処理でエラー:', e);
        }
      }

      if (!songId) {
        throw new Error('楽曲情報の保存に失敗しました。');
      }

      const { data: insertedLetter, error: insertLetterError } = await supabase
        .from('song_letters')
        .insert({
          sender_id: user.id,
          receiver_id: null,
          song_id: songId,
          sender_name: displayName,
          is_anonymous: isAnonymous,
          message,
          status: 'queued',
        })
        .select('id')
        .single();

      if (insertLetterError || !insertedLetter) {
        console.error(insertLetterError);
        throw new Error('ソングレターの送信に失敗しました。');
      }

      await assignRandomReceiver(insertedLetter.id, maxInboxLetters);

      navigate('/app', { replace: true });
    } catch (err: any) {
      console.error(err);
      setError(err.message ?? 'エラーが発生しました。');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div>
        <h1 className="mb-1">ソングレターを書く</h1>
        <p className="text-sm text-gray-600">
          誰かに曲とメッセージを届けましょう。Spotify検索から曲を選ぶか、YouTubeのURL/IDを入力できます。
        </p>
      </div>

      {/* 上限チェックの結果表示 */}
      {limitCheckLoading ? (
        <div className="rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm text-gray-600">
          今日送れるソングレターの残り回数を確認しています…
        </div>
      ) : limitExceeded ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">今日の送信上限に達しました</p>
            <p className="text-xs mt-1">
              本日は既に {sentToday} / {maxDailyLetters} 通送信済みです。明日また送ってみてください。
            </p>
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm text-gray-600">
          今日はあと <span style={{ color: '#8fcccc' }} className="font-medium">{maxDailyLetters - sentToday}</span> 通送信できます
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* 送り主の表示名 */}
        <div className="space-y-3">
          <label className="block text-sm text-gray-700">送り主の表示名</label>

          {profileLoading ? (
            <p className="text-sm text-gray-500">プロフィールを読み込み中…</p>
          ) : profileError ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
              {profileError}
            </div>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  className={`rounded-lg border px-4 py-3 text-sm text-left transition-all ${
                    !isAnonymous
                      ? 'border-[#8fcccc] bg-[#8fcccc]/5 shadow-sm'
                      : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}
                  onClick={() => setIsAnonymous(false)}
                  disabled={!profileName}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium">ユーザー名で送る</span>
                    <span
                      className={`h-5 w-5 rounded-full border-2 flex items-center justify-center ${
                        !isAnonymous ? 'border-[#8fcccc]' : 'border-gray-300'
                      }`}
                    >
                      {!isAnonymous && (
                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: '#8fcccc' }} />
                      )}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500">
                    表示名: {profileName ?? '（取得できませんでした）'}
                  </p>
                </button>

                <button
                  type="button"
                  className={`rounded-lg border px-4 py-3 text-sm text-left transition-all ${
                    isAnonymous
                      ? 'border-[#8fcccc] bg-[#8fcccc]/5 shadow-sm'
                      : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}
                  onClick={() => setIsAnonymous(true)}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium">匿名で送る</span>
                    <span
                      className={`h-5 w-5 rounded-full border-2 flex items-center justify-center ${
                        isAnonymous ? 'border-[#8fcccc]' : 'border-gray-300'
                      }`}
                    >
                      {isAnonymous && (
                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: '#8fcccc' }} />
                      )}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500">表示名: 匿名</p>
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                相手にはここで選んだ名前だけが表示されます
              </p>
            </>
          )}
        </div>

        {/* 曲のサービス選択 */}
        <div className="space-y-3">
          <label className="block text-sm text-gray-700">曲のサービスを選択</label>
          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              className={`rounded-lg border px-4 py-3 text-sm transition-all ${
                provider === 'spotify'
                  ? 'border-[#8fcccc] bg-[#8fcccc]/5 shadow-sm'
                  : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
              onClick={() => setProvider('spotify')}
            >
              <div className="flex items-center justify-between">
                <span className="font-medium">Spotify検索</span>
                <span
                  className={`h-5 w-5 rounded-full border-2 flex items-center justify-center ${
                    provider === 'spotify' ? 'border-[#8fcccc]' : 'border-gray-300'
                  }`}
                >
                  {provider === 'spotify' && (
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: '#8fcccc' }} />
                  )}
                </span>
              </div>
            </button>
            <button
              type="button"
              className={`rounded-lg border px-4 py-3 text-sm transition-all ${
                provider === 'youtube'
                  ? 'border-[#8fcccc] bg-[#8fcccc]/5 shadow-sm'
                  : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
              onClick={() => setProvider('youtube')}
            >
              <div className="flex items-center justify-between">
                <span className="font-medium">YouTube URL/ID</span>
                <span
                  className={`h-5 w-5 rounded-full border-2 flex items-center justify-center ${
                    provider === 'youtube' ? 'border-[#8fcccc]' : 'border-gray-300'
                  }`}
                >
                  {provider === 'youtube' && (
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: '#8fcccc' }} />
                  )}
                </span>
              </div>
            </button>
          </div>
        </div>

        {/* Spotify 検索 UI */}
        {provider === 'spotify' && (
          <div className="rounded-xl border border-gray-200 bg-white p-6 space-y-4">
            <h3 className="flex items-center gap-2">
              <Search className="w-5 h-5" style={{ color: '#8fcccc' }} />
              Spotifyで曲を検索
            </h3>

            <div className="flex gap-2">
              <input
                type="text"
                className="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm focus:border-[#8fcccc] focus:outline-none transition-colors"
                placeholder="曲名やアーティスト名で検索"
                value={spotifyQuery}
                onChange={(e) => setSpotifyQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleSpotifySearch();
                  }
                }}
              />
              <button
                type="button"
                onClick={handleSpotifySearch}
                disabled={spotifyLoading}
                className="rounded-lg px-5 py-2.5 text-sm transition-all disabled:opacity-50 text-white"
                style={{ backgroundColor: '#8fcccc' }}
              >
                {spotifyLoading ? '検索中…' : '検索'}
              </button>
            </div>

            {spotifyError && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                {spotifyError}
              </div>
            )}

            {spotifyResults.length > 0 && !selectedTrack && (
              <div className="space-y-3">
                <p className="text-sm text-gray-700 font-medium">
                  検索結果 ({spotifyResults.length}件)
                </p>
                
                <div className="grid gap-3 sm:grid-cols-2">
                  {spotifyResults.map((track) => (
                    <button
                      type="button"
                      key={track.id}
                      onClick={() => setSelectedTrack(track)}
                      className="rounded-lg border border-gray-200 bg-white hover:border-[#8fcccc] hover:shadow-md transition-all p-3 text-left"
                    >
                      <div className="flex gap-3">
                        {track.imageUrl ? (
                          <img
                            src={track.imageUrl}
                            alt={track.name}
                            className="w-16 h-16 rounded object-cover flex-shrink-0"
                          />
                        ) : (
                          <div className="w-16 h-16 rounded bg-gray-100 flex items-center justify-center flex-shrink-0">
                            <Music className="w-6 h-6 text-gray-300" />
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium line-clamp-1">{track.name}</p>
                          <p className="text-xs text-gray-500 line-clamp-1 mt-1">
                            {track.artists.map((a) => a.name).join(', ')}
                          </p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {selectedTrack && (
              <div className="rounded-lg border-2 p-4 space-y-3" style={{ borderColor: '#8fcccc', backgroundColor: '#8fcccc10' }}>
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-medium" style={{ color: '#8fcccc' }}>選択中の曲</p>
                  <button
                    type="button"
                    onClick={() => setSelectedTrack(null)}
                    className="text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex gap-4">
                  {selectedTrack.imageUrl && (
                    <img
                      src={selectedTrack.imageUrl}
                      alt={selectedTrack.name}
                      className="w-24 h-24 rounded-lg object-cover flex-shrink-0"
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-medium line-clamp-2">{selectedTrack.name}</p>
                    <p className="text-sm text-gray-600 line-clamp-1 mt-1">
                      {selectedTrack.artists.map((a) => a.name).join(', ')}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* YouTube 入力 UI */}
        {provider === 'youtube' && (
          <div className="rounded-xl border border-gray-200 bg-white p-6 space-y-4">
            <h3 className="flex items-center gap-2">
              <Music className="w-5 h-5" style={{ color: '#8fcccc' }} />
              YouTubeの動画情報
            </h3>

            <div>
              <label className="block text-sm text-gray-700 mb-2">YouTube URL または動画ID</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  className="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm focus:border-[#8fcccc] focus:outline-none transition-colors"
                  placeholder="例: https://www.youtube.com/watch?v=XXXXXXXXXXX"
                  value={ytInput}
                  onChange={(e) => {
                    setYtInput(e.target.value);
                    setYtMeta(null);
                  }}
                />
                <button
                  type="button"
                  onClick={handleFetchYouTubeMeta}
                  disabled={ytMetaLoading}
                  className="rounded-lg px-5 py-2.5 text-sm transition-all disabled:opacity-50 text-white"
                  style={{ backgroundColor: '#8fcccc' }}
                >
                  {ytMetaLoading ? '取得中…' : '情報取得'}
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                URLまたは動画IDからタイトルやサムネイルを自動取得します
              </p>
            </div>

            {ytMetaError && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                {ytMetaError}
              </div>
            )}

            {ytMeta && (
              <div className="rounded-lg border-2 p-4 space-y-3" style={{ borderColor: '#8fcccc', backgroundColor: '#8fcccc10' }}>
                <p className="text-sm font-medium" style={{ color: '#8fcccc' }}>取得した動画情報</p>
                
                {ytMeta.imageUrl && (
                  <img
                    src={ytMeta.imageUrl}
                    alt={ytMeta.title}
                    className="w-full aspect-video rounded-lg object-cover"
                  />
                )}
                <div>
                  <p className="font-medium line-clamp-2">{ytMeta.title}</p>
                  <p className="text-sm text-gray-600 mt-1">{ytMeta.channelTitle}</p>
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm text-gray-700 mb-2">動画タイトル（編集可能）</label>
              <input
                type="text"
                className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm focus:border-[#8fcccc] focus:outline-none transition-colors"
                placeholder="曲のタイトルを入力"
                value={ytTitle}
                onChange={(e) => setYtTitle(e.target.value)}
              />
              <p className="text-xs text-gray-500 mt-2">
                自動取得したタイトルを手動で編集できます
              </p>
            </div>
          </div>
        )}

        {/* メッセージ */}
        <div className="space-y-2">
          <label className="block text-sm text-gray-700">メッセージ</label>
          <textarea
            className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm min-h-[140px] focus:border-[#8fcccc] focus:outline-none transition-colors"
            placeholder="この曲に込めた気持ちや、伝えたいことを書いてみましょう。"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <p>{error}</p>
          </div>
        )}

        <button
          type="submit"
          disabled={
            loading ||
            profileLoading ||
            (!profileName && !isAnonymous) ||
            limitExceeded ||
            limitCheckLoading
          }
          className="w-full rounded-lg py-3 text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed text-white shadow-sm"
          style={{ backgroundColor: '#8fcccc' }}
        >
          {loading ? '送信中…' : 'ソングレターを投函する'}
        </button>
      </form>
    </div>
  );
};
