'use client';

import { useMemo } from 'react';
import dynamic from 'next/dynamic';
import { MapPin } from 'lucide-react';
import type { ItineraryItem } from '@/lib/types';
import type { MapPoint } from './TripMap';

// Leaflet 不能 SSR，動態載入
const TripMap = dynamic(() => import('./TripMap'), {
  ssr: false,
  loading: () => <div className="w-full h-full animate-pulse bg-[var(--color-primary-soft)]/40" />,
});

// Trip 主頁「當日地圖」卡片：把當天有座標的行程點按時間標號、連成路線。
// 一個座標點都沒有時整張卡不出現（舊資料不強制回填）。
export default function DayRouteMap({ items }: { items: ItineraryItem[] }) {
  const points = useMemo<MapPoint[]>(
    () =>
      items
        .filter((i) => i.lat != null && i.lng != null)
        .map((i, idx) => ({
          id: i.id,
          name: i.location,
          lat: i.lat as number,
          lng: i.lng as number,
          number: idx + 1,
          sub: i.start_time ? i.start_time.substring(0, 5) : undefined,
        })),
    [items]
  );

  const route = useMemo(() => points.map((p) => [p.lat, p.lng] as [number, number]), [points]);
  const fitKey = points.map((p) => p.id).join('|');

  if (points.length === 0) return null;

  return (
    <div className="relative isolate rounded-xl overflow-hidden border border-[var(--color-border-hairline)] shadow-[0_8px_30px_rgba(15,110,86,0.06)] h-[280px] bg-white">
      <TripMap points={points} route={route} fitKey={fitKey} className="w-full h-full" />
      <div className="absolute top-3 left-3 z-[500] flex items-center gap-1.5 bg-white/90 backdrop-blur px-3 py-1.5 rounded-xl shadow-sm border border-[var(--color-border-hairline)]">
        <MapPin className="w-3.5 h-3.5 text-[var(--color-primary)]" />
        <span className="text-[10px] font-black text-[var(--color-ink)] tracking-widest">當日路線・{points.length} 個定位點</span>
      </div>
    </div>
  );
}
