import { useQuery } from "@tanstack/react-query"
import { generationApi } from "@/api"
import { Label } from "@/components/ui/label"
import { cn } from "@/utils/cn"

interface AspectRatioSelectorProps {
  value: string
  onChange: (value: string) => void
  disabled?: boolean
}

const ratioIcons: Record<string, React.ReactNode> = {
  "1:1": (
    <svg viewBox="0 0 24 24" className="w-4 h-4">
      <rect x="4" y="4" width="16" height="16" fill="currentColor" rx="2" />
    </svg>
  ),
  "16:9": (
    <svg viewBox="0 0 24 24" className="w-4 h-4">
      <rect x="2" y="6" width="20" height="12" fill="currentColor" rx="2" />
    </svg>
  ),
  "9:16": (
    <svg viewBox="0 0 24 24" className="w-4 h-4">
      <rect x="6" y="2" width="12" height="20" fill="currentColor" rx="2" />
    </svg>
  ),
  "4:3": (
    <svg viewBox="0 0 24 24" className="w-4 h-4">
      <rect x="3" y="5" width="18" height="14" fill="currentColor" rx="2" />
    </svg>
  ),
  "3:4": (
    <svg viewBox="0 0 24 24" className="w-4 h-4">
      <rect x="5" y="3" width="14" height="18" fill="currentColor" rx="2" />
    </svg>
  ),
  "3:2": (
    <svg viewBox="0 0 24 24" className="w-4 h-4">
      <rect x="2" y="5" width="20" height="14" fill="currentColor" rx="2" />
    </svg>
  ),
  "2:3": (
    <svg viewBox="0 0 24 24" className="w-4 h-4">
      <rect x="5" y="2" width="14" height="20" fill="currentColor" rx="2" />
    </svg>
  ),
}

export function AspectRatioSelector({ value, onChange, disabled }: AspectRatioSelectorProps) {
  const { data: aspectRatios, isLoading } = useQuery({
    queryKey: ['aspect-ratios'],
    queryFn: () => generationApi.getAspectRatios(),
  })

  const ratios = aspectRatios ? Object.keys(aspectRatios) : ["1:1", "16:9", "9:16", "4:3", "3:4"]

  return (
    <div className="space-y-3">
      <Label>宽高比</Label>
      <div className="flex flex-wrap gap-2">
        {ratios.map((ratio) => (
          <button
            key={ratio}
            onClick={() => onChange(ratio)}
            disabled={disabled || isLoading}
            className={cn(
              "flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-colors",
              value === ratio
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-background hover:bg-accent border-input",
              (disabled || isLoading) && "opacity-50 cursor-not-allowed"
            )}
          >
            {ratioIcons[ratio] || null}
            <span>{ratio}</span>
          </button>
        ))}
      </div>
      {aspectRatios && aspectRatios[value] && (
        <p className="text-xs text-muted-foreground">
          输出尺寸: {aspectRatios[value][0]} × {aspectRatios[value][1]}
        </p>
      )}
    </div>
  )
}
