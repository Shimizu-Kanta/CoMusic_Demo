import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../contexts/AuthContext';
import { Music, Clock, Check, Reply, Send as SendIcon } from 'lucide-react';

type SentLetter = {
  id: string;
  receiver_id: string | null;
  sender_name: string;
  message: string;
  status: string;
  created_at: string;
  delivered_at: string | null;
  song_id: string;
};

type Song = {
  id: string;
  title: string;
  artist_name?: string;
  thumbnail_url?: string | null;
};

export const SentLettersPage = () => {
  const { user } = useAuth();
  const [letters, setLetters] = useState<SentLetter[]>([]);
  const [songs, setSongs] = useState<Record<string, Song>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const fetchSent = async () => {
      setLoading(true);

      const { data, error } = await supabase
        .from('song_letters')
        .select('id, receiver_id, sender_name, message, status, created_at, delivered_at, song_id')
        .eq('sender_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error(error);
        setLetters([]);
      } else {
        setLetters(data ?? []);

        // 楽曲情報を取得
        const songIds = [...new Set((data ?? []).map((l: any) => l.song_id))];
        if (songIds.length > 0) {
          const { data: songsData } = await supabase
            .from('songs')
            .select('id, title, artist_name, thumbnail_url')
            .in('id', songIds);

          if (songsData) {
            const songsMap: Record<string, Song> = {};
            songsData.forEach((s: any) => {
              songsMap[s.id] = s;
            });
            setSongs(songsMap);
          }
        }
      }

      setLoading(false);
    };

    fetchSent();
  }, [user]);

  if (!user) return null;

  const getStatusBadge = (letter: SentLetter) => {
    if (letter.status === 'queued') {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700">
          <Clock className="w-3 h-3" />
          配達待ち
        </span>
      );
    }
    if (letter.status === 'replied') {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700">
          <Reply className="w-3 h-3" />
          返信済み
        </span>
      );
    }
    if (letter.status === 'delivered') {
      return (
        <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs shadow-sm" style={{ backgroundColor: '#8fcccc', color: 'white' }}>
          <Check className="w-3 h-3" />
          配達済み
        </span>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="mb-1">送信したソングレター</h1>
        <p className="text-sm text-gray-600">
          あなたがこれまでに送ったソングレターの一覧です。
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-gray-400">読み込み中…</p>
      ) : letters.length === 0 ? (
        <div className="text-center py-12">
          <SendIcon className="w-16 h-16 mx-auto mb-4 text-gray-300" />
          <p className="text-sm text-gray-500">
            まだソングレターを送っていません。
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {letters.map((letter) => {
            const createdDate = new Date(letter.created_at);
            const song = songs[letter.song_id];

            return (
              <Link
                key={letter.id}
                to={`/letters/${letter.id}`}
                className="group relative rounded-xl border border-gray-200 bg-white overflow-hidden hover:border-[#8fcccc] transition-all hover:shadow-lg"
              >
                {/* Album Art */}
                <div className="aspect-square bg-gray-100 relative overflow-hidden">
                  {song?.thumbnail_url ? (
                    <img
                      src={song.thumbnail_url}
                      alt={song.title || 'Album art'}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Music className="w-16 h-16 text-gray-300" />
                    </div>
                  )}
                  
                  {/* Status Badge */}
                  <div className="absolute top-3 right-3">
                    {getStatusBadge(letter)}
                  </div>
                </div>

                {/* Content */}
                <div className="p-4 space-y-2">
                  <div>
                    <p className="font-medium text-sm line-clamp-1">
                      {song?.title || '楽曲情報なし'}
                    </p>
                    {song?.artist_name && (
                      <p className="text-xs text-gray-500 line-clamp-1">
                        {song.artist_name}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {createdDate.toLocaleDateString('ja-JP', {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </span>
                    <span className="truncate max-w-[120px]">
                      to {letter.receiver_id ? '送信済み' : '未配達'}
                    </span>
                  </div>

                  <p className="text-xs text-gray-600 line-clamp-2">
                    {letter.message}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
};