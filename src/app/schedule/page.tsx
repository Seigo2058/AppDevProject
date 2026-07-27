"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { BusFront, MapPin, GraduationCap, Search, ChevronRight, Info } from "lucide-react";
import {
  ClassPeriod,
  BoardingSelection,
  DayPlan,
  CommuteLeg,
  days,
  dayFullNames,
  parseCSV,
  fetchWithTimeout,
  getDaySchedule,
  getComputedScheduleCache,
  setComputedScheduleCache,
  formatRouteLabel,
} from "@/lib/schedule";
import { getCsvCoverageStops, getStopAgencyNames } from "@/lib/tripGraph";
import { findCsvStopNameByEndpoint } from "@/lib/stopRegistry";
import LocationSearchModal, { LocationSearchResult } from "@/components/search/LocationSearchModal";
import TodayScheduleSection from "@/app/components/home/TodayScheduleSection";
import Button from "@/components/ui/Button";

const ACCENT = "#a0e25e";

function InfoBadge({ className = "" }: { className?: string }) {
  return (
    <div
      className={`flex items-center justify-center size-4 rounded-full border shrink-0 text-[10px] font-bold ${className}`}
      style={{ borderColor: ACCENT, color: ACCENT }}
    >
      !
    </div>
  );
}

function LegCard({
  leftLabel,
  leftTime,
  leftName,
  LeftIcon,
  rightLabel,
  rightTime,
  rightName,
  RightIcon,
  centerLabel,
  onClick,
}: {
  leftLabel: string;
  leftTime: string;
  leftName: string;
  LeftIcon: typeof MapPin;
  rightLabel: string;
  rightTime: string;
  rightName: string;
  RightIcon: typeof MapPin;
  centerLabel: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="乗り換えの道のりを表示"
      className="w-full text-left bg-[#fafafa] border border-[#e8e8e8] shadow-[0px_2px_6px_rgba(0,0,0,0.06)] rounded-lg pl-4 pr-8 py-3 flex items-center gap-2 relative cursor-pointer transition-colors hover:bg-[#e6e6e6] active:bg-[#dcdcdc]"
    >
      <div className="flex flex-col gap-1.5 shrink-0">
        <p className="text-xs text-black/50">{leftLabel}</p>
        <p className="text-base font-bold text-black">{leftTime}</p>
        <div className="flex items-center gap-1 text-black">
          <LeftIcon size={13} />
          <span className="text-[10px]">{leftName}</span>
        </div>
      </div>
      <div className="flex-1 flex flex-col items-center justify-center gap-1.5 self-stretch pt-3 min-w-0">
        <div className="w-full border-t border-dashed border-black/20" />
        <div className="flex items-center gap-1 text-black/60 text-[10px] whitespace-nowrap">
          <BusFront size={13} />
          <span>{centerLabel}</span>
        </div>
      </div>
      <div className="flex flex-col items-end gap-1.5 shrink-0">
        <p className="text-xs text-black/50">{rightLabel}</p>
        <p className="text-base font-bold text-black">{rightTime}</p>
        <div className="flex items-center gap-1 text-black">
          <RightIcon size={13} />
          <span className="text-[10px]">{rightName}</span>
        </div>
      </div>
      <ChevronRight size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-black/30" />
    </button>
  );
}

