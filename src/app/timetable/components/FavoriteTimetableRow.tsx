"use client";

import { useRouter } from "next/navigation";
import { ChevronRight, CircleX } from "lucide-react";
import SwipeRevealRow, { PinToHomeAction } from "@/components/SwipeRevealRow";
import type { TimetableInfo } from "@/lib/timetableData";

// 削除＋ホームに追加の2ボタンぶん
const REVEAL_WIDTH = 124;

const ACCENT = "#a0e25e";

// TransitAPI/CSVのどちらも運賃・乗換回数を返さないため、Figmaデザインの見た目を
// 再現する目的の仮値。実データ連携が決まり次第、実際の値に差し替える。
const DUMMY_FARE = 250;
const DUMMY_TRANSFER_COUNT = 0;

// 編集モードの切り替え時は呼び出し側が key を変えて再マウントし、個別スワイプ状態を捨てる。
interface FavoriteTimetableRowProps {
  info: TimetableInfo;
  stopName: string;
  /** ホーム画面の「登録時刻」に表示中か */
  pinnedToHome: boolean;
  /** 編集モード中は全カードを開いた状態にする */
  editing: boolean;
  onDelete: () => void;
  onTogglePin: () => void;
}

export default function FavoriteTimetableRow({
  info,
  stopName,
  pinnedToHome,
  editing,
  onDelete,
  onTogglePin,
}: FavoriteTimetableRowProps) {
  const router = useRouter();

  return (
    <SwipeRevealRow
      editing={editing}
      revealWidth={REVEAL_WIDTH}
      onOpen={() =>
        router.push(
          `/timetable/view?route_id=${info.route_id}&stop_name=${encodeURIComponent(stopName)}`
        )
      }
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
          <PinToHomeAction pinned={pinnedToHome} label="ホームに追加" onClick={onTogglePin} />
        </>
      }
    >
      <div className="flex w-full items-center gap-2 px-4 py-3">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-1 text-[10px] text-black/70">
            <span>{stopName}</span>
            <span>から</span>
            <span>{info.direction}</span>
            <span>方面</span>
          </div>
          <div className="flex items-center gap-2">
            <span
              className="shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold"
              style={{ color: ACCENT, borderColor: ACCENT, backgroundColor: `${ACCENT}1a` }}
            >
              {info.transportType}
            </span>
            <span className="truncate text-xs font-medium text-black/50">{info.agencyName}</span>
          </div>
          <p className="truncate text-base font-bold leading-tight text-black">{info.routeName}</p>
          <div className="flex items-center gap-2 text-[11px] text-black">
            <span className="font-bold">{DUMMY_FARE}円</span>
            <span className="text-black/20">|</span>
            <span>{DUMMY_TRANSFER_COUNT > 0 ? `乗換${DUMMY_TRANSFER_COUNT}回` : "乗換無"}</span>
          </div>
        </div>

        <ChevronRight size={16} className="shrink-0 text-black/30" />
      </div>
    </SwipeRevealRow>
  );
}
