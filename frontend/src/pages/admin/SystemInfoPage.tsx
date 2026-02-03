import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { 
  Cpu, 
  HardDrive, 
  MemoryStick, 
  Thermometer, 
  Gauge, 
  Zap,
  RefreshCw,
  Server,
  Monitor
} from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { LoadingSpinner } from "@/components/common/LoadingSpinner"
import { systemApi } from "@/api"

interface GpuInfo {
  index: number
  name: string
  uuid: string | null
  memory: {
    total_mb: number
    used_mb: number
    free_mb: number
    total_gb: number
    used_gb: number
    free_gb: number
    percent: number
  }
  utilization: {
    gpu_percent: number | null
    memory_percent: number
  }
  temperature: {
    current: number | null
    unit: string
  }
  power: {
    draw_watts: number | null
    limit_watts: number | null
    percent: number | null
  }
  fan_speed_percent: number | null
  performance_state: string | null
}

interface SystemInfo {
  platform: {
    system: string
    release: string
    version: string
    machine: string
    processor: string
    python_version: string
  }
  cpu: {
    physical_cores: number
    logical_cores: number
    percent: number
    percent_per_core: number[]
    frequency?: {
      current_mhz: number
      min_mhz: number
      max_mhz: number
    }
  }
  memory: {
    total_gb: number
    available_gb: number
    used_gb: number
    percent: number
    swap: {
      total_gb: number
      used_gb: number
      percent: number
    }
  }
  gpu: {
    available: boolean
    driver_version: string | null
    cuda_version: string | null
    gpus: GpuInfo[]
  }
  process: {
    pid: number
    memory_gb: number
    memory_percent: number
    cpu_percent: number
    threads: number
    create_time: number
  }
  disk?: {
    total_gb: number
    used_gb: number
    free_gb: number
    percent: number
  }
  pytorch: {
    version: string
    cuda_available: boolean
    cuda_version: string | null
    cudnn_version: number | null
    cudnn_enabled: boolean
  }
  boot_time?: number
}

