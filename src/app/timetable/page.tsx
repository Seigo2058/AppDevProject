"use client";
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Search, BusFront, ChevronRight, Trash2 } from 'lucide-react';
import { getFavoriteRoutes, getTimetableInfoById, removeFavoriteRoute, TimetableInfo } from '@/lib/timetableData';

const ACCENT = "#a0e25e";

// TransitAPI/CSVのどちらも運賃・乗換回数を返さないため、Figmaデザインの見た目を
// 再現する目的の仮値。実データ連携が決まり次第、実際の値に差し替える。
const DUMMY_FARE = 250;
const DUMMY_TRANSFER_COUNT = 0;

export default function TimetableTopPage() {
  const [favorites, setFavorites] = useState<{ info: TimetableInfo; stopName: string }[]>([]);
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

      const favs: { info: TimetableInfo; stopName: string }[] = [];
      // 登録は曜日を区別しないため、同じ路線・方面・停留所は1件にまとめる
      // （曜日別に登録された古いデータが残っていても重複表示しない）。
      const seen = new Set<string>();
      for (const item of savedItems) {
        const info = await getTimetableInfoById(item.routeId);
        if (!info) continue;
        const key = `${info.routeName}|${info.direction}|${item.stopName}`;
        if (seen.has(key)) continue;
        seen.add(key);
        favs.push({ info, stopName: item.stopName });
      }
      setFavorites(favs);
      setLoading(false);
    }
    loadFavorites();
  }, []);

  const handleRemove = async (routeId: string, stopName: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    await removeFavoriteRoute(routeId, stopName);
    setFavorites(prev => prev.filter(f => !(f.info.route_id === routeId && f.stopName === stopName)));
  };

  return (
    <div className="min-h-screen bg-[#eee]">
      <div className="max-w-2xl mx-auto px-4 pt-6 pb-8 space-y-6">
        <h1 className="text-[20px] font-bold text-black">時刻表検索</h1>

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
                {isEditing ? "完了" : "編集"}
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
                <Link
                  key={`${fav.info.route_id}-${fav.stopName}-${index}`}
                  href={`/timetable/view?route_id=${fav.info.route_id}&stop_name=${encodeURIComponent(fav.stopName)}`}
                  className="block bg-[#fafafa] rounded-lg px-4 py-3 flex items-center gap-2 transition-colors hover:bg-[#e6e6e6] active:bg-[#dcdcdc]"
                >
                  <div className="flex-1 flex flex-col gap-1 min-w-0">
                    <div className="flex items-center gap-1 text-[10px] text-black/70 flex-wrap">
                      <span>{fav.stopName}</span>
                      <span>から</span>
                      <span>{fav.info.direction}</span>
                      <span>方面</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className="text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0"
                        style={{ color: ACCENT, borderColor: ACCENT, backgroundColor: `${ACCENT}1a` }}
                      >
                        {fav.info.transportType}
                      </span>
                      <span className="text-xs text-black/50 font-medium truncate">{fav.info.agencyName}</span>
                    </div>
                    <p className="text-base font-bold text-black leading-tight truncate">{fav.info.routeName}</p>
                    <div className="flex items-center gap-2 text-[11px] text-black">
                      <span className="font-bold">{DUMMY_FARE}円</span>
                      <span className="text-black/20">|</span>
                      <span>{DUMMY_TRANSFER_COUNT > 0 ? `乗換${DUMMY_TRANSFER_COUNT}回` : "乗換無"}</span>
                    </div>
                  </div>
                  {isEditing ? (
                    <button
                      onClick={(e) => handleRemove(fav.info.route_id, fav.stopName, e)}
                      className="p-1.5 text-black/30 hover:text-red-500 rounded-lg transition-colors shrink-0 cursor-pointer"
                      title="お気に入り解除"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  ) : (
                    <ChevronRight className="w-4 h-4 text-black/30 shrink-0" />
                  )}
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
