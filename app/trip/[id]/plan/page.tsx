'use client';

import { useEffect, useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import Sidebar from '@/components/Sidebar';
import { useToast } from '@/components/Toast';
import { DndContext, useDraggable, useDroppable, DragEndEvent, DragOverlay, TouchSensor, MouseSensor, useSensor, useSensors } from '@dnd-kit/core';
import type { Trip, ItineraryItem, BucketItem, TripAccommodation } from '@/lib/types';
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
      className={`p-3 bg-white border border-gray-100 rounded-xl shadow-sm mb-2 flex items-start gap-2 ${isDragging ? 'opacity-50' : 'hover:shadow-md'} transition-all cursor-grab active:cursor-grabbing`}
    >
      <GripVertical className="w-4 h-4 text-gray-300 mt-1 flex-shrink-0" />
      <div>
        <h4 className="font-bold text-sm text-gray-800">{item.title}</h4>
        {item.note && <p className="text-[10px] text-gray-400 mt-1 line-clamp-1">{item.note}</p>}
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
    <div ref={setNodeRef} className={`h-28 border-b border-r border-gray-100 p-1.5 relative group ${isOver ? 'bg-blue-50/50 ring-2 ring-inset ring-blue-400' : 'bg-transparent'} transition-colors flex flex-col gap-1 overflow-y-auto custom-scrollbar`}>
      {/* Insert Button (High z-index, Bottom Right) */}
      <button onClick={() => onInsert(dayNum, timeStr)} className="absolute bottom-1 right-1 w-6 h-6 rounded-full bg-white shadow-md border border-gray-100 flex items-center justify-center text-blue-500 hover:text-white hover:bg-blue-500 opacity-0 group-hover:opacity-100 transition-all z-50">
        <Plus className="w-3 h-3"/>
      </button>

      {/* Render mapped items */}
      <div className="relative z-10 flex flex-col gap-1 flex-1 pb-6 w-full">
        {items.map(item => (
          <div key={item.id} className="bg-white p-2 rounded-lg shadow-sm border border-gray-200 relative group/item hover:border-blue-300 transition-colors">
            <div className="flex justify-between items-start mb-1">
              <span className="text-[9px] font-black font-mono text-white bg-gray-900 px-1.5 py-0.5 rounded shadow-sm">
                {item.start_time?.substring(0, 5) || timeStr}
              </span>
              <button onClick={(e) => { e.stopPropagation(); onRemoveItem(item.id); }} className="text-gray-300 hover:text-red-500 opacity-0 group-hover/item:opacity-100 transition-all z-20"><Trash2 className="w-3 h-3" /></button>
            </div>
            <h4 className="font-bold text-[11px] text-gray-900 leading-tight">{item.location}</h4>
          </div>
        ))}
      </div>
    </div>
  );
}

