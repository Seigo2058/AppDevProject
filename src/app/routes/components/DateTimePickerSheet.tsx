"use client";

import { useEffect, useRef, useState } from "react";

// 行ピッチ34px・可視5行。選択行は中央の帯で示す。
const ITEM_HEIGHT = 34;
const VISIBLE_ROWS = 5;
const WHEEL_HEIGHT = ITEM_HEIGHT * VISIBLE_ROWS;
const PAD_ROWS = Math.floor(VISIBLE_ROWS / 2);

export type TimeMode = "now" | "departure" | "arrival";

interface DateTimePickerSheetProps {
  open: boolean;
  /** "YYYY-MM-DD" */
  date: string;
  /** "HH:MM" */
  time: string;
  mode: TimeMode;
  onCancel: () => void;
  onConfirm: (value: { date: string; time: string; mode: TimeMode }) => void;
}

function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// 今日を中心に前後の日付候補を作る。当日は「今日」と表示する。
function buildDateOptions(): { key: string; label: string }[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const options: { key: string; label: string }[] = [];
  for (let offset = -7; offset <= 30; offset++) {
    const d = new Date(today);
    d.setDate(d.getDate() + offset);
    options.push({
      key: toDateKey(d),
      label: offset === 0 ? "今日" : `${d.getMonth() + 1}月${d.getDate()}日`,
    });
  }
  return options;
}

interface WheelColumnProps {
  items: { key: string; label: string }[];
  selectedKey: string;
  onSelect: (key: string) => void;
  className?: string;
}

