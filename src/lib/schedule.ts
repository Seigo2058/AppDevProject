export interface ClassPeriod {
  id: number;
  start: string;
  end: string;
}

export interface OutboundBus {
  shinsapporo: string;
  atsubetsuChuo: string;
  oasa: string;
  wakaba: string;
  nopporo: string;
  johodai: string;
  edc: string;
  isSchool: boolean;
}

export interface InboundBus {
  edc: string;
  johodai: string;
  nopporo: string;
  wakaba: string;
  oasa: string;
  atsubetsuChuo: string;
  shinsapporo: string;
  isSchool: boolean;
}

export const days = ["月", "火", "水", "木", "金"];
export const dayFullNames: Record<string, string> = {
  "月": "月曜日",
  "火": "火曜日",
  "水": "水曜日",
  "木": "木曜日",
  "金": "金曜日"
};

// 堅牢なCSV行パーサー
export function parseCSV(text: string): string[][] {
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
export function timeToMinutes(timeStr: string): number {
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
export async function fetchWithTimeout(url: string, ms = 8000) {
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

// 行きのバス乗車時刻ヘルパー
export const getOutboundDepartureTime = (bus: OutboundBus | null | undefined, stop: string): string => {
  if (!bus) return "-";
  if (stop === "新札幌駅") return bus.shinsapporo || "-";
  if (stop === "厚別中央2条6丁目") return bus.atsubetsuChuo || "-";
  if (stop === "大麻駅南口") return bus.oasa || "-";
  if (stop === "若葉1丁目") return bus.wakaba || "-";
  if (stop === "野幌駅南口") return bus.nopporo || "-";
  return "-";
};

// 帰りのバス到着時刻ヘルパー
export const getInboundArrivalTime = (bus: InboundBus | null | undefined, stop: string): string => {
  if (!bus) return "-";
  if (stop === "新札幌駅") return bus.shinsapporo || "-";
  if (stop === "厚別中央2条6丁目") return bus.atsubetsuChuo || "-";
  if (stop === "大麻駅南口") return bus.oasa || "-";
  if (stop === "若葉1丁目") return bus.wakaba || "-";
  if (stop === "野幌駅南口") return bus.nopporo || "-";
  return "-";
};

export function getDaySchedule(
  day: string,
  schedule: string[],
  periods: ClassPeriod[],
  outboundBuses: OutboundBus[],
  inboundBuses: InboundBus[],
  boardingStop: string
) {
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
}
