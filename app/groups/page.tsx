'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import Sidebar from '@/components/Sidebar';
import BottomTabs from '@/components/BottomTabs';
import Modal from '@/components/Modal';
import { useToast } from '@/components/Toast';
import { useConfirm } from '@/components/ConfirmDialog';
import type { Group, Member, GroupMember } from '@/lib/types';

export default function GroupsPage() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [groupMembers, setGroupMembers] = useState<GroupMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [isModalOpen, setModalOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<Group | null>(null);

  // 表單
  const [groupName, setGroupName] = useState('');
  const [groupColor, setGroupColor] = useState('#3b82f6');
  const [groupIcon, setGroupIcon] = useState('👥');

  // 成員管理
  const [managingGroupId, setManagingGroupId] = useState<string | null>(null);

  const { toast } = useToast();
  const { confirm } = useConfirm();

  const fetchData = async () => {
    const { data: g } = await supabase.from('groups').select('*').order('created_at');
    const { data: m } = await supabase.from('trip_members').select('*');
    const { data: gm } = await supabase.from('group_members').select('*');
    setGroups(g || []);
    setMembers(m || []);
    setGroupMembers(gm || []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const handleSaveGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupName) { toast('請輸入群組名稱', 'warning'); return; }

    try {
      if (editingGroup) {
        await supabase.from('groups').update({ name: groupName, color: groupColor, icon: groupIcon }).eq('id', editingGroup.id);
        toast('群組已更新', 'success');
      } else {
        await supabase.from('groups').insert([{ name: groupName, color: groupColor, icon: groupIcon }]);
        toast('群組已建立', 'success');
      }
      closeModal();
      fetchData();
    } catch (error: any) {
      toast('失敗：' + error.message, 'error');
    }
  };

  const handleDeleteGroup = async (id: string, name: string) => {
    const ok = await confirm({ message: `確定要刪除「${name}」群組嗎？`, confirmText: '刪除', danger: true });
    if (!ok) return;
    await supabase.from('groups').delete().eq('id', id);
    toast('群組已刪除', 'info');
    fetchData();
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingGroup(null);
    setGroupName(''); setGroupColor('#3b82f6'); setGroupIcon('👥');
  };

  const openEditModal = (group: Group) => {
    setEditingGroup(group);
    setGroupName(group.name);
    setGroupColor(group.color);
    setGroupIcon(group.icon);
    setModalOpen(true);
  };

  const toggleMember = async (groupId: string, memberId: string) => {
    const existing = groupMembers.find(gm => gm.group_id === groupId && gm.member_id === memberId);
    if (existing) {
      await supabase.from('group_members').delete().eq('id', existing.id);
    } else {
      await supabase.from('group_members').insert([{ group_id: groupId, member_id: memberId }]);
    }
    fetchData();
  };

  const getGroupMembers = (groupId: string) => {
    const memberIds = groupMembers.filter(gm => gm.group_id === groupId).map(gm => gm.member_id);
    return members.filter(m => memberIds.includes(m.id));
  };

  const iconOptions = ['👥', '👨‍👩‍👧‍👦', '🎓', '🏢', '⛺', '🎮', '🏋️', '🎵', '🚀', '❤️'];
  const colorOptions = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316'];

  return (
    <div className="bg-gray-50 min-h-screen text-black relative font-sans">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setSidebarOpen(false)} currentPage="groups" />

      <div className="px-4 py-4 border-b border-gray-100 flex items-center bg-white/90 backdrop-blur-lg sticky top-0 z-30">
        <button onClick={() => setSidebarOpen(true)} className="sidebar-hamburger p-2.5 hover:bg-gray-100 rounded-xl transition-colors">☰</button>
        <h1 className="ml-4 font-bold text-lg tracking-tight">身分組管理</h1>
      </div>

      <div className="max-w-xl mx-auto p-6 space-y-6 page-content-mobile">
        <div className="flex justify-between items-end mb-4">
          <div>
            <h2 className="text-3xl font-black tracking-tighter italic">GROUPS</h2>
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-[0.3em]">Discord-style role system</p>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-16 text-gray-300">載入中...</div>
        ) : groups.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">🏷️</div>
            <h3 className="text-lg font-bold text-gray-300 mb-2">還沒有群組</h3>
            <p className="text-sm text-gray-300 mb-6">建立群組來分隔不同旅行團體的內容！</p>
          </div>
        ) : (
          <div className="space-y-4">
            {groups.map(group => {
              const gMembers = getGroupMembers(group.id);
              const isManaging = managingGroupId === group.id;
              return (
                <div key={group.id} className="bg-white rounded-[1.5rem] shadow-sm border border-gray-100 overflow-hidden card-hover">
                  <div className="p-5">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{group.icon}</span>
                        <div>
                          <h3 className="font-bold text-lg">{group.name}</h3>
                          <p className="text-[10px] text-gray-400">{gMembers.length} 位成員</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded-full" style={{ backgroundColor: group.color }} />
                        <button onClick={() => openEditModal(group)} className="w-8 h-8 rounded-xl flex items-center justify-center text-gray-400 hover:text-blue-500 hover:bg-blue-50 transition-all">✎</button>
                        <button onClick={() => handleDeleteGroup(group.id, group.name)} className="w-8 h-8 rounded-xl flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 transition-all">✕</button>
                      </div>
                    </div>

                    {/* 成員頭像列 */}
                    <div className="flex items-center gap-1 flex-wrap">
                      {gMembers.map(m => (
                        <span key={m.id} className="group-tag" style={{ backgroundColor: group.color + '20', color: group.color }}>
                          {m.nickname}
                        </span>
                      ))}
                      <button
                        onClick={() => setManagingGroupId(isManaging ? null : group.id)}
                        className="text-[10px] text-gray-400 px-2 py-1 rounded-lg hover:bg-gray-100 transition-colors font-bold"
                      >
                        {isManaging ? '收合' : '+ 管理成員'}
                      </button>
                    </div>
                  </div>

                  {/* 成員管理展開 */}
                  {isManaging && (
                    <div className="border-t border-gray-100 p-4 bg-gray-50/50">
                      <p className="text-[10px] font-bold text-gray-400 uppercase mb-3">點擊成員加入/移除此群組</p>
                      <div className="flex flex-wrap gap-2">
                        {members.map(m => {
                          const isIn = groupMembers.some(gm => gm.group_id === group.id && gm.member_id === m.id);
                          return (
                            <button
                              key={m.id}
                              onClick={() => toggleMember(group.id, m.id)}
                              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                                isIn
                                  ? 'text-white shadow-md scale-105'
                                  : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                              }`}
                              style={isIn ? { backgroundColor: group.color } : {}}
                            >
                              {isIn ? '✓ ' : ''}{m.nickname}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <button
          onClick={() => { closeModal(); setModalOpen(true); }}
          className="w-full border-2 border-dashed border-gray-200 py-4 rounded-2xl text-sm text-gray-400 hover:bg-gray-100 hover:border-gray-300 hover:text-gray-600 transition-all font-medium"
        >
          + 建立新群組
        </button>
      </div>

      {/* 新增/編輯 Modal */}
      <Modal isOpen={isModalOpen} onClose={closeModal} title={editingGroup ? '編輯群組' : '建立新群組'}>
        <form onSubmit={handleSaveGroup}>
          <div className="space-y-5">
            <div>
              <label className="text-[10px] text-gray-400 font-bold uppercase ml-1 mb-2 block">群組名稱</label>
              <input value={groupName} onChange={e => setGroupName(e.target.value)} className="w-full bg-gray-50 border-none p-4 rounded-2xl outline-none font-bold focus:ring-2 focus:ring-blue-500 transition-all" placeholder="例：家庭、大學好友" />
            </div>
            <div>
              <label className="text-[10px] text-gray-400 font-bold uppercase ml-1 mb-2 block">圖標</label>
              <div className="flex flex-wrap gap-2">
                {iconOptions.map(icon => (
                  <button key={icon} type="button" onClick={() => setGroupIcon(icon)}
                    className={`w-10 h-10 rounded-xl text-xl flex items-center justify-center transition-all ${groupIcon === icon ? 'bg-gray-900 shadow-md scale-110' : 'bg-gray-100 hover:bg-gray-200'}`}
                  >{icon}</button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-[10px] text-gray-400 font-bold uppercase ml-1 mb-2 block">標籤顏色</label>
              <div className="flex flex-wrap gap-2">
                {colorOptions.map(c => (
                  <button key={c} type="button" onClick={() => setGroupColor(c)}
                    className={`w-8 h-8 rounded-full transition-all ${groupColor === c ? 'scale-125 ring-2 ring-offset-2 ring-gray-400' : 'hover:scale-110'}`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
          </div>
          <div className="flex gap-3 mt-8">
            <button type="button" onClick={closeModal} className="flex-1 py-4 bg-gray-50 rounded-2xl font-bold hover:bg-gray-100 transition-colors">取消</button>
            <button type="submit" className="flex-1 py-4 bg-gray-900 text-white rounded-2xl font-bold active:scale-95 transition-all">{editingGroup ? '儲存' : '建立'}</button>
          </div>
        </form>
      </Modal>

      <BottomTabs />
    </div>
  );
}
