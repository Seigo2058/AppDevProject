"use client";
import { useState } from 'react';
import { Plus, Trash2, Save } from 'lucide-react';

export default function TimetablePage() {
  const [agency, setAgency] = useState('jr_hokkaido');
  const [routeName, setRouteName] = useState('');
  const [times, setTimes] = useState([{ hour: '', minute: '' }]);

  const addTime = () => setTimes([...times, { hour: '', minute: '' }]);
  const removeTime = (index: number) => setTimes(times.filter((_, i) => i !== index));

  const updateTime = (index: number, field: 'hour' | 'minute', value: string) => {
    const newTimes = [...times];
    newTimes[index][field] = value;
    setTimes(newTimes);
  };

  const handleSave = () => {
    alert('時刻表を保存しました（モック）');
  };

  return (
    <div className="p-4 space-y-6">
      <h2 className="text-xl font-bold text-gray-800">時刻表の登録</h2>
      
      <div className="space-y-4 bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
        <div>
          <label className="block text-sm font-bold text-gray-700 mb-1">交通機関</label>
          <select 
            value={agency} 
            onChange={(e) => setAgency(e.target.value)}
            className="w-full border border-gray-300 rounded-lg p-3 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="jr_hokkaido">JR北海道</option>
            <option value="jr_bus">JRバス</option>
            <option value="chuo_bus">中央バス</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-bold text-gray-700 mb-1">路線名・停留所名</label>
          <input 
            type="text" 
            placeholder="例: 札幌駅発 ○○大学行" 
            value={routeName}
            onChange={(e) => setRouteName(e.target.value)}
            className="w-full border border-gray-300 rounded-lg p-3 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-bold text-gray-700 mb-2">発車時刻</label>
          <div className="space-y-2">
            {times.map((t, i) => (
              <div key={i} className="flex items-center space-x-2">
                <input 
                  type="number" 
                  placeholder="時" 
                  value={t.hour}
                  onChange={(e) => updateTime(i, 'hour', e.target.value)}
                  className="w-20 border border-gray-300 rounded-lg p-3 bg-gray-50 text-center"
                  min="0" max="23"
                />
                <span className="font-bold text-gray-500">:</span>
                <input 
                  type="number" 
                  placeholder="分" 
                  value={t.minute}
                  onChange={(e) => updateTime(i, 'minute', e.target.value)}
                  className="w-20 border border-gray-300 rounded-lg p-3 bg-gray-50 text-center"
                  min="0" max="59"
                />
                <button 
                  onClick={() => removeTime(i)}
                  className="p-3 text-red-500 hover:bg-red-50 rounded-lg ml-auto"
                >
                  <Trash2 size={20} />
                </button>
              </div>
            ))}
          </div>
          <button 
            onClick={addTime}
            className="mt-3 w-full py-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 font-bold flex items-center justify-center hover:bg-gray-50 transition-colors"
          >
            <Plus size={20} className="mr-1" />
            時刻を追加
          </button>
        </div>
      </div>

      <button 
        onClick={handleSave}
        className="w-full bg-blue-600 text-white font-bold py-4 rounded-xl shadow-sm flex items-center justify-center hover:bg-blue-700 transition-colors active:scale-[0.98]"
      >
        <Save size={20} className="mr-2" />
        保存する
      </button>
    </div>
  );
}
