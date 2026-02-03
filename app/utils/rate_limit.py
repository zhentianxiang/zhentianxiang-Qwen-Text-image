from slowapi import Limiter
from slowapi.util import get_remote_address
from ..config import settings

# 初始化 Rate Limiter
limiter = Limiter(
    key_func=get_remote_address, 
    enabled=settings.security.rate_limit.enabled
)
