'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button, Card, Input } from '@/components/ui';
import { useToast } from '@/components/Toast';
import { useMembers } from '@/features/members/hooks/useMembers';
import { authApi } from '../api';
import type { Member } from '@/lib/types';

interface ClaimMemberProps {
  email: string;
  userId: string;
  onClose: () => void;
}

// 自助認領畫面：登入的 email 對不到任何成員時全站顯示。
// 使用者選擇自己是哪位成員並輸入該成員的 4 位 PIN，
// 驗證通過即把該成員綁定到目前登入帳號（user_id + email）。
export function ClaimMember({ email, userId, onClose }: ClaimMemberProps) {
  const { data: members = [], isLoading, isError, refetch } = useMembers();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pin, setPin] = useState('');

  // 只列出尚未被任何帳號認領的成員
  const unbound = useMemo(() => members.filter((m) => !m.user_id), [members]);

  const claim = useMutation({
    mutationFn: async (): Promise<Member> => {
      if (!selectedId) throw new Error('請先選擇你是哪位成員');
      const { data, error } = await authApi.claimMember({ memberId: selectedId, pin, userId, email });
      if (error) throw error;
      const claimed = (data ?? [])[0] as Member | undefined;
      if (!claimed) throw new Error('PIN 不正確，或該成員已被認領');
      return claimed;
    },
    onSuccess: (member) => {
      if (typeof localStorage !== 'undefined') localStorage.setItem('my_member_id', member.id);
      queryClient.invalidateQueries({ queryKey: ['members'] });
      toast(`綁定成功，歡迎 ${member.nickname}！`, 'success');
      onClose();
    },
    onError: (error) => {
      toast(error instanceof Error ? error.message : '未知錯誤', 'error');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedId) { toast('請先選擇你是哪位成員', 'warning'); return; }
    if (pin.length !== 4) { toast('請輸入 4 位數 PIN', 'warning'); return; }
    claim.mutate();
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-6 overflow-y-auto"
      style={{ background: 'rgba(31, 42, 39, 0.45)' }}
    >
      <Card className="w-full max-w-sm">
        <h2 style={{ color: 'var(--color-ink)' }} className="font-black text-lg mb-1">認領你的成員檔案</h2>
        <p style={{ color: 'var(--color-ink-muted)' }} className="text-xs leading-relaxed mb-4">
          <span className="font-bold break-all">{email}</span> 還沒有對應的成員。
          請選擇你是哪位成員，並輸入你的 4 位 PIN 完成綁定。
        </p>

        {isLoading ? (
          <p style={{ color: 'var(--color-ink-muted)' }} className="text-sm text-center py-6">載入成員中…</p>
        ) : isError ? (
          <div className="text-center py-4">
            <p style={{ color: 'var(--color-ink)' }} className="text-sm font-bold mb-2">成員名單載入失敗</p>
            <p style={{ color: 'var(--color-ink-muted)' }} className="text-xs mb-4">請檢查網路連線後重試。</p>
            <Button variant="secondary" style={{ width: '100%' }} onClick={() => refetch()}>重試</Button>
            <Button variant="ghost" style={{ width: '100%', marginTop: 8 }} onClick={onClose}>稍後再說</Button>
          </div>
        ) : unbound.length === 0 ? (
          <div className="text-center py-4">
            <p style={{ color: 'var(--color-ink)' }} className="text-sm font-bold mb-2">所有成員都已被認領</p>
            <p style={{ color: 'var(--color-ink-muted)' }} className="text-xs mb-4">
              若你認為有誤，請聯絡管理者處理。
            </p>
            <Button variant="secondary" style={{ width: '100%' }} onClick={onClose}>知道了</Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-wrap gap-2">
              {unbound.map((m) => {
                const selected = m.id === selectedId;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setSelectedId(m.id)}
                    className="px-3 py-1.5 text-sm font-medium transition-colors"
                    style={{
                      borderRadius: 'var(--radius-pill)',
                      background: selected ? 'var(--color-primary)' : 'var(--color-primary-soft)',
                      color: selected ? '#fff' : 'var(--color-primary-strong)',
                      border: '0.5px solid transparent',
                    }}
                  >
                    {m.nickname}
                  </button>
                );
              })}
            </div>

            <Input
              type="password"
              inputMode="numeric"
              maxLength={4}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
              placeholder="4 位 PIN"
              style={{ textAlign: 'center', letterSpacing: '0.5em' }}
            />

            <Button type="submit" disabled={claim.isPending || !selectedId || pin.length !== 4} style={{ width: '100%' }}>
              {claim.isPending ? '綁定中…' : '確認綁定'}
            </Button>
            <Button type="button" variant="ghost" style={{ width: '100%' }} onClick={onClose}>
              稍後再說
            </Button>
          </form>
        )}
      </Card>
    </div>
  );
}
