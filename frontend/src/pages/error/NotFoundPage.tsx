import { Link } from "react-router-dom"
import { Ghost, Home } from "lucide-react"
import { Button } from "@/components/ui/button"

export function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 text-center animate-in fade-in zoom-in duration-500">
      <div className="mb-8 flex h-32 w-32 items-center justify-center rounded-full bg-muted/50 p-6 shadow-xl ring-8 ring-muted/20">
        <Ghost className="h-16 w-16 text-muted-foreground/50" />
      </div>
      <h1 className="mb-2 text-4xl font-extrabold tracking-tight lg:text-5xl">404</h1>
      <h2 className="mb-4 text-xl font-semibold tracking-tight text-muted-foreground">
        页面好像被外星人劫走了
      </h2>
      <p className="mb-8 max-w-sm text-sm text-muted-foreground">
        您访问的页面不存在，或者已经被移动到了未知的维度。
      </p>
      <Button asChild size="lg" className="rounded-full px-8">
        <Link to="/">
          <Home className="mr-2 h-4 w-4" />
          返回地球 (首页)
        </Link>
      </Button>
    </div>
  )
}
