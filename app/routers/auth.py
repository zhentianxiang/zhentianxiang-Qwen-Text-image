"""
认证路由模块

提供用户注册、登录、Token 刷新、密码重置等接口
"""

from datetime import timedelta
from typing import List, Optional
import uuid

from fastapi import APIRouter, Depends, HTTPException, status, Request, Body
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel, Field

from ..config import settings
from ..models.database import User, get_db
from ..schemas.user import (
    UserCreate,
    UserLogin,
    UserResponse,
    UserUpdate,
    Token,
    PasswordChange,
)
from ..services.auth import (
    get_password_hash,
    verify_password,
    create_access_token,
    authenticate_user,
    get_current_user,
    get_current_active_user,
    get_current_admin_user,
    get_user_by_username,
)
from ..utils.logger import get_logger
from ..utils.rate_limit import limiter
from ..utils.email_utils import send_verification_email, send_password_reset_email

logger = get_logger(__name__)
router = APIRouter(prefix="/auth", tags=["认证"])


class PasswordResetRequest(BaseModel):
    email: str
    username: str

class PasswordResetConfirm(BaseModel):
    token: str
    new_password: str = Field(..., min_length=6, max_length=100)


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit(settings.security.rate_limit.register_limit)
async def register(
    request: Request,
    user_data: UserCreate,
    db: AsyncSession = Depends(get_db),
) -> User:
    """
    用户注册
    
    - **username**: 用户名（3-50字符）
    - **password**: 密码（至少6字符）
    - **email**: 邮箱（必须）
    """
    # 检查是否允许注册
    if not settings.auth.allow_registration:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="当前不允许用户注册"
        )
    
    # 检查用户名是否已存在
    existing_user = await get_user_by_username(db, user_data.username)
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="用户名已存在"
        )
    
    # 检查邮箱注册数量限制
    if user_data.email:
        # 强制转换为小写
        user_data.email = user_data.email.lower()
        
        # 统计该邮箱已注册的账号数量
        # 注意: select(func.count()) 需要导入 func
        from sqlalchemy import func
        result = await db.execute(
            select(func.count()).select_from(User).where(User.email == user_data.email)
        )
        count = result.scalar_one()
        
        if count >= 5:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="该邮箱已达到最大注册账号数量限制(5个)"
            )
    elif settings.email.enabled:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="请输入有效的邮箱地址"
        )
    
    # 生成验证Token
    verification_token = uuid.uuid4().hex if settings.email.enabled else None
    is_verified = not settings.email.enabled # 如果未启用邮件，则自动验证通过
    
    # 创建用户
    new_user = User(
        username=user_data.username,
        email=user_data.email,
        hashed_password=get_password_hash(user_data.password),
        is_active=True,
        is_admin=False,
        is_verified=is_verified,
        verification_token=verification_token,
    )
    
    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)
    
    logger.info(f"新用户注册: {new_user.username}")
    
    # 发送验证邮件
    if settings.email.enabled and user_data.email:
        try:
            await send_verification_email(user_data.email, verification_token, user_data.username, str(request.base_url))
        except Exception as e:
            logger.error(f"验证邮件发送失败: {e}")
            # 不回滚注册，允许用户重发
    
    return new_user


@router.post("/login", response_model=Token)
@limiter.limit(settings.security.rate_limit.login_limit)
async def login(
    request: Request,
    user_data: UserLogin,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """
    用户登录
    """
    user = await authenticate_user(db, user_data.username, user_data.password)
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="用户名或密码错误",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # 检查邮箱验证状态
    if settings.email.enabled and not user.is_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="请先验证您的邮箱",
        )
    
    # 创建 Token
    access_token_expires = timedelta(minutes=settings.auth.access_token_expire_minutes)
    access_token = create_access_token(
        data={
            "sub": user.username,
            "user_id": user.id,
            "is_admin": user.is_admin,
        },
        expires_delta=access_token_expires,
    )
    
    logger.info(f"用户登录: {user.username}")
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "expires_in": settings.auth.access_token_expire_minutes * 60,
    }


