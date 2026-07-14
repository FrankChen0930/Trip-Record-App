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
    mutationFn: async (row: { trip_id: string | undefined; category: string; title: string }) => {
      const { error } = await planApi.addBucket(row);
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
