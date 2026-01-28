"use client";

import { User, Lock, Settings } from "lucide-react";
import { useAuthStore } from "@/stores/auth-store";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ProfileForm } from "@/components/settings/profile-form";
import { PasswordForm } from "@/components/settings/password-form";
import { PreferencesForm } from "@/components/settings/preferences-form";
import { PageLoader } from "@/components/shared/loading-spinner";

export default function SettingsPage() {
  const { user, isLoading } = useAuthStore();

  if (isLoading || !user) {
    return <PageLoader message="Loading settings..." />;
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">
          Manage your account settings and preferences.
        </p>
      </div>

      {/* Settings Tabs */}
      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList>
          <TabsTrigger value="profile" className="gap-2">
            <User className="h-4 w-4" />
            Profile
          </TabsTrigger>
          <TabsTrigger value="password" className="gap-2">
            <Lock className="h-4 w-4" />
            Password
          </TabsTrigger>
          <TabsTrigger value="preferences" className="gap-2">
            <Settings className="h-4 w-4" />
            Preferences
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <ProfileForm user={user} />
        </TabsContent>

        <TabsContent value="password">
          <PasswordForm />
        </TabsContent>

        <TabsContent value="preferences">
          <PreferencesForm />
        </TabsContent>
      </Tabs>
    </div>
  );
}
