import { collection, getDocs } from "firebase/firestore";
import { getDb } from "@/lib/firebase";

/**
 * Firestore に置いた時刻表データの読み込み。
 *
 * データ構造（scripts/seed-firestore.mjs が public/csv から投入する）:
 *
 *   timetables/{route_id}
 *     transportType, agencyName, routeName, direction, dayType  … 路線の属性
 *     stops:   string[]                     … 停車順（route_stops_list.csv 由来）
 *     columns: string[]                     … 時刻表の列名（"札幌発" のような着/発を含む）
 *     departures: Record<string,string>[]   … 1便＝1要素。列名 → 時刻。空欄のセルはキーごと省略
 *
 *   schoolPeriods/{時限}
 *     period, startTime, endTime            … school_timetable.csv 由来
 *
 * コレクション全体（22件程度）を1回のクエリで読み、以降はメモリにキャッシュする。
 * 画面ごと・路線ごとに読み直さないので、CSVを個別に取得していた頃より往復が減る。
 */

export interface TimetableDoc {
  routeId: string;
  transportType: string;
  agencyName: string;
  routeName: string;
  direction: string;
  dayType: string;
  stops: string[];
  columns: string[];
  departures: Record<string, string>[];
}

export interface ClassPeriodDoc {
  period: number;
  startTime: string;
  endTime: string;
}

export class FirestoreNotConfiguredError extends Error {
  constructor() {
    super(
      "Firebase の接続情報が設定されていません。.env.local に NEXT_PUBLIC_FIREBASE_* を設定してください（docs/DEPLOY.md 参照）。"
    );
    this.name = "FirestoreNotConfiguredError";
  }
}

let timetableCache: Promise<TimetableDoc[]> | null = null;
let classPeriodCache: Promise<ClassPeriodDoc[]> | null = null;

function toStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}

function toDepartures(value: unknown): Record<string, string>[] {
  if (!Array.isArray(value)) return [];
  return value.map((row) => {
    if (!row || typeof row !== "object") return {};
    const entries = Object.entries(row as Record<string, unknown>).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string"
    );
    return Object.fromEntries(entries);
  });
}

/** timetables コレクションを丸ごと読む（初回のみ通信し、以降はキャッシュを返す）。 */
export async function loadTimetableDocs(): Promise<TimetableDoc[]> {
  if (timetableCache) return timetableCache;

  timetableCache = (async () => {
    const db = getDb();
    if (!db) throw new FirestoreNotConfiguredError();

    const snapshot = await getDocs(collection(db, "timetables"));
    return snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        routeId: doc.id,
        transportType: typeof data.transportType === "string" ? data.transportType : "",
        agencyName: typeof data.agencyName === "string" ? data.agencyName : "",
        routeName: typeof data.routeName === "string" ? data.routeName : "",
        direction: typeof data.direction === "string" ? data.direction : "",
        dayType: typeof data.dayType === "string" ? data.dayType : "",
        stops: toStringArray(data.stops),
        columns: toStringArray(data.columns),
        departures: toDepartures(data.departures),
      };
    });
  })();

  try {
    return await timetableCache;
  } catch (error) {
    // 失敗をキャッシュしたままにすると復帰できないので、次回は再試行できるようにする
    timetableCache = null;
    throw error;
  }
}

/** 授業の時限（school_timetable.csv 相当）を読む。 */
export async function loadClassPeriods(): Promise<ClassPeriodDoc[]> {
  if (classPeriodCache) return classPeriodCache;

  classPeriodCache = (async () => {
    const db = getDb();
    if (!db) throw new FirestoreNotConfiguredError();

    const snapshot = await getDocs(collection(db, "schoolPeriods"));
    return snapshot.docs
      .map((doc) => {
        const data = doc.data();
        const period = typeof data.period === "number" ? data.period : Number(doc.id);
        return {
          period,
          startTime: typeof data.startTime === "string" ? data.startTime : "",
          endTime: typeof data.endTime === "string" ? data.endTime : "",
        };
      })
      .filter((p) => Number.isFinite(p.period))
      .sort((a, b) => a.period - b.period);
  })();

  try {
    return await classPeriodCache;
  } catch (error) {
    classPeriodCache = null;
    throw error;
  }
}
