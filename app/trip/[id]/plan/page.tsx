'use client';

import { useEffect, useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import { useToast } from '@/components/Toast';
import { DndContext, useDraggable, useDroppable, DragEndEvent, DragOverlay, TouchSensor, MouseSensor, useSensor, useSensors } from '@dnd-kit/core';
import type { ItineraryItem, BucketItem, TripAccommodation } from '@/lib/types';
import { useTrip } from '@/features/trips/hooks/useTrip';
import { usePlanData } from '@/features/plan/hooks/usePlanData';
import {
  useAssignBucket, useInsertItinerary, useRemoveItinerary, useAddBucket, useSaveAccommodation,
  useMoveItinerary, useUnassignItinerary, useUpdateItineraryItem, useUpdateBucketItem, useRemoveBucketItem,
} from '@/features/plan/hooks/usePlanMutations';
import { useConfirm } from '@/components/ConfirmDialog';
import PlaceLocateField, { type PlaceCoord } from '@/features/suggestions/components/PlaceLocateField';
import { Menu, Navigation, CheckCircle2, Clock, Trash2, Plus, GripVertical, MapPin, Map, Compass, ChevronUp, ChevronDown, Bed, Edit2, Link as LinkIcon, Crosshair, Star, ListPlus } from 'lucide-react';
import type { WishPlace } from '@/lib/types';
import { useWishPlaces, wishStatus } from '@/features/wishlist/hooks/useWishPlaces';
import Modal from '@/components/Modal';
import PlanMapPanel from '@/features/map/components/PlanMapPanel';

// --- DND Draggable Item（備選池卡：可拖、點擊編輯、定位/刪除鈕常駐） ---
function DraggableBucketItem({ item, onLocate, onEdit, onDelete }: {
  item: BucketItem;
  onLocate: (item: BucketItem) => void;
  onEdit: (item: BucketItem) => void;
  onDelete: (item: BucketItem) => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `bucket-${item.id}`,
    data: { type: 'BucketItem', item }
  });
  const located = item.lat != null && item.lng != null;

  return (
    <div
      ref={setNodeRef} {...listeners} {...attributes}
      onClick={() => onEdit(item)}
      className={`p-3 bg-white border border-[#E8F3EE] rounded-xl shadow-sm mb-2 flex items-start gap-2 ${isDragging ? 'opacity-50' : 'hover:shadow-md'} transition-all cursor-grab active:cursor-grabbing`}
    >
      <GripVertical className="w-4 h-4 text-[#C4CFC9] mt-1 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <h4 className="font-bold text-sm text-[var(--color-ink)] flex items-center gap-1">
          <span className="truncate">{item.title}</span>
          {located && <MapPin className="w-3 h-3 text-[var(--color-primary)] flex-shrink-0" aria-label="已定位" />}
          {item.rating != null && <span className="text-[9px] text-amber-600 font-black flex-shrink-0">★{item.rating}</span>}
        </h4>
        {item.note && <p className="text-[10px] text-[var(--color-ink-muted)] mt-1 line-clamp-1">{item.note}</p>}
      </div>
      <div className="flex flex-col gap-0.5 flex-shrink-0">
        {!located && (
          <button
            onClick={(e) => { e.stopPropagation(); onLocate(item); }}
            className="p-1.5 rounded-lg text-[var(--color-ink-muted)] hover:bg-[var(--color-primary-soft)] hover:text-[var(--color-primary-strong)] transition-all"
            title="用 Google 定位這個項目"
          >
            <Crosshair className="w-3.5 h-3.5" />
          </button>
        )}
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(item); }}
          className="p-1.5 rounded-lg text-[#C4CFC9] hover:bg-red-50 hover:text-red-500 transition-all"
          title="刪除"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

// --- 行程格內的卡片（P5d：可拖到別格 / 拖回備選池、點擊編輯） ---
function DraggableItineraryCard({ item, timeStr, onRemove, onEdit }: {
  item: ItineraryItem;
  timeStr: string;
  onRemove: (id: string) => void;
  onEdit: (item: ItineraryItem) => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `itin-${item.id}`,
    data: { type: 'ItineraryCard', item }
  });

  return (
    <div
      ref={setNodeRef} {...listeners} {...attributes}
      onClick={() => onEdit(item)}
      className={`bg-white p-2 rounded-lg shadow-sm border border-[#D8EBE3] relative hover:border-[#9BDCC4] transition-colors cursor-grab active:cursor-grabbing ${isDragging ? 'opacity-40' : ''}`}
    >
      <div className="flex justify-between items-start mb-1">
        <span className="text-[9px] font-black font-mono text-white bg-[var(--color-ink)] px-1.5 py-0.5 rounded shadow-sm">
          {item.start_time?.substring(0, 5) || timeStr}
        </span>
        <button
          onClick={(e) => { e.stopPropagation(); onRemove(item.id); }}
          className="text-[#C4CFC9] hover:text-red-500 transition-all z-20"
          title="刪除"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      </div>
      <h4 className="font-bold text-[11px] text-[var(--color-ink)] leading-tight flex items-center gap-1">
        <span className="min-w-0">{item.location}</span>
        {item.lat != null && item.lng != null && <MapPin className="w-2.5 h-2.5 text-[var(--color-primary)] flex-shrink-0" aria-label="已定位" />}
      </h4>
    </div>
  );
}

// --- 備選池整欄是 drop zone（行程卡拖回來＝退回備選） ---
function BucketPoolDropZone({ children }: { children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: 'bucket-pool' });
  return (
    <div
      ref={setNodeRef}
      className={`flex-1 overflow-y-auto p-3 custom-scrollbar transition-colors ${isOver ? 'bg-[var(--color-primary-soft)]/50 ring-2 ring-inset ring-[var(--color-primary)] rounded-lg' : ''}`}
    >
      {children}
    </div>
  );
}

