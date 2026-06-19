"use client";

import { useState } from 'react';
import { Search, MapPin, Clock, CircleDollarSign, ArrowRight, Loader2 } from 'lucide-react';

export default function RouteSearch() {
  const [departure, setDeparture] = useState('');
  const [destination, setDestination] = useState('');
  const [routeResult, setRouteResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSearch = async () => {
    if (!departure || !destination) {
      setError('出発地と目的地を入力してください');
      return;
    }

    setLoading(true);
    setError('');
    setRouteResult(null);

    try {
      // 1. 出発地の駅IDを取得
      const depRes = await fetch(`/api/navitime/node?word=${encodeURIComponent(departure)}`);
      const depData = await depRes.json();
      if (!depData.items || depData.items.length === 0) {
        throw new Error(`出発地「${departure}」が見つかりませんでした`);
      }
      const depId = depData.items[0].id;

      // 2. 目的地の駅IDを取得
      const destRes = await fetch(`/api/navitime/node?word=${encodeURIComponent(destination)}`);
      const destData = await destRes.json();
      if (!destData.items || destData.items.length === 0) {
        throw new Error(`目的地「${destination}」が見つかりませんでした`);
      }
      const destId = destData.items[0].id;

      // 3. 経路検索を実行
      const routeRes = await fetch(`/api/navitime/route_transit?start=${depId}&goal=${destId}`);
      const routeData = await routeRes.json();
      
      if (!routeData.items || routeData.items.length === 0) {
        throw new Error('経路が見つかりませんでした');
      }

      setRouteResult(routeData.items[0]);
    } catch (err: any) {
      setError(err.message || '検索中にエラーが発生しました');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 mb-6">
      <h2 className="text-sm font-bold text-gray-500 mb-4 flex items-center">
        <Search size={16} className="mr-1 text-blue-500" />
        経路検索
      </h2>
      
      <div className="space-y-3 relative">
        <div className="relative">
          <MapPin size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-blue-500" />
          <input
            type="text"
            placeholder="出発地 (例: 札幌)"
            value={departure}
            onChange={(e) => setDeparture(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-shadow text-sm"
          />
        </div>

        <div className="flex justify-center -my-2 relative z-10">
          <div className="bg-white p-1 rounded-full border border-gray-200">
             <ArrowRight size={14} className="text-gray-400 transform rotate-90" />
          </div>
        </div>

        <div className="relative">
          <MapPin size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-red-500" />
          <input
            type="text"
            placeholder="目的地 (例: 小樽)"
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-shadow text-sm"
          />
        </div>

        <button
          onClick={handleSearch}
          disabled={loading}
          className="w-full mt-2 bg-blue-600 text-white font-bold py-3 rounded-lg shadow-sm flex items-center justify-center hover:bg-blue-700 transition-colors active:scale-[0.98] disabled:bg-blue-400"
        >
          {loading ? (
            <Loader2 size={18} className="animate-spin mr-2" />
          ) : (
            <Search size={18} className="mr-2" />
          )}
          検索する
        </button>

        {error && (
          <p className="text-sm text-red-500 mt-2 text-center">{error}</p>
        )}
      </div>

      {routeResult && (
        <div className="mt-6 pt-4 border-t border-gray-100 animate-in fade-in slide-in-from-bottom-2">
          <h3 className="text-sm font-bold text-gray-800 mb-3">検索結果 (推奨ルート)</h3>
          
          <div className="bg-blue-50 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center text-blue-800 font-bold">
                <Clock size={18} className="mr-2" />
                <span>
                  {routeResult.summary?.move?.time ? `${routeResult.summary.move.time}分` : '時間不明'}
                </span>
              </div>
              <div className="flex items-center text-gray-700 font-bold">
                <CircleDollarSign size={18} className="mr-2 text-gray-500" />
                <span>
                  {routeResult.summary?.move?.fare?.unit_0 !== undefined 
                    ? `¥${routeResult.summary.move.fare.unit_0.toLocaleString()}` 
                    : routeResult.summary?.move?.reference_fare?.lowest_total_ticket !== undefined
                      ? `¥${routeResult.summary.move.reference_fare.lowest_total_ticket.toLocaleString()}`
                      : '運賃不明'}
                </span>
              </div>
            </div>

            {routeResult.sections && routeResult.sections.length > 0 && (
              <div className="mt-4 space-y-2">
                <p className="text-xs font-bold text-gray-500">乗り換え・経路</p>
                <div className="space-y-2 text-sm text-gray-700">
                  {routeResult.sections.map((section: any, idx: number) => {
                    if (section.type === 'point') {
                      return (
                        <div key={idx} className="flex items-center font-bold">
                          <div className="w-2 h-2 rounded-full bg-blue-500 mr-2"></div>
                          {section.name}
                        </div>
                      );
                    } else if (section.type === 'move') {
                      const lineName = section.transport?.name || section.line_name || '徒歩・その他';
                      return (
                        <div key={idx} className="flex items-center pl-1 border-l-2 border-blue-200 ml-1 py-1">
                          <span className="text-xs text-gray-500 ml-3">
                            {lineName} ({section.time}分)
                          </span>
                        </div>
                      );
                    }
                    return null;
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
