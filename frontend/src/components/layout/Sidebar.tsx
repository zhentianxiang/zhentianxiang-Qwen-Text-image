import { Link, useLocation } from "react-router-dom"
import { 
  LayoutDashboard, 
  ImagePlus, 
  Pencil, 
  Layers, 
  ListTodo, 
  History, 
  User, 
  Users,
  BarChart3,
  Server,
  ChevronLeft,
  ChevronRight
} from "lucide-react"
import { cn } from "@/utils/cn"
import { useAuth } from "@/hooks/useAuth"
import { useUIStore } from "@/stores/uiStore"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

interface NavItem {
  title: string
  href: string
  icon: React.ElementType
  adminOnly?: boolean
}

const mainNavItems: NavItem[] = [
  { title: "仪表盘", href: "/", icon: LayoutDashboard },
  { title: "文生图", href: "/generate/text-to-image", icon: ImagePlus },
  { title: "图像编辑", href: "/generate/image-edit", icon: Pencil },
  { title: "批量编辑", href: "/generate/batch-edit", icon: Layers },
]

const taskNavItems: NavItem[] = [
  { title: "任务列表", href: "/tasks", icon: ListTodo },
  { title: "历史记录", href: "/history", icon: History },
]

const userNavItems: NavItem[] = [
  { title: "个人中心", href: "/profile", icon: User },
]

const adminNavItems: NavItem[] = [
  { title: "用户管理", href: "/admin/users", icon: Users, adminOnly: true },
  { title: "全局统计", href: "/admin/statistics", icon: BarChart3, adminOnly: true },
  { title: "系统详情", href: "/admin/system", icon: Server, adminOnly: true },
]

function NavLink({ item, collapsed }: { item: NavItem; collapsed: boolean }) {
  const location = useLocation()
  const isActive = location.pathname === item.href
  
  const linkContent = (
    <Link
      to={item.href}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all hover:bg-accent",
        isActive && "bg-accent text-accent-foreground font-medium",
        collapsed && "justify-center px-2"
      )}
    >
      <item.icon className={cn("h-5 w-5 shrink-0", isActive && "text-primary")} />
      {!collapsed && <span>{item.title}</span>}
    </Link>
  )

  if (collapsed) {
    return (
      <Tooltip delayDuration={0}>
        <TooltipTrigger asChild>
          {linkContent}
        </TooltipTrigger>
        <TooltipContent side="right">
          {item.title}
        </TooltipContent>
      </Tooltip>
    )
  }

  return linkContent
}

export function Sidebar() {
  const { isAdmin } = useAuth()
  const { sidebarCollapsed, toggleSidebar } = useUIStore()

  return (
    <TooltipProvider>
      <aside
        className={cn(
          "fixed left-0 top-14 z-30 h-[calc(100vh-3.5rem)] border-r bg-background transition-all duration-300",
          sidebarCollapsed ? "w-16" : "w-64"
        )}
      >
        <div className="flex h-full flex-col">
          {/* Nav Content */}
          <nav className="flex-1 overflow-y-auto p-3 space-y-1">
            {/* Main Nav */}
            <div className="space-y-1">
              {!sidebarCollapsed && (
                <h3 className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  创作
                </h3>
              )}
              {mainNavItems.map((item) => (
                <NavLink key={item.href} item={item} collapsed={sidebarCollapsed} />
              ))}
            </div>

            <Separator className="my-3" />

            {/* Task Nav */}
            <div className="space-y-1">
              {!sidebarCollapsed && (
                <h3 className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  任务
                </h3>
              )}
              {taskNavItems.map((item) => (
                <NavLink key={item.href} item={item} collapsed={sidebarCollapsed} />
              ))}
            </div>

            <Separator className="my-3" />

            {/* User Nav */}
            <div className="space-y-1">
              {!sidebarCollapsed && (
                <h3 className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  账户
                </h3>
              )}
              {userNavItems.map((item) => (
                <NavLink key={item.href} item={item} collapsed={sidebarCollapsed} />
              ))}
            </div>

            {/* Admin Nav */}
            {isAdmin && (
              <>
                <Separator className="my-3" />
                <div className="space-y-1">
                  {!sidebarCollapsed && (
                    <h3 className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      管理
                    </h3>
                  )}
                  {adminNavItems.map((item) => (
                    <NavLink key={item.href} item={item} collapsed={sidebarCollapsed} />
                  ))}
                </div>
              </>
            )}
          </nav>

          {/* Collapse Button */}
          <div className="border-t p-3">
            <Button
              variant="ghost"
              size="sm"
              className={cn("w-full", sidebarCollapsed && "px-2")}
              onClick={toggleSidebar}
            >
              {sidebarCollapsed ? (
                <ChevronRight className="h-4 w-4" />
              ) : (
                <>
                  <ChevronLeft className="h-4 w-4 mr-2" />
                  收起侧边栏
                </>
              )}
            </Button>
          </div>
        </div>
      </aside>
    </TooltipProvider>
  )
}
