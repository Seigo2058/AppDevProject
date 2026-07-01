"use client";

import { useEffect, useState } from "react";
import { Bus, GraduationCap } from "lucide-react";
import {
  ClassPeriod,
  OutboundBus,
  InboundBus,
  days,
  dayFullNames,
  parseCSV,
  fetchWithTimeout,
  getDaySchedule,
  getOutboundDepartureTime,
  getInboundArrivalTime,
} from "@/lib/schedule";
import RouteLegCard from "./RouteLegCard";

export default function TodayScheduleSection() {
  const [scheduleData, setScheduleData] = useState<{
    periods: ClassPeriod[];
    outbound: OutboundBus[];
    inbound: InboundBus[];
  } | null>(null);

  const [boardingStop] = useState<string>(() => {
    if (typeof window === "undefined") return "新札幌駅";
    return localStorage.getItem("commute_boarding_stop") || "新札幌駅";
  });
  const [schedule] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    const saved = localStorage.getItem("commute_schedule");
    if (!saved) return [];
    try {
      const parsed = JSON.parse(saved);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });
  const [isLoading, setIsLoading] = useState(true);
  const [today] = useState(() => new Date());

  useEffect(() => {
    async function loadData() {
      try {
        const [resPeriods, resOutbound, resInbound] = await Promise.all([
          fetchWithTimeout("/csv/school_timetable.csv").then((r) => r.text()),
          fetchWithTimeout("/csv/timetable_jrbus_shin29_ShinsapporoToJohodai_weekdays.csv").then((r) => r.text()),
          fetchWithTimeout("/csv/timetable_jrbus_shin29_JohodaiToShinsapporo_weekdays.csv").then((r) => r.text()),
        ]);

        const rawPeriods = parseCSV(resPeriods);
        const parsedPeriods: ClassPeriod[] = [];
        for (let i = 1; i < rawPeriods.length; i++) {
          const row = rawPeriods[i];
          if (row && row.length >= 3) {
            const id = parseInt(row[0], 10);
            if (!isNaN(id)) {
              parsedPeriods.push({ id, start: row[1] || "", end: row[2] || "" });
            }
          }
        }

        const rawOutbound = parseCSV(resOutbound);
        const parsedOutbound: OutboundBus[] = [];
        for (let i = 1; i < rawOutbound.length; i++) {
          const row = rawOutbound[i];
          if (row && row.length >= 7) {
            parsedOutbound.push({
              shinsapporo: row[0] || "-",
              atsubetsuChuo: row[1] || "-",
              oasa: row[2] || "-",
              wakaba: row[3] || "-",
              nopporo: row[4] || "-",
              johodai: row[5] || "-",
              edc: row[6] || "-",
              isSchool: row[7] === "TRUE",
            });
          }
        }

        const rawInbound = parseCSV(resInbound);
        const parsedInbound: InboundBus[] = [];
        for (let i = 1; i < rawInbound.length; i++) {
          const row = rawInbound[i];
          if (row && row.length >= 7) {
            parsedInbound.push({
              edc: row[0] || "-",
              johodai: row[1] || "-",
              nopporo: row[2] || "-",
              wakaba: row[3] || "-",
              oasa: row[4] || "-",
              atsubetsuChuo: row[5] || "-",
              shinsapporo: row[6] || "-",
              isSchool: row[7] === "TRUE",
            });
          }
        }

        setScheduleData({ periods: parsedPeriods, outbound: parsedOutbound, inbound: parsedInbound });
      } catch (err) {
        console.error("Failed to load CSV data in TodayScheduleSection:", err);
      } finally {
        setIsLoading(false);
      }
    }

    loadData();
  }, []);

  const card = renderCard();

  return (
    <section className="space-y-4">
      <h2 className="text-base font-bold text-black">My時間割ルート</h2>
      {card}
    </section>
  );

  function renderCard() {
    if (isLoading || !scheduleData) {
      return (
        <div className="bg-[#fafafa] shadow-sm rounded-lg p-4 flex items-center justify-center min-h-[100px]">
          <div className="animate-spin rounded-full h-6 w-6 border-2 border-[#aecb72] border-t-transparent" />
        </div>
      );
    }

    const dayIndex = today.getDay();
    if (dayIndex === 0 || dayIndex === 6) {
      return (
        <div className="bg-[#fafafa] shadow-sm rounded-lg p-4">
          <p className="text-sm font-bold text-gray-600">本日は休日のため、通学スケジュールはありません。</p>
        </div>
      );
    }

    const dayStr = days[dayIndex - 1];
    const dayPlan = getDaySchedule(dayStr, schedule, scheduleData.periods, scheduleData.outbound, scheduleData.inbound, boardingStop);

    if (!dayPlan) {
      return (
        <div className="bg-[#fafafa] shadow-sm rounded-lg p-4">
          <p className="text-sm font-bold text-gray-600">本日の時間割が登録されていません。</p>
        </div>
      );
    }

    const periodBadge = dayPlan.minPeriod === dayPlan.maxPeriod ? `${dayPlan.minPeriod}限` : `${dayPlan.minPeriod}限〜${dayPlan.maxPeriod}限`;

    const outboundArrivalStop = dayPlan.outbound?.edc !== "-" ? "eDCタワー前" : "情報大学前";
    const outboundArrivalTime = dayPlan.outbound ? (dayPlan.outbound.edc !== "-" ? dayPlan.outbound.edc : dayPlan.outbound.johodai) : "-";

    const inboundDepartureStop = dayPlan.inbound?.edc !== "-" ? "eDCタワー前(構内)" : "情報大学前(白樺通沿)";
    const inboundDepartureTime = dayPlan.inbound ? (dayPlan.inbound.edc !== "-" ? dayPlan.inbound.edc : dayPlan.inbound.johodai) : "-";

    return (
      <div className="bg-[#fafafa] shadow-sm rounded-lg p-4 flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-4">
          <p className="text-base font-bold text-black whitespace-nowrap">{dayFullNames[dayStr]}</p>
          <div className="flex items-center gap-4 text-xs text-black flex-wrap">
            <span>
              本日の授業時間：<span className="font-bold">{dayPlan.classStart}~{dayPlan.classEnd}</span>
            </span>
            <span className="bg-[#aecb72] text-white text-[10px] font-bold rounded-lg px-2 py-1 whitespace-nowrap">
              {periodBadge}
            </span>
          </div>
        </div>

        <div className="border-t border-gray-200" />

        <div className="flex flex-col gap-4">
          {dayPlan.outbound && (
            <RouteLegCard
              label="行き"
              methodLabel="スクール便"
              departureTime={getOutboundDepartureTime(dayPlan.outbound, boardingStop)}
              departureStop={boardingStop}
              departureIcon={Bus}
              arrivalTime={outboundArrivalTime}
              arrivalStop={outboundArrivalStop}
              arrivalIcon={GraduationCap}
            />
          )}
          {dayPlan.inbound && (
            <RouteLegCard
              label="帰り"
              methodLabel="スクール便"
              departureTime={inboundDepartureTime}
              departureStop={inboundDepartureStop}
              departureIcon={GraduationCap}
              arrivalTime={getInboundArrivalTime(dayPlan.inbound, boardingStop)}
              arrivalStop={boardingStop}
              arrivalIcon={Bus}
            />
          )}
        </div>
      </div>
    );
  }
}
