'use client';

import { useEffect, useState, useRef, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import Sidebar from '@/components/Sidebar';

export default function TripMasterPage() {
  const { id: tripId } = useParams();
  const [data, setData] = useState<any[]>([]);
  const [tripInfo, setTripInfo] = useState<any>(null);
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [isFormOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [scrollY, setScrollY] = useState(0);
  const [activeDay, setActiveDay] = useState(1);
  const itemRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

  const groupMembers = ['阿明', '小華', '大強', '小美'];

  // 表單狀態
  const [day, setDay] = useState(1);
  const [startTime, setStartTime] = useState('08:00');
  const [endTime, setEndTime] = useState('');
  const [location, setLocation] = useState('');
  const [transport, setTransport] = useState('機車');
  const [itemType, setItemType] = useState('activity');
  const [note, setNote] = useState('');
  const [mapUrl, setMapUrl] = useState(''); // 🔴 新增 Map URL 狀態

  const fetchData = async () => {
    if (!tripId) return;
    
    const { data: trip } = await supabase.from('trips').select('*').eq('id', tripId).single();
    setTripInfo(trip);
    
    const { data: itinerary } = await supabase
      .from('trip_itinerary')
      .select('*')
      .eq('trip_id', tripId)
      .order('day').order('start_time');

    const { data: statuses } = await supabase.from('trip_member_ticket_status').select('*');

    const enrichedData = itinerary?.map(item => ({
      ...item,
      member_statuses: statuses?.filter(s => s.itinerary_id === item.id) || []
    }));

    setData(enrichedData || []);
  };

  useEffect(() => {
    fetchData();
    const handleScroll = () => setScrollY(window.scrollY);
    window.addEventListener('scroll', handleScroll);

    const channel = supabase
      .channel(`trip-realtime-${tripId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trip_itinerary' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trip_member_ticket_status' }, () => fetchData())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      window.removeEventListener('scroll', handleScroll);
    };
  }, [tripId]);

  const updateMemberTicket = async (itinerary_id: string, member_name: string, ticket_link: string | null, is_ready: boolean) => {
    const { error } = await supabase
      .from('trip_member_ticket_status')
      .upsert({ itinerary_id, member_name, ticket_link, is_ready }, { onConflict: 'itinerary_id,member_name' });
    if (!error) fetchData();
  };

  const currentItems = useMemo(() => data.filter(i => i.day === activeDay), [data, activeDay]);
  
  // 🔴 優化：自動偵測天數範圍 (支援 Day 0)
  const days = useMemo(() => {
    if (data.length === 0) return [1];
    const allDays = data.map(d => d.day);
    const min = Math.min(...allDays, 1);
    const max = Math.max(...allDays, 1);
    return Array.from({ length: max - min + 1 }, (_, i) => min + i);
  }, [data]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = { 
      day, start_time: startTime, end_time: endTime || null, 
      location, transport_type: transport, item_type: itemType, 
      note, trip_id: tripId, map_url: mapUrl // 🔴 傳入 Map URL
    };

    if (editingId) await supabase.from('trip_itinerary').update(payload).eq('id', editingId);
    else await supabase.from('trip_itinerary').insert([payload]);
    
    setFormOpen(false); 
    resetForm();
    fetchData();
  };

  const resetForm = () => {
    setEditingId(null); setLocation(''); setNote(''); setMapUrl('');
    setStartTime('08:00'); setEndTime(''); setTransport('機車'); setItemType('activity');
  };

  const handleEdit = (item: any) => {
    setEditingId(item.id); setDay(item.day); setStartTime(item.start_time || '08:00');
    setEndTime(item.end_time || ''); setLocation(item.location); 
    setTransport(item.transport_type); setItemType(item.item_type || 'activity'); 
    setNote(item.note || ''); setMapUrl(item.map_url || ''); // 🔴 讀取 Map URL
    setFormOpen(true);
  };

  const getTransportColor = (type: string) => {
    const colors: {[key: string]: string} = {
      '機車': 'bg-blue-600', '汽車': 'bg-green-600', '火車': 'bg-orange-500', '高鐵': 'bg-purple-700', '步行': 'bg-slate-500'
    };
    return colors[type] || 'bg-blue-500';
  };

  return (
    <div className="bg-gray-100 min-h-screen text-black relative font-sans overflow-x-hidden">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setSidebarOpen(false)} currentPage="itinerary" />

      <div className="fixed top-6 left-6 z-[100]">
        <button onClick={() => setSidebarOpen(true)} className="p-3 rounded-2xl bg-black/50 backdrop-blur-md text-white shadow-2xl hover:bg-black transition-all">☰</button>
      </div>

      <div className="fixed top-0 left-0 w-full z-0 h-[300px] bg-black">
        <img src={tripInfo?.cover_url} className="w-full h-full object-cover" style={{ opacity: 1 - scrollY/300 }} />
        <div className="absolute inset-0 bg-gradient-to-t from-gray-100 via-transparent to-black/20" />
      </div>

      <div className="relative z-10" style={{ marginTop: '240px' }}>
        
        <div className="sticky top-0 z-[50] py-6 bg-gradient-to-b from-transparent via-gray-100/95 to-gray-100 backdrop-blur-sm">
          <div className="flex items-center overflow-x-auto scrollbar-hide px-4 snap-x snap-mandatory h-24 perspective-[1200px]">
            <div className="flex gap-6 items-center mx-auto px-10">
              {days.map(d => {
                const diff = d - activeDay;
                const absDiff = Math.abs(diff);
                const visualAbsDiff = Math.min(absDiff, 3);
                return (
                  <button 
                    key={d} 
                    onClick={() => { setActiveDay(d); setDay(d); }}
                    style={{
                      transform: `rotateY(${visualAbsDiff * (diff > 0 ? 20 : -20)}deg) scale(${1 - visualAbsDiff * 0.12}) translateZ(${-visualAbsDiff * 40}px)`,
                      opacity: 1 - visualAbsDiff * 0.2,
                      transition: 'all 0.5s cubic-bezier(0.2, 0.8, 0.2, 1)'
                    }}
                    className={`flex-none w-16 h-16 snap-center rounded-2xl text-[10px] font-black shadow-xl border-2 flex items-center justify-center transition-all ${
                      activeDay === d ? 'bg-blue-600 text-white border-blue-400 scale-125 z-20' : 'bg-white text-gray-400 border-white z-10'
                    }`}
                  >
                    D{d}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="bg-gray-100 min-h-screen px-6 pb-40 rounded-t-[3rem]">
          <div className="max-w-xl mx-auto relative pt-10">
            <div className="absolute left-[52px] top-0 bottom-0 w-1 bg-gray-200/50 rounded-full" />

            <div className="space-y-12 relative">
              {currentItems.length > 0 ? currentItems.map((item, idx) => {
                const isTicket = item.item_type === 'ticket';
                // 🔴 判斷是否為交通移動或隨興行程
                const isTransit = item.location.includes('騎車') || item.location.includes('移動');
                const isOptional = item.location.includes('隨興') || item.location.includes('/');
                
                const nextItem = currentItems[idx + 1];
                const prevItem = currentItems[idx - 1];
                const isSameNext = nextItem?.transport_type === item.transport_type;
                const isSamePrev = prevItem?.transport_type === item.transport_type;

                return (
                  <div key={item.id} ref={(el) => { itemRefs.current[item.id] = el; }} className="relative pl-32 group">
                    
                    <div className="absolute left-0 top-0 bottom-[-3rem] w-10 flex flex-col items-center">
                      <div className={`w-full relative flex items-center justify-center transition-all duration-500
                        ${getTransportColor(item.transport_type)} 
                        ${isSamePrev ? 'rounded-none top-[-3rem] h-[calc(100%+3rem)]' : 'rounded-t-full top-0 h-full'} 
                        ${isSameNext ? 'z-0' : 'rounded-b-full h-[85%] z-10'}
                      `}>
                        {(!isSamePrev || idx === 0) && (
                          <span className="[writing-mode:vertical-lr] text-[10px] text-white font-black py-6 tracking-widest uppercase">
                            {item.transport_type}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="absolute left-[52px] top-8 -translate-x-1/2 w-6 h-6 rounded-full border-4 border-gray-100 bg-blue-600 z-30 shadow-lg" />

                    <div className="relative">
                      <div className="flex items-center gap-2 mb-2 font-mono text-[10px] font-black">
                        <span className="bg-black text-white px-2 py-0.5 rounded shadow-sm">
                          {item.start_time?.substring(0, 5)} {item.end_time && `~ ${item.end_time.substring(0, 5)}`}
                        </span>
                        {isTicket && <span className="text-orange-600 font-bold ml-1 italic tracking-widest">● TICKET LOG</span>}
                      </div>

                      {/* 🔴 核心：動態樣式切換 */}
                      <div className={`p-6 rounded-[2.5rem] shadow-xl border-2 transition-all ${
                        isTransit ? 'bg-purple-50 border-purple-100' : 
                        isOptional ? 'bg-blue-50/40 border-blue-200 border-dashed' : 
                        isTicket ? 'bg-orange-50 border-orange-200 border-dashed' : 'bg-white border-white'
                      }`}>
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex-1">
                             {isOptional && <span className="text-[8px] bg-blue-500 text-white px-2 py-0.5 rounded-full mb-1 inline-block font-black">OPTIONAL</span>}
                             <h3 className={`text-xl font-black leading-tight ${isTransit ? 'text-purple-900' : 'text-gray-900'}`}>
                               {item.location}
                             </h3>
                          </div>
                          
                          <div className="flex gap-3">
                            {/* 📍 導航按鈕 */}
                            {item.map_url && (
                              <a href={item.map_url} target="_blank" className="w-10 h-10 bg-white shadow-md rounded-2xl flex items-center justify-center hover:scale-110 active:scale-95 transition-all text-lg">📍</a>
                            )}
                            <button onClick={() => handleEdit(item)} className="text-gray-300 hover:text-blue-500">✎</button>
                            <button onClick={() => { if(confirm('刪除？')) supabase.from('trip_itinerary').delete().eq('id', item.id).then(() => fetchData()) }} className="text-gray-300 hover:text-red-500">✕</button>
                          </div>
                        </div>

                        {item.note && <p className="text-xs text-gray-400 mb-4 italic leading-relaxed">{item.note}</p>}

                        {isTicket && (
                          <div className="space-y-2 pt-4 border-t border-orange-200/50">
                            {groupMembers.map(name => {
                              const status = item.member_statuses?.find((s: any) => s.member_name === name);
                              return (
                                <div key={name} className="flex items-center justify-between bg-white/60 p-3 rounded-2xl border border-orange-100/50">
                                  <span className={`text-[10px] font-black ${status?.is_ready ? 'text-green-600' : 'text-gray-400'}`}>
                                    {name} {status?.is_ready ? '● 已取票' : '○ 待處理'}
                                  </span>
                                  <div className="flex gap-2">
                                    <button onClick={() => { const link = prompt(`取票網址:`, status?.ticket_link || ''); if (link !== null) updateMemberTicket(item.id, name, link, !!status?.is_ready); }} className="text-[9px] font-bold bg-orange-100 text-orange-600 px-2 py-1 rounded-lg">傳連結</button>
                                    {status?.ticket_link && <a href={status.ticket_link} target="_blank" onClick={() => updateMemberTicket(item.id, name, status.ticket_link, true)} className="text-[9px] font-bold bg-orange-600 text-white px-3 py-1 rounded-lg animate-pulse">領票</a>}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              }) : (
                <div className="text-center py-24 text-gray-300 italic font-black uppercase tracking-widest opacity-30">No Records Today</div>
              )}
            </div>
          </div>
        </div>
      </div>

      <button onClick={() => { resetForm(); setDay(activeDay); setFormOpen(true); }} className="fixed bottom-10 right-10 w-16 h-16 bg-black text-white rounded-[2rem] shadow-2xl z-[100] text-4xl hover:scale-110 active:scale-95 transition-all">+</button>

      {isFormOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xl z-[200] flex items-center justify-center p-4">
          <form onSubmit={handleSubmit} className="bg-white w-full max-w-sm p-10 rounded-[3rem] shadow-2xl text-black">
            <div className="flex gap-2 mb-8 font-black">
              <button type="button" onClick={() => setItemType('activity')} className={`flex-1 py-3 rounded-2xl text-xs ${itemType === 'activity' ? 'bg-black text-white' : 'bg-gray-100'}`}>一般行程</button>
              <button type="button" onClick={() => { setItemType('ticket'); setTransport('高鐵'); }} className={`flex-1 py-3 rounded-2xl text-xs ${itemType === 'ticket' ? 'bg-orange-600 text-white' : 'bg-gray-100'}`}>交通票券</button>
            </div>
            
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} className="bg-gray-50 p-4 rounded-2xl outline-none font-bold text-sm" />
                <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} className="bg-gray-50 p-4 rounded-2xl outline-none font-bold text-sm" />
              </div>
              <input value={location} onChange={e => setLocation(e.target.value)} className="w-full bg-gray-50 p-4 rounded-2xl outline-none font-black" placeholder="地點 (例: 騎車90分鐘 / 台中隨興)" />
              
              <div className="relative">
                <input value={mapUrl} onChange={e => setMapUrl(e.target.value)} className="w-full bg-blue-50 p-4 pr-12 rounded-2xl outline-none border border-blue-100 text-xs font-mono" placeholder="Google Maps 分享連結" />
                <span className="absolute right-4 top-1/2 -translate-y-1/2">📍</span>
              </div>

              <select value={transport} onChange={e => setTransport(e.target.value)} className="w-full bg-gray-50 p-4 rounded-2xl outline-none font-black appearance-none">
                {itemType === 'ticket' ? (
                  <><option>高鐵</option><option>火車</option><option>其他</option></>
                ) : (
                  <><option>機車</option><option>汽車</option><option>火車</option><option>高鐵</option><option>步行</option></>
                )}
              </select>
              <textarea value={note} onChange={e => setNote(e.target.value)} className="w-full bg-gray-50 p-4 rounded-2xl h-24 outline-none resize-none font-medium" placeholder="備註..." />
            </div>
            
            <div className="flex gap-4 mt-8">
              <button type="button" onClick={() => setFormOpen(false)} className="flex-1 py-4 font-bold text-gray-400">取消</button>
              <button type="submit" className="flex-1 py-4 bg-blue-600 text-white rounded-2xl font-bold shadow-lg">儲存行程</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}