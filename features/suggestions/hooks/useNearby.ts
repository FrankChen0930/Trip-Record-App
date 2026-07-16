import { useQuery } from '@tanstack/react-query';
import { placesApi, type NearbyKind } from '../api';

export interface NearbyRequest {
  lat: number;
  lng: number;
  kind: NearbyKind;
}

// 「按下探索才查」：座標取到小數三位（約 100m）當快取 key，小幅平移不重打。
export function useNearby(req: NearbyRequest | null) {
  const rounded = req
    ? { lat: Math.round(req.lat * 1000) / 1000, lng: Math.round(req.lng * 1000) / 1000, kind: req.kind }
    : null;
  return useQuery({
    queryKey: ['place-nearby', rounded],
    queryFn: async () => {
      const { places } = await placesApi.nearby(rounded!.lat, rounded!.lng, rounded!.kind);
      return places;
    },
    enabled: !!rounded,
    staleTime: Infinity,
    retry: 1,
  });
}
