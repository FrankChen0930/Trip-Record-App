'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button, Card, Input } from '@/components/ui';
import { useToast } from '@/components/Toast';
import { useSession } from '@/features/auth/hooks/useSession';
import { authApi } from '@/features/auth/api';

export default function LoginPage() {
  const { session, loading } = useSession();
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) { toast('請輸入 email', 'warning'); return; }
    setSending(true);
    try {
      const { error } = await authApi.sendMagicLink(email.trim());
      if (error) throw error;
      setSent(true);
      toast('登入連結已寄出，請查收信箱', 'success');
    } catch (error) {
      toast('寄送失敗：' + (error instanceof Error ? error.message : '未知錯誤'), 'error');
    } finally {
      setSending(false);
    }
  };

  const handleSignOut = async () => {
    await authApi.signOut();
    if (typeof localStorage !== 'undefined') localStorage.removeItem('my_member_id');
    toast('已登出', 'info');
  };

  return (
    <div style={{ background: 'var(--color-bg-page)', minHeight: '100vh' }} className="flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <h1 style={{ color: 'var(--color-ink)' }} className="text-2xl font-black mb-1 text-center">Trip Record</h1>
        <p style={{ color: 'var(--color-ink-muted)' }} className="text-xs text-center mb-8">使用 Email 登入</p>

        <Card>
          {loading ? (
            <p style={{ color: 'var(--color-ink-muted)' }} className="text-sm text-center py-4">載入中…</p>
          ) : session ? (
            <div className="flex flex-col gap-4">
              <div>
                <p style={{ color: 'var(--color-ink-muted)' }} className="text-xs">已登入</p>
                <p style={{ color: 'var(--color-ink)' }} className="font-bold text-sm break-all">{session.user.email}</p>
              </div>
              <Link href="/"><Button style={{ width: '100%' }}>進入首頁</Button></Link>
              <Button variant="secondary" style={{ width: '100%' }} onClick={handleSignOut}>登出</Button>
            </div>
          ) : sent ? (
            <div className="text-center py-2">
              <p style={{ color: 'var(--color-ink)' }} className="font-bold text-sm mb-2">信件已寄出 📮</p>
              <p style={{ color: 'var(--color-ink-muted)' }} className="text-xs leading-relaxed">
                請到 <span className="font-bold break-all">{email}</span> 收信，點擊連結即可登入。
              </p>
              <button onClick={() => setSent(false)} style={{ color: 'var(--color-primary-strong)' }} className="text-xs underline mt-4">用其他 email</button>
            </div>
          ) : (
            <form onSubmit={handleSend} className="flex flex-col gap-4">
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoFocus
              />
              <Button type="submit" disabled={sending} style={{ width: '100%' }}>
                {sending ? '寄送中…' : '寄送登入連結'}
              </Button>
            </form>
          )}
        </Card>

        <p style={{ color: 'var(--color-ink-muted)' }} className="text-[11px] text-center mt-6 leading-relaxed">
          首次登入若對應不到成員，會出現認領畫面<br />（選擇自己並輸入 4 位 PIN 即可完成綁定）
        </p>
      </div>
    </div>
  );
}
