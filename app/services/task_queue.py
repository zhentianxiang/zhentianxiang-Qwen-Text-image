"""
任务队列管理模块

实现基于 GPU 数量的任务调度：
- 单 GPU：任务排队执行
- 多 GPU：根据 GPU 数量并行执行

支持任务持久化到数据库
"""

import asyncio
import gc
import uuid
import time
import json
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Callable, Dict, List, Optional, Union
from datetime import datetime, timedelta

import torch

from ..config import settings
from ..utils.logger import get_logger
from ..utils.memory_utils import cleanup_memory, log_memory_status

logger = get_logger(__name__)


class TaskStatus(str, Enum):
    """任务状态"""
    PENDING = "pending"       # 等待中
    RUNNING = "running"       # 运行中
    COMPLETED = "completed"   # 已完成
    FAILED = "failed"         # 失败
    CANCELLED = "cancelled"   # 已取消


class TaskType(str, Enum):
    """任务类型"""
    TEXT_TO_IMAGE = "text_to_image"
    IMAGE_EDIT = "image_edit"
    BATCH_EDIT = "batch_edit"


@dataclass
class TaskResult:
    """任务结果"""
    task_id: str
    status: TaskStatus
    result: Any = None
    error: Optional[str] = None
    created_at: datetime = field(default_factory=datetime.now)
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    position_in_queue: int = 0  # 队列中的位置
    
    # 新增字段用于数据库持久化
    task_type: Optional[str] = None
    prompt: Optional[str] = None
    negative_prompt: Optional[str] = None
    parameters: Optional[Dict[str, Any]] = None
    user_id: Optional[int] = None
    result_path: Optional[str] = None
    result_filename: Optional[str] = None
    
    def to_dict(self) -> Dict[str, Any]:
        """转换为字典"""
        return {
            "task_id": self.task_id,
            "status": self.status.value,
            "error": self.error,
            "created_at": self.created_at.isoformat(),
            "started_at": self.started_at.isoformat() if self.started_at else None,
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
            "position_in_queue": self.position_in_queue,
            "wait_time_seconds": (
                (self.started_at - self.created_at).total_seconds()
                if self.started_at else None
            ),
            "execution_time_seconds": (
                (self.completed_at - self.started_at).total_seconds()
                if self.completed_at and self.started_at else None
            ),
            "task_type": self.task_type,
            "result_path": self.result_path,
            "result_filename": self.result_filename,
        }


@dataclass
class Task:
    """任务对象"""
    task_id: str
    func: Callable
    args: tuple = ()
    kwargs: dict = field(default_factory=dict)
    priority: int = 0  # 优先级，数字越小优先级越高
    created_at: datetime = field(default_factory=datetime.now)
    gpu_id: Optional[int] = None  # 指定 GPU
    
    # 用于数据库持久化的元数据
    task_type: Optional[str] = None
    prompt: Optional[str] = None
    negative_prompt: Optional[str] = None
    parameters: Optional[Dict[str, Any]] = None
    user_id: Optional[int] = None


