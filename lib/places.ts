// Google Places API (New) 伺服器端 helper。
// 金鑰只在伺服器讀取，前端一律透過 app/api/places/* 代理呼叫。
// TODO(P2b): RLS 啟用後，代理 route 要驗 Supabase session 才放行。

const PLACES_ENDPOINT = 'https://places.googleapis.com/v1';

// FieldMask 控制計費 SKU：只取名稱/座標/地址/評分/類型，維持在低價層級。
const FIELD_MASK = [
  'places.id',
  'places.displayName',
  'places.formattedAddress',
  'places.location',
  'places.rating',
  'places.userRatingCount',
  'places.primaryTypeDisplayName',
].join(',');

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

interface RawPlace {
  id: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  location?: { latitude?: number; longitude?: number };
  rating?: number;
  userRatingCount?: number;
  primaryTypeDisplayName?: { text?: string };
}

// 存活檢查：Place Details 只取 businessStatus（最低價 SKU 欄位）
export async function placeBusinessStatus(placeId: string): Promise<string | null> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) throw new Error('GOOGLE_PLACES_API_KEY 未設定');

  const res = await fetch(`${PLACES_ENDPOINT}/places/${encodeURIComponent(placeId)}`, {
    headers: {
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': 'id,businessStatus',
    },
  });
  if (res.status === 404) return 'NOT_FOUND'; // 地點已從 Google 下架
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Places Details ${res.status}: ${detail.slice(0, 300)}`);
  }
  const data: { businessStatus?: string } = await res.json();
  return data.businessStatus ?? null;
}

// 營業時間：Place Details 取 regularOpeningHours.weekdayDescriptions。
// 此欄位屬較高價 SKU，前端拿到後會永久快取進 trip_itinerary.opening_hours，每個地點只查一次。
export async function placeOpeningHours(placeId: string): Promise<string[] | null> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) throw new Error('GOOGLE_PLACES_API_KEY 未設定');

  const res = await fetch(`${PLACES_ENDPOINT}/places/${encodeURIComponent(placeId)}?languageCode=zh-TW`, {
    headers: {
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': 'id,regularOpeningHours.weekdayDescriptions',
    },
  });
  if (res.status === 404) return null; // 地點已從 Google 下架
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Places Details ${res.status}: ${detail.slice(0, 300)}`);
  }
  const data: { regularOpeningHours?: { weekdayDescriptions?: string[] } } = await res.json();
  return data.regularOpeningHours?.weekdayDescriptions ?? null;
}

export async function placesFetch(
  path: 'places:searchText' | 'places:searchNearby',
  body: Record<string, unknown>
): Promise<PlaceResult[]> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) throw new Error('GOOGLE_PLACES_API_KEY 未設定');

  const res = await fetch(`${PLACES_ENDPOINT}/${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': FIELD_MASK,
    },
    body: JSON.stringify({ languageCode: 'zh-TW', regionCode: 'TW', ...body }),
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Places API ${res.status}: ${detail.slice(0, 300)}`);
  }

  const data: { places?: RawPlace[] } = await res.json();
  return (data.places ?? [])
    .filter((p) => p.location?.latitude !== undefined && p.location?.longitude !== undefined)
    .map((p) => ({
      placeId: p.id,
      name: p.displayName?.text ?? '(未命名)',
      address: p.formattedAddress ?? '',
      lat: p.location!.latitude!,
      lng: p.location!.longitude!,
      rating: p.rating ?? null,
      ratingCount: p.userRatingCount ?? null,
      typeLabel: p.primaryTypeDisplayName?.text ?? null,
    }));
}
