import { useQuery } from '@tanstack/react-query';
import { wishlistApi } from '../api';
import type { WishPlace } from '@/lib/types';

export const WISHLIST_KEY = ['wish-places'];

export function useWishPlaces() {
  return useQuery({
    queryKey: WISHLIST_KEY,
    queryFn: async () => {
      const { data, error } = await wishlistApi.list();
      if (error) throw error;
      return (data ?? []) as WishPlace[];
    },
  });
}

// 顯示用狀態：綜合「限時截止日」與 Google businessStatus
export type WishDisplayStatus = 'ok' | 'expired' | 'closed_temp' | 'closed' | 'unknown';

export function wishStatus(p: WishPlace): WishDisplayStatus {
  if (p.expires_at && new Date(p.expires_at + 'T23:59:59') < new Date()) return 'expired';
  if (p.business_status === 'CLOSED_PERMANENTLY' || p.business_status === 'NOT_FOUND') return 'closed';
  if (p.business_status === 'CLOSED_TEMPORARILY') return 'closed_temp';
  if (p.business_status === 'OPERATIONAL') return 'ok';
  return 'unknown';
}
