"use client";

import { ArrowDownUp, ChevronDown } from "lucide-react";
import type { BoardingSelection } from "@/lib/schedule";
import type { TimeMode } from "./DateTimePickerSheet";
import Button from "@/components/ui/Button";

interface RouteSearchFormProps {
  departure: BoardingSelection | null;
  destination: BoardingSelection | null;
  date: string;
  time: string;
  mode: TimeMode;
  onPickLocation: (field: "departure" | "destination") => void;
  onSwap: () => void;
  onOpenTimePicker: () => void;
  /** 検索結果画面では検索ボタンを出さないため省略できる。 */
  onSearch?: () => void;
}

const WEEKDAY_LABELS = ["日", "月", "火", "水", "木", "金", "土"];

export function formatDateTimeLabel(date: string, time: string, mode: TimeMode): string {
  if (mode === "now") return "現在時刻で出発";

  const d = new Date(`${date}T00:00:00`);
  const suffix = mode === "arrival" ? "に到着" : "に出発";
  if (isNaN(d.getTime())) return `${time}${suffix}`;

  return `${d.getMonth() + 1}/${d.getDate()}(${WEEKDAY_LABELS[d.getDay()]}) ${time}${suffix}`;
}

export default function RouteSearchForm({
  departure,
  destination,
  date,
  time,
  mode,
  onPickLocation,
  onSwap,
  onOpenTimePicker,
  onSearch,
}: RouteSearchFormProps) {
  return (
    <div className="flex flex-col gap-2">
      <div className="relative flex flex-col gap-2">
        {[
          { field: "departure" as const, label: "出発", value: departure, placeholder: "出発地点" },
          { field: "destination" as const, label: "到着", value: destination, placeholder: "到着地点" },
        ].map((row) => (
          <button
            key={row.field}
            type="button"
            onClick={() => onPickLocation(row.field)}
            className="flex h-11 w-full items-center gap-3 rounded-lg bg-white pl-[22px] pr-4 text-left transition-colors hover:bg-[#ebebeb] active:bg-[#e0e0e0]"
          >
            <span className="shrink-0 text-sm text-[#232323]">{row.label}</span>
            <span className="h-[34px] w-px shrink-0 bg-gray-300" />
            <span
              className={`min-w-0 flex-1 truncate text-sm ${
                row.value ? "text-black" : "text-[#232323]/50"
              }`}
            >
              {row.value?.name ?? row.placeholder}
            </span>
          </button>
        ))}

        {/* 2つの入力欄の境目に重ねる入れ替えボタン */}
        <button
          type="button"
          onClick={onSwap}
          aria-label="出発地と到着地を入れ替える"
          className="absolute right-[17px] top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-full bg-[#142547] text-white shadow-md transition-colors hover:bg-[#12203e] active:bg-[#101c37]"
        >
          <ArrowDownUp size={16} />
        </button>
      </div>

      <button
        type="button"
        onClick={onOpenTimePicker}
        className="flex w-full items-center justify-center gap-2.5 rounded-lg bg-white py-2.5 pl-2.5 pr-5 transition-colors hover:bg-[#ebebeb] active:bg-[#e0e0e0]"
      >
        <span className="text-base text-black">{formatDateTimeLabel(date, time, mode)}</span>
        <ChevronDown size={14} className="shrink-0 text-black" />
      </button>

      {onSearch && (
        <Button onClick={onSearch} className="mt-1">
          検索する
        </Button>
      )}
    </div>
  );
}
