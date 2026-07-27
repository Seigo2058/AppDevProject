"use client";

import { useCallback, useEffect, useState } from "react";
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
import RouteSearchForm from "./components/RouteSearchForm";
import DateTimePickerSheet, { TimeMode } from "./components/DateTimePickerSheet";
import MyRouteRow from "./components/MyRouteRow";
import RouteResultCard from "./components/RouteResultCard";
import RouteDetailView from "./components/RouteDetailView";

export default function RoutesPage() {
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
    const now = new Date();
    setTargetDate(
      `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`
    );
    setTargetTime(
      `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`
    );

    setMyRoutes(loadMyRoutes());

    getCsvCoverageStops().then((stops) => {
      const campusStops = ["情報大学前", "eDCタワー前"];
      setCsvCoverageStops([
        ...campusStops,
        ...stops.filter((s) => !campusStops.includes(s)),
      ]);
    });
    getStopAgencyNames().then((map) => setStopAgencyNames(Object.fromEntries(map)));
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
                className="text-[13px] font-bold text-[#8dc753] transition-opacity hover:opacity-70 active:opacity-60"
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
                    key={route.routeId}
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
