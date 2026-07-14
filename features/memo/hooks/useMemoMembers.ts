import { useQuery } from '@tanstack/react-query';
import { memoApi } from '../api';
import type { Member } from '@/lib/types';

// 備忘錄分頁用的成員清單。沿用原查詢（含 trip_id 篩選），維持原行為。
export function useMemoMembers(tripId: string | undefined) {
  return useQuery({
    queryKey: ['memo-members', tripId],
    enabled: !!tripId,
    queryFn: async (): Promise<Member[]> => {
      const { data } = await memoApi.listMembers(tripId as string);
      return data ?? [];
    },
  });
}
