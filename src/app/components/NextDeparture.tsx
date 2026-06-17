"use client";

import { useState, useEffect } from "react";
import { Bus, GraduationCap, MapPin } from "lucide-react";
import {
  ClassPeriod,
  OutboundBus,
  InboundBus,
  days,
  parseCSV,
  timeToMinutes,
  fetchWithTimeout,
  getDaySchedule,
  getOutboundDepartureTime
} from "@/lib/schedule";

export default function NextDeparture() {
  const [scheduleData, setScheduleData] = useState<{
    periods: ClassPeriod[];
    outbound: OutboundBus[];
    inbound: InboundBus[];
  } | null>(null);
  
  const [boardingStop, setBoardingStop] = useState<string>("新札幌駅");
  const [schedule, setSchedule] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // 1分ごとに現在時刻を更新
  const [currentTime, setCurrentTime] = useState<Date | null>(null);

  useEffect(() => {
    setCurrentTime(new Date());
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    async function loadData() {
      try {
        const [resPeriods, resOutbound, resInbound] = await Promise.all([
          fetchWithTimeout("/csv/school_timetable.csv").then(r => r.text()),
          fetchWithTimeout("/csv/timetable_jrbus_shin29_ShinsapporoToJohodai_weekdays.csv").then(r => r.text()),
          fetchWithTimeout("/csv/timetable_jrbus_shin29_JohodaiToShinsapporo_weekdays.csv").then(r => r.text()),
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

        setScheduleData({
          periods: parsedPeriods,
          outbound: parsedOutbound,
          inbound: parsedInbound
        });
        setIsLoading(false);
      } catch (err) {
        console.error("Failed to load CSV data in NextDeparture:", err);
        setIsLoading(false);
      }
    }

    loadData();

    if (typeof window !== "undefined") {
      const savedStop = localStorage.getItem("commute_boarding_stop");
      if (savedStop) setBoardingStop(savedStop);
      const savedSchedule = localStorage.getItem("commute_schedule");
      if (savedSchedule) {
        try {
          const parsed = JSON.parse(savedSchedule);
          if (Array.isArray(parsed)) setSchedule(parsed);
        } catch (e) {}
      }
    }
  }, []);

  if (isLoading || !scheduleData || !currentTime) {
    return (
      <section className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 flex items-center justify-center min-h-[100px]">
        <div className="animate-spin rounded-full h-6 w-6 border-2 border-blue-500 border-t-transparent"></div>
      </section>
    );
  }

  // 曜日判定 (0: 日, 1: 月, ..., 6: 土)
  const dayIndex = currentTime.getDay();
  
  // 平日のみ計算 (月=1, 金=5)
  if (dayIndex === 0 || dayIndex === 6) {
    return (
      <section className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
        <h2 className="text-sm font-bold text-gray-500 mb-3">次の出発（予定）</h2>
        <p className="text-sm font-bold text-gray-600">本日は休日のため、通学スケジュールの計算はありません。</p>
      </section>
    );
  }

  const dayStr = days[dayIndex - 1];
  const dayPlan = getDaySchedule(
    dayStr,
    schedule,
    scheduleData.periods,
    scheduleData.outbound,
    scheduleData.inbound,
    boardingStop
  );

  if (!dayPlan) {
    return (
      <section className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
        <h2 className="text-sm font-bold text-gray-500 mb-3">次の出発（予定）</h2>
        <p className="text-sm font-bold text-gray-600">本日の授業予定が登録されていません。</p>
      </section>
    );
  }

  const currentMins = currentTime.getHours() * 60 + currentTime.getMinutes();
  
  let nextDeparture: {
    time: string;
    stop: string;
    dest: string;
    isOutbound: boolean;
  } | null = null;

  if (dayPlan.outbound && dayPlan.inbound) {
    const outTimeStr = getOutboundDepartureTime(dayPlan.outbound, boardingStop);
    const inTimeStr = dayPlan.inbound.edc !== "-" ? dayPlan.inbound.edc : dayPlan.inbound.johodai;

    const outMins = timeToMinutes(outTimeStr);
    const inMins = timeToMinutes(inTimeStr);

    if (outMins !== -1 && currentMins < outMins) {
      nextDeparture = {
        time: outTimeStr,
        stop: boardingStop,
        dest: dayPlan.outbound.edc !== "-" ? "eDCタワー前" : "情報大学前",
        isOutbound: true
      };
    } else if (inMins !== -1 && currentMins < inMins) {
      nextDeparture = {
        time: inTimeStr,
        stop: dayPlan.inbound.edc !== "-" ? "eDCタワー前(構内)" : "情報大学前(白樺通沿)",
        dest: boardingStop,
        isOutbound: false
      };
    }
  }

  if (!nextDeparture) {
    return (
      <section className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
        <h2 className="text-sm font-bold text-gray-500 mb-3">次の出発（予定）</h2>
        <p className="text-sm font-bold text-gray-600">本日の通学スケジュールは終了しました。</p>
      </section>
    );
  }

  const depMins = timeToMinutes(nextDeparture.time);
  let diffMins = depMins - currentMins;
  if (diffMins < 0) diffMins = 0; // 万一のため

  return (
    <section className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 relative overflow-hidden">
      <div className="absolute top-0 right-0 p-3 opacity-10 pointer-events-none">
        <GraduationCap size={80} />
      </div>
      <div className="relative z-10">
        <h2 className="text-sm font-bold text-gray-500 mb-3 flex items-center space-x-1.5">
          <span>次の出発（予定）</span>
          <span className={`px-2 py-0.5 rounded-md text-[10px] text-white ${nextDeparture.isOutbound ? "bg-blue-500" : "bg-indigo-500"}`}>
            {nextDeparture.isOutbound ? "登校" : "下校"}
          </span>
        </h2>
        
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center space-x-3">
            <div className={`p-2 rounded-lg ${nextDeparture.isOutbound ? "bg-blue-100 text-blue-600" : "bg-indigo-100 text-indigo-600"}`}>
              <Bus size={24} />
            </div>
            <div>
              <p className="text-2xl font-black text-gray-900">{nextDeparture.time}</p>
              <p className="text-xs text-gray-500 font-bold">{nextDeparture.stop} 乗車</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-500 font-bold">あと</p>
            <p className={`text-2xl font-black ${diffMins <= 10 ? "text-red-500 animate-pulse" : "text-blue-600"}`}>
              {diffMins}分
            </p>
          </div>
        </div>
        
        <div className="bg-gray-50 rounded-lg p-2.5 flex items-center space-x-2 text-xs text-gray-600 font-bold mt-3 border border-gray-100">
          <MapPin size={14} className="text-gray-400" />
          <span>目的地: {nextDeparture.dest}</span>
        </div>
      </div>
    </section>
  );
}
