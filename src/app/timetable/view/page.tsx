"use client";
import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ChevronLeft, Info } from 'lucide-react';
import { 
  getTimetableInfoById, 
  getTimetableInfo, 
  fetchTimetableData, 
  getRouteStopsById,
  TimetableInfo,
  saveFavoriteRoute,
  getFavoriteRoutes,
  removeFavoriteRoute
} from '@/lib/timetableData';

function TimetableViewContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const paramRouteId = searchParams.get('route_id');
  const paramRouteName = searchParams.get('route_name');
  const paramDirection = searchParams.get('direction');
  const paramDayType = searchParams.get('day_type') || '平日';
  const paramStopName = searchParams.get('stop_name') || '';

  const [currentInfo, setCurrentInfo] = useState<TimetableInfo | null>(null);
  // 時刻を時(hour)ごとにグループ化したデータ
  const [scheduleByHour, setScheduleByHour] = useState<{ hour: number, minutes: string[] }[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEdgeStop, setIsEdgeStop] = useState(false);
  
  const [isFavorite, setIsFavorite] = useState(false);
  
  // 他の曜日の情報を保持（タブ切り替え用）
  const [availableDays, setAvailableDays] = useState<{ dayType: string, routeId: string }[]>([]);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      let info: TimetableInfo | undefined;

      if (paramRouteId) {
        info = await getTimetableInfoById(paramRouteId);
      } else if (paramRouteName && paramDirection) {
        info = await getTimetableInfo(paramRouteName, paramDirection, paramDayType);
      }

      if (info) {
        setCurrentInfo(info);
        const data = await fetchTimetableData(info.csvFileName);
        
        // 停留所が路線の端（最初または最後）かどうかを判定
        const stops = await getRouteStopsById(info.route_id);
        if (stops.length > 0) {
          const isFirst = stops[0] === paramStopName;
          const isLast = stops[stops.length - 1] === paramStopName;
          setIsEdgeStop(isFirst || isLast);
        }

        let colIndex = -1;
        if (data.length > 0) {
          const headers = data[0];
          colIndex = headers.findIndex(h => h.includes(paramStopName));
          if (colIndex === -1) colIndex = 0; 
        }

        const timesObj: Record<number, string[]> = {};
        
        if (colIndex !== -1 && data.length > 1) {
          for (let i = 1; i < data.length; i++) {
            const timeStr = data[i][colIndex];
            if (timeStr && timeStr.trim() !== '' && timeStr.trim() !== '-') {
              const cleaned = timeStr.trim();
              const [h, m] = cleaned.split(':');
              const hour = parseInt(h, 10);
              if (!isNaN(hour)) {
                if (!timesObj[hour]) timesObj[hour] = [];
                timesObj[hour].push(m);
              }
            }
          }
        }
        
        // オブジェクトを配列に変換してソート
        const grouped = Object.keys(timesObj)
          .map(k => parseInt(k, 10))
          .sort((a, b) => a - b)
          .map(hour => ({
            hour,
            minutes: timesObj[hour].sort()
          }));
          
        setScheduleByHour(grouped);
        
        // お気に入り状態の確認
        const favs = getFavoriteRoutes();
        setIsFavorite(favs.some(f => f.routeId === info!.route_id && f.stopName === paramStopName));

        // タブ用に同じ路線・方面の他曜日の情報を探す
        const p1 = await getTimetableInfo(info.routeName, info.direction, '平日');
        const p2 = await getTimetableInfo(info.routeName, info.direction, '土日・祝');
        
        const days = [];
        if (p1) days.push({ dayType: p1.dayType, routeId: p1.route_id });
        if (p2) days.push({ dayType: p2.dayType, routeId: p2.route_id });
        
        // 表示順を「平日」「土日・祝」の順にする
        days.sort((a, b) => a.dayType === '平日' ? -1 : 1);
        setAvailableDays(days);
      } else {
        setCurrentInfo(null);
      }
      setLoading(false);
    }
    loadData();
  }, [paramRouteId, paramRouteName, paramDirection, paramDayType, paramStopName]);

  const toggleFavorite = () => {
    if (!currentInfo) return;
    if (isFavorite) {
      removeFavoriteRoute(currentInfo.route_id, paramStopName);
      setIsFavorite(false);
    } else {
      saveFavoriteRoute(currentInfo.route_id, paramStopName);
      setIsFavorite(true);
      // alertは控えめに
    }
  };

  const handleTabClick = (routeId: string) => {
    router.replace(`/timetable/view?route_id=${routeId}&stop_name=${encodeURIComponent(paramStopName)}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-gray-400 font-bold animate-pulse">読み込み中...</div>
      </div>
    );
  }

  if (!currentInfo) {
    return (
      <div className="min-h-screen bg-white p-4">
        <button onClick={() => router.back()} className="mb-4 text-gray-600 font-medium flex items-center">
          <ChevronLeft className="w-5 h-5 mr-1" />
          戻る
        </button>
        <p className="text-gray-500 text-center mt-10 font-bold">時刻表情報が見つかりません</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white flex flex-col font-sans">
      {/* 上部ヘッダーエリア */}
      <div className="bg-white sticky top-0 z-20">
        <div className="p-4 flex items-center">
          <button 
            onClick={() => router.back()}
            className="flex items-center text-gray-600 text-base font-medium"
          >
            <ChevronLeft className="w-6 h-6 mr-1" />
            出発地点
          </button>
        </div>

        {/* 駅名・方面 */}
        <div className="text-center pb-3">
          <h2 className="text-2xl font-black text-black tracking-tight">{paramStopName || currentInfo.routeName}</h2>
          <p className="text-sm font-medium text-gray-600 mt-1">{currentInfo.direction} 方面</p>
        </div>

        {/* 路線名帯 (ライトグリーン) */}
        <div className="bg-[#A8CD64] text-white py-1 relative flex items-center justify-center">
          {/* 左端の装飾 */}
          <div className="absolute left-0 top-0 bottom-0 flex items-center pl-6">
             <div className="w-3.5 h-3.5 bg-white rounded-full"></div>
          </div>
          <span className="text-sm font-bold tracking-widest">{currentInfo.routeName}</span>
          {/* 右端の装飾 */}
          <div className="absolute right-0 top-0 bottom-0 flex items-center pr-6">
             <div className="w-3.5 h-3.5 bg-white rounded-full"></div>
          </div>
        </div>
        
        {/* （もし前後の駅名があれば表示するスペース。今回は仮で省略） */}
        <div className="flex justify-between px-6 py-2 text-xs font-medium text-gray-700">
          <span>&nbsp;</span>
          <span>&nbsp;</span>
        </div>

        {/* タブ切り替え */}
        {availableDays.length > 0 && (
          <div className="px-4 pb-4">
            <div className="flex bg-[#F2F2F2] rounded-lg overflow-hidden p-1 gap-1">
              {availableDays.map((d) => {
                const isActive = currentInfo.route_id === d.routeId;
                return (
                  <button
                    key={d.routeId}
                    onClick={() => handleTabClick(d.routeId)}
                    className={`flex-1 py-2.5 text-sm font-bold rounded-md transition-all ${
                      isActive 
                        ? 'bg-[#A8CD64] text-white shadow-sm' 
                        : 'text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {d.dayType}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* 時刻表コンテンツ */}
      <div className="flex-1 pb-28 relative">
        {scheduleByHour.length === 0 ? (
          <p className="text-gray-400 text-center mt-10 text-sm font-bold">発車時刻データがありません</p>
        ) : (
          <div>
            {scheduleByHour.map((group, idx) => (
              <div key={idx}>
                {/* 帯 */}
                <div className="bg-[#EAEAEA] px-4 py-1.5 border-t border-[#D9D9D9]">
                  <span className="font-extrabold text-black text-sm">{group.hour}時</span>
                </div>
                {/* 分のリスト */}
                <div className="px-6 py-4 grid grid-cols-5 gap-y-4 gap-x-2">
                  {group.minutes.map((m, mIdx) => (
                    <div key={mIdx} className="text-center">
                      <span className="text-2xl font-medium text-black">{m}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 画面下部固定アクションバー */}
      <div className="fixed bottom-16 left-0 right-0 bg-[#F2F2F2] p-4 flex space-x-3 z-30 shadow-[0_-4px_20px_-10px_rgba(0,0,0,0.05)] border-t border-gray-200">
        <button 
          onClick={() => alert('運行情報ページへ遷移します（未実装）')}
          className="w-[72px] h-[64px] bg-gray-500 rounded-xl flex flex-col items-center justify-center text-white active:scale-[0.98] transition-transform shadow-sm"
        >
          <div className="font-bold text-2xl leading-none mb-1">!</div>
          <span className="text-[10px] font-bold">運行情報</span>
        </button>
        
        <button 
          onClick={toggleFavorite}
          className={`flex-1 h-[64px] rounded-xl font-bold text-base flex items-center justify-center transition-transform active:scale-[0.98] shadow-sm ${
            isFavorite 
              ? 'bg-[#A8CD64] text-white hover:bg-[#96bc54]' 
              : 'bg-white text-[#A8CD64] border-2 border-[#A8CD64] hover:bg-gray-50'
          }`}
        >
          {isFavorite ? '登録を解除する' : '時刻表を登録する'}
        </button>
      </div>
    </div>
  );
}

export default function TimetableViewPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-gray-400 font-bold animate-pulse">読み込み中...</div>
      </div>
    }>
      <TimetableViewContent />
    </Suspense>
  );
}
