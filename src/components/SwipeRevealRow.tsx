"use client";

import { useRef, useState, type ReactNode } from "react";
import { Star } from "lucide-react";

// これ以上左へドラッグしたら開いたままにする
const SWIPE_THRESHOLD = 40;

/**
 * 左スワイプ（または編集モード）でカードをずらし、右側に操作ボタンを覗かせる行。
 * MYルート・登録時刻の各カードで同じ操作感になるよう、ここに集約する。
 *
 * 編集モードを抜けたときに個別スワイプ状態を捨てるため、呼び出し側は
 * editing を含む key を渡して再マウントさせる。
 */
interface SwipeRevealRowProps {
  /** 右側に覗かせる操作ボタン */
  actions: ReactNode;
  /** 操作ボタンを表示するためにカードをずらす幅 */
  revealWidth: number;
  /** 編集モード中は全カードを開いた状態にする */
  editing: boolean;
  /** カード本体をタップしたとき（開いている場合は閉じるだけで呼ばれない） */
  onOpen: () => void;
  children: ReactNode;
}

export default function SwipeRevealRow({
  actions,
  revealWidth,
  editing,
  onOpen,
  children,
}: SwipeRevealRowProps) {
  const [swipedOpen, setSwipedOpen] = useState(false);
  const [dragOffset, setDragOffset] = useState<number | null>(null);
  const startX = useRef(0);

  const isOpen = editing || swipedOpen;
  const offset = dragOffset ?? (isOpen ? -revealWidth : 0);

  const handleTouchStart = (e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const delta = e.touches[0].clientX - startX.current;
    const base = isOpen ? -revealWidth : 0;
    setDragOffset(Math.max(-revealWidth, Math.min(0, base + delta)));
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
        style={{ width: revealWidth }}
      >
        {actions}
      </div>

      <button
        type="button"
        onClick={() => (isOpen ? setSwipedOpen(false) : onOpen())}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className="relative w-full rounded-lg bg-[#fafafa] text-left transition-colors hover:bg-[#e6e6e6] active:bg-[#dcdcdc]"
        style={{
          transform: `translateX(${offset}px)`,
          transition: dragOffset === null ? "transform 200ms ease" : "none",
        }}
      >
        {children}
      </button>
    </div>
  );
}

/** 「ホームに追加」「ホームから削除」の星ボタン。塗りつぶし＝ホーム表示中。 */
export function PinToHomeAction({
  pinned,
  label,
  onClick,
}: {
  pinned: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={pinned}
      className="flex w-[66px] flex-col items-center gap-1 transition-opacity hover:opacity-80 active:opacity-70"
    >
      <Star size={30} className={pinned ? "fill-[#a0e25e] text-[#a0e25e]" : "text-[#a0e25e]"} />
      <span className="whitespace-nowrap text-[10px] text-black">{label}</span>
    </button>
  );
}
