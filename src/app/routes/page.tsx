"use client";

import { useEffect, useState } from "react";
import {
  Search,
  MapPin,
  Clock,
  ArrowRight,
  Loader2,
  ChevronRight,
  Plus,
  ChevronLeft,
  Trash2,
  Calendar,
  Bus,
  TrainFront,
  Footprints,
  Info,
  ExternalLink,
  Edit2,
  Check,
  AlertTriangle,
  X
} from "lucide-react";
import { useRouter } from "next/navigation";
import LocationSearchModal, { LocationSearchResult } from "@/components/search/LocationSearchModal";
import { getCsvCoverageStops } from "@/lib/tripGraph";
import { findCsvStopNameByEndpoint, canonicalStopName } from "@/lib/stopRegistry";
import {
  searchRoutes,
  getDayType,
  timeToMinutes,
  minutesToTime,
  calculateCsvFare,
  timeDifferenceMinutes,
  SearchResultJourney,
  RouteSegmentDetail
} from "@/lib/generalRouteSearch";
import type { BoardingSelection } from "@/lib/schedule";

const ACCENT = "#aecb72";

interface SavedRoute {
  routeId: string;
  routeName: string;
  departure: BoardingSelection;
  destination: BoardingSelection;
  createdAt: string;
  updatedAt: string;
}

