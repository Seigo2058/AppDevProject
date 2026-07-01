"use client";

import { useState, useCallback } from "react";
import {
  Search,
  MapPin,
  ArrowUpDown,
  Clock,
  Train,
  Bus,
  Footprints,
  ChevronDown,
  ChevronUp,
  CalendarDays,
  Loader2,
  Navigation2,
  AlertCircle,
  Star,
  Zap,
  TrendingDown,
} from "lucide-react";

interface RouteSection {
  type: "point" | "move";
  name?: string;
  transport?: { name?: string; type?: string };
  time?: number;
  distance?: number;
  line_name?: string;
}

interface RouteItem {
  summary?: {
    move?: {
      time?: number;
      fare?: { unit_0?: number };
      reference_fare?: { lowest_total_ticket?: number };
      distance?: number;
    };
  };
  sections?: RouteSection[];
}

interface SearchState {
  status: "idle" | "loading" | "success" | "error";
  results: RouteItem[];
  error?: string;
}

function getTransportIcon(section: RouteSection) {
  const typeName = section.transport?.type?.toLowerCase() ?? "";
  const name = (section.transport?.name ?? section.line_name ?? "").toLowerCase();
  if (typeName.includes("walk") || name.includes("徒歩")) return "walk";
  if (typeName.includes("bus") || name.includes("バス")) return "bus";
  return "train";
}

function getFareDisplay(item: RouteItem): string {
  const fare = item.summary?.move?.fare?.unit_0;
  if (fare !== undefined) return `¥${fare.toLocaleString()}`;
  const ref = item.summary?.move?.reference_fare?.lowest_total_ticket;
  if (ref !== undefined) return `¥${ref.toLocaleString()}`;
  return "運賃不明";
}

function getTransferCount(item: RouteItem): number {
  if (!item.sections) return 0;
  const points = item.sections.filter((s) => s.type === "point" && s.name);
  return Math.max(0, points.length - 2);
}

function getBadge(
  idx: number,
  item: RouteItem,
  allItems: RouteItem[]
): { label: string; color: string } | null {
  if (idx === 0) return { label: "おすすめ", color: "bg-blue-500" };
  const mine = item.summary?.move?.time ?? Infinity;
  const minTime = Math.min(
    ...allItems.map((r) => r.summary?.move?.time ?? Infinity)
  );
  const myFare =
    item.summary?.move?.fare?.unit_0 ??
    item.summary?.move?.reference_fare?.lowest_total_ticket ??
    Infinity;
  const minFare = Math.min(
    ...allItems.map((r) => {
      const f = r.summary?.move?.fare?.unit_0;
      const rf = r.summary?.move?.reference_fare?.lowest_total_ticket;
      return f ?? rf ?? Infinity;
    })
  );
  if (mine === minTime) return { label: "最速", color: "bg-emerald-500" };
  if (myFare === minFare) return { label: "最安", color: "bg-orange-500" };
  return null;
}

