import { QueryClient } from '@tanstack/react-query';

// 統一的 TanStack Query 設定。各 feature 的 hooks 共用這套快取策略。
export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,          // 30 秒內視為新鮮，避免重複抓
        gcTime: 5 * 60_000,         // 5 分鐘後回收快取
        refetchOnWindowFocus: false,
        retry: 1,
      },
      mutations: {
        retry: 0,
      },
    },
  });
}
