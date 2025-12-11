import { FormEvent, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../contexts/AuthContext';
import { Music, ExternalLink, Archive, Send, User } from 'lucide-react';

type Letter = {
  id: string;
  sender_id: string;
  receiver_id: string | null;
  song_id: string;
  sender_name: string;
  is_anonymous: boolean;
  message: string;
  status: 'queued' | 'delivered' | 'replied' | 'archived';
  created_at: string;
  delivered_at: string | null;
  read_at: string | null;
  archived_at: string | null;
};

type Song = {
  id: string;
  provider: 'spotify' | 'youtube';
  provider_track_id: string;
  title: string;
  artist_name?: string;
  url: string | null;
  thumbnail_url?: string | null;
};

type Reply = {
  id: string;
  content: string;
  created_at: string;
};

export const LetterDetailPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();

  const [letter, setLetter] = useState<Letter | null>(null);
  const [song, setSong] = useState<Song | null>(null);
  const [replies, setReplies] = useState<Reply[]>([]);
  const [replyText, setReplyText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sendingReply, setSendingReply] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;

    const fetchData = async () => {
      setLoading(true);
      setError(null);

      // 1. レター本体
      const { data: letterData, error: letterError } = await supabase
        .from('song_letters')
        .select('*')
        .eq('id', id)
        .single<Letter>();

      if (letterError || !letterData) {
        console.error(letterError);
        setError('ソングレターが見つかりませんでした。');
        setLoading(false);
        return;
      }

      setLetter(letterData);

      // 2. 楽曲情報
      const { data: songData, error: songError } = await supabase
        .from('songs')
        .select('*')
        .eq('id', letterData.song_id)
        .single<Song>();

      if (songError) {
        console.error(songError);
      } else {
        setSong(songData);
      }

      // 3. 返信一覧
      const { data: repliesData, error: repliesError } = await supabase
        .from('song_letter_replies')
        .select('id, content, created_at')
        .eq('letter_id', id)
        .order('created_at', { ascending: true });

      if (repliesError) {
        console.error(repliesError);
      } else {
        setReplies(repliesData ?? []);
      }

      setLoading(false);

      // 4. 受信者が初めて開いた場合は既読にする
      if (
        user &&
        letterData.receiver_id === user.id &&
        !letterData.read_at
      ) {
        const now = new Date().toISOString();
        const { error: readError } = await supabase
          .from('song_letters')
          .update({ read_at: now })
          .eq('id', letterData.id);

        if (readError) {
          console.warn('read_at 更新エラー:', readError);
        } else {
          setLetter((prev) =>
            prev ? { ...prev, read_at: now, status: prev.status } : prev
          );
        }
      }
    };

    fetchData();
  }, [id, user]);

  const handleReplySubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!user || !id || !replyText.trim() || !letter) return;

    const isReceiver = letter.receiver_id === user.id;

    if (!isReceiver) {
      setError('このレターに返信できるのは、受信したユーザーだけです。');
      return;
    }

    setSendingReply(true);
    setError(null);

    try {
      const { data, error: insertError } = await supabase
        .from('song_letter_replies')
        .insert({
          letter_id: id,
          replier_id: user.id,
          content: replyText.trim(),
        })
        .select('id, content, created_at')
        .single<Reply>();

      if (insertError || !data) {
        console.error(insertError);
        throw new Error('返信の送信に失敗しました。');
      }

      setReplies((prev) => [...prev, data]);
      setReplyText('');

      if (letter.status !== 'replied') {
        await supabase
          .from('song_letters')
          .update({ status: 'replied' })
          .eq('id', letter.id);

        setLetter({ ...letter, status: 'replied' });
      }
    } catch (e: any) {
      setError(e.message ?? 'エラーが発生しました。');
    } finally {
      setSendingReply(false);
    }
  };

  const handleArchive = async () => {
    if (!letter) return;

    const { error } = await supabase
      .from('song_letters')
      .update({ archived_at: new Date().toISOString() })
      .eq('id', letter.id);

    if (error) {
      console.error(error);
      alert('アーカイブに失敗しました。時間をおいて再度お試しください。');
      return;
    }

    navigate('/letters/inbox', { replace: true });
  };

  if (!user) {
    return (
      <p className="text-sm text-gray-500">
        ログインしてからこのページを表示してください。
      </p>
    );
  }

  if (loading) {
    return <p className="text-sm text-gray-500">読み込み中…</p>;
  }

  if (error || !letter) {
    return (
      <p className="text-sm text-red-500">
        {error ?? 'ソングレターの読み込み中にエラーが発生しました。'}
      </p>
    );
  }

  const isSender = letter.sender_id === user.id;
  const isReceiver = letter.receiver_id === user.id;

  if (!isSender && !isReceiver) {
    return (
      <p className="text-sm text-red-500">
        このソングレターを閲覧する権限がありません。
      </p>
    );
  }

  const baseTime = letter.delivered_at ?? letter.created_at;
  const createdAt = new Date(baseTime).toLocaleString('ja-JP');

  const songLink =
    song?.url ??
    (song
      ? song.provider === 'spotify'
        ? `https://open.spotify.com/track/${song.provider_track_id}`
        : `https://youtu.be/${song.provider_track_id}`
      : null);

  const heading = isReceiver
    ? 'あなた宛に届いたソングレター'
    : 'あなたが送ったソングレター';

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="mb-1">{heading}</h1>
          <p className="text-xs text-gray-500">{createdAt}</p>
          {letter.read_at && isReceiver && (
            <p className="text-xs text-gray-400 mt-1">
              既読: {new Date(letter.read_at).toLocaleString('ja-JP')}
            </p>
          )}
        </div>

        {isReceiver && !letter.archived_at && (
          <button
            type="button"
            onClick={handleArchive}
            className="flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-2 text-xs text-gray-600 hover:bg-gray-50 transition-colors"
          >
            <Archive className="w-4 h-4" />
            アーカイブ
          </button>
        )}
      </div>

      {/* Letter Content */}
      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm">
        {/* Song Info with Album Art */}
        {song && (
          <div className="md:flex">
            {/* Album Art */}
            <div className="md:w-64 aspect-square md:aspect-auto bg-gray-100 relative overflow-hidden flex-shrink-0">
              {song.thumbnail_url ? (
                <img
                  src={song.thumbnail_url}
                  alt={song.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Music className="w-24 h-24 text-gray-300" />
                </div>
              )}
            </div>

            {/* Song Details */}
            <div className="flex-1 p-6 space-y-4">
              <div>
                <p className="text-xs text-gray-500 mb-1">楽曲</p>
                <h2 className="text-xl mb-1">{song.title}</h2>
                {song.artist_name && (
                  <p className="text-sm text-gray-600">{song.artist_name}</p>
                )}
              </div>

              {songLink && (
                <a
                  href={songLink}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm transition-colors text-white"
                  style={{ backgroundColor: '#8fcccc' }}
                >
                  <ExternalLink className="w-4 h-4" />
                  {song.provider === 'spotify' ? 'Spotifyで開く' : 'YouTubeで開く'}
                </a>
              )}
            </div>
          </div>
        )}

        {/* Sender Info */}
        <div className="border-t border-gray-200 p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#8fcccc]/10 flex items-center justify-center">
              <User className="w-5 h-5" style={{ color: '#8fcccc' }} />
            </div>
            <div>
              <p className="text-sm text-gray-600">差出人</p>
              <p className="font-medium">{letter.sender_name}</p>
            </div>
          </div>

          {/* Message */}
          <div>
            <p className="text-xs text-gray-500 mb-2">メッセージ</p>
            <p className="text-sm whitespace-pre-wrap leading-relaxed text-gray-700">
              {letter.message}
            </p>
          </div>
        </div>
      </div>

      {/* Replies Section */}
      <div className="space-y-4">
        <h2 className="flex items-center gap-2">
          <Send className="w-5 h-5" style={{ color: '#8fcccc' }} />
          感想・返信
        </h2>

        {replies.length === 0 ? (
          <p className="text-xs text-gray-500 px-4 py-3 bg-gray-50 rounded-lg border border-gray-200">
            まだ返信はありません。
          </p>
        ) : (
          <div className="space-y-3">
            {replies.map((r) => (
              <div
                key={r.id}
                className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
              >
                <p className="text-xs text-gray-500 mb-2">
                  {new Date(r.created_at).toLocaleString('ja-JP')}
                </p>
                <p className="text-sm whitespace-pre-wrap leading-relaxed text-gray-700">{r.content}</p>
              </div>
            ))}
          </div>
        )}

        {/* Reply Form: 受信者だけ */}
        {isReceiver && (
          <form onSubmit={handleReplySubmit} className="space-y-3">
            <textarea
              className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm min-h-[120px] focus:border-[#8fcccc] focus:outline-none transition-colors"
              placeholder="このレターへの感想やお礼を書いてみましょう（任意）"
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
            />
            {error && (
              <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={sendingReply || !replyText.trim()}
              className="flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed text-white"
              style={{ backgroundColor: '#8fcccc' }}
            >
              <Send className="w-4 h-4" />
              {sendingReply ? '送信中…' : '感想を送る'}
            </button>
          </form>
        )}

        {/* 送り主向け説明 */}
        {isSender && (
          <p className="text-xs text-gray-500 px-4 py-3 bg-gray-50 rounded-lg border border-gray-200">
            これはあなたが送ったソングレターです。ここで相手からの感想を読むことができます。
          </p>
        )}
      </div>
    </div>
  );
};