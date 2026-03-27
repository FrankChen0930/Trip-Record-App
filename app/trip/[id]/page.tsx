'use client';

import { useEffect, useState, useRef, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import Sidebar from '@/components/Sidebar';
import BottomTabs from '@/components/BottomTabs';
import Modal from '@/components/Modal';
import SpreadsheetImport from '@/components/SpreadsheetImport';
import { useToast } from '@/components/Toast';
import { useConfirm } from '@/components/ConfirmDialog';
import { ItinerarySkeleton } from '@/components/Skeleton';
import type { Trip, ItineraryItem, Member } from '@/lib/types';

export default function TripMasterPage() {
  const { id: tripId } = useParams();
  const [data, setData] = useState<ItineraryItem[]>([]);
  const [tripInfo, setTripInfo] = useState<Trip | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [isFormOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [scrollY, setScrollY] = useState(0);
  const [isImportOpen, setImportOpen] = useState(false);
  const [activeDay, setActiveDay] = useState(1);
  const itemRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});
  const { toast } = useToast();
  const { confirm } = useConfirm();

  // 表單狀態
  const [day, setDay] = useState(1);
  const [startTime, setStartTime] = useState('08:00');
  const [endTime, setEndTime] = useState('');
  const [location, setLocation] = useState('');
  const [transport, setTransport] = useState('機車');
  const [itemType, setItemType] = useState('activity');
  const [note, setNote] = useState('');
  const [mapUrl, setMapUrl] = useState('');

  const fetchData = async () => {
    if (!tripId) return;

    const { data: trip } = await supabase.from('trips').select('*').eq('id', tripId).single();
    setTripInfo(trip);

    const { data: memberData } = await supabase.from('trip_members').select('*');
    setMembers(memberData || []);

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
    setLoading(false);
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

  const memberNicknames = useMemo(() => members.map(m => m.nickname), [members]);

  const updateMemberTicket = async (itinerary_id: string, member_name: string, ticket_link: string | null, is_ready: boolean) => {
    const { error } = await supabase
      .from('trip_member_ticket_status')
      .upsert({ itinerary_id, member_name, ticket_link, is_ready }, { onConflict: 'itinerary_id,member_name' });
    if (!error) fetchData();
  };

  const currentItems = useMemo(() => data.filter(i => i.day === activeDay), [data, activeDay]);

  const days = useMemo(() => {
    if (!tripInfo?.start_date || !tripInfo?.end_date) return [1];
    const start = new Date(tripInfo.start_date);
    const end = new Date(tripInfo.end_date);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    return Array.from({ length: diffDays }, (_, i) => i + 1);
  }, [tripInfo]);

  // 計算每天的實際日期
  const getDayDate = (dayNum: number) => {
    if (!tripInfo?.start_date) return '';
    const date = new Date(tripInfo.start_date);
    date.setDate(date.getDate() + dayNum - 1);
    const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
    return `${date.getMonth() + 1}/${date.getDate()} ${weekdays[date.getDay()]}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!location) { toast('請填寫地點', 'warning'); return; }

    const payload = {
      day, start_time: startTime, end_time: endTime || null,
      location, transport_type: transport, item_type: itemType,
      note, trip_id: tripId, map_url: mapUrl
    };

    try {
      if (editingId) {
        await supabase.from('trip_itinerary').update(payload).eq('id', editingId);
        toast('行程已更新', 'success');
      } else {
        await supabase.from('trip_itinerary').insert([payload]);
        toast('行程已新增', 'success');
      }

      setFormOpen(false);
      resetForm();
      fetchData();
    } catch (error: any) {
      toast('儲存失敗：' + error.message, 'error');
    }
  };

  const resetForm = () => {
    setEditingId(null); setLocation(''); setNote(''); setMapUrl('');
    setStartTime('08:00'); setEndTime(''); setTransport('機車'); setItemType('activity');
  };

  const handleEdit = (item: ItineraryItem) => {
    setEditingId(item.id); setDay(item.day); setStartTime(item.start_time || '08:00');
    setEndTime(item.end_time || ''); setLocation(item.location);
    setTransport(item.transport_type); setItemType(item.item_type || 'activity');
    setNote(item.note || ''); setMapUrl(item.map_url || '');
    setFormOpen(true);
  };

  const handleDelete = async (id: string) => {
    const ok = await confirm({ message: '確定要刪除這筆行程嗎？', confirmText: '刪除', danger: true });
    if (!ok) return;
    await supabase.from('trip_itinerary').delete().eq('id', id);
    toast('行程已刪除', 'info');
    fetchData();
  };

  const getTransportColor = (type: string) => {
    const colors: {[key: string]: string} = {
      '機車': 'bg-blue-600', '汽車': 'bg-emerald-600', '火車': 'bg-orange-500', '高鐵': 'bg-violet-700', '步行': 'bg-slate-500'
    };
    return colors[type] || 'bg-blue-500';
  };

  const getTransportEmoji = (type: string) => {
    const emojis: {[key: string]: string} = {
      '機車': '🏍️', '汽車': '🚗', '火車': '🚃', '高鐵': '🚄', '步行': '🚶'
    };
    return emojis[type] || '🚗';
  };

  return (
    <div className="bg-gray-50 min-h-screen text-black relative font-sans overflow-x-hidden">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setSidebarOpen(false)} currentPage="itinerary" />

      <div className="fixed top-6 left-6 z-[100]">
        <button onClick={() => setSidebarOpen(true)} className="p-3 rounded-2xl glass-dark text-white shadow-2xl hover:bg-black/60 transition-all">☰</button>
      </div>

      {/* 封面區域 */}
      <div className="fixed top-0 left-0 w-full z-0 h-[300px] bg-gray-900">
        <img src={tripInfo?.cover_url || ''} className="w-full h-full object-cover" style={{ opacity: Math.max(0, 1 - scrollY/300), transform: `scale(${1 + scrollY * 0.001})` }} />
        <div className="absolute inset-0 bg-gradient-to-t from-gray-50 via-transparent to-black/30" />
        <div className="absolute bottom-20 left-6 right-6 text-white z-10" style={{ opacity: Math.max(0, 1 - scrollY/200) }}>
          <h1 className="text-3xl font-black drop-shadow-lg tracking-tight">{tripInfo?.name}</h1>
          <p className="text-[10px] font-bold text-white/60 uppercase tracking-[0.2em] mt-1">{tripInfo?.start_date} — {tripInfo?.end_date}</p>
        </div>
      </div>

      <div className="relative z-10" style={{ marginTop: '240px' }}>
        {/* 日期選擇器 */}
        <div className="sticky top-0 z-[50] py-5 bg-gradient-to-b from-gray-50/95 via-gray-50/90 to-gray-50 backdrop-blur-md">
          <div className="flex items-center overflow-x-auto scrollbar-hide px-4 snap-x snap-mandatory h-24 perspective-[1200px]">
            <div className="flex gap-4 items-center mx-auto px-10">
              {days.map(d => {
                const diff = d - activeDay;
                const absDiff = Math.abs(diff);
                const visualAbsDiff = Math.min(absDiff, 3);
                return (
                  <button
                    key={d}
                    onClick={() => { setActiveDay(d); setDay(d); }}
                    style={{
                      transform: `rotateY(${visualAbsDiff * (diff > 0 ? 18 : -18)}deg) scale(${1 - visualAbsDiff * 0.1}) translateZ(${-visualAbsDiff * 30}px)`,
                      opacity: 1 - visualAbsDiff * 0.2,
                      transition: 'all 0.5s cubic-bezier(0.2, 0.8, 0.2, 1)'
                    }}
                    className={`flex-none w-20 h-20 snap-center rounded-2xl font-black shadow-lg border-2 flex flex-col items-center justify-center transition-all ${
                      activeDay === d ? 'bg-blue-600 text-white border-blue-400 scale-110 z-20' : 'bg-white text-gray-400 border-gray-100 z-10 hover:border-blue-200'
                    }`}
                  >
                    <span className="text-[10px] font-bold">D{d}</span>
                    <span className={`text-[9px] mt-0.5 ${activeDay === d ? 'text-blue-200' : 'text-gray-300'}`}>{getDayDate(d)}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="bg-gray-50 min-h-screen px-6 pb-40 rounded-t-[3rem]">
          <div className="max-w-xl mx-auto relative pt-8">
            <div className="absolute left-[52px] top-0 bottom-0 w-1 bg-gray-200/50 rounded-full" />

            <div className="space-y-10 relative">
              {loading ? <ItinerarySkeleton /> :
              currentItems.length > 0 ? currentItems.map((item, idx) => {
                const isTicket = item.item_type === 'ticket';
                const isTransit = item.location.includes('騎車') || item.location.includes('移動');
                const isOptional = item.location.includes('隨興') || item.location.includes('/');

                const nextItem = currentItems[idx + 1];
                const prevItem = currentItems[idx - 1];
                const isSameNext = nextItem?.transport_type === item.transport_type;
                const isSamePrev = prevItem?.transport_type === item.transport_type;

                return (
                  <div key={item.id} ref={(el) => { itemRefs.current[item.id] = el; }} className="relative pl-32 group">

                    <div className="absolute left-0 top-0 bottom-[-2.5rem] w-10 flex flex-col items-center">
                      <div className={`w-full relative flex items-center justify-center transition-all duration-500
                        ${getTransportColor(item.transport_type)}
                        ${isSamePrev ? 'rounded-none top-[-2.5rem] h-[calc(100%+2.5rem)]' : 'rounded-t-full top-0 h-full'}
                        ${isSameNext ? 'z-0' : 'rounded-b-full h-[85%] z-10'}
                      `}>
                        {(!isSamePrev || idx === 0) && (
                          <span className="[writing-mode:vertical-lr] text-[10px] text-white font-black py-6 tracking-widest uppercase">
                            {getTransportEmoji(item.transport_type)} {item.transport_type}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="absolute left-[52px] top-8 -translate-x-1/2 w-6 h-6 rounded-full border-4 border-gray-50 bg-blue-600 z-30 shadow-lg group-hover:scale-125 transition-transform" />

                    <div className="relative">
                      <div className="flex items-center gap-2 mb-2 font-mono text-[10px] font-black">
                        <span className="bg-gray-900 text-white px-3 py-1 rounded-lg shadow-sm">
                          {item.start_time?.substring(0, 5)} {item.end_time && `~ ${item.end_time.substring(0, 5)}`}
                        </span>
                        {isTicket && <span className="text-orange-600 font-bold ml-1 italic tracking-widest">● TICKET LOG</span>}
                      </div>

                      <div className={`p-6 rounded-[2rem] shadow-lg border-2 transition-all card-hover ${
                        isTransit ? 'bg-violet-50 border-violet-100' :
                        isOptional ? 'bg-blue-50/40 border-blue-200 border-dashed' :
                        isTicket ? 'bg-amber-50 border-amber-200 border-dashed' : 'bg-white border-white'
                      }`}>
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex-1">
                            {isOptional && <span className="text-[8px] bg-blue-500 text-white px-2 py-0.5 rounded-full mb-1 inline-block font-black">OPTIONAL</span>}
                            <h3 className={`text-xl font-black leading-tight ${isTransit ? 'text-violet-900' : 'text-gray-900'}`}>
                              {item.location}
                            </h3>
                          </div>

                          <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            {item.map_url && (
                              <a href={item.map_url} target="_blank" className="w-9 h-9 bg-gray-50 shadow-sm rounded-xl flex items-center justify-center hover:scale-110 active:scale-95 transition-all text-base border border-gray-100">📍</a>
                            )}
                            <button onClick={() => handleEdit(item)} className="w-9 h-9 rounded-xl flex items-center justify-center text-gray-400 hover:text-blue-500 hover:bg-blue-50 transition-all">✎</button>
                            <button onClick={() => handleDelete(item.id)} className="w-9 h-9 rounded-xl flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 transition-all">✕</button>
                          </div>
                        </div>

                        {item.note && <p className="text-xs text-gray-400 mb-4 italic leading-relaxed">{item.note}</p>}

                        {isTicket && (
                          <div className="space-y-2 pt-4 border-t border-amber-200/50">
                            {memberNicknames.map(name => {
                              const status = item.member_statuses?.find((s) => s.member_name === name);
                              return (
                                <div key={name} className="flex items-center justify-between bg-white/70 p-3 rounded-xl border border-amber-100/50">
                                  <span className={`text-[10px] font-black ${status?.is_ready ? 'text-emerald-600' : 'text-gray-400'}`}>
                                    {name} {status?.is_ready ? '● 已取票' : '○ 待處理'}
                                  </span>
                                  <div className="flex gap-2">
                                    <button onClick={() => { const link = prompt(`取票網址:`, status?.ticket_link || ''); if (link !== null) updateMemberTicket(item.id, name, link, !!status?.is_ready); }} className="text-[9px] font-bold bg-amber-100 text-amber-700 px-2 py-1 rounded-lg hover:bg-amber-200 transition-colors">傳連結</button>
                                    {status?.ticket_link && <a href={status.ticket_link} target="_blank" onClick={() => updateMemberTicket(item.id, name, status.ticket_link, true)} className="text-[9px] font-bold bg-amber-600 text-white px-3 py-1 rounded-lg animate-pulse hover:bg-amber-700 transition-colors">領票</a>}
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
                <div className="empty-state">
                  <div className="empty-state-icon">📝</div>
                  <h3 className="text-lg font-bold text-gray-300 mb-2">今天還沒有行程</h3>
                  <p className="text-sm text-gray-300">點擊右下角的 + 按鈕新增行程！</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="fixed bottom-6 right-6 z-[400] flex flex-col gap-2 items-end">
        <button onClick={() => setImportOpen(true)} className="w-11 h-11 bg-blue-500 text-white rounded-2xl shadow-lg flex items-center justify-center text-lg hover:bg-blue-600 active:scale-95 transition-all" title="匯入試算表">📊</button>
        <button onClick={() => { resetForm(); setDay(activeDay); setFormOpen(true); }} className="w-14 h-14 bg-gray-900 text-white rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.25)] flex items-center justify-center text-2xl font-light hover:shadow-[0_8px_40px_rgba(0,0,0,0.35)] active:scale-95 transition-all">+</button>
      </div>

      {/* 新增/編輯行程 Modal */}
      <Modal isOpen={isFormOpen} onClose={() => setFormOpen(false)} title={editingId ? '編輯行程' : '新增行程'}>
        <form onSubmit={handleSubmit}>
          <div className="flex gap-2 mb-6 font-bold">
            <button type="button" onClick={() => setItemType('activity')} className={`flex-1 py-3 rounded-2xl text-xs transition-all ${itemType === 'activity' ? 'bg-gray-900 text-white shadow-md' : 'bg-gray-50 hover:bg-gray-100'}`}>一般行程</button>
            <button type="button" onClick={() => { setItemType('ticket'); setTransport('高鐵'); }} className={`flex-1 py-3 rounded-2xl text-xs transition-all ${itemType === 'ticket' ? 'bg-amber-600 text-white shadow-md' : 'bg-gray-50 hover:bg-gray-100'}`}>交通票券</button>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} className="bg-gray-50 p-4 rounded-2xl outline-none font-bold text-sm" />
              <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} className="bg-gray-50 p-4 rounded-2xl outline-none font-bold text-sm" />
            </div>
            <input value={location} onChange={e => setLocation(e.target.value)} className="w-full bg-gray-50 p-4 rounded-2xl outline-none font-black focus:ring-2 focus:ring-blue-500 transition-all" placeholder="地點 (例: 騎車90分鐘 / 台中隨興)" />

            <div className="relative">
              <input value={mapUrl} onChange={e => setMapUrl(e.target.value)} className="w-full bg-blue-50 p-4 pr-12 rounded-2xl outline-none border border-blue-100 text-xs font-mono focus:ring-2 focus:ring-blue-500 transition-all" placeholder="Google Maps 分享連結" />
              <span className="absolute right-4 top-1/2 -translate-y-1/2">📍</span>
            </div>

            <select value={transport} onChange={e => setTransport(e.target.value)} className="w-full bg-gray-50 p-4 rounded-2xl outline-none font-black appearance-none">
              {itemType === 'ticket' ? (
                <><option>高鐵</option><option>火車</option><option>其他</option></>
              ) : (
                <><option>機車</option><option>汽車</option><option>火車</option><option>高鐵</option><option>步行</option></>
              )}
            </select>
            <textarea value={note} onChange={e => setNote(e.target.value)} className="w-full bg-gray-50 p-4 rounded-2xl h-24 outline-none resize-none font-medium focus:ring-2 focus:ring-blue-500 transition-all" placeholder="備註..." />
          </div>

          <div className="flex gap-4 mt-8">
            <button type="button" onClick={() => setFormOpen(false)} className="flex-1 py-4 text-gray-400 font-bold hover:text-gray-600 transition-colors">取消</button>
            <button type="submit" className="flex-1 py-4 bg-blue-600 text-white rounded-2xl font-bold shadow-lg active:scale-95 transition-all hover:bg-blue-700">儲存行程</button>
          </div>
        </form>
      </Modal>

      {/* 試算表匯入 Modal */}
      <Modal isOpen={isImportOpen} onClose={() => setImportOpen(false)} title="匯入行程資料">
        <SpreadsheetImport tripId={tripId as string} tripInfo={tripInfo} onImportComplete={fetchData} onClose={() => setImportOpen(false)} />
      </Modal>

      <BottomTabs />
    </div>
  );
}