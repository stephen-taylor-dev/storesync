"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Building2,
  MapPin,
  Megaphone,
  Settings,
  ArrowLeft,
  Plus,
  FileText,
  ExternalLink,
} from "lucide-react";
import { useBrand } from "@/hooks/use-brands";
import { useTemplates } from "@/hooks/use-templates";
import { useCampaigns } from "@/hooks/use-campaigns";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/campaigns/status-badge";
import { LoadingSpinner } from "@/components/shared/loading-spinner";
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
  const router = useRouter();
  const brandId = params.brandId as string;
  const [isLocationDialogOpen, setIsLocationDialogOpen] = useState(false);

  const { data: brand, isLoading, isError, refetch } = useBrand(brandId);
  const { data: templatesData, isLoading: templatesLoading } = useTemplates({ brand: brandId });
  const { data: campaignsData, isLoading: campaignsLoading } = useCampaigns({ brand: brandId });

  const templates = templatesData?.results || [];
  const campaigns = campaignsData?.results || [];

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
            <div className="text-2xl font-bold">{campaigns.length}</div>
            <p className="text-xs text-muted-foreground">Total campaigns</p>
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
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Campaign Templates</CardTitle>
                  <CardDescription>
                    Templates available for {brand.name}
                  </CardDescription>
                </div>
                <Button size="sm" asChild>
                  <Link href="/dashboard/templates/new">
                    <Plus className="mr-2 h-4 w-4" />
                    Create Template
                  </Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {templatesLoading ? (
                <div className="flex justify-center py-8">
                  <LoadingSpinner />
                </div>
              ) : templates.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No templates yet. Create your first template to get started.
                </p>
              ) : (
                <div className="space-y-3">
                  {templates.map((template) => (
                    <div
                      key={template.id}
                      className="flex items-center justify-between rounded-lg border p-4 hover:bg-muted/50 transition-colors cursor-pointer"
                      onClick={() => router.push(`/dashboard/templates/${template.id}`)}
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                          <FileText className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium">{template.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {template.campaign_type} • {template.campaign_count || 0} campaigns
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={template.is_active ? "default" : "secondary"}>
                          {template.is_active ? "Active" : "Inactive"}
                        </Badge>
                        <Button variant="ghost" size="icon" asChild>
                          <Link href={`/dashboard/templates/${template.id}`}>
                            <ExternalLink className="h-4 w-4" />
                          </Link>
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="campaigns" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Campaigns</CardTitle>
                  <CardDescription>
                    Active and recent campaigns for {brand.name}
                  </CardDescription>
                </div>
                <Button size="sm" asChild>
                  <Link href="/dashboard/campaigns/new">
                    <Plus className="mr-2 h-4 w-4" />
                    Create Campaign
                  </Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {campaignsLoading ? (
                <div className="flex justify-center py-8">
                  <LoadingSpinner />
                </div>
              ) : campaigns.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No campaigns yet. Create your first campaign to get started.
                </p>
              ) : (
                <div className="space-y-3">
                  {campaigns.map((campaign) => (
                    <div
                      key={campaign.id}
                      className="flex items-center justify-between rounded-lg border p-4 hover:bg-muted/50 transition-colors cursor-pointer"
                      onClick={() => router.push(`/dashboard/campaigns/${campaign.id}`)}
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                          <Megaphone className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium">{campaign.template_name || "Campaign"}</p>
                          <p className="text-sm text-muted-foreground">
                            {campaign.location_name}
                            {campaign.scheduled_start && ` • ${formatDate(campaign.scheduled_start)}`}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <StatusBadge status={campaign.status} />
                        <Button variant="ghost" size="icon" asChild>
                          <Link href={`/dashboard/campaigns/${campaign.id}`}>
                            <ExternalLink className="h-4 w-4" />
                          </Link>
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
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
