'use client';

import { useEffect, useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import { useToast } from '@/components/Toast';
import { DndContext, useDraggable, useDroppable, DragEndEvent, DragOverlay, TouchSensor, MouseSensor, useSensor, useSensors } from '@dnd-kit/core';
import type { ItineraryItem, BucketItem, TripAccommodation } from '@/lib/types';
import { useTrip } from '@/features/trips/hooks/useTrip';
import { usePlanData } from '@/features/plan/hooks/usePlanData';
import { useAssignBucket, useInsertItinerary, useRemoveItinerary, useAddBucket, useSaveAccommodation } from '@/features/plan/hooks/usePlanMutations';
import { Menu, Navigation, CheckCircle2, Clock, Trash2, Plus, GripVertical, MapPin, Map, Compass, ChevronUp, ChevronDown, Bed, Edit2, Link as LinkIcon } from 'lucide-react';
import Modal from '@/components/Modal';

// --- DND Draggable Item ---
function DraggableBucketItem({ item }: { item: BucketItem }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `bucket-${item.id}`,
    data: { type: 'BucketItem', item }
  });

  return (
    <div
      ref={setNodeRef} {...listeners} {...attributes}
      className={`p-3 bg-white border border-[#E8F3EE] rounded-xl shadow-sm mb-2 flex items-start gap-2 ${isDragging ? 'opacity-50' : 'hover:shadow-md'} transition-all cursor-grab active:cursor-grabbing`}
    >
      <GripVertical className="w-4 h-4 text-[#C4CFC9] mt-1 flex-shrink-0" />
      <div>
        <h4 className="font-bold text-sm text-[var(--color-ink)]">{item.title}</h4>
        {item.note && <p className="text-[10px] text-[var(--color-ink-muted)] mt-1 line-clamp-1">{item.note}</p>}
      </div>
    </div>
  );
}

