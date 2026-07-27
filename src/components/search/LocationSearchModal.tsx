"use client";

import { useEffect, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  X,
  TrainFront,
  BusFront,
  MapPin,
  Plane,
  Building2,
  School,
  Trees,
  Hospital,
  Stethoscope,
  Shield,
  Landmark,
  Baby,
  Library,
  UtensilsCrossed,
  Beer,
  Clapperboard,
  SquareParking,
} from "lucide-react";
import { suggestPlaces, PlaceSuggestion } from "@/lib/transitApi";
import { findCsvStopNameByEndpoint } from "@/lib/stopRegistry";

// TransitAPIのdescriptionはOSMタグ由来の自由テキスト（固定の列挙型ではない）。
// "type"や"type / 運営元"の形式で返ってくるため、"/"より前の種別部分だけを見て
// 対応するアイコンを引く。ここに無い種別はBusFront（既定の停留所アイコン）にフォールバックする。
const POI_ICONS: Record<string, LucideIcon> = {
  "施設": Building2,
  school: School,
  park: Trees,
  hospital: Hospital,
  doctors: Stethoscope,
  police: Shield,
  townhall: Landmark,
  kindergarten: Baby,
  library: Library,
  restaurant: UtensilsCrossed,
  pub: Beer,
  cinema: Clapperboard,
  parking: SquareParking,
};

// TransitAPIには"空港"専用のkindが無く、station/placeのどちらでも返ってくるため、
// 名称に「空港」を含む、またはOSM由来の説明が"aerodrome"の場合を空港として扱う。
// TransitAPIは同じ駅でも事業者・路線ごとに別エントリを返す（JRの駅と地下鉄駅、バス停等）。
// 名前だけでは区別が付かず、以前は候補が全て同じ表記に見えてしまっていたため、
// 事業者情報(feedName、またはOSM由来ならdescriptionの"駅 / 事業者名"表記)を
// 元に「JR札幌駅」「バス停 大麻駅」のような表示用ラベルを組み立てる。
// なお、これは表示専用でありPlaceSuggestion.name自体は変更しない
// （onSelectで渡す実際の地点名は既存の駅名表記のまま保つ必要があるため）。
function getPlaceDisplayLabel(place: PlaceSuggestion): string {
  const needsStationSuffix = place.kind === "station" && !place.name.endsWith("駅");
  const displayName = needsStationSuffix ? `${place.name}駅` : place.name;

  if (place.kind === "stop") {
    return `バス停 ${displayName}`;
  }
  if (place.feedName) {
    if (place.feedName.startsWith("JR")) return `JR${displayName}`;
    if (place.feedName.includes("地下鉄")) return `地下鉄${displayName}`;
    // 私鉄・他事業者: 路線名等の詳細（括弧書き）を省いた事業者名のみを前置する
    const operatorLabel = place.feedName.split(/[\s（(]/)[0];
    return `${operatorLabel} ${displayName}`;
  }
  // OSM由来のエントリは事業者情報がdescriptionに"駅 / 事業者名"の形で入っていることがある
  const osmOperatorMatch = place.description?.match(/^駅\s*\/\s*(.+)/);
  if (osmOperatorMatch) {
    return `${osmOperatorMatch[1]} ${displayName}`;
  }
  return displayName;
}

function getPlaceIcon(place: PlaceSuggestion): LucideIcon {
  const isAirport = place.name.includes("空港") || place.description === "aerodrome";
  if (isAirport) return Plane;
  if (place.kind === "station") return TrainFront;
  const poiType = place.description?.split("/")[0]?.trim();
  if (poiType && poiType in POI_ICONS) return POI_ICONS[poiType];
  return BusFront;
}

export interface LocationSearchResult {
  name: string;
  endpoint?: string; // TransitAPI由来の場合のみセットされる（駅ID or geo:lat,lon）
  kind?: PlaceSuggestion["kind"];
}

interface LocationSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (result: LocationSearchResult) => void;
  initialValue?: string;
  placeholder?: string;
  pinned?: string[];
  pinnedLabel?: string;
  pinnedAgencyNames?: Record<string, string>;
}

