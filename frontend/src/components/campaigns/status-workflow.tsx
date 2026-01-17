"use client";

import { useState } from "react";
import {
  Send,
  CheckCircle,
  XCircle,
  Calendar,
  Edit,
  Trash2,
  RotateCcw,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { StatusBadge } from "@/components/campaigns/status-badge";
import { ApprovalDialog } from "@/components/approvals/approval-dialog";
import { CAMPAIGN_STATUS_CONFIG } from "@/types/campaign";
import type { CampaignStatus, LocationCampaign } from "@/types";

interface StatusWorkflowProps {
  campaign: LocationCampaign;
  onEdit?: () => void;
  onDelete?: () => void;
  onActionComplete?: () => void;
}

interface WorkflowAction {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  variant: "default" | "destructive" | "outline" | "secondary";
  requiresComments?: boolean;
  commentsLabel?: string;
}

const WORKFLOW_ACTIONS: Record<CampaignStatus, WorkflowAction[]> = {
  draft: [
    {
      id: "submit",
      label: "Submit for Review",
      icon: Send,
      variant: "default",
      commentsLabel: "Add submission notes (optional)",
    },
    { id: "edit", label: "Edit", icon: Edit, variant: "outline" },
    { id: "delete", label: "Delete", icon: Trash2, variant: "destructive" },
  ],
  pending_review: [
    {
      id: "approve",
      label: "Approve",
      icon: CheckCircle,
      variant: "default",
      commentsLabel: "Add approval notes (optional)",
    },
    {
      id: "reject",
      label: "Reject",
      icon: XCircle,
      variant: "destructive",
      requiresComments: true,
      commentsLabel: "Rejection reason (required)",
    },
  ],
  approved: [
    {
      id: "schedule",
      label: "Schedule",
      icon: Calendar,
      variant: "default",
    },
    {
      id: "revise",
      label: "Request Revision",
      icon: RotateCcw,
      variant: "outline",
      commentsLabel: "Revision notes (optional)",
    },
  ],
  rejected: [
    {
      id: "revise",
      label: "Revise & Resubmit",
      icon: Edit,
      variant: "default",
      commentsLabel: "What changes were made (optional)",
    },
    { id: "delete", label: "Delete", icon: Trash2, variant: "destructive" },
  ],
  scheduled: [
    {
      id: "revise",
      label: "Cancel & Revise",
      icon: RotateCcw,
      variant: "outline",
      commentsLabel: "Reason for revision (optional)",
    },
  ],
  active: [],
  completed: [],
};

// Status flow visualization
const STATUS_FLOW: CampaignStatus[] = [
  "draft",
  "pending_review",
  "approved",
  "scheduled",
  "active",
  "completed",
];

function StatusFlowIndicator({ currentStatus }: { currentStatus: CampaignStatus }) {
  const currentIndex = STATUS_FLOW.indexOf(currentStatus);
  const isRejected = currentStatus === "rejected";

  return (
    <div className="flex items-center gap-1 overflow-x-auto pb-2">
      {STATUS_FLOW.map((status, index) => {
        const config = CAMPAIGN_STATUS_CONFIG[status];
        const isPast = index < currentIndex;
        const isCurrent = status === currentStatus;
        const isFuture = index > currentIndex;

        return (
          <div key={status} className="flex items-center">
            <div
              className={`flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium whitespace-nowrap ${
                isCurrent
                  ? "bg-primary text-primary-foreground"
                  : isPast
                  ? "bg-muted text-muted-foreground"
                  : "bg-muted/50 text-muted-foreground/50"
              }`}
            >
              {isPast && <CheckCircle className="h-3 w-3" />}
              {config?.label || status}
            </div>
            {index < STATUS_FLOW.length - 1 && (
              <ArrowRight
                className={`h-4 w-4 mx-1 ${
                  isPast ? "text-muted-foreground" : "text-muted-foreground/30"
                }`}
              />
            )}
          </div>
        );
      })}
      {isRejected && (
        <>
          <ArrowRight className="h-4 w-4 mx-1 text-destructive" />
          <div className="flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium bg-destructive text-destructive-foreground whitespace-nowrap">
            <XCircle className="h-3 w-3" />
            Rejected
          </div>
        </>
      )}
    </div>
  );
}

export function StatusWorkflow({
  campaign,
  onEdit,
  onDelete,
  onActionComplete,
}: StatusWorkflowProps) {
  const [selectedAction, setSelectedAction] = useState<WorkflowAction | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const actions = WORKFLOW_ACTIONS[campaign.status] || [];

  const handleActionClick = (action: WorkflowAction) => {
    if (action.id === "edit" && onEdit) {
      onEdit();
      return;
    }

    if (action.id === "delete" && onDelete) {
      onDelete();
      return;
    }

    // Open dialog for workflow actions
    setSelectedAction(action);
    setDialogOpen(true);
  };

  const handleDialogClose = () => {
    setDialogOpen(false);
    setSelectedAction(null);
  };

  const handleActionComplete = () => {
    handleDialogClose();
    onActionComplete?.();
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                Status
                <StatusBadge status={campaign.status} />
              </CardTitle>
              <CardDescription>
                {CAMPAIGN_STATUS_CONFIG[campaign.status]?.description ||
                  "Campaign status"}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Status Flow Indicator */}
          <StatusFlowIndicator currentStatus={campaign.status} />

          {/* Action Buttons */}
          {actions.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-2 border-t">
              {actions.map((action) => (
                <Button
                  key={action.id}
                  variant={action.variant}
                  size="sm"
                  onClick={() => handleActionClick(action)}
                >
                  <action.icon className="mr-2 h-4 w-4" />
                  {action.label}
                </Button>
              ))}
            </div>
          )}

          {actions.length === 0 && (
            <p className="text-sm text-muted-foreground pt-2 border-t">
              No actions available for this status.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Approval Dialog */}
      {selectedAction && (
        <ApprovalDialog
          open={dialogOpen}
          onOpenChange={handleDialogClose}
          campaign={campaign}
          action={selectedAction.id}
          title={selectedAction.label}
          requiresComments={selectedAction.requiresComments}
          commentsLabel={selectedAction.commentsLabel}
          onSuccess={handleActionComplete}
        />
      )}
    </>
  );
}
