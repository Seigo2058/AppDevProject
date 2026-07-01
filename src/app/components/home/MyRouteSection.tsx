import Link from "next/link";
import { Plus } from "lucide-react";
import MyRouteCard from "./MyRouteCard";

export default function MyRouteSection() {
  return (
    <section className="space-y-4">
      <h2 className="text-base font-bold text-black">Myルート</h2>

      <MyRouteCard
        fromName="若葉一丁目"
        toName="北海道情報大学"
        departureTime="12:00"
        arrivalTime="12:20"
        durationMinutes={20}
        remainingLabel="3:00"
        fare={250}
        transferLabel="無"
      />

      <Link
        href="/routes"
        aria-label="ルートを追加"
        className="w-full h-[90px] border-[1.5px] border-dashed border-[#aecb72] rounded-lg flex items-center justify-center active:bg-[#aecb72]/5 transition-colors"
      >
        <span className="flex items-center justify-center size-8 rounded-full bg-[#aecb72] text-white">
          <Plus size={20} />
        </span>
      </Link>
    </section>
  );
}
