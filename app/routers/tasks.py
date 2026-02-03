"""
任务管理路由模块

提供任务状态查询、结果获取、历史记录查询等接口
"""

from datetime import datetime
from typing import Any, Dict, Optional
import math

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import FileResponse

from ..models.database import User
from ..services import get_task_queue, TaskStatus
from ..services.auth import get_current_user, get_current_active_admin_user
from ..services.task_history import (
    get_user_task_history,
    get_all_task_history,
    get_user_task_statistics,
    get_global_task_statistics,
    get_user_quota_info,
    get_task_history_by_id,
    cleanup_old_task_history,
)
from ..schemas import TaskHistoryListResponse, TaskStatistics, UserQuotaResponse
from ..utils.logger import get_logger

logger = get_logger(__name__)
router = APIRouter(prefix="/tasks", tags=["任务管理"])


@router.get("/queue")
async def get_queue_info(
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    """
    获取任务队列信息
    
    返回队列状态、GPU数量、并行度、各状态任务数量等
    统计数据仅针对当前用户
    """
    task_queue = get_task_queue()
    return task_queue.get_queue_info(user_id=current_user.id)


@router.get("/history/me", response_model=TaskHistoryListResponse)
async def get_my_task_history(
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(20, ge=1, le=100, description="每页数量"),
    status: Optional[str] = Query(None, description="状态过滤"),
    task_type: Optional[str] = Query(None, description="任务类型过滤"),
    start_date: Optional[datetime] = Query(None, description="开始日期"),
    end_date: Optional[datetime] = Query(None, description="结束日期"),
    current_user: User = Depends(get_current_user),
) -> TaskHistoryListResponse:
    """
    获取当前用户的任务历史记录
    
    - **page**: 页码，从1开始
    - **page_size**: 每页数量，最大100
    - **status**: 状态过滤（pending/running/completed/failed/cancelled）
    - **task_type**: 任务类型过滤（text_to_image/image_edit/batch_edit）
    - **start_date**: 开始日期
    - **end_date**: 结束日期
    """
    items, total = await get_user_task_history(
        user_id=current_user.id,
        page=page,
        page_size=page_size,
        status=status,
        task_type=task_type,
        start_date=start_date,
        end_date=end_date,
    )
    
    total_pages = math.ceil(total / page_size) if total > 0 else 1
    
    return TaskHistoryListResponse(
        items=[item.to_dict() for item in items],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )


@router.get("/history/all", response_model=TaskHistoryListResponse)
async def get_all_tasks_history(
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(20, ge=1, le=100, description="每页数量"),
    status: Optional[str] = Query(None, description="状态过滤"),
    task_type: Optional[str] = Query(None, description="任务类型过滤"),
    user_id: Optional[int] = Query(None, description="用户ID过滤"),
    start_date: Optional[datetime] = Query(None, description="开始日期"),
    end_date: Optional[datetime] = Query(None, description="结束日期"),
    current_user: User = Depends(get_current_active_admin_user),
) -> TaskHistoryListResponse:
    """
    获取所有任务历史记录（管理员）
    
    - **page**: 页码，从1开始
    - **page_size**: 每页数量，最大100
    - **status**: 状态过滤（pending/running/completed/failed/cancelled）
    - **task_type**: 任务类型过滤（text_to_image/image_edit/batch_edit）
    - **user_id**: 用户ID过滤
    - **start_date**: 开始日期
    - **end_date**: 结束日期
    """
    items, total = await get_all_task_history(
        page=page,
        page_size=page_size,
        status=status,
        task_type=task_type,
        user_id=user_id,
        start_date=start_date,
        end_date=end_date,
    )
    
    total_pages = math.ceil(total / page_size) if total > 0 else 1
    
    return TaskHistoryListResponse(
        items=[item.to_dict() for item in items],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )


@router.get("/statistics/me", response_model=TaskStatistics)
async def get_my_statistics(
    current_user: User = Depends(get_current_user),
) -> TaskStatistics:
    """
    获取当前用户的任务统计信息
    
    返回任务数量统计、执行时间统计等
    """
    stats = await get_user_task_statistics(current_user.id)
    return TaskStatistics(**stats)


@router.get("/statistics/global", response_model=TaskStatistics)
async def get_global_statistics(
    current_user: User = Depends(get_current_active_admin_user),
) -> Dict[str, Any]:
    """
    获取全局任务统计信息（管理员）
    
    返回全局任务数量统计、活跃用户数等
    """
    stats = await get_global_task_statistics()
    return stats


@router.get("/quota/me", response_model=UserQuotaResponse)
async def get_my_quota(
    current_user: User = Depends(get_current_user),
) -> UserQuotaResponse:
    """
    获取当前用户的配额信息
    
    返回每日/每月限额、已用量、剩余量等
    """
    quota_info = await get_user_quota_info(current_user.id)
    return UserQuotaResponse(**quota_info)


@router.get("/history/{task_id}")
async def get_task_history_detail(
    task_id: str,
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    """
    获取任务历史详情
    
    - **task_id**: 任务ID
    
    返回任务的完整信息，包括参数、结果路径等
    """
    task_history = await get_task_history_by_id(task_id)
    
    if not task_history:
        raise HTTPException(status_code=404, detail="任务历史记录不存在")
    
    # 检查权限：只能查看自己的任务或管理员可以查看所有
    if task_history.user_id != current_user.id and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="无权查看此任务")
    
    return task_history.to_dict()


@router.get("/{task_id}")
async def get_task_status(
    task_id: str,
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    """
    获取任务状态
    
    - **task_id**: 任务ID（提交任务时返回）
    
    返回任务的详细状态信息，包括：
    - status: 任务状态（pending/running/completed/failed/cancelled）
    - position_in_queue: 在队列中的位置（仅等待中的任务）
    - wait_time_seconds: 等待时间
    - execution_time_seconds: 执行时间
    """
    task_queue = get_task_queue()
    task_result = await task_queue.get_task_status(task_id)
    
    if task_result:
        return task_result.to_dict()
    
    # 内存中没有，尝试从数据库获取
    task_history = await get_task_history_by_id(task_id)
    
    if not task_history:
        raise HTTPException(status_code=404, detail="任务不存在")
    
    # 检查权限
    if task_history.user_id != current_user.id and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="无权查看此任务")
    
    return task_history.to_dict()


@router.get("/{task_id}/result")
async def get_task_result(
    task_id: str,
    wait: bool = Query(False, description="是否等待任务完成"),
    timeout: float = Query(300.0, description="等待超时时间（秒）"),
    current_user: User = Depends(get_current_user),
) -> Any:
    """
    获取任务结果
    
    - **task_id**: 任务ID
    - **wait**: 是否等待任务完成
    - **timeout**: 等待超时时间（秒），默认300秒
    
    如果任务已完成，返回结果文件；
    如果任务未完成且 wait=False，返回当前状态；
    如果任务未完成且 wait=True，等待任务完成后返回结果。
    """
    import os
    
    task_queue = get_task_queue()
    
    if wait:
        task_result = await task_queue.get_task_result(task_id, timeout=timeout)
    else:
        task_result = await task_queue.get_task_status(task_id)
    
    # 优先使用内存中的任务结果
    if task_result:
        # 任务未完成
        if task_result.status == TaskStatus.PENDING:
            return {
                "status": "pending",
                "message": "任务等待中",
                "position_in_queue": task_result.position_in_queue,
            }
        
        if task_result.status == TaskStatus.RUNNING:
            return {
                "status": "running",
                "message": "任务执行中",
            }
        
        # 任务失败
        if task_result.status == TaskStatus.FAILED:
            raise HTTPException(
                status_code=500, 
                detail=f"任务执行失败: {task_result.error}"
            )
        
        # 任务已取消
        if task_result.status == TaskStatus.CANCELLED:
            raise HTTPException(status_code=400, detail="任务已取消")
        
        # 任务已完成，返回结果
        result = task_result.result
        
        if isinstance(result, dict) and "file_path" in result:
            file_path = result["file_path"]
            media_type = result.get("media_type", "application/octet-stream")
            filename = result.get("filename", "result")
            
            if os.path.exists(file_path):
                return FileResponse(
                    file_path,
                    media_type=media_type,
                    filename=filename,
                )
        
        # 返回其他类型的结果
        return {
            "status": "completed",
            "result": result,
        }
    
    # 内存中没有，尝试从数据库获取（重启后的历史任务）
    task_history = await get_task_history_by_id(task_id)
    
    if not task_history:
        raise HTTPException(status_code=404, detail="任务不存在")
    
    # 检查权限
    if task_history.user_id != current_user.id and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="无权查看此任务")
    
    # 根据数据库中的状态返回
    if task_history.status == "pending":
        return {
            "status": "pending",
            "message": "任务等待中（历史记录）",
        }
    
    if task_history.status == "running":
        return {
            "status": "running",
            "message": "任务执行中（历史记录）",
        }
    
    if task_history.status == "failed":
        raise HTTPException(
            status_code=500,
            detail=f"任务执行失败: {task_history.error_message or '未知错误'}"
        )
    
    if task_history.status == "cancelled":
        raise HTTPException(status_code=400, detail="任务已取消")
    
    # 任务已完成，尝试返回文件
    if task_history.status == "completed" and task_history.result_path:
        file_path = task_history.result_path
        
        if os.path.exists(file_path):
            # 根据文件扩展名判断媒体类型
            if file_path.endswith(".zip"):
                media_type = "application/zip"
            else:
                media_type = "image/png"
            
            filename = task_history.result_filename or os.path.basename(file_path)
            
            return FileResponse(
                file_path,
                media_type=media_type,
                filename=filename,
            )
        else:
            logger.warning(f"任务 {task_id} 的结果文件不存在: {file_path}")
            raise HTTPException(
                status_code=404,
                detail=f"结果文件不存在（可能已被清理）"
            )
    
    # 没有结果文件
    return {
        "status": "completed",
        "message": "任务已完成，但无可用结果文件",
    }


