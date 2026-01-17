"use client";

import Link from "next/link";
import {
  Building2,
  MapPin,
  Megaphone,
  Clock,
  TrendingUp,
  Plus,
  ArrowRight,
} from "lucide-react";
import { useAuthStore } from "@/stores/auth-store";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface StatCardProps {
  title: string;
  value: string | number;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  trend?: {
    value: number;
    isPositive: boolean;
  };
}

function StatCard({ title, value, description, icon: Icon, trend }: StatCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        <div className="flex items-center gap-1">
          {trend && (
            <span
              className={`text-xs ${
                trend.isPositive ? "text-green-600" : "text-red-600"
              }`}
            >
              {trend.isPositive ? "+" : ""}
              {trend.value}%
            </span>
          )}
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </CardContent>
    </Card>
  );
}

interface QuickActionProps {
  title: string;
  description: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

function QuickAction({ title, description, href, icon: Icon }: QuickActionProps) {
  return (
    <Link href={href}>
      <div className="flex items-center gap-4 rounded-lg border p-4 transition-colors hover:bg-muted/50">
        <div className="rounded-full bg-primary/10 p-2">
          <Icon className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1">
          <p className="font-medium">{title}</p>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        <ArrowRight className="h-4 w-4 text-muted-foreground" />
      </div>
    </Link>
  );
}

export default function DashboardPage() {
  const { user } = useAuthStore();

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            Welcome back, {user?.first_name || user?.username}! Here&apos;s an
            overview of your marketing operations.
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild>
            <Link href="/dashboard/campaigns/new">
              <Plus className="mr-2 h-4 w-4" />
              New Campaign
            </Link>
          </Button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Brands"
          value="-"
          description="Brands you manage"
          icon={Building2}
        />
        <StatCard
          title="Total Locations"
          value="-"
          description="Across all brands"
          icon={MapPin}
        />
        <StatCard
          title="Active Campaigns"
          value="-"
          description="Currently running"
          icon={Megaphone}
        />
        <StatCard
          title="Pending Approval"
          value="-"
          description="Awaiting review"
          icon={Clock}
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>
              Latest updates across your campaigns
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <TrendingUp className="h-12 w-12 text-muted-foreground/50" />
              <p className="mt-4 text-sm text-muted-foreground">
                No recent activity to display.
              </p>
              <p className="text-sm text-muted-foreground">
                Create your first campaign to get started.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Common tasks and shortcuts</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <QuickAction
              title="Create Campaign"
              description="Start a new marketing campaign"
              href="/dashboard/campaigns/new"
              icon={Megaphone}
            />
            <QuickAction
              title="Add Location"
              description="Register a new store location"
              href="/dashboard/locations/new"
              icon={MapPin}
            />
            <QuickAction
              title="Create Template"
              description="Design a new campaign template"
              href="/dashboard/templates/new"
              icon={Plus}
            />
            <QuickAction
              title="View All Brands"
              description="Manage your brand portfolio"
              href="/dashboard/brands"
              icon={Building2}
            />
          </CardContent>
        </Card>
      </div>

      {/* Campaigns Overview */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Campaign Overview</CardTitle>
            <CardDescription>
              Status of your recent campaigns
            </CardDescription>
          </div>
          <Button variant="outline" asChild>
            <Link href="/dashboard/campaigns">View All</Link>
          </Button>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Megaphone className="h-12 w-12 text-muted-foreground/50" />
            <p className="mt-4 text-sm text-muted-foreground">
              No campaigns yet.
            </p>
            <Button className="mt-4" asChild>
              <Link href="/dashboard/campaigns/new">
                <Plus className="mr-2 h-4 w-4" />
                Create Your First Campaign
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
