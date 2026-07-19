import { useMemo } from 'react';
import { useMembers } from './useMembers';
import { useCurrentMember } from './useCurrentMember';
import { useGroupMembers } from '@/features/groups/hooks/useGroups';
import type { Member } from '@/lib/types';

// 身分組可見性（p9）：admin 看得到全部成員；一般成員只看得到「跟自己同身分組」的成員（含自己）；
// 未驗證身分（沒有 my_member_id）看不到任何名冊。
export function useVisibleMembers(): { visible: Member[]; me: Member | null; isAdmin: boolean; isLoading: boolean } {
  const { data: members = [], isLoading } = useMembers();
  const { data: groupMembers = [] } = useGroupMembers();
  const { me, isAdmin } = useCurrentMember();

  const visible = useMemo(() => {
    if (isAdmin) return members;
    if (!me) return [];
    const myGroupIds = new Set(groupMembers.filter((gm) => gm.member_id === me.id).map((gm) => gm.group_id));
    const visibleIds = new Set(groupMembers.filter((gm) => myGroupIds.has(gm.group_id)).map((gm) => gm.member_id));
    visibleIds.add(me.id);
    return members.filter((m) => visibleIds.has(m.id));
  }, [members, groupMembers, me, isAdmin]);

  return { visible, me, isAdmin, isLoading };
}
