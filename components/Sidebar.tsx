'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Home, Tags, Users, Map, Book, DollarSign, Camera, LayoutDashboard, X, FileText } from 'lucide-react';

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
      <div
        className={`fixed inset-0 bg-black/40 backdrop-blur-sm z-[199] transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      />
      <div className={`fixed inset-y-0 left-0 w-72 bg-white/95 backdrop-blur-xl shadow-2xl z-[200] transition-transform duration-500 flex flex-col ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}
        style={{ transitionTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)' }}
      >
        <div className="p-8 pb-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xl font-black text-black tracking-tighter">TRAVEL</h2>
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-gray-100 transition-colors text-gray-400">
              <X className="w-4 h-4" />
            </button>
          </div>
          <p className="text-[9px] font-bold text-gray-300 uppercase tracking-[0.3em]">Navigation System</p>
        </div>

        <nav className="flex-1 px-4 space-y-1 overflow-y-auto">
          <NavLink href="/" onClick={onClose} icon={<Home className="w-5 h-5" />} label="旅程存檔" sub="Archive" active={currentPage === 'itinerary' && !tripId} />

          <div className="mt-4 pt-4 border-t border-gray-100 space-y-1">
            <NavLink href="/groups" onClick={onClose} icon={<Tags className="w-5 h-5" />} label="身分組" sub="Groups" active={currentPage === 'groups'} color="blue" />
            <NavLink href="/members" onClick={onClose} icon={<Users className="w-5 h-5" />} label="成員名冊" sub="Members" active={currentPage === 'members'} color="violet" />
          </div>

          {tripId && (
            <div className="mt-4 pt-4 border-t border-gray-100 space-y-1">
              <p className="text-[9px] font-bold text-gray-300 uppercase tracking-[0.2em] mb-3 px-4">CURRENT TRIP</p>
              <NavLink href={`/trip/${tripId}`} onClick={onClose} icon={<Map className="w-5 h-5" />} label="行程細節" sub="Itinerary" active={currentPage === 'itinerary'} color="blue" />
              <NavLink href={`/trip/${tripId}/plan`} onClick={onClose} icon={<LayoutDashboard className="w-5 h-5" />} label="行程規劃" sub="Planning Mode" active={currentPage === 'plan'} color="indigo" />
              <NavLink href={`/trip/${tripId}/memo`} onClick={onClose} icon={<FileText className="w-5 h-5" />} label="注意事項" sub="Memo" active={currentPage === 'memo'} color="rose" />
              <NavLink href={`/trip/${tripId}/journal`} onClick={onClose} icon={<Book className="w-5 h-5" />} label="每日日記" sub="Journal" active={currentPage === 'journal'} color="amber" />
              <NavLink href={`/trip/${tripId}/expense`} onClick={onClose} icon={<DollarSign className="w-5 h-5" />} label="支出結算" sub="Settlement" active={currentPage === 'expense'} color="emerald" />
              <NavLink href={`/trip/${tripId}/photos`} onClick={onClose} icon={<Camera className="w-5 h-5" />} label="照片紀錄" sub="Gallery" active={currentPage === 'photos'} color="amber" />
            </div>
          )}
        </nav>

        <div className="p-6 border-t border-gray-100">
          <p className="text-[9px] text-gray-300 font-bold uppercase tracking-widest">Trip Record App</p>
          <p className="text-[8px] text-gray-200 font-mono mt-1">v0.3.0 — Groups + Journal</p>
        </div>
      </div>
    </>
  );
}

// ===== Nav Link subcomponent =====
function NavLink({ href, onClick, icon, label, sub, active, color }: {
  href: string; onClick: () => void; icon: React.ReactNode; label: string; sub: string;
  active: boolean; color?: string;
}) {
  const bgMap: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    amber: 'bg-amber-50 text-amber-600',
    violet: 'bg-violet-50 text-violet-600',
  };
  const activeClass = color ? bgMap[color] || 'bg-gray-900 text-white' : 'bg-gray-900 text-white';

  return (
    <Link href={href} onClick={onClick}
      className={`flex items-center gap-3 py-3.5 px-4 rounded-2xl transition-all duration-300 group ${
        active ? `${activeClass} shadow-sm` : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
      }`}
    >
      <span className="flex-shrink-0 group-hover:scale-110 transition-transform">{icon}</span>
      <div>
        <span className="text-sm font-bold block">{label}</span>
        <span className="text-[9px] opacity-50 font-medium">{sub}</span>
      </div>
    </Link>
  );
}