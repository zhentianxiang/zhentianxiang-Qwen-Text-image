import { Link } from "react-router-dom"
import { Moon, Sun, LogOut, User, Settings, Shield } from "lucide-react"
import { useAuth } from "@/hooks/useAuth"
import { useUIStore } from "@/stores/uiStore"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { QuotaIndicator } from "@/components/common/QuotaIndicator"

export function Header() {
  const { user, logout, isAdmin } = useAuth()
  const { theme, setTheme } = useUIStore()

  const toggleTheme = () => {
    const newTheme = theme === "dark" ? "light" : "dark"
    setTheme(newTheme)
  }

  const getUserInitials = (name: string) => {
    return name.slice(0, 2).toUpperCase()
  }

  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-14 items-center px-4 gap-4">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2 font-bold text-xl">
          <div className="h-8 w-8 rounded-lg gradient-bg flex items-center justify-center text-white text-sm">
            Q
          </div>
          <span className="hidden md:inline bg-gradient-to-r from-primary to-purple-500 bg-clip-text text-transparent">
            Qwen Image
          </span>
        </Link>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Quota */}
        <QuotaIndicator className="hidden sm:flex" />

        {/* Theme Toggle */}
        <Button variant="ghost" size="icon" onClick={toggleTheme}>
          {theme === "dark" ? (
            <Sun className="h-5 w-5" />
          ) : (
            <Moon className="h-5 w-5" />
          )}
        </Button>

        {/* User Menu */}
        {user && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-9 w-9 rounded-full">
                <Avatar className="h-9 w-9">
                  <AvatarFallback className="bg-primary text-primary-foreground">
                    {getUserInitials(user.username)}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end" forceMount>
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">{user.username}</p>
                  <p className="text-xs leading-none text-muted-foreground">
                    {user.email || "未设置邮箱"}
                  </p>
                  {isAdmin && (
                    <div className="flex items-center gap-1 mt-1">
                      <Shield className="h-3 w-3 text-primary" />
                      <span className="text-xs text-primary">管理员</span>
                    </div>
                  )}
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link to="/profile" className="cursor-pointer">
                  <User className="mr-2 h-4 w-4" />
                  个人中心
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/quota" className="cursor-pointer">
                  <Settings className="mr-2 h-4 w-4" />
                  配额管理
                </Link>
              </DropdownMenuItem>
              {isAdmin && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link to="/admin/users" className="cursor-pointer">
                      <Shield className="mr-2 h-4 w-4" />
                      用户管理
                    </Link>
                  </DropdownMenuItem>
                </>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={logout} className="cursor-pointer text-destructive">
                <LogOut className="mr-2 h-4 w-4" />
                退出登录
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </header>
  )
}
