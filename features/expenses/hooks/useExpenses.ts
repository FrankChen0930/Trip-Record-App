import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase/client';
import { expensesApi } from '../api';
import type { Expense } from '@/lib/types';

// 取得某趟旅程的支出，並內建 Realtime 訂閱：trip_expenses 一有變動就讓快取失效重抓。
export function useExpenses(tripId: string | undefined) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['expenses', tripId],
    enabled: !!tripId,
    queryFn: async (): Promise<Expense[]> => {
      const { data, error } = await expensesApi.list(tripId as string);
      if (error) throw error;
      return data ?? [];
    },
  });

  useEffect(() => {
    if (!tripId) return;
    const channel = supabase
      .channel(`exp-${tripId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trip_expenses' },
        () => queryClient.invalidateQueries({ queryKey: ['expenses', tripId] }))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [tripId, queryClient]);

  return query;
}
