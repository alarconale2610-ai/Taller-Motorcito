import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Branch } from '@/types/database';

interface BranchState {
  selectedBranch: Branch | null;
  setSelectedBranch: (branch: Branch) => void;
  isAdmin: boolean;
}

export const useBranchStore = create<BranchState>()(
  persist(
    (set) => ({
      selectedBranch: null,
      setSelectedBranch: (branch) => set({ selectedBranch: branch }),
      isAdmin: false,
    }),
    {
      name: 'branch-storage',
    }
  )
);
