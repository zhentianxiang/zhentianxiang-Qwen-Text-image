"""
文生图路由模块

支持异步任务队列模式，避免推理阻塞服务器
"""

import gc
import uuid
from typing import Dict, Any

import torch
from fastapi import APIRouter, Depends, Form, HTTPException, Query, Response
from fastapi.responses import FileResponse, JSONResponse

from ..config import settings
from ..models import get_model_manager
from ..models.database import User
from ..services import get_task_queue, TaskStatus
from ..services.auth import get_current_user
from ..services.task_history import check_and_update_quota
from ..utils.logger import get_logger
from ..utils.image_utils import save_images_to_temp, create_zip_from_images
from ..utils.memory_utils import cleanup_memory, log_memory_status

logger = get_logger(__name__)
router = APIRouter(prefix="/text-to-image", tags=["文生图"])


def _run_text_to_image_inference(
    prompt: str,
    negative_prompt: str,
    width: int,
    height: int,
    num_inference_steps: int,
    true_cfg_scale: float,
    seed: int,
    num_images: int,
    user_id: int = None,
    **kwargs  # 接收 _gpu_id 等额外参数
) -> Dict[str, Any]:
    """
    执行文生图推理（同步函数，在线程池中运行）
    
    返回结果文件路径
    """
    model_manager = get_model_manager()
    
    if not model_manager.is_text_to_image_loaded:
        raise RuntimeError("文生图模型未加载")
    
    # 获取随机数生成器
    generator = model_manager.get_generator(seed)
    
    logger.info(f"[推理] 开始生成图像 | prompt: {prompt[:50]}... | size: {width}x{height}")
    
    result = None
    images = None
    saved_images = None
    return_value = None
    
    try:
        with torch.inference_mode():
            result = model_manager.text_to_image_pipeline(
                prompt=prompt,
                negative_prompt=negative_prompt if negative_prompt else None,
                width=width,
                height=height,
                num_inference_steps=num_inference_steps,
                true_cfg_scale=true_cfg_scale,
                generator=generator,
                num_images_per_prompt=num_images,
            )
        
        # 立即复制图像列表，然后清理 result
        images = list(result.images)
        
        # 清理 pipeline 返回的 result 对象
        if hasattr(result, 'images'):
            result.images.clear() if hasattr(result.images, 'clear') else None
        del result
        result = None
        
        logger.info(f"[推理] 图像生成成功 | 数量: {len(images)}")
        
        # 保存图像到持久化目录（按用户组织）
        saved_images = save_images_to_temp(images, prefix="generated", user_id=user_id)
        
        # 图像已保存，关闭 PIL Image 对象释放内存
        for img in images:
            if hasattr(img, 'close'):
                img.close()
        images.clear()
        del images
        images = None
        
        if len(saved_images) == 1:
            filepath, filename = saved_images[0]
            return_value = {
                "file_path": filepath,
                "media_type": "image/png",
                "filename": filename,
            }
        else:
            # 多张图像返回ZIP
            image_paths = [path for path, _ in saved_images]
            zip_path = create_zip_from_images(image_paths, user_id=user_id)
            
            return_value = {
                "file_path": zip_path,
                "media_type": "application/zip",
                "filename": f"generated_images_{uuid.uuid4().hex[:8]}.zip",
            }
        
        return return_value
        
    finally:
        # 确保所有变量被清理
        if result is not None:
            del result
        if images is not None:
            for img in images:
                if hasattr(img, 'close'):
                    img.close()
            del images
        if generator is not None:
            del generator
        
        # 多轮垃圾回收确保彻底清理
        for _ in range(3):
            gc.collect()
        
        # CUDA 缓存清理
        if torch.cuda.is_available():
            torch.cuda.synchronize()
            torch.cuda.empty_cache()
        
        # 清理 Pipeline 内部缓存
        try:
            model_manager.clear_pipeline_cache()
        except Exception as e:
            logger.warning(f"清理 pipeline 缓存失败: {e}")
        
        # 记录清理后内存状态
        log_memory_status("[文生图] 推理完成后")


