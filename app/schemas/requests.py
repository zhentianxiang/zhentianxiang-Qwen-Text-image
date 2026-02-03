"""
请求和响应数据模型
"""

from typing import List, Optional
from pydantic import BaseModel, Field


class TextToImageRequest(BaseModel):
    """文生图请求参数"""
    
    prompt: str = Field(..., description="生成图像的描述文本")
    negative_prompt: str = Field(default="", description="不希望出现在图像中的内容")
    aspect_ratio: str = Field(default="1:1", description="图像宽高比")
    num_inference_steps: int = Field(default=50, ge=20, le=100, description="推理步数")
    true_cfg_scale: float = Field(default=4.0, ge=1.0, le=10.0, description="CFG尺度参数")
    seed: int = Field(default=-1, description="随机种子，-1表示随机生成")
    num_images: int = Field(default=1, ge=1, le=4, description="生成图像数量")


class ImageEditRequest(BaseModel):
    """图像编辑请求参数"""
    
    prompt: str = Field(..., description="编辑图像的描述文本")
    negative_prompt: str = Field(default="", description="不希望出现在图像中的内容")
    num_inference_steps: int = Field(default=40, ge=20, le=100, description="推理步数")
    true_cfg_scale: float = Field(default=4.0, ge=1.0, le=10.0, description="CFG尺度参数")
    guidance_scale: float = Field(default=1.0, ge=1.0, le=10.0, description="指导尺度")
    seed: int = Field(default=-1, description="随机种子，-1表示随机生成")
    num_images: int = Field(default=1, ge=1, le=4, description="生成图像数量")


class BatchEditRequest(BaseModel):
    """批量编辑请求参数"""
    
    prompts: List[str] = Field(..., description="多个编辑提示")
    negative_prompt: str = Field(default="", description="不希望出现在图像中的内容")
    num_inference_steps: int = Field(default=40, ge=20, le=100, description="推理步数")
    seed: int = Field(default=-1, description="随机种子，-1表示随机生成")


class HealthResponse(BaseModel):
    """健康检查响应"""
    
    status: str = Field(..., description="服务状态")
    text_to_image_model_loaded: bool = Field(..., description="文生图模型是否加载")
    image_edit_model_loaded: bool = Field(..., description="图像编辑模型是否加载")
    gpu_available: bool = Field(..., description="GPU是否可用")
    gpu_count: int = Field(..., description="GPU数量")


class ModelInfo(BaseModel):
    """模型信息"""
    
    name: str = Field(..., description="模型名称")
    description: str = Field(..., description="模型描述")
    capabilities: List[str] = Field(..., description="模型能力")
    status: str = Field(..., description="模型状态")


class ModelsResponse(BaseModel):
    """模型列表响应"""
    
    text_to_image: ModelInfo = Field(..., description="文生图模型信息")
    image_edit: ModelInfo = Field(..., description="图像编辑模型信息")


class GenerationResult(BaseModel):
    """图像生成结果"""
    
    success: bool = Field(..., description="是否成功")
    message: str = Field(default="", description="消息")
    image_count: int = Field(default=0, description="生成的图像数量")
    filenames: List[str] = Field(default_factory=list, description="文件名列表")
