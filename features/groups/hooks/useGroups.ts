import { useQuery } from '@tanstack/react-query';
import { groupsApi } from '../api';
import type { Group, GroupMember } from '@/lib/types';

export function useGroups() {
  return useQuery({
    queryKey: ['groups'],
    queryFn: async (): Promise<Group[]> => {
      const { data, error } = await groupsApi.list();
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useGroupMembers() {
  return useQuery({
    queryKey: ['group_members'],
    queryFn: async (): Promise<GroupMember[]> => {
      const { data, error } = await groupsApi.listMembers();
      if (error) throw error;
      return data ?? [];
    },
  });
}
