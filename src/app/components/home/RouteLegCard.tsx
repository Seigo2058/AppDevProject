"use client";

import { useEffect, useState } from "react";
import { LucideIcon } from "lucide-react";
import { timeToMinutes } from "@/lib/generalRouteSearch";

interface RouteLegCardProps {
  label: string;
  icon: LucideIcon;
  placeName: string;
  agencyName: string;
  departureTime: string;
  /** 出発日が何日先か。翌日以降の便を跨いで残り時間を出すために使う。 */
  dayOffset?: number;
}

function formatCountdown(departureTime: string, dayOffset: number): string {
  const depMins = timeToMinutes(departureTime);
  if (depMins === -1) return "-";

  const now = new Date();
  const diff = depMins + dayOffset * 24 * 60 - (now.getHours() * 60 + now.getMinutes());
  if (diff < 0) return "-";

  return `${Math.floor(diff / 60)}:${String(diff % 60).padStart(2, "0")}`;
}

export default function RouteLegCard({
  label,
  icon: Icon,
  placeName,
  agencyName,
  departureTime,
  dayOffset = 0,
}: RouteLegCardProps) {
  // 出発までの残り時間は現在時刻に依存するため、SSRとの不一致を避けてマウント後に算出する。
  const [countdown, setCountdown] = useState<string | null>(null);

  useEffect(() => {
    setCountdown(formatCountdown(departureTime, dayOffset));
    const id = setInterval(() => setCountdown(formatCountdown(departureTime, dayOffset)), 30_000);
    return () => clearInterval(id);
  }, [departureTime, dayOffset]);

  return (
    <div className="w-full flex flex-col gap-4">
      <p className="text-xs font-medium text-black">{label}</p>

      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-1 min-w-0">
          <Icon size={36} strokeWidth={1.5} className="shrink-0 text-black" />
          <div className="min-w-0 flex flex-col gap-1 justify-center">
            <p className="text-base font-bold text-[#121212] truncate">{placeName}</p>
            <p className="text-[11px] text-black/60 truncate">{agencyName}</p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-4 shrink-0">
          <div className="flex items-end gap-1">
            <span className="text-[32px] font-bold leading-none text-[#161616]">
              {departureTime}
            </span>
            <span className="text-[11px] leading-[11px] text-[#737373]">発</span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-[11px] leading-none text-black/60">出発まで</span>
            <span className="text-lg font-bold leading-none text-black">
              {countdown ?? "-"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
