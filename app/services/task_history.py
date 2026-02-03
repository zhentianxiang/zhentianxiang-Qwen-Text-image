"""
任务历史服务

提供任务历史记录的查询、统计等功能
"""

from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any, Tuple

from sqlalchemy import select, func, and_, desc
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.database import TaskHistory, UserQuota, get_db_session
from ..utils.logger import get_logger

logger = get_logger(__name__)


async def get_task_history_by_id(task_id: str) -> Optional[TaskHistory]:
    """根据任务ID获取任务历史记录"""
    async with get_db_session() as db:
        result = await db.execute(
            select(TaskHistory).where(TaskHistory.task_id == task_id)
        )
        return result.scalar_one_or_none()


async def get_user_task_history(
    user_id: int,
    page: int = 1,
    page_size: int = 20,
    status: Optional[str] = None,
    task_type: Optional[str] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
) -> Tuple[List[TaskHistory], int]:
    """
    获取用户的任务历史记录
    
    Args:
        user_id: 用户ID
        page: 页码
        page_size: 每页数量
        status: 状态过滤
        task_type: 任务类型过滤
        start_date: 开始日期
        end_date: 结束日期
    
    Returns:
        (任务列表, 总数)
    """
    async with get_db_session() as db:
        # 构建查询条件
        conditions = [TaskHistory.user_id == user_id]
        
        if status:
            conditions.append(TaskHistory.status == status)
        if task_type:
            conditions.append(TaskHistory.task_type == task_type)
        if start_date:
            conditions.append(TaskHistory.created_at >= start_date)
        if end_date:
            conditions.append(TaskHistory.created_at <= end_date)
        
        # 查询总数
        count_result = await db.execute(
            select(func.count(TaskHistory.id)).where(and_(*conditions))
        )
        total = count_result.scalar()
        
        # 查询数据
        offset = (page - 1) * page_size
        result = await db.execute(
            select(TaskHistory)
            .where(and_(*conditions))
            .order_by(desc(TaskHistory.created_at))
            .offset(offset)
            .limit(page_size)
        )
        items = result.scalars().all()
        
        return list(items), total


async def get_all_task_history(
    page: int = 1,
    page_size: int = 20,
    status: Optional[str] = None,
    task_type: Optional[str] = None,
    user_id: Optional[int] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
) -> Tuple[List[TaskHistory], int]:
    """
    获取所有任务历史记录（管理员用）
    
    Args:
        page: 页码
        page_size: 每页数量
        status: 状态过滤
        task_type: 任务类型过滤
        user_id: 用户ID过滤
        start_date: 开始日期
        end_date: 结束日期
    
    Returns:
        (任务列表, 总数)
    """
    async with get_db_session() as db:
        # 构建查询条件
        conditions = []
        
        if status:
            conditions.append(TaskHistory.status == status)
        if task_type:
            conditions.append(TaskHistory.task_type == task_type)
        if user_id is not None:
            conditions.append(TaskHistory.user_id == user_id)
        if start_date:
            conditions.append(TaskHistory.created_at >= start_date)
        if end_date:
            conditions.append(TaskHistory.created_at <= end_date)
        
        # 查询总数
        if conditions:
            count_result = await db.execute(
                select(func.count(TaskHistory.id)).where(and_(*conditions))
            )
        else:
            count_result = await db.execute(
                select(func.count(TaskHistory.id))
            )
        total = count_result.scalar()
        
        # 查询数据
        offset = (page - 1) * page_size
        query = select(TaskHistory).order_by(desc(TaskHistory.created_at)).offset(offset).limit(page_size)
        if conditions:
            query = query.where(and_(*conditions))
        
        result = await db.execute(query)
        items = result.scalars().all()
        
        return list(items), total


