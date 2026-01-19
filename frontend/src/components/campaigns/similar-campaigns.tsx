"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Layers,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Sparkles,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useSimilarCampaigns,
  type SimilarCampaign,
} from "@/hooks/use-campaigns";

interface SimilarCampaignsProps {
  campaignId: string;
  hasEmbedding?: boolean;
  limit?: number;
  threshold?: number;
  sameBrand?: boolean;
}

function SimilarCampaignCard({ campaign }: { campaign: SimilarCampaign }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const similarityPercent = Math.round(campaign.similarity_score * 100);

  return (
    <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
      <div className="rounded-lg border p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <Link
                href={`/dashboard/campaigns/${campaign.campaign_id}`}
                className="font-medium hover:underline truncate"
              >
                {campaign.template_name}
              </Link>
              <Badge variant="outline" className="shrink-0">
                {similarityPercent}% match
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground truncate">
              {campaign.location_name} - {campaign.brand_name}
            </p>
          </div>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm">
              {isExpanded ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>
          </CollapsibleTrigger>
        </div>

        <div className="mt-2">
          <Progress value={similarityPercent} className="h-1" />
        </div>

        <CollapsibleContent>
          <div className="mt-3 space-y-3">
            <div className="rounded-md bg-muted p-3 text-sm">
              <p className="text-muted-foreground">
                {campaign.content_preview}
              </p>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link href={`/dashboard/campaigns/${campaign.campaign_id}`}>
                <ExternalLink className="mr-2 h-4 w-4" />
                View Campaign
              </Link>
            </Button>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map((i) => (
        <div key={i} className="rounded-lg border p-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
            <Skeleton className="h-8 w-8" />
          </div>
          <Skeleton className="mt-2 h-1 w-full" />
        </div>
      ))}
    </div>
  );
}

export function SimilarCampaigns({
  campaignId,
  hasEmbedding = true,
  limit = 5,
  threshold = 0.6,
  sameBrand = false,
}: SimilarCampaignsProps) {
  const { data, isLoading, isError, refetch } = useSimilarCampaigns(
    campaignId,
    { limit, threshold, sameBrand }
  );

  // Don't fetch if there's no embedding
  const similarCampaigns = hasEmbedding ? data?.results || [] : [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Layers className="h-5 w-5" />
          Similar Campaigns
        </CardTitle>
        <CardDescription>
          Campaigns with similar content based on AI analysis
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!hasEmbedding ? (
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <AlertCircle className="mb-3 h-10 w-10 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">
              Generate content first to find similar campaigns.
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Similar campaigns are found using AI embeddings of the content.
            </p>
          </div>
        ) : isLoading ? (
          <LoadingSkeleton />
        ) : isError ? (
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <AlertCircle className="mb-3 h-10 w-10 text-destructive/50" />
            <p className="text-sm text-muted-foreground">
              Failed to load similar campaigns.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={() => refetch()}
            >
              Try Again
            </Button>
          </div>
        ) : similarCampaigns.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <Sparkles className="mb-3 h-10 w-10 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">
              No similar campaigns found.
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              This campaign&apos;s content is unique!
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {similarCampaigns.map((campaign) => (
              <SimilarCampaignCard
                key={campaign.campaign_id}
                campaign={campaign}
              />
            ))}
            {data && data.total > limit && (
              <p className="text-center text-xs text-muted-foreground">
                Showing {limit} of {data.total} similar campaigns
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
