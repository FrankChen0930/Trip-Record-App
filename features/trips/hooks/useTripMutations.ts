import { useMutation, useQueryClient } from '@tanstack/react-query';
import { tripsApi, type TripPayload } from '../api';

// 新增/編輯旅程。（2026-07-19 起不再自動生成每日 21:00 住宿預設格——住宿改用專屬住宿卡）
export function useSaveTrip() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { id: string | null; payload: TripPayload }) => {
      if (vars.id) {
        const { error } = await tripsApi.update(vars.id, vars.payload);
        if (error) throw error;
        return;
      }
      const { error } = await tripsApi.create(vars.payload);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['trips'] }),
  });
}

export function useDeleteTrip() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await tripsApi.remove(id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['trips'] }),
  });
}

export function useUploadCover() {
  return useMutation({
    mutationFn: (file: File) => tripsApi.uploadCover(file),
  });
}