async def get_user_task_statistics(user_id: int) -> Dict[str, Any]:
    """
    获取用户的任务统计信息
    
    Args:
        user_id: 用户ID
    
    Returns:
        统计信息字典
    """
    async with get_db_session() as db:
        # 总任务数
        total_result = await db.execute(
            select(func.count(TaskHistory.id)).where(TaskHistory.user_id == user_id)
        )
        total_tasks = total_result.scalar()
        
        # 按状态统计
        status_stats = {}
        for status in ["pending", "running", "completed", "failed", "cancelled"]:
            result = await db.execute(
                select(func.count(TaskHistory.id)).where(
                    and_(
                        TaskHistory.user_id == user_id,
                        TaskHistory.status == status
                    )
                )
            )
            status_stats[status] = result.scalar()
        
        # 按任务类型统计
        type_stats = {}
        for task_type in ["text_to_image", "image_edit", "batch_edit"]:
            result = await db.execute(
                select(func.count(TaskHistory.id)).where(
                    and_(
                        TaskHistory.user_id == user_id,
                        TaskHistory.task_type == task_type
                    )
                )
            )
            type_stats[task_type] = result.scalar()
        
        # 平均执行时间
        avg_time_result = await db.execute(
            select(func.avg(TaskHistory.execution_time)).where(
                and_(
                    TaskHistory.user_id == user_id,
                    TaskHistory.execution_time.isnot(None)
                )
            )
        )
        avg_execution_time = avg_time_result.scalar()
        
        # 总执行时间
        total_time_result = await db.execute(
            select(func.sum(TaskHistory.execution_time)).where(
                and_(
                    TaskHistory.user_id == user_id,
                    TaskHistory.execution_time.isnot(None)
                )
            )
        )
        total_execution_time = total_time_result.scalar()
        
        return {
            "total_tasks": total_tasks,
            "completed_tasks": status_stats.get("completed", 0),
            "failed_tasks": status_stats.get("failed", 0),
            "pending_tasks": status_stats.get("pending", 0),
            "text_to_image_count": type_stats.get("text_to_image", 0),
            "image_edit_count": type_stats.get("image_edit", 0),
            "batch_edit_count": type_stats.get("batch_edit", 0),
            "avg_execution_time": float(avg_execution_time) if avg_execution_time else None,
            "total_execution_time": float(total_execution_time) if total_execution_time else None,
        }


async def get_global_task_statistics() -> Dict[str, Any]:
    """
    获取全局任务统计信息（管理员用）
    
    Returns:
        统计信息字典
    """
    async with get_db_session() as db:
        # 总任务数
        total_result = await db.execute(
            select(func.count(TaskHistory.id))
        )
        total_tasks = total_result.scalar()
        
        # 按状态统计
        status_stats = {}
        for status in ["pending", "running", "completed", "failed", "cancelled"]:
            result = await db.execute(
                select(func.count(TaskHistory.id)).where(TaskHistory.status == status)
            )
            status_stats[status] = result.scalar()
        
        # 按任务类型统计
        type_stats = {}
        for task_type in ["text_to_image", "image_edit", "batch_edit"]:
            result = await db.execute(
                select(func.count(TaskHistory.id)).where(TaskHistory.task_type == task_type)
            )
            type_stats[task_type] = result.scalar()
        
        # 平均执行时间
        avg_time_result = await db.execute(
            select(func.avg(TaskHistory.execution_time)).where(
                TaskHistory.execution_time.isnot(None)
            )
        )
        avg_execution_time = avg_time_result.scalar()
        
        # 总执行时间
        total_time_result = await db.execute(
            select(func.sum(TaskHistory.execution_time)).where(
                TaskHistory.execution_time.isnot(None)
            )
        )
        total_execution_time = total_time_result.scalar()
        
        # 今日任务数
        today_start = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
        today_result = await db.execute(
            select(func.count(TaskHistory.id)).where(TaskHistory.created_at >= today_start)
        )
        today_tasks = today_result.scalar()
        
        # 活跃用户数（有任务记录的用户）
        active_users_result = await db.execute(
            select(func.count(func.distinct(TaskHistory.user_id))).where(
                TaskHistory.user_id.isnot(None)
            )
        )
        active_users = active_users_result.scalar()
        
        return {
            "total_tasks": total_tasks,
            "completed_tasks": status_stats.get("completed", 0),
            "failed_tasks": status_stats.get("failed", 0),
            "pending_tasks": status_stats.get("pending", 0),
            "text_to_image_count": type_stats.get("text_to_image", 0),
            "image_edit_count": type_stats.get("image_edit", 0),
            "batch_edit_count": type_stats.get("batch_edit", 0),
            "avg_execution_time": float(avg_execution_time) if avg_execution_time else None,
            "total_execution_time": float(total_execution_time) if total_execution_time else None,
            "today_tasks": today_tasks,
            "active_users": active_users,
        }


async def get_or_create_user_quota(user_id: int) -> UserQuota:
    """获取或创建用户配额"""
    from ..config import settings
    
    async with get_db_session() as db:
        result = await db.execute(
            select(UserQuota).where(UserQuota.user_id == user_id)
        )
        quota = result.scalar_one_or_none()
        
        if not quota:
            quota = UserQuota(
                user_id=user_id,
                daily_limit=settings.quota.default_daily_limit,
                monthly_limit=settings.quota.default_monthly_limit,
            )
            db.add(quota)
            await db.commit()
            await db.refresh(quota)
        
        return quota


