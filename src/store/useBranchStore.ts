// src/store/useBranchStore.ts
import { create } from 'zustand';
import { Branch, BranchConfig } from '@/types/database';
import { getBranches, getBranchConfig } from '@/lib/actions/branches';

interface BranchWithConfig extends Branch {
  config?: BranchConfig;
  business_name?: string;
}

interface BranchState {
  branches: BranchWithConfig[];
  selectedBranch: BranchWithConfig | null;
  loading: boolean;
  setBranches: (branches: BranchWithConfig[]) => void;
  setSelectedBranch: (branch: BranchWithConfig | null) => void;
  loadBranches: (userBranchId?: string, isAdmin?: boolean) => Promise<void>;
  refreshBranchConfig: (branchId: string) => Promise<void>;
  clearBranchData: () => void; // ← NUEVO: para limpiar al logout
}

export const useBranchStore = create<BranchState>()((set, get) => ({
  branches: [],
  selectedBranch: null,
  loading: false,

  setBranches: (branches) => set({ branches }),

  setSelectedBranch: (branch) => {
    set({ selectedBranch: branch });
    // Solo guardar el ID, no todo el objeto
    if (typeof window !== 'undefined' && branch) {
      localStorage.setItem('last-selected-branch', branch.id);
    }
  },

  loadBranches: async (userBranchId?: string, isAdmin?: boolean) => {
    set({ loading: true });
    try {
      const allBranches = await getBranches();

      if (!Array.isArray(allBranches)) {
        set({ branches: [], selectedBranch: null, loading: false });
        return;
      }

      const branchesWithConfig: BranchWithConfig[] = await Promise.all(
        allBranches.map(async (branch) => {
          try {
            const config = await getBranchConfig(branch.id);
            return {
              ...branch,
              config: config || undefined,
              business_name: config?.business_name || branch.name,
            };
          } catch {
            return {
              ...branch,
              business_name: branch.name,
            };
          }
        })
      );

      let selected: BranchWithConfig | null = null;

      if (isAdmin) {
        const lastSelected =
          typeof window !== 'undefined'
            ? localStorage.getItem('last-selected-branch')
            : null;

        selected =
          branchesWithConfig.find((b) => b.id === lastSelected) ||
          branchesWithConfig[0] ||
          null;
      } else {
        selected =
          branchesWithConfig.find((b) => b.id === userBranchId) ||
          branchesWithConfig[0] ||
          null;
      }

      set({
        branches: branchesWithConfig,
        selectedBranch: selected,
        loading: false,
      });
    } catch (error) {
      console.error('Error loading branches:', error);
      set({ branches: [], selectedBranch: null, loading: false });
    }
  },

  refreshBranchConfig: async (branchId: string) => {
    try {
      const config = await getBranchConfig(branchId);
      const { branches, selectedBranch } = get();

      const updatedBranches: BranchWithConfig[] = branches.map((b) =>
        b.id === branchId
          ? {
              ...b,
              config: config || undefined,
              business_name: config?.business_name || b.name,
            }
          : b
      );

      const updatedSelected: BranchWithConfig | null =
        selectedBranch?.id === branchId
          ? {
              ...selectedBranch,
              config: config || undefined,
              business_name: config?.business_name || selectedBranch.name,
            }
          : selectedBranch;

      set({
        branches: updatedBranches,
        selectedBranch: updatedSelected,
      });
    } catch (error) {
      console.error('Error refreshing branch config:', error);
    }
  },

  clearBranchData: () => {
    set({ branches: [], selectedBranch: null, loading: false });
    if (typeof window !== 'undefined') {
      localStorage.removeItem('last-selected-branch');
      localStorage.removeItem('admin_selected_branch_id');
    }
  },
}));