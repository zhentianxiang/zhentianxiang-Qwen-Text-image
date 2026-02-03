# Qwen Image Service - API 文档

> 版本: 1.3.0  
> 基础URL: `http://<host>:8000`

---

## 目录

- [概述](#概述)
- [认证](#认证)
- [通用说明](#通用说明)
- [异步任务模式](#异步任务模式)
- [API端点](#api端点)
  - [认证接口](#1-认证接口)
  - [文生图](#2-文生图)
  - [图像编辑](#3-图像编辑)
  - [批量编辑](#4-批量编辑)
  - [任务管理](#5-任务管理)
    - [队列信息](#51-获取队列信息)
    - [任务状态](#52-获取任务状态)
    - [任务结果](#53-获取任务结果)
    - [取消任务](#54-取消任务)
    - [任务历史](#55-获取我的任务历史)
    - [任务统计](#58-获取我的任务统计)
    - [配额信息](#510-获取我的配额信息)
  - [健康检查](#6-健康检查)
  - [模型信息](#7-模型信息)
  - [宽高比查询](#8-宽高比查询)
- [错误处理](#错误处理)
- [示例代码](#示例代码)

---

## 概述

Qwen Image Service 提供以下功能：

| 功能 | 端点 | 描述 |
|------|------|------|
| 用户认证 | `/auth/*` | 用户注册、登录、管理 |
| 文生图 | `POST /text-to-image` | 根据文本描述生成图像 |
| 图像编辑 | `POST /image-edit` | 基于上传图像进行编辑 |
| 批量编辑 | `POST /image-edit/batch` | 对同一图像应用多个编辑 |
| 任务管理 | `GET /tasks/*` | 查询和管理异步任务 |

### 新特性 (v1.3.0)

- **任务历史记录**：所有任务持久化到数据库，支持历史查询
- **任务统计分析**：用户和全局任务统计，包括成功率、平均执行时间等
- **用户配额管理**：每日/每月使用限额和使用量统计

### v1.2.0 特性

- **用户认证系统**：JWT Token 认证，支持用户注册、登录、权限管理
- **SQLite 数据库**：轻量级用户数据存储
- **管理员功能**：用户管理、权限控制

### v1.1.0 特性

- **异步任务队列**：推理任务在后台执行，不会阻塞服务器
- **多GPU并行**：自动检测GPU数量，多GPU时可并行执行多个任务
- **任务状态查询**：可随时查询任务进度和结果
- **任务排队**：单GPU时任务自动排队，无需等待

---

## 认证

### 认证方式

服务使用 **JWT Bearer Token** 认证。所有生成接口（文生图、图像编辑、任务管理）都需要认证。

### 请求头格式

```
Authorization: Bearer <token>
```

### 获取 Token

通过登录接口获取 Token：

```bash
curl -X POST http://localhost:8000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "admin123"}'
```

响应：
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer",
  "expires_in": 86400
}
```

### 默认管理员

首次启动服务会自动创建默认管理员账号：
- **用户名**: `admin`
- **密码**: `admin123`

> ⚠️ **生产环境请务必修改默认密码！**

### 禁用认证

如不需要认证，可设置环境变量：
```bash
AUTH_ENABLED=false
```

---

## 通用说明

### 请求格式

- **Content-Type**: `application/json`（认证接口）
- **Content-Type**: `multipart/form-data`（包含文件上传的端点）
- **Content-Type**: `application/x-www-form-urlencoded`（纯表单数据）

### 响应格式

| 场景 | Content-Type | 描述 |
|------|--------------|------|
| 单张图像 | `image/png` | 直接返回PNG图像 |
| 多张图像 | `application/zip` | 返回ZIP压缩包 |
| JSON数据 | `application/json` | 系统信息等 |
| 任务已接受 | `application/json` | 异步模式下返回任务ID |
| 错误 | `application/json` | 包含错误详情 |

### 支持的宽高比

| 宽高比 | 尺寸 (宽×高) |
|--------|-------------|
| `1:1` | 1024 × 1024 |
| `16:9` | 1664 × 928 |
| `9:16` | 928 × 1664 |
| `4:3` | 1472 × 1104 |
| `3:4` | 1104 × 1472 |
| `3:2` | 1584 × 1056 |
| `2:3` | 1056 × 1584 |

---

## 异步任务模式

### 工作原理

1. **提交任务**：调用生成/编辑接口时，任务被加入队列
2. **返回任务ID**：接口立即返回任务ID（HTTP 202）
3. **查询状态**：通过 `/tasks/{task_id}` 查询任务进度
4. **获取结果**：任务完成后通过 `/tasks/{task_id}/result` 获取结果

### 任务状态

| 状态 | 描述 |
|------|------|
| `pending` | 等待中，在队列中排队 |
| `running` | 执行中 |
| `completed` | 已完成 |
| `failed` | 执行失败 |
| `cancelled` | 已取消 |

### 同步 vs 异步模式

所有生成接口都支持 `async_mode` 参数：

- `async_mode=true`（默认）：立即返回任务ID，后台执行
- `async_mode=false`：等待任务完成后直接返回结果

---

## API端点

### 1. 认证接口

#### 1.1 用户注册

```
POST /auth/register
```

**请求体**（JSON）：

| 参数 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `username` | string | ✅ | 用户名（3-50字符） |
| `password` | string | ✅ | 密码（至少6字符） |
| `email` | string | ❌ | 邮箱（可选） |

**示例**：
```bash
curl -X POST http://localhost:8000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username": "newuser", "password": "123456", "email": "user@example.com"}'
```

**响应** (`201 Created`)：
```json
{
  "id": 2,
  "username": "newuser",
  "email": "user@example.com",
  "is_active": true,
  "is_admin": false,
  "created_at": "2024-01-15T10:30:00.000Z"
}
```

#### 1.2 用户登录

```
POST /auth/login
```

**请求体**（JSON）：

| 参数 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `username` | string | ✅ | 用户名 |
| `password` | string | ✅ | 密码 |

**示例**：
```bash
curl -X POST http://localhost:8000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "admin123"}'
```

**响应**：
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer",
  "expires_in": 86400
}
```

#### 1.3 获取当前用户信息

```
GET /auth/me
```

**请求头**：
```
Authorization: Bearer <token>
```

**响应**：
```json
{
  "id": 1,
  "username": "admin",
  "email": null,
  "is_active": true,
  "is_admin": true,
  "created_at": "2024-01-15T10:00:00.000Z"
}
```

#### 1.4 更新用户信息

```
PUT /auth/me
```

**请求体**（JSON）：

| 参数 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `email` | string | ❌ | 新邮箱 |
| `password` | string | ❌ | 新密码 |

#### 1.5 修改密码

```
POST /auth/change-password
```

**请求体**（JSON）：

| 参数 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `old_password` | string | ✅ | 原密码 |
| `new_password` | string | ✅ | 新密码（至少6字符） |

**响应**：
```json
{
  "message": "密码修改成功"
}
```

#### 1.6 获取用户列表（管理员）

```
GET /auth/users
```

**请求参数**：

| 参数 | 类型 | 必填 | 默认值 | 描述 |
|------|------|------|--------|------|
| `skip` | int | ❌ | 0 | 跳过记录数 |
| `limit` | int | ❌ | 100 | 返回记录数限制 |

**响应**：
```json
[
  {
    "id": 1,
    "username": "admin",
    "email": null,
    "is_active": true,
    "is_admin": true,
    "created_at": "2024-01-15T10:00:00.000Z"
  }
]
```

#### 1.7 启用/禁用用户（管理员）

```
PUT /auth/users/{user_id}/toggle-active
```

**响应**：
```json
{
  "message": "用户已禁用",
  "user_id": 2,
  "is_active": false
}
```

#### 1.8 设置管理员权限（管理员）

```
PUT /auth/users/{user_id}/toggle-admin
```

**响应**：
```json
{
  "message": "用户已设置为管理员",
  "user_id": 2,
  "is_admin": true
}
```

#### 1.9 删除用户（管理员）

```
DELETE /auth/users/{user_id}
```

**响应**：
```json
{
  "message": "用户 username 已删除"
}
```

---

### 2. 文生图

根据文本描述生成图像。**需要认证**。

```
POST /text-to-image
```

#### 请求参数

| 参数 | 类型 | 必填 | 默认值 | 描述 |
|------|------|------|--------|------|
| `prompt` | string | ✅ | - | 生成图像的描述文本 |
| `negative_prompt` | string | ❌ | `""` | 不希望出现在图像中的内容 |
| `aspect_ratio` | string | ❌ | `"1:1"` | 图像宽高比 |
| `num_inference_steps` | int | ❌ | `50` | 推理步数 (20-100) |
| `true_cfg_scale` | float | ❌ | `4.0` | CFG尺度 (1.0-10.0) |
| `seed` | int | ❌ | `-1` | 随机种子，-1表示随机 |
| `num_images` | int | ❌ | `1` | 生成图像数量 (1-4) |
| `async_mode` | bool | ❌ | `true` | 是否使用异步模式 |

#### 响应

**异步模式** (async_mode=true):
- **成功**: `202 Accepted` - 返回任务ID

```json
{
  "message": "任务已提交",
  "task_id": "550e8400-e29b-41d4-a716-446655440000",
  "status_url": "/tasks/550e8400-e29b-41d4-a716-446655440000",
  "result_url": "/tasks/550e8400-e29b-41d4-a716-446655440000/result",
  "queue_info": {
    "pending_tasks": 2,
    "running_tasks": 1
  }
}
```

**同步模式** (async_mode=false):
- **成功 (单张)**: `200 OK` - 返回 `image/png`
- **成功 (多张)**: `200 OK` - 返回 `application/zip`

#### 示例

```bash
# 异步模式
curl -X POST "http://localhost:8000/text-to-image" \
  -H "Authorization: Bearer <token>" \
  -F "prompt=一只可爱的橘猫在阳光下打盹" \
  -F "aspect_ratio=16:9"

# 同步模式
curl -X POST "http://localhost:8000/text-to-image" \
  -H "Authorization: Bearer <token>" \
  -F "prompt=一只可爱的橘猫" \
  -F "async_mode=false" \
  --output cat.png
```

---

### 3. 图像编辑

基于上传的图像进行编辑。**需要认证**。

```
POST /image-edit
```

#### 请求参数

| 参数 | 类型 | 必填 | 默认值 | 描述 |
|------|------|------|--------|------|
| `images` | file[] | ✅ | - | 上传的图像文件（1-2张） |
| `prompt` | string | ✅ | - | 编辑图像的描述文本 |
| `negative_prompt` | string | ❌ | `""` | 不希望出现在图像中的内容 |
| `num_inference_steps` | int | ❌ | `40` | 推理步数 (20-100) |
| `true_cfg_scale` | float | ❌ | `4.0` | CFG尺度 (1.0-10.0) |
| `guidance_scale` | float | ❌ | `1.0` | 指导尺度 (1.0-10.0) |
| `seed` | int | ❌ | `-1` | 随机种子 |
| `num_images` | int | ❌ | `1` | 生成图像数量 (1-4) |
| `async_mode` | bool | ❌ | `true` | 是否使用异步模式 |

#### 文件限制

- **最大文件大小**: 20MB
- **支持的格式**: `image/jpeg`, `image/png`, `image/webp`
- **最大文件数量**: 2

#### 示例

```bash
curl -X POST "http://localhost:8000/image-edit" \
  -H "Authorization: Bearer <token>" \
  -F "images=@original.jpg" \
  -F "prompt=把背景换成海滩" \
  -F "async_mode=false" \
  --output edited.png
```

---

### 4. 批量编辑

对同一张图像应用多个编辑提示。**需要认证**。

```
POST /image-edit/batch
```

#### 请求参数

| 参数 | 类型 | 必填 | 默认值 | 描述 |
|------|------|------|--------|------|
| `image` | file | ✅ | - | 上传的单张图像文件 |
| `prompts` | string | ✅ | - | 多个编辑提示，用 `\|` 分隔 |
| `negative_prompt` | string | ❌ | `""` | 不希望出现在图像中的内容 |
| `num_inference_steps` | int | ❌ | `40` | 推理步数 (20-100) |
| `true_cfg_scale` | float | ❌ | `4.0` | CFG尺度 (1.0-10.0) |
| `seed` | int | ❌ | `-1` | 随机种子 |
| `async_mode` | bool | ❌ | `true` | 是否使用异步模式 |

#### 限制

- **最大提示数量**: 10

---

### 5. 任务管理

所有任务管理接口都**需要认证**。

#### 5.1 获取队列信息

```
GET /tasks/queue
```

**响应**:
```json
{
  "is_running": true,
  "gpu_count": 2,
  "max_workers": 2,
  "queue_size": 3,
  "tasks": {
    "pending": 3,
    "running": 2,
    "completed": 15,
    "failed": 1,
    "total": 21
  }
}
```

#### 5.2 获取任务状态

```
GET /tasks/{task_id}
```

**响应**:
```json
{
  "task_id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "running",
  "error": null,
  "created_at": "2024-01-15T10:30:00.000Z",
  "started_at": "2024-01-15T10:30:05.000Z",
  "completed_at": null,
  "position_in_queue": 0,
  "wait_time_seconds": 5.0,
  "execution_time_seconds": null
}
```

#### 5.3 获取任务结果

```
GET /tasks/{task_id}/result
```

| 参数 | 类型 | 必填 | 默认值 | 描述 |
|------|------|------|--------|------|
| `wait` | bool | ❌ | `false` | 是否等待任务完成 |
| `timeout` | float | ❌ | `300` | 等待超时时间（秒） |

#### 5.4 取消任务

```
DELETE /tasks/{task_id}
```

> 注意：只能取消等待中的任务，已开始执行的任务无法取消

#### 5.5 获取我的任务历史

```
GET /tasks/history/me
```

| 参数 | 类型 | 必填 | 默认值 | 描述 |
|------|------|------|--------|------|
| `page` | int | ❌ | `1` | 页码 |
| `page_size` | int | ❌ | `20` | 每页数量（最大100） |
| `status` | string | ❌ | - | 状态过滤 |
| `task_type` | string | ❌ | - | 任务类型过滤 |
| `start_date` | datetime | ❌ | - | 开始日期 |
| `end_date` | datetime | ❌ | - | 结束日期 |

**响应**:
```json
{
  "items": [
    {
      "id": 1,
      "task_id": "550e8400-e29b-41d4-a716-446655440000",
      "user_id": 1,
      "task_type": "text_to_image",
      "prompt": "一只可爱的猫",
      "negative_prompt": null,
      "parameters": {"width": 1024, "height": 1024},
      "status": "completed",
      "result_path": "/tmp/generated_xxx.png",
      "result_filename": "generated_xxx.png",
      "error_message": null,
      "created_at": "2024-01-15T10:30:00.000Z",
      "started_at": "2024-01-15T10:30:05.000Z",
      "completed_at": "2024-01-15T10:30:20.000Z",
      "execution_time": 15.0
    }
  ],
  "total": 100,
  "page": 1,
  "page_size": 20,
  "total_pages": 5
}
```

#### 5.6 获取所有任务历史（管理员）

```
GET /tasks/history/all
```

| 参数 | 类型 | 必填 | 默认值 | 描述 |
|------|------|------|--------|------|
| `page` | int | ❌ | `1` | 页码 |
| `page_size` | int | ❌ | `20` | 每页数量（最大100） |
| `status` | string | ❌ | - | 状态过滤 |
| `task_type` | string | ❌ | - | 任务类型过滤 |
| `user_id` | int | ❌ | - | 用户ID过滤 |
| `start_date` | datetime | ❌ | - | 开始日期 |
| `end_date` | datetime | ❌ | - | 结束日期 |

#### 5.7 获取任务历史详情

```
GET /tasks/history/{task_id}
```

返回任务的完整历史信息，包括参数和结果。

#### 5.8 获取我的任务统计

```
GET /tasks/statistics/me
```

**响应**:
```json
{
  "total_tasks": 100,
  "completed_tasks": 95,
  "failed_tasks": 5,
  "pending_tasks": 0,
  "text_to_image_count": 60,
  "image_edit_count": 35,
  "batch_edit_count": 5,
  "avg_execution_time": 12.5,
  "total_execution_time": 1250.0
}
```

#### 5.9 获取全局任务统计（管理员）

```
GET /tasks/statistics/global
```

额外返回：
- `today_tasks`: 今日任务数
- `active_users`: 活跃用户数

#### 5.10 获取我的配额信息

```
GET /tasks/quota/me
```

**响应**:
```json
{
  "user_id": 1,
  "daily_limit": 100,
  "monthly_limit": 3000,
  "used_today": 5,
  "used_this_month": 150,
  "total_used": 500,
  "remaining_today": 95,
  "remaining_this_month": 2850
}
```

#### 5.11 清理旧任务（管理员）

```
POST /tasks/cleanup
```

| 参数 | 类型 | 必填 | 默认值 | 描述 |
|------|------|------|--------|------|
| `max_age_hours` | int | ❌ | `24` | 清理内存中超过指定小时数的任务 |
| `max_age_days` | int | ❌ | `30` | 清理数据库中超过指定天数的任务 |

**响应**:
```json
{
  "message": "已清理 10 个内存任务记录，100 个数据库历史记录",
  "memory_cleaned_count": 10,
  "db_cleaned_count": 100
}
```

---

### 6. 健康检查

检查服务状态和模型加载情况。**无需认证**。

```
GET /health
```

#### 响应

```json
{
  "status": "healthy",
  "text_to_image_model_loaded": true,
  "image_edit_model_loaded": true,
  "gpu_available": true,
  "gpu_count": 2
}
```

---

### 7. 模型信息

获取可用模型的详细信息。**无需认证**。

```
GET /models
```

#### 响应

```json
{
  "text_to_image": {
    "name": "Qwen/Qwen-Image-2512",
    "description": "Qwen-Image-2512 文生图模型",
    "capabilities": ["text-to-image", "image generation"],
    "status": "loaded"
  },
  "image_edit": {
    "name": "Qwen/Qwen-Image-Edit-2511",
    "description": "Qwen-Image-Edit-2511 图像编辑模型",
    "capabilities": ["image-to-image", "image editing", "multi-image composition"],
    "status": "loaded"
  }
}
```

---

### 8. 宽高比查询

获取支持的图像宽高比及其对应尺寸。**无需认证**。

```
GET /text-to-image/aspect-ratios
```

#### 响应

```json
{
  "1:1": [1024, 1024],
  "16:9": [1664, 928],
  "9:16": [928, 1664],
  "4:3": [1472, 1104],
  "3:4": [1104, 1472],
  "3:2": [1584, 1056],
  "2:3": [1056, 1584]
}
```

---

## 错误处理

### 错误响应格式

```json
{
  "detail": "错误描述信息"
}
```

### HTTP状态码

| 状态码 | 描述 |
|--------|------|
| `200` | 成功 |
| `201` | 创建成功 |
| `202` | 任务已接受（异步模式） |
| `400` | 请求参数错误 |
| `401` | 未认证或认证失败 |
| `403` | 权限不足 |
| `404` | 资源不存在 |
| `408` | 任务超时 |
| `500` | 服务器内部错误 |
| `503` | 模型未加载 |

### 常见错误

| 错误信息 | 原因 | 解决方案 |
|----------|------|----------|
| `无效的认证凭据` | Token 无效或过期 | 重新登录获取新 Token |
| `用户名或密码错误` | 登录凭据错误 | 检查用户名和密码 |
| `当前不允许用户注册` | 注册功能已禁用 | 联系管理员 |
| `用户名已存在` | 注册时用户名重复 | 使用其他用户名 |
| `需要管理员权限` | 访问管理员接口 | 使用管理员账号 |
| `文生图模型未加载` | 模型未成功加载 | 等待模型加载完成 |
| `任务不存在` | 任务ID无效 | 检查任务ID |

---

## 示例代码

### Python 完整示例

```python
import requests
import time

BASE_URL = "http://localhost:8000"


class QwenImageClient:
    def __init__(self, base_url=BASE_URL):
        self.base_url = base_url
        self.token = None
    
    def login(self, username, password):
        """登录获取 Token"""
        response = requests.post(
            f"{self.base_url}/auth/login",
            json={"username": username, "password": password}
        )
        response.raise_for_status()
        self.token = response.json()["access_token"]
        return self.token
    
    def _headers(self):
        """获取认证请求头"""
        return {"Authorization": f"Bearer {self.token}"}
    
    def text_to_image(self, prompt, output_path="output.png", async_mode=True, **kwargs):
        """文生图"""
        data = {"prompt": prompt, "async_mode": str(async_mode).lower(), **kwargs}
        
        response = requests.post(
            f"{self.base_url}/text-to-image",
            headers=self._headers(),
            data=data
        )
        response.raise_for_status()
        
        if async_mode:
            task_id = response.json()["task_id"]
            return self._wait_and_download(task_id, output_path)
        else:
            with open(output_path, "wb") as f:
                f.write(response.content)
            return output_path
    
    def _wait_and_download(self, task_id, output_path):
        """等待任务完成并下载结果"""
        print(f"任务已提交: {task_id}")
        
        while True:
            response = requests.get(
                f"{self.base_url}/tasks/{task_id}",
                headers=self._headers()
            )
            status = response.json()
            
            if status["status"] == "completed":
                break
            elif status["status"] == "failed":
                raise Exception(f"任务失败: {status['error']}")
            elif status["status"] == "pending":
                print(f"等待中... 队列位置: {status['position_in_queue']}")
            else:
                print(f"执行中...")
            
            time.sleep(2)
        
        # 下载结果
        response = requests.get(
            f"{self.base_url}/tasks/{task_id}/result",
            headers=self._headers()
        )
        
        with open(output_path, "wb") as f:
            f.write(response.content)
        
        print(f"已保存到: {output_path}")
        return output_path
    
    def get_queue_info(self):
        """获取队列信息"""
        response = requests.get(
            f"{self.base_url}/tasks/queue",
            headers=self._headers()
        )
        return response.json()


# 使用示例
if __name__ == "__main__":
    client = QwenImageClient()
    
    # 登录
    client.login("admin", "admin123")
    
    # 查看队列状态
    queue = client.get_queue_info()
    print(f"GPU: {queue['gpu_count']}, 等待: {queue['tasks']['pending']}")
    
    # 生成图像
    client.text_to_image(
        prompt="一只可爱的橘猫在阳光下打盹",
        output_path="cat.png",
        aspect_ratio="16:9"
    )
```

### cURL 示例

```bash
# 登录
TOKEN=$(curl -s -X POST http://localhost:8000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "admin123"}' | jq -r '.access_token')

# 文生图（异步）
TASK_ID=$(curl -s -X POST http://localhost:8000/text-to-image \
  -H "Authorization: Bearer $TOKEN" \
  -F "prompt=一只可爱的橘猫" | jq -r '.task_id')

# 查询状态
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:8000/tasks/$TASK_ID

# 获取结果
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:8000/tasks/$TASK_ID/result?wait=true" \
  --output result.png

# 文生图（同步）
curl -X POST http://localhost:8000/text-to-image \
  -H "Authorization: Bearer $TOKEN" \
  -F "prompt=一只可爱的橘猫" \
  -F "async_mode=false" \
  --output cat.png

# 用户注册
curl -X POST http://localhost:8000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username": "newuser", "password": "123456"}'

# 获取当前用户信息
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:8000/auth/me

# 修改密码
curl -X POST http://localhost:8000/auth/change-password \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"old_password": "admin123", "new_password": "newpassword"}'
```

---

## 更新日志

### v1.3.0

- ✨ 新增任务历史记录功能，所有任务持久化到数据库
- ✨ 新增任务历史查询接口 `/tasks/history/me` 和 `/tasks/history/all`
- ✨ 新增任务统计接口 `/tasks/statistics/me` 和 `/tasks/statistics/global`
- ✨ 新增用户配额管理 `/tasks/quota/me`
- ✨ 任务记录包含：任务类型、提示词、参数、结果路径、执行时间等
- 📊 支持按状态、类型、日期等条件过滤历史记录
- 🗑️ 清理任务接口现支持清理内存和数据库记录

### v1.2.0

- ✨ 新增用户认证系统（JWT Token）
- ✨ 新增用户注册、登录接口
- ✨ 新增用户管理接口（管理员）
- ✨ 支持 SQLite 数据库存储用户数据
- ✨ 所有生成接口需要认证
- 🔒 支持禁用认证功能

### v1.1.0

- ✨ 新增异步任务队列系统
- ✨ 支持多GPU并行推理
- ✨ 新增任务状态查询接口
- ✨ 新增任务取消功能
- ✨ 所有生成接口支持 `async_mode` 参数
- 🐛 修复推理时阻塞服务器的问题

### v1.0.0

- 初始版本
- 支持文生图、图像编辑、批量编辑
- 支持多种宽高比
- GPU加速支持