async def check_and_update_quota(user_id: int, count: int = 1) -> Tuple[bool, str, int]:
    """
    检查并更新用户配额
    
    Args:
        user_id: 用户ID
        count: 消耗的配额数量（默认1，按生成图片数量计算）
    
    Returns:
        (是否允许, 消息, 剩余今日配额)
    """
    from ..config import settings
    
    async with get_db_session() as db:
        result = await db.execute(
            select(UserQuota).where(UserQuota.user_id == user_id)
        )
        quota = result.scalar_one_or_none()
        
        if not quota:
            # 创建新配额，使用配置的默认值
            quota = UserQuota(
                user_id=user_id,
                daily_limit=settings.quota.default_daily_limit,
                monthly_limit=settings.quota.default_monthly_limit,
            )
            db.add(quota)
            await db.commit()
            await db.refresh(quota)
        
        now = datetime.now()
        
        # 检查是否需要重置每日计数
        if quota.last_daily_reset.date() < now.date():
            quota.used_today = 0
            quota.last_daily_reset = now
        
        # 检查是否需要重置每月计数
        if quota.last_monthly_reset.month != now.month or quota.last_monthly_reset.year != now.year:
            quota.used_this_month = 0
            quota.last_monthly_reset = now
        
        remaining_today = quota.daily_limit - quota.used_today if quota.daily_limit > 0 else -1
        remaining_month = quota.monthly_limit - quota.used_this_month if quota.monthly_limit > 0 else -1
        
        # 检查每日限额
        if quota.daily_limit > 0 and quota.used_today + count > quota.daily_limit:
            return False, f"配额不足：需要 {count} 次，今日剩余 {remaining_today} 次（每日限额 {quota.daily_limit}）", remaining_today
        
        # 检查每月限额
        if quota.monthly_limit > 0 and quota.used_this_month + count > quota.monthly_limit:
            return False, f"配额不足：需要 {count} 次，本月剩余 {remaining_month} 次（每月限额 {quota.monthly_limit}）", remaining_today
        
        # 更新使用量
        quota.used_today += count
        quota.used_this_month += count
        quota.total_used += count
        
        await db.commit()
        
        new_remaining = quota.daily_limit - quota.used_today if quota.daily_limit > 0 else -1
        return True, "OK", new_remaining


async def get_user_quota_info(user_id: int) -> Dict[str, Any]:
    """获取用户配额信息"""
    quota = await get_or_create_user_quota(user_id)
    
    now = datetime.now()
    
    # 计算剩余
    used_today = quota.used_today
    used_this_month = quota.used_this_month
    
    # 检查是否需要重置（只是计算，不实际重置）
    if quota.last_daily_reset.date() < now.date():
        used_today = 0
    if quota.last_monthly_reset.month != now.month or quota.last_monthly_reset.year != now.year:
        used_this_month = 0
    
    remaining_today = max(0, quota.daily_limit - used_today) if quota.daily_limit > 0 else -1
    remaining_this_month = max(0, quota.monthly_limit - used_this_month) if quota.monthly_limit > 0 else -1
    
    return {
        "user_id": user_id,
        "daily_limit": quota.daily_limit,
        "monthly_limit": quota.monthly_limit,
        "used_today": used_today,
        "used_this_month": used_this_month,
        "total_used": quota.total_used,
        "remaining_today": remaining_today,
        "remaining_this_month": remaining_this_month,
    }


async def cleanup_old_task_history(days: int = 30) -> int:
    """
    清理旧的任务历史记录
    
    Args:
        days: 保留天数
    
    Returns:
        删除的记录数
    """
    async with get_db_session() as db:
        cutoff = datetime.now() - timedelta(days=days)
        
        # 查询要删除的记录数
        count_result = await db.execute(
            select(func.count(TaskHistory.id)).where(
                and_(
                    TaskHistory.created_at < cutoff,
                    TaskHistory.status.in_(["completed", "failed", "cancelled"])
                )
            )
        )
        count = count_result.scalar()
        
        if count > 0:
            # 删除旧记录
            from sqlalchemy import delete
            await db.execute(
                delete(TaskHistory).where(
                    and_(
                        TaskHistory.created_at < cutoff,
                        TaskHistory.status.in_(["completed", "failed", "cancelled"])
                    )
                )
            )
            await db.commit()
            logger.info(f"清理了 {count} 条旧任务历史记录")
        
        return count
