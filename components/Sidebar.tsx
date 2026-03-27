'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  currentPage: string;
}

export default function Sidebar({ isOpen, onClose, currentPage }: SidebarProps) {
  const params = useParams();
  const tripId = params?.id;

  return (
    <>
      {/* 遮罩層 */}
      <div
        className={`fixed inset-0 bg-black/40 backdrop-blur-sm z-[199] transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      />

      {/* 側邊欄 */}
      <div className={`fixed inset-y-0 left-0 w-72 bg-white/95 backdrop-blur-xl shadow-2xl z-[200] transition-transform duration-500 flex flex-col ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}
        style={{ transitionTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)' }}
      >
        {/* Header */}
        <div className="p-8 pb-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xl font-black text-black tracking-tighter">TRAVEL</h2>
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-gray-100 transition-colors text-gray-400 text-sm">✕</button>
          </div>
          <p className="text-[9px] font-bold text-gray-300 uppercase tracking-[0.3em]">Navigation System</p>
        </div>

        {/* 主要導航 */}
        <nav className="flex-1 px-4 space-y-1 overflow-y-auto">
          <Link
            href="/"
            onClick={onClose}
            className={`flex items-center gap-3 py-3.5 px-4 rounded-2xl transition-all duration-300 group ${
              currentPage === 'itinerary' && !tripId
                ? 'bg-gray-900 text-white shadow-lg'
                : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
            }`}
          >
            <span className="text-lg group-hover:scale-110 transition-transform">🏠</span>
            <div>
              <span className="text-sm font-bold block">旅程存檔</span>
              <span className="text-[9px] opacity-50 font-medium">Archive</span>
            </div>
          </Link>

          {tripId && (
            <div className="mt-6 pt-6 border-t border-gray-100 space-y-1">
              <p className="text-[9px] font-bold text-gray-300 uppercase tracking-[0.2em] mb-4 px-4">CURRENT TRIP</p>

              <Link
                href={`/trip/${tripId}`}
                onClick={onClose}
                className={`flex items-center gap-3 py-3.5 px-4 rounded-2xl transition-all duration-300 group ${
                  currentPage === 'itinerary' ? 'bg-blue-50 text-blue-600 shadow-sm' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                <span className="text-lg group-hover:scale-110 transition-transform">🧭</span>
                <div>
                  <span className="text-sm font-bold block">行程細節</span>
                  <span className="text-[9px] opacity-50 font-medium">Itinerary</span>
                </div>
              </Link>

              <Link
                href={`/trip/${tripId}/expense`}
                onClick={onClose}
                className={`flex items-center gap-3 py-3.5 px-4 rounded-2xl transition-all duration-300 group ${
                  currentPage === 'expense' ? 'bg-emerald-50 text-emerald-600 shadow-sm' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                <span className="text-lg group-hover:scale-110 transition-transform">💰</span>
                <div>
                  <span className="text-sm font-bold block">支出結算</span>
                  <span className="text-[9px] opacity-50 font-medium">Settlement</span>
                </div>
              </Link>

              <Link
                href={`/trip/${tripId}/photos`}
                onClick={onClose}
                className={`flex items-center gap-3 py-3.5 px-4 rounded-2xl transition-all duration-300 group ${
                  currentPage === 'photos' ? 'bg-amber-50 text-amber-600 shadow-sm' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                <span className="text-lg group-hover:scale-110 transition-transform">📸</span>
                <div>
                  <span className="text-sm font-bold block">照片紀錄</span>
                  <span className="text-[9px] opacity-50 font-medium">Gallery</span>
                </div>
              </Link>
            </div>
          )}

          <div className="mt-6 pt-6 border-t border-gray-100 space-y-1">
            <Link
              href="/members"
              onClick={onClose}
              className={`flex items-center gap-3 py-3.5 px-4 rounded-2xl transition-all duration-300 group ${
                currentPage === 'members' ? 'bg-violet-50 text-violet-600 shadow-sm' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              <span className="text-lg group-hover:scale-110 transition-transform">👤</span>
              <div>
                <span className="text-sm font-bold block">成員名冊</span>
                <span className="text-[9px] opacity-50 font-medium">Members</span>
              </div>
            </Link>
          </div>
        </nav>

        {/* Footer */}
        <div className="p-6 border-t border-gray-100">
          <p className="text-[9px] text-gray-300 font-bold uppercase tracking-widest">Trip Record App</p>
          <p className="text-[8px] text-gray-200 font-mono mt-1">v0.2.0 — Upgraded Edition</p>
        </div>
      </div>
    </>
  );
}