// src/pages/app/SentLettersPage.tsx
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../contexts/AuthContext';

type SentLetter = {
  id: string;
  receiver_id: string | null;
  sender_name: string;
  message: string;
  status: string;
  created_at: string;
};

export const SentLettersPage = () => {
  const { user } = useAuth();
  const [letters, setLetters] = useState<SentLetter[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const fetchSent = async () => {
      setLoading(true);

      const { data, error } = await supabase
        .from('song_letters')
        .select('id, receiver_id, sender_name, message, status, created_at')
        .eq('sender_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error(error);
        setLetters([]);
      } else {
        setLetters(data ?? []);
      }

      setLoading(false);
    };

    fetchSent();
  }, [user]);

  if (!user) return null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold mb-1">送信したソングレター</h1>
        <p className="text-sm text-slate-400">
          あなたがこれまでに送ったソングレターの一覧です。返信がついたレターには「返信あり」と表示されます。（今後さらに拡張予定）
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-slate-400">読み込み中…</p>
      ) : letters.length === 0 ? (
        <p className="text-sm text-slate-400">
          まだソングレターを送っていません。
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
                <div>
                  <p className="text-sm font-medium">
                    宛先:{' '}
                    <span className="text-slate-300">
                      {letter.receiver_id ? '誰かの受信ボックス' : 'まだ誰にも届いていません'}
                    </span>
                  </p>
                  <p className="text-xs text-slate-500">
                    {new Date(letter.created_at).toLocaleString('ja-JP')}
                  </p>
                </div>
                <span className="text-xs text-slate-400">
                  {letter.status === 'queued'
                    ? '配達待ち'
                    : letter.status === 'delivered'
                    ? '配達済み'
                    : letter.status === 'replied'
                    ? '返信あり'
                    : 'アーカイブ'}
                </span>
              </div>
              <p className="text-xs text-slate-500 mb-1">
                送り主として表示される名前: {letter.sender_name}
              </p>
              <p className="text-sm text-slate-200 line-clamp-2">
                {letter.message}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};
