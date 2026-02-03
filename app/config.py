"""
配置管理模块

支持从YAML配置文件和环境变量加载配置
环境变量优先级高于配置文件
"""

import os
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
from functools import lru_cache

import yaml
from pydantic import Field
from pydantic_settings import BaseSettings


# 项目根目录
PROJECT_ROOT = Path(__file__).parent.parent
CONFIG_DIR = PROJECT_ROOT / "config"


def load_yaml_config(config_path: Optional[Path] = None) -> Dict[str, Any]:
    """加载YAML配置文件"""
    if config_path is None:
        config_path = CONFIG_DIR / "config.yaml"
    
    if not config_path.exists():
        return {}
    
    with open(config_path, "r", encoding="utf-8") as f:
        return yaml.safe_load(f) or {}


class AppSettings(BaseSettings):
    """应用配置"""
    
    # 服务配置
    app_name: str = Field(default="Qwen 多模态图像API服务")
    app_description: str = Field(
        default="集成文生图(Qwen-Image-2512)和图像编辑(Qwen-Image-Edit-2511)功能"
    )
    app_version: str = Field(default="1.0.0")
    host: str = Field(default="0.0.0.0", alias="APP_HOST")
    port: int = Field(default=8000, alias="APP_PORT")
    base_url: str = Field(default="http://localhost:8000", alias="APP_BASE_URL")
    debug: bool = Field(default=False, alias="APP_DEBUG")
    
    model_config = {"env_prefix": "", "extra": "ignore", "populate_by_name": True}


class ModelSettings(BaseSettings):
    """模型配置"""
    
    text_to_image_model: str = Field(
        default="Qwen/Qwen-Image-2512",
        alias="TEXT_TO_IMAGE_MODEL"
    )
    image_edit_model: str = Field(
        default="Qwen/Qwen-Image-Edit-2511",
        alias="IMAGE_EDIT_MODEL"
    )
    models_dir: str = Field(default="./models", alias="MODELS_DIR")
    device: str = Field(default="cuda", alias="DEVICE")
    
    model_config = {"env_prefix": "", "extra": "ignore"}


class GenerationSettings(BaseSettings):
    """图像生成配置"""
    
    default_num_inference_steps: int = Field(default=50, alias="DEFAULT_NUM_INFERENCE_STEPS")
    default_guidance_scale: float = Field(default=7.5, alias="DEFAULT_GUIDANCE_SCALE")
    default_true_cfg_scale: float = Field(default=4.0, alias="DEFAULT_TRUE_CFG_SCALE")
    default_width: int = Field(default=1024, alias="DEFAULT_WIDTH")
    default_height: int = Field(default=1024, alias="DEFAULT_HEIGHT")
    
    min_inference_steps: int = Field(default=20)
    max_inference_steps: int = Field(default=100)
    max_images_per_request: int = Field(default=4)
    max_batch_prompts: int = Field(default=10)
    
    model_config = {"env_prefix": "", "extra": "ignore"}


class RateLimitSettings(BaseSettings):
    """速率限制配置"""
    enabled: bool = Field(default=True, alias="RATE_LIMIT_ENABLED")
    global_limit: str = Field(default="100/minute", alias="RATE_LIMIT_GLOBAL")
    login_limit: str = Field(default="5/minute", alias="RATE_LIMIT_LOGIN")
    register_limit: str = Field(default="3/hour", alias="RATE_LIMIT_REGISTER")
    generation_limit: str = Field(default="10/minute", alias="RATE_LIMIT_GENERATION")
    
    model_config = {"env_prefix": "", "extra": "ignore"}


