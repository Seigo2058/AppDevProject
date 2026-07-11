import { planOutboundLeg, planInboundLeg } from "./journeyPlanner";

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

// 経路の中の1本の乗り物区間（CSV区間・TransitAPI区間どちらから来たものも同じ形に正規化する）。
// 出発地→到着地の道のり画面で、乗換ごとの内訳を表示するために使う。
export interface JourneySegment {
  mode: "bus" | "train" | "transit" | "walk";
  routeName?: string;
  fromStop: string;
  toStop: string;
  departureTime: string;
  arrivalTime: string;
}

// CSV経路・TransitAPI経路のどちらで計算しても同じ形になるよう正規化した1本のバス脚。
export interface CommuteLeg {
  departureTime: string; // 乗車時刻 "H:MM" 表示用
  arrivalTime: string; // 到着時刻 "H:MM" 表示用
  stopLabel: string; // 反対側の停留所・目的地表示名
  isSchoolBus: boolean;
  routeName?: string;
  segments?: JourneySegment[]; // 乗換込みの内訳（道のり画面用）。取得できない場合は省略される。
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

// 計算済みの1週間分プラン（DayPlan）をlocalStorageにキャッシュし、乗車停留所・時間割が
// 変わっていない限り、ページ遷移のたびにTransitAPI/CSVへ問い合わせて再計算しないようにする。
// v2: 帰りの授業終了後5分バッファ（CLASS_EXIT_BUFFER_MINS）を撤廃した計算ロジックの変更。
// v3: 帰りの経路選択基準を「出発が最も早い」から「到着が最も早い」に修正した変更
// （TransitAPIの徒歩オンリー案が、実在するバス便より誤って優先されていた不具合の修正）。
// v4: 函館本線（JR）の時刻表CSVを新しいデータに差し替えたため。
// v5: 函館本線を岩見沢〜札幌の全区間（11駅）に拡張し、拡張路線の停留所を追加したため。
// v6: 検索経由でTransitAPI由来として選ばれた停留所名がCSV路線網の駅名と一致する場合に、
// CSV単独経路を試さず、かつ自分自身への無意味なハイブリッド乗換候補（不自然な徒歩案の
// 原因）を作ってしまっていた不具合の修正。
// v7: JR函館本線に到着(着)/出発(発)別の時刻データを導入し、途中駅での停車時間を
// 正確に扱うようにしたため（下り方向の岩見沢駅も追加）。
// v8: TransitAPIへの同時リクエスト数を絞るセマフォを導入。過負荷による"Failed to fetch"で
// 一部候補が欠落したまま計算・保存されていた可能性があるキャッシュを無効化するため。
// v9: 経路探索をフォールバック方式に変更（CSV単独経路が見つかればそれを採用し、見つから
// ない場合のみハイブリッド探索を行う。TransitAPI単独の直行経路は候補から除外）。
// 計算ロジック・元データを変えるたびにキー名を変更し、古い内容で計算済みのキャッシュを
// 確実に無効化する。
const COMPUTED_CACHE_KEY = "commute_computed_schedule_cache_v9";

interface ComputedScheduleCache {
  cacheKey: string;
  plans: Record<string, DayPlan | null>;
}

// boarding・schedule（曜日ごとの選択状態）が同じであれば同じキャッシュキーになる。
// 曜日の並び順に依存しないよう、比較前にソートしておく。
function buildCacheKey(boarding: BoardingSelection, schedule: string[]): string {
  return JSON.stringify({ boarding, schedule: [...schedule].sort() });
}

function readComputedCache(): ComputedScheduleCache | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(COMPUTED_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.cacheKey === "string" && parsed.plans && typeof parsed.plans === "object") {
      return parsed as ComputedScheduleCache;
    }
    return null;
  } catch {
    return null;
  }
}

// boarding・scheduleに対応するキャッシュのうち、requiredDaysを全て含んでいる場合のみ返す。
// 1曜日だけキャッシュされている状態（ホーム画面の「本日」のみの計算等）を、
// 週全体がキャッシュ済みであるかのように誤認しないための完全性チェック。
export function getComputedScheduleCache(
  boarding: BoardingSelection,
  schedule: string[],
  requiredDays: string[]
): Record<string, DayPlan | null> | null {
  const cache = readComputedCache();
  if (!cache || cache.cacheKey !== buildCacheKey(boarding, schedule)) return null;
  const hasAll = requiredDays.every((day) => Object.prototype.hasOwnProperty.call(cache.plans, day));
  return hasAll ? cache.plans : null;
}

// 新たに計算した結果をキャッシュに書き込む。boarding・scheduleが前回と同じであれば
// 既存の他の曜日の結果とマージし、異なっていれば（設定が変わったため）作り直す。
export function setComputedScheduleCache(
  boarding: BoardingSelection,
  schedule: string[],
  planUpdates: Record<string, DayPlan | null>
) {
  if (typeof window === "undefined") return;
  const cacheKey = buildCacheKey(boarding, schedule);
  const existing = readComputedCache();
  const basePlans = existing && existing.cacheKey === cacheKey ? existing.plans : {};
  try {
    localStorage.setItem(
      COMPUTED_CACHE_KEY,
      JSON.stringify({ cacheKey, plans: { ...basePlans, ...planUpdates } })
    );
  } catch (e) {
    console.error("Failed to persist computed schedule cache:", e);
  }
}

const ROUTE_SEGMENT_MAX_LENGTH = 5;
const ROUTE_SEGMENT_VISIBLE_COUNT = 2;

function truncateRouteSegment(name: string): string {
  return name.length > ROUTE_SEGMENT_MAX_LENGTH ? `${name.slice(0, ROUTE_SEGMENT_MAX_LENGTH)}…` : name;
}

// 乗換込みの路線名（"路線A → 路線B" 形式）をカード幅に収まるよう省略する。
// 乗換が無い（区間が1件のみの）場合は省略せずそのまま表示する。
// 乗換がある場合、各路線名は最大5文字+"…"、3件以上ある場合は3件目以降を"→…"にまとめる。
// ホーム画面・時間割画面のどちらのカードでも同じ表記になるよう、ここに集約する。
export function formatRouteLabel(routeName: string): string {
  const segments = routeName.split(" → ").map((s) => s.trim()).filter(Boolean);
  if (segments.length <= 1) return routeName;

  const visible = segments.slice(0, ROUTE_SEGMENT_VISIBLE_COUNT).map(truncateRouteSegment);
  return segments.length > ROUTE_SEGMENT_VISIBLE_COUNT ? `${visible.join(" → ")}→…` : visible.join(" → ");
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

    const [outbound, inbound] = await Promise.all([
      planOutboundLeg(boarding, startMins),
      planInboundLeg(boarding, endMins),
    ]);

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
