'use client';

import { useEffect, useState, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import Sidebar from '@/components/Sidebar';
import Lightbox from '@/components/Lightbox';
import { useToast } from '@/components/Toast';
import { useConfirm } from '@/components/ConfirmDialog';
import type { Trip, Photo } from '@/lib/types';

export default function PhotoArchivePage() {
  const { id: tripId } = useParams();
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [tripInfo, setTripInfo] = useState<Trip | null>(null);
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [activeDay, setActiveDay] = useState(1);
  const [uploading, setUploading] = useState(false);
  const [inputUrl, setInputUrl] = useState('');
  const { toast } = useToast();
  const { confirm } = useConfirm();

  // Lightbox 狀態
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  const fetchData = async () => {
    const { data: trip } = await supabase.from('trips').select('*').eq('id', tripId).single();
    setTripInfo(trip);

    const { data } = await supabase.from('trip_photos').select('*').eq('trip_id', tripId).order('created_at', { ascending: false });
    setPhotos(data || []);
  };

  useEffect(() => { fetchData(); }, [tripId]);

  // 動態天數計算（修正寫死 14 天的問題）
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
    return `${date.getMonth() + 1}/${date.getDate()}`;
  };

  const filteredPhotos = useMemo(() => photos.filter(p => p.day === activeDay), [photos, activeDay]);
  const lightboxImages = useMemo(() => filteredPhotos.map(p => ({
    url: p.url,
    caption: new Date(p.created_at).toLocaleDateString() + (p.is_storage ? ' (精選)' : ' (雲端)')
  })), [filteredPhotos]);

  const getDirectLink = (url: string) => {
    if (url.includes('drive.google.com')) {
      return url.replace('/view?usp=sharing', '').replace('file/d/', 'uc?export=view&id=').replace('/view', '');
    }
    return url;
  };

  const handleAddLink = async () => {
    if (!inputUrl) return;
    try {
      setUploading(true);
      const directUrl = getDirectLink(inputUrl);
      const { error } = await supabase.from('trip_photos').insert([{
        trip_id: tripId,
        day: activeDay,
        url: directUrl,
        is_storage: false
      }]);
      if (error) throw error;
      setInputUrl('');
      toast('連結已存檔', 'success');
      fetchData();
    } catch (error: any) {
      toast('連結存檔失敗：' + error.message, 'error');
    } finally {
      setUploading(false);
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setUploading(true);
      const file = e.target.files?.[0];
      if (!file) return;

      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`;
      const filePath = `${tripId}/${fileName}`;

      const { error: uploadError } = await supabase.storage.from('trip-photos').upload(filePath, file);
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from('trip-photos').getPublicUrl(filePath);

      await supabase.from('trip_photos').insert([{
        trip_id: tripId,
        day: activeDay,
        url: publicUrl,
        storage_path: filePath,
        is_storage: true
      }]);

      toast('照片已上傳', 'success');
      fetchData();
    } catch (error: any) {
      toast('上傳失敗：' + error.message, 'error');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (photo: Photo) => {
    const ok = await confirm({ message: '確定要永久刪除這張影像紀錄嗎？', confirmText: '刪除', danger: true });
    if (!ok) return;
    try {
      if (photo.is_storage && photo.storage_path) {
        await supabase.storage.from('trip-photos').remove([photo.storage_path]);
      }
      const { error: dbError } = await supabase.from('trip_photos').delete().eq('id', photo.id);
      if (dbError) throw dbError;
      toast('照片已刪除', 'info');
      fetchData();
    } catch (error: any) {
      toast('刪除失敗：' + error.message, 'error');
    }
  };

  return (
    <div className="bg-gray-50 min-h-screen text-black font-sans overflow-x-hidden">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setSidebarOpen(false)} currentPage="photos" />

      {/* 頂部選單 */}
      <div className="fixed top-6 left-6 z-[100]">
        <button onClick={() => setSidebarOpen(true)} className="p-3 rounded-2xl glass-dark text-white shadow-2xl hover:bg-black/60 transition-all">☰</button>
      </div>

      <div className="pt-24 px-6 max-w-6xl mx-auto">
        <h1 className="text-4xl font-black tracking-tighter mb-2 italic">PHOTO ARCHIVE</h1>
        <p className="text-gray-400 text-[10px] font-bold uppercase tracking-[0.3em] mb-2">
          {tripInfo?.name || '載入中...'}
        </p>
        <p className="text-gray-300 text-[9px] font-bold uppercase tracking-[0.2em] mb-8">
          {uploading ? '⏳ 處理中...' : `Day ${activeDay} · ${filteredPhotos.length} 張照片`}
        </p>

        {/* 3D 日期選取器 — 動態天數 */}
        <div className="sticky top-0 z-[50] py-6 bg-gray-50/80 backdrop-blur-md mb-6">
          <div className="flex justify-center items-center perspective-[1200px] h-20">
            <div className="flex gap-3 items-center px-10 overflow-x-auto scrollbar-hide">
              {days.map(d => {
                const diff = d - activeDay;
                const absDiff = Math.abs(diff);
                const visualAbsDiff = Math.min(absDiff, 3);
                return (
                  <button
                    key={d} onClick={() => setActiveDay(d)}
                    style={{
                      transform: `rotateY(${visualAbsDiff * (diff > 0 ? 18 : -18)}deg) scale(${1 - visualAbsDiff * 0.1}) translateZ(${-visualAbsDiff * 30}px)`,
                      opacity: 1 - visualAbsDiff * 0.2,
                      transition: 'all 0.5s ease'
                    }}
                    className={`flex-none w-20 h-16 rounded-2xl font-black shadow-lg border-2 flex flex-col items-center justify-center ${
                      activeDay === d ? 'bg-amber-500 text-white border-amber-400 scale-110 z-20' : 'bg-white text-gray-400 border-gray-100 hover:border-amber-200'
                    }`}
                  >
                    <span className="text-[10px]">D{d}</span>
                    <span className={`text-[9px] ${activeDay === d ? 'text-amber-200' : 'text-gray-300'}`}>{getDayDate(d)}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* 照片網格 */}
        {filteredPhotos.length === 0 ? (
          <div className="empty-state pb-48">
            <div className="empty-state-icon">📸</div>
            <h3 className="text-lg font-bold text-gray-300 mb-2">這天還沒有照片</h3>
            <p className="text-sm text-gray-300">使用底部控制列上傳或貼上連結！</p>
          </div>
        ) : (
          <div className="columns-2 md:columns-3 lg:columns-4 gap-4 space-y-4 pb-48">
            {filteredPhotos.map((photo, idx) => (
              <div key={photo.id} className="relative group break-inside-avoid rounded-[1.5rem] overflow-hidden shadow-lg border border-white cursor-pointer" onClick={() => { setLightboxIndex(idx); setLightboxOpen(true); }}>
                <img
                  src={photo.url}
                  alt="trip"
                  className="w-full h-auto grayscale-[0.15] group-hover:grayscale-0 transition-all duration-700 group-hover:scale-105"
                  loading="lazy"
                />

                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/30 opacity-0 group-hover:opacity-100 transition-all duration-300 p-4 flex flex-col justify-between items-end">
                  <div className="flex gap-2">
                    {!photo.is_storage && (
                      <div className="bg-blue-500 text-white p-2 rounded-xl shadow-lg" title="雲端連結照片">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" /></svg>
                      </div>
                    )}
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(photo); }}
                      className="bg-red-500/80 backdrop-blur-md text-white p-2 rounded-xl hover:bg-red-600 transition-all hover:scale-110 shadow-lg"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                  </div>
                  <div className="w-full">
                    <p className="text-white text-[9px] font-black uppercase tracking-widest">
                      {new Date(photo.created_at).toLocaleDateString()} {photo.is_storage ? '(精選)' : '(雲端)'}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 混合式存檔控制中心 */}
      <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[100] w-[calc(100%-3rem)] max-w-lg">
        <div className="glass-dark rounded-[2.5rem] p-4 shadow-[0_20px_60px_rgba(0,0,0,0.5)] flex flex-col gap-3">
          <div className="flex gap-2">
            <input
              value={inputUrl}
              onChange={(e) => setInputUrl(e.target.value)}
              placeholder="貼上 Google Drive 連結..."
              className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-xs text-white outline-none focus:border-amber-500 transition-all placeholder:text-gray-500"
            />
            <button
              onClick={handleAddLink}
              disabled={!inputUrl || uploading}
              className="bg-amber-600 text-white px-5 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest active:scale-95 transition-all disabled:opacity-30 hover:bg-amber-500"
            >
              Add
            </button>
          </div>
          <div className="h-[1px] bg-white/5 mx-4" />
          <div className="flex items-center justify-between px-4">
            <span className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">或上傳精選 (Supabase)</span>
            <label className={`bg-white/10 text-white p-2.5 rounded-xl cursor-pointer hover:bg-white/20 transition-all ${uploading ? 'opacity-30 pointer-events-none animate-pulse' : ''}`}>
              <span className="text-sm">📸</span>
              <input type="file" accept="image/*" onChange={handleUpload} className="hidden" />
            </label>
          </div>
        </div>
      </div>

      {/* Lightbox */}
      <Lightbox
        images={lightboxImages}
        currentIndex={lightboxIndex}
        isOpen={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
      />
    </div>
  );
}