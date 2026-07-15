// 瀏覽器端影像壓縮：長邊縮到 2560px、輸出 WebP q0.82。
// createImageBitmap 的 imageOrientation: 'from-image' 會自動套用 EXIF 方向，
// 所以輸出的 WebP 不需要再帶方向資訊。
const MAX_EDGE = 2560;
const QUALITY = 0.82;

export const VIDEO_EXTS = ['mp4', 'mov'];

export function fileExt(name: string): string {
  return name.includes('.') ? name.split('.').pop()!.toLowerCase() : '';
}

export function isVideoFile(file: File): boolean {
  return file.type.startsWith('video/') || VIDEO_EXTS.includes(fileExt(file.name));
}

export async function compressToWebp(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  try {
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const w = Math.round(bitmap.width * scale);
    const h = Math.round(bitmap.height * scale);

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('無法建立 canvas context');
    ctx.drawImage(bitmap, 0, 0, w, h);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/webp', QUALITY)
    );
    if (!blob) throw new Error('WebP 轉檔失敗');
    // 極少數情況（小圖、已高度壓縮）轉出來反而更大，就用原檔
    return blob.size < file.size ? blob : file;
  } finally {
    bitmap.close();
  }
}
