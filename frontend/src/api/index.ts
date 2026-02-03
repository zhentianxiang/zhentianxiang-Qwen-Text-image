import apiClient from './client'
import type { HealthResponse } from '@/types'

export { authApi } from './auth'
export { generationApi } from './generation'
export { tasksApi } from './tasks'
export { apiClient }

// 健康检查
export const getHealth = async (): Promise<HealthResponse> => {
  const response = await apiClient.get<HealthResponse>('/health')
  return response.data
}

// 系统信息 API
export const systemApi = {
  // 获取内存状态
  getMemory: async () => {
    const response = await apiClient.get('/memory')
    return response.data
  },

  // 获取 GPU 详细状态
  getGpuStatus: async () => {
    const response = await apiClient.get('/gpu')
    return response.data
  },

  // 获取系统综合信息（仅管理员）
  getSystemInfo: async () => {
    const response = await apiClient.get('/system')
    return response.data
  },
}
