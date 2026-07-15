'use client';

import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import BottomTabs from '@/components/BottomTabs';
import { useToast } from '@/components/Toast';
import { useTrip } from '@/features/trips/hooks/useTrip';
import { useJournals } from '@/features/journal/hooks/useJournals';
import { useSaveJournal } from '@/features/journal/hooks/useSaveJournal';

export default function JournalPage() {
  const params = useParams();
  const tripId = Array.isArray(params.id) ? params.id[0] : params.id;

  // 伺服器資料改由 feature hooks（TanStack Query）提供
  const { data: tripInfo } = useTrip(tripId);
  const { data: journals = [] } = useJournals(tripId);
  const saveJournal = useSaveJournal(tripId);

  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [activeDay, setActiveDay] = useState(1);
  const [showDayZero, setShowDayZero] = useState(false);
  const [content, setContent] = useState('');
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const debounceTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const { toast } = useToast();
  const saving = saveJournal.isPending;

  useEffect(() => {
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem(`trip_${tripId}_dayZero`);
      if (saved === 'true') {
        setShowDayZero(true);
        if (activeDay === 1) setActiveDay(0);
      }
    }
  }, [tripId]);

  const days = useMemo(() => {
    if (!tripInfo?.start_date || !tripInfo?.end_date) return [1];
    const start = new Date(tripInfo.start_date);
    const end = new Date(tripInfo.end_date);
    const diffDays = Math.ceil(Math.abs(end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    return Array.from({ length: diffDays }, (_, i) => showDayZero ? i : i + 1);
  }, [tripInfo, showDayZero]);

  const getDayDate = (dayNum: number) => {
    if (!tripInfo?.start_date) return '';
    const date = new Date(tripInfo.start_date);
    date.setDate(date.getDate() + dayNum - (showDayZero ? 0 : 1));
    const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
    return `${date.getMonth() + 1}/${date.getDate()} ${weekdays[date.getDay()]}`;
  };

  // 切換天數時載入對應日記
  useEffect(() => {
    const journal = journals.find(j => j.day === activeDay);
    setContent(journal?.content || '');
    setLastSaved(journal?.updated_at ? new Date(journal.updated_at).toLocaleTimeString() : null);
  }, [activeDay, journals]);

  // 自動儲存 (debounce 1.5 秒)。寫入與快取更新交給 useSaveJournal mutation。
  const autoSave = useCallback((text: string) => {
    if (!tripId) return;
    saveJournal.mutate(
      { day: activeDay, content: text },
      {
        onSuccess: () => setLastSaved(new Date().toLocaleTimeString()),
        onError: () => toast('自動儲存失敗', 'error'),
      }
    );
  }, [tripId, activeDay, saveJournal, toast]);

  const handleContentChange = (text: string) => {
    setContent(text);
    clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => autoSave(text), 1500);
  };

  // 計算日記已填天數
  const filledDays = journals.filter(j => j.content?.trim()).map(j => j.day);

  // 字數
  const charCount = content.length;

  return (
    <div className="min-h-screen relative font-sans overflow-x-hidden" style={{ background: 'var(--color-bg-page)', color: 'var(--color-ink)' }}>
      <Sidebar isOpen={isSidebarOpen} onClose={() => setSidebarOpen(false)} currentPage="journal" />

      <div className="px-4 py-4 border-b border-[#E8F3EE] flex items-center justify-between bg-white/90 backdrop-blur-lg sticky top-0 z-30">
        <div className="flex items-center">
          <button onClick={() => setSidebarOpen(true)} className="sidebar-hamburger p-2.5 hover:bg-[var(--color-primary-soft)] rounded-xl transition-colors">☰</button>
          <h1 className="ml-4 font-bold text-lg tracking-tight">每日日記</h1>
        </div>
        <div className="flex items-center gap-2">
          {saving && <span className="text-[9px] text-[var(--color-primary-strong)] font-bold animate-pulse">儲存中...</span>}
          {!saving && lastSaved && <span className="text-[9px] text-[var(--color-ink-muted)] font-mono">已存 {lastSaved}</span>}
        </div>
      </div>

      <div className="max-w-xl mx-auto p-6 page-content-mobile">
        {/* 旅程名稱 */}
        <div className="mb-6">
          <h2 className="text-2xl font-black tracking-tight">{tripInfo?.name || '...'}</h2>
          <p className="text-[10px] text-[var(--color-ink-muted)] font-bold uppercase tracking-[0.2em] mt-1">Travel Journal · 旅行日誌</p>
        </div>

        {/* 日期選擇器（水平捲動） */}
        <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-4 mb-6">
          {days.map(d => {
            const hasDiary = filledDays.includes(d);
            return (
              <button
                key={d}
                onClick={() => setActiveDay(d)}
                className={`flex-none flex flex-col items-center px-4 py-2.5 rounded-2xl text-xs font-bold transition-all border-2 ${
                  activeDay === d
                    ? 'bg-[var(--color-ink)] text-white border-[var(--color-ink)] shadow-lg'
                    : hasDiary
                    ? 'bg-[var(--color-primary-soft)] border-[#9BDCC4] text-[var(--color-primary-strong)]'
                    : 'bg-white border-[var(--color-border-hairline)] text-[var(--color-ink-muted)] hover:border-[#9BDCC4]'
                }`}
              >
                <span>D{d}</span>
                <span className={`text-[9px] mt-0.5 ${activeDay === d ? 'text-white/60' : ''}`}>{getDayDate(d)}</span>
                {hasDiary && activeDay !== d && <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-accent2)] mt-1" />}
              </button>
            );
          })}
        </div>

        {/* 編輯器卡片 */}
        <div className="bg-white rounded-xl shadow-sm border border-[#E8F3EE] overflow-hidden min-h-[400px]">
          {/* 日期標頭 */}
          <div className="px-6 pt-5 pb-3 border-b border-[#E8F3EE]">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="font-bold text-[var(--color-ink)]">Day {activeDay}</h3>
                <p className="text-[10px] text-[var(--color-ink-muted)]">{getDayDate(activeDay)}</p>
              </div>
              <span className="text-[9px] text-[#C4CFC9] font-mono">{charCount} 字</span>
            </div>
          </div>

          {/* 文字編輯器 */}
          <textarea
            className="journal-editor"
            value={content}
            onChange={e => handleContentChange(e.target.value)}
            placeholder={`寫下 Day ${activeDay} 的旅行心得...\n\n今天去了哪裡？遇到了什麼有趣的事？\n吃了什麼好吃的？有什麼感想？`}
          />
        </div>

        {/* 日記概覽 */}
        <div className="mt-8">
          <h3 className="text-[10px] font-bold text-[var(--color-ink-muted)] uppercase tracking-widest mb-4">日記進度</h3>
          <div className="flex gap-1.5 flex-wrap">
            {days.map(d => (
              <div
                key={d}
                onClick={() => setActiveDay(d)}
                className={`w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-bold cursor-pointer transition-all ${
                  filledDays.includes(d)
                    ? 'bg-[var(--color-primary)] text-white shadow-sm'
                    : 'bg-[#EEF1F0] text-[#C4CFC9] hover:bg-[#E1E7E4]'
                } ${activeDay === d ? 'ring-2 ring-[var(--color-ink)] ring-offset-2' : ''}`}
              >
                {d}
              </div>
            ))}
          </div>
          <p className="text-[10px] text-[var(--color-ink-muted)] mt-3">{filledDays.length} / {days.length} 天已寫日記</p>
        </div>
      </div>

      <BottomTabs />
    </div>
  );
}
