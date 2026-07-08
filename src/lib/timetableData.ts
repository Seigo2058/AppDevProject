export interface RouteStop {
  route_id: string;
  transportType: string; // "バス" | "JR"
  routeName: string;
  stops: string[]; // カンマ区切りの文字列を配列に変換
}

export interface TimetableInfo {
  route_id: string;
  transportType: string;
  agencyName: string;
  routeName: string;
  direction: string;
  dayType: string;
  csvFileName: string;
}

// 簡単なCSVパーサー (ダブルクォートを考慮)
export function parseCSVRow(text: string): string[][] {
  const result: string[][] = [];
  let row: string[] = [];
  let inQuotes = false;
  let cell = '';

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      row.push(cell.trim());
      cell = '';
    } else if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && text[i + 1] === '\n') {
        i++; // skip \n
      }
      row.push(cell.trim());
      result.push(row);
      row = [];
      cell = '';
    } else {
      cell += char;
    }
  }
  if (cell !== '' || row.length > 0) {
    row.push(cell.trim());
    result.push(row);
  }
  return result;
}

export async function fetchRouteStops(): Promise<RouteStop[]> {
  try {
    const res = await fetch('/csv/route_stops_list.csv');
    if (!res.ok) return [];
    const text = await res.text();
    const rows = parseCSVRow(text);

    // Header: route_id, 交通機関種別, 路線名, 停留所1, 停留所2, ...
    // データは2行目以降
    return rows.slice(1).filter(r => r.length >= 4).map(row => {
      // 停留所は4列目(インデックス3)以降の空でないセル
      const stops = row.slice(3).map(s => s.trim()).filter(s => s !== '');
      return {
        route_id: row[0],
        transportType: row[1],
        routeName: row[2],
        stops: stops
      };
    });
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
    const res = await fetch('/csv/timetable_list.csv');
    if (!res.ok) return [];
    const text = await res.text();
    const rows = parseCSVRow(text);

    // Header: route_id,交通機関種別,事業者名,路線名,方面,曜日,対応するcsv
    return rows.slice(1).filter(r => r.length >= 7).map(row => ({
      route_id: row[0],
      transportType: row[1],
      agencyName: row[2],
      routeName: row[3],
      direction: row[4],
      dayType: row[5],
      csvFileName: row[6]
    }));
  } catch (error) {
    console.error("Failed to fetch timetable list:", error);
    return [];
  }
}

export interface SearchResult {
  matchedName: string;
  routeName: string;
}

// 検索機能：駅・停留所名または路線名で部分一致検索し、一致する名前と路線名のペアを返す
export async function searchStopsAndRoutes(keyword: string): Promise<SearchResult[]> {
  if (!keyword.trim()) return [];
  const routeStops = await fetchRouteStops();
  const lowerKeyword = keyword.toLowerCase();

  const results: SearchResult[] = [];
  const added = new Set<string>();

  for (const item of routeStops) {
    // 停留所一覧のいずれかがマッチ
    for (const stop of item.stops) {
      if (stop.toLowerCase().includes(lowerKeyword)) {
        const key = `${stop}-${item.routeName}`;
        if (!added.has(key)) {
          added.add(key);
          results.push({ matchedName: stop, routeName: item.routeName });
        }
      }
    }
  }

  return results;
}

// 特定の路線名に紐づく方面リストを取得する
export async function getDirectionsByRouteName(routeName: string): Promise<string[]> {
  const timetables = await fetchTimetableList();
  const matched = timetables.filter(t => t.routeName === routeName);
  
  const directions = new Set<string>();
  for (const t of matched) {
    directions.add(t.direction);
  }
  return Array.from(directions);
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

// 実際の時刻表CSVデータを取得する
export async function fetchTimetableData(csvFileName: string): Promise<string[][]> {
  try {
    const res = await fetch(`/csv/${csvFileName}`);
    if (!res.ok) return [];
    const text = await res.text();
    return parseCSVRow(text);
  } catch (error) {
    console.error("Failed to fetch timetable data:", error);
    return [];
  }
}

// 端の停留所かどうかを判定し、もし端であればその停留所から出発する平日のroute_idを返す
export async function checkEdgeStopAndGetRouteId(routeName: string, stopName: string): Promise<string | null> {
  const routeStops = await fetchRouteStops();
  const matchedStops = routeStops.filter(r => r.routeName === routeName);
  
  let isEdge = false;
  for (const r of matchedStops) {
    if (r.stops.length > 0 && (r.stops[0] === stopName || r.stops[r.stops.length - 1] === stopName)) {
      isEdge = true;
      break;
    }
  }

  if (!isEdge) return null;

  // 端である場合、その駅から出発するルートを探す
  const departingRoutes = matchedStops.filter(r => r.stops.length > 0 && r.stops[0] === stopName);
  if (departingRoutes.length === 0) return null;

  const timetables = await fetchTimetableList();
  for (const dr of departingRoutes) {
    const tInfo = timetables.find(t => t.route_id === dr.route_id && t.dayType === '平日');
    if (tInfo) return tInfo.route_id;
  }
  
  return departingRoutes[0].route_id;
}

export interface FavoriteItem {
  routeId: string;
  stopName: string;
}

export function saveFavoriteRoute(routeId: string, stopName: string) {
  if (typeof window === 'undefined') return;
  const current = getFavoriteRoutes();
  const exists = current.some(f => f.routeId === routeId && f.stopName === stopName);
  if (!exists) {
    localStorage.setItem('favoriteRoutesV2', JSON.stringify([...current, { routeId, stopName }]));
  }
}

export function removeFavoriteRoute(routeId: string, stopName: string) {
  if (typeof window === 'undefined') return;
  const current = getFavoriteRoutes();
  const updated = current.filter(f => !(f.routeId === routeId && f.stopName === stopName));
  localStorage.setItem('favoriteRoutesV2', JSON.stringify(updated));
}

export function getFavoriteRoutes(): FavoriteItem[] {
  if (typeof window === 'undefined') return [];
  const saved = localStorage.getItem('favoriteRoutesV2');
  return saved ? JSON.parse(saved) : [];
}
