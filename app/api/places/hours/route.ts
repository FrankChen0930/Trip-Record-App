import { NextRequest, NextResponse } from 'next/server';
import { placeOpeningHours } from '@/lib/places';

// 行程卡營業時間代理：回傳地點的每週營業時間文字（zh-TW）。
// body: { placeId: string }；查無資訊時 weekdayDescriptions 為 null。
export async function POST(req: NextRequest) {
  try {
    const { placeId } = await req.json();
    if (typeof placeId !== 'string' || !placeId.trim() || placeId.length > 300) {
      return NextResponse.json({ error: 'placeId 格式錯誤' }, { status: 400 });
    }
    const weekdayDescriptions = await placeOpeningHours(placeId.trim());
    return NextResponse.json({ weekdayDescriptions });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