// --- Spreadsheet Grid Droppable Cell ---
function DroppableTimeCell({ dayNum, timeStr, items, onRemoveItem, onInsert, onEditItem }: { dayNum: number, timeStr: string, items: ItineraryItem[], onRemoveItem: (id: string) => void, onInsert: (day: number, time: string) => void, onEditItem: (item: ItineraryItem) => void }) {
  const { setNodeRef, isOver } = useDroppable({
    id: `cell-${dayNum}-${timeStr}`,
    data: { day: dayNum, time: timeStr }
  });

  return (
    <div ref={setNodeRef} className={`h-28 border-b border-r border-[#E8F3EE] p-1.5 relative group ${isOver ? 'bg-[var(--color-primary-soft)]/50 ring-2 ring-inset ring-[var(--color-primary)]' : 'bg-transparent'} transition-colors flex flex-col gap-1 overflow-y-auto custom-scrollbar`}>
      {/* Insert Button（常駐，行動裝置沒有 hover） */}
      <button onClick={() => onInsert(dayNum, timeStr)} className="absolute bottom-1 right-1 w-6 h-6 rounded-full bg-white shadow-md border border-[#E8F3EE] flex items-center justify-center text-[var(--color-primary)] hover:text-white hover:bg-[var(--color-primary)] opacity-40 group-hover:opacity-100 transition-all z-50">
        <Plus className="w-3 h-3"/>
      </button>

      {/* Render mapped items */}
      <div className="relative z-10 flex flex-col gap-1 flex-1 pb-6 w-full">
        {items.map(item => (
          <DraggableItineraryCard key={item.id} item={item} timeStr={timeStr} onRemove={onRemoveItem} onEdit={onEditItem} />
        ))}
      </div>
    </div>
  );
}

