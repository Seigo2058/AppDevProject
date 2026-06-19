import Link from 'next/link';
import { AlertTriangle, MapPin, Bus, Train, ArrowRight } from 'lucide-react';
import RouteSearch from './components/RouteSearch';
import NextDeparture from './components/NextDeparture';

export default function Home() {
  return (
    <div className="p-4 space-y-6">
      {/* 経路検索 */}
      <RouteSearch />

      {/* 次の出発 */}
      <NextDeparture />


      {/* 遅延情報 */}
      <section className="space-y-3">
        <h2 className="text-sm font-bold text-gray-500 flex items-center">
          <AlertTriangle size={16} className="mr-1 text-orange-500" />
          運行・遅延情報
        </h2>
        <div className="grid grid-cols-2 gap-3">
          <a href="https://www3.jrhokkaido.co.jp/webunkou/" target="_blank" rel="noopener noreferrer" className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col items-center justify-center space-y-2 active:bg-gray-50 transition-colors">
            <Train size={24} className="text-green-600" />
            <span className="text-xs font-bold text-gray-700">JR北海道</span>
          </a>
          <a href="https://www.jrhokkaidobus.com/" target="_blank" rel="noopener noreferrer" className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col items-center justify-center space-y-2 active:bg-gray-50 transition-colors">
            <Bus size={24} className="text-blue-600" />
            <span className="text-xs font-bold text-gray-700">JRバス</span>
          </a>
          <a href="https://www.chuo-bus.co.jp/" target="_blank" rel="noopener noreferrer" className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col items-center justify-center space-y-2 active:bg-gray-50 transition-colors col-span-2">
            <Bus size={24} className="text-red-600" />
            <span className="text-xs font-bold text-gray-700">北海道中央バス</span>
          </a>
        </div>
      </section>

      {/* 現在位置情報 */}
      <section className="space-y-3">
        <h2 className="text-sm font-bold text-gray-500 flex items-center">
          <MapPin size={16} className="mr-1 text-blue-500" />
          列車・バスの現在位置
        </h2>
        <div className="space-y-2">
          <a href="https://www3.jrhokkaido.co.jp/webunkou/" target="_blank" rel="noopener noreferrer" className="w-full bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between active:bg-gray-50 transition-colors">
            <div className="flex items-center space-x-3">
              <div className="bg-green-100 p-2 rounded-lg text-green-600">
                <Train size={20} />
              </div>
              <span className="text-sm font-bold text-gray-800">JR北海道 列車走行位置</span>
            </div>
            <ArrowRight size={16} className="text-gray-400" />
          </a>
          <a href="#" target="_blank" rel="noopener noreferrer" className="w-full bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between active:bg-gray-50 transition-colors">
            <div className="flex items-center space-x-3">
              <div className="bg-blue-100 p-2 rounded-lg text-blue-600">
                <Bus size={20} />
              </div>
              <span className="text-sm font-bold text-gray-800">JRバス 接近情報</span>
            </div>
            <ArrowRight size={16} className="text-gray-400" />
          </a>
          <a href="#" target="_blank" rel="noopener noreferrer" className="w-full bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between active:bg-gray-50 transition-colors">
            <div className="flex items-center space-x-3">
              <div className="bg-red-100 p-2 rounded-lg text-red-600">
                <Bus size={20} />
              </div>
              <span className="text-sm font-bold text-gray-800">中央バス 接近情報</span>
            </div>
            <ArrowRight size={16} className="text-gray-400" />
          </a>
        </div>
      </section>
    </div>
  );
}