class SecuritySettings(BaseSettings):
    """安全配置"""
    
    max_upload_size_mb: int = Field(default=20, alias="MAX_UPLOAD_SIZE_MB")
    allowed_image_types: List[str] = Field(
        default=["image/jpeg", "image/png", "image/webp"]
    )
    
    # CORS
    cors_origins: List[str] = Field(default=["*"])
    cors_allow_credentials: bool = Field(default=True, alias="CORS_ALLOW_CREDENTIALS")
    cors_allow_methods: List[str] = Field(default=["*"])
    cors_allow_headers: List[str] = Field(default=["*"])
    
    # Rate Limiting
    rate_limit: RateLimitSettings = Field(default_factory=RateLimitSettings)
    
    model_config = {"env_prefix": "", "extra": "ignore"}
    
    def __init__(self, **data):
        import json
        
        # 处理 CORS_ORIGINS 环境变量
        if "CORS_ORIGINS" in os.environ:
            cors_value = os.environ["CORS_ORIGINS"].strip()
            # 尝试解析 JSON 数组格式，如 ["*"] 或 ["http://a.com"]
            if cors_value.startswith("["):
                try:
                    data["cors_origins"] = json.loads(cors_value)
                except json.JSONDecodeError:
                    data["cors_origins"] = [cors_value]
            # 单个 * 或逗号分隔的值
            elif cors_value == "*":
                data["cors_origins"] = ["*"]
            else:
                data["cors_origins"] = [s.strip() for s in cors_value.split(",")]
        
        # 处理 ALLOWED_IMAGE_TYPES 环境变量
        if "ALLOWED_IMAGE_TYPES" in os.environ:
            types_value = os.environ["ALLOWED_IMAGE_TYPES"].strip()
            if types_value.startswith("["):
                try:
                    data["allowed_image_types"] = json.loads(types_value)
                except json.JSONDecodeError:
                    data["allowed_image_types"] = [types_value]
            else:
                data["allowed_image_types"] = [s.strip() for s in types_value.split(",")]
        
        # Handle nested rate_limit config if passed as dict
        if "rate_limit" in data and isinstance(data["rate_limit"], dict):
            data["rate_limit"] = RateLimitSettings(**data["rate_limit"])
            
        super().__init__(**data)


class EmailSettings(BaseSettings):
    """邮件配置"""
    enabled: bool = Field(default=False, alias="EMAIL_ENABLED")
    smtp_server: str = Field(default="smtp.qq.com", alias="EMAIL_SMTP_SERVER")
    smtp_port: int = Field(default=587, alias="EMAIL_SMTP_PORT")
    smtp_username: str = Field(default="", alias="EMAIL_SMTP_USERNAME")
    smtp_password: str = Field(default="", alias="EMAIL_SMTP_PASSWORD")
    from_email: str = Field(default="", alias="EMAIL_FROM_EMAIL")
    from_name: str = Field(default="Qwen Image Service", alias="EMAIL_FROM_NAME")
    tls: bool = Field(default=True, alias="EMAIL_TLS")
    ssl: bool = Field(default=False, alias="EMAIL_SSL")
    
    model_config = {"env_prefix": "", "extra": "ignore", "populate_by_name": True}


class LoggingSettings(BaseSettings):
    """日志配置"""
    
    level: str = Field(default="INFO", alias="LOG_LEVEL")
    format: str = Field(
        default="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
    )
    file_enabled: bool = Field(default=True, alias="LOG_FILE_ENABLED")
    file_path: str = Field(default="./logs/app.log", alias="LOG_FILE_PATH")
    
    model_config = {"env_prefix": "", "extra": "ignore"}


class CleanupSettings(BaseSettings):
    """临时文件清理配置"""
    
    enabled: bool = Field(default=True, alias="AUTO_CLEANUP_ENABLED")
    max_age_hours: int = Field(default=24, alias="TEMP_FILE_MAX_AGE_HOURS")
    check_interval_minutes: int = Field(default=60)
    
    model_config = {"env_prefix": "", "extra": "ignore"}


class TaskQueueSettings(BaseSettings):
    """任务队列配置"""
    
    # 最大并行工作者数量，0表示自动检测GPU数量
    max_workers: int = Field(default=0, alias="TASK_QUEUE_MAX_WORKERS")
    # 任务结果保留时间（小时）
    result_retention_hours: int = Field(default=24, alias="TASK_RESULT_RETENTION_HOURS")
    # 同步模式超时时间（秒）
    sync_timeout_seconds: int = Field(default=600, alias="SYNC_TIMEOUT_SECONDS")
    # 执行模式：thread (默认) 或 process
    execution_mode: str = Field(default="thread", alias="TASK_QUEUE_EXECUTION_MODE")
    
    model_config = {"env_prefix": "", "extra": "ignore", "populate_by_name": True}


