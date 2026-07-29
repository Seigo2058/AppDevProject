"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight, Clock, Loader2, Plus } from "lucide-react";
import SwipeRevealRow, { PinToHomeAction } from "@/components/SwipeRevealRow";
import {
  fetchTimetableData,
  getFavoriteRoutes,
  getRouteStopsById,
  getSameLineRouteIds,
  getTimetableInfoById,
  toggleFavoritePinned,
  TimetableInfo,
} from "@/lib/timetableData";
import { getDayType, timeToMinutes } from "@/lib/generalRouteSearch";
import { canonicalStopName } from "@/lib/stopRegistry";
import { getAgencyColor } from "@/lib/agencyColors";

/** ホームに出す1件ぶんの登録時刻。 */
interface RegisteredTime {
  /** 遷移先の route_id（本日の曜日区分のもの） */
  routeId: string;
  stopName: string;
  info: TimetableInfo;
  /** 乗車する停留所の次の停留所（カード1段目の「〇〇 ▶ 〇〇」の右側） */
  nextStop: string;
  /** これから発車する時刻（早い順） */
  upcoming: string[];
  /** 本日ぶんが終わっている場合に出す翌営業日の始発 */
  firstOfDay: string | null;
}

// カードに出すのは直近の1本だけ
const UPCOMING_COUNT = 1;

// 星ボタン1つぶんだけカードをずらす
const REVEAL_WIDTH = 74;

/**
 * 停留所に対応する列を探す。
 *
 * 列名の付き方が路線で異なるため、順に条件を緩めて照合する。
 * - バス: 列名がそのまま停留所名（例「野幌駅北口」）
 * - JR:   到着・出発が別列（例「大麻着」「大麻発」）。発車時刻なので発の列を使う
 * さらに登録側は「大麻駅」、CSV側は「大麻」のように表記が揺れるため、
 * canonicalStopName で正規化した比較も行う（これが無いとJRの登録が
 * ホームに出ない）。
 */
/** 停車順の中から乗車停留所の次の停留所を返す。終点や見つからない場合は空文字。 */
function findNextStop(stops: string[], stopName: string): string {
  const target = canonicalStopName(stopName);
  let index = stops.indexOf(stopName);
  if (index === -1) index = stops.findIndex((s) => canonicalStopName(s) === target);
  if (index === -1 || index === stops.length - 1) return "";
  return stops[index + 1];
}

function findStopColumn(columns: string[], stopName: string): number {
  const exactDeparture = columns.indexOf(`${stopName}発`);
  if (exactDeparture !== -1) return exactDeparture;

  const exact = columns.indexOf(stopName);
  if (exact !== -1) return exact;

  const target = canonicalStopName(stopName);
  const canonicalDeparture = columns.findIndex(
    (c) => c.endsWith("発") && canonicalStopName(`${c.slice(0, -1)}駅`) === target
  );
  if (canonicalDeparture !== -1) return canonicalDeparture;

  const canonical = columns.findIndex((c) => canonicalStopName(c) === target);
  if (canonical !== -1) return canonical;

  return columns.findIndex((c) => c.includes(stopName));
}