function TransportBadge({ section }: { section: RouteSection }) {
  const icon = getTransportIcon(section);
  const name = section.transport?.name ?? section.line_name ?? "徒歩・その他";
  const time = section.time ?? 0;
  const colors: Record<string, string> = {
    walk: "bg-gray-100 text-gray-600 border-gray-200",
    bus: "bg-blue-50 text-blue-700 border-blue-200",
    train: "bg-emerald-50 text-emerald-700 border-emerald-200",
  };
  const Icon = icon === "walk" ? Footprints : icon === "bus" ? Bus : Train;
  return (
    <div
      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-bold ${colors[icon]}`}
    >
      <Icon size={12} />
      <span className="max-w-[120px] truncate">{name}</span>
      <span className="opacity-60">·{time}分</span>
    </div>
  );
}

function RouteCard({
  item,
  index,
  allItems,
}: {
  item: RouteItem;
  index: number;
  allItems: RouteItem[];
}) {
  const [expanded, setExpanded] = useState(false);
  const time = item.summary?.move?.time;
  const badge = getBadge(index, item, allItems);
  const transfers = getTransferCount(item);
  const moveSections = item.sections?.filter((s) => s.type === "move") ?? [];

  return (
    <div
      className={`bg-white rounded-2xl shadow-sm border overflow-hidden transition-all duration-300 ${
        index === 0
          ? "border-blue-200 shadow-blue-50 shadow-md"
          : "border-gray-100"
      }`}
    >
      <div className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2 flex-wrap">
            {badge && (
              <span
                className={`${badge.color} text-white text-[10px] font-black px-2.5 py-1 rounded-full flex items-center gap-1`}
              >
                {badge.label === "おすすめ" && <Star size={10} />}
                {badge.label === "最速" && <Zap size={10} />}
                {badge.label === "最安" && <TrendingDown size={10} />}
                {badge.label}
              </span>
            )}
            {transfers > 0 ? (
              <span className="bg-gray-100 text-gray-600 text-[10px] font-bold px-2.5 py-1 rounded-full">
                乗り換え {transfers}回
              </span>
            ) : (
              <span className="bg-gray-100 text-gray-500 text-[10px] font-bold px-2.5 py-1 rounded-full">
                乗り換えなし
              </span>
            )}
          </div>
          <div className="text-right">
            <p className="text-2xl font-black text-gray-900 leading-none">
              {time !== undefined ? (
                <>
                  {time}
                  <span className="text-sm font-bold text-gray-400 ml-0.5">分</span>
                </>
              ) : (
                "—"
              )}
            </p>
            <p className="text-sm font-bold text-gray-500 mt-0.5">
              {getFareDisplay(item)}
            </p>
          </div>
        </div>
        {moveSections.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {moveSections.map((s, i) => (
              <TransportBadge key={i} section={s} />
            ))}
          </div>
        )}
      </div>

      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-center gap-1 py-2.5 text-xs font-bold text-gray-400 hover:text-gray-600 bg-gray-50 border-t border-gray-100 transition-colors"
      >
        {expanded ? (
          <>
            <ChevronUp size={14} />
            経路を閉じる
          </>
        ) : (
          <>
            <ChevronDown size={14} />
            詳細を見る
          </>
        )}
      </button>

      {expanded && (
        <div className="px-4 py-3 border-t border-gray-100 bg-gray-50">
          {item.sections?.map((section, i) => {
            if (section.type === "point") {
              return (
                <div key={i} className="flex items-center gap-3 py-2">
                  <div className="w-3 h-3 rounded-full bg-blue-500 border-2 border-white shadow-sm shrink-0 ml-0.5" />
                  <span className="text-sm font-bold text-gray-800">
                    {section.name}
                  </span>
                </div>
              );
            } else if (section.type === "move") {
              const icon = getTransportIcon(section);
              const Icon =
                icon === "walk" ? Footprints : icon === "bus" ? Bus : Train;
              const name =
                section.transport?.name ?? section.line_name ?? "徒歩・その他";
              return (
                <div
                  key={i}
                  className="flex items-center gap-3 py-1.5 border-l-2 border-blue-200 ml-1.5 pl-4"
                >
                  <Icon size={13} className="text-gray-400 shrink-0" />
                  <span className="text-xs text-gray-500 font-bold">
                    {name}
                    {section.time !== undefined && (
                      <span className="text-gray-400 font-normal ml-1">
                        ({section.time}分)
                      </span>
                    )}
                  </span>
                </div>
              );
            }
            return null;
          })}
        </div>
      )}
    </div>
  );
}

export default function RoutesPage() {
  const [departure, setDeparture] = useState("");
  const [destination, setDestination] = useState("");
  const [dateTime, setDateTime] = useState(() => {
    const now = new Date();
    const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 16);
  });
  const [timeMode, setTimeMode] = useState<"depart" | "arrive">("depart");
  const [state, setState] = useState<SearchState>({ status: "idle", results: [] });

  const swapLocations = () => {
    setDeparture(destination);
    setDestination(departure);
  };

  const handleSearch = useCallback(async () => {
    if (!departure.trim() || !destination.trim()) {
      setState({ status: "error", results: [], error: "出発地と目的地を入力してください" });
      return;
    }
    setState({ status: "loading", results: [] });
    try {
      const depRes = await fetch(`/api/navitime/node?word=${encodeURIComponent(departure)}`);
      const depData = await depRes.json();
      if (!depData.items || depData.items.length === 0) {
        throw new Error(`出発地「${departure}」が見つかりませんでした`);
      }

      const destRes = await fetch(`/api/navitime/node?word=${encodeURIComponent(destination)}`);
      const destData = await destRes.json();
      if (!destData.items || destData.items.length === 0) {
        throw new Error(`目的地「${destination}」が見つかりませんでした`);
      }

      const depId = depData.items[0].id;
      const destId = destData.items[0].id;
      const startTime = dateTime.slice(0, 16) + ":00";

      const routeRes = await fetch(
        `/api/navitime/route_transit?start=${depId}&goal=${destId}&start_time=${encodeURIComponent(startTime)}`
      );
      const routeData = await routeRes.json();
      if (!routeData.items || routeData.items.length === 0) {
        throw new Error("この区間の経路が見つかりませんでした");
      }
      setState({ status: "success", results: routeData.items });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "検索中にエラーが発生しました";
      setState({ status: "error", results: [], error: message });
    }
  }, [departure, destination, dateTime, timeMode]);

  const isLoading = state.status === "loading";

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-100 px-4 pt-4 pb-5 shadow-sm">
        <h2 className="text-base font-black text-gray-800 mb-4 flex items-center gap-2">
          <Navigation2 size={18} className="text-blue-500" />
          経路検索
        </h2>

        <div className="relative space-y-2">
          <div className="relative">
            <MapPin size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-500 shrink-0" />
            <input
              type="text"
              id="route-departure"
              placeholder="出発地 (例: 札幌駅)"
              value={departure}
              onChange={(e) => setDeparture(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold text-gray-800 placeholder:text-gray-400 placeholder:font-normal focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition-shadow"
            />
          </div>
          <div className="flex justify-center">
            <button
              onClick={swapLocations}
              className="group bg-white border border-gray-200 rounded-full p-2 shadow-sm hover:bg-blue-50 hover:border-blue-300 transition-all active:scale-95"
              aria-label="出発地と目的地を入れ替え"
            >
              <ArrowUpDown size={16} className="text-gray-400 group-hover:text-blue-500 transition-colors" />
            </button>
          </div>
          <div className="relative">
            <MapPin size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-red-500 shrink-0" />
            <input
              type="text"
              id="route-destination"
              placeholder="目的地 (例: 小樽駅)"
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold text-gray-800 placeholder:text-gray-400 placeholder:font-normal focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition-shadow"
            />
          </div>
        </div>

        <div className="mt-3 flex gap-2 items-center">
          <div className="flex rounded-lg border border-gray-200 overflow-hidden shrink-0">
            <button
              onClick={() => setTimeMode("depart")}
              className={`px-3 py-2 text-xs font-bold transition-colors ${timeMode === "depart" ? "bg-blue-500 text-white" : "bg-white text-gray-500 hover:bg-gray-50"}`}
            >
              出発
            </button>
            <button
              onClick={() => setTimeMode("arrive")}
              className={`px-3 py-2 text-xs font-bold transition-colors ${timeMode === "arrive" ? "bg-blue-500 text-white" : "bg-white text-gray-500 hover:bg-gray-50"}`}
            >
              到着
            </button>
          </div>
          <div className="relative flex-1">
            <CalendarDays size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              type="datetime-local"
              value={dateTime}
              onChange={(e) => setDateTime(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs font-bold text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
            />
          </div>
        </div>

        <button
          id="route-search-btn"
          onClick={handleSearch}
          disabled={isLoading}
          className="mt-4 w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-black py-3.5 rounded-xl flex items-center justify-center gap-2 shadow-sm transition-all active:scale-[0.98]"
        >
          {isLoading ? (
            <>
              <Loader2 size={18} className="animate-spin" />
              検索中...
            </>
          ) : (
            <>
              <Search size={18} />
              経路を検索
            </>
          )}
        </button>
      </div>

      <div className="px-4 py-4 space-y-3">
        {state.status === "error" && (
          <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-2xl p-4">
            <AlertCircle size={20} className="text-red-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-red-700">検索エラー</p>
              <p className="text-xs text-red-500 mt-0.5">{state.error}</p>
            </div>
          </div>
        )}

        {state.status === "loading" && (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="bg-white rounded-2xl border border-gray-100 p-4 animate-pulse">
                <div className="flex justify-between items-start mb-3">
                  <div className="flex gap-2">
                    <div className="h-6 w-16 bg-gray-200 rounded-full" />
                    <div className="h-6 w-20 bg-gray-200 rounded-full" />
                  </div>
                  <div className="h-8 w-16 bg-gray-200 rounded-lg" />
                </div>
                <div className="flex gap-2">
                  <div className="h-6 w-24 bg-gray-100 rounded-full" />
                  <div className="h-6 w-20 bg-gray-100 rounded-full" />
                </div>
              </div>
            ))}
          </div>
        )}

        {state.status === "success" && state.results.length > 0 && (
          <>
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold text-gray-400">{state.results.length}件の経路候補</p>
              <p className="text-xs text-gray-400">{departure} → {destination}</p>
            </div>
            {state.results.map((item, i) => (
              <RouteCard key={i} item={item} index={i} allItems={state.results} />
            ))}
          </>
        )}

        {state.status === "idle" && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="bg-blue-50 rounded-full p-6 mb-4">
              <Navigation2 size={40} className="text-blue-400" />
            </div>
            <p className="text-sm font-bold text-gray-500">出発地と目的地を入力して</p>
            <p className="text-sm font-bold text-gray-500">経路を検索しましょう</p>
            <p className="text-xs text-gray-400 mt-2">
              電車・バス・徒歩を組み合わせた<br />最適ルートを提案します
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
