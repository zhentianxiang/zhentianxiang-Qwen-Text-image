# Qwen Image 前端

基于 React + TypeScript + Tailwind CSS 构建的现代化 AI 图像生成平台前端。

## 技术栈

- **React 18** - UI 框架
- **TypeScript** - 类型安全
- **Vite** - 构建工具
- **Tailwind CSS** - 样式框架
- **Shadcn/ui** - UI 组件库
- **TanStack Query** - 数据获取
- **Zustand** - 状态管理
- **React Router** - 路由管理
- **React Hook Form + Zod** - 表单验证

## 功能特性

- 🔐 用户认证（登录/注册）
- 🖼️ 文生图（Text-to-Image）
- ✏️ 图像编辑（Image Edit）
- 📦 批量编辑（Batch Edit）
- 📋 任务管理和历史记录
- 📊 配额管理
- 👥 管理员控制台
- 🌙 深色/浅色主题
- 📱 响应式设计

## 开发

### 环境要求

- Node.js 18+
- npm 或 yarn

### 安装依赖

```bash
cd frontend
npm install
```

### 开发服务器

```bash
npm run dev
```

访问 http://localhost:3000

### 构建

```bash
npm run build
```

构建产物在 `dist` 目录。

## 配置

创建 `.env` 文件：

```env
# API 地址（开发环境使用代理）
VITE_API_URL=/api
```

## Docker 部署

### 单独构建前端

```bash
docker build -t qwen-image-frontend ./frontend
docker run -p 3000:80 qwen-image-frontend
```

### 使用 Docker Compose

在项目根目录：

```bash
docker-compose up -d qwen-image-frontend
```

## 目录结构

```
src/
├── api/           # API 请求层
├── components/    # 组件
│   ├── ui/        # 基础 UI 组件
│   ├── layout/    # 布局组件
│   ├── auth/      # 认证相关
│   ├── generation/# 生成相关
│   ├── tasks/     # 任务相关
│   └── common/    # 公共组件
├── hooks/         # 自定义 Hooks
├── pages/         # 页面组件
├── stores/        # 状态管理
├── types/         # 类型定义
├── utils/         # 工具函数
└── styles/        # 样式
```

## 许可证

MIT
