"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, Search, Filter, Megaphone, Calendar, MapPin } from "lucide-react";
import { useCampaigns } from "@/hooks/use-campaigns";
import { useBrands } from "@/hooks/use-brands";
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
import { PageLoader } from "@/components/shared/loading-spinner";
import { ErrorState, EmptyState } from "@/components/shared/error-state";
import { StatusBadge } from "@/components/campaigns/status-badge";
import { formatDate } from "@/lib/utils";
import type { LocationCampaign } from "@/types";

const STATUS_OPTIONS = [
  { value: "all", label: "All Statuses" },
  { value: "draft", label: "Draft" },
  { value: "pending_review", label: "Pending Review" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "scheduled", label: "Scheduled" },
  { value: "active", label: "Active" },
  { value: "completed", label: "Completed" },
];

function CampaignRow({ campaign }: { campaign: LocationCampaign }) {
  return (
    <TableRow>
      <TableCell>
        <Link
          href={`/dashboard/campaigns/${campaign.id}`}
          className="font-medium hover:underline"
        >
          {campaign.template_name || "Untitled Campaign"}
        </Link>
        <p className="text-sm text-muted-foreground">
          {campaign.location_name}
        </p>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-1 text-sm text-muted-foreground">
          <MapPin className="h-3 w-3" />
          {campaign.brand_name || "-"}
        </div>
      </TableCell>
      <TableCell>
        <StatusBadge status={campaign.status} />
      </TableCell>
      <TableCell>
        {campaign.scheduled_start ? (
          <div className="flex items-center gap-1 text-sm">
            <Calendar className="h-3 w-3 text-muted-foreground" />
            {formatDate(campaign.scheduled_start)}
          </div>
        ) : (
          <span className="text-sm text-muted-foreground">Not scheduled</span>
        )}
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">
        {formatDate(campaign.created_at)}
      </TableCell>
      <TableCell>
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/dashboard/campaigns/${campaign.id}`}>View</Link>
        </Button>
      </TableCell>
    </TableRow>
  );
}

export default function CampaignsPage() {
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [brandFilter, setBrandFilter] = useState<string>("all");

  const { data: brandsData } = useBrands({ page: 1 });
  const { data, isLoading, isError, refetch } = useCampaigns({
    page,
    status: statusFilter !== "all" ? statusFilter : undefined,
    brand: brandFilter !== "all" ? brandFilter : undefined,
  });

  if (isLoading) {
    return <PageLoader message="Loading campaigns..." />;
  }

  if (isError) {
    return (
      <ErrorState
        title="Failed to load campaigns"
        message="There was an error loading your campaigns. Please try again."
        onRetry={() => refetch()}
      />
    );
  }

  const campaigns = data?.results || [];
  const totalPages = Math.ceil((data?.count || 0) / 10);
  const brands = brandsData?.results || [];

  // Calculate stats
  const stats = {
    total: data?.count || 0,
    draft: campaigns.filter((c) => c.status === "draft").length,
    pending: campaigns.filter((c) => c.status === "pending_review").length,
    active: campaigns.filter((c) => c.status === "active").length,
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Campaigns</h1>
          <p className="text-muted-foreground">
            Manage and track your marketing campaigns across locations.
          </p>
        </div>
        <Button asChild>
          <Link href="/dashboard/campaigns/new">
            <Plus className="mr-2 h-4 w-4" />
            New Campaign
          </Link>
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Campaigns</CardDescription>
            <CardTitle className="text-2xl">{stats.total}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Drafts</CardDescription>
            <CardTitle className="text-2xl">{stats.draft}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Pending Review</CardDescription>
            <CardTitle className="text-2xl">{stats.pending}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Active</CardDescription>
            <CardTitle className="text-2xl">{stats.active}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Campaign List</CardTitle>
          <CardDescription>
            View and manage all campaigns
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Select value={brandFilter} onValueChange={setBrandFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All Brands" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Brands</SelectItem>
                {brands.map((brand) => (
                  <SelectItem key={brand.id} value={brand.id}>
                    {brand.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {data?.count !== undefined && (
              <Badge variant="secondary" className="ml-auto">
                {data.count} campaigns
              </Badge>
            )}
          </div>

          {/* Table */}
          {campaigns.length === 0 ? (
            <EmptyState
              icon={Megaphone}
              title="No campaigns found"
              description={
                statusFilter !== "all" || brandFilter !== "all"
                  ? "No campaigns match your filters. Try adjusting your search."
                  : "Create your first campaign to get started."
              }
              action={
                statusFilter === "all" &&
                brandFilter === "all" && (
                  <Button asChild>
                    <Link href="/dashboard/campaigns/new">
                      <Plus className="mr-2 h-4 w-4" />
                      New Campaign
                    </Link>
                  </Button>
                )
              }
              className="min-h-[300px]"
            />
          ) : (
            <>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Campaign</TableHead>
                      <TableHead>Brand</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Schedule</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead className="w-[80px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {campaigns.map((campaign) => (
                      <CampaignRow key={campaign.id} campaign={campaign} />
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                  >
                    Previous
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    Page {page} of {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                  >
                    Next
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
