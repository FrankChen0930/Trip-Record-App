'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import Sidebar from '@/components/Sidebar';

export default function PhotoArchiveHybridPage() {
  const { id: tripId } = useParams();
  const [photos, setPhotos] = useState<any[]>([]);
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [activeDay, setActiveDay] = useState(1);
  const [uploading, setUploading] = useState(false);
  const [inputUrl, setInputUrl] = useState(''); // 🔴 處理外部網址輸入

  const fetchPhotos = async () => {
    const { data } = await supabase.from('trip_photos').select('*').eq('trip_id', tripId).order('created_at', { ascending: false });
    setPhotos(data || []);
  };

  useEffect(() => { fetchPhotos(); }, [tripId]);

  // 🔴 智慧網址轉換器：將 Google Drive 連結轉換為直連圖床格式
  const getDirectLink = (url: string) => {
    if (url.includes('drive.google.com')) {
      return url.replace('/view?usp=sharing', '').replace('file/d/', 'uc?export=view&id=').replace('/view', '');
    }
    return url;
  };

  // 🟢 模式 A：新增外部連結 (不佔 Supabase 空間)
  const handleAddLink = async () => {
    if (!inputUrl) return;
    try {
      setUploading(true);
      const directUrl = getDirectLink(inputUrl);
      const { error } = await supabase.from('trip_photos').insert([{
        trip_id: tripId,
        day: activeDay,
        url: directUrl,
        is_storage: false // 標記為外部儲存
      }]);
      if (error) throw error;
      setInputUrl('');
      fetchPhotos();
    } catch (error: any) {
      alert('連結存檔失敗：' + error.message);
    } finally {
      setUploading(false);
    }
  };

  // 🔵 模式 B：上傳精選原圖 (使用 Supabase Storage)
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
        is_storage: true // 標記為內部儲存
      }]);

      fetchPhotos();
    } catch (error: any) {
      alert('上傳失敗：' + error.message);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (photo: any) => {
    if (!confirm('確定要永久刪除這張影像紀錄嗎？')) return;
    try {
      // 只有內部儲存的照片才需要刪除 Storage
      if (photo.is_storage && photo.storage_path) {
        await supabase.storage.from('trip-photos').remove([photo.storage_path]);
      }
      const { error: dbError } = await supabase.from('trip_photos').delete().eq('id', photo.id);
      if (dbError) throw dbError;
      fetchPhotos();
    } catch (error: any) {
      alert('刪除失敗：' + error.message);
    }
  };

  const days = Array.from({ length: 14 }, (_, i) => i + 1);

  return (
    <div className="bg-gray-50 min-h-screen text-black font-sans overflow-x-hidden">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setSidebarOpen(false)} currentPage="photos" />

      {/* 頂部選單 */}
      <div className="fixed top-6 left-6 z-[100]">
        <button onClick={() => setSidebarOpen(true)} className="p-3 rounded-2xl bg-black/50 backdrop-blur-md text-white shadow-2xl hover:bg-black transition-all">☰</button>
      </div>

      <div className="pt-24 px-6 max-w-6xl mx-auto">
        <h1 className="text-4xl font-black tracking-tighter mb-2 italic">PHOTO ARCHIVE</h1>
        <p className="text-gray-400 text-[10px] font-bold uppercase tracking-[0.3em] mb-8">
          混合雲存儲模式：{uploading ? '處理中...' : 'Google Drive & Supabase'}
        </p>

        {/* 3D 日期選取器 */}
        <div className="sticky top-0 z-[50] py-8 bg-gray-50/80 backdrop-blur-md mb-8">
          <div className="flex justify-center items-center perspective-[1200px] h-16">
            <div className="flex gap-4 items-center px-10">
              {days.map(d => {
                const diff = d - activeDay;
                const absDiff = Math.abs(diff);
                const visualAbsDiff = Math.min(absDiff, 3);
                return (
                  <button 
                    key={d} onClick={() => setActiveDay(d)}
                    style={{
                      transform: `rotateY(${visualAbsDiff * (diff > 0 ? 20 : -20)}deg) scale(${1 - visualAbsDiff * 0.12}) translateZ(${-visualAbsDiff * 40}px)`,
                      opacity: 1 - visualAbsDiff * 0.2,
                      transition: 'all 0.5s ease'
                    }}
                    className={`flex-none w-16 py-2 rounded-xl text-[10px] font-black shadow-lg border ${activeDay === d ? 'bg-orange-500 text-white border-orange-400 scale-125 z-20' : 'bg-white text-gray-400 border-gray-100'}`}
                  >
                    D{d}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* 照片網格 */}
        <div className="columns-2 md:columns-3 lg:columns-4 gap-4 space-y-4 pb-48">
          {photos.filter(p => p.day === activeDay).map((photo) => (
            <div key={photo.id} className="relative group break-inside-avoid rounded-[2rem] overflow-hidden shadow-xl border border-white">
              <img 
                src={photo.url} 
                alt="trip" 
                className="w-full h-auto grayscale-[0.2] group-hover:grayscale-0 transition-all duration-700 group-hover:scale-105" 
              />
              
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/40 opacity-0 group-hover:opacity-100 transition-all duration-300 p-5 flex flex-col justify-between items-end">
                
                <div className="flex gap-2">
                   {/* 🔴 外部連結標記 */}
                   {!photo.is_storage && (
                     <div className="bg-blue-500 text-white p-2 rounded-xl shadow-lg" title="雲端連結照片">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
                        </svg>
                     </div>
                   )}
                   <button 
                     onClick={() => handleDelete(photo)}
                     className="bg-red-500/80 backdrop-blur-md text-white p-2 rounded-xl hover:bg-red-600 transition-all transform hover:scale-110 shadow-lg"
                   >
                     <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                     </svg>
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
      </div>

      {/* 🔴 混合式存檔控制中心 */}
      <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[100] w-[calc(100%-3rem)] max-w-lg">
        <div className="bg-black/80 backdrop-blur-2xl p-4 rounded-[3rem] shadow-[0_20px_60px_rgba(0,0,0,0.5)] border border-white/10 flex flex-col gap-3">
          
          {/* 模式 A：貼網址 */}
          <div className="flex gap-2">
            <input 
              value={inputUrl}
              onChange={(e) => setInputUrl(e.target.value)}
              placeholder="貼上 Google Drive 連結..."
              className="flex-1 bg-white/5 border border-white/10 rounded-2xl px-5 py-3 text-xs text-white outline-none focus:border-orange-500 transition-all"
            />
            <button 
              onClick={handleAddLink}
              disabled={!inputUrl || uploading}
              className="bg-orange-600 text-white px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest active:scale-95 transition-all disabled:opacity-30"
            >
              Add Link
            </button>
          </div>

          <div className="h-[1px] bg-white/5 mx-4" />

          {/* 模式 B：上傳檔案按鈕 (做小一點，提示這是存精選) */}
          <div className="flex items-center justify-between px-6">
            <span className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">或上傳當日精選 (Supabase Storage)</span>
            <label className={`bg-white/10 text-white p-3 rounded-2xl cursor-pointer hover:bg-white/20 transition-all ${uploading ? 'opacity-30 pointer-events-none' : ''}`}>
               <span className="text-sm">📸</span>
               <input type="file" accept="image/*" onChange={handleUpload} className="hidden" />
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}