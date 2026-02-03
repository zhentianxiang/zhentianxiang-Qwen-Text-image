import { useQuery } from "@tanstack/react-query"
import { 
  BarChart3, 
  TrendingUp, 
  CheckCircle, 
  XCircle, 
  Clock, 
  ImagePlus,
  Pencil,
  Layers,
  Loader2
} from "lucide-react"
import { tasksApi } from "@/api"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { formatDuration } from "@/utils/format"

export function StatisticsPage() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['global-statistics'],
    queryFn: () => tasksApi.getGlobalStatistics(),
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!stats) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        无法获取统计数据
      </div>
    )
  }

  const successRate = stats.total_tasks > 0 
    ? Math.round((stats.completed_tasks / stats.total_tasks) * 100) 
    : 0

  return (
    <div className="space-y-6 animate-in">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">全局统计</h1>
        <p className="text-muted-foreground">系统使用统计数据</p>
      </div>

      {/* Overview Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">总任务数</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total_tasks}</div>
            <p className="text-xs text-muted-foreground">
              今日: {stats.today_tasks ?? 0}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">成功任务</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.completed_tasks}</div>
            <p className="text-xs text-muted-foreground">
              成功率: {successRate}%
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">失败任务</CardTitle>
            <XCircle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.failed_tasks}</div>
            <p className="text-xs text-muted-foreground">
              待处理: {stats.pending_tasks}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">平均耗时</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatDuration(stats.avg_execution_time ?? null)}
            </div>
            <p className="text-xs text-muted-foreground">
              总耗时: {formatDuration(stats.total_execution_time ?? null)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Task Type Distribution */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            任务类型分布
          </CardTitle>
          <CardDescription>各功能模块使用情况</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="p-6 rounded-lg bg-blue-500/10 text-center">
              <ImagePlus className="h-10 w-10 mx-auto mb-3 text-blue-500" />
              <div className="text-3xl font-bold">{stats.text_to_image_count}</div>
              <div className="text-sm text-muted-foreground mt-1">文生图</div>
              <div className="text-xs text-muted-foreground">
                {stats.total_tasks > 0 
                  ? Math.round((stats.text_to_image_count / stats.total_tasks) * 100) 
                  : 0}%
              </div>
            </div>
            <div className="p-6 rounded-lg bg-green-500/10 text-center">
              <Pencil className="h-10 w-10 mx-auto mb-3 text-green-500" />
              <div className="text-3xl font-bold">{stats.image_edit_count}</div>
              <div className="text-sm text-muted-foreground mt-1">图像编辑</div>
              <div className="text-xs text-muted-foreground">
                {stats.total_tasks > 0 
                  ? Math.round((stats.image_edit_count / stats.total_tasks) * 100) 
                  : 0}%
              </div>
            </div>
            <div className="p-6 rounded-lg bg-purple-500/10 text-center">
              <Layers className="h-10 w-10 mx-auto mb-3 text-purple-500" />
              <div className="text-3xl font-bold">{stats.batch_edit_count}</div>
              <div className="text-sm text-muted-foreground mt-1">批量编辑</div>
              <div className="text-xs text-muted-foreground">
                {stats.total_tasks > 0 
                  ? Math.round((stats.batch_edit_count / stats.total_tasks) * 100) 
                  : 0}%
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Additional Stats */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>任务状态分布</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">已完成</span>
                <span className="font-medium text-green-500">{stats.completed_tasks}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">失败</span>
                <span className="font-medium text-destructive">{stats.failed_tasks}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">等待中</span>
                <span className="font-medium text-yellow-500">{stats.pending_tasks}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>系统信息</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">活跃用户数</span>
                <span className="font-medium">{stats.active_users ?? "-"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">今日任务数</span>
                <span className="font-medium">{stats.today_tasks ?? 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">总执行时间</span>
                <span className="font-medium">
                  {formatDuration(stats.total_execution_time ?? null)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
