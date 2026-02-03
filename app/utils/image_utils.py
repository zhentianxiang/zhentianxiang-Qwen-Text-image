"""
图像处理工具模块
"""

import os
import io
import uuid
import time
import zipfile
import tempfile
from datetime import datetime
from pathlib import Path
from typing import List, Optional, Tuple

from PIL import Image
from fastapi import UploadFile, HTTPException

from .logger import get_logger
from ..config import settings

logger = get_logger(__name__)


def get_output_dir(user_id: Optional[int] = None) -> Path:
    """
    获取输出目录路径
    
    根据配置决定是否按日期和用户组织目录
    
    Args:
        user_id: 用户ID（可选）
    
    Returns:
        输出目录的 Path 对象
    """
    base_dir = Path(settings.storage.output_dir)
    
    # 确保基础目录存在
    base_dir.mkdir(parents=True, exist_ok=True)
    
    output_path = base_dir
    
    # 按日期组织
    if settings.storage.organize_by_date:
        date_str = datetime.now().strftime("%Y/%m/%d")
        output_path = output_path / date_str
    
    # 按用户组织
    if settings.storage.organize_by_user and user_id:
        output_path = output_path / f"user_{user_id}"
    
    # 确保目录存在
    output_path.mkdir(parents=True, exist_ok=True)
    
    return output_path


def validate_image_file(
    file: UploadFile,
    allowed_types: List[str],
    max_size_mb: int,
) -> None:
    """
    验证上传的图像文件
    
    Args:
        file: 上传的文件
        allowed_types: 允许的MIME类型列表
        max_size_mb: 最大文件大小（MB）
    
    Raises:
        HTTPException: 验证失败时抛出
    """
    # 检查文件类型
    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=400,
            detail=f"不支持的文件类型: {file.content_type}。支持的类型: {allowed_types}"
        )
    
    # 检查文件大小（需要先读取内容）
    # 注意：这会消耗文件内容，调用后需要重置文件指针或使用返回的内容


async def read_and_validate_image(
    file: UploadFile,
    allowed_types: List[str],
    max_size_mb: int,
) -> Image.Image:
    """
    读取并验证上传的图像
    
    Args:
        file: 上传的文件
        allowed_types: 允许的MIME类型列表
        max_size_mb: 最大文件大小（MB）
    
    Returns:
        PIL Image对象
    
    Raises:
        HTTPException: 验证失败或读取失败时抛出
    """
    # 检查文件类型
    if file.content_type and file.content_type not in allowed_types:
        raise HTTPException(
            status_code=400,
            detail=f"不支持的文件类型: {file.content_type}。支持的类型: {allowed_types}"
        )
    
    # 读取文件内容
    content = await file.read()
    
    # 检查文件大小
    max_size_bytes = max_size_mb * 1024 * 1024
    if len(content) > max_size_bytes:
        raise HTTPException(
            status_code=400,
            detail=f"文件大小超过限制: {len(content) / 1024 / 1024:.2f}MB > {max_size_mb}MB"
        )
    
    # 尝试打开图像
    try:
        image = Image.open(io.BytesIO(content)).convert("RGB")
        return image
    except Exception as e:
        logger.error(f"无法打开图像文件: {e}")
        raise HTTPException(
            status_code=400,
            detail=f"无法解析图像文件: {str(e)}"
        )


def save_image_to_temp(
    image: Image.Image,
    prefix: str = "generated",
    format: str = "PNG",
    user_id: Optional[int] = None,
) -> Tuple[str, str]:
    """
    保存图像到持久化目录
    
    Args:
        image: PIL Image对象
        prefix: 文件名前缀
        format: 图像格式
        user_id: 用户ID（可选，用于按用户组织目录）
    
    Returns:
        (文件路径, 文件名) 元组
    """
    # 使用持久化输出目录
    output_dir = get_output_dir(user_id)
    
    # 生成唯一文件名（包含时间戳和UUID）
    timestamp = datetime.now().strftime("%H%M%S")
    filename = f"{prefix}_{timestamp}_{uuid.uuid4().hex[:8]}.{format.lower()}"
    filepath = output_dir / filename
    
    image.save(str(filepath), format)
    logger.debug(f"图像已保存到: {filepath}")
    
    return str(filepath), filename


