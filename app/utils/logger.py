"""
日志配置模块

统一配置所有模块的日志输出到控制台和文件
"""

import logging
import sys
from pathlib import Path
from typing import Optional


# 全局配置
_initialized = False
_file_handler: Optional[logging.FileHandler] = None
_console_handler: Optional[logging.StreamHandler] = None
_log_level = logging.INFO
_log_format = "%(asctime)s - %(name)s - %(levelname)s - %(message)s"


def init_logging(
    level: str = "INFO",
    log_format: Optional[str] = None,
    file_enabled: bool = False,
    file_path: Optional[str] = None,
) -> None:
    """
    初始化全局日志配置
    
    所有通过 get_logger() 获取的 logger 都会使用这个配置
    
    Args:
        level: 日志级别
        log_format: 日志格式
        file_enabled: 是否启用文件日志
        file_path: 日志文件路径
    """
    global _initialized, _file_handler, _console_handler, _log_level, _log_format
    
    if _initialized:
        return
    
    _log_level = getattr(logging, level.upper(), logging.INFO)
    
    if log_format:
        _log_format = log_format
    
    formatter = logging.Formatter(_log_format)
    
    # 控制台处理器
    _console_handler = logging.StreamHandler(sys.stdout)
    _console_handler.setFormatter(formatter)
    _console_handler.setLevel(_log_level)
    
    # 文件处理器（可选）
    if file_enabled and file_path:
        log_dir = Path(file_path).parent
        log_dir.mkdir(parents=True, exist_ok=True)
        
        _file_handler = logging.FileHandler(file_path, encoding="utf-8")
        _file_handler.setFormatter(formatter)
        _file_handler.setLevel(_log_level)
    
    # 配置根 logger，让所有子 logger 继承
    root_logger = logging.getLogger()
    root_logger.setLevel(_log_level)
    
    # 清除已有的 handlers
    root_logger.handlers.clear()
    
    # 添加处理器到根 logger
    root_logger.addHandler(_console_handler)
    if _file_handler:
        root_logger.addHandler(_file_handler)
    
    _initialized = True


def setup_logger(
    name: str = "qwen_image",
    level: str = "INFO",
    log_format: Optional[str] = None,
    file_path: Optional[str] = None,
) -> logging.Logger:
    """
    设置并返回logger（向后兼容）
    
    首次调用时会初始化全局日志配置
    
    Args:
        name: logger名称
        level: 日志级别
        log_format: 日志格式
        file_path: 日志文件路径（可选）
    
    Returns:
        配置好的logger实例
    """
    # 如果是首次调用，初始化全局配置
    if not _initialized:
        init_logging(
            level=level,
            log_format=log_format,
            file_enabled=bool(file_path),
            file_path=file_path,
        )
    
    return logging.getLogger(name)


def get_logger(name: str = "qwen_image") -> logging.Logger:
    """
    获取logger实例
    
    如果全局日志未初始化，会使用默认配置
    """
    if not _initialized:
        # 尝试从配置中初始化
        try:
            from ..config import settings
            init_logging(
                level=settings.logging.level,
                log_format=settings.logging.format,
                file_enabled=settings.logging.file_enabled,
                file_path=settings.logging.file_path,
            )
        except Exception:
            # 使用默认配置
            init_logging()
    
    return logging.getLogger(name)
