"""
信息查询路由模块
"""

from fastapi import APIRouter, Depends

from ..config import settings
from ..models import get_model_manager
from ..models.database import User
from ..schemas import HealthResponse, ModelInfo, ModelsResponse
from ..services.auth import get_current_active_admin_user
from ..utils.memory_utils import (
    get_memory_info,
    get_gpu_details,
    get_system_info,
)

router = APIRouter(tags=["系统信息"])


@router.get("/health", response_model=HealthResponse)
async def health_check():
    """
    健康检查端点
    
    返回服务状态和模型加载情况
    """
    model_manager = get_model_manager()
    
    return HealthResponse(
        status="healthy",
        text_to_image_model_loaded=model_manager.is_text_to_image_loaded,
        image_edit_model_loaded=model_manager.is_image_edit_loaded,
        gpu_available=model_manager.gpu_available,
        gpu_count=model_manager.gpu_count,
    )


@router.get("/models", response_model=ModelsResponse)
async def list_models():
    """
    列出可用模型信息
    
    返回所有支持的模型及其状态
    """
    model_manager = get_model_manager()
    
    return ModelsResponse(
        text_to_image=ModelInfo(
            name=settings.models.text_to_image_model,
            description="Qwen-Image-2512 文生图模型",
            capabilities=["text-to-image", "image generation"],
            status="loaded" if model_manager.is_text_to_image_loaded else "not loaded",
        ),
        image_edit=ModelInfo(
            name=settings.models.image_edit_model,
            description="Qwen-Image-Edit-2511 图像编辑模型",
            capabilities=["image-to-image", "image editing", "multi-image composition"],
            status="loaded" if model_manager.is_image_edit_loaded else "not loaded",
        ),
    )


@router.get("/aspect-ratios")
async def get_aspect_ratios():
    """
    获取支持的宽高比
    
    返回所有支持的图像宽高比及其对应的像素尺寸
    """
    return settings.aspect_ratios


@router.get("/memory")
async def get_memory_status():
    """
    获取内存使用状态
    
    返回 CPU 和 GPU 内存的当前使用情况
    """
    return get_memory_info()


@router.get("/gpu")
async def get_gpu_status():
    """
    获取 GPU 详细状态
    
    返回每个 GPU 的内存使用、使用率、温度、功耗等信息
    """
    return get_gpu_details()


@router.get("/system")
async def get_system_status(
    _: User = Depends(get_current_active_admin_user),
):
    """
    获取系统综合信息（仅管理员）
    
    返回 CPU、内存、GPU、操作系统、PyTorch 等完整系统信息
    """
    return get_system_info()
