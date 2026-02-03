import { useEffect, useState } from "react"
import { useSearchParams, Link } from "react-router-dom"
import { Loader2, CheckCircle2, XCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { authApi } from "@/api/auth"

export function VerifyEmailPage() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get("token")
  
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [message, setMessage] = useState("正在验证您的邮箱...")

  useEffect(() => {
    if (!token) {
      setStatus('error')
      setMessage("无效的验证链接")
      return
    }

    const verify = async () => {
      try {
        await authApi.verifyEmail(token)
        setStatus('success')
        setMessage("邮箱验证成功！您现在可以登录了。")
      } catch (error) {
        setStatus('error')
        const msg = error instanceof Error ? (error as any).response?.data?.detail || error.message : "验证失败"
        setMessage(msg)
      }
    }

    verify()
  }, [token])

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="space-y-1 text-center">
        <div className="flex justify-center mb-4">
          {status === 'loading' && (
            <div className="p-3 bg-muted rounded-full">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          )}
          {status === 'success' && (
            <div className="p-3 bg-green-100 rounded-full">
              <CheckCircle2 className="h-8 w-8 text-green-600" />
            </div>
          )}
          {status === 'error' && (
            <div className="p-3 bg-red-100 rounded-full">
              <XCircle className="h-8 w-8 text-red-600" />
            </div>
          )}
        </div>
        <CardTitle className="text-2xl font-bold">
          {status === 'loading' && "验证中"}
          {status === 'success' && "验证成功"}
          {status === 'error' && "验证失败"}
        </CardTitle>
        <CardDescription>
          {message}
        </CardDescription>
      </CardHeader>
      
      {status !== 'loading' && (
        <CardFooter>
          <Button asChild className="w-full">
            <Link to="/login">
              前往登录
            </Link>
          </Button>
        </CardFooter>
      )}
    </Card>
  )
}
