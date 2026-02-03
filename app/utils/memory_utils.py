"""
内存管理工具

提供内存清理和监控功能，防止推理后内存泄漏
支持 GPU 监控（内存、使用率、温度）
"""

import gc
import subprocess
import platform
from typing import Dict, Any, Optional, List

import torch

from .logger import get_logger

logger = get_logger(__name__)


def cleanup_memory(aggressive: bool = False) -> Dict[str, Any]:
    """
    清理内存（包括 GPU 和 CPU 内存）
    
    Args:
        aggressive: 是否使用激进清理模式（会增加清理时间但更彻底）
    
    Returns:
        清理前后的内存信息
    """
    memory_before = get_memory_info()
    
    # 1. Python 垃圾回收
    gc.collect()
    
    # 2. 如果有多代未清理的对象，强制完全回收
    if aggressive:
        for _ in range(3):
            gc.collect()
    
    # 3. 清理 CUDA 缓存
    if torch.cuda.is_available():
        torch.cuda.empty_cache()
        
        # 激进模式：同步所有 CUDA 流后再清理
        if aggressive:
            torch.cuda.synchronize()
            torch.cuda.empty_cache()
            
            # 重置最大内存统计（用于调试）
            for i in range(torch.cuda.device_count()):
                torch.cuda.reset_peak_memory_stats(i)
    
    memory_after = get_memory_info()
    
    # 计算清理效果
    freed_ram = memory_before.get("cpu_used_gb", 0) - memory_after.get("cpu_used_gb", 0)
    freed_vram = memory_before.get("gpu_used_gb", 0) - memory_after.get("gpu_used_gb", 0)
    
    logger.debug(
        f"内存清理完成 | RAM 释放: {freed_ram:.2f}GB | 显存释放: {freed_vram:.2f}GB"
    )
    
    return {
        "before": memory_before,
        "after": memory_after,
        "freed_cpu_gb": max(0, freed_ram),  # RAM (保持 API 兼容)
        "freed_gpu_gb": max(0, freed_vram),  # VRAM
    }


def get_memory_info() -> Dict[str, Any]:
    """
    获取当前内存使用信息
    
    Returns:
        包含 CPU 和 GPU 内存使用情况的字典
    """
    info = {
        "gpu_available": torch.cuda.is_available(),
        "gpu_count": torch.cuda.device_count() if torch.cuda.is_available() else 0,
    }
    
    # CPU 内存信息
    try:
        import psutil
        process = psutil.Process()
        memory_info = process.memory_info()
        info["cpu_used_gb"] = memory_info.rss / (1024 ** 3)
        info["cpu_used_mb"] = memory_info.rss / (1024 ** 2)
        
        # 系统总内存
        system_memory = psutil.virtual_memory()
        info["cpu_total_gb"] = system_memory.total / (1024 ** 3)
        info["cpu_percent"] = system_memory.percent
    except ImportError:
        # psutil 不可用时跳过
        info["cpu_used_gb"] = 0
        info["cpu_used_mb"] = 0
    except Exception as e:
        logger.warning(f"获取 CPU 内存信息失败: {e}")
        info["cpu_used_gb"] = 0
    
    # GPU 内存信息
    if info["gpu_available"]:
        try:
            gpu_info = []
            total_gpu_used = 0
            total_gpu_allocated = 0
            
            for i in range(info["gpu_count"]):
                allocated = torch.cuda.memory_allocated(i) / (1024 ** 3)
                reserved = torch.cuda.memory_reserved(i) / (1024 ** 3)
                total_memory = torch.cuda.get_device_properties(i).total_memory / (1024 ** 3)
                
                gpu_info.append({
                    "device": i,
                    "name": torch.cuda.get_device_properties(i).name,
                    "allocated_gb": allocated,
                    "reserved_gb": reserved,
                    "total_gb": total_memory,
                    "percent": (reserved / total_memory) * 100 if total_memory > 0 else 0,
                })
                
                total_gpu_used += reserved
                total_gpu_allocated += allocated
            
            info["gpu_devices"] = gpu_info
            info["gpu_used_gb"] = total_gpu_used
            info["gpu_allocated_gb"] = total_gpu_allocated
        except Exception as e:
            logger.warning(f"获取 GPU 内存信息失败: {e}")
            info["gpu_used_gb"] = 0
    else:
        info["gpu_used_gb"] = 0
    
    return info


def log_memory_status(prefix: str = "") -> None:
    """
    记录当前内存状态到日志
    
    Args:
        prefix: 日志前缀，用于标识调用位置
    """
    info = get_memory_info()
    
    log_parts = [f"{prefix}" if prefix else "内存状态"]
    log_parts.append(f"进程内存(RAM): {info.get('cpu_used_gb', 0):.2f}GB")
    
    if info["gpu_available"]:
        log_parts.append(f"显存(VRAM): {info.get('gpu_used_gb', 0):.2f}GB (allocated: {info.get('gpu_allocated_gb', 0):.2f}GB)")
        
        # 详细的每张卡信息
        for gpu in info.get("gpu_devices", []):
            logger.debug(
                f"  GPU {gpu['device']} ({gpu['name']}): "
                f"{gpu['reserved_gb']:.2f}/{gpu['total_gb']:.2f}GB ({gpu['percent']:.1f}%)"
            )
    
    logger.info(" | ".join(log_parts))


