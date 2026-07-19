import { supabase } from '@/lib/supabase/client';

// 成員名冊資料存取。
export const membersApi = {
  list: () =>
    supabase.from('trip_members').select('*').order('created_at', { ascending: true }),

  create: (payload: { real_name: string; nickname: string; pin: string }) =>
    supabase.from('trip_members').insert([payload]).select().single(),

  remove: (id: string) =>
    supabase.from('trip_members').delete().eq('id', id),
};
