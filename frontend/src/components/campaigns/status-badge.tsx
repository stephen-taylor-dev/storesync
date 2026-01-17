import { Badge } from "@/components/ui/badge";
import { CAMPAIGN_STATUS_CONFIG } from "@/types/campaign";
import type { CampaignStatus } from "@/types";

interface StatusBadgeProps {
  status: CampaignStatus;
  showDescription?: boolean;
}

export function StatusBadge({ status, showDescription = false }: StatusBadgeProps) {
  const config = CAMPAIGN_STATUS_CONFIG[status] || {
    label: status,
    variant: "secondary" as const,
    description: "",
  };

  if (showDescription) {
    return (
      <div className="flex flex-col gap-1">
        <Badge variant={config.variant}>{config.label}</Badge>
        <span className="text-xs text-muted-foreground">{config.description}</span>
      </div>
    );
  }

  return <Badge variant={config.variant}>{config.label}</Badge>;
}

// Helper to get available actions based on current status
export function getAvailableActions(status: CampaignStatus): string[] {
  switch (status) {
    case "draft":
      return ["submit", "edit", "delete"];
    case "pending_review":
      return ["approve", "reject"];
    case "approved":
      return ["schedule", "revise"];
    case "rejected":
      return ["revise", "delete"];
    case "scheduled":
      return ["revise"];
    case "active":
      return [];
    case "completed":
      return [];
    default:
      return [];
  }
}

// Helper to get next status description
export function getActionDescription(action: string): string {
  switch (action) {
    case "submit":
      return "Submit for review";
    case "approve":
      return "Approve campaign";
    case "reject":
      return "Reject with feedback";
    case "schedule":
      return "Schedule for publishing";
    case "revise":
      return "Send back for revision";
    case "edit":
      return "Edit campaign";
    case "delete":
      return "Delete campaign";
    default:
      return action;
  }
}
