import { supabase } from '@/lib/supabase/client';

export interface GroupData { name: string; color: string; icon: string; }

export const groupsApi = {
  list: () => supabase.from('groups').select('*').order('created_at'),
  create: (data: GroupData) => supabase.from('groups').insert([data]),
  update: (id: string, data: GroupData) => supabase.from('groups').update(data).eq('id', id),
  remove: (id: string) => supabase.from('groups').delete().eq('id', id),

  listMembers: () => supabase.from('group_members').select('*'),
  addMember: (groupId: string, memberId: string) =>
    supabase.from('group_members').insert([{ group_id: groupId, member_id: memberId }]),
  removeMember: (id: string) => supabase.from('group_members').delete().eq('id', id),
};
