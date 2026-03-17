'use client';

import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import Sidebar from '@/components/Sidebar';

export default function HomePage() {
  const [trips, setTrips] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
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
    const { data: tripData } = await supabase.from('trips').select('*').order('start_date', { ascending: false });
    const { data: memData } = await supabase.from('trip_members').select('*');
    setTrips(tripData || []);
    setMembers(memData || []);
  };

  useEffect(() => { fetchData(); }, []);

  // 🔴 核心功能：處理圖片上傳
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const fileExt = file.name.split('.').pop();
    const fileName = `${Math.random()}.${fileExt}`; // 避免檔名重複
    const filePath = `${fileName}`;

    // 1. 上傳到 Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from('trip-covers')
      .upload(filePath, file);

    if (uploadError) {
      alert('圖片上傳失敗：' + uploadError.message);
      setIsUploading(false);
      return;
    }

    // 2. 取得公開 URL
    const { data } = supabase.storage.from('trip-covers').getPublicUrl(filePath);
    setCoverUrl(data.publicUrl);
    setIsUploading(false);
  };

  // 🔴 核心功能：新增或編輯旅程
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !startDate) return alert('請填寫必要資訊');

    const payload = { 
      name, 
      start_date: startDate, 
      end_date: endDate || null, 
      cover_url: coverUrl || "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b" 
    };

    if (editingId) {
      // 編輯模式
      const { error } = await supabase.from('trips').update(payload).eq('id', editingId);
      if (error) alert(error.message);
    } else {
      // 新增模式
      const { error } = await supabase.from('trips').insert([payload]);
      if (error) alert(error.message);
    }

    setModalOpen(false);
    setEditingId(null);
    setName(''); setStartDate(''); setEndDate(''); setCoverUrl('');
    fetchData();
  };

  // 🔴 核心功能：刪除旅程
  const handleDeleteTrip = async (id: string) => {
    if (!confirm('確定要徹底刪除這趟旅程紀錄嗎？此動作無法復原。')) return;
    await supabase.from('trips').delete().eq('id', id);
    fetchData();
  };

  const openEditModal = (trip: any) => {
    setEditingId(trip.id);
    setName(trip.name);
    setStartDate(trip.start_date);
    setEndDate(trip.end_date || '');
    setCoverUrl(trip.cover_url || '');
    setModalOpen(true);
  };

  const handleJump = (tripId: string) => {
    const target = tripRefs.current[tripId];
    if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // 🔴 在 app/page.tsx 裡更新 handleAddTrip 邏輯
  const handleAddTrip = async (e: React.FormEvent) => {
    e.preventDefault();
    // 檢查必要欄位
    if (!name || !startDate) return alert('請輸入名稱與開始日期');

    // 1. 建立旅程主檔案
    const { data: newTrip, error: tripError } = await supabase
      .from('trips')
      .insert([{ 
        name, 
        start_date: startDate, 
        end_date: endDate || null, 
        cover_url: coverUrl || "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b" 
      }])
      .select()
      .single();

    if (tripError) {
      alert('建立旅程失敗：' + tripError.message);
      return;
    }

    // 🔴 智慧預設邏輯：如果是多日行程，自動生成每一晚的住宿佔位格
    if (endDate && newTrip) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      // 計算天數 (end - start)
      const diffTime = Math.abs(end.getTime() - start.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

      // 產生預設行程陣列
      const presets = Array.from({ length: diffDays }, (_, i) => ({
        trip_id: newTrip.id,
        day: i + 1,
        start_time: '21:00:00', // 資料庫 time 格式通常建議補上秒數
        location: '🏨 預計住宿點',
        transport_type: '機車',
        note: '這是自動生成的預設格，記得排好後點擊編輯修改地點！',
        item_type: 'activity'
      }));

      // 執行 Batch Insert
      const { error: presetError } = await supabase
        .from('trip_itinerary')
        .insert(presets);

      if (presetError) {
        console.error('預設住宿生成失敗:', presetError.message);
      }
    }

    // 🔴 這裡修正為你目前使用的變數名稱
    setModalOpen(false); 
    
    // 清空輸入框
    setName(''); setStartDate(''); setEndDate(''); setCoverUrl('');
    
    // 重新抓取列表
    fetchData();
  };
  return (
    <div className="bg-white min-h-screen text-black relative font-sans">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setSidebarOpen(false)} currentPage="itinerary" />

      {/* 頂部跳轉列 */}
      <div className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b p-4">
        <div className="max-w-xl mx-auto flex gap-2">
          <button onClick={() => setSidebarOpen(true)} className="p-2 border rounded-xl">☰</button>
          <select onChange={(e) => handleJump(e.target.value)} className="flex-1 bg-gray-50 border rounded-xl px-4 text-sm outline-none">
            <option value="">🔍 跳轉旅程...</option>
            {trips.map(t => <option key={t.id} value={t.id}>{t.start_date} - {t.name}</option>)}
          </select>
        </div>
      </div>

      <div className="max-w-xl mx-auto p-6 pt-10">
        <div className="mb-12">
          <h1 className="text-4xl font-black tracking-tighter mb-2">TRAVEL ARCHIVE</h1>
          <p className="text-gray-400 text-[10px] font-bold uppercase tracking-[0.3em]">公路旅行數位紀錄資料庫</p>
        </div>

        <div className="relative">
          <div className="absolute left-2 top-0 bottom-0 w-[1px] bg-gray-200" />
          <div className="space-y-16">
            {trips.map((trip) => (
              <div key={trip.id} ref={(el) => { tripRefs.current[trip.id] = el; }} className="relative pl-10 group">
                <div className="absolute left-0 top-6 -translate-x-1/2 w-3 h-3 rounded-full border-2 border-white bg-black z-10" />
                <div className="absolute left-0 top-[31px] w-10 h-[1px] bg-gray-200" />

                <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden group-hover:border-gray-300 transition-all">
                  {/* 旅程卡片標題與編輯按鈕 */}
                  <div className="p-6">
                    <div className="flex justify-between items-start mb-4">
                      <Link href={`/trip/${trip.id}`} className="flex-1">
                        <h2 className="text-xl font-bold text-gray-900 hover:text-blue-600 transition-colors">{trip.name}</h2>
                      </Link>
                      <div className="flex gap-2">
                        <button onClick={() => openEditModal(trip)} className="text-gray-300 hover:text-blue-500 p-1">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                        </button>
                        <button onClick={() => handleDeleteTrip(trip.id)} className="text-gray-200 hover:text-red-400 p-1">
                           <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                      </div>
                    </div>
                    <p className="text-xs text-gray-400 font-mono">{trip.start_date} — {trip.end_date || 'Continuing'}</p>
                  </div>
                  {/* 卡片封面預覽 */}
                  <Link href={`/trip/${trip.id}`}>
                    <div className="h-32 w-full bg-gray-100 border-t">
                      <img src={trip.cover_url} className="w-full h-full object-cover grayscale-[0.5] hover:grayscale-0 transition-all duration-500" />
                    </div>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <button onClick={() => { setEditingId(null); setName(''); setStartDate(''); setEndDate(''); setCoverUrl(''); setModalOpen(true); }} className="fixed bottom-8 right-8 w-14 h-14 bg-black text-white rounded-full shadow-2xl flex items-center justify-center text-3xl z-40 hover:scale-110 active:scale-95 transition-all">+</button>

      {/* 新增/編輯 Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <form onSubmit={handleAddTrip} className="bg-white w-full max-w-sm p-8 rounded-[40px] shadow-2xl text-black my-auto">
            <h2 className="text-2xl font-black mb-8 tracking-tighter">{editingId ? '編輯旅程檔案' : '建立新旅程'}</h2>
            <div className="space-y-5">
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1 mb-2 block">旅程名稱</label>
                <input value={name} onChange={e => setName(e.target.value)} className="w-full bg-gray-50 border-none p-4 rounded-2xl outline-none" placeholder="2026 畢業環島" />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1 mb-2 block">開始日期</label>
                  <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full bg-gray-50 border-none p-4 rounded-2xl outline-none text-sm" />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1 mb-2 block">結束日期</label>
                  <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full bg-gray-50 border-none p-4 rounded-2xl outline-none text-sm" />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1 mb-2 block">封面圖片 (上傳照片)</label>
                <div className="relative">
                  <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" id="file-upload" />
                  <label htmlFor="file-upload" className="w-full bg-gray-50 border-2 border-dashed border-gray-200 p-4 rounded-2xl flex flex-col items-center justify-center cursor-pointer hover:bg-gray-100 transition">
                    {isUploading ? <span className="text-xs animate-pulse">上傳中...</span> : 
                     coverUrl ? <img src={coverUrl} className="h-20 w-full object-cover rounded-xl" /> :
                     <span className="text-xs text-gray-400">點擊上傳或更換照片</span>}
                  </label>
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-10">
              <button type="button" onClick={() => setModalOpen(false)} className="flex-1 py-4 bg-gray-100 rounded-2xl font-bold">取消</button>
              <button type="submit" className="flex-1 py-4 bg-black text-white rounded-2xl font-bold">{editingId ? '儲存變更' : '建立檔案'}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}