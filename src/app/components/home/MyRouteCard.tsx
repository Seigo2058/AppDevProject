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
}: MyRouteCardProps) {
  return (
    <Link
      href="/routes"
      className="w-full bg-[#fafafa] shadow-sm rounded-lg h-[90px] px-4 py-2 flex items-center gap-1 active:bg-gray-100 transition-colors"
    >
      <div className="flex-1 min-w-0 flex flex-col gap-1">
        <p className="text-[10px] text-black truncate">
          {fromName}から{toName}まで
        </p>
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="text-2xl font-bold text-black">{departureTime}</span>
          <span className="text-2xl font-bold text-black/30">-</span>
          <span className="text-2xl font-bold text-black">{arrivalTime}</span>
          <span className="text-xs text-black">（{durationMinutes}分）</span>
          <span className="text-[11px] text-black">
            残り<span className="font-bold">{remainingLabel}</span>
          </span>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-black">
          <span className="font-bold">{fare}円</span>
          <span className="text-black/30">|</span>
          <span>乗換{transferLabel}</span>
        </div>
      </div>
      <ChevronRight size={14} className="text-gray-400 shrink-0" />
    </Link>
  );
}