function LegSection({
  label,
  leg,
  direction,
  boardingName,
  emptyMessage,
  onOpenDetail,
}: {
  label: string;
  leg: CommuteLeg | null;
  direction: "outbound" | "inbound";
  boardingName: string;
  emptyMessage: string;
  onOpenDetail: (leg: CommuteLeg) => void;
}) {
  return (
    <div className="space-y-2">
      <p className="text-[11px] font-medium text-black/80">{label}</p>
      {leg ? (
        direction === "outbound" ? (
          <LegCard
            leftLabel="出発時刻"
            leftTime={leg.departureTime}
            leftName={boardingName}
            LeftIcon={MapPin}
            rightLabel="大学到着時刻"
            rightTime={leg.arrivalTime}
            rightName={leg.stopLabel}
            RightIcon={GraduationCap}
            centerLabel={leg.isSchoolBus ? "スクール便" : formatRouteLabel(leg.routeName || "バス")}
            onClick={() => onOpenDetail(leg)}
          />
        ) : (
          <LegCard
            leftLabel="大学乗車時刻"
            leftTime={leg.departureTime}
            leftName={leg.stopLabel}
            LeftIcon={GraduationCap}
            rightLabel="最寄り到着時刻"
            rightTime={leg.arrivalTime}
            rightName={boardingName}
            RightIcon={MapPin}
            centerLabel={leg.isSchoolBus ? "スクール便" : formatRouteLabel(leg.routeName || "バス")}
            onClick={() => onOpenDetail(leg)}
          />
        )
      ) : (
        <div className="bg-red-50 text-red-600 text-xs font-bold p-3 rounded-lg border border-red-100">
          {emptyMessage}
        </div>
      )}
    </div>
  );
}

