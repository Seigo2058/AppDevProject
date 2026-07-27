"use client";

import { ChevronRight } from "lucide-react";
import type { SearchResultJourney } from "@/lib/generalRouteSearch";

interface RouteResultCardProps {
  journey: SearchResultJourney;
  onClick: () => void;
}

// "若葉一丁目(バス) > 新29" のように経路の内訳を1行にまとめる
function buildRouteSummary(journey: SearchResultJourney): string {
  if (journey.segments.length === 0) return journey.routeName;

  return journey.segments
    .map((segment) => {
      if (segment.mode === "walk") return "徒歩";
      return segment.routeName || segment.fromStop;
    })
    .join(" > ");
}

export default function RouteResultCard({ journey, onClick }: RouteResultCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-between gap-2 rounded-lg bg-[#fafafa] px-4 py-3 text-left transition-colors hover:bg-[#e6e6e6] active:bg-[#dcdcdc]"
    >
      <div className="flex min-w-0 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-1">
          <span className="text-2xl font-bold text-black">{journey.departureTime}</span>
          <span className="h-px w-3 shrink-0 bg-black" />
          <span className="text-2xl font-bold text-black">{journey.arrivalTime}</span>
          <span className="text-xs text-black">（{journey.durationMinutes}分）</span>
        </div>

        <p className="truncate text-[11px] text-black">{buildRouteSummary(journey)}</p>

        <div className="flex items-center gap-2 text-[11px] text-black">
          <span className="font-bold">{journey.fare}円</span>
          <span className="h-[11px] w-px bg-black/20" />
          <span>乗換{journey.transferCount > 0 ? "有" : "無"}</span>
        </div>
      </div>

      <ChevronRight size={16} className="shrink-0 text-black" />
    </button>
  );
}
