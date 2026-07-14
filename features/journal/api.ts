import { supabase } from '@/lib/supabase/client';

// 每日日記資料存取。
export const journalApi = {
  list: (tripId: string) =>
    supabase.from('trip_journals').select('*').eq('trip_id', tripId),

  upsert: (payload: { trip_id: string; day: number; content: string }) =>
    supabase.from('trip_journals').upsert(
      { ...payload, updated_at: new Date().toISOString() },
      { onConflict: 'trip_id,day' }
    ),
};
