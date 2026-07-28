import { suggestPlaces, planJourney, formatClock, clockToSecs } from "./transitApi";
import type { PlanLeg, Journey } from "./transitApi";
import { fetchTimetableList, fetchRouteStops, fetchTimetableData } from "./timetableData";
import { canonicalStopName, resolveStopEndpoint, getHybridTransferCandidates, CAMPUS_CANONICAL_STOPS, StopEndpoint } from "./stopRegistry";
import type { BoardingSelection, JourneySegment } from "./schedule";

export interface RouteSegmentDetail {
  mode: "bus" | "train" | "transit" | "walk";
  routeName?: string;
  fromStop: string;
  toStop: string;
  departureTime: string; // "HH:MM"
  arrivalTime: string;   // "HH:MM"
}

export interface SearchResultJourney {
  departureTime: string;
  arrivalTime: string;
  departureStop: string;
  arrivalStop: string;
  durationMinutes: number;
  fare: number;
  transferCount: number;
  routeName: string;
  segments: RouteSegmentDetail[];
  isCsvOnly: boolean;
  // 本日の便が終了しており、翌日の便を表示している場合に true
  isNextDay?: boolean;
}

// 乗り継ぎ時に見込むバッファ（分）
const HYBRID_TRANSFER_BUFFER_MINS = 5;

// "HH:MM" -> 深夜0時からの分数
export function timeToMinutes(timeStr: string): number {
  if (!timeStr || timeStr === "-") return -1;
  const parts = timeStr.split(":");
  if (parts.length !== 2) return -1;
  const hours = parseInt(parts[0], 10);
  const minutes = parseInt(parts[1], 10);
  if (isNaN(hours) || isNaN(minutes)) return -1;
  return hours * 60 + minutes;
}

// 深夜0時からの分数 -> "HH:MM"
export function minutesToTime(mins: number): string {
  const normalized = (mins + 24 * 60) % (24 * 60);
  const hours = Math.floor(normalized / 60);
  const minutes = normalized % 60;
  return `${hours}:${String(minutes).padStart(2, "0")}`;
}

// 2つの時間（"HH:MM"）の差（分）
export function timeDifferenceMinutes(t1: string, t2: string): number {
  const m1 = timeToMinutes(t1);
  const m2 = timeToMinutes(t2);
  if (m1 === -1 || m2 === -1) return 0;
  return m2 >= m1 ? m2 - m1 : (m2 + 24 * 60) - m1;
}

export function getDayType(date: Date = new Date()): "平日" | "土日・祝" {
  const day = date.getDay();
  if (day === 0 || day === 6) {
    return "土日・祝";
  }
  return "平日";
}

// CSV区間の概算運賃算出
export function calculateCsvFare(from: string, to: string, routeName: string): number {
  const fromClean = canonicalStopName(from);
  const toClean = canonicalStopName(to);

  if (routeName.includes("函館本線") || routeName.includes("JR")) {
    const stations = ["岩見沢駅", "豊幌駅", "江別駅", "高砂駅", "野幌駅", "大麻駅", "森林公園駅", "厚別駅", "白石駅", "苗穂駅", "札幌駅"].map(canonicalStopName);
    const fromIdx = stations.indexOf(fromClean);
    const toIdx = stations.indexOf(toClean);
    if (fromIdx !== -1 && toIdx !== -1) {
      const diff = Math.abs(fromIdx - toIdx);
      if (diff === 0) return 0;
      if (diff === 1) return 200;
      if (diff === 2) return 250;
      if (diff <= 4) return 340;
      if (diff <= 6) return 440;
      if (diff <= 8) return 540;
      return 680;
    }
  }

  // バス路線（江92、新24、新26、新29等）は一律250円とする
  return 250;
}

// TransitAPI区間の概算運賃算出
function estimateTransitFare(legs: PlanLeg[]): number {
  let fare = 0;
  for (const leg of legs) {
    if (leg.kind === "transit") {
      const mode = (leg.mode ?? "").toLowerCase();
      if (mode.includes("bus")) {
        fare += 250;
      } else {
        // 電車、地下鉄等
        fare += 290;
      }
    }
  }
  return fare;
}

// TransitAPI用セグメント変換
const IMPLICIT_WALK_GAP_TOLERANCE_SECS = 30;

