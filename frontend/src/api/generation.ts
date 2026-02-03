import apiClient from './client'
import type { TaskSubmitResponse, AspectRatios, TextToImageParams, ImageEditParams, BatchEditParams } from '@/types'

export const generationApi = {
  // 获取支持的宽高比
  getAspectRatios: async (): Promise<AspectRatios> => {
    const response = await apiClient.get<AspectRatios>('/text-to-image/aspect-ratios')
    return response.data
  },

  // 文生图
  textToImage: async (params: TextToImageParams): Promise<TaskSubmitResponse | Blob> => {
    const formData = new FormData()
    formData.append('prompt', params.prompt)
    if (params.negative_prompt) formData.append('negative_prompt', params.negative_prompt)
    if (params.aspect_ratio) formData.append('aspect_ratio', params.aspect_ratio)
    if (params.num_inference_steps) formData.append('num_inference_steps', params.num_inference_steps.toString())
    if (params.true_cfg_scale) formData.append('true_cfg_scale', params.true_cfg_scale.toString())
    if (params.seed !== undefined) formData.append('seed', params.seed.toString())
    if (params.num_images) formData.append('num_images', params.num_images.toString())
    formData.append('async_mode', params.async_mode !== false ? 'true' : 'false')

    const response = await apiClient.post('/text-to-image', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      responseType: params.async_mode !== false ? 'json' : 'blob',
    })
    return response.data
  },

  // 图像编辑
  imageEdit: async (params: ImageEditParams): Promise<TaskSubmitResponse | Blob> => {
    const formData = new FormData()
    params.images.forEach((image) => formData.append('images', image))
    formData.append('prompt', params.prompt)
    if (params.negative_prompt) formData.append('negative_prompt', params.negative_prompt)
    if (params.num_inference_steps) formData.append('num_inference_steps', params.num_inference_steps.toString())
    if (params.true_cfg_scale) formData.append('true_cfg_scale', params.true_cfg_scale.toString())
    if (params.guidance_scale) formData.append('guidance_scale', params.guidance_scale.toString())
    if (params.seed !== undefined) formData.append('seed', params.seed.toString())
    if (params.num_images) formData.append('num_images', params.num_images.toString())
    formData.append('async_mode', params.async_mode !== false ? 'true' : 'false')

    const response = await apiClient.post('/image-edit', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      responseType: params.async_mode !== false ? 'json' : 'blob',
    })
    return response.data
  },

  // 批量编辑
  batchEdit: async (params: BatchEditParams): Promise<TaskSubmitResponse | Blob> => {
    const formData = new FormData()
    formData.append('image', params.image)
    formData.append('prompts', params.prompts)
    if (params.negative_prompt) formData.append('negative_prompt', params.negative_prompt)
    if (params.num_inference_steps) formData.append('num_inference_steps', params.num_inference_steps.toString())
    if (params.true_cfg_scale) formData.append('true_cfg_scale', params.true_cfg_scale.toString())
    if (params.seed !== undefined) formData.append('seed', params.seed.toString())
    formData.append('async_mode', params.async_mode !== false ? 'true' : 'false')

    const response = await apiClient.post('/image-edit/batch', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      responseType: params.async_mode !== false ? 'json' : 'blob',
    })
    return response.data
  },
}
