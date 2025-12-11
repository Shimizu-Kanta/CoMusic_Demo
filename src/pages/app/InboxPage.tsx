import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../contexts/AuthContext';
import { Music, Clock, Check, Reply, Mail, Send as SendIcon } from 'lucide-react';

type SentLetter = {
  id: string;
  receiver_id: string | null;
  sender_name: string;
  message: string;
  status: string;
  created_at: string;
  delivered_at: string | null;
  song_id: string;
  is_anonymous: boolean;
  read_at: string | null;
};

type Song = {
  id: string;
  title: string;
  artist_name?: string;
  thumbnail_url?: string | null;
};

export const InboxPage = () => {
  const { user } = useAuth();
  const [letters, setLetters] = useState<SentLetter[]>([]);
  const [songs, setSongs] = useState<Record<string, Song>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const fetchSent = async () => {
      setLoading(true);

      const { data: lettersData, error: lettersError } = await supabase
        .from('song_letters')
        .select(`
        id, sender_name, message, status, created_at, song_id, is_anonymous, read_at,
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

    fetchSent();
  }, [user]);

  if (!user) return null;

  const getStatusBadge = (letter: SentLetter) => {
    if (letter.status === 'replied') {
      return (
        <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs shadow-sm" style={{ backgroundColor: '#8fcccc', color: 'white' }}>
          <Reply className="w-3 h-3" />
          返信済み
        </span>
      );
    }
    if (letter.status === 'delivered') {
      if (!letter.read_at) {
        return (
          <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs shadow-sm" style={{ backgroundColor: '#88aaff', color: 'white' }}>
            <Mail className="w-3 h-3" />
            未読
          </span>
        );
      } else {
        return (
          <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs shadow-sm" style={{ backgroundColor: '#8fcccc', color: 'white' }}>
            <Check className="w-3 h-3" />
            受け取り済み
          </span>
        );
      }
    }
    return null;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="mb-1">受信したソングレター</h1>
        <p className="text-sm text-gray-600">
          あなたがこれまでに受け取ったソングレターの一覧です。
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-gray-400">読み込み中…</p>
      ) : letters.length === 0 ? (
        <div className="text-center py-12">
          <SendIcon className="w-16 h-16 mx-auto mb-4 text-gray-300" />
          <p className="text-sm text-gray-500">
            まだソングレターを受け取っていません。
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
                  {letter.song?.thumbnail_url ? (
                    <img
                      src={letter.song.thumbnail_url}
                      alt={letter.song.title || 'Album art'}
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
                      {letter.song?.title || '楽曲情報なし'}
                    </p>
                    {Array.isArray(letter.song?.songs_artists) && letter.song.songs_artists.length > 0 && (
                      <p className="text-xs text-gray-500 line-clamp-1">
                        {letter.song.songs_artists.map((sa: any) => sa.artist?.name).filter(Boolean).join(', ')}
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
                      from {letter.is_anonymous ? '匿名' : letter.sender_name}
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