@router.delete("/{task_id}")
async def cancel_task(
    task_id: str,
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    """
    取消任务
    
    - **task_id**: 任务ID
    
    注意：只能取消等待中的任务，已开始执行的任务无法取消
    """
    task_queue = get_task_queue()
    
    task_result = await task_queue.get_task_status(task_id)
    if not task_result:
        raise HTTPException(status_code=404, detail="任务不存在")
    
    if task_result.status != TaskStatus.PENDING:
        raise HTTPException(
            status_code=400, 
            detail=f"无法取消状态为 {task_result.status.value} 的任务"
        )
    
    success = await task_queue.cancel_task(task_id)
    
    if not success:
        raise HTTPException(status_code=400, detail="取消任务失败")
    
    return {"message": "任务已取消", "task_id": task_id}


@router.post("/cleanup")
async def cleanup_tasks(
    max_age_hours: int = Query(24, description="清理超过指定小时数的已完成任务（内存）"),
    max_age_days: int = Query(30, description="清理超过指定天数的已完成任务（数据库）"),
    current_user: User = Depends(get_current_active_admin_user),
) -> Dict[str, Any]:
    """
    清理旧任务记录（管理员）
    
    - **max_age_hours**: 清理内存中超过指定小时数的已完成任务，默认24小时
    - **max_age_days**: 清理数据库中超过指定天数的已完成任务，默认30天
    
    清理已完成、失败或取消的旧任务记录以释放内存和存储空间
    """
    task_queue = get_task_queue()
    
    # 清理内存中的任务记录
    memory_cleaned = task_queue.cleanup_old_tasks(max_age_hours=max_age_hours)
    
    # 清理数据库中的任务历史
    db_cleaned = await cleanup_old_task_history(days=max_age_days)
    
    return {
        "message": f"已清理 {memory_cleaned} 个内存任务记录，{db_cleaned} 个数据库历史记录",
        "memory_cleaned_count": memory_cleaned,
        "db_cleaned_count": db_cleaned,
    }
