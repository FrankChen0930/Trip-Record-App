'use client';

import { useEffect, useState } from 'react';
import Sidebar from '@/components/Sidebar';
import BottomTabs from '@/components/BottomTabs';
import Modal from '@/components/Modal';
import { useToast } from '@/components/Toast';
import { useConfirm } from '@/components/ConfirmDialog';
import { MemberSkeleton } from '@/components/Skeleton';
import { useMembers } from '@/features/members/hooks/useMembers';
import { useAddMember, useDeleteMember } from '@/features/members/hooks/useMemberMutations';

export default function MembersPage() {
  // 伺服器資料改由 feature hooks（TanStack Query）提供
  const { data: members = [], isLoading: loading } = useMembers();
  const addMember = useAddMember();
  const deleteMember = useDeleteMember();

  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [isAddModalOpen, setAddModalOpen] = useState(false);

  const [myId, setMyId] = useState<string | null>(null);
  const [pinInput, setPinInput] = useState('');

  const [newRealName, setNewRealName] = useState('');
  const [newNickname, setNewNickname] = useState('');
  const [newPin, setNewPin] = useState('');

  const { toast } = useToast();
  const { confirm } = useConfirm();

  // PIN + localStorage 登入維持原狀（屬本機 UI 狀態），P2 導入 Auth 時再統一改寫。
  useEffect(() => {
    setMyId(localStorage.getItem('my_member_id'));
  }, []);

  const handleLogin = () => {
    const user = members.find(m => m.pin === pinInput);
    if (user) {
      localStorage.setItem('my_member_id', user.id);
      setMyId(user.id);
      setPinInput('');
      toast(`歡迎回來，${user.nickname}！`, 'success');
    } else {
      toast('驗證失敗：PIN 碼不正確', 'error');
    }
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRealName || !newNickname || !newPin) { toast('請填寫完整資訊', 'warning'); return; }
    try {
      await addMember.mutateAsync({ real_name: newRealName, nickname: newNickname, pin: newPin });
      setAddModalOpen(false);
      setNewRealName(''); setNewNickname(''); setNewPin('');
      toast('新成員已加入團隊！', 'success');
    } catch (error) {
      toast('新增失敗：' + (error instanceof Error ? error.message : '未知錯誤'), 'error');
    }
  };

  const handleDelete = async (id: string, name: string) => {
    const ok = await confirm({
      message: `確定要刪除「${name}」的成員紀錄嗎？`,
      confirmText: '刪除',
      danger: true
    });
    if (!ok) return;
    try {
      await deleteMember.mutateAsync(id);
      toast(`${name} 已從名冊移除`, 'info');
    } catch (error) {
      toast('刪除失敗：' + (error instanceof Error ? error.message : '未知錯誤'), 'error');
    }
  };

  const currentUser = members.find(m => m.id === myId);

  return (
    <div className="min-h-screen relative font-sans" style={{ background: 'var(--color-bg-page)', color: 'var(--color-ink)' }}>
      <Sidebar isOpen={isSidebarOpen} onClose={() => setSidebarOpen(false)} currentPage="members" />

      {/* 頂部導航 */}
      <div className="px-4 py-4 border-b border-[var(--color-border-hairline)] flex items-center bg-white/90 backdrop-blur-lg sticky top-0 z-30">
        <button onClick={() => setSidebarOpen(true)} className="p-2.5 hover:bg-[var(--color-primary-soft)] rounded-xl transition-colors">☰</button>
        <h1 className="ml-4 font-bold text-lg tracking-tight">成員名冊</h1>
      </div>

      <div className="max-w-xl mx-auto p-6 space-y-8">

        {/* 身分登入區 */}
        {!myId ? (
          <div className="hero-gradient text-white p-8 rounded-[2rem] relative overflow-hidden">
            <div className="relative z-10">
              <h2 className="text-sm font-bold mb-2 uppercase tracking-widest text-white/60">身分驗證</h2>
              <p className="text-xs text-white/40 mb-6">請輸入你的 4 位數 PIN 碼以同步個人資料</p>
              <input
                type="password" placeholder="• • • •" value={pinInput} onChange={e => setPinInput(e.target.value)}
                className="w-full bg-white/10 border border-white/10 p-4 mb-6 text-center text-3xl tracking-[1em] outline-none rounded-2xl backdrop-blur-sm text-white placeholder:text-white/20 focus:border-white/30 transition-all"
                maxLength={4}
              />
              <button onClick={handleLogin} className="w-full bg-white text-[var(--color-primary-strong)] py-4 rounded-xl font-bold hover:bg-white/90 transition-all active:scale-[0.98]">確認身分</button>
            </div>
          </div>
        ) : (
          <div className="flex justify-between items-end bg-white p-6 rounded-xl shadow-sm border border-[var(--color-border-hairline)]">
            <div>
              <p className="text-[10px] text-[var(--color-primary-strong)] font-bold uppercase tracking-widest mb-1">✓ Authenticated</p>
              <h2 className="text-2xl font-black">{currentUser?.nickname}</h2>
              <p className="text-xs text-[var(--color-ink-muted)] mt-0.5">{currentUser?.real_name}</p>
            </div>
            <button onClick={() => { localStorage.removeItem('my_member_id'); setMyId(null); toast('已登出', 'info'); }} className="text-xs text-[var(--color-ink-muted)] hover:text-[var(--color-ink)] underline transition-colors">切換身分</button>
          </div>
        )}

        {/* 成員列表 */}
        <div className="relative">
          <div className="absolute left-2 top-0 bottom-0 w-[1px] bg-[#D8EBE3] z-0" />

          {loading ? <MemberSkeleton /> : (
            <div className="space-y-6">
              {members.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-state-icon">👤</div>
                  <h3 className="text-lg font-bold mb-2" style={{ color: 'var(--color-ink-muted)' }}>還沒有成員</h3>
                  <p className="text-sm" style={{ color: 'var(--color-ink-muted)', opacity: 0.7 }}>點擊下方按鈕新增第一位夥伴！</p>
                </div>
              ) : members.map((m) => (
                <div key={m.id} className="relative pl-10 group">
                  <div className={`absolute left-0 top-6 -translate-x-1/2 w-3.5 h-3.5 rounded-full border-[3px] border-[var(--color-bg-page)] z-10 transition-all duration-300 group-hover:scale-125 ${m.id === myId ? 'bg-[var(--color-primary)]' : 'bg-[var(--color-ink)]'}`} />

                  <div className="bg-white border border-[var(--color-border-hairline)] p-5 rounded-xl shadow-sm hover:shadow-md hover:border-[#C4DED3] transition-all card-hover flex justify-between items-center">
                    <div className="grid grid-cols-2 gap-6">
                      <div>
                        <p className="text-[10px] text-[var(--color-ink-muted)] font-bold uppercase mb-1">暱稱</p>
                        <p className="font-bold text-[var(--color-ink)]">{m.nickname}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-[var(--color-ink-muted)] font-bold uppercase mb-1">姓名</p>
                        <p className="text-[var(--color-ink-muted)] text-sm">{m.real_name}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      {m.id === myId && <span className="text-[9px] font-bold text-[var(--color-primary-strong)] bg-[var(--color-primary-soft)] px-2.5 py-1 rounded-lg">是我</span>}
                      <button onClick={() => handleDelete(m.id, m.nickname)} className="w-8 h-8 rounded-xl flex items-center justify-center text-[#C4CFC9] hover:text-red-400 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all">✕</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <button
          onClick={() => setAddModalOpen(true)}
          className="w-full border-2 border-dashed border-[#C4DED3] py-4 rounded-xl text-sm text-[var(--color-ink-muted)] hover:bg-[var(--color-primary-soft)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary-strong)] transition-all font-medium"
        >
          + 新增成員
        </button>
      </div>

      {/* 新增成員 Modal */}
      <Modal isOpen={isAddModalOpen} onClose={() => setAddModalOpen(false)} title="新增夥伴紀錄">
        <form onSubmit={handleAddMember}>
          <div className="space-y-5">
            <div>
              <label className="text-xs font-bold text-[var(--color-ink-muted)] block mb-2">真實姓名</label>
              <input value={newRealName} onChange={e => setNewRealName(e.target.value)} className="w-full border-none bg-[var(--color-bg-page)] p-4 rounded-xl outline-none focus:ring-2 focus:ring-[var(--color-primary)] transition-all" placeholder="輸入姓名" />
            </div>
            <div>
              <label className="text-xs font-bold text-[var(--color-ink-muted)] block mb-2">顯示暱稱</label>
              <input value={newNickname} onChange={e => setNewNickname(e.target.value)} className="w-full border-none bg-[var(--color-bg-page)] p-4 rounded-xl outline-none focus:ring-2 focus:ring-[var(--color-primary)] transition-all" placeholder="輸入暱稱" />
            </div>
            <div>
              <label className="text-xs font-bold text-[var(--color-ink-muted)] block mb-2">身分 PIN 碼 (4位數)</label>
              <input value={newPin} onChange={e => setNewPin(e.target.value)} maxLength={4} className="w-full border-none bg-[var(--color-bg-page)] p-4 rounded-xl text-center tracking-[1em] font-bold outline-none focus:ring-2 focus:ring-[var(--color-primary)] transition-all" placeholder="0000" />
            </div>
          </div>
          <div className="flex gap-3 mt-10">
            <button type="button" onClick={() => setAddModalOpen(false)} className="flex-1 py-4 bg-[#EEF1F0] text-[var(--color-ink)] rounded-xl font-bold hover:bg-[#E1E7E4] transition-colors">取消</button>
            <button type="submit" className="flex-1 py-4 bg-[var(--color-primary)] text-white rounded-xl font-bold active:scale-95 transition-all hover:bg-[var(--color-primary-strong)]">建立檔案</button>
          </div>
        </form>
      </Modal>

      <BottomTabs />
    </div>
  );
}
