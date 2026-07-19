import { useMembers } from './useMembers';
import { useVisibleMembers } from './useVisibleMembers';
import { useGroupMembers } from '@/features/groups/hooks/useGroups';
import { useTrip } from '@/features/trips/hooks/useTrip';
import type { Member } from '@/lib/types';

// 旅程範圍的成員名單（p9）：旅程掛在某身分組 → 只回該組成員（記帳的代墊/分攤、票券名單都用這份，
// 不再把全站成員都列出來）；旅程沒掛組（公開）→ 回操作者可見的成員。
// 不手動 memo（React Compiler 會處理；手動寫反而觸發 preserve-manual-memoization）。
export function useTripMembers(tripId: string | undefined): { data: Member[] } {
  const { data: trip } = useTrip(tripId);
  const { data: members = [] } = useMembers();
  const { data: groupMembers = [] } = useGroupMembers();
  const { visible } = useVisibleMembers();

  if (trip?.group_id) {
    const groupId = trip.group_id;
    const ids = new Set(groupMembers.filter((gm) => gm.group_id === groupId).map((gm) => gm.member_id));
    return { data: members.filter((m) => ids.has(m.id)) };
  }
  return { data: visible };
}
