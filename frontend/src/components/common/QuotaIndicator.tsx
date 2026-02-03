import { cn } from "@/utils/cn"
import { useQuota } from "@/hooks/useQuota"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

interface QuotaIndicatorProps {
  className?: string
}

export function QuotaIndicator({ className }: QuotaIndicatorProps) {
  const { quota, isLoading } = useQuota()

  if (isLoading || !quota) {
    return null
  }

  const percentage = quota.daily_limit > 0 
    ? Math.round((quota.used_today / quota.daily_limit) * 100)
    : 0
  
  const isLow = percentage > 80
  const isExhausted = quota.remaining_today <= 0

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={cn("flex items-center gap-2", className)}>
            <div className="flex items-center gap-1.5 text-sm">
              <span className={cn(
                "font-medium",
                isExhausted && "text-destructive",
                isLow && !isExhausted && "text-yellow-600 dark:text-yellow-500"
              )}>
                {quota.remaining_today}
              </span>
              <span className="text-muted-foreground">/ {quota.daily_limit}</span>
            </div>
            <div className="h-2 w-16 overflow-hidden rounded-full bg-secondary">
              <div 
                className={cn(
                  "h-full transition-all",
                  isExhausted ? "bg-destructive" : isLow ? "bg-yellow-500" : "bg-primary"
                )}
                style={{ width: `${100 - percentage}%` }}
              />
            </div>
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <div className="space-y-1 text-xs">
            <p>今日剩余：{quota.remaining_today} 次</p>
            <p>今日已用：{quota.used_today} 次</p>
            <p>本月剩余：{quota.remaining_this_month} 次</p>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
