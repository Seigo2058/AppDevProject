"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, GraduationCap, MapPin } from "lucide-react";
import { CommuteLeg, dayFullNames } from "@/lib/schedule";
import RouteJourneyDetail from "@/components/route/RouteJourneyDetail";
import Button from "@/components/ui/Button";

interface JourneyDetailPayload {
  day: string;
  direction: "outbound" | "inbound";
  leg: CommuteLeg;
  boardingName: string;
}

export default function JourneyDetailPage() {
  const router = useRouter();
  const [detail, setDetail] = useState<JourneyDetailPayload | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    function loadDetail() {
      try {
        const raw = sessionStorage.getItem("commute_journey_detail");
        if (raw) setDetail(JSON.parse(raw));
      } catch (e) {
        console.error("Failed to read journey detail:", e);
      } finally {
        setLoaded(true);
      }
    }
    loadDetail();
  }, []);

  if (!loaded) {
    return (
      <div className="flex min-h-full items-center justify-center bg-[#eee]">
        <p className="animate-pulse font-bold text-black/40">読み込み中...</p>
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="flex min-h-full flex-col items-center justify-center gap-4 bg-[#eee] px-4 text-center">
        <p className="text-sm font-medium text-black/50">
          経路情報が見つかりませんでした。
          <br />
          時間割ページからもう一度お試しください。
        </p>
        <Button size="S" onClick={() => router.push("/schedule")}>
          時間割へ戻る
        </Button>
      </div>
    );
  }

  const { day, direction, leg, boardingName } = detail;
  const startLabel = direction === "outbound" ? boardingName : leg.stopLabel;
  const endLabel = direction === "outbound" ? leg.stopLabel : boardingName;

  // 内訳が取得できていない経路は、乗車〜降車を1区間として扱う。
  const segments = leg.segments && leg.segments.length > 0
    ? leg.segments
    : [
        {
          mode: "transit" as const,
          routeName: leg.routeName,
          fromStop: startLabel,
          toStop: endLabel,
          departureTime: leg.departureTime,
          arrivalTime: leg.arrivalTime,
        },
      ];

  return (
    <div className="min-h-full bg-[#eee] px-4 pt-4 pb-8 text-black">
      <div className="mx-auto flex max-w-2xl flex-col gap-4">
        <button
          type="button"
          onClick={() => router.back()}
          className="flex items-center gap-2 text-black active:opacity-60"
        >
          <ChevronLeft size={22} />
          <span className="text-base font-bold">ルートの詳細</span>
        </button>

        <p className="text-xs text-black/50">
          {dayFullNames[day] ?? day} ・ {direction === "outbound" ? "行き" : "帰り"}
        </p>

        <RouteJourneyDetail
          segments={segments}
          departureStop={startLabel}
          arrivalStop={endLabel}
          departureTime={leg.departureTime}
          arrivalTime={leg.arrivalTime}
          departureIcon={direction === "outbound" ? MapPin : GraduationCap}
          arrivalIcon={direction === "outbound" ? GraduationCap : MapPin}
        />
      </div>
    </div>
  );
}
