"""
图像编辑路由模块

支持异步任务队列模式，避免推理阻塞服务器
"""

import gc
import uuid
import io
import base64
from typing import Dict, Any, List

import torch
from PIL import Image
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, Response
from fastapi.responses import FileResponse, JSONResponse

from ..config import settings
from ..models import get_model_manager
from ..models.database import User
from ..services import get_task_queue, TaskStatus
from ..services.auth import get_current_user
from ..services.task_history import check_and_update_quota
from ..utils.logger import get_logger
from ..utils.image_utils import (
    read_and_validate_image,
    save_images_to_temp,
    create_zip_from_images,
)
from ..utils.memory_utils import cleanup_memory, log_memory_status

logger = get_logger(__name__)
router = APIRouter(prefix="/image-edit", tags=["图像编辑"])


def _serialize_images(pil_images: List[Image.Image]) -> List[str]:
    """将PIL图像序列化为base64字符串，以便在线程间传递"""
    serialized = []
    for img in pil_images:
        buffer = io.BytesIO()
        img.save(buffer, format="PNG")
        buffer.seek(0)
        serialized.append(base64.b64encode(buffer.read()).decode("utf-8"))
    return serialized


def _deserialize_images(serialized: List[str]) -> List[Image.Image]:
    """从base64字符串反序列化为PIL图像"""
    images = []
    for s in serialized:
        buffer = io.BytesIO(base64.b64decode(s))
        images.append(Image.open(buffer).convert("RGB"))
    return images


def _run_image_edit_inference(
    serialized_images: List[str],
    prompt: str,
    negative_prompt: str,
    num_inference_steps: int,
    true_cfg_scale: float,
    guidance_scale: float,
    seed: int,
    num_images: int,
    user_id: int = None,
    **kwargs
) -> Dict[str, Any]:
    """
    执行图像编辑推理（同步函数，在线程池中运行）
    """
    model_manager = get_model_manager()
    
    if not model_manager.is_image_edit_loaded:
        raise RuntimeError("图像编辑模型未加载")
    
    # 反序列化图像
    pil_images = _deserialize_images(serialized_images)
    
    # 获取随机数生成器
    generator = model_manager.get_generator(seed)
    
    logger.info(f"[推理] 开始编辑图像 | prompt: {prompt[:50]}... | 输入图像数: {len(pil_images)}")
    
    result = None
    output_images = None
    saved_images = None
    return_value = None
    
    try:
        with torch.inference_mode():
            result = model_manager.image_edit_pipeline(
                image=pil_images,
                prompt=prompt,
                negative_prompt=negative_prompt if negative_prompt else None,
                generator=generator,
                true_cfg_scale=true_cfg_scale,
                guidance_scale=guidance_scale,
                num_inference_steps=num_inference_steps,
                num_images_per_prompt=num_images,
            )
        
        # 清理输入图像
        for img in pil_images:
            if hasattr(img, 'close'):
                img.close()
        pil_images.clear()
        del pil_images
        pil_images = None
        
        # 立即复制图像列表
        output_images = list(result.images)
        
        # 清理 result 对象
        if hasattr(result, 'images'):
            result.images.clear() if hasattr(result.images, 'clear') else None
        del result
        result = None
        
        logger.info(f"[推理] 图像编辑成功 | 数量: {len(output_images)}")
        
        # 保存图像到持久化目录
        saved_images = save_images_to_temp(output_images, prefix="edited", user_id=user_id)
        
        # 关闭输出图像
        for img in output_images:
            if hasattr(img, 'close'):
                img.close()
        output_images.clear()
        del output_images
        output_images = None
        
        if len(saved_images) == 1:
            filepath, filename = saved_images[0]
            return_value = {
                "file_path": filepath,
                "media_type": "image/png",
                "filename": filename,
            }
        else:
            image_paths = [path for path, _ in saved_images]
            zip_path = create_zip_from_images(image_paths, user_id=user_id)
            
            return_value = {
                "file_path": zip_path,
                "media_type": "application/zip",
                "filename": f"edited_images_{uuid.uuid4().hex[:8]}.zip",
            }
        
        return return_value
        
    finally:
        # 确保所有变量被清理
        if result is not None:
            del result
        if output_images is not None:
            for img in output_images:
                if hasattr(img, 'close'):
                    img.close()
            del output_images
        if pil_images is not None:
            for img in pil_images:
                if hasattr(img, 'close'):
                    img.close()
            del pil_images
        if generator is not None:
            del generator
        
        # 多轮垃圾回收
        for _ in range(3):
            gc.collect()
        
        if torch.cuda.is_available():
            torch.cuda.synchronize()
            torch.cuda.empty_cache()
        
        # 清理 Pipeline 内部缓存
        try:
            model_manager.clear_pipeline_cache()
        except Exception as e:
            logger.warning(f"清理 pipeline 缓存失败: {e}")
        
        log_memory_status("[图像编辑] 推理完成后")


