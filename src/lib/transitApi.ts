// TransitAPI (https://api.transit.ls8h.com) クライアント。
// 公開・CORS対応・APIキー不要のため、サーバープロキシを介さずクライアントから直接呼び出す。

const TRANSIT_API_BASE = "https://api.transit.ls8h.com";

// ハイブリッド乗換候補（拡張路線の停留所ごと）を常にすべて計算する都合上、planJourneyは
// 1回のスケジュール計算で100件超規模に並列で呼ばれ得る。無制限に並列実行するとサーバー
// 側の負荷等により"Failed to fetch"が頻発する一方、絞りすぎると計算完了までの待ち時間が
// 大幅に伸びる（6並列では数十秒〜1分以上かかることを確認）。両者のバランスを取り、
// 同時実行数を絞るための簡易セマフォを導入する。上限を超えた分は先着順にキューイングされ、
// 空きが出次第実行される。
const MAX_CONCURRENT_PLAN_REQUESTS = 12;

class Semaphore {
  private available: number;
  private readonly queue: (() => void)[] = [];

  constructor(concurrency: number) {
    this.available = concurrency;
  }

  async acquire(): Promise<() => void> {
    if (this.available <= 0) {
      await new Promise<void>((resolve) => this.queue.push(resolve));
    }
    this.available--;
    return () => this.release();
  }

  private release() {
    this.available++;
    const next = this.queue.shift();
    if (next) next();
  }
}

const planJourneySemaphore = new Semaphore(MAX_CONCURRENT_PLAN_REQUESTS);

// 学校専用のスクール便CSVには存在しないため、TransitAPI側では
// 大学近隣のOSM地点（北海道情報大学）を固定の目的地として使う。
export const JOHODAI = {
  id: "geo:43.077892,141.536019",
  name: "北海道情報大学",
};

export interface PlaceSuggestion {
  id: string;
  endpoint: string;
  name: string;
  kind: "station" | "stop" | "place" | "address";
  description?: string;
  nameKana?: string;
  feedName?: string;
}

// "transit:query-landmark:" と "osm:cluster:" は、同名の複数駅・停留所を1点に束ねた
// 集約エントリ（例: "札幌 4地点"）で、特定の事業者・路線の停留所ではない。
// 検索候補としては曖昧なだけでなく、この集約地点の座標をそのままplanJourneyに渡すと
// 実在する地下鉄・JRがあるのに全区間徒歩の案内が返ってくることがある（generalRouteSearch.ts
// で対処済みの不具合の発生源のひとつ）。事業者・路線が特定できる個別エントリのみを返す。
function isAggregatedClusterPlace(place: PlaceSuggestion): boolean {
  return place.id.startsWith("transit:query-landmark:") || place.id.startsWith("osm:cluster:");
}

export async function suggestPlaces(query: string, limit = 10): Promise<PlaceSuggestion[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];
  try {
    const url = new URL("/api/v1/places/suggest", TRANSIT_API_BASE);
    url.searchParams.set("q", trimmed);
    url.searchParams.set("limit", String(limit));
    const res = await fetch(url.toString());
    if (!res.ok) return [];
    const data = await res.json();
    const places: PlaceSuggestion[] = Array.isArray(data.places) ? data.places : [];
    return places.filter((p) => !isAggregatedClusterPlace(p));
  } catch (e) {
    // 呼び出し側は空配列を正しく扱える設計であり、ネットワーク不調は起こり得る想定内の
    // 失敗のためconsole.warnに留める。console.errorはNext.jsの開発時オーバーレイに
    // ハンドリング済みの失敗まで致命的エラーとして表示させてしまうため使わない。
    console.warn("TransitAPI suggestPlaces failed:", e);
    return [];
  }
}

export interface PlanLeg {
  kind: "transit" | "walk";
  routeName?: string;
  mode?: string;
  headsign?: string;
  from: { id: string; name: string };
  to: { id: string; name: string };
  departureSecs: number;
  arrivalSecs: number;
}

export interface Journey {
  departureSecs: number;
  arrivalSecs: number;
  durationSecs: number;
  transferCount: number;
  legs: PlanLeg[];
}

export interface PlanParams {
  from: string;
  to: string;
  fromLabel?: string;
  toLabel?: string;
  type?: "departure" | "arrival" | "first" | "last";
  time?: string;
  numItineraries?: number;
}

export type PlanResult =
  | { ok: true; journeys: Journey[] }
  | { ok: false; error: string };

export async function planJourney(params: PlanParams): Promise<PlanResult> {
  const release = await planJourneySemaphore.acquire();
  try {
    const url = new URL("/api/v1/plan", TRANSIT_API_BASE);
    url.searchParams.set("from", params.from);
    url.searchParams.set("to", params.to);
    if (params.fromLabel) url.searchParams.set("fromLabel", params.fromLabel);
    if (params.toLabel) url.searchParams.set("toLabel", params.toLabel);
    url.searchParams.set("type", params.type ?? "departure");
    if (params.time) url.searchParams.set("time", params.time);
    url.searchParams.set("numItineraries", String(params.numItineraries ?? 4));

    const res = await fetch(url.toString());
    const data = await res.json();

    if (!res.ok || data.error) {
      const message =
        typeof data.error === "string" ? data.error : data.error?.message || "経路検索に失敗しました";
      return { ok: false, error: message };
    }

    return { ok: true, journeys: Array.isArray(data.journeys) ? data.journeys : [] };
  } catch (e) {
    // journeyPlanner側は複数候補を並列に試し、失敗した候補は単に除外する設計のため、
    // 個々の失敗はアプリのクラッシュではない想定内の事象。console.errorはNext.jsの
    // 開発時オーバーレイにハンドリング済みの失敗まで致命的エラーとして表示させてしまう
    // ため、ここではconsole.warnに留める。
    console.warn("TransitAPI planJourney failed:", e);
    return { ok: false, error: "経路検索に失敗しました" };
  } finally {
    release();
  }
}

// TransitAPIの時刻は0時起点の秒数(24h超・負値もあり得る)。表示用にHH:MM文字列へ変換する。
export function formatClock(secs: number): string {
  const normalized = Math.round(secs / 60) * 60;
  const totalMinutes = Math.floor(normalized / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}:${String(minutes).padStart(2, "0")}`;
}

// "HH:MM" → 0時起点の秒数
export function clockToSecs(clock: string): number {
  const [h, m] = clock.split(":").map((v) => parseInt(v, 10));
  return (h || 0) * 3600 + (m || 0) * 60;
}
