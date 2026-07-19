'use client';

import { useState } from 'react';
import Sidebar from '@/components/Sidebar';
import BottomTabs from '@/components/BottomTabs';
import Modal from '@/components/Modal';
import { useToast } from '@/components/Toast';
import { useConfirm } from '@/components/ConfirmDialog';
import type { Group } from '@/lib/types';
import { useMembers } from '@/features/members/hooks/useMembers';
import { useCurrentMember } from '@/features/members/hooks/useCurrentMember';
import { useGroups, useGroupMembers } from '@/features/groups/hooks/useGroups';
import { useSaveGroup, useDeleteGroup, useToggleGroupMember } from '@/features/groups/hooks/useGroupMutations';

export default function GroupsPage() {
  // 伺服器資料改由 feature hooks 提供
  const { data: allGroups = [], isLoading: groupsLoading } = useGroups();
  const { data: members = [], isLoading: membersLoading } = useMembers();
  const { data: groupMembers = [], isLoading: gmLoading } = useGroupMembers();
  const loading = groupsLoading || membersLoading || gmLoading;
  // p9：admin 看得到／管得動全部身分組；一般成員只看得到自己所屬的組（唯讀）
  const { me, isAdmin } = useCurrentMember();
  const groups = isAdmin
    ? allGroups
    : allGroups.filter(g => me && groupMembers.some(gm => gm.group_id === g.id && gm.member_id === me.id));
  const saveGroup = useSaveGroup();
  const deleteGroup = useDeleteGroup();
  const toggleGroupMember = useToggleGroupMember();

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

  const handleSaveGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupName) { toast('請輸入群組名稱', 'warning'); return; }

    try {
      await saveGroup.mutateAsync({
        id: editingGroup?.id ?? null,
        data: { name: groupName, color: groupColor, icon: groupIcon },
      });
      toast(editingGroup ? '群組已更新' : '群組已建立', 'success');
      closeModal();
    } catch (error) {
      toast('失敗：' + (error instanceof Error ? error.message : '未知錯誤'), 'error');
    }
  };

  const handleDeleteGroup = async (id: string, name: string) => {
    const ok = await confirm({ message: `確定要刪除「${name}」群組嗎？`, confirmText: '刪除', danger: true });
    if (!ok) return;
    try {
      await deleteGroup.mutateAsync(id);
      toast('群組已刪除', 'info');
    } catch (error) {
      toast('刪除失敗：' + (error instanceof Error ? error.message : '未知錯誤'), 'error');
    }
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
    try {
      await toggleGroupMember.mutateAsync({ existingId: existing?.id ?? null, groupId, memberId });
    } catch (error) {
      toast('更新失敗：' + (error instanceof Error ? error.message : '未知錯誤'), 'error');
    }
  };

  const getGroupMembers = (groupId: string) => {
    const memberIds = groupMembers.filter(gm => gm.group_id === groupId).map(gm => gm.member_id);
    return members.filter(m => memberIds.includes(m.id));
  };

  const iconOptions = ['👥', '👨‍👩‍👧‍👦', '🎓', '🏢', '⛺', '🎮', '🏋️', '🎵', '🚀', '❤️'];
  const colorOptions = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316'];

  return (
    <div className="min-h-screen relative font-sans" style={{ background: 'var(--color-bg-page)', color: 'var(--color-ink)' }}>
      <Sidebar isOpen={isSidebarOpen} onClose={() => setSidebarOpen(false)} currentPage="groups" />

      <div className="px-4 py-4 border-b border-[var(--color-border-hairline)] flex items-center bg-white/90 backdrop-blur-lg sticky top-0 z-30">
        <button onClick={() => setSidebarOpen(true)} className="sidebar-hamburger p-2.5 hover:bg-[var(--color-primary-soft)] rounded-xl transition-colors">☰</button>
        <h1 className="ml-4 font-bold text-lg tracking-tight">身分組管理</h1>
      </div>

      <div className="max-w-xl mx-auto p-6 space-y-6 page-content-mobile">
        <div className="flex justify-between items-end mb-4">
          <div>
            <h2 className="text-3xl font-black tracking-tighter italic">GROUPS</h2>
            <p className="text-[10px] text-[var(--color-ink-muted)] font-bold uppercase tracking-[0.3em]">Discord-style role system</p>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-16" style={{ color: 'var(--color-ink-muted)' }}>載入中...</div>
        ) : groups.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">🏷️</div>
            <h3 className="text-lg font-bold mb-2" style={{ color: 'var(--color-ink-muted)' }}>{isAdmin ? '還沒有群組' : '你還沒有加入任何身分組'}</h3>
            <p className="text-sm mb-6" style={{ color: 'var(--color-ink-muted)', opacity: 0.7 }}>{isAdmin ? '建立群組來分隔不同旅行團體的內容！' : '請聯絡管理員將你加入身分組'}</p>
          </div>
        ) : (
          <div className="space-y-4">
            {groups.map(group => {
              const gMembers = getGroupMembers(group.id);
              const isManaging = managingGroupId === group.id;
              return (
                <div key={group.id} className="bg-white rounded-xl shadow-sm border border-[var(--color-border-hairline)] overflow-hidden card-hover">
                  <div className="p-5">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{group.icon}</span>
                        <div>
                          <h3 className="font-bold text-lg">{group.name}</h3>
                          <p className="text-[10px] text-[var(--color-ink-muted)]">{gMembers.length} 位成員</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded-full" style={{ backgroundColor: group.color }} />
                        {isAdmin && (
                          <>
                            <button onClick={() => openEditModal(group)} className="w-8 h-8 rounded-xl flex items-center justify-center text-[var(--color-ink-muted)] hover:text-[var(--color-primary-strong)] hover:bg-[var(--color-primary-soft)] transition-all">✎</button>
                            <button onClick={() => handleDeleteGroup(group.id, group.name)} className="w-8 h-8 rounded-xl flex items-center justify-center text-[var(--color-ink-muted)] hover:text-red-500 hover:bg-red-50 transition-all">✕</button>
                          </>
                        )}
                      </div>
                    </div>

                    {/* 成員頭像列 */}
                    <div className="flex items-center gap-1 flex-wrap">
                      {gMembers.map(m => (
                        <span key={m.id} className="group-tag" style={{ backgroundColor: group.color + '20', color: group.color }}>
                          {m.nickname}
                        </span>
                      ))}
                      {isAdmin && (
                        <button
                          onClick={() => setManagingGroupId(isManaging ? null : group.id)}
                          className="text-[10px] text-[var(--color-ink-muted)] px-2 py-1 rounded-lg hover:bg-[var(--color-primary-soft)] transition-colors font-bold"
                        >
                          {isManaging ? '收合' : '+ 管理成員'}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* 成員管理展開 */}
                  {isManaging && (
                    <div className="border-t border-[var(--color-border-hairline)] p-4 bg-[var(--color-bg-page)]">
                      <p className="text-[10px] font-bold text-[var(--color-ink-muted)] uppercase mb-3">點擊成員加入/移除此群組</p>
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
                                  : 'bg-[#EEF1F0] text-[var(--color-ink-muted)] hover:bg-[#E1E7E4]'
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

        {/* 建立群組限管理員（p9） */}
        {isAdmin && (
          <button
            onClick={() => { closeModal(); setModalOpen(true); }}
            className="w-full border-2 border-dashed border-[#C4DED3] py-4 rounded-xl text-sm text-[var(--color-ink-muted)] hover:bg-[var(--color-primary-soft)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary-strong)] transition-all font-medium"
          >
            + 建立新群組
          </button>
        )}
      </div>

      {/* 新增/編輯 Modal */}
      <Modal isOpen={isModalOpen} onClose={closeModal} title={editingGroup ? '編輯群組' : '建立新群組'}>
        <form onSubmit={handleSaveGroup}>
          <div className="space-y-5">
            <div>
              <label className="text-[10px] text-[var(--color-ink-muted)] font-bold uppercase ml-1 mb-2 block">群組名稱</label>
              <input value={groupName} onChange={e => setGroupName(e.target.value)} className="w-full bg-[var(--color-bg-page)] border-none p-4 rounded-xl outline-none font-bold focus:ring-2 focus:ring-[var(--color-primary)] transition-all" placeholder="例：家庭、大學好友" />
            </div>
            <div>
              <label className="text-[10px] text-[var(--color-ink-muted)] font-bold uppercase ml-1 mb-2 block">圖標</label>
              <div className="flex flex-wrap gap-2">
                {iconOptions.map(icon => (
                  <button key={icon} type="button" onClick={() => setGroupIcon(icon)}
                    className={`w-10 h-10 rounded-xl text-xl flex items-center justify-center transition-all ${groupIcon === icon ? 'bg-[var(--color-primary-soft)] ring-2 ring-[var(--color-primary)] shadow-md scale-110' : 'bg-[#EEF1F0] hover:bg-[#E1E7E4]'}`}
                  >{icon}</button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-[10px] text-[var(--color-ink-muted)] font-bold uppercase ml-1 mb-2 block">標籤顏色</label>
              <div className="flex flex-wrap gap-2">
                {colorOptions.map(c => (
                  <button key={c} type="button" onClick={() => setGroupColor(c)}
                    className={`w-8 h-8 rounded-full transition-all ${groupColor === c ? 'scale-125 ring-2 ring-offset-2 ring-[var(--color-primary)]' : 'hover:scale-110'}`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
          </div>
          <div className="flex gap-3 mt-8">
            <button type="button" onClick={closeModal} className="flex-1 py-4 bg-[#EEF1F0] text-[var(--color-ink)] rounded-xl font-bold hover:bg-[#E1E7E4] transition-colors">取消</button>
            <button type="submit" className="flex-1 py-4 bg-[var(--color-primary)] text-white rounded-xl font-bold active:scale-95 transition-all hover:bg-[var(--color-primary-strong)]">{editingGroup ? '儲存' : '建立'}</button>
          </div>
        </form>
      </Modal>

      <BottomTabs />
    </div>
  );
}
