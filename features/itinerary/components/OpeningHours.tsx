'use client';

import { useState } from 'react';
import { Clock, ChevronDown } from 'lucide-react';
import type { ItineraryItem } from '@/lib/types';
import { useOpeningHours } from '../hooks/useOpeningHours';

// 行程卡營業時間區塊：手機預設摺疊只顯示今日（點擊展開整週）、md 以上直接全部展開。
// 只有已定位（place_id）且 Google 有營業時間資訊的卡片才會顯示。
export default function OpeningHours({ item }: { item: ItineraryItem }) {
  const [expanded, setExpanded] = useState(false);
  const hours = useOpeningHours(item);
  if (!hours || hours.length === 0) return null;

  const todayIdx = (new Date().getDay() + 6) % 7; // Google 陣列從星期一開始，getDay() 從星期日
  const today = hours[todayIdx];

  return (
    <div className="mt-3 pt-3 border-t border-black/5">
      {/* 手機：一行今日營業時間，點擊展開整週 */}
      <button type="button" onClick={() => setExpanded(v => !v)} className="md:hidden w-full flex items-center gap-1.5 text-[10px] font-bold text-[var(--color-ink-muted)]">
        <Clock className="w-3 h-3 flex-shrink-0 text-[var(--color-primary)]" />
        <span className="flex-1 text-left truncate">{today}</span>
        <ChevronDown className={`w-3.5 h-3.5 flex-shrink-0 transition-transform ${expanded ? 'rotate-180' : ''}`} />
      </button>

      <div className={`${expanded ? 'block mt-2' : 'hidden'} md:block space-y-0.5`}>
        <div className="hidden md:flex items-center gap-1.5 text-[10px] font-black text-[var(--color-ink-muted)] uppercase tracking-widest mb-1">
          <Clock className="w-3 h-3 text-[var(--color-primary)]" /> 營業時間
        </div>
        {hours.map((line, i) => (
          <p key={i} className={`text-[10px] leading-relaxed ${i === todayIdx ? 'font-black text-[var(--color-primary-strong)]' : 'text-[var(--color-ink-muted)]'}`}>{line}</p>
        ))}
      </div>
    </div>
  );
}