export default function SchedulePage() {
  const router = useRouter();

  // 読み込み状態
  const [periods, setPeriods] = useState<ClassPeriod[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 自前CSVで直通/1回の乗換により大学へ到達できる停留所（検索の「よく使う乗り場」候補）
  const [csvCoverageStops, setCsvCoverageStops] = useState<string[]>([]);
  // 停留所名 -> 事業者名（"よく使う乗り場"に駅名の下へ小さく表示する）
  const [stopAgencyNames, setStopAgencyNames] = useState<Record<string, string>>({});

  // ユーザー設定
  const [boarding, setBoarding] = useState<BoardingSelection | null>(null);
  const [schedule, setSchedule] = useState<string[]>([]);
  const [isEditing, setIsEditing] = useState(true);
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  // 1週間分の通学プラン（TransitAPI呼び出しを伴うため非同期に計算する）
  const [computedSchedules, setComputedSchedules] = useState<Record<string, DayPlan | null>>({});
  const [isComputing, setIsComputing] = useState(false);

  // マウント時にCSVデータを読み込む
  useEffect(() => {
    async function loadData() {
      try {
        const resPeriods = await fetchWithTimeout("/csv/school_timetable.csv").then(r => {
          if (!r.ok) throw new Error("timetable.csv の読み込みに失敗しました");
          return r.text();
        });

        // 時間割（school_timetable）の解析
        const rawPeriods = parseCSV(resPeriods);
        const parsedPeriods: ClassPeriod[] = [];
        for (let i = 1; i < rawPeriods.length; i++) {
          const row = rawPeriods[i];
          if (row && row.length >= 3) {
            const id = parseInt(row[0], 10);
            if (!isNaN(id)) {
              parsedPeriods.push({
                id: id,
                start: row[1] || "",
                end: row[2] || "",
              });
            }
          }
        }
        setPeriods(parsedPeriods);
        setIsLoading(false);
      } catch (err) {
        console.error("Failed to load CSV data:", err);
        setError(err instanceof Error ? err.message : "データの読み込みに失敗しました。");
        setIsLoading(false);
      }
    }

    function restoreSettings() {
      if (typeof window === "undefined") return;
      try {
        const savedBoardingRaw = localStorage.getItem("commute_boarding_stop");
        if (savedBoardingRaw) {
          try {
            const parsed = JSON.parse(savedBoardingRaw);
            if (parsed && typeof parsed === "object" && (parsed.source === "csv" || parsed.source === "transit")) {
              setBoarding(parsed);
            } else {
              throw new Error("invalid boarding format");
            }
          } catch {
            // 旧バージョン（生文字列で保存）からの移行。当時はCSV経路しか存在しなかったため、
            // 保存されていた文字列はそのままCSV乗り場名として扱う。
            setBoarding({ source: "csv", name: savedBoardingRaw });
          }
        } else {
          setBoarding({ source: "csv", name: "新札幌駅" });
        }

        const savedSchedule = localStorage.getItem("commute_schedule");
        if (savedSchedule) {
          const parsed = JSON.parse(savedSchedule);
          if (Array.isArray(parsed)) {
            setSchedule(parsed);
          } else {
            console.warn("Invalid schedule format in localStorage, ignoring.");
          }
        }
        const savedIsEditing = localStorage.getItem("commute_is_editing");
        if (savedIsEditing !== null) {
          setIsEditing(savedIsEditing === "true");
        } else if (savedSchedule && Array.isArray(JSON.parse(savedSchedule)) && JSON.parse(savedSchedule).length > 0) {
          setIsEditing(false);
        }
      } catch (e) {
        console.error("Failed to recover localStorage:", e);
      }
    }

    loadData();
    restoreSettings();
    getCsvCoverageStops().then(setCsvCoverageStops);
    getStopAgencyNames().then((map) => setStopAgencyNames(Object.fromEntries(map)));
  }, []);

  // 乗車停留所・時間割が変わった時だけ1週間分のプランをTransitAPI/CSVから再計算する。
  // 同じ設定であれば、ページ遷移で再マウントされてもキャッシュ済みの結果をそのまま使う。
  useEffect(() => {
    let cancelled = false;
    async function computeAll() {
      if (isLoading || error || !boarding) {
        if (!cancelled) setComputedSchedules({});
        return;
      }

      const cached = getComputedScheduleCache(boarding, schedule, days);
      if (cached) {
        if (!cancelled) setComputedSchedules(cached);
        return;
      }

      setIsComputing(true);
      const entries = await Promise.all(
        days.map(async (day) => {
          const plan = await getDaySchedule(day, schedule, periods, boarding);
          return [day, plan] as const;
        })
      );
      if (cancelled) return;
      const result = Object.fromEntries(entries);
      setComputedSchedules(result);
      setIsComputing(false);
      setComputedScheduleCache(boarding, schedule, result);
    }
    computeAll();
    return () => {
      cancelled = true;
    };
  }, [boarding, schedule, periods, isLoading, error]);

  const handleSetBoarding = (next: BoardingSelection) => {
    setBoarding(next);
    if (typeof window !== "undefined") {
      localStorage.setItem("commute_boarding_stop", JSON.stringify(next));
    }
  };

  const handleSearchSelect = (result: LocationSearchResult) => {
    setIsSearchOpen(false);
    // 検索候補の地点IDがCSV路線網の停留所と一致する場合は、CSV側の正規名で
    // boardingを構築する。TransitAPIが返す表記（全角数字等、例:「厚別中央２条６丁目」）を
    // そのまま使うと、CSV側の半角表記（「厚別中央2条6丁目」）と文字列が一致せず、
    // CSV経路が見つかっているのに探索されない・ハイブリッド探索に回ってしまうため。
    const csvStopName = findCsvStopNameByEndpoint(result.endpoint);
    if (csvStopName) {
      handleSetBoarding({ source: "csv", name: csvStopName });
    } else if (result.endpoint) {
      handleSetBoarding({ source: "transit", id: result.endpoint, name: result.name });
    } else {
      handleSetBoarding({ source: "csv", name: result.name });
    }
  };

  const handleSetIsEditing = (editing: boolean) => {
    setIsEditing(editing);
    if (typeof window !== "undefined") {
      localStorage.setItem("commute_is_editing", editing.toString());
    }
  };

  const openJourneyDetail = (day: string, direction: "outbound" | "inbound", leg: CommuteLeg, boardingName: string) => {
    if (typeof window === "undefined") return;
    sessionStorage.setItem("commute_journey_detail", JSON.stringify({ day, direction, leg, boardingName }));
    router.push("/schedule/journey");
  };

  const toggleClass = (day: string, periodId: number) => {
    setSchedule(prev => {
      const key = `${day}-${periodId}`;
      const next = prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key];
      if (typeof window !== "undefined") {
        localStorage.setItem("commute_schedule", JSON.stringify(next));
      }
      return next;
    });
  };

  // 簡易ローダー
  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#eee] flex flex-col items-center justify-center space-y-4">
        <div
          className="animate-spin rounded-full h-12 w-12 border-4 border-t-transparent"
          style={{ borderColor: ACCENT, borderTopColor: "transparent" }}
        ></div>
        <p className="text-gray-500 font-bold">データを読み込んでいます...</p>
      </div>
    );
  }

  // プライマリフェッチエラーのハンドラー
  if (error) {
    return (
      <div className="min-h-screen bg-[#eee] flex items-center justify-center px-4">
        <div className="p-6 text-center space-y-4 max-w-md w-full bg-white rounded-lg border border-[#e8e8e8] shadow-sm">
          <div className="inline-flex bg-red-100 p-3 rounded-full text-red-600">
            <Info size={32} />
          </div>
          <h3 className="text-lg font-bold text-gray-800">エラーが発生しました</h3>
          <p className="text-sm text-red-500">{error}</p>
          <Button size="S" onClick={() => window.location.reload()} className="mx-auto mt-2">
            再読み込みする
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#eee]">
      <div className="max-w-2xl mx-auto px-4 pt-6 pb-8 space-y-4">
        <h1 className="text-2xl font-bold text-black">My時間割</h1>

        {isEditing ? (
          /* 登録・編集エリア */
          <section className="bg-[#fafafa] rounded-lg shadow-[0px_2px_6px_rgba(0,0,0,0.06)] overflow-hidden">
            {/* バス停乗り場の登録 */}
            <div className="relative px-4 pt-4 pb-6 space-y-4">
              <InfoBadge className="absolute right-4 top-4" />
              <p className="text-sm font-bold text-black">バス停乗り場の登録</p>
              <button
                onClick={() => setIsSearchOpen(true)}
                className="w-full bg-white border border-[#e8e8e8] rounded-lg p-4 flex items-center justify-between opacity-80 cursor-pointer transition-colors hover:bg-[#ebebeb] active:bg-[#e0e0e0]"
              >
                <span className="text-sm font-bold text-black">{boarding ? boarding.name : "駅・停留所を検索"}</span>
                <Search size={16} className="text-black/40 shrink-0" />
              </button>
            </div>

            {/* 時間割の登録 */}
            <div className="relative px-4 pt-6 pb-4 space-y-6">
              <InfoBadge className="absolute right-4 top-6" />
              <p className="text-sm font-bold text-black">時間割の登録</p>

              <div className="space-y-2">
                {/* 曜日ヘッダー */}
                <div className="flex text-center">
                  <div className="w-9 shrink-0" />
                  {days.map(day => (
                    <div key={day} className="flex-1 text-xs font-bold text-black">
                      {day}
                    </div>
                  ))}
                </div>

                {/* 時限グリッド */}
                <div className="space-y-2">
                  {periods.map(period => (
                    <div key={period.id} className="flex items-center h-12 gap-1">
                      <div className="w-9 shrink-0 flex flex-col text-black">
                        <span className="text-xs font-bold">{period.id}限</span>
                        <span className="text-[11px] text-black/60">{period.start}</span>
                      </div>
                      <div className="flex flex-1 justify-between gap-2">
                        {days.map(day => {
                          const scheduleArray = Array.isArray(schedule) ? schedule : [];
                          const isSelected = scheduleArray.includes(`${day}-${period.id}`);
                          return (
                            <button
                              key={`${day}-${period.id}`}
                              onClick={() => toggleClass(day, period.id)}
                              aria-pressed={isSelected}
                              className={`size-12 shrink-0 cursor-pointer rounded-lg transition-colors ${
                                isSelected
                                  ? "bg-[#a0e25e] hover:bg-[#93d057] active:bg-[#8dc753]"
                                  // 未選択のhoverは選択色と同じだと区別が付かないため、淡いプレビュー色にする
                                  : "bg-[#d9d9d9] hover:bg-[#c9e9a6] active:bg-[#a0e25e]"
                              }`}
                            />
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <Button onClick={() => handleSetIsEditing(false)}>登録する</Button>
            </div>
          </section>
        ) : (
          /* 通学スケジュール表示エリア（画面遷移せず編集エリアと切り替わる） */
          <div className="flex flex-col gap-10">
            <TodayScheduleSection title="今日のスケジュール" />

              <section className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-black">
                  １週間の最適な移動スケジュール
                  {isComputing && <span className="ml-2 text-xs font-bold animate-pulse" style={{ color: ACCENT }}>計算中...</span>}
                </h2>
                <button
                  onClick={() => handleSetIsEditing(true)}
                  className="text-[11px] font-bold cursor-pointer"
                  style={{ color: ACCENT }}
                >
                  編集する
                </button>
              </div>

              {!boarding ? (
                <div className="bg-[#fafafa] p-8 rounded-lg border border-[#e8e8e8] text-center">
                  <MapPin className="w-10 h-10 text-black/20 mx-auto mb-3" />
                  <p className="text-black/50 font-medium text-sm">
                    乗車する駅・停留所を登録すると、
                    <br />
                    1週間の移動スケジュールを計算します。
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {days.map(day => {
                    const plan = computedSchedules[day];

                    return (
                      <div
                        key={day}
                        className="bg-[#fafafa] rounded-lg shadow-[0px_2px_6px_rgba(0,0,0,0.06)] p-4 space-y-4"
                      >
                        <div className="flex items-start justify-between gap-4 flex-wrap">
                          <p className="text-base font-bold text-black shrink-0">{dayFullNames[day]}</p>
                          {plan && (
                            <div className="flex items-center justify-end gap-4 flex-wrap">
                              <p className="text-xs text-black whitespace-nowrap">
                                本日の授業時間：<span className="font-bold">{plan.classStart}~{plan.classEnd}</span>
                              </p>
                              <span
                                className="rounded-lg border p-1 text-[10px] font-bold text-black whitespace-nowrap"
                                style={{ borderColor: ACCENT }}
                              >
                                {plan.minPeriod}限〜{plan.maxPeriod}限
                              </span>
                            </div>
                          )}
                        </div>

                        <hr className="border-black/10" />

                        {plan ? (
                          <div className="space-y-4">
                            <LegSection
                              label="行き"
                              leg={plan.outbound}
                              direction="outbound"
                              boardingName={boarding.name}
                              emptyMessage="授業開始時間に間に合う運行バスが見つかりませんでした。"
                              onOpenDetail={(leg) => openJourneyDetail(day, "outbound", leg, boarding.name)}
                            />
                            <LegSection
                              label="帰り"
                              leg={plan.inbound}
                              direction="inbound"
                              boardingName={boarding.name}
                              emptyMessage="授業終了後に乗車できる運行バスが見つかりませんでした。"
                              onOpenDetail={(leg) => openJourneyDetail(day, "inbound", leg, boarding.name)}
                            />
                          </div>
                        ) : (
                          <p className="text-xs text-black/50 text-center py-4">
                            この曜日はお休みです（授業が登録されていません）
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
              </section>
          </div>
        )}

        <LocationSearchModal
          isOpen={isSearchOpen}
          onClose={() => setIsSearchOpen(false)}
          onSelect={handleSearchSelect}
          placeholder="駅名・停留所名で検索"
          pinned={csvCoverageStops}
          pinnedLabel="よく使う乗り場"
          pinnedAgencyNames={stopAgencyNames}
        />
      </div>
    </div>
  );
}
