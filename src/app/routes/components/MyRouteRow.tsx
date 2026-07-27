"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronRight, CircleX, Star } from "lucide-react";
import type { SearchResultJourney } from "@/lib/generalRouteSearch";
import type { SavedRoute } from "@/lib/myRoutes";

// 編集操作を表示するために card をどれだけ左へずらすか
const REVEAL_WIDTH = 124;
// これ以上左へドラッグしたら開いたままにする
const SWIPE_THRESHOLD = 40;

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
  const [swipedOpen, setSwipedOpen] = useState(false);
  const [dragOffset, setDragOffset] = useState<number | null>(null);
  const startX = useRef(0);

  // 編集モードを抜けたら個別スワイプも閉じる
  useEffect(() => {
    if (!editing) setSwipedOpen(false);
  }, [editing]);

  const isOpen = editing || swipedOpen;
  const offset = dragOffset ?? (isOpen ? -REVEAL_WIDTH : 0);

  const handleTouchStart = (e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const delta = e.touches[0].clientX - startX.current;
    const base = isOpen ? -REVEAL_WIDTH : 0;
    setDragOffset(Math.max(-REVEAL_WIDTH, Math.min(0, base + delta)));
  };

  const handleTouchEnd = () => {
    if (dragOffset !== null) {
      setSwipedOpen(dragOffset <= -SWIPE_THRESHOLD);
      setDragOffset(null);
    }
  };

  return (
    <div className="relative overflow-hidden rounded-lg">
      {/* 背面の操作。カードがずれた分だけ見えるようになる。 */}
      <div
        className="absolute inset-y-0 right-0 flex items-center justify-end gap-2 pr-1"
        style={{ width: REVEAL_WIDTH }}
      >
        <button
          type="button"
          onClick={onDelete}
          className="flex w-11 flex-col items-center gap-1 transition-opacity hover:opacity-80 active:opacity-70"
        >
          <CircleX size={30} className="fill-[#e94b4b] text-white" />
          <span className="text-[10px] text-black">削除</span>
        </button>
        <button
          type="button"
          onClick={onTogglePin}
          aria-pressed={!!route.pinnedToHome}
          className="flex w-[66px] flex-col items-center gap-1 transition-opacity hover:opacity-80 active:opacity-70"
        >
          <Star
            size={30}
            className={route.pinnedToHome ? "fill-[#a0e25e] text-[#a0e25e]" : "text-[#a0e25e]"}
          />
          <span className="whitespace-nowrap text-[10px] text-black">ホームに追加</span>
        </button>
      </div>

      <button
        type="button"
        onClick={() => (isOpen ? setSwipedOpen(false) : onOpen())}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className="relative flex h-[90px] w-full items-center justify-between gap-1 rounded-lg bg-[#fafafa] px-4 py-2 text-left transition-colors hover:bg-[#e6e6e6] active:bg-[#dcdcdc]"
        style={{
          transform: `translateX(${offset}px)`,
          transition: dragOffset === null ? "transform 200ms ease" : "none",
        }}
      >
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
      </button>
    </div>
  );
}
