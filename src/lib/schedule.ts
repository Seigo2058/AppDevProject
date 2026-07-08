import { JOHODAI, planJourney, formatClock } from "./transitApi";
import { planOutboundCsvJourney, planInboundCsvJourney } from "./tripGraph";

export interface ClassPeriod {
  id: number;
  start: string;
  end: string;
}

// 乗り場の選択元。CSVの5停留所（スクール便の実データがある）を選んだ場合は"csv"、
// それ以外（検索共通UI経由でTransitAPIから選んだ場合）は"transit"。
export type BoardingSelection =
  | { source: "csv"; name: string }
  | { source: "transit"; id: string; name: string };

// CSV経路・TransitAPI経路のどちらで計算しても同じ形になるよう正規化した1本のバス脚。
export interface CommuteLeg {
  departureTime: string; // 乗車時刻 "H:MM" 表示用
  arrivalTime: string; // 到着時刻 "H:MM" 表示用
  stopLabel: string; // 反対側の停留所・目的地表示名
  isSchoolBus: boolean;
  routeName?: string;
}

export interface DayPlan {
  minPeriod: number;
  maxPeriod: number;
  classStart: string;
  classEnd: string;
  outbound: CommuteLeg | null;
  inbound: CommuteLeg | null;
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

// 自前の時刻表CSV（route_stops_list.csv / timetable_list.csv に登録された全路線）から、
// 指定停留所での最適な行き/帰りの便を求める。直通経路が無くても1回の乗換（例: JR→バス）で
// 大学へ到達できる経路をtripGraphが探索するため、TransitAPIが対応していない区間もここでカバーできる。
async function getCsvLegs(
  boardingStop: string,
  startMins: number,
  endMins: number
): Promise<{ outbound: CommuteLeg | null; inbound: CommuteLeg | null }> {
  const [outboundJourney, inboundJourney] = await Promise.all([
    planOutboundCsvJourney(boardingStop, startMins),
    planInboundCsvJourney(boardingStop, endMins),
  ]);

  return {
    outbound: outboundJourney
      ? {
          departureTime: outboundJourney.departureTime,
          arrivalTime: outboundJourney.arrivalTime,
          stopLabel: outboundJourney.legs[outboundJourney.legs.length - 1].toStop,
          isSchoolBus: false,
          routeName: outboundJourney.routeName,
        }
      : null,
    inbound: inboundJourney
      ? {
          departureTime: inboundJourney.departureTime,
          arrivalTime: inboundJourney.arrivalTime,
          stopLabel: inboundJourney.legs[0].fromStop,
          isSchoolBus: false,
          routeName: inboundJourney.routeName,
        }
      : null,
  };
}

// 実際のバス到着時刻は秒単位（例: 9:00:44）でGTFSの補間誤差が乗ることがあるため、
// 分単位で指定される授業時刻との比較には数分の許容誤差を持たせる。
const ON_TIME_TOLERANCE_SECS = 3 * 60;
// 帰りの検索で「同日中に妥当な便」とみなす範囲。これを超えて次の日にずれ込むような
// 結果は、実質的に「便が見つからない」ものとして扱う。
const SAME_DAY_WINDOW_SECS = 6 * 60 * 60;

// TransitAPIの一般路線から、指定の駅・停留所での最適な行き/帰りの便を求める。
async function getTransitLegs(
  boarding: { id: string; name: string },
  startMins: number,
  endMins: number
): Promise<{ outbound: CommuteLeg | null; inbound: CommuteLeg | null }> {
  const classStartSecs = startMins * 60;
  const classEndSecs = endMins * 60;

  const lookbackSecs = Math.max(classStartSecs - 90 * 60, 0);
  const lookbackClock = formatClock(lookbackSecs);
  const classEndClock = formatClock(classEndSecs);

  const [outboundResult, inboundResult] = await Promise.all([
    planJourney({
      from: boarding.id,
      to: JOHODAI.id,
      fromLabel: boarding.name,
      toLabel: JOHODAI.name,
      type: "departure",
      time: lookbackClock,
      numItineraries: 6,
    }),
    planJourney({
      from: JOHODAI.id,
      to: boarding.id,
      fromLabel: JOHODAI.name,
      toLabel: boarding.name,
      type: "departure",
      time: classEndClock,
      numItineraries: 6,
    }),
  ]);

  let outbound: CommuteLeg | null = null;
  if (outboundResult.ok && outboundResult.journeys.length > 0) {
    // 授業開始までに到着する便のうち、最も出発が遅い（＝待ち時間が短い）ものを選ぶ。
    // 該当が無ければ「間に合う便が無い」として null を返す（誤った時刻を出さない）。
    const onTime = outboundResult.journeys.filter((j) => j.arrivalSecs <= classStartSecs + ON_TIME_TOLERANCE_SECS);
    if (onTime.length > 0) {
      const best = onTime.reduce((a, b) => (b.departureSecs > a.departureSecs ? b : a));
      outbound = {
        departureTime: formatClock(best.departureSecs),
        arrivalTime: formatClock(best.arrivalSecs),
        stopLabel: JOHODAI.name,
        isSchoolBus: false,
        routeName: best.legs.find((l) => l.kind === "transit")?.routeName,
      };
    }
  }

  let inbound: CommuteLeg | null = null;
  if (inboundResult.ok && inboundResult.journeys.length > 0) {
    // 授業終了後、同日中に出発する便のうち最も早いものを選ぶ。
    // 同日中に見つからなければ（翌日便への飛びなど）「見つからない」扱いにする。
    const onTime = inboundResult.journeys.filter(
      (j) =>
        j.departureSecs >= classEndSecs - ON_TIME_TOLERANCE_SECS &&
        j.departureSecs <= classEndSecs + SAME_DAY_WINDOW_SECS
    );
    if (onTime.length > 0) {
      const best = onTime.reduce((a, b) => (b.departureSecs < a.departureSecs ? b : a));
      inbound = {
        departureTime: formatClock(best.departureSecs),
        arrivalTime: formatClock(best.arrivalSecs),
        stopLabel: JOHODAI.name,
        isSchoolBus: false,
        routeName: best.legs.find((l) => l.kind === "transit")?.routeName,
      };
    }
  }

  return { outbound, inbound };
}

export async function getDaySchedule(
  day: string,
  schedule: string[],
  periods: ClassPeriod[],
  boarding: BoardingSelection
): Promise<DayPlan | null> {
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

    const { outbound, inbound } =
      boarding.source === "csv"
        ? await getCsvLegs(boarding.name, startMins, endMins)
        : await getTransitLegs(boarding, startMins, endMins);

    return {
      minPeriod: minPeriodId,
      maxPeriod: maxPeriodId,
      classStart,
      classEnd,
      outbound,
      inbound,
    };
  } catch (e) {
    console.error(`getDaySchedule error for day ${day}:`, e);
    return null;
  }
}
