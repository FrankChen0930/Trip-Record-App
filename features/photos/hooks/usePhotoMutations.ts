import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { photosApi } from '../api';
import { compressToWebp, fileExt, isVideoFile } from '../lib/compress';
import type { Photo } from '@/lib/types';

// 上傳多個檔案到 R2：照片先壓 WebP，影片原檔直傳；全部成功的批次 insert DB。
// progress 回報「第幾個 / 總數」供 UI 顯示。
export function useUploadPhotos(tripId: string | undefined) {
  const queryClient = useQueryClient();
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

  const mutation = useMutation({
    mutationFn: async (vars: { files: File[]; day: number }) => {
      const { files, day } = vars;
      const rows: Array<Pick<Photo, 'trip_id' | 'day' | 'url' | 'is_storage'> & { storage_path: string }> = [];
      const failed: string[] = [];
      setProgress({ done: 0, total: files.length });

      for (const file of files) {
        try {
          const video = isVideoFile(file);
          const blob = video ? file : await compressToWebp(file);
          const ext = video ? (fileExt(file.name) || 'mp4') : (blob === file ? (fileExt(file.name) || 'jpg') : 'webp');
          const { key, uploadUrl, contentType } = await photosApi.presign(tripId as string, day, ext);
          await photosApi.uploadToR2(uploadUrl, blob, contentType);
          rows.push({ trip_id: tripId as string, day, url: '', storage_path: key, is_storage: true });
        } catch (e) {
          console.error('upload failed:', file.name, e);
          failed.push(file.name);
        } finally {
          setProgress((p) => (p ? { ...p, done: p.done + 1 } : p));
        }
      }

      if (rows.length > 0) {
        const { error } = await photosApi.insert(rows);
        if (error) throw error;
      }
      return { uploaded: rows.length, failed };
    },
    onSettled: () => {
      setProgress(null);
      queryClient.invalidateQueries({ queryKey: ['photos', tripId] });
    },
  });

  return { ...mutation, progress };
}

// 貼外部連結（Google Drive / 相簿等）。
export function useAddPhotoLink(tripId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { url: string; day: number }) => {
      const { error } = await photosApi.insert([{
        trip_id: tripId as string,
        day: vars.day,
        url: vars.url,
        is_storage: false,
      }]);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['photos', tripId] }),
  });
}

// 刪除照片：先刪 R2 物件（若有），再刪 DB row。
export function useDeletePhoto(tripId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (photo: Photo) => {
      if (photo.is_storage && photo.storage_path?.startsWith('trips/')) {
        await photosApi.deleteObject(photo.storage_path);
      }
      const { error } = await photosApi.removeRow(photo.id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['photos', tripId] }),
  });
}
