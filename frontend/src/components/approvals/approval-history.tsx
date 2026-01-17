"use client";

import {
  CheckCircle,
  XCircle,
  Send,
  Clock,
  RotateCcw,
  Calendar,
  MessageSquare,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatDateTime } from "@/lib/utils";
import type { ApprovalStep } from "@/types";

interface ApprovalHistoryProps {
  history: ApprovalStep[];
  className?: string;
}

function getDecisionConfig(decision: ApprovalStep["decision"]) {
  switch (decision) {
    case "approved":
      return {
        icon: CheckCircle,
        color: "text-green-600",
        bgColor: "bg-green-100 dark:bg-green-900/30",
        label: "Approved",
      };
    case "rejected":
      return {
        icon: XCircle,
        color: "text-red-600",
        bgColor: "bg-red-100 dark:bg-red-900/30",
        label: "Rejected",
      };
    case "submitted":
      return {
        icon: Send,
        color: "text-blue-600",
        bgColor: "bg-blue-100 dark:bg-blue-900/30",
        label: "Submitted",
      };
    case "requested_changes":
      return {
        icon: RotateCcw,
        color: "text-yellow-600",
        bgColor: "bg-yellow-100 dark:bg-yellow-900/30",
        label: "Changes Requested",
      };
    default:
      return {
        icon: Clock,
        color: "text-gray-600",
        bgColor: "bg-gray-100 dark:bg-gray-900/30",
        label: decision,
      };
  }
}

function ApprovalHistoryItem({ step, isLast }: { step: ApprovalStep; isLast: boolean }) {
  const config = getDecisionConfig(step.decision);
  const Icon = config.icon;

  return (
    <div className="flex gap-4">
      {/* Timeline indicator */}
      <div className="flex flex-col items-center">
        <div className={`rounded-full p-2 ${config.bgColor}`}>
          <Icon className={`h-4 w-4 ${config.color}`} />
        </div>
        {!isLast && <div className="w-px flex-1 bg-border mt-2" />}
      </div>

      {/* Content */}
      <div className="flex-1 pb-6">
        <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
          <span className={`font-medium ${config.color}`}>{config.label}</span>
          <span className="text-sm text-muted-foreground">
            by {step.approver_name || "System"}
          </span>
          <span className="text-sm text-muted-foreground sm:ml-auto">
            {formatDateTime(step.created_at)}
          </span>
        </div>

        {/* Status change info */}
        <div className="mt-1 text-sm text-muted-foreground">
          {step.previous_status} → {step.new_status}
        </div>

        {/* Comments */}
        {step.comments && (
          <div className="mt-2 flex items-start gap-2 rounded-lg border bg-muted/50 p-3">
            <MessageSquare className="h-4 w-4 mt-0.5 text-muted-foreground" />
            <p className="text-sm">{step.comments}</p>
          </div>
        )}
      </div>
    </div>
  );
}

export function ApprovalHistory({ history, className }: ApprovalHistoryProps) {
  if (!history || history.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>Approval History</CardTitle>
          <CardDescription>No approval history yet</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Actions taken on this campaign will appear here.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Sort by date, newest first
  const sortedHistory = [...history].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Approval History</CardTitle>
        <CardDescription>
          Timeline of approvals and status changes
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-0">
          {sortedHistory.map((step, index) => (
            <ApprovalHistoryItem
              key={step.id}
              step={step}
              isLast={index === sortedHistory.length - 1}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Compact version for inline display
 */
export function ApprovalHistoryCompact({ history }: { history: ApprovalStep[] }) {
  if (!history || history.length === 0) {
    return null;
  }

  const latestStep = history[history.length - 1];
  const config = getDecisionConfig(latestStep.decision);
  const Icon = config.icon;

  return (
    <div className="flex items-center gap-2 text-sm">
      <Icon className={`h-4 w-4 ${config.color}`} />
      <span>
        {config.label} by {latestStep.approver_name || "System"}
      </span>
      <span className="text-muted-foreground">
        {formatDateTime(latestStep.created_at)}
      </span>
    </div>
  );
}