function transitJourneyToSegments(
  journey: { departureSecs: number; arrivalSecs: number; legs: PlanLeg[] },
  originLabel: string,
  destLabel: string
): RouteSegmentDetail[] {
  const { legs } = journey;
  if (legs.length === 0) {
    return [
      {
        mode: "walk",
        fromStop: originLabel,
        toStop: destLabel,
        departureTime: formatClock(journey.departureSecs),
        arrivalTime: formatClock(journey.arrivalSecs),
      },
    ];
  }

  const segments: RouteSegmentDetail[] = [];

  if (legs[0].departureSecs - journey.departureSecs > IMPLICIT_WALK_GAP_TOLERANCE_SECS) {
    segments.push({
      mode: "walk",
      fromStop: originLabel,
      toStop: legs[0].from.name,
      departureTime: formatClock(journey.departureSecs),
      arrivalTime: formatClock(legs[0].departureSecs),
    });
  }

  legs.forEach((l) => {
    let mode: RouteSegmentDetail["mode"] = "transit";
    if (l.kind === "walk") {
      mode = "walk";
    } else {
      const m = (l.mode ?? "").toLowerCase();
      if (m.includes("rail") || m.includes("train") || m.includes("subway") || m.includes("tram")) {
        mode = "train";
      } else if (m.includes("bus")) {
        mode = "bus";
      }
    }

    segments.push({
      mode,
      routeName: l.routeName || (l.kind === "walk" ? "徒歩" : undefined),
      fromStop: l.from.name,
      toStop: l.to.name,
      departureTime: formatClock(l.departureSecs),
      arrivalTime: formatClock(l.arrivalSecs),
    });
  });

  const lastLeg = legs[legs.length - 1];
  if (journey.arrivalSecs - lastLeg.arrivalSecs > IMPLICIT_WALK_GAP_TOLERANCE_SECS) {
    segments.push({
      mode: "walk",
      fromStop: lastLeg.to.name,
      toStop: destLabel,
      departureTime: formatClock(lastLeg.arrivalSecs),
      arrivalTime: formatClock(journey.arrivalSecs),
    });
  }

  return segments;
}

// CSV 運行データを構築
interface RouteRun {
  routeId: string;
  routeName: string;
  transportType: string;
  stops: string[];
  arrivalRows: string[][];
  departureRows: string[][];
}

function parseArrivalDepartureHeader(
  header: string[]
): Map<string, { arrivalCol: number | null; departureCol: number | null }> | null {
  const map = new Map<string, { arrivalCol: number | null; departureCol: number | null }>();
  let matched = false;
  header.forEach((col, i) => {
    const trimmed = col.trim();
    const isArrival = trimmed.endsWith("着");
    const isDeparture = !isArrival && trimmed.endsWith("発");
    if (!isArrival && !isDeparture) return;
    matched = true;
    const stopName = canonicalStopName(`${trimmed.slice(0, -1)}駅`);
    const entry = map.get(stopName) ?? { arrivalCol: null, departureCol: null };
    if (isArrival) entry.arrivalCol = i;
    else entry.departureCol = i;
    map.set(stopName, entry);
  });
  return matched ? map : null;
}

async function loadRouteRuns(dayType: string): Promise<RouteRun[]> {
  const [timetables, routeStops] = await Promise.all([fetchTimetableList(), fetchRouteStops()]);
  const stopsById = new Map(routeStops.map((r) => [r.route_id, r.stops]));
  const matched = timetables.filter((t) => t.dayType === dayType);

  const runs = await Promise.all(
    matched.map(async (t): Promise<RouteRun | null> => {
      const rawStops = stopsById.get(t.route_id);
      if (!rawStops || rawStops.length === 0) return null;
      const data = await fetchTimetableData(t.route_id);
      if (data.length === 0) return null;
      const [header, ...rows] = data;
      const validRows = rows.filter((r) => r.length > 0);
      const stops = rawStops.map(canonicalStopName);

      const adMap = parseArrivalDepartureHeader(header);
      let arrivalRows: string[][];
      let departureRows: string[][];
      if (adMap) {
        arrivalRows = validRows.map((row) =>
          stops.map((s) => {
            const cols = adMap.get(s);
            return cols?.arrivalCol != null ? row[cols.arrivalCol] ?? "" : "";
          })
        );
        departureRows = validRows.map((row) =>
          stops.map((s) => {
            const cols = adMap.get(s);
            return cols?.departureCol != null ? row[cols.departureCol] ?? "" : "";
          })
        );
      } else {
        arrivalRows = validRows;
        departureRows = validRows;
      }

      return {
        routeId: t.route_id,
        routeName: t.routeName,
        transportType: t.transportType,
        stops,
        arrivalRows,
        departureRows,
      };
    })
  );

  return runs.filter((r): r is RouteRun => r !== null);
}

