// src/pages/app/InboxPage.tsx
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../contexts/AuthContext';

type Letter = {
  id: string;
  sender_name: string;
  message: string;
  status: 'queued' | 'delivered' | 'replied' | 'archived';
  created_at: string;
  delivered_at: string | null;
  read_at: string | null;
};

export const InboxPage = () => {
  const { user } = useAuth();
  const [letters, setLetters] = useState<Letter[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 受信枠上限（app_settings から取得）
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
          'id, sender_name, message, status, created_at, delivered_at, read_at, archived_at'
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
          })) ?? [];
        setLetters(mapped);
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
    // Link への遷移を止める
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

    // ローカル状態から削除して即反映
    setLetters((prev) => prev.filter((l) => l.id !== letterId));
  };

  const unreadCount = letters.filter((l) => !l.read_at).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold mb-1">受信ボックス</h1>
        <p className="text-sm text-slate-400">
          あなたに届いたソングレターの一覧です。開封すると既読になり、いらなくなったレターはアーカイブできます。
        </p>
        <p className="mt-2 text-xs text-slate-500">
          未読受信枠: {unreadCount} / {maxInboxLetters}
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-slate-400">読み込み中…</p>
      ) : error ? (
        <p className="text-sm text-red-400">{error}</p>
      ) : letters.length === 0 ? (
        <p className="text-sm text-slate-400">
          まだソングレターは届いていません。
        </p>
      ) : (
        <div className="space-y-3">
          {letters.map((letter) => {
            const deliveredAt = letter.delivered_at ?? letter.created_at;
            const deliveredText = new Date(deliveredAt).toLocaleString('ja-JP');
            const isUnread =
              letter.status === 'delivered' && !letter.read_at;

            return (
              <Link
                key={letter.id}
                to={`/letters/${letter.id}`}
                className="block rounded-xl border border-slate-800 bg-slate-900/60 p-4 hover:border-sky-500/60 transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-sm font-medium">
                        {letter.sender_name}{' '}
                        <span className="text-xs text-slate-500">
                          ({deliveredText})
                        </span>
                      </p>
                      {isUnread && (
                        <span className="inline-flex items-center rounded-full bg-sky-500/20 px-2 py-0.5 text-[10px] font-semibold text-sky-300">
                          未読
                        </span>
                      )}
                      {letter.status === 'replied' && (
                        <span className="inline-flex items-center rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
                          返信済
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-slate-200 line-clamp-2">
                      {letter.message}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => handleArchive(e, letter.id)}
                    className="rounded-md border border-slate-700 px-2 py-1 text-[11px] text-slate-300 hover:bg-slate-800"
                  >
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
