"use client";
import { Bell } from 'lucide-react';

export default function Header() {
  return (
    <header className="fixed top-0 left-0 right-0 h-14 bg-white border-b border-gray-200 flex items-center justify-between px-4 z-50">
      <h1 className="text-lg font-bold text-gray-800">通学ナビ</h1>
      <button 
        className="p-2 text-gray-600 hover:text-blue-600 focus:outline-none transition-colors rounded-full hover:bg-gray-100"
        onClick={() => {
          if ('Notification' in window) {
            Notification.requestPermission().then(permission => {
              if (permission === 'granted') {
                new Notification('通知設定', { body: '出発時間の通知が有効になりました' });
              }
            });
          } else {
            alert('お使いのブラウザは通知に対応していません。');
          }
        }}
      >
        <Bell size={20} />
      </button>
    </header>
  );
}
