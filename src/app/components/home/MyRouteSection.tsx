"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Loader2, MapPin } from "lucide-react";
import MyRouteCard from "./MyRouteCard";
import {
  searchNextAvailableRoutes,
  timeToMinutes,
  SearchResultJourney
} from "@/lib/generalRouteSearch";
import { setRoutePinnedToHome, type SavedRoute } from "@/lib/myRoutes";

export default function MyRouteSection() {
  const [myRoutes, setMyRoutes] = useState<SavedRoute[]>([]);
  const [routeTrips, setRouteTrips] = useState<Record<string, SearchResultJourney | null>>({});
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);

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

        // ホームには「ホームに追加」で星を付けたルートだけを出す。
        // pinnedToHome を持たない既存データは、従来通り表示されるよう未指定＝表示とみなす。
        const pinned = parsed.filter((route) => route.pinnedToHome !== false);
        if (pinned.length === 0) {
          setLoading(false);
          return;
        }

        setMyRoutes(pinned);

        const trips: Record<string, SearchResultJourney | null> = {};
        await Promise.all(
          parsed.map(async (route) => {
            try {
              const results = await searchNextAvailableRoutes(
                route.departure,
                route.destination
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

  // 星ボタンでホーム表示から外す。ルート自体はルート画面に残る。
  const handleRemoveFromHome = (routeId: string) => {
    setRoutePinnedToHome(routeId, false);
    setMyRoutes((prev) => prev.filter((route) => route.routeId !== routeId));
  };

  const getRemainingTimeText = (departureTime: string, isNextDay?: boolean): string => {
    const now = new Date();
    const nowMins = now.getHours() * 60 + now.getMinutes();
    const depMins = timeToMinutes(departureTime);
    if (depMins === -1) return "-";
    // 翌日の便は24時間を加算して残り時間を算出する
    const diff = depMins - nowMins + (isNextDay ? 24 * 60 : 0);

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
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-black">Myルート</h2>
        {myRoutes.length > 0 && (
          <button
            type="button"
            onClick={() => setIsEditing((prev) => !prev)}
            className="text-[13px] font-bold text-[#a0e25e] transition-opacity hover:opacity-70 active:opacity-60"
          >
            {isEditing ? "完了" : "編集する"}
          </button>
        )}
      </div>

      <div className="flex flex-col gap-2">
        {loading ? (
          <div className="bg-[#fafafa] rounded-lg h-[90px] flex items-center justify-center">
            <Loader2 size={20} className="animate-spin text-[#a0e25e] mr-2" />
            <span className="text-xs text-black/50">マイルート情報を読み込み中...</span>
          </div>
        ) : myRoutes.length === 0 ? (
          <div className="bg-[#fafafa] rounded-lg h-[90px] flex flex-col items-center justify-center text-xs text-black/50">
            <MapPin size={20} className="mb-1 text-black/20" />
            <p>登録されたマイルートがありません。</p>
          </div>
        ) : (
          myRoutes.map((route) => {
            const trip = routeTrips[route.routeId];
            if (!trip) {
              return (
                <div
                  key={route.routeId}
                  className="w-full bg-[#fafafa] rounded-lg h-[90px] px-4 py-2 flex flex-col justify-center gap-1"
                >
                  <p className="text-[10px] text-black truncate">
                    {route.departure.name}から{route.destination.name}まで
                  </p>
                  <p className="text-xs text-black/40">
                    本日の運行は終了、または利用可能な便が見つかりません
                  </p>
                </div>
              );
            }

            return (
              <MyRouteCard
                key={`${route.routeId}-${isEditing}`}
                routeId={route.routeId}
                editing={isEditing}
                onRemoveFromHome={() => handleRemoveFromHome(route.routeId)}
                fromName={route.departure.name}
                toName={route.destination.name}
                departureTime={trip.departureTime}
                arrivalTime={trip.arrivalTime}
                durationMinutes={trip.durationMinutes}
                remainingLabel={getRemainingTimeText(trip.departureTime, trip.isNextDay)}
                fare={trip.fare}
                transferLabel={trip.transferCount > 0 ? `${trip.transferCount}回` : "無"}
                isNextDay={trip.isNextDay}
              />
            );
          })
        )}

        {/* Button to add/go to routes page */}
        <Link
          href="/routes"
          aria-label="ルートを追加"
          className="w-full h-[90px] border-[1.5px] border-dashed border-[#a0e25e] rounded-lg flex items-center justify-center transition-colors hover:border-[#8dc753] hover:bg-black/5 active:border-[#8dc753] active:bg-black/12"
        >
          <span className="flex items-center justify-center size-8 rounded-full bg-[#a0e25e] text-white">
            <Plus size={20} />
          </span>
        </Link>
      </div>
    </section>
  );
}
