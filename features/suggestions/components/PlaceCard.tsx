'use client';

import { Star, MapPin } from 'lucide-react';
import type { PlaceResult } from '../api';

interface PlaceCardProps {
  place: PlaceResult;
  index?: number;          // 對應地圖 marker 編號
  color?: string;          // 編號徽章底色（與 marker 同色）
  actionLabel: string;
  done?: boolean;          // 已加入過
  onSelect: () => void;    // 點卡片 → 地圖飛過去
  onAction: () => void;
}

export default function PlaceCard({ place, index, color = '#1D9E75', actionLabel, done, onSelect, onAction }: PlaceCardProps) {
  return (
    <div
      onClick={onSelect}
      className="p-3 bg-white border border-[var(--color-border-hairline)] rounded-xl shadow-sm hover:shadow-md hover:border-[#9BDCC4] transition-all cursor-pointer"
    >
      <div className="flex items-start gap-2">
        {index !== undefined && (
          <span
            className="flex-shrink-0 w-5 h-5 rounded-full text-white text-[10px] font-black font-mono flex items-center justify-center mt-0.5"
            style={{ background: color }}
          >
            {index}
          </span>
        )}
        <div className="flex-1 min-w-0">
          <h4 className="font-bold text-sm text-[var(--color-ink)] leading-tight">{place.name}</h4>
          <div className="flex items-center gap-2 mt-1 text-[10px] text-[var(--color-ink-muted)] font-bold">
            {place.rating != null && (
              <span className="flex items-center gap-0.5 text-amber-600">
                <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                {place.rating}{place.ratingCount != null && <span className="text-[var(--color-ink-muted)] font-medium">({place.ratingCount})</span>}
              </span>
            )}
            {place.typeLabel && <span className="bg-[var(--color-primary-soft)] text-[var(--color-primary-strong)] px-1.5 py-0.5 rounded">{place.typeLabel}</span>}
          </div>
          {place.address && (
            <p className="text-[10px] text-[var(--color-ink-muted)] mt-1 line-clamp-1 flex items-center gap-1">
              <MapPin className="w-3 h-3 flex-shrink-0" />{place.address}
            </p>
          )}
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); if (!done) onAction(); }}
          disabled={done}
          className={`flex-shrink-0 text-[10px] font-black px-2.5 py-1.5 rounded-lg transition-all ${
            done
              ? 'bg-[var(--color-primary-soft)] text-[var(--color-primary-strong)] cursor-default'
              : 'bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-strong)] active:scale-95'
          }`}
        >
          {done ? '✓ 已加入' : actionLabel}
        </button>
      </div>
    </div>
  );
}
