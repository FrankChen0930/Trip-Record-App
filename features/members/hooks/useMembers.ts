import { useQuery } from '@tanstack/react-query';
import { membersApi } from '../api';
import type { Member } from '@/lib/types';

// 全體成員名冊（全域共用，queryKey ['members']）。
export function useMembers() {
  return useQuery({
    queryKey: ['members'],
    queryFn: async (): Promise<Member[]> => {
      const { data, error } = await membersApi.list();
      if (error) throw error;
      return data ?? [];
    },
  });
}
