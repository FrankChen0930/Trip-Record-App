'use client';

import { useEffect, useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import Sidebar from '@/components/Sidebar';
import { useToast } from '@/components/Toast';
import { DndContext, useDraggable, useDroppable, DragEndEvent, TouchSensor, MouseSensor, useSensor, useSensors } from '@dnd-kit/core';
import type { Trip, ItineraryItem, BucketItem } from '@/lib/types';
import { Menu, Navigation, CheckCircle2, Clock, Trash2, Plus, GripVertical, MapPin } from 'lucide-react';
import Modal from '@/components/Modal';

// --- DND Components ---
function DraggableBucketItem({ item }: { item: BucketItem }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `bucket-${item.id}`,
    data: { type: 'BucketItem', item }
  });

  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, zIndex: 100 } : undefined;

  return (
    <div
      ref={setNodeRef} style={style} {...listeners} {...attributes}
      className={`p-3 bg-white border border-gray-100 rounded-xl shadow-sm mb-2 flex items-start gap-2 ${isDragging ? 'opacity-50 ring-2 ring-blue-500 scale-105' : 'hover:shadow-md'} transition-all cursor-grab active:cursor-grabbing`}
    >
      <GripVertical className="w-4 h-4 text-gray-300 mt-1 flex-shrink-0" />
      <div>
        <h4 className="font-bold text-sm text-gray-800">{item.title}</h4>
        {item.note && <p className="text-[10px] text-gray-400 mt-1 line-clamp-1">{item.note}</p>}
        {item.price && <p className="text-[10px] text-blue-500 font-mono mt-1 font-bold">${item.price}</p>}
      </div>
    </div>
  );
}

