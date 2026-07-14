import { supabase } from '@/lib/supabase/client';

// 一筆支出寫入資料庫的形狀（新增/編輯共用）
export interface ExpenseInput {
  item_name: string;
  amount: number;
  payer: string;
  participants: string[];
  split_type: 'equal' | 'custom';
  split_details: Record<string, number> | null;
  trip_id: string | undefined;
}

export const expensesApi = {
  list: (tripId: string) =>
    supabase.from('trip_expenses').select('*').eq('trip_id', tripId).order('created_at', { ascending: false }),

  create: (payload: ExpenseInput) =>
    supabase.from('trip_expenses').insert([payload]),

  update: (id: string, payload: ExpenseInput) =>
    supabase.from('trip_expenses').update(payload).eq('id', id),

  remove: (id: string) =>
    supabase.from('trip_expenses').delete().eq('id', id),

  // 清帳：記一筆 is_transfer 還款
  insertTransfer: (tripId: string | undefined, debtor: string, creditor: string, amount: number) =>
    supabase.from('trip_expenses').insert([{
      item_name: '✔️ 結清款項',
      amount,
      payer: debtor,
      participants: [creditor],
      split_type: 'equal',
      is_transfer: true,
      trip_id: tripId,
    }]),
};
