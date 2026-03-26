// src/store/useAuthStore.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Profile } from '@/types/database';

interface AuthState {
  user: Profile | null;           // ✅ Acepta null
  isLoading: boolean;
  setUser: (user: Profile | null) => void;  // ✅ Acepta null
  setLoading: (loading: boolean) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,                   // ✅ Inicia en null
      isLoading: true,
      setUser: (user) => set({ user }),      // ✅ Acepta Profile | null
      setLoading: (loading) => set({ isLoading: loading }),
      logout: () => set({ user: null, isLoading: false }),  // ✅ Limpia a null
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({ user: state.user }),
    }
  )
);