'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { Search, Compass, Loader2, X } from 'lucide-react';
import { useToast } from '@/components/Toast';
import type { BucketItem, ItineraryItem } from '@/lib/types';
import type { NearbyKind, PlaceResult } from '@/features/suggestions/api';
import { usePlaceSearch, type PlaceSearchRequest } from '@/features/suggestions/hooks/usePlaceSearch';
import { useNearby, type NearbyRequest } from '@/features/suggestions/hooks/useNearby';
import { useAddBucketPlace, useUpdateBucketPlace } from '@/features/plan/hooks/usePlanMutations';
import PlaceCard from '@/features/suggestions/components/PlaceCard';
import type { MapPoint } from './TripMap';

const TripMap = dynamic(() => import('./TripMap'), {
  ssr: false,
  loading: () => <div className="w-full h-full animate-pulse bg-[var(--color-primary-soft)]/40" />,
});

// P5e: Plan 頁常駐地圖面板——搜尋 / 探索附近 / 定位全部在這張地圖上完成（取代全螢幕 MapPickerModal）。
const ITIN_COLOR = '#0F6E56';    // 已排行程：深湖水青（標 Day 編號）
const BUCKET_COLOR = '#6366F1';  // 備選池定位點：靛藍小點
const SEARCH_COLOR = '#1D9E75';  // 搜尋結果：湖水青
const NEARBY_COLOR = '#F97316';  // 建議景點：橘

const NEARBY_KINDS: { key: NearbyKind; label: string }[] = [
  { key: 'attraction', label: '景點' },
  { key: 'food', label: '美食' },
  { key: 'cafe', label: '咖啡' },
];

interface PlanMapPanelProps {
  tripId: string;
  itinerary: ItineraryItem[];
  bucketList: BucketItem[];
  locateTarget: BucketItem | null;  // 補定位模式：選到的地點寫回這個備選項目
  onClearLocate: () => void;
}

