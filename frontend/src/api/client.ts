import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios'
import { storage } from '@/utils/storage'
import { eventBus } from '@/utils/events'

const BASE_URL = import.meta.env.VITE_API_URL || '/api'

export const apiClient = axios.create({
  baseURL: BASE_URL,
  timeout: 600000, // 10 minutes for long tasks
  headers: {
    'Content-Type': 'application/json',
  },
})

// 请求拦截器 - 添加 Token
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = storage.getToken()
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

// 响应拦截器 - 处理错误
apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError<{ detail: string }>) => {
    const status = error.response?.status
    const data = error.response?.data
    
    // 401 未授权
    if (status === 401) {
      // 检查是否是登录请求，如果是登录请求失败，不应该跳转
      const isLoginRequest = error.config?.url?.includes('/auth/login')
      const isOnLoginPage = window.location.pathname === '/login' || window.location.pathname.startsWith('/login')
      
      // 只有在非登录请求或不在登录页面时才执行跳转
      if (!isLoginRequest && !isOnLoginPage) {
        storage.clear()
        eventBus.dispatch('unauthorized', null)
        // 延迟跳转，等待 UI 反应
        setTimeout(() => {
          window.location.href = '/login'
        }, 100)
      }
      return Promise.reject(error)
    }

    // 403 无权限
    if (status === 403) {
      eventBus.dispatch('api-error', {
        title: "权限不足",
        message: data?.detail || "您没有权限执行此操作"
      })
    }
    
    // 429 请求过多
    else if (status === 429) {
      eventBus.dispatch('api-error', {
        title: "请求过于频繁",
        message: data?.detail || "请稍后再试"
      })
    }

    // 500+ 服务器错误
    else if (status && status >= 500) {
      eventBus.dispatch('api-error', {
        title: "服务器错误",
        message: "服务器遇到问题，请稍后重试"
      })
    }
    
    // 网络错误
    else if (error.code === 'ERR_NETWORK') {
      eventBus.dispatch('api-error', {
        title: "网络连接失败",
        message: "无法连接到服务器，请检查网络"
      })
    }

    return Promise.reject(error)
  }
)

export default apiClient
