// まずCSV単独経路(tripGraph)を試し、見つかった場合はそれを採用する（通信なしで確定）。
// 見つからなかった場合のみ、拡張路線の乗換候補駅ごとにTransitAPI区間+CSV区間を
// 組み合わせたハイブリッド経路を探索するフォールバック方式の統合プランナー。
// TransitAPIで大学まで直行する単独経路は候補にしない。
// 自前CSV路線をTransitAPIの「拡張路線」として組み込み、TransitAPIだけでは知り得ない
// スクール便等の自前路線への乗換を、TransitAPI区間と組み合わせて解決する。

import { planJourney, formatClock } from "./transitApi";
import type { PlanLeg } from "./transitApi";
import { planOutboundCsvJourney, planInboundCsvJourney, CsvJourney, CsvJourneyLeg } from "./tripGraph";
import { canonicalStopName, resolveStopEndpoint, getHybridTransferCandidates, StopEndpoint } from "./stopRegistry";
import type { BoardingSelection, CommuteLeg, JourneySegment } from "./schedule";

// 帰りの検索で「同日中に妥当な便」とみなす範囲。
const SAME_DAY_WINDOW_SECS = 6 * 60 * 60;
const LOOKBACK_SECS = 90 * 60;
// TransitAPI区間からCSV区間（またはその逆）へ乗り継ぐ際に最低限見込む時間（分）。
// 別々の交通事業者・データソースをまたぐ乗換のため、CSV内部の乗換バッファより長めに取る。
const HYBRID_TRANSFER_BUFFER_MINS = 5;

// "HH:MM" → 0時起点の分数（"-"や不正値は-1）
function timeToMinutes(timeStr: string | undefined): number {
  if (!timeStr || timeStr === "-") return -1;
  const parts = timeStr.split(":");
  if (parts.length !== 2) return -1;
  const hours = parseInt(parts[0], 10);
  const minutes = parseInt(parts[1], 10);
  if (isNaN(hours) || isNaN(minutes)) return -1;
  return hours * 60 + minutes;
}

function csvLegsToSegments(legs: CsvJourneyLeg[]): JourneySegment[] {
  return legs.map((l) => ({
    mode: l.transportType === "バス" ? "bus" : l.transportType === "JR" ? "train" : "transit",
    routeName: l.routeName,
    fromStop: l.fromStop,
    toStop: l.toStop,
    departureTime: l.departureTime,
    arrivalTime: l.arrivalTime,
  }));
}

function transitModeToSegmentMode(mode: string | undefined): JourneySegment["mode"] {
  const normalized = (mode ?? "").toLowerCase();
  if (normalized.includes("rail") || normalized.includes("train") || normalized.includes("subway") || normalized.includes("tram")) {
    return "train";
  }
  if (normalized.includes("bus")) return "bus";
  return "transit";
}

function transitLegsToSegments(legs: PlanLeg[]): JourneySegment[] {
  return legs.map((l) => ({
    mode: l.kind === "walk" ? "walk" : transitModeToSegmentMode(l.mode),
    routeName: l.routeName,
    fromStop: l.from.name,
    toStop: l.to.name,
    departureTime: formatClock(l.departureSecs),
    arrivalTime: formatClock(l.arrivalSecs),
  }));
}

// TransitAPIのjourneyは、乗換地点までの最初/最後の徒歩(access/egress walk)を
// legs配列に含めず、journey全体のdepartureSecs/arrivalSecsにのみ反映することがある
// （例: バスを降りてから目的地まで徒歩15分、というケース）。legs単体では道のりが
// 目的地まで繋がらず表示上の時刻が矛盾するため、そのギャップを徒歩区間として補う。
const IMPLICIT_WALK_GAP_TOLERANCE_SECS = 30;