export default function PlanMapPanel({ tripId, itinerary, bucketList, locateTarget, onClearLocate }: PlanMapPanelProps) {
  const { toast } = useToast();
  const [searchText, setSearchText] = useState('');
  const [searchReq, setSearchReq] = useState<PlaceSearchRequest | null>(null);
  const [nearbyReq, setNearbyReq] = useState<NearbyRequest | null>(null);
  const [kind, setKind] = useState<NearbyKind>('attraction');
  const [focus, setFocus] = useState<{ lat: number; lng: number } | null>(null);
  const mapCenter = useRef<{ lat: number; lng: number } | null>(null);

  const { data: searchResults = [], isFetching: searching } = usePlaceSearch(searchReq);
  const { data: nearbyResults = [], isFetching: exploring } = useNearby(nearbyReq);
  const addBucketPlace = useAddBucketPlace(tripId);
  const updateBucketPlace = useUpdateBucketPlace(tripId);

  // 進入補定位模式：自動以項目名稱搜尋
  useEffect(() => {
    if (locateTarget) {
      setSearchText(locateTarget.title);
      setNearbyReq(null);
      setSearchReq({ query: locateTarget.title, ...(mapCenter.current ?? {}) });
    }
  }, [locateTarget]);

  const itineraryPoints = useMemo<MapPoint[]>(
    () =>
      itinerary
        .filter((i) => i.lat != null && i.lng != null)
        .map((i) => ({
          id: `it-${i.id}`,
          name: i.location,
          lat: i.lat as number,
          lng: i.lng as number,
          color: ITIN_COLOR,
          number: i.day,
          sub: `Day ${i.day}${i.start_time ? ` ${i.start_time.substring(0, 5)}` : ''}（已排行程）`,
        })),
    [itinerary]
  );

  const bucketPoints = useMemo<MapPoint[]>(
    () =>
      bucketList
        .filter((b) => b.lat != null && b.lng != null)
        .map((b) => ({
          id: `bk-${b.id}`,
          name: b.title,
          lat: b.lat as number,
          lng: b.lng as number,
          color: BUCKET_COLOR,
          sub: `備選池${b.rating != null ? `・★${b.rating}` : ''}`,
        })),
    [bucketList]
  );

  const addedPlaceIds = useMemo(
    () => new Set(bucketList.map((b) => b.place_id).filter(Boolean) as string[]),
    [bucketList]
  );

  const handlePick = (place: PlaceResult) => {
    if (locateTarget) {
      updateBucketPlace.mutate(
        { id: locateTarget.id, lat: place.lat, lng: place.lng, place_id: place.placeId, address: place.address || null, rating: place.rating },
        {
          onSuccess: () => {
            toast(`「${locateTarget.title}」已定位`, 'success');
            setSearchReq(null);
            onClearLocate();
          },
          onError: (err) => toast('定位失敗：' + (err instanceof Error ? err.message : '未知錯誤'), 'error'),
        }
      );
    } else {
      addBucketPlace.mutate(
        { category: 'attraction', title: place.name, lat: place.lat, lng: place.lng, place_id: place.placeId, address: place.address || null, rating: place.rating },
        {
          onSuccess: () => toast(`「${place.name}」已加入備選池`, 'success'),
          onError: (err) => toast('加入失敗：' + (err instanceof Error ? err.message : '未知錯誤'), 'error'),
        }
      );
    }
  };

  const actionLabel = locateTarget ? '設為位置' : '加入備選池';

  const toPoint = (p: PlaceResult, idx: number, color: string): MapPoint => ({
    id: `pl-${p.placeId}`,
    name: p.name,
    lat: p.lat,
    lng: p.lng,
    number: idx + 1,
    color,
    sub: p.address,
    action: { label: actionLabel, onClick: () => handlePick(p), done: !locateTarget && addedPlaceIds.has(p.placeId) },
  });

  const searchPoints = useMemo(
    () => searchResults.map((p, i) => toPoint(p, i, SEARCH_COLOR)),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- handlePick 依賴的 mutation 每 render 變、不適合入 deps
    [searchResults, addedPlaceIds, locateTarget]
  );
  const nearbyPoints = useMemo(
    () => nearbyResults.map((p, i) => toPoint(p, i, NEARBY_COLOR)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [nearbyResults, addedPlaceIds, locateTarget]
  );

  const allPoints = useMemo(
    () => [...itineraryPoints, ...bucketPoints, ...searchPoints, ...nearbyPoints],
    [itineraryPoints, bucketPoints, searchPoints, nearbyPoints]
  );

  // 有搜尋/探索結果時 fit 到結果；否則 fit 行程＋備選點
  const fitKey = searchPoints.length > 0 || nearbyPoints.length > 0
    ? `r-${searchPoints.map((p) => p.id).join(',')}-${nearbyPoints.map((p) => p.id).join(',')}`
    : `i-${[...itineraryPoints, ...bucketPoints].map((p) => p.id).join(',')}`;

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchText.trim();
    if (!q) return;
    setNearbyReq(null);
    setSearchReq({ query: q, ...(mapCenter.current ?? {}) });
  };

  const explore = (k: NearbyKind) => {
    setKind(k);
    const fallback = [...itineraryPoints, ...bucketPoints][0];
    const c = mapCenter.current ?? (fallback ? { lat: fallback.lat, lng: fallback.lng } : null);
    if (!c) { toast('請先移動地圖到想探索的區域', 'warning'); return; }
    setSearchReq(null);
    setNearbyReq({ lat: c.lat, lng: c.lng, kind: k });
  };

  const clearResults = () => {
    setSearchReq(null);
    setNearbyReq(null);
    if (locateTarget) onClearLocate();
  };

  const hasResults = !!searchReq || !!nearbyReq;
  const activeResults = searchReq ? searchResults : nearbyResults;
  const activeColor = searchReq ? SEARCH_COLOR : NEARBY_COLOR;
  const loadingResults = searchReq ? searching : exploring;

  return (
    // isolate：把 Leaflet 內部的高 z-index 關在本容器的 stacking context 裡，避免蓋過側欄/Modal
    <div className="relative isolate w-full h-full">
      <TripMap
        points={allPoints}
        fitKey={fitKey}
        focus={focus}
        onViewChange={(c) => { mapCenter.current = c; }}
        className="w-full h-full"
      />

      {/* 搜尋列（左上） */}
      <form onSubmit={submitSearch} className="absolute top-3 left-3 z-[1000] flex gap-1.5 w-[min(360px,calc(100%-24px))]">
        <div className="relative flex-1">
          <input
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder="搜尋地點加入備選池…"
            className="w-full bg-white/95 backdrop-blur p-2.5 pl-9 rounded-xl outline-none text-sm font-bold shadow-md border border-[var(--color-border-hairline)] focus:ring-2 focus:ring-[var(--color-primary)] transition-all"
          />
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-ink-muted)]" />
        </div>
        <button type="submit" disabled={searching} className="px-3.5 py-2 bg-[var(--color-primary)] text-white rounded-xl font-bold text-xs shadow-md hover:bg-[var(--color-primary-strong)] transition-all disabled:opacity-50">
          {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : '搜尋'}
        </button>
      </form>

      {/* 探索附近（右上） */}
      <div className="absolute top-3 right-3 z-[1000] flex gap-1">
        {NEARBY_KINDS.map((k) => (
          <button
            key={k.key}
            onClick={() => explore(k.key)}
            className={`px-2.5 py-2 rounded-xl text-xs font-black shadow-md transition-all flex items-center gap-1 border ${
              nearbyReq && kind === k.key
                ? 'bg-orange-500 text-white border-orange-500'
                : 'bg-white/95 backdrop-blur text-[var(--color-ink-muted)] border-[var(--color-border-hairline)] hover:text-orange-600'
            }`}
            title={`探索地圖中心附近的${k.label}`}
          >
            <Compass className="w-3.5 h-3.5" />{k.label}
          </button>
        ))}
      </div>

      {/* 補定位模式橫幅 */}
      {locateTarget && (
        <div className="absolute top-16 left-3 z-[1000] flex items-center gap-2 bg-amber-50/95 backdrop-blur border border-amber-200 rounded-xl px-3 py-2 shadow-md w-[min(360px,calc(100%-24px))]">
          <span className="flex-1 text-[11px] font-black text-amber-700 truncate">定位模式：為「{locateTarget.title}」選位置</span>
          <button onClick={clearResults} className="p-0.5 text-amber-500 hover:text-amber-700" title="取消定位">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* 浮動結果卡列 */}
      {hasResults && (
        <div className={`absolute left-3 ${locateTarget ? 'top-28' : 'top-16'} bottom-3 z-[1000] w-[min(300px,calc(100%-24px))] flex flex-col`}>
          <div className="flex items-center justify-between bg-white/95 backdrop-blur rounded-t-xl border border-b-0 border-[var(--color-border-hairline)] px-3 py-2 shadow-md">
            <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: activeColor }}>
              {searchReq ? '搜尋結果' : `附近${NEARBY_KINDS.find((k) => k.key === kind)?.label}`}
              {loadingResults ? '（查詢中…）' : `（${activeResults.length}）`}
            </span>
            <button onClick={clearResults} className="p-0.5 text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]" title="清除結果">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar bg-white/80 backdrop-blur rounded-b-xl border border-t-0 border-[var(--color-border-hairline)] shadow-md p-2 space-y-2">
            {activeResults.map((p, i) => (
              <PlaceCard
                key={p.placeId} place={p} index={i + 1} color={activeColor}
                actionLabel={actionLabel} done={!locateTarget && addedPlaceIds.has(p.placeId)}
                onSelect={() => setFocus({ lat: p.lat, lng: p.lng })}
                onAction={() => handlePick(p)}
              />
            ))}
            {!loadingResults && activeResults.length === 0 && (
              <p className="text-xs text-[var(--color-ink-muted)] font-bold p-2">
                {searchReq ? '找不到結果，換個關鍵字試試。' : '這一帶沒找到，移動地圖再探索一次。'}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