function WheelColumn({ items, selectedKey, onSelect, className }: WheelColumnProps) {
  const ref = useRef<HTMLDivElement>(null);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const selectedIndex = Math.max(0, items.findIndex((item) => item.key === selectedKey));

  // 外部から値が変わったとき、その行が中央に来るようスクロール位置を合わせる。
  // 位置合わせ後のindexは必ずselectedKeyと一致するため、下のcommitは何も起こさず無限ループにならない。
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const target = selectedIndex * ITEM_HEIGHT;
    if (Math.abs(el.scrollTop - target) > 1) el.scrollTop = target;
  }, [selectedIndex]);

  // スクロールが止まった時点で中央の行を選択として確定する。
  const commitSelection = () => {
    const el = ref.current;
    if (!el) return;
    const index = Math.round(el.scrollTop / ITEM_HEIGHT);
    const item = items[Math.min(items.length - 1, Math.max(0, index))];
    if (item && item.key !== selectedKey) onSelect(item.key);
  };

  // scrollend が使えるブラウザではそれを優先し、無い場合のみデバウンスで代替する。
  const handleScroll = () => {
    if (typeof window === "undefined" || "onscrollend" in window) return;
    if (settleTimer.current) clearTimeout(settleTimer.current);
    settleTimer.current = setTimeout(commitSelection, 150);
  };

  useEffect(() => {
    return () => {
      if (settleTimer.current) clearTimeout(settleTimer.current);
    };
  }, []);

  // 中央以外の行はタップでその行まで滑らかにスクロールさせて選択する。
  const handleRowClick = (index: number, key: string) => {
    const el = ref.current;
    if (!el) return;
    el.scrollTo({ top: index * ITEM_HEIGHT, behavior: "smooth" });
    if (key !== selectedKey) onSelect(key);
  };

  return (
    <div
      ref={ref}
      onScroll={handleScroll}
      onScrollEnd={commitSelection}
      className={`h-full overflow-y-auto snap-y snap-mandatory [scrollbar-width:none] [&::-webkit-scrollbar]:hidden [mask-image:linear-gradient(to_bottom,transparent_0%,#000_30%,#000_70%,transparent_100%)] [-webkit-mask-image:linear-gradient(to_bottom,transparent_0%,#000_30%,#000_70%,transparent_100%)] ${className ?? ""}`}
      style={{ paddingTop: PAD_ROWS * ITEM_HEIGHT, paddingBottom: PAD_ROWS * ITEM_HEIGHT }}
    >
      {items.map((item, index) => (
        <button
          type="button"
          key={item.key}
          onClick={() => handleRowClick(index, item.key)}
          className={`snap-center flex w-full items-center justify-center tabular-nums transition-all ${
            item.key === selectedKey
              ? "text-[17px] font-semibold text-black"
              : "text-base text-black/45"
          }`}
          style={{ height: ITEM_HEIGHT }}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

export default function DateTimePickerSheet({
  open,
  date,
  time,
  mode,
  onCancel,
  onConfirm,
}: DateTimePickerSheetProps) {
  const [dateOptions] = useState(buildDateOptions);
  const [draftDate, setDraftDate] = useState(date);
  const [draftHour, setDraftHour] = useState(() => time.split(":")[0] ?? "00");
  const [draftMinute, setDraftMinute] = useState(() => time.split(":")[1] ?? "00");
  const [draftMode, setDraftMode] = useState<TimeMode>(mode);

  // 開くたびに呼び出し元の現在値を初期表示にする
  useEffect(() => {
    if (!open) return;
    setDraftDate(date);
    setDraftHour(time.split(":")[0] ?? "00");
    setDraftMinute(time.split(":")[1] ?? "00");
    setDraftMode(mode);
  }, [open, date, time, mode]);

  // シート表示中は背面のページがスクロールしないようにする
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  // Escapeで閉じる
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onCancel]);

  if (!open) return null;

  const hours = Array.from({ length: 24 }, (_, i) => {
    const key = String(i).padStart(2, "0");
    return { key, label: key };
  });
  const minutes = Array.from({ length: 60 }, (_, i) => {
    const key = String(i).padStart(2, "0");
    return { key, label: key };
  });

  const isNow = draftMode === "now";

  // 「現在時刻」を選んだときはホイールを今の時刻に合わせ、そこから回せるようにする。
  const handleModeChange = (next: TimeMode) => {
    setDraftMode(next);
    if (next !== "now") return;
    const now = new Date();
    setDraftDate(toDateKey(now));
    setDraftHour(String(now.getHours()).padStart(2, "0"));
    setDraftMinute(String(now.getMinutes()).padStart(2, "0"));
  };

  // 「現在時刻」のままホイールを回したら、時刻指定の意思表示とみなして「出発」に切り替える。
  // 外部要因によるスクロール位置の同期はonSelectを呼ばないため、ここが誤発火することはない。
  const handleWheelSelect = (apply: (value: string) => void) => (value: string) => {
    apply(value);
    if (isNow) setDraftMode("departure");
  };

  const handleConfirm = () => {
    if (isNow) {
      const now = new Date();
      onConfirm({
        date: toDateKey(now),
        time: `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`,
        mode: "now",
      });
      return;
    }
    onConfirm({ date: draftDate, time: `${draftHour}:${draftMinute}`, mode: draftMode });
  };

  const modes: { key: TimeMode; label: string }[] = [
    { key: "now", label: "現在時刻" },
    { key: "departure", label: "出発" },
    { key: "arrival", label: "到着" },
  ];

  return (
    <div className="fixed inset-0 z-50 mx-auto flex max-w-[600px] flex-col justify-end">
      <button
        type="button"
        aria-label="閉じる"
        onClick={onCancel}
        className="flex-1 bg-black/30 transition-opacity"
      />

      <div className="shrink-0 rounded-t-[20px] bg-[#f4f4f6] shadow-[0_-8px_30px_rgba(0,0,0,0.18)]">
        {/* 現在時刻 / 出発 / 到着 */}
        <div className="px-4 pt-4 pb-3">
          <div className="flex gap-0.5 rounded-[10px] bg-black/[0.06] p-0.5">
            {modes.map((item) => {
              const active = draftMode === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => handleModeChange(item.key)}
                  className={`flex-1 rounded-lg py-1.5 text-sm transition-all ${
                    active
                      ? "bg-white font-bold text-black shadow-[0_1px_3px_rgba(0,0,0,0.12)]"
                      : "text-black/55 active:text-black"
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* 列の見出し。どの列が日付・時・分かを判別できるようにする。 */}
        <div
          className="mx-auto flex w-full max-w-[260px] text-[11px] tracking-wide text-black/35"
        >
          <span className="flex-[1.6] text-center">日付</span>
          <span className="flex-1 text-center">時</span>
          <span className="flex-1 text-center">分</span>
        </div>

        {/* 日付・時・分のドラムロール */}
        <div className="relative px-4" style={{ height: WHEEL_HEIGHT }}>
          {/* 選択行を示す帯。ホイールより背面に置き、操作を妨げない。 */}
          <div
            className="pointer-events-none absolute left-1/2 top-1/2 w-full max-w-[292px] -translate-x-1/2 -translate-y-1/2 rounded-[10px] bg-black/[0.06]"
            style={{ height: ITEM_HEIGHT }}
          />
          <div
            className="relative mx-auto flex h-full w-full max-w-[260px]"
          >
            <WheelColumn
              items={dateOptions}
              selectedKey={draftDate}
              onSelect={handleWheelSelect(setDraftDate)}
              className="flex-[1.6]"
            />
            <WheelColumn
              items={hours}
              selectedKey={draftHour}
              onSelect={handleWheelSelect(setDraftHour)}
              className="flex-1"
            />
            <WheelColumn
              items={minutes}
              selectedKey={draftMinute}
              onSelect={handleWheelSelect(setDraftMinute)}
              className="flex-1"
            />
          </div>
        </div>

        {/* キャンセル / 完了 */}
        <div className="flex gap-3 px-4 pt-3 pb-4 pb-safe">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-[10px] bg-black/[0.06] py-3 text-base text-black/70 transition-colors hover:bg-black/10 active:bg-black/12"
          >
            キャンセル
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="flex-1 rounded-[10px] bg-[#a0e25e] py-3 text-base font-bold text-black transition-colors hover:bg-[#93d057] active:bg-[#8dc753]"
          >
            完了
          </button>
        </div>
      </div>
    </div>
  );
}
