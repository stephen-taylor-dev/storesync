"use client";

import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Calendar,
  MapPin,
  FileText,
  Clock,
  User,
  RefreshCw,
} from "lucide-react";
import { useCampaign, useDeleteCampaign } from "@/hooks/use-campaigns";
import { useCampaignPolling } from "@/hooks/use-polling";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { PageLoader } from "@/components/shared/loading-spinner";
import { ErrorState } from "@/components/shared/error-state";
import { StatusBadge } from "@/components/campaigns/status-badge";
import { StatusWorkflow } from "@/components/campaigns/status-workflow";
import { ContentPreview } from "@/components/campaigns/content-preview";
import { SimilarCampaigns } from "@/components/campaigns/similar-campaigns";
import { EmailPreview } from "@/components/campaigns/email-preview";
import { EmailSender } from "@/components/campaigns/email-sender";
import { ApprovalHistory } from "@/components/approvals/approval-history";
import { useToast } from "@/hooks/use-toast";
import { formatDate, formatDateTime } from "@/lib/utils";

export default function CampaignDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const campaignId = params.campaignId as string;

  const { data: campaign, isLoading, isError, refetch } = useCampaign(campaignId);
  const deleteCampaign = useDeleteCampaign();

  // Enable polling for real-time status updates
  const { refresh } = useCampaignPolling(campaignId, !!campaign);

  if (isLoading) {
    return <PageLoader message="Loading campaign..." />;
  }

  if (isError || !campaign) {
    return (
      <ErrorState
        title="Failed to load campaign"
        message="There was an error loading this campaign. Please try again."
        onRetry={() => refetch()}
      />
    );
  }

  const handleEdit = () => {
    router.push(`/dashboard/campaigns/${campaign.id}/edit`);
  };

  const handleDelete = () => {
    if (confirm("Are you sure you want to delete this campaign?")) {
      deleteCampaign.mutate(campaign.id, {
        onSuccess: () => {
          toast({ title: "Campaign deleted" });
          router.push("/dashboard/campaigns");
        },
        onError: () => {
          toast({
            variant: "destructive",
            title: "Failed to delete campaign",
          });
        },
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Back Link & Refresh */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/dashboard/campaigns">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Campaigns
          </Link>
        </Button>
        <Button variant="outline" size="sm" onClick={refresh}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight">
              {campaign.template_name || "Campaign"}
            </h1>
            <StatusBadge status={campaign.status} />
          </div>
          <p className="text-muted-foreground">
            {campaign.location_name} • {campaign.brand_name}
          </p>
        </div>
      </div>

      {/* Content Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Status Workflow */}
          <StatusWorkflow
            campaign={campaign}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onActionComplete={refetch}
          />

          {/* Generated Content with AI Features */}
          <ContentPreview
            campaign={campaign}
            onContentUpdate={refetch}
            editable={["draft", "rejected"].includes(campaign.status)}
          />

          {/* HTML Email Preview */}
          <EmailPreview campaign={campaign} onEmailGenerated={refetch} />

          {/* Email Recipients & Sending */}
          <EmailSender campaign={campaign} onSendComplete={refetch} />

          {/* Customizations */}
          {campaign.customizations &&
            Object.keys(campaign.customizations).length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Customizations</CardTitle>
                  <CardDescription>
                    Custom variables for this campaign
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-2">
                    {Object.entries(campaign.customizations).map(
                      ([key, value]) => (
                        <div
                          key={key}
                          className="flex items-center justify-between rounded-lg border px-4 py-2"
                        >
                          <span className="font-medium">{key}</span>
                          <span className="text-muted-foreground">
                            {String(value)}
                          </span>
                        </div>
                      )
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

          {/* Approval History */}
          <ApprovalHistory history={campaign.approval_history || []} />

          {/* Similar Campaigns */}
          <SimilarCampaigns
            campaignId={campaign.id}
            hasEmbedding={!!campaign.generated_content}
          />
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Details Card */}
          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Location</p>
                  <p className="text-sm text-muted-foreground">
                    {campaign.location_name}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Template</p>
                  <p className="text-sm text-muted-foreground">
                    {campaign.template_name}
                  </p>
                </div>
              </div>

              <Separator />

              <div className="flex items-center gap-3">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Schedule</p>
                  <p className="text-sm text-muted-foreground">
                    {campaign.scheduled_start
                      ? `${formatDate(campaign.scheduled_start)}${
                          campaign.scheduled_end
                            ? ` - ${formatDate(campaign.scheduled_end)}`
                            : ""
                        }`
                      : "Not scheduled"}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <User className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Created By</p>
                  <p className="text-sm text-muted-foreground">
                    {campaign.created_by_name || "Unknown"}
                  </p>
                </div>
              </div>

              <Separator />

              <div className="flex items-center gap-3">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Created</p>
                  <p className="text-sm text-muted-foreground">
                    {formatDateTime(campaign.created_at)}
                  </p>
                </div>
              </div>

              {campaign.updated_at && (
                <div className="flex items-center gap-3">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Last Updated</p>
                    <p className="text-sm text-muted-foreground">
                      {formatDateTime(campaign.updated_at)}
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Auto-refresh indicator */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-sm">
                <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                <span className="text-muted-foreground">
                  Auto-refreshing every 10s
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
