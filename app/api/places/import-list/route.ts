import { NextRequest, NextResponse } from 'next/server';
import { fetchGoogleMapsList } from '@/lib/googleList';

// Google Maps 已儲存清單匯入代理：貼分享連結 → 回傳清單名稱與所有地點（名稱/地址/座標）。
// body: { url: string }
export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json();
    if (typeof url !== 'string' || !url.trim() || url.length > 2000) {
      return NextResponse.json({ error: '連結格式錯誤' }, { status: 400 });
    }
    const result = await fetchGoogleMapsList(url.trim());
    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
