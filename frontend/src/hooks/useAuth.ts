import { useEffect } from 'react'
import { useAuthStore } from '@/stores/authStore'

export function useAuth() {
  const { user, isAuthenticated, isLoading, login, register, logout, fetchUser } = useAuthStore()

  useEffect(() => {
    // 如果已登录但没有用户信息，获取用户信息
    if (isAuthenticated && !user) {
      fetchUser()
    }
  }, [isAuthenticated, user, fetchUser])

  return {
    user,
    isAuthenticated,
    isLoading,
    isAdmin: user?.is_admin ?? false,
    login,
    register,
    logout,
  }
}
