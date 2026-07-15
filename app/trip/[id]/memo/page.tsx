'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import { useToast } from '@/components/Toast';
import type { TripMemo } from '@/lib/types';
import { useTrip } from '@/features/trips/hooks/useTrip';
import { useMemoMembers } from '@/features/memo/hooks/useMemoMembers';
import { useMemos } from '@/features/memo/hooks/useMemos';
import { useAddMemo, useUpdateMemo, useDeleteMemo } from '@/features/memo/hooks/useMemoMutations';
import { Menu, FileText, CheckSquare, Plus, Trash2, Edit2, Link as LinkIcon } from 'lucide-react';
import React from 'react';

// --- Helper to parse Markdown Links ---
function Linkifier({ text }: { text: string }) {
  // Parse [Name](URL) or raw HTTP
  const elements: React.ReactNode[] = [];
  const regex = /\[([^\]]+)\]\((https?:\/\/[^\s]+)\)|(https?:\/\/[^\s]+)/g;
  
  let lastIndex = 0;
  let match;
  
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      elements.push(<span key={lastIndex}>{text.substring(lastIndex, match.index)}</span>);
    }
    
    if (match[1] && match[2]) {
      // [Name](URL)
      elements.push(
        <a key={match.index} href={match[2]} target="_blank" rel="noopener noreferrer" className="text-[var(--color-primary-strong)] hover:text-[var(--color-primary)] underline font-medium break-all">
          {match[1]}
        </a>
      );
    } else if (match[3]) {
      // Raw URL
      elements.push(
        <a key={match.index} href={match[3]} target="_blank" rel="noopener noreferrer" className="text-[var(--color-primary-strong)] hover:text-[var(--color-primary)] underline break-all">
          {match[3]}
        </a>
      );
    }
    lastIndex = regex.lastIndex;
  }
  
  if (lastIndex < text.length) {
    elements.push(<span key={lastIndex}>{text.substring(lastIndex)}</span>);
  }
  
  return <p className="whitespace-pre-wrap leading-relaxed text-sm text-[var(--color-ink)]">{elements.length > 0 ? elements : text}</p>;
}

// --- Text Memo Component ---
function TextMemoCard({ memo, onUpdate, onDelete }: { memo: TripMemo; onUpdate: (id: string, updates: Partial<TripMemo>) => void; onDelete: (id: string) => void }) {
  const [isEditing, setIsEditing] = useState(memo.content === '' && memo.title === '');
  const [title, setTitle] = useState(memo.title || '');
  const [content, setContent] = useState(memo.content);

  const handleSave = () => {
    onUpdate(memo.id, { title, content });
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-[#C4DED3] flex flex-col gap-3 relative group">
         <button onClick={() => onDelete(memo.id)} className="absolute top-4 right-4 text-[#C4CFC9] hover:text-red-500 transition"><Trash2 className="w-4 h-4"/></button>
         <input 
           value={title} onChange={e => setTitle(e.target.value)} 
           placeholder="備忘錄標題 (選填)" 
           className="w-11/12 text-lg font-black outline-none bg-transparent placeholder-[#B6C6BF]"
         />
         <textarea 
           value={content} onChange={e => setContent(e.target.value)} 
           placeholder={`內容...\n(可使用 [顯示文字](網址) 建立超連結)`} 
           rows={4}
           className="w-full text-sm outline-none bg-transparent resize-none placeholder-[#B6C6BF] custom-scrollbar"
         />
         <div className="flex justify-between items-center mt-2">
            <span className="text-[10px] text-[var(--color-ink-muted)] font-mono">支援 [文字](連結) 格式</span>
            <button onClick={handleSave} className="px-4 py-1.5 bg-[var(--color-primary-soft)] text-[var(--color-primary-strong)] hover:bg-[#B9E7D6] text-xs font-bold rounded-lg transition">完成</button>
         </div>
      </div>
    );
  }

  return (
    <div className="bg-white p-5 rounded-2xl shadow-sm border border-transparent hover:border-[#C4DED3] flex flex-col gap-2 relative group transition-all">
       <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition flex gap-2">
         <button onClick={() => setIsEditing(true)} className="text-[#C4CFC9] hover:text-[var(--color-primary-strong)] p-1"><Edit2 className="w-4 h-4"/></button>
         <button onClick={() => onDelete(memo.id)} className="text-[#C4CFC9] hover:text-red-500 p-1"><Trash2 className="w-4 h-4"/></button>
       </div>
       {title && <h3 className="text-lg font-black text-[var(--color-ink)] pr-16">{title}</h3>}
       <Linkifier text={content} />
    </div>
  );
}

