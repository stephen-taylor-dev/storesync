"use client";

import { Settings, Construction } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/shared/error-state";

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">
          Configure application settings and preferences.
        </p>
      </div>

      {/* Content */}
      <Card>
        <CardHeader>
          <CardTitle>Application Settings</CardTitle>
          <CardDescription>
            Manage your organization's settings and configurations.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <EmptyState
            icon={Construction}
            title="Coming Soon"
            description="Settings management features are currently under development. Check back soon!"
            className="min-h-[300px]"
          />
        </CardContent>
      </Card>
    </div>
  );
}
