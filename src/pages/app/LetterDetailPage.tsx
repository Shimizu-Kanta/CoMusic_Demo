// src/pages/app/LetterDetailPage.tsx
import { FormEvent, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../contexts/AuthContext';

type Letter = {
  id: string;
  sender_id: string;
  receiver_id: string | null;
  song_id: string;
  sender_name: string;
  is_anonymous: boolean;
  message: string;
  status: string;
  created_at: string;
};

type Song = {
  id: string;
  provider: 'spotify' | 'youtube';
  provider_track_id: string;
  title: string;
  url: string | null;
};

type Reply = {
  id: string;
  content: string;
  created_at: string;
};

export const LetterDetailPage = () => {
  const { user } = useAuth();
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
    };

    fetchData();
  }, [id]);

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

      // 初回返信なら、ステータスを replied に更新
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

  if (!user) {
    return (
      <p className="text-sm text-slate-400">
        ログインしてからこのページを表示してください。
      </p>
    );
  }

  if (loading) {
    return <p className="text-sm text-slate-400">読み込み中…</p>;
  }

  if (error || !letter) {
    return (
      <p className="text-sm text-red-400">
        {error ?? 'ソングレターの読み込み中にエラーが発生しました。'}
      </p>
    );
  }

  const isSender = letter.sender_id === user.id;
  const isReceiver = letter.receiver_id === user.id;

  // 送り主でも受信者でもない場合は見せない
  if (!isSender && !isReceiver) {
    return (
      <p className="text-sm text-red-400">
        このソングレターを閲覧する権限がありません。
      </p>
    );
  }

  const createdAt = new Date(letter.created_at).toLocaleString('ja-JP');

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
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-xl font-semibold mb-1">{heading}</h1>
        <p className="text-xs text-slate-400">{createdAt} のレター</p>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">{letter.sender_name}</p>
          <span className="text-xs text-slate-400">
            {letter.is_anonymous ? '匿名レター' : 'アカウント由来のレター'}
          </span>
        </div>

        {song && (
          <div className="rounded-md border border-slate-700 bg-slate-950/60 p-3 text-sm space-y-1">
            <p className="text-xs text-slate-400">曲</p>
            <p className="font-medium">{song.title}</p>
            {songLink && (
              <a
                href={songLink}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-sky-400 hover:underline"
              >
                {song.provider === 'spotify' ? 'Spotifyで開く' : 'YouTubeで開く'}
              </a>
            )}
          </div>
        )}

        <div>
          <p className="text-xs text-slate-400 mb-1">メッセージ</p>
          <p className="text-sm whitespace-pre-wrap">{letter.message}</p>
        </div>
      </div>

      <div className="space-y-3">
        <h2 className="text-sm font-semibold">感想・返信</h2>

        {replies.length === 0 ? (
          <p className="text-xs text-slate-400">まだ返信はありません。</p>
        ) : (
          <div className="space-y-2">
            {replies.map((r) => (
              <div
                key={r.id}
                className="rounded-lg border border-slate-800 bg-slate-900/60 p-3"
              >
                <p className="text-xs text-slate-400 mb-1">
                  {new Date(r.created_at).toLocaleString('ja-JP')}
                </p>
                <p className="text-sm whitespace-pre-wrap">{r.content}</p>
              </div>
            ))}
          </div>
        )}

        {/* 返信フォーム：受信者だけ表示 */}
        {isReceiver && (
          <form onSubmit={handleReplySubmit} className="space-y-2">
            <textarea
              className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm min-h-[80px]"
              placeholder="このレターへの感想やお礼を書いてみましょう。（任意）"
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
            />
            {error && (
              <p className="text-xs text-red-400 bg-red-950/40 border border-red-900 rounded-md px-3 py-2">
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={sendingReply || !replyText.trim()}
              className="rounded-md bg-sky-500 px-4 py-2 text-sm font-medium text-white hover:bg-sky-400 disabled:opacity-50"
            >
              {sendingReply ? '送信中…' : '感想を送る'}
            </button>
          </form>
        )}

        {/* 送り主のときの説明 */}
        {isSender && (
          <p className="text-xs text-slate-500">
            これはあなたが送ったソングレターです。ここで相手からの感想を読むことができます。
            （送り主からの追いメッセージ機能は今後拡張しても良さそうです）
          </p>
        )}
      </div>
    </div>
  );
};
