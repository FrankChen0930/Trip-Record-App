'use client';

import { useEffect, useState } from 'react';
import { useSession } from './hooks/useSession';
import { authApi } from './api';
import { ClaimMember } from './components/ClaimMember';

// 橋接層：登入後把 Auth 帳號對應到 trip_members 成員，並把成員 id 寫入
// localStorage 的 my_member_id —— 讓現有頁面（仍以此識別「我」）無痛沿用。
// 對應順序：
//   1) user_id（已認領/綁定過的帳號，換 email 也認得）
//   2) email 對得到且該成員未被綁定 → 自動綁定
//   3) 都對不到 → 顯示自助認領畫面（選成員 + 輸入 4 位 PIN）
// P2b 開啟 RLS 後，可改為純 session 識別並移除這個橋接。
export function AuthBridge() {
  const { session } = useSession();
  const [needsClaim, setNeedsClaim] = useState(false);

  const email = session?.user?.email;
  const userId = session?.user?.id;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // 未登入（或登出）：重置認領狀態
      if (!email || !userId) {
        setNeedsClaim(false);
        return;
      }

      // 1) 已綁定過：直接以 user_id 認出
      const { data: bound } = await authApi.findMemberByUserId(userId);
      if (cancelled) return;
      if (bound) {
        if (typeof localStorage !== 'undefined') localStorage.setItem('my_member_id', bound.id);
        setNeedsClaim(false);
        return;
      }

      // 2) email 對得到且尚未被任何帳號綁定：自動綁定
      const { data: member } = await authApi.findMemberByEmail(email);
      if (cancelled) return;
      if (member && !member.user_id) {
        await authApi.bindMember(member.id, userId);
        if (cancelled) return;
        if (typeof localStorage !== 'undefined') localStorage.setItem('my_member_id', member.id);
        setNeedsClaim(false);
        return;
      }

      // 3) 對不到（或該 email 的成員已被別的帳號綁走）：進入自助認領
      setNeedsClaim(true);
    })();

    return () => { cancelled = true; };
  }, [email, userId]);

  if (!needsClaim || !email || !userId) return null;
  return <ClaimMember email={email} userId={userId} onClose={() => setNeedsClaim(false)} />;
}
