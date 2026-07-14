import { supabase } from '@/lib/supabase/client';

export interface TripPayload {
  name: string;
  start_date: string;
  end_date: string | null;
  cover_url: string;
  group_id: string | null;
}

// trips 資料存取。trip 基本資料幾乎每頁都會用到，集中於此。
export const tripsApi = {
  get: (tripId: string) =>
    supabase.from('trips').select('*').eq('id', tripId).single(),

  list: () =>
    supabase.from('trips').select('*').order('start_date', { ascending: false }),

  create: (payload: TripPayload) =>
    supabase.from('trips').insert([payload]).select().single(),

  update: (id: string, payload: TripPayload) =>
    supabase.from('trips').update(payload).eq('id', id),

  remove: (id: string) =>
    supabase.from('trips').delete().eq('id', id),

  insertItinerary: (rows: Record<string, unknown>[]) =>
    supabase.from('trip_itinerary').insert(rows),

  // 上傳封面到 Supabase Storage，回傳公開網址
  uploadCover: async (file: File): Promise<string> => {
    const ext = file.name.split('.').pop();
    const fileName = `${Math.random().toString(36).substring(2)}.${ext}`;
    const filePath = `covers/${fileName}`;
    const { error } = await supabase.storage.from('trip-covers').upload(filePath, file);
    if (error) throw error;
    const { data } = supabase.storage.from('trip-covers').getPublicUrl(filePath);
    return data.publicUrl;
  },
};
