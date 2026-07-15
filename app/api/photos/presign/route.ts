import { NextRequest, NextResponse } from 'next/server';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { getR2Client, R2_BUCKET } from '@/lib/r2';

// 簽發 R2 直傳用的 presigned PUT URL。
// TODO(P2b): RLS 啟用後，這裡要驗 Supabase session 才簽發。
const ALLOWED_EXT: Record<string, string> = {
  webp: 'image/webp',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  mp4: 'video/mp4',
  mov: 'video/quicktime',
};

export async function POST(req: NextRequest) {
  try {
    const { tripId, day, ext } = await req.json();
    if (typeof tripId !== 'string' || !/^[\w-]{1,64}$/.test(tripId)) {
      return NextResponse.json({ error: 'tripId 格式錯誤' }, { status: 400 });
    }
    const dayNum = Number(day);
    if (!Number.isInteger(dayNum) || dayNum < 0 || dayNum > 99) {
      return NextResponse.json({ error: 'day 格式錯誤' }, { status: 400 });
    }
    const contentType = ALLOWED_EXT[String(ext).toLowerCase()];
    if (!contentType) {
      return NextResponse.json({ error: `不支援的檔案類型：${ext}` }, { status: 400 });
    }

    const key = `trips/${tripId}/day${dayNum}/${crypto.randomUUID()}.${String(ext).toLowerCase()}`;
    const uploadUrl = await getSignedUrl(
      getR2Client(),
      new PutObjectCommand({ Bucket: R2_BUCKET, Key: key, ContentType: contentType }),
      { expiresIn: 600 }
    );

    return NextResponse.json({ key, uploadUrl, contentType });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
