// src/pages/app/InboxPage.tsx
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../contexts/AuthContext';

type Letter = {
  id: string;
  sender_name: string;
  message: string;
  status: string;
  created_at: string;
};

export const InboxPage = () => {
  const { user } = useAuth();
  const [letters, setLetters] = useState<Letter[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const fetchInbox = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('song_letters')
        .select('id, sender_name, message, status, created_at')
        .eq('receiver_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error(error);
        setLetters([]);
      } else {
        setLetters(data ?? []);
      }

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
