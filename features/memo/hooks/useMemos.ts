import { useQuery } from '@tanstack/react-query';
import { memoApi } from '../api';
import type { TripMemo } from '@/lib/types';

export function useMemos(tripId: string | undefined) {
  return useQuery({
    queryKey: ['memos', tripId],
    enabled: !!tripId,
    queryFn: async (): Promise<TripMemo[]> => {
      const { data } = await memoApi.list(tripId as string);
      return data ?? [];
    },
  });
}
