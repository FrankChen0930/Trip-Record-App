'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import Sidebar from '@/components/Sidebar';
import Modal from '@/components/Modal';
import { useToast } from '@/components/Toast';
import { useConfirm } from '@/components/ConfirmDialog';
import { MemberSkeleton } from '@/components/Skeleton';
import type { Member } from '@/lib/types';

export default function MembersPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [isAddModalOpen, setAddModalOpen] = useState(false);

  const [myId, setMyId] = useState<string | null>(null);
  const [pinInput, setPinInput] = useState('');

  const [newRealName, setNewRealName] = useState('');
  const [newNickname, setNewNickname] = useState('');
  const [newPin, setNewPin] = useState('');

  const { toast } = useToast();
  const { confirm } = useConfirm();

  const fetchMembers = async () => {
    const { data } = await supabase.from('trip_members').select('*').order('created_at', { ascending: true });
    setMembers(data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchMembers();
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
      await supabase.from('trip_members').insert([{ real_name: newRealName, nickname: newNickname, pin: newPin }]);
      setAddModalOpen(false);
      setNewRealName(''); setNewNickname(''); setNewPin('');
      toast('新成員已加入團隊！', 'success');
      fetchMembers();
    } catch (error: any) {
      toast('新增失敗：' + error.message, 'error');
    }
  };

  const handleDelete = async (id: string, name: string) => {
    const ok = await confirm({
      message: `確定要刪除「${name}」的成員紀錄嗎？`,
      confirmText: '刪除',
      danger: true
    });
    if (!ok) return;
    await supabase.from('trip_members').delete().eq('id', id);
    toast(`${name} 已從名冊移除`, 'info');
    fetchMembers();
  };

  const currentUser = members.find(m => m.id === myId);

  return (
    <div className="bg-gray-50 min-h-screen text-black relative font-sans">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setSidebarOpen(false)} currentPage="members" />

      {/* 頂部導航 */}
      <div className="px-4 py-4 border-b border-gray-100 flex items-center bg-white/90 backdrop-blur-lg sticky top-0 z-30">
        <button onClick={() => setSidebarOpen(true)} className="p-2.5 hover:bg-gray-100 rounded-xl transition-colors">☰</button>
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
              <button onClick={handleLogin} className="w-full bg-white text-gray-900 py-4 rounded-2xl font-bold hover:bg-white/90 transition-all active:scale-[0.98]">確認身分</button>
            </div>
          </div>
        ) : (
          <div className="flex justify-between items-end bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <div>
              <p className="text-[10px] text-blue-600 font-bold uppercase tracking-widest mb-1">✓ Authenticated</p>
              <h2 className="text-2xl font-black">{currentUser?.nickname}</h2>
              <p className="text-xs text-gray-400 mt-0.5">{currentUser?.real_name}</p>
            </div>
            <button onClick={() => { localStorage.removeItem('my_member_id'); setMyId(null); toast('已登出', 'info'); }} className="text-xs text-gray-400 hover:text-gray-600 underline transition-colors">切換身分</button>
          </div>
        )}

        {/* 成員列表 */}
        <div className="relative">
          <div className="absolute left-2 top-0 bottom-0 w-[1px] bg-gray-200/50 z-0" />

          {loading ? <MemberSkeleton /> : (
            <div className="space-y-6">
              {members.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-state-icon">👤</div>
                  <h3 className="text-lg font-bold text-gray-300 mb-2">還沒有成員</h3>
                  <p className="text-sm text-gray-300">點擊下方按鈕新增第一位夥伴！</p>
                </div>
              ) : members.map((m) => (
                <div key={m.id} className="relative pl-10 group">
                  <div className={`absolute left-0 top-6 -translate-x-1/2 w-3.5 h-3.5 rounded-full border-[3px] border-gray-50 z-10 transition-all duration-300 group-hover:scale-125 ${m.id === myId ? 'bg-blue-600' : 'bg-gray-900'}`} />

                  <div className="bg-white border border-gray-100 p-5 rounded-2xl shadow-sm hover:shadow-md hover:border-gray-200 transition-all card-hover flex justify-between items-center">
                    <div className="grid grid-cols-2 gap-6">
                      <div>
                        <p className="text-[10px] text-gray-400 font-bold uppercase mb-1">暱稱</p>
                        <p className="font-bold text-gray-900">{m.nickname}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-gray-400 font-bold uppercase mb-1">姓名</p>
                        <p className="text-gray-600 text-sm">{m.real_name}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      {m.id === myId && <span className="text-[9px] font-bold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-lg">是我</span>}
                      <button onClick={() => handleDelete(m.id, m.nickname)} className="w-8 h-8 rounded-xl flex items-center justify-center text-gray-200 hover:text-red-400 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all">✕</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <button
          onClick={() => setAddModalOpen(true)}
          className="w-full border-2 border-dashed border-gray-200 py-4 rounded-2xl text-sm text-gray-400 hover:bg-gray-100 hover:border-gray-300 hover:text-gray-600 transition-all font-medium"
        >
          + 新增成員
        </button>
      </div>

      {/* 新增成員 Modal */}
      <Modal isOpen={isAddModalOpen} onClose={() => setAddModalOpen(false)} title="新增夥伴紀錄">
        <form onSubmit={handleAddMember}>
          <div className="space-y-5">
            <div>
              <label className="text-xs font-bold text-gray-400 block mb-2">真實姓名</label>
              <input value={newRealName} onChange={e => setNewRealName(e.target.value)} className="w-full border-none bg-gray-50 p-4 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 transition-all" placeholder="輸入姓名" />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-400 block mb-2">顯示暱稱</label>
              <input value={newNickname} onChange={e => setNewNickname(e.target.value)} className="w-full border-none bg-gray-50 p-4 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 transition-all" placeholder="輸入暱稱" />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-400 block mb-2">身分 PIN 碼 (4位數)</label>
              <input value={newPin} onChange={e => setNewPin(e.target.value)} maxLength={4} className="w-full border-none bg-gray-50 p-4 rounded-2xl text-center tracking-[1em] font-bold outline-none focus:ring-2 focus:ring-blue-500 transition-all" placeholder="0000" />
            </div>
          </div>
          <div className="flex gap-3 mt-10">
            <button type="button" onClick={() => setAddModalOpen(false)} className="flex-1 py-4 bg-gray-50 rounded-2xl font-bold hover:bg-gray-100 transition-colors">取消</button>
            <button type="submit" className="flex-1 py-4 bg-gray-900 text-white rounded-2xl font-bold active:scale-95 transition-all hover:bg-gray-800">建立檔案</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}