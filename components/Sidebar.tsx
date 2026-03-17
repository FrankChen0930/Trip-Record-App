'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';

// 🔴 1. 確保 Props 定義在這裡，並包含所有你傳入的屬性
interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  currentPage: string; // 這裡放寬成 string，避免字串不匹配
}

// 🔴 2. 確保 function 簽名有接收這些 Props
export default function Sidebar({ isOpen, onClose, currentPage }: SidebarProps) {
  const params = useParams();
  const tripId = params?.id;

  return (
    <div className={`fixed inset-y-0 left-0 w-64 bg-white shadow-2xl z-[200] transform transition-transform ${isOpen ? 'translate-x-0' : '-translate-x-full'} transition-transform duration-300 ease-in-out`}>
      <div className="p-6">
        <h2 className="text-xl font-bold mb-8 text-black tracking-tighter">🧭 系統選單</h2>
        
        <nav className="space-y-2">
          <Link 
            href="/" 
            onClick={onClose}
            className={`block py-3 px-4 rounded-xl transition-all ${currentPage === 'itinerary' && !tripId ? 'bg-gray-100 text-blue-600 font-bold' : 'text-gray-600 hover:bg-gray-50'}`}
          >
            🏠 旅程存檔 (Archive)
          </Link>

          {tripId && (
            <div className="mt-6 pt-6 border-t border-gray-100 space-y-2">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-4 px-4">CURRENT TRIP</p>
              
              <Link 
                href={`/trip/${tripId}`} 
                onClick={onClose}
                className={`block py-3 px-4 rounded-xl transition-all ${currentPage === 'itinerary' ? 'bg-blue-50 text-blue-600 font-bold' : 'text-gray-600 hover:bg-gray-50'}`}
              >
                🧭 行程細節
              </Link>
              
              <Link 
                href={`/trip/${tripId}/expense`} 
                onClick={onClose}
                className={`block py-3 px-4 rounded-xl transition-all ${currentPage === 'expense' ? 'bg-green-50 text-green-600 font-bold' : 'text-gray-600 hover:bg-gray-50'}`}
              >
                💰 支出結算
              </Link>

              <Link 
                href={`/trip/${tripId}/photos`} 
                onClick={onClose}
                className={`block py-3 px-4 rounded-xl transition-all ${currentPage === 'photos' ? 'bg-orange-50 text-orange-600 font-bold' : 'text-gray-600 hover:bg-gray-50'}`}
              >
                📸 照片紀錄 (Gallery)
              </Link>
            </div>
          )}

          <div className="mt-6 pt-6 border-t border-gray-100 space-y-2">
            <Link 
              href="/members" 
              onClick={onClose}
              className={`block py-3 px-4 rounded-xl transition-all ${currentPage === 'members' ? 'bg-purple-50 text-purple-600 font-bold' : 'text-gray-600 hover:bg-gray-50'}`}
            >
              👤 成員名冊
            </Link>
          </div>
        </nav>
      </div>

      <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 p-2 hover:bg-gray-100 rounded-lg transition">✕</button>
    </div>
  );
}