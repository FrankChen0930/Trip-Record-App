import { useMutation, useQueryClient } from '@tanstack/react-query';
import { memoApi } from '../api';
import type { TripMemo } from '@/lib/types';

const memosKey = (tripId: string | undefined) => ['memos', tripId];

// 新增備忘錄：成功後把新項目併入快取
export function useAddMemo(tripId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (memo: Partial<TripMemo>) => {
      const { data, error } = await memoApi.create(memo);
      if (error) throw error;
      return data as TripMemo;
    },
    onSuccess: (created) => {
      queryClient.setQueryData<TripMemo[]>(memosKey(tripId), (old) => [...(old ?? []), created]);
    },
  });
}

// 更新備忘錄：樂觀更新快取（不重抓，避免打字游標跳動），與原本的本機即時更新一致
export function useUpdateMemo(tripId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { id: string; updates: Partial<TripMemo> }) => {
      const { error } = await memoApi.update(vars.id, vars.updates);
      if (error) throw error;
    },
    onMutate: async (vars) => {
      queryClient.setQueryData<TripMemo[]>(memosKey(tripId), (old) =>
        (old ?? []).map((m) => (m.id === vars.id ? { ...m, ...vars.updates } : m)));
    },
  });
}

export function useDeleteMemo(tripId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await memoApi.remove(id);
      if (error) throw error;
    },
    onMutate: async (id) => {
      queryClient.setQueryData<TripMemo[]>(memosKey(tripId), (old) => (old ?? []).filter((m) => m.id !== id));
    },
  });
}
