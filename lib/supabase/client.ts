import { createClient } from '@supabase/supabase-js';

// ===== 瀏覽器端 Supabase client =====
// 重構期：集中管理 client 建立。P2 導入 Auth 後，這裡會帶上使用者 session。

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ 環境變數抓不到，請檢查 .env.local（NEXT_PUBLIC_SUPABASE_URL / ANON_KEY）');
}

export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '');