def _run_batch_edit_inference(
    serialized_image: str,
    prompt_list: List[str],
    negative_prompt: str,
    num_inference_steps: int,
    true_cfg_scale: float,
    seed: int,
    user_id: int = None,
    **kwargs
) -> Dict[str, Any]:
    """
    执行批量图像编辑推理（同步函数，在线程池中运行）
    """
    model_manager = get_model_manager()
    
    if not model_manager.is_image_edit_loaded:
        raise RuntimeError("图像编辑模型未加载")
    
    # 反序列化图像
    pil_image = _deserialize_images([serialized_image])[0]
    
    # 获取随机数生成器
    generator = model_manager.get_generator(seed)
    
    logger.info(f"[推理] 开始批量编辑 | 提示数: {len(prompt_list)}")
    
    all_saved_images = []
    
    try:
        for i, prompt in enumerate(prompt_list):
            logger.info(f"[推理] 处理提示 {i+1}/{len(prompt_list)}: {prompt[:30]}...")
            
            result = None
            output_images = None
            try:
                with torch.inference_mode():
                    result = model_manager.image_edit_pipeline(
                        image=[pil_image],
                        prompt=prompt,
                        negative_prompt=negative_prompt if negative_prompt else None,
                        generator=generator,
                        true_cfg_scale=true_cfg_scale,
                        guidance_scale=1.0,
                        num_inference_steps=num_inference_steps,
                        num_images_per_prompt=1,
                    )
                
                # 复制图像列表
                output_images = list(result.images)
                
                # 清理 result
                if hasattr(result, 'images'):
                    result.images.clear() if hasattr(result.images, 'clear') else None
                del result
                result = None
                
                # 保存结果到持久化目录
                saved = save_images_to_temp(output_images, prefix=f"batch_{i}", user_id=user_id)
                all_saved_images.extend(saved)
                
                # 关闭输出图像
                for img in output_images:
                    if hasattr(img, 'close'):
                        img.close()
                output_images.clear()
                
            finally:
                # 每次迭代后清理
                if result is not None:
                    del result
                if output_images is not None:
                    del output_images
                
                gc.collect()
                if torch.cuda.is_available():
                    torch.cuda.empty_cache()
        
        logger.info(f"[推理] 批量编辑完成 | 总输出: {len(all_saved_images)}")
        
        # 打包所有结果
        image_paths = [path for path, _ in all_saved_images]
        zip_path = create_zip_from_images(image_paths, user_id=user_id)
        
        return {
            "file_path": zip_path,
            "media_type": "application/zip",
            "filename": f"batch_edit_{uuid.uuid4().hex[:8]}.zip",
        }
    finally:
        # 最终清理
        if pil_image is not None:
            if hasattr(pil_image, 'close'):
                pil_image.close()
            del pil_image
        if generator is not None:
            del generator
        
        # 多轮垃圾回收
        for _ in range(3):
            gc.collect()
        
        if torch.cuda.is_available():
            torch.cuda.synchronize()
            torch.cuda.empty_cache()
        
        # 清理 Pipeline 内部缓存
        try:
            model_manager.clear_pipeline_cache()
        except Exception as e:
            logger.warning(f"清理 pipeline 缓存失败: {e}")
        
        log_memory_status("[批量编辑] 推理完成后")


