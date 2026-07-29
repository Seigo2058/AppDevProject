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

/**
 * 表示中のタブをもう一度押したときに発火するイベント。
 * URLだけでは戻せない画面内の状態（ルート画面の検索結果・詳細表示など）を、
 * 各ページ側でトップに戻すために使う。detail には対象タブのパスが入る。
 */
export const TAB_ROOT_RESET_EVENT = 'tab-root-reset';

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
    // 背景（白帯）は画面幅いっぱい、アイコンの並びはコンテンツと同じ600pxに揃える
    <nav className="shrink-0 min-h-16 bg-white border-t border-gray-200 flex justify-center pb-safe shadow-[0_-2px_10px_rgba(0,0,0,0.05)]">
      <div className="flex w-full max-w-[600px] justify-around items-center">
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
              if (isActive) {
                // 同じURLのままページ内で画面を切り替えているタブ（ルート画面など）は
                // 遷移が起きないため、イベントでトップ表示に戻すよう伝える。
                window.dispatchEvent(
                  new CustomEvent(TAB_ROOT_RESET_EVENT, { detail: item.href })
                );
                return;
              }
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
      </div>
    </nav>
  );
}
