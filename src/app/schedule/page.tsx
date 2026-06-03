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

// Types matching CSV records
interface ClassPeriod {
  id: number;
  start: string;
  end: string;
}

interface OutboundBus {
  shinsapporo: string;
  oasa: string;
  nopporo: string;
  johodai: string;
  edc: string;
  isSchool: boolean;
}

interface InboundBus {
  edc: string;
  johodai: string;
  nopporo: string;
  oasa: string;
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

// Robust CSV Line parser
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

// Convert HH:MM time string to minutes past midnight
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

// Fetch helper with timeout
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
  // Load States
  const [periods, setPeriods] = useState<ClassPeriod[]>([]);
  const [outboundBuses, setOutboundBuses] = useState<OutboundBus[]>([]);
  const [inboundBuses, setInboundBuses] = useState<InboundBus[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // User Preferences
  const [boardingStop, setBoardingStop] = useState<string>("新札幌駅");
  const [schedule, setSchedule] = useState<string[]>([]);
  const [isEditing, setIsEditing] = useState(true);

  // Load CSV data on mount
  useEffect(() => {
    async function loadData() {
      try {
        const [resPeriods, resOutbound, resInbound] = await Promise.all([
          fetchWithTimeout("/csv/school_timetable.csv").then(r => {
            if (!r.ok) throw new Error("timetable.csv の読み込みに失敗しました");
            return r.text();
          }),
          fetchWithTimeout("/csv/timetable_jrbus_shinsapporoToJohodai.csv").then(r => {
            if (!r.ok) throw new Error("行き時刻表CSV の読み込みに失敗しました");
            return r.text();
          }),
          fetchWithTimeout("/csv/timetable_jrbus_johodaiToShinsapporo.csv").then(r => {
            if (!r.ok) throw new Error("帰り時刻表CSV の読み込みに失敗しました");
            return r.text();
          }),
        ]);

        // Parse school_timetable
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

        // Parse outbound
        const rawOutbound = parseCSV(resOutbound);
        const parsedOutbound: OutboundBus[] = [];
        for (let i = 1; i < rawOutbound.length; i++) {
          const row = rawOutbound[i];
          if (row && row.length >= 5) {
            parsedOutbound.push({
              shinsapporo: row[0] || "-",
              oasa: row[1] || "-",
              nopporo: row[2] || "-",
              johodai: row[3] || "-",
              edc: row[4] || "-",
              isSchool: row[5] === "TRUE",
            });
          }
        }
        setOutboundBuses(parsedOutbound);

        // Parse inbound
        const rawInbound = parseCSV(resInbound);
        const parsedInbound: InboundBus[] = [];
        for (let i = 1; i < rawInbound.length; i++) {
          const row = rawInbound[i];
          if (row && row.length >= 5) {
            parsedInbound.push({
              edc: row[0] || "-",
              johodai: row[1] || "-",
              nopporo: row[2] || "-",
              oasa: row[3] || "-",
              shinsapporo: row[4] || "-",
              isSchool: row[5] === "TRUE",
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

    // Recover preferences from localStorage
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

  // Outbound boarding bus time helper
  const getOutboundDepartureTime = (bus: OutboundBus | null | undefined, stop: string): string => {
    if (!bus) return "-";
    if (stop === "新札幌駅") return bus.shinsapporo || "-";
    if (stop === "大麻駅南口") return bus.oasa || "-";
    if (stop === "野幌駅南口") return bus.nopporo || "-";
    return "-";
  };

  // Inbound arrival bus time helper
  const getInboundArrivalTime = (bus: InboundBus | null | undefined, stop: string): string => {
    if (!bus) return "-";
    if (stop === "新札幌駅") return bus.shinsapporo || "-";
    if (stop === "大麻駅南口") return bus.oasa || "-";
    if (stop === "野幌駅南口") return bus.nopporo || "-";
    return "-";
  };

  // Dynamically calculate commute schedules based on periods for a specific day
  const getDaySchedule = (day: string) => {
    try {
      const scheduleArray = Array.isArray(schedule) ? schedule : [];
      const dayPeriods = periods.filter(p => p && p.id && scheduleArray.includes(`${day}-${p.id}`));
      if (dayPeriods.length === 0) return null;

      // First and last period IDs
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

      // OUTBOUND CALCULATION
      // Find the latest bus that arrives at University before or exactly at classStart
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
            // Choose the one that has a later departure to minimize travel time
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

      // Fallback: If no bus arrives before class, pick the earliest available bus
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

      // INBOUND CALCULATION
      // Find the earliest bus that departs from University after or exactly at classEnd
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

      // Fallback: If no bus is scheduled after the class, pick the latest available bus
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

  // Safe evaluation of daily schedules to catch any render-time crashes
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

  // Quick loaders
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent"></div>
        <p className="text-gray-500 font-bold">データを読み込んでいます...</p>
      </div>
    );
  }

  // Primary fetch error or render calculation crash handler
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
      

      {/* Bus Stop Selector Area */}
      <section className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm space-y-4">
        <div className="flex items-center space-x-2 text-gray-800">
          <Bus className="text-blue-600 h-5 w-5" />
          <h3 className="text-sm font-bold text-gray-800">乗車バス停の登録</h3>
        </div>
        <p className="text-xs text-gray-500 leading-relaxed">
          出発する最寄りの停留所を選択してください。情報大学行きのバス運行状況と照らし合わせます。
        </p>
        
        <div className="grid grid-cols-3 gap-2.5 pt-1">
          {["新札幌駅", "大麻駅南口", "野幌駅南口"].map((stop) => {
            const isSelected = boardingStop === stop;
            return (
              <button
                key={stop}
                onClick={() => handleSetBoardingStop(stop)}
                className={`py-3 px-2 rounded-xl text-center text-xs font-bold transition-all flex flex-col items-center justify-center space-y-1.5 cursor-pointer border ${
                  isSelected
                    ? "bg-blue-50 text-blue-700 border-blue-200 shadow-sm font-black ring-2 ring-blue-500/20"
                    : "bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100 hover:text-gray-800"
                }`}
              >
                <MapPin className={`h-4 w-4 ${isSelected ? "text-blue-600" : "text-gray-400"}`} />
                <span>{stop}</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Timetable Interactive Grid (Shown during Editing Mode) */}
      <section className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Calendar className="text-blue-600 h-5 w-5" />
            <h3 className="text-sm font-bold text-gray-800">授業時間割の登録</h3>
          </div>
          {!isEditing && (
            <button
              onClick={() => setIsEditing(true)}
              className="flex items-center text-xs font-bold text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg hover:bg-blue-100 transition-colors cursor-pointer"
            >
              時間割を編集
            </button>
          )}
        </div>

        {isEditing ? (
          <div className="space-y-4 animate-in fade-in duration-200">
            <p className="text-xs text-gray-500">
              授業がある「曜日 ✕ 時間目」のマスをタップして登録してください（再度タップすると解除）。
            </p>
            
            <div className="overflow-x-auto pb-2">
              <div className="min-w-[340px] space-y-1.5">
                {/* Header Row */}
                <div className="flex text-center">
                  <div className="w-10"></div>
                  {days.map(day => (
                    <div key={day} className="flex-1 text-xs font-black text-gray-500 py-1">
                      {day}
                    </div>
                  ))}
                </div>
                
                {/* Grid Body */}
                <div className="space-y-1">
                  {periods.map((period) => (
                    <div key={period.id} className="flex h-12 items-center">
                      {/* Period Label with Times */}
                      <div className="w-10 flex flex-col justify-center items-center text-center">
                        <span className="text-[11px] font-black text-gray-800">{period.id}限</span>
                        <span className="text-[8px] text-gray-400 font-bold leading-none">{period.start}</span>
                      </div>
                      
                      {/* Interactive Days */}
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
              onClick={() => setIsEditing(false)}
              className="w-full bg-blue-600 text-white font-bold py-3.5 rounded-xl shadow-md flex items-center justify-center hover:bg-blue-700 transition-colors active:scale-[0.99] cursor-pointer"
            >
              <Check size={18} className="mr-2" />
              時間割を確定してスケジュールを更新
            </button>
          </div>
        ) : (
          <div className="bg-blue-50/50 rounded-xl p-4 flex items-start space-x-3 border border-blue-100">
            <Info className="h-5 w-5 text-blue-600 mt-0.5 shrink-0" />
            <div className="space-y-1">
              <p className="text-xs font-bold text-blue-900">時間割の登録完了</p>
              <p className="text-[11px] text-blue-700 leading-relaxed">
                授業日程が保存されました。下の「1週間の移動スケジュール」にて、最適なバス乗車時刻を算出しています。時間割を変更したい場合は、右上の「時間割を編集」をタップしてください。
              </p>
            </div>
          </div>
        )}
      </section>

      {/* Commute Schedule Section */}
      <section className="space-y-4">
        <h3 className="text-sm font-extrabold text-gray-600 uppercase tracking-wider">
          1週間の最適な移動スケジュール
        </h3>
        
        <div className="space-y-4">
          {days.map(day => {
            const plan = computedSchedules[day];
            
            return (
              <div key={day} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden transition-all duration-300 hover:shadow-md">
                {/* Card Title Bar */}
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
                
                {/* Commute Plan Content */}
                <div className="p-5">
                  {plan ? (
                    <div className="space-y-5">
                      
                      {/* Classes Info Block */}
                      <div className="flex items-center space-x-3 text-xs bg-gray-50 p-3 rounded-xl border border-gray-100">
                        <GraduationCap className="h-4.5 w-4.5 text-gray-500" />
                        <div>
                          <span className="font-bold text-gray-600">本日の授業時間: </span>
                          <span className="font-black text-gray-900 ml-1">
                            {plan.classStart} 〜 {plan.classEnd}
                          </span>
                        </div>
                      </div>

                      {/* OUTBOUND COMMUTE SECTION */}
                      <div className="space-y-2">
                        <div className="flex items-center space-x-1.5 text-xs font-extrabold text-blue-600">
                          <MapPin size={14} />
                          <span>行き (登校・{plan.minPeriod}限開始に合わせる)</span>
                        </div>

                        {plan.outbound ? (
                          <div className="bg-blue-50/30 border border-blue-100 rounded-xl p-4 space-y-3">
                            <div className="flex justify-between items-center">
                              {/* Boarding Info */}
                              <div className="text-left space-y-1">
                                <p className="text-xs text-gray-400 font-bold">乗車停留所</p>
                                <p className="text-base font-black text-gray-900">
                                  {getOutboundDepartureTime(plan.outbound, boardingStop)}
                                </p>
                                <p className="text-[10px] font-bold text-blue-600 bg-blue-100/60 px-1.5 py-0.5 rounded-md inline-block">
                                  {boardingStop}
                                </p>
                              </div>

                              {/* Commute Arrow */}
                              <div className="flex flex-col items-center px-4 flex-1">
                                <div className="w-full flex items-center justify-center space-x-1 text-gray-400">
                                  <div className="h-[1px] bg-gray-200 flex-1"></div>
                                  <Bus size={14} className="text-blue-500 animate-pulse" />
                                  <div className="h-[1px] bg-gray-200 flex-1"></div>
                                </div>
                                <p className="text-[9px] font-bold text-gray-400 mt-1">バス運行</p>
                              </div>

                              {/* Destination Info */}
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

                            {/* Extra badge if it is a school bus */}
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

                      {/* INBOUND COMMUTE SECTION */}
                      <div className="space-y-2">
                        <div className="flex items-center space-x-1.5 text-xs font-extrabold text-indigo-600">
                          <Clock size={14} />
                          <span>帰り (下校・{plan.maxPeriod}限終了以降に乗車)</span>
                        </div>

                        {plan.inbound ? (
                          <div className="bg-indigo-50/20 border border-indigo-100 rounded-xl p-4 space-y-3">
                            <div className="flex justify-between items-center">
                              {/* Boarding Stop */}
                              <div className="text-left space-y-1">
                                <p className="text-xs text-gray-400 font-bold">大学乗車時刻</p>
                                <p className="text-base font-black text-gray-900">
                                  {plan.inbound.edc !== "-" ? plan.inbound.edc : plan.inbound.johodai}
                                </p>
                                <p className="text-[10px] font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 px-1.5 py-0.5 rounded-md inline-block">
                                  {plan.inbound.edc !== "-" ? "eDCタワー前" : "情報大学前"}
                                </p>
                              </div>

                              {/* Commute Arrow */}
                              <div className="flex flex-col items-center px-4 flex-1">
                                <div className="w-full flex items-center justify-center space-x-1 text-gray-400">
                                  <div className="h-[1px] bg-gray-200 flex-1"></div>
                                  <Bus size={14} className="text-indigo-500" />
                                  <div className="h-[1px] bg-gray-200 flex-1"></div>
                                </div>
                                <p className="text-[9px] font-bold text-gray-400 mt-1">バス運行</p>
                              </div>

                              {/* Destination Info */}
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

                            {/* Extra badge if it is a school bus */}
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
