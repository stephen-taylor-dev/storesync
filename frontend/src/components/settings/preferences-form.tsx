"use client";

import { useEffect, useState } from "react";
import { Bell, Monitor } from "lucide-react";
import { useTheme } from "next-themes";
import { usePreferences, useUpdatePreferences } from "@/hooks/use-settings";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
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
import { useToast } from "@/hooks/use-toast";
import { Separator } from "@/components/ui/separator";
import { InlineLoader } from "@/components/shared/loading-spinner";

export function PreferencesForm() {
  const { toast } = useToast();
  const { theme, setTheme } = useTheme();
  const { data: preferences, isLoading } = usePreferences();
  const updatePreferences = useUpdatePreferences();
  const [mounted, setMounted] = useState(false);

  // Prevent hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  const handleNotificationChange = async (
    key: "email_campaign_submitted" | "email_campaign_approved" | "email_campaign_rejected",
    value: boolean
  ) => {
    try {
      await updatePreferences.mutateAsync({
        notifications: { [key]: value },
      });
      toast({
        title: "Preferences updated",
        description: "Your notification preferences have been saved.",
      });
    } catch {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update preferences. Please try again.",
      });
    }
  };

  const handleThemeChange = async (newTheme: "light" | "dark" | "system") => {
    setTheme(newTheme); // Apply immediately
    try {
      await updatePreferences.mutateAsync({
        display: { theme: newTheme },
      });
      toast({
        title: "Preferences updated",
        description: "Your display preferences have been saved.",
      });
    } catch {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update preferences. Please try again.",
      });
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <InlineLoader />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Notification Preferences */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            <div>
              <CardTitle>Email Notifications</CardTitle>
              <CardDescription>
                Choose when to receive email notifications about campaign activity.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="email_campaign_submitted">Campaign Submitted</Label>
              <p className="text-sm text-muted-foreground">
                Receive an email when a campaign is submitted for review.
              </p>
            </div>
            <Switch
              id="email_campaign_submitted"
              checked={preferences?.notifications?.email_campaign_submitted ?? true}
              onCheckedChange={(checked) =>
                handleNotificationChange("email_campaign_submitted", checked)
              }
              disabled={updatePreferences.isPending}
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="email_campaign_approved">Campaign Approved</Label>
              <p className="text-sm text-muted-foreground">
                Receive an email when your campaign is approved.
              </p>
            </div>
            <Switch
              id="email_campaign_approved"
              checked={preferences?.notifications?.email_campaign_approved ?? true}
              onCheckedChange={(checked) =>
                handleNotificationChange("email_campaign_approved", checked)
              }
              disabled={updatePreferences.isPending}
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="email_campaign_rejected">Campaign Rejected</Label>
              <p className="text-sm text-muted-foreground">
                Receive an email when your campaign is rejected.
              </p>
            </div>
            <Switch
              id="email_campaign_rejected"
              checked={preferences?.notifications?.email_campaign_rejected ?? true}
              onCheckedChange={(checked) =>
                handleNotificationChange("email_campaign_rejected", checked)
              }
              disabled={updatePreferences.isPending}
            />
          </div>
        </CardContent>
      </Card>

      {/* Display Preferences */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Monitor className="h-5 w-5" />
            <div>
              <CardTitle>Display Settings</CardTitle>
              <CardDescription>
                Customize how the application looks.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="theme">Theme</Label>
              <p className="text-sm text-muted-foreground">
                Select your preferred color theme.
              </p>
            </div>
            <Select
              value={mounted ? (theme ?? "system") : (preferences?.display?.theme ?? "system")}
              onValueChange={(value) =>
                handleThemeChange(value as "light" | "dark" | "system")
              }
              disabled={updatePreferences.isPending || !mounted}
            >
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Select theme" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="light">Light</SelectItem>
                <SelectItem value="dark">Dark</SelectItem>
                <SelectItem value="system">System</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