def save_images_to_temp(
    images: List[Image.Image],
    prefix: str = "generated",
    format: str = "PNG",
    user_id: Optional[int] = None,
) -> List[Tuple[str, str]]:
    """
    批量保存图像到持久化目录
    
    Args:
        images: PIL Image对象列表
        prefix: 文件名前缀
        format: 图像格式
        user_id: 用户ID（可选，用于按用户组织目录）
    
    Returns:
        [(文件路径, 文件名), ...] 列表
    """
    results = []
    for i, image in enumerate(images):
        filepath, filename = save_image_to_temp(
            image,
            prefix=f"{prefix}_{i}",
            format=format,
            user_id=user_id,
        )
        results.append((filepath, filename))
    return results


def create_zip_from_images(
    image_paths: List[str],
    zip_name: Optional[str] = None,
    user_id: Optional[int] = None,
) -> str:
    """
    将多个图像文件打包成ZIP
    
    Args:
        image_paths: 图像文件路径列表
        zip_name: ZIP文件名（可选）
        user_id: 用户ID（可选，用于确定保存目录）
    
    Returns:
        ZIP文件路径
    """
    # 使用持久化输出目录
    output_dir = get_output_dir(user_id)
    
    if zip_name is None:
        timestamp = datetime.now().strftime("%H%M%S")
        zip_name = f"images_{timestamp}_{uuid.uuid4().hex[:8]}.zip"
    
    zip_path = output_dir / zip_name
    
    with zipfile.ZipFile(str(zip_path), "w", zipfile.ZIP_DEFLATED) as zipf:
        for path in image_paths:
            if os.path.exists(path):
                arcname = os.path.basename(path)
                zipf.write(path, arcname)
    
    logger.debug(f"ZIP文件已创建: {zip_path}")
    return str(zip_path)


def cleanup_old_output_files(
    max_age_days: Optional[int] = None,
    patterns: Optional[List[str]] = None,
) -> int:
    """
    清理过期的输出文件
    
    Args:
        max_age_days: 文件最大保留天数（None 或 0 表示使用配置）
        patterns: 要清理的文件名模式列表
    
    Returns:
        清理的文件数量
    """
    # 使用配置的保留天数
    retention_days = max_age_days or settings.storage.retention_days
    
    # 如果为 0，表示永久保留，不清理
    if retention_days <= 0:
        logger.debug("文件保留天数设为0，跳过清理")
        return 0
    
    if patterns is None:
        patterns = ["generated_", "edited_", "batch_", "images_"]
    
    output_dir = Path(settings.storage.output_dir)
    
    if not output_dir.exists():
        return 0
    
    max_age_seconds = retention_days * 24 * 3600
    current_time = time.time()
    cleaned_count = 0
    
    try:
        # 递归遍历所有文件
        for filepath in output_dir.rglob("*"):
            if not filepath.is_file():
                continue
            
            # 检查文件名是否匹配模式
            if not any(filepath.name.startswith(p) for p in patterns):
                continue
            
            # 检查文件年龄
            file_age = current_time - filepath.stat().st_mtime
            if file_age > max_age_seconds:
                try:
                    filepath.unlink()
                    cleaned_count += 1
                    logger.debug(f"已清理过期文件: {filepath}")
                except OSError as e:
                    logger.warning(f"无法删除文件 {filepath}: {e}")
        
        # 清理空目录
        _cleanup_empty_dirs(output_dir)
    
    except Exception as e:
        logger.error(f"清理输出文件时出错: {e}")
    
    if cleaned_count > 0:
        logger.info(f"已清理 {cleaned_count} 个过期输出文件")
    
    return cleaned_count


def _cleanup_empty_dirs(base_dir: Path) -> None:
    """
    递归清理空目录
    
    Args:
        base_dir: 基础目录
    """
    for dirpath in sorted(base_dir.rglob("*"), reverse=True):
        if dirpath.is_dir():
            try:
                # 尝试删除空目录
                dirpath.rmdir()
                logger.debug(f"已清理空目录: {dirpath}")
            except OSError:
                # 目录非空，跳过
                pass


# 保留旧函数名作为别名，保持向后兼容
def cleanup_old_temp_files(
    max_age_hours: int = 24,
    patterns: Optional[List[str]] = None,
) -> int:
    """向后兼容：清理过期文件（调用新函数）"""
    max_age_days = max_age_hours // 24 if max_age_hours >= 24 else 1
    return cleanup_old_output_files(max_age_days=max_age_days, patterns=patterns)
