import { NextRequest, NextResponse } from 'next/server';
import { DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getR2Client, R2_BUCKET } from '@/lib/r2';

// 刪除 R2 上的照片物件（DB row 由前端另行刪除）。
// TODO(P2b): RLS 啟用後，這裡要驗 Supabase session 才允許刪除。
export async function DELETE(req: NextRequest) {
  try {
    const { key } = await req.json();
    // 只允許刪 trips/ 底下的物件，避免這支 API 被拿來亂刪 bucket
    if (typeof key !== 'string' || !key.startsWith('trips/') || key.includes('..')) {
      return NextResponse.json({ error: 'key 格式錯誤' }, { status: 400 });
    }
    await getR2Client().send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: key }));
    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
