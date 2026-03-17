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

  // 🔴 在這裡修改你們的成員名單
  const groupMembers = ['阿明', '小華', '大強', '小美'];

  // 表單狀態
  const [day, setDay] = useState(1);
  const [startTime, setStartTime] = useState('08:00');
  const [endTime, setEndTime] = useState('');
  const [location, setLocation] = useState('');
  const [transport, setTransport] = useState('機車');
  const [itemType, setItemType] = useState('activity');
  const [note, setNote] = useState('');

  const fetchData = async () => {
    if (!tripId) return;
    
    // 1. 抓取旅程與行程
    const { data: trip } = await supabase.from('trips').select('*').eq('id', tripId).single();
    setTripInfo(trip);
    
    const { data: itinerary } = await supabase
      .from('trip_itinerary')
      .select('*')
      .eq('trip_id', tripId)
      .order('day').order('start_time');

    // 2. 抓取所有人的票券狀態
    const { data: statuses } = await supabase.from('trip_member_ticket_status').select('*');

    // 3. 資料整合 (Client-side Join)
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

    // 🟢 Realtime 監聽：行程與票券狀態變動時即時刷新
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

  // 🔴 領票與分票邏輯
  const updateMemberTicket = async (itineraryId: string, memberName: string, link: string | null, isReady: boolean) => {
    const { error } = await supabase
      .from('trip_member_ticket_status')
      .upsert({ 
        itinerary_id: itineraryId, 
        member_name: memberName, 
        ticket_link: link,
        is_ready: isReady 
      }, { onConflict: 'itinerary_id,member_name' });
    if (!error) fetchData();
  };

  const currentItems = useMemo(() => data.filter(i => i.day === activeDay), [data, activeDay]);
  const days = useMemo(() => {
    const max = data.length > 0 ? Math.max(...data.map(d => d.day)) : 1;
    return Array.from({ length: Math.max(max, 1) }, (_, i) => i + 1);
  }, [data]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = { day, start_time: startTime, end_time: endTime || null, location, transport_type: transport, item_type: itemType, note, trip_id: tripId };
    if (editingId) await supabase.from('trip_itinerary').update(payload).eq('id', editingId);
    else await supabase.from('trip_itinerary').insert([payload]);
    setFormOpen(false); fetchData();
  };

  const handleEdit = (item: any) => {
    setEditingId(item.id); setDay(item.day); setStartTime(item.start_time || '08:00');
    setLocation(item.location); setTransport(item.transport_type);
    setItemType(item.item_type || 'activity'); setNote(item.note || '');
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

      {/* 漢堡按鈕 */}
      <div className="fixed top-6 left-6 z-[100]">
        <button onClick={() => setSidebarOpen(true)} className="p-3 rounded-2xl bg-black/50 backdrop-blur-md text-white shadow-2xl hover:bg-black transition-all">☰</button>
      </div>

      {/* 沉浸式封面 */}
      <div className="fixed top-0 left-0 w-full z-0 h-[300px] bg-black">
        <img src={tripInfo?.cover_url} className="w-full h-full object-cover" style={{ opacity: 1 - scrollY/300 }} />
        <div className="absolute inset-0 bg-gradient-to-t from-gray-100 via-transparent to-black/20" />
      </div>

      <div className="relative z-10" style={{ marginTop: '240px' }}>
        
        {/* 🔴 3.5D 弧形日期導覽 (透明度保底至 Day 3) */}
        <div className="sticky top-0 z-[50] py-8 bg-gradient-to-b from-transparent via-gray-100/95 to-gray-100 backdrop-blur-sm">
          <div className="flex justify-center items-center perspective-[1200px] h-20">
            <div className="flex gap-4 items-center px-20">
              {days.map(d => {
                const diff = d - activeDay;
                const absDiff = Math.abs(diff);
                const visualAbsDiff = Math.min(absDiff, 3); // 🟢 關鍵：保底邏輯
                return (
                  <button 
                    key={d} onClick={() => { setActiveDay(d); setDay(d); }}
                    style={{
                      transform: `rotateY(${visualAbsDiff * (diff > 0 ? 20 : -20)}deg) scale(${1 - visualAbsDiff * 0.12}) translateZ(${-visualAbsDiff * 40}px)`,
                      opacity: 1 - visualAbsDiff * 0.2,
                      transition: 'all 0.5s cubic-bezier(0.2, 0.8, 0.2, 1)'
                    }}
                    className={`flex-none w-20 py-2.5 rounded-2xl text-[10px] font-black shadow-xl border-2 transition-all ${activeDay === d ? 'bg-blue-600 text-white border-blue-400 scale-125 z-20' : 'bg-white text-gray-400 border-white z-10'}`}
                  >
                    DAY {d}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* 行程內容 */}
        <div className="bg-gray-100 min-h-screen px-6 pb-40 rounded-t-[3rem]">
          <div className="max-w-xl mx-auto relative pt-10">
            {/* 主時間軸線 */}
            <div className="absolute left-[52px] top-0 bottom-0 w-1 bg-gray-200/50 rounded-full" />

            <div className="space-y-12 relative">
              {currentItems.length > 0 ? currentItems.map((item, idx) => {
                const isTicket = item.item_type === 'ticket';
                const nextItem = currentItems[idx + 1];
                const prevItem = currentItems[idx - 1];
                const isSameNext = nextItem?.transport_type === item.transport_type;
                const isSamePrev = prevItem?.transport_type === item.transport_type;

                return (
                  <div key={item.id} ref={(el) => { itemRefs.current[item.id] = el; }} className="relative pl-32 group">
                    
                    {/* 🔴 交通工具連通長條 (含垂直置中文字) */}
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

                    {/* 時間圓點 */}
                    <div className="absolute left-[52px] top-8 -translate-x-1/2 w-6 h-6 rounded-full border-4 border-gray-100 bg-blue-600 z-30 shadow-lg" />

                    {/* 卡片本體 */}
                    <div className="relative">
                      <div className="flex items-center gap-2 mb-2 font-mono text-[10px] font-black">
                        <span className="bg-black text-white px-2 py-0.5 rounded shadow-sm">
                          {item.start_time?.substring(0, 5)} {item.end_time && `~ ${item.end_time.substring(0, 5)}`}
                        </span>
                        {isTicket && <span className="text-orange-600 font-bold ml-1 italic tracking-widest">● TICKET LOG</span>}
                      </div>

                      <div className={`p-6 rounded-[2.5rem] shadow-xl border-2 transition-all ${isTicket ? 'bg-orange-50 border-orange-200 border-dashed' : 'bg-white border-white'}`}>
                        <div className="flex justify-between items-start mb-2">
                          <h3 className="text-xl font-black text-gray-900 leading-tight">{item.location}</h3>
                          <div className="flex gap-4">
                            <button onClick={() => handleEdit(item)} className="text-gray-300 hover:text-blue-500">✎</button>
                            <button onClick={() => { if(confirm('刪除？')) supabase.from('trip_itinerary').delete().eq('id', item.id).then(() => fetchData()) }} className="text-gray-300 hover:text-red-500">✕</button>
                          </div>
                        </div>

                        {item.note && <p className="text-xs text-gray-400 mb-4 italic leading-relaxed">{item.note}</p>}

                        {/* 🔴 分票/領票區 (簡易版) */}
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
                                    <button 
                                      onClick={() => {
                                        const link = prompt(`貼上 ${name} 的分票/取票網址:`, status?.ticket_link || '');
                                        if (link !== null) updateMemberTicket(item.id, name, link, !!status?.is_ready);
                                      }}
                                      className="text-[9px] font-bold bg-orange-100 text-orange-600 px-2 py-1 rounded-lg"
                                    >
                                      {status?.ticket_link ? '換連結' : '傳連結'}
                                    </button>
                                    {status?.ticket_link && (
                                      <a 
                                        href={status.ticket_link} target="_blank" 
                                        onClick={() => updateMemberTicket(item.id, name, status.ticket_link, true)}
                                        className="text-[9px] font-bold bg-orange-600 text-white px-3 py-1 rounded-lg shadow-sm animate-pulse"
                                      >
                                        領票
                                      </a>
                                    )}
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

      {/* FAB 新增按鈕 */}
      <button onClick={() => { setEditingId(null); setItemType('activity'); setFormOpen(true); }} className="fixed bottom-10 right-10 w-16 h-16 bg-black text-white rounded-[2rem] shadow-2xl z-[100] text-4xl hover:scale-110 active:scale-95 transition-all">+</button>

      {/* 🔴 表單 Modal (含動態交通工具過濾) */}
      {isFormOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xl z-[200] flex items-center justify-center p-4">
          <form onSubmit={handleSubmit} className="bg-white w-full max-w-sm p-10 rounded-[3rem] shadow-2xl text-black">
            <div className="flex gap-2 mb-8 font-black">
              <button type="button" onClick={() => setItemType('activity')} className={`flex-1 py-3 rounded-2xl text-xs ${itemType === 'activity' ? 'bg-black text-white' : 'bg-gray-100'}`}>一般行程</button>
              <button type="button" onClick={() => { setItemType('ticket'); setTransport('高鐵'); }} className={`flex-1 py-3 rounded-2xl text-xs ${itemType === 'ticket' ? 'bg-orange-600 text-white' : 'bg-gray-100'}`}>交通票券</button>
            </div>
            
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} className="bg-gray-50 p-4 rounded-2xl outline-none font-bold" />
                <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} className="bg-gray-50 p-4 rounded-2xl outline-none font-bold" placeholder="結束" />
              </div>
              <input value={location} onChange={e => setLocation(e.target.value)} className="w-full bg-gray-50 p-4 rounded-2xl outline-none font-black" placeholder="地點 / 車次" />
              
              {/* 🟢 動態選項過濾 */}
              <div className="relative">
                <select value={transport} onChange={e => setTransport(e.target.value)} className="w-full bg-gray-50 p-4 rounded-2xl outline-none font-black appearance-none">
                  {itemType === 'ticket' ? (
                    <>
                      <option>高鐵</option><option>火車</option><option>其他</option>
                    </>
                  ) : (
                    <>
                      <option>機車</option><option>汽車</option><option>火車</option><option>高鐵</option><option>步行</option>
                    </>
                  )}
                </select>
                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none opacity-30">▼</div>
              </div>
              
              <textarea value={note} onChange={e => setNote(e.target.value)} className="w-full bg-gray-50 p-4 rounded-2xl h-24 outline-none resize-none font-medium" placeholder="備註..." />
            </div>
            
            <div className="flex gap-4 mt-10">
              <button type="button" onClick={() => setFormOpen(false)} className="flex-1 py-4 font-bold text-gray-400">取消</button>
              <button type="submit" className="flex-1 py-4 bg-blue-600 text-white rounded-2xl font-bold shadow-lg">儲存行程</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}