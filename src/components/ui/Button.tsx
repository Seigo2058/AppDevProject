"use client";

import type { ButtonHTMLAttributes } from "react";

/**
 * Figmaのボタン定義（size L/M/S × style primary/secondary × state default/Pressed/Release）。
 *
 * Pressed はベース色に黒12%を重ねた指定なので、実色に焼き込んで表現する
 * （#a0e25e × 0.88 = #8dc753 ＝ Figma側でも押下時の色として使われている値）。
 * hover はその中間（黒8%）とし、Release は押下後＝操作済みの状態を表す
 * accentInactive(#646464) ＋ 白文字。
 */
const VARIANT_CLASSES = {
  primary: "bg-[#a0e25e] text-black hover:bg-[#93d057] active:bg-[#8dc753]",
  secondary: "bg-[#89c986] text-black hover:bg-[#7eb97b] active:bg-[#79b176]",
} as const;

// Release（操作済み）。押しても色が変わらないことで「もう押した」ことを示す。
const RELEASE_CLASSES = "bg-[#646464] text-white";

const SIZE_CLASSES = {
  L: "w-full px-4 py-2",
  M: "w-full max-w-[338px] p-2.5",
  S: "w-full max-w-[279px] p-2.5",
} as const;

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof VARIANT_CLASSES;
  size?: keyof typeof SIZE_CLASSES;
  /** 押下後（登録済みなど操作が完了した状態）。Release スタイルで表示する。 */
  released?: boolean;
}

export default function Button({
  variant = "primary",
  size = "L",
  released = false,
  className = "",
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={`flex h-[50px] min-w-0 items-center justify-center rounded-lg text-sm font-bold transition-colors disabled:cursor-not-allowed ${
        SIZE_CLASSES[size]
      } ${released ? RELEASE_CLASSES : `${VARIANT_CLASSES[variant]} disabled:opacity-50`} ${className}`}
      {...props}
    />
  );
}
