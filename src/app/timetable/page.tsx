"use client";
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Search, Clock, Trash2, ChevronRight, Bus } from 'lucide-react';
import { getFavoriteRoutes, getTimetableInfoById, removeFavoriteRoute, TimetableInfo, FavoriteItem } from '@/lib/timetableData';

export default function TimetableTopPage() {
  const [favorites, setFavorites] = useState<{ info: TimetableInfo; stopName: string }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadFavorites() {
      const savedItems = getFavoriteRoutes();
      if (savedItems.length === 0) {
        setFavorites([]);
        setLoading(false);
        return;
      }

      const favs: { info: TimetableInfo; stopName: string }[] = [];
      for (const item of savedItems) {
        const info = await getTimetableInfoById(item.routeId);
        if (info) {
          favs.push({ info, stopName: item.stopName });
        }
      }
      setFavorites(favs);
      setLoading(false);
    }
    loadFavorites();
  }, []);

  const handleRemove = (routeId: string, stopName: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    removeFavoriteRoute(routeId, stopName);
    setFavorites(prev => prev.filter(f => !(f.info.route_id === routeId && f.stopName === stopName)));
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <div className="bg-white p-4 sticky top-0 z-10 border-b border-gray-100 shadow-sm">
        <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center">
          <Clock className="w-5 h-5 mr-2 text-blue-600" />
          時刻表
        </h2>
        
        <Link href="/timetable/search" className="block w-full">
          <div className="flex items-center bg-gray-100 rounded-xl p-3 text-gray-500 hover:bg-gray-200 transition-colors cursor-pointer">
            <Search className="w-5 h-5 mr-2 text-gray-400" />
            <span className="text-sm font-medium">駅・停留所名で検索</span>
          </div>
        </Link>
      </div>

      <div className="p-4 space-y-4">
        <h3 className="text-sm font-bold text-gray-600 uppercase tracking-wider mb-2">登録済み時刻表</h3>

        {loading ? (
          <div className="text-center py-8 text-gray-400 text-sm animate-pulse">読み込み中...</div>
        ) : favorites.length === 0 ? (
          <div className="bg-white p-8 rounded-2xl border border-gray-100 text-center shadow-sm">
            <Bus className="w-12 h-12 text-gray-200 mx-auto mb-3" />
            <p className="text-gray-500 font-medium text-sm">
              登録された時刻表はありません。<br/>
              検索から時刻表を追加してください。
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {favorites.map((fav, index) => (
              <Link 
                key={`${fav.info.route_id}-${fav.stopName}-${index}`} 
                href={`/timetable/view?route_id=${fav.info.route_id}&stop_name=${encodeURIComponent(fav.stopName)}`}
                className="block bg-white p-4 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow active:scale-[0.98]"
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1 pr-4">
                    <div className="flex items-center space-x-2 mb-1">
                      <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100">
                        {fav.info.transportType}
                      </span>
                      <span className="text-xs text-gray-500 font-medium">{fav.info.agencyName}</span>
                    </div>
                    <h4 className="font-bold text-gray-800 text-lg leading-tight mb-1">{fav.stopName}</h4>
                    <p className="text-sm font-bold text-gray-600 mb-1">{fav.info.routeName}</p>
                    <p className="text-xs font-bold text-blue-500">{fav.info.direction} 方面</p>
                    <p className="text-[11px] font-medium text-gray-400 mt-1">{fav.info.dayType}</p>
                  </div>
                  <div className="flex flex-col items-end space-y-3">
                    <button 
                      onClick={(e) => handleRemove(fav.info.route_id, fav.stopName, e)}
                      className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      title="お気に入り解除"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <ChevronRight className="w-5 h-5 text-gray-300" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
