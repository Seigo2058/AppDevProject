"use client";
import { useState } from 'react';
import { Search, Clock, ArrowRight, Bus } from 'lucide-react';

export default function SchedulePage() {
  const [day, setDay] = useState('月');
  const [period, setPeriod] = useState('1');
  const [showResult, setShowResult] = useState(false);

  const days = ['月', '火', '水', '木', '金'];
  const periods = [
    { id: '1', time: '08:50', label: '1限' },
    { id: '2', time: '10:30', label: '2限' },
    { id: '3', time: '13:00', label: '3限' },
    { id: '4', time: '14:40', label: '4限' },
    { id: '5', time: '16:20', label: '5限' },
    { id: '6', time: '18:00', label: '6限' },
  ];

  const handleSearch = () => {
    setShowResult(true);
  };

  return (
    <div className="p-4 space-y-6">
      <h2 className="text-xl font-bold text-gray-800">コマに合わせて検索</h2>
      
      <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm space-y-4">
        <div>
          <label className="block text-sm font-bold text-gray-700 mb-2">曜日を選択</label>
          <div className="flex space-x-2">
            {days.map(d => (
              <button
                key={d}
                onClick={() => setDay(d)}
                className={`flex-1 py-2 rounded-lg font-bold text-sm transition-colors ${
                  day === d ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {d}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-bold text-gray-700 mb-2">時限を選択</label>
          <div className="grid grid-cols-3 gap-2">
            {periods.map(p => (
              <button
                key={p.id}
                onClick={() => setPeriod(p.id)}
                className={`py-3 flex flex-col items-center justify-center rounded-lg border-2 transition-colors ${
                  period === p.id ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-gray-100 bg-white text-gray-600 hover:border-gray-300'
                }`}
              >
                <span className="font-bold">{p.label}</span>
                <span className="text-xs">{p.time}〜</span>
              </button>
            ))}
          </div>
        </div>

        <button 
          onClick={handleSearch}
          className="w-full mt-4 bg-gray-900 text-white font-bold py-4 rounded-xl shadow-sm flex items-center justify-center hover:bg-gray-800 transition-colors active:scale-[0.98]"
        >
          <Search size={20} className="mr-2" />
          最適な時間を検索
        </button>
      </div>

      {showResult && (
        <div className="space-y-3 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <h3 className="text-sm font-bold text-gray-500">おすすめの出発時間</h3>
          
          <div className="bg-white p-4 rounded-xl border border-blue-200 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full bg-blue-500"></div>
            <div className="flex items-center justify-between mb-4">
              <span className="bg-blue-100 text-blue-800 text-xs font-bold px-2 py-1 rounded">第1候補</span>
              <span className="text-xs font-bold text-gray-500 flex items-center">
                <Clock size={14} className="mr-1" />
                所要時間: 40分
              </span>
            </div>
            
            <div className="flex items-center justify-between">
              <div className="text-center">
                <p className="text-2xl font-black text-gray-900">07:45</p>
                <p className="text-xs text-gray-500">出発 (自宅)</p>
              </div>
              
              <div className="flex-1 flex flex-col items-center px-2">
                <div className="w-full flex items-center justify-center space-x-1 text-blue-500 mb-1">
                  <div className="h-0.5 bg-blue-200 flex-1"></div>
                  <Bus size={16} />
                  <div className="h-0.5 bg-blue-200 flex-1"></div>
                </div>
                <p className="text-[10px] text-gray-500">JRバス (○○行き)</p>
              </div>

              <div className="text-center">
                <p className="text-2xl font-black text-gray-900">08:25</p>
                <p className="text-xs text-gray-500">到着 (大学)</p>
              </div>
            </div>
            
            <p className="text-xs font-bold text-green-600 mt-4 text-center">
              1限 (08:50開始) に余裕で間に合います！
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
