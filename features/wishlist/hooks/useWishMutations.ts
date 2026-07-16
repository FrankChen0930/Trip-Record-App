import { useEffect, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { wishlistApi, fetchBusinessStatus } from '../api';
import { WISHLIST_KEY } from './useWishPlaces';
import type { WishPlace } from '@/lib/types';

export function useAddWishPlace() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (row: Record<string, unknown>) => {
      const { error } = await wishlistApi.add(row);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: WISHLIST_KEY }),
  });
}

export function useUpdateWishPlace() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { id: string; data: Record<string, unknown> }) => {
      const { error } = await wishlistApi.update(vars.id, vars.data);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: WISHLIST_KEY }),
  });
}

export function useRemoveWishPlace() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await wishlistApi.remove(id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: WISHLIST_KEY }),
  });
}

// 手動「重新檢查」單一地點的存活狀態
export function useCheckWishStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (p: WishPlace) => {
      if (!p.place_id) throw new Error('此項目尚未定位，無法檢查');
      const status = await fetchBusinessStatus(p.place_id);
      const { error } = await wishlistApi.update(p.id, {
        business_status: status,
        status_checked_at: new Date().toISOString(),
      });
      if (error) throw error;
      return status;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: WISHLIST_KEY }),
  });
}

const STALE_DAYS = 30;
const STALE_BATCH = 5;

// 進頁面時自動補檢查：挑「超過 30 天沒檢查」的前 5 筆（有 place_id 者），逐筆更新。
// 每次 mount 只跑一輪，額度花費極低（Details 只取 businessStatus）。
export function useStaleStatusCheck(places: WishPlace[] | undefined) {
  const queryClient = useQueryClient();
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current || !places || places.length === 0) return;
    const cutoff = Date.now() - STALE_DAYS * 24 * 60 * 60 * 1000;
    const stale = places
      .filter((p) => p.place_id && (!p.status_checked_at || new Date(p.status_checked_at).getTime() < cutoff))
      .slice(0, STALE_BATCH);
    if (stale.length === 0) return;
    ran.current = true;

    (async () => {
      for (const p of stale) {
        try {
          const status = await fetchBusinessStatus(p.place_id as string);
          await wishlistApi.update(p.id, {
            business_status: status,
            status_checked_at: new Date().toISOString(),
          });
        } catch {
          // 單筆失敗不擋其他筆
        }
      }
      queryClient.invalidateQueries({ queryKey: WISHLIST_KEY });
    })();
  }, [places, queryClient]);
}
