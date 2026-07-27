"use client";

import { useEffect, useState } from "react";
import { BusFront, GraduationCap, LucideIcon } from "lucide-react";
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
  timeToMinutes,
} from "@/lib/schedule";
import RouteLegCard from "./RouteLegCard";

// 当日の最終便の出発からこの時間が経過したら、翌営業日の「行き」に表示を繰り越す。
const ROLLOVER_MINUTES = 120;

interface Leg {
  label: string;
  icon: LucideIcon;
  placeName: string;
  agencyName: string;
  departureTime: string;
}

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

// 起点日から先の平日を、日付のオフセット付きで最大5日分（＝月〜金で重複なし）並べる。
function upcomingSchoolDays(from: Date): { dayStr: string; offset: number }[] {
  const result: { dayStr: string; offset: number }[] = [];
  for (let offset = 0; offset < 7 && result.length < days.length; offset++) {
    const date = new Date(from);
    date.setDate(date.getDate() + offset);
    const dayIndex = date.getDay();
    if (dayIndex === 0 || dayIndex === 6) continue;
    result.push({ dayStr: days[dayIndex - 1], offset });
  }
  return result;
}

// DayPlanを出発時刻の早い順（行き→帰り）のカード表示用データに変換する。
function buildLegs(plan: DayPlan, boardingName: string): Leg[] {
  return [
    plan.outbound && {
      label: "行き",
      icon: BusFront,
      placeName: boardingName,
      agencyName: plan.outbound.isSchoolBus
        ? "スクール便"
        : formatRouteLabel(plan.outbound.routeName || "路線バス"),
      departureTime: plan.outbound.departureTime,
    },
    plan.inbound && {
      label: "帰り",
      icon: GraduationCap,
      placeName: plan.inbound.stopLabel,
      agencyName: plan.inbound.isSchoolBus
        ? "スクール便"
        : formatRouteLabel(plan.inbound.routeName || "路線バス"),
      departureTime: plan.inbound.departureTime,
    },
  ]
    .filter((leg) => !!leg)
    .sort((a, b) => timeToMinutes(a.departureTime) - timeToMinutes(b.departureTime));
}

interface TodayScheduleSectionProps {
  /** セクション見出し。ホームは「My時間割ルート」、時間割トップは「今日のスケジュール」。 */
  title?: string;
}

