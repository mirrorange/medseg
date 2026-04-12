import { useState, useCallback } from "react";
import { useRevalidator } from "react-router";
import type { Route } from "./+types/admin.users";
import {
  getUsersApiUsersGet,
  adminUpdateApiUsersUserIdPut,
  adminDeleteApiUsersUserIdDelete,
} from "~/api";
import type { UserRead, AdminUserUpdate } from "~/api/types.gen";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "~/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Switch } from "~/components/ui/switch";
import { toast } from "sonner";
import { Pencil, Trash2 } from "lucide-react";

export function meta({}: Route.MetaArgs) {
  return [{ title: "User Management - MedSeg Cloud" }];
}

export async function clientLoader({}: Route.ClientLoaderArgs) {
  const { data } = await getUsersApiUsersGet();
  return { users: data ?? [] };
}

export default function AdminUsersPage({ loaderData }: Route.ComponentProps) {
  const { users } = loaderData;
  const revalidator = useRevalidator();
  const [editUser, setEditUser] = useState<UserRead | null>(null);
  const [deleteUser, setDeleteUser] = useState<UserRead | null>(null);
  const [editForm, setEditForm] = useState<AdminUserUpdate>({});

  const openEdit = useCallback((user: UserRead) => {
    setEditUser(user);
    setEditForm({
      username: user.username,
      email: user.email,
      role: user.role,
      is_active: user.is_active,
    });
  }, []);

  const handleUpdate = useCallback(async () => {
    if (!editUser) return;
    try {
      await adminUpdateApiUsersUserIdPut({
        path: { user_id: editUser.id },
        body: editForm,
      });
      toast.success("User updated");
      setEditUser(null);
      revalidator.revalidate();
    } catch {
      toast.error("Failed to update user");
    }
  }, [editUser, editForm, revalidator]);

  const handleDelete = useCallback(async () => {
    if (!deleteUser) return;
    try {
      await adminDeleteApiUsersUserIdDelete({
        path: { user_id: deleteUser.id },
      });
      toast.success("User deleted");
      setDeleteUser(null);
      revalidator.revalidate();
    } catch {
      toast.error("Failed to delete user");
    }
  }, [deleteUser, revalidator]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">User Management</h1>
        <p className="mt-1 text-muted-foreground">
          Manage user accounts, roles, and active status.
        </p>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Username</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[100px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => (
              <TableRow key={user.id}>
                <TableCell className="font-medium">{user.username}</TableCell>
                <TableCell>{user.email}</TableCell>
                <TableCell>
                  <Badge variant={user.role === "admin" ? "default" : "secondary"}>
                    {user.role}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge variant={user.is_active ? "default" : "destructive"}>
                    {user.is_active ? "Active" : "Inactive"}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openEdit(user)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setDeleteUser(user)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Edit Dialog */}
      <Dialog open={!!editUser} onOpenChange={(open) => !open && setEditUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-username">Username</Label>
              <Input
                id="edit-username"
                value={editForm.username ?? ""}
                onChange={(e) =>
                  setEditForm((f) => ({ ...f, username: e.target.value }))
                }
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-email">Email</Label>
              <Input
                id="edit-email"
                type="email"
                value={editForm.email ?? ""}
                onChange={(e) =>
                  setEditForm((f) => ({ ...f, email: e.target.value }))
                }
              />
            </div>
            <div className="grid gap-2">
              <Label>Role</Label>
              <Select
                value={editForm.role ?? "user"}
                onValueChange={(v) => setEditForm((f) => ({ ...f, role: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">User</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="edit-active"
                checked={editForm.is_active ?? true}
                onCheckedChange={(v) =>
                  setEditForm((f) => ({ ...f, is_active: v }))
                }
              />
              <Label htmlFor="edit-active">Active</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditUser(null)}>
              Cancel
            </Button>
            <Button onClick={handleUpdate}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog
        open={!!deleteUser}
        onOpenChange={(open) => !open && setDeleteUser(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete User</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete user "{deleteUser?.username}"? This
              action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