@router.post("", response_model=None)
async def edit_image(
    images: List[UploadFile] = File(..., description="上传的图像文件（支持1-2张）"),
    prompt: str = Form(..., description="编辑图像的描述文本"),
    negative_prompt: str = Form("", description="不希望出现在图像中的内容"),
    num_inference_steps: int = Form(40, ge=20, le=100, description="推理步数"),
    true_cfg_scale: float = Form(4.0, ge=1.0, le=10.0, description="CFG尺度参数"),
    guidance_scale: float = Form(1.0, ge=1.0, le=10.0, description="指导尺度"),
    seed: int = Form(-1, description="随机种子，-1表示随机生成"),
    num_images: int = Form(1, ge=1, le=4, description="生成图像数量"),
    async_mode: bool = Form(True, description="是否使用异步模式（返回任务ID）"),
    current_user: User = Depends(get_current_user),
) -> Response:
    """
    图像编辑端点：基于上传的图像进行编辑
    
    **异步模式** (async_mode=True，默认)：
    - 返回任务ID，通过 /tasks/{task_id} 查询状态
    - 通过 /tasks/{task_id}/result 获取结果
    
    **同步模式** (async_mode=False)：
    - 等待任务完成直接返回图像
    
    参数说明：
    - **images**: 上传1-2张图像作为编辑基础
    - **prompt**: 描述要进行的编辑操作
    - **negative_prompt**: 描述不希望出现的内容
    - **num_inference_steps**: 推理步数
    - **true_cfg_scale**: CFG尺度
    - **guidance_scale**: 指导尺度
    - **seed**: 随机种子
    - **num_images**: 生成图像数量
    - **async_mode**: 是否使用异步模式
    """
    model_manager = get_model_manager()
    
    # 在 process 模式下，主进程不加载模型，跳过检查
    if settings.task_queue.execution_mode != "process" and not model_manager.is_image_edit_loaded:
        raise HTTPException(status_code=503, detail="图像编辑模型未加载")
    
    # 检查配额（按生成图片数量消耗配额）
    
    # 检查配额（按生成图片数量消耗配额）
    if settings.quota.enabled:
        # 管理员不受配额限制
        if not (settings.quota.admin_unlimited and current_user.is_admin):
            allowed, message, remaining = await check_and_update_quota(current_user.id, count=num_images)
            if not allowed:
                raise HTTPException(status_code=429, detail=message)
            logger.info(f"配额检查通过 | 用户: {current_user.username} | 消耗: {num_images} | 今日剩余: {remaining}")
    
    # 验证图像数量
    if len(images) > 2:
        raise HTTPException(status_code=400, detail="最多上传2张图像")
    
    if len(images) == 0:
        raise HTTPException(status_code=400, detail="请至少上传1张图像")
    
    # 读取并验证图像
    pil_images = []
    for image_file in images:
        pil_image = await read_and_validate_image(
            image_file,
            allowed_types=settings.security.allowed_image_types,
            max_size_mb=settings.security.max_upload_size_mb,
        )
        pil_images.append(pil_image)
    
    # 序列化图像以便在线程间传递
    serialized_images = _serialize_images(pil_images)
    
    logger.info(f"收到图像编辑请求 | prompt: {prompt[:50]}... | async: {async_mode}")
    
    task_queue = get_task_queue()
    
    # 任务参数
    task_parameters = {
        "num_inference_steps": num_inference_steps,
        "true_cfg_scale": true_cfg_scale,
        "guidance_scale": guidance_scale,
        "seed": seed,
        "num_images": num_images,
        "input_images_count": len(images),
    }
    
    # 提交任务到队列
    task_id = await task_queue.submit(
        _run_image_edit_inference,
        serialized_images=serialized_images,
        prompt=prompt,
        negative_prompt=negative_prompt,
        num_inference_steps=num_inference_steps,
        true_cfg_scale=true_cfg_scale,
        guidance_scale=guidance_scale,
        seed=seed,
        num_images=num_images,
        user_id=current_user.id,  # 用于按用户组织存储目录
        # 任务元数据
        _task_type="image_edit",
        _parameters=task_parameters,
        _user_id=current_user.id,
    )
    
    if async_mode:
        # 异步模式：返回任务ID
        queue_info = task_queue.get_queue_info()
        return JSONResponse(
            status_code=202,
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
                raise HTTPException(status_code=500, detail=f"编辑失败: {task_result.error}")
            
            if task_result.status != TaskStatus.COMPLETED:
                raise HTTPException(status_code=408, detail="任务超时")
            
            result = task_result.result
            return FileResponse(
                result["file_path"],
                media_type=result["media_type"],
                filename=result["filename"],
            )
            
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"图像编辑失败: {e}")
            raise HTTPException(status_code=500, detail=f"编辑失败: {str(e)}")


