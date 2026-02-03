import apiClient from './client'
import type { User, LoginRequest, RegisterRequest, TokenResponse, PasswordChangeRequest } from '@/types'

export const authApi = {
  login: async (data: LoginRequest): Promise<TokenResponse> => {
    const response = await apiClient.post<TokenResponse>('/auth/login', data)
    return response.data
  },

  register: async (data: RegisterRequest): Promise<User> => {
    const response = await apiClient.post<User>('/auth/register', data)
    return response.data
  },

  verifyEmail: async (token: string): Promise<{ message: string }> => {
    const response = await apiClient.get<{ message: string }>('/auth/verify-email', { params: { token } })
    return response.data
  },

  resendVerificationEmail: async (email: string): Promise<{ message: string }> => {
    const response = await apiClient.post<{ message: string }>('/auth/resend-verification-email', { email })
    return response.data
  },

  forgotPassword: async (username: string, email: string): Promise<{ message: string }> => {
    const response = await apiClient.post<{ message: string }>('/auth/forgot-password', { username, email })
    return response.data
  },

  resetPassword: async (token: string, newPassword: string): Promise<{ message: string }> => {
    const response = await apiClient.post<{ message: string }>('/auth/reset-password', { 
      token, 
      new_password: newPassword 
    })
    return response.data
  },

  getMe: async (): Promise<User> => {
    const response = await apiClient.get<User>('/auth/me')
    return response.data
  },

  updateMe: async (data: { email?: string }): Promise<User> => {
    const response = await apiClient.put<User>('/auth/me', data)
    return response.data
  },

  changePassword: async (data: PasswordChangeRequest): Promise<{ message: string }> => {
    const response = await apiClient.post<{ message: string }>('/auth/change-password', data)
    return response.data
  },

  // Admin APIs
  getUsers: async (skip = 0, limit = 100): Promise<User[]> => {
    const response = await apiClient.get<User[]>('/auth/users', { params: { skip, limit } })
    return response.data
  },

  toggleUserActive: async (userId: number): Promise<{ message: string; user_id: number; is_active: boolean }> => {
    const response = await apiClient.put(`/auth/users/${userId}/toggle-active`)
    return response.data
  },

  toggleUserAdmin: async (userId: number): Promise<{ message: string; user_id: number; is_admin: boolean }> => {
    const response = await apiClient.put(`/auth/users/${userId}/toggle-admin`)
    return response.data
  },

  deleteUser: async (userId: number): Promise<{ message: string }> => {
    const response = await apiClient.delete(`/auth/users/${userId}`)
    return response.data
  },
}