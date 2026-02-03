import { useState, useCallback } from "react"
import { useMutation } from "@tanstack/react-query"
import { Layers, Loader2 } from "lucide-react"
import { generationApi, tasksApi } from "@/api"
import { useTask } from "@/hooks/useTask"
import { useQuota } from "@/hooks/useQuota"
import { toast } from "@/hooks/useToast"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { ImageUploader } from "@/components/generation/ImageUploader"
import { ParameterSliders } from "@/components/generation/ParameterSliders"
import { GenerationResult } from "@/components/generation/GenerationResult"
import type { TaskSubmitResponse, TaskStatus } from "@/types"

export function BatchEditPage() {
  // Form state
  const [files, setFiles] = useState<File[]>([])
  const [prompts, setPrompts] = useState("")
  const [negativePrompt, setNegativePrompt] = useState("")
  const [numInferenceSteps, setNumInferenceSteps] = useState(50)
  const [cfgScale, setCfgScale] = useState(4.0)
  const [seed, setSeed] = useState(-1)

  // Task state
  const [taskId, setTaskId] = useState<string | null>(null)
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [isZipFile, setIsZipFile] = useState(false)
  const [generatedNumImages, setGeneratedNumImages] = useState(1)
  const [taskStatus, setTaskStatus] = useState<TaskStatus | null>(null)
  const [taskError, setTaskError] = useState<string | null>(null)

  const { refetch: refetchQuota, remainingToday } = useQuota()

  // Count prompts
  const promptCount = prompts.split('\n').filter(p => p.trim()).length

  // Task polling
  const { task } = useTask(taskId, {
    onComplete: async (completedTask) => {
      setTaskStatus("completed")
      try {
        const result = await tasksApi.getTaskResult(completedTask.task_id)
        if (result instanceof Blob) {
          const url = URL.createObjectURL(result)
          const isZip = result.type === 'application/zip' || 
                        result.type === 'application/x-zip-compressed' ||
                        result.type === 'application/octet-stream'
          setIsZipFile(isZip)
          setImageUrl(url)
        }
        refetchQuota()
        toast({
          title: "批量编辑完成",
          description: "所有图像已编辑成功",
          variant: "success" as const,
        })
      } catch {
        toast({
          title: "获取结果失败",
          variant: "destructive",
        })
      }
    },
    onError: (error) => {
      setTaskStatus("failed")
      setTaskError(error)
      toast({
        title: "批量编辑失败",
        description: error,
        variant: "destructive",
      })
    },
  })

  if (task && task.status !== taskStatus) {
    setTaskStatus(task.status)
    if (task.error) {
      setTaskError(task.error)
    }
  }

  // Submit mutation
  const submitMutation = useMutation({
    mutationFn: async () => {
      const response = await generationApi.batchEdit({
        image: files[0],
        prompts,
        negative_prompt: negativePrompt || undefined,
        num_inference_steps: numInferenceSteps,
        true_cfg_scale: cfgScale,
        seed: seed === -1 ? undefined : seed,
        async_mode: true,
      })
      return response as TaskSubmitResponse
    },
    onSuccess: (data) => {
      setTaskId(data.task_id)
      setTaskStatus("pending")
      setImageUrl(null)
      setIsZipFile(false)
      setGeneratedNumImages(promptCount)
      setTaskError(null)
      toast({
        title: "批量任务已提交",
        description: `共 ${promptCount} 个编辑任务`,
      })
    },
    onError: (error: Error) => {
      toast({
        title: "提交失败",
        description: error.message,
        variant: "destructive",
      })
    },
  })

  const handleSubmit = useCallback(() => {
    if (files.length === 0) {
      toast({
        title: "请上传图片",
        variant: "destructive",
      })
      return
    }
    if (!prompts.trim()) {
      toast({
        title: "请输入编辑提示词",
        variant: "destructive",
      })
      return
    }
    if (remainingToday < promptCount) {
      toast({
        title: "配额不足",
        description: `今日剩余配额: ${remainingToday}，需要: ${promptCount}`,
        variant: "destructive",
      })
      return
    }
    submitMutation.mutate()
  }, [files, prompts, remainingToday, promptCount, submitMutation])

  const handleRetry = useCallback(() => {
    submitMutation.mutate()
  }, [submitMutation])

  const isEditing = submitMutation.isPending || taskStatus === "pending" || taskStatus === "running"

  return (
    <div className="space-y-6 animate-in">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">批量编辑</h1>
        <p className="text-muted-foreground">
          对同一张图片应用多个不同的编辑效果
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left Panel */}
        <div className="space-y-6">
          {/* Image Upload */}
          <Card>
            <CardHeader>
              <CardTitle>上传原图</CardTitle>
              <CardDescription>选择需要批量编辑的图片（仅支持1张）</CardDescription>
            </CardHeader>
            <CardContent>
              <ImageUploader
                files={files}
                onFilesChange={(newFiles) => setFiles(newFiles.slice(0, 1))}
                maxFiles={1}
                disabled={isEditing}
              />
            </CardContent>
          </Card>

          {/* Batch Prompts */}
          <Card>
            <CardHeader>
              <CardTitle>批量编辑提示词</CardTitle>
              <CardDescription>
                每行一个提示词，将生成对应数量的编辑结果
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>编辑指令（每行一个）</Label>
                  <span className="text-xs text-muted-foreground">
                    {promptCount} 个提示词
                  </span>
                </div>
                <Textarea
                  value={prompts}
                  onChange={(e) => setPrompts(e.target.value)}
                  placeholder={`把背景换成海滩\n添加落日效果\n转换为油画风格\n添加下雪效果`}
                  className="min-h-[200px] font-mono text-sm"
                  disabled={isEditing}
                />
                <p className="text-xs text-muted-foreground">
                  每个提示词消耗 1 次配额，当前将消耗 {promptCount} 次
                </p>
              </div>

              <div className="space-y-2">
                <Label>通用负面提示词（可选）</Label>
                <Textarea
                  value={negativePrompt}
                  onChange={(e) => setNegativePrompt(e.target.value)}
                  placeholder="应用于所有编辑的负面提示词..."
                  className="min-h-[60px] resize-none"
                  disabled={isEditing}
                />
              </div>
            </CardContent>
          </Card>

          {/* Advanced Parameters */}
          <Card>
            <CardHeader>
              <CardTitle>高级参数</CardTitle>
            </CardHeader>
            <CardContent>
              <ParameterSliders
                numInferenceSteps={numInferenceSteps}
                setNumInferenceSteps={setNumInferenceSteps}
                cfgScale={cfgScale}
                setCfgScale={setCfgScale}
                seed={seed}
                setSeed={setSeed}
                disabled={isEditing}
              />
            </CardContent>
          </Card>

          {/* Submit Button */}
          <Button
            size="lg"
            className="w-full"
            onClick={handleSubmit}
            disabled={isEditing || files.length === 0 || !prompts.trim()}
          >
            {isEditing ? (
              <>
                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                批量编辑中...
              </>
            ) : (
              <>
                <Layers className="h-5 w-5 mr-2" />
                开始批量编辑（消耗 {promptCount} 次配额）
              </>
            )}
          </Button>
        </div>

        {/* Right Panel */}
        <div className="lg:sticky lg:top-20">
          <GenerationResult
            taskId={taskId}
            status={taskStatus}
            imageUrl={imageUrl}
            isZipFile={isZipFile}
            numImages={generatedNumImages}
            prompt={`批量编辑 ${promptCount} 个变体`}
            error={taskError}
            onRetry={handleRetry}
          />
        </div>
      </div>
    </div>
  )
}
