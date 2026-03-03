import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import api from '@/lib/api';

export const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,

      login: async (email, password) => {
        const res = await api.post('/auth/login', { email, password });
        const { access_token, user } = res.data;
        localStorage.setItem('token', access_token);
        localStorage.setItem('user', JSON.stringify(user));
        set({ user, token: access_token, isAuthenticated: true });
        return res.data;
      },

      logout: () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        set({ user: null, token: null, isAuthenticated: false });
      },

      setUser: (user) => {
        localStorage.setItem('user', JSON.stringify(user));
        set({ user });
      },

      // Hydrate from localStorage on first load (for backward compatibility)
      hydrate: () => {
        const token = localStorage.getItem('token');
        const userStr = localStorage.getItem('user');
        if (token && userStr) {
          try {
            const user = JSON.parse(userStr);
            set({ user, token, isAuthenticated: true });
          } catch {
            set({ user: null, token: null, isAuthenticated: false });
          }
        }
      },

      hasPermission: (module) => {
        const { user } = get();
        if (!user) return false;
        if (user.role === 'admin' || user.role === 'manager') return true;
        const perms = user.permissions || [];
        return perms.includes(module);
      },

      isBranchRestricted: () => {
        const { user } = get();
        return user?.branch_id && user.branch_id !== '';
      },

      getUserBranch: () => {
        const { user } = get();
        return user?.branch_id || null;
      },
    }),
    {
      name: 'ssc-auth',
      partialize: (state) => ({ user: state.user, token: state.token, isAuthenticated: state.isAuthenticated }),
    }
  )
);
