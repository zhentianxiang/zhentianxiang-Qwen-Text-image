import { useQuery } from '@tanstack/react-query'
import { tasksApi } from '@/api'

export function useQuota() {
  const { data: quota, isLoading, error, refetch } = useQuery({
    queryKey: ['quota'],
    queryFn: () => tasksApi.getMyQuota(),
    refetchInterval: 60000, // 每分钟刷新一次
  })

  return {
    quota,
    isLoading,
    error,
    refetch,
    remainingToday: quota?.remaining_today ?? 0,
    remainingMonth: quota?.remaining_this_month ?? 0,
    usedToday: quota?.used_today ?? 0,
    dailyLimit: quota?.daily_limit ?? 0,
  }
}
