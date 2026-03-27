'use client';

import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import Sidebar from '@/components/Sidebar';
import Modal from '@/components/Modal';
import { useToast } from '@/components/Toast';
import { useConfirm } from '@/components/ConfirmDialog';
import { TripCardSkeleton } from '@/components/Skeleton';
import type { Trip } from '@/lib/types';

export default function HomePage() {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [isModalOpen, setModalOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [showBackToTop, setShowBackToTop] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [coverUrl, setCoverUrl] = useState('');

  const tripRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});
  const { toast } = useToast();
  const { confirm } = useConfirm();

  const fetchData = async () => {
    const { data: tripData } = await supabase
      .from('trips')
      .select('*')
      .order('start_date', { ascending: false });
    setTrips(tripData || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
    const handleScroll = () => setShowBackToTop(window.scrollY > 400);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

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
      toast('圖片上傳失敗：' + uploadError.message, 'error');
      setIsUploading(false);
      return;
    }

    const { data } = supabase.storage.from('trip-covers').getPublicUrl(filePath);
    setCoverUrl(data.publicUrl);
    setIsUploading(false);
    toast('封面圖已上傳', 'success');
  };

  const handleSaveTrip = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !startDate) { toast('請填寫旅程名稱與開始日期', 'warning'); return; }

    const payload = {
      name,
      start_date: startDate,
      end_date: endDate || null,
      cover_url: coverUrl || "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b"
    };

    try {
      if (editingId) {
        const { error: updateError } = await supabase
          .from('trips')
          .update(payload)
          .eq('id', editingId);
        if (updateError) throw updateError;
        toast('旅程變更已儲存', 'success');
      } else {
        const { data: newTrip, error: tripError } = await supabase
          .from('trips')
          .insert([payload])
          .select()
          .single();

        if (tripError) throw tripError;

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
        toast('新旅程已開啟！', 'success');
      }

      closeModal();
      fetchData();
    } catch (error: any) {
      toast('儲存失敗：' + error.message, 'error');
    }
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingId(null);
    setName(''); setStartDate(''); setEndDate(''); setCoverUrl('');
  };

  const openEditModal = (trip: Trip) => {
    setEditingId(trip.id);
    setName(trip.name);
    setStartDate(trip.start_date);
    setEndDate(trip.end_date || '');
    setCoverUrl(trip.cover_url || '');
    setModalOpen(true);
  };

  const handleDeleteTrip = async (id: string) => {
    const ok = await confirm({
      message: '確定要徹底刪除這趟旅程紀錄嗎？此動作無法復原。',
      confirmText: '刪除',
      cancelText: '取消',
      danger: true
    });
    if (!ok) return;
    await supabase.from('trips').delete().eq('id', id);
    toast('旅程已刪除', 'info');
    fetchData();
  };

  const handleJump = (tripId: string) => {
    const target = tripRefs.current[tripId];
    if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // 計算旅程統計
  const totalTrips = trips.length;
  const totalDays = trips.reduce((acc, t) => {
    if (t.start_date && t.end_date) {
      const diff = Math.abs(new Date(t.end_date).getTime() - new Date(t.start_date).getTime());
      return acc + Math.ceil(diff / (1000 * 60 * 60 * 24)) + 1;
    }
    return acc;
  }, 0);

  return (
    <div className="bg-gray-50 min-h-screen text-black relative font-sans">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setSidebarOpen(false)} currentPage="itinerary" />

      {/* Hero 區域 */}
      <div className="hero-gradient text-white relative">
        <div className="max-w-xl mx-auto px-6 pt-20 pb-16 relative z-10">
          <div className="flex items-center justify-between mb-12">
            <button
              onClick={() => setSidebarOpen(true)}
              className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/10 hover:bg-white/20 backdrop-blur-sm transition-all text-sm"
            >
              ☰
            </button>
            <select
              onChange={(e) => handleJump(e.target.value)}
              className="bg-white/10 backdrop-blur-sm border border-white/10 rounded-xl px-4 py-2 text-xs font-medium outline-none appearance-none text-white/70 max-w-[200px]"
            >
              <option value="">🔍 跳轉旅程...</option>
              {trips.map(t => <option key={t.id} value={t.id}>{t.start_date} - {t.name}</option>)}
            </select>
          </div>

          <h1 className="text-5xl font-black tracking-tighter mb-3 italic leading-none">
            TRAVEL<br />ARCHIVE
          </h1>
          <p className="text-white/30 text-[10px] font-bold uppercase tracking-[0.4em] mb-8">公路旅行數位紀錄資料庫</p>

          {/* 統計卡片 */}
          <div className="flex gap-3">
            <div className="glass-dark rounded-2xl px-5 py-3 flex-1">
              <p className="text-[9px] text-white/40 font-bold uppercase tracking-widest">Trips</p>
              <p className="text-2xl font-black">{totalTrips}</p>
            </div>
            <div className="glass-dark rounded-2xl px-5 py-3 flex-1">
              <p className="text-[9px] text-white/40 font-bold uppercase tracking-widest">Days</p>
              <p className="text-2xl font-black">{totalDays}</p>
            </div>
            <div className="glass-dark rounded-2xl px-5 py-3 flex-1">
              <p className="text-[9px] text-white/40 font-bold uppercase tracking-widest">Memories</p>
              <p className="text-2xl font-black">∞</p>
            </div>
          </div>
        </div>

        {/* 圓弧過渡 */}
        <div className="absolute bottom-0 left-0 right-0 h-12 bg-gray-50 rounded-t-[3rem]" />
      </div>

      {/* 旅程列表 */}
      <div className="max-w-xl mx-auto px-6 pb-32 -mt-2">
        <div className="relative">
          <div className="absolute left-2 top-0 bottom-0 w-[1px] bg-gray-200/60" />

          <div className="space-y-10">
            {loading ? (
              <>
                <TripCardSkeleton />
                <TripCardSkeleton />
                <TripCardSkeleton />
              </>
            ) : trips.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">🌍</div>
                <h3 className="text-lg font-bold text-gray-300 mb-2">還沒有旅程紀錄</h3>
                <p className="text-sm text-gray-300 mb-6">點擊右下角的 + 按鈕開始你的第一趟冒險！</p>
              </div>
            ) : trips.map((trip) => (
              <div
                key={trip.id}
                ref={(el) => { tripRefs.current[trip.id] = el; }}
                className="relative pl-10 group"
              >
                {/* Timeline dot */}
                <div className="absolute left-0 top-6 -translate-x-1/2 w-3.5 h-3.5 rounded-full border-[3px] border-gray-50 bg-gray-900 z-10 group-hover:bg-blue-600 group-hover:scale-125 transition-all duration-500" />

                <div className="card-hover bg-white border border-gray-100/80 rounded-[2rem] shadow-sm overflow-hidden">
                  <div className="p-6">
                    <div className="flex justify-between items-start mb-4">
                      <Link href={`/trip/${trip.id}`} className="flex-1">
                        <h2 className="text-xl font-black text-gray-900 hover:text-blue-600 transition-colors uppercase italic tracking-tight">{trip.name}</h2>
                      </Link>
                      <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                        <button
                          onClick={() => openEditModal(trip)}
                          className="w-8 h-8 rounded-xl flex items-center justify-center text-gray-400 hover:text-blue-500 hover:bg-blue-50 transition-all"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                        </button>
                        <button
                          onClick={() => handleDeleteTrip(trip.id)}
                          className="w-8 h-8 rounded-xl flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 transition-all"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="status-dot bg-blue-500" />
                      <p className="text-[10px] text-gray-400 font-bold tracking-widest uppercase">{trip.start_date} — {trip.end_date || 'ONGOING'}</p>
                    </div>
                  </div>

                  <Link href={`/trip/${trip.id}`}>
                    <div className="h-52 w-full bg-gray-100 border-t overflow-hidden relative">
                      <img
                        src={trip.cover_url || ''}
                        className="w-full h-full object-cover grayscale-[0.2] group-hover:grayscale-0 group-hover:scale-105 transition-all duration-700"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent group-hover:from-transparent transition-all duration-500" />
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
        className="fab-button bg-gray-900 text-white hover:shadow-[0_8px_40px_rgba(0,0,0,0.35)]"
      >
        +
      </button>

      {/* Back to Top */}
      <button
        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        className={`back-to-top ${showBackToTop ? 'visible' : ''}`}
      >
        ↑
      </button>

      {/* 新增/編輯 Modal */}
      <Modal isOpen={isModalOpen} onClose={closeModal} title={editingId ? 'EDIT ARCHIVE' : 'NEW JOURNEY'}>
        <form onSubmit={handleSaveTrip}>
          <div className="space-y-6">
            <div>
              <label className="text-[9px] font-black text-gray-400 uppercase tracking-[0.2em] ml-1 mb-2 block">旅程名稱</label>
              <input value={name} onChange={e => setName(e.target.value)} className="w-full bg-gray-50 border-none p-4 rounded-2xl outline-none font-bold focus:ring-2 focus:ring-blue-500 transition-all" placeholder="2026 畢業環島" />
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
              <label className="text-[9px] font-black text-gray-400 uppercase tracking-[0.2em] ml-1 mb-2 block">封面圖片</label>
              <div className="relative">
                <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" id="file-upload" />
                <label htmlFor="file-upload" className="w-full bg-gray-50 border-2 border-dashed border-gray-200 p-6 rounded-3xl flex flex-col items-center justify-center cursor-pointer hover:bg-gray-100 hover:border-gray-300 transition-all">
                  {isUploading ? <span className="text-xs animate-pulse font-bold text-blue-500">UPLOADING...</span> :
                  coverUrl ? <img src={coverUrl} className="h-24 w-full object-cover rounded-2xl" /> :
                  <div className="text-center">
                    <span className="text-2xl block mb-2">📷</span>
                    <span className="text-[10px] text-gray-400 font-bold">點擊上傳封面照片</span>
                  </div>}
                </label>
              </div>
            </div>
          </div>

          <div className="flex gap-4 mt-10">
            <button type="button" onClick={closeModal} className="flex-1 py-4 bg-gray-50 rounded-2xl font-black text-xs hover:bg-gray-100 transition-colors">CANCEL</button>
            <button type="submit" className="flex-1 py-4 bg-gray-900 text-white rounded-2xl font-black text-xs shadow-lg active:scale-95 transition-all hover:bg-gray-800">
              {editingId ? 'SAVE CHANGES' : 'CREATE ARCHIVE'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}