// --- Todo Item Component ---
function TodoItem({ memo, onUpdate, onDelete }: { memo: TripMemo; onUpdate: (id: string, updates: Partial<TripMemo>) => void; onDelete: (id: string) => void }) {
  return (
    <div className="flex items-start gap-3 p-2 group hover:bg-[var(--color-bg-page)] rounded-xl transition-colors">
      <button 
        onClick={() => onUpdate(memo.id, { is_checked: !memo.is_checked })} 
        className={`mt-0.5 flex-shrink-0 w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${memo.is_checked ? 'bg-[var(--color-primary)] border-[var(--color-primary)] text-white shadow-sm' : 'border-[#C4CFC9] text-transparent hover:border-[var(--color-primary)]'}`}
      >
        <CheckSquare className="w-3.5 h-3.5" />
      </button>
      <input 
        value={memo.content}
        onChange={e => onUpdate(memo.id, { content: e.target.value })}
        className={`flex-1 bg-transparent outline-none text-sm font-medium transition-all ${memo.is_checked ? 'line-through text-[var(--color-ink-muted)]' : 'text-[var(--color-ink)]'}`}
        placeholder="待辦事項..."
      />
      <button onClick={() => onDelete(memo.id)} className="opacity-0 group-hover:opacity-100 text-[#C4CFC9] hover:text-red-500 transition px-1"><Trash2 className="w-3.5 h-3.5"/></button>
    </div>
  );
}