function stopIndexes(stops: string[], targets: Set<string>): number[] {
  const result: number[] = [];
  stops.forEach((s, i) => {
    if (targets.has(s)) result.push(i);
  });
  return result;
}

// CSV上の全直通・1回乗換経路を全探索
async function findCsvJourneys(
  fromName: string,
  toName: string,
  dayType: string
): Promise<SearchResultJourney[]> {
  const runs = await loadRouteRuns(dayType);
  const results: SearchResultJourney[] = [];

  // キャンパス停留所は複数の表記（情報大学前、eDCタワー前、EDCタワー前）でCSVに記載されるため
  // いずれかが一致すれば乗車可能として扱う
  function makeStopSet(name: string): Set<string> {
    const canonical = canonicalStopName(name);
    if (CAMPUS_CANONICAL_STOPS.has(canonical)) {
      return new Set(CAMPUS_CANONICAL_STOPS);
    }
    return new Set([canonical]);
  }

  const fromSet = makeStopSet(fromName);
  const toSet = makeStopSet(toName);

  // 直通
  for (const run of runs) {
    const fromIdxs = stopIndexes(run.stops, fromSet);
    const toIdxs = stopIndexes(run.stops, toSet);
    for (const fi of fromIdxs) {
      for (const ti of toIdxs) {
        if (ti <= fi) continue;
        for (let rowIdx = 0; rowIdx < run.departureRows.length; rowIdx++) {
          const dep = run.departureRows[rowIdx][fi];
          const arr = run.arrivalRows[rowIdx][ti];
          if (!dep || dep === "-" || !arr || arr === "-") continue;

          const duration = timeDifferenceMinutes(dep, arr);
          const segment: RouteSegmentDetail = {
            mode: run.transportType === "バス" ? "bus" : run.transportType === "JR" ? "train" : "transit",
            routeName: run.routeName,
            fromStop: run.stops[fi],
            toStop: run.stops[ti],
            departureTime: dep,
            arrivalTime: arr,
          };
          const fare = calculateCsvFare(segment.fromStop, segment.toStop, run.routeName);

          results.push({
            departureTime: dep,
            arrivalTime: arr,
            departureStop: run.stops[fi],
            arrivalStop: run.stops[ti],
            durationMinutes: duration,
            fare,
            transferCount: 0,
            routeName: run.routeName,
            segments: [segment],
            isCsvOnly: true,
          });
        }
      }
    }
  }

  // 1回乗換
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

            for (let rowAIdx = 0; rowAIdx < runA.departureRows.length; rowAIdx++) {
              const depA = runA.departureRows[rowAIdx][fi];
              const arrA = runA.arrivalRows[rowAIdx][ti];
              if (!depA || depA === "-" || !arrA || arrA === "-") continue;
              const arrAMins = timeToMinutes(arrA);
              if (arrAMins === -1) continue;

              for (let rowBIdx = 0; rowBIdx < runB.departureRows.length; rowBIdx++) {
                const depB = runB.departureRows[rowBIdx][tiB];
                const arrB = runB.arrivalRows[rowBIdx][toIdx];
                if (!depB || depB === "-" || !arrB || arrB === "-") continue;
                const depBMins = timeToMinutes(depB);
                if (depBMins === -1) continue;

                // 乗り継ぎ待ち時間 (分)
                const waitMins = depBMins - arrAMins;
                if (waitMins < 3 || waitMins > 90) continue;

                const duration = timeDifferenceMinutes(depA, arrB);
                const segA: RouteSegmentDetail = {
                  mode: runA.transportType === "バス" ? "bus" : runA.transportType === "JR" ? "train" : "transit",
                  routeName: runA.routeName,
                  fromStop: runA.stops[fi],
                  toStop: transferStop,
                  departureTime: depA,
                  arrivalTime: arrA,
                };
                const segB: RouteSegmentDetail = {
                  mode: runB.transportType === "バス" ? "bus" : runB.transportType === "JR" ? "train" : "transit",
                  routeName: runB.routeName,
                  fromStop: transferStop,
                  toStop: runB.stops[toIdx],
                  departureTime: depB,
                  arrivalTime: arrB,
                };

                const fare =
                  calculateCsvFare(segA.fromStop, segA.toStop, runA.routeName) +
                  calculateCsvFare(segB.fromStop, segB.toStop, runB.routeName);

                results.push({
                  departureTime: depA,
                  arrivalTime: arrB,
                  departureStop: runA.stops[fi],
                  arrivalStop: runB.stops[toIdx],
                  durationMinutes: duration,
                  fare,
                  transferCount: 1,
                  routeName: `${runA.routeName} → ${runB.routeName}`,
                  segments: [segA, segB],
                  isCsvOnly: true,
                });
              }
            }
          }
        }
      }
    }
  }

  return results;
}

