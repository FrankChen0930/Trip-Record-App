import { supabase } from '@/lib/supabase/client';
import type { TripMemo } from '@/lib/types';

export const memoApi = {
  // 沿用原本以 trip_id 篩選的成員查詢，維持原行為
  listMembers: (tripId: string) =>
    supabase.from('trip_members').select('*').eq('trip_id', tripId),
  list: (tripId: string) =>
    supabase.from('trip_memos').select('*').eq('trip_id', tripId).order('sort_order', { ascending: true }),
  create: (memo: Partial<TripMemo>) =>
    supabase.from('trip_memos').insert([memo]).select().single(),
  update: (id: string, updates: Partial<TripMemo>) =>
    supabase.from('trip_memos').update(updates).eq('id', id),
  remove: (id: string) =>
    supabase.from('trip_memos').delete().eq('id', id),
};
