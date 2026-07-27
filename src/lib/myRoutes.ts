import type { BoardingSelection } from "./schedule";

const STORAGE_KEY = "my_routes";

export interface SavedRoute {
  routeId: string;
  routeName: string;
  departure: BoardingSelection;
  destination: BoardingSelection;
  createdAt: string;
  updatedAt: string;
  /** ホーム画面のMyルートに表示するか。編集画面の星アイコンで切り替える。 */
  pinnedToHome?: boolean;
}

export function loadMyRoutes(): SavedRoute[] {
  if (typeof window === "undefined") return [];
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return [];
    const parsed = JSON.parse(saved);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.error("Failed to load my routes:", e);
    return [];
  }
}

export function saveMyRoutes(routes: SavedRoute[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(routes));
  } catch (e) {
    console.error("Failed to persist my routes:", e);
  }
}

export function createRouteId(): string {
  return Math.random().toString(36).substring(2, 9);
}
