# features/ — 功能模組

重構後採 feature-based 結構：同一功能的 UI、hooks、資料存取收在一起，頁面（`app/`）只負責組裝。

## 每個 feature 的慣例結構

```
features/<name>/
├── components/   # 此功能專屬的 UI 元件（頁面從這裡組裝）
├── hooks/        # 以 TanStack Query 包裝的資料 hooks（useXxx）
└── api.ts        # 集中此功能的 Supabase 查詢/寫入（取代散落的 fetchData）
```

## 資料流規範

- 伺服器資料一律走 `api.ts` + TanStack Query hook（不在頁面直接 `supabase.from(...)`）。
- 跨頁的小型 UI / 身份狀態放 `stores/`（Zustand）。
- 設計系統 primitives 從 `@/components/ui` 取用，不再各頁手寫樣式。

## 範例（P1 會逐步落地）

```ts
// features/expenses/api.ts
import { supabase } from '@/lib/supabase/client';
export const expensesApi = {
  list: (tripId: string) =>
    supabase.from('trip_expenses').select('*').eq('trip_id', tripId),
};

// features/expenses/hooks/useExpenses.ts
import { useQuery } from '@tanstack/react-query';
import { expensesApi } from '../api';
export function useExpenses(tripId: string) {
  return useQuery({
    queryKey: ['expenses', tripId],
    queryFn: async () => {
      const { data, error } = await expensesApi.list(tripId);
      if (error) throw error;
      return data;
    },
  });
}
```

## 模組清單

trips · itinerary · expenses · photos · plan · memo · journal · members · groups · map · suggestions · auth
