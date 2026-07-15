"use client";

import { Bus, Train } from 'lucide-react';

interface RouteSegmentProps {
  label: string;
  labelColor: string;
  departureTime: string;
  departureStation: string;
  arrivalTime: string;
  arrivalStation: string;
  busType: string;
  type: 'go' | 'return';
}

function RouteSegment({
  label,
  labelColor,
  departureTime,
  departureStation,
  arrivalTime,
  arrivalStation,
  busType,
  type,
}: RouteSegmentProps) {
  return (
    <div className="flex flex-col gap-2" style={{ width: '100%' }}>
      <span
        className="text-[11px] font-[500] w-full"
        style={{ fontFamily: "'Inter', sans-serif", color: labelColor }}
      >
        {label}
      </span>

      <div
        className="flex flex-row items-center justify-center gap-[9px] rounded-lg"
        style={{
          width: 340,
          padding: '8px 16px',
          background: '#FBFBFB',
          border: '1px solid #E8E8E8',
          boxShadow: '0px 2px 12px 0px rgba(0,0,0,0.06)',
        }}
      >
        {/* 左カラム */}
        {type === 'go' ? (
          <div className="flex flex-col justify-center gap-[6px]" style={{ width: 72 }}>
            <span className="text-[12px] opacity-50" style={{ fontFamily: "'Inter', sans-serif", color: '#000000' }}>
              出発時刻
            </span>
            <span className="text-[16px] font-bold w-full" style={{ fontFamily: "'Inter', sans-serif", color: '#000000' }}>
              {departureTime}
            </span>
            <div className="flex flex-row items-center gap-[2px]">
              <Bus size={15} style={{ color: '#888' }} />
              <span className="text-[10px]" style={{ fontFamily: "'Inter', sans-serif", color: '#000000', width: 36 }}>
                {departureStation}
              </span>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-stretch justify-center gap-[6px]" style={{ width: 72 }}>
            <span className="text-[12px] opacity-50 w-full" style={{ fontFamily: "'Inter', sans-serif", color: '#000000' }}>
              大学到着時刻
            </span>
            <span className="text-[16px] font-bold w-full" style={{ fontFamily: "'Inter', sans-serif", color: '#000000' }}>
              {arrivalTime}
            </span>
            <div className="flex flex-row items-center gap-[2px]">
              <Bus size={15} style={{ color: '#888' }} />
              <span className="text-[10px]" style={{ fontFamily: "'Inter', sans-serif", color: '#000000', width: 36 }}>
                {arrivalStation}
              </span>
            </div>
          </div>
        )}

        {/* 中央: 路線図 */}
        <div
          className="flex flex-col items-center justify-center flex-1 gap-[8px] self-stretch"
          style={{ padding: '10px 0 0' }}
        >
          <div style={{ width: 160, position: 'relative' }}>
            <div style={{ width: '100%', height: 1, background: '#000000', opacity: 0.4, marginTop: 7 }} />
            <Bus size={15} style={{ position: 'absolute', top: -7, left: 73, color: '#E3E3E3' }} />
          </div>
          <span className="text-[10px] opacity-60" style={{ fontFamily: "'Inter', sans-serif", color: '#000000', textAlign: 'center' }}>
            {busType}
          </span>
        </div>

        {/* 右カラム */}
        {type === 'go' ? (
          <div className="flex flex-col items-stretch gap-[5px]" style={{ width: 72 }}>
            <span className="text-[12px] opacity-50 w-full" style={{ fontFamily: "'Inter', sans-serif", color: '#000000' }}>
              大学到着時刻
            </span>
            <span className="text-[16px] font-bold text-right w-full" style={{ fontFamily: "'Inter', sans-serif", color: '#000000' }}>
              {arrivalTime}
            </span>
            <div className="flex flex-row items-center justify-end gap-[1px]">
              <Train size={15} style={{ color: '#888' }} />
              <span className="text-[10px]" style={{ fontFamily: "'Inter', sans-serif", color: '#000000' }}>
                {arrivalStation}
              </span>
            </div>
          </div>
        ) : (
          <div className="flex flex-col justify-center gap-[6px]" style={{ width: 72 }}>
            <span className="text-[12px] opacity-50" style={{ fontFamily: "'Inter', sans-serif", color: '#000000' }}>
              出発時刻
            </span>
            <span className="text-[16px] font-bold w-full" style={{ fontFamily: "'Inter', sans-serif", color: '#000000' }}>
              {departureTime}
            </span>
            <div className="flex flex-row items-center gap-[2px]">
              <Train size={15} style={{ color: '#888' }} />
              <span className="text-[10px]" style={{ fontFamily: "'Inter', sans-serif", color: '#000000', width: 36 }}>
                {departureStation}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function MyScheduleRouteCard() {
  return (
    <div
      className="flex flex-col items-center gap-4 rounded-lg"
      style={{
        width: 370,
        padding: 16,
        background: '#FAFAFA',
        boxShadow: '0px 2px 12px 0px rgba(0,0,0,0.06)',
        borderRadius: 8,
      }}
    >
      {/* ヘッダー行 */}
      <div className="flex flex-row items-center gap-[44px] w-full">
        <span className="text-[16px] font-bold" style={{ fontFamily: "'Inter', sans-serif", color: '#000000' }}>
          月曜日
        </span>
        <div className="flex flex-row items-center gap-2">
          <div className="flex flex-row items-center gap-2">
            <span className="text-[12px]" style={{ fontFamily: "'Noto Sans JP', sans-serif", color: '#000000' }}>
              本日の授業時間：
            </span>
            <span className="text-[12px] font-bold" style={{ fontFamily: "'Inter', sans-serif", color: '#000000' }}>
              9:00~14:25
            </span>
          </div>
          <div className="flex items-center justify-center rounded-lg" style={{ padding: 4, background: '#AECB72' }}>
            <span className="text-[10px] font-bold" style={{ fontFamily: "'Inter', sans-serif", color: '#FFFFFF' }}>
              １限〜３限
            </span>
          </div>
        </div>
      </div>

      {/* 区切り線 */}
      <div className="w-full" style={{ height: 1, background: '#D2D2D2', opacity: 0.6 }} />

      {/* 行き・帰り */}
      <div className="flex flex-col gap-4" style={{ width: 340 }}>
        <RouteSegment
          label="行き"
          labelColor="#232323"
          departureTime="8:40"
          departureStation="野幌駅"
          arrivalTime="8:50"
          arrivalStation="情報大学前"
          busType="スクール便"
          type="go"
        />
        <RouteSegment
          label="帰り"
          labelColor="#4E4E4E"
          departureTime="8:40"
          departureStation="野幌駅"
          arrivalTime="8:50"
          arrivalStation="情報大学前"
          busType="スクール便"
          type="return"
        />
      </div>
    </div>
  );
}
