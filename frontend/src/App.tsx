import { useEffect } from "react"
import { BrowserRouter, Routes, Route } from "react-router-dom"
import { TooltipProvider } from "@/components/ui/tooltip"
import { Toaster } from "@/components/ui/toaster"
import { useToast } from "@/hooks/useToast"
import { eventBus } from "@/utils/events"

// Layouts
import { MainLayout } from "@/components/layout/MainLayout"
import { AuthLayout } from "@/components/layout/AuthLayout"
import { ProtectedRoute } from "@/components/auth/ProtectedRoute"

// Auth Pages
import { LoginPage } from "@/pages/auth/LoginPage"
import { RegisterPage } from "@/pages/auth/RegisterPage"
import { ForgotPasswordPage } from "@/pages/auth/ForgotPasswordPage"
import { ResetPasswordPage } from "@/pages/auth/ResetPasswordPage"
import { VerifyEmailPage } from "@/pages/auth/VerifyEmailPage"

// Main Pages
import { DashboardPage } from "@/pages/dashboard/DashboardPage"
import { TextToImagePage } from "@/pages/generate/TextToImagePage"
import { ImageEditPage } from "@/pages/generate/ImageEditPage"
import { BatchEditPage } from "@/pages/generate/BatchEditPage"
import { TaskListPage } from "@/pages/tasks/TaskListPage"
import { TaskDetailPage } from "@/pages/tasks/TaskDetailPage"
import { HistoryPage } from "@/pages/history/HistoryPage"
import { ProfilePage } from "@/pages/profile/ProfilePage"
import { QuotaPage } from "@/pages/profile/QuotaPage"

import { NotFoundPage } from "@/pages/error/NotFoundPage"

// Admin Pages
import { UsersPage } from "@/pages/admin/UsersPage"
import { StatisticsPage } from "@/pages/admin/StatisticsPage"
import SystemInfoPage from "@/pages/admin/SystemInfoPage"

function AppContent() {
  const { toast } = useToast()

  useEffect(() => {
    const handleError = (detail: any) => {
      toast({
        title: detail.title,
        description: detail.message,
        variant: "destructive",
      })
    }

    const handleUnauthorized = () => {
      toast({
        title: "登录已过期",
        description: "请重新登录",
        variant: "destructive",
      })
    }

    eventBus.on('api-error', handleError)
    eventBus.on('unauthorized', handleUnauthorized)

    return () => {
      eventBus.remove('api-error', handleError)
      eventBus.remove('unauthorized', handleUnauthorized)
    }
  }, [toast])

  return (
    <Routes>
      {/* Auth Routes */}
      <Route element={<AuthLayout />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/auth/verify-email" element={<VerifyEmailPage />} />
      </Route>

      {/* Protected Routes */}
      <Route
        element={
          <ProtectedRoute>
            <MainLayout />
          </ProtectedRoute>
        }
      >
        {/* Dashboard */}
        <Route path="/" element={<DashboardPage />} />

        {/* Generation */}
        <Route path="/generate/text-to-image" element={<TextToImagePage />} />
        <Route path="/generate/image-edit" element={<ImageEditPage />} />
        <Route path="/generate/batch-edit" element={<BatchEditPage />} />

        {/* Tasks */}
        <Route path="/tasks" element={<TaskListPage />} />
        <Route path="/tasks/:taskId" element={<TaskDetailPage />} />

        {/* History */}
        <Route path="/history" element={<HistoryPage />} />

        {/* Profile */}
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/quota" element={<QuotaPage />} />

        {/* Admin Routes */}
        <Route
          path="/admin/users"
          element={
            <ProtectedRoute requireAdmin>
              <UsersPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/statistics"
          element={
            <ProtectedRoute requireAdmin>
              <StatisticsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/system"
          element={
            <ProtectedRoute requireAdmin>
              <SystemInfoPage />
            </ProtectedRoute>
          }
        />
      </Route>

      {/* 404 - Keep this last */}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}

function App() {
  return (
    <BrowserRouter>
      <TooltipProvider>
        <AppContent />
        <Toaster />
      </TooltipProvider>
    </BrowserRouter>
  )
}

export default App
