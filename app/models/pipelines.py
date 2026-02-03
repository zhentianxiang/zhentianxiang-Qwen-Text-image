"""
模型管理模块

负责加载和管理AI模型的生命周期
"""

from typing import Optional, Any
import torch

from ..utils.logger import get_logger
from ..config import settings

logger = get_logger(__name__)


class ModelManager:
    """
    模型管理器
    
    单例模式，负责管理文生图和图像编辑模型的加载和推理
    """
    
    _instance: Optional["ModelManager"] = None
    
    def __new__(cls) -> "ModelManager":
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialized = False
        return cls._instance
    
    def __init__(self):
        if self._initialized:
            return
        
        self._text_to_image_pipeline = None
        self._image_edit_pipeline = None
        self._device = None
        self._dtype = None
        self._initialized = True
    
    @property
    def text_to_image_pipeline(self) -> Optional[Any]:
        """文生图模型pipeline"""
        return self._text_to_image_pipeline
    
    @property
    def image_edit_pipeline(self) -> Optional[Any]:
        """图像编辑模型pipeline"""
        return self._image_edit_pipeline
    
    @property
    def device(self) -> str:
        """当前使用的设备"""
        if self._device is None:
            if settings.models.device == "cuda" and torch.cuda.is_available():
                self._device = "cuda"
            else:
                self._device = "cpu"
        return self._device
    
    @property
    def dtype(self) -> torch.dtype:
        """当前使用的数据类型"""
        if self._dtype is None:
            if self.device == "cuda":
                self._dtype = torch.bfloat16
            else:
                self._dtype = torch.float32
        return self._dtype
    
    @property
    def is_text_to_image_loaded(self) -> bool:
        """文生图模型是否已加载"""
        return self._text_to_image_pipeline is not None
    
    @property
    def is_image_edit_loaded(self) -> bool:
        """图像编辑模型是否已加载"""
        return self._image_edit_pipeline is not None
    
    @property
    def gpu_available(self) -> bool:
        """GPU是否可用"""
        return torch.cuda.is_available()
    
    @property
    def gpu_count(self) -> int:
        """可用GPU数量"""
        return torch.cuda.device_count() if self.gpu_available else 0
    
    async def load_models(self) -> None:
        """
        加载所有模型
        
        在应用启动时调用
        """
        logger.info("开始加载模型...")
        logger.info(f"使用设备: {self.device}, 数据类型: {self.dtype}")
        
        await self._load_text_to_image_model()
        await self._load_image_edit_model()
        
        logger.info("✅ 所有模型加载完成！")
    
    async def _load_text_to_image_model(self) -> None:
        """加载文生图模型"""
        try:
            logger.info(f"正在加载文生图模型: {settings.models.text_to_image_model}")
            
            from diffusers import DiffusionPipeline
            
            # 自动判断最佳加载策略
            device_map = None
            if self.device == "cuda" and self.gpu_count > 1:
                # 多卡环境：使用 balanced 策略分片模型
                device_map = "balanced"
                logger.info(f"检测到 {self.gpu_count} 张显卡，将使用 balanced 策略分片加载")
            
            self._text_to_image_pipeline = DiffusionPipeline.from_pretrained(
                settings.models.text_to_image_model,
                torch_dtype=self.dtype,
                trust_remote_code=True,
                device_map=device_map,
            )
            
            if self.device == "cuda":
                # 启用 VAE Tiling 和 Slicing 以节省显存（对生成高分辨率图像至关重要）
                try:
                    self._text_to_image_pipeline.enable_vae_tiling()
                    self._text_to_image_pipeline.enable_vae_slicing()
                    logger.info("已启用 VAE Tiling 和 Slicing")
                except Exception as e:
                    logger.warning(f"启用 VAE 优化失败: {e}")

                if self.gpu_count > 1:
                    logger.info(f"文生图模型已加载 (Device Map: Balanced, GPUs: {self.gpu_count})")
                else:
                    # 单卡环境：由于模型巨大(Qwen-Image)，即使 A40(48G) 也可能 OOM
                    # 必须使用 CPU Offload 来节省显存
                    self._text_to_image_pipeline.enable_model_cpu_offload()
                    self._text_to_image_pipeline.enable_attention_slicing()
                    logger.info("文生图模型已加载 (Single GPU with CPU Offload)")
            else:
                logger.info("文生图模型已加载 (CPU)")
            
        except Exception as e:
            logger.error(f"文生图模型加载失败: {e}")
            raise
    
    async def _load_image_edit_model(self) -> None:
        """加载图像编辑模型"""
        try:
            logger.info(f"正在加载图像编辑模型: {settings.models.image_edit_model}")
            
            from diffusers import QwenImageEditPlusPipeline
            
            # 自动判断最佳加载策略
            device_map = None
            if self.device == "cuda" and self.gpu_count > 1:
                device_map = "balanced"
            
            self._image_edit_pipeline = QwenImageEditPlusPipeline.from_pretrained(
                settings.models.image_edit_model,
                torch_dtype=self.dtype,
                trust_remote_code=True,
                device_map=device_map,
            )
            
            if self.device == "cuda":
                # 启用 VAE Tiling 和 Slicing 以节省显存
                try:
                    self._image_edit_pipeline.enable_vae_tiling()
                    self._image_edit_pipeline.enable_vae_slicing()
                    logger.info("已启用 VAE Tiling 和 Slicing")
                except Exception as e:
                    logger.warning(f"启用 VAE 优化失败: {e}")

                if self.gpu_count > 1:
                    logger.info(f"图像编辑模型已加载 (Device Map: Balanced, GPUs: {self.gpu_count})")
                else:
                    # 单卡环境：使用 CPU Offload
                    self._image_edit_pipeline.enable_model_cpu_offload()
                    self._image_edit_pipeline.enable_attention_slicing()
                    logger.info("图像编辑模型已加载 (Single GPU with CPU Offload)")
            else:
                logger.info("图像编辑模型已加载 (CPU)")
            
        except Exception as e:
            logger.error(f"图像编辑模型加载失败: {e}")
            raise
    
    async def unload_models(self) -> None:
        """
        卸载所有模型
        
        释放GPU内存
        """
        logger.info("正在卸载模型...")
        
        if self._text_to_image_pipeline is not None:
            del self._text_to_image_pipeline
            self._text_to_image_pipeline = None
        
        if self._image_edit_pipeline is not None:
            del self._image_edit_pipeline
            self._image_edit_pipeline = None
        
        # 清理GPU缓存
        if self.gpu_available:
            torch.cuda.empty_cache()
        
        logger.info("模型已卸载")
    
    def get_generator(self, seed: int = -1) -> Optional[torch.Generator]:
        """
        获取随机数生成器
        
        Args:
            seed: 随机种子，-1表示不使用固定种子
        
        Returns:
            torch.Generator 或 None
        """
        if seed == -1:
            return None
        
        generator = torch.Generator(device=self.device)
        generator.manual_seed(seed)
        return generator
    
    def clear_pipeline_cache(self) -> None:
        """
        清理 Pipeline 内部缓存
        
        在推理后调用以释放可能被缓存的中间张量
        """
        import gc
        
        # 清理文生图 pipeline 的缓存
        if self._text_to_image_pipeline is not None:
            # 清理 scheduler 的缓存
            if hasattr(self._text_to_image_pipeline, 'scheduler'):
                scheduler = self._text_to_image_pipeline.scheduler
                if hasattr(scheduler, 'sigmas'):
                    scheduler.sigmas = None
                if hasattr(scheduler, 'timesteps'):
                    scheduler.timesteps = None
        
        # 清理图像编辑 pipeline 的缓存
        if self._image_edit_pipeline is not None:
            if hasattr(self._image_edit_pipeline, 'scheduler'):
                scheduler = self._image_edit_pipeline.scheduler
                if hasattr(scheduler, 'sigmas'):
                    scheduler.sigmas = None
                if hasattr(scheduler, 'timesteps'):
                    scheduler.timesteps = None
        
        # 垃圾回收
        gc.collect()
        
        # 清理 CUDA 缓存
        if self.gpu_available:
            torch.cuda.empty_cache()
            torch.cuda.synchronize()
        
        logger.debug("Pipeline 缓存已清理")


# 全局单例
_model_manager: Optional[ModelManager] = None


def get_model_manager() -> ModelManager:
    """获取模型管理器单例"""
    global _model_manager
    if _model_manager is None:
        _model_manager = ModelManager()
    return _model_manager
