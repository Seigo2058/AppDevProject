"use client";

import { ChevronRight, Plus } from 'lucide-react';

interface MyRouteCardItemProps {
  startPlace: string;
  goalPlace: string;
  startTime: string;
  goalTime: string;
  interval: string;
  restTime: string;
  fee: string;
  transfer: string;
}

function MyRouteCardItem({
  startPlace,
  goalPlace,
  startTime,
  goalTime,
  interval,
  restTime,
  fee,
  transfer,
}: MyRouteCardItemProps) {
  return (
    <div
      className="flex flex-row items-center justify-center gap-1 rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
      style={{
        padding: '8px 16px',
        height: 90,
        background: '#FAFAFA',
        border: '1px solid #E8E8E8',
        borderRadius: 8,
        width: '100%',
        boxShadow: '0px 2px 12px 0px rgba(0,0,0,0.06)',
      }}
    >
      <div className="flex flex-col justify-center gap-1" style={{ width: 325 }}>
        {/* 出発地 → 目的地 */}
        <div className="flex flex-row gap-1 items-center">
          <span className="text-[10px]" style={{ fontFamily: "'Noto Sans JP', sans-serif", color: '#000000' }}>{startPlace}</span>
          <span className="text-[10px]" style={{ fontFamily: "'Noto Sans JP', sans-serif", color: '#000000' }}>から</span>
          <span className="text-[10px]" style={{ fontFamily: "'Noto Sans JP', sans-serif", color: '#000000' }}>{goalPlace}</span>
          <span className="text-[10px]" style={{ fontFamily: "'Noto Sans JP', sans-serif", color: '#000000' }}>まで</span>
        </div>

        {/* 時刻・所要時間 */}
        <div className="flex flex-row items-end gap-1">
          <div className="flex flex-row items-center gap-1">
            <span className="text-[24px] font-bold leading-none" style={{ fontFamily: "'Noto Sans JP', sans-serif", color: '#000000', lineHeight: 1 }}>
              {startTime}
            </span>
            <div style={{ width: 12, height: 1, background: '#000000' }} />
            <span className="text-[24px] font-bold leading-none" style={{ fontFamily: "'Noto Sans JP', sans-serif", color: '#000000', lineHeight: 1 }}>
              {goalTime}
            </span>
          </div>
          <div className="flex flex-row items-end">
            <span className="text-[12px]" style={{ fontFamily: "'Noto Sans JP', sans-serif", color: '#000000', lineHeight: '1.2' }}>（</span>
            <span className="text-[12px]" style={{ fontFamily: "'Noto Sans JP', sans-serif", color: '#000000', lineHeight: '1.2' }}>{interval}</span>
            <span className="text-[12px]" style={{ fontFamily: "'Noto Sans JP', sans-serif", color: '#000000', lineHeight: '1.2' }}>分）</span>
          </div>
          <div className="flex flex-row items-center">
            <span className="text-[11px]" style={{ fontFamily: "'Noto Sans JP', sans-serif", color: '#000000' }}>残り</span>
            <span className="text-[11px] font-bold" style={{ fontFamily: "'Noto Sans JP', sans-serif", color: '#000000' }}>{restTime}</span>
          </div>
        </div>

        {/* 料金・乗換 */}
        <div className="flex flex-row items-center gap-2 relative">
          <div className="flex flex-row items-center">
            <span className="text-[11px] font-bold" style={{ fontFamily: "'Noto Sans JP', sans-serif", color: '#000000' }}>{fee}</span>
            <span className="text-[11px] font-bold" style={{ fontFamily: "'Noto Sans JP', sans-serif", color: '#000000' }}>円</span>
          </div>
          <div style={{ position: 'absolute', left: 35, top: -2, width: 1, height: 17, background: '#8F8D8D' }} />
          <div className="flex flex-row items-center ml-3">
            <span className="text-[11px]" style={{ fontFamily: "'Noto Sans JP', sans-serif", color: '#000000' }}>乗換</span>
            <span className="text-[11px]" style={{ fontFamily: "'Noto Sans JP', sans-serif", color: '#000000' }}>{transfer}</span>
          </div>
        </div>
      </div>

      <div className="flex items-center" style={{ width: 14, height: 14 }}>
        <ChevronRight size={11} style={{ color: '#888' }} />
      </div>
    </div>
  );
}

function AddRouteButton() {
  return (
    <button
      className="flex flex-col items-center justify-center gap-2 rounded-lg cursor-pointer hover:opacity-80 transition-opacity"
      style={{
        width: 370,
        height: 90,
        border: '1.5px dashed #AECB72',
        borderRadius: 8,
        background: 'transparent',
      }}
    >
      <div className="flex items-center justify-center rounded-full" style={{ padding: 8, background: '#AECB72' }}>
        <Plus size={16} style={{ color: '#FFFFFF' }} />
      </div>
    </button>
  );
}

export default function MyRouteCard() {
  const routes: MyRouteCardItemProps[] = [
    {
      startPlace: '若葉一丁目',
      goalPlace: '北海道情報大学',
      startTime: '12:00',
      goalTime: '12:20',
      interval: '20',
      restTime: '3:00',
      fee: '250',
      transfer: '無',
    },
  ];

  return (
    <div className="flex flex-col gap-2" style={{ width: 370 }}>
      <div className="flex flex-col gap-2">
        {routes.map((route, i) => (
          <MyRouteCardItem key={i} {...route} />
        ))}
      </div>
      <AddRouteButton />
    </div>
  );
}
