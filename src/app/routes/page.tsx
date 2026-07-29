"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ChevronLeft, Loader2 } from "lucide-react";
import LocationSearchModal, { LocationSearchResult } from "@/components/search/LocationSearchModal";
import { getCsvCoverageStops, getStopAgencyNames } from "@/lib/tripGraph";
import { findCsvStopNameByEndpoint, canonicalStopName } from "@/lib/stopRegistry";
import {
  searchRoutes,
  searchNextAvailableRoutes,
  getDayType,
  timeToMinutes,
  minutesToTime,
  SearchResultJourney,
} from "@/lib/generalRouteSearch";
import type { BoardingSelection } from "@/lib/schedule";
import { createRouteId, loadMyRoutes, saveMyRoutes, SavedRoute } from "@/lib/myRoutes";
import { TAB_ROOT_RESET_EVENT } from "@/components/BottomNav";
import RouteSearchForm from "./components/RouteSearchForm";
import DateTimePickerSheet, { TimeMode } from "./components/DateTimePickerSheet";
import MyRouteRow from "./components/MyRouteRow";
import RouteResultCard from "./components/RouteResultCard";
import RouteDetailView from "./components/RouteDetailView";

// タブを移動して戻ってきたときに、検索結果や開いていた画面を復元するための保存キー。
// sessionStorage なのでブラウザタブを閉じれば消える。
const VIEW_STATE_KEY = "routes_view_state";

interface RoutesViewState {
  view: "list" | "results" | "detail";
  departure: BoardingSelection | null;
  destination: BoardingSelection | null;
  targetDate: string;
  targetTime: string;
  timeMode: TimeMode;
  searchResults: SearchResultJourney[];
  selectedJourney: SearchResultJourney | null;
  detailOrigin: "list" | "results";
  searchDeparture: BoardingSelection | null;
  searchDestination: BoardingSelection | null;
  searchDayType: "平日" | "土日・祝";
}

