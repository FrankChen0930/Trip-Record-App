import { useMutation, useQueryClient } from '@tanstack/react-query';
import { planApi } from '../api';
import type { BucketItem, ItineraryItem } from '@/lib/types';
import type { PlanBundle } from './usePlanData';

const planKey = (tripId: string | undefined) => ['plan', tripId];

// 拖曳備選項目到時間格：樂觀地把它移進行程、移出備選池，再寫入 DB。
export function useAssignBucket(tripId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { bucketItem: BucketItem; day: number; time: string }) => {
      const { error: insErr } = await planApi.insertItinerary({
        trip_id: tripId, day: vars.day, start_time: vars.time, location: vars.bucketItem.title,
        transport_type: '機車', item_type: 'activity',
        note: vars.bucketItem.note || null, map_url: vars.bucketItem.link || null,
        // 備選池項目若已定位，座標一併帶進行程（P5a）
        lat: vars.bucketItem.lat ?? null, lng: vars.bucketItem.lng ?? null,
        place_id: vars.bucketItem.place_id ?? null,
      });
      if (insErr) throw insErr;
      const { error: delErr } = await planApi.removeBucket(vars.bucketItem.id);
      if (delErr) throw delErr;
    },
    onMutate: async (vars) => {
      queryClient.setQueryData<PlanBundle>(planKey(tripId), (old) => {
        if (!old) return old;
        const tempItem: ItineraryItem = {
          id: `temp-${Date.now()}`, trip_id: tripId as string, day: vars.day, start_time: vars.time,
          end_time: null, location: vars.bucketItem.title, transport_type: '機車', item_type: 'activity',
          note: vars.bucketItem.note ?? null, map_url: vars.bucketItem.link ?? null,
          lat: vars.bucketItem.lat ?? null, lng: vars.bucketItem.lng ?? null,
          place_id: vars.bucketItem.place_id ?? null,
        };
        return {
          ...old,
          itinerary: [...old.itinerary, tempItem],
          bucketList: old.bucketList.filter((b) => b.id !== vars.bucketItem.id),
        };
      });
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: planKey(tripId) }),
  });
}

export function useInsertItinerary(tripId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { day: number; time: string; title: string }) => {
      const { error } = await planApi.insertItinerary({
        trip_id: tripId, day: vars.day, start_time: vars.time, location: vars.title,
        item_type: 'activity', transport_type: '機車',
      });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: planKey(tripId) }),
  });
}

// P5d: 行程卡拖到另一個時間格 → 改天/改時間（樂觀更新）
export function useMoveItinerary(tripId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { id: string; day: number; time: string }) => {
      const { error } = await planApi.updateItinerary(vars.id, { day: vars.day, start_time: vars.time });
      if (error) throw error;
    },
    onMutate: async (vars) => {
      queryClient.setQueryData<PlanBundle>(planKey(tripId), (old) => {
        if (!old) return old;
        return {
          ...old,
          itinerary: old.itinerary.map((i) =>
            i.id === vars.id ? { ...i, day: vars.day, start_time: vars.time } : i
          ),
        };
      });
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: planKey(tripId) }),
  });
}

// P5d: 行程卡拖回備選池 → 退回備選（保留名稱/備註/連結/座標），與 useAssignBucket 互為鏡像
export function useUnassignItinerary(tripId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (item: ItineraryItem) => {
      // map_url 若是多景點 JSON 陣列就不帶回（備選池 link 是單一網址）
      const link = item.map_url && !item.map_url.startsWith('[') ? item.map_url : null;
      const { error: insErr } = await planApi.addBucket({
        trip_id: tripId, category: 'attraction', title: item.location,
        note: item.note ?? null, link,
        lat: item.lat ?? null, lng: item.lng ?? null, place_id: item.place_id ?? null,
      });
      if (insErr) throw insErr;
      const { error: delErr } = await planApi.removeItinerary(item.id);
      if (delErr) throw delErr;
    },
    onMutate: async (item) => {
      queryClient.setQueryData<PlanBundle>(planKey(tripId), (old) => {
        if (!old) return old;
        const tempBucket: BucketItem = {
          id: `temp-${Date.now()}`, trip_id: tripId as string, category: 'attraction',
          title: item.location, note: item.note ?? undefined,
          link: item.map_url && !item.map_url.startsWith('[') ? item.map_url : undefined,
          lat: item.lat ?? null, lng: item.lng ?? null, place_id: item.place_id ?? null,
          created_at: new Date().toISOString(),
        };
        return {
          ...old,
          itinerary: old.itinerary.filter((i) => i.id !== item.id),
          bucketList: [tempBucket, ...old.bucketList],
        };
      });
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: planKey(tripId) }),
  });
}

// P5d: 行程卡點擊編輯
export function useUpdateItineraryItem(tripId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { id: string; data: Record<string, unknown> }) => {
      const { error } = await planApi.updateItinerary(vars.id, vars.data);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: planKey(tripId) }),
  });
}

// P5d: 備選池卡片編輯 / 刪除
export function useUpdateBucketItem(tripId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { id: string; data: Record<string, unknown> }) => {
      const { error } = await planApi.updateBucket(vars.id, vars.data);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: planKey(tripId) }),
  });
}

export function useRemoveBucketItem(tripId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await planApi.removeBucket(id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: planKey(tripId) }),
  });
}

export function useRemoveItinerary(tripId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await planApi.removeItinerary(id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: planKey(tripId) }),
  });
}

export function useAddBucket(tripId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (row: Parameters<typeof planApi.addBucket>[0]) => {
      const { error } = await planApi.addBucket(row);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: planKey(tripId) }),
  });
}

// 從地圖/建議加入備選池：帶完整地點資訊（P5b）
export interface BucketPlaceInput {
  lat: number;
  lng: number;
  place_id: string;
  address: string | null;
  rating: number | null;
}

export function useAddBucketPlace(tripId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { category: string; title: string } & BucketPlaceInput) => {
      const { error } = await planApi.addBucket({ trip_id: tripId, ...vars });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: planKey(tripId) }),
  });
}

// 既有備選池項目補定位（例：台南備選池的舊資料）
export function useUpdateBucketPlace(tripId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { id: string } & BucketPlaceInput) => {
      const { id, ...data } = vars;
      const { error } = await planApi.updateBucket(id, data);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: planKey(tripId) }),
  });
}

export function useSaveAccommodation(tripId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { id: string | null; day: number; name: string; mapUrl: string; bookingUrl: string }) => {
      if (vars.id) {
        const { error } = await planApi.updateAccommodation(vars.id, { name: vars.name, map_url: vars.mapUrl, booking_url: vars.bookingUrl });
        if (error) throw error;
      } else {
        const { error } = await planApi.insertAccommodation({ trip_id: tripId, day: vars.day, name: vars.name, map_url: vars.mapUrl, booking_url: vars.bookingUrl });
        if (error) throw error;
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: planKey(tripId) }),
  });
}
