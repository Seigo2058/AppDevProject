"use client";
import { useState, useEffect } from 'react';
import { ChevronLeft, Search, Navigation } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { searchStopsAndRoutes, SearchResult, checkEdgeStopAndGetRouteId } from '@/lib/timetableData';

export default function TimetableSearchPage() {
  const router = useRouter();
  const [keyword, setKeyword] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (!keyword.trim()) {
        setResults([]);
        return;
      }
      setIsSearching(true);
      const matched = await searchStopsAndRoutes(keyword);
      setResults(matched);
      setIsSearching(false);
    }, 300); // デバウンス処理
    
    return () => clearTimeout(timer);
  }, [keyword]);

  const handleRouteClick = async (routeName: string, stopName: string) => {
    const edgeRouteId = await checkEdgeStopAndGetRouteId(routeName, stopName);
    if (edgeRouteId) {
      router.push(`/timetable/view?route_id=${edgeRouteId}&stop_name=${encodeURIComponent(stopName)}`);
    } else {
      router.push(`/timetable/direction?route_name=${encodeURIComponent(routeName)}&stop_name=${encodeURIComponent(stopName)}`);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* ヘッダー＆検索バー */}
      <div className="bg-white p-4 sticky top-0 z-10 border-b border-gray-100 shadow-sm flex items-center space-x-3">
        <button 
          onClick={() => router.back()}
          className="p-2 -ml-2 rounded-full hover:bg-gray-100 text-gray-500 transition-colors"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
        <div className="flex-1 relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="w-5 h-5 text-gray-400" />
          </div>
          <input
            type="text"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            className="block w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-xl leading-5 bg-gray-50 placeholder-gray-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm font-medium transition-colors"
            placeholder="駅名・停留所名・路線名を入力"
            autoFocus
          />
        </div>
      </div>

      <div className="p-4">
        {keyword.trim() === '' ? (
          <div className="text-center py-12">
            <Navigation className="w-12 h-12 text-gray-200 mx-auto mb-3" />
            <p className="text-gray-400 font-bold text-sm">
              調べたい駅名や路線名を<br/>入力してください
            </p>
          </div>
        ) : isSearching ? (
          <div className="text-center py-8 text-gray-400 text-sm font-bold animate-pulse">検索中...</div>
        ) : results.length > 0 ? (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <ul className="divide-y divide-gray-100">
              {results.map((resItem, idx) => (
                <li key={idx}>
                  <button
                    onClick={() => handleRouteClick(resItem.routeName, resItem.matchedName)}
                    className="w-full text-left px-4 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors active:bg-gray-100"
                  >
                    <div>
                      <h4 className="font-bold text-gray-800 text-base">{resItem.routeName}</h4>
                      {resItem.matchedName !== resItem.routeName && (
                        <p className="text-sm text-gray-500 font-medium mt-1">停留所: {resItem.matchedName}</p>
                      )}
                    </div>
                    <ChevronLeft className="w-5 h-5 text-gray-300 rotate-180" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="text-center py-10">
            <p className="text-gray-500 font-bold text-sm">該当する路線が見つかりません</p>
            <p className="text-gray-400 text-xs mt-1">別のキーワードでお試しください</p>
          </div>
        )}
      </div>
    </div>
  );
}
