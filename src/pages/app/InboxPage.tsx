import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../contexts/AuthContext';
import { Music, Clock, Check, Reply, Archive } from 'lucide-react';

type Letter = {
  id: string;
  sender_name: string;
  message: string;
  status: 'queued' | 'delivered' | 'replied' | 'archived';
  created_at: string;
  delivered_at: string | null;
  read_at: string | null;
  song_id: string;
};

type Song = {
  id: string;
  title: string;
  artist_name?: string;
  thumbnail_url?: string | null;
};

export const InboxPage = () => {
  const { user } = useAuth();
  const [letters, setLetters] = useState<Letter[]>([]);
  const [songs, setSongs] = useState<Record<string, Song>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [maxInboxLetters, setMaxInboxLetters] = useState<number>(10);

  useEffect(() => {
    if (!user) return;

    const fetchInbox = async () => {
      setLoading(true);
      setError(null);

      // 1. app_settings から max_inbox_letters を取得
      const { data: settings, error: settingsError } = await supabase
        .from('app_settings')
        .select('key, value_int');

      if (settingsError) {
        console.warn('app_settings 読み込みエラー:', settingsError);
      } else if (settings) {
        const inboxSetting = settings.find(
          (s) => s.key === 'max_inbox_letters' && s.value_int != null
        );
        if (inboxSetting) {
          setMaxInboxLetters(inboxSetting.value_int as number);
        }
      }

      // 2. 自分宛て & アーカイブされていないレターを取得
      const { data, error: inboxError } = await supabase
        .from('song_letters')
        .select(
          'id, sender_name, message, status, created_at, delivered_at, read_at, archived_at, song_id'
        )
        .eq('receiver_id', user.id)
        .is('archived_at', null)
        .order('delivered_at', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false });

      if (inboxError) {
        console.error(inboxError);
        setError('受信ボックスの読み込みに失敗しました。');
        setLetters([]);
      } else {
        const mapped: Letter[] =
          (data as any[])?.map((row) => ({
            id: row.id as string,
            sender_name: row.sender_name as string,
            message: row.message as string,
            status: row.status as Letter['status'],
            created_at: row.created_at as string,
            delivered_at: row.delivered_at ?? null,
            read_at: row.read_at ?? null,
            song_id: row.song_id as string,
          })) ?? [];
        setLetters(mapped);

        // 3. 楽曲情報を取得
        const songIds = [...new Set(mapped.map((l) => l.song_id))];
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

    fetchInbox();
  }, [user]);

  if (!user) return null;

  const handleArchive = async (
    e: React.MouseEvent<HTMLButtonElement>,
    letterId: string
  ) => {
    e.preventDefault();
    e.stopPropagation();

    const { error } = await supabase
      .from('song_letters')
      .update({ archived_at: new Date().toISOString() })
      .eq('id', letterId);

    if (error) {
      console.error(error);
      alert('アーカイブに失敗しました。時間をおいて再度お試しください。');
      return;
    }

    setLetters((prev) => prev.filter((l) => l.id !== letterId));
  };

  const unreadCount = letters.filter((l) => !l.read_at).length;

  const getStatusBadge = (letter: Letter) => {
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
    if (letter.status === 'delivered' && !letter.read_at) {
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
        <h1 className="mb-1">受信ボックス</h1>
        <p className="text-sm text-gray-600">
          あなたに届いたソングレターの一覧です。
        </p>
        <p className="mt-2 text-xs text-gray-500">
          未読受信枠: {unreadCount} / {maxInboxLetters}
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-gray-400">読み込み中…</p>
      ) : error ? (
        <p className="text-sm text-red-500">{error}</p>
      ) : letters.length === 0 ? (
        <div className="text-center py-12">
          <Music className="w-16 h-16 mx-auto mb-4 text-gray-300" />
          <p className="text-sm text-gray-500">
            まだソングレターは届いていません。
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {letters.map((letter) => {
            const deliveredAt = letter.delivered_at ?? letter.created_at;
            const deliveredDate = new Date(deliveredAt);
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
                      {deliveredDate.toLocaleDateString('ja-JP', {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </span>
                    <span className="truncate max-w-[120px]">
                      from {letter.sender_name}
                    </span>
                  </div>

                  <p className="text-xs text-gray-600 line-clamp-2">
                    {letter.message}
                  </p>

                  {/* Archive Button */}
                  <button
                    type="button"
                    onClick={(e) => handleArchive(e, letter.id)}
                    className="w-full mt-2 flex items-center justify-center gap-1 rounded-md border border-gray-300 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50 transition-colors"
                  >
                    <Archive className="w-3 h-3" />
                    アーカイブ
                  </button>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
};