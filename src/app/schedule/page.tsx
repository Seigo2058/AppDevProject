"use client";
import { useState } from 'react';
import { Clock, Bus, MapPin, CalendarCheck, Check, Pencil } from 'lucide-react';

const days = ['月', '火', '水', '木', '金'];
const periods = [
  { id: 1, start: '08:50', end: '10:20' },
  { id: 2, start: '10:30', end: '12:00' },
  { id: 3, start: '13:00', end: '14:30' },
  { id: 4, start: '14:40', end: '16:10' },
  { id: 5, start: '16:20', end: '17:50' },
  { id: 6, start: '18:00', end: '19:30' },
];

// ダミー時刻表 (自宅発 -> 大学着)
const dummyOutbound = [
  { depart: '07:30', arrive: '08:10' },
  { depart: '07:45', arrive: '08:25' },
  { depart: '08:00', arrive: '08:40' },
  { depart: '09:00', arrive: '09:40' },
  { depart: '09:30', arrive: '10:10' },
  { depart: '11:45', arrive: '12:25' },
  { depart: '13:30', arrive: '14:10' },
  { depart: '15:15', arrive: '15:55' },
  { depart: '17:00', arrive: '17:40' },
];

// ダミー時刻表 (大学発 -> 自宅着)
const dummyInbound = [
  { depart: '10:45', arrive: '11:25' },
  { depart: '12:15', arrive: '12:55' },
  { depart: '14:45', arrive: '15:25' },
  { depart: '16:30', arrive: '17:10' },
  { depart: '18:10', arrive: '18:50' },
  { depart: '19:45', arrive: '20:25' },
  { depart: '21:00', arrive: '21:40' },
];