// --- Main Page ---
export default function MemoPage() {
  const params = useParams();
  const tripId = Array.isArray(params.id) ? params.id[0] : params.id;
  const { toast } = useToast();

  // 伺服器資料改由 feature hooks 提供
  const { data: tripInfo } = useTrip(tripId);
  const { data: members = [] } = useMemoMembers(tripId);
  const { data: memos = [] } = useMemos(tripId);
  const addMemo = useAddMemo(tripId);
  const updateMemo = useUpdateMemo(tripId);
  const deleteMemo = useDeleteMemo(tripId);

  const [activeTab, setActiveTab] = useState<string>('shared');
  const [isSidebarOpen, setSidebarOpen] = useState(false);

  const activeMemos = memos.filter(m => activeTab === 'shared' ? m.member_id === null : m.member_id === activeTab);
  const textMemos = activeMemos.filter(m => m.type !== 'todo');
  const todoMemos = activeMemos.filter(m => m.type === 'todo');

  const handleUpdateMemo = (id: string, updates: Partial<TripMemo>) => {
    updateMemo.mutate({ id, updates });
  };

  const handleAddMemo = async (type: 'text' | 'todo') => {
    const highestOrder = activeMemos.reduce((max, m) => Math.max(max, m.sort_order), 0);
    const newMemo: Partial<TripMemo> = {
      trip_id: tripId as string,
      member_id: activeTab === 'shared' ? null : activeTab,
      title: '',
      content: '',
      is_checked: false,
      type: type,
      sort_order: highestOrder + 100
    };
    try {
      await addMemo.mutateAsync(newMemo);
      if (type === 'text') toast('已建立新文字備忘錄', 'success');
    } catch (error) {
      toast('新增失敗：' + (error instanceof Error ? error.message : '未知錯誤'), 'error');
    }
  };

  const handleDeleteMemo = (id: string) => {
    deleteMemo.mutate(id);
  };

  return (
    <div className="min-h-screen flex flex-col font-sans" style={{ background: 'var(--color-bg-page)', color: 'var(--color-ink)' }}>
      <Sidebar isOpen={isSidebarOpen} onClose={() => setSidebarOpen(false)} currentPage="memo" />

      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-[#E8F3EE] bg-white sticky top-0 z-20 shadow-sm">
        <div className="flex items-center gap-4">
          <button onClick={() => setSidebarOpen(true)} className="p-2 rounded-xl text-[var(--color-ink-muted)] hover:bg-[var(--color-primary-soft)] transition-colors">
            <Menu className="w-5 h-5" />
          </button>
          <div>
            <h1 className="font-black text-lg text-[var(--color-ink)] tracking-tight flex items-center gap-2">
              <FileText className="w-5 h-5 text-[var(--color-primary)]" />
              注意事項與備忘錄
            </h1>
            <p className="text-[10px] font-bold text-[var(--color-ink-muted)] uppercase tracking-widest">{tripInfo?.name}</p>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto w-full flex-1 p-6 flex flex-col">
        {/* Tabs */}
        <div className="flex gap-2 mb-8 overflow-x-auto custom-scrollbar pb-2">
          <button 
            onClick={() => setActiveTab('shared')}
            className={`px-5 py-2.5 rounded-full font-bold text-sm tracking-widest whitespace-nowrap transition-all shadow-sm ${activeTab === 'shared' ? 'bg-[var(--color-primary)] text-white' : 'bg-white text-[var(--color-ink-muted)] hover:bg-[var(--color-primary-soft)] border border-[var(--color-border-hairline)]'}`}
          >
            🌟 共用筆記
          </button>
          {members.map(m => (
            <button 
              key={m.id} onClick={() => setActiveTab(m.id)}
              className={`px-5 py-2.5 rounded-full font-bold text-sm whitespace-nowrap flex items-center gap-2 transition-all shadow-sm ${activeTab === m.id ? 'bg-[var(--color-ink)] text-white' : 'bg-white text-[var(--color-ink-muted)] hover:bg-[var(--color-primary-soft)] border border-[var(--color-border-hairline)]'}`}
            >
              <div className="w-2 h-2 rounded-full bg-[var(--color-accent2)]" />
              {m.nickname} 的清單
            </button>
          ))}
        </div>

        {/* Two Column Layout */}
        <div className="flex flex-col md:flex-row gap-8">
          
          {/* Left Column: Text Memos */}
          <div className="flex-1 max-w-2xl">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-black text-[var(--color-ink)] tracking-tight">文字備忘錄</h2>
              <button 
                onClick={() => handleAddMemo('text')} 
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--color-primary)] text-white text-xs font-bold rounded-xl shadow-sm hover:bg-[var(--color-primary-strong)] transition"
              >
                <Plus className="w-4 h-4" /> 新增區塊
              </button>
            </div>
            
            <div className="space-y-4">
              {textMemos.length === 0 ? (
                <div className="bg-white border-2 border-dashed border-[#D8EBE3] rounded-xl p-10 flex flex-col items-center justify-center text-center group cursor-pointer hover:border-[var(--color-primary)] transition" onClick={() => handleAddMemo('text')}>
                  <div className="w-12 h-12 bg-[var(--color-primary-soft)] rounded-full flex items-center justify-center mb-3 group-hover:scale-110 transition">
                    <FileText className="w-6 h-6 text-[var(--color-primary)]" />
                  </div>
                  <p className="font-bold text-[var(--color-ink-muted)] text-sm">目前沒有文字備忘錄</p>
                  <p className="text-xs text-[#C4CFC9] mt-1">點擊新增您的第一張筆記卡片</p>
                </div>
              ) : (
                textMemos.map(memo => (
                  <TextMemoCard key={memo.id} memo={memo} onUpdate={handleUpdateMemo} onDelete={handleDeleteMemo} />
                ))
              )}
            </div>
          </div>

          {/* Right Column: Checklists */}
          <div className="w-full md:w-[360px] lg:w-[420px]">
             <div className="bg-white rounded-xl p-6 shadow-sm border border-[#E8F3EE] sticky top-24">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-black text-[var(--color-ink)] tracking-tight flex items-center gap-2">
                    核取清單 <span className="bg-[var(--color-primary-soft)] text-[var(--color-primary-strong)] text-[10px] px-2 py-0.5 rounded-full">{todoMemos.filter(t => t.is_checked).length}/{todoMemos.length}</span>
                  </h2>
                </div>

                <div className="space-y-1 mb-6 max-h-[500px] overflow-y-auto custom-scrollbar pr-2">
                  {todoMemos.length === 0 ? (
                    <p className="text-center text-sm font-bold text-[#C4CFC9] py-8">還沒有任何待辦事項</p>
                  ) : (
                    todoMemos.map(memo => (
                      <TodoItem key={memo.id} memo={memo} onUpdate={handleUpdateMemo} onDelete={handleDeleteMemo} />
                    ))
                  )}
                </div>

                <button 
                  onClick={() => handleAddMemo('todo')} 
                  className="w-full py-3 border-2 border-dashed border-[#D8EBE3] rounded-xl text-[var(--color-ink-muted)] font-bold text-sm flex items-center justify-center gap-2 hover:border-[var(--color-primary)] hover:text-[var(--color-primary-strong)] hover:bg-[var(--color-primary-soft)] transition"
                >
                  <Plus className="w-4 h-4" /> 加入清單
                </button>
             </div>
          </div>

        </div>
      </div>
    </div>
  );
}
