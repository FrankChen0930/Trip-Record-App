import { useMutation, useQueryClient } from '@tanstack/react-query';
import { expensesApi, type ExpenseInput } from '../api';

function useInvalidateExpenses(tripId: string | undefined) {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ['expenses', tripId] });
}

// 新增或編輯支出（有 id 走 update，無 id 走 insert）
export function useSaveExpense(tripId: string | undefined) {
  const invalidate = useInvalidateExpenses(tripId);
  return useMutation({
    mutationFn: async (vars: { id: string | null; payload: ExpenseInput }) => {
      const { error } = vars.id
        ? await expensesApi.update(vars.id, vars.payload)
        : await expensesApi.create(vars.payload);
      if (error) throw error;
    },
    onSuccess: () => invalidate(),
  });
}

export function useDeleteExpense(tripId: string | undefined) {
  const invalidate = useInvalidateExpenses(tripId);
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await expensesApi.remove(id);
      if (error) throw error;
    },
    onSuccess: () => invalidate(),
  });
}

export function useSettleDebt(tripId: string | undefined) {
  const invalidate = useInvalidateExpenses(tripId);
  return useMutation({
    mutationFn: async (vars: { debtor: string; creditor: string; amount: number }) => {
      const { error } = await expensesApi.insertTransfer(tripId, vars.debtor, vars.creditor, vars.amount);
      if (error) throw error;
    },
    onSuccess: () => invalidate(),
  });
}