@router.post("/forgot-password")
@limiter.limit("3/hour")
async def forgot_password(
    request: Request,
    data: PasswordResetRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    忘记密码 - 发送重置邮件
    """
    if not settings.email.enabled:
        raise HTTPException(status_code=400, detail="邮件服务未启用")
        
    email_lower = data.email.lower()
    result = await db.execute(
        select(User).where(User.email == email_lower)
    )
    user = result.scalar_one_or_none()
    
    if not user or user.username != data.username:
        # 为了安全，不提示用户不存在或不匹配
        return {"message": "如果该邮箱和用户名匹配，重置邮件已发送"}
        
    # 生成重置Token (复用 verification_token 字段)
    reset_token = uuid.uuid4().hex
    user.verification_token = reset_token
    await db.commit()
    
    try:
        await send_password_reset_email(user.email, reset_token, user.username, str(request.base_url))
    except Exception as e:
        logger.error(f"重置邮件发送失败: {e}")
        raise HTTPException(status_code=500, detail="邮件发送失败")
        
    return {"message": "重置邮件已发送，请检查您的邮箱"}


@router.post("/reset-password")
@limiter.limit("5/minute")
async def reset_password(
    request: Request,
    data: PasswordResetConfirm,
    db: AsyncSession = Depends(get_db),
):
    """
    重置密码 - 使用 Token
    """
    result = await db.execute(
        select(User).where(User.verification_token == data.token)
    )
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(status_code=400, detail="无效或过期的重置链接")
        
    # 重置密码
    user.hashed_password = get_password_hash(data.new_password)
    user.verification_token = None # 清除 Token
    # 如果用户之前未验证，重置密码可视作已验证？通常是的，因为他们访问了邮箱
    if not user.is_verified:
        user.is_verified = True
        
    await db.commit()
    
    logger.info(f"用户密码已重置: {user.username}")
    return {"message": "密码重置成功，请使用新密码登录"}


@router.get("/verify-email")
async def verify_email(
    token: str,
    db: AsyncSession = Depends(get_db),
):
    """
    验证邮箱
    """
    result = await db.execute(
        select(User).where(User.verification_token == token)
    )
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="无效的验证链接"
        )
        
    if user.is_verified:
        return {"message": "邮箱已验证，请直接登录"}
        
    user.is_verified = True
    user.verification_token = None
    await db.commit()
    
    return {"message": "邮箱验证成功，您现在可以登录了"}


@router.post("/resend-verification-email")
@limiter.limit("3/hour") # 限制重发频率
async def resend_verification_email(
    request: Request,
    email: str = Body(..., embed=True), # 接收 {"email": "..."}
    db: AsyncSession = Depends(get_db),
):
    """
    重发验证邮件
    """
    if not settings.email.enabled:
        raise HTTPException(status_code=400, detail="邮件服务未启用")
        
    email_lower = email.lower()
    result = await db.execute(
        select(User).where(User.email == email_lower)
    )
    user = result.scalar_one_or_none()
    
    if not user:
        return {"message": "如果该邮箱已注册，验证邮件已发送"}
        
    if user.is_verified:
        return {"message": "该账号已验证"}
        
    # 生成新Token
    new_token = uuid.uuid4().hex
    user.verification_token = new_token
    await db.commit()
    
    try:
        await send_verification_email(email_lower, new_token, user.username)
    except Exception as e:
        logger.error(f"邮件发送失败: {e}")
        raise HTTPException(status_code=500, detail="邮件发送失败，请稍后重试")
        
    return {"message": "验证邮件已发送"}


@router.get("/me", response_model=UserResponse)
async def get_me(
    current_user: User = Depends(get_current_active_user),
) -> User:
    """
    获取当前登录用户信息
    """
    return current_user


@router.put("/me", response_model=UserResponse)
async def update_me(
    user_data: UserUpdate,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> User:
    """
    更新当前用户信息
    """
    # 更新邮箱
    if user_data.email is not None:
        # 检查邮箱是否已被使用
        result = await db.execute(
            select(User).where(
                User.email == user_data.email,
                User.id != current_user.id
            )
        )
        if result.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="邮箱已被使用"
            )
        current_user.email = user_data.email
    
    # 更新密码
    if user_data.password is not None:
        current_user.hashed_password = get_password_hash(user_data.password)
    
    await db.commit()
    await db.refresh(current_user)
    
    logger.info(f"用户信息已更新: {current_user.username}")
    
    return current_user


@router.post("/change-password")
async def change_password(
    password_data: PasswordChange,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """
    修改密码
    """
    # 验证原密码
    if not verify_password(password_data.old_password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="原密码错误"
        )
    
    # 更新密码
    current_user.hashed_password = get_password_hash(password_data.new_password)
    await db.commit()
    
    logger.info(f"用户密码已修改: {current_user.username}")
    
    return {"message": "密码修改成功"}


# ==================== 管理员接口 ====================

@router.get("/users", response_model=List[UserResponse])
async def list_users(
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(get_current_admin_user),
    db: AsyncSession = Depends(get_db),
) -> List[User]:
    """
    获取所有用户列表（管理员）
    """
    result = await db.execute(
        select(User).offset(skip).limit(limit)
    )
    return result.scalars().all()


@router.put("/users/{user_id}/toggle-active")
async def toggle_user_active(
    user_id: int,
    current_user: User = Depends(get_current_admin_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """
    启用/禁用用户（管理员）
    """
    if user_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="不能禁用自己"
        )
    
    result = await db.execute(
        select(User).where(User.id == user_id)
    )
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="用户不存在"
        )
    
    user.is_active = not user.is_active
    await db.commit()
    
    status_text = "启用" if user.is_active else "禁用"
    logger.info(f"用户 {user.username} 已被{status_text}")
    
    return {
        "message": f"用户已{status_text}",
        "user_id": user_id,
        "is_active": user.is_active,
    }


@router.put("/users/{user_id}/toggle-admin")
async def toggle_user_admin(
    user_id: int,
    current_user: User = Depends(get_current_admin_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """
    设置/取消管理员权限（管理员）
    """
    if user_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="不能修改自己的管理员权限"
        )
    
    result = await db.execute(
        select(User).where(User.id == user_id)
    )
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="用户不存在"
        )
    
    user.is_admin = not user.is_admin
    await db.commit()
    
    status_text = "设置为管理员" if user.is_admin else "取消管理员权限"
    logger.info(f"用户 {user.username} 已被{status_text}")
    
    return {
        "message": f"用户已{status_text}",
        "user_id": user_id,
        "is_admin": user.is_admin,
    }


@router.delete("/users/{user_id}")
async def delete_user(
    user_id: int,
    current_user: User = Depends(get_current_admin_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """
    删除用户（管理员）
    """
    if user_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="不能删除自己"
        )
    
    result = await db.execute(
        select(User).where(User.id == user_id)
    )
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="用户不存在"
        )
    
    username = user.username
    await db.delete(user)
    await db.commit()
    
    logger.info(f"用户已删除: {username}")
    
    return {"message": f"用户 {username} 已删除"}
