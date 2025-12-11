import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../contexts/AuthContext';

export const InboxPage = () => {
  const { user } = useAuth();
  const [letters, setLetters] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const fetchInbox = async () => {
      setLoading(true);

      const { data: lettersData, error: lettersError } = await supabase
        .from('song_letters')
        .select(`
        id, sender_name, message, status, created_at, song_id,
        song:song_id (id, title, thumbnail_url, songs_artists (artist:artist_id (name)))
        `)
        .eq('receiver_id', user.id)
        .order('created_at', { ascending: false });

      if (lettersError || !lettersData) {
        console.error(lettersError);
        setLetters([]);
        setLoading(false);
        return;
      }
      setLetters(lettersData);
      setLoading(false);
    };

    fetchInbox();
  }, [user]);

  if (!user) return null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold mb-1">受信ボックス</h1>
        <p className="text-sm text-slate-400">
          あなたに届いたソングレターの一覧です。
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-slate-400">読み込み中…</p>
      ) : letters.length === 0 ? (
        <p className="text-sm text-slate-400">
          まだソングレターは届いていません。
        </p>
      ) : (
        <div className="space-y-3">
          {letters.map((letter) => (
            <Link
              key={letter.id}
              to={`/letters/${letter.id}`}
              className="block rounded-xl border border-slate-800 bg-slate-900/60 p-4 hover:border-sky-500/60 transition-colors"
            >
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium">
                  {letter.sender_name}{' '}
                  <span className="text-xs text-slate-500">
                    ({new Date(letter.created_at).toLocaleString('ja-JP')})
                  </span>
                </p>
                <span className="text-xs text-slate-400">
                  {letter.status === 'queued'
                    ? '配達待ち'
                    : letter.status === 'delivered'
                    ? '受信中'
                    : letter.status === 'replied'
                    ? '返信済み'
                    : 'アーカイブ'}
                </span>
              </div>
              <div className="flex flex-row gap-3 items-start">
                {letter.song?.thumbnail_url && (
                  <img
                    src={letter.song.thumbnail_url}
                    alt={letter.song.title}
                    className="rounded object-cover w-24 h-24 flex-shrink-0"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">
                    {letter.song?.title || '（曲情報なし）'}
                  </p>
                  <p className="text-xs text-slate-400 mb-2 truncate">
                    {letter.song?.songs_artists
                      .map((sa: any) => sa.artist.name)
                      .join(', ') || '（アーティスト情報なし）'}
                  </p>
                  <p className="text-sm text-slate-200 line-clamp-2">
                    {letter.message}
                  </p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};
