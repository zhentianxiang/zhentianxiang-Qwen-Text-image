import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Trash2, Loader2 } from "lucide-react"
import { tasksApi } from "@/api"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { TaskCard } from "@/components/tasks/TaskCard"
import { useToast } from "@/hooks/useToast"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

export function RecycleBinPage() {
  const [page, setPage] = useState(1)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const pageSize = 12
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['recycle-bin', page],
    queryFn: () => tasksApi.getRecycleBin({
      page,
      page_size: pageSize,
    }),
  })

  const restoreMutation = useMutation({
    mutationFn: tasksApi.restoreTask,
    onSuccess: () => {
      toast({
        title: "已还原",
        description: "任务已还原至历史记录",
      })
      queryClient.invalidateQueries({ queryKey: ['recycle-bin'] })
      queryClient.invalidateQueries({ queryKey: ['my-history'] })
    },
    onError: () => {
      toast({
        title: "还原失败",
        description: "无法还原该任务",
        variant: "destructive",
      })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: tasksApi.permanentDeleteTask,
    onSuccess: () => {
      toast({
        title: "已永久删除",
        description: "任务已被永久清除",
      })
      setDeleteId(null)
      queryClient.invalidateQueries({ queryKey: ['recycle-bin'] })
    },
    onError: () => {
      toast({
        title: "删除失败",
        description: "无法永久删除该任务",
        variant: "destructive",
      })
      setDeleteId(null)
    },
  })

  const handleRestore = (taskId: string) => {
    restoreMutation.mutate(taskId)
  }

  const handleDelete = (taskId: string) => {
    setDeleteId(taskId)
  }

  const confirmDelete = () => {
    if (deleteId) {
      deleteMutation.mutate(deleteId)
    }
  }

  return (
    <div className="space-y-6 animate-in">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">回收站</h1>
        <p className="text-muted-foreground">管理已删除的任务，可以还原或永久删除</p>
      </div>

      {/* Task List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : data && data.items.length > 0 ? (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {data.items.map((task) => (
              <TaskCard 
                key={task.task_id} 
                task={task} 
                isRecycleBin
                onRestore={handleRestore}
                onDelete={handleDelete}
              />
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
            <Trash2 className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">回收站为空</p>
          </CardContent>
        </Card>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteId} onOpenChange={(open: boolean) => !open && setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认永久删除？</DialogTitle>
            <DialogDescription>
              此操作将永久删除该任务及其生成的图片，无法恢复。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>
              取消
            </Button>
            <Button 
              variant="destructive"
              onClick={confirmDelete}
            >
              永久删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}