export default function RoutesPage() {
  const router = useRouter();

  // Navigation states
  const [view, setView] = useState<"list" | "results" | "detail">("list");

  // Registered My Routes state
  const [myRoutes, setMyRoutes] = useState<SavedRoute[]>([]);
  const [routeTrips, setRouteTrips] = useState<Record<string, SearchResultJourney | null>>({});
  const [loadingTrips, setLoadingTrips] = useState<Record<string, boolean>>({});

  // Input states for new search
  const [departure, setDeparture] = useState<BoardingSelection | null>(null);
  const [destination, setDestination] = useState<BoardingSelection | null>(null);
  const [targetDate, setTargetDate] = useState<string>("");
  const [targetTime, setTargetTime] = useState<string>("");
  const [timeType, setTimeType] = useState<"departure" | "arrival">("departure");

  // Search Results state
  const [searchResults, setSearchResults] = useState<SearchResultJourney[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState("");

  // Selected Journey for Detail view
  const [selectedJourney, setSelectedJourney] = useState<SearchResultJourney | null>(null);

  // States for search inputs of departure/destination
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [searchingField, setSearchingField] = useState<"departure" | "destination" | null>(null);
  const [csvCoverageStops, setCsvCoverageStops] = useState<string[]>([]);

  // Delay info modal state
  const [isDelayModalOpen, setIsDelayModalOpen] = useState(false);

  // Edit route state
  const [editingRouteId, setEditingRouteId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");

  // System/Day parameters stored during search to enable "previous/next" trip updates
  const [searchDeparture, setSearchDeparture] = useState<BoardingSelection | null>(null);
  const [searchDestination, setSearchDestination] = useState<BoardingSelection | null>(null);
  const [searchDayType, setSearchDayType] = useState<"平日" | "土日・祝">("平日");

  // Load registered routes from localStorage
  useEffect(() => {
    function loadSavedRoutes() {
      if (typeof window === "undefined") return;
      try {
        const saved = localStorage.getItem("my_routes");
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) {
            setMyRoutes(parsed);
          }
        }
      } catch (e) {
        console.error("Failed to load saved routes:", e);
      }
    }

    // Set default date and time
    const now = new Date();
    setTargetDate(now.toISOString().split("T")[0]);
    setTargetTime(`${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`);

    loadSavedRoutes();
    getCsvCoverageStops().then((stops) => {
      const campusStops = ["情報大学前", "eDCタワー前"];
      const merged = [
        ...campusStops,
        ...stops.filter((s) => !campusStops.includes(s)),
      ];
      setCsvCoverageStops(merged);
    });
  }, []);

  // Fetch the next available trip for each registered route dynamically
  useEffect(() => {
    if (myRoutes.length === 0) return;

    const now = new Date();
    const currentMins = now.getHours() * 60 + now.getMinutes();
    const timeStr = minutesToTime(currentMins);
    const dayType = getDayType(now);

    myRoutes.forEach(async (route) => {
      // Avoid refetching if already loading or loaded
      if (routeTrips[route.routeId] !== undefined || loadingTrips[route.routeId]) return;

      setLoadingTrips((prev) => ({ ...prev, [route.routeId]: true }));
      try {
        const results = await searchRoutes(
          route.departure,
          route.destination,
          timeStr,
          "departure",
          dayType
        );
        setRouteTrips((prev) => ({
          ...prev,
          [route.routeId]: results.length > 0 ? results[0] : null
        }));
      } catch (e) {
        console.error(`Failed to fetch trip for route ${route.routeId}:`, e);
        setRouteTrips((prev) => ({ ...prev, [route.routeId]: null }));
      } finally {
        setLoadingTrips((prev) => ({ ...prev, [route.routeId]: false }));
      }
    });
  }, [myRoutes]);

  const handleOpenSearchModal = (field: "departure" | "destination") => {
    setSearchingField(field);
    setIsSearchModalOpen(true);
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

    if (searchingField === "departure") {
      setDeparture(nextSelection);
    } else if (searchingField === "destination") {
      setDestination(nextSelection);
    }
    setSearchingField(null);
  };

  // Perform route search
  const handleSearch = async () => {
    if (!departure || !destination) {
      setSearchError("出発地と目的地を入力してください");
      return;
    }

    setSearchLoading(true);
    setSearchError("");
    setView("results");

    // Save search context for next/prev paging
    setSearchDeparture(departure);
    setSearchDestination(destination);

    try {
      const dateObj = new Date(targetDate);
      const dayType = getDayType(isNaN(dateObj.getTime()) ? new Date() : dateObj);
      setSearchDayType(dayType);

      const results = await searchRoutes(
        departure,
        destination,
        targetTime,
        timeType,
        dayType
      );

      setSearchResults(results);
    } catch (e: any) {
      setSearchError(e.message || "検索中にエラーが発生しました");
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  };

  // Save route to My Routes
  const handleRegisterRoute = (journey: SearchResultJourney) => {
    if (!searchDeparture || !searchDestination) return;

    const routeNameInput = prompt(
      "登録するルートの名前を入力してください",
      `${searchDeparture.name} → ${searchDestination.name}`
    );

    if (routeNameInput === null) return; // User cancelled

    const routeName = routeNameInput.trim() || `${searchDeparture.name} → ${searchDestination.name}`;
    const newRoute: SavedRoute = {
      routeId: Math.random().toString(36).substring(2, 9),
      routeName,
      departure: searchDeparture,
      destination: searchDestination,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const updatedRoutes = [...myRoutes, newRoute];
    setMyRoutes(updatedRoutes);
    localStorage.setItem("my_routes", JSON.stringify(updatedRoutes));

    // Force trip fetch for the new route
    setRouteTrips((prev) => {
      const next = { ...prev };
      delete next[newRoute.routeId];
      return next;
    });

    alert("マイルートに登録しました");
  };

  const handleUnregisterRoute = (routeId: string) => {
    if (!confirm("このルートをマイルートから削除しますか？")) return;

    const updated = myRoutes.filter((r) => r.routeId !== routeId);
    setMyRoutes(updated);
    localStorage.setItem("my_routes", JSON.stringify(updated));

    setRouteTrips((prev) => {
      const next = { ...prev };
      delete next[routeId];
      return next;
    });
  };

  const handleStartRename = (route: SavedRoute) => {
    setEditingRouteId(route.routeId);
    setEditingName(route.routeName);
  };

  const handleSaveRename = (routeId: string) => {
    const updated = myRoutes.map((r) => {
      if (r.routeId === routeId) {
        return { ...r, routeName: editingName, updatedAt: new Date().toISOString() };
      }
      return r;
    });
    setMyRoutes(updated);
    localStorage.setItem("my_routes", JSON.stringify(updated));
    setEditingRouteId(null);
  };

  // Go to previous trip
  const handlePreviousTrip = async () => {
    if (!selectedJourney || !searchDeparture || !searchDestination) return;
    setSearchLoading(true);

    try {
      const prevMins = timeToMinutes(selectedJourney.departureTime) - 1;
      const prevTime = minutesToTime(prevMins);

      const results = await searchRoutes(
        searchDeparture,
        searchDestination,
        prevTime,
        "arrival",
        searchDayType
      );

      if (results.length > 0) {
        // Take the one arriving closest to target (index 0 is sorted latest-arrival first)
        setSelectedJourney(results[0]);
      } else {
        alert("これより前の便は見つかりませんでした");
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSearchLoading(false);
    }
  };

  // Go to next trip
  const handleNextTrip = async () => {
    if (!selectedJourney || !searchDeparture || !searchDestination) return;
    setSearchLoading(true);

    try {
      const nextMins = timeToMinutes(selectedJourney.departureTime) + 1;
      const nextTime = minutesToTime(nextMins);

      const results = await searchRoutes(
        searchDeparture,
        searchDestination,
        nextTime,
        "departure",
        searchDayType
      );

      if (results.length > 0) {
        // Take the one departing closest to target (index 0 is sorted earliest-departure first)
        setSelectedJourney(results[0]);
      } else {
        alert("これより後の便は見つかりませんでした");
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSearchLoading(false);
    }
  };

  // Formatter for remaining time in cards
  const getRemainingTimeText = (departureTime: string): string => {
    const now = new Date();
    const nowMins = now.getHours() * 60 + now.getMinutes();
    const depMins = timeToMinutes(departureTime);
    if (depMins === -1) return "-";
    const diff = depMins - nowMins;

    if (diff < 0) {
      return "運行終了";
    }
    if (diff < 60) {
      return `${diff}分`;
    }
    const hrs = Math.floor(diff / 60);
    const mins = diff % 60;
    return `${hrs}:${String(mins).padStart(2, "0")}`;
  };

  // Segment icon utility
  const getSegmentIcon = (mode: RouteSegmentDetail["mode"]) => {
    if (mode === "train") return <TrainFront size={16} className="text-blue-600" />;
    if (mode === "walk") return <Footprints size={16} className="text-gray-400" />;
    return <Bus size={16} className="text-[#aecb72]" />;
  };

  // Check if current search is already registered
  const isSelectedRouteRegistered = () => {
    if (!searchDeparture || !searchDestination) return false;
    return myRoutes.some(
      (r) =>
        canonicalStopName(r.departure.name) === canonicalStopName(searchDeparture.name) &&
        canonicalStopName(r.destination.name) === canonicalStopName(searchDestination.name)
    );
  };

  // Toggle departure/destination inputs
  const handleSwapLocations = () => {
    const temp = departure;
    setDeparture(destination);
    setDestination(temp);
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-24 text-black">
      {/* Title Header */}
      <div className="bg-white p-4 sticky top-0 z-20 border-b border-gray-100 shadow-sm flex items-center justify-between">
        <div className="flex items-center space-x-2">
          {view !== "list" && (
            <button
              onClick={() => setView(view === "detail" ? "results" : "list")}
              className="p-1 -ml-1 text-gray-500 hover:bg-gray-100 rounded-lg mr-1"
            >
              <ChevronLeft size={20} />
            </button>
          )}
          <h2 className="text-lg font-bold text-gray-800">
            {view === "list" && "マイルート & 経路検索"}
            {view === "results" && "検索結果一覧"}
            {view === "detail" && "経路詳細"}
          </h2>
        </div>
        {view === "detail" && selectedJourney && (
          <button
            onClick={() => setIsDelayModalOpen(true)}
            className="text-xs font-bold text-red-500 border border-red-200 px-3 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 transition-colors flex items-center gap-1"
          >
            <AlertTriangle size={13} />
            運行情報
          </button>
        )}
      </div>

      <div className="max-w-2xl mx-auto p-4 space-y-6">
        {/* VIEW 1: MY ROUTES & ROUTE SEARCH INPUTS */}
        {view === "list" && (
          <>
            {/* My Routes Section */}
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-gray-500 tracking-wider">登録済みマイルート</h3>
                <span className="text-[10px] text-gray-400">現在時刻基準で直近便を表示しています</span>
              </div>

              {myRoutes.length === 0 ? (
                <div className="bg-white border border-gray-100 p-8 rounded-xl text-center shadow-sm">
                  <MapPin className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm text-gray-500 font-medium">登録されているマイルートはありません</p>
                  <p className="text-xs text-gray-400 mt-1">下の経路検索からルートを検索して登録してください</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {myRoutes.map((route) => {
                    const trip = routeTrips[route.routeId];
                    const isLoading = loadingTrips[route.routeId];

                    return (
                      <div
                        key={route.routeId}
                        className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow relative"
                      >
                        <div className="flex justify-between items-start mb-2">
                          {editingRouteId === route.routeId ? (
                            <div className="flex items-center gap-1.5 w-full mr-12">
                              <input
                                type="text"
                                value={editingName}
                                onChange={(e) => setEditingName(e.target.value)}
                                className="border border-gray-300 rounded px-2 py-1 text-xs w-full focus:outline-none focus:border-blue-500"
                                autoFocus
                              />
                              <button
                                onClick={() => handleSaveRename(route.routeId)}
                                className="bg-blue-500 text-white p-1 rounded hover:bg-blue-600"
                              >
                                <Check size={14} />
                              </button>
                            </div>
                          ) : (
                            <div className="min-w-0 pr-12">
                              <h4 className="font-bold text-gray-800 text-sm truncate">{route.routeName}</h4>
                              <p className="text-[10px] text-gray-400 mt-0.5">
                                {route.departure.name} → {route.destination.name}
                              </p>
                            </div>
                          )}

                          <div className="absolute right-4 top-4 flex items-center space-x-1.5">
                            {editingRouteId !== route.routeId && (
                              <button
                                onClick={() => handleStartRename(route)}
                                className="p-1 text-gray-400 hover:text-blue-500 rounded hover:bg-gray-50"
                                title="名前を変更"
                              >
                                <Edit2 size={13} />
                              </button>
                            )}
                            <button
                              onClick={() => handleUnregisterRoute(route.routeId)}
                              className="p-1 text-gray-400 hover:text-red-500 rounded hover:bg-gray-50"
                              title="ルート削除"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>

                        {/* Next trip information */}
                        {isLoading ? (
                          <div className="flex items-center justify-center py-2">
                            <Loader2 size={16} className="animate-spin text-gray-400 mr-2" />
                            <span className="text-xs text-gray-400">直近便を検索中...</span>
                          </div>
                        ) : trip ? (
                          <button
                            onClick={() => {
                              setSearchDeparture(route.departure);
                              setSearchDestination(route.destination);
                              const now = new Date();
                              setSearchDayType(getDayType(now));
                              setSelectedJourney(trip);
                              setView("detail");
                            }}
                            className="w-full text-left bg-gray-50 p-3 rounded-lg border border-gray-100 flex items-center justify-between mt-2 hover:bg-gray-100 transition-colors active:scale-[0.99]"
                          >
                            <div className="flex-1 min-w-0">
                              <div className="flex items-baseline gap-2 flex-wrap">
                                <span className="text-xl font-bold text-gray-900">{trip.departureTime}</span>
                                <span className="text-xl font-bold text-gray-300">-</span>
                                <span className="text-xl font-bold text-gray-900">{trip.arrivalTime}</span>
                                <span className="text-xs text-gray-500">（{trip.durationMinutes}分）</span>
                                <span className="text-[11px] text-gray-600 bg-gray-200/60 px-1.5 py-0.5 rounded font-medium">
                                  残り <span className="font-bold">{getRemainingTimeText(trip.departureTime)}</span>
                                </span>
                              </div>
                              <div className="flex items-center gap-2 mt-1 text-[11px] text-gray-500">
                                <span className="font-bold text-gray-700">{trip.fare}円</span>
                                <span>|</span>
                                <span>乗換 {trip.transferCount > 0 ? `${trip.transferCount}回` : "なし"}</span>
                                <span>|</span>
                                <span className="truncate">{trip.routeName}</span>
                              </div>
                            </div>
                            <ChevronRight size={14} className="text-gray-400 shrink-0 ml-2" />
                          </button>
                        ) : (
                          <p className="text-xs text-gray-400 italic py-2 mt-1">本日の運行は終了、または利用可能な便が見つかりません</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* Route Search Box */}
            <section className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm space-y-4">
              <h3 className="text-sm font-bold text-gray-500 mb-2 flex items-center">
                <Search size={16} className="mr-1 text-blue-500" />
                経路を検索する
              </h3>

              <div className="space-y-3 relative">
                {/* Departure Input */}
                <div className="relative">
                  <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-xs font-bold text-blue-500">出発</span>
                  <button
                    onClick={() => handleOpenSearchModal("departure")}
                    className="w-full text-left pl-12 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm min-h-[46px] hover:bg-gray-100 transition-colors flex items-center justify-between"
                  >
                    <span className={departure ? "text-gray-900 font-bold" : "text-gray-400"}>
                      {departure ? departure.name : "出発地（駅・停留所・住所）を入力"}
                    </span>
                    <MapPin size={16} className="text-gray-400" />
                  </button>
                </div>

                {/* Swap button */}
                <div className="flex justify-center -my-2.5 relative z-10">
                  <button
                    onClick={handleSwapLocations}
                    className="bg-white p-2 rounded-full border border-gray-200 hover:bg-gray-50 transition-colors shadow-sm"
                    title="出発地と目的地を入れ替える"
                  >
                    <ArrowRight size={14} className="text-gray-500 transform rotate-90" />
                  </button>
                </div>

                {/* Destination Input */}
                <div className="relative">
                  <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-xs font-bold text-red-500">到着</span>
                  <button
                    onClick={() => handleOpenSearchModal("destination")}
                    className="w-full text-left pl-12 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm min-h-[46px] hover:bg-gray-100 transition-colors flex items-center justify-between"
                  >
                    <span className={destination ? "text-gray-900 font-bold" : "text-gray-400"}>
                      {destination ? destination.name : "目的地（駅・停留所・住所）を入力"}
                    </span>
                    <MapPin size={16} className="text-gray-400" />
                  </button>
                </div>

                {/* Time Specified Input Area */}
                <div className="grid grid-cols-2 gap-3 pt-2">
                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold text-gray-500 uppercase">日付指定</label>
                    <input
                      type="date"
                      value={targetDate}
                      onChange={(e) => setTargetDate(e.target.value)}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold text-gray-500 uppercase">時刻指定</label>
                    <input
                      type="time"
                      value={targetTime}
                      onChange={(e) => setTargetTime(e.target.value)}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                    />
                  </div>
                </div>

                {/* Type Selection (Departure vs Arrival) */}
                <div className="flex border border-gray-200 rounded-xl overflow-hidden text-xs">
                  <button
                    onClick={() => setTimeType("departure")}
                    className={`flex-1 py-3 text-center font-bold transition-colors ${
                      timeType === "departure" ? "bg-blue-500 text-white" : "bg-white text-gray-500 hover:bg-gray-50"
                    }`}
                  >
                    出発予定時刻
                  </button>
                  <button
                    onClick={() => setTimeType("arrival")}
                    className={`flex-1 py-3 text-center font-bold transition-colors ${
                      timeType === "arrival" ? "bg-blue-500 text-white" : "bg-white text-gray-500 hover:bg-gray-50"
                    }`}
                  >
                    到着予定時刻
                  </button>
                </div>

                {/* Submit Search button */}
                <button
                  onClick={handleSearch}
                  disabled={searchLoading}
                  className="w-full mt-2 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 rounded-xl shadow-sm flex items-center justify-center transition-all active:scale-[0.98] disabled:bg-blue-400 cursor-pointer text-sm"
                >
                  {searchLoading ? (
                    <Loader2 size={18} className="animate-spin mr-2" />
                  ) : (
                    <Search size={18} className="mr-2" />
                  )}
                  検索する
                </button>

                {searchError && <p className="text-xs text-red-500 text-center font-bold">{searchError}</p>}
              </div>
            </section>
          </>
        )}

        {/* VIEW 2: SEARCH RESULTS */}
        {view === "results" && (
          <section className="space-y-4">
            {/* Header info */}
            <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex justify-between items-center text-xs">
              <div>
                <p className="text-gray-500">
                  <span className="font-bold text-gray-700">出発：</span>
                  {searchDeparture?.name}
                </p>
                <p className="text-gray-500 mt-1">
                  <span className="font-bold text-gray-700">到着：</span>
                  {searchDestination?.name}
                </p>
              </div>
              <div className="text-right text-gray-500 border-l border-gray-200 pl-4 shrink-0">
                <p className="font-bold text-gray-700">{targetDate}</p>
                <p className="mt-1">
                  {targetTime} {timeType === "departure" ? "出発" : "到着"}指定
                </p>
              </div>
            </div>

            {searchLoading ? (
              <div className="text-center py-16 space-y-3">
                <Loader2 size={36} className="animate-spin text-[#aecb72] mx-auto" />
                <p className="text-sm font-bold text-gray-400">最適な経路を算出しています...</p>
              </div>
            ) : searchResults.length === 0 ? (
              <div className="bg-white p-12 rounded-2xl border border-gray-100 text-center shadow-sm">
                <Info className="w-12 h-12 text-gray-200 mx-auto mb-3" />
                <p className="text-gray-500 font-bold text-sm">条件に一致する便がありません</p>
                <p className="text-xs text-gray-400 mt-1.5">日時を変更するか、別の発着地点をお試しください</p>
                <button
                  onClick={() => setView("list")}
                  className="mt-4 px-4 py-2 border border-gray-200 rounded-lg text-xs font-bold text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  条件を入力し直す
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider pl-1">候補ルート一覧</p>
                {searchResults.map((journey, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setSelectedJourney(journey);
                      setView("detail");
                    }}
                    className="w-full text-left bg-white p-4 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow flex items-center justify-between hover:bg-gray-50/50 active:scale-[0.99] cursor-pointer"
                  >
                    <div className="flex-1 min-w-0 pr-4">
                      <div className="flex items-baseline gap-2 flex-wrap">
                        <span className="text-2xl font-black text-gray-900 leading-none">{journey.departureTime}</span>
                        <span className="text-xl font-bold text-gray-300">-</span>
                        <span className="text-2xl font-black text-gray-900 leading-none">{journey.arrivalTime}</span>
                        <span className="text-xs font-bold text-[#aecb72] bg-[#aecb72]/10 px-2 py-0.5 rounded ml-1">
                          {journey.durationMinutes}分
                        </span>
                      </div>

                      <div className="flex items-center gap-2 mt-2.5 text-xs text-gray-500">
                        <span className="font-bold text-gray-800">{journey.fare}円</span>
                        <span className="text-gray-300">|</span>
                        <span>乗換 {journey.transferCount > 0 ? `${journey.transferCount}回` : "なし"}</span>
                        <span className="text-gray-300">|</span>
                        <span className="truncate font-medium text-gray-600">{journey.routeName}</span>
                      </div>
                    </div>
                    <ChevronRight className="text-gray-400 shrink-0" size={16} />
                  </button>
                ))}
              </div>
            )}
          </section>
        )}

        {/* VIEW 3: ROUTE DETAILS */}
        {view === "detail" && selectedJourney && (
          <section className="space-y-4">
            {/* Summary card */}
            <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm space-y-3">
              <div className="flex justify-between items-baseline">
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-black text-gray-900">{selectedJourney.departureTime}</span>
                  <span className="text-2xl font-bold text-gray-300">-</span>
                  <span className="text-3xl font-black text-gray-900">{selectedJourney.arrivalTime}</span>
                </div>
                <span className="text-xs font-bold text-[#aecb72] bg-[#aecb72]/10 px-2.5 py-1 rounded-full">
                  所要時間 {selectedJourney.durationMinutes}分
                </span>
              </div>
              <div className="flex items-center justify-between text-xs text-gray-500 pt-1.5 border-t border-gray-100">
                <div className="flex items-center gap-3">
                  <span className="font-bold text-gray-800 text-sm">{selectedJourney.fare}円</span>
                  <span className="text-gray-200">|</span>
                  <span>乗換 {selectedJourney.transferCount > 0 ? `${selectedJourney.transferCount}回` : "直通"}</span>
                </div>
                <span className="text-[11px] text-gray-400 font-medium">
                  日付: {targetDate} ({searchDayType})
                </span>
              </div>
            </div>

            {/* Paging Buttons (前の便 / 後の便) */}
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={handlePreviousTrip}
                disabled={searchLoading}
                className="bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 font-bold py-3.5 rounded-xl text-xs shadow-sm flex items-center justify-center gap-1 active:scale-[0.98] transition-all disabled:opacity-50 cursor-pointer"
              >
                {searchLoading ? <Loader2 size={13} className="animate-spin" /> : <ChevronLeft size={16} />}
                前の便
              </button>
              <button
                onClick={handleNextTrip}
                disabled={searchLoading}
                className="bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 font-bold py-3.5 rounded-xl text-xs shadow-sm flex items-center justify-center gap-1 active:scale-[0.98] transition-all disabled:opacity-50 cursor-pointer"
              >
                後の便
                {searchLoading ? <Loader2 size={13} className="animate-spin" /> : <ChevronRight size={16} />}
              </button>
            </div>

            {/* Timeline */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
              <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">乗り換えルート詳細</h4>
              <div className="relative pl-6">
                {/* Vertical line connecting steps */}
                <div className="absolute left-[6px] top-2 bottom-2 w-0.5 bg-gray-200" />

                <div className="space-y-6">
                  {selectedJourney.segments.map((seg, idx) => {
                    const isLast = idx === selectedJourney.segments.length - 1;
                    return (
                      <div key={idx} className="relative space-y-2">
                        {/* Circle dot representing step */}
                        <div
                          className="absolute -left-[24px] top-1 size-3 rounded-full bg-white border-2"
                          style={{ borderColor: ACCENT }}
                        />

                        {/* Step details */}
                        <div className="flex justify-between items-start">
                          <div className="min-w-0 pr-4">
                            <span className="text-xs font-bold text-gray-400">
                              {seg.departureTime}発
                            </span>
                            <h5 className="font-bold text-sm text-gray-800 truncate mt-0.5">
                              {seg.fromStop}
                            </h5>
                          </div>
                        </div>

                        {/* Transition segment */}
                        <div className="bg-gray-50 rounded-xl p-3 border border-gray-100 flex items-center gap-2 text-xs">
                          {getSegmentIcon(seg.mode)}
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-gray-700 truncate">
                              {seg.routeName || (seg.mode === "walk" ? "徒歩" : "バス")}
                            </p>
                            <p className="text-[10px] text-gray-400 mt-0.5">
                              所要時間: {timeDifferenceMinutes(seg.departureTime, seg.arrivalTime)}分
                            </p>
                          </div>
                          <span className="font-bold text-gray-600 shrink-0">
                            {seg.mode === "walk"
                              ? "無料"
                              : `${calculateCsvFare(seg.fromStop, seg.toStop, seg.routeName || "")}円`}
                          </span>
                        </div>

                        {/* Destination point for this leg (only if it is the last segment) */}
                        {isLast && (
                          <div className="relative pt-4">
                            <div
                              className="absolute -left-[24px] top-[22px] size-3 rounded-full bg-white border-2"
                              style={{ borderColor: ACCENT }}
                            />
                            <span className="text-xs font-bold text-gray-400">
                              {seg.arrivalTime}着
                            </span>
                            <h5 className="font-bold text-sm text-gray-800 truncate mt-0.5">
                              {seg.toStop}
                            </h5>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="space-y-2">
              <button
                onClick={() => handleRegisterRoute(selectedJourney)}
                disabled={isSelectedRouteRegistered()}
                className={`w-full py-4 rounded-xl font-bold text-sm shadow-sm flex items-center justify-center gap-2 transition-all active:scale-[0.98] border cursor-pointer ${
                  isSelectedRouteRegistered()
                    ? "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed"
                    : "bg-[#aecb72] hover:bg-[#9cb663] text-white border-[#aecb72]"
                }`}
              >
                <Plus size={16} />
                {isSelectedRouteRegistered() ? "マイルート登録済み" : "このルートをマイルートに登録"}
              </button>

              <button
                onClick={() => setView("results")}
                className="w-full bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 py-3.5 rounded-xl text-xs font-bold shadow-sm flex items-center justify-center gap-1.5 active:scale-[0.98] transition-all cursor-pointer"
              >
                検索結果一覧に戻る
              </button>
            </div>
          </section>
        )}
      </div>

      {/* Modal 1: Location Search Modal */}
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
      />

      {/* Modal 2: Delay/Operation Status Modal */}
      {isDelayModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end justify-center sm:items-center p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-md overflow-hidden shadow-xl animate-in slide-in-from-bottom">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-red-50">
              <div className="flex items-center gap-2 text-red-600 font-bold">
                <AlertTriangle size={18} />
                運行状況リンク一覧
              </div>
              <button
                onClick={() => setIsDelayModalOpen(false)}
                className="p-1 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-full"
              >
                <X size={18} />
              </button>
            </div>
            <div className="p-4 space-y-3">
              <p className="text-xs text-gray-500 leading-relaxed mb-1">
                運行の遅延・運休情報は各交通機関の公式ページよりご確認ください。
              </p>
              <div className="grid grid-cols-1 gap-2.5">
                <a
                  href="https://www3.jrhokkaido.co.jp/webunkou/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between p-3.5 border border-gray-100 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors font-bold text-xs"
                >
                  <span>JR北海道 運行情報</span>
                  <ExternalLink size={14} className="text-gray-400" />
                </a>
                <a
                  href="https://unkou-jhb.buskita.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between p-3.5 border border-gray-100 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors font-bold text-xs"
                >
                  <span>ジェイ・アール北海道バス 運行情報</span>
                  <ExternalLink size={14} className="text-gray-400" />
                </a>
                <a
                  href="https://www.chuo-bus.co.jp/support/stop/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between p-3.5 border border-gray-100 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors font-bold text-xs"
                >
                  <span>北海道中央バス 停留所案内</span>
                  <ExternalLink size={14} className="text-gray-400" />
                </a>
                <a
                  href="https://operationstatus.city.sapporo.jp/unkojoho/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between p-3.5 border border-gray-100 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors font-bold text-xs"
                >
                  <span>札幌市営地下鉄 運行情報</span>
                  <ExternalLink size={14} className="text-gray-400" />
                </a>
              </div>
              <button
                onClick={() => setIsDelayModalOpen(false)}
                className="w-full mt-2 border border-gray-200 text-gray-700 py-3 rounded-xl text-xs font-bold hover:bg-gray-50 active:scale-[0.98] transition-all cursor-pointer"
              >
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
