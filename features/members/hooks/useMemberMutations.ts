import { useMutation, useQueryClient } from '@tanstack/react-query';
import { membersApi } from '../api';

// 新增成員。成功後讓 ['members'] 快取失效重抓。
export function useAddMember() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { real_name: string; nickname: string; pin: string }) => {
      const { error } = await membersApi.create(payload);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['members'] }),
  });
}

// 刪除成員。
export function useDeleteMember() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await membersApi.remove(id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['members'] }),
  });
}
