export type TaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'

export type TaskType = 'text_to_image' | 'image_edit' | 'batch_edit'

export interface Task {
  task_id: string
  status: TaskStatus
  error: string | null
  created_at: string
  started_at: string | null
  completed_at: string | null
  position_in_queue: number
  wait_time_seconds: number | null
  execution_time_seconds: number | null
  task_type?: TaskType
  result_path?: string
  result_filename?: string
}

export interface TaskSubmitResponse {
  message: string
  task_id: string
  status_url: string
  result_url: string
  queue_info: {
    pending_tasks: number
    running_tasks: number
  }
}

export interface TaskHistory {
  id: number
  task_id: string
  user_id: number | null
  task_type: TaskType
  prompt: string
  negative_prompt: string | null
  parameters: Record<string, unknown>
  status: TaskStatus
  result_path: string | null
  result_filename: string | null
  error_message: string | null
  created_at: string
  started_at: string | null
  completed_at: string | null
  execution_time: number | null
}

export interface TaskHistoryListResponse {
  items: TaskHistory[]
  total: number
  page: number
  page_size: number
  total_pages: number
}

export interface TaskStatistics {
  total_tasks: number
  completed_tasks: number
  failed_tasks: number
  pending_tasks: number
  text_to_image_count: number
  image_edit_count: number
  batch_edit_count: number
  avg_execution_time: number | null
  total_execution_time: number | null
  today_tasks?: number
  active_users?: number
}

export interface QueueInfo {
  is_running: boolean
  gpu_count: number
  max_workers: number
  queue_size: number
  tasks: {
    pending: number
    running: number
    completed: number
    failed: number
    total: number
  }
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
