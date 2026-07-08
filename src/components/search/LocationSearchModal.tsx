"use client";

import { useEffect, useState } from "react";
import { X, TrainFront, Bus, MapPin } from "lucide-react";
import { suggestPlaces, PlaceSuggestion } from "@/lib/transitApi";

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
}

export default function LocationSearchModal({
  isOpen,
  onClose,
  onSelect,
  initialValue = "",
  placeholder = "駅名・停留所名で検索",
  pinned = [],
  pinnedLabel = "よく使う乗り場",
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
                      <span className="text-[13px] font-medium text-black">{name}</span>
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
              {results.map((place, idx) => (
                <li key={place.id} className={idx > 0 ? "border-t border-gray-300" : ""}>
                  <button
                    onClick={() => onSelect({ name: place.name, endpoint: place.endpoint, kind: place.kind })}
                    className="w-full text-left px-4 py-3 flex items-center gap-2.5 hover:bg-black/5 active:bg-black/10 transition-colors"
                  >
                    {place.kind === "station" ? (
                      <TrainFront className="w-6 h-6 text-gray-700 shrink-0" />
                    ) : (
                      <Bus className="w-6 h-6 text-gray-700 shrink-0" />
                    )}
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
              ))}
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
