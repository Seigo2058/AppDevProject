"use client";
import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ChevronLeft, MapPin } from 'lucide-react';
import { getDirectionsByRouteName } from '@/lib/timetableData';

function DirectionSelectionContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const routeName = searchParams.get('route_name');
  const stopName = searchParams.get('stop_name') || '';
  
  const [directions, setDirections] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadDirections() {
      if (!routeName) {
        setLoading(false);
        return;
      }
      const dirs = await getDirectionsByRouteName(routeName);
      
      // 方面が1つしかない場合はスキップして直接時刻表画面へ
      // （※平日の時刻表をデフォルトで表示するため day_type=平日 とする）
      if (dirs.length === 1) {
        router.replace(`/timetable/view?route_name=${encodeURIComponent(routeName)}&direction=${encodeURIComponent(dirs[0])}&day_type=${encodeURIComponent('平日')}&stop_name=${encodeURIComponent(stopName)}`);
      } else {
        setDirections(dirs);
        setLoading(false);
      }
    }
    loadDirections();
  }, [routeName, router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-400 font-bold animate-pulse">読み込み中...</div>
      </div>
    );
  }

  if (!routeName || directions.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <button onClick={() => router.back()} className="mb-4 text-blue-600 font-bold flex items-center">
          <ChevronLeft className="w-5 h-5 mr-1" />
          戻る
        </button>
        <p className="text-gray-500 text-center mt-10 font-bold">路線情報が見つかりません</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <div className="bg-white p-4 sticky top-0 z-10 border-b border-gray-100 shadow-sm flex items-center">
        <button 
          onClick={() => router.back()}
          className="p-2 -ml-2 mr-2 rounded-full hover:bg-gray-100 text-gray-500 transition-colors"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
        <h2 className="text-lg font-bold text-gray-800 flex-1 truncate">{routeName}</h2>
      </div>

      <div className="p-4 space-y-4">
        <h3 className="text-sm font-extrabold text-gray-600 uppercase tracking-wider mb-2">方面を選択</h3>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <ul className="divide-y divide-gray-100">
            {directions.map((dir, idx) => (
              <li key={idx}>
                <button
                  onClick={() => router.push(`/timetable/view?route_name=${encodeURIComponent(routeName)}&direction=${encodeURIComponent(dir)}&day_type=${encodeURIComponent('平日')}&stop_name=${encodeURIComponent(stopName)}`)}
                  className="w-full text-left px-4 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors active:bg-gray-100"
                >
                  <div className="flex items-center">
                    <MapPin className="w-5 h-5 text-blue-500 mr-3" />
                    <span className="font-bold text-gray-800 text-base">{dir} 方面</span>
                  </div>
                  <ChevronLeft className="w-5 h-5 text-gray-300 rotate-180" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

export default function TimetableDirectionPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-400 font-bold animate-pulse">読み込み中...</div>
      </div>
    }>
      <DirectionSelectionContent />
    </Suspense>
  );
}
