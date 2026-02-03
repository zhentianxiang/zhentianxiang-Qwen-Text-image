import { useQuery } from "@tanstack/react-query"
import { Gauge, TrendingUp, Calendar, Loader2 } from "lucide-react"
import { tasksApi } from "@/api"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"

export function QuotaPage() {
  const { data: quota, isLoading } = useQuery({
    queryKey: ['quota'],
    queryFn: () => tasksApi.getMyQuota(),
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!quota) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        无法获取配额信息
      </div>
    )
  }

  const todayPercent = quota.daily_limit > 0 
    ? Math.round((quota.used_today / quota.daily_limit) * 100) 
    : 0
  const monthPercent = quota.monthly_limit > 0 
    ? Math.round((quota.used_this_month / quota.monthly_limit) * 100) 
    : 0

  return (
    <div className="space-y-6 animate-in max-w-4xl">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">配额管理</h1>
        <p className="text-muted-foreground">查看您的使用量和配额限制</p>
      </div>

      {/* Overview Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">今日剩余</CardTitle>
            <Gauge className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">{quota.remaining_today}</div>
            <p className="text-xs text-muted-foreground">次</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">本月剩余</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{quota.remaining_this_month}</div>
            <p className="text-xs text-muted-foreground">次</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">累计使用</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{quota.total_used}</div>
            <p className="text-xs text-muted-foreground">次</p>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Usage */}
      <Card>
        <CardHeader>
          <CardTitle>使用详情</CardTitle>
          <CardDescription>您的配额使用情况</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Today's Usage */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="font-medium">今日使用量</span>
              <span className="text-muted-foreground">
                {quota.used_today} / {quota.daily_limit}
              </span>
            </div>
            <Progress value={todayPercent} className="h-3" />
            <p className="text-xs text-muted-foreground">
              已使用 {todayPercent}%，剩余 {quota.remaining_today} 次
            </p>
          </div>

          {/* Monthly Usage */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="font-medium">本月使用量</span>
              <span className="text-muted-foreground">
                {quota.used_this_month} / {quota.monthly_limit}
              </span>
            </div>
            <Progress value={monthPercent} className="h-3" />
            <p className="text-xs text-muted-foreground">
              已使用 {monthPercent}%，剩余 {quota.remaining_this_month} 次
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Quota Info */}
      <Card>
        <CardHeader>
          <CardTitle>配额说明</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <div className="flex items-start gap-2">
            <span className="text-primary">•</span>
            <p>每次生成图像（文生图）消耗 1 次配额</p>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-primary">•</span>
            <p>每次图像编辑消耗 1 次配额</p>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-primary">•</span>
            <p>批量编辑按提示词数量消耗配额</p>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-primary">•</span>
            <p>每日配额在次日 00:00 重置</p>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-primary">•</span>
            <p>每月配额在每月 1 日 00:00 重置</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
