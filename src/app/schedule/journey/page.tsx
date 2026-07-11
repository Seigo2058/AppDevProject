"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, Bus, TrainFront, Footprints, MapPin, GraduationCap } from "lucide-react";
import { CommuteLeg, JourneySegment, dayFullNames } from "@/lib/schedule";

const ACCENT = "#aecb72";

interface JourneyDetailPayload {
  day: string;
  direction: "outbound" | "inbound";
  leg: CommuteLeg;
  boardingName: string;
}

function SegmentIcon({ mode }: { mode: JourneySegment["mode"] }) {
  if (mode === "train") return <TrainFront size={14} />;
  if (mode === "walk") return <Footprints size={14} />;
  return <Bus size={14} />;
}

function segmentLabel(seg: JourneySegment): string {
  if (seg.routeName) return seg.routeName;
  return seg.mode === "walk" ? "徒歩" : "バス";
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
      <div className="min-h-screen bg-[#eee] flex items-center justify-center">
        <p className="text-black/40 font-bold animate-pulse">読み込み中...</p>
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="min-h-screen bg-[#eee] flex flex-col items-center justify-center px-4 space-y-4 text-center">
        <p className="text-black/50 font-medium text-sm">
          経路情報が見つかりませんでした。
          <br />
          時間割ページからもう一度お試しください。
        </p>
        <button
          onClick={() => router.push("/schedule")}
          className="px-4 py-2 text-white font-bold rounded-lg text-xs cursor-pointer"
          style={{ backgroundColor: ACCENT }}
        >
          時間割へ戻る
        </button>
      </div>
    );
  }

  const { day, direction, leg, boardingName } = detail;
  const startLabel = direction === "outbound" ? boardingName : leg.stopLabel;
  const endLabel = direction === "outbound" ? leg.stopLabel : boardingName;

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

  // 各地点の到着時刻と出発時刻を別々に持たせる。乗換地点（中間地点）は
  // 「前の区間の到着」と「次の区間の出発」の両方を表示する（乗継の待ち時間が分かるように）。
  // 始点は出発のみ、終点は到着のみを持つ。
  // CSVのバス区間は着/発を区別した時刻データを持たないため、同じ値が両方に入る
  // （区間の到着地点としては、その値をそのまま到着時刻として扱う）。JR区間は
  // 実際の到着(着)列の値がarrivalTimeに入っている。
  interface Waypoint {
    name: string;
    arrivalTime?: string;
    departureTime?: string;
  }

  const waypoints: Waypoint[] = segments.map((s, i) => ({
    name: s.fromStop,
    arrivalTime: i > 0 ? segments[i - 1].arrivalTime : undefined,
    departureTime: s.departureTime,
  }));
  waypoints.push({
    name: segments[segments.length - 1].toStop,
    arrivalTime: segments[segments.length - 1].arrivalTime,
  });

  return (
    <div className="min-h-screen bg-[#eee]">
      <div className="max-w-2xl mx-auto px-4 pt-6 pb-8 space-y-4">
        <button
          onClick={() => router.back()}
          className="flex items-center text-black/60 text-sm font-medium cursor-pointer -ml-1"
        >
          <ChevronLeft className="w-5 h-5" />
          戻る
        </button>

        <div>
          <h1 className="text-[20px] font-bold text-black">乗り換えの道のり</h1>
          <p className="text-xs text-black/50 mt-1">
            {dayFullNames[day] ?? day} ・ {direction === "outbound" ? "行き" : "帰り"}
          </p>
        </div>

        <div className="bg-[#fafafa] rounded-lg shadow-[0px_2px_6px_rgba(0,0,0,0.06)] p-4 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-black min-w-0">
            {direction === "outbound" ? <MapPin size={14} className="shrink-0" /> : <GraduationCap size={14} className="shrink-0" />}
            <span className="text-xs font-bold truncate">{startLabel}</span>
          </div>
          <span className="text-black/30 text-xs shrink-0 px-2">→</span>
          <div className="flex items-center gap-1.5 text-black min-w-0 justify-end">
            {direction === "outbound" ? <GraduationCap size={14} className="shrink-0" /> : <MapPin size={14} className="shrink-0" />}
            <span className="text-xs font-bold truncate">{endLabel}</span>
          </div>
        </div>

        <div className="bg-[#fafafa] rounded-lg shadow-[0px_2px_6px_rgba(0,0,0,0.06)] p-4">
          <div className="relative pl-6">
            <div className="absolute left-[6px] top-2 bottom-2 w-px bg-black/15" />
            <div className="space-y-5">
              {waypoints.map((wp, i) => {
                const isTransfer = wp.arrivalTime !== undefined && wp.departureTime !== undefined && wp.arrivalTime !== wp.departureTime;
                return (
                  <div key={i} className="relative">
                    <div
                      className="absolute -left-6 top-0.5 size-3 rounded-full bg-white border-2"
                      style={{ borderColor: ACCENT }}
                    />
                    {isTransfer ? (
                      <p className="text-sm text-black">
                        <span className="font-bold">{wp.arrivalTime}</span>
                        <span className="ml-1 text-[10px] text-black/40">着</span>
                        <span className="mx-1.5 text-black/30">/</span>
                        <span className="font-bold">{wp.departureTime}</span>
                        <span className="ml-1 text-[10px] text-black/40">発</span>
                        <span className="ml-2 text-black/70">{wp.name}</span>
                      </p>
                    ) : (
                      <p className="text-sm text-black">
                        <span className="font-bold">{wp.arrivalTime ?? wp.departureTime}</span>
                        <span className="ml-2 text-black/70">{wp.name}</span>
                      </p>
                    )}
                    {i < segments.length && (
                      <div className="mt-2 flex items-center gap-1.5 text-black/60 text-xs">
                        <SegmentIcon mode={segments[i].mode} />
                        <span>{segmentLabel(segments[i])}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
