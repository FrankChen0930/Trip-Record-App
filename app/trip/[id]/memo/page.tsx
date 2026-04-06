'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import Sidebar from '@/components/Sidebar';
import { useToast } from '@/components/Toast';
import type { Trip, Member, TripMemo } from '@/lib/types';
import { Menu, FileText, CheckSquare, Plus, Trash2, GripVertical, Type, Heading1 } from 'lucide-react';

function AutoResizeTextarea({ value, onChange, onKeyDown, onFocus, className, placeholder }: any) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  }, [value]);

  return (
    <textarea
      ref={textareaRef}
      value={value}
      onChange={onChange}
      onKeyDown={onKeyDown}
      onFocus={onFocus}
      placeholder={placeholder}
      rows={1}
      className={`resize-none overflow-hidden outline-none bg-transparent ${className}`}
    />
  );
}

export default function MemoPage() {
  const { id: tripId } = useParams();
  const router = useRouter();
  const { toast } = useToast();

  const [tripInfo, setTripInfo] = useState<Trip | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [memos, setMemos] = useState<TripMemo[]>([]);
  const [activeTab, setActiveTab] = useState<string>('shared');
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [focusedId, setFocusedId] = useState<string | null>(null);

  const fetchData = async () => {
    const { data: trip } = await supabase.from('trips').select('*').eq('id', tripId).single();
    setTripInfo(trip);

    const { data: mem } = await supabase.from('trip_members').select('*').eq('trip_id', tripId);
    setMembers(mem || []);

    const { data: mms } = await supabase.from('trip_memos').select('*').eq('trip_id', tripId).order('sort_order', { ascending: true });
    setMemos(mms || []);
  };

  useEffect(() => {
    if (tripId) fetchData();
  }, [tripId]);

  const activeMemos = memos.filter(m => activeTab === 'shared' ? m.member_id === null : m.member_id === activeTab);

  const handleUpdateMemo = async (id: string, updates: Partial<TripMemo>) => {
    if (id.startsWith('temp-')) return;
    setMemos(prev => prev.map(m => m.id === id ? { ...m, ...updates } : m));
    await supabase.from('trip_memos').update(updates).eq('id', id);
  };

  const handleAddBlock = async (afterIndex: number = activeMemos.length - 1, type: 'text' | 'todo' | 'heading1' = 'text') => {
    const newOrder = activeMemos.length > 0 ? (activeMemos[afterIndex]?.sort_order || 0) + 100 : 100; // Simplified ordering
    const newId = `temp-${Date.now()}`;
    const newBlock: TripMemo = {
      id: newId,
      trip_id: tripId as string,
      member_id: activeTab === 'shared' ? null : activeTab,
      content: '',
      is_checked: false,
      type: type,
      sort_order: newOrder,
      created_at: new Date().toISOString()
    };
    
    // Opt update
    setMemos(prev => {
      const copy = [...prev];
      copy.splice(prev.findIndex(m => m.id === activeMemos[afterIndex]?.id) + 1, 0, newBlock);
      return copy;
    });
    setFocusedId(newId);

    // DB update
    const { data } = await supabase.from('trip_memos').insert([{ ...newBlock, id: undefined }]).select().single();
    if (data) {
      setMemos(prev => prev.map(m => m.id === newId ? data as TripMemo : m));
      setFocusedId(data.id);
    }
  };

  const handleDeleteBlock = async (id: string, index: number) => {
    if (id.startsWith('temp-')) return;
    setMemos(prev => prev.filter(m => m.id !== id));
    if (index > 0) setFocusedId(activeMemos[index - 1].id);
    await supabase.from('trip_memos').delete().eq('id', id);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>, memo: TripMemo, index: number) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleAddBlock(index, memo.type === 'heading1' ? 'text' : memo.type);
    } else if (e.key === 'Backspace' && memo.content === '') {
      e.preventDefault();
      handleDeleteBlock(memo.id, index);
    } else if (e.key === ' ' && memo.content === '/todo') {
      e.preventDefault();
      handleUpdateMemo(memo.id, { type: 'todo', content: '' });
    } else if (e.key === ' ' && memo.content === '#') {
      e.preventDefault();
      handleUpdateMemo(memo.id, { type: 'heading1', content: '' });
    }
  };

  return (
    <div className="bg-white min-h-screen text-black flex flex-col font-sans">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setSidebarOpen(false)} currentPage="memo" />

      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-100 bg-white sticky top-0 z-20 shadow-sm">
        <div className="flex items-center gap-4">
          <button onClick={() => setSidebarOpen(true)} className="p-2 rounded-xl text-gray-500 hover:bg-gray-100 transition-colors">
            <Menu className="w-5 h-5" />
          </button>
          <div>
            <h1 className="font-black text-lg text-gray-900 tracking-tight flex items-center gap-2">
              <FileText className="w-5 h-5 text-rose-500" />
              注意事項與備忘錄
            </h1>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{tripInfo?.name}</p>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto w-full flex-1 p-6 flex flex-col">
        {/* Tabs */}
        <div className="flex gap-2 mb-8 overflow-x-auto custom-scrollbar pb-2">
          <button 
            onClick={() => setActiveTab('shared')}
            className={`px-5 py-2.5 rounded-full font-bold text-sm tracking-widest whitespace-nowrap transition-all ${activeTab === 'shared' ? 'bg-rose-500 text-white shadow-md' : 'bg-gray-50 text-gray-500 hover:bg-gray-100 border border-gray-100'}`}
          >
            🌟 共用筆記
          </button>
          {members.map(m => (
            <button 
              key={m.id} onClick={() => setActiveTab(m.id)}
              className={`px-5 py-2.5 rounded-full font-bold text-sm whitespace-nowrap flex items-center gap-2 transition-all ${activeTab === m.id ? 'bg-gray-900 text-white shadow-md' : 'bg-gray-50 text-gray-500 hover:bg-gray-100 border border-gray-100'}`}
            >
              <div className="w-2 h-2 rounded-full bg-emerald-400" />
              {m.nickname} 的清單
            </button>
          ))}
        </div>

        {/* Editor Area */}
        <div className="flex-1 min-h-[500px]">
          {activeMemos.length === 0 ? (
            <div className="mt-12 text-center text-gray-300 group cursor-pointer" onClick={() => handleAddBlock(-1)}>
               <FileText className="w-16 h-16 mx-auto mb-4 opacity-30 group-hover:opacity-60 transition-opacity" />
               <p className="font-bold mb-2">這裡還空空的</p>
               <p className="text-sm">點擊此處開始撰寫第一筆注意事項</p>
               <div className="flex items-center justify-center gap-4 mt-6 text-xs font-mono">
                 <span className="bg-gray-50 px-3 py-1 rounded-lg border border-gray-100">輸入 /todo 建立待辦清單</span>
                 <span className="bg-gray-50 px-3 py-1 rounded-lg border border-gray-100">輸入 # 開啟大標題</span>
               </div>
            </div>
          ) : (
            <div className="space-y-1 pb-32">
               {activeMemos.map((memo, idx) => (
                 <div key={memo.id} className="relative group flex items-start gap-2 -ml-8 pr-4">
                   {/* Handle & Controls */}
                   <div className="w-6 pt-1 flex-shrink-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                     <button onClick={() => handleDeleteBlock(memo.id, idx)} className="text-gray-300 hover:text-red-500 transition-colors p-1"><Trash2 className="w-3 h-3" /></button>
                   </div>
                   
                   {/* Block Content */}
                   <div className="flex-1 flex gap-3">
                     {memo.type === 'todo' && (
                       <button onClick={() => handleUpdateMemo(memo.id, { is_checked: !memo.is_checked })} className={`mt-1.5 flex-shrink-0 w-5 h-5 rounded-md border flex items-center justify-center transition-all ${memo.is_checked ? 'bg-rose-500 border-rose-500 text-white' : 'border-gray-300 text-transparent hover:border-rose-400'}`}>
                         <CheckSquare className="w-3.5 h-3.5" />
                       </button>
                     )}
                     
                     <AutoResizeTextarea 
                       value={memo.content}
                       onChange={(e: any) => {
                         const val = e.target.value;
                         setMemos(prev => prev.map(m => m.id === memo.id ? { ...m, content: val } : m));
                         // We rely on standard debounced updates or simple blur in production, but here we update state immediately and fire async save rarely.
                         // Actually, firing handleUpdateMemo on every stroke is bad. Let's rely on onBlur for DB sync.
                       }}
                       onBlur={(e: any) => handleUpdateMemo(memo.id, { content: e.target.value })}
                       onKeyDown={(e: any) => onKeyDown(e, memo, idx)}
                       autoFocus={focusedId === memo.id}
                       placeholder={memo.type === 'heading1' ? '標題...' : memo.type === 'todo' ? '待辦事項...' : '輸入斜線 / 選擇區塊類型，或直接輸入文字'}
                       className={`w-full py-1 leading-relaxed text-gray-800 focus:placeholder-gray-200 ${
                         memo.type === 'heading1' ? 'text-2xl font-black mt-4 mb-2' :
                         memo.type === 'todo' ? `text-base ${memo.is_checked ? 'line-through text-gray-400 font-medium pb-2' : ''}` :
                         'text-base'
                       }`}
                     />
                   </div>
                 </div>
               ))}
               <div className="h-20" onClick={() => handleAddBlock(activeMemos.length - 1)} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
