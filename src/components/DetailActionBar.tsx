"use client";

import { useState } from "react";
import { TriangleAlert } from "lucide-react";
import Button from "@/components/ui/Button";
import DelayInfoModal from "@/components/DelayInfoModal";

/**
 * 詳細画面（ルート詳細・時刻表詳細）共通の下部アクションバー。
 * 画面下部（タブバーの上）に固定し、遅延情報ボタンと主アクションボタンを並べる（Figma準拠）。
 * 遅延情報モーダルの開閉はこのコンポーネントが持つので、利用側は主アクションだけ渡せばよい。
 */
interface DetailActionBarProps {
  /** 主アクションボタンのラベル（例：登録する／登録済み） */
  actionLabel: string;
  onAction: () => void;
  disabled?: boolean;
  /** 操作済み（登録済みなど）。Buttonのreleaseスタイルで表示する。 */
  released?: boolean;
}

export default function DetailActionBar({
  actionLabel,
  onAction,
  disabled = false,
  released = false,
}: DetailActionBarProps) {
  const [isDelayModalOpen, setIsDelayModalOpen] = useState(false);

  return (
    <>
      <div className="fixed inset-x-0 bottom-16 z-30 flex items-center gap-4 bg-[#eee] px-6 py-2">
        <button
          type="button"
          onClick={() => setIsDelayModalOpen(true)}
          className="flex size-[50px] shrink-0 flex-col items-center justify-center gap-1 rounded-lg bg-[#4e4e4e]/80 px-1 py-2 text-white transition-colors hover:bg-[#484848]/80 active:bg-[#454545]/80"
        >
          <TriangleAlert size={24} />
          <span className="text-[10px] leading-none">遅延情報</span>
        </button>

        <Button onClick={onAction} disabled={disabled} released={released}>
          {actionLabel}
        </Button>
      </div>

      <DelayInfoModal open={isDelayModalOpen} onClose={() => setIsDelayModalOpen(false)} />
    </>
  );
}
