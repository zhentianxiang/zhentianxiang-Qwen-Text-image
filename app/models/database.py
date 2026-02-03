"""
数据库模块

使用 SQLAlchemy + SQLite 管理用户数据和任务历史
"""

from datetime import datetime
from typing import AsyncGenerator, Optional
import json

from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, Float, ForeignKey, create_engine
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import declarative_base, relationship

from ..config import settings
from ..utils.logger import get_logger

logger = get_logger(__name__)

# 创建基类
Base = declarative_base()


class User(Base):
    """用户模型"""
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, index=True, nullable=False)
    email = Column(String(100), unique=True, index=True, nullable=True)
    hashed_password = Column(String(255), nullable=False)
    is_active = Column(Boolean, default=True)
    is_admin = Column(Boolean, default=False)
    is_verified = Column(Boolean, default=False)  # 邮箱验证状态
    verification_token = Column(String(100), nullable=True)  # 验证Token
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # 关联任务
    tasks = relationship("TaskHistory", back_populates="user", lazy="dynamic")
    
    def __repr__(self):
        return f"<User(id={self.id}, username={self.username})>"


class TaskHistory(Base):
    """任务历史记录模型"""
    __tablename__ = "task_history"
    
    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(String(36), unique=True, index=True, nullable=False)  # UUID
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    
    # 任务类型: text_to_image, image_edit, batch_edit
    task_type = Column(String(50), nullable=False, index=True)
    
    # 提示词
    prompt = Column(Text, nullable=False)
    negative_prompt = Column(Text, nullable=True)
    
    # 参数 (JSON 格式)
    parameters = Column(Text, nullable=True)
    
    # 状态: pending, running, completed, failed, cancelled
    status = Column(String(20), default="pending", index=True)
    
    # 结果
    result_path = Column(String(500), nullable=True)  # 结果文件路径
    result_filename = Column(String(255), nullable=True)  # 结果文件名
    error_message = Column(Text, nullable=True)  # 错误信息
    
    # 时间戳
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    
    # 执行时间（秒）
    execution_time = Column(Float, nullable=True)
    
    # 关联用户
    user = relationship("User", back_populates="tasks")
    
    def __repr__(self):
        return f"<TaskHistory(id={self.id}, task_id={self.task_id}, status={self.status})>"
    
    def get_parameters(self) -> dict:
        """获取参数字典"""
        if self.parameters:
            try:
                return json.loads(self.parameters)
            except json.JSONDecodeError:
                return {}
        return {}
    
    def set_parameters(self, params: dict) -> None:
        """设置参数"""
        self.parameters = json.dumps(params, ensure_ascii=False)
    
    def to_dict(self) -> dict:
        """转换为字典"""
        return {
            "id": self.id,
            "task_id": self.task_id,
            "user_id": self.user_id,
            "task_type": self.task_type,
            "prompt": self.prompt,
            "negative_prompt": self.negative_prompt,
            "parameters": self.get_parameters(),
            "status": self.status,
            "result_path": self.result_path,
            "result_filename": self.result_filename,
            "error_message": self.error_message,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "started_at": self.started_at.isoformat() if self.started_at else None,
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
            "execution_time": self.execution_time,
        }


class UserQuota(Base):
    """用户配额模型"""
    __tablename__ = "user_quotas"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False)
    
    # 配额限制
    daily_limit = Column(Integer, default=100)  # 每日限额
    monthly_limit = Column(Integer, default=3000)  # 每月限额
    
    # 使用统计
    used_today = Column(Integer, default=0)
    used_this_month = Column(Integer, default=0)
    total_used = Column(Integer, default=0)  # 总使用量
    
    # 重置日期
    last_daily_reset = Column(DateTime, default=datetime.utcnow)
    last_monthly_reset = Column(DateTime, default=datetime.utcnow)
    
    def __repr__(self):
        return f"<UserQuota(user_id={self.user_id}, used_today={self.used_today})>"


# 异步数据库引擎
_async_engine = None
_async_session_factory = None

# 同步数据库引擎（用于初始化）
_sync_engine = None


def get_database_url() -> str:
    """获取数据库URL"""
    return settings.auth.database_url


def get_async_database_url() -> str:
    """获取异步数据库URL"""
    url = get_database_url()
    # 将 sqlite:/// 转换为 sqlite+aiosqlite:///
    if url.startswith("sqlite:///"):
        return url.replace("sqlite:///", "sqlite+aiosqlite:///")
    return url


async def init_database() -> None:
    """初始化数据库"""
    global _async_engine, _async_session_factory, _sync_engine
    
    database_url = get_database_url()
    async_database_url = get_async_database_url()
    
    logger.info(f"初始化数据库: {database_url}")
    
    # 创建同步引擎用于初始化表
    _sync_engine = create_engine(
        database_url,
        echo=settings.app.debug,
    )
    
    # 创建异步引擎
    _async_engine = create_async_engine(
        async_database_url,
        echo=settings.app.debug,
    )
    
    # 创建异步会话工厂
    _async_session_factory = async_sessionmaker(
        _async_engine,
        class_=AsyncSession,
        expire_on_commit=False,
    )
    
    # 使用同步引擎创建表
    Base.metadata.create_all(bind=_sync_engine)
    
    logger.info("数据库初始化完成")
    
    # 创建默认管理员账号（如果配置了）
    await create_default_admin()


async def create_default_admin() -> None:
    """创建默认管理员账号"""
    from ..services.auth import get_password_hash
    
    if not settings.auth.default_admin_username:
        return
    
    async with get_db_session() as db:
        from sqlalchemy import select
        
        # 检查是否已存在
        result = await db.execute(
            select(User).where(User.username == settings.auth.default_admin_username)
        )
        existing_user = result.scalar_one_or_none()
        
        if existing_user:
            logger.info(f"默认管理员账号已存在: {settings.auth.default_admin_username}")
            return
        
        # 创建管理员账号
        admin_user = User(
            username=settings.auth.default_admin_username,
            hashed_password=get_password_hash(settings.auth.default_admin_password),
            is_active=True,
            is_admin=True,
            is_verified=True, # 管理员默认已验证
        )
        
        db.add(admin_user)
        await db.commit()
        
        logger.info(f"默认管理员账号已创建: {settings.auth.default_admin_username}")


async def close_database() -> None:
    """关闭数据库连接"""
    global _async_engine
    
    if _async_engine:
        await _async_engine.dispose()
        logger.info("数据库连接已关闭")


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """
    获取数据库会话（依赖注入用）
    
    Usage:
        @router.get("/")
        async def endpoint(db: AsyncSession = Depends(get_db)):
            ...
    """
    if _async_session_factory is None:
        raise RuntimeError("数据库未初始化")
    
    async with _async_session_factory() as session:
        try:
            yield session
        finally:
            await session.close()


class get_db_session:
    """
    数据库会话上下文管理器
    
    Usage:
        async with get_db_session() as db:
            ...
    """
    
    def __init__(self):
        self.session: Optional[AsyncSession] = None
    
    async def __aenter__(self) -> AsyncSession:
        if _async_session_factory is None:
            raise RuntimeError("数据库未初始化")
        self.session = _async_session_factory()
        return self.session
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.session:
            await self.session.close()
