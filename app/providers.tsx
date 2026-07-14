'use client';

import { useState } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { createQueryClient } from '@/lib/query-client';
import { ToastProvider } from '@/components/Toast';
import { ConfirmProvider } from '@/components/ConfirmDialog';
import { AuthBridge } from '@/features/auth/AuthBridge';

// 全站 Provider 組裝層。集中管理 QueryClient 與既有的 Toast / Confirm。
export function Providers({ children }: { children: React.ReactNode }) {
  // 用 useState 確保 QueryClient 在 client 端只建立一次
  const [queryClient] = useState(() => createQueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <ConfirmProvider>
          <AuthBridge />
          {children}
        </ConfirmProvider>
      </ToastProvider>
    </QueryClientProvider>
  );
}
