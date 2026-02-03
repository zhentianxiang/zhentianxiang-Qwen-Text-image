import { useState, useCallback } from "react"
import { useMutation } from "@tanstack/react-query"
import { Pencil, Loader2 } from "lucide-react"
import { generationApi, tasksApi } from "@/api"
import { useTask } from "@/hooks/useTask"
import { useQuota } from "@/hooks/useQuota"
import { toast } from "@/hooks/useToast"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { PromptInput } from "@/components/generation/PromptInput"
import { ImageUploader } from "@/components/generation/ImageUploader"
import { ParameterSliders } from "@/components/generation/ParameterSliders"
import { GenerationResult } from "@/components/generation/GenerationResult"
import type { TaskSubmitResponse, TaskStatus } from "@/types"

export function ImageEditPage() {
  // Form state
  const [files, setFiles] = useState<File[]>([])
  const [prompt, setPrompt] = useState("")
  const [negativePrompt, setNegativePrompt] = useState("")
  const [numImages, setNumImages] = useState(1)
  const [numInferenceSteps, setNumInferenceSteps] = useState(50)
  const [cfgScale, setCfgScale] = useState(4.0)
  const [guidanceScale, setGuidanceScale] = useState(1.5)
  const [seed, setSeed] = useState(-1)

  // Task state
  const [taskId, setTaskId] = useState<string | null>(null)
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [isZipFile, setIsZipFile] = useState(false)
  const [generatedNumImages, setGeneratedNumImages] = useState(1)
  const [taskStatus, setTaskStatus] = useState<TaskStatus | null>(null)
  const [taskError, setTaskError] = useState<string | null>(null)

  const { refetch: refetchQuota, remainingToday } = useQuota()

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
          title: "编辑完成",
          description: "图像已编辑成功",
          variant: "success" as const,
        })
      } catch {
        toast({
          title: "获取结果失败",
          description: "无法获取编辑后的图像",
          variant: "destructive",
        })
      }
    },
    onError: (error) => {
      setTaskStatus("failed")
      setTaskError(error)
      toast({
        title: "编辑失败",
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
      const response = await generationApi.imageEdit({
        images: files,
        prompt,
        negative_prompt: negativePrompt || undefined,
        num_inference_steps: numInferenceSteps,
        true_cfg_scale: cfgScale,
        guidance_scale: guidanceScale,
        seed: seed === -1 ? undefined : seed,
        num_images: numImages,
        async_mode: true,
      })
      return response as TaskSubmitResponse
    },
    onSuccess: (data) => {
      setTaskId(data.task_id)
      setTaskStatus("pending")
      setImageUrl(null)
      setIsZipFile(false)
      setGeneratedNumImages(numImages)
      setTaskError(null)
      toast({
        title: "任务已提交",
        description: `排队中: ${data.queue_info.pending_tasks} 个任务`,
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
    if (!prompt.trim()) {
      toast({
        title: "请输入编辑提示词",
        variant: "destructive",
      })
      return
    }
    if (remainingToday < numImages) {
      toast({
        title: "配额不足",
        description: `今日剩余配额: ${remainingToday}，需要: ${numImages}`,
        variant: "destructive",
      })
      return
    }
    submitMutation.mutate()
  }, [files, prompt, remainingToday, numImages, submitMutation])

  const handleRetry = useCallback(() => {
    submitMutation.mutate()
  }, [submitMutation])

  const isEditing = submitMutation.isPending || taskStatus === "pending" || taskStatus === "running"

  return (
    <div className="space-y-6 animate-in">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">图像编辑</h1>
        <p className="text-muted-foreground">
          上传图片，通过文字描述进行智能编辑
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left Panel */}
        <div className="space-y-6">
          {/* Image Upload */}
          <Card>
            <CardHeader>
              <CardTitle>上传图片</CardTitle>
              <CardDescription>选择需要编辑的图片</CardDescription>
            </CardHeader>
            <CardContent>
              <ImageUploader
                files={files}
                onFilesChange={setFiles}
                maxFiles={4}
                disabled={isEditing}
              />
            </CardContent>
          </Card>

          {/* Edit Prompt */}
          <Card>
            <CardHeader>
              <CardTitle>编辑提示词</CardTitle>
              <CardDescription>描述您想要对图片进行的修改</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <PromptInput
                value={prompt}
                onChange={setPrompt}
                placeholder="例如：把背景换成海滩，添加落日效果..."
                label="编辑指令"
                disabled={isEditing}
              />
              
              <div className="space-y-2">
                <Label>负面提示词（可选）</Label>
                <Textarea
                  value={negativePrompt}
                  onChange={(e) => setNegativePrompt(e.target.value)}
                  placeholder="描述您不想在编辑结果中出现的内容..."
                  className="min-h-[80px] resize-none"
                  disabled={isEditing}
                />
              </div>

              <div className="space-y-2">
                <Label>生成数量</Label>
                <div className="flex gap-2">
                  {[1, 2, 3, 4].map((n) => (
                    <Button
                      key={n}
                      variant={numImages === n ? "default" : "outline"}
                      size="sm"
                      onClick={() => setNumImages(n)}
                      disabled={isEditing}
                    >
                      {n}
                    </Button>
                  ))}
                </div>
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
                showGuidanceScale
                guidanceScale={guidanceScale}
                setGuidanceScale={setGuidanceScale}
                disabled={isEditing}
              />
            </CardContent>
          </Card>

          {/* Submit Button */}
          <Button
            size="lg"
            className="w-full"
            onClick={handleSubmit}
            disabled={isEditing || files.length === 0 || !prompt.trim()}
          >
            {isEditing ? (
              <>
                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                编辑中...
              </>
            ) : (
              <>
                <Pencil className="h-5 w-5 mr-2" />
                开始编辑（消耗 {numImages} 次配额）
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
            prompt={prompt}
            error={taskError}
            onRetry={handleRetry}
          />
        </div>
      </div>
    </div>
  )
}
