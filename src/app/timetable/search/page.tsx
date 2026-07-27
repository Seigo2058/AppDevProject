"use client";
import { useState, useEffect } from 'react';
import { MapPin, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { searchStops, StopSearchResult } from '@/lib/timetableData';

export default function TimetableSearchPage() {
  const router = useRouter();
  const [keyword, setKeyword] = useState('');
  const [results, setResults] = useState<StopSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (!keyword.trim()) {
        setResults([]);
        return;
      }
      setIsSearching(true);
      const matched = await searchStops(keyword);
      setResults(matched);
      setIsSearching(false);
    }, 300); // デバウンス処理

    return () => clearTimeout(timer);
  }, [keyword]);

  // 停留所を選んだ後、その停留所を通る路線・方面の選択画面へ遷移する
  const handleStopClick = (stopName: string) => {
    router.push(`/timetable/routes?stop_name=${encodeURIComponent(stopName)}`);
  };

  return (
    <div className="min-h-full bg-[#eee] py-2">
      <div className="flex flex-col gap-6 px-4">
        {/* 検索バー */}
        <div className="flex items-center">
          <button
            type="button"
            onClick={() => router.back()}
            aria-label="検索を閉じる"
            className="flex items-center p-2.5 text-black transition-opacity hover:opacity-70 active:opacity-60"
          >
            <X size={24} />
          </button>
          <input
            type="text"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            className="h-11 min-w-0 flex-1 rounded-lg bg-white p-2.5 text-xs text-black outline-none placeholder:text-black/40"
            placeholder="駅・停留所名で検索"
            autoFocus
          />
        </div>

        {/* 検索結果（駅・停留所） */}
        {keyword.trim() === '' ? (
          <p className="pt-8 text-center text-xs font-medium text-black/40">
            調べたい駅名や停留所名を
            <br />
            入力してください
          </p>
        ) : isSearching ? (
          <p className="animate-pulse pt-8 text-center text-xs font-bold text-black/40">検索中...</p>
        ) : results.length > 0 ? (
          <div className="flex flex-col gap-2.5">
            {results.map((resItem) => (
              <div key={resItem.stopName} className="flex flex-col gap-2.5">
                <button
                  type="button"
                  onClick={() => handleStopClick(resItem.stopName)}
                  className="flex items-center gap-2 text-left transition-opacity hover:opacity-70 active:opacity-60"
                >
                  <MapPin size={24} className="shrink-0 text-black" />
                  <div className="flex min-w-0 flex-col gap-2">
                    <p className="truncate text-[13px] font-medium leading-[13px] text-black">{resItem.stopName}</p>
                    <p className="truncate text-[11px] leading-[11px] text-black">
                      {resItem.transportTypes.join('・')}
                      {resItem.transportTypes.length > 0 && ' / '}
                      {resItem.routeCount}路線
                    </p>
                  </div>
                </button>
                <div className="h-px w-full bg-black/20" />
              </div>
            ))}
          </div>
        ) : (
          <div className="pt-8 text-center">
            <p className="text-xs font-bold text-black/50">該当する駅・停留所が見つかりません</p>
            <p className="mt-1 text-[11px] text-black/40">別のキーワードでお試しください</p>
          </div>
        )}
      </div>
    </div>
  );
}
