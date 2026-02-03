import apiClient from './client'
import type { Task, TaskHistory, TaskHistoryListResponse, TaskStatistics, QueueInfo, UserQuota } from '@/types'

export const tasksApi = {
  // 获取队列信息
  getQueueInfo: async (): Promise<QueueInfo> => {
    const response = await apiClient.get<QueueInfo>('/tasks/queue')
    return response.data
  },

  // 获取任务状态
  getTaskStatus: async (taskId: string): Promise<Task> => {
    const response = await apiClient.get<Task>(`/tasks/${taskId}`)
    return response.data
  },

  // 获取任务结果
  getTaskResult: async (taskId: string, wait = false, timeout = 300): Promise<Blob | { status: string; message?: string }> => {
    const response = await apiClient.get(`/tasks/${taskId}/result`, {
      params: { wait, timeout },
      responseType: 'blob',
    })
    
    // 检查是否是 JSON 响应（任务未完成）
    const contentType = response.headers['content-type']
    if (contentType?.includes('application/json')) {
      const text = await response.data.text()
      return JSON.parse(text)
    }
    
    return response.data
  },

  // 取消任务
  cancelTask: async (taskId: string): Promise<{ message: string; task_id: string }> => {
    const response = await apiClient.delete(`/tasks/${taskId}`)
    return response.data
  },

  // 获取我的任务历史
  getMyHistory: async (params: {
    page?: number
    page_size?: number
    status?: string
    task_type?: string
    start_date?: string
    end_date?: string
  }): Promise<TaskHistoryListResponse> => {
    const response = await apiClient.get<TaskHistoryListResponse>('/tasks/history/me', { params })
    return response.data
  },

  // 获取所有任务历史（管理员）
  getAllHistory: async (params: {
    page?: number
    page_size?: number
    status?: string
    task_type?: string
    user_id?: number
    start_date?: string
    end_date?: string
  }): Promise<TaskHistoryListResponse> => {
    const response = await apiClient.get<TaskHistoryListResponse>('/tasks/history/all', { params })
    return response.data
  },

  // 获取任务历史详情
  getHistoryDetail: async (taskId: string): Promise<TaskHistory> => {
    const response = await apiClient.get<TaskHistory>(`/tasks/history/${taskId}`)
    return response.data
  },

  // 获取我的统计
  getMyStatistics: async (): Promise<TaskStatistics> => {
    const response = await apiClient.get<TaskStatistics>('/tasks/statistics/me')
    return response.data
  },

  // 获取全局统计（管理员）
  getGlobalStatistics: async (): Promise<TaskStatistics> => {
    const response = await apiClient.get<TaskStatistics>('/tasks/statistics/global')
    return response.data
  },

  // 获取我的配额
  getMyQuota: async (): Promise<UserQuota> => {
    const response = await apiClient.get<UserQuota>('/tasks/quota/me')
    return response.data
  },

  // 清理旧任务（管理员）
  cleanup: async (maxAgeHours = 24, maxAgeDays = 30): Promise<{ message: string; memory_cleaned_count: number; db_cleaned_count: number }> => {
    const response = await apiClient.post('/tasks/cleanup', null, {
      params: { max_age_hours: maxAgeHours, max_age_days: maxAgeDays },
    })
    return response.data
  },
}