export default function RegisteredTimesSection() {
  const router = useRouter();
  const [items, setItems] = useState<RegisteredTime[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        // ホームには時刻表画面の「ホームに追加」で星を付けた登録だけを出す。
        // pinnedToHome を持たない既存データは、従来通り表示されるよう未指定＝表示とみなす。
        const favorites = getFavoriteRoutes().filter((f) => f.pinnedToHome !== false);
        if (favorites.length === 0) return;

        const now = new Date();
        const nowMinutes = now.getHours() * 60 + now.getMinutes();
        const todayDayType = getDayType(now);

        const loaded = await Promise.all(
          favorites.map(async (favorite): Promise<RegisteredTime | null> => {
            // 登録は曜日を区別しない（平日を代表として保存している）ので、
            // 本日の曜日区分に対応する route_id に読み替えてから時刻を引く。
            const sameLineIds = await getSameLineRouteIds(favorite.routeId);
            const candidates = await Promise.all(sameLineIds.map(getTimetableInfoById));
            const info =
              candidates.find((c) => c?.dayType === todayDayType) ??
              candidates.find((c) => c?.route_id === favorite.routeId) ??
              candidates.find((c) => c !== undefined);
            if (!info) return null;

            const [data, stops] = await Promise.all([
              fetchTimetableData(info.route_id),
              getRouteStopsById(info.route_id),
            ]);
            if (data.length < 2) return null;

            const [columns, ...rows] = data;
            const columnIndex = findStopColumn(columns, favorite.stopName);
            if (columnIndex === -1) return null;

            const times = rows
              .map((row) => (row[columnIndex] ?? "").trim())
              .filter((time) => timeToMinutes(time) !== -1)
              .sort((a, b) => timeToMinutes(a) - timeToMinutes(b));
            if (times.length === 0) return null;

            return {
              routeId: info.route_id,
              stopName: favorite.stopName,
              info,
              nextStop: findNextStop(stops, favorite.stopName),
              upcoming: times
                .filter((time) => timeToMinutes(time) >= nowMinutes)
                .slice(0, UPCOMING_COUNT),
              firstOfDay: times[0],
            };
          })
        );

        setItems(loaded.filter((item): item is RegisteredTime => item !== null));
      } catch (e) {
        console.error("Failed to load registered times on home page:", e);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  // 星ボタンでホーム表示から外す。登録自体は時刻表画面に残る。
  const handleRemoveFromHome = async (item: RegisteredTime) => {
    await toggleFavoritePinned(item.routeId, item.stopName);
    setItems((prev) =>
      prev.filter((i) => !(i.routeId === item.routeId && i.stopName === item.stopName))
    );
  };

  const getRemainingLabel = (time: string): string => {
    const now = new Date();
    const diff = timeToMinutes(time) - (now.getHours() * 60 + now.getMinutes());
    if (diff < 0) return "-";
    if (diff < 60) return `${diff}分`;
    return `${Math.floor(diff / 60)}:${String(diff % 60).padStart(2, "0")}`;
  };

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-black">登録時刻</h2>
        {items.length > 0 && (
          <button
            type="button"
            onClick={() => setIsEditing((prev) => !prev)}
            className="text-[13px] font-bold text-[#a0e25e] transition-opacity hover:opacity-70 active:opacity-60"
          >
            {isEditing ? "完了" : "編集する"}
          </button>
        )}
      </div>

      <div className="flex flex-col gap-2">
        {loading ? (
          <div className="flex h-[90px] items-center justify-center rounded-lg bg-[#fafafa]">
            <Loader2 size={20} className="mr-2 animate-spin text-[#a0e25e]" />
            <span className="text-xs text-black/50">登録時刻を読み込み中...</span>
          </div>
        ) : items.length === 0 ? (
          <div className="flex h-[90px] flex-col items-center justify-center rounded-lg bg-[#fafafa] text-xs text-black/50">
            <Clock size={20} className="mb-1 text-black/20" />
            <p>登録された時刻表はありません。</p>
          </div>
        ) : (
          items.map((item) => (
            <SwipeRevealRow
              key={`${item.routeId}-${item.stopName}-${isEditing}`}
              editing={isEditing}
              revealWidth={REVEAL_WIDTH}
              onOpen={() =>
                router.push(
                  `/timetable/view?route_id=${item.routeId}&stop_name=${encodeURIComponent(item.stopName)}`
                )
              }
              actions={
                <PinToHomeAction
                  pinned
                  label="ホームから削除"
                  onClick={() => handleRemoveFromHome(item)}
                />
              }
            >
              {/* Figma: 停留所→終点 / 事業者・路線・方面 / 発車時刻・残り */}
              <div className="flex h-[105px] w-full items-center gap-2 px-4 py-3">
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="truncate text-base font-bold leading-4 text-black">
                      {item.stopName}
                    </span>
                    {item.nextStop && (
                      <>
                        <span className="h-[10px] w-[9px] shrink-0 bg-[#d9d9d9] [clip-path:polygon(0%_0%,100%_50%,0%_100%)]" />
                        {/* 次の停留所は乗車する停留所より控えめに見せるため灰色にする */}
                        <span className="truncate text-sm font-bold leading-4 text-[#646464]">
                          {item.nextStop}
                        </span>
                      </>
                    )}
                  </div>

                  <div className="flex min-w-0 items-center gap-2">
                    <span
                      className="shrink-0 text-xs font-bold leading-4"
                      style={{ color: getAgencyColor(item.info.agencyName) }}
                    >
                      {item.info.agencyName}
                    </span>
                    <span className="truncate text-xs font-bold leading-4 text-[#646464]">
                      {item.info.routeName}
                    </span>
                    <span className="shrink-0 rounded-full border border-[#89c986] bg-white px-1 text-[11px] font-bold leading-4 text-[#646464]">
                      {item.info.direction}方面
                    </span>
                  </div>

                  {item.upcoming.length > 0 ? (
                    <div className="flex items-baseline gap-3">
                      <span className="whitespace-nowrap">
                        <span className="text-[28px] font-bold leading-4 text-black">
                          {item.upcoming[0]}
                        </span>
                        <span className="text-[11px] font-medium leading-4 text-[#a8a8a8]">発</span>
                      </span>
                      <span className="whitespace-nowrap text-xs leading-4">
                        <span className="font-medium text-[#a8a8a8]">残り</span>
                        <span className="font-bold text-black">
                          {getRemainingLabel(item.upcoming[0])}
                        </span>
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-baseline gap-2">
                      <span className="text-xs text-black/40">本日の運行は終了</span>
                      {item.firstOfDay && (
                        <span className="text-[11px] text-[#a8a8a8]">始発 {item.firstOfDay}</span>
                      )}
                    </div>
                  )}
                </div>

                <ChevronRight size={24} className="shrink-0 text-black/30" />
              </div>
            </SwipeRevealRow>
          ))
        )}

        {/* 時刻表を追加する導線（Myルートの追加ボタンと同じ見た目） */}
        <Link
          href="/timetable/search"
          aria-label="時刻表を追加"
          className="w-full h-[90px] border-[1.5px] border-dashed border-[#a0e25e] rounded-lg flex items-center justify-center transition-colors hover:border-[#8dc753] hover:bg-black/5 active:border-[#8dc753] active:bg-black/12"
        >
          <span className="flex items-center justify-center size-8 rounded-full bg-[#a0e25e] text-white">
            <Plus size={20} />
          </span>
        </Link>
      </div>
    </section>
  );
}
