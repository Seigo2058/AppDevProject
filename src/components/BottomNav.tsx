"use client";

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect } from 'react';
import { Home, Map, Calendar, Clock } from 'lucide-react';

const navItems = [
  { href: '/', label: 'ホーム', icon: Home },
  { href: '/schedule', label: '時間割', icon: Calendar },
  { href: '/routes', label: 'ルート', icon: Map },
  { href: '/timetable', label: '時刻表', icon: Clock },
];

// タブごとに「最後に開いていたURL」を覚えるキー
const LAST_URL_KEY = 'tab_last_url';

/** パスがどのタブに属するかを返す（/timetable/view → /timetable）。 */
function sectionOf(pathname: string): string {
  const matched = navItems
    .filter((item) => item.href !== '/')
    .find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`));
  return matched ? matched.href : '/';
}

function readLastUrl(section: string): string | null {
  try {
    const saved = JSON.parse(sessionStorage.getItem(LAST_URL_KEY) ?? '{}');
    return typeof saved[section] === 'string' ? saved[section] : null;
  } catch {
    return null;
  }
}

export default function BottomNav() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const currentSection = sectionOf(pathname);

  // 現在地をタブごとに記録する。別のタブへ移動して戻ってきたとき、
  // ここに保存したURL（検索結果や詳細画面）へ戻せるようにする。
  useEffect(() => {
    const query = searchParams.toString();
    const url = query ? `${pathname}?${query}` : pathname;
    try {
      const saved = JSON.parse(sessionStorage.getItem(LAST_URL_KEY) ?? '{}');
      sessionStorage.setItem(LAST_URL_KEY, JSON.stringify({ ...saved, [currentSection]: url }));
    } catch {
      // sessionStorageが使えない環境では記憶しないだけで、遷移自体は動く
    }
  }, [pathname, searchParams, currentSection]);

  return (
    <nav className="shrink-0 min-h-16 bg-white border-t border-gray-200 flex justify-around items-center pb-safe shadow-[0_-2px_10px_rgba(0,0,0,0.05)]">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = currentSection === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={(e) => {
              // 表示中のタブをもう一度押したときはトップへ（深い階層からの脱出用）。
              // 別タブへ移るときは、そのタブで最後に開いていた画面に戻す。
              if (isActive) return;
              const lastUrl = readLastUrl(item.href);
              if (lastUrl && lastUrl !== item.href) {
                e.preventDefault();
                router.push(lastUrl);
              }
            }}
            className={`flex flex-col items-center justify-center w-full h-full space-y-1 ${
              isActive ? 'text-[#aecb72]' : 'text-gray-400 hover:text-gray-900'
            }`}
          >
            <Icon size={24} className={isActive ? 'fill-[#aecb72]/10 stroke-[#aecb72]' : ''} />
            <span className={`text-[10px] ${isActive ? 'font-bold' : 'font-medium'}`}>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
