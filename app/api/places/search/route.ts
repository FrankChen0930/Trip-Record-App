import { NextRequest, NextResponse } from 'next/server';
import { placesFetch } from '@/lib/places';

// 地點文字搜尋代理（Places Text Search）。
// body: { query: string, lat?: number, lng?: number }
// 有座標時以其為中心做 locationBias，讓「在台南搜咖啡」優先回台南的結果。
export async function POST(req: NextRequest) {
  try {
    const { query, lat, lng } = await req.json();
    if (typeof query !== 'string' || !query.trim() || query.length > 100) {
      return NextResponse.json({ error: 'query 格式錯誤' }, { status: 400 });
    }

    const body: Record<string, unknown> = {
      textQuery: query.trim(),
      maxResultCount: 8,
    };
    if (typeof lat === 'number' && typeof lng === 'number') {
      body.locationBias = { circle: { center: { latitude: lat, longitude: lng }, radius: 30000 } };
    }

    const places = await placesFetch('places:searchText', body);
    return NextResponse.json({ places });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
