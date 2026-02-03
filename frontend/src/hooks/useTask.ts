import { useState, useCallback, useEffect, useRef } from 'react'
import { tasksApi } from '@/api'
import type { Task, TaskStatus } from '@/types'

interface UseTaskOptions {
  onComplete?: (task: Task) => void
  onError?: (error: string) => void
  pollingInterval?: number
}

export function useTask(taskId: string | null, options: UseTaskOptions = {}) {
  const { onComplete, onError, pollingInterval = 3000 } = options
  const [task, setTask] = useState<Task | null>(null)
  const [isPolling, setIsPolling] = useState(false)

  // 使用 ref 保存回调函数，确保它们的变化不会触发 polling 重启
  const callbacksRef = useRef({ onComplete, onError })

  useEffect(() => {
    callbacksRef.current = { onComplete, onError }
  }, [onComplete, onError])

  const fetchStatus = useCallback(async () => {
    if (!taskId) return null
    
    try {
      const status = await tasksApi.getTaskStatus(taskId)
      setTask(status)
      return status
    } catch (err) {
      const message = err instanceof Error ? err.message : '获取任务状态失败'
      // 使用 ref 中的 onError
      callbacksRef.current.onError?.(message)
      return null
    }
  }, [taskId]) // 移除 onError 依赖，因为它现在通过 ref 访问

  // 轮询任务状态
  useEffect(() => {
    if (!taskId) {
      setTask(null)
      return
    }

    let timeoutId: number | null = null
    let attempts = 0
    
    const poll = async () => {
      const status = await fetchStatus()
      if (!status) {
        // 如果获取失败，稍后重试，但不要太快
        timeoutId = window.setTimeout(poll, Math.max(pollingInterval, 5000))
        return
      }
      
      const completedStatuses: TaskStatus[] = ['completed', 'failed', 'cancelled']
      if (completedStatuses.includes(status.status)) {
        setIsPolling(false)
        
        // 使用 ref 中的回调
        if (status.status === 'completed') {
          callbacksRef.current.onComplete?.(status)
        } else if (status.status === 'failed') {
          callbacksRef.current.onError?.(status.error || '任务执行失败')
        }
        return // 停止轮询
      }

      // 计算下一次轮询间隔 (自适应退避策略)
      attempts++
      let nextInterval = pollingInterval
      
      // 如果前 5 次 (约 15秒) 还没完成，稍微放慢速度
      if (attempts > 5) {
        nextInterval = pollingInterval * 1.5
      }
      // 如果 20 次 (约 1分钟) 还没完成，显著放慢速度
      if (attempts > 20) {
        nextInterval = pollingInterval * 3
      }

      timeoutId = window.setTimeout(poll, nextInterval)
    }

    setIsPolling(true)
    poll() // 立即执行一次

    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId)
      }
    }
    // 依赖项中移除了 onComplete 和 onError，防止父组件重渲染导致轮询重启
  }, [taskId, fetchStatus, pollingInterval])

  const cancel = useCallback(async () => {
    if (!taskId) return false
    
    try {
      await tasksApi.cancelTask(taskId)
      await fetchStatus()
      return true
    } catch {
      return false
    }
  }, [taskId, fetchStatus])

  return {
    task,
    isPolling,
    isPending: task?.status === 'pending',
    isRunning: task?.status === 'running',
    isCompleted: task?.status === 'completed',
    isFailed: task?.status === 'failed',
    cancel,
    refetch: fetchStatus,
  }
}