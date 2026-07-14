import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// 當前使用者身份。P0：沿用「以 member id 識別」，但集中到 store（取代散落的 localStorage 直接存取）。
// P2：導入 Supabase Auth 後，currentMemberId 會由登入後的 auth.uid() 對應而來。
interface SessionState {
  currentMemberId: string | null;
  setCurrentMemberId: (id: string | null) => void;
  clear: () => void;
}

export const useSessionStore = create<SessionState>()(
  persist(
    (set) => ({
      currentMemberId: null,
      setCurrentMemberId: (id) => set({ currentMemberId: id }),
      clear: () => set({ currentMemberId: null }),
    }),
    { name: 'trip-session' }
  )
);
