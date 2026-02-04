export interface User {
  id: number
  username: string
  email: string | null
  is_active: boolean
  is_admin: boolean
  created_at: string
}

export interface LoginRequest {
  username: string
  password: string
}

export interface RegisterRequest {
  username: string
  password: string
  email?: string
}

export interface TokenResponse {
  access_token: string
  token_type: string
  expires_in: number
}

export interface PasswordChangeRequest {
  old_password: string
  new_password: string
}

export interface UserQuota {
  user_id: number
  daily_limit: number
  monthly_limit: number
  used_today: number
  used_this_month: number
  total_used: number
  remaining_today: number
  remaining_this_month: number
}

export interface UserAdminCreate {
  username: string
  password: string
  email?: string
  is_admin?: boolean
}

export interface UserAdminUpdate {
  email?: string
  password?: string
  is_active?: boolean
  is_admin?: boolean
}

export interface UserQuotaUpdate {
  daily_limit?: number
  monthly_limit?: number
}