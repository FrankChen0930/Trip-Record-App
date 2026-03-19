'use client';

import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import Sidebar from '@/components/Sidebar';

export default function HomePage() {
  const [trips, setTrips] = useState<any[]>([]);
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [isModalOpen, setModalOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  // 表單與編輯狀態
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [coverUrl, setCoverUrl] = useState('');

  const tripRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

  const fetchData = async () => {
    const { data: tripData } = await supabase
      .from('trips')
      .select('*')
      .order('start_date', { ascending: false });
    setTrips(tripData || []);
  };

  useEffect(() => { fetchData(); }, []);

  // 🔴 處理封面圖片上傳
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const fileExt = file.name.split('.').pop();
    const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`;
    const filePath = `covers/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('trip-covers')
      .upload(filePath, file);

    if (uploadError) {
      alert('圖片上傳失敗：' + uploadError.message);
      setIsUploading(false);
      return;
    }

    const { data } = supabase.storage.from('trip-covers').getPublicUrl(filePath);
    setCoverUrl(data.publicUrl);
    setIsUploading(false);
  };

  // 🔴 核心修復：統一處理儲存與更新
  const handleSaveTrip = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !startDate) return alert('請填寫旅程名稱與開始日期');

    const payload = { 
      name, 
      start_date: startDate, 
      end_date: endDate || null, 
      cover_url: coverUrl || "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b" 
    };

    try {
      if (editingId) {
        // ✅ 模式 A：編輯模式 (Update)
        const { error: updateError } = await supabase
          .from('trips')
          .update(payload)
          .eq('id', editingId); // 關鍵：精確對準該筆 ID

        if (updateError) throw updateError;
        alert('旅程變更已儲存！');
      } else {
        // ✅ 模式 B：新增模式 (Insert)
        const { data: newTrip, error: tripError } = await supabase
          .from('trips')
          .insert([payload])
          .select()
          .single();

        if (tripError) throw tripError;

        // 🟢 智慧預設邏輯：僅在「新建立」時生成住宿佔位格
        if (endDate && newTrip) {
          const start = new Date(startDate);
          const end = new Date(endDate);
          const diffTime = Math.abs(end.getTime() - start.getTime());
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

          const presets = Array.from({ length: diffDays }, (_, i) => ({
            trip_id: newTrip.id,
            day: i + 1,
            start_time: '21:00:00',
            location: '🏨 預計住宿點',
            transport_type: '機車',
            note: '自動生成的預設格，請點擊編輯修改地點。',
            item_type: 'activity'
          }));

          await supabase.from('trip_itinerary').insert(presets);
        }
        alert('新旅程已開啟！');
      }

      // 重設狀態並重新整理
      closeModal();
      fetchData();
    } catch (error: any) {
      alert('儲存失敗：' + error.message);
    }
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingId(null);
    setName(''); setStartDate(''); setEndDate(''); setCoverUrl('');
  };

  const openEditModal = (trip: any) => {
    setEditingId(trip.id);
    setName(trip.name);
    setStartDate(trip.start_date);
    setEndDate(trip.end_date || '');
    setCoverUrl(trip.cover_url || '');
    setModalOpen(true);
  };

  const handleDeleteTrip = async (id: string) => {
    if (!confirm('確定要徹底刪除這趟旅程紀錄嗎？此動作無法復原。')) return;
    await supabase.from('trips').delete().eq('id', id);
    fetchData();
  };

  const handleJump = (tripId: string) => {
    const target = tripRefs.current[tripId];
    if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="bg-white min-h-screen text-black relative font-sans">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setSidebarOpen(false)} currentPage="itinerary" />

      {/* 頂部導覽列 */}
      <div className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b p-4">
        <div className="max-w-xl mx-auto flex gap-2">
          <button onClick={() => setSidebarOpen(true)} className="p-2 border rounded-xl hover:bg-gray-50 transition">☰</button>
          <select onChange={(e) => handleJump(e.target.value)} className="flex-1 bg-gray-50 border rounded-xl px-4 text-sm outline-none appearance-none">
            <option value="">🔍 跳轉旅程...</option>
            {trips.map(t => <option key={t.id} value={t.id}>{t.start_date} - {t.name}</option>)}
          </select>
        </div>
      </div>

      <div className="max-w-xl mx-auto p-6 pt-10 pb-32">
        <div className="mb-12">
          <h1 className="text-4xl font-black tracking-tighter mb-2 italic">TRAVEL ARCHIVE</h1>
          <p className="text-gray-400 text-[10px] font-bold uppercase tracking-[0.3em]">公路旅行數位紀錄資料庫</p>
        </div>

        <div className="relative">
          <div className="absolute left-2 top-0 bottom-0 w-[1px] bg-gray-100" />
          <div className="space-y-16">
            {trips.map((trip) => (
              <div key={trip.id} ref={(el) => { tripRefs.current[trip.id] = el; }} className="relative pl-10 group">
                <div className="absolute left-0 top-6 -translate-x-1/2 w-3 h-3 rounded-full border-2 border-white bg-black z-10" />
                
                <div className="bg-white border border-gray-100 rounded-[2rem] shadow-sm overflow-hidden hover:shadow-xl hover:border-gray-200 transition-all duration-500">
                  <div className="p-6">
                    <div className="flex justify-between items-start mb-4">
                      <Link href={`/trip/${trip.id}`} className="flex-1">
                        <h2 className="text-xl font-black text-gray-900 hover:text-blue-600 transition-colors uppercase italic">{trip.name}</h2>
                      </Link>
                      <div className="flex gap-2">
                        <button onClick={() => openEditModal(trip)} className="text-gray-300 hover:text-blue-500 p-1 transition-colors">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                        </button>
                        <button onClick={() => handleDeleteTrip(trip.id)} className="text-gray-200 hover:text-red-400 p-1 transition-colors">
                           <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                       <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                       <p className="text-[10px] text-gray-400 font-black tracking-widest uppercase">{trip.start_date} — {trip.end_date || 'ONGOING'}</p>
                    </div>
                  </div>
                  
                  <Link href={`/trip/${trip.id}`}>
                    <div className="h-48 w-full bg-gray-50 border-t overflow-hidden relative group">
                      <img src={trip.cover_url} className="w-full h-full object-cover grayscale-[0.3] group-hover:grayscale-0 group-hover:scale-105 transition-all duration-700" />
                      <div className="absolute inset-0 bg-black/10 group-hover:bg-transparent transition-all" />
                    </div>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* FAB 按鈕 */}
      <button 
        onClick={() => { closeModal(); setModalOpen(true); }} 
        className="fixed bottom-8 right-8 w-16 h-16 bg-black text-white rounded-2xl shadow-2xl flex items-center justify-center text-3xl z-40 hover:scale-110 active:scale-95 transition-all"
      >
        +
      </button>

      {/* 新增/編輯 Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <form onSubmit={handleSaveTrip} className="bg-white w-full max-w-sm p-10 rounded-[3rem] shadow-2xl text-black">
            <h2 className="text-2xl font-black mb-8 tracking-tighter italic">
              {editingId ? 'EDIT ARCHIVE' : 'NEW JOURNEY'}
            </h2>
            <div className="space-y-6">
              <div>
                <label className="text-[9px] font-black text-gray-400 uppercase tracking-[0.2em] ml-1 mb-2 block">旅程名稱</label>
                <input value={name} onChange={e => setName(e.target.value)} className="w-full bg-gray-50 border-none p-4 rounded-2xl outline-none font-bold" placeholder="2026 畢業環島" />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[9px] font-black text-gray-400 uppercase tracking-[0.2em] ml-1 mb-2 block">開始日期</label>
                  <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full bg-gray-50 border-none p-4 rounded-2xl outline-none text-xs font-bold" />
                </div>
                <div>
                  <label className="text-[9px] font-black text-gray-400 uppercase tracking-[0.2em] ml-1 mb-2 block">結束日期</label>
                  <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full bg-gray-50 border-none p-4 rounded-2xl outline-none text-xs font-bold" />
                </div>
              </div>

              <div>
                <label className="text-[9px] font-black text-gray-400 uppercase tracking-[0.2em] ml-1 mb-2 block">封面圖片 (SUPABASE STORAGE)</label>
                <div className="relative">
                  <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" id="file-upload" />
                  <label htmlFor="file-upload" className="w-full bg-gray-50 border-2 border-dashed border-gray-100 p-6 rounded-3xl flex flex-col items-center justify-center cursor-pointer hover:bg-gray-100 transition-all">
                    {isUploading ? <span className="text-xs animate-pulse font-bold">UPLOADING...</span> : 
                     coverUrl ? <img src={coverUrl} className="h-24 w-full object-cover rounded-2xl" /> :
                     <span className="text-[10px] text-gray-400 font-black">UPLOAD COVER PHOTO</span>}
                  </label>
                </div>
              </div>
            </div>

            <div className="flex gap-4 mt-10">
              <button type="button" onClick={closeModal} className="flex-1 py-4 bg-gray-50 rounded-2xl font-black text-xs">CANCEL</button>
              <button type="submit" className="flex-1 py-4 bg-black text-white rounded-2xl font-black text-xs shadow-lg active:scale-95 transition-all">
                {editingId ? 'SAVE CHANGES' : 'CREATE ARCHIVE'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}