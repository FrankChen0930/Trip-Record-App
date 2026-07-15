'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
import { useParams } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import BottomTabs from '@/components/BottomTabs';
import Lightbox from '@/components/Lightbox';
import { useToast } from '@/components/Toast';
import { useConfirm } from '@/components/ConfirmDialog';
import { useTrip } from '@/features/trips/hooks/useTrip';
import { usePhotos } from '@/features/photos/hooks/usePhotos';
import { useUploadPhotos, useAddPhotoLink, useDeletePhoto } from '@/features/photos/hooks/usePhotoMutations';
import { photoDisplayUrl, isVideoPath } from '@/features/photos/api';
import type { Photo } from '@/lib/types';
import { Folder, Play, Trash2, ImagePlus } from 'lucide-react';

export default function PhotoArchivePage() {
  const { id } = useParams();
  const tripId = typeof id === 'string' ? id : undefined;
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [activeDay, setActiveDay] = useState(1);
  const [inputUrl, setInputUrl] = useState('');
  const [showDayZero, setShowDayZero] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { confirm } = useConfirm();

  const { data: tripInfo } = useTrip(tripId);
  const { data: photos = [] } = usePhotos(tripId);
  const upload = useUploadPhotos(tripId);
  const addLink = useAddPhotoLink(tripId);
  const deletePhoto = useDeletePhoto(tripId);

  // Lightbox 狀態
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  // Day 0 顯示：沿用 trip 頁的 localStorage 設定；若已有 Day 0 的照片也強制顯示
  const hasDayZeroPhotos = useMemo(() => photos.some((p) => p.day === 0), [photos]);
  useEffect(() => {
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem(`trip_${tripId}_dayZero`);
      if (saved === 'true') {
        // localStorage 只能在 client 端 hydration 後讀，無法用 useState 初始值取代
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setShowDayZero(true);
        setActiveDay((d) => (d === 1 ? 0 : d));
      }
    }
  }, [tripId]);
  const effectiveDayZero = showDayZero || hasDayZeroPhotos;

  const days = useMemo(() => {
    if (!tripInfo?.start_date || !tripInfo?.end_date) return [1];
    const start = new Date(tripInfo.start_date);
    const end = new Date(tripInfo.end_date);
    const diffDays = Math.ceil(Math.abs(end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    return Array.from({ length: diffDays }, (_, i) => (effectiveDayZero ? i : i + 1));
  }, [tripInfo, effectiveDayZero]);

  const getDayDate = (dayNum: number) => {
    if (!tripInfo?.start_date) return '';
    const date = new Date(tripInfo.start_date);
    date.setDate(date.getDate() + dayNum - (effectiveDayZero ? 0 : 1));
    return `${date.getMonth() + 1}/${date.getDate()}`;
  };

  const filteredPhotos = useMemo(() => photos.filter((p) => p.day === activeDay), [photos, activeDay]);
  const lightboxImages = useMemo(
    () =>
      filteredPhotos.map((p) => ({
        url: photoDisplayUrl(p),
        isVideo: isVideoPath(p.storage_path ?? p.url),
        caption: new Date(p.created_at).toLocaleDateString(),
      })),
    [filteredPhotos]
  );

  const busy = upload.isPending || addLink.isPending;

  const handleAddLink = () => {
    if (!inputUrl) return;
    addLink.mutate(
      { url: inputUrl.trim(), day: activeDay },
      {
        onSuccess: () => { setInputUrl(''); toast('連結已存檔', 'success'); },
        onError: (e) => toast(`連結存檔失敗：${e.message}`, 'error'),
      }
    );
  };

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = ''; // 允許重選同一批檔案
    if (files.length === 0) return;
    upload.mutate(
      { files, day: activeDay },
      {
        onSuccess: ({ uploaded, failed }) => {
          if (uploaded > 0) toast(`已上傳 ${uploaded} 個檔案`, 'success');
          if (failed.length > 0) toast(`${failed.length} 個檔案上傳失敗`, 'error');
        },
        onError: (e) => toast(`上傳失敗：${e.message}`, 'error'),
      }
    );
  };

  const handleDelete = async (photo: Photo) => {
    const ok = await confirm({ message: '確定要永久刪除這張影像紀錄嗎？', confirmText: '刪除', danger: true });
    if (!ok) return;
    deletePhoto.mutate(photo, {
      onSuccess: () => toast('照片已刪除', 'info'),
      onError: (e) => toast(`刪除失敗：${e.message}`, 'error'),
    });
  };

  const statusText = upload.progress
    ? `⏳ 上傳中 ${upload.progress.done}/${upload.progress.total}...`
    : busy
      ? '⏳ 處理中...'
      : `Day ${activeDay} · ${filteredPhotos.length} 個紀錄`;

  return (
    <div className="min-h-screen font-sans overflow-x-hidden" style={{ background: 'var(--color-bg-page)', color: 'var(--color-ink)' }}>
      <Sidebar isOpen={isSidebarOpen} onClose={() => setSidebarOpen(false)} currentPage="photos" />

      {/* 頂部選單 */}
      <div className="fixed top-6 left-6 z-[100]">
        <button onClick={() => setSidebarOpen(true)} className="p-3 rounded-2xl glass-dark text-white shadow-2xl hover:bg-black/60 transition-all">☰</button>
      </div>

      <div className="pt-24 px-6 max-w-6xl mx-auto">
        <h1 className="text-4xl font-black tracking-tighter mb-2">PHOTO ARCHIVE</h1>
        <p className="text-[10px] font-bold uppercase tracking-[0.3em] mb-2" style={{ color: 'var(--color-ink-muted)' }}>
          {tripInfo?.name || '載入中...'}
        </p>
        <p className="text-[9px] font-bold uppercase tracking-[0.2em] mb-8" style={{ color: 'var(--color-ink-muted)', opacity: 0.7 }}>
          {statusText}
        </p>

        {/* 3D 日期選取器 — 動態天數 */}
        <div className="sticky top-0 z-[50] py-6 backdrop-blur-md mb-6" style={{ background: 'color-mix(in srgb, var(--color-bg-page) 80%, transparent)' }}>
          <div className="flex justify-center items-center perspective-[1200px] h-20">
            <div className="flex gap-3 items-center px-10 overflow-x-auto scrollbar-hide">
              {days.map((d) => {
                const diff = d - activeDay;
                const visualAbsDiff = Math.min(Math.abs(diff), 3);
                return (
                  <button
                    key={d} onClick={() => setActiveDay(d)}
                    style={{
                      transform: `rotateY(${visualAbsDiff * (diff > 0 ? 18 : -18)}deg) scale(${1 - visualAbsDiff * 0.1}) translateZ(${-visualAbsDiff * 30}px)`,
                      opacity: 1 - visualAbsDiff * 0.2,
                      transition: 'all 0.5s ease',
                    }}
                    className={`flex-none w-20 h-16 rounded-xl font-black shadow-lg border-2 flex flex-col items-center justify-center ${
                      activeDay === d
                        ? 'bg-[var(--color-primary)] text-white border-[var(--color-accent2)] scale-110 z-20'
                        : 'bg-white text-[var(--color-ink-muted)] border-[var(--color-border-hairline)] hover:border-[#9BDCC4]'
                    }`}
                  >
                    <span className="text-[10px]">D{d}</span>
                    <span className={`text-[9px] ${activeDay === d ? 'text-[#CDEEE2]' : 'text-[#B6C6BF]'}`}>{getDayDate(d)}</span>
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
            <h3 className="text-lg font-bold mb-2" style={{ color: 'var(--color-ink-muted)' }}>這天還沒有照片</h3>
            <p className="text-sm" style={{ color: 'var(--color-ink-muted)', opacity: 0.7 }}>使用底部控制列上傳或貼上連結！</p>
          </div>
        ) : (
          <div className="columns-2 md:columns-3 lg:columns-4 gap-4 space-y-4 pb-48">
            {filteredPhotos.map((photo, idx) => {
              const src = photoDisplayUrl(photo);
              const isVideo = isVideoPath(photo.storage_path ?? photo.url);
              const isGenericLink =
                !photo.is_storage &&
                (photo.url.includes('drive.google.com/drive/folders') ||
                  photo.url.includes('photos.app.goo.gl') ||
                  (!photo.url.match(/\.(jpeg|jpg|gif|png|webp)/i) && !photo.url.includes('uc?export=view')));

              if (isGenericLink) {
                return (
                  <div key={photo.id} className="relative group break-inside-avoid rounded-xl overflow-hidden shadow-sm border border-[var(--color-border-hairline)] bg-white hover:border-[#9BDCC4] transition-colors">
                    <a href={photo.url} target="_blank" rel="noopener noreferrer" className="flex flex-col items-center justify-center p-8 text-center h-48">
                      <Folder className="w-12 h-12 mb-3 group-hover:scale-110 transition-transform" style={{ color: 'var(--color-accent2)' }} />
                      <span className="text-xs font-bold break-all line-clamp-2 leading-relaxed" style={{ color: 'var(--color-ink-muted)' }}>外部雲端相簿連結</span>
                    </a>
                    <button
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleDelete(photo); }}
                      className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 bg-red-50 text-red-500 p-2 rounded-xl hover:bg-red-500 hover:text-white transition-all shadow-sm"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    <div className="absolute bottom-3 left-3">
                      <span className="text-[9px] font-black px-2 py-1 rounded-lg uppercase" style={{ background: 'var(--color-primary-soft)', color: 'var(--color-primary-strong)' }}>外部連結</span>
                    </div>
                  </div>
                );
              }

              return (
                <div
                  key={photo.id}
                  className="relative group break-inside-avoid rounded-xl overflow-hidden shadow-lg border border-white cursor-pointer bg-black/5"
                  onClick={() => { setLightboxIndex(idx); setLightboxOpen(true); }}
                >
                  {isVideo ? (
                    <>
                      <video src={src} preload="metadata" muted playsInline className="w-full h-auto pointer-events-none" />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-12 h-12 rounded-full flex items-center justify-center shadow-lg" style={{ background: 'rgba(7,48,38,0.55)' }}>
                          <Play className="w-5 h-5 text-white ml-0.5" fill="currentColor" />
                        </div>
                      </div>
                    </>
                  ) : (
                    <img
                      src={src}
                      alt="trip"
                      className="w-full h-auto grayscale-[0.15] group-hover:grayscale-0 transition-all duration-700 group-hover:scale-105"
                      loading="lazy"
                    />
                  )}

                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/30 opacity-0 group-hover:opacity-100 transition-all duration-300 p-4 flex flex-col justify-between items-end">
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(photo); }}
                      className="bg-red-500/80 backdrop-blur-md text-white p-2 rounded-xl hover:bg-red-600 transition-all hover:scale-110 shadow-lg"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    <div className="w-full mt-2">
                      <p className="text-white text-[9px] font-black uppercase tracking-widest bg-black/30 inline-block px-2 py-1 rounded-lg backdrop-blur-sm">
                        {new Date(photo.created_at).toLocaleDateString()}{isVideo ? ' · 影片' : ''}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 混合式存檔控制中心 */}
      <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[100] w-[calc(100%-3rem)] max-w-lg">
        <div className="glass-dark rounded-[2rem] p-4 shadow-[0_20px_60px_rgba(0,0,0,0.5)] flex flex-col gap-3">
          <div className="flex gap-2">
            <input
              value={inputUrl}
              onChange={(e) => setInputUrl(e.target.value)}
              placeholder="貼上外部相簿連結..."
              className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-xs text-white outline-none focus:border-[var(--color-accent2)] transition-all placeholder:text-gray-500"
            />
            <button
              onClick={handleAddLink}
              disabled={!inputUrl || busy}
              className="bg-[var(--color-primary)] text-white px-5 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest active:scale-95 transition-all disabled:opacity-30 hover:bg-[var(--color-primary-strong)]"
            >
              Add
            </button>
          </div>
          <div className="h-[1px] bg-white/5 mx-4" />
          <div className="flex items-center justify-between px-4">
            <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">
              {upload.progress ? `上傳中 ${upload.progress.done}/${upload.progress.total}` : '上傳照片 / 影片（可多選）'}
            </span>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={busy}
              className={`bg-[var(--color-primary)] text-white p-2.5 rounded-xl hover:bg-[var(--color-primary-strong)] transition-all ${busy ? 'opacity-40 pointer-events-none animate-pulse' : ''}`}
            >
              <ImagePlus className="w-4 h-4" />
            </button>
            <input ref={fileInputRef} type="file" accept="image/*,video/mp4,video/quicktime" multiple onChange={handleUpload} className="hidden" />
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

      <BottomTabs />
    </div>
  );
}
