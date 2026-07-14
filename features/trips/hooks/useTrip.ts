import { useQuery } from '@tanstack/react-query';
import { tripsApi } from '../api';
import type { Trip } from '@/lib/types';

// 取得單一 trip 基本資料。多頁共用，靠 queryKey ['trip', id] 共享快取，不重複抓。
export function useTrip(tripId: string | undefined) {
  return useQuery({
    queryKey: ['trip', tripId],
    enabled: !!tripId,
    queryFn: async (): Promise<Trip | null> => {
      const { data, error } = await tripsApi.get(tripId as string);
      if (error) throw error;
      return data;
    },
  });
}
