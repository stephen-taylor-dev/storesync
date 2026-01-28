"use client";

import { useState, useEffect } from "react";
import { Users, Search, ChevronLeft, ChevronRight, Pencil, Trash2 } from "lucide-react";
import { useDebounce } from "@/hooks/use-debounce";
import { useUsers, useDeleteUser, type AdminUser } from "@/hooks/use-users";
import { useAuthStore } from "@/stores/auth-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PageLoader } from "@/components/shared/loading-spinner";
import { ErrorState, EmptyState } from "@/components/shared/error-state";
import { RoleBadge, USER_ROLES } from "@/components/users/role-badge";
import { UserEditDialog } from "@/components/users/user-edit-dialog";
import { useToast } from "@/hooks/use-toast";

function Pagination({
  currentPage,
  totalPages,
  totalCount,
  pageSize,
  onPageChange,
}: {
  currentPage: number;
  totalPages: number;
  totalCount: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}) {
  const startItem = (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalCount);

  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    const maxVisible = 5;

    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      if (currentPage <= 3) {
        for (let i = 1; i <= 4; i++) pages.push(i);
        pages.push("...");
        pages.push(totalPages);
      } else if (currentPage >= totalPages - 2) {
        pages.push(1);
        pages.push("...");
        for (let i = totalPages - 3; i <= totalPages; i++) pages.push(i);
      } else {
        pages.push(1);
        pages.push("...");
        pages.push(currentPage - 1);
        pages.push(currentPage);
        pages.push(currentPage + 1);
        pages.push("...");
        pages.push(totalPages);
      }
    }
    return pages;
  };

  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-between border-t pt-4">
      <p className="text-sm text-muted-foreground">
        Showing {startItem} to {endItem} of {totalCount} users
      </p>
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
        >
          <ChevronLeft className="h-4 w-4" />
          Previous
        </Button>

        {getPageNumbers().map((page, idx) =>
          typeof page === "number" ? (
            <Button
              key={idx}
              variant={page === currentPage ? "default" : "outline"}
              size="sm"
              className="w-9"
              onClick={() => onPageChange(page)}
            >
              {page}
            </Button>
          ) : (
            <span key={idx} className="px-2 text-muted-foreground">
              {page}
            </span>
          )
        )}

        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
        >
          Next
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

export default function UsersPage() {
  const { user: currentUser } = useAuthStore();
  const { toast } = useToast();
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [deletingUser, setDeletingUser] = useState<AdminUser | null>(null);

  const debouncedSearch = useDebounce(searchQuery, 300);
  const deleteUser = useDeleteUser();

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, roleFilter, statusFilter]);

  const pageSize = 20;
  const {
    data: usersData,
    isLoading,
    isError,
    refetch,
  } = useUsers({
    page,
    pageSize,
    search: debouncedSearch || undefined,
    role: roleFilter !== "all" ? roleFilter : undefined,
    is_active: statusFilter !== "all" ? statusFilter === "active" : undefined,
  });

  const users = usersData?.results || [];
  const totalCount = usersData?.count || 0;
  const totalPages = Math.ceil(totalCount / pageSize);

  const handleDelete = async () => {
    if (!deletingUser) return;

    try {
      await deleteUser.mutateAsync(deletingUser.id);
      toast({
        title: "User deleted",
        description: `${deletingUser.username} has been deleted.`,
      });
      setDeletingUser(null);
    } catch {
      toast({
        variant: "destructive",
        title: "Failed to delete user",
        description: "There was an error deleting the user.",
      });
    }
  };

  // Check if current user is admin
  if (currentUser?.role !== "admin") {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Users</h1>
          <p className="text-muted-foreground">
            Manage user accounts and permissions.
          </p>
        </div>
        <Card>
          <CardContent className="pt-6">
            <ErrorState
              title="Access Denied"
              message="You do not have permission to access user management. Only administrators can manage users."
            />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading && page === 1) {
    return <PageLoader message="Loading users..." />;
  }

  if (isError) {
    return (
      <ErrorState
        title="Failed to load users"
        message="There was an error loading users. Please try again."
        onRetry={() => refetch()}
      />
    );
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Users</h1>
        <p className="text-muted-foreground">
          Manage user accounts and permissions.
        </p>
      </div>

      {/* Filters & Table */}
      <Card>
        <CardHeader>
          <CardTitle>User Management</CardTitle>
          <CardDescription>
            {totalCount} user{totalCount !== 1 ? "s" : ""} in your organization
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search users..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All Roles" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                {USER_ROLES.map((role) => (
                  <SelectItem key={role.value} value={role.value}>
                    {role.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Loading indicator for page changes */}
          {isLoading && page > 1 && (
            <div className="flex justify-center py-4">
              <div className="text-sm text-muted-foreground">Loading...</div>
            </div>
          )}

          {/* Users Table */}
          {!isLoading && users.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No users found"
              description={
                searchQuery || roleFilter !== "all" || statusFilter !== "all"
                  ? "No users match your filters. Try adjusting your search criteria."
                  : "No users have been created yet."
              }
              className="min-h-[300px]"
            />
          ) : !isLoading && (
            <>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Username</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Brands</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Joined</TableHead>
                      <TableHead className="w-[100px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((user) => (
                      <TableRow key={user.id} className="hover:bg-muted/50">
                        <TableCell className="font-medium">
                          {user.username}
                          {user.id === currentUser?.id && (
                            <span className="ml-2 text-xs text-muted-foreground">(you)</span>
                          )}
                        </TableCell>
                        <TableCell>{user.email || "-"}</TableCell>
                        <TableCell>
                          {user.first_name || user.last_name
                            ? `${user.first_name} ${user.last_name}`.trim()
                            : "-"}
                        </TableCell>
                        <TableCell>
                          <RoleBadge role={user.role} />
                        </TableCell>
                        <TableCell>
                          {user.brands_detail && user.brands_detail.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {user.brands_detail.slice(0, 2).map((brand) => (
                                <Badge key={brand.id} variant="outline" className="text-xs">
                                  {brand.name}
                                </Badge>
                              ))}
                              {user.brands_detail.length > 2 && (
                                <Badge variant="outline" className="text-xs">
                                  +{user.brands_detail.length - 2}
                                </Badge>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant={user.is_active ? "success" : "secondary"}>
                            {user.is_active ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                        <TableCell>{formatDate(user.date_joined)}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setEditingUser(user)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setDeletingUser(user)}
                              disabled={user.id === currentUser?.id}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              <Pagination
                currentPage={page}
                totalPages={totalPages}
                totalCount={totalCount}
                pageSize={pageSize}
                onPageChange={setPage}
              />
            </>
          )}
        </CardContent>
      </Card>

      {/* Edit User Dialog */}
      <UserEditDialog
        user={editingUser}
        open={!!editingUser}
        onOpenChange={(open) => !open && setEditingUser(null)}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deletingUser} onOpenChange={(open) => !open && setDeletingUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete User</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {deletingUser?.username}? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletingUser(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteUser.isPending}
            >
              {deleteUser.isPending ? "Deleting..." : "Delete User"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
