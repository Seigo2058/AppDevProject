"use client";
import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { getLinesWithDirectionsByStop, StopLineGroup } from '@/lib/timetableData';

function RouteSelectionContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const stopName = searchParams.get('stop_name') || '';

  const [lines, setLines] = useState<StopLineGroup[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadLines() {
      if (!stopName) {
        setLoading(false);
        return;
      }
      const found = await getLinesWithDirectionsByStop(stopName);
      setLines(found);
      setLoading(false);
    }
    loadLines();
  }, [stopName]);

  const handleDirectionClick = (routeId: string) => {
    router.push(`/timetable/view?route_id=${routeId}&stop_name=${encodeURIComponent(stopName)}`);
  };

  return (
    <div className="min-h-full bg-[#eee]">
      {/* ヘッダー（選択中の駅・停留所名） */}
      <div className="sticky top-0 z-10 bg-white px-4 py-1">
        <div className="flex items-center">
          <button
            type="button"
            onClick={() => router.back()}
            aria-label="戻る"
            className="flex items-center p-2.5 text-black transition-opacity hover:opacity-70 active:opacity-60"
          >
            <ChevronLeft size={24} />
          </button>
          <p className="flex-1 truncate pr-12 text-center text-base font-bold leading-4 text-black">
            {stopName || '駅・停留所'}
          </p>
        </div>
      </div>

      {loading ? (
        <p className="animate-pulse pt-12 text-center text-xs font-bold text-black/40">読み込み中...</p>
      ) : !stopName || lines.length === 0 ? (
        <p className="px-4 pt-12 text-center text-xs font-bold text-black/50">
          {stopName ? 'この停留所から乗車できる路線が見つかりません' : '駅・停留所が指定されていません'}
        </p>
      ) : (
        <div className="flex flex-col gap-4 pt-12">
          <p className="px-4 text-sm font-bold leading-4 text-black">方面を選択</p>

          <div className="flex flex-col gap-4">
            {lines.map((line) => (
              <div key={line.routeName} className="flex flex-col gap-px">
                <div className="flex items-center bg-[#89c986] px-4 py-1">
                  <p className="text-[11px] font-bold leading-4 text-white">{line.routeName}</p>
                </div>
                {line.directions.map((dir) => (
                  <button
                    key={dir.routeId}
                    type="button"
                    onClick={() => handleDirectionClick(dir.routeId)}
                    className="flex items-center justify-between bg-[#fafafa] p-4 text-left transition-colors hover:bg-[#e6e6e6] active:bg-[#dcdcdc]"
                  >
                    <span className="min-w-0 truncate text-xs leading-4 text-black">{dir.direction} 方面</span>
                    <ChevronRight size={16} className="shrink-0 text-black" />
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function TimetableRoutesPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-full items-center justify-center bg-[#eee]">
        <div className="animate-pulse text-xs font-bold text-black/40">読み込み中...</div>
      </div>
    }>
      <RouteSelectionContent />
    </Suspense>
  );
}
