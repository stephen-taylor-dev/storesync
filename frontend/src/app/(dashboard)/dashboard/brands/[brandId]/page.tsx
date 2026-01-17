"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  Building2,
  MapPin,
  Megaphone,
  Settings,
  ArrowLeft,
  Plus,
} from "lucide-react";
import { useBrand } from "@/hooks/use-brands";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageLoader } from "@/components/shared/loading-spinner";
import { ErrorState } from "@/components/shared/error-state";
import { LocationTable } from "@/components/brands/location-table";
import { LocationFormDialog } from "@/components/brands/location-form-dialog";
import { formatDate } from "@/lib/utils";

export default function BrandDetailPage() {
  const params = useParams();
  const brandId = params.brandId as string;
  const [isLocationDialogOpen, setIsLocationDialogOpen] = useState(false);

  const { data: brand, isLoading, isError, refetch } = useBrand(brandId);

  if (isLoading) {
    return <PageLoader message="Loading brand..." />;
  }

  if (isError || !brand) {
    return (
      <ErrorState
        title="Failed to load brand"
        message="There was an error loading this brand. Please try again."
        onRetry={() => refetch()}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Back Link */}
      <Button variant="ghost" size="sm" asChild>
        <Link href="/dashboard/brands">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Brands
        </Link>
      </Button>

      {/* Page Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="flex items-center gap-4">
          {brand.logo ? (
            <img
              src={brand.logo}
              alt={brand.name}
              className="h-16 w-16 rounded-lg object-cover"
            />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-primary/10">
              <Building2 className="h-8 w-8 text-primary" />
            </div>
          )}
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{brand.name}</h1>
            <p className="text-muted-foreground">{brand.slug}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href={`/dashboard/brands/${brandId}/settings`}>
              <Settings className="mr-2 h-4 w-4" />
              Settings
            </Link>
          </Button>
          <Button onClick={() => setIsLocationDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Location
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Locations</CardTitle>
            <MapPin className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{brand.location_count ?? 0}</div>
            <p className="text-xs text-muted-foreground">
              Total store locations
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Campaigns</CardTitle>
            <Megaphone className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">-</div>
            <p className="text-xs text-muted-foreground">Active campaigns</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Created</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatDate(brand.created_at)}
            </div>
            <p className="text-xs text-muted-foreground">Brand created date</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="locations" className="space-y-4">
        <TabsList>
          <TabsTrigger value="locations">Locations</TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
          <TabsTrigger value="campaigns">Campaigns</TabsTrigger>
        </TabsList>

        <TabsContent value="locations" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Locations</CardTitle>
                  <CardDescription>
                    Manage store locations for {brand.name}
                  </CardDescription>
                </div>
                <Button
                  size="sm"
                  onClick={() => setIsLocationDialogOpen(true)}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Location
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <LocationTable brandId={brandId} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="templates" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Campaign Templates</CardTitle>
              <CardDescription>
                Templates available for {brand.name}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                No templates yet. Create your first template to get started.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="campaigns" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Campaigns</CardTitle>
              <CardDescription>
                Active and recent campaigns for {brand.name}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                No campaigns yet. Create your first campaign to get started.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Location Form Dialog */}
      <LocationFormDialog
        brandId={brandId}
        open={isLocationDialogOpen}
        onOpenChange={setIsLocationDialogOpen}
      />
    </div>
  );
}
