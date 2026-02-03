import { useQuery } from "@tanstack/react-query"
import { Link } from "react-router-dom"
import { 
  ImagePlus, 
  Pencil, 
  Layers, 
  CheckCircle, 
  XCircle, 
  Clock, 
  TrendingUp,
  ArrowRight
} from "lucide-react"
import { tasksApi, getHealth } from "@/api"
import { useAuth } from "@/hooks/useAuth"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { formatDuration } from "@/utils/format"

export function DashboardPage() {
  const { user, isAdmin } = useAuth()

  const { data: stats } = useQuery({
    queryKey: ['my-statistics'],
    queryFn: () => tasksApi.getMyStatistics(),
  })

  const { data: quota } = useQuery({
    queryKey: ['quota'],
    queryFn: () => tasksApi.getMyQuota(),
  })

  const { data: queueInfo } = useQuery({
    queryKey: ['queue-info'],
    queryFn: () => tasksApi.getQueueInfo(),
    refetchInterval: 5000,
  })

  const { data: health } = useQuery({
    queryKey: ['health'],
    queryFn: () => getHealth(),
    refetchInterval: 30000,
  })

  const quickActions = [
    { title: "文生图", href: "/generate/text-to-image", icon: ImagePlus, color: "bg-blue-500" },
    { title: "图像编辑", href: "/generate/image-edit", icon: Pencil, color: "bg-green-500" },
    { title: "批量编辑", href: "/generate/batch-edit", icon: Layers, color: "bg-purple-500" },
  ]

  return (
    <div className="space-y-6 animate-in">
      {/* Welcome Section */}
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">
          欢迎回来，{user?.username}
        </h1>
        <p className="text-muted-foreground">
          开始创作您的 AI 艺术作品
        </p>
      </div>

      {/* Quick Actions */}
      <div className="grid gap-4 md:grid-cols-3">
        {quickActions.map((action) => (
          <Link key={action.href} to={action.href}>
            <Card className="hover:shadow-md transition-shadow cursor-pointer group">
              <CardContent className="flex items-center gap-4 p-6">
                <div className={`p-3 rounded-xl ${action.color} text-white`}>
                  <action.icon className="h-6 w-6" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold">{action.title}</h3>
                  <p className="text-sm text-muted-foreground">开始创作</p>
                </div>
                <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:translate-x-1 transition-transform" />
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">总任务数</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.total_tasks ?? 0}</div>
            <p className="text-xs text-muted-foreground">
              今日: {stats?.today_tasks ?? 0}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">已完成</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.completed_tasks ?? 0}</div>
            <p className="text-xs text-muted-foreground">
              成功率: {stats?.total_tasks ? Math.round((stats.completed_tasks / stats.total_tasks) * 100) : 0}%
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">失败任务</CardTitle>
            <XCircle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.failed_tasks ?? 0}</div>
            <p className="text-xs text-muted-foreground">
              待处理: {stats?.pending_tasks ?? 0}
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
              {formatDuration(stats?.avg_execution_time ?? null)}
            </div>
            <p className="text-xs text-muted-foreground">
              每次任务
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Quota & Queue Info */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Quota Card */}
        <Card>
          <CardHeader>
            <CardTitle>配额使用情况</CardTitle>
            <CardDescription>您的今日和本月使用量</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>今日使用</span>
                <span>{quota?.used_today ?? 0} / {quota?.daily_limit ?? 0}</span>
              </div>
              <Progress 
                value={quota?.daily_limit ? (quota.used_today / quota.daily_limit) * 100 : 0} 
              />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>本月使用</span>
                <span>{quota?.used_this_month ?? 0} / {quota?.monthly_limit ?? 0}</span>
              </div>
              <Progress 
                value={quota?.monthly_limit ? (quota.used_this_month / quota.monthly_limit) * 100 : 0}
              />
            </div>
            <div className="pt-2 border-t">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">累计使用</span>
                <span className="font-medium">{quota?.total_used ?? 0} 次</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Queue Info Card */}
        <Card>
          <CardHeader>
            <CardTitle>系统状态</CardTitle>
            <CardDescription>任务队列和服务器状态</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm">服务状态</span>
              <Badge variant={queueInfo?.is_running ? "success" : "destructive"}>
                {queueInfo?.is_running ? "运行中" : "已停止"}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">GPU 数量</span>
              <span className="font-medium">{health?.gpu_count ?? 0}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">并行工作数</span>
              <span className="font-medium">{queueInfo?.max_workers ?? 0}</span>
            </div>
            <div className="pt-2 border-t grid grid-cols-2 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-primary">
                  {queueInfo?.tasks?.running ?? 0}
                </div>
                <div className="text-xs text-muted-foreground">执行中</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-yellow-500">
                  {queueInfo?.tasks?.pending ?? 0}
                </div>
                <div className="text-xs text-muted-foreground">等待中</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Task Type Distribution */}
      {stats && (
        <Card>
          <CardHeader>
            <CardTitle>任务类型分布</CardTitle>
            <CardDescription>您使用各功能的次数</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="p-4 rounded-lg bg-blue-500/10">
                <ImagePlus className="h-8 w-8 mx-auto mb-2 text-blue-500" />
                <div className="text-2xl font-bold">{stats.text_to_image_count}</div>
                <div className="text-sm text-muted-foreground">文生图</div>
              </div>
              <div className="p-4 rounded-lg bg-green-500/10">
                <Pencil className="h-8 w-8 mx-auto mb-2 text-green-500" />
                <div className="text-2xl font-bold">{stats.image_edit_count}</div>
                <div className="text-sm text-muted-foreground">图像编辑</div>
              </div>
              <div className="p-4 rounded-lg bg-purple-500/10">
                <Layers className="h-8 w-8 mx-auto mb-2 text-purple-500" />
                <div className="text-2xl font-bold">{stats.batch_edit_count}</div>
                <div className="text-sm text-muted-foreground">批量编辑</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Admin Quick Access */}
      {isAdmin && (
        <Card className="border-primary/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Badge variant="default">管理员</Badge>
              快速访问
            </CardTitle>
          </CardHeader>
          <CardContent className="flex gap-4">
            <Button asChild variant="outline">
              <Link to="/admin/users">用户管理</Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/admin/statistics">全局统计</Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
