import { useState, useCallback } from "react"
import { useMutation } from "@tanstack/react-query"
import { Sparkles, Loader2 } from "lucide-react"
import { generationApi, tasksApi } from "@/api"
import { useTask } from "@/hooks/useTask"
import { useQuota } from "@/hooks/useQuota"
import { toast } from "@/hooks/useToast"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { PromptInput } from "@/components/generation/PromptInput"
import { AspectRatioSelector } from "@/components/generation/AspectRatioSelector"
import { ParameterSliders } from "@/components/generation/ParameterSliders"
import { GenerationResult } from "@/components/generation/GenerationResult"
import type { TaskSubmitResponse, TaskStatus } from "@/types"

export function TextToImagePage() {
  // Form state
  const [prompt, setPrompt] = useState("")
  const [negativePrompt, setNegativePrompt] = useState("")
  const [aspectRatio, setAspectRatio] = useState("1:1")
  const [numImages, setNumImages] = useState(1)
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

  // Task polling
  const { task } = useTask(taskId, {
    onComplete: async (completedTask) => {
      setTaskStatus("completed")
      // Fetch the result image
      try {
        const result = await tasksApi.getTaskResult(completedTask.task_id)
        if (result instanceof Blob) {
          const url = URL.createObjectURL(result)
          // 检查是否是 ZIP 文件
          const isZip = result.type === 'application/zip' || 
                        result.type === 'application/x-zip-compressed' ||
                        result.type === 'application/octet-stream'
          setIsZipFile(isZip)
          setImageUrl(url)
        }
        refetchQuota()
        toast({
          title: "生成完成",
          description: "图像已生成成功",
          variant: "success" as const,
        })
      } catch {
        toast({
          title: "获取结果失败",
          description: "无法获取生成的图像",
          variant: "destructive",
        })
      }
    },
    onError: (error) => {
      setTaskStatus("failed")
      setTaskError(error)
      toast({
        title: "生成失败",
        description: error,
        variant: "destructive",
      })
    },
  })

  // Update task status from polling
  if (task && task.status !== taskStatus) {
    setTaskStatus(task.status)
    if (task.error) {
      setTaskError(task.error)
    }
  }

  // Submit mutation
  const submitMutation = useMutation({
    mutationFn: async () => {
      const response = await generationApi.textToImage({
        prompt,
        negative_prompt: negativePrompt || undefined,
        aspect_ratio: aspectRatio,
        num_inference_steps: numInferenceSteps,
        true_cfg_scale: cfgScale,
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
    if (!prompt.trim()) {
      toast({
        title: "请输入提示词",
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
  }, [prompt, remainingToday, numImages, submitMutation])

  const handleRetry = useCallback(() => {
    submitMutation.mutate()
  }, [submitMutation])

  const isGenerating = submitMutation.isPending || taskStatus === "pending" || taskStatus === "running"

  return (
    <div className="space-y-6 animate-in">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">文生图</h1>
        <p className="text-muted-foreground">
          输入文字描述，AI 为您生成对应图像
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left Panel - Input Form */}
        <div className="space-y-6">
          {/* Prompt */}
          <Card>
            <CardHeader>
              <CardTitle>提示词</CardTitle>
              <CardDescription>描述您想要生成的图像内容</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <PromptInput
                value={prompt}
                onChange={setPrompt}
                disabled={isGenerating}
              />
              
              {/* Negative Prompt */}
              <div className="space-y-2">
                <Label>负面提示词（可选）</Label>
                <Textarea
                  value={negativePrompt}
                  onChange={(e) => setNegativePrompt(e.target.value)}
                  placeholder="描述您不想在图像中出现的内容..."
                  className="min-h-[80px] resize-none"
                  disabled={isGenerating}
                />
              </div>
            </CardContent>
          </Card>

          {/* Aspect Ratio & Number */}
          <Card>
            <CardHeader>
              <CardTitle>图像设置</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <AspectRatioSelector
                value={aspectRatio}
                onChange={setAspectRatio}
                disabled={isGenerating}
              />

              <div className="space-y-2">
                <Label>生成数量</Label>
                <div className="flex gap-2">
                  {[1, 2, 3, 4].map((n) => (
                    <Button
                      key={n}
                      variant={numImages === n ? "default" : "outline"}
                      size="sm"
                      onClick={() => setNumImages(n)}
                      disabled={isGenerating}
                    >
                      {n}
                    </Button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  每张图像消耗 1 次配额，当前将消耗 {numImages} 次
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Advanced Parameters */}
          <Card>
            <CardHeader>
              <CardTitle>高级参数</CardTitle>
              <CardDescription>调整生成参数以获得更好的效果</CardDescription>
            </CardHeader>
            <CardContent>
              <ParameterSliders
                numInferenceSteps={numInferenceSteps}
                setNumInferenceSteps={setNumInferenceSteps}
                cfgScale={cfgScale}
                setCfgScale={setCfgScale}
                seed={seed}
                setSeed={setSeed}
                disabled={isGenerating}
              />
            </CardContent>
          </Card>

          {/* Submit Button */}
          <Button
            size="lg"
            className="w-full"
            onClick={handleSubmit}
            disabled={isGenerating || !prompt.trim()}
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                生成中...
              </>
            ) : (
              <>
                <Sparkles className="h-5 w-5 mr-2" />
                生成图像（消耗 {numImages} 次配额）
              </>
            )}
          </Button>
        </div>

        {/* Right Panel - Result */}
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
