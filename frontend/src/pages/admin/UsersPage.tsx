import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Users, Shield, ShieldOff, UserX, UserCheck, Loader2, Trash2 } from "lucide-react"
import { authApi } from "@/api"
import { toast } from "@/hooks/useToast"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { formatDate } from "@/utils/format"

// Simple table components
function SimpleTable({ className, children }: { className?: string; children: React.ReactNode }) {
  return <table className={`w-full caption-bottom text-sm ${className}`}>{children}</table>
}

export function UsersPage() {
  const queryClient = useQueryClient()
  const [deleteUserId, setDeleteUserId] = useState<number | null>(null)

  const { data: users, isLoading } = useQuery({
    queryKey: ['admin-users'],
    queryFn: () => authApi.getUsers(0, 100),
  })

  const toggleActiveMutation = useMutation({
    mutationFn: (userId: number) => authApi.toggleUserActive(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] })
      toast({ title: "用户状态已更新", variant: "success" as const })
    },
  })

  const toggleAdminMutation = useMutation({
    mutationFn: (userId: number) => authApi.toggleUserAdmin(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] })
      toast({ title: "用户角色已更新", variant: "success" as const })
    },
  })

  const deleteUserMutation = useMutation({
    mutationFn: (userId: number) => authApi.deleteUser(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] })
      toast({ title: "用户已删除", variant: "success" as const })
      setDeleteUserId(null)
    },
  })

  return (
    <div className="space-y-6 animate-in">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">用户管理</h1>
        <p className="text-muted-foreground">管理系统用户账户</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            用户列表
          </CardTitle>
          <CardDescription>
            共 {users?.length ?? 0} 个用户
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <div className="rounded-md border">
              <SimpleTable>
                <thead className="[&_tr]:border-b">
                  <tr className="border-b transition-colors hover:bg-muted/50">
                    <th className="h-12 px-4 text-left align-middle font-medium">ID</th>
                    <th className="h-12 px-4 text-left align-middle font-medium">用户名</th>
                    <th className="h-12 px-4 text-left align-middle font-medium">邮箱</th>
                    <th className="h-12 px-4 text-left align-middle font-medium">状态</th>
                    <th className="h-12 px-4 text-left align-middle font-medium">角色</th>
                    <th className="h-12 px-4 text-left align-middle font-medium">创建时间</th>
                    <th className="h-12 px-4 text-left align-middle font-medium">操作</th>
                  </tr>
                </thead>
                <tbody className="[&_tr:last-child]:border-0">
                  {users?.map((user) => (
                    <tr key={user.id} className="border-b transition-colors hover:bg-muted/50">
                      <td className="p-4 align-middle">{user.id}</td>
                      <td className="p-4 align-middle font-medium">{user.username}</td>
                      <td className="p-4 align-middle text-muted-foreground">
                        {user.email || "-"}
                      </td>
                      <td className="p-4 align-middle">
                        <Badge variant={user.is_active ? "success" : "destructive"}>
                          {user.is_active ? "正常" : "禁用"}
                        </Badge>
                      </td>
                      <td className="p-4 align-middle">
                        <Badge variant={user.is_admin ? "default" : "secondary"}>
                          {user.is_admin ? "管理员" : "用户"}
                        </Badge>
                      </td>
                      <td className="p-4 align-middle text-muted-foreground">
                        {formatDate(user.created_at)}
                      </td>
                      <td className="p-4 align-middle">
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => toggleActiveMutation.mutate(user.id)}
                            disabled={toggleActiveMutation.isPending}
                            title={user.is_active ? "禁用用户" : "启用用户"}
                          >
                            {user.is_active ? (
                              <UserX className="h-4 w-4" />
                            ) : (
                              <UserCheck className="h-4 w-4" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => toggleAdminMutation.mutate(user.id)}
                            disabled={toggleAdminMutation.isPending}
                            title={user.is_admin ? "撤销管理员" : "设为管理员"}
                          >
                            {user.is_admin ? (
                              <ShieldOff className="h-4 w-4" />
                            ) : (
                              <Shield className="h-4 w-4" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeleteUserId(user.id)}
                            className="text-destructive hover:text-destructive"
                            title="删除用户"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </SimpleTable>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteUserId} onOpenChange={() => setDeleteUserId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认删除</DialogTitle>
            <DialogDescription>
              您确定要删除这个用户吗？此操作不可撤销。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteUserId(null)}>
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteUserId && deleteUserMutation.mutate(deleteUserId)}
              disabled={deleteUserMutation.isPending}
            >
              {deleteUserMutation.isPending && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
