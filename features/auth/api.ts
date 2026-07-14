import { supabase } from '@/lib/supabase/client';

export const authApi = {
  // 寄送 Magic Link 登入信
  sendMagicLink: (email: string) =>
    supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: typeof window !== 'undefined' ? window.location.origin : undefined,
      },
    }),

  signOut: () => supabase.auth.signOut(),

  // 以 email 找成員（忽略大小寫）
  findMemberByEmail: (email: string) =>
    supabase.from('trip_members').select('*').ilike('email', email).maybeSingle(),

  // 以已綁定的 user_id 找成員（已認領過的帳號換 email 也認得出來）
  findMemberByUserId: (userId: string) =>
    supabase.from('trip_members').select('*').eq('user_id', userId).maybeSingle(),

  // 將成員綁定到目前登入的 Auth 使用者
  bindMember: (memberId: string, userId: string) =>
    supabase.from('trip_members').update({ user_id: userId }).eq('id', memberId),

  // 自助認領：PIN 與「尚未被綁定」都放在 where 條件裡一次驗證，
  // PIN 錯誤或該成員已被別人認領都會更新 0 筆（由呼叫端判斷）。
  claimMember: (params: { memberId: string; pin: string; userId: string; email: string }) =>
    supabase
      .from('trip_members')
      .update({ user_id: params.userId, email: params.email })
      .eq('id', params.memberId)
      .eq('pin', params.pin)
      .is('user_id', null)
      .select(),
};
