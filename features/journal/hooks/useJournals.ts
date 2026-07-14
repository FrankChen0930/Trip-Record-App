import { useQuery } from '@tanstack/react-query';
import { journalApi } from '../api';
import type { Journal } from '@/lib/types';

// 取得某趟旅程的所有日記。
export function useJournals(tripId: string | undefined) {
  return useQuery({
    queryKey: ['journals', tripId],
    enabled: !!tripId,
    queryFn: async (): Promise<Journal[]> => {
      const { data, error } = await journalApi.list(tripId as string);
      if (error) throw error;
      return data ?? [];
    },
  });
}
