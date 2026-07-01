import { Train, Bus } from "lucide-react";

export default function OtherLinksSection() {
  return (
    <section className="space-y-4">
      <h2 className="text-sm font-bold text-black">その他</h2>
      <div className="flex gap-4">
        <a
          href="https://www3.jrhokkaido.co.jp/webunkou/"
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 bg-white shadow-sm rounded-lg h-[55px] px-4 flex items-center gap-4 active:bg-gray-50 transition-colors"
        >
          <Train size={28} className="text-green-600 shrink-0" />
          <span className="text-sm font-bold text-black">JR遅延情報</span>
        </a>
        <a
          href="https://www.jrhokkaidobus.com/"
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 bg-white shadow-sm rounded-lg h-[55px] px-4 flex items-center gap-4 active:bg-gray-50 transition-colors"
        >
          <Bus size={28} className="text-blue-600 shrink-0" />
          <span className="text-sm font-bold text-black">バス遅延情報</span>
        </a>
      </div>
    </section>
  );
}
