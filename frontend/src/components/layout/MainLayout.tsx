import { Outlet } from "react-router-dom"
import { cn } from "@/utils/cn"
import { useUIStore } from "@/stores/uiStore"
import { Header } from "./Header"
import { Sidebar } from "./Sidebar"

export function MainLayout() {
  const { sidebarCollapsed } = useUIStore()

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <Sidebar />
      <main
        className={cn(
          "transition-all duration-300 pt-4 pb-8 px-4 md:px-8",
          sidebarCollapsed ? "ml-16" : "ml-64"
        )}
      >
        <div className="mx-auto max-w-7xl">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
