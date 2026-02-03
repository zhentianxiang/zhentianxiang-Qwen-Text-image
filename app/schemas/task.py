"""
任务相关的 Pydantic Schema
"""

from datetime import datetime
from typing import Optional, Dict, Any, List

from pydantic import BaseModel, Field


class TaskHistoryResponse(BaseModel):
    """任务历史响应"""
    id: int
    task_id: str
    user_id: Optional[int] = None
    task_type: str
    prompt: str
    negative_prompt: Optional[str] = None
    parameters: Dict[str, Any] = {}
    status: str
    result_path: Optional[str] = None
    result_filename: Optional[str] = None
    error_message: Optional[str] = None
    created_at: Optional[datetime] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    execution_time: Optional[float] = None
    
    model_config = {"from_attributes": True}


class TaskHistoryListResponse(BaseModel):
    """任务历史列表响应"""
    items: List[TaskHistoryResponse]
    total: int
    page: int
    page_size: int
    total_pages: int


class TaskStatistics(BaseModel):
    """任务统计"""
    total_tasks: int = Field(..., description="总任务数")
    completed_tasks: int = Field(..., description="完成任务数")
    failed_tasks: int = Field(..., description="失败任务数")
    pending_tasks: int = Field(..., description="等待中任务数")
    
    # 按类型统计
    text_to_image_count: int = Field(0, description="文生图任务数")
    image_edit_count: int = Field(0, description="图像编辑任务数")
    batch_edit_count: int = Field(0, description="批量编辑任务数")
    
    # 时间统计
    avg_execution_time: Optional[float] = Field(None, description="平均执行时间（秒）")
    total_execution_time: Optional[float] = Field(None, description="总执行时间（秒）")


class UserQuotaResponse(BaseModel):
    """用户配额响应"""
    user_id: int
    daily_limit: int = Field(..., description="每日限额")
    monthly_limit: int = Field(..., description="每月限额")
    used_today: int = Field(..., description="今日已用")
    used_this_month: int = Field(..., description="本月已用")
    total_used: int = Field(..., description="总使用量")
    remaining_today: int = Field(..., description="今日剩余")
    remaining_this_month: int = Field(..., description="本月剩余")
    
    model_config = {"from_attributes": True}
