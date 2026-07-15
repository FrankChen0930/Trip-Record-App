import { supabase } from '@/lib/supabase/client';
import type { Photo } from '@/lib/types';

// 照片資料存取：DB rows 走 Supabase，檔案本體走 R2（presigned 直傳）。
const R2_PUBLIC_URL = (process.env.NEXT_PUBLIC_R2_PUBLIC_URL ?? '').replace(/\/$/, '');

// 顯示網址：R2 照片由 storage_path + 環境變數組出來（之後換自訂網域只要改 env），
// 外部連結照片直接用 url 欄位。
export function photoDisplayUrl(photo: Photo): string {
  if (photo.is_storage && photo.storage_path && R2_PUBLIC_URL) {
    return `${R2_PUBLIC_URL}/${photo.storage_path}`;
  }
  return photo.url;
}

export function isVideoPath(path: string | null | undefined): boolean {
  return /\.(mp4|mov)$/i.test(path ?? '');
}

export const photosApi = {
  list: (tripId: string) =>
    supabase.from('trip_photos').select('*').eq('trip_id', tripId)
      .order('created_at', { ascending: true }),

  insert: (rows: Array<Pick<Photo, 'trip_id' | 'day' | 'url' | 'is_storage'> & { storage_path?: string }>) =>
    supabase.from('trip_photos').insert(rows),

  removeRow: (id: string) =>
    supabase.from('trip_photos').delete().eq('id', id),

  // 跟後端要 presigned PUT URL
  presign: async (tripId: string, day: number, ext: string) => {
    const res = await fetch('/api/photos/presign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tripId, day, ext }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? `presign 失敗（${res.status}）`);
    return json as { key: string; uploadUrl: string; contentType: string };
  },

  uploadToR2: async (uploadUrl: string, blob: Blob, contentType: string) => {
    const res = await fetch(uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': contentType },
      body: blob,
    });
    if (!res.ok) throw new Error(`R2 上傳失敗（${res.status}）`);
  },

  deleteObject: async (key: string) => {
    const res = await fetch('/api/photos/object', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key }),
    });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      throw new Error(json.error ?? `R2 刪除失敗（${res.status}）`);
    }
  },
};