export default function LocationSearchModal({
  isOpen,
  onClose,
  onSelect,
  initialValue = "",
  placeholder = "駅名・停留所名で検索",
  pinned = [],
  pinnedLabel = "よく使う乗り場",
  pinnedAgencyNames = {},
}: LocationSearchModalProps) {
  const [keyword, setKeyword] = useState(initialValue);
  const [results, setResults] = useState<PlaceSuggestion[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    function syncKeyword() {
      if (isOpen) setKeyword(initialValue);
    }
    syncKeyword();
  }, [isOpen, initialValue]);

  useEffect(() => {
    function resetIfEmpty() {
      if (!keyword.trim()) {
        setResults([]);
        return true;
      }
      return false;
    }

    if (!isOpen || resetIfEmpty()) return;

    function startSearching() {
      setIsSearching(true);
    }
    startSearching();

    const timer = setTimeout(async () => {
      const matched = await suggestPlaces(keyword);
      setResults(matched);
      setIsSearching(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [keyword, isOpen]);

  if (!isOpen) return null;

  const showPinned = keyword.trim() === "" && pinned.length > 0;

  return (
    <div className="fixed inset-0 z-[60] bg-black/40 flex flex-col">
      <div className="bg-[#eee] flex flex-col flex-1 pt-[env(safe-area-inset-top)] overflow-hidden">
        <div className="flex items-center gap-3 px-4 pt-4 pb-2 shrink-0">
          <button
            onClick={onClose}
            aria-label="閉じる"
            className="p-2 -ml-2 rounded-full text-gray-500 hover:bg-black/5 active:bg-black/10 transition-colors shrink-0"
          >
            <X className="w-6 h-6" />
          </button>
          <div className="flex-1 bg-white rounded-lg">
            <input
              type="text"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder={placeholder}
              autoFocus
              className="w-full h-[44px] px-3 rounded-lg text-sm text-black placeholder-gray-400 focus:outline-none"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {showPinned ? (
            <div>
              <p className="px-4 pt-3 pb-1 text-xs font-bold text-gray-500">{pinnedLabel}</p>
              <ul>
                {pinned.map((name, idx) => (
                  <li key={name} className={idx > 0 ? "border-t border-gray-300" : ""}>
                    <button
                      onClick={() => onSelect({ name })}
                      className="w-full text-left px-4 py-3 flex items-center gap-2.5 hover:bg-black/5 active:bg-black/10 transition-colors"
                    >
                      <MapPin className="w-6 h-6 text-gray-500 shrink-0" />
                      <div className="flex flex-col gap-0.5 min-w-0">
                        <span className="text-[13px] font-medium text-black truncate">{name}</span>
                        {pinnedAgencyNames[name] && (
                          <span className="text-[10px] text-gray-400 truncate">{pinnedAgencyNames[name]}</span>
                        )}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : keyword.trim() === "" ? (
            <div className="text-center py-12 px-4">
              <p className="text-gray-400 font-bold text-sm">
                調べたい駅名や停留所名を
                <br />
                入力してください
              </p>
            </div>
          ) : isSearching ? (
            <div className="text-center py-8 text-gray-400 text-sm font-bold animate-pulse">検索中...</div>
          ) : results.length > 0 ? (
            <ul>
              {/* CSV路線網に登録済みの駅・停留所（=独自時刻表データを持つ地点）を先頭に
                  並べ替える。地点ID(endpoint)での厳密一致のため、表記ゆれの影響を受けない。
                  Array.prototype.sortは安定ソートなので、それぞれのグループ内の順序は
                  TransitAPI側のスコア順のまま保たれる。 */}
              {[...results]
                .sort((a, b) => {
                  const aIsCsv = findCsvStopNameByEndpoint(a.endpoint) !== null;
                  const bIsCsv = findCsvStopNameByEndpoint(b.endpoint) !== null;
                  return aIsCsv === bIsCsv ? 0 : aIsCsv ? -1 : 1;
                })
                .map((place, idx) => {
                  const isCsvStop = findCsvStopNameByEndpoint(place.endpoint) !== null;
                  const PlaceIcon = isCsvStop ? MapPin : getPlaceIcon(place);
                  return (
                    <li key={place.id} className={idx > 0 ? "border-t border-gray-300" : ""}>
                      <button
                        onClick={() => onSelect({ name: place.name, endpoint: place.endpoint, kind: place.kind })}
                        className="w-full text-left px-4 py-3 flex items-center gap-2.5 hover:bg-black/5 active:bg-black/10 transition-colors"
                      >
                        <PlaceIcon className="w-6 h-6 text-gray-700 shrink-0" />
                        <div className="flex flex-col gap-1 min-w-0">
                          <p className="text-[13px] font-medium text-black truncate">{place.name}</p>
                          {(place.description || place.nameKana) && (
                            <p className="text-[11px] text-gray-600 truncate">
                              {place.description || place.nameKana}
                            </p>
                          )}
                        </div>
                      </button>
                    </li>
                  );
                })}
            </ul>
          ) : (
            <div className="text-center py-10 px-4">
              <p className="text-gray-500 font-bold text-sm">該当する駅・停留所が見つかりません</p>
              <p className="text-gray-400 text-xs mt-1">別のキーワードでお試しください</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
