// 相容層：既有頁面以 `import { supabase } from '@/lib/supabase'` 匯入。
// 實作已移到 lib/supabase/client.ts，這裡轉出以避免一次大量改 import。
// 新程式碼請直接 import from '@/lib/supabase/client'（前端）或 '@/lib/supabase/server'（伺服器端）。
export { supabase } from './supabase/client';
