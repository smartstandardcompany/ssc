import { create } from 'zustand';
import api from '@/lib/api';

export const useBranchStore = create((set, get) => ({
  branches: [],
  loading: false,

  fetchBranches: async () => {
    if (get().branches.length > 0) return get().branches;
    set({ loading: true });
    try {
      const res = await api.get('/branches');
      set({ branches: res.data, loading: false });
      return res.data;
    } catch {
      set({ loading: false });
      return [];
    }
  },

  getBranchName: (branchId) => {
    const { branches } = get();
    if (!branchId) return 'All Branches';
    return branches.find(b => b.id === branchId)?.name || 'All Branches';
  },

  reset: () => set({ branches: [], loading: false }),
}));
