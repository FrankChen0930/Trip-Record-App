import { useQuery } from '@tanstack/react-query';
import { tripsApi } from '../api';
import type { Trip } from '@/lib/types';

// 所有旅程（首頁列表用），queryKey ['trips']。
export function useTrips() {
  return useQuery({
    queryKey: ['trips'],
    queryFn: async (): Promise<Trip[]> => {
      const { data, error } = await tripsApi.list();
      if (error) throw error;
      return data ?? [];
    },
  });
}
