import { useQuery } from "@tanstack/react-query"
import { Loader2, ListTodo, RefreshCw } from "lucide-react"
import { tasksApi } from "@/api"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

export function TaskListPage() {
  const { data: queueInfo, isLoading, refetch } = useQuery({
    queryKey: ['queue-info'],
    queryFn: () => tasksApi.getQueueInfo(),
    refetchInterval: 3000,
  })

  // This is a simplified view - in a real app you'd have a list of active tasks
  // For now we show queue status

  return (
    <div className="space-y-6 animate-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">任务列表</h1>
          <p className="text-muted-foreground">查看当前任务队列状态</p>
        </div>
        <Button variant="outline" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          刷新
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : queueInfo ? (
        <div className="grid gap-6 md:grid-cols-2">
          {/* Queue Status */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ListTodo className="h-5 w-5" />
                队列状态
              </CardTitle>
              <CardDescription>当前任务队列信息</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span>服务状态</span>
                <Badge variant={queueInfo.is_running ? "success" : "destructive"}>
                  {queueInfo.is_running ? "运行中" : "已停止"}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span>GPU 数量</span>
                <span className="font-medium">{queueInfo.gpu_count}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>最大并行数</span>
                <span className="font-medium">{queueInfo.max_workers}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>队列大小</span>
                <span className="font-medium">{queueInfo.queue_size}</span>
              </div>
            </CardContent>
          </Card>

          {/* Task Counts */}
          <Card>
            <CardHeader>
              <CardTitle>任务统计</CardTitle>
              <CardDescription>当前会话任务数量</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-4 rounded-lg bg-yellow-500/10">
                  <div className="text-3xl font-bold text-yellow-500">
                    {queueInfo.tasks?.pending ?? 0}
                  </div>
                  <div className="text-sm text-muted-foreground">等待中</div>
                </div>
                <div className="text-center p-4 rounded-lg bg-blue-500/10">
                  <div className="text-3xl font-bold text-blue-500">
                    {queueInfo.tasks?.running ?? 0}
                  </div>
                  <div className="text-sm text-muted-foreground">执行中</div>
                </div>
                <div className="text-center p-4 rounded-lg bg-green-500/10">
                  <div className="text-3xl font-bold text-green-500">
                    {queueInfo.tasks?.completed ?? 0}
                  </div>
                  <div className="text-sm text-muted-foreground">已完成</div>
                </div>
                <div className="text-center p-4 rounded-lg bg-red-500/10">
                  <div className="text-3xl font-bold text-red-500">
                    {queueInfo.tasks?.failed ?? 0}
                  </div>
                  <div className="text-sm text-muted-foreground">失败</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            无法获取队列信息
          </CardContent>
        </Card>
      )}
    </div>
  )
}
