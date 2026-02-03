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
