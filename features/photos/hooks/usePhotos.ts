import { useQuery } from '@tanstack/react-query';
import { photosApi } from '../api';
import type { Photo } from '@/lib/types';

// 取得某趟旅程的所有照片（拍攝順序 = created_at 升冪）。
export function usePhotos(tripId: string | undefined) {
  return useQuery({
    queryKey: ['photos', tripId],
    enabled: !!tripId,
    queryFn: async (): Promise<Photo[]> => {
      const { data, error } = await photosApi.list(tripId as string);
      if (error) throw error;
      return data ?? [];
    },
  });
}
