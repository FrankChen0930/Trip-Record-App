'use client';

import Link from 'next/link';
import { LogIn, LogOut, UserCircle } from 'lucide-react';
import { useToast } from '@/components/Toast';
import { useMembers } from '@/features/members/hooks/useMembers';
import { useSession } from '../hooks/useSession';
import { authApi } from '../api';

// 側邊欄的登入狀態入口：未登入顯示「登入」連結，
// 已登入顯示綁定成員的暱稱（尚未綁定則顯示 email）與登出鈕。
export function AuthStatus({ onNavigate }: { onNavigate?: () => void }) {
  const { session, loading } = useSession();
  const { data: members = [] } = useMembers();
  const { toast } = useToast();

  if (loading) return null;

  if (!session) {
    return (
      <Link
        href="/login"
        onClick={onNavigate}
        className="flex items-center gap-3 py-3 px-4 rounded-2xl text-[var(--color-ink-muted)] hover:bg-[var(--color-bg-page)] hover:text-[var(--color-ink)] transition-all"
      >
        <LogIn className="w-5 h-5 flex-shrink-0" />
        <div>
          <span className="text-sm font-bold block">登入</span>
          <span className="text-[9px] opacity-50 font-medium">Sign in</span>
        </div>
      </Link>
    );
  }

  const me = members.find((m) => m.user_id === session.user.id);
  const displayName = me?.nickname ?? session.user.email ?? '已登入';

  const handleSignOut = async () => {
    const { error } = await authApi.signOut();
    if (error) {
      toast(`登出失敗：${error.message}`, 'error');
      return;
    }
    if (typeof localStorage !== 'undefined') localStorage.removeItem('my_member_id');
    toast('已登出', 'info');
    onNavigate?.();
  };

  return (
    <div className="flex items-center gap-3 py-3 px-4 rounded-2xl bg-[var(--color-bg-page)]">
      <UserCircle className="w-5 h-5 flex-shrink-0" style={{ color: 'var(--color-primary)' }} />
      <div className="flex-1 min-w-0">
        <span className="text-sm font-bold block truncate" style={{ color: 'var(--color-ink)' }}>{displayName}</span>
        <span className="text-[9px] font-medium block truncate" style={{ color: 'var(--color-ink-muted)' }}>{session.user.email}</span>
      </div>
      <button
        onClick={handleSignOut}
        title="登出"
        className="w-8 h-8 flex-shrink-0 flex items-center justify-center rounded-xl text-gray-400 hover:text-red-500 hover:bg-red-50 transition-all"
      >
        <LogOut className="w-4 h-4" />
      </button>
    </div>
  );
}
