"use client";
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Search, BusFront } from 'lucide-react';
import {
  getFavoriteRoutes,
  getTimetableInfoById,
  removeFavoriteRoute,
  toggleFavoritePinned,
  TimetableInfo,
} from '@/lib/timetableData';
import FavoriteTimetableRow from './components/FavoriteTimetableRow';

const ACCENT = "#a0e25e";

interface FavoriteRow {
  info: TimetableInfo;
  stopName: string;
  /** ホーム画面の「登録時刻」に表示するか */
  pinnedToHome: boolean;
}

export default function TimetableTopPage() {
  const [favorites, setFavorites] = useState<FavoriteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    async function loadFavorites() {
      const savedItems = getFavoriteRoutes();
      if (savedItems.length === 0) {
        setFavorites([]);
        setLoading(false);
        return;
      }

      const favs: FavoriteRow[] = [];
      // 登録は曜日を区別しないため、同じ路線・方面・停留所は1件にまとめる
      // （曜日別に登録された古いデータが残っていても重複表示しない）。
      const seen = new Set<string>();
      for (const item of savedItems) {
        const info = await getTimetableInfoById(item.routeId);
        if (!info) continue;
        const key = `${info.routeName}|${info.direction}|${item.stopName}`;
        if (seen.has(key)) continue;
        seen.add(key);
        // pinnedToHome を持たない既存データは表示扱い（MYルートと同じ扱い）
        favs.push({ info, stopName: item.stopName, pinnedToHome: item.pinnedToHome !== false });
      }
      setFavorites(favs);
      setLoading(false);
    }
    loadFavorites();
  }, []);

  const handleRemove = async (routeId: string, stopName: string) => {
    await removeFavoriteRoute(routeId, stopName);
    setFavorites(prev => prev.filter(f => !(f.info.route_id === routeId && f.stopName === stopName)));
  };

  // ホーム画面の「登録時刻」に出すかを切り替える（MYルートの星と同じ操作）
  const handleTogglePin = async (routeId: string, stopName: string) => {
    const pinned = await toggleFavoritePinned(routeId, stopName);
    setFavorites(prev =>
      prev.map(f =>
        f.info.route_id === routeId && f.stopName === stopName ? { ...f, pinnedToHome: pinned } : f
      )
    );
  };

  return (
    <div className="min-h-screen bg-[#eee]">
      <div className="max-w-2xl mx-auto px-4 pt-4 pb-8 space-y-6">
        <h1 className="text-[24px] font-bold text-black">時刻表検索</h1>

        <Link href="/timetable/search" className="block w-full">
          <div className="w-full h-11 bg-white rounded-lg flex items-center gap-2 px-3 cursor-pointer transition-colors hover:bg-[#ebebeb] active:bg-[#e0e0e0]">
            <Search size={16} className="text-black/40 shrink-0" />
            <span className="text-xs font-bold text-black/50">駅・停留所名で検索</span>
          </div>
        </Link>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-black">登録時刻</h2>
            {favorites.length > 0 && (
              <button
                onClick={() => setIsEditing(prev => !prev)}
                className="cursor-pointer text-[13px] font-bold transition-opacity hover:opacity-70 active:opacity-60"
                style={{ color: ACCENT }}
              >
                {isEditing ? "完了" : "ホームに追加・編集"}
              </button>
            )}
          </div>

          {loading ? (
            <div className="text-center py-8 text-black/40 text-sm font-bold animate-pulse">読み込み中...</div>
          ) : favorites.length === 0 ? (
            <div className="bg-[#fafafa] p-8 rounded-lg text-center">
              <BusFront className="w-12 h-12 text-black/10 mx-auto mb-3" />
              <p className="text-black/50 font-medium text-sm">
                登録された時刻表はありません。
                <br />
                検索から時刻表を追加してください。
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {favorites.map((fav, index) => (
                <FavoriteTimetableRow
                  key={`${fav.info.route_id}-${fav.stopName}-${index}-${isEditing}`}
                  info={fav.info}
                  stopName={fav.stopName}
                  pinnedToHome={fav.pinnedToHome}
                  editing={isEditing}
                  onDelete={() => handleRemove(fav.info.route_id, fav.stopName)}
                  onTogglePin={() => handleTogglePin(fav.info.route_id, fav.stopName)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
