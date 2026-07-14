import { useMutation, useQueryClient } from '@tanstack/react-query';
import { groupsApi, type GroupData } from '../api';

export function useSaveGroup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { id: string | null; data: GroupData }) => {
      const { error } = vars.id
        ? await groupsApi.update(vars.id, vars.data)
        : await groupsApi.create(vars.data);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['groups'] }),
  });
}

export function useDeleteGroup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await groupsApi.remove(id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['groups'] });
      queryClient.invalidateQueries({ queryKey: ['group_members'] });
    },
  });
}

export function useToggleGroupMember() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { existingId: string | null; groupId: string; memberId: string }) => {
      const { error } = vars.existingId
        ? await groupsApi.removeMember(vars.existingId)
        : await groupsApi.addMember(vars.groupId, vars.memberId);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['group_members'] }),
  });
}
