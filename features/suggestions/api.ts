// 前端呼叫自家 Places 代理（app/api/places/*），不直接碰 Google、也拿不到金鑰。

export interface PlaceResult {
  placeId: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  rating: number | null;
  ratingCount: number | null;
  typeLabel: string | null;
}

export type NearbyKind = 'attraction' | 'food' | 'cafe';

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(typeof data?.error === 'string' ? data.error : `HTTP ${res.status}`);
  return data as T;
}

export const placesApi = {
  search: (query: string, center?: { lat: number; lng: number }) =>
    postJson<{ places: PlaceResult[] }>('/api/places/search', { query, ...(center ?? {}) }),
  nearby: (lat: number, lng: number, kind: NearbyKind) =>
    postJson<{ places: PlaceResult[] }>('/api/places/nearby', { lat, lng, kind }),
};
