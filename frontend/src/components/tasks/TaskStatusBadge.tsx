import { Badge } from "@/components/ui/badge"
import { Loader2 } from "lucide-react"
import type { TaskStatus } from "@/types"

interface TaskStatusBadgeProps {
  status: TaskStatus
}

const statusConfig: Record<TaskStatus, { label: string; variant: "default" | "secondary" | "destructive" | "outline" | "success" | "warning" }> = {
  pending: { label: "等待中", variant: "secondary" },
  running: { label: "执行中", variant: "warning" },
  completed: { label: "已完成", variant: "success" },
  failed: { label: "失败", variant: "destructive" },
  cancelled: { label: "已取消", variant: "outline" },
}

export function TaskStatusBadge({ status }: TaskStatusBadgeProps) {
  const config = statusConfig[status]
  
  return (
    <Badge variant={config.variant} className="gap-1">
      {status === "running" && <Loader2 className="h-3 w-3 animate-spin" />}
      {config.label}
    </Badge>
  )
}