// --- Daily Accommodation Block ---
function AccommodationCell({ day, data, tripId }: { day: number, data?: TripAccommodation, tripId: string }) {
  const { toast } = useToast();
  const saveAccommodation = useSaveAccommodation(tripId);
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(data?.name || '');
  const [mapUrl, setMapUrl] = useState(data?.map_url || '');
  const [bookingUrl, setBookingUrl] = useState(data?.booking_url || '');
  const [checkIn, setCheckIn] = useState(data?.check_in?.substring(0, 5) || '');
  const [checkOut, setCheckOut] = useState(data?.check_out?.substring(0, 5) || '');
  const [note, setNote] = useState(data?.note || '');

  useEffect(() => {
    setName(data?.name || '');
    setMapUrl(data?.map_url || '');
    setBookingUrl(data?.booking_url || '');
    setCheckIn(data?.check_in?.substring(0, 5) || '');
    setCheckOut(data?.check_out?.substring(0, 5) || '');
    setNote(data?.note || '');
  }, [data]);

  const handleSave = async () => {
    if (!name) return;
    try {
      await saveAccommodation.mutateAsync({ id: data?.id ?? null, day, name, mapUrl, bookingUrl, checkIn, checkOut, note });
      toast('住宿已更新', 'success');
      setIsEditing(false);
    } catch {
      toast('儲存失敗', 'error');
    }
  };

  return (
    <div className="border-b border-r border-[#E8F3EE] p-3 bg-indigo-50/30 flex flex-col min-h-[120px]">
       <div className="flex justify-between items-center mb-2">
         <span className="flex items-center gap-1 text-indigo-600 font-bold text-[11px] tracking-widest"><Bed className="w-3.5 h-3.5" /> 本日住宿</span>
         {data?.id && !isEditing && <button onClick={() => setIsEditing(true)} className="text-[var(--color-ink-muted)] hover:text-indigo-600 p-1"><Edit2 className="w-3 h-3"/></button>}
       </div>
       {isEditing || !data?.id ? (
         <div className="flex flex-col gap-1.5 focus-within:z-10 mt-1">
           <input value={name} onChange={e => setName(e.target.value)} placeholder="住宿名稱" className="text-xs p-2 rounded-lg border border-indigo-100 w-full outline-none focus:ring-1 focus:ring-indigo-400" />
           <input value={mapUrl} onChange={e => setMapUrl(e.target.value)} placeholder="網址 (地圖)" className="text-[10px] p-2 rounded-lg border border-indigo-100 w-full outline-none focus:ring-1 focus:ring-indigo-400" />
           <input value={bookingUrl} onChange={e => setBookingUrl(e.target.value)} placeholder="網址 (訂房網)" className="text-[10px] p-2 rounded-lg border border-indigo-100 w-full outline-none focus:ring-1 focus:ring-indigo-400" />
           <div className="flex items-center gap-1">
             <label className="text-[9px] font-bold text-indigo-400 w-7 flex-shrink-0">入住</label>
             <input type="time" value={checkIn} onChange={e => setCheckIn(e.target.value)} className="flex-1 min-w-0 text-[10px] p-1.5 rounded-lg border border-indigo-100 outline-none focus:ring-1 focus:ring-indigo-400" />
             <label className="text-[9px] font-bold text-indigo-400 w-7 flex-shrink-0 text-right">退房</label>
             <input type="time" value={checkOut} onChange={e => setCheckOut(e.target.value)} className="flex-1 min-w-0 text-[10px] p-1.5 rounded-lg border border-indigo-100 outline-none focus:ring-1 focus:ring-indigo-400" />
           </div>
           <textarea value={note} onChange={e => setNote(e.target.value)} placeholder="備註 / 注意事項（門禁、停車、早餐…）" rows={2} className="text-[10px] p-2 rounded-lg border border-indigo-100 w-full outline-none focus:ring-1 focus:ring-indigo-400 resize-none" />
           <div className="flex gap-1 mt-1">
             <button onClick={handleSave} className="flex-1 py-1.5 bg-indigo-600 text-white font-bold text-[10px] rounded-lg hover:bg-indigo-700 shadow-sm transition">儲存</button>
             {(isEditing && data?.id) && <button onClick={() => setIsEditing(false)} className="flex-1 py-1.5 bg-[#EEF1F0] text-[var(--color-ink-muted)] font-bold text-[10px] rounded-lg hover:bg-[#E1E7E4] transition">取消</button>}
           </div>
         </div>
       ) : (
         <div className="flex flex-col gap-1 mt-1">
           <h4 className="font-bold text-[13px] text-[var(--color-ink)] leading-tight mb-1">{data?.name}</h4>
           {(data?.check_in || data?.check_out) && (
             <p className="text-[10px] text-indigo-500 font-bold">
               {data?.check_in && `入住 ${data.check_in.substring(0, 5)}`}{data?.check_in && data?.check_out && ' ・ '}{data?.check_out && `退房 ${data.check_out.substring(0, 5)}`}
             </p>
           )}
           {data?.note && <p className="text-[10px] text-[var(--color-ink-muted)] leading-relaxed whitespace-pre-wrap">{data.note}</p>}
           {data?.map_url && <a href={data.map_url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-indigo-500 hover:text-indigo-600 font-medium flex items-center gap-1 bg-white p-1.5 rounded border border-indigo-50 shadow-sm"><Map className="w-3 h-3"/> 地圖導航</a>}
           {data?.booking_url && <a href={data.booking_url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-orange-500 hover:text-orange-600 font-medium flex items-center gap-1 bg-white p-1.5 rounded border border-orange-50 shadow-sm"><LinkIcon className="w-3 h-3"/> 訂房資訊</a>}
         </div>
       )}
    </div>
  );
}

// --- Main Page ---
export default function PlanPage() {
  const params = useParams();
  const tripId = Array.isArray(params.id) ? params.id[0] : params.id;
  const router = useRouter();
  const { toast } = useToast();

  // 伺服器資料改由 feature hooks 提供
  const { data: tripInfo } = useTrip(tripId);
  const { data: planData } = usePlanData(tripId);
  const itinerary = planData?.itinerary ?? [];
  const accommodations = planData?.accommodations ?? [];
  // 下游有 useMemo 依賴（bucketPlaceIds/bucketTitles），需要穩定的參考
  const bucketList = useMemo(() => planData?.bucketList ?? [], [planData]);
  const assignBucket = useAssignBucket(tripId);
  const insertItinerary = useInsertItinerary(tripId);
  const removeItinerary = useRemoveItinerary(tripId);
  const addBucket = useAddBucket(tripId);
  // P5d: 雙向拖曳與卡片編輯
  const moveItinerary = useMoveItinerary(tripId);
  const unassignItinerary = useUnassignItinerary(tripId);
  const updateItineraryItem = useUpdateItineraryItem(tripId);
  const updateBucketItem = useUpdateBucketItem(tripId);
  const removeBucketItem = useRemoveBucketItem(tripId);
  const { confirm } = useConfirm();
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  
  // Grid State
  const [startHour, setStartHour] = useState(7);
  const [endHour, setEndHour] = useState(21);
  const [showDayZero, setShowDayZero] = useState(false);

  useEffect(() => {
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem(`trip_${tripId}_dayZero`);
      if (saved === 'true') setShowDayZero(true);
    }
  }, [tripId]);

  const handleToggleDayZero = (checked: boolean) => {
    setShowDayZero(checked);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(`trip_${tripId}_dayZero`, checked.toString());
    }
  };

  // P5e: 補定位模式（在常駐地圖上完成）
  const [locateTarget, setLocateTarget] = useState<BucketItem | null>(null);
  const openLocate = (item: BucketItem) => setLocateTarget(item);

  // 從探索清單匯入備選池
  const [isImportOpen, setImportOpen] = useState(false);
  const { data: wishPlaces = [] } = useWishPlaces();
  const bucketPlaceIds = useMemo(() => new Set(bucketList.map(b => b.place_id).filter(Boolean) as string[]), [bucketList]);

  const importWish = async (p: WishPlace) => {
    try {
      await addBucket.mutateAsync({
        trip_id: tripId, category: 'attraction', title: p.title,
        note: p.note ?? null, link: p.source_url ?? null,
        lat: p.lat, lng: p.lng, place_id: p.place_id, address: p.address, rating: p.rating,
      });
      toast(`「${p.title}」已加入備選池`, 'success');
    } catch (error) {
      toast('匯入失敗：' + (error instanceof Error ? error.message : '未知錯誤'), 'error');
    }
  };

  // 從 Google Maps 已儲存清單匯入備選池（貼分享連結 → 解析 → 勾選匯入）
  const [isGListOpen, setGListOpen] = useState(false);
  const [glistUrl, setGlistUrl] = useState('');
  const [glistLoading, setGlistLoading] = useState(false);
  const [glistResult, setGlistResult] = useState<{ title: string; places: { name: string; address: string | null; lat: number | null; lng: number | null; note: string | null }[] } | null>(null);
  const [glistChecked, setGlistChecked] = useState<boolean[]>([]);
  const bucketTitles = useMemo(() => new Set(bucketList.map(b => b.title)), [bucketList]);

  const closeGList = () => { setGListOpen(false); setGlistUrl(''); setGlistResult(null); setGlistChecked([]); };

  const parseGList = async () => {
    if (!glistUrl.trim()) { toast('請先貼上清單分享連結', 'warning'); return; }
    setGlistLoading(true);
    try {
      const res = await fetch('/api/places/import-list', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: glistUrl.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `解析失敗 (${res.status})`);
      setGlistResult(data);
      // 預設全勾，但已在備選池的（同名）不勾
      setGlistChecked(data.places.map((p: { name: string }) => !bucketTitles.has(p.name)));
    } catch (error) {
      toast(error instanceof Error ? error.message : '解析失敗', 'error');
    } finally {
      setGlistLoading(false);
    }
  };

  const importGList = async () => {
    if (!glistResult) return;
    const picked = glistResult.places.filter((_, i) => glistChecked[i]);
    if (picked.length === 0) { toast('沒有勾選任何地點', 'warning'); return; }
    try {
      for (const p of picked) {
        // 名稱像住宿的自動歸類（與行程卡語意色一致）
        const isAcc = /民宿|飯店|旅店|酒店|營地|露營|B&B|HOTEL|HOSTEL/i.test(p.name);
        await addBucket.mutateAsync({
          trip_id: tripId, category: isAcc ? 'accommodation' : 'attraction', title: p.name,
          note: p.note, link: null, lat: p.lat, lng: p.lng, place_id: null, address: p.address, rating: null,
        });
      }
      toast(`已匯入 ${picked.length} 個地點到備選池`, 'success');
      closeGList();
    } catch (error) {
      toast('匯入失敗：' + (error instanceof Error ? error.message : '未知錯誤'), 'error');
    }
  };

  // Add Bucket Item Modal
  const [isAddOpen, setAddOpen] = useState(false);
  const [bucketTitle, setBucketTitle] = useState('');
  const [bucketCategory, setBucketCategory] = useState<'accommodation'|'attraction'|'note'>('attraction');

  // Insert Itinerary Item Modal
  const [isInsertOpen, setInsertOpen] = useState(false);
  const [insertDay, setInsertDay] = useState(1);
  const [insertTime, setInsertTime] = useState('08:00');
  const [insertTitle, setInsertTitle] = useState('');

  const [activeDrag, setActiveDrag] = useState<
    { kind: 'bucket'; item: BucketItem } | { kind: 'itin'; item: ItineraryItem } | null
  >(null);

  // P5d: 行程卡編輯 Modal
  const [editingItin, setEditingItin] = useState<ItineraryItem | null>(null);
  const [itinTime, setItinTime] = useState('08:00');
  const [itinTitle, setItinTitle] = useState('');
  const [itinTransport, setItinTransport] = useState('機車');
  const [itinNote, setItinNote] = useState('');
  const [itinCoord, setItinCoord] = useState<PlaceCoord | null>(null);

  const openEditItin = (item: ItineraryItem) => {
    setEditingItin(item);
    setItinTime(item.start_time?.substring(0, 5) || '08:00');
    setItinTitle(item.location);
    setItinTransport(item.transport_type || '機車');
    setItinNote(item.note || '');
    setItinCoord(item.lat != null && item.lng != null ? { lat: item.lat, lng: item.lng, placeId: item.place_id ?? null } : null);
  };

  const submitEditItin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItin || !itinTitle) return;
    try {
      await updateItineraryItem.mutateAsync({
        id: editingItin.id,
        data: {
          start_time: itinTime, location: itinTitle, transport_type: itinTransport, note: itinNote || null,
          lat: itinCoord?.lat ?? null, lng: itinCoord?.lng ?? null, place_id: itinCoord?.placeId ?? null,
        },
      });
      setEditingItin(null);
      toast('行程已更新', 'success');
    } catch (error) {
      toast('更新失敗：' + (error instanceof Error ? error.message : '未知錯誤'), 'error');
    }
  };

  // P5d: 備選池卡編輯 Modal
  const [editingBucket, setEditingBucket] = useState<BucketItem | null>(null);
  const [bEditTitle, setBEditTitle] = useState('');
  const [bEditCategory, setBEditCategory] = useState<'accommodation' | 'attraction' | 'note'>('attraction');
  const [bEditNote, setBEditNote] = useState('');
  const [bEditLink, setBEditLink] = useState('');
  const [bEditPrice, setBEditPrice] = useState('');

  const openEditBucket = (item: BucketItem) => {
    setEditingBucket(item);
    setBEditTitle(item.title);
    setBEditCategory(item.category);
    setBEditNote(item.note || '');
    setBEditLink(item.link || '');
    setBEditPrice(item.price != null ? String(item.price) : '');
  };

  const submitEditBucket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBucket || !bEditTitle) return;
    try {
      await updateBucketItem.mutateAsync({
        id: editingBucket.id,
        data: {
          title: bEditTitle, category: bEditCategory, note: bEditNote || null, link: bEditLink || null,
          price: bEditPrice.trim() !== '' && !Number.isNaN(Number(bEditPrice)) ? Number(bEditPrice) : null,
        },
      });
      setEditingBucket(null);
      toast('備選項目已更新', 'success');
    } catch (error) {
      toast('更新失敗：' + (error instanceof Error ? error.message : '未知錯誤'), 'error');
    }
  };

  const handleDeleteBucket = async (item: BucketItem) => {
    const ok = await confirm({ message: `確定刪除備選項目「${item.title}」嗎？`, confirmText: '刪除', danger: true });
    if (!ok) return;
    removeBucketItem.mutate(item.id, {
      onSuccess: () => toast('已刪除', 'info'),
      onError: (err) => toast('刪除失敗：' + (err instanceof Error ? err.message : '未知錯誤'), 'error'),
    });
  };

  const mouseSensor = useSensor(MouseSensor, { activationConstraint: { distance: 5 } });
  const touchSensor = useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } });
  const sensors = useSensors(mouseSensor, touchSensor);

  const days = useMemo(() => {
    if (!tripInfo?.start_date || !tripInfo?.end_date) return [1];
    const start = new Date(tripInfo.start_date);
    const end = new Date(tripInfo.end_date);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    const daysArr = Array.from({ length: diffDays }, (_, i) => showDayZero ? i : i + 1);
    return daysArr;
  }, [tripInfo, showDayZero]);

  const timeSlots = useMemo(() => {
    const slots = [];
    for (let h = startHour; h <= endHour; h++) {
      slots.push(`${h.toString().padStart(2, '0')}:00`);
      if (h !== endHour) {
        slots.push(`${h.toString().padStart(2, '0')}:30`);
      }
    }
    return slots;
  }, [startHour, endHour]);

  const getDayDate = (dayNum: number) => {
    if (!tripInfo?.start_date) return '';
    const date = new Date(tripInfo.start_date);
    date.setDate(date.getDate() + dayNum - (showDayZero ? 0 : 1));
    const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
    return `${date.getMonth() + 1}/${date.getDate()} (${weekdays[date.getDay()]})`;
  };

  const getSlotItems = (day: number, slot: string) => {
    return itinerary.filter(i => {
      if (i.day !== day) return false;
      const t = i.start_time || '08:00:00';
      const m = parseInt(t.substring(3, 5), 10);
      const mappedTime = `${t.substring(0, 2)}:${m < 30 ? '00' : '30'}`;
      return mappedTime === slot;
    });
  };

  const handleDragStart = (event: { active: { data: { current?: { type?: string; item?: unknown } } } }) => {
    const data = event.active.data.current;
    if (data?.type === 'BucketItem') setActiveDrag({ kind: 'bucket', item: data.item as BucketItem });
    else if (data?.type === 'ItineraryCard') setActiveDrag({ kind: 'itin', item: data.item as ItineraryItem });
  };

  // 與 getSlotItems 相同的取整規則：判斷「拖回原格」用
  const slotOf = (t: string | null) => {
    const time = t || '08:00:00';
    const m = parseInt(time.substring(3, 5), 10);
    return `${time.substring(0, 2)}:${m < 30 ? '00' : '30'}`;
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveDrag(null);
    const { active, over } = event;
    if (!over) return;
    const activeType = active.data.current?.type;

    // P5d: 行程卡拖回備選池 → 退回備選
    if (over.id === 'bucket-pool' && activeType === 'ItineraryCard') {
      const item = active.data.current?.item as ItineraryItem;
      unassignItinerary.mutate(item, {
        onSuccess: () => toast(`「${item.location}」已退回備選池`, 'success'),
        onError: (err) => toast('退回失敗: ' + (err instanceof Error ? err.message : '未知錯誤'), 'error'),
      });
      return;
    }

    if (!over.id.toString().startsWith('cell-')) return;
    const cellDay = over.data.current?.day;
    const cellTime = over.data.current?.time;
    if (cellDay === undefined || !cellTime) return;

    // 備選池 → 行程格（原有行為）
    if (activeType === 'BucketItem') {
      const bucketItem = bucketList.find(b => `bucket-${b.id}` === active.id);
      if (!bucketItem) return;
      assignBucket.mutate({ bucketItem, day: cellDay, time: cellTime }, {
        onSuccess: () => toast('行程已建立', 'success'),
        onError: (err) => toast('指派失敗: ' + (err instanceof Error ? err.message : '未知錯誤'), 'error'),
      });
      return;
    }

    // P5d: 行程卡拖到別格 → 改天/改時間
    if (activeType === 'ItineraryCard') {
      const item = active.data.current?.item as ItineraryItem;
      if (item.day === cellDay && slotOf(item.start_time) === cellTime) return; // 原格，不動
      moveItinerary.mutate({ id: item.id, day: cellDay, time: cellTime }, {
        onError: (err) => toast('移動失敗: ' + (err instanceof Error ? err.message : '未知錯誤'), 'error'),
      });
    }
  };

  const handleRemoveItinerary = (id: string) => {
    removeItinerary.mutate(id);
  };

  const handleAddBucketItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bucketTitle) return;
    try {
      await addBucket.mutateAsync({ trip_id: tripId, category: bucketCategory, title: bucketTitle });
      setBucketTitle('');
      setAddOpen(false);
      toast('已新增至備選池', 'success');
    } catch {
      toast('新增失敗', 'error');
    }
  };

  const openInsertModal = (day: number, timeStr: string) => {
    setInsertDay(day);
    setInsertTime(timeStr);
    setInsertTitle('');
    setInsertOpen(true);
  };

  const submitInsertModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if(!insertTitle) return;
    try {
      await insertItinerary.mutateAsync({ day: insertDay, time: insertTime, title: insertTitle });
      setInsertTitle('');
      setInsertOpen(false);
      toast('行程已新增', 'success');
    } catch {
      toast('新增失敗', 'error');
    }
  };

  return (
    // h-dvh：鎖定視窗高度，行程表/備選池只在自己面板內捲動，地圖不跟著跑
    <div className="bg-white h-dvh flex flex-col font-sans overflow-hidden" style={{ color: 'var(--color-ink)' }}>
      <Sidebar isOpen={isSidebarOpen} onClose={() => setSidebarOpen(false)} currentPage="plan" />

      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-[#E8F3EE] bg-white shadow-sm z-20 flex-shrink-0">
        <div className="flex items-center gap-4">
          <button onClick={() => setSidebarOpen(true)} className="p-2 rounded-xl text-[var(--color-ink-muted)] hover:bg-[var(--color-primary-soft)] transition-colors">
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-3">
            <div>
              <h1 className="font-black text-lg text-[var(--color-ink)] tracking-tight">行事曆規畫模式 (Beta)</h1>
              <p className="text-[10px] font-bold text-[var(--color-primary)] uppercase tracking-widest">{tripInfo?.name}</p>
            </div>
            <div className="h-6 w-px bg-[#D8EBE3] mx-2"></div>
            <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-[var(--color-ink-muted)] bg-[var(--color-bg-page)] px-3 py-1.5 rounded-lg border border-[#E8F3EE] hover:bg-[var(--color-primary-soft)] transition-colors">
              <input type="checkbox" checked={showDayZero} onChange={e => handleToggleDayZero(e.target.checked)} className="accent-[var(--color-primary)]" />
              從 Day 0 開始計算
            </label>
          </div>
        </div>
        <button onClick={() => router.push(`/trip/${tripId}`)} className="bg-[var(--color-primary-soft)] text-[var(--color-primary-strong)] px-4 py-2 rounded-xl font-bold text-xs hover:bg-[#B9E7D6] transition-colors flex items-center gap-1 shadow-sm">
          <CheckCircle2 className="w-4 h-4" /> 儲存並檢視
        </button>
      </div>

      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">

          {/* P5e: 常駐地圖（左 2/3）——搜尋 / 探索附近 / 定位都在這張圖上 */}
          <div className="relative h-[38vh] lg:h-auto lg:flex-[2] min-w-0 border-b lg:border-b-0 lg:border-r border-[#E8F3EE]">
            <PlanMapPanel
              tripId={tripId as string}
              itinerary={itinerary}
              bucketList={bucketList}
              locateTarget={locateTarget}
              onClearLocate={() => setLocateTarget(null)}
            />
          </div>

          {/* Spreadsheet Board（右側視窗化，內部捲動） */}
          <div className="flex-1 lg:flex-[1] min-h-0 min-w-0 overflow-auto custom-scrollbar bg-[var(--color-bg-page)] p-3">
            
            <div className="bg-white border text-[var(--color-ink)] border-[#D8EBE3] rounded-xl shadow-sm flex flex-col w-max">
              
              {/* Header Row (Days) */}
              <div className="flex border-b border-[#D8EBE3] bg-[var(--color-bg-page)] sticky top-0 z-10">
                 <div className="w-20 border-r border-[#D8EBE3] flex-shrink-0 flex items-center justify-center">
                    <Clock className="w-5 h-5 text-[#C4CFC9]" />
                 </div>
                 {days.map(d => (
                   <div key={d} className="w-48 border-r border-[#D8EBE3] flex-shrink-0 p-3 flex flex-col items-center justify-center">
                     <span className="text-sm font-black text-[var(--color-ink)]">Day {d}</span>
                     <span className="text-[10px] text-[var(--color-ink-muted)] font-bold mt-0.5">{getDayDate(d)}</span>
                   </div>
                 ))}
              </div>

              {/* Grid Body */}
              <div className="flex relative">
                 {/* Y-Axis: Time Slots */}
                 <div className="w-20 flex-shrink-0 bg-white z-0 flex flex-col border-r border-[#D8EBE3]">
                    <div className="h-8 flex border-b border-[#E8F3EE] bg-[var(--color-bg-page)]">
                        <button onClick={() => setStartHour(Math.max(0, startHour - 1))} className="flex-1 hover:bg-[var(--color-primary-soft)] flex items-center justify-center text-[var(--color-ink-muted)] transition-colors" title="增加更早時間"><ChevronUp className="w-4 h-4"/></button>
                        <button onClick={() => setStartHour(Math.min(23, startHour + 1))} className="flex-1 hover:bg-[var(--color-primary-soft)] flex items-center justify-center text-[var(--color-ink-muted)] transition-colors border-l border-[#E8F3EE]" title="刪除時間列"><Trash2 className="w-3 h-3"/></button>
                    </div>
                    {timeSlots.map(t => (
                      <div key={t} className="h-28 border-b border-[#E8F3EE] flex items-start justify-center p-2">
                        <span className="text-[10px] font-mono font-bold text-[var(--color-ink-muted)]">{t}</span>
                      </div>
                    ))}
                    <div className="h-8 flex border-b border-[#E8F3EE] bg-[var(--color-bg-page)]">
                        <button onClick={() => setEndHour(Math.max(0, endHour - 1))} className="flex-1 hover:bg-[var(--color-primary-soft)] flex items-center justify-center text-[var(--color-ink-muted)] transition-colors border-r border-[#E8F3EE]" title="刪除時間列"><Trash2 className="w-3 h-3"/></button>
                        <button onClick={() => setEndHour(Math.min(23, endHour + 1))} className="flex-1 hover:bg-[var(--color-primary-soft)] flex items-center justify-center text-[var(--color-ink-muted)] transition-colors" title="增加更晚時間"><ChevronDown className="w-4 h-4"/></button>
                    </div>
                    
                    {/* Placeholder for Accommodation row */}
                    <div className="flex-1 min-h-[120px] bg-white border-r border-[#D8EBE3] border-b border-[#E8F3EE]"></div>
                 </div>

                 {/* Columns */}
                 {days.map(d => (
                   <div key={d} className="w-48 flex-shrink-0 flex flex-col bg-white">
                     <div className="h-8 border-b border-r border-[#E8F3EE] bg-[var(--color-bg-page)]"></div>
                     {timeSlots.map(t => (
                       <DroppableTimeCell
                         key={`${d}-${t}`} dayNum={d} timeStr={t}
                         items={getSlotItems(d, t)}
                         onRemoveItem={handleRemoveItinerary}
                         onInsert={openInsertModal}
                         onEditItem={openEditItin}
                       />
                     ))}
                     <AccommodationCell day={d} data={accommodations.find(a => a.day === d)} tripId={tripId as string} />
                     <div className="h-8 bg-[var(--color-bg-page)] border-r border-[#E8F3EE] border-b"></div>
                   </div>
                 ))}
              </div>

            </div>

          </div>

          {/* Bucket List Sidebar (Right) */}
          <div className="w-full h-56 lg:h-auto lg:w-64 bg-[var(--color-bg-page)] border-t lg:border-t-0 lg:border-l border-[#E8F3EE] flex flex-col flex-shrink-0 shadow-[-10px_0_30px_rgba(0,0,0,0.02)] z-10">
            <div className="p-4 border-b border-[#E8F3EE] bg-white flex justify-between items-center z-10 shadow-sm relative">
              <div>
                <h3 className="font-black text-[var(--color-ink)] flex items-center gap-2"><Navigation className="w-4 h-4 text-[var(--color-primary)]" /> 備選池</h3>
                <p className="text-[9px] text-[var(--color-ink-muted)] font-bold mt-1 uppercase tracking-widest">拖曳項目至行程表</p>
              </div>
              <div className="flex gap-1.5">
                <button onClick={() => setImportOpen(true)} className="w-8 h-8 flex items-center justify-center bg-white border border-[#D8EBE3] text-[var(--color-primary-strong)] rounded-lg shadow-sm hover:bg-[var(--color-primary-soft)] transition" title="從探索清單匯入">
                  <Compass className="w-4 h-4" />
                </button>
                <button onClick={() => setGListOpen(true)} className="w-8 h-8 flex items-center justify-center bg-white border border-[#D8EBE3] text-[var(--color-primary-strong)] rounded-lg shadow-sm hover:bg-[var(--color-primary-soft)] transition" title="匯入 Google 地圖清單">
                  <ListPlus className="w-4 h-4" />
                </button>
                <button onClick={() => setAddOpen(true)} className="w-8 h-8 flex items-center justify-center bg-[var(--color-primary)] text-white rounded-lg shadow-sm hover:bg-[var(--color-primary-strong)] transition" title="手動新增">
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>
            
            <BucketPoolDropZone>
              <p className="text-[9px] text-[var(--color-ink-muted)] font-bold mb-3 px-1 opacity-70">行程卡也可以拖回這裡退回備選</p>
              <div className="mb-6">
                <h4 className="text-[10px] font-black text-[var(--color-ink-muted)] uppercase tracking-widest mb-2 px-1">景點 / 美食</h4>
                {bucketList.filter(b => b.category === 'attraction').map(item => (
                  <DraggableBucketItem key={item.id} item={item} onLocate={openLocate} onEdit={openEditBucket} onDelete={handleDeleteBucket} />
                ))}
              </div>
              <div className="mb-6">
                <h4 className="text-[10px] font-black text-[var(--color-ink-muted)] uppercase tracking-widest mb-2 px-1">住宿</h4>
                {bucketList.filter(b => b.category === 'accommodation').map(item => (
                  <DraggableBucketItem key={item.id} item={item} onLocate={openLocate} onEdit={openEditBucket} onDelete={handleDeleteBucket} />
                ))}
              </div>
            </BucketPoolDropZone>
          </div>

        </div>

        {/* Drag Overlay for smooth Visual Feedback */}
        <DragOverlay>
          {activeDrag?.kind === 'bucket' ? (
            <div className="p-3 bg-white border-2 border-[var(--color-primary)] rounded-xl shadow-2xl flex items-start gap-2 rotate-3 scale-105 opacity-90 w-48">
              <GripVertical className="w-4 h-4 text-[#C4CFC9] mt-1 flex-shrink-0" />
              <div>
                <h4 className="font-bold text-sm text-[var(--color-ink)]">{activeDrag.item.title}</h4>
              </div>
            </div>
          ) : activeDrag?.kind === 'itin' ? (
            <div className="p-2 bg-white border-2 border-[var(--color-primary)] rounded-lg shadow-2xl rotate-3 scale-105 opacity-90 w-40">
              <span className="text-[9px] font-black font-mono text-white bg-[var(--color-ink)] px-1.5 py-0.5 rounded shadow-sm">
                {activeDrag.item.start_time?.substring(0, 5)}
              </span>
              <h4 className="font-bold text-[11px] text-[var(--color-ink)] leading-tight mt-1">{activeDrag.item.location}</h4>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* Add Bucket Item Modal */}
      <Modal isOpen={isAddOpen} onClose={() => setAddOpen(false)} title="新增至備選池">
        <form onSubmit={handleAddBucketItem}>
          <div className="space-y-4">
            <div className="flex gap-2">
              <button type="button" onClick={() => setBucketCategory('attraction')} className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${bucketCategory === 'attraction' ? 'bg-[var(--color-primary)] text-white' : 'bg-[#EEF1F0] text-[var(--color-ink-muted)]'}`}>景點/美食</button>
              <button type="button" onClick={() => setBucketCategory('accommodation')} className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${bucketCategory === 'accommodation' ? 'bg-[var(--color-primary)] text-white' : 'bg-[#EEF1F0] text-[var(--color-ink-muted)]'}`}>住宿</button>
            </div>
            <input 
              value={bucketTitle} onChange={e => setBucketTitle(e.target.value)} 
              placeholder="名稱 (例如: 春水堂)" 
              className="w-full bg-[var(--color-bg-page)] p-4 rounded-xl outline-none font-bold focus:ring-2 focus:ring-[var(--color-primary)]"
              autoFocus
            />
            <button type="submit" className="w-full py-4 bg-[var(--color-primary)] text-white rounded-xl font-bold shadow-lg hover:bg-[var(--color-primary-strong)]">新增</button>
          </div>
        </form>
      </Modal>

      {/* Insert Event Modal */}
      <Modal isOpen={isInsertOpen} onClose={() => setInsertOpen(false)} title="安插行程">
        <form onSubmit={submitInsertModal}>
          <div className="space-y-4">
            <div className="bg-[var(--color-primary-soft)]/60 p-3 rounded-xl border border-[#C4DED3] flex items-center justify-between text-xs font-bold text-[var(--color-primary-strong)]">
               <span>Day {insertDay}</span>
               <span className="font-mono bg-[#CDEEE2] px-2 py-1 rounded-lg">{insertTime}</span>
            </div>
            <div className="flex gap-2">
              <input type="time" value={insertTime} onChange={e => setInsertTime(e.target.value)} className="bg-[var(--color-bg-page)] p-4 rounded-xl outline-none font-bold font-mono focus:ring-2 focus:ring-[var(--color-primary)] w-1/3" />
              <input 
                value={insertTitle} onChange={e => setInsertTitle(e.target.value)} 
                placeholder="行程名稱" 
                className="w-2/3 bg-[var(--color-bg-page)] p-4 rounded-xl outline-none font-bold focus:ring-2 focus:ring-[var(--color-primary)]"
                autoFocus
              />
            </div>
            <button type="submit" className="w-full py-4 bg-[var(--color-primary)] text-white rounded-xl font-bold hover:bg-[var(--color-primary-strong)]">儲存</button>
          </div>
        </form>
      </Modal>

      {/* 從探索清單匯入 Modal */}
      <Modal isOpen={isImportOpen} onClose={() => setImportOpen(false)} title="從探索清單匯入">
        <div className="space-y-2 max-h-[60vh] overflow-y-auto custom-scrollbar">
          {wishPlaces.length === 0 && (
            <p className="text-sm text-[var(--color-ink-muted)] font-bold text-center py-8">
              探索清單還是空的——側欄「探索清單」可以開始收藏地點
            </p>
          )}
          {wishPlaces.map(p => {
            const st = wishStatus(p);
            const added = !!p.place_id && bucketPlaceIds.has(p.place_id);
            const gone = st === 'expired' || st === 'closed';
            return (
              <div key={p.id} className={`flex items-center gap-2 p-3 bg-white border border-[var(--color-border-hairline)] rounded-xl ${gone ? 'opacity-60' : ''}`}>
                <div className="flex-1 min-w-0">
                  <h4 className="font-bold text-sm text-[var(--color-ink)] flex items-center gap-1.5">
                    <span className="truncate">{p.title}</span>
                    {p.rating != null && <span className="flex items-center gap-0.5 text-[10px] text-amber-600 font-black flex-shrink-0"><Star className="w-3 h-3 fill-amber-400 text-amber-400" />{p.rating}</span>}
                    {p.lat != null && <MapPin className="w-3 h-3 text-[var(--color-primary)] flex-shrink-0" />}
                  </h4>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    {gone && <span className="text-[9px] font-black text-red-500">{st === 'expired' ? '已結束' : '已歇業'}</span>}
                    {p.address && <span className="text-[10px] text-[var(--color-ink-muted)] truncate">{p.address}</span>}
                  </div>
                </div>
                <button
                  onClick={() => importWish(p)}
                  disabled={added || addBucket.isPending}
                  className={`flex-shrink-0 text-[10px] font-black px-3 py-1.5 rounded-lg transition-all ${
                    added ? 'bg-[var(--color-primary-soft)] text-[var(--color-primary-strong)] cursor-default'
                      : 'bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-strong)] active:scale-95 disabled:opacity-50'
                  }`}
                >
                  {added ? '✓ 已在池中' : '加入'}
                </button>
              </div>
            );
          })}
        </div>
      </Modal>

      {/* 匯入 Google 地圖清單 Modal */}
      <Modal isOpen={isGListOpen} onClose={closeGList} title="匯入 Google 地圖清單">
        <div className="space-y-4">
          <p className="text-[11px] text-[var(--color-ink-muted)] font-bold leading-relaxed">
            在 Google Maps 打開你的「已儲存清單」→ 分享 → 複製連結貼到這裡（清單要設為公開分享）
          </p>
          <div className="flex gap-2">
            <input
              value={glistUrl} onChange={e => setGlistUrl(e.target.value)}
              placeholder="https://maps.app.goo.gl/…"
              className="flex-1 min-w-0 bg-[var(--color-bg-page)] p-3.5 rounded-xl outline-none text-xs font-mono font-bold focus:ring-2 focus:ring-[var(--color-primary)] transition-all"
            />
            <button onClick={parseGList} disabled={glistLoading} className="flex-shrink-0 px-4 py-3.5 bg-[var(--color-primary)] text-white rounded-xl font-bold text-xs hover:bg-[var(--color-primary-strong)] disabled:opacity-50 transition">
              {glistLoading ? '解析中…' : '解析'}
            </button>
          </div>

          {glistResult && (
            <>
              <div className="flex items-center justify-between">
                <h4 className="font-black text-sm text-[var(--color-ink)] truncate">{glistResult.title}</h4>
                <button
                  onClick={() => setGlistChecked(prev => prev.every(Boolean) ? prev.map(() => false) : prev.map(() => true))}
                  className="flex-shrink-0 text-[10px] font-black text-[var(--color-primary-strong)] px-2 py-1 rounded-lg hover:bg-[var(--color-primary-soft)] transition"
                >
                  {glistChecked.every(Boolean) ? '全部取消' : '全選'}
                </button>
              </div>
              <div className="space-y-1.5 max-h-[40vh] overflow-y-auto custom-scrollbar">
                {glistResult.places.map((p, i) => {
                  const dup = bucketTitles.has(p.name);
                  return (
                    <label key={i} className={`flex items-center gap-2.5 p-3 bg-white border border-[var(--color-border-hairline)] rounded-xl cursor-pointer hover:border-[#9BDCC4] transition ${dup ? 'opacity-60' : ''}`}>
                      <input
                        type="checkbox" checked={glistChecked[i] ?? false}
                        onChange={() => setGlistChecked(prev => prev.map((c, j) => j === i ? !c : c))}
                        className="w-4 h-4 accent-[var(--color-primary)] flex-shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-xs text-[var(--color-ink)] truncate flex items-center gap-1.5">
                          <span className="truncate">{p.name}</span>
                          {p.lat != null && <MapPin className="w-3 h-3 text-[var(--color-primary)] flex-shrink-0" />}
                          {dup && <span className="text-[9px] font-black text-[var(--color-ink-muted)] flex-shrink-0">已在池中</span>}
                        </p>
                        {p.address && <p className="text-[10px] text-[var(--color-ink-muted)] truncate mt-0.5">{p.address}</p>}
                      </div>
                    </label>
                  );
                })}
              </div>
              <button onClick={importGList} disabled={addBucket.isPending} className="w-full py-4 bg-[var(--color-primary)] text-white rounded-xl font-bold shadow-lg hover:bg-[var(--color-primary-strong)] disabled:opacity-50 transition">
                {addBucket.isPending ? '匯入中…' : `匯入 ${glistChecked.filter(Boolean).length} 個地點`}
              </button>
            </>
          )}
        </div>
      </Modal>

      {/* P5d: 行程卡編輯 Modal */}
      <Modal isOpen={!!editingItin} onClose={() => setEditingItin(null)} title="編輯行程">
        <form onSubmit={submitEditItin}>
          <div className="space-y-4">
            <div className="bg-[var(--color-primary-soft)]/60 p-3 rounded-xl border border-[#C4DED3] text-xs font-bold text-[var(--color-primary-strong)]">
              Day {editingItin?.day}
            </div>
            <div className="flex gap-2">
              <input type="time" value={itinTime} onChange={e => setItinTime(e.target.value)} className="bg-[var(--color-bg-page)] p-4 rounded-xl outline-none font-bold font-mono focus:ring-2 focus:ring-[var(--color-primary)] w-1/3" />
              <input value={itinTitle} onChange={e => setItinTitle(e.target.value)} placeholder="行程名稱" className="w-2/3 bg-[var(--color-bg-page)] p-4 rounded-xl outline-none font-bold focus:ring-2 focus:ring-[var(--color-primary)]" />
            </div>
            <PlaceLocateField query={itinTitle} value={itinCoord} onChange={setItinCoord} />
            <select value={itinTransport} onChange={e => setItinTransport(e.target.value)} className="w-full bg-[var(--color-bg-page)] p-4 rounded-xl outline-none font-black appearance-none">
              <option>機車</option><option>汽車</option><option>火車</option><option>高鐵</option><option>步行</option>
            </select>
            <textarea value={itinNote} onChange={e => setItinNote(e.target.value)} className="w-full bg-[var(--color-bg-page)] p-4 rounded-xl h-20 outline-none resize-none font-medium focus:ring-2 focus:ring-[var(--color-primary)]" placeholder="備註..." />
            <button type="submit" disabled={updateItineraryItem.isPending} className="w-full py-4 bg-[var(--color-primary)] text-white rounded-xl font-bold shadow-lg hover:bg-[var(--color-primary-strong)] disabled:opacity-50">儲存</button>
          </div>
        </form>
      </Modal>

      {/* P5d: 備選池卡編輯 Modal */}
      <Modal isOpen={!!editingBucket} onClose={() => setEditingBucket(null)} title="編輯備選項目">
        <form onSubmit={submitEditBucket}>
          <div className="space-y-4">
            <div className="flex gap-2">
              <button type="button" onClick={() => setBEditCategory('attraction')} className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${bEditCategory === 'attraction' ? 'bg-[var(--color-primary)] text-white' : 'bg-[#EEF1F0] text-[var(--color-ink-muted)]'}`}>景點/美食</button>
              <button type="button" onClick={() => setBEditCategory('accommodation')} className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${bEditCategory === 'accommodation' ? 'bg-[var(--color-primary)] text-white' : 'bg-[#EEF1F0] text-[var(--color-ink-muted)]'}`}>住宿</button>
            </div>
            <input value={bEditTitle} onChange={e => setBEditTitle(e.target.value)} placeholder="名稱" className="w-full bg-[var(--color-bg-page)] p-4 rounded-xl outline-none font-bold focus:ring-2 focus:ring-[var(--color-primary)]" />
            <input value={bEditLink} onChange={e => setBEditLink(e.target.value)} placeholder="相關連結（可選）" className="w-full bg-[var(--color-bg-page)] p-3 rounded-xl outline-none text-xs font-mono font-bold focus:ring-2 focus:ring-[var(--color-primary)]" />
            <input value={bEditPrice} onChange={e => setBEditPrice(e.target.value)} inputMode="decimal" placeholder="金額（可選）" className="w-full bg-[var(--color-bg-page)] p-3 rounded-xl outline-none text-xs font-bold focus:ring-2 focus:ring-[var(--color-primary)]" />
            <textarea value={bEditNote} onChange={e => setBEditNote(e.target.value)} className="w-full bg-[var(--color-bg-page)] p-4 rounded-xl h-20 outline-none resize-none font-medium focus:ring-2 focus:ring-[var(--color-primary)]" placeholder="備註（可選）" />
            {editingBucket?.address && <p className="text-[10px] text-[var(--color-ink-muted)] px-1 flex items-center gap-1"><MapPin className="w-3 h-3" />{editingBucket.address}</p>}
            <button type="submit" disabled={updateBucketItem.isPending} className="w-full py-4 bg-[var(--color-primary)] text-white rounded-xl font-bold shadow-lg hover:bg-[var(--color-primary-strong)] disabled:opacity-50">儲存</button>
          </div>
        </form>
      </Modal>

    </div>
  );
}
