export interface ApiError {
  detail: string
}

export interface HealthResponse {
  status: string
  text_to_image_model_loaded: boolean
  image_edit_model_loaded: boolean
  gpu_available: boolean
  gpu_count: number
}

export interface AspectRatios {
  [key: string]: [number, number]
}

export interface TextToImageParams {
  prompt: string
  negative_prompt?: string
  aspect_ratio?: string
  num_inference_steps?: number
  true_cfg_scale?: number
  seed?: number
  num_images?: number
  async_mode?: boolean
}

export interface ImageEditParams {
  images: File[]
  prompt: string
  negative_prompt?: string
  num_inference_steps?: number
  true_cfg_scale?: number
  guidance_scale?: number
  seed?: number
  num_images?: number
  async_mode?: boolean
}

export interface BatchEditParams {
  image: File
  prompts: string
  negative_prompt?: string
  num_inference_steps?: number
  true_cfg_scale?: number
  seed?: number
  async_mode?: boolean
}
