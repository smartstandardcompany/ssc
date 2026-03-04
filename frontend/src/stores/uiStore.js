import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useUIStore = create(
  persist(
    (set, get) => ({
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

      // Hydrate dark mode from persisted state on app load
      hydrateDarkMode: () => {
        const { darkMode } = get();
        document.documentElement.classList.toggle('dark', darkMode);
      },
    }),
    {
      name: 'ssc-ui',
      partialize: (state) => ({ darkMode: state.darkMode, sidebarCollapsed: state.sidebarCollapsed }),
      onRehydrateStorage: () => (state) => {
        // Apply dark mode class when state is rehydrated from storage
        if (state?.darkMode) {
          document.documentElement.classList.add('dark');
        }
      },
    }
  )
);