class AuthSettings(BaseSettings):
    """认证配置"""
    
    # 是否启用认证
    enabled: bool = Field(default=True, alias="AUTH_ENABLED")
    
    # JWT 配置
    secret_key: str = Field(
        default="your-secret-key-change-in-production-please",
        alias="AUTH_SECRET_KEY"
    )
    algorithm: str = Field(default="HS256", alias="AUTH_ALGORITHM")
    access_token_expire_minutes: int = Field(default=1440, alias="AUTH_TOKEN_EXPIRE_MINUTES")  # 默认24小时
    
    # 数据库配置
    database_url: str = Field(default="sqlite:///./data/users.db", alias="AUTH_DATABASE_URL")
    
    # 默认管理员账号（首次启动时创建）
    default_admin_username: str = Field(default="admin", alias="AUTH_DEFAULT_ADMIN_USERNAME")
    default_admin_password: str = Field(default="admin123", alias="AUTH_DEFAULT_ADMIN_PASSWORD")
    
    # 是否允许用户注册
    allow_registration: bool = Field(default=True, alias="AUTH_ALLOW_REGISTRATION")
    
    model_config = {"env_prefix": "", "extra": "ignore"}


class QuotaSettings(BaseSettings):
    """配额配置"""
    
    # 是否启用配额限制
    enabled: bool = Field(default=True, alias="QUOTA_ENABLED")
    
    # 默认每日限额（0表示不限制）
    default_daily_limit: int = Field(default=100, alias="QUOTA_DEFAULT_DAILY_LIMIT")
    
    # 默认每月限额（0表示不限制）
    default_monthly_limit: int = Field(default=3000, alias="QUOTA_DEFAULT_MONTHLY_LIMIT")
    
    # 管理员是否受配额限制
    admin_unlimited: bool = Field(default=True, alias="QUOTA_ADMIN_UNLIMITED")
    
    model_config = {"env_prefix": "", "extra": "ignore"}


class StorageSettings(BaseSettings):
    """存储配置"""
    
    # 输出目录（持久化存储生成的图片）
    output_dir: str = Field(default="/app/data/outputs", alias="STORAGE_OUTPUT_DIR")
    
    # 是否按日期组织子目录
    organize_by_date: bool = Field(default=True, alias="STORAGE_ORGANIZE_BY_DATE")
    
    # 是否按用户组织子目录
    organize_by_user: bool = Field(default=True, alias="STORAGE_ORGANIZE_BY_USER")
    
    # 文件保留天数（0表示永久保留）
    retention_days: int = Field(default=0, alias="STORAGE_RETENTION_DAYS")
    
    model_config = {"env_prefix": "", "extra": "ignore"}


class Settings:
    """统一配置管理类"""
    
    def __init__(self, config_path: Optional[Path] = None):
        # 加载YAML配置
        yaml_config = load_yaml_config(config_path)
        
        # 初始化各子配置
        self.app = AppSettings(**yaml_config.get("app", {}))
        self.models = ModelSettings(**yaml_config.get("models", {}))
        self.generation = GenerationSettings(**yaml_config.get("generation", {}))
        self.security = SecuritySettings(**yaml_config.get("security", {}))
        self.logging = LoggingSettings(**yaml_config.get("logging", {}))
        self.cleanup = CleanupSettings(**yaml_config.get("cleanup", {}))
        self.task_queue = TaskQueueSettings(**yaml_config.get("task_queue", {}))
        self.auth = AuthSettings(**yaml_config.get("auth", {}))
        self.quota = QuotaSettings(**yaml_config.get("quota", {}))
        self.storage = StorageSettings(**yaml_config.get("storage", {}))
        self.email = EmailSettings(**yaml_config.get("email", {}))
        
        # 加载宽高比配置
        self._aspect_ratios = yaml_config.get("aspect_ratios", {
            "1:1": [1024, 1024],
            "16:9": [1664, 928],
            "9:16": [928, 1664],
            "4:3": [1472, 1104],
            "3:4": [1104, 1472],
            "3:2": [1584, 1056],
            "2:3": [1056, 1584],
        })
    
    @property
    def aspect_ratios(self) -> Dict[str, Tuple[int, int]]:
        """获取支持的宽高比"""
        return {k: tuple(v) for k, v in self._aspect_ratios.items()}
    
    def get_aspect_ratio_size(self, ratio: str) -> Tuple[int, int]:
        """根据宽高比获取尺寸"""
        if ratio in self._aspect_ratios:
            return tuple(self._aspect_ratios[ratio])
        return (self.generation.default_width, self.generation.default_height)


@lru_cache()
def get_settings() -> Settings:
    """获取配置单例"""
    return Settings()


# 便捷访问
settings = get_settings()
