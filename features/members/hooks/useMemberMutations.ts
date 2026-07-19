import { useMutation, useQueryClient } from '@tanstack/react-query';
import { membersApi } from '../api';
import { groupsApi } from '@/features/groups/api';

// 新增成員（可同時掛進身分組）。成功後讓 ['members'] 與 ['group_members'] 快取失效重抓。
export function useAddMember() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { real_name: string; nickname: string; pin: string; groupIds?: string[] }) => {
      const { groupIds, ...member } = payload;
      const { data, error } = await membersApi.create(member);
      if (error) throw error;
      for (const groupId of groupIds ?? []) {
        const { error: gmErr } = await groupsApi.addMember(groupId, data.id);
        if (gmErr) throw gmErr;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['members'] });
      queryClient.invalidateQueries({ queryKey: ['group_members'] });
    },
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
