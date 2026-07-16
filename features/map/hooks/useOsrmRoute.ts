import { useQuery } from '@tanstack/react-query';
import type { ItineraryItem } from '@/lib/types';

// 相鄰行程點交通時間：用 FOSSGIS 的 OSRM 公開服務（免費、免金鑰、支援 CORS）。
// 機車/汽車走 driving，步行走 foot；火車/高鐵路網不適用道路路由，略過不估。
const OSRM_BASE = 'https://routing.openstreetmap.de';

function profileFor(transport: string): string | null {
  if (transport === '步行') return 'routed-foot/route/v1/foot';
  if (transport === '機車' || transport === '汽車') return 'routed-car/route/v1/driving';
  return null; // 火車/高鐵等不估
}

export interface TravelLeg {
  durationMin: number;
  distanceKm: number;
  transport: string;
}

// 回傳 { [目的地行程 id]: 從上一個定位點到它的交通時間 }
export function useDayTravelTimes(items: ItineraryItem[]) {
  const pts = items.filter((i) => i.lat != null && i.lng != null);
  const key = pts.map((p) => `${p.id}:${p.lat},${p.lng},${p.transport_type}`).join('|');

  return useQuery({
    queryKey: ['osrm-day', key],
    enabled: pts.length >= 2,
    staleTime: Infinity,
    retry: 1,
    queryFn: async () => {
      const legs: Record<string, TravelLeg> = {};
      await Promise.all(
        pts.slice(1).map(async (to, i) => {
          const from = pts[i];
          const profile = profileFor(to.transport_type);
          if (!profile) return;
          try {
            const res = await fetch(
              `${OSRM_BASE}/${profile}/${from.lng},${from.lat};${to.lng},${to.lat}?overview=false`
            );
            if (!res.ok) return;
            const data = await res.json();
            const r = data.routes?.[0];
            if (!r) return;
            legs[to.id] = {
              durationMin: Math.max(1, Math.round(r.duration / 60)),
              distanceKm: Math.round(r.distance / 100) / 10,
              transport: to.transport_type,
            };
          } catch {
            // 單段失敗不影響其他段
          }
        })
      );
      return legs;
    },
  });
}
