# ==============================================
# Qwen Image Service - Dockerfile
# ==============================================
# 使用中科大镜像源加速构建

# 基础镜像 - PyTorch 2.5 with CUDA (支持 torch.xpu 属性)
FROM pytorch/pytorch:2.5.1-cuda12.4-cudnn9-runtime

# 设置环境变量
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    DEBIAN_FRONTEND=noninteractive

# 设置工作目录
WORKDIR /app

# 替换apt源为中科大镜像（兼容新旧Ubuntu版本）
RUN if [ -f /etc/apt/sources.list ]; then \
        sed -i 's/archive.ubuntu.com/mirrors.ustc.edu.cn/g' /etc/apt/sources.list && \
        sed -i 's/security.ubuntu.com/mirrors.ustc.edu.cn/g' /etc/apt/sources.list; \
    fi && \
    if [ -d /etc/apt/sources.list.d ]; then \
        find /etc/apt/sources.list.d -name "*.list" -exec sed -i 's/archive.ubuntu.com/mirrors.ustc.edu.cn/g' {} \; && \
        find /etc/apt/sources.list.d -name "*.list" -exec sed -i 's/security.ubuntu.com/mirrors.ustc.edu.cn/g' {} \; ; \
    fi

# 安装系统依赖
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1-mesa-glx \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender-dev \
    && rm -rf /var/lib/apt/lists/*

# 配置pip使用中科大镜像
RUN pip config set global.index-url https://mirrors.ustc.edu.cn/pypi/web/simple && \
    pip config set global.trusted-host mirrors.ustc.edu.cn

# 复制依赖文件
COPY requirements.txt .

# 安装Python依赖
RUN pip install --no-cache-dir -r requirements.txt

# 复制应用代码
COPY app/ ./app/
COPY config/ ./config/

# 创建非root用户（安全最佳实践）
RUN useradd --create-home --shell /bin/bash appuser && \
    chown -R appuser:appuser /app && \
    # 创建缓存目录，避免运行时权限警告
    mkdir -p /home/appuser/.cache/torch/kernels && \
    mkdir -p /home/appuser/.cache/huggingface && \
    chown -R appuser:appuser /home/appuser/.cache && \
    # 创建数据目录（用于SQLite数据库）
    mkdir -p /app/data && \
    chown -R appuser:appuser /app/data && \
    # 创建日志目录
    mkdir -p /app/logs && \
    chown -R appuser:appuser /app/logs
USER appuser

# 暴露端口
EXPOSE 8000

# 健康检查
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')" || exit 1

# 启动命令
CMD ["python", "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