function DroppableDayColumn({ dayNum, dateStr, items, onRemoveItem }: { dayNum: number, dateStr: string, items: ItineraryItem[], onRemoveItem: (id: string) => void }) {
  const { setNodeRef, isOver } = useDroppable({
    id: `day-${dayNum}`,
    data: { day: dayNum }
  });

  return (
    <div ref={setNodeRef} className={`flex-none w-72 h-[calc(100vh-200px)] p-4 flex flex-col rounded-[2rem] border-2 transition-colors ${isOver ? 'bg-blue-50/50 border-blue-400 border-dashed' : 'bg-gray-50/50 border-transparent'}`}>
      <div className="flex items-center gap-2 mb-4 px-2">
        <span className="text-xl font-black text-gray-900">Day {dayNum}</span>
        <span className="text-xs text-gray-400 font-bold bg-white px-2 py-0.5 rounded-md shadow-sm">{dateStr}</span>
      </div>
      
      <div className="flex-1 overflow-y-auto pr-2 space-y-3 custom-scrollbar">
        {items.length === 0 && !isOver && (
          <div className="h-24 border-2 border-dashed border-gray-200 rounded-2xl flex items-center justify-center text-gray-400 text-xs font-bold">
            可拖曳行程至此安排
          </div>
        )}
        {items.map(item => (
          <div key={item.id} className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 relative group">
            <div className="flex justify-between items-start mb-2">
              <span className="text-[10px] font-black font-mono text-white bg-gray-900 px-2 py-0.5 rounded-lg shadow-sm">
                {item.start_time?.substring(0, 5) || '08:00'}
              </span>
              <button onClick={() => onRemoveItem(item.id)} className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"><Trash2 className="w-3 h-3" /></button>
            </div>
            <h4 className="font-bold text-sm text-gray-900 mb-1">{item.location}</h4>
            <div className="flex items-center gap-1 text-[10px] text-gray-500 font-medium bg-gray-50 px-2 py-1 rounded-lg inline-flex">
              <MapPin className="w-3 h-3" /> {item.transport_type}
            </div>
          </div>
        ))}
      </div>
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
  const [bucketList, setBucketList] = useState<BucketItem[]>([]);
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  
  // Add bucket item modal states
  const [isAddOpen, setAddOpen] = useState(false);
  const [bucketTitle, setBucketTitle] = useState('');
  const [bucketCategory, setBucketCategory] = useState<'accommodation'|'attraction'|'note'>('attraction');
  
  const mouseSensor = useSensor(MouseSensor, { activationConstraint: { distance: 5 } });
  const touchSensor = useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } });
  const sensors = useSensors(mouseSensor, touchSensor);

  const fetchData = async () => {
    const { data: trip } = await supabase.from('trips').select('*').eq('id', tripId).single();
    setTripInfo(trip);

    const { data: it } = await supabase.from('trip_itinerary').select('*').eq('trip_id', tripId).order('start_time');
    setItinerary(it || []);

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
    return Array.from({ length: diffDays }, (_, i) => i + 1);
  }, [tripInfo]);

  const getDayDate = (dayNum: number) => {
    if (!tripInfo?.start_date) return '';
    const date = new Date(tripInfo.start_date);
    date.setDate(date.getDate() + dayNum - 1);
    const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
    return `${date.getMonth() + 1}/${date.getDate()} (${weekdays[date.getDay()]})`;
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;

    if (active.id.toString().startsWith('bucket-') && over.id.toString().startsWith('day-')) {
      const bucketItem = bucketList.find(b => `bucket-${b.id}` === active.id);
      const targetDay = over.data.current?.day;
      if (!bucketItem || !targetDay) return;

      // Optimistic Update
      const tempId = `temp-${Date.now()}`;
      const newItItem: ItineraryItem = {
        id: tempId,
        trip_id: tripId as string,
        day: targetDay,
        start_time: '08:00',
        end_time: null,
        location: bucketItem.title,
        transport_type: '機車',
        item_type: 'activity',
        note: bucketItem.note,
        map_url: bucketItem.link
      };
      
      setItinerary(prev => [...prev, newItItem]);
      setBucketList(prev => prev.filter(b => b.id !== bucketItem.id));

      try {
        await supabase.from('trip_itinerary').insert([{ ...newItItem, id: undefined }]);
        // Keep in bucket list or delete? It says "assignment", let's delete from bucket list to clean it up
        await supabase.from('trip_bucket_list').delete().eq('id', bucketItem.id);
        fetchData(); // Sync exact IDs
        toast('行程已指派', 'success');
      } catch (err: any) {
        toast('指派失敗', 'error');
        fetchData(); // Rollback
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
  }

  return (
    <div className="bg-white min-h-screen text-black flex flex-col font-sans overflow-hidden">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setSidebarOpen(false)} currentPage="plan" />

      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-100 bg-white shadow-sm z-10 flex-shrink-0">
        <div className="flex items-center gap-4">
          <button onClick={() => setSidebarOpen(true)} className="p-2 rounded-xl text-gray-500 hover:bg-gray-100 transition-colors">
            <Menu className="w-5 h-5" />
          </button>
          <div>
            <h1 className="font-black text-lg text-gray-900 tracking-tight">行程規劃模式</h1>
            <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest">{tripInfo?.name}</p>
          </div>
        </div>
        <button onClick={() => router.push(`/trip/${tripId}`)} className="bg-indigo-50 text-indigo-600 px-4 py-2 rounded-xl font-bold text-xs hover:bg-indigo-100 transition-colors flex items-center gap-1 shadow-sm">
          <CheckCircle2 className="w-4 h-4" /> 儲存並檢視
        </button>
      </div>

      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <div className="flex-1 flex overflow-hidden">
          
          {/* Kanban Board (Left/Scrollable) */}
          <div className="flex-1 overflow-x-auto overflow-y-hidden custom-scrollbar bg-white p-4">
            <div className="flex gap-4 h-full">
              {days.map(d => (
                <DroppableDayColumn 
                  key={d} dayNum={d} dateStr={getDayDate(d)} 
                  items={itinerary.filter(i => i.day === d)} 
                  onRemoveItem={handleRemoveItinerary}
                />
              ))}
            </div>
          </div>

          {/* Bucket List Sidebar (Right) */}
          <div className="w-72 bg-gray-50 border-l border-gray-100 flex flex-col flex-shrink-0 shadow-[-10px_0_30px_rgba(0,0,0,0.02)]">
            <div className="p-4 border-b border-gray-100 bg-white flex justify-between items-center">
              <div>
                <h3 className="font-black text-gray-900 flex items-center gap-2"><Navigation className="w-4 h-4 text-indigo-500" /> 備選池</h3>
                <p className="text-[9px] text-gray-400 font-bold mt-1 uppercase tracking-widest">拖曳項目至行程表</p>
              </div>
              <button onClick={() => setAddOpen(true)} className="w-8 h-8 flex items-center justify-center bg-indigo-600 text-white rounded-lg shadow-sm hover:bg-indigo-700 transition">
                <Plus className="w-4 h-4" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
              <div className="mb-6">
                <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-3">景點 / 美食</h4>
                {bucketList.filter(b => b.category === 'attraction').map(item => (
                  <DraggableBucketItem key={item.id} item={item} />
                ))}
              </div>
              <div className="mb-6">
                <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-3">住宿</h4>
                {bucketList.filter(b => b.category === 'accommodation').map(item => (
                  <DraggableBucketItem key={item.id} item={item} />
                ))}
              </div>
              <div>
                <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-3">備忘錄</h4>
                {bucketList.filter(b => b.category === 'note').map(item => (
                  <DraggableBucketItem key={item.id} item={item} />
                ))}
              </div>
            </div>
          </div>

        </div>
      </DndContext>

      {/* Add Bucket Item Modal */}
      <Modal isOpen={isAddOpen} onClose={() => setAddOpen(false)} title="新增至備選池">
        <form onSubmit={handleAddBucketItem}>
          <div className="space-y-4">
            <div className="flex gap-2">
              <button type="button" onClick={() => setBucketCategory('attraction')} className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${bucketCategory === 'attraction' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-500'}`}>景點/美食</button>
              <button type="button" onClick={() => setBucketCategory('accommodation')} className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${bucketCategory === 'accommodation' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-500'}`}>住宿</button>
              <button type="button" onClick={() => setBucketCategory('note')} className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${bucketCategory === 'note' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-500'}`}>備忘錄</button>
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

    </div>
  );
}
