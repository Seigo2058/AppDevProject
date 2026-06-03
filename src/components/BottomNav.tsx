"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Map, Calendar, Clock } from 'lucide-react';

export default function BottomNav() {
  const pathname = usePathname();

  const navItems = [
    { href: '/', label: 'ホーム', icon: Home },
    { href: '/schedule', label: 'コマ確認', icon: Calendar },
    { href: '/routes', label: 'ルート', icon: Map },
    { href: '/timetable', label: '時刻表', icon: Clock },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 h-16 bg-white border-t border-gray-200 flex justify-around items-center z-50 pb-safe shadow-[0_-2px_10px_rgba(0,0,0,0.05)]">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex flex-col items-center justify-center w-full h-full space-y-1 ${
              isActive ? 'text-lime-600' : 'text-gray-400 hover:text-gray-900'
            }`}
          >
            <Icon size={24} className={isActive ? 'fill-lime-50 stroke-lime-600' : ''} />
            <span className={`text-[10px] ${isActive ? 'font-bold' : 'font-medium'}`}>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
