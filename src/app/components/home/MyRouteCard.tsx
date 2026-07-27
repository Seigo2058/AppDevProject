import Link from "next/link";
import { ChevronRight } from "lucide-react";

interface MyRouteCardProps {
  fromName: string;
  toName: string;
  departureTime: string;
  arrivalTime: string;
  durationMinutes: number;
  remainingLabel: string;
  fare: number;
  transferLabel: string;
  isNextDay?: boolean;
}

export default function MyRouteCard({
  fromName,
  toName,
  departureTime,
  arrivalTime,
  durationMinutes,
  remainingLabel,
  fare,
  transferLabel,
  isNextDay,
}: MyRouteCardProps) {
  return (
    <Link
      href="/routes"
      className="w-full bg-[#fafafa] rounded-lg h-[90px] px-4 py-2 flex items-center justify-between gap-1 transition-colors hover:bg-[#e6e6e6] active:bg-[#dcdcdc]"
    >
      <div className="min-w-0 flex flex-col gap-1 justify-center">
        <p className="text-[10px] text-black truncate">
          {fromName} から {toName} まで
        </p>
        <div className="flex items-center gap-1 flex-wrap">
          {isNextDay && (
            <span className="rounded bg-[#a0e25e] px-1 text-[10px] font-bold text-white">
              翌日
            </span>
          )}
          <span className="text-2xl font-bold text-black">{departureTime}</span>
          <span className="w-3 h-px bg-black shrink-0" />
          <span className="text-2xl font-bold text-black">{arrivalTime}</span>
          <span className="text-xs text-black">（<span className="font-bold">{durationMinutes}</span>分）</span>
          <span className="text-[11px] text-black">
            残り <span className="font-bold">{remainingLabel}</span>
          </span>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-black">
          <span className="font-bold">{fare} 円</span>
          <span className="w-px h-[11px] bg-black/20" />
          <span>乗換 {transferLabel}</span>
        </div>
      </div>
      <ChevronRight size={14} className="text-black shrink-0" />
    </Link>
  );
}
