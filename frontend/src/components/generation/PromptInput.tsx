import { useState } from "react"
import { Sparkles, Wand2 } from "lucide-react"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

interface PromptInputProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  label?: string
  showEnhance?: boolean
  disabled?: boolean
}

const promptSuggestions = [
  "一只可爱的橘猫在阳光下打盹，柔和的光线，温暖的氛围",
  "赛博朋克风格的未来城市，霓虹灯，雨夜",
  "水彩风格的山水画，中国传统艺术",
  "宇航员在月球表面行走，地球在背景中",
  "精致的美食摄影，日式料理，俯视角度",
]

export function PromptInput({ 
  value, 
  onChange, 
  placeholder = "描述您想要生成的图像...",
  label = "提示词",
  showEnhance = true,
  disabled = false
}: PromptInputProps) {
  const [showSuggestions, setShowSuggestions] = useState(false)

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>{label}</Label>
        {showEnhance && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-6 px-2 text-xs"
                  onClick={() => setShowSuggestions(!showSuggestions)}
                  disabled={disabled}
                >
                  <Sparkles className="h-3 w-3 mr-1" />
                  灵感
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                获取提示词灵感
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
      
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="min-h-[120px] resize-none"
        disabled={disabled}
      />

      {showSuggestions && (
        <div className="flex flex-wrap gap-2 pt-2">
          {promptSuggestions.map((suggestion, index) => (
            <Button
              key={index}
              variant="outline"
              size="sm"
              className="text-xs h-7"
              onClick={() => {
                onChange(suggestion)
                setShowSuggestions(false)
              }}
              disabled={disabled}
            >
              <Wand2 className="h-3 w-3 mr-1" />
              {suggestion.slice(0, 15)}...
            </Button>
          ))}
        </div>
      )}
    </div>
  )
}
