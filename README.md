# Qwen Image Service

> 多模态图像生成与编辑 API 服务，集成 Qwen-Image-2512 文生图和 Qwen-Image-Edit-2511 图像编辑功能。

## ✨ 功能特性

- 🎨 **文生图** - 根据文字描述生成高质量图像
- ✏️ **图像编辑** - 基于上传图像进行智能编辑
- 📦 **批量编辑** - 对同一张图像应用多个编辑效果
- 🔄 **异步任务队列** - 后台执行，支持多GPU并行推理
- 🔐 **用户认证** - JWT Token 认证，支持用户管理
- 📊 **任务历史** - 记录所有任务历史，支持统计分析
- 💾 **数据持久化** - SQLite 数据库存储用户和任务数据
- 🖥️ **Web 前端** - 现代化的图形操作界面
- 🐳 **Docker 部署** - 一键部署，开箱即用

## 📥 模型下载

使用前请先下载模型文件到 `./models` 目录：

| 模型 | 功能 | 下载地址 |
|------|------|----------|
| **Qwen-Image-2512** | 文生图 | [hf-mirror.com/Qwen/Qwen-Image-2512](https://hf-mirror.com/Qwen/Qwen-Image-2512) |
| **Qwen-Image-Edit-2511** | 图像编辑 | [hf-mirror.com/Qwen/Qwen-Image-Edit-2511](https://hf-mirror.com/Qwen/Qwen-Image-Edit-2511) |

### 下载方式

```bash
# 安装 huggingface-cli
pip install huggingface_hub

# 设置镜像源（国内加速）
export HF_ENDPOINT=https://hf-mirror.com

# 下载文生图模型
huggingface-cli download Qwen/Qwen-Image-2512 --local-dir ./models/Qwen-Image-2512

# 下载图像编辑模型
huggingface-cli download Qwen/Qwen-Image-Edit-2511 --local-dir ./models/Qwen-Image-Edit-2511
```

> 💡 **模型大小**：两个模型合计约 130GB，请确保有足够磁盘空间

## 📁 项目结构

```
qwen-image/
├── app/                          # 后端应用
│   ├── __init__.py
│   ├── main.py                   # FastAPI应用入口
│   ├── config.py                 # 配置管理模块
│   ├── models/                   # 模型管理
│   │   ├── __init__.py
│   │   ├── pipelines.py          # 模型加载和管理
│   │   └── database.py           # 数据库模型（用户表）
│   ├── routers/                  # API路由
│   │   ├── __init__.py
│   │   ├── text_to_image.py      # 文生图端点
│   │   ├── image_edit.py         # 图像编辑端点
│   │   ├── tasks.py              # 任务管理端点
│   │   ├── auth.py               # 认证端点
│   │   └── info.py               # 系统信息端点
│   ├── schemas/                  # 数据模型
│   │   ├── __init__.py
│   │   ├── requests.py           # 请求/响应模型
│   │   ├── user.py               # 用户相关模型
│   │   └── task.py               # 任务相关模型
│   ├── services/                 # 服务层
│   │   ├── __init__.py
│   │   ├── task_queue.py         # 任务队列管理
│   │   ├── task_history.py       # 任务历史服务
│   │   └── auth.py               # 认证服务
│   └── utils/                    # 工具模块
│       ├── __init__.py
│       ├── logger.py             # 日志配置
│       └── image_utils.py        # 图像处理工具
├── frontend/                     # 前端应用
│   ├── index.html               # 主页面
│   ├── style.css                # 样式
│   ├── app.js                   # 交互逻辑
│   ├── nginx.conf               # Nginx配置
│   └── Dockerfile               # 前端容器
├── config/
│   └── config.yaml               # 主配置文件
├── models/                       # 模型目录（需下载）
├── data/                         # 数据目录（SQLite数据库）
├── logs/                         # 日志目录
├── requirements.txt              # Python依赖
├── Dockerfile                    # Docker镜像构建
├── docker-compose.yml            # Docker Compose编排
├── API.md                        # API文档
└── README.md                     # 本文件
```

## 🚀 快速开始

### 方式一：Docker部署（推荐）

```bash
# 1. 下载模型到 ./models 目录（见上方说明）

# 2. 使用 Docker Compose 启动（需要 NVIDIA Docker）
docker-compose up -d --build

# 3. 查看日志
docker-compose logs -f

# 4. 停止服务
docker-compose down
```

**访问地址：**
- 前端界面：http://localhost:3000
- API 文档：http://localhost:8000/docs
- 健康检查：http://localhost:8000/health

> 💡 Docker镜像使用中科大镜像源加速构建，HuggingFace使用 hf-mirror.com 加速模型下载

### 方式二：本地运行

#### 1. 安装依赖

```bash
# 创建虚拟环境（推荐）
python -m venv venv
source venv/bin/activate  # Linux/Mac
# 或 venv\Scripts\activate  # Windows

# 安装依赖
pip install -r requirements.txt
```

#### 2. 配置

##### 方式A：使用环境变量

```bash
# 复制示例配置
cp .env.example .env

# 编辑 .env 文件
vim .env
```

##### 方式B：使用配置文件

编辑 `config/config.yaml` 文件。

> 💡 环境变量优先级高于配置文件

#### 3. 启动服务

```bash
# 方式一：使用模块运行
python -m app.main

# 方式二：使用uvicorn
uvicorn app.main:app --host 0.0.0.0 --port 8000

# 开发模式（自动重载）
uvicorn app.main:app --reload
```

#### 4. 访问API

- API文档：http://localhost:8000/docs
- 健康检查：http://localhost:8000/health

## 🔐 用户认证

服务默认启用用户认证，未登录用户无法访问生成接口。

### 默认管理员账号

首次启动会自动创建默认管理员：
- **用户名**: `admin`
- **密码**: `admin123`

> ⚠️ **生产环境请务必修改默认密码！**

### 认证流程

```bash
# 1. 登录获取 Token
curl -X POST http://localhost:8000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "admin123"}'

# 返回: {"access_token": "eyJ...", "token_type": "bearer", "expires_in": 86400}

# 2. 使用 Token 访问接口
curl -X POST http://localhost:8000/text-to-image \
  -H "Authorization: Bearer eyJ..." \
  -F "prompt=一只可爱的猫"
```

### 用户注册

如果启用了用户注册（默认启用）：

```bash
curl -X POST http://localhost:8000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username": "newuser", "password": "123456"}'
```

### 禁用认证

如不需要认证，可在配置中禁用：

```yaml
# config/config.yaml
auth:
  enabled: false
```

或设置环境变量：
```bash
AUTH_ENABLED=false
```

## 🔄 异步任务队列

服务支持异步任务模式，推理任务在后台执行，不阻塞服务器。

### 特性

- **多GPU并行**：自动检测GPU数量，多GPU时可并行执行多个任务
- **任务排队**：单GPU时任务自动排队
- **状态查询**：随时查询任务进度

### 使用方式

```bash
# 1. 提交任务（默认异步模式）
curl -X POST http://localhost:8000/text-to-image \
  -H "Authorization: Bearer <token>" \
  -F "prompt=一只可爱的猫"

# 返回: {"task_id": "xxx", "status_url": "/tasks/xxx", ...}

# 2. 查询任务状态
curl -H "Authorization: Bearer <token>" \
  http://localhost:8000/tasks/xxx

# 3. 获取结果
curl -H "Authorization: Bearer <token>" \
  http://localhost:8000/tasks/xxx/result --output result.png
```

### 同步模式

如需同步等待结果，设置 `async_mode=false`：

```bash
curl -X POST http://localhost:8000/text-to-image \
  -H "Authorization: Bearer <token>" \
  -F "prompt=一只可爱的猫" \
  -F "async_mode=false" \
  --output cat.png
```

## 📊 任务历史与统计

所有任务都会记录到数据库，支持查询历史和统计分析。

### 数据库存储内容

- **用户表** (users)
  - 用户账号信息、密码哈希、权限状态等
  
- **任务历史表** (task_history)
  - 任务ID、类型、提示词、参数
  - 状态、结果路径、错误信息
  - 创建时间、开始时间、完成时间、执行时长
  - 关联用户ID

- **用户配额表** (user_quotas)
  - 每日/每月使用限额
  - 使用量统计

### 查询任务历史

```bash
# 查看我的任务历史
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:8000/tasks/history/me?page=1&page_size=20"

# 按状态过滤
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:8000/tasks/history/me?status=completed"

# 按任务类型过滤
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:8000/tasks/history/me?task_type=text_to_image"
```

### 统计信息

```bash
# 我的任务统计
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:8000/tasks/statistics/me

# 返回:
# {
#   "total_tasks": 100,
#   "completed_tasks": 95,
#   "failed_tasks": 5,
#   "text_to_image_count": 60,
#   "image_edit_count": 40,
#   "avg_execution_time": 12.5
# }

# 我的配额信息
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:8000/tasks/quota/me
```

### 管理员功能

```bash
# 查看所有用户的任务历史（管理员）
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  "http://localhost:8000/tasks/history/all?user_id=1"

# 全局统计（管理员）
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  http://localhost:8000/tasks/statistics/global

# 清理旧任务记录（管理员）
curl -X POST -H "Authorization: Bearer $ADMIN_TOKEN" \
  "http://localhost:8000/tasks/cleanup?max_age_days=30"
```

## 📚 API端点

详细文档请查看 [API.md](./API.md)

### 认证接口

| 端点 | 方法 | 描述 |
|------|------|------|
| `/auth/register` | POST | 用户注册 |
| `/auth/login` | POST | 用户登录 |
| `/auth/me` | GET | 获取当前用户信息 |
| `/auth/change-password` | POST | 修改密码 |
| `/auth/users` | GET | 获取用户列表（管理员） |

### 生成接口

| 端点 | 方法 | 描述 |
|------|------|------|
| `/text-to-image` | POST | 文生图 |
| `/image-edit` | POST | 图像编辑 |
| `/image-edit/batch` | POST | 批量编辑 |

### 任务管理

| 端点 | 方法 | 描述 |
|------|------|------|
| `/tasks/queue` | GET | 获取队列信息 |
| `/tasks/{task_id}` | GET | 获取任务状态 |
| `/tasks/{task_id}/result` | GET | 获取任务结果 |
| `/tasks/{task_id}` | DELETE | 取消任务 |
| `/tasks/history/me` | GET | 我的任务历史 |
| `/tasks/history/all` | GET | 所有任务历史（管理员） |
| `/tasks/history/{task_id}` | GET | 任务历史详情 |
| `/tasks/statistics/me` | GET | 我的任务统计 |
| `/tasks/statistics/global` | GET | 全局任务统计（管理员） |
| `/tasks/quota/me` | GET | 我的配额信息 |
| `/tasks/cleanup` | POST | 清理旧任务（管理员） |

### 系统信息

| 端点 | 方法 | 描述 |
|------|------|------|
| `/health` | GET | 健康检查 |
| `/models` | GET | 模型信息 |

### 快速测试

```bash
# 登录
TOKEN=$(curl -s -X POST http://localhost:8000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "admin123"}' | jq -r '.access_token')

# 健康检查
curl http://localhost:8000/health

# 文生图（异步）
curl -X POST http://localhost:8000/text-to-image \
  -H "Authorization: Bearer $TOKEN" \
  -F "prompt=一只可爱的橘猫在阳光下打盹"

# 文生图（同步）
curl -X POST http://localhost:8000/text-to-image \
  -H "Authorization: Bearer $TOKEN" \
  -F "prompt=一只可爱的橘猫" \
  -F "async_mode=false" \
  --output cat.png
```

## ⚙️ 配置说明

### 环境变量

| 变量名 | 默认值 | 说明 |
|--------|--------|------|
| `APP_HOST` | 0.0.0.0 | 服务监听地址 |
| `APP_PORT` | 8000 | 服务端口 |
| `APP_DEBUG` | false | 调试模式 |
| `TEXT_TO_IMAGE_MODEL` | Qwen/Qwen-Image-2512 | 文生图模型 |
| `IMAGE_EDIT_MODEL` | Qwen/Qwen-Image-Edit-2511 | 图像编辑模型 |
| `DEVICE` | cuda | 计算设备 (cuda/cpu) |
| `LOG_LEVEL` | INFO | 日志级别 |
| `LOG_FILE_ENABLED` | true | 是否启用日志文件 |
| `LOG_FILE_PATH` | ./logs/app.log | 日志文件路径 |
| `MAX_UPLOAD_SIZE_MB` | 20 | 最大上传文件大小 |
| `CORS_ORIGINS` | ["*"] | CORS允许的源 |

### 认证配置

| 变量名 | 默认值 | 说明 |
|--------|--------|------|
| `AUTH_ENABLED` | true | 是否启用认证 |
| `AUTH_SECRET_KEY` | (需修改) | JWT 密钥 |
| `AUTH_TOKEN_EXPIRE_MINUTES` | 1440 | Token 过期时间（分钟） |
| `AUTH_DEFAULT_ADMIN_USERNAME` | admin | 默认管理员用户名 |
| `AUTH_DEFAULT_ADMIN_PASSWORD` | admin123 | 默认管理员密码 |
| `AUTH_ALLOW_REGISTRATION` | true | 是否允许用户注册 |

### 任务队列配置

| 变量名 | 默认值 | 说明 |
|--------|--------|------|
| `TASK_QUEUE_MAX_WORKERS` | 0 | 最大并行数（0=自动检测GPU数量） |
| `TASK_RESULT_RETENTION_HOURS` | 24 | 任务结果保留时间 |
| `SYNC_TIMEOUT_SECONDS` | 600 | 同步模式超时时间 |

### 配额限制配置

| 变量名 | 默认值 | 说明 |
|--------|--------|------|
| `QUOTA_ENABLED` | true | 是否启用配额限制 |
| `QUOTA_DEFAULT_DAILY_LIMIT` | 100 | 默认每日限额 |
| `QUOTA_DEFAULT_MONTHLY_LIMIT` | 3000 | 默认每月限额 |
| `QUOTA_ADMIN_UNLIMITED` | true | 管理员是否不受限制 |

> 💡 **配额计算规则**：生成几张图消耗几次配额
> - 文生图 `num_images=4` → 消耗 4 次配额
> - 图像编辑 `num_images=2` → 消耗 2 次配额  
> - 批量编辑 3 个提示 → 消耗 3 次配额

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

## 🐳 Docker说明

### 镜像加速

Dockerfile 已配置以下中国镜像源：

| 类型 | 镜像源 |
|------|--------|
| APT | mirrors.ustc.edu.cn |
| PyPI | mirrors.ustc.edu.cn/pypi/web/simple |
| HuggingFace | hf-mirror.com |

### GPU支持

Docker Compose 已配置 NVIDIA GPU 支持，需要：

1. 安装 [NVIDIA Container Toolkit](https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/install-guide.html)
2. 确保 `nvidia-smi` 命令可用

```bash
# 验证GPU支持
docker run --rm --gpus all nvidia/cuda:12.4-base nvidia-smi
```

### 数据持久化

| 路径 | 说明 |
|------|------|
| `./models:/app/models` | 模型文件目录 |
| `./config:/app/config` | 配置文件目录 |
| `./logs:/app/logs` | 日志文件目录 |
| `./data:/app/data` | 数据库文件目录 |
| `huggingface_cache` | 模型缓存 |

## 📝 注意事项

1. **GPU内存**: 两个模型同时加载需要较大显存，建议使用24GB以上GPU
2. **首次启动**: 首次运行会下载模型，可能需要较长时间
3. **生产环境**: 
   - 请修改 `AUTH_SECRET_KEY` 为随机字符串
   - 请修改默认管理员密码
   - 请配置具体的 CORS 源，不要使用 `["*"]`
4. **临时文件**: 服务会自动清理24小时前的生成文件
5. **Docker健康检查**: start_period 设为120秒，等待模型加载

## 🔗 相关链接

- [Qwen-Image-2512 模型页面](https://hf-mirror.com/Qwen/Qwen-Image-2512)
- [Qwen-Image-Edit-2511 模型页面](https://hf-mirror.com/Qwen/Qwen-Image-Edit-2511)
- [Qwen-Image 技术报告](https://arxiv.org/abs/2508.02324)
- [Qwen 官方 GitHub](https://github.com/QwenLM)

## 📄 License

MIT License
