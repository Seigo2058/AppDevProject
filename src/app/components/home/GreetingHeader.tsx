import { Settings } from "lucide-react";

export default function GreetingHeader() {
  return (
    <div className="flex items-center justify-between h-11 py-2">
      <h1 className="text-2xl font-bold text-black">おはようございます</h1>
      <button
        type="button"
        aria-label="設定"
        className="p-1 text-gray-700 hover:text-black transition-colors"
      >
        <Settings size={24} />
      </button>
    </div>
  );
}
