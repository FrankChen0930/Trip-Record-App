'use client';

import { useState } from 'react';
import { Crosshair, Loader2, MapPin, Star, X } from 'lucide-react';
import { placesApi, type PlaceResult } from '../api';

export interface PlaceCoord {
  lat: number;
  lng: number;
  placeId: string | null;
  name?: string;
  address?: string;        // 選定地點的地址/評分（需要的呼叫端自取）
  rating?: number | null;
}

interface PlaceLocateFieldProps {
  query: string;                       // 以行程「地點」欄位文字當搜尋字串
  value: PlaceCoord | null;
  onChange: (v: PlaceCoord | null) => void;
}

// 行程表單內的「Google 定位」欄：按鈕觸發搜尋（不隨打字打 API），
// 選定結果後只把座標存進表單狀態，儲存行程時一併寫入。
export default function PlaceLocateField({ query, value, onChange }: PlaceLocateFieldProps) {
  const [results, setResults] = useState<PlaceResult[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const search = async () => {
    const q = query.trim();
    if (!q) return;
    setLoading(true);
    setError(null);
    try {
      const { places } = await placesApi.search(q);
      setResults(places);
    } catch (e) {
      setError(e instanceof Error ? e.message : '搜尋失敗');
    } finally {
      setLoading(false);
    }
  };

  const pick = (p: PlaceResult) => {
    onChange({ lat: p.lat, lng: p.lng, placeId: p.placeId, name: p.name, address: p.address, rating: p.rating });
    setResults(null);
  };

  if (value) {
    return (
      <div className="flex items-center justify-between bg-[#E4F5EE] p-3 rounded-xl border border-[#C4DED3]">
        <span className="flex items-center gap-1.5 text-xs font-bold text-[var(--color-primary-strong)] min-w-0">
          <MapPin className="w-4 h-4 flex-shrink-0" />
          <span className="truncate">已定位{value.name ? `：${value.name}` : ''}</span>
        </span>
        <button type="button" onClick={() => onChange(null)} className="p-1 text-[var(--color-ink-muted)] hover:text-red-500 transition-colors flex-shrink-0" title="清除定位">
          <X className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={search}
        disabled={loading || !query.trim()}
        className="w-full flex items-center justify-center gap-1.5 py-3 rounded-xl text-xs font-bold bg-[var(--color-bg-page)] text-[var(--color-ink-muted)] hover:bg-[var(--color-primary-soft)] hover:text-[var(--color-primary-strong)] transition-all disabled:opacity-50"
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Crosshair className="w-4 h-4" />}
        用 Google 定位「{query.trim() || '地點'}」（供地圖顯示）
      </button>

      {error && <p className="text-[10px] text-red-500 font-bold px-1">{error}</p>}

      {results && (
        <div className="space-y-1.5 bg-[var(--color-bg-page)] p-2 rounded-xl border border-[var(--color-border-hairline)] max-h-48 overflow-y-auto custom-scrollbar">
          {results.length === 0 && <p className="text-[10px] text-[var(--color-ink-muted)] font-bold p-2">找不到結果</p>}
          {results.map((p) => (
            <button
              key={p.placeId}
              type="button"
              onClick={() => pick(p)}
              className="w-full text-left p-2.5 bg-white rounded-lg border border-[var(--color-border-hairline)] hover:border-[#9BDCC4] hover:shadow-sm transition-all"
            >
              <div className="text-xs font-bold text-[var(--color-ink)] flex items-center gap-1.5">
                {p.name}
                {p.rating != null && (
                  <span className="flex items-center gap-0.5 text-[10px] text-amber-600 font-bold">
                    <Star className="w-3 h-3 fill-amber-400 text-amber-400" />{p.rating}
                  </span>
                )}
              </div>
              <div className="text-[10px] text-[var(--color-ink-muted)] mt-0.5 line-clamp-1">{p.address}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
