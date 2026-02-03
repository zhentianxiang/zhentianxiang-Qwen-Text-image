"""
邮件工具模块

处理邮件发送逻辑
"""

from typing import List, Optional
from pathlib import Path

from fastapi_mail import FastMail, MessageSchema, ConnectionConfig, MessageType
from pydantic import EmailStr

from ..config import settings
from ..utils.logger import get_logger

logger = get_logger(__name__)

# 邮件配置 (延迟初始化)
_mail_conf: Optional[ConnectionConfig] = None

def get_mail_config() -> ConnectionConfig:
    """获取邮件配置，如果未启用或配置无效则抛出异常"""
    global _mail_conf
    if _mail_conf:
        return _mail_conf
        
    if not settings.email.enabled:
        raise RuntimeError("邮件服务未启用")
        
    # 简单的格式检查，防止空字符串导致 crash
    if "@" not in settings.email.from_email:
        logger.warning(f"发件人邮箱格式不正确: {settings.email.from_email}，将使用临时默认值避免启动崩溃")
        from_email = "noreply@example.com"
    else:
        from_email = settings.email.from_email

    _mail_conf = ConnectionConfig(
        MAIL_USERNAME=settings.email.smtp_username,
        MAIL_PASSWORD=settings.email.smtp_password,
        MAIL_FROM=from_email,
        MAIL_PORT=settings.email.smtp_port,
        MAIL_SERVER=settings.email.smtp_server,
        MAIL_FROM_NAME=settings.email.from_name,
        MAIL_STARTTLS=settings.email.tls,
        MAIL_SSL_TLS=settings.email.ssl,
        USE_CREDENTIALS=True,
        VALIDATE_CERTS=True
    )
    return _mail_conf

async def send_verification_email(email: EmailStr, token: str, username: str, base_url: Optional[str] = None):
    """
    发送验证邮件
    """
    if not settings.email.enabled:
        logger.warning("邮件服务未启用，跳过发送验证邮件")
        return

    try:
        conf = get_mail_config()
    except Exception as e:
        logger.error(f"无法加载邮件配置: {e}")
        return

    # 优先使用传入的 base_url，否则使用配置中的
    final_base_url = (base_url or settings.app.base_url).rstrip("/")
    verify_url = f"{final_base_url}/auth/verify-email?token={token}"
    
    html = f"""
    <html>
        <body>
            <h2>欢迎加入 {settings.app.app_name}</h2>
            <p>亲爱的 {username}:</p>
            <p>感谢您注册账号。请点击下面的链接验证您的邮箱地址：</p>
            <p><a href="{verify_url}">验证邮箱</a></p>
            <p>或者复制以下链接到浏览器：</p>
            <p>{verify_url}</p>
            <p>如果您没有注册账号，请忽略此邮件。</p>
        </body>
    </html>
    """

    message = MessageSchema(
        subject=f"{settings.app.app_name} - 验证您的邮箱",
        recipients=[email],
        body=html,
        subtype=MessageType.html
    )

    fm = FastMail(conf)
    try:
        await fm.send_message(message)
        logger.info(f"验证邮件已发送至 {email}")
    except Exception as e:
        logger.error(f"发送邮件失败: {e}")
        raise e

async def send_password_reset_email(email: EmailStr, token: str, username: str, base_url: Optional[str] = None):
    """
    发送密码重置邮件
    """
    if not settings.email.enabled:
        logger.warning("邮件服务未启用，无法发送重置邮件")
        return

    try:
        conf = get_mail_config()
    except Exception as e:
        logger.error(f"无法加载邮件配置: {e}")
        return

    # 优先使用传入的 base_url，否则使用配置中的
    final_base_url = (base_url or settings.app.base_url).rstrip("/")
    reset_url = f"{final_base_url}/reset-password?token={token}"
    
    html = f"""
    <html>
        <body>
            <h2>{settings.app.app_name} - 密码重置</h2>
            <p>亲爱的 {username}:</p>
            <p>您收到这封邮件是因为您（或其他人）申请了重置密码。</p>
            <p>请点击下面的链接重置您的密码：</p>
            <p><a href="{reset_url}">重置密码</a></p>
            <p>或者复制以下链接到浏览器：</p>
            <p>{reset_url}</p>
            <p>如果是误操作，请忽略此邮件，您的密码不会改变。</p>
        </body>
    </html>
    """

    message = MessageSchema(
        subject=f"{settings.app.app_name} - 重置密码",
        recipients=[email],
        body=html,
        subtype=MessageType.html
    )

    fm = FastMail(conf)
    try:
        await fm.send_message(message)
        logger.info(f"密码重置邮件已发送至 {email}")
    except Exception as e:
        logger.error(f"发送邮件失败: {e}")
        raise e