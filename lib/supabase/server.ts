import { createClient } from '@supabase/supabase-js';

// ===== 伺服器端 Supabase client（Route Handlers / Server Components 用）=====
// P0：先提供無 session 的 anon client，行為與前端一致。
// P2：導入 Supabase Auth 時，改用 @supabase/ssr 從 cookie 還原使用者 session，
//      讓 RLS 能依 auth.uid() 生效。屆時只需替換此函式內部實作。

export function createServerSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