export default function SchedulePage() {
  const [schedule, setSchedule] = useState<Set<string>>(new Set());
  const [isEditing, setIsEditing] = useState(true);

  const toggleClass = (day: string, periodId: number) => {
    if (!isEditing) return;
    setSchedule(prev => {
      const newSchedule = new Set(prev);
      const key = `${day}-${periodId}`;
      if (newSchedule.has(key)) {
        newSchedule.delete(key);
      } else {
        newSchedule.add(key);
      }
      return newSchedule;
    });
  };

  const getDaySchedule = (day: string) => {
    const dayPeriods = periods.filter(p => schedule.has(`${day}-${p.id}`));
    if (dayPeriods.length === 0) return null;

    const minPeriod = Math.min(...dayPeriods.map(p => p.id));
    const maxPeriod = Math.max(...dayPeriods.map(p => p.id));
    const classStart = periods.find(p => p.id === minPeriod)!.start;
    const classEnd = periods.find(p => p.id === maxPeriod)!.end;

    // 行き: 授業開始時刻より前に到着する最も遅いバス
    const outbound = dummyOutbound.slice().reverse().find(b => b.arrive <= classStart) || dummyOutbound[0];
    
    // 帰り: 授業終了時刻より後に出発する最も早いバス
    const inbound = dummyInbound.find(b => b.depart >= classEnd) || dummyInbound[dummyInbound.length - 1];

    return { minPeriod, maxPeriod, outbound, inbound };
  };

  return (
    <div className="p-4 space-y-6 pb-24">
      <div className="flex items-center space-x-2 text-gray-800">
        <CalendarCheck size={24} className="text-blue-600" />
        <h2 className="text-xl font-bold">時間割と移動スケジュール</h2>
      </div>
      
      {/* 時間割グリッド（編集中のみ表示） */}
      {isEditing && (
        <section className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm space-y-4 animate-in fade-in zoom-in-95 duration-200">
          <h3 className="text-sm font-bold text-gray-700">授業をタップして登録</h3>
          
          <div className="overflow-x-auto pb-2">
            <div className="min-w-[300px]">
              {/* ヘッダー */}
              <div className="flex mb-1">
                <div className="w-8"></div>
                {days.map(day => (
                  <div key={day} className="flex-1 text-center text-xs font-bold text-gray-500 py-1">
                    {day}
                  </div>
                ))}
              </div>
              
              {/* グリッド本体 */}
              <div className="space-y-1">
                {periods.map(period => (
                  <div key={period.id} className="flex h-12 items-center">
                    <div className="w-8 flex flex-col justify-center items-center text-xs text-gray-500">
                      <span className="font-bold">{period.id}</span>
                    </div>
                    {days.map(day => {
                      const isSelected = schedule.has(`${day}-${period.id}`);
                      return (
                        <div key={`${day}-${period.id}`} className="flex-1 h-full px-0.5 py-0.5">
                          <button
                            onClick={() => toggleClass(day, period.id)}
                            className={`w-full h-full rounded-md transition-all active:scale-95 flex items-center justify-center ${
                              isSelected 
                                ? 'bg-blue-500 text-white shadow-inner shadow-blue-600/50' 
                                : 'bg-gray-100 hover:bg-gray-200'
                            }`}
                          >
                            {isSelected && <span className="text-xs font-bold text-white">✓</span>}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <button
            onClick={() => setIsEditing(false)}
            className="w-full bg-blue-600 text-white font-bold py-3.5 rounded-xl shadow-sm flex items-center justify-center hover:bg-blue-700 transition-colors active:scale-[0.98]"
          >
            <Check size={20} className="mr-2" />
            時間割を確定してスケジュールを更新
          </button>
        </section>
      )}

      {/* 曜日ごとの移動スケジュール */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-gray-500">1週間の移動スケジュール</h3>
          {!isEditing && (
            <button
              onClick={() => setIsEditing(true)}
              className="flex items-center text-sm font-bold text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg hover:bg-blue-100 transition-colors active:scale-95"
            >
              <Pencil size={16} className="mr-1" />
              時間割を編集
            </button>
          )}
        </div>
        
        <div className="space-y-3">
          {days.map(day => {
            const plan = getDaySchedule(day);
            
            return (
              <div key={day} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="bg-gray-50 px-4 py-2 border-b border-gray-100 flex justify-between items-center">
                  <span className="font-bold text-gray-800">{day}曜日</span>
                  {plan ? (
                    <span className="text-xs font-bold text-blue-600 bg-blue-100 px-2 py-1 rounded-full">
                      {plan.minPeriod}限 〜 {plan.maxPeriod}限
                    </span>
                  ) : (
                    <span className="text-xs text-gray-500">授業なし</span>
                  )}
                </div>
                
                <div className="p-4">
                  {plan ? (
                    <div className="space-y-4">
                      {/* 行き */}
                      <div className="flex items-start space-x-3">
                        <div className="bg-blue-100 p-2 rounded-lg text-blue-600 mt-1">
                          <MapPin size={16} />
                        </div>
                        <div className="flex-1">
                          <p className="text-xs font-bold text-gray-500 mb-1">行き (大学へ)</p>
                          <div className="flex items-center justify-between bg-gray-50 p-3 rounded-lg border border-gray-100">
                            <div className="text-center">
                              <p className="text-lg font-black text-gray-900">{plan.outbound.depart}</p>
                              <p className="text-[10px] text-gray-500">自宅発</p>
                            </div>
                            <div className="flex-1 flex flex-col items-center px-2">
                              <div className="w-full flex items-center justify-center space-x-1 text-gray-400">
                                <div className="h-[1px] bg-gray-300 flex-1"></div>
                                <Bus size={14} />
                                <div className="h-[1px] bg-gray-300 flex-1"></div>
                              </div>
                              <p className="text-[10px] text-gray-400 mt-1">約40分</p>
                            </div>
                            <div className="text-center">
                              <p className="text-lg font-black text-gray-900">{plan.outbound.arrive}</p>
                              <p className="text-[10px] text-gray-500">大学着</p>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* 帰り */}
                      <div className="flex items-start space-x-3">
                        <div className="bg-green-100 p-2 rounded-lg text-green-600 mt-1">
                          <Clock size={16} />
                        </div>
                        <div className="flex-1">
                          <p className="text-xs font-bold text-gray-500 mb-1">帰り (自宅へ)</p>
                          <div className="flex items-center justify-between bg-gray-50 p-3 rounded-lg border border-gray-100">
                            <div className="text-center">
                              <p className="text-lg font-black text-gray-900">{plan.inbound.depart}</p>
                              <p className="text-[10px] text-gray-500">大学発</p>
                            </div>
                            <div className="flex-1 flex flex-col items-center px-2">
                              <div className="w-full flex items-center justify-center space-x-1 text-gray-400">
                                <div className="h-[1px] bg-gray-300 flex-1"></div>
                                <Bus size={14} />
                                <div className="h-[1px] bg-gray-300 flex-1"></div>
                              </div>
                              <p className="text-[10px] text-gray-400 mt-1">約40分</p>
                            </div>
                            <div className="text-center">
                              <p className="text-lg font-black text-gray-900">{plan.inbound.arrive}</p>
                              <p className="text-[10px] text-gray-500">自宅着</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500 text-center py-4">
                      この日は授業が登録されていません。
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
