"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Loader2, MapPin } from "lucide-react";
import MyRouteCard from "./MyRouteCard";
import {
  searchRoutes,
  getDayType,
  minutesToTime,
  timeToMinutes,
  SearchResultJourney
} from "@/lib/generalRouteSearch";
import type { BoardingSelection } from "@/lib/schedule";

interface SavedRoute {
  routeId: string;
  routeName: string;
  departure: BoardingSelection;
  destination: BoardingSelection;
}

export default function MyRouteSection() {
  const [myRoutes, setMyRoutes] = useState<SavedRoute[]>([]);
  const [routeTrips, setRouteTrips] = useState<Record<string, SearchResultJourney | null>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadAndFetchRoutes() {
      if (typeof window === "undefined") {
        setLoading(false);
        return;
      }

      try {
        const saved = localStorage.getItem("my_routes");
        if (!saved) {
          setLoading(false);
          return;
        }

        const parsed = JSON.parse(saved) as SavedRoute[];
        if (!Array.isArray(parsed) || parsed.length === 0) {
          setLoading(false);
          return;
        }

        setMyRoutes(parsed);

        const now = new Date();
        const currentMins = now.getHours() * 60 + now.getMinutes();
        const timeStr = minutesToTime(currentMins);
        const dayType = getDayType(now);

        const trips: Record<string, SearchResultJourney | null> = {};
        await Promise.all(
          parsed.map(async (route) => {
            try {
              const results = await searchRoutes(
                route.departure,
                route.destination,
                timeStr,
                "departure",
                dayType
              );
              trips[route.routeId] = results.length > 0 ? results[0] : null;
            } catch (e) {
              console.error(`Failed to fetch trip for route ${route.routeId}:`, e);
              trips[route.routeId] = null;
            }
          })
        );

        setRouteTrips(trips);
      } catch (e) {
        console.error("Failed to load/fetch routes on home page:", e);
      } finally {
        setLoading(false);
      }
    }

    loadAndFetchRoutes();
  }, []);

  const getRemainingTimeText = (departureTime: string): string => {
    const now = new Date();
    const nowMins = now.getHours() * 60 + now.getMinutes();
    const depMins = timeToMinutes(departureTime);
    if (depMins === -1) return "-";
    const diff = depMins - nowMins;

    if (diff < 0) {
      return "運行終了";
    }
    if (diff < 60) {
      return `${diff}分`;
    }
    const hrs = Math.floor(diff / 60);
    const mins = diff % 60;
    return `${hrs}:${String(mins).padStart(2, "0")}`;
  };

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-black">Myルート</h2>
        {myRoutes.length > 0 && (
          <span className="text-[10px] text-black/45">直近の運行便を表示中</span>
        )}
      </div>

      {loading ? (
        <div className="bg-[#fafafa] shadow-sm rounded-lg h-[90px] flex items-center justify-center border border-gray-100">
          <Loader2 size={20} className="animate-spin text-[#aecb72] mr-2" />
          <span className="text-xs text-black/50">マイルート情報を読み込み中...</span>
        </div>
      ) : myRoutes.length === 0 ? (
        <div className="bg-[#fafafa] border border-gray-150 p-6 rounded-lg text-center text-xs text-black/50">
          <MapPin size={24} className="mx-auto mb-2 text-black/20" />
          <p>登録されたマイルートがありません。</p>
          <p className="mt-0.5 text-black/40">ルートタブから新規登録してください。</p>
        </div>
      ) : (
        <div className="space-y-3">
          {myRoutes.map((route) => {
            const trip = routeTrips[route.routeId];
            if (!trip) {
              return (
                <div
                  key={route.routeId}
                  className="w-full bg-[#fafafa] shadow-sm rounded-lg p-3 border border-gray-100 flex flex-col justify-center min-h-[90px]"
                >
                  <p className="text-[10px] text-black truncate">
                    {route.departure.name}から{route.destination.name}まで
                  </p>
                  <p className="text-xs text-black/40 italic mt-1.5">
                    本日の運行は終了、または利用可能な便が見つかりません
                  </p>
                </div>
              );
            }

            return (
              <MyRouteCard
                key={route.routeId}
                fromName={route.departure.name}
                toName={route.destination.name}
                departureTime={trip.departureTime}
                arrivalTime={trip.arrivalTime}
                durationMinutes={trip.durationMinutes}
                remainingLabel={getRemainingTimeText(trip.departureTime)}
                fare={trip.fare}
                transferLabel={trip.transferCount > 0 ? `${trip.transferCount}回` : "無"}
              />
            );
          })}
        </div>
      )}

      {/* Button to add/go to routes page */}
      <Link
        href="/routes"
        aria-label="ルートを追加"
        className="w-full h-[90px] border-[1.5px] border-dashed border-[#aecb72] rounded-lg flex items-center justify-center active:bg-[#aecb72]/5 transition-colors"
      >
        <span className="flex items-center justify-center size-8 rounded-full bg-[#aecb72] text-white">
          <Plus size={20} />
        </span>
      </Link>
    </section>
  );
}
