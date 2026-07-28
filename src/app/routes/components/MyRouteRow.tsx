"use client";

import { ChevronRight, CircleX } from "lucide-react";
import SwipeRevealRow, { PinToHomeAction } from "@/components/SwipeRevealRow";
import type { SearchResultJourney } from "@/lib/generalRouteSearch";
import type { SavedRoute } from "@/lib/myRoutes";

// 削除＋ホームに追加の2ボタンぶん
const REVEAL_WIDTH = 124;

// 編集モードの切り替え時は呼び出し側が key を変えて再マウントし、個別スワイプ状態を捨てる。
interface MyRouteRowProps {
  route: SavedRoute;
  trip: SearchResultJourney | null | undefined;
  remainingLabel: string;
  /** 編集モード中は全カードを開いた状態にする */
  editing: boolean;
  onOpen: () => void;
  onDelete: () => void;
  onTogglePin: () => void;
}

export default function MyRouteRow({
  route,
  trip,
  remainingLabel,
  editing,
  onOpen,
  onDelete,
  onTogglePin,
}: MyRouteRowProps) {
  return (
    <SwipeRevealRow
      editing={editing}
      revealWidth={REVEAL_WIDTH}
      onOpen={onOpen}
      actions={
        <>
          <button
            type="button"
            onClick={onDelete}
            className="flex w-11 flex-col items-center gap-1 transition-opacity hover:opacity-80 active:opacity-70"
          >
            <CircleX size={30} className="fill-[#e94b4b] text-white" />
            <span className="text-[10px] text-black">削除</span>
          </button>
          <PinToHomeAction
            pinned={!!route.pinnedToHome}
            label="ホームに追加"
            onClick={onTogglePin}
          />
        </>
      }
    >
      <div className="flex h-[90px] w-full items-center justify-between gap-1 px-4 py-2">
        <div className="flex min-w-0 flex-col justify-center gap-1">
          <p className="truncate text-[10px] text-black">
            {route.departure.name}から{route.destination.name}まで
          </p>

          {trip ? (
            <>
              <div className="flex flex-wrap items-center gap-1">
                {trip.isNextDay && (
                  <span className="rounded bg-[#a0e25e] px-1 text-[10px] font-bold text-white">
                    翌日
                  </span>
                )}
                <span className="text-2xl font-bold text-black">{trip.departureTime}</span>
                <span className="h-px w-3 shrink-0 bg-black" />
                <span className="text-2xl font-bold text-black">{trip.arrivalTime}</span>
                <span className="text-xs text-black">（{trip.durationMinutes}分）</span>
                <span className="text-[11px] text-black">
                  残り<span className="font-bold">{remainingLabel}</span>
                </span>
              </div>
              <div className="flex items-center gap-2 text-[11px] text-black">
                <span className="font-bold">{trip.fare}円</span>
                <span className="h-[11px] w-px bg-black/20" />
                <span>乗換{trip.transferCount > 0 ? `${trip.transferCount}回` : "無"}</span>
              </div>
            </>
          ) : (
            <p className="text-xs text-black/40">
              {trip === undefined
                ? "運行情報を取得中..."
                : "本日の運行は終了、または利用可能な便が見つかりません"}
            </p>
          )}
        </div>

        <ChevronRight size={14} className="shrink-0 text-black" />
      </div>
    </SwipeRevealRow>
  );
}