export default function TodayScheduleSection({ title = "My時間割ルート" }: TodayScheduleSectionProps) {
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
  // 当日ぶんと繰り越し先ぶんを保持するため、曜日をキーにした計算結果のマップで持つ。
  const [plans, setPlans] = useState<Record<string, DayPlan | null>>({});
  const [isComputing, setIsComputing] = useState(false);
  const [today] = useState(() => new Date());
  // 表示対象は時刻の経過で 行き→帰り→翌日の行き と切り替わるため、定期的に現在時刻を更新する。
  // カード本体はデータ取得後（＝クライアント側）にしか描画されないため、SSRとの不一致は起きない。
  const [nowMinutes, setNowMinutes] = useState(() => {
    const d = new Date();
    return d.getHours() * 60 + d.getMinutes();
  });

  useEffect(() => {
    const id = setInterval(() => {
      const d = new Date();
      setNowMinutes(d.getHours() * 60 + d.getMinutes());
    }, 30_000);
    return () => clearInterval(id);
  }, []);

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
    if (isLoading || !scheduleData || !boarding) return;
    let cancelled = false;

    // 当日ぶんと、繰り越し先となる翌営業日ぶんの2日分を先頭から順に確定させる。
    // 当日ぶんが出た時点でスピナーを解除し、繰り越し先は裏で計算を続けることで
    // 初回表示が遅くならないようにする。
    async function resolvePlans() {
      setIsComputing(true);
      let resolved = 0;

      for (const { dayStr } of upcomingSchoolDays(today)) {
        let plan: DayPlan | null;
        const cached = getComputedScheduleCache(boarding!, schedule, [dayStr]);
        if (cached) {
          plan = cached[dayStr];
        } else {
          plan = await getDaySchedule(dayStr, schedule, scheduleData!.periods, boarding!);
          if (cancelled) return;
          setComputedScheduleCache(boarding!, schedule, { [dayStr]: plan });
        }
        if (cancelled) return;

        setPlans((prev) => ({ ...prev, [dayStr]: plan }));
        if (plan) {
          resolved++;
          setIsComputing(false);
          if (resolved >= 2) return;
        }
      }

      if (!cancelled) setIsComputing(false);
    }

    resolvePlans();
    return () => {
      cancelled = true;
    };
  }, [isLoading, scheduleData, boarding, schedule, today]);

  // 表示すべき「次に乗る便」を選ぶ。undefined は計算待ち、null は該当便なしを表す。
  function selectTarget() {
    if (!boarding) return null;

    for (const { dayStr, offset } of upcomingSchoolDays(today)) {
      if (!(dayStr in plans)) return undefined;

      const plan = plans[dayStr];
      if (!plan) continue;

      const legs = buildLegs(plan, boarding.name);
      if (legs.length === 0) continue;

      if (offset > 0) {
        // 翌営業日以降はその日の最初の便（＝行き）を表示する。
        return { dayStr, offset, plan, leg: legs[0] };
      }

      const lastDeparture = timeToMinutes(legs[legs.length - 1].departureTime);
      if (lastDeparture !== -1 && nowMinutes >= lastDeparture + ROLLOVER_MINUTES) {
        continue;
      }

      // まだ出発していない最初の便。最終便の出発直後（繰り越しまでの猶予中）は最終便を出し続ける。
      const upcoming = legs.find((leg) => {
        const departure = timeToMinutes(leg.departureTime);
        return departure !== -1 && departure >= nowMinutes;
      });
      return { dayStr, offset, plan, leg: upcoming ?? legs[legs.length - 1] };
    }

    return null;
  }

  return (
    <section className="space-y-4">
      <h2 className="text-base font-bold text-black">{title}</h2>
      {renderCard()}
    </section>
  );

  function renderCard() {
    const target = selectTarget();

    // boardingやscheduleはlocalStorage由来のためサーバーでは必ず空になる。
    // isLoadingはサーバー・クライアントとも初期値trueなので、この分岐を先頭に置くことで
    // 初回レンダーの出力が必ず一致し、hydrationの不一致を避けられる。
    if (isLoading || !scheduleData || isComputing || target === undefined) {
      return (
        <div className="bg-[#fafafa] rounded-lg p-4 flex items-center justify-center min-h-[100px]">
          <div className="animate-spin rounded-full h-6 w-6 border-2 border-[#a0e25e] border-t-transparent" />
        </div>
      );
    }

    if (!boarding) {
      return (
        <div className="bg-[#fafafa] rounded-lg p-4">
          <p className="text-sm font-bold text-gray-600">
            「時間割」ページで乗車する駅・停留所を登録してください。
          </p>
        </div>
      );
    }

    if (!target) {
      return (
        <div className="bg-[#fafafa] rounded-lg p-4">
          <p className="text-sm font-bold text-gray-600">表示できる通学ルートがありません。</p>
        </div>
      );
    }

    const { dayStr, offset, plan, leg } = target;
    const periodBadge =
      plan.minPeriod === plan.maxPeriod
        ? `${plan.minPeriod}限`
        : `${plan.minPeriod}限〜${plan.maxPeriod}限`;

    return (
      <div className="bg-[#fafafa] rounded-lg p-4 flex flex-col gap-4">
        <div className="flex items-start justify-between gap-4">
          <p className="text-base font-bold text-black whitespace-nowrap">{dayFullNames[dayStr]}</p>
          <div className="flex items-center justify-end gap-4 flex-wrap">
            <span className="text-xs text-black whitespace-nowrap">
              {offset === 0 ? "本日の授業時間：" : "授業時間："}
              <span className="font-bold">
                {plan.classStart}~{plan.classEnd}
              </span>
            </span>
            <span className="rounded-lg border border-[#a0e25e] p-1 text-[10px] font-bold text-black whitespace-nowrap">
              {periodBadge}
            </span>
          </div>
        </div>

        <div className="border-t border-gray-200" />

        <RouteLegCard
          label={leg.label}
          icon={leg.icon}
          placeName={leg.placeName}
          agencyName={leg.agencyName}
          departureTime={leg.departureTime}
          dayOffset={offset}
        />
      </div>
    );
  }
}
