import { LucideIcon } from "lucide-react";

interface RouteLegCardProps {
  label: string;
  methodLabel: string;
  departureTime: string;
  departureStop: string;
  departureIcon: LucideIcon;
  arrivalTime: string;
  arrivalStop: string;
  arrivalIcon: LucideIcon;
}

export default function RouteLegCard({
  label,
  methodLabel,
  departureTime,
  departureStop,
  departureIcon: DepartureIcon,
  arrivalTime,
  arrivalStop,
  arrivalIcon: ArrivalIcon,
}: RouteLegCardProps) {
  return (
    <div className="w-full space-y-2">
      <p className="text-[11px] text-black/70">{label}</p>
      <div className="bg-[#fbfbfb] border border-[#e8e8e8] shadow-sm rounded-lg px-4 py-2 flex items-start justify-center gap-2">
        <div className="w-[72px] shrink-0 flex flex-col gap-1.5 justify-center">
          <span className="text-xs text-black/50">出発時刻</span>
          <span className="text-base font-bold text-black">{departureTime}</span>
          <span className="flex items-center gap-1 text-[10px] text-black">
            <DepartureIcon size={13} className="text-gray-500 shrink-0" />
            {departureStop}
          </span>
        </div>

        <div className="flex-1 min-w-0 flex flex-col items-center justify-center gap-1 pt-2.5">
          <div className="w-full border-t border-dashed border-gray-300" />
          <span className="text-[10px] text-black/60 whitespace-nowrap">{methodLabel}</span>
        </div>

        <div className="w-[72px] shrink-0 flex flex-col gap-1.5 items-end justify-center">
          <span className="text-xs text-black/50">到着時刻</span>
          <span className="text-base font-bold text-black">{arrivalTime}</span>
          <span className="flex items-center gap-1 text-[10px] text-black">
            <ArrivalIcon size={13} className="text-gray-500 shrink-0" />
            {arrivalStop}
          </span>
        </div>
      </div>
    </div>
  );
}
