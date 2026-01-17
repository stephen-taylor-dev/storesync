"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Clock,
  CheckCircle,
  XCircle,
  Eye,
  RefreshCw,
  Filter,
  Inbox,
} from "lucide-react";
import { useCampaigns } from "@/hooks/use-campaigns";
import { useBrands } from "@/hooks/use-brands";
import { useApprovalPolling } from "@/hooks/use-polling";
import { Button } from "@/components/ui/button";
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
import { ApprovalDialog } from "@/components/approvals/approval-dialog";
import { formatDate, formatDateTime } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth-store";
import type { LocationCampaign } from "@/types";

function ApprovalQueueRow({
  campaign,
  onApprove,
  onReject,
}: {
  campaign: LocationCampaign;
  onApprove: (campaign: LocationCampaign) => void;
  onReject: (campaign: LocationCampaign) => void;
}) {
  return (
    <TableRow>
      <TableCell>
        <div>
          <Link
            href={`/dashboard/campaigns/${campaign.id}`}
            className="font-medium hover:underline"
          >
            {campaign.template_name || "Untitled"}
          </Link>
          <p className="text-sm text-muted-foreground">
            {campaign.location_name}
          </p>
        </div>
      </TableCell>
      <TableCell>
        <Badge variant="outline">{campaign.brand_name}</Badge>
      </TableCell>
      <TableCell>
        <div className="text-sm">
          <p>{campaign.created_by_name || "Unknown"}</p>
          <p className="text-muted-foreground">
            {formatDateTime(campaign.created_at)}
          </p>
        </div>
      </TableCell>
      <TableCell>
        {campaign.scheduled_start ? (
          <div className="text-sm">
            <p>{formatDate(campaign.scheduled_start)}</p>
            {campaign.scheduled_end && (
              <p className="text-muted-foreground">
                to {formatDate(campaign.scheduled_end)}
              </p>
            )}
          </div>
        ) : (
          <span className="text-sm text-muted-foreground">Not set</span>
        )}
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" asChild>
            <Link href={`/dashboard/campaigns/${campaign.id}`}>
              <Eye className="mr-1 h-4 w-4" />
              View
            </Link>
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={() => onApprove(campaign)}
          >
            <CheckCircle className="mr-1 h-4 w-4" />
            Approve
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => onReject(campaign)}
          >
            <XCircle className="mr-1 h-4 w-4" />
            Reject
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

export default function ApprovalsPage() {
  const { user } = useAuthStore();
  const [brandFilter, setBrandFilter] = useState<string>("all");
  const [selectedCampaign, setSelectedCampaign] =
    useState<LocationCampaign | null>(null);
  const [actionType, setActionType] = useState<"approve" | "reject" | null>(null);

  // Fetch pending campaigns
  const { data, isLoading, isError, refetch } = useCampaigns({
    status: "pending_review",
    brand: brandFilter !== "all" ? brandFilter : undefined,
  });

  const { data: brandsData } = useBrands({});

  // Enable polling for real-time updates
  const { refresh } = useApprovalPolling(true);

  if (isLoading) {
    return <PageLoader message="Loading approval queue..." />;
  }

  if (isError) {
    return (
      <ErrorState
        title="Failed to load approvals"
        message="There was an error loading the approval queue. Please try again."
        onRetry={() => refetch()}
      />
    );
  }

  const campaigns = data?.results || [];
  const brands = brandsData?.results || [];

  const handleApprove = (campaign: LocationCampaign) => {
    setSelectedCampaign(campaign);
    setActionType("approve");
  };

  const handleReject = (campaign: LocationCampaign) => {
    setSelectedCampaign(campaign);
    setActionType("reject");
  };

  const handleDialogClose = () => {
    setSelectedCampaign(null);
    setActionType(null);
  };

  const handleActionComplete = () => {
    handleDialogClose();
    refetch();
  };

  // Check if user has permission to approve
  const canApprove =
    user?.role === "admin" || user?.role === "brand_manager";

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Approval Queue</h1>
          <p className="text-muted-foreground">
            Review and approve pending campaign submissions.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={refresh}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Pending Review
            </CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{campaigns.length}</div>
            <p className="text-xs text-muted-foreground">
              Campaigns awaiting approval
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Your Role</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold capitalize">
              {user?.role?.replace("_", " ") || "Unknown"}
            </div>
            <p className="text-xs text-muted-foreground">
              {canApprove ? "Can approve campaigns" : "View only access"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Auto-Refresh</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-sm">Active (15s)</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Queue updates automatically
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Queue Table */}
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Pending Campaigns</CardTitle>
              <CardDescription>
                Campaigns submitted for review
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
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
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {campaigns.length === 0 ? (
            <EmptyState
              icon={Inbox}
              title="No pending approvals"
              description={
                brandFilter !== "all"
                  ? "No campaigns pending for this brand."
                  : "All caught up! No campaigns are waiting for review."
              }
              className="min-h-[300px]"
            />
          ) : !canApprove ? (
            <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 dark:border-yellow-900 dark:bg-yellow-900/20">
              <p className="text-sm text-yellow-800 dark:text-yellow-200">
                You don&apos;t have permission to approve campaigns. Contact an
                admin or brand manager to gain approval access.
              </p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Campaign</TableHead>
                    <TableHead>Brand</TableHead>
                    <TableHead>Submitted By</TableHead>
                    <TableHead>Schedule</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {campaigns.map((campaign) => (
                    <ApprovalQueueRow
                      key={campaign.id}
                      campaign={campaign}
                      onApprove={handleApprove}
                      onReject={handleReject}
                    />
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Approval/Rejection Dialog */}
      {selectedCampaign && actionType && (
        <ApprovalDialog
          open={!!selectedCampaign}
          onOpenChange={handleDialogClose}
          campaign={selectedCampaign}
          action={actionType}
          title={actionType === "approve" ? "Approve Campaign" : "Reject Campaign"}
          requiresComments={actionType === "reject"}
          commentsLabel={
            actionType === "reject"
              ? "Rejection reason (required)"
              : "Approval notes (optional)"
          }
          onSuccess={handleActionComplete}
        />
      )}
    </div>
  );
}
