"use client";

import { BusFront, Footprints, MapPin, TrainFront, type LucideIcon } from "lucide-react";
import { timeDifferenceMinutes } from "@/lib/generalRouteSearch";

const ACCENT = "#a0e25e";
const TRAIN_RAIL = "#142547";

// ルート検索の詳細（マイルート）と時間割の道のり画面で共通に使う経路の内訳。
// generalRouteSearch の RouteSegmentDetail / schedule の JourneySegment のどちらもこの形に一致する。
export interface RouteJourneySegment {
  mode: "bus" | "train" | "transit" | "walk";
  routeName?: string;
  fromStop: string;
  toStop: string;
  departureTime: string;
  arrivalTime: string;
}

interface RouteJourneyDetailProps {
  segments: RouteJourneySegment[];
  departureStop: string;
  arrivalStop: string;
  departureTime: string;
  arrivalTime: string;
  /** 円。取得できない画面では省略する。 */
  fare?: number;
  /** 省略時は乗車区間の数から算出する。 */
  transferCount?: number;
  /** 省略時は出発・到着時刻から算出する。 */
  durationMinutes?: number;
  departureIcon?: LucideIcon;
  arrivalIcon?: LucideIcon;
}

// 乗換地点は「前の区間の到着」と「次の区間の出発」の両方を持たせ、待ち時間が分かるようにする。
// 始点は出発のみ、終点は到着のみを持つ。
interface Waypoint {
  name: string;
  arrivalTime?: string;
  departureTime?: string;
}

function segmentIcon(mode: RouteJourneySegment["mode"]): LucideIcon {
  if (mode === "walk") return Footprints;
  if (mode === "train") return TrainFront;
  return BusFront;
}

function segmentLabel(mode: RouteJourneySegment["mode"]): string {
  if (mode === "walk") return "徒歩";
  if (mode === "train") return "電車";
  return "バス";
}

function railColor(mode: RouteJourneySegment["mode"]): string {
  if (mode === "walk") return "rgba(0,0,0,0.25)";
  return mode === "train" ? TRAIN_RAIL : ACCENT;
}

function buildWaypoints(segments: RouteJourneySegment[]): Waypoint[] {
  const waypoints: Waypoint[] = segments.map((segment, index) => ({
    name: segment.fromStop,
    arrivalTime: index > 0 ? segments[index - 1].arrivalTime : undefined,
    departureTime: segment.departureTime,
  }));
  const last = segments[segments.length - 1];
  waypoints.push({ name: last.toStop, arrivalTime: last.arrivalTime });
  return waypoints;
}

