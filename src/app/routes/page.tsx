"use client";
import { useState } from 'react';
import { Save, MapPin, ArrowDown } from 'lucide-react';

export default function RoutesPage() {
  const [routeName, setRouteName] = useState('');
  const [departure, setDeparture] = useState('');
  const [destination, setDestination] = useState('');
  const [transport, setTransport] = useState('jr_bus');

  const handleSave = () => {
    alert('マイルートを保存しました（モック）');
  };

  return (
    <div className="p-4 space-y-6">
      <h2 className="text-xl font-bold text-gray-800">マイルートの登録</h2>
      
      <div className="space-y-4 bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
        <div>
          <label className="block text-sm font-bold text-gray-700 mb-1">ルート名</label>
          <input 
            type="text" 
            placeholder="例: 自宅から大学" 
            value={routeName}
            onChange={(e) => setRouteName(e.target.value)}
            className="w-full border border-gray-300 rounded-lg p-3 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="pt-4 border-t border-gray-100">
          <div className="relative space-y-4">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">出発地</label>
              <div className="flex items-center">
                <MapPin size={20} className="text-gray-400 mr-2" />
                <input 
                  type="text" 
                  placeholder="最寄りの駅やバス停" 
                  value={departure}
                  onChange={(e) => setDeparture(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg p-3 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="flex justify-center z-10 relative py-2">
               <div className="bg-gray-100 p-2 rounded-full border border-gray-200">
                 <ArrowDown size={16} className="text-gray-500" />
               </div>
            </div>

            <div className="z-10 relative">
              <label className="block text-sm font-bold text-gray-700 mb-1">利用する交通機関</label>
              <select 
                value={transport} 
                onChange={(e) => setTransport(e.target.value)}
                className="w-full border border-gray-300 rounded-lg p-3 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="jr_hokkaido">JR北海道 (○○線)</option>
                <option value="jr_bus">JRバス (○○行き)</option>
                <option value="chuo_bus">中央バス (○○行き)</option>
              </select>
            </div>

            <div className="flex justify-center z-10 relative py-2">
               <div className="bg-gray-100 p-2 rounded-full border border-gray-200">
                 <ArrowDown size={16} className="text-gray-500" />
               </div>
            </div>

            <div className="z-10 relative">
              <label className="block text-sm font-bold text-gray-700 mb-1">到着地 (目的地)</label>
              <div className="flex items-center">
                <MapPin size={20} className="text-red-400 mr-2" />
                <input 
                  type="text" 
                  placeholder="大学やアルバイト先など" 
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg p-3 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <button 
        onClick={handleSave}
        className="w-full bg-blue-600 text-white font-bold py-4 rounded-xl shadow-sm flex items-center justify-center hover:bg-blue-700 transition-colors active:scale-[0.98]"
      >
        <Save size={20} className="mr-2" />
        ルートを保存
      </button>
    </div>
  );
}