@router.post("", response_model=None)
async def generate_image(
    prompt: str = Form(..., description="生成图像的描述文本"),
    negative_prompt: str = Form("", description="不希望出现在图像中的内容"),
    aspect_ratio: str = Form("1:1", description="图像宽高比"),
    num_inference_steps: int = Form(50, ge=20, le=100, description="推理步数"),
    true_cfg_scale: float = Form(4.0, ge=1.0, le=10.0, description="CFG尺度参数"),
    seed: int = Form(-1, description="随机种子，-1表示随机生成"),
    num_images: int = Form(1, ge=1, le=4, description="生成图像数量"),
    async_mode: bool = Form(True, description="是否使用异步模式（返回任务ID）"),
    current_user: User = Depends(get_current_user),
) -> Response:
    """
    文生图端点：根据文本提示生成图像
    
    **异步模式** (async_mode=True，默认)：
    - 返回任务ID，通过 /tasks/{task_id} 查询状态
    - 通过 /tasks/{task_id}/result 获取结果
    - 适合长时间运行的任务，不会阻塞服务器
    
    **同步模式** (async_mode=False)：
    - 等待任务完成直接返回图像
    - 可能会较长时间等待响应
    
    参数说明：
    - **prompt**: 描述要生成的图像内容
    - **negative_prompt**: 描述不希望出现的内容
    - **aspect_ratio**: 图像宽高比，支持 1:1, 16:9, 9:16, 4:3, 3:4, 3:2, 2:3
    - **num_inference_steps**: 推理步数，越多质量越好但速度越慢
    - **true_cfg_scale**: CFG尺度，控制生成图像与提示的匹配程度
    - **seed**: 随机种子，用于复现结果
    - **num_images**: 生成图像数量
    - **async_mode**: 是否使用异步模式
    """
    model_manager = get_model_manager()
    
    # 在 process 模式下，主进程不加载模型，跳过检查
    if settings.task_queue.execution_mode != "process" and not model_manager.is_text_to_image_loaded:
        raise HTTPException(status_code=503, detail="文生图模型未加载")
    
    # 检查配额（按生成图片数量消耗配额）
    if settings.quota.enabled:
        # 管理员不受配额限制
        if not (settings.quota.admin_unlimited and current_user.is_admin):
            allowed, message, remaining = await check_and_update_quota(current_user.id, count=num_images)
            if not allowed:
                raise HTTPException(status_code=429, detail=message)
            logger.info(f"配额检查通过 | 用户: {current_user.username} | 消耗: {num_images} | 今日剩余: {remaining}")
    
    # 获取宽高比对应的尺寸
    width, height = settings.get_aspect_ratio_size(aspect_ratio)
    
    logger.info(f"收到文生图请求 | prompt: {prompt[:50]}... | async: {async_mode}")
    
    task_queue = get_task_queue()
    
    # 任务参数
    task_parameters = {
        "width": width,
        "height": height,
        "aspect_ratio": aspect_ratio,
        "num_inference_steps": num_inference_steps,
        "true_cfg_scale": true_cfg_scale,
        "seed": seed,
        "num_images": num_images,
    }
    
    # 提交任务到队列
    task_id = await task_queue.submit(
        _run_text_to_image_inference,
        prompt=prompt,
        negative_prompt=negative_prompt,
        width=width,
        height=height,
        num_inference_steps=num_inference_steps,
        true_cfg_scale=true_cfg_scale,
        seed=seed,
        num_images=num_images,
        user_id=current_user.id,  # 用于按用户组织存储目录
        # 任务元数据（用于持久化到数据库）
        _task_type="text_to_image",
        _parameters=task_parameters,
        _user_id=current_user.id,
    )
    
    if async_mode:
        # 异步模式：返回任务ID
        queue_info = task_queue.get_queue_info()
        return JSONResponse(
            status_code=202,  # Accepted
            content={
                "message": "任务已提交",
                "task_id": task_id,
                "status_url": f"/tasks/{task_id}",
                "result_url": f"/tasks/{task_id}/result",
                "queue_info": {
                    "pending_tasks": queue_info["tasks"]["pending"],
                    "running_tasks": queue_info["tasks"]["running"],
                }
            }
        )
    else:
        # 同步模式：等待任务完成
        try:
            task_result = await task_queue.get_task_result(task_id, timeout=600)
            
            if not task_result:
                raise HTTPException(status_code=500, detail="任务结果获取失败")
            
            if task_result.status == TaskStatus.FAILED:
                raise HTTPException(status_code=500, detail=f"生成失败: {task_result.error}")
            
            if task_result.status != TaskStatus.COMPLETED:
                raise HTTPException(status_code=408, detail="任务超时")
            
            result = task_result.result
            return FileResponse(
                result["file_path"],
                media_type=result["media_type"],
                filename=result["filename"],
            )
            
        except Exception as e:
            logger.error(f"图像生成失败: {e}")
            raise HTTPException(status_code=500, detail=f"生成失败: {str(e)}")


@router.get("/aspect-ratios")
async def get_aspect_ratios():
    """获取支持的宽高比及其对应尺寸"""
    return settings.aspect_ratios
