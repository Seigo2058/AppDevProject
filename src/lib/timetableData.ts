import { loadTimetableDocs } from "@/lib/firestoreData";

export interface RouteStop {
  route_id: string;
  transportType: string; // "バス" | "JR"
  routeName: string;
  stops: string[]; // 停車順
}

export interface TimetableInfo {
  route_id: string;
  transportType: string;
  agencyName: string;
  routeName: string;
  direction: string;
  dayType: string;
}

export async function fetchRouteStops(): Promise<RouteStop[]> {
  try {
    const docs = await loadTimetableDocs();
    return docs.map(doc => ({
      route_id: doc.routeId,
      transportType: doc.transportType,
      routeName: doc.routeName,
      stops: doc.stops,
    }));
  } catch (error) {
    console.error("Failed to fetch route stops:", error);
    return [];
  }
}

export async function getRouteStopsById(routeId: string): Promise<string[]> {
  const routeStops = await fetchRouteStops();
  const found = routeStops.find(r => r.route_id === routeId);
  return found ? found.stops : [];
}

export async function fetchTimetableList(): Promise<TimetableInfo[]> {
  try {
    const docs = await loadTimetableDocs();
    return docs.map(doc => ({
      route_id: doc.routeId,
      transportType: doc.transportType,
      agencyName: doc.agencyName,
      routeName: doc.routeName,
      direction: doc.direction,
      dayType: doc.dayType,
    }));
  } catch (error) {
    console.error("Failed to fetch timetable list:", error);
    return [];
  }
}

export interface StopSearchResult {
  stopName: string;
  routeCount: number;
  transportTypes: string[];
}

// 検索機能：駅・停留所名で部分一致検索し、停留所単位（重複なし）で返す。
// 路線の選択は停留所を選んだ後の画面で行う。
export async function searchStops(keyword: string): Promise<StopSearchResult[]> {
  if (!keyword.trim()) return [];
  const routeStops = await fetchRouteStops();
  const lowerKeyword = keyword.toLowerCase();

  // 停留所名ごとに、そこを通る路線名と交通機関種別を集約する
  const byStop = new Map<string, { routeNames: Set<string>; transportTypes: Set<string> }>();

  for (const item of routeStops) {
    for (const stop of item.stops) {
      if (!stop.toLowerCase().includes(lowerKeyword)) continue;
      let entry = byStop.get(stop);
      if (!entry) {
        entry = { routeNames: new Set(), transportTypes: new Set() };
        byStop.set(stop, entry);
      }
      entry.routeNames.add(item.routeName);
      if (item.transportType) entry.transportTypes.add(item.transportType);
    }
  }

  const results: StopSearchResult[] = Array.from(byStop.entries()).map(([stopName, entry]) => ({
    stopName,
    routeCount: entry.routeNames.size,
    transportTypes: Array.from(entry.transportTypes),
  }));

  // 前方一致を優先し、その中では名前が短い（＝キーワードに近い）ものを上に出す
  return results.sort((a, b) => {
    const aStarts = a.stopName.toLowerCase().startsWith(lowerKeyword);
    const bStarts = b.stopName.toLowerCase().startsWith(lowerKeyword);
    if (aStarts !== bStarts) return aStarts ? -1 : 1;
    if (a.stopName.length !== b.stopName.length) return a.stopName.length - b.stopName.length;
    return a.stopName.localeCompare(b.stopName, 'ja');
  });
}

export interface StopDirectionOption {
  direction: string;
  routeId: string; // 平日を優先した代表の route_id
}

export interface StopLineGroup {
  routeName: string;
  transportType: string;
  directions: StopDirectionOption[];
}

// 指定した停留所から乗車できる路線を、路線ごとに方面をまとめて返す。
// route_stops_list.csv は route_id（＝路線＋方面＋曜日）単位で停車順を持つため、
// その停留所が終点になっている便は乗車できないものとして除外する。
export async function getLinesWithDirectionsByStop(stopName: string): Promise<StopLineGroup[]> {
  if (!stopName) return [];
  const [routeStops, timetables] = await Promise.all([fetchRouteStops(), fetchTimetableList()]);

  const groups = new Map<string, StopLineGroup>();

  for (const rs of routeStops) {
    const index = rs.stops.indexOf(stopName);
    if (index === -1 || index === rs.stops.length - 1) continue;

    const info = timetables.find(t => t.route_id === rs.route_id);
    if (!info) continue;

    let group = groups.get(rs.routeName);
    if (!group) {
      group = { routeName: rs.routeName, transportType: rs.transportType, directions: [] };
      groups.set(rs.routeName, group);
    }

    const existing = group.directions.find(d => d.direction === info.direction);
    if (existing) {
      // 同じ方面が曜日違いで複数ある場合は平日を代表にする
      if (info.dayType === '平日') existing.routeId = info.route_id;
      continue;
    }
    group.directions.push({ direction: info.direction, routeId: info.route_id });
  }

  return Array.from(groups.values());
}

