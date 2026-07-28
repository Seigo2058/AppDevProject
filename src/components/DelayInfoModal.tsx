"use client";

import { BusFront, ChevronLeft } from "lucide-react";
import { getAgencyColor } from "@/lib/agencyColors";

interface DelayInfoModalProps {
  open: boolean;
  onClose: () => void;
}

// 交通事業者ごとの運行・遅延情報ページ。アイコン色は agencyColors に集約している。
const AGENCIES = [
  { label: "JR北海道バス", href: "https://unkou-jhb.buskita.com/" },
  { label: "北海道中央バス", href: "https://www.chuo-bus.co.jp/support/stop/" },
  { label: "JR北海道", href: "https://www3.jrhokkaido.co.jp/webunkou/" },
  { label: "札幌市営地下鉄", href: "https://operationstatus.city.sapporo.jp/unkojoho/" },
];

export default function DelayInfoModal({ open, onClose }: DelayInfoModalProps) {
  if (!open) return null;

  return (
    // 画面全体（下部アクションバー・タブバーを含む）を覆う。Figmaでは #8a8a8a 40%。
    <div className="fixed inset-0 z-40 bg-[#8a8a8a]/40">
      {/* 背景タップで閉じる。パネルは上に重ねる。 */}
      <button type="button" aria-label="閉じる" onClick={onClose} className="absolute inset-0 size-full" />

      {/* 下部アクションバーの上に重ねる（Figma準拠のオフセット）。画面が低いときは上端側を詰める。 */}
      <div className="absolute inset-x-3 bottom-[191px] h-[439px] max-h-[calc(100%-207px)] overflow-y-auto rounded-lg bg-[#d9d9d9] px-2 pt-2">
        <button
          type="button"
          onClick={onClose}
          aria-label="戻る"
          className="flex size-6 items-center justify-center text-[#8a8a8a] active:opacity-60"
        >
          <ChevronLeft size={20} strokeWidth={1.5} />
        </button>

        <div className="mt-14 grid grid-cols-2 gap-x-[14px] gap-y-4">
          {AGENCIES.map((agency) => (
            <a
              key={agency.label}
              href={agency.href}
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-[55px] items-center gap-4 rounded-lg bg-white px-4 py-2.5 shadow-[0_2px_6px_rgba(0,0,0,0.06)] transition-colors hover:bg-[#f5f5f5] active:bg-[#ebebeb]"
            >
              <BusFront
                size={35}
                strokeWidth={1.8}
                className="shrink-0"
                style={{ color: getAgencyColor(agency.label) }}
              />
              <span className="text-xs font-bold whitespace-nowrap text-black">{agency.label}</span>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
