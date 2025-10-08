"use client"

import { DashboardNav } from "@/components/dashboard-nav"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { UserPlus, Trash2 } from "lucide-react"
import useSWR from "swr"
import { useState } from "react"
import { toast } from "sonner"

async function fetchUsers() {
  const response = await fetch("/api/admin/users")
  if (!response.ok) throw new Error("Failed to fetch users")
  return response.json()
}

export default function UsersPage() {
  const { data: users, isLoading, mutate } = useSWR("admin-users", fetchUsers)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isCreating, setIsCreating] = useState(false)

  const [newUser, setNewUser] = useState({
    email: "",
    password: "",
    role: "customer",
  })

  const handleCreateUser = async () => {
    setIsCreating(true)
    try {
      const response = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newUser),
      })

      if (!response.ok) throw new Error("Failed to create user")

      toast.success("User created successfully")
      setIsCreateOpen(false)
      setNewUser({ email: "", password: "", role: "customer" })
      mutate()
    } catch (error) {
      toast.error("Failed to create user")
      console.error(error)
    } finally {
      setIsCreating(false)
    }
  }

  const handleDeleteUser = async (userId: string) => {
    if (!confirm("Are you sure you want to delete this user?")) return

    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: "DELETE",
      })

      if (!response.ok) throw new Error("Failed to delete user")

      toast.success("User deleted successfully")
      mutate()
    } catch (error) {
      toast.error("Failed to delete user")
      console.error(error)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <DashboardNav />

      <main className="container mx-auto p-6">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white">User Management</h1>
            <p className="text-slate-400">Manage users, roles, and permissions</p>
          </div>

          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2 bg-blue-600 hover:bg-blue-700">
                <UserPlus className="h-4 w-4" />
                Create User
              </Button>
            </DialogTrigger>
            <DialogContent className="border-slate-800 bg-slate-900">
              <DialogHeader>
                <DialogTitle className="text-white">Create New User</DialogTitle>
                <DialogDescription className="text-slate-400">Add a new user to the system</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="email" className="text-slate-200">
                    Email
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    value={newUser.email}
                    onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                    className="border-slate-700 bg-slate-800 text-white"
                  />
                </div>
                <div>
                  <Label htmlFor="password" className="text-slate-200">
                    Password
                  </Label>
                  <Input
                    id="password"
                    type="password"
                    value={newUser.password}
                    onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                    className="border-slate-700 bg-slate-800 text-white"
                  />
                </div>
                <div>
                  <Label htmlFor="role" className="text-slate-200">
                    Role
                  </Label>
                  <Select value={newUser.role} onValueChange={(value) => setNewUser({ ...newUser, role: value })}>
                    <SelectTrigger className="border-slate-700 bg-slate-800 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="border-slate-700 bg-slate-800">
                      <SelectItem value="customer" className="text-white">
                        Customer
                      </SelectItem>
                      <SelectItem value="msp_user" className="text-white">
                        MSP User
                      </SelectItem>
                      <SelectItem value="msp_admin" className="text-white">
                        MSP Admin
                      </SelectItem>
                      <SelectItem value="superadmin" className="text-white">
                        Superadmin
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsCreateOpen(false)} className="border-slate-700">
                  Cancel
                </Button>
                <Button onClick={handleCreateUser} disabled={isCreating} className="bg-blue-600 hover:bg-blue-700">
                  {isCreating ? "Creating..." : "Create User"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <Card className="border-slate-800 bg-slate-900/50 backdrop-blur">
          <CardHeader>
            <CardTitle className="text-white">All Users</CardTitle>
            <CardDescription className="text-slate-400">Manage system users and their roles</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center text-slate-400">Loading...</div>
            ) : (
              <div className="space-y-2">
                {users?.map((user: { id: string; email: string; role: string; created_at: string }) => (
                  <div
                    key={user.id}
                    className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-800/50 p-4"
                  >
                    <div className="flex items-center gap-4">
                      <div>
                        <div className="font-medium text-white">{user.email}</div>
                        <div className="text-sm text-slate-400">
                          Created {new Date(user.created_at).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <Badge
                        variant="outline"
                        className={
                          user.role === "superadmin"
                            ? "border-red-500/20 bg-red-500/10 text-red-400"
                            : user.role === "msp_admin"
                              ? "border-purple-500/20 bg-purple-500/10 text-purple-400"
                              : user.role === "msp_user"
                                ? "border-blue-500/20 bg-blue-500/10 text-blue-400"
                                : "border-green-500/20 bg-green-500/10 text-green-400"
                        }
                      >
                        {user.role}
                      </Badge>
                      {user.role !== "superadmin" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteUser(user.id)}
                          className="text-red-400 hover:bg-red-500/10 hover:text-red-300"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
