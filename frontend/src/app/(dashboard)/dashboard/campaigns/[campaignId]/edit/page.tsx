"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useCampaign } from "@/hooks/use-campaigns";
import { Button } from "@/components/ui/button";
import { CampaignForm } from "@/components/campaigns/campaign-form";
import { PageLoader } from "@/components/shared/loading-spinner";
import { ErrorState } from "@/components/shared/error-state";

interface CampaignEditPageProps {
  params: { campaignId: string };
}

export default function CampaignEditPage({ params }: CampaignEditPageProps) {
  const { campaignId } = params;
  const { data: campaign, isLoading, isError, refetch } = useCampaign(campaignId);

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

  // Only allow editing draft or rejected campaigns
  const canEdit = ["draft", "rejected"].includes(campaign.status);

  if (!canEdit) {
    return (
      <ErrorState
        title="Cannot edit campaign"
        message={`This campaign is in "${campaign.status}" status and cannot be edited. Only draft or rejected campaigns can be modified.`}
        onRetry={() => window.history.back()}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Back Link */}
      <Button variant="ghost" size="sm" asChild>
        <Link href={`/dashboard/campaigns/${campaignId}`}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Campaign
        </Link>
      </Button>

      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Edit Campaign</h1>
        <p className="text-muted-foreground">
          {campaign.template_name} - {campaign.location_name}
        </p>
      </div>

      {/* Form */}
      <CampaignForm campaign={campaign} />
    </div>
  );
}
