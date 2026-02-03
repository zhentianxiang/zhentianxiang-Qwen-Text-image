import { useState } from "react"
import { Link } from "react-router-dom"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Loader2, ArrowLeft, Mail } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { toast } from "@/hooks/useToast"
import { authApi } from "@/api/auth"

const forgotPasswordSchema = z.object({
  username: z.string().min(1, "请输入用户名"),
  email: z.string().email("请输入有效的邮箱地址"),
})

type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>

export function ForgotPasswordPage() {
  const [isLoading, setIsLoading] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordFormData>({
    resolver: zodResolver(forgotPasswordSchema),
  })

  const onSubmit = async (data: ForgotPasswordFormData) => {
    setIsLoading(true)
    try {
      await authApi.forgotPassword(data.username, data.email)
      setIsSubmitted(true)
      toast({
        title: "请求已提交",
        description: "如果该邮箱和用户名匹配，您将收到一封重置密码的邮件。",
        variant: "success" as const,
      })
    } catch (error) {
      toast({
        title: "请求失败",
        description: "无法提交请求，请稍后重试",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="space-y-1">
        <div className="flex justify-center mb-4">
          <div className="p-3 bg-primary/10 rounded-full">
            <Mail className="h-6 w-6 text-primary" />
          </div>
        </div>
        <CardTitle className="text-2xl font-bold text-center">忘记密码</CardTitle>
        <CardDescription className="text-center">
          {isSubmitted 
            ? "重置链接已发送到您的邮箱" 
            : "输入您的用户名和注册邮箱，我们将向您发送重置密码的链接"}
        </CardDescription>
      </CardHeader>
      
      {isSubmitted ? (
        <CardContent className="space-y-4">
          <p className="text-sm text-center text-muted-foreground">
            请检查您的邮箱收件箱（以及垃圾邮件文件夹）。
            点击邮件中的链接以设置新密码。
          </p>
          <Button asChild className="w-full" variant="outline">
            <Link to="/login">返回登录</Link>
          </Button>
        </CardContent>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">用户名</Label>
              <Input
                id="username"
                placeholder="请输入用户名"
                {...register("username")}
                disabled={isLoading}
              />
              {errors.username && (
                <p className="text-sm text-destructive">{errors.username.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">邮箱</Label>
              <Input
                id="email"
                type="email"
                placeholder="name@example.com"
                {...register("email")}
                disabled={isLoading}
              />
              {errors.email && (
                <p className="text-sm text-destructive">{errors.email.message}</p>
              )}
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-4">
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              发送重置链接
            </Button>
            <Button asChild variant="ghost" className="w-full">
              <Link to="/login" className="flex items-center gap-2">
                <ArrowLeft className="h-4 w-4" />
                返回登录
              </Link>
            </Button>
          </CardFooter>
        </form>
      )}
    </Card>
  )
}
