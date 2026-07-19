import { useSyncExternalStore } from 'react';
import { useMembers } from './useMembers';
import type { Member } from '@/lib/types';

// storage 事件只在跨分頁時觸發；同分頁的身分變更（成員頁 PIN 登入）由該頁自身 state 處理。
const subscribe = (cb: () => void) => {
  window.addEventListener('storage', cb);
  return () => window.removeEventListener('storage', cb);
};

// 目前操作者的成員身分（沿用 localStorage.my_member_id，AuthBridge/PIN 登入都寫這把）。
// isAdmin：role === 'admin'（p9）。P2b 前僅供 UI 層顯示/隱藏，強制力等 RLS。
export function useCurrentMember(): { me: Member | null; isAdmin: boolean; myId: string | null } {
  const { data: members = [] } = useMembers();
  const myId = useSyncExternalStore(
    subscribe,
    () => localStorage.getItem('my_member_id'),
    () => null // SSR 期間視為未驗證
  );

  const me = members.find((m) => m.id === myId) ?? null;
  return { me, isAdmin: me?.role === 'admin', myId };
}
