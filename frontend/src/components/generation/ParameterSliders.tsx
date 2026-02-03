import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Shuffle } from "lucide-react"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

interface ParameterSlidersProps {
  numInferenceSteps: number
  setNumInferenceSteps: (value: number) => void
  cfgScale: number
  setCfgScale: (value: number) => void
  seed: number
  setSeed: (value: number) => void
  disabled?: boolean
  showGuidanceScale?: boolean
  guidanceScale?: number
  setGuidanceScale?: (value: number) => void
}

export function ParameterSliders({
  numInferenceSteps,
  setNumInferenceSteps,
  cfgScale,
  setCfgScale,
  seed,
  setSeed,
  disabled = false,
  showGuidanceScale = false,
  guidanceScale = 1.5,
  setGuidanceScale,
}: ParameterSlidersProps) {
  const randomizeSeed = () => {
    setSeed(Math.floor(Math.random() * 2147483647))
  }

  return (
    <div className="space-y-6">
      {/* Inference Steps */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label>推理步数</Label>
          <span className="text-sm text-muted-foreground">{numInferenceSteps}</span>
        </div>
        <Slider
          value={[numInferenceSteps]}
          onValueChange={([value]) => setNumInferenceSteps(value)}
          min={10}
          max={100}
          step={1}
          disabled={disabled}
        />
        <p className="text-xs text-muted-foreground">
          步数越高质量越好，但生成时间更长。推荐: 30-50
        </p>
      </div>

      {/* CFG Scale */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label>CFG 尺度</Label>
          <span className="text-sm text-muted-foreground">{cfgScale.toFixed(1)}</span>
        </div>
        <Slider
          value={[cfgScale]}
          onValueChange={([value]) => setCfgScale(value)}
          min={1}
          max={10}
          step={0.5}
          disabled={disabled}
        />
        <p className="text-xs text-muted-foreground">
          控制生成结果与提示词的相关程度。推荐: 3-5
        </p>
      </div>

      {/* Guidance Scale (for image edit) */}
      {showGuidanceScale && setGuidanceScale && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label>引导尺度</Label>
            <span className="text-sm text-muted-foreground">{guidanceScale.toFixed(1)}</span>
          </div>
          <Slider
            value={[guidanceScale]}
            onValueChange={([value]) => setGuidanceScale(value)}
            min={1}
            max={5}
            step={0.1}
            disabled={disabled}
          />
          <p className="text-xs text-muted-foreground">
            控制原图与编辑结果的平衡。推荐: 1.5
          </p>
        </div>
      )}

      {/* Seed */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label>随机种子</Label>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={randomizeSeed}
                  disabled={disabled}
                >
                  <Shuffle className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>随机种子</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <div className="flex gap-2">
          <Input
            type="number"
            value={seed}
            onChange={(e) => setSeed(parseInt(e.target.value) || -1)}
            min={-1}
            max={2147483647}
            disabled={disabled}
            className="flex-1"
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSeed(-1)}
            disabled={disabled}
          >
            随机
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          -1 表示随机。使用相同种子可复现结果
        </p>
      </div>
    </div>
  )
}
