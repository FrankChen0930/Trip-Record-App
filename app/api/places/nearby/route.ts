import { NextRequest, NextResponse } from 'next/server';
import { placesFetch } from '@/lib/places';

// 建議景點代理（Places Nearby Search）。
// body: { lat: number, lng: number, kind?: 'attraction' | 'food' | 'cafe' }
const KIND_TYPES: Record<string, string[]> = {
  attraction: ['tourist_attraction'],
  food: ['restaurant'],
  cafe: ['cafe', 'bakery'],
};

export async function POST(req: NextRequest) {
  try {
    const { lat, lng, kind } = await req.json();
    if (typeof lat !== 'number' || typeof lng !== 'number') {
      return NextResponse.json({ error: 'lat/lng 格式錯誤' }, { status: 400 });
    }
    const includedTypes = KIND_TYPES[String(kind ?? 'attraction')];
    if (!includedTypes) {
      return NextResponse.json({ error: `不支援的類型：${kind}` }, { status: 400 });
    }

    const places = await placesFetch('places:searchNearby', {
      includedTypes,
      maxResultCount: 12,
      rankPreference: 'POPULARITY',
      locationRestriction: {
        circle: { center: { latitude: lat, longitude: lng }, radius: 3000 },
      },
    });
    return NextResponse.json({ places });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
