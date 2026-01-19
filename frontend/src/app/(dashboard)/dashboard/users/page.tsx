"use client";

import { Users, Construction } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/shared/error-state";

export default function UsersPage() {
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Users</h1>
        <p className="text-muted-foreground">
          Manage user accounts and permissions.
        </p>
      </div>

      {/* Content */}
      <Card>
        <CardHeader>
          <CardTitle>User Management</CardTitle>
          <CardDescription>
            View and manage users across your organization.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <EmptyState
            icon={Construction}
            title="Coming Soon"
            description="User management features are currently under development. Check back soon!"
            className="min-h-[300px]"
          />
        </CardContent>
      </Card>
    </div>
  );
}
