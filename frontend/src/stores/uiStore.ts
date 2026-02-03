import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface UIState {
  sidebarCollapsed: boolean
  theme: 'light' | 'dark' | 'system'
  
  // Actions
  toggleSidebar: () => void
  setSidebarCollapsed: (collapsed: boolean) => void
  setTheme: (theme: 'light' | 'dark' | 'system') => void
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      theme: 'system',

      toggleSidebar: () => {
        set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed }))
      },

      setSidebarCollapsed: (collapsed: boolean) => {
        set({ sidebarCollapsed: collapsed })
      },

      setTheme: (theme: 'light' | 'dark' | 'system') => {
        set({ theme })
        
        // 应用主题
        const root = document.documentElement
        if (theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
          root.classList.add('dark')
        } else {
          root.classList.remove('dark')
        }
      },
    }),
    {
      name: 'ui-storage',
    }
  )
)

// 初始化主题
const initTheme = () => {
  const stored = localStorage.getItem('ui-storage')
  if (stored) {
    const { state } = JSON.parse(stored)
    const theme = state?.theme || 'system'
    const root = document.documentElement
    if (theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      root.classList.add('dark')
    }
  }
}

initTheme()
