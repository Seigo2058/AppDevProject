"use client";

import { useState, useEffect } from "react";
import { Clock, Bus, MapPin, Calendar, Check, GraduationCap, Info, Search } from "lucide-react";
import {
  ClassPeriod,
  BoardingSelection,
  DayPlan,
  days,
  dayFullNames,
  parseCSV,
  fetchWithTimeout,
  getDaySchedule,
} from "@/lib/schedule";
import { getCsvCoverageStops } from "@/lib/tripGraph";
import LocationSearchModal, { LocationSearchResult } from "@/components/search/LocationSearchModal";

export default function SchedulePage() {
  // 読み込み状態
  const [periods, setPeriods] = useState<ClassPeriod[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 自前CSVで直通/1回の乗換により大学へ到達できる停留所（検索の「よく使う乗り場」候補）
  const [csvCoverageStops, setCsvCoverageStops] = useState<string[]>([]);

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
  }, []);

  // 乗車停留所・駅が変わるたびに1週間分のプランをTransitAPI/CSVから再計算する
  useEffect(() => {
    let cancelled = false;
    async function computeAll() {
      if (isLoading || error || !boarding) {
        if (!cancelled) setComputedSchedules({});
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
      setComputedSchedules(Object.fromEntries(entries));
      setIsComputing(false);
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
    if (result.endpoint) {
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
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent"></div>
        <p className="text-gray-500 font-bold">データを読み込んでいます...</p>
      </div>
    );
  }

  // プライマリフェッチエラーのハンドラー
  if (error) {
    return (
      <div className="p-6 text-center space-y-4 max-w-md mx-auto mt-10 bg-white rounded-2xl border border-gray-100 shadow-sm">
        <div className="inline-flex bg-red-100 p-3 rounded-full text-red-600">
          <Info size={32} />
        </div>
        <h3 className="text-lg font-bold text-gray-800">エラーが発生しました</h3>
        <p className="text-sm text-red-500">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-2 px-4 py-2 bg-blue-600 text-white font-bold rounded-xl text-xs hover:bg-blue-700 transition-colors cursor-pointer"
        >
          再読み込みする
        </button>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-6 pb-24 max-w-2xl mx-auto">

      {/* 登録・編集エリア (isEditing === true の時のみ表示) */}
      {isEditing && (
        <section className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm space-y-6 animate-in fade-in duration-200">
          <div className="space-y-4">
            <div className="flex items-center space-x-2 text-gray-800">
              <Bus className="text-blue-600 h-5 w-5" />
              <h3 className="text-sm font-bold text-gray-800">乗車バス停の登録</h3>
            </div>
            <p className="text-xs text-gray-500 leading-relaxed">
              出発する最寄りの駅・停留所を検索してください。情報大学行きの運行状況と照らし合わせます。
            </p>

            <button
              onClick={() => setIsSearchOpen(true)}
              className="w-full py-3.5 pl-10 pr-10 rounded-xl text-sm font-bold bg-gray-50 border border-gray-200 text-gray-800 text-left cursor-pointer transition-all hover:bg-gray-100 relative"
            >
              {boarding ? boarding.name : "駅・停留所を検索"}
              <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                <MapPin size={18} />
              </div>
              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                <Search size={16} />
              </div>
            </button>
          </div>

          <hr className="border-gray-100" />

          <div className="space-y-4">
            <div className="flex items-center space-x-2 text-gray-800">
              <Calendar className="text-blue-600 h-5 w-5" />
              <h3 className="text-sm font-bold text-gray-800">授業時間割の登録</h3>
            </div>

            <p className="text-xs text-gray-500">
              授業がある「曜日 ✕ 時間目」のマスをタップして登録してください（再度タップすると解除）。
            </p>

            <div className="overflow-x-auto pb-2 -mx-2 px-2 sm:mx-0 sm:px-0">
              <div className="w-full min-w-[260px] sm:min-w-[340px] space-y-1.5">
                {/* ヘッダー行 */}
                <div className="flex text-center">
                  <div className="w-8 sm:w-10 shrink-0"></div>
                  {days.map(day => (
                    <div key={day} className="flex-1 text-xs font-black text-gray-500 py-1">
                      {day}
                    </div>
                  ))}
                </div>

                {/* グリッド本体 */}
                <div className="space-y-1">
                  {periods.map((period) => (
                    <div key={period.id} className="flex h-12 items-center">
                      {/* 時間付きの授業ラベル */}
                      <div className="w-8 sm:w-10 flex flex-col justify-center items-center text-center shrink-0">
                        <span className="text-[10px] sm:text-[11px] font-black text-gray-800">{period.id}限</span>
                        <span className="text-[7px] sm:text-[8px] text-gray-400 font-bold leading-none">{period.start}</span>
                      </div>

                      {/* インタラクティブな曜日 */}
                      {days.map(day => {
                        const scheduleArray = Array.isArray(schedule) ? schedule : [];
                        const isSelected = scheduleArray.includes(`${day}-${period.id}`);
                        return (
                          <div key={`${day}-${period.id}`} className="flex-1 h-full px-0.5 py-0.5">
                            <button
                              onClick={() => toggleClass(day, period.id)}
                              className={`w-full h-full rounded-lg transition-all active:scale-95 flex items-center justify-center cursor-pointer border ${
                                isSelected
                                  ? "bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-500/20 font-black scale-[0.98]"
                                  : "bg-gray-50 hover:bg-gray-200/70 border-gray-100 text-gray-400"
                              }`}
                            >
                              {isSelected ? (
                                <span className="text-xs text-white">✓</span>
                              ) : (
                                <span className="text-[9px] font-medium opacity-20">{period.id}限</span>
                              )}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <button
              onClick={() => handleSetIsEditing(false)}
              className="w-full bg-blue-600 text-white font-bold py-3.5 rounded-xl shadow-md flex items-center justify-center hover:bg-blue-700 transition-colors active:scale-[0.99] cursor-pointer"
            >
              <Check size={18} className="mr-2" />
              登録する
            </button>
          </div>
        </section>
      )}

      {/* 通学スケジュールセクション */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-extrabold text-gray-600 uppercase tracking-wider">
            1週間の最適な移動スケジュール
            {isComputing && <span className="ml-2 text-blue-500 normal-case font-bold animate-pulse">計算中...</span>}
          </h3>
          {!isEditing && (
            <button
              onClick={() => handleSetIsEditing(true)}
              className="flex items-center space-x-1 text-xs font-bold text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg hover:bg-blue-100 transition-colors cursor-pointer"
            >
              <span>編集する</span>
            </button>
          )}
        </div>

        {!boarding ? (
          <div className="bg-white p-8 rounded-2xl border border-gray-100 text-center shadow-sm">
            <MapPin className="w-10 h-10 text-gray-200 mx-auto mb-3" />
            <p className="text-gray-500 font-medium text-sm">
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
                <div key={day} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden transition-all duration-300 hover:shadow-md">
                  {/* カードタイトルバー */}
                  <div className="bg-gray-50/80 px-5 py-3.5 border-b border-gray-100 flex justify-between items-center">
                    <span className="font-bold text-gray-800 text-sm">{dayFullNames[day]}</span>
                    {plan ? (
                      <span className="text-[11px] font-black text-blue-700 bg-blue-50 border border-blue-100 px-3 py-1 rounded-full">
                        {plan.minPeriod}限 〜 {plan.maxPeriod}限
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold text-gray-400 bg-gray-150 px-2 py-0.5 rounded-full">
                        授業なし
                      </span>
                    )}
                  </div>

                  {/* 通学プランコンテンツ */}
                  <div className="p-5">
                    {plan ? (
                      <div className="space-y-5">

                        {/* 授業情報ブロック */}
                        <div className="flex items-center space-x-3 text-xs bg-gray-50 p-3 rounded-xl border border-gray-100">
                          <GraduationCap className="h-4.5 w-4.5 text-gray-500" />
                          <div>
                            <span className="font-bold text-gray-600">本日の授業時間: </span>
                            <span className="font-black text-gray-900 ml-1">
                              {plan.classStart} 〜 {plan.classEnd}
                            </span>
                          </div>
                        </div>

                        {/* 行きの通学セクション */}
                        <div className="space-y-2">
                          <div className="flex items-center space-x-1.5 text-xs font-extrabold text-blue-600">
                            <MapPin size={14} />
                            <span>行き (登校・{plan.minPeriod}限開始に合わせる)</span>
                          </div>

                          {plan.outbound ? (
                            <div className="bg-blue-50/30 border border-blue-100 rounded-xl p-4 space-y-3">
                              <div className="flex justify-between items-center">
                                {/* 乗車情報 */}
                                <div className="text-left space-y-1">
                                  <p className="text-xs text-gray-400 font-bold">乗車停留所</p>
                                  <p className="text-base font-black text-gray-900">{plan.outbound.departureTime}</p>
                                  <p className="text-[10px] font-bold text-blue-600 bg-blue-100/60 px-1.5 py-0.5 rounded-md inline-block">
                                    {boarding.name}
                                  </p>
                                </div>

                                {/* 通学の矢印 */}
                                <div className="flex flex-col items-center px-4 flex-1">
                                  <div className="w-full flex items-center justify-center space-x-1 text-gray-400">
                                    <div className="h-[1px] bg-gray-200 flex-1"></div>
                                    <Bus size={14} className="text-blue-500 animate-pulse" />
                                    <div className="h-[1px] bg-gray-200 flex-1"></div>
                                  </div>
                                  <p className="text-[9px] font-bold text-gray-400 mt-1">運行中</p>
                                </div>

                                {/* 目的地情報 */}
                                <div className="text-right space-y-1">
                                  <p className="text-xs text-gray-400 font-bold">大学到着時刻</p>
                                  <p className="text-base font-black text-gray-900">{plan.outbound.arrivalTime}</p>
                                  <p className="text-[10px] font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 px-1.5 py-0.5 rounded-md inline-block">
                                    {plan.outbound.stopLabel}
                                  </p>
                                </div>
                              </div>

                              {plan.outbound.isSchoolBus ? (
                                <div className="flex items-center space-x-1 bg-green-50 border border-green-200 text-green-700 px-2 py-1 rounded-lg text-[10px] font-bold w-fit">
                                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-green-500"></span>
                                  <span>スクール便 (講義期間中運行)</span>
                                </div>
                              ) : plan.outbound.routeName ? (
                                <div className="flex items-center space-x-1 bg-gray-100 border border-gray-200 text-gray-600 px-2 py-1 rounded-lg text-[10px] font-bold w-fit">
                                  <span>路線: {plan.outbound.routeName}</span>
                                </div>
                              ) : null}
                            </div>
                          ) : (
                            <div className="bg-red-50 text-red-700 p-4 rounded-xl border border-red-100 text-xs font-bold">
                              授業開始時間に間に合う運行バスが見つかりませんでした。
                            </div>
                          )}
                        </div>

                        {/* 帰りの通学セクション */}
                        <div className="space-y-2">
                          <div className="flex items-center space-x-1.5 text-xs font-extrabold text-indigo-600">
                            <Clock size={14} />
                            <span>帰り (下校・{plan.maxPeriod}限終了以降に乗車)</span>
                          </div>

                          {plan.inbound ? (
                            <div className="bg-indigo-50/20 border border-indigo-100 rounded-xl p-4 space-y-3">
                              <div className="flex justify-between items-center">
                                {/* 乗車停留所 */}
                                <div className="text-left space-y-1">
                                  <p className="text-xs text-gray-400 font-bold">大学乗車時刻</p>
                                  <p className="text-base font-black text-gray-900">{plan.inbound.departureTime}</p>
                                  <p className="text-[10px] font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 px-1.5 py-0.5 rounded-md inline-block">
                                    {plan.inbound.stopLabel}
                                  </p>
                                </div>

                                {/* 通学の矢印 */}
                                <div className="flex flex-col items-center px-4 flex-1">
                                  <div className="w-full flex items-center justify-center space-x-1 text-gray-400">
                                    <div className="h-[1px] bg-gray-200 flex-1"></div>
                                    <Bus size={14} className="text-indigo-500" />
                                    <div className="h-[1px] bg-gray-200 flex-1"></div>
                                  </div>
                                  <p className="text-[9px] font-bold text-gray-400 mt-1">運行中</p>
                                </div>

                                {/* 目的地情報 */}
                                <div className="text-right space-y-1">
                                  <p className="text-xs text-gray-400 font-bold">最寄り到着時刻</p>
                                  <p className="text-base font-black text-gray-900">{plan.inbound.arrivalTime}</p>
                                  <p className="text-[10px] font-bold text-blue-600 bg-blue-50 border border-blue-100 px-1.5 py-0.5 rounded-md inline-block">
                                    {boarding.name}
                                  </p>
                                </div>
                              </div>

                              {plan.inbound.isSchoolBus ? (
                                <div className="flex items-center space-x-1 bg-green-50 border border-green-200 text-green-700 px-2 py-1 rounded-lg text-[10px] font-bold w-fit">
                                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-green-500"></span>
                                  <span>スクール便 (講義期間中運行)</span>
                                </div>
                              ) : plan.inbound.routeName ? (
                                <div className="flex items-center space-x-1 bg-gray-100 border border-gray-200 text-gray-600 px-2 py-1 rounded-lg text-[10px] font-bold w-fit">
                                  <span>路線: {plan.inbound.routeName}</span>
                                </div>
                              ) : null}
                            </div>
                          ) : (
                            <div className="bg-red-50 text-red-700 p-4 rounded-xl border border-red-100 text-xs font-bold">
                              授業終了後に乗車できる運行バスが見つかりませんでした。
                            </div>
                          )}
                        </div>

                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-6 text-center space-y-2">
                        <div className="bg-gray-50 p-3 rounded-full text-gray-300">
                          <Calendar size={24} />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-gray-600">この曜日はお休みです</p>
                          <p className="text-[10px] text-gray-400 mt-0.5">授業が登録されていないため、通学バスの計算はありません。</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <LocationSearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        onSelect={handleSearchSelect}
        placeholder="駅名・停留所名で検索"
        pinned={csvCoverageStops}
        pinnedLabel="よく使う乗り場"
      />

    </div>
  );
}
