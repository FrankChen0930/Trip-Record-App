import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// 如果抓不到，就在控制台大聲呼救
if (!supabaseUrl || !supabaseAnonKey) {
  console.error("❌ 警告：環境變數抓不到！請檢查 .env.local 檔案");
  console.log("當前 URL:", supabaseUrl);
}

export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '');