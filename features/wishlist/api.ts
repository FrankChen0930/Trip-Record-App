import { supabase } from '@/lib/supabase/client';

export const wishlistApi = {
  list: () =>
    supabase.from('wish_places').select('*').order('created_at', { ascending: false }),
  add: (row: Record<string, unknown>) =>
    supabase.from('wish_places').insert([row]),
  update: (id: string, data: Record<string, unknown>) =>
    supabase.from('wish_places').update(data).eq('id', id),
  remove: (id: string) =>
    supabase.from('wish_places').delete().eq('id', id),
};

// 存活檢查（走自家代理，金鑰在伺服器）
export async function fetchBusinessStatus(placeId: string): Promise<string | null> {
  const res = await fetch('/api/places/details', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ placeId }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(typeof data?.error === 'string' ? data.error : `HTTP ${res.status}`);
  return data.businessStatus ?? null;
}
