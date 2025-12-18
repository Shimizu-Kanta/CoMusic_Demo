import React, { useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Mail } from 'lucide-react';

export default function Modal({
  isOpenModal,
  setIsOpenModal,
}: {
  isOpenModal: boolean;
  setIsOpenModal: React.Dispatch<React.SetStateAction<boolean>>;
}) {
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        setIsOpenModal(false);
      }
    };

    if (isOpenModal) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpenModal, setIsOpenModal]);

  useEffect(() => {
    if (isOpenModal) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body. style.overflow = '';
    };
  }, [isOpenModal]);

  if (!isOpenModal) return null;

  return createPortal(
    <div 
      style={{ 
        position: 'fixed',
        top: 0,
        left:  0,
        right: 0,
        bottom: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
      }}
      onClick={() => setIsOpenModal(false)}
    >
      <div 
        ref={modalRef} className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-xl font-bold mb-4">チュートリアル</h2>
        <h3 className="text-lg font-semibold mb-2">
            <Mail className="inline mr-2" />
            ソングレター
        </h3>
        <p className="mb-4">
            ソングレターは、音楽とあなたの気持ちを届ける手紙です。<br/>
            Spotifyにある楽曲か、YouTubeの動画を選んで、メッセージを添えて送ることができます。<br/>
            受け取った相手は、あなたの選んだ音楽とメッセージを一緒に楽しむことができます。<br/>
            受け取った楽曲が気に入った場合には、その気持ちを返信することができます。
        </p>
        <button
          onClick={() => setIsOpenModal(false)}
          className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover: bg-blue-600 transition-colors"
        >
          閉じる
        </button>
      </div>
    </div>,
    document.body
  );
}