function GpuCard({ gpu }: { gpu: GpuInfo }) {
  const tempColor = gpu.temperature.current 
    ? gpu.temperature.current > 80 ? "text-red-500" 
    : gpu.temperature.current > 60 ? "text-yellow-500" 
    : "text-green-500"
    : "text-muted-foreground"

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Monitor className="h-5 w-5" />
            GPU {gpu.index}
          </CardTitle>
          {gpu.performance_state && (
            <Badge variant="outline">{gpu.performance_state}</Badge>
          )}
        </div>
        <CardDescription>{gpu.name}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 显存使用 */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="flex items-center gap-1">
              <MemoryStick className="h-4 w-4" />
              显存
            </span>
            <span>
              {gpu.memory.used_gb.toFixed(1)} / {gpu.memory.total_gb.toFixed(1)} GB
            </span>
          </div>
          <Progress value={gpu.memory.percent} className="h-2" />
          <p className="text-xs text-muted-foreground text-right">
            {gpu.memory.percent.toFixed(1)}% 已使用
          </p>
        </div>

        {/* GPU 使用率 */}
        {gpu.utilization.gpu_percent !== null && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="flex items-center gap-1">
                <Gauge className="h-4 w-4" />
                GPU 使用率
              </span>
              <span>{gpu.utilization.gpu_percent}%</span>
            </div>
            <Progress value={gpu.utilization.gpu_percent} className="h-2" />
          </div>
        )}

        {/* 温度和功耗 */}
        <div className="grid grid-cols-2 gap-4 pt-2">
          <div className="flex items-center gap-2">
            <Thermometer className={`h-5 w-5 ${tempColor}`} />
            <div>
              <p className="text-sm font-medium">
                {gpu.temperature.current !== null 
                  ? `${gpu.temperature.current}°C` 
                  : "N/A"}
              </p>
              <p className="text-xs text-muted-foreground">温度</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-yellow-500" />
            <div>
              <p className="text-sm font-medium">
                {gpu.power.draw_watts !== null 
                  ? `${gpu.power.draw_watts.toFixed(0)}W` 
                  : "N/A"}
              </p>
              <p className="text-xs text-muted-foreground">
                {gpu.power.limit_watts ? `/ ${gpu.power.limit_watts.toFixed(0)}W` : "功耗"}
              </p>
            </div>
          </div>
        </div>

        {/* 风扇转速 */}
        {gpu.fan_speed_percent !== null && (
          <div className="text-sm text-muted-foreground">
            风扇转速: {gpu.fan_speed_percent}%
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default function SystemInfoPage() {
  const [isRefreshing, setIsRefreshing] = useState(false)

  // 获取系统信息
  const { data: systemInfo, isLoading, refetch } = useQuery<SystemInfo>({
    queryKey: ["system-info"],
    queryFn: systemApi.getSystemInfo,
    refetchInterval: 10000, // 每 10 秒刷新
  })

  const handleRefresh = async () => {
    setIsRefreshing(true)
    await refetch()
    setIsRefreshing(false)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (!systemInfo) {
    return (
      <div className="text-center text-muted-foreground py-8">
        无法获取系统信息
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">系统详情</h1>
          <p className="text-muted-foreground">
            查看服务器资源使用情况和系统状态
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
            刷新
          </Button>
        </div>
      </div>

      {/* 系统概览 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* CPU 使用率 */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Cpu className="h-4 w-4" />
              CPU 使用率
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{systemInfo.cpu.percent}%</div>
            <Progress value={systemInfo.cpu.percent} className="mt-2 h-2" />
            <p className="text-xs text-muted-foreground mt-2">
              {systemInfo.cpu.physical_cores} 核心 / {systemInfo.cpu.logical_cores} 线程
            </p>
          </CardContent>
        </Card>

        {/* 内存使用 */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <MemoryStick className="h-4 w-4" />
              系统内存
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {systemInfo.memory.used_gb.toFixed(1)} / {systemInfo.memory.total_gb.toFixed(1)} GB
            </div>
            <Progress value={systemInfo.memory.percent} className="mt-2 h-2" />
            <p className="text-xs text-muted-foreground mt-2">
              {systemInfo.memory.percent.toFixed(1)}% 已使用
            </p>
          </CardContent>
        </Card>

        {/* 磁盘使用 */}
        {systemInfo.disk && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <HardDrive className="h-4 w-4" />
                磁盘空间
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {systemInfo.disk.used_gb.toFixed(1)} / {systemInfo.disk.total_gb.toFixed(1)} GB
              </div>
              <Progress value={systemInfo.disk.percent} className="mt-2 h-2" />
              <p className="text-xs text-muted-foreground mt-2">
                剩余 {systemInfo.disk.free_gb.toFixed(1)} GB
              </p>
            </CardContent>
          </Card>
        )}

        {/* 进程内存 */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Server className="h-4 w-4" />
              服务进程
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {systemInfo.process.memory_gb.toFixed(2)} GB
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              PID: {systemInfo.process.pid} | {systemInfo.process.threads} 线程
            </p>
          </CardContent>
        </Card>
      </div>

      {/* GPU 信息 */}
      {systemInfo.gpu.available && systemInfo.gpu.gpus.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">GPU 状态</h2>
            <div className="flex gap-2 text-sm text-muted-foreground">
              {systemInfo.gpu.driver_version && (
                <Badge variant="secondary">驱动: {systemInfo.gpu.driver_version}</Badge>
              )}
              {systemInfo.gpu.cuda_version && (
                <Badge variant="secondary">CUDA: {systemInfo.gpu.cuda_version}</Badge>
              )}
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {systemInfo.gpu.gpus.map((gpu) => (
              <GpuCard key={gpu.index} gpu={gpu} />
            ))}
          </div>
        </div>
      )}

      <Separator />

      {/* 详细系统信息 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* 平台信息 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">平台信息</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <InfoRow label="操作系统" value={systemInfo.platform.system} />
            <InfoRow label="系统版本" value={systemInfo.platform.release} />
            <InfoRow label="架构" value={systemInfo.platform.machine} />
            <InfoRow label="处理器" value={systemInfo.platform.processor || "N/A"} />
            <InfoRow label="Python 版本" value={systemInfo.platform.python_version} />
          </CardContent>
        </Card>

        {/* PyTorch 信息 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">PyTorch 信息</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <InfoRow label="PyTorch 版本" value={systemInfo.pytorch.version} />
            <InfoRow 
              label="CUDA 可用" 
              value={systemInfo.pytorch.cuda_available ? "是" : "否"} 
            />
            {systemInfo.pytorch.cuda_version && (
              <InfoRow label="CUDA 版本" value={systemInfo.pytorch.cuda_version} />
            )}
            {systemInfo.pytorch.cudnn_version && (
              <InfoRow label="cuDNN 版本" value={String(systemInfo.pytorch.cudnn_version)} />
            )}
            <InfoRow 
              label="cuDNN 启用" 
              value={systemInfo.pytorch.cudnn_enabled ? "是" : "否"} 
            />
          </CardContent>
        </Card>

        {/* CPU 详情 */}
        {systemInfo.cpu.frequency && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">CPU 详情</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <InfoRow label="物理核心" value={String(systemInfo.cpu.physical_cores)} />
              <InfoRow label="逻辑核心" value={String(systemInfo.cpu.logical_cores)} />
              <InfoRow 
                label="当前频率" 
                value={`${systemInfo.cpu.frequency.current_mhz.toFixed(0)} MHz`} 
              />
              <InfoRow 
                label="最大频率" 
                value={`${systemInfo.cpu.frequency.max_mhz.toFixed(0)} MHz`} 
              />
            </CardContent>
          </Card>
        )}

        {/* Swap 内存 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Swap 内存</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>使用量</span>
                <span>
                  {systemInfo.memory.swap.used_gb.toFixed(1)} / {systemInfo.memory.swap.total_gb.toFixed(1)} GB
                </span>
              </div>
              <Progress value={systemInfo.memory.swap.percent} className="h-2" />
              <p className="text-xs text-muted-foreground text-right">
                {systemInfo.memory.swap.percent.toFixed(1)}% 已使用
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  )
}
