"use client";

import { ChevronLeft } from "lucide-react";
import type { SearchResultJourney } from "@/lib/generalRouteSearch";
import RouteJourneyDetail from "@/components/route/RouteJourneyDetail";
import Button from "@/components/ui/Button";
import DetailActionBar from "@/components/DetailActionBar";

interface RouteDetailViewProps {
  journey: SearchResultJourney;
  isRegistered: boolean;
  isPaging: boolean;
  onBack: () => void;
  onPreviousTrip: () => void;
  onNextTrip: () => void;
  onRegister: () => void;
}

export default function RouteDetailView({
  journey,
  isRegistered,
  isPaging,
  onBack,
  onPreviousTrip,
  onNextTrip,
  onRegister,
}: RouteDetailViewProps) {
  return (
    // 下部の固定アクションバーに隠れないよう余白を取る。
    <div className="flex flex-col gap-4 pb-24">
      <button
        type="button"
        onClick={onBack}
        className="flex items-center gap-2 text-black active:opacity-60"
      >
        <ChevronLeft size={22} />
        <span className="text-base font-bold">ルートの詳細</span>
      </button>

      <div className="flex items-center justify-between gap-3">
        <Button variant="secondary" onClick={onPreviousTrip} disabled={isPaging}>
          前の便
        </Button>
        <Button variant="secondary" onClick={onNextTrip} disabled={isPaging}>
          次の便
        </Button>
      </div>

      <RouteJourneyDetail
        segments={journey.segments}
        departureStop={journey.departureStop}
        arrivalStop={journey.arrivalStop}
        departureTime={journey.departureTime}
        arrivalTime={journey.arrivalTime}
        fare={journey.fare}
        transferCount={journey.transferCount}
        durationMinutes={journey.durationMinutes}
      />

      <DetailActionBar
        actionLabel={isRegistered ? "登録済み" : "登録する"}
        onAction={onRegister}
        disabled={isRegistered}
        released={isRegistered}
      />
    </div>
  );
}