@router.post("/batch", response_model=None)
async def batch_edit(
    image: UploadFile = File(..., description="上传的单张图像文件"),
    prompts: str = Form(..., description="多个编辑提示，用|分隔"),
    negative_prompt: str = Form("", description="不希望出现在图像中的内容"),
    num_inference_steps: int = Form(40, ge=20, le=100, description="推理步数"),
    true_cfg_scale: float = Form(4.0, ge=1.0, le=10.0, description="CFG尺度参数"),
    seed: int = Form(-1, description="随机种子，-1表示随机生成"),
    async_mode: bool = Form(True, description="是否使用异步模式（返回任务ID）"),
    current_user: User = Depends(get_current_user),
) -> Response:
    """
    批量编辑端点：对同一张图像应用多个编辑提示
    
    **异步模式** (async_mode=True，默认)：
    - 返回任务ID，通过 /tasks/{task_id} 查询状态
    - 通过 /tasks/{task_id}/result 获取结果
    
    **同步模式** (async_mode=False)：
    - 等待任务完成直接返回结果ZIP
    
    参数说明：
    - **image**: 上传单张图像
    - **prompts**: 多个编辑提示，用|分隔（例如："添加帽子|改变背景为海滩|添加太阳镜"）
    - **negative_prompt**: 描述不希望出现的内容
    - **num_inference_steps**: 推理步数
    - **seed**: 随机种子
    - **async_mode**: 是否使用异步模式
    
    返回包含所有编辑结果的ZIP文件
    """
    model_manager = get_model_manager()
    
    # 在 process 模式下，主进程不加载模型，跳过检查
    if settings.task_queue.execution_mode != "process" and not model_manager.is_image_edit_loaded:
        raise HTTPException(status_code=503, detail="图像编辑模型未加载")
    
    # 检查配额（按生成图片数量消耗配额）
    
    # 解析提示列表
    prompt_list = [p.strip() for p in prompts.split("|") if p.strip()]
    
    if not prompt_list:
        raise HTTPException(status_code=400, detail="请提供至少一个有效的编辑提示")
    
    if len(prompt_list) > settings.generation.max_batch_prompts:
        raise HTTPException(
            status_code=400,
            detail=f"批量编辑提示数量不能超过 {settings.generation.max_batch_prompts}"
        )
    
    # 检查配额（批量编辑消耗的配额 = 提示数量，每个提示生成一张图）
    if settings.quota.enabled:
        # 管理员不受配额限制
        if not (settings.quota.admin_unlimited and current_user.is_admin):
            quota_count = len(prompt_list)
            allowed, message, remaining = await check_and_update_quota(current_user.id, count=quota_count)
            if not allowed:
                raise HTTPException(status_code=429, detail=message)
            logger.info(f"配额检查通过 | 用户: {current_user.username} | 消耗: {quota_count} | 今日剩余: {remaining}")
    
    # 读取并验证图像
    pil_image = await read_and_validate_image(
        image,
        allowed_types=settings.security.allowed_image_types,
        max_size_mb=settings.security.max_upload_size_mb,
    )
    
    # 序列化图像
    serialized_image = _serialize_images([pil_image])[0]
    
    logger.info(f"收到批量编辑请求 | 提示数: {len(prompt_list)} | async: {async_mode}")
    
    task_queue = get_task_queue()
    
    # 任务参数
    task_parameters = {
        "num_inference_steps": num_inference_steps,
        "true_cfg_scale": true_cfg_scale,
        "seed": seed,
        "prompts_count": len(prompt_list),
    }
    
    # 提交任务到队列（批量编辑的 prompt 使用第一个提示作为代表）
    task_id = await task_queue.submit(
        _run_batch_edit_inference,
        serialized_image=serialized_image,
        prompt_list=prompt_list,
        negative_prompt=negative_prompt,
        num_inference_steps=num_inference_steps,
        true_cfg_scale=true_cfg_scale,
        seed=seed,
        user_id=current_user.id,  # 用于按用户组织存储目录
        # 任务元数据
        _task_type="batch_edit",
        _prompt=prompt_list[0] if prompt_list else "",
        _negative_prompt=negative_prompt if negative_prompt else None,
        _parameters=task_parameters,
        _user_id=current_user.id,
    )
    
    if async_mode:
        # 异步模式：返回任务ID
        queue_info = task_queue.get_queue_info()
        return JSONResponse(
            status_code=202,
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
            task_result = await task_queue.get_task_result(task_id, timeout=1800)  # 批量任务给更长时间
            
            if not task_result:
                raise HTTPException(status_code=500, detail="任务结果获取失败")
            
            if task_result.status == TaskStatus.FAILED:
                raise HTTPException(status_code=500, detail=f"批量编辑失败: {task_result.error}")
            
            if task_result.status != TaskStatus.COMPLETED:
                raise HTTPException(status_code=408, detail="任务超时")
            
            result = task_result.result
            return FileResponse(
                result["file_path"],
                media_type=result["media_type"],
                filename=result["filename"],
            )
            
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"批量编辑失败: {e}")
            raise HTTPException(status_code=500, detail=f"批量编辑失败: {str(e)}")
