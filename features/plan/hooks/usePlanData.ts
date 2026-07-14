import { useQuery } from '@tanstack/react-query';
import { planApi } from '../api';
import type { ItineraryItem, TripAccommodation, BucketItem } from '@/lib/types';

export interface PlanBundle {
  itinerary: ItineraryItem[];
  accommodations: TripAccommodation[];
  bucketList: BucketItem[];
}

// 規劃看板一次取回：行程 + 住宿 + 備選池。
export function usePlanData(tripId: string | undefined) {
  return useQuery({
    queryKey: ['plan', tripId],
    enabled: !!tripId,
    queryFn: async (): Promise<PlanBundle> => {
      const [itRes, accRes, blRes] = await Promise.all([
        planApi.listItinerary(tripId as string),
        planApi.listAccommodations(tripId as string),
        planApi.listBucket(tripId as string),
      ]);
      return {
        itinerary: itRes.data ?? [],
        accommodations: accRes.data ?? [],
        bucketList: blRes.data ?? [],
      };
    },
  });
}
