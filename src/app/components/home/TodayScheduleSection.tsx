"use client";

import { useEffect, useState } from "react";
import { Bus, GraduationCap } from "lucide-react";
import {
  ClassPeriod,
  BoardingSelection,
  DayPlan,
  days,
  dayFullNames,
  parseCSV,
  fetchWithTimeout,
  getDaySchedule,
  getComputedScheduleCache,
  setComputedScheduleCache,
  formatRouteLabel,
} from "@/lib/schedule";
import RouteLegCard from "./RouteLegCard";

function loadBoardingSelection(): BoardingSelection | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem("commute_boarding_stop");
  if (!raw) return { source: "csv", name: "新札幌駅" };
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && (parsed.source === "csv" || parsed.source === "transit")) {
      return parsed;
    }
    throw new Error("invalid boarding format");
  } catch {
    // 旧バージョン（生文字列で保存）からの移行。当時はCSV経路しか存在しなかったため、
    // 保存されていた文字列はそのままCSV乗り場名として扱う。
    return { source: "csv", name: raw };
  }
}

export default function TodayScheduleSection() {
  const [scheduleData, setScheduleData] = useState<{
    periods: ClassPeriod[];
  } | null>(null);

  const [boarding] = useState<BoardingSelection | null>(loadBoardingSelection);
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
  const [dayPlan, setDayPlan] = useState<DayPlan | null>(null);
  const [isComputing, setIsComputing] = useState(false);
  const [today] = useState(() => new Date());

  useEffect(() => {
    async function loadData() {
      try {
        const resPeriods = await fetchWithTimeout("/csv/school_timetable.csv").then((r) => r.text());

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

        setScheduleData({ periods: parsedPeriods });
      } catch (err) {
        console.error("Failed to load CSV data in TodayScheduleSection:", err);
      } finally {
        setIsLoading(false);
      }
    }

    loadData();
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function compute() {
      if (isLoading || !scheduleData || !boarding) return;

      const dayIndex = today.getDay();
      if (dayIndex === 0 || dayIndex === 6) {
        if (!cancelled) setDayPlan(null);
        return;
      }

      const dayStr = days[dayIndex - 1];

      const cached = getComputedScheduleCache(boarding, schedule, [dayStr]);
      if (cached) {
        if (!cancelled) setDayPlan(cached[dayStr]);
        return;
      }

      setIsComputing(true);
      const plan = await getDaySchedule(dayStr, schedule, scheduleData.periods, boarding);
      if (!cancelled) {
        setDayPlan(plan);
        setIsComputing(false);
        setComputedScheduleCache(boarding, schedule, { [dayStr]: plan });
      }
    }
    compute();
    return () => {
      cancelled = true;
    };
  }, [isLoading, scheduleData, boarding, schedule, today]);

  const card = renderCard();

  return (
    <section className="space-y-4">
      <h2 className="text-base font-bold text-black">My時間割ルート</h2>
      {card}
    </section>
  );

  function renderCard() {
    if (isLoading || !scheduleData || isComputing) {
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

    if (!boarding) {
      return (
        <div className="bg-[#fafafa] shadow-sm rounded-lg p-4">
          <p className="text-sm font-bold text-gray-600">
            「時間割」ページで乗車する駅・停留所を登録してください。
          </p>
        </div>
      );
    }

    const dayStr = days[dayIndex - 1];

    if (!dayPlan) {
      return (
        <div className="bg-[#fafafa] shadow-sm rounded-lg p-4">
          <p className="text-sm font-bold text-gray-600">本日の時間割が登録されていません。</p>
        </div>
      );
    }

    const periodBadge = dayPlan.minPeriod === dayPlan.maxPeriod ? `${dayPlan.minPeriod}限` : `${dayPlan.minPeriod}限〜${dayPlan.maxPeriod}限`;

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
              methodLabel={dayPlan.outbound.isSchoolBus ? "スクール便" : formatRouteLabel(dayPlan.outbound.routeName || "路線バス")}
              departureTime={dayPlan.outbound.departureTime}
              departureStop={boarding.name}
              departureIcon={Bus}
              arrivalTime={dayPlan.outbound.arrivalTime}
              arrivalStop={dayPlan.outbound.stopLabel}
              arrivalIcon={GraduationCap}
            />
          )}
          {dayPlan.inbound && (
            <RouteLegCard
              label="帰り"
              methodLabel={dayPlan.inbound.isSchoolBus ? "スクール便" : formatRouteLabel(dayPlan.inbound.routeName || "路線バス")}
              departureTime={dayPlan.inbound.departureTime}
              departureStop={dayPlan.inbound.stopLabel}
              departureIcon={GraduationCap}
              arrivalTime={dayPlan.inbound.arrivalTime}
              arrivalStop={boarding.name}
              arrivalIcon={Bus}
            />
          )}
        </div>
      </div>
    );
  }
}
