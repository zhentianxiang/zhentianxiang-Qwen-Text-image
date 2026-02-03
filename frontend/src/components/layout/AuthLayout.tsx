import { useState, useEffect } from "react"
import { Outlet, Navigate } from "react-router-dom"
import { useAuth } from "@/hooks/useAuth"
import { LoadingPage } from "@/components/common/LoadingSpinner"

// 背景图片列表
// 请将对应的图片文件放入 frontend/public/ 目录下
// 推荐尺寸: 1920x1080
const BACKGROUND_IMAGES = [
  "/bg.jpg",      // 默认背景
  "/bg-1.jpg",
  "/bg-2.jpg",
  "/bg-3.jpg",
  "/bg-4.jpg",
  "/bg-5.jpg",
  "/bg-6.jpg",
  "/bg-7.jpg",
  "/bg-8.jpg",
  "/bg-9.jpg",
  "/bg-10.jpg",
  "/bg-11.jpg",
  "/bg-13.jpg",
  "/bg-14.jpg",
  "/bg-15.jpg",
  "/bg-16.jpg",
]

export function AuthLayout() {
  const { isAuthenticated, isLoading } = useAuth()
  const [bgImage, setBgImage] = useState<string>("/bg.jpg")

  useEffect(() => {
    // 随机选择一张背景图
    const randomIndex = Math.floor(Math.random() * BACKGROUND_IMAGES.length)
    setBgImage(BACKGROUND_IMAGES[randomIndex])
  }, [])

  if (isLoading) {
    return <LoadingPage />
  }

  if (isAuthenticated) {
    return <Navigate to="/" replace />
  }

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-slate-900">
      {/* Background Image */}
      <div 
        className="absolute inset-0 z-0 bg-cover bg-center bg-no-repeat transition-all duration-1000 ease-in-out"
        style={{ 
          backgroundImage: `url(${bgImage})`,
        }}
      >
        {/* Fallback gradient if image fails load (handled by CSS/browser usually showing bg-color) or purely as base */}
      </div>

      {/* Overlay - 半透明遮罩，确保文字/表单清晰可见 */}
      <div className="absolute inset-0 z-0 bg-black/60 backdrop-blur-sm" />
      
      {/* Content */}
      <div className="relative z-10 w-full max-w-md px-4">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/20 backdrop-blur-md border border-white/10 mb-4 shadow-lg">
            <span className="text-3xl font-bold text-white">Q</span>
          </div>
          <h1 className="text-3xl font-bold text-white mb-2 drop-shadow-md">Qwen Image</h1>
          <p className="text-slate-200 drop-shadow-sm">AI 图像创作平台</p>
        </div>
        <Outlet />
      </div>
    </div>
  )
}