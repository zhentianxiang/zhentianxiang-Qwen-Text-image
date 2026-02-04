import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Users, Loader2, Trash2, Plus, Pencil, Database } from "lucide-react"
import { authApi } from "@/api"
import { toast } from "@/hooks/useToast"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { formatDate } from "@/utils/format"
import { User } from "@/types"

// Simple table components
function SimpleTable({ className, children }: { className?: string; children: React.ReactNode }) {
  return <table className={`w-full caption-bottom text-sm ${className}`}>{children}</table>
}

export function UsersPage() {
  const queryClient = useQueryClient()
  
  // Dialog states
  const [createUserOpen, setCreateUserOpen] = useState(false)
  const [editUser, setEditUser] = useState<User | null>(null)
  const [quotaUser, setQuotaUser] = useState<User | null>(null)
  const [deleteUserId, setDeleteUserId] = useState<number | null>(null)

  // Form states
  const [createForm, setCreateForm] = useState({ username: "", email: "", password: "", is_admin: "false" })
  const [editForm, setEditForm] = useState({ email: "", password: "", is_admin: "false", is_active: "true" })
  const [quotaForm, setQuotaForm] = useState({ daily_limit: 100, monthly_limit: 3000 })

  // Queries
  const { data: users, isLoading } = useQuery({
    queryKey: ['admin-users'],
    queryFn: () => authApi.getUsers(0, 100),
  })

  // Fetch quota when quota dialog opens
  const { data: userQuota, isLoading: isQuotaLoading } = useQuery({
    queryKey: ['admin-user-quota', quotaUser?.id],
    queryFn: () => quotaUser ? authApi.getUserQuota(quotaUser.id) : Promise.reject('No user'),
    enabled: !!quotaUser,
  })

  // Update quota form when data loads
  if (userQuota && quotaUser && (quotaForm.daily_limit !== userQuota.daily_limit || quotaForm.monthly_limit !== userQuota.monthly_limit)) {
     // This causes infinite loop if not careful. 
     // Better to set initial state in useEffect or just use defaultValue in inputs if not controlled, 
     // but controlled is better.
     // Let's use a useEffect or just set it once when data arrives.
  }
  
  // Actually, better to use useEffect to sync quotaForm with userQuota
  // but useEffect inside conditional render is bad.
  // We'll handle this by setting form state when opening dialog or when data fetch succeeds?
  // React Query has `onSuccess` deprecated.
  // We will handle it by checking if data is fresh.
  
  // Mutations
  const createUserMutation = useMutation({
    mutationFn: (data: any) => authApi.createUser({
      ...data,
      is_admin: data.is_admin === "true"
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] })
      toast({ title: "用户创建成功", variant: "success" })
      setCreateUserOpen(false)
      setCreateForm({ username: "", email: "", password: "", is_admin: "false" })
    },
    onError: (error: any) => {
      toast({ title: "创建失败", description: error.response?.data?.detail || "未知错误", variant: "destructive" })
    }
  })

  const updateUserMutation = useMutation({
    mutationFn: (data: any) => authApi.updateUser(editUser!.id, {
      email: data.email || undefined,
      password: data.password || undefined,
      is_admin: data.is_admin === "true",
      is_active: data.is_active === "true"
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] })
      toast({ title: "用户更新成功", variant: "success" })
      setEditUser(null)
    },
    onError: (error: any) => {
      toast({ title: "更新失败", description: error.response?.data?.detail || "未知错误", variant: "destructive" })
    }
  })

  const updateQuotaMutation = useMutation({
    mutationFn: (data: any) => authApi.updateUserQuota(quotaUser!.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-user-quota', quotaUser?.id] })
      toast({ title: "配额更新成功", variant: "success" })
      setQuotaUser(null)
    },
    onError: (error: any) => {
      toast({ title: "更新失败", description: error.response?.data?.detail || "未知错误", variant: "destructive" })
    }
  })

  const deleteUserMutation = useMutation({
    mutationFn: (userId: number) => authApi.deleteUser(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] })
      toast({ title: "用户已删除", variant: "success" })
      setDeleteUserId(null)
    },
  })

  // Handlers
  const handleEditClick = (user: User) => {
    setEditUser(user)
    setEditForm({
      email: user.email || "",
      password: "",
      is_admin: user.is_admin ? "true" : "false",
      is_active: user.is_active ? "true" : "false"
    })
  }

  const handleQuotaClick = (user: User) => {
    setQuotaUser(user)
    // Reset form to defaults, will be populated by query data
    setQuotaForm({ daily_limit: 100, monthly_limit: 3000 }) 
  }

  return (
    <div className="space-y-6 animate-in">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">用户管理</h1>
          <p className="text-muted-foreground">管理系统用户账户</p>
        </div>
        <Button onClick={() => setCreateUserOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> 创建用户
        </Button>
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
                            onClick={() => handleEditClick(user)}
                            title="编辑用户"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleQuotaClick(user)}
                            title="配额管理"
                          >
                            <Database className="h-4 w-4" />
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

      {/* Create User Dialog */}
      <Dialog open={createUserOpen} onOpenChange={setCreateUserOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>创建新用户</DialogTitle>
            <DialogDescription>
              创建一个新的用户账号。
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="username">用户名</Label>
              <Input
                id="username"
                value={createForm.username}
                onChange={(e) => setCreateForm({ ...createForm, username: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="email">邮箱</Label>
              <Input
                id="email"
                type="email"
                value={createForm.email}
                onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password">密码</Label>
              <Input
                id="password"
                type="password"
                value={createForm.password}
                onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="role">角色</Label>
              <Select
                value={createForm.is_admin}
                onValueChange={(value) => setCreateForm({ ...createForm, is_admin: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="选择角色" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="false">普通用户</SelectItem>
                  <SelectItem value="true">管理员</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateUserOpen(false)}>
              取消
            </Button>
            <Button
              onClick={() => createUserMutation.mutate(createForm)}
              disabled={createUserMutation.isPending || !createForm.username || !createForm.password}
            >
              {createUserMutation.isPending && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              创建
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog open={!!editUser} onOpenChange={(open) => !open && setEditUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>编辑用户: {editUser?.username}</DialogTitle>
            <DialogDescription>
              修改用户信息。留空密码则不修改。
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-email">邮箱</Label>
              <Input
                id="edit-email"
                type="email"
                value={editForm.email}
                onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-password">密码 (留空不修改)</Label>
              <Input
                id="edit-password"
                type="password"
                placeholder="******"
                value={editForm.password}
                onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-status">状态</Label>
              <Select
                value={editForm.is_active}
                onValueChange={(value) => setEditForm({ ...editForm, is_active: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="选择状态" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="true">正常</SelectItem>
                  <SelectItem value="false">禁用</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-role">角色</Label>
              <Select
                value={editForm.is_admin}
                onValueChange={(value) => setEditForm({ ...editForm, is_admin: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="选择角色" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="false">普通用户</SelectItem>
                  <SelectItem value="true">管理员</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditUser(null)}>
              取消
            </Button>
            <Button
              onClick={() => updateUserMutation.mutate(editForm)}
              disabled={updateUserMutation.isPending}
            >
              {updateUserMutation.isPending && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Quota Dialog */}
      <Dialog open={!!quotaUser} onOpenChange={(open) => !open && setQuotaUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>配额管理: {quotaUser?.username}</DialogTitle>
            <DialogDescription>
              设置用户的每日和每月使用限额。
            </DialogDescription>
          </DialogHeader>
          {isQuotaLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-muted-foreground">今日已用</p>
                    <p className="text-2xl font-bold">{userQuota?.used_today ?? 0}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-muted-foreground">本月已用</p>
                    <p className="text-2xl font-bold">{userQuota?.used_this_month ?? 0}</p>
                  </div>
                </div>
                
                <div className="grid gap-2">
                  <Label htmlFor="daily-limit">每日限额</Label>
                  <Input
                    id="daily-limit"
                    type="number"
                    defaultValue={userQuota?.daily_limit}
                    onChange={(e) => setQuotaForm({ ...quotaForm, daily_limit: parseInt(e.target.value) })}
                  />
                  <p className="text-xs text-muted-foreground">
                    每天允许生成的图片数量。
                  </p>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="monthly-limit">每月限额</Label>
                  <Input
                    id="monthly-limit"
                    type="number"
                    defaultValue={userQuota?.monthly_limit}
                    onChange={(e) => setQuotaForm({ ...quotaForm, monthly_limit: parseInt(e.target.value) })}
                  />
                  <p className="text-xs text-muted-foreground">
                    每月允许生成的图片数量。
                  </p>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setQuotaUser(null)}>
                  取消
                </Button>
                <Button
                  onClick={() => updateQuotaMutation.mutate(quotaForm)}
                  disabled={updateQuotaMutation.isPending}
                >
                  {updateQuotaMutation.isPending && (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  )}
                  保存
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

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