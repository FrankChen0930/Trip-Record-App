import { useMutation, useQueryClient } from '@tanstack/react-query';
import { tripsApi, type TripPayload } from '../api';

// 新增/編輯旅程。新增且有結束日期時，自動生成每日預設行程格。
export function useSaveTrip() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { id: string | null; payload: TripPayload; startDate: string; endDate: string }) => {
      if (vars.id) {
        const { error } = await tripsApi.update(vars.id, vars.payload);
        if (error) throw error;
        return;
      }
      const { data: newTrip, error } = await tripsApi.create(vars.payload);
      if (error) throw error;
      if (vars.endDate && newTrip) {
        const start = new Date(vars.startDate);
        const end = new Date(vars.endDate);
        const diffDays = Math.ceil(Math.abs(end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
        const presets = Array.from({ length: diffDays }, (_, i) => ({
          trip_id: newTrip.id, day: i + 1, start_time: '21:00:00', location: '🏨 預計住宿點',
          transport_type: '機車', note: '自動生成的預設格，請點擊編輯修改地點。', item_type: 'activity',
        }));
        const { error: presetErr } = await tripsApi.insertItinerary(presets);
        if (presetErr) throw presetErr;
      }
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
