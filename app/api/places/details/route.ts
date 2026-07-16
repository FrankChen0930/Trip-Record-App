import { NextRequest, NextResponse } from 'next/server';
import { placeBusinessStatus } from '@/lib/places';

// 探索清單存活檢查代理：回傳地點的 businessStatus。
// body: { placeId: string }
export async function POST(req: NextRequest) {
  try {
    const { placeId } = await req.json();
    if (typeof placeId !== 'string' || !placeId.trim() || placeId.length > 300) {
      return NextResponse.json({ error: 'placeId 格式錯誤' }, { status: 400 });
    }
    const businessStatus = await placeBusinessStatus(placeId.trim());
    return NextResponse.json({ businessStatus });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
