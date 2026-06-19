"use client";

import { useState, useEffect } from "react";
import { 
  Clock, 
  Bus, 
  MapPin, 
  Calendar, 
  Check, 
  ArrowRight, 
  GraduationCap, 
  Info, 
  CalendarCheck 
} from "lucide-react";

// CSVのレコードに対応する型
interface ClassPeriod {
  id: number;
  start: string;
  end: string;
}

interface OutboundBus {
  shinsapporo: string;
  atsubetsuChuo: string;
  oasa: string;
  wakaba: string;
  nopporo: string;
  johodai: string;
  edc: string;
  isSchool: boolean;
}

interface InboundBus {
  edc: string;
  johodai: string;
  nopporo: string;
  wakaba: string;
  oasa: string;
  atsubetsuChuo: string;
  shinsapporo: string;
  isSchool: boolean;
}

const days = ["月", "火", "水", "木", "金"];
const dayFullNames: Record<string, string> = {
  "月": "月曜日",
  "火": "火曜日",
  "水": "水曜日",
  "木": "木曜日",
  "金": "金曜日"
};

// 堅牢なCSV行パーサー
function parseCSV(text: string): string[][] {
  try {
    if (!text) return [];
    const lines = text.split(/\r?\n/);
    return lines
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .map(line => line.split(',').map(cell => cell.trim()));
  } catch (e) {
    console.error("CSV Parse error:", e);
    return [];
  }
}

// HH:MM形式の文字列を深夜0時からの分数に変換する
function timeToMinutes(timeStr: string): number {
  if (!timeStr || timeStr === "-") return -1;
  try {
    const parts = timeStr.split(":");
    if (parts.length !== 2) return -1;
    const hours = parseInt(parts[0], 10);
    const minutes = parseInt(parts[1], 10);
    if (isNaN(hours) || isNaN(minutes)) return -1;
    return hours * 60 + minutes;
  } catch (e) {
    return -1;
  }
}

// タイムアウト付きのフェッチヘルパー
async function fetchWithTimeout(url: string, ms = 8000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), ms);
  try {
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    throw error;
  }
}

