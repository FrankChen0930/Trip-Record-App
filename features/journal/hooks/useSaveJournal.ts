import { useMutation, useQueryClient } from '@tanstack/react-query';
import { journalApi } from '../api';

// 儲存（upsert）某天的日記。成功後讓 ['journals', tripId] 快取失效並重抓，
// 取代原本手動再 select 一次的寫法。
export function useSaveJournal(tripId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (vars: { day: number; content: string }) => {
      const { error } = await journalApi.upsert({
        trip_id: tripId as string,
        day: vars.day,
        content: vars.content,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['journals', tripId] });
    },
  });
}
