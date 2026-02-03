"""
Qwen Image Service - 主程序入口

多模态图像生成与编辑服务
"""

import asyncio
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.middleware import SlowAPIMiddleware
from slowapi.errors import RateLimitExceeded

from .config import settings
from .models import get_model_manager
from .models.database import init_database, close_database
from .routers import (
    text_to_image_router, 
    image_edit_router, 
    info_router, 
    tasks_router,
    auth_router,
)
from .services import get_task_queue
from .utils.rate_limit import limiter
from .utils.logger import init_logging, get_logger
from .utils.image_utils import cleanup_old_temp_files

# 初始化全局日志配置（所有模块的日志都会输出到控制台和文件）
init_logging(
    level=settings.logging.level,
    log_format=settings.logging.format,
    file_enabled=settings.logging.file_enabled,
    file_path=settings.logging.file_path,
)
logger = get_logger("qwen_image")

async def custom_rate_limit_handler(request: Request, exc: RateLimitExceeded):
    """自定义频率限制异常处理"""
    # exc.detail 包含类似 "5 per 1 minute" 的信息
    detail = str(exc.detail)
    message = f"请求过于频繁。"
    
    if "minute" in detail:
        message += "请在一分钟后再试。"
    elif "hour" in detail:
        message += "请在一小时后再试。"
    elif "day" in detail:
        message += "请明天再试。"
    else:
        message += f"请稍后再试 (触发限制: {detail})。"
        
    return JSONResponse(
        status_code=429,
        content={"detail": message}
    )

async def cleanup_task():
    """定期清理临时文件的后台任务"""
    while True:
        await asyncio.sleep(settings.cleanup.check_interval_minutes * 60)
        if settings.cleanup.enabled:
            try:
                cleanup_old_temp_files(max_age_hours=settings.cleanup.max_age_hours)
                # 同时清理旧任务记录
                task_queue = get_task_queue()
                task_queue.cleanup_old_tasks(max_age_hours=settings.cleanup.max_age_hours)
            except Exception as e:
                logger.error(f"清理临时文件时出错: {e}")


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """
    应用生命周期管理
    
    启动时加载模型和任务队列，关闭时释放资源
    """
    logger.info("=" * 50)
    logger.info("Qwen Image Service 正在启动...")
    logger.info("=" * 50)
    
    # 初始化数据库
    if settings.auth.enabled:
        await init_database()
        logger.info(f"用户认证已启用 | 数据库: {settings.auth.database_url}")
    else:
        logger.info("用户认证已禁用")
    
    # 加载模型 (仅在线程模式下加载，进程模式由Worker按需加载)
    model_manager = get_model_manager()
    logger.info(f"当前任务执行模式: {settings.task_queue.execution_mode}")
    
    if settings.task_queue.execution_mode == "process":
        logger.info("执行模式为 'process'，跳过主进程模型加载。模型将由 Worker 进程按需加载。")
    else:
        try:
            await model_manager.load_models()
        except Exception as e:
            logger.error(f"模型加载失败: {e}")
            raise
    
    # 启动任务队列
    task_queue = get_task_queue()
    await task_queue.start()
    logger.info(f"任务队列已启动 | GPU数量: {task_queue.gpu_count} | 最大并行数: {task_queue.max_workers}")
    
    # 启动清理任务
    cleanup_task_handle = None
    if settings.cleanup.enabled:
        cleanup_task_handle = asyncio.create_task(cleanup_task())
        logger.info(f"临时文件清理任务已启动 (间隔: {settings.cleanup.check_interval_minutes}分钟)")
    
    logger.info("=" * 50)
    logger.info("服务启动完成！")
    logger.info(f"API文档: http://{settings.app.host}:{settings.app.port}/docs")
    if settings.auth.enabled:
        logger.info(f"默认管理员: {settings.auth.default_admin_username}")
    logger.info("=" * 50)
    
    yield
    
    # 清理资源
    logger.info("正在关闭服务...")
    
    # 停止任务队列
    await task_queue.stop()
    logger.info("任务队列已停止")
    
    if cleanup_task_handle:
        cleanup_task_handle.cancel()
        try:
            await cleanup_task_handle
        except asyncio.CancelledError:
            pass
    
    await model_manager.unload_models()
    
    # 关闭数据库
    if settings.auth.enabled:
        await close_database()
    
    logger.info("服务已关闭")


# 创建FastAPI应用
app = FastAPI(
    title=settings.app.app_name,
    description=settings.app.app_description,
    version=settings.app.app_version,
    lifespan=lifespan,
)

# 注册 Rate Limiter
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, custom_rate_limit_handler)
app.add_middleware(SlowAPIMiddleware)

# 添加CORS中间件
# 注意：当 allow_origins=["*"] 时，allow_credentials 必须为 False（CORS规范要求）
cors_origins = settings.security.cors_origins
cors_credentials = settings.security.cors_allow_credentials

# 如果 origins 包含 "*"，则不能使用 credentials
if "*" in cors_origins:
    cors_credentials = False

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=cors_credentials,
    allow_methods=settings.security.cors_allow_methods,
    allow_headers=settings.security.cors_allow_headers,
)

# 注册路由
app.include_router(auth_router)  # 认证路由
app.include_router(text_to_image_router)
app.include_router(image_edit_router)
app.include_router(info_router)
app.include_router(tasks_router)


@app.get("/")
async def root():
    """根路径 - 返回服务信息"""
    task_queue = get_task_queue()
    queue_info = task_queue.get_queue_info()
    
    return {
        "name": settings.app.app_name,
        "version": settings.app.app_version,
        "docs": "/docs",
        "health": "/health",
        "auth_enabled": settings.auth.enabled,
        "task_queue": {
            "gpu_count": queue_info["gpu_count"],
            "max_workers": queue_info["max_workers"],
            "pending_tasks": queue_info["tasks"]["pending"],
            "running_tasks": queue_info["tasks"]["running"],
        }
    }


def main():
    """主函数 - 用于直接运行"""
    import uvicorn
    
    uvicorn.run(
        "app.main:app",
        host=settings.app.host,
        port=settings.app.port,
        reload=settings.app.debug,
    )


if __name__ == "__main__":
    main()