class TaskQueue:
    """
    任务队列管理器
    
    支持根据 GPU 数量自动调整并行度：
    - 单 GPU 时，任务按顺序执行
    - 多 GPU 时，可并行执行多个任务
    
    支持任务持久化到数据库
    """
    
    _instance: Optional["TaskQueue"] = None
    
    def __new__(cls) -> "TaskQueue":
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialized = False
        return cls._instance
    
    def __init__(self):
        if self._initialized:
            return
        
        self._queue: asyncio.Queue[Task] = None
        self._tasks: Dict[str, TaskResult] = {}
        self._executor: Optional[ThreadPoolExecutor] = None
        self._workers: List[asyncio.Task] = []
        self._running = False
        self._lock = asyncio.Lock()
        
        # GPU 相关
        self._gpu_count = torch.cuda.device_count() if torch.cuda.is_available() else 0
        
        # 确定最大工作者数量
        configured_workers = settings.task_queue.max_workers
        if configured_workers > 0:
            # 使用配置的值
            self._max_workers = configured_workers
        else:
            # 自动检测：有GPU用GPU数量，没有GPU用1
            self._max_workers = max(1, self._gpu_count) if self._gpu_count > 0 else 1
        
        # GPU 使用状态锁（每个 GPU 一个信号量）
        self._gpu_semaphores: Dict[int, asyncio.Semaphore] = {}
        
        self._initialized = True
        logger.info(f"任务队列初始化 | GPU数量: {self._gpu_count} | 最大并行数: {self._max_workers}")
    
    @property
    def gpu_count(self) -> int:
        """GPU 数量"""
        return self._gpu_count
    
    @property
    def max_workers(self) -> int:
        """最大并行工作者数量"""
        return self._max_workers
    
    @property
    def is_running(self) -> bool:
        """队列是否在运行"""
        return self._running
    
    @property
    def queue_size(self) -> int:
        """队列中等待的任务数量"""
        return self._queue.qsize() if self._queue else 0
    
    @property
    def active_tasks_count(self) -> int:
        """当前正在执行的任务数量"""
        return sum(
            1 for t in self._tasks.values() 
            if t.status == TaskStatus.RUNNING
        )
    
    async def start(self) -> None:
        """启动任务队列"""
        if self._running:
            logger.warning("任务队列已在运行")
            return
        
        self._queue = asyncio.Queue()
        self._executor = ThreadPoolExecutor(
            max_workers=self._max_workers,
            thread_name_prefix="inference_worker"
        )
        
        # 为每个 GPU 创建信号量（限制同时只有一个任务使用该 GPU）
        for i in range(max(1, self._gpu_count)):
            self._gpu_semaphores[i] = asyncio.Semaphore(1)
        
        # 启动工作协程
        self._running = True
        for i in range(self._max_workers):
            worker = asyncio.create_task(self._worker(i))
            self._workers.append(worker)
        
        logger.info(f"任务队列已启动 | 工作者数量: {self._max_workers}")
    
    async def stop(self) -> None:
        """停止任务队列"""
        if not self._running:
            return
        
        self._running = False
        
        # 取消所有工作协程
        for worker in self._workers:
            worker.cancel()
        
        # 等待工作协程结束
        for worker in self._workers:
            try:
                await worker
            except asyncio.CancelledError:
                pass
        
        self._workers.clear()
        
        # 关闭线程池
        if self._executor:
            self._executor.shutdown(wait=True)
            self._executor = None
        
        logger.info("任务队列已停止")
    
    async def _worker(self, worker_id: int) -> None:
        """
        工作协程
        
        从队列中取任务并执行
        """
        gpu_id = worker_id % max(1, self._gpu_count)
        logger.info(f"工作者 {worker_id} 启动 | 分配GPU: {gpu_id if self._gpu_count > 0 else 'CPU'}")
        
        while self._running:
            try:
                # 从队列获取任务（带超时）
                try:
                    task = await asyncio.wait_for(
                        self._queue.get(), 
                        timeout=1.0
                    )
                except asyncio.TimeoutError:
                    continue
                
                # 获取 GPU 信号量
                semaphore = self._gpu_semaphores.get(gpu_id)
                if semaphore:
                    await semaphore.acquire()
                
                try:
                    await self._execute_task(task, gpu_id)
                finally:
                    if semaphore:
                        semaphore.release()
                    self._queue.task_done()
                
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"工作者 {worker_id} 发生错误: {e}")
    
    async def _execute_task(self, task: Task, gpu_id: int) -> None:
        """执行任务"""
        task_result = self._tasks.get(task.task_id)
        if not task_result:
            return
        
        # 更新状态为运行中
        task_result.status = TaskStatus.RUNNING
        task_result.started_at = datetime.now()
        
        # 更新数据库状态
        await self._update_task_in_db(task.task_id, status="running", started_at=task_result.started_at)
        
        logger.info(f"开始执行任务 {task.task_id} | GPU: {gpu_id if self._gpu_count > 0 else 'CPU'} | Mode: {settings.task_queue.execution_mode}")
        
        try:
            result = None
            
            # 模式 1: 独立进程模式 (彻底释放内存)
            if settings.task_queue.execution_mode == "process":
                import sys
                import json
                import tempfile
                import os
                
                # 准备参数文件
                # 注入 GPU ID 到参数中
                if self._gpu_count > 0:
                    task.kwargs["_gpu_id"] = gpu_id
                    
                # 创建临时参数文件
                with tempfile.NamedTemporaryFile(mode='w', delete=False, suffix='.json', encoding='utf-8') as tmp:
                    json.dump(task.kwargs, tmp)
                    args_file = tmp.name
                
                # 创建临时输出文件
                with tempfile.NamedTemporaryFile(mode='w', delete=False, suffix='.json', encoding='utf-8') as tmp_out:
                    output_file = tmp_out.name

                try:
                    # 构建命令
                    cmd = [
                        sys.executable,
                        "-m", "app.inference_worker",
                        "--task-type", task.task_type or "text_to_image", # 默认为 text_to_image 如果未指定
                        "--args-file", args_file,
                        "--output-file", output_file
                    ]
                    
                    logger.debug(f"Executing subprocess: {' '.join(cmd)}")
                    
                    # 运行子进程
                    proc = await asyncio.create_subprocess_exec(
                        *cmd,
                        stdout=asyncio.subprocess.PIPE,
                        stderr=asyncio.subprocess.PIPE
                    )
                    
                    logger.info(f"Worker subprocess started | PID: {proc.pid} | Task: {task.task_id}")
                    
                    stdout, stderr = await proc.communicate()
                    
                    logger.info(f"Worker subprocess finished | PID: {proc.pid} | Return Code: {proc.returncode}")
                    
                    if proc.returncode != 0:
                        error_msg = stderr.decode().strip()
                        logger.error(f"Worker process failed (code {proc.returncode}): {error_msg}")
                        raise RuntimeError(f"Worker process error: {error_msg}")
                        
                    # 读取输出文件
                    try:
                        with open(output_file, 'r', encoding='utf-8') as f:
                            content = f.read().strip()
                            if not content:
                                raise ValueError("Empty output file")
                            worker_output = json.loads(content)
                    except Exception as e:
                        logger.error(f"Failed to read/parse worker output from {output_file}: {e}")
                        # 尝试从 stdout/stderr 获取更多信息
                        logger.error(f"STDOUT: {stdout.decode().strip()}")
                        logger.error(f"STDERR: {stderr.decode().strip()}")
                        raise RuntimeError(f"Failed to get result from worker: {e}")
                        
                    if worker_output.get("status") == "failed":
                        raise RuntimeError(worker_output.get("error", "Unknown worker error"))
                        
                    result = worker_output.get("result")
                    
                finally:
                    # 清理临时文件
                    if os.path.exists(args_file):
                        os.unlink(args_file)
                    if os.path.exists(output_file):
                        os.unlink(output_file)

            # 模式 2: 线程池模式 (默认, 响应快但内存不释放)
            else:
                # 在线程池中执行推理任务（避免阻塞事件循环）
                loop = asyncio.get_event_loop()
                
                # 设置当前任务使用的 GPU
                if self._gpu_count > 0:
                    task.kwargs["_gpu_id"] = gpu_id
                
                result = await loop.run_in_executor(
                    self._executor,
                    lambda: task.func(*task.args, **task.kwargs)
                )
            
            # 更新状态为完成
            task_result.status = TaskStatus.COMPLETED
            task_result.result = result
            task_result.completed_at = datetime.now()
            
            # 提取结果路径和文件名
            result_path = None
            result_filename = None
            if isinstance(result, dict):
                # 支持多种键名: file_path, path, output_path
                result_path = result.get("file_path") or result.get("path") or result.get("output_path")
                result_filename = result.get("filename")
            elif isinstance(result, str):
                result_path = result
                import os
                result_filename = os.path.basename(result)
            
            task_result.result_path = result_path
            task_result.result_filename = result_filename
            
            # 计算执行时间
            execution_time = (task_result.completed_at - task_result.started_at).total_seconds()
            
            # 更新数据库
            await self._update_task_in_db(
                task.task_id,
                status="completed",
                completed_at=task_result.completed_at,
                result_path=result_path,
                result_filename=result_filename,
                execution_time=execution_time
            )
            
            logger.info(f"任务 {task.task_id} 执行成功")
            
        except Exception as e:
            # 更新状态为失败
            task_result.status = TaskStatus.FAILED
            task_result.error = str(e)
            task_result.completed_at = datetime.now()
            
            # 计算执行时间
            execution_time = None
            if task_result.started_at:
                execution_time = (task_result.completed_at - task_result.started_at).total_seconds()
            
            # 更新数据库
            await self._update_task_in_db(
                task.task_id,
                status="failed",
                completed_at=task_result.completed_at,
                error_message=str(e),
                execution_time=execution_time
            )
            
            logger.error(f"任务 {task.task_id} 执行失败: {e}")
        
        finally:
            # 任务执行完成后强制清理内存（额外保障）
            try:
                gc.collect()
                if torch.cuda.is_available():
                    torch.cuda.empty_cache()
                    # 同步确保内存完全释放
                    torch.cuda.synchronize()
                log_memory_status(f"[任务队列] 任务 {task.task_id[:8]} 完成后")
            except Exception as cleanup_error:
                logger.warning(f"内存清理时发生警告: {cleanup_error}")
    
    async def _save_task_to_db(
        self,
        task_id: str,
        task_type: str,
        prompt: str,
        user_id: Optional[int] = None,
        negative_prompt: Optional[str] = None,
        parameters: Optional[Dict[str, Any]] = None,
    ) -> None:
        """保存任务到数据库"""
        try:
            from ..models.database import get_db_session, TaskHistory
            
            async with get_db_session() as db:
                task_history = TaskHistory(
                    task_id=task_id,
                    user_id=user_id,
                    task_type=task_type,
                    prompt=prompt,
                    negative_prompt=negative_prompt,
                    status="pending",
                )
                if parameters:
                    task_history.set_parameters(parameters)
                
                db.add(task_history)
                await db.commit()
                
            logger.debug(f"任务 {task_id} 已保存到数据库")
            
        except Exception as e:
            logger.error(f"保存任务到数据库失败: {e}")
    
    async def _update_task_in_db(
        self,
        task_id: str,
        status: Optional[str] = None,
        started_at: Optional[datetime] = None,
        completed_at: Optional[datetime] = None,
        result_path: Optional[str] = None,
        result_filename: Optional[str] = None,
        error_message: Optional[str] = None,
        execution_time: Optional[float] = None,
    ) -> None:
        """更新数据库中的任务状态"""
        try:
            from ..models.database import get_db_session, TaskHistory
            from sqlalchemy import select
            
            async with get_db_session() as db:
                result = await db.execute(
                    select(TaskHistory).where(TaskHistory.task_id == task_id)
                )
                task_history = result.scalar_one_or_none()
                
                if task_history:
                    if status is not None:
                        task_history.status = status
                    if started_at is not None:
                        task_history.started_at = started_at
                    if completed_at is not None:
                        task_history.completed_at = completed_at
                    if result_path is not None:
                        task_history.result_path = result_path
                    if result_filename is not None:
                        task_history.result_filename = result_filename
                    if error_message is not None:
                        task_history.error_message = error_message
                    if execution_time is not None:
                        task_history.execution_time = execution_time
                    
                    await db.commit()
                    logger.debug(f"任务 {task_id} 数据库状态已更新")
                    
        except Exception as e:
            logger.error(f"更新数据库任务状态失败: {e}")
    
    async def submit(
        self,
        func: Callable,
        *args,
        priority: int = 0,
        _task_type: Optional[str] = None,
        _prompt: Optional[str] = None,
        _negative_prompt: Optional[str] = None,
        _parameters: Optional[Dict[str, Any]] = None,
        _user_id: Optional[int] = None,
        **kwargs
    ) -> str:
        """
        提交任务到队列
        
        Args:
            func: 要执行的函数
            *args: 位置参数
            priority: 优先级（暂未实现优先级队列）
            _task_type: 任务类型（元数据，以 _ 开头避免与函数参数冲突）
            _prompt: 提示词（元数据）
            _negative_prompt: 负面提示词（元数据）
            _parameters: 其他参数（元数据）
            _user_id: 用户 ID（元数据）
            **kwargs: 关键字参数（传递给执行函数）
        
        Returns:
            任务 ID
        """
        if not self._running:
            raise RuntimeError("任务队列未启动")
        
        task_id = str(uuid.uuid4())
        
        # 如果未提供元数据，尝试从 kwargs 中提取
        task_type = _task_type
        prompt = _prompt or kwargs.get("prompt")
        negative_prompt = _negative_prompt or kwargs.get("negative_prompt")
        parameters = _parameters
        user_id = _user_id
        
        task = Task(
            task_id=task_id,
            func=func,
            args=args,
            kwargs=kwargs,
            priority=priority,
            task_type=task_type,
            prompt=prompt,
            negative_prompt=negative_prompt,
            parameters=parameters,
            user_id=user_id,
        )
        
        # 创建任务结果记录
        task_result = TaskResult(
            task_id=task_id,
            status=TaskStatus.PENDING,
            position_in_queue=self._queue.qsize() + 1,
            task_type=task_type,
            prompt=prompt,
            negative_prompt=negative_prompt,
            parameters=parameters,
            user_id=user_id,
        )
        
        async with self._lock:
            self._tasks[task_id] = task_result
            await self._queue.put(task)
        
        # 保存任务到数据库
        if task_type and prompt:
            await self._save_task_to_db(
                task_id=task_id,
                task_type=task_type,
                prompt=prompt,
                user_id=user_id,
                negative_prompt=negative_prompt,
                parameters=parameters,
            )
        
        logger.info(f"任务已提交 {task_id} | 队列位置: {task_result.position_in_queue}")
        
        return task_id
    
    async def get_task_status(self, task_id: str) -> Optional[TaskResult]:
        """获取任务状态"""
        task_result = self._tasks.get(task_id)
        if task_result and task_result.status == TaskStatus.PENDING:
            # 更新队列位置
            task_result.position_in_queue = await self._get_queue_position(task_id)
        return task_result
    
    async def _get_queue_position(self, task_id: str) -> int:
        """获取任务在队列中的位置（近似值）"""
        # 简化实现：返回当前等待中的任务数量
        pending_count = sum(
            1 for t in self._tasks.values()
            if t.status == TaskStatus.PENDING
        )
        return pending_count
    
    async def get_task_result(
        self, 
        task_id: str, 
        timeout: Optional[float] = None
    ) -> Optional[TaskResult]:
        """
        获取任务结果
        
        Args:
            task_id: 任务 ID
            timeout: 超时时间（秒）
        
        Returns:
            任务结果，如果任务不存在返回 None
        """
        start_time = time.time()
        
        while True:
            task_result = self._tasks.get(task_id)
            
            if not task_result:
                return None
            
            if task_result.status in (
                TaskStatus.COMPLETED, 
                TaskStatus.FAILED, 
                TaskStatus.CANCELLED
            ):
                return task_result
            
            if timeout and (time.time() - start_time) > timeout:
                return task_result
            
            await asyncio.sleep(0.5)
    
    async def cancel_task(self, task_id: str) -> bool:
        """
        取消任务
        
        注意：只能取消等待中的任务，已开始执行的任务无法取消
        """
        async with self._lock:
            task_result = self._tasks.get(task_id)
            
            if not task_result:
                return False
            
            if task_result.status != TaskStatus.PENDING:
                return False
            
            task_result.status = TaskStatus.CANCELLED
            task_result.completed_at = datetime.now()
            
            # 更新数据库
            await self._update_task_in_db(
                task_id,
                status="cancelled",
                completed_at=task_result.completed_at
            )
        
        logger.info(f"任务 {task_id} 已取消")
        return True
    
    def get_queue_info(self, user_id: Optional[int] = None) -> Dict[str, Any]:
        """
        获取队列信息
        
        Args:
            user_id: 可选的用户ID，如果提供则只统计该用户的任务
        """
        # 如果指定了用户，只统计该用户的任务
        if user_id is not None:
            tasks_to_count = [t for t in self._tasks.values() if t.user_id == user_id]
        else:
            tasks_to_count = self._tasks.values()

        pending = sum(1 for t in tasks_to_count if t.status == TaskStatus.PENDING)
        running = sum(1 for t in tasks_to_count if t.status == TaskStatus.RUNNING)
        completed = sum(1 for t in tasks_to_count if t.status == TaskStatus.COMPLETED)
        failed = sum(1 for t in tasks_to_count if t.status == TaskStatus.FAILED)
        
        # queue_size 仍然返回全局排队数量，因为它反映了系统繁忙程度
        # 但 tasks 字典中的统计数据是针对特定用户的
        
        return {
            "is_running": self._running,
            "gpu_count": self._gpu_count,
            "max_workers": self._max_workers,
            "queue_size": self.queue_size, # 全局队列长度
            "tasks": {
                "pending": pending,
                "running": running,
                "completed": completed,
                "failed": failed,
                "total": len(tasks_to_count),
            }
        }
    
    def cleanup_old_tasks(self, max_age_hours: int = 24) -> int:
        """
        清理旧任务记录（内存中）
        
        Args:
            max_age_hours: 最大保留时间（小时）
        
        Returns:
            清理的任务数量
        """
        cutoff = datetime.now() - timedelta(hours=max_age_hours)
        cleaned = 0
        
        task_ids_to_remove = []
        for task_id, task_result in self._tasks.items():
            if task_result.status in (
                TaskStatus.COMPLETED, 
                TaskStatus.FAILED, 
                TaskStatus.CANCELLED
            ):
                if task_result.completed_at and task_result.completed_at < cutoff:
                    task_ids_to_remove.append(task_id)
        
        for task_id in task_ids_to_remove:
            del self._tasks[task_id]
            cleaned += 1
        
        if cleaned > 0:
            logger.info(f"清理了 {cleaned} 个旧任务记录（内存）")
        
        return cleaned


# 全局单例
_task_queue: Optional[TaskQueue] = None


def get_task_queue() -> TaskQueue:
    """获取任务队列单例"""
    global _task_queue
    if _task_queue is None:
        _task_queue = TaskQueue()
    return _task_queue
