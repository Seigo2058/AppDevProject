// route_stops_list.csv / timetable_list.csv に登録された自前の時刻表データだけを使い、
// 直通または1回の乗換（例: JR函館本線→JR北海道バス）で目的地（大学）に到達できるかを
// 総当たりで探索する。TransitAPIがカバーしないスクール便・独自路線のためのフォールバック経路探索。

import { fetchTimetableList, fetchRouteStops, fetchTimetableData } from "./timetableData";

// 停留所名の表記ゆれ（JR「野幌駅」とバス「野幌駅北口/南口」など、同一駅の異なる出入口・
// 異なるCSV上の呼び方）を吸収し、同じ地点として乗換検索できるようにする。
// 「厚別駅」(JR)と「厚別中央2条6丁目」(バス)のように、名前は似ていても実際には
// 離れた別地点のものは正規化後も別の文字列になるため誤って統合されない。
export function canonicalStopName(name: string): string {
  return name
    .replace(/\([^)]*\)/g, "")
    .replace(/(北口|南口|東口|西口)$/, "")
    .trim();
}

const CAMPUS_CANONICAL_STOPS = new Set(["情報大学前", "eDCタワー前"]);

// 同一駅での乗換に最低限見込む時間（分）
const TRANSFER_BUFFER_MINS = 3;
// これを超える待ち時間が生じる乗換は非現実的として候補から除外する
const MAX_TRANSFER_WAIT_MINS = 90;
// 授業開始/終了時刻との比較に許容する誤差（分）
const ON_TIME_TOLERANCE_MINS = 3;
// 帰りの経路で「同日中に妥当な便」とみなす範囲
const SAME_DAY_WINDOW_MINS = 6 * 60;

function timeToMinutes(timeStr: string | undefined): number {
  if (!timeStr || timeStr === "-") return -1;
  const parts = timeStr.split(":");
  if (parts.length !== 2) return -1;
  const hours = parseInt(parts[0], 10);
  const minutes = parseInt(parts[1], 10);
  if (isNaN(hours) || isNaN(minutes)) return -1;
  return hours * 60 + minutes;
}

interface RouteRun {
  routeId: string;
  routeName: string;
  transportType: string;
  stops: string[]; // 正規化済みの停留所名。CSVの列順（=進行方向順）
  rows: string[][]; // 各行が1本の便。列はstopsに対応
}

const routeRunCache = new Map<string, Promise<RouteRun[]>>();

async function buildRouteRuns(dayType: string): Promise<RouteRun[]> {
  const [timetables, routeStops] = await Promise.all([fetchTimetableList(), fetchRouteStops()]);
  const stopsById = new Map(routeStops.map((r) => [r.route_id, r.stops]));
  const matched = timetables.filter((t) => t.dayType === dayType);

  const runs = await Promise.all(
    matched.map(async (t): Promise<RouteRun | null> => {
      const rawStops = stopsById.get(t.route_id);
      if (!rawStops || rawStops.length === 0) return null;
      const data = await fetchTimetableData(t.csvFileName);
      if (data.length === 0) return null;
      const rows = data.slice(1).filter((r) => r.length > 0);
      return {
        routeId: t.route_id,
        routeName: t.routeName,
        transportType: t.transportType,
        stops: rawStops.map(canonicalStopName),
        rows,
      };
    })
  );

  return runs.filter((r): r is RouteRun => r !== null);
}

function loadRouteRuns(dayType: string): Promise<RouteRun[]> {
  if (!routeRunCache.has(dayType)) {
    routeRunCache.set(dayType, buildRouteRuns(dayType));
  }
  return routeRunCache.get(dayType)!;
}

export interface CsvJourneyLeg {
  routeId: string;
  routeName: string;
  transportType: string;
  fromStop: string;
  toStop: string;
  departureTime: string;
  arrivalTime: string;
}

export interface CsvJourney {
  legs: CsvJourneyLeg[]; // 直通なら1件、乗換ありなら2件
  departureTime: string;
  arrivalTime: string;
  routeName: string; // 表示用。乗換ありなら "路線A → 路線B"
}

function stopIndexes(stops: string[], targets: Set<string>): number[] {
  const result: number[] = [];
  stops.forEach((s, i) => {
    if (targets.has(s)) result.push(i);
  });
  return result;
}

