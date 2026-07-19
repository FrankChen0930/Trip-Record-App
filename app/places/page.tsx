'use client';

import { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import Sidebar from '@/components/Sidebar';
import Modal from '@/components/Modal';
import { useToast } from '@/components/Toast';
import { useConfirm } from '@/components/ConfirmDialog';
import { Menu, Plus, Compass, Star, MapPin, Link as LinkIcon, RefreshCw, Edit2, Trash2, Clock, Loader2 } from 'lucide-react';
import type { WishPlace, WishSourceType } from '@/lib/types';
import { useVisibleMembers } from '@/features/members/hooks/useVisibleMembers';
import { useWishPlaces, wishStatus, type WishDisplayStatus } from '@/features/wishlist/hooks/useWishPlaces';
import { useAddWishPlace, useUpdateWishPlace, useRemoveWishPlace, useCheckWishStatus, useStaleStatusCheck } from '@/features/wishlist/hooks/useWishMutations';
import PlaceLocateField, { type PlaceCoord } from '@/features/suggestions/components/PlaceLocateField';
import type { MapPoint } from '@/features/map/components/TripMap';

const TripMap = dynamic(() => import('@/features/map/components/TripMap'), {
  ssr: false,
  loading: () => <div className="w-full h-full animate-pulse bg-[var(--color-primary-soft)]/40" />,
});

const SOURCE_META: Record<WishSourceType, { label: string; badge: string }> = {
  instagram: { label: 'IG 看到', badge: 'bg-pink-100 text-pink-700' },
  youtube: { label: 'YT 看到', badge: 'bg-red-100 text-red-700' },
  friend: { label: '朋友推薦', badge: 'bg-blue-100 text-blue-700' },
  visited: { label: '去過想再去', badge: 'bg-emerald-100 text-emerald-700' },
  other: { label: '其他', badge: 'bg-gray-100 text-gray-600' },
};

const STATUS_META: Record<WishDisplayStatus, { label: string; badge: string; marker: string } | null> = {
  ok: null, // 正常不顯示徽章
  expired: { label: '已結束', badge: 'bg-amber-100 text-amber-700', marker: '#F59E0B' },
  closed_temp: { label: '暫停營業', badge: 'bg-orange-100 text-orange-700', marker: '#F97316' },
  closed: { label: '已歇業', badge: 'bg-red-100 text-red-700', marker: '#EF4444' },
  unknown: null,
};

type SourceFilter = 'all' | WishSourceType;
type StatusFilter = 'all' | 'ok' | 'limited' | 'gone';

export default function PlacesPage() {
  const { toast } = useToast();
  const { confirm } = useConfirm();
  const [isSidebarOpen, setSidebarOpen] = useState(false);

  const { data: places = [], isLoading } = useWishPlaces();
  // p9：發現者名單只列自己看得到的成員（同身分組）
  const { visible: members } = useVisibleMembers();
  useStaleStatusCheck(places);

  const addWish = useAddWishPlace();
  const updateWish = useUpdateWishPlace();
  const removeWish = useRemoveWishPlace();
  const checkStatus = useCheckWishStatus();

  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [focus, setFocus] = useState<{ lat: number; lng: number } | null>(null);

  // 新增/編輯 Modal（editing=null 且 open=true 代表新增）
  const [isFormOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<WishPlace | null>(null);
  const [fTitle, setFTitle] = useState('');
  const [fCoord, setFCoord] = useState<PlaceCoord | null>(null);
  const [fAddress, setFAddress] = useState<string | null>(null);
  const [fRating, setFRating] = useState<number | null>(null);
  const [fSource, setFSource] = useState<WishSourceType>('instagram');
  const [fSourceUrl, setFSourceUrl] = useState('');
  const [fFoundBy, setFFoundBy] = useState('');
  const [fExpires, setFExpires] = useState('');
  const [fNote, setFNote] = useState('');

  const openAdd = () => {
    setEditing(null);
    setFTitle(''); setFCoord(null); setFAddress(null); setFRating(null);
    setFSource('instagram'); setFSourceUrl(''); setFFoundBy(''); setFExpires(''); setFNote('');
    setFormOpen(true);
  };

  // 分享入口：IG/YT「分享」到本 App（Android share target / iOS 捷徑）帶著
  // ?shared_title=&shared_text=&shared_url= 開啟本頁 → 預填新增表單。
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const sTitle = sp.get('shared_title') ?? '';
    const sText = sp.get('shared_text') ?? '';
    let sUrl = sp.get('shared_url') ?? '';
    if (!sTitle && !sText && !sUrl) return;
    if (!sUrl) {
      const m = sText.match(/https?:\/\/\S+/);
      if (m) sUrl = m[0];
    }
    const cleanText = sText.replace(/https?:\/\/\S+/g, '').trim();
    setEditing(null);
    setFTitle(sTitle || cleanText.slice(0, 60));
    setFCoord(null); setFAddress(null); setFRating(null);
    setFSource(sUrl.includes('instagram.com') ? 'instagram' : /youtu\.?be/.test(sUrl) ? 'youtube' : 'other');
    setFSourceUrl(sUrl);
    setFFoundBy(''); setFExpires('');
    setFNote(sTitle && cleanText ? cleanText : '');
    setFormOpen(true);
    window.history.replaceState({}, '', '/places'); // 清掉網址參數，避免重整重複觸發
  }, []);

  const openEdit = (p: WishPlace) => {
    setEditing(p);
    setFTitle(p.title);
    setFCoord(p.lat != null && p.lng != null ? { lat: p.lat, lng: p.lng, placeId: p.place_id } : null);
    setFAddress(p.address); setFRating(p.rating);
    setFSource(p.source_type); setFSourceUrl(p.source_url || '');
    setFFoundBy(p.found_by || ''); setFExpires(p.expires_at || ''); setFNote(p.note || '');
    setFormOpen(true);
  };

  const submitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fTitle.trim()) { toast('請填寫名稱', 'warning'); return; }
    const row = {
      title: fTitle.trim(),
      lat: fCoord?.lat ?? null, lng: fCoord?.lng ?? null, place_id: fCoord?.placeId ?? null,
      address: fCoord ? fAddress : null, rating: fCoord ? fRating : null,
      source_type: fSource, source_url: fSourceUrl.trim() || null,
      found_by: fFoundBy || null, expires_at: fExpires || null, note: fNote.trim() || null,
    };
    try {
      if (editing) await updateWish.mutateAsync({ id: editing.id, data: row });
      else await addWish.mutateAsync(row);
      setFormOpen(false);
      toast(editing ? '已更新' : '已加入探索清單', 'success');
    } catch (error) {
      toast('儲存失敗：' + (error instanceof Error ? error.message : '未知錯誤'), 'error');
    }
  };

  const handleDelete = async (p: WishPlace) => {
    const ok = await confirm({ message: `確定刪除「${p.title}」嗎？`, confirmText: '刪除', danger: true });
    if (!ok) return;
    removeWish.mutate(p.id, {
      onSuccess: () => toast('已刪除', 'info'),
      onError: (err) => toast('刪除失敗：' + (err instanceof Error ? err.message : '未知錯誤'), 'error'),
    });
  };

  const handleCheck = (p: WishPlace) => {
    checkStatus.mutate(p, {
      onSuccess: (status) =>
        toast(status === 'OPERATIONAL' ? '確認營業中 ✓' : status === 'CLOSED_TEMPORARILY' ? '目前暫停營業' : status ? '此地點似乎已不存在' : '查無狀態資訊', status === 'OPERATIONAL' ? 'success' : 'warning'),
      onError: (err) => toast('檢查失敗：' + (err instanceof Error ? err.message : '未知錯誤'), 'error'),
    });
  };

  const memberName = (id: string | null) => members.find((m) => m.id === id)?.nickname ?? null;

  const filtered = useMemo(() => places.filter((p) => {
    if (sourceFilter !== 'all' && p.source_type !== sourceFilter) return false;
    const st = wishStatus(p);
    if (statusFilter === 'ok' && (st === 'expired' || st === 'closed' || st === 'closed_temp')) return false;
    if (statusFilter === 'limited' && !p.expires_at) return false;
    if (statusFilter === 'gone' && st !== 'expired' && st !== 'closed' && st !== 'closed_temp') return false;
    return true;
  }), [places, sourceFilter, statusFilter]);

  const mapPoints = useMemo<MapPoint[]>(
    () => filtered
      .filter((p) => p.lat != null && p.lng != null)
      .map((p) => {
        const st = wishStatus(p);
        return {
          id: p.id, name: p.title, lat: p.lat as number, lng: p.lng as number,
          color: STATUS_META[st]?.marker ?? '#1D9E75',
          sub: [SOURCE_META[p.source_type].label, memberName(p.found_by) ? `by ${memberName(p.found_by)}` : null].filter(Boolean).join('・'),
        };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- memberName 由 members 導出
    [filtered, members]
  );

  return (
    <div className="min-h-screen font-sans" style={{ background: 'var(--color-bg-page)', color: 'var(--color-ink)' }}>
      <Sidebar isOpen={isSidebarOpen} onClose={() => setSidebarOpen(false)} currentPage="places" />

      {/* Header */}
      <div className="sticky top-0 z-[50] bg-white/90 backdrop-blur-md border-b border-[var(--color-border-hairline)] px-4 py-3 flex items-center gap-3">
        <button onClick={() => setSidebarOpen(true)} className="p-2 rounded-xl text-[var(--color-ink-muted)] hover:bg-[var(--color-primary-soft)] transition-colors">
          <Menu className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2">
          <Compass className="w-5 h-5 text-[var(--color-primary)]" />
          <div>
            <h1 className="font-black text-lg tracking-tight leading-none">探索清單</h1>
            <p className="text-[9px] font-bold text-[var(--color-ink-muted)] uppercase tracking-widest mt-0.5">Wish Places・{places.length} 個地點</p>
          </div>
        </div>
        <button onClick={openAdd} className="ml-auto flex items-center gap-1 px-4 py-2 bg-[var(--color-primary)] text-white rounded-xl font-bold text-xs shadow-sm hover:bg-[var(--color-primary-strong)] active:scale-95 transition-all">
          <Plus className="w-4 h-4" /> 新增地點
        </button>
      </div>

      <div className="max-w-5xl mx-auto px-4 pb-24">
        {/* 地圖 */}
        {mapPoints.length > 0 && (
          <div className="relative isolate mt-4 rounded-xl overflow-hidden border border-[var(--color-border-hairline)] shadow-[0_8px_30px_rgba(15,110,86,0.06)] h-[300px] bg-white">
            <TripMap points={mapPoints} fitKey={mapPoints.map((p) => p.id).join('|')} focus={focus} className="w-full h-full" />
          </div>
        )}

        {/* 篩選 */}
        <div className="flex flex-wrap items-center gap-1.5 mt-4">
          {([['all', '全部'], ['instagram', 'IG'], ['youtube', 'YT'], ['friend', '朋友推薦'], ['visited', '去過想再去'], ['other', '其他']] as [SourceFilter, string][]).map(([key, label]) => (
            <button key={key} onClick={() => setSourceFilter(key)}
              className={`px-3 py-1.5 rounded-pill text-[11px] font-black rounded-full transition-all ${sourceFilter === key ? 'bg-[var(--color-primary)] text-white shadow-sm' : 'bg-white text-[var(--color-ink-muted)] border border-[var(--color-border-hairline)] hover:border-[#9BDCC4]'}`}>
              {label}
            </button>
          ))}
          <div className="w-px h-5 bg-[var(--color-border-hairline)] mx-1" />
          {([['all', '全部狀態'], ['ok', '可去'], ['limited', '限時'], ['gone', '已結束/歇業']] as [StatusFilter, string][]).map(([key, label]) => (
            <button key={key} onClick={() => setStatusFilter(key)}
              className={`px-3 py-1.5 text-[11px] font-black rounded-full transition-all ${statusFilter === key ? 'bg-[var(--color-ink)] text-white shadow-sm' : 'bg-white text-[var(--color-ink-muted)] border border-[var(--color-border-hairline)] hover:border-[#9BDCC4]'}`}>
              {label}
            </button>
          ))}
        </div>

        {/* 卡片牆 */}
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-4">
            {[...Array(6)].map((_, i) => <div key={i} className="h-40 rounded-xl bg-white/60 animate-pulse" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center pt-20 pb-10">
            <Compass className="w-12 h-12 mx-auto text-[var(--color-ink-muted)] opacity-30 mb-4" />
            <h3 className="text-lg font-bold text-[var(--color-ink-muted)]">{places.length === 0 ? '還沒有收藏任何地點' : '沒有符合篩選的地點'}</h3>
            <p className="text-sm text-[var(--color-ink-muted)] opacity-70 mt-1">在 IG 看到有興趣的店，就把它存進來吧</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-4">
            {filtered.map((p) => {
              const st = wishStatus(p);
              const stMeta = STATUS_META[st];
              const founder = memberName(p.found_by);
              return (
                <div key={p.id}
                  onClick={() => p.lat != null && p.lng != null && setFocus({ lat: p.lat, lng: p.lng })}
                  className={`bg-white rounded-xl border border-[var(--color-border-hairline)] shadow-sm hover:shadow-md transition-all p-4 flex flex-col gap-2 ${stMeta ? 'opacity-80' : ''} ${p.lat != null ? 'cursor-pointer' : ''}`}>
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-black text-sm leading-tight flex-1 min-w-0">{p.title}</h3>
                    {p.rating != null && (
                      <span className="flex items-center gap-0.5 text-[11px] text-amber-600 font-black flex-shrink-0">
                        <Star className="w-3 h-3 fill-amber-400 text-amber-400" />{p.rating}
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-1">
                    <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${SOURCE_META[p.source_type].badge}`}>{SOURCE_META[p.source_type].label}</span>
                    {founder && <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-[var(--color-primary-soft)] text-[var(--color-primary-strong)]">by {founder}</span>}
                    {p.expires_at && st !== 'expired' && (
                      <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 flex items-center gap-0.5"><Clock className="w-2.5 h-2.5" />限時至 {p.expires_at}</span>
                    )}
                    {stMeta && <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${stMeta.badge}`}>{stMeta.label}</span>}
                  </div>

                  {p.address && <p className="text-[10px] text-[var(--color-ink-muted)] flex items-center gap-1 line-clamp-1"><MapPin className="w-3 h-3 flex-shrink-0" />{p.address}</p>}
                  {p.note && <p className="text-[11px] text-[var(--color-ink-muted)] line-clamp-2 leading-relaxed">{p.note}</p>}

                  <div className="flex items-center gap-1 mt-auto pt-2 border-t border-[var(--color-border-hairline)]">
                    {p.source_url && (
                      <a href={p.source_url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}
                        className="p-1.5 rounded-lg text-[var(--color-ink-muted)] hover:bg-[var(--color-primary-soft)] hover:text-[var(--color-primary-strong)] transition-all" title="開啟來源（IG/YT 等）">
                        <LinkIcon className="w-3.5 h-3.5" />
                      </a>
                    )}
                    {p.place_id && (
                      <button onClick={(e) => { e.stopPropagation(); handleCheck(p); }} disabled={checkStatus.isPending}
                        className="p-1.5 rounded-lg text-[var(--color-ink-muted)] hover:bg-[var(--color-primary-soft)] hover:text-[var(--color-primary-strong)] transition-all disabled:opacity-40" title="重新檢查是否還在營業">
                        {checkStatus.isPending && checkStatus.variables?.id === p.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                      </button>
                    )}
                    <span className="text-[8px] text-[var(--color-ink-muted)] opacity-50 font-bold ml-1">
                      {p.status_checked_at ? `檢查於 ${p.status_checked_at.substring(0, 10)}` : p.place_id ? '未檢查' : '未定位'}
                    </span>
                    <div className="ml-auto flex gap-1">
                      <button onClick={(e) => { e.stopPropagation(); openEdit(p); }} className="p-1.5 rounded-lg text-[var(--color-ink-muted)] hover:bg-[var(--color-primary-soft)] hover:text-[var(--color-primary-strong)] transition-all" title="編輯"><Edit2 className="w-3.5 h-3.5" /></button>
                      <button onClick={(e) => { e.stopPropagation(); handleDelete(p); }} className="p-1.5 rounded-lg text-[#C4CFC9] hover:bg-red-50 hover:text-red-500 transition-all" title="刪除"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 新增 / 編輯 Modal */}
      <Modal isOpen={isFormOpen} onClose={() => setFormOpen(false)} title={editing ? '編輯地點' : '新增到探索清單'}>
        <form onSubmit={submitForm}>
          <div className="space-y-4">
            <input value={fTitle} onChange={(e) => setFTitle(e.target.value)} placeholder="地點名稱（例：綠町抹茶）" autoFocus
              className="w-full bg-[var(--color-bg-page)] p-4 rounded-xl outline-none font-black focus:ring-2 focus:ring-[var(--color-primary)] transition-all" />

            <PlaceLocateField query={fTitle} value={fCoord} onChange={(v) => { setFCoord(v); setFAddress(v?.address ?? null); setFRating(v?.rating ?? null); }} />

            <div className="flex flex-wrap gap-1.5">
              {(Object.keys(SOURCE_META) as WishSourceType[]).map((key) => (
                <button key={key} type="button" onClick={() => setFSource(key)}
                  className={`px-3 py-2 rounded-xl text-xs font-bold transition-all ${fSource === key ? 'bg-[var(--color-primary)] text-white shadow-sm' : 'bg-[#EEF1F0] text-[var(--color-ink-muted)]'}`}>
                  {SOURCE_META[key].label}
                </button>
              ))}
            </div>

            <input value={fSourceUrl} onChange={(e) => setFSourceUrl(e.target.value)} placeholder="來源連結（IG 短片網址等，可選）"
              className="w-full bg-[var(--color-bg-page)] p-3 rounded-xl outline-none text-xs font-mono font-bold focus:ring-2 focus:ring-[var(--color-primary)]" />

            <div className="flex gap-2">
              <select value={fFoundBy} onChange={(e) => setFFoundBy(e.target.value)}
                className="w-1/2 bg-[var(--color-bg-page)] p-3 rounded-xl outline-none font-bold text-xs appearance-none">
                <option value="">誰發現的（可選）</option>
                {members.map((m) => <option key={m.id} value={m.id}>{m.nickname}</option>)}
              </select>
              <div className="w-1/2 relative">
                <input type="date" value={fExpires} onChange={(e) => setFExpires(e.target.value)} title="限時活動截止日（可選）"
                  className="w-full bg-[var(--color-bg-page)] p-3 rounded-xl outline-none font-bold text-xs" />
                {!fExpires && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] font-bold text-[var(--color-ink-muted)] pointer-events-none opacity-60">限時截止日</span>}
              </div>
            </div>

            <textarea value={fNote} onChange={(e) => setFNote(e.target.value)} placeholder="備註（想吃什麼、注意事項…）"
              className="w-full bg-[var(--color-bg-page)] p-4 rounded-xl h-20 outline-none resize-none font-medium focus:ring-2 focus:ring-[var(--color-primary)]" />

            <button type="submit" disabled={addWish.isPending || updateWish.isPending}
              className="w-full py-4 bg-[var(--color-primary)] text-white rounded-xl font-bold shadow-lg hover:bg-[var(--color-primary-strong)] disabled:opacity-50">
              {editing ? '儲存變更' : '加入清單'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
