"""
推理工作进程脚本

此脚本独立运行，用于在隔离的进程中执行推理任务，
确保任务完成后能彻底释放所有显存和内存资源。
"""

import argparse
import json
import sys
import asyncio
import traceback
from typing import Dict, Any

from app.config import settings
from app.models import get_model_manager
from app.utils.logger import init_logging, get_logger

# 初始化日志
init_logging(
    level=settings.logging.level,
    log_format=settings.logging.format,
    file_enabled=settings.logging.file_enabled,
    file_path=settings.logging.file_path,
)
logger = get_logger("inference_worker")

async def run_worker(task_type: str, args_file: str, output_file: str):
    """运行推理任务"""
    logger.info(f"Worker process started | Task Type: {task_type}")
    
    # 1. 读取参数
    try:
        with open(args_file, "r", encoding="utf-8") as f:
            kwargs = json.load(f)
    except Exception as e:
        logger.error(f"Failed to load arguments: {e}")
        error_output = {"status": "failed", "error": f"Load args failed: {str(e)}"}
        with open(output_file, "w", encoding="utf-8") as f:
            json.dump(error_output, f)
        return

    model_manager = get_model_manager()
    result = None

    try:
        # 2. 按需加载模型
        if task_type == "text_to_image":
            # 导入具体的推理逻辑
            # 注意：我们需要手动加载模型，因为主进程没有加载
            await model_manager._load_text_to_image_model()
            
            # 导入推理函数 (避免循环导入，延迟导入)
            from app.routers.text_to_image import _run_text_to_image_inference
            
            # 运行推理
            # 注意：_run_text_to_image_inference 是同步函数，但在 worker 中直接调用即可
            result = _run_text_to_image_inference(**kwargs)
            
        elif task_type == "image_edit":
            await model_manager._load_image_edit_model()
            from app.routers.image_edit import _run_image_edit_inference
            result = _run_image_edit_inference(**kwargs)
            
        elif task_type == "batch_edit":
            await model_manager._load_image_edit_model()
            from app.routers.image_edit import _run_batch_edit_inference
            result = _run_batch_edit_inference(**kwargs)
            
        else:
            raise ValueError(f"Unknown task type: {task_type}")

        # 3. 输出结果
        # 如果成功，result 应该是一个包含 file_path 等信息的字典
        output = {
            "status": "completed",
            "result": result
        }
        with open(output_file, "w", encoding="utf-8") as f:
            json.dump(output, f)
        logger.info("Worker task completed successfully")

    except Exception as e:
        logger.error(f"Worker execution failed: {e}")
        traceback.print_exc()
        output = {
            "status": "failed",
            "error": str(e)
        }
        with open(output_file, "w", encoding="utf-8") as f:
            json.dump(output, f)
    
    finally:
        # 4. 显式清理 (虽然进程退出会释放资源，但为了日志好看)
        await model_manager.unload_models()

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--task-type", required=True, help="Task type (text_to_image, image_edit, etc)")
    parser.add_argument("--args-file", required=True, help="Path to JSON file containing arguments")
    parser.add_argument("--output-file", required=True, help="Path to write output JSON")
    args = parser.parse_args()

    asyncio.run(run_worker(args.task_type, args.args_file, args.output_file))