// --- Spreadsheet Grid Droppable Cell ---
function DroppableTimeCell({ dayNum, timeStr, items, onRemoveItem, onInsert }: { dayNum: number, timeStr: string, items: ItineraryItem[], onRemoveItem: (id: string) => void, onInsert: (day: number, time: string) => void }) {
  const { setNodeRef, isOver } = useDroppable({
    id: `cell-${dayNum}-${timeStr}`,
    data: { day: dayNum, time: timeStr }
  });

  return (
    <div ref={setNodeRef} className={`h-28 border-b border-r border-[#E8F3EE] p-1.5 relative group ${isOver ? 'bg-[var(--color-primary-soft)]/50 ring-2 ring-inset ring-[var(--color-primary)]' : 'bg-transparent'} transition-colors flex flex-col gap-1 overflow-y-auto custom-scrollbar`}>
      {/* Insert Button (High z-index, Bottom Right) */}
      <button onClick={() => onInsert(dayNum, timeStr)} className="absolute bottom-1 right-1 w-6 h-6 rounded-full bg-white shadow-md border border-[#E8F3EE] flex items-center justify-center text-[var(--color-primary)] hover:text-white hover:bg-[var(--color-primary)] opacity-0 group-hover:opacity-100 transition-all z-50">
        <Plus className="w-3 h-3"/>
      </button>

      {/* Render mapped items */}
      <div className="relative z-10 flex flex-col gap-1 flex-1 pb-6 w-full">
        {items.map(item => (
          <div key={item.id} className="bg-white p-2 rounded-lg shadow-sm border border-[#D8EBE3] relative group/item hover:border-[#9BDCC4] transition-colors">
            <div className="flex justify-between items-start mb-1">
              <span className="text-[9px] font-black font-mono text-white bg-[var(--color-ink)] px-1.5 py-0.5 rounded shadow-sm">
                {item.start_time?.substring(0, 5) || timeStr}
              </span>
              <button onClick={(e) => { e.stopPropagation(); onRemoveItem(item.id); }} className="text-[#C4CFC9] hover:text-red-500 opacity-0 group-hover/item:opacity-100 transition-all z-20"><Trash2 className="w-3 h-3" /></button>
            </div>
            <h4 className="font-bold text-[11px] text-[var(--color-ink)] leading-tight">{item.location}</h4>
          </div>
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

  useEffect(() => {
    setName(data?.name || '');
    setMapUrl(data?.map_url || '');
    setBookingUrl(data?.booking_url || '');
  }, [data]);

  const handleSave = async () => {
    if (!name) return;
    try {
      await saveAccommodation.mutateAsync({ id: data?.id ?? null, day, name, mapUrl, bookingUrl });
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
           <div className="flex gap-1 mt-1">
             <button onClick={handleSave} className="flex-1 py-1.5 bg-indigo-600 text-white font-bold text-[10px] rounded-lg hover:bg-indigo-700 shadow-sm transition">儲存</button>
             {(isEditing && data?.id) && <button onClick={() => setIsEditing(false)} className="flex-1 py-1.5 bg-[#EEF1F0] text-[var(--color-ink-muted)] font-bold text-[10px] rounded-lg hover:bg-[#E1E7E4] transition">取消</button>}
           </div>
         </div>
       ) : (
         <div className="flex flex-col gap-1 mt-1">
           <h4 className="font-bold text-[13px] text-[var(--color-ink)] leading-tight mb-1">{data?.name}</h4>
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
  const bucketList = planData?.bucketList ?? [];
  const assignBucket = useAssignBucket(tripId);
  const insertItinerary = useInsertItinerary(tripId);
  const removeItinerary = useRemoveItinerary(tripId);
  const addBucket = useAddBucket(tripId);
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

  // Add Bucket Item Modal
  const [isAddOpen, setAddOpen] = useState(false);
  const [bucketTitle, setBucketTitle] = useState('');
  const [bucketCategory, setBucketCategory] = useState<'accommodation'|'attraction'|'note'>('attraction');

  // Insert Itinerary Item Modal
  const [isInsertOpen, setInsertOpen] = useState(false);
  const [insertDay, setInsertDay] = useState(1);
  const [insertTime, setInsertTime] = useState('08:00');
  const [insertTitle, setInsertTitle] = useState('');

  const [activeDragItem, setActiveDragItem] = useState<BucketItem | null>(null);

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

  const handleDragStart = (event: any) => {
    const { active } = event;
    if (active.data.current?.type === 'BucketItem') {
      setActiveDragItem(active.data.current.item);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveDragItem(null);
    const { active, over } = event;
    if (!over) return;

    if (active.id.toString().startsWith('bucket-') && over.id.toString().startsWith('cell-')) {
      const bucketItem = bucketList.find(b => `bucket-${b.id}` === active.id);
      const cellDay = over.data.current?.day;
      const cellTime = over.data.current?.time;
      if (!bucketItem || cellDay === undefined || !cellTime) return;

      assignBucket.mutate({ bucketItem, day: cellDay, time: cellTime }, {
        onSuccess: () => toast('行程已建立', 'success'),
        onError: (err) => toast('指派失敗: ' + (err instanceof Error ? err.message : '未知錯誤'), 'error'),
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
    <div className="bg-white min-h-screen flex flex-col font-sans overflow-hidden" style={{ color: 'var(--color-ink)' }}>
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
        <div className="flex-1 flex overflow-hidden">
          
          {/* Spreadsheet Board (Left/Scrollable Matrix) */}
          <div className="flex-1 overflow-auto custom-scrollbar bg-[var(--color-bg-page)] p-6 flex justify-center">
            
            <div className="bg-white border text-[var(--color-ink)] border-[#D8EBE3] rounded-xl shadow-sm flex flex-col overflow-hidden max-w-full">
              
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
          <div className="w-64 bg-[var(--color-bg-page)] border-l border-[#E8F3EE] flex flex-col flex-shrink-0 shadow-[-10px_0_30px_rgba(0,0,0,0.02)] z-10">
            <div className="p-4 border-b border-[#E8F3EE] bg-white flex justify-between items-center z-10 shadow-sm relative">
              <div>
                <h3 className="font-black text-[var(--color-ink)] flex items-center gap-2"><Navigation className="w-4 h-4 text-[var(--color-primary)]" /> 備選池</h3>
                <p className="text-[9px] text-[var(--color-ink-muted)] font-bold mt-1 uppercase tracking-widest">拖曳項目至行程表</p>
              </div>
              <button onClick={() => setAddOpen(true)} className="w-8 h-8 flex items-center justify-center bg-[var(--color-primary)] text-white rounded-lg shadow-sm hover:bg-[var(--color-primary-strong)] transition">
                <Plus className="w-4 h-4" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-3 custom-scrollbar">
              <div className="mb-6">
                <h4 className="text-[10px] font-black text-[var(--color-ink-muted)] uppercase tracking-widest mb-2 px-1">景點 / 美食</h4>
                {bucketList.filter(b => b.category === 'attraction').map(item => (
                  <DraggableBucketItem key={item.id} item={item} />
                ))}
              </div>
              <div className="mb-6">
                <h4 className="text-[10px] font-black text-[var(--color-ink-muted)] uppercase tracking-widest mb-2 px-1">住宿</h4>
                {bucketList.filter(b => b.category === 'accommodation').map(item => (
                  <DraggableBucketItem key={item.id} item={item} />
                ))}
              </div>
            </div>
          </div>

        </div>

        {/* Drag Overlay for smooth Visual Feedback */}
        <DragOverlay>
          {activeDragItem ? (
            <div className="p-3 bg-white border-2 border-[var(--color-primary)] rounded-xl shadow-2xl flex items-start gap-2 rotate-3 scale-105 opacity-90 w-48">
              <GripVertical className="w-4 h-4 text-[#C4CFC9] mt-1 flex-shrink-0" />
              <div>
                <h4 className="font-bold text-sm text-[var(--color-ink)]">{activeDragItem.title}</h4>
              </div>
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

    </div>
  );
}
