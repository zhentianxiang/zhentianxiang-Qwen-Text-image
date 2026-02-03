import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { User } from '@/types'
import { storage } from '@/utils/storage'
import { authApi } from '@/api'

interface AuthState {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  isLoading: boolean
  
  // Actions
  login: (username: string, password: string) => Promise<void>
  register: (username: string, password: string, email?: string) => Promise<void>
  logout: () => void
  fetchUser: () => Promise<void>
  setUser: (user: User | null) => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: storage.getToken(),
      isAuthenticated: !!storage.getToken(),
      isLoading: false,

      login: async (username: string, password: string) => {
        set({ isLoading: true })
        try {
          const response = await authApi.login({ username, password })
          storage.setToken(response.access_token)
          set({ token: response.access_token, isAuthenticated: true })
          
          // 获取用户信息
          await get().fetchUser()
        } finally {
          set({ isLoading: false })
        }
      },

      register: async (username: string, password: string, email?: string) => {
        set({ isLoading: true })
        try {
          await authApi.register({ username, password, email })
          // 注册成功，不自动登录（因为需要邮箱验证）
        } finally {
          set({ isLoading: false })
        }
      },

      logout: () => {
        storage.clear()
        set({ user: null, token: null, isAuthenticated: false })
      },

      fetchUser: async () => {
        try {
          const user = await authApi.getMe()
          set({ user })
          storage.setUser(user)
        } catch {
          // Token 无效，清除登录状态
          get().logout()
        }
      },

      setUser: (user: User | null) => {
        set({ user })
        if (user) {
          storage.setUser(user)
        }
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({ token: state.token, isAuthenticated: state.isAuthenticated }),
    }
  )
)
