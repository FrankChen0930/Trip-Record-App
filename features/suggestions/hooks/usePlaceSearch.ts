import { useQuery } from '@tanstack/react-query';
import { placesApi } from '../api';

export interface PlaceSearchRequest {
  query: string;
  lat?: number;
  lng?: number;
}

// 「送出才查」：呼叫端按下搜尋時才設定 req（避免打字過程狂打 API）。
// 同參數的結果永久快取，重搜同字串不再計費。
export function usePlaceSearch(req: PlaceSearchRequest | null) {
  return useQuery({
    queryKey: ['place-search', req],
    queryFn: async () => {
      const center = req!.lat !== undefined && req!.lng !== undefined
        ? { lat: req!.lat, lng: req!.lng }
        : undefined;
      const { places } = await placesApi.search(req!.query, center);
      return places;
    },
    enabled: !!req && req.query.trim().length > 0,
    staleTime: Infinity,
    retry: 1,
  });
}