async function findAllJourneys(fromSet: Set<string>, toSet: Set<string>, dayType: string): Promise<CsvJourney[]> {
  const runs = await loadRouteRuns(dayType);
  const journeys: CsvJourney[] = [];

  // 直通経路: 同じ便の中でfromより後にtoが出てくる区間をそのまま利用する
  for (const run of runs) {
    const fromIdxs = stopIndexes(run.stops, fromSet);
    const toIdxs = stopIndexes(run.stops, toSet);
    for (const fi of fromIdxs) {
      for (const ti of toIdxs) {
        if (ti <= fi) continue;
        for (const row of run.rows) {
          const dep = row[fi];
          const arr = row[ti];
          if (!dep || dep === "-" || !arr || arr === "-") continue;
          journeys.push({
            legs: [
              {
                routeId: run.routeId,
                routeName: run.routeName,
                transportType: run.transportType,
                fromStop: run.stops[fi],
                toStop: run.stops[ti],
                departureTime: dep,
                arrivalTime: arr,
              },
            ],
            departureTime: dep,
            arrivalTime: arr,
            routeName: run.routeName,
          });
        }
      }
    }
  }

  // 乗換1回の経路: runAでfrom→乗換地点、runBで乗換地点→toとなる組み合わせを総当たりで探す
  for (const runA of runs) {
    const fromIdxs = stopIndexes(runA.stops, fromSet);
    if (fromIdxs.length === 0) continue;

    for (const runB of runs) {
      if (runB === runA) continue;
      const toIdxs = stopIndexes(runB.stops, toSet);
      if (toIdxs.length === 0) continue;

      for (const fi of fromIdxs) {
        for (let ti = fi + 1; ti < runA.stops.length; ti++) {
          const transferStop = runA.stops[ti];
          if (fromSet.has(transferStop) || toSet.has(transferStop)) continue;
          const tiB = runB.stops.indexOf(transferStop);
          if (tiB === -1) continue;

          for (const toIdx of toIdxs) {
            if (toIdx <= tiB) continue;

            for (const rowA of runA.rows) {
              const depA = rowA[fi];
              const arrA = rowA[ti];
              if (!depA || depA === "-" || !arrA || arrA === "-") continue;
              const arrAMins = timeToMinutes(arrA);
              if (arrAMins === -1) continue;

              for (const rowB of runB.rows) {
                const depB = rowB[tiB];
                const arrB = rowB[toIdx];
                if (!depB || depB === "-" || !arrB || arrB === "-") continue;
                const depBMins = timeToMinutes(depB);
                if (depBMins === -1) continue;

                const waitMins = depBMins - arrAMins;
                if (waitMins < TRANSFER_BUFFER_MINS || waitMins > MAX_TRANSFER_WAIT_MINS) continue;

                journeys.push({
                  legs: [
                    {
                      routeId: runA.routeId,
                      routeName: runA.routeName,
                      transportType: runA.transportType,
                      fromStop: runA.stops[fi],
                      toStop: transferStop,
                      departureTime: depA,
                      arrivalTime: arrA,
                    },
                    {
                      routeId: runB.routeId,
                      routeName: runB.routeName,
                      transportType: runB.transportType,
                      fromStop: transferStop,
                      toStop: runB.stops[toIdx],
                      departureTime: depB,
                      arrivalTime: arrB,
                    },
                  ],
                  departureTime: depA,
                  arrivalTime: arrB,
                  routeName: `${runA.routeName} → ${runB.routeName}`,
                });
              }
            }
          }
        }
      }
    }
  }

  return journeys;
}

// 行き: 授業開始時刻(arriveByMins)までに大学へ到着する便のうち、最も出発が遅い(=待ち時間が短い)ものを選ぶ
export async function planOutboundCsvJourney(
  boardingStopName: string,
  arriveByMins: number,
  dayType = "平日"
): Promise<CsvJourney | null> {
  const from = new Set([canonicalStopName(boardingStopName)]);
  const journeys = await findAllJourneys(from, CAMPUS_CANONICAL_STOPS, dayType);
  const onTime = journeys.filter((j) => timeToMinutes(j.arrivalTime) <= arriveByMins + ON_TIME_TOLERANCE_MINS);
  if (onTime.length === 0) return null;
  return onTime.reduce((best, j) => (timeToMinutes(j.departureTime) > timeToMinutes(best.departureTime) ? j : best));
}

// 帰り: 授業終了時刻(departAfterMins)以降に大学を出発する便のうち、最も早いものを選ぶ
export async function planInboundCsvJourney(
  boardingStopName: string,
  departAfterMins: number,
  dayType = "平日"
): Promise<CsvJourney | null> {
  const to = new Set([canonicalStopName(boardingStopName)]);
  const journeys = await findAllJourneys(CAMPUS_CANONICAL_STOPS, to, dayType);
  const onTime = journeys.filter((j) => {
    const dep = timeToMinutes(j.departureTime);
    return dep >= departAfterMins - ON_TIME_TOLERANCE_MINS && dep <= departAfterMins + SAME_DAY_WINDOW_MINS;
  });
  if (onTime.length === 0) return null;
  return onTime.reduce((best, j) => (timeToMinutes(j.departureTime) < timeToMinutes(best.departureTime) ? j : best));
}

// 検索UIの「よく使う乗り場」候補: 直通、または1回の乗換で大学へ到達できる停留所の一覧。
// findAllJourneysと同じ探索の深さ（直通+乗換1回）に揃えているため、ここに含まれる停留所は
// 必ずplanOutbound/InboundCsvJourneyで経路が見つかる。
export async function getCsvCoverageStops(dayType = "平日"): Promise<string[]> {
  const runs = await loadRouteRuns(dayType);

  const direct = new Set<string>();
  for (const run of runs) {
    if (run.stops.some((s) => CAMPUS_CANONICAL_STOPS.has(s))) {
      run.stops.forEach((s) => {
        if (!CAMPUS_CANONICAL_STOPS.has(s)) direct.add(s);
      });
    }
  }

  const withTransfer = new Set(direct);
  for (const run of runs) {
    if (run.stops.some((s) => direct.has(s))) {
      run.stops.forEach((s) => {
        if (!CAMPUS_CANONICAL_STOPS.has(s)) withTransfer.add(s);
      });
    }
  }

  return Array.from(withTransfer);
}
