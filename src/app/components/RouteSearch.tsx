"use client";

import { useState, useCallback } from "react";
import {
  Search,
  MapPin,
  ArrowUpDown,
  Loader2,
  Navigation2,
  Clock,
  AlertCircle,
  Train,
  Bus,
  Footprints,
  ChevronRight,
} from "lucide-react";
import Link from "next/link";

interface RouteSection {
  type: "point" | "move";
  name?: string;
  transport?: { name?: string; type?: string };
  time?: number;
  line_name?: string;
}

interface RouteItem {
  summary?: {
    move?: {
      time?: number;
      fare?: { unit_0?: number };
      reference_fare?: { lowest_total_ticket?: number };
    };
  };
  sections?: RouteSection[];
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

export default function RouteSearch() {
  const [departure, setDeparture] = useState("");
  const [destination, setDestination] = useState("");
  const [result, setResult] = useState<RouteItem | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const swapLocations = () => {
    setDeparture(destination);
    setDestination(departure);
  };

  const handleSearch = useCallback(async () => {
    if (!departure.trim() || !destination.trim()) {
      setError("出発地と目的地を入力してください");
      return;
    }
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const depRes = await fetch(`/api/navitime/node?word=${encodeURIComponent(departure)}`);
      const depData = await depRes.json();
      if (!depData.items?.length) throw new Error(`出発地「${departure}」が見つかりませんでした`);

      const destRes = await fetch(`/api/navitime/node?word=${encodeURIComponent(destination)}`);
      const destData = await destRes.json();
      if (!destData.items?.length) throw new Error(`目的地「${destination}」が見つかりませんでした`);

      const depId = depData.items[0].id;
      const destId = destData.items[0].id;

      const routeRes = await fetch(`/api/navitime/route_transit?start=${depId}&goal=${destId}`);
      const routeData = await routeRes.json();
      if (!routeData.items?.length) throw new Error("経路が見つかりませんでした");

      setResult(routeData.items[0]);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "検索中にエラーが発生しました");
    } finally {
      setLoading(false);
    }
  }, [departure, destination]);

  const moveSections = result?.sections?.filter((s) => s.type === "move") ?? [];

  return (
    <section className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-black text-gray-700 flex items-center gap-2">
          <Navigation2 size={16} className="text-blue-500" />
          経路検索
        </h2>
        <Link
          href="/routes"
          className="text-xs font-bold text-blue-500 hover:text-blue-700 flex items-center gap-0.5"
        >
          詳細検索
          <ChevronRight size={13} />
        </Link>
      </div>

      <div className="space-y-2">
        <div className="flex gap-2">
          <div className="flex-1 space-y-1.5">
            <div className="relative">
              <MapPin size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-blue-500" />
              <input
                type="text"
                id="home-route-departure"
                placeholder="出発地"
                value={departure}
                onChange={(e) => setDeparture(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                className="w-full pl-8 pr-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-800 font-bold placeholder:text-gray-400 placeholder:font-normal focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
              />
            </div>
            <div className="relative">
              <MapPin size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-red-500" />
              <input
                type="text"
                id="home-route-destination"
                placeholder="目的地"
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                className="w-full pl-8 pr-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-800 font-bold placeholder:text-gray-400 placeholder:font-normal focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
              />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <button
              onClick={swapLocations}
              className="flex-1 bg-gray-100 hover:bg-gray-200 rounded-lg px-2 flex items-center justify-center transition-colors"
              aria-label="入れ替え"
            >
              <ArrowUpDown size={15} className="text-gray-500" />
            </button>
            <button
              id="home-route-search-btn"
              onClick={handleSearch}
              disabled={loading}
              className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg px-3 flex items-center justify-center transition-colors"
            >
              {loading ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Search size={16} />
              )}
            </button>
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 bg-red-50 rounded-lg p-2.5 border border-red-200">
            <AlertCircle size={14} className="text-red-500 shrink-0" />
            <p className="text-xs font-bold text-red-600">{error}</p>
          </div>
        )}

        {result && (
          <div className="bg-blue-50 rounded-xl p-3 border border-blue-100 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-blue-800">
                <Clock size={15} />
                <span className="text-lg font-black">
                  {result.summary?.move?.time ?? "—"}
                  <span className="text-xs font-bold ml-0.5">分</span>
                </span>
              </div>
              <span className="text-sm font-bold text-gray-600">{getFareDisplay(result)}</span>
            </div>
            {moveSections.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {moveSections.map((s, i) => {
                  const icon = getTransportIcon(s);
                  const Icon = icon === "walk" ? Footprints : icon === "bus" ? Bus : Train;
                  const name = s.transport?.name ?? s.line_name ?? "徒歩";
                  const colors: Record<string, string> = {
                    walk: "bg-gray-100 text-gray-600",
                    bus: "bg-blue-100 text-blue-700",
                    train: "bg-emerald-100 text-emerald-700",
                  };
                  return (
                    <span key={i} className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${colors[icon]}`}>
                      <Icon size={10} />
                      {name}
                    </span>
                  );
                })}
              </div>
            )}
            <Link
              href="/routes"
              className="block text-center text-xs font-bold text-blue-600 hover:text-blue-800 mt-1"
            >
              詳細を見る →
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}
