import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { History, Filter, Loader2 } from "lucide-react"
import { tasksApi } from "@/api"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { TaskCard } from "@/components/tasks/TaskCard"

export function HistoryPage() {
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState<string>("all")
  const [taskType, setTaskType] = useState<string>("all")
  const pageSize = 12

  const { data, isLoading } = useQuery({
    queryKey: ['my-history', page, status, taskType],
    queryFn: () => tasksApi.getMyHistory({
      page,
      page_size: pageSize,
      status: status === "all" ? undefined : status,
      task_type: taskType === "all" ? undefined : taskType,
    }),
  })

  return (
    <div className="space-y-6 animate-in">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">历史记录</h1>
        <p className="text-muted-foreground">查看您的所有生成任务</p>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="flex flex-wrap gap-4 py-4">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">筛选:</span>
          </div>

          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="状态" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部状态</SelectItem>
              <SelectItem value="completed">已完成</SelectItem>
              <SelectItem value="failed">失败</SelectItem>
              <SelectItem value="pending">等待中</SelectItem>
              <SelectItem value="running">执行中</SelectItem>
            </SelectContent>
          </Select>

          <Select value={taskType} onValueChange={setTaskType}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="类型" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部类型</SelectItem>
              <SelectItem value="text_to_image">文生图</SelectItem>
              <SelectItem value="image_edit">图像编辑</SelectItem>
              <SelectItem value="batch_edit">批量编辑</SelectItem>
            </SelectContent>
          </Select>

          {data && (
            <div className="ml-auto text-sm text-muted-foreground">
              共 {data.total} 条记录
            </div>
          )}
        </CardContent>
      </Card>

      {/* Task List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : data && data.items.length > 0 ? (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {data.items.map((task) => (
              <TaskCard key={task.task_id} task={task} />
            ))}
          </div>

          {/* Pagination */}
          {data.total_pages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                上一页
              </Button>
              <span className="text-sm text-muted-foreground">
                {page} / {data.total_pages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.min(data.total_pages, p + 1))}
                disabled={page === data.total_pages}
              >
                下一页
              </Button>
            </div>
          )}
        </>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <History className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">暂无历史记录</p>
            <p className="text-sm text-muted-foreground">开始生成图像后将在此显示</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