export default function SchedulePage() {
  // 読み込み状態
  const [periods, setPeriods] = useState<ClassPeriod[]>([]);
  const [outboundBuses, setOutboundBuses] = useState<OutboundBus[]>([]);
  const [inboundBuses, setInboundBuses] = useState<InboundBus[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ユーザー設定
  const [boardingStop, setBoardingStop] = useState<string>("新札幌駅");
  const [schedule, setSchedule] = useState<string[]>([]);
  const [isEditing, setIsEditing] = useState(true);

  // マウント時にCSVデータを読み込む
  useEffect(() => {
    async function loadData() {
      try {
        const [resPeriods, resOutbound, resInbound] = await Promise.all([
          fetchWithTimeout("/csv/school_timetable.csv").then(r => {
            if (!r.ok) throw new Error("timetable.csv の読み込みに失敗しました");
            return r.text();
          }),
          fetchWithTimeout("/csv/timetable_jrbus_shin29_ShinsapporoToJohodai_weekdays.csv").then(r => {
            if (!r.ok) throw new Error("行き時刻表CSV の読み込みに失敗しました");
            return r.text();
          }),
          fetchWithTimeout("/csv/timetable_jrbus_shin29_JohodaiToShinsapporo_weekdays.csv").then(r => {
            if (!r.ok) throw new Error("帰り時刻表CSV の読み込みに失敗しました");
            return r.text();
          }),
        ]);

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

        // 行き（outbound）の解析
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
        setOutboundBuses(parsedOutbound);

        // 帰り（inbound）の解析
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
        setInboundBuses(parsedInbound);
        setIsLoading(false);
      } catch (err: any) {
        console.error("Failed to load CSV data:", err);
        setError(err.message || "データの読み込みに失敗しました。");
        setIsLoading(false);
      }
    }

    loadData();

    // localStorageから設定を復元する
    if (typeof window !== "undefined") {
      try {
        const savedStop = localStorage.getItem("commute_boarding_stop");
        if (savedStop) {
          // eslint-disable-next-line react-hooks/exhaustive-deps
          setBoardingStop(savedStop);
        }
        const savedSchedule = localStorage.getItem("commute_schedule");
        if (savedSchedule) {
          const parsed = JSON.parse(savedSchedule);
          if (Array.isArray(parsed)) {
            // eslint-disable-next-line react-hooks/exhaustive-deps
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSetBoardingStop = (stop: string) => {
    setBoardingStop(stop);
    if (typeof window !== "undefined") {
      localStorage.setItem("commute_boarding_stop", stop);
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

  // 行きのバス乗車時刻ヘルパー
  const getOutboundDepartureTime = (bus: OutboundBus | null | undefined, stop: string): string => {
    if (!bus) return "-";
    if (stop === "新札幌駅") return bus.shinsapporo || "-";
    if (stop === "厚別中央2条6丁目") return bus.atsubetsuChuo || "-";
    if (stop === "大麻駅南口") return bus.oasa || "-";
    if (stop === "若葉1丁目") return bus.wakaba || "-";
    if (stop === "野幌駅南口") return bus.nopporo || "-";
    return "-";
  };

  // 帰りのバス到着時刻ヘルパー
  const getInboundArrivalTime = (bus: InboundBus | null | undefined, stop: string): string => {
    if (!bus) return "-";
    if (stop === "新札幌駅") return bus.shinsapporo || "-";
    if (stop === "厚別中央2条6丁目") return bus.atsubetsuChuo || "-";
    if (stop === "大麻駅南口") return bus.oasa || "-";
    if (stop === "若葉1丁目") return bus.wakaba || "-";
    if (stop === "野幌駅南口") return bus.nopporo || "-";
    return "-";
  };

  // 指定された曜日の授業時間に基づいて通学スケジュールを動的に計算する
  const getDaySchedule = (day: string) => {
    try {
      const scheduleArray = Array.isArray(schedule) ? schedule : [];
      const dayPeriods = periods.filter(p => p && p.id && scheduleArray.includes(`${day}-${p.id}`));
      if (dayPeriods.length === 0) return null;

      // 最初と最後の授業時間のID
      const periodIds = dayPeriods.map(p => p.id).filter(id => !isNaN(id));
      if (periodIds.length === 0) return null;
      
      const minPeriodId = Math.min(...periodIds);
      const maxPeriodId = Math.max(...periodIds);

      const firstPeriod = periods.find(p => p.id === minPeriodId);
      const lastPeriod = periods.find(p => p.id === maxPeriodId);

      if (!firstPeriod || !lastPeriod) {
        return null;
      }

      const classStart = firstPeriod.start || "09:00";
      const classEnd = lastPeriod.end || "18:00";
      const startMins = timeToMinutes(classStart);
      const endMins = timeToMinutes(classEnd);

      if (startMins === -1 || endMins === -1) return null;

      // 行きの計算
      // 授業開始時刻以前に大学に到着する最も遅いバスを見つける
      let optimalOutbound: OutboundBus | null = null;
      let latestArrivalMins = -1;

      for (const bus of outboundBuses) {
        if (!bus) continue;
        const depTime = getOutboundDepartureTime(bus, boardingStop);
        const arrTime = bus.edc && bus.edc !== "-" ? bus.edc : (bus.johodai && bus.johodai !== "-" ? bus.johodai : "-");
        
        if (depTime === "-" || arrTime === "-") continue;

        const depMins = timeToMinutes(depTime);
        const arrMins = timeToMinutes(arrTime);
        if (depMins === -1 || arrMins === -1) continue;

        if (arrMins <= startMins) {
          if (arrMins > latestArrivalMins) {
            latestArrivalMins = arrMins;
            optimalOutbound = bus;
          } else if (arrMins === latestArrivalMins) {
            // 移動時間を最小限に抑えるため、出発時刻が遅い方を選択する
            if (optimalOutbound) {
              const currentOptimalDepTime = getOutboundDepartureTime(optimalOutbound, boardingStop);
              const currentOptimalDepMins = timeToMinutes(currentOptimalDepTime);
              if (currentOptimalDepMins !== -1 && depMins > currentOptimalDepMins) {
                optimalOutbound = bus;
              }
            }
          }
        }
      }

      // フォールバック: 授業前に到着するバスがない場合、最も早いバスを選択する
      if (!optimalOutbound && outboundBuses.length > 0) {
        const validBuses = outboundBuses.filter(bus => 
          bus &&
          getOutboundDepartureTime(bus, boardingStop) !== "-" && 
          (bus.edc !== "-" || bus.johodai !== "-")
        );
        if (validBuses.length > 0) {
          optimalOutbound = validBuses[0];
        }
      }

      // 帰りの計算
      // 授業終了時刻以降に大学を出発する最も早いバスを見つける
      let optimalInbound: InboundBus | null = null;
      let earliestDepartureMins = 9999;

      for (const bus of inboundBuses) {
        if (!bus) continue;
        const depStop = bus.edc && bus.edc !== "-" ? "eDCタワー前(構内)" : (bus.johodai && bus.johodai !== "-" ? "情報大学前(白樺通沿)" : null);
        if (!depStop) continue;

        const depTime = depStop === "eDCタワー前(構内)" ? bus.edc : bus.johodai;
        const arrTime = getInboundArrivalTime(bus, boardingStop);

        if (depTime === "-" || arrTime === "-") continue;

        const depMins = timeToMinutes(depTime);
        const arrMins = timeToMinutes(arrTime);
        if (depMins === -1 || arrMins === -1) continue;

        if (depMins >= endMins) {
          if (depMins < earliestDepartureMins) {
            earliestDepartureMins = depMins;
            optimalInbound = bus;
          }
        }
      }

      // フォールバック: 授業後に運行するバスがない場合、利用可能な最も遅いバスを選択する
      if (!optimalInbound && inboundBuses.length > 0) {
        const validBuses = inboundBuses.filter(bus => 
          bus &&
          (bus.edc !== "-" || bus.johodai !== "-") && 
          getInboundArrivalTime(bus, boardingStop) !== "-"
        );
        if (validBuses.length > 0) {
          optimalInbound = validBuses[validBuses.length - 1];
        }
      }

      return {
        minPeriod: minPeriodId,
        maxPeriod: maxPeriodId,
        classStart,
        classEnd,
        outbound: optimalOutbound,
        inbound: optimalInbound
      };
    } catch (e) {
      console.error(`getDaySchedule error for day ${day}:`, e);
      return null;
    }
  };

  // レンダリング時のクラッシュをキャッチするための毎日のスケジュールの安全な評価
  let computedSchedules: Record<string, any> = {};
  let renderingError: string | null = null;

  try {
    if (!isLoading && !error) {
      for (const day of days) {
        computedSchedules[day] = getDaySchedule(day);
      }
    }
  } catch (e: any) {
    console.error("Render calculations failed:", e);
    renderingError = e.message || "時刻データの処理中にエラーが発生しました。";
  }

  // 簡易ローダー
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent"></div>
        <p className="text-gray-500 font-bold">データを読み込んでいます...</p>
      </div>
    );
  }

  // プライマリフェッチエラーまたはレンダリング計算クラッシュのハンドラー
  const activeError = error || renderingError;
  if (activeError) {
    return (
      <div className="p-6 text-center space-y-4 max-w-md mx-auto mt-10 bg-white rounded-2xl border border-gray-100 shadow-sm">
        <div className="inline-flex bg-red-100 p-3 rounded-full text-red-600">
          <Info size={32} />
        </div>
        <h3 className="text-lg font-bold text-gray-800">エラーが発生しました</h3>
        <p className="text-sm text-red-500">{activeError}</p>
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
              出発する最寄りの停留所を選択してください。情報大学行きのバス運行状況と照らし合わせます。
            </p>
            
            <div className="pt-1 relative">
              <select
                value={boardingStop}
                onChange={(e) => handleSetBoardingStop(e.target.value)}
                className="w-full py-3.5 pl-10 pr-10 rounded-xl text-sm font-bold bg-gray-50 border border-gray-200 text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500/50 cursor-pointer appearance-none transition-all hover:bg-gray-100"
              >
                {["新札幌駅", "厚別中央2条6丁目", "大麻駅南口", "若葉1丁目", "野幌駅南口"].map((stop) => (
                  <option key={stop} value={stop}>
                    {stop}
                  </option>
                ))}
              </select>
              <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                <MapPin size={18} />
              </div>
              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
              </div>
            </div>
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
                                <p className="text-base font-black text-gray-900">
                                  {getOutboundDepartureTime(plan.outbound, boardingStop)}
                                </p>
                                <p className="text-[10px] font-bold text-blue-600 bg-blue-100/60 px-1.5 py-0.5 rounded-md inline-block">
                                  {boardingStop}
                                </p>
                              </div>

                              {/* 通学の矢印 */}
                              <div className="flex flex-col items-center px-4 flex-1">
                                <div className="w-full flex items-center justify-center space-x-1 text-gray-400">
                                  <div className="h-[1px] bg-gray-200 flex-1"></div>
                                  <Bus size={14} className="text-blue-500 animate-pulse" />
                                  <div className="h-[1px] bg-gray-200 flex-1"></div>
                                </div>
                                <p className="text-[9px] font-bold text-gray-400 mt-1">バス運行</p>
                              </div>

                              {/* 目的地情報 */}
                              <div className="text-right space-y-1">
                                <p className="text-xs text-gray-400 font-bold">大学到着時刻</p>
                                <p className="text-base font-black text-gray-900">
                                  {plan.outbound.edc !== "-" ? plan.outbound.edc : plan.outbound.johodai}
                                </p>
                                <p className="text-[10px] font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 px-1.5 py-0.5 rounded-md inline-block">
                                  {plan.outbound.edc !== "-" ? "eDCタワー前" : "情報大学前"}
                                </p>
                              </div>
                            </div>

                            {/* スクールバスの場合の追加バッジ */}
                            {plan.outbound.isSchool && (
                              <div className="flex items-center space-x-1 bg-green-50 border border-green-200 text-green-700 px-2 py-1 rounded-lg text-[10px] font-bold w-fit">
                                <span className="inline-block h-1.5 w-1.5 rounded-full bg-green-500"></span>
                                <span>スクール便 (講義期間中運行)</span>
                              </div>
                            )}
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
                                <p className="text-base font-black text-gray-900">
                                  {plan.inbound.edc !== "-" ? plan.inbound.edc : plan.inbound.johodai}
                                </p>
                                <p className="text-[10px] font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 px-1.5 py-0.5 rounded-md inline-block">
                                  {plan.inbound.edc !== "-" ? "eDCタワー前" : "情報大学前"}
                                </p>
                              </div>

                              {/* 通学の矢印 */}
                              <div className="flex flex-col items-center px-4 flex-1">
                                <div className="w-full flex items-center justify-center space-x-1 text-gray-400">
                                  <div className="h-[1px] bg-gray-200 flex-1"></div>
                                  <Bus size={14} className="text-indigo-500" />
                                  <div className="h-[1px] bg-gray-200 flex-1"></div>
                                </div>
                                <p className="text-[9px] font-bold text-gray-400 mt-1">バス運行</p>
                              </div>

                              {/* 目的地情報 */}
                              <div className="text-right space-y-1">
                                <p className="text-xs text-gray-400 font-bold">最寄り到着時刻</p>
                                <p className="text-base font-black text-gray-900">
                                  {getInboundArrivalTime(plan.inbound, boardingStop)}
                                </p>
                                <p className="text-[10px] font-bold text-blue-600 bg-blue-50 border border-blue-100 px-1.5 py-0.5 rounded-md inline-block">
                                  {boardingStop}
                                </p>
                              </div>
                            </div>

                            {/* スクールバスの場合の追加バッジ */}
                            {plan.inbound.isSchool && (
                              <div className="flex items-center space-x-1 bg-green-50 border border-green-200 text-green-700 px-2 py-1 rounded-lg text-[10px] font-bold w-fit">
                                <span className="inline-block h-1.5 w-1.5 rounded-full bg-green-500"></span>
                                <span>スクール便 (講義期間中運行)</span>
                              </div>
                            )}
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
      </section>

    </div>
  );
}
