'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import Sidebar from '@/components/Sidebar';

export default function MembersPage() {
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [isAddModalOpen, setAddModalOpen] = useState(false);
  
  const [myId, setMyId] = useState<string | null>(null);
  const [pinInput, setPinInput] = useState('');

  const [newRealName, setNewRealName] = useState('');
  const [newNickname, setNewNickname] = useState('');
  const [newPin, setNewPin] = useState('');

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
    } else {
      alert('驗證失敗：PIN 碼不正確');
    }
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRealName || !newNickname || !newPin) return alert('請填寫完整資訊');
    await supabase.from('trip_members').insert([{ real_name: newRealName, nickname: newNickname, pin: newPin }]);
    setAddModalOpen(false);
    fetchMembers();
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`確定要刪除「${name}」的成員紀錄嗎？`)) return;
    await supabase.from('trip_members').delete().eq('id', id);
    fetchMembers();
  };

  const currentUser = members.find(m => m.id === myId);

  return (
    <div className="bg-white min-h-screen text-black relative font-sans">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setSidebarOpen(false)} currentPage="members" />

      {/* 頂部導航 */}
      <div className="p-4 border-b flex items-center bg-white sticky top-0 z-30">
        <button onClick={() => setSidebarOpen(true)} className="p-2 hover:bg-gray-100 rounded-lg">☰</button>
        <h1 className="ml-4 font-bold text-lg tracking-tight">成員名冊</h1>
      </div>

      <div className="max-w-xl mx-auto p-6 space-y-10">
        
        {/* 身分登入區 */}
        {!myId ? (
          <div className="border border-black p-8 rounded-2xl bg-gray-50">
            <h2 className="text-sm font-bold mb-4 uppercase tracking-widest">身分驗證</h2>
            <p className="text-xs text-gray-500 mb-6">請輸入你的 4 位數 PIN 碼以同步個人資料</p>
            <input 
              type="password" placeholder="PIN" value={pinInput} onChange={e => setPinInput(e.target.value)}
              className="w-full border-b border-black p-4 mb-6 text-center text-4xl tracking-[1em] outline-none bg-transparent"
              maxLength={4}
            />
            <button onClick={handleLogin} className="w-full bg-black text-white py-4 rounded-xl font-bold hover:bg-gray-800 transition">確認身分</button>
          </div>
        ) : (
          <div className="flex justify-between items-end border-b pb-4">
            <div>
              <p className="text-[10px] text-blue-600 font-bold uppercase tracking-widest mb-1">Authenticated</p>
              <h2 className="text-2xl font-bold">{currentUser?.nickname}</h2>
            </div>
            <button onClick={() => { localStorage.removeItem('my_member_id'); setMyId(null); }} className="text-xs text-gray-400 underline">切換身分</button>
          </div>
        )}

        {/* 成員列表 (時間軸連線風格) */}
        <div className="relative">
          <div className="absolute left-2 top-0 bottom-0 w-[1px] bg-gray-200 z-0" />

          <div className="space-y-8">
            {loading ? <p className="pl-10 text-gray-400 text-sm">載入中...</p> : 
              members.map((m) => (
              <div key={m.id} className="relative pl-10">
                <div className={`absolute left-0 top-6 -translate-x-1/2 w-3 h-3 rounded-full border-2 border-white z-10 ${m.id === myId ? 'bg-blue-600' : 'bg-black'}`} />
                <div className="absolute left-0 top-[31px] w-10 h-[1px] bg-gray-200 -z-10" />

                <div className="bg-white border border-gray-100 p-5 rounded-2xl shadow-sm hover:border-gray-300 transition-all flex justify-between items-center">
                  <div className="grid grid-cols-2 gap-8">
                    <div>
                      <p className="text-[10px] text-gray-400 font-bold uppercase mb-1">暱稱</p>
                      <p className="font-bold">{m.nickname}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-400 font-bold uppercase mb-1">姓名</p>
                      <p className="text-gray-600 text-sm">{m.real_name}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    {m.id === myId && <span className="text-[9px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">是我</span>}
                    <button onClick={() => handleDelete(m.id, m.nickname)} className="text-gray-200 hover:text-red-400">✕</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <button 
          onClick={() => setAddModalOpen(true)}
          className="w-full border border-dashed border-gray-300 py-4 rounded-2xl text-sm text-gray-500 hover:bg-gray-50 transition"
        >
          + 新增成員
        </button>
      </div>

      {/* 新增成員 Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form onSubmit={handleAddMember} className="bg-white w-full max-w-sm p-8 rounded-[32px] shadow-xl text-black">
            <h2 className="text-xl font-bold mb-8 text-center">新增夥伴紀錄</h2>
            <div className="space-y-5">
              <div>
                <label className="text-xs font-bold text-gray-400 block mb-2">真實姓名</label>
                <input value={newRealName} onChange={e => setNewRealName(e.target.value)} className="w-full border-none bg-gray-50 p-4 rounded-2xl outline-none" placeholder="輸入姓名" />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-400 block mb-2">顯示暱稱</label>
                <input value={newNickname} onChange={e => setNewNickname(e.target.value)} className="w-full border-none bg-gray-50 p-4 rounded-2xl outline-none" placeholder="輸入暱稱" />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-400 block mb-2">身分 PIN 碼 (4位數)</label>
                <input value={newPin} onChange={e => setNewPin(e.target.value)} maxLength={4} className="w-full border-none bg-gray-50 p-4 rounded-2xl text-center tracking-[1em] font-bold outline-none" placeholder="0000" />
              </div>
            </div>
            <div className="flex gap-3 mt-10">
              <button type="button" onClick={() => setAddModalOpen(false)} className="flex-1 py-4 bg-gray-100 rounded-2xl font-bold">取消</button>
              <button type="submit" className="flex-1 py-4 bg-black text-white rounded-2xl font-bold">建立檔案</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}