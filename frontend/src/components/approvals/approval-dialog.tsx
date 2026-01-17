"use client";

import { useState } from "react";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  useSubmitCampaign,
  useApproveCampaign,
  useRejectCampaign,
  useScheduleCampaign,
  useReviseCampaign,
} from "@/hooks/use-campaigns";
import { useToast } from "@/hooks/use-toast";
import type { LocationCampaign } from "@/types";

interface ApprovalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaign: LocationCampaign;
  action: string;
  title: string;
  requiresComments?: boolean;
  commentsLabel?: string;
  onSuccess?: () => void;
}

export function ApprovalDialog({
  open,
  onOpenChange,
  campaign,
  action,
  title,
  requiresComments = false,
  commentsLabel = "Comments (optional)",
  onSuccess,
}: ApprovalDialogProps) {
  const { toast } = useToast();
  const [comments, setComments] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submitCampaign = useSubmitCampaign();
  const approveCampaign = useApproveCampaign();
  const rejectCampaign = useRejectCampaign();
  const scheduleCampaign = useScheduleCampaign();
  const reviseCampaign = useReviseCampaign();

  const handleSubmit = async () => {
    // Validate required comments
    if (requiresComments && !comments.trim()) {
      setError("Comments are required for this action.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      switch (action) {
        case "submit":
          await submitCampaign.mutateAsync({
            id: campaign.id,
            comments: comments || undefined,
          });
          toast({
            title: "Campaign submitted",
            description: "Your campaign has been submitted for review.",
          });
          break;

        case "approve":
          await approveCampaign.mutateAsync({
            id: campaign.id,
            comments: comments || undefined,
          });
          toast({
            title: "Campaign approved",
            description: "The campaign has been approved.",
          });
          break;

        case "reject":
          await rejectCampaign.mutateAsync({
            id: campaign.id,
            comments: comments,
          });
          toast({
            title: "Campaign rejected",
            description: "The campaign has been rejected with feedback.",
          });
          break;

        case "schedule":
          await scheduleCampaign.mutateAsync(campaign.id);
          toast({
            title: "Campaign scheduled",
            description: "The campaign has been scheduled for publishing.",
          });
          break;

        case "revise":
          await reviseCampaign.mutateAsync({
            id: campaign.id,
            comments: comments || undefined,
          });
          toast({
            title: "Revision requested",
            description: "The campaign has been sent back for revision.",
          });
          break;

        default:
          throw new Error(`Unknown action: ${action}`);
      }

      onSuccess?.();
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "An error occurred";
      setError(errorMessage);
      toast({
        variant: "destructive",
        title: "Action failed",
        description: errorMessage,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setComments("");
      setError(null);
    }
    onOpenChange(newOpen);
  };

  const getActionVariant = (): "default" | "destructive" => {
    return action === "reject" ? "destructive" : "default";
  };

  const getDescription = () => {
    switch (action) {
      case "submit":
        return "Submit this campaign for review. A reviewer will need to approve it before it can be scheduled.";
      case "approve":
        return "Approve this campaign. It will be ready for scheduling after approval.";
      case "reject":
        return "Reject this campaign and send it back for revision. Please provide feedback explaining what needs to be changed.";
      case "schedule":
        return "Schedule this campaign for publishing based on the configured dates.";
      case "revise":
        return "Send this campaign back for revision. The author will be notified to make changes.";
      default:
        return "";
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{getDescription()}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Campaign Info */}
          <div className="rounded-lg border bg-muted/50 p-3">
            <p className="font-medium">{campaign.template_name}</p>
            <p className="text-sm text-muted-foreground">
              {campaign.location_name} • {campaign.brand_name}
            </p>
          </div>

          {/* Comments Input */}
          {action !== "schedule" && (
            <div className="space-y-2">
              <Label htmlFor="comments">
                {commentsLabel}
                {requiresComments && (
                  <span className="text-destructive ml-1">*</span>
                )}
              </Label>
              <Textarea
                id="comments"
                placeholder={
                  requiresComments
                    ? "Please provide detailed feedback..."
                    : "Add any notes or comments..."
                }
                value={comments}
                onChange={(e) => {
                  setComments(e.target.value);
                  if (error) setError(null);
                }}
                rows={4}
                className={error ? "border-destructive" : ""}
              />
              {error && (
                <div className="flex items-center gap-2 text-sm text-destructive">
                  <AlertCircle className="h-4 w-4" />
                  {error}
                </div>
              )}
            </div>
          )}

          {/* Warning for rejection */}
          {action === "reject" && (
            <div className="flex items-start gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm">
              <AlertCircle className="h-4 w-4 mt-0.5 text-destructive" />
              <div>
                <p className="font-medium text-destructive">
                  This action will reject the campaign
                </p>
                <p className="text-muted-foreground">
                  The author will be notified and will need to make revisions
                  before resubmitting.
                </p>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            variant={getActionVariant()}
            onClick={handleSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting ? "Processing..." : title}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