// --- Daily Accommodation Block ---
function AccommodationCell({ day, data, tripId, onUpdate }: { day: number, data?: TripAccommodation, tripId: string, onUpdate: () => void }) {
  const { toast } = useToast();
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
      if (data?.id) {
        await supabase.from('trip_accommodations').update({ name, map_url: mapUrl, booking_url: bookingUrl }).eq('id', data.id);
      } else {
        await supabase.from('trip_accommodations').insert([{ trip_id: tripId, day, name, map_url: mapUrl, booking_url: bookingUrl }]);
      }
      toast('住宿已更新', 'success');
      setIsEditing(false);
      onUpdate();
    } catch(e: any) {
      toast('儲存失敗', 'error');
    }
  };

  return (
    <div className="border-b border-r border-gray-100 p-3 bg-indigo-50/30 flex flex-col min-h-[120px]">
       <div className="flex justify-between items-center mb-2">
         <span className="flex items-center gap-1 text-indigo-600 font-bold text-[11px] tracking-widest"><Bed className="w-3.5 h-3.5" /> 本日住宿</span>
         {data?.id && !isEditing && <button onClick={() => setIsEditing(true)} className="text-gray-400 hover:text-indigo-600 p-1"><Edit2 className="w-3 h-3"/></button>}
       </div>
       {isEditing || !data?.id ? (
         <div className="flex flex-col gap-1.5 focus-within:z-10 mt-1">
           <input value={name} onChange={e => setName(e.target.value)} placeholder="住宿名稱" className="text-xs p-2 rounded-lg border border-indigo-100 w-full outline-none focus:ring-1 focus:ring-indigo-400" />
           <input value={mapUrl} onChange={e => setMapUrl(e.target.value)} placeholder="網址 (地圖)" className="text-[10px] p-2 rounded-lg border border-indigo-100 w-full outline-none focus:ring-1 focus:ring-indigo-400" />
           <input value={bookingUrl} onChange={e => setBookingUrl(e.target.value)} placeholder="網址 (訂房網)" className="text-[10px] p-2 rounded-lg border border-indigo-100 w-full outline-none focus:ring-1 focus:ring-indigo-400" />
           <div className="flex gap-1 mt-1">
             <button onClick={handleSave} className="flex-1 py-1.5 bg-indigo-600 text-white font-bold text-[10px] rounded-lg hover:bg-indigo-700 shadow-sm transition">儲存</button>
             {(isEditing && data?.id) && <button onClick={() => setIsEditing(false)} className="flex-1 py-1.5 bg-gray-100 text-gray-600 font-bold text-[10px] rounded-lg hover:bg-gray-200 transition">取消</button>}
           </div>
         </div>
       ) : (
         <div className="flex flex-col gap-1 mt-1">
           <h4 className="font-bold text-[13px] text-gray-900 leading-tight mb-1">{data?.name}</h4>
           {data?.map_url && <a href={data.map_url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-indigo-500 hover:text-indigo-600 font-medium flex items-center gap-1 bg-white p-1.5 rounded border border-indigo-50 shadow-sm"><Map className="w-3 h-3"/> 地圖導航</a>}
           {data?.booking_url && <a href={data.booking_url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-orange-500 hover:text-orange-600 font-medium flex items-center gap-1 bg-white p-1.5 rounded border border-orange-50 shadow-sm"><LinkIcon className="w-3 h-3"/> 訂房資訊</a>}
         </div>
       )}
    </div>
  );
}

// --- Main Page ---
export default function PlanPage() {
  const { id: tripId } = useParams();
  const router = useRouter();
  const { toast } = useToast();

  const [tripInfo, setTripInfo] = useState<Trip | null>(null);
  const [itinerary, setItinerary] = useState<ItineraryItem[]>([]);
  const [accommodations, setAccommodations] = useState<TripAccommodation[]>([]);
  const [bucketList, setBucketList] = useState<BucketItem[]>([]);
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  
  // Grid State
  const [startHour, setStartHour] = useState(7);
  const [endHour, setEndHour] = useState(21);
  const [showDayZero, setShowDayZero] = useState(false);

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

  const fetchData = async () => {
    const { data: trip } = await supabase.from('trips').select('*').eq('id', tripId).single();
    setTripInfo(trip);

    const { data: it } = await supabase.from('trip_itinerary').select('*').eq('trip_id', tripId).order('start_time');
    setItinerary(it || []);

    const { data: acc } = await supabase.from('trip_accommodations').select('*').eq('trip_id', tripId);
    setAccommodations(acc || []);

    const { data: bl } = await supabase.from('trip_bucket_list').select('*').eq('trip_id', tripId).order('created_at', { ascending: false });
    setBucketList(bl || []);
  };

  useEffect(() => {
    if (tripId) fetchData();
  }, [tripId]);

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

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveDragItem(null);
    const { active, over } = event;
    if (!over) return;

    if (active.id.toString().startsWith('bucket-') && over.id.toString().startsWith('cell-')) {
      const bucketItem = bucketList.find(b => `bucket-${b.id}` === active.id);
      const cellDay = over.data.current?.day;
      const cellTime = over.data.current?.time;
      if (!bucketItem || cellDay === undefined || !cellTime) return;

      const tempId = `temp-${Date.now()}`;
      const newItItem: ItineraryItem = {
        id: tempId,
        trip_id: tripId as string,
        day: cellDay,
        start_time: cellTime,
        end_time: null,
        location: bucketItem.title,
        transport_type: '機車',
        item_type: 'activity',
        note: bucketItem.note ?? null,
        map_url: bucketItem.link ?? null
      };
      
      setItinerary(prev => [...prev, newItItem]);
      setBucketList(prev => prev.filter(b => b.id !== bucketItem.id));

      try {
        const { error: insertError } = await supabase.from('trip_itinerary').insert([{
          trip_id: tripId,
          day: cellDay,
          start_time: cellTime,
          location: bucketItem.title,
          transport_type: '機車',
          item_type: 'activity',
          note: bucketItem.note || null,
          map_url: bucketItem.link || null
        }]);
        if (insertError) throw insertError;

        const { error: deleteError } = await supabase.from('trip_bucket_list').delete().eq('id', bucketItem.id);
        if (deleteError) throw deleteError;

        toast('行程已建立', 'success');
      } catch (err: any) {
        toast('指派失敗: ' + err.message, 'error');
      } finally {
        fetchData();
      }
    }
  };

  const handleRemoveItinerary = async (id: string) => {
    await supabase.from('trip_itinerary').delete().eq('id', id);
    fetchData();
  };

  const handleAddBucketItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bucketTitle) return;
    try {
      await supabase.from('trip_bucket_list').insert([{
        trip_id: tripId,
        category: bucketCategory,
        title: bucketTitle
      }]);
      setBucketTitle('');
      setAddOpen(false);
      fetchData();
      toast('已新增至備選池', 'success');
    } catch (e: any) {
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
      await supabase.from('trip_itinerary').insert([{
        trip_id: tripId,
        day: insertDay,
        start_time: insertTime,
        location: insertTitle,
        item_type: 'activity',
        transport_type: '機車'
      }]);
      setInsertTitle('');
      setInsertOpen(false);
      fetchData();
      toast('行程已新增', 'success');
    } catch(e) {
      toast('新增失敗', 'error');
    }
  };

  return (
    <div className="bg-white min-h-screen text-black flex flex-col font-sans overflow-hidden">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setSidebarOpen(false)} currentPage="plan" />

      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-100 bg-white shadow-sm z-20 flex-shrink-0">
        <div className="flex items-center gap-4">
          <button onClick={() => setSidebarOpen(true)} className="p-2 rounded-xl text-gray-500 hover:bg-gray-100 transition-colors">
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-3">
            <div>
              <h1 className="font-black text-lg text-gray-900 tracking-tight">行事曆規畫模式 (Beta)</h1>
              <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest">{tripInfo?.name}</p>
            </div>
            <div className="h-6 w-px bg-gray-200 mx-2"></div>
            <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-gray-600 bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-100 hover:bg-gray-100 transition-colors">
              <input type="checkbox" checked={showDayZero} onChange={e => setShowDayZero(e.target.checked)} className="accent-indigo-500" />
              從 Day 0 開始計算
            </label>
          </div>
        </div>
        <button onClick={() => router.push(`/trip/${tripId}`)} className="bg-indigo-50 text-indigo-600 px-4 py-2 rounded-xl font-bold text-xs hover:bg-indigo-100 transition-colors flex items-center gap-1 shadow-sm">
          <CheckCircle2 className="w-4 h-4" /> 儲存並檢視
        </button>
      </div>

      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="flex-1 flex overflow-hidden">
          
          {/* Spreadsheet Board (Left/Scrollable Matrix) */}
          <div className="flex-1 overflow-auto custom-scrollbar bg-gray-50/50 p-6 flex justify-center">
            
            <div className="bg-white border text-gray-800 border-gray-200 rounded-[2rem] shadow-sm flex flex-col overflow-hidden max-w-full">
              
              {/* Header Row (Days) */}
              <div className="flex border-b border-gray-200 bg-gray-50 sticky top-0 z-10">
                 <div className="w-20 border-r border-gray-200 flex-shrink-0 flex items-center justify-center">
                    <Clock className="w-5 h-5 text-gray-300" />
                 </div>
                 {days.map(d => (
                   <div key={d} className="w-48 border-r border-gray-200 flex-shrink-0 p-3 flex flex-col items-center justify-center">
                     <span className="text-sm font-black text-gray-900">Day {d}</span>
                     <span className="text-[10px] text-gray-400 font-bold mt-0.5">{getDayDate(d)}</span>
                   </div>
                 ))}
              </div>

              {/* Grid Body */}
              <div className="flex relative">
                 {/* Y-Axis: Time Slots */}
                 <div className="w-20 flex-shrink-0 bg-white z-0 flex flex-col border-r border-gray-200">
                    <div className="h-8 flex border-b border-gray-100 bg-gray-50">
                        <button onClick={() => setStartHour(Math.max(0, startHour - 1))} className="flex-1 hover:bg-gray-100 flex items-center justify-center text-gray-400 transition-colors" title="增加更早時間"><ChevronUp className="w-4 h-4"/></button>
                        <button onClick={() => setStartHour(Math.min(23, startHour + 1))} className="flex-1 hover:bg-gray-100 flex items-center justify-center text-gray-400 transition-colors border-l border-gray-100" title="刪除時間列"><Trash2 className="w-3 h-3"/></button>
                    </div>
                    {timeSlots.map(t => (
                      <div key={t} className="h-28 border-b border-gray-100 flex items-start justify-center p-2">
                        <span className="text-[10px] font-mono font-bold text-gray-400">{t}</span>
                      </div>
                    ))}
                    <div className="h-8 flex border-b border-gray-100 bg-gray-50">
                        <button onClick={() => setEndHour(Math.max(0, endHour - 1))} className="flex-1 hover:bg-gray-100 flex items-center justify-center text-gray-400 transition-colors border-r border-gray-100" title="刪除時間列"><Trash2 className="w-3 h-3"/></button>
                        <button onClick={() => setEndHour(Math.min(23, endHour + 1))} className="flex-1 hover:bg-gray-100 flex items-center justify-center text-gray-400 transition-colors" title="增加更晚時間"><ChevronDown className="w-4 h-4"/></button>
                    </div>
                    
                    {/* Placeholder for Accommodation row */}
                    <div className="flex-1 min-h-[120px] bg-white border-r border-gray-200 border-b border-gray-100"></div>
                 </div>

                 {/* Columns */}
                 {days.map(d => (
                   <div key={d} className="w-48 flex-shrink-0 flex flex-col bg-white">
                     <div className="h-8 border-b border-r border-gray-100 bg-gray-50/50"></div>
                     {timeSlots.map(t => (
                       <DroppableTimeCell 
                         key={`${d}-${t}`} dayNum={d} timeStr={t} 
                         items={getSlotItems(d, t)} 
                         onRemoveItem={handleRemoveItinerary}
                         onInsert={openInsertModal}
                       />
                     ))}
                     <AccommodationCell day={d} data={accommodations.find(a => a.day === d)} tripId={tripId as string} onUpdate={fetchData} />
                     <div className="h-8 bg-gray-50/50 border-r border-gray-100 border-b"></div>
                   </div>
                 ))}
              </div>

            </div>

          </div>

          {/* Bucket List Sidebar (Right) */}
          <div className="w-64 bg-gray-50 border-l border-gray-100 flex flex-col flex-shrink-0 shadow-[-10px_0_30px_rgba(0,0,0,0.02)] z-10">
            <div className="p-4 border-b border-gray-100 bg-white flex justify-between items-center z-10 shadow-sm relative">
              <div>
                <h3 className="font-black text-gray-900 flex items-center gap-2"><Navigation className="w-4 h-4 text-indigo-500" /> 備選池</h3>
                <p className="text-[9px] text-gray-400 font-bold mt-1 uppercase tracking-widest">拖曳項目至行程表</p>
              </div>
              <button onClick={() => setAddOpen(true)} className="w-8 h-8 flex items-center justify-center bg-indigo-600 text-white rounded-lg shadow-sm hover:bg-indigo-700 transition">
                <Plus className="w-4 h-4" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-3 custom-scrollbar">
              <div className="mb-6">
                <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 px-1">景點 / 美食</h4>
                {bucketList.filter(b => b.category === 'attraction').map(item => (
                  <DraggableBucketItem key={item.id} item={item} />
                ))}
              </div>
              <div className="mb-6">
                <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 px-1">住宿</h4>
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
            <div className="p-3 bg-white border-2 border-indigo-500 rounded-xl shadow-2xl flex items-start gap-2 rotate-3 scale-105 opacity-90 w-48">
              <GripVertical className="w-4 h-4 text-gray-300 mt-1 flex-shrink-0" />
              <div>
                <h4 className="font-bold text-sm text-gray-800">{activeDragItem.title}</h4>
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
              <button type="button" onClick={() => setBucketCategory('attraction')} className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${bucketCategory === 'attraction' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-500'}`}>景點/美食</button>
              <button type="button" onClick={() => setBucketCategory('accommodation')} className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${bucketCategory === 'accommodation' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-500'}`}>住宿</button>
            </div>
            <input 
              value={bucketTitle} onChange={e => setBucketTitle(e.target.value)} 
              placeholder="名稱 (例如: 春水堂)" 
              className="w-full bg-gray-50 p-4 rounded-xl outline-none font-bold focus:ring-2 focus:ring-indigo-500"
              autoFocus
            />
            <button type="submit" className="w-full py-4 bg-indigo-600 text-white rounded-xl font-bold shadow-lg hover:bg-indigo-700">新增</button>
          </div>
        </form>
      </Modal>

      {/* Insert Event Modal */}
      <Modal isOpen={isInsertOpen} onClose={() => setInsertOpen(false)} title="安插行程">
        <form onSubmit={submitInsertModal}>
          <div className="space-y-4">
            <div className="bg-blue-50/50 p-3 rounded-xl border border-blue-100 flex items-center justify-between text-xs font-bold text-blue-800">
               <span>Day {insertDay}</span>
               <span className="font-mono bg-blue-100 px-2 py-1 rounded-lg">{insertTime}</span>
            </div>
            <div className="flex gap-2">
              <input type="time" value={insertTime} onChange={e => setInsertTime(e.target.value)} className="bg-gray-50 p-4 rounded-xl outline-none font-bold font-mono focus:ring-2 focus:ring-blue-500 w-1/3" />
              <input 
                value={insertTitle} onChange={e => setInsertTitle(e.target.value)} 
                placeholder="行程名稱" 
                className="w-2/3 bg-gray-50 p-4 rounded-xl outline-none font-bold focus:ring-2 focus:ring-blue-500"
                autoFocus
              />
            </div>
            <button type="submit" className="w-full py-4 bg-gray-900 text-white rounded-xl font-bold hover:bg-gray-800">儲存</button>
          </div>
        </form>
      </Modal>

    </div>
  );
}