function RoutesPageContent() {
  // ホームのMyルートから ?routeId= 付きで来た場合は、そのルートの詳細を直接開く
  const requestedRouteId = useSearchParams().get("routeId");
  const autoOpenedRouteId = useRef<string | null>(null);

  // 復元した検索結果をそのまま見せるため、初回の自動再検索を1度だけ飛ばす
  const skipAutoSearch = useRef(false);
  // 復元処理は1回だけ（開発時のStrictModeによる二重実行で、保存し直した内容を読み戻さないため）
  const restoreStarted = useRef(false);
  const savedState = useRef<RoutesViewState | null>(null);
  // 復元が終わるまでは保存しない（初期状態で上書きしてしまうのを防ぐ）
  const [restoreDone, setRestoreDone] = useState(false);

  const [view, setView] = useState<"list" | "results" | "detail">("list");

  const [myRoutes, setMyRoutes] = useState<SavedRoute[]>([]);
  const [routeTrips, setRouteTrips] = useState<Record<string, SearchResultJourney | null>>({});
  const [isEditingRoutes, setIsEditingRoutes] = useState(false);

  const [departure, setDeparture] = useState<BoardingSelection | null>(null);
  const [destination, setDestination] = useState<BoardingSelection | null>(null);
  const [targetDate, setTargetDate] = useState("");
  const [targetTime, setTargetTime] = useState("");
  const [timeMode, setTimeMode] = useState<TimeMode>("now");
  const [isPickerOpen, setIsPickerOpen] = useState(false);

  const [searchResults, setSearchResults] = useState<SearchResultJourney[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [selectedJourney, setSelectedJourney] = useState<SearchResultJourney | null>(null);
  // 詳細画面の戻り先。マイルートから直接開いた場合は一覧に戻す。
  const [detailOrigin, setDetailOrigin] = useState<"list" | "results">("results");

  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [searchingField, setSearchingField] = useState<"departure" | "destination" | null>(null);
  const [csvCoverageStops, setCsvCoverageStops] = useState<string[]>([]);
  const [stopAgencyNames, setStopAgencyNames] = useState<Record<string, string>>({});

  // 「前の便/次の便」で検索条件を引き継ぐため、検索実行時の条件を保持する
  const [searchDeparture, setSearchDeparture] = useState<BoardingSelection | null>(null);
  const [searchDestination, setSearchDestination] = useState<BoardingSelection | null>(null);
  const [searchDayType, setSearchDayType] = useState<"平日" | "土日・祝">("平日");

  useEffect(() => {
    // 別タブから戻ってきたときは、前回の検索条件・検索結果・開いていた画面を復元する。
    // ?routeId= 付きで来た場合はそのルートの詳細を開くのが目的なので復元しない。
    // 読み込みは1回だけ行い、結果をrefに持つ（StrictModeでこのeffectが2回走っても同じ結果になるようにする）。
    if (!restoreStarted.current) {
      restoreStarted.current = true;
      if (!requestedRouteId) {
        try {
          const raw = sessionStorage.getItem(VIEW_STATE_KEY);
          savedState.current = raw ? (JSON.parse(raw) as RoutesViewState) : null;
        } catch (e) {
          console.error("Failed to restore routes view state:", e);
        }
      }
    }

    const saved = savedState.current;
    const now = new Date();
    const nowDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    const nowTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

    setTargetDate(saved?.targetDate || nowDate);
    setTargetTime(saved?.targetTime || nowTime);

    if (saved) {
      setView(saved.view);
      setDeparture(saved.departure);
      setDestination(saved.destination);
      setTimeMode(saved.timeMode);
      setSearchResults(saved.searchResults);
      setSelectedJourney(saved.selectedJourney);
      setDetailOrigin(saved.detailOrigin);
      setSearchDeparture(saved.searchDeparture);
      setSearchDestination(saved.searchDestination);
      setSearchDayType(saved.searchDayType);
      // 復元直後は結果があるので、条件変更による自動再検索を1回だけ抑止する
      skipAutoSearch.current = saved.view === "results" && saved.searchResults.length > 0;
    }
    setRestoreDone(true);

    setMyRoutes(loadMyRoutes());

    getCsvCoverageStops().then((stops) => {
      const campusStops = ["情報大学前", "eDCタワー前"];
      setCsvCoverageStops([
        ...campusStops,
        ...stops.filter((s) => !campusStops.includes(s)),
      ]);
    });
    getStopAgencyNames().then((map) => setStopAgencyNames(Object.fromEntries(map)));
    // requestedRouteId はマウント時の値だけ見れば足りる（?routeId= の変化は別のeffectが処理する）
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 登録済みマイルートそれぞれの直近の便を取得する(本日終了時は翌日の便)
  useEffect(() => {
    if (myRoutes.length === 0) return;

    myRoutes.forEach(async (route) => {
      if (routeTrips[route.routeId] !== undefined) return;
      try {
        const results = await searchNextAvailableRoutes(
          route.departure,
          route.destination
        );
        setRouteTrips((prev) => ({
          ...prev,
          [route.routeId]: results.length > 0 ? results[0] : null,
        }));
      } catch (e) {
        console.error(`Failed to fetch trip for route ${route.routeId}:`, e);
        setRouteTrips((prev) => ({ ...prev, [route.routeId]: null }));
      }
    });
  }, [myRoutes, routeTrips]);

  // 画面の状態が変わるたびに保存しておき、タブを移動して戻ったときに復元できるようにする
  useEffect(() => {
    if (!restoreDone) return;
    const snapshot: RoutesViewState = {
      view,
      departure,
      destination,
      targetDate,
      targetTime,
      timeMode,
      searchResults,
      selectedJourney,
      detailOrigin,
      searchDeparture,
      searchDestination,
      searchDayType,
    };
    try {
      sessionStorage.setItem(VIEW_STATE_KEY, JSON.stringify(snapshot));
    } catch (e) {
      console.error("Failed to persist routes view state:", e);
    }
  }, [
    restoreDone,
    view,
    departure,
    destination,
    targetDate,
    targetTime,
    timeMode,
    searchResults,
    selectedJourney,
    detailOrigin,
    searchDeparture,
    searchDestination,
    searchDayType,
  ]);

  const persistRoutes = (routes: SavedRoute[]) => {
    setMyRoutes(routes);
    saveMyRoutes(routes);
  };

  const handleSearchSelect = (result: LocationSearchResult) => {
    setIsSearchModalOpen(false);
    const csvStopName = findCsvStopNameByEndpoint(result.endpoint);

    let nextSelection: BoardingSelection;
    if (csvStopName) {
      nextSelection = { source: "csv", name: csvStopName };
    } else if (result.endpoint) {
      nextSelection = { source: "transit", id: result.endpoint, name: result.name };
    } else {
      nextSelection = { source: "csv", name: result.name };
    }

    if (searchingField === "departure") setDeparture(nextSelection);
    else if (searchingField === "destination") setDestination(nextSelection);
    setSearchingField(null);
  };

  // 現在の検索条件(出発地・目的地・日時)で経路を検索する
  const runSearch = useCallback(async () => {
    if (!departure || !destination) return;

    setSearchLoading(true);
    setSearchError("");
    setSearchDeparture(departure);
    setSearchDestination(destination);

    try {
      const dateObj = new Date(`${targetDate}T00:00:00`);
      const dayType = getDayType(isNaN(dateObj.getTime()) ? new Date() : dateObj);
      setSearchDayType(dayType);

      const results = await searchRoutes(
        departure,
        destination,
        targetTime,
        timeMode === "arrival" ? "arrival" : "departure",
        dayType
      );
      setSearchResults(results);
    } catch (e) {
      setSearchError(e instanceof Error ? e.message : "検索中にエラーが発生しました");
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  }, [departure, destination, targetDate, targetTime, timeMode]);

  const handleSearch = () => {
    if (!departure || !destination) {
      setSearchError("出発地と目的地を入力してください");
      return;
    }
    setView("results");
  };

  // 検索結果画面では、検索条件(経路・時刻)が変更されたら自動的に再検索する
  useEffect(() => {
    if (view !== "results") return;
    if (!departure || !destination) return;
    // 復元直後は保存済みの結果を表示したままにする（重い再検索を避ける）
    if (skipAutoSearch.current) {
      skipAutoSearch.current = false;
      return;
    }
    runSearch();
  }, [view, departure, destination, runSearch]);

  const handleRegisterRoute = () => {
    if (!searchDeparture || !searchDestination) return;

    const newRoute: SavedRoute = {
      routeId: createRouteId(),
      routeName: `${searchDeparture.name} → ${searchDestination.name}`,
      departure: searchDeparture,
      destination: searchDestination,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      pinnedToHome: true,
    };

    persistRoutes([...myRoutes, newRoute]);
    setRouteTrips((prev) => {
      const next = { ...prev };
      delete next[newRoute.routeId];
      return next;
    });
    setView("list");
  };

  // マイルートのカードから、その経路の直近の便の詳細を直接開く
  const handleOpenMyRoute = async (route: SavedRoute) => {
    setDeparture(route.departure);
    setDestination(route.destination);
    setSearchDeparture(route.departure);
    setSearchDestination(route.destination);
    setDetailOrigin("list");
    setSearchError("");

    const now = new Date();
    const dayType = getDayType(now);
    setSearchDayType(dayType);

    const cached = routeTrips[route.routeId];
    if (cached) {
      setSelectedJourney(cached);
      setView("detail");
      return;
    }

    // 直近の便がまだ取得できていない場合はこの場で検索してから詳細を開く
    setSelectedJourney(null);
    setSearchLoading(true);
    setView("detail");
    try {
      const results = await searchNextAvailableRoutes(
        route.departure,
        route.destination,
        now
      );
      if (results.length > 0) {
        setSelectedJourney(results[0]);
        setRouteTrips((prev) => ({ ...prev, [route.routeId]: results[0] }));
      } else {
        setSearchError("利用可能な便が見つかりません");
      }
    } catch (e) {
      setSearchError(e instanceof Error ? e.message : "検索中にエラーが発生しました");
    } finally {
      setSearchLoading(false);
    }
  };

  // メニューバーで表示中の「ルート」タブをもう一度押されたら、検索結果や詳細を閉じてトップに戻す
  useEffect(() => {
    const handleTabReset = (event: Event) => {
      if ((event as CustomEvent<string>).detail !== "/routes") return;
      setView("list");
      setSelectedJourney(null);
      setSearchError("");
    };
    window.addEventListener(TAB_ROOT_RESET_EVENT, handleTabReset);
    return () => window.removeEventListener(TAB_ROOT_RESET_EVENT, handleTabReset);
  }, []);

  // ?routeId= 付きで開かれたら、マイルートの読み込みを待って該当ルートの詳細を開く。
  // 同じ画面で2回開かないよう、一度処理したidを覚えておく。
  useEffect(() => {
    if (!requestedRouteId) return;
    if (autoOpenedRouteId.current === requestedRouteId) return;
    const route = myRoutes.find((r) => r.routeId === requestedRouteId);
    if (!route) return;
    autoOpenedRouteId.current = requestedRouteId;
    // URL（＝外部の状態）に追従して詳細を開く処理なので、effect から呼ぶ必要がある
    // eslint-disable-next-line react-hooks/set-state-in-effect
    handleOpenMyRoute(route);
    // handleOpenMyRoute は毎回作り直される関数のため依存に入れない（入れると開き直しが起きる）
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestedRouteId, myRoutes]);

  const handleDeleteRoute = (routeId: string) => {
    persistRoutes(myRoutes.filter((r) => r.routeId !== routeId));
    setRouteTrips((prev) => {
      const next = { ...prev };
      delete next[routeId];
      return next;
    });
  };

  const handleTogglePin = (routeId: string) => {
    persistRoutes(
      myRoutes.map((r) =>
        r.routeId === routeId
          ? { ...r, pinnedToHome: !r.pinnedToHome, updatedAt: new Date().toISOString() }
          : r
      )
    );
  };

  // 選択中の便の前後の便へ移動する
  const handleShiftTrip = async (direction: "previous" | "next") => {
    if (!selectedJourney || !searchDeparture || !searchDestination) return;
    setSearchLoading(true);

    try {
      const baseMins = timeToMinutes(selectedJourney.departureTime);
      const results = await searchRoutes(
        searchDeparture,
        searchDestination,
        minutesToTime(direction === "previous" ? baseMins - 1 : baseMins + 1),
        direction === "previous" ? "arrival" : "departure",
        searchDayType
      );
      if (results.length > 0) setSelectedJourney(results[0]);
    } catch (e) {
      console.error(e);
    } finally {
      setSearchLoading(false);
    }
  };

  const getRemainingTimeText = (departureTime: string, isNextDay?: boolean): string => {
    const now = new Date();
    // 翌日の便は24時間を加算して残り時間を算出する
    const diff =
      timeToMinutes(departureTime) -
      (now.getHours() * 60 + now.getMinutes()) +
      (isNextDay ? 24 * 60 : 0);
    if (diff < 0) return "運行終了";
    if (diff < 60) return `${diff}分`;
    return `${Math.floor(diff / 60)}:${String(diff % 60).padStart(2, "0")}`;
  };

  const isSelectedRouteRegistered = () => {
    if (!searchDeparture || !searchDestination) return false;
    return myRoutes.some(
      (r) =>
        canonicalStopName(r.departure.name) === canonicalStopName(searchDeparture.name) &&
        canonicalStopName(r.destination.name) === canonicalStopName(searchDestination.name)
    );
  };

  const searchForm = (
    <RouteSearchForm
      departure={departure}
      destination={destination}
      date={targetDate}
      time={targetTime}
      mode={timeMode}
      onPickLocation={(field) => {
        setSearchingField(field);
        setIsSearchModalOpen(true);
      }}
      onSwap={() => {
        setDeparture(destination);
        setDestination(departure);
      }}
      onOpenTimePicker={() => setIsPickerOpen(true)}
      onSearch={view === "list" ? handleSearch : undefined}
    />
  );

  return (
    <div className="relative min-h-full bg-[#eee] px-4 pt-4 pb-8 text-black">
      {view === "list" && (
        <div className="flex flex-col gap-6">
          <h1 className="text-2xl font-bold text-black">ルート検索</h1>

          {searchForm}
          {searchError && <p className="text-xs text-red-600">{searchError}</p>}

          <section className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-black">MYルート</h2>
              <button
                type="button"
                onClick={() => setIsEditingRoutes((prev) => !prev)}
                className="text-[13px] font-bold text-[#a0e25e] transition-opacity hover:opacity-70 active:opacity-60"
              >
                {isEditingRoutes ? "完了" : "ホームに追加・編集"}
              </button>
            </div>

            {myRoutes.length === 0 ? (
              <div className="flex h-[90px] items-center justify-center rounded-lg bg-[#fafafa] text-xs text-black/50">
                登録されたマイルートがありません。
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {myRoutes.map((route) => (
                  <MyRouteRow
                    key={`${route.routeId}-${isEditingRoutes}`}
                    route={route}
                    trip={routeTrips[route.routeId]}
                    remainingLabel={
                      routeTrips[route.routeId]
                        ? getRemainingTimeText(
                            routeTrips[route.routeId]!.departureTime,
                            routeTrips[route.routeId]!.isNextDay
                          )
                        : "-"
                    }
                    editing={isEditingRoutes}
                    onOpen={() => handleOpenMyRoute(route)}
                    onDelete={() => handleDeleteRoute(route.routeId)}
                    onTogglePin={() => handleTogglePin(route.routeId)}
                  />
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {view === "results" && (
        <div className="flex flex-col gap-4">
          <button
            type="button"
            onClick={() => setView("list")}
            className="flex items-center gap-2 text-black active:opacity-60"
          >
            <ChevronLeft size={22} />
            <span className="text-base font-bold">ルート検索</span>
          </button>

          {searchForm}

          <div className="mt-4 flex flex-col gap-2">
            {searchLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 size={28} className="animate-spin text-[#a0e25e]" />
              </div>
            ) : searchError ? (
              <p className="text-xs text-red-600">{searchError}</p>
            ) : searchResults.length === 0 ? (
              <p className="py-8 text-center text-xs text-black/50">
                条件に合う経路が見つかりませんでした。
              </p>
            ) : (
              searchResults.map((journey, index) => (
                <RouteResultCard
                  key={`${journey.departureTime}-${journey.arrivalTime}-${index}`}
                  journey={journey}
                  onClick={() => {
                    setSelectedJourney(journey);
                    setDetailOrigin("results");
                    setView("detail");
                  }}
                />
              ))
            )}
          </div>
        </div>
      )}

      {view === "detail" && !selectedJourney && (
        <div className="flex flex-col gap-4">
          <button
            type="button"
            onClick={() => setView(detailOrigin)}
            aria-label="戻る"
            className="flex size-8 items-center justify-center text-black active:opacity-60"
          >
            <ChevronLeft size={22} />
          </button>
          {searchLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={28} className="animate-spin text-[#a0e25e]" />
            </div>
          ) : (
            <p className="py-8 text-center text-xs text-black/50">
              {searchError || "経路を表示できませんでした。"}
            </p>
          )}
        </div>
      )}

      {view === "detail" && selectedJourney && (
        <RouteDetailView
          journey={selectedJourney}
          isRegistered={isSelectedRouteRegistered()}
          isPaging={searchLoading}
          onBack={() => setView(detailOrigin)}
          onPreviousTrip={() => handleShiftTrip("previous")}
          onNextTrip={() => handleShiftTrip("next")}
          onRegister={handleRegisterRoute}
        />
      )}

      <LocationSearchModal
        isOpen={isSearchModalOpen}
        onClose={() => {
          setIsSearchModalOpen(false);
          setSearchingField(null);
        }}
        onSelect={handleSearchSelect}
        placeholder={searchingField === "departure" ? "出発地を検索（例：札幌）" : "目的地を検索（例：情報大学前）"}
        pinned={csvCoverageStops}
        pinnedLabel="よく使う乗り場"
        pinnedAgencyNames={stopAgencyNames}
      />

      <DateTimePickerSheet
        open={isPickerOpen}
        date={targetDate}
        time={targetTime}
        mode={timeMode}
        onCancel={() => setIsPickerOpen(false)}
        onConfirm={({ date, time, mode }) => {
          setTargetDate(date);
          setTargetTime(time);
          setTimeMode(mode);
          setIsPickerOpen(false);
        }}
      />
    </div>
  );
}

export default function RoutesPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-full items-center justify-center bg-[#eee]">
          <Loader2 size={28} className="animate-spin text-[#a0e25e]" />
        </div>
      }
    >
      <RoutesPageContent />
    </Suspense>
  );
}
