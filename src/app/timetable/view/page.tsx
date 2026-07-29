"use client";
import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import {
  getTimetableInfoById,
  getTimetableInfo,
  fetchTimetableData,
  getRouteStopsById,
  TimetableInfo,
  saveFavoriteRoute,
  isFavoriteRoute,
  removeFavoriteRoute
} from '@/lib/timetableData';
import DetailActionBar from '@/components/DetailActionBar';

// 発車時刻は1行あたり5件で折り返す（Figmaの時刻表レイアウトに準拠）
const TIMES_PER_ROW = 5;

function chunkMinutes(minutes: string[]): string[][] {
  const rows: string[][] = [];
  for (let i = 0; i < minutes.length; i += TIMES_PER_ROW) {
    rows.push(minutes.slice(i, i + TIMES_PER_ROW));
  }
  return rows;
}

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
  // 路線図バーの両端に表示する始発・終点
  const [originStop, setOriginStop] = useState('');
  const [terminalStop, setTerminalStop] = useState('');

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
        const data = await fetchTimetableData(info.route_id);

        const stops = await getRouteStopsById(info.route_id);
        setOriginStop(stops.length > 0 ? stops[0] : '');
        setTerminalStop(stops.length > 0 ? stops[stops.length - 1] : '');

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

        // お気に入り状態の確認（曜日は区別しないので、同じ路線・方面なら登録済み扱い）
        setIsFavorite(await isFavoriteRoute(info.route_id, paramStopName));

        // タブ用に同じ路線・方面の他曜日の情報を探す
        const p1 = await getTimetableInfo(info.routeName, info.direction, '平日');
        const p2 = await getTimetableInfo(info.routeName, info.direction, '土日・祝');

        const days = [];
        if (p1) days.push({ dayType: p1.dayType, routeId: p1.route_id });
        if (p2) days.push({ dayType: p2.dayType, routeId: p2.route_id });

        // 表示順を「平日」「土日・祝」の順にする
        days.sort((a) => a.dayType === '平日' ? -1 : 1);
        setAvailableDays(days);
      } else {
        setCurrentInfo(null);
      }
      setLoading(false);
    }
    loadData();
  }, [paramRouteId, paramRouteName, paramDirection, paramDayType, paramStopName]);

  // 登録は曜日を区別しない。平日タブ・土日タブのどちらから押しても同じ1件を登録／解除する。
  const toggleFavorite = async () => {
    if (!currentInfo) return;
    if (isFavorite) {
      await removeFavoriteRoute(currentInfo.route_id, paramStopName);
      setIsFavorite(false);
    } else {
      await saveFavoriteRoute(currentInfo.route_id, paramStopName);
      setIsFavorite(true);
    }
  };

  const handleTabClick = (routeId: string) => {
    router.replace(`/timetable/view?route_id=${routeId}&stop_name=${encodeURIComponent(paramStopName)}`);
  };

  // 右端の時刻インデックスから該当の「〇時」ブロックへスクロールする
  const handleHourIndexClick = (hour: number) => {
    document.getElementById(`hour-block-${hour}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  if (loading) {
    return (
      <div className="flex min-h-full items-center justify-center bg-[#f9f9f9]">
        <div className="animate-pulse text-xs font-bold text-black/40">読み込み中...</div>
      </div>
    );
  }

  if (!currentInfo) {
    return (
      <div className="min-h-full bg-[#f9f9f9] p-4">
        <button
          type="button"
          onClick={() => router.back()}
          className="flex items-center gap-1 text-base text-black active:opacity-60"
        >
          <ChevronLeft size={24} />
          戻る
        </button>
        <p className="mt-10 text-center text-xs font-bold text-black/50">時刻表情報が見つかりません</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-full flex-col bg-[#f9f9f9]">
      {/* 上部ヘッダー（戻る／路線図／曜日切り替え） */}
      <div className="sticky top-0 z-20 bg-white drop-shadow-[0px_2px_6px_rgba(0,0,0,0.06)]">
        <div className="bg-white py-1">
          <div className="flex items-center px-4">
            <button
              type="button"
              onClick={() => router.back()}
              aria-label="戻る"
              className="flex items-center p-2.5 text-black active:opacity-60"
            >
              <ChevronLeft size={24} />
            </button>
            <p className="text-base leading-4 text-black">出発地点</p>
          </div>
        </div>

        {/* 駅名・方面・路線図バー */}
        <div className="flex flex-col items-center gap-4 bg-white py-4">
          <p className="w-full truncate px-4 py-0.5 text-center text-[20px] font-bold leading-7 text-black">
            {paramStopName || currentInfo.routeName}
          </p>
          <p className="w-full truncate px-4 text-center text-xs leading-4 text-black">
            {currentInfo.direction} 方面
          </p>

          <div className="flex w-full flex-col gap-2">
            <div className="flex w-full items-center">
              <div className="flex min-w-0 flex-1 items-center justify-between gap-2 bg-[#142547] py-1 pl-6 pr-2">
                <span className="size-4 shrink-0 rounded-full bg-white" />
                <p className="min-w-0 flex-1 truncate text-center text-[11px] font-bold leading-4 text-white">
                  {currentInfo.routeName}
                </p>
                <span className="size-4 shrink-0 rounded-full bg-white" />
              </div>
              {/* 進行方向を示す矢印 */}
              <span className="h-6 w-4 shrink-0 bg-[#142547] [clip-path:polygon(0%_0%,100%_50%,0%_100%)]" />
            </div>
            <div className="flex items-start justify-between gap-2 px-5 text-[11px] leading-4 text-black">
              <span className="truncate">{originStop}</span>
              <span className="truncate">{terminalStop}</span>
            </div>
          </div>
        </div>

        {/* 曜日タブ */}
        {availableDays.length > 0 && (
          <div className="flex items-center justify-center bg-white p-4">
            <div className="flex h-10 w-full max-w-[345px] items-center rounded-lg bg-[#eee] p-1 drop-shadow-[0px_2px_6px_rgba(0,0,0,0.06)]">
              {availableDays.map((d) => {
                const isActive = currentInfo.route_id === d.routeId;
                return (
                  <button
                    key={d.routeId}
                    type="button"
                    onClick={() => handleTabClick(d.routeId)}
                    className={`flex h-8 flex-1 items-center justify-center rounded-lg px-2 py-1 text-[13px] leading-4 text-black transition-colors ${
                      isActive ? 'bg-[#89c986] font-bold' : 'font-normal'
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

      {/* 時刻表 */}
      <div className="relative flex-1 pb-24">
        {scheduleByHour.length === 0 ? (
          <p className="mt-10 text-center text-xs font-bold text-black/40">発車時刻データがありません</p>
        ) : (
          <>
            {scheduleByHour.map((group) => (
              <div key={group.hour} id={`hour-block-${group.hour}`}>
                <div className="flex items-center bg-[#eee] px-4 py-1">
                  <p className="text-xs font-bold leading-4 text-black">{group.hour}時</p>
                </div>
                <div className="flex flex-col bg-white py-2">
                  {chunkMinutes(group.minutes).map((row, rowIdx) => (
                    <div key={rowIdx} className="grid grid-cols-5 px-6 py-2">
                      {row.map((minute, minuteIdx) => (
                        <span
                          key={minuteIdx}
                          className="text-center text-[20px] font-medium leading-6 text-black"
                        >
                          {minute}
                        </span>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {/* 右端の時刻インデックス */}
            {scheduleByHour.length > 1 && (
              // 600px幅の枠は右端に数字を寄せるためだけのもの。そのままだと画面の大部分を
              // 覆ってスクロール操作を奪ってしまうので、枠自体はポインタ操作を透過させ、
              // 数字のボタンだけ押せるようにする。
              <div className="pointer-events-none fixed inset-x-0 bottom-32 z-10 mx-auto flex max-w-[600px] flex-col items-end pr-1">
                {scheduleByHour.map((group) => (
                  <button
                    key={group.hour}
                    type="button"
                    onClick={() => handleHourIndexClick(group.hour)}
                    className="pointer-events-auto px-1 text-[10px] font-bold leading-4 text-[#010101] active:opacity-60"
                  >
                    {group.hour}
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <DetailActionBar
        actionLabel={isFavorite ? '登録を解除する' : '登録する'}
        onAction={toggleFavorite}
        released={isFavorite}
      />
    </div>
  );
}

export default function TimetableViewPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-full items-center justify-center bg-[#f9f9f9]">
        <div className="animate-pulse text-xs font-bold text-black/40">読み込み中...</div>
      </div>
    }>
      <TimetableViewContent />
    </Suspense>
  );
}