// 路線名、方面、曜日から route_id などを取得する
export async function getTimetableInfo(routeName: string, direction: string, dayType: string): Promise<TimetableInfo | undefined> {
  const timetables = await fetchTimetableList();
  return timetables.find(t => 
    t.routeName === routeName && 
    t.direction === direction && 
    t.dayType === dayType
  );
}

// route_id から情報を取得
export async function getTimetableInfoById(routeId: string): Promise<TimetableInfo | undefined> {
  const timetables = await fetchTimetableList();
  return timetables.find(t => t.route_id === routeId);
}

// 発車時刻の表を取得する。
// 戻り値は従来のCSVと同じ「1行目＝列名、2行目以降＝各便」の二次元配列。
export async function fetchTimetableData(routeId: string): Promise<string[][]> {
  try {
    const docs = await loadTimetableDocs();
    const doc = docs.find(d => d.routeId === routeId);
    if (!doc || doc.columns.length === 0) return [];
    const rows = doc.departures.map(row => doc.columns.map(col => row[col] ?? ''));
    return [doc.columns, ...rows];
  } catch (error) {
    console.error("Failed to fetch timetable data:", error);
    return [];
  }
}

export interface FavoriteItem {
  routeId: string;
  stopName: string;
}

// route_id は「路線＋方面＋曜日」単位だが、登録は曜日を区別しない。
// そのため同じ路線・方面の route_id（平日／土日・祝）をまとめて1件として扱う。
export async function getSameLineRouteIds(routeId: string): Promise<string[]> {
  const timetables = await fetchTimetableList();
  const info = timetables.find(t => t.route_id === routeId);
  if (!info) return [routeId];
  return timetables
    .filter(t => t.routeName === info.routeName && t.direction === info.direction)
    .map(t => t.route_id);
}

// 登録時に保存する代表の route_id。表示・遷移は平日を既定にする。
async function getRepresentativeRouteId(routeId: string): Promise<string> {
  const timetables = await fetchTimetableList();
  const info = timetables.find(t => t.route_id === routeId);
  if (!info) return routeId;
  const weekday = timetables.find(
    t => t.routeName === info.routeName && t.direction === info.direction && t.dayType === '平日'
  );
  return weekday ? weekday.route_id : routeId;
}

export async function saveFavoriteRoute(routeId: string, stopName: string) {
  if (typeof window === 'undefined') return;
  const [representative, sameLineIds] = await Promise.all([
    getRepresentativeRouteId(routeId),
    getSameLineRouteIds(routeId),
  ]);
  // 曜日違いで重複登録されないよう、同じ路線・方面の既存分を代表1件に置き換える。
  const others = getFavoriteRoutes().filter(
    f => !(sameLineIds.includes(f.routeId) && f.stopName === stopName)
  );
  localStorage.setItem(
    'favoriteRoutesV2',
    JSON.stringify([...others, { routeId: representative, stopName }])
  );
}

export async function removeFavoriteRoute(routeId: string, stopName: string) {
  if (typeof window === 'undefined') return;
  const sameLineIds = await getSameLineRouteIds(routeId);
  const updated = getFavoriteRoutes().filter(
    f => !(sameLineIds.includes(f.routeId) && f.stopName === stopName)
  );
  localStorage.setItem('favoriteRoutesV2', JSON.stringify(updated));
}

export async function isFavoriteRoute(routeId: string, stopName: string): Promise<boolean> {
  const sameLineIds = await getSameLineRouteIds(routeId);
  return getFavoriteRoutes().some(f => sameLineIds.includes(f.routeId) && f.stopName === stopName);
}

export function getFavoriteRoutes(): FavoriteItem[] {
  if (typeof window === 'undefined') return [];
  const saved = localStorage.getItem('favoriteRoutesV2');
  return saved ? JSON.parse(saved) : [];
}
