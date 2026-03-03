import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useUIStore = create(
  persist(
    (set) => ({
      darkMode: false,
      sidebarCollapsed: false,
      mobileMenuOpen: false,

      toggleDarkMode: () => set((state) => {
        const newVal = !state.darkMode;
        document.documentElement.classList.toggle('dark', newVal);
        return { darkMode: newVal };
      }),

      setDarkMode: (val) => {
        document.documentElement.classList.toggle('dark', val);
        set({ darkMode: val });
      },

      toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
      setSidebarCollapsed: (val) => set({ sidebarCollapsed: val }),
      setMobileMenuOpen: (val) => set({ mobileMenuOpen: val }),
    }),
    {
      name: 'ssc-ui',
      partialize: (state) => ({ darkMode: state.darkMode, sidebarCollapsed: state.sidebarCollapsed }),
    }
  )
);