// 始点をTransitAPI Endpointへ解決
function resolveOriginEndpoint(boarding: BoardingSelection): StopEndpoint | null {
  if (boarding.source === "transit") {
    return { id: boarding.id, name: boarding.name };
  }
  return resolveStopEndpoint(canonicalStopName(boarding.name));
}

// ハイブリッド・TransitAPI・CSVの総合検索メイン
export async function searchRoutes(
  from: BoardingSelection,
  to: BoardingSelection,
  targetTime: string, // "HH:MM"
  timeType: "departure" | "arrival",
  dayType: "平日" | "土日・祝" = "平日"
): Promise<SearchResultJourney[]> {
  const journeys: SearchResultJourney[] = [];
  const targetMins = timeToMinutes(targetTime);

  // 1. CSV内検索 (両端がCSV停留所にある場合)
  // キャンパス停留所はCSVに直接登録されているため、明示的にtrueとする
  const routeStopsAll = await fetchRouteStops();
  const allCsvStopNames = new Set(routeStopsAll.flatMap(r => r.stops.map(canonicalStopName)));

  const fromCanonical = canonicalStopName(from.name);
  const toCanonical = canonicalStopName(to.name);

  const isFromInCsv = fromCanonical !== "" && (
    CAMPUS_CANONICAL_STOPS.has(fromCanonical) || allCsvStopNames.has(fromCanonical)
  );
  const isToInCsv = toCanonical !== "" && (
    CAMPUS_CANONICAL_STOPS.has(toCanonical) || allCsvStopNames.has(toCanonical)
  );

  if (isFromInCsv && isToInCsv) {
    try {
      const csvResults = await findCsvJourneys(from.name, to.name, dayType);
      journeys.push(...csvResults);
    } catch (e) {
      console.warn("CSV search failed:", e);
    }
  }

  // 時間割(journeyPlanner.ts)と同じ「CSV優先」方針: 目的の時間帯に間に合うCSV単独経路が
  // 既に見つかっている場合、TransitAPI単独検索・ハイブリッド検索(いずれも通信コストが高く、
  // 乗換候補ごとに並列でTransitAPIへ問い合わせる)は行わない。これにより通信量を削減しつつ、
  // 大量のハイブリッド候補で直通CSV経路(例: 新29)が上位5件から押し出される問題も防ぐ。
  const hasUsableCsvResult =
    timeType === "departure"
      ? journeys.some((j) => timeToMinutes(j.departureTime) >= targetMins)
      : journeys.some((j) => timeToMinutes(j.arrivalTime) <= targetMins);

  // 2. TransitAPI単独検索 (両方がTransitAPI Endpointに解決できる場合)
  const fromEndpoint = resolveOriginEndpoint(from);
  const toEndpoint = resolveOriginEndpoint(to);
  if (!hasUsableCsvResult && fromEndpoint && toEndpoint) {
    try {
      const apiResult = await planJourney({
        from: fromEndpoint.id,
        to: toEndpoint.id,
        fromLabel: fromEndpoint.name,
        toLabel: toEndpoint.name,
        type: timeType,
        time: targetTime,
        numItineraries: 6,
      });

      if (apiResult.ok && apiResult.journeys.length > 0) {
        // TransitAPIは公共交通機関の乗換がない「全区間徒歩」の案内も1候補として返すことがある。
        // これは出発待ちが無い分、他の実際の地下鉄・JR便より出発時刻が早くなりがちで、
        // transitAPIのlegsにtransit区間が1つも無いため`routeName`のフォールバック値
        // "公共交通機関"がそのまま付き、あたかも実在の公共交通機関の経路であるかのように
        // 誤表示されてしまう。経路検索は公共交通機関の経路を提示する機能のため、
        // 徒歩のみの案内はここでは除外する。
        const transitJourneys = apiResult.journeys.filter((j) => j.legs.some((l) => l.kind === "transit"));
        const results = transitJourneys.map((j) => {
          const depTime = formatClock(j.departureSecs);
          const arrTime = formatClock(j.arrivalSecs);
          const duration = Math.round(j.durationSecs / 60);
          const segments = transitJourneyToSegments(j, fromEndpoint.name, toEndpoint.name);
          const fare = estimateTransitFare(j.legs);

          return {
            departureTime: depTime,
            arrivalTime: arrTime,
            departureStop: fromEndpoint.name,
            arrivalStop: toEndpoint.name,
            durationMinutes: duration,
            fare,
            transferCount: j.transferCount,
            routeName: j.legs.find((l) => l.kind === "transit")?.routeName || "公共交通機関",
            segments,
            isCsvOnly: false,
          };
        });
        journeys.push(...results);
      }
    } catch (e) {
      console.warn("TransitAPI search failed:", e);
    }
  }

  // 3. ハイブリッド検索 (どちらか一方が大学停留所で、他方が一般地点の場合)
  const isFromCampus = CAMPUS_CANONICAL_STOPS.has(canonicalStopName(from.name));
  const isToCampus = CAMPUS_CANONICAL_STOPS.has(canonicalStopName(to.name));

  if (!hasUsableCsvResult && (isFromCampus || isToCampus) && !(isFromCampus && isToCampus)) {
    const tasks: Promise<void>[] = [];
    const hybridJourneys: SearchResultJourney[] = [];

    // 大学への行き (Outbound)
    if (isToCampus && fromEndpoint) {
      const originCanonical = canonicalStopName(from.name);
      for (const transferStop of getHybridTransferCandidates()) {
        if (transferStop === originCanonical) continue;

        tasks.push(
          (async () => {
            const transferEndpoint = resolveStopEndpoint(transferStop);
            if (!transferEndpoint) return;

            if (timeType === "departure") {
              const apiResult = await planJourney({
                from: fromEndpoint.id,
                to: transferEndpoint.id,
                fromLabel: fromEndpoint.name,
                toLabel: transferEndpoint.name,
                type: "departure",
                time: targetTime,
                numItineraries: 4,
              });
              if (!apiResult.ok) return;

              for (const j of apiResult.journeys) {
                const arrClock = formatClock(j.arrivalSecs);
                const arrMins = timeToMinutes(arrClock);

                const csvJourneys = await findCsvJourneys(transferStop, to.name, dayType);
                const matchedCsv = csvJourneys.filter(cj => timeToMinutes(cj.departureTime) >= arrMins + HYBRID_TRANSFER_BUFFER_MINS);
                if (matchedCsv.length === 0) continue;

                const bestCsv = matchedCsv.reduce((best, cj) => timeToMinutes(cj.departureTime) < timeToMinutes(best.departureTime) ? cj : best);

                const depTime = formatClock(j.departureSecs);
                const arrTime = bestCsv.arrivalTime;
                const duration = timeDifferenceMinutes(depTime, arrTime);
                const apiSegs = transitJourneyToSegments(j, fromEndpoint.name, transferEndpoint.name);
                const combinedSegs = [...apiSegs, ...bestCsv.segments];
                const fare = estimateTransitFare(j.legs) + bestCsv.fare;

                hybridJourneys.push({
                  departureTime: depTime,
                  arrivalTime: arrTime,
                  departureStop: fromEndpoint.name,
                  arrivalStop: to.name,
                  durationMinutes: duration,
                  fare,
                  transferCount: j.transferCount + bestCsv.transferCount + 1,
                  routeName: `${j.legs.find((l) => l.kind === "transit")?.routeName || "公共交通機関"} → ${bestCsv.routeName}`,
                  segments: combinedSegs,
                  isCsvOnly: false,
                });
              }
            } else {
              const csvJourneys = await findCsvJourneys(transferStop, to.name, dayType);
              const matchedCsv = csvJourneys.filter(cj => timeToMinutes(cj.arrivalTime) <= targetMins);
              if (matchedCsv.length === 0) return;

              for (const cj of matchedCsv) {
                const depMins = timeToMinutes(cj.departureTime);

                const targetApiArrClock = minutesToTime(depMins - HYBRID_TRANSFER_BUFFER_MINS);
                const apiResult = await planJourney({
                  from: fromEndpoint.id,
                  to: transferEndpoint.id,
                  fromLabel: fromEndpoint.name,
                  toLabel: transferEndpoint.name,
                  type: "arrival",
                  time: targetApiArrClock,
                  numItineraries: 2,
                });
                if (!apiResult.ok || apiResult.journeys.length === 0) continue;

                const bestTransit = apiResult.journeys.reduce((best, j) => j.departureSecs > best.departureSecs ? j : best);
                const depTime = formatClock(bestTransit.departureSecs);
                const arrTime = cj.arrivalTime;
                const duration = timeDifferenceMinutes(depTime, arrTime);
                const apiSegs = transitJourneyToSegments(bestTransit, fromEndpoint.name, transferEndpoint.name);
                const combinedSegs = [...apiSegs, ...cj.segments];
                const fare = estimateTransitFare(bestTransit.legs) + cj.fare;

                hybridJourneys.push({
                  departureTime: depTime,
                  arrivalTime: arrTime,
                  departureStop: fromEndpoint.name,
                  arrivalStop: to.name,
                  durationMinutes: duration,
                  fare,
                  transferCount: bestTransit.transferCount + cj.transferCount + 1,
                  routeName: `${bestTransit.legs.find((l) => l.kind === "transit")?.routeName || "公共交通機関"} → ${cj.routeName}`,
                  segments: combinedSegs,
                  isCsvOnly: false,
                });
              }
            }
          })()
        );
      }
    }

    // 大学からの帰り (Inbound)
    if (isFromCampus && toEndpoint) {
      const destCanonical = canonicalStopName(to.name);
      for (const transferStop of getHybridTransferCandidates()) {
        if (transferStop === destCanonical) continue;

        tasks.push(
          (async () => {
            const transferEndpoint = resolveStopEndpoint(transferStop);
            if (!transferEndpoint) return;

            if (timeType === "departure") {
              const csvJourneys = await findCsvJourneys(from.name, transferStop, dayType);
              const matchedCsv = csvJourneys.filter(cj => timeToMinutes(cj.departureTime) >= targetMins);
              if (matchedCsv.length === 0) return;

              for (const cj of matchedCsv) {
                const arrMins = timeToMinutes(cj.arrivalTime);

                const apiResult = await planJourney({
                  from: transferEndpoint.id,
                  to: toEndpoint.id,
                  fromLabel: transferEndpoint.name,
                  toLabel: toEndpoint.name,
                  type: "departure",
                  time: minutesToTime(arrMins + HYBRID_TRANSFER_BUFFER_MINS),
                  numItineraries: 2,
                });
                if (!apiResult.ok || apiResult.journeys.length === 0) continue;

                const bestTransit = apiResult.journeys.reduce((best, j) => j.departureSecs < best.departureSecs ? j : best);
                const depTime = cj.departureTime;
                const arrTime = formatClock(bestTransit.arrivalSecs);
                const duration = timeDifferenceMinutes(depTime, arrTime);
                const apiSegs = transitJourneyToSegments(bestTransit, transferEndpoint.name, toEndpoint.name);
                const combinedSegs = [...cj.segments, ...apiSegs];
                const fare = cj.fare + estimateTransitFare(bestTransit.legs);

                hybridJourneys.push({
                  departureTime: depTime,
                  arrivalTime: arrTime,
                  departureStop: from.name,
                  arrivalStop: toEndpoint.name,
                  durationMinutes: duration,
                  fare,
                  transferCount: cj.transferCount + bestTransit.transferCount + 1,
                  routeName: `${cj.routeName} → ${bestTransit.legs.find((l) => l.kind === "transit")?.routeName || "公共交通機関"}`,
                  segments: combinedSegs,
                  isCsvOnly: false,
                });
              }
            } else {
              const apiResult = await planJourney({
                from: transferEndpoint.id,
                to: toEndpoint.id,
                fromLabel: transferEndpoint.name,
                toLabel: toEndpoint.name,
                type: "arrival",
                time: targetTime,
                numItineraries: 4,
              });
              if (!apiResult.ok) return;

              for (const j of apiResult.journeys) {
                const depClock = formatClock(j.departureSecs);
                const depMins = timeToMinutes(depClock);

                const csvJourneys = await findCsvJourneys(from.name, transferStop, dayType);
                const matchedCsv = csvJourneys.filter(cj => timeToMinutes(cj.arrivalTime) <= depMins - HYBRID_TRANSFER_BUFFER_MINS);
                if (matchedCsv.length === 0) continue;

                const bestCsv = matchedCsv.reduce((best, cj) => timeToMinutes(cj.departureTime) > timeToMinutes(best.departureTime) ? cj : best);

                const depTime = bestCsv.departureTime;
                const arrTime = formatClock(j.arrivalSecs);
                const duration = timeDifferenceMinutes(depTime, arrTime);
                const apiSegs = transitJourneyToSegments(j, transferEndpoint.name, toEndpoint.name);
                const combinedSegs = [...bestCsv.segments, ...apiSegs];
                const fare = bestCsv.fare + estimateTransitFare(j.legs);

                hybridJourneys.push({
                  departureTime: depTime,
                  arrivalTime: arrTime,
                  departureStop: from.name,
                  arrivalStop: toEndpoint.name,
                  durationMinutes: duration,
                  fare,
                  transferCount: bestCsv.transferCount + j.transferCount + 1,
                  routeName: `${bestCsv.routeName} → ${j.legs.find((l) => l.kind === "transit")?.routeName || "公共交通機関"}`,
                  segments: combinedSegs,
                  isCsvOnly: false,
                });
              }
            }
          })()
        );
      }
    }

    await Promise.all(tasks);
    journeys.push(...hybridJourneys);
  }

  // 4. 重複の除去・ソート・絞り込み
  const uniqueMap = new Map<string, SearchResultJourney>();
  for (const j of journeys) {
    const key = `${j.departureTime}_${j.arrivalTime}_${j.routeName}`;
    const existing = uniqueMap.get(key);
    if (!existing) {
      uniqueMap.set(key, j);
    } else {
      if (j.transferCount < existing.transferCount || (j.transferCount === existing.transferCount && j.fare < existing.fare)) {
        uniqueMap.set(key, j);
      }
    }
  }

  const uniqueJourneys = Array.from(uniqueMap.values());

  let filtered = uniqueJourneys;
  if (timeType === "departure") {
    filtered = uniqueJourneys.filter(j => timeToMinutes(j.departureTime) >= targetMins);
    filtered.sort((a, b) => timeToMinutes(a.departureTime) - timeToMinutes(b.departureTime));
  } else {
    filtered = uniqueJourneys.filter(j => timeToMinutes(j.arrivalTime) <= targetMins);
    filtered.sort((a, b) => timeToMinutes(b.arrivalTime) - timeToMinutes(a.arrivalTime));
  }

  // 極端に時間がかかるルート(最短の2倍以上)を除外する
  const validDurations = filtered
    .map(j => j.durationMinutes)
    .filter(d => typeof d === "number" && d > 0);
  if (validDurations.length > 0) {
    const minDuration = Math.min(...validDurations);
    filtered = filtered.filter(j => !(j.durationMinutes > 0) || j.durationMinutes < minDuration * 2);
  }

  return filtered.slice(0, 5);
}

// 直近の便を検索する。本日の便が終了している場合は翌日の始発から検索し、
// 得られた便には isNextDay: true を付与する(Myルートの表示用)。
export async function searchNextAvailableRoutes(
  from: BoardingSelection,
  to: BoardingSelection,
  baseDate: Date = new Date()
): Promise<SearchResultJourney[]> {
  const currentMins = baseDate.getHours() * 60 + baseDate.getMinutes();
  const today = await searchRoutes(
    from,
    to,
    minutesToTime(currentMins),
    "departure",
    getDayType(baseDate)
  );
  if (today.length > 0) return today;

  // 本日の便が無ければ翌日の始発(0:00)から検索する
  const nextDay = new Date(baseDate);
  nextDay.setDate(nextDay.getDate() + 1);
  const nextResults = await searchRoutes(
    from,
    to,
    "0:00",
    "departure",
    getDayType(nextDay)
  );
  return nextResults.map((r) => ({ ...r, isNextDay: true }));
}
