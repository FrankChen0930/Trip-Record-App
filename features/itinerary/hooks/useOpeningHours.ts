import { useQuery, useQueryClient } from '@tanstack/react-query';
import { itineraryApi } from '../api';
import type { ItineraryItem } from '@/lib/types';

// 行程卡營業時間：DB 有快取（opening_hours）就直接用；
// 沒有且已定位（place_id）才打自家代理查 Google，成功後寫回 trip_itinerary 永久快取，
// 之後任何人看這張卡都不再耗 Google 配額。
export function useOpeningHours(item: ItineraryItem): string[] | null {
  const queryClient = useQueryClient();
  const cached = item.opening_hours;

  const query = useQuery({
    queryKey: ['place-hours', item.id],
    enabled: !!item.place_id && cached == null,
    staleTime: Infinity,
    retry: 1,
    queryFn: async (): Promise<string[]> => {
      const res = await fetch('/api/places/hours', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ placeId: item.place_id }),
      });
      if (!res.ok) throw new Error(`營業時間查詢失敗 (${res.status})`);
      const data: { weekdayDescriptions: string[] | null } = await res.json();
      const weekdayDescriptions = data.weekdayDescriptions ?? [];
      const { error } = await itineraryApi.updateOpeningHours(item.id, { weekdayDescriptions });
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ['itinerary', item.trip_id] });
      return weekdayDescriptions;
    },
  });

  return cached?.weekdayDescriptions ?? query.data ?? null;
}