function transitJourneyToSegments(
  journey: { departureSecs: number; arrivalSecs: number; legs: PlanLeg[] },
  originLabel: string,
  destLabel: string
): JourneySegment[] {
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

  const segments: JourneySegment[] = [];

  if (legs[0].departureSecs - journey.departureSecs > IMPLICIT_WALK_GAP_TOLERANCE_SECS) {
    segments.push({
      mode: "walk",
      fromStop: originLabel,
      toStop: legs[0].from.name,
      departureTime: formatClock(journey.departureSecs),
      arrivalTime: formatClock(legs[0].departureSecs),
    });
  }

  segments.push(...transitLegsToSegments(legs));

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

// 行き: fromからtoへ、arriveByMinsまでに到着する便のうち、最も出発が遅い(=待ち時間が短い)ものを選ぶ
async function bestOutboundTransitLeg(
  from: StopEndpoint,
  to: StopEndpoint,
  arriveByMins: number
): Promise<CommuteLeg | null> {
  const arriveBySecs = arriveByMins * 60;
  const lookbackClock = formatClock(Math.max(arriveBySecs - LOOKBACK_SECS, 0));

  const result = await planJourney({
    from: from.id,
    to: to.id,
    fromLabel: from.name,
    toLabel: to.name,
    type: "departure",
    time: lookbackClock,
    numItineraries: 6,
  });

  if (!result.ok || result.journeys.length === 0) return null;
  // 到着基準時刻より後に着く便は間に合わないため除外する（許容誤差は設けない）。
  const onTime = result.journeys.filter((j) => j.arrivalSecs <= arriveBySecs);
  if (onTime.length === 0) return null;
  const best = onTime.reduce((a, b) => (b.departureSecs > a.departureSecs ? b : a));
  return {
    departureTime: formatClock(best.departureSecs),
    arrivalTime: formatClock(best.arrivalSecs),
    stopLabel: to.name,
    isSchoolBus: false,
    routeName: best.legs.find((l) => l.kind === "transit")?.routeName,
    segments: transitJourneyToSegments(best, from.name, to.name),
  };
}

// 帰り: fromからtoへ、departAfterMins以降に出発する便のうち、最も早いものを選ぶ
async function bestInboundTransitLeg(
  from: StopEndpoint,
  to: StopEndpoint,
  departAfterMins: number
): Promise<CommuteLeg | null> {
  const departAfterSecs = departAfterMins * 60;
  const departClock = formatClock(departAfterSecs);

  const result = await planJourney({
    from: from.id,
    to: to.id,
    fromLabel: from.name,
    toLabel: to.name,
    type: "departure",
    time: departClock,
    numItineraries: 6,
  });

  if (!result.ok || result.journeys.length === 0) return null;
  // departAfterSecsより前に出発する便には乗れないため除外する（許容誤差は設けない）。
  const onTime = result.journeys.filter(
    (j) => j.departureSecs >= departAfterSecs && j.departureSecs <= departAfterSecs + SAME_DAY_WINDOW_SECS
  );
  if (onTime.length === 0) return null;
  const best = onTime.reduce((a, b) => (b.departureSecs < a.departureSecs ? b : a));
  return {
    departureTime: formatClock(best.departureSecs),
    arrivalTime: formatClock(best.arrivalSecs),
    stopLabel: from.name,
    isSchoolBus: false,
    routeName: best.legs.find((l) => l.kind === "transit")?.routeName,
    segments: transitJourneyToSegments(best, from.name, to.name),
  };
}

function csvJourneyToOutboundLeg(j: CsvJourney): CommuteLeg {
  return {
    departureTime: j.departureTime,
    arrivalTime: j.arrivalTime,
    stopLabel: j.legs[j.legs.length - 1].toStop,
    isSchoolBus: false,
    routeName: j.routeName,
    segments: csvLegsToSegments(j.legs),
  };
}

function csvJourneyToInboundLeg(j: CsvJourney): CommuteLeg {
  return {
    departureTime: j.departureTime,
    arrivalTime: j.arrivalTime,
    stopLabel: j.legs[0].fromStop,
    isSchoolBus: false,
    routeName: j.routeName,
    segments: csvLegsToSegments(j.legs),
  };
}

// boarding(CSV由来ならその停留所名、TransitAPI由来ならその地点ID)を、
// TransitAPI問い合わせに使える地点(StopEndpoint)に解決する。CSV由来の停留所に
// 座標が未登録の場合はnull（=TransitAPI単独/ハイブリッド探索は行わずCSV単独のみになる）。
function resolveOriginEndpoint(boarding: BoardingSelection): StopEndpoint | null {
  if (boarding.source === "transit") {
    return { id: boarding.id, name: boarding.name };
  }
  return resolveStopEndpoint(canonicalStopName(boarding.name));
}

// boarding.nameがCSV路線網上の停留所名と一致するかに関わらず（検索モーダル経由でTransitAPI由来
// として選ばれた場合でも、同じ実在駅名ならCSV網上の駅と同一視する）正規化名を返す。
// これにより、CSV網に含まれる駅を検索経由で選んだ場合も、CSV単独経路が試され、かつ
// ハイブリッド探索でその駅自身を無意味な乗換候補にしてしまう（TransitAPIに同一地点への
// 無意味な問い合わせをさせ、結果的に不自然な徒歩案が選ばれる）ことを防ぐ。
function originCanonicalName(boarding: BoardingSelection): string {
  return canonicalStopName(boarding.name);
}

// 行き: 授業開始時刻(arriveByMins)までに大学へ到着する経路を求める。
// まずCSV単独経路（通信なし）を試し、見つかればそれで確定する。見つからなかった場合のみ、
// 拡張路線の乗換候補駅ごとにTransitAPI区間+CSV区間のハイブリッド経路を探索する
// （TransitAPIで大学まで直行する単独経路は候補にしない）。CSV単独経路が見つかる
// ケースが大半のため、通常はTransitAPIへの通信がほぼ発生しない。
export async function planOutboundLeg(
  boarding: BoardingSelection,
  arriveByMins: number,
  dayType = "平日"
): Promise<CommuteLeg | null> {
  const csvJourney = await planOutboundCsvJourney(boarding.name, arriveByMins, dayType);
  if (csvJourney) {
    return csvJourneyToOutboundLeg(csvJourney);
  }

  const originEndpoint = resolveOriginEndpoint(boarding);
  if (!originEndpoint) return null;

  const originCanonical = originCanonicalName(boarding);
  const candidates: { leg: CommuteLeg; departureMins: number }[] = [];
  const tasks: Promise<void>[] = [];

  for (const transferStop of getHybridTransferCandidates()) {
    if (transferStop === originCanonical) continue;
    tasks.push(
      (async () => {
        const csvLeg = await planOutboundCsvJourney(transferStop, arriveByMins, dayType);
        if (!csvLeg) return;
        const transferEndpoint = resolveStopEndpoint(transferStop);
        if (!transferEndpoint) return;
        const csvDepartMins = timeToMinutes(csvLeg.departureTime);
        if (csvDepartMins === -1) return;

        const transitLeg = await bestOutboundTransitLeg(
          originEndpoint,
          transferEndpoint,
          csvDepartMins - HYBRID_TRANSFER_BUFFER_MINS
        );
        if (!transitLeg) return;

        const combined: CommuteLeg = {
          departureTime: transitLeg.departureTime,
          arrivalTime: csvLeg.arrivalTime,
          stopLabel: csvLeg.legs[csvLeg.legs.length - 1].toStop,
          isSchoolBus: false,
          routeName: `${transitLeg.routeName ?? "徒歩"} → ${csvLeg.routeName}`,
          segments: [...(transitLeg.segments ?? []), ...csvLegsToSegments(csvLeg.legs)],
        };
        candidates.push({ leg: combined, departureMins: timeToMinutes(combined.departureTime) });
      })()
    );
  }

  await Promise.all(tasks);

  if (candidates.length === 0) return null;
  return candidates.reduce((a, b) => (b.departureMins > a.departureMins ? b : a)).leg;
}

// 帰り: 授業終了時刻(departAfterMins)以降に大学を出発する経路を求める。
// まずCSV単独経路（通信なし）を試し、見つかればそれで確定する。見つからなかった場合のみ、
// 拡張路線の乗換候補駅ごとにCSV区間+TransitAPI区間のハイブリッド経路を探索する
// （TransitAPIで大学から直行する単独経路は候補にしない）。
export async function planInboundLeg(
  boarding: BoardingSelection,
  departAfterMins: number,
  dayType = "平日"
): Promise<CommuteLeg | null> {
  const csvJourney = await planInboundCsvJourney(boarding.name, departAfterMins, dayType);
  if (csvJourney) {
    return csvJourneyToInboundLeg(csvJourney);
  }

  const originEndpoint = resolveOriginEndpoint(boarding);
  if (!originEndpoint) return null;

  const originCanonical = originCanonicalName(boarding);
  const candidates: { leg: CommuteLeg; arrivalMins: number }[] = [];
  const tasks: Promise<void>[] = [];

  for (const transferStop of getHybridTransferCandidates()) {
    if (transferStop === originCanonical) continue;
    tasks.push(
      (async () => {
        const csvLeg = await planInboundCsvJourney(transferStop, departAfterMins, dayType);
        if (!csvLeg) return;
        const transferEndpoint = resolveStopEndpoint(transferStop);
        if (!transferEndpoint) return;
        const csvArriveMins = timeToMinutes(csvLeg.arrivalTime);
        if (csvArriveMins === -1) return;

        const transitLeg = await bestInboundTransitLeg(
          transferEndpoint,
          originEndpoint,
          csvArriveMins + HYBRID_TRANSFER_BUFFER_MINS
        );
        if (!transitLeg) return;

        const combined: CommuteLeg = {
          departureTime: csvLeg.departureTime,
          arrivalTime: transitLeg.arrivalTime,
          stopLabel: csvLeg.legs[0].fromStop,
          isSchoolBus: false,
          routeName: `${csvLeg.routeName} → ${transitLeg.routeName ?? "徒歩"}`,
          segments: [...csvLegsToSegments(csvLeg.legs), ...(transitLeg.segments ?? [])],
        };
        candidates.push({ leg: combined, arrivalMins: timeToMinutes(combined.arrivalTime) });
      })()
    );
  }

  await Promise.all(tasks);

  if (candidates.length === 0) return null;
  return candidates.reduce((a, b) => (b.arrivalMins < a.arrivalMins ? b : a)).leg;
}
