import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Profile } from '@/types/database';

interface AuthState {
  user: Profile | null;
  loading: boolean;
  setUser: (user: Profile) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      loading: false,
      setUser: (user) => set({ user, loading: false }),
      logout: () => set({ user: null, loading: false }),
    }),
    {
      name: 'auth-storage',
    }
  )
);
