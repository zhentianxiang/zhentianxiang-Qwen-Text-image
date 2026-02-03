import { useState } from "react"
import { useMutation } from "@tanstack/react-query"
import { User, Mail, Lock, Loader2, Check } from "lucide-react"
import { authApi } from "@/api"
import { useAuth } from "@/hooks/useAuth"
import { useAuthStore } from "@/stores/authStore"
import { toast } from "@/hooks/useToast"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

export function ProfilePage() {
  const { user, isAdmin } = useAuth()
  const setUser = useAuthStore((s) => s.setUser)
  
  const [email, setEmail] = useState(user?.email || "")
  const [oldPassword, setOldPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")

  const updateEmailMutation = useMutation({
    mutationFn: () => authApi.updateMe({ email: email || undefined }),
    onSuccess: (updatedUser) => {
      setUser(updatedUser)
      toast({
        title: "邮箱已更新",
        variant: "success" as const,
      })
    },
    onError: (error: Error) => {
      toast({
        title: "更新失败",
        description: error.message,
        variant: "destructive",
      })
    },
  })

  const changePasswordMutation = useMutation({
    mutationFn: () => authApi.changePassword({
      old_password: oldPassword,
      new_password: newPassword,
    }),
    onSuccess: () => {
      setOldPassword("")
      setNewPassword("")
      setConfirmPassword("")
      toast({
        title: "密码已修改",
        description: "请使用新密码重新登录",
        variant: "success" as const,
      })
    },
    onError: (error: Error) => {
      toast({
        title: "修改失败",
        description: error.message,
        variant: "destructive",
      })
    },
  })

  const handleChangePassword = () => {
    if (newPassword !== confirmPassword) {
      toast({
        title: "密码不匹配",
        description: "两次输入的新密码不一致",
        variant: "destructive",
      })
      return
    }
    if (newPassword.length < 6) {
      toast({
        title: "密码太短",
        description: "新密码至少6个字符",
        variant: "destructive",
      })
      return
    }
    changePasswordMutation.mutate()
  }

  if (!user) return null

  return (
    <div className="space-y-6 animate-in max-w-2xl">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">个人中心</h1>
        <p className="text-muted-foreground">管理您的账户信息</p>
      </div>

      {/* Profile Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            账户信息
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">用户名</span>
            <span className="font-medium">{user.username}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">角色</span>
            <Badge variant={isAdmin ? "default" : "secondary"}>
              {isAdmin ? "管理员" : "普通用户"}
            </Badge>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">状态</span>
            <Badge variant={user.is_active ? "success" : "destructive"}>
              {user.is_active ? "正常" : "已禁用"}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Email Update */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            邮箱设置
          </CardTitle>
          <CardDescription>更新您的邮箱地址</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">邮箱地址</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="请输入邮箱"
            />
          </div>
          <Button
            onClick={() => updateEmailMutation.mutate()}
            disabled={updateEmailMutation.isPending}
          >
            {updateEmailMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Check className="h-4 w-4 mr-2" />
            )}
            保存
          </Button>
        </CardContent>
      </Card>

      {/* Password Change */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            修改密码
          </CardTitle>
          <CardDescription>更改您的登录密码</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="old-password">当前密码</Label>
            <Input
              id="old-password"
              type="password"
              value={oldPassword}
              onChange={(e) => setOldPassword(e.target.value)}
              placeholder="请输入当前密码"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-password">新密码</Label>
            <Input
              id="new-password"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="请输入新密码（至少6位）"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm-password">确认新密码</Label>
            <Input
              id="confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="请再次输入新密码"
            />
          </div>
          <Button
            onClick={handleChangePassword}
            disabled={changePasswordMutation.isPending || !oldPassword || !newPassword}
          >
            {changePasswordMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Lock className="h-4 w-4 mr-2" />
            )}
            修改密码
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
