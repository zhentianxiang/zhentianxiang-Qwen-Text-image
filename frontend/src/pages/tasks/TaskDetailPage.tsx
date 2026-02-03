import { useParams, Link, useNavigate } from "react-router-dom"
import { useQuery, useMutation } from "@tanstack/react-query"
import { ArrowLeft, Download, Clock, Calendar, Loader2, FileArchive, Image as ImageIcon, RotateCw } from "lucide-react"
import { tasksApi, generationApi } from "@/api"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { TaskStatusBadge } from "@/components/tasks/TaskStatusBadge"
import { formatDate, formatDuration } from "@/utils/format"
import { useToast } from "@/hooks/useToast"
import type { TaskType, TaskSubmitResponse } from "@/types"

const taskTypeLabels: Record<TaskType, string> = {
  text_to_image: "文生图",
  image_edit: "图像编辑",
  batch_edit: "批量编辑",
}

interface ResultData {
  url: string
  isZip: boolean
  filename: string
}

export function TaskDetailPage() {
  const { taskId } = useParams<{ taskId: string }>()
  const navigate = useNavigate()
  const { toast } = useToast()

  const { data: task, isLoading } = useQuery({
    queryKey: ['task-detail', taskId],
    queryFn: () => tasksApi.getHistoryDetail(taskId!),
    enabled: !!taskId,
  })

  const { data: resultData, isLoading: isResultLoading, isError: isResultError } = useQuery({
    queryKey: ['task-result', taskId],
    queryFn: async (): Promise<ResultData | null> => {
      const result = await tasksApi.getTaskResult(taskId!)
      if (result instanceof Blob) {
        const isZip = result.type === 'application/zip' || 
                      result.type === 'application/x-zip-compressed' ||
                      result.type === 'application/octet-stream'
        const url = URL.createObjectURL(result)
        const filename = isZip ? `qwen-images-${taskId?.slice(0, 8)}.zip` : `qwen-image-${taskId?.slice(0, 8)}.png`
        return { url, isZip, filename }
      }
      return null
    },
    enabled: !!taskId && task?.status === 'completed',
    retry: 1, // 只重试一次
    staleTime: 1000 * 60 * 5, // 5分钟内不重新获取
    refetchOnWindowFocus: false, // 窗口聚焦时不刷新
  })

  const retryMutation = useMutation({
    mutationFn: async () => {
      if (!task || task.task_type !== 'text_to_image') {
        throw new Error("仅支持文生图任务重试")
      }
      // 从 task 信息中重构参数
      const params = {
        prompt: task.prompt,
        negative_prompt: task.negative_prompt,
        ...task.parameters,
        async_mode: true
      }
      // 注意：这里我们假设 task.parameters 包含了 API 所需的所有参数
      // 实际上 parameters 可能存储的是 key-value，需要确保键名匹配
      return await generationApi.textToImage(params as any) as TaskSubmitResponse
    },
    onSuccess: (data) => {
      toast({
        title: "任务已重新提交",
        description: "正在跳转到新任务详情页...",
      })
      navigate(`/tasks/${data.task_id}`)
    },
    onError: (error) => {
      toast({
        title: "重试失败",
        description: error instanceof Error ? error.message : "未知错误",
        variant: "destructive"
      })
    }
  })

  const downloadResult = () => {
    if (resultData) {
      const link = document.createElement("a")
      link.href = resultData.url
      link.download = resultData.filename
      link.click()
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!task) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">任务不存在</p>
        <Button asChild variant="link" className="mt-4">
          <Link to="/history">返回历史记录</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/history">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">任务详情</h1>
            <p className="text-sm text-muted-foreground">ID: {task.task_id}</p>
          </div>
        </div>
        
        {/* 重试按钮 - 仅限失败的文生图任务 */}
        {task.status === 'failed' && task.task_type === 'text_to_image' && (
          <Button 
            onClick={() => retryMutation.mutate()} 
            disabled={retryMutation.isPending}
          >
            {retryMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RotateCw className="h-4 w-4 mr-2" />
            )}
            重试任务
          </Button>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Task Info */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>基本信息</CardTitle>
                <TaskStatusBadge status={task.status} />
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">任务类型</span>
                <Badge variant="secondary">
                  {taskTypeLabels[task.task_type] || task.task_type}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">创建时间</span>
                <span className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  {formatDate(task.created_at)}
                </span>
              </div>
              {task.started_at && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">开始时间</span>
                  <span>{formatDate(task.started_at)}</span>
                </div>
              )}
              {task.completed_at && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">完成时间</span>
                  <span>{formatDate(task.completed_at)}</span>
                </div>
              )}
              {task.execution_time && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">执行耗时</span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    {formatDuration(task.execution_time)}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>提示词</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground mb-1">正向提示词</p>
                <p className="p-3 rounded-lg bg-muted text-sm">{task.prompt}</p>
              </div>
              {task.negative_prompt && (
                <div>
                  <p className="text-sm text-muted-foreground mb-1">负向提示词</p>
                  <p className="p-3 rounded-lg bg-muted text-sm">{task.negative_prompt}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {task.parameters && Object.keys(task.parameters).length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>参数</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  {Object.entries(task.parameters).map(([key, value]) => (
                    <div key={key} className="flex justify-between">
                      <span className="text-muted-foreground">{key}</span>
                      <span className="font-medium">{String(value)}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {task.error_message && (
            <Card className="border-destructive">
              <CardHeader>
                <CardTitle className="text-destructive">错误信息</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm">{task.error_message}</p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Result Preview */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>生成结果</CardTitle>
            </CardHeader>
            <CardContent>
              {task.status === 'completed' ? (
                isResultLoading ? (
                  // 加载结果中
                  <div className="flex flex-col items-center justify-center py-12">
                    <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
                    <p className="text-muted-foreground">正在加载结果...</p>
                  </div>
                ) : isResultError ? (
                  // 加载失败
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                    <ImageIcon className="h-12 w-12 mb-4" />
                    <p className="mb-2">结果文件不可用</p>
                    <p className="text-sm">可能已被清理或文件丢失</p>
                  </div>
                ) : resultData ? (
                  <div className="space-y-4">
                    {resultData.isZip ? (
                      // ZIP 文件（多张图片）
                      <div className="flex flex-col items-center justify-center py-12 bg-muted rounded-lg">
                        <FileArchive className="h-16 w-16 text-primary mb-4" />
                        <p className="font-medium mb-2">图片压缩包</p>
                        <p className="text-sm text-muted-foreground mb-4">
                          包含多张生成的图片
                        </p>
                        <Button onClick={downloadResult}>
                          <Download className="h-4 w-4 mr-2" />
                          下载 ZIP 文件
                        </Button>
                      </div>
                    ) : (
                      // 单张图片
                      <>
                        <div className="rounded-lg overflow-hidden bg-muted">
                          <img
                            src={resultData.url}
                            alt="Generated"
                            className="w-full h-auto"
                          />
                        </div>
                        <Button onClick={downloadResult} className="w-full">
                          <Download className="h-4 w-4 mr-2" />
                          下载图像
                        </Button>
                      </>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                    <ImageIcon className="h-12 w-12 mb-4" />
                    <p>无可用结果</p>
                  </div>
                )
              ) : task.status === 'pending' || task.status === 'running' ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
                  <p className="text-muted-foreground">
                    {task.status === 'pending' ? '任务等待中...' : '任务执行中...'}
                  </p>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <ImageIcon className="h-12 w-12 mb-4" />
                  <p>无可用结果</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