export default function RouteJourneyDetail({
  segments,
  departureStop,
  arrivalStop,
  departureTime,
  arrivalTime,
  fare,
  transferCount,
  durationMinutes,
  departureIcon: DepartureIcon = MapPin,
  arrivalIcon: ArrivalIcon = MapPin,
}: RouteJourneyDetailProps) {
  const duration = durationMinutes ?? timeDifferenceMinutes(departureTime, arrivalTime);
  const transfers =
    transferCount ?? Math.max(0, segments.filter((s) => s.mode !== "walk").length - 1);
  const waypoints = segments.length > 0 ? buildWaypoints(segments) : [];

  return (
    <div className="flex flex-col gap-4 rounded-lg bg-[#fafafa] p-4 shadow-[0px_2px_6px_rgba(0,0,0,0.06)]">
      {/* 出発地 → 目的地 */}
      <div className="flex items-center gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-1.5 text-black">
          <DepartureIcon size={14} className="shrink-0" />
          <span className="truncate text-sm font-bold">{departureStop}</span>
        </div>
        {/*
          「▶」(U+25B6) はiOSで絵文字（▶️）として描画されてしまうため、
          文字ではなくCSSの三角形で描く（他画面の矢印と同じ作り）。
        */}
        <span
          aria-hidden="true"
          className="h-[10px] w-[8px] shrink-0 bg-black/30 [clip-path:polygon(0%_0%,100%_50%,0%_100%)]"
        />
        <div className="flex min-w-0 flex-1 items-center justify-end gap-1.5 text-black">
          <ArrivalIcon size={14} className="shrink-0" />
          <span className="truncate text-sm font-bold">{arrivalStop}</span>
        </div>
      </div>

      <div className="h-px w-full bg-black/10" />

      {/* 出発・到着時刻とサマリー */}
      <div className="flex flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-2xl font-bold text-black">{departureTime}</span>
          <span className="h-px w-3 shrink-0 bg-black" />
          <span className="text-2xl font-bold text-black">{arrivalTime}</span>
          <span className="text-xs text-black">（{duration}分）</span>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-black">
          <span>乗換{transfers > 0 ? `${transfers}回` : "無"}</span>
          {fare !== undefined && (
            <>
              <span className="h-[11px] w-px bg-black/20" />
              <span className="font-bold">{fare}円</span>
            </>
          )}
        </div>
      </div>

      <div className="h-px w-full bg-black/10" />

      {/* 経路の内訳 */}
      {waypoints.length === 0 ? (
        <p className="text-xs text-black/50">経路の詳細が取得できませんでした。</p>
      ) : (
        <div>
          {waypoints.map((waypoint, index) => {
            const isFirst = index === 0;
            const isLast = index === waypoints.length - 1;
            const segment = segments[index];
            const waitMinutes =
              waypoint.arrivalTime && waypoint.departureTime
                ? timeDifferenceMinutes(waypoint.arrivalTime, waypoint.departureTime)
                : 0;
            const Icon = segment ? segmentIcon(segment.mode) : null;

            return (
              <div key={`${waypoint.name}-${index}`}>
                {/* 地点 */}
                <div className="grid grid-cols-[64px_16px_1fr] gap-x-3">
                  <div className="flex flex-col items-start">
                    {waypoint.arrivalTime && waypoint.departureTime ? (
                      <>
                        <span className="whitespace-nowrap text-[11px] leading-5 text-black/50">
                          {waypoint.arrivalTime}着
                        </span>
                        <span className="whitespace-nowrap text-sm font-bold leading-5 text-black">
                          {waypoint.departureTime}発
                        </span>
                      </>
                    ) : (
                      <span className="whitespace-nowrap text-sm font-bold leading-5 text-black">
                        {waypoint.arrivalTime ?? waypoint.departureTime}
                      </span>
                    )}
                  </div>

                  <div className="relative flex justify-center">
                    {/* 地点の上下は前後の区間の色でつなぎ、1本のレールに見えるようにする */}
                    {!isFirst && (
                      <span
                        className="absolute top-0 h-[10px] w-[3px]"
                        style={{ backgroundColor: railColor(segments[index - 1].mode) }}
                      />
                    )}
                    {segment && (
                      <span
                        className="absolute bottom-0 top-[10px] w-[3px]"
                        style={{ backgroundColor: railColor(segment.mode) }}
                      />
                    )}
                    <span
                      className="relative mt-1 size-3 shrink-0 rounded-full border-2"
                      style={{
                        borderColor: ACCENT,
                        backgroundColor: isFirst || isLast ? ACCENT : "#ffffff",
                      }}
                    />
                  </div>

                  <div className="flex flex-wrap items-start gap-2">
                    <span
                      className={`min-w-0 truncate leading-5 text-black ${
                        isFirst || isLast ? "text-sm font-bold" : "text-sm"
                      }`}
                    >
                      {waypoint.name}
                    </span>
                    {waitMinutes > 0 && (
                      <span className="shrink-0 rounded-full bg-black/5 px-2 py-0.5 text-[10px] text-black/60">
                        待ち{waitMinutes}分
                      </span>
                    )}
                  </div>
                </div>

                {/* 区間 */}
                {segment && Icon && (
                  <div className="grid grid-cols-[64px_16px_1fr] gap-x-3">
                    <div className="py-2 text-[11px] leading-5 text-black/60">
                      {timeDifferenceMinutes(segment.departureTime, segment.arrivalTime)}分
                    </div>

                    <div className="flex justify-center">
                      {segment.mode === "walk" ? (
                        <span className="h-full border-l-[3px] border-dotted border-black/25" />
                      ) : (
                        <span
                          className="h-full w-[3px]"
                          style={{ backgroundColor: railColor(segment.mode) }}
                        />
                      )}
                    </div>

                    <div className="flex min-w-0 flex-wrap items-center gap-2 py-2">
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-[#e8e8e8] bg-white px-2 py-1 text-[11px] font-bold text-black">
                        <Icon size={14} />
                        {segmentLabel(segment.mode)}
                      </span>
                      {segment.routeName && (
                        <span className="min-w-0 truncate text-[11px] text-black/60">
                          {segment.routeName}
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