class MemoryTracker:
    """
    内存跟踪器上下文管理器
    
    用于跟踪代码块执行前后的内存变化
    
    Usage:
        with MemoryTracker("推理任务"):
            # 执行推理代码
            pass
    """
    
    def __init__(self, name: str = "任务", auto_cleanup: bool = True):
        self.name = name
        self.auto_cleanup = auto_cleanup
        self.memory_before: Optional[Dict[str, Any]] = None
        self.memory_after: Optional[Dict[str, Any]] = None
    
    def __enter__(self):
        self.memory_before = get_memory_info()
        logger.debug(
            f"[{self.name}] 开始 | "
            f"RAM: {self.memory_before.get('cpu_used_gb', 0):.2f}GB | "
            f"显存: {self.memory_before.get('gpu_used_gb', 0):.2f}GB"
        )
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        if self.auto_cleanup:
            cleanup_memory(aggressive=True)
        
        self.memory_after = get_memory_info()
        
        ram_delta = self.memory_after.get('cpu_used_gb', 0) - self.memory_before.get('cpu_used_gb', 0)
        vram_delta = self.memory_after.get('gpu_used_gb', 0) - self.memory_before.get('gpu_used_gb', 0)
        
        logger.info(
            f"[{self.name}] 完成 | "
            f"RAM: {self.memory_after.get('cpu_used_gb', 0):.2f}GB ({ram_delta:+.2f}GB) | "
            f"显存: {self.memory_after.get('gpu_used_gb', 0):.2f}GB ({vram_delta:+.2f}GB)"
        )
        
        return False  # 不抑制异常


def get_gpu_details() -> Dict[str, Any]:
    """
    获取详细的 GPU 信息（包括温度、使用率、功耗等）
    
    使用 nvidia-smi 命令获取详细信息
    
    Returns:
        包含 GPU 详细信息的字典
    """
    result = {
        "available": torch.cuda.is_available(),
        "driver_version": None,
        "cuda_version": None,
        "gpus": [],
    }
    
    if not result["available"]:
        return result
    
    # 获取 CUDA 版本
    try:
        result["cuda_version"] = torch.version.cuda
    except Exception:
        pass
    
    # 尝试使用 nvidia-smi 获取详细信息
    try:
        # 查询 GPU 详细信息
        cmd = [
            "nvidia-smi",
            "--query-gpu=index,name,uuid,memory.total,memory.used,memory.free,utilization.gpu,utilization.memory,temperature.gpu,power.draw,power.limit,fan.speed,pstate",
            "--format=csv,noheader,nounits"
        ]
        output = subprocess.check_output(cmd, timeout=10).decode("utf-8").strip()
        
        # 获取驱动版本
        driver_cmd = ["nvidia-smi", "--query-gpu=driver_version", "--format=csv,noheader"]
        driver_output = subprocess.check_output(driver_cmd, timeout=5).decode("utf-8").strip()
        result["driver_version"] = driver_output.split("\n")[0].strip()
        
        for line in output.split("\n"):
            if not line.strip():
                continue
            
            parts = [p.strip() for p in line.split(",")]
            if len(parts) >= 13:
                gpu_info = {
                    "index": int(parts[0]),
                    "name": parts[1],
                    "uuid": parts[2],
                    "memory": {
                        "total_mb": _safe_float(parts[3]),
                        "used_mb": _safe_float(parts[4]),
                        "free_mb": _safe_float(parts[5]),
                        "total_gb": _safe_float(parts[3]) / 1024 if _safe_float(parts[3]) else 0,
                        "used_gb": _safe_float(parts[4]) / 1024 if _safe_float(parts[4]) else 0,
                        "free_gb": _safe_float(parts[5]) / 1024 if _safe_float(parts[5]) else 0,
                        "percent": (_safe_float(parts[4]) / _safe_float(parts[3]) * 100) if _safe_float(parts[3]) else 0,
                    },
                    "utilization": {
                        "gpu_percent": _safe_float(parts[6]),
                        "memory_percent": _safe_float(parts[7]),
                    },
                    "temperature": {
                        "current": _safe_float(parts[8]),
                        "unit": "°C",
                    },
                    "power": {
                        "draw_watts": _safe_float(parts[9]),
                        "limit_watts": _safe_float(parts[10]),
                        "percent": (_safe_float(parts[9]) / _safe_float(parts[10]) * 100) if _safe_float(parts[10]) else 0,
                    },
                    "fan_speed_percent": _safe_float(parts[11]),
                    "performance_state": parts[12] if len(parts) > 12 else "N/A",
                }
                result["gpus"].append(gpu_info)
        
    except FileNotFoundError:
        logger.warning("nvidia-smi 未找到，无法获取详细 GPU 信息")
        # 回退到 PyTorch 基本信息
        result["gpus"] = _get_basic_gpu_info()
    except subprocess.TimeoutExpired:
        logger.warning("nvidia-smi 命令超时")
        result["gpus"] = _get_basic_gpu_info()
    except Exception as e:
        logger.warning(f"获取 GPU 详细信息失败: {e}")
        result["gpus"] = _get_basic_gpu_info()
    
    return result


def _safe_float(value: str) -> Optional[float]:
    """安全地将字符串转换为浮点数"""
    try:
        return float(value) if value and value.strip() not in ("[N/A]", "N/A", "") else None
    except (ValueError, TypeError):
        return None


def _get_basic_gpu_info() -> List[Dict[str, Any]]:
    """使用 PyTorch 获取基本 GPU 信息"""
    gpus = []
    if torch.cuda.is_available():
        for i in range(torch.cuda.device_count()):
            props = torch.cuda.get_device_properties(i)
            allocated = torch.cuda.memory_allocated(i)
            reserved = torch.cuda.memory_reserved(i)
            total = props.total_memory
            
            gpus.append({
                "index": i,
                "name": props.name,
                "uuid": None,
                "memory": {
                    "total_mb": total / (1024 ** 2),
                    "used_mb": reserved / (1024 ** 2),
                    "free_mb": (total - reserved) / (1024 ** 2),
                    "total_gb": total / (1024 ** 3),
                    "used_gb": reserved / (1024 ** 3),
                    "free_gb": (total - reserved) / (1024 ** 3),
                    "percent": (reserved / total * 100) if total else 0,
                },
                "utilization": {
                    "gpu_percent": None,
                    "memory_percent": (reserved / total * 100) if total else 0,
                },
                "temperature": {
                    "current": None,
                    "unit": "°C",
                },
                "power": {
                    "draw_watts": None,
                    "limit_watts": None,
                    "percent": None,
                },
                "fan_speed_percent": None,
                "performance_state": None,
            })
    return gpus


def get_system_info() -> Dict[str, Any]:
    """
    获取系统综合信息（CPU、内存、GPU、操作系统等）
    
    Returns:
        包含系统综合信息的字典
    """
    import os
    
    info = {
        "platform": {
            "system": platform.system(),
            "release": platform.release(),
            "version": platform.version(),
            "machine": platform.machine(),
            "processor": platform.processor(),
            "python_version": platform.python_version(),
        },
        "cpu": {},
        "memory": {},
        "gpu": get_gpu_details(),
        "process": {},
    }
    
    # CPU 信息
    try:
        import psutil
        
        # CPU 基本信息
        info["cpu"]["physical_cores"] = psutil.cpu_count(logical=False)
        info["cpu"]["logical_cores"] = psutil.cpu_count(logical=True)
        info["cpu"]["percent"] = psutil.cpu_percent(interval=0.1)
        info["cpu"]["percent_per_core"] = psutil.cpu_percent(interval=0.1, percpu=True)
        
        # CPU 频率
        try:
            freq = psutil.cpu_freq()
            if freq:
                info["cpu"]["frequency"] = {
                    "current_mhz": freq.current,
                    "min_mhz": freq.min,
                    "max_mhz": freq.max,
                }
        except Exception:
            pass
        
        # 系统内存
        mem = psutil.virtual_memory()
        info["memory"]["total_gb"] = mem.total / (1024 ** 3)
        info["memory"]["available_gb"] = mem.available / (1024 ** 3)
        info["memory"]["used_gb"] = mem.used / (1024 ** 3)
        info["memory"]["percent"] = mem.percent
        
        # Swap 内存
        swap = psutil.swap_memory()
        info["memory"]["swap"] = {
            "total_gb": swap.total / (1024 ** 3),
            "used_gb": swap.used / (1024 ** 3),
            "percent": swap.percent,
        }
        
        # 当前进程信息
        process = psutil.Process()
        with process.oneshot():
            info["process"]["pid"] = process.pid
            info["process"]["memory_gb"] = process.memory_info().rss / (1024 ** 3)
            info["process"]["memory_percent"] = process.memory_percent()
            info["process"]["cpu_percent"] = process.cpu_percent()
            info["process"]["threads"] = process.num_threads()
            info["process"]["create_time"] = process.create_time()
        
        # 磁盘信息
        try:
            disk = psutil.disk_usage("/")
            info["disk"] = {
                "total_gb": disk.total / (1024 ** 3),
                "used_gb": disk.used / (1024 ** 3),
                "free_gb": disk.free / (1024 ** 3),
                "percent": disk.percent,
            }
        except Exception:
            pass
        
        # 系统启动时间
        info["boot_time"] = psutil.boot_time()
        
    except ImportError:
        logger.warning("psutil 未安装，无法获取详细系统信息")
    except Exception as e:
        logger.warning(f"获取系统信息失败: {e}")
    
    # PyTorch 信息
    info["pytorch"] = {
        "version": torch.__version__,
        "cuda_available": torch.cuda.is_available(),
        "cuda_version": torch.version.cuda if torch.cuda.is_available() else None,
        "cudnn_version": torch.backends.cudnn.version() if torch.cuda.is_available() else None,
        "cudnn_enabled": torch.backends.cudnn.enabled if torch.cuda.is_available() else False,
    }
    
    return info
