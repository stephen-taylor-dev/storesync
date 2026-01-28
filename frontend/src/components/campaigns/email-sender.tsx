"use client";

import { useState } from "react";
import {
  Users,
  Send,
  Loader2,
  Trash2,
  Plus,
  CheckCircle,
  XCircle,
  Clock,
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
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  useAddRecipients,
  useClearRecipients,
  useEmailRecipients,
  useEmailStats,
  useSendEmails,
} from "@/hooks/use-email";
import { LocationCampaign } from "@/types";

interface EmailSenderProps {
  campaign: LocationCampaign;
  onSendComplete?: () => void;
}

export function EmailSender({ campaign, onSendComplete }: EmailSenderProps) {
  const { toast } = useToast();
  const [addRecipientsOpen, setAddRecipientsOpen] = useState(false);
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);
  const [recipientInput, setRecipientInput] = useState("");

  const { data: emailStats, isLoading: isLoadingStats } = useEmailStats(
    campaign.id,
    !!campaign.has_html_email
  );

  const { data: recipients } = useEmailRecipients(campaign.id, {}, !!campaign.has_html_email);

  const addRecipients = useAddRecipients();
  const sendEmails = useSendEmails();
  const clearRecipients = useClearRecipients();

  const hasHtmlEmail = campaign.has_html_email;
  const isActive = campaign.status === "active";
  const stats = emailStats || { total: 0, pending: 0, sent: 0, failed: 0 };
  const sendProgress = stats.total > 0 ? ((stats.sent + stats.failed) / stats.total) * 100 : 0;
  const canSend = hasHtmlEmail && stats.pending > 0 && isActive;

  const parseRecipients = (input: string): Array<{ email: string; name?: string }> => {
    const lines = input.split("\n").filter((line) => line.trim());
    return lines.map((line) => {
      // Support formats: "email" or "email, name" or "name <email>"
      const emailMatch = line.match(/<([^>]+)>/);
      if (emailMatch) {
        const email = emailMatch[1].trim();
        const name = line.replace(/<[^>]+>/, "").trim();
        return { email, name };
      }

      const parts = line.split(",").map((p) => p.trim());
      if (parts.length >= 2) {
        return { email: parts[0], name: parts[1] };
      }

      return { email: parts[0] };
    });
  };

  const handleAddRecipients = async () => {
    const parsed = parseRecipients(recipientInput);
    if (parsed.length === 0) {
      toast({
        variant: "destructive",
        title: "No recipients",
        description: "Please enter at least one email address.",
      });
      return;
    }

    try {
      const result = await addRecipients.mutateAsync({
        campaignId: campaign.id,
        recipients: parsed,
      });

      toast({
        title: "Recipients added",
        description: `Added ${result.created} recipients${
          result.skipped > 0 ? `, skipped ${result.skipped} duplicates` : ""
        }`,
      });

      setAddRecipientsOpen(false);
      setRecipientInput("");
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Failed to add recipients",
        description: "Could not add recipients. Please try again.",
      });
    }
  };

  const handleSendEmails = async () => {
    try {
      const result = await sendEmails.mutateAsync({ campaignId: campaign.id });

      if (result.status === "queued") {
        toast({
          title: "Emails queued",
          description: "Emails are being sent in the background.",
        });
      } else {
        toast({
          title: "Emails sent",
          description: `Sent ${result.sent} emails${
            result.failed ? `, ${result.failed} failed` : ""
          }`,
        });
      }

      onSendComplete?.();
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Send failed",
        description: "Could not send emails. Please try again.",
      });
    }
  };

  const handleClearRecipients = async () => {
    try {
      const result = await clearRecipients.mutateAsync(campaign.id);
      toast({
        title: "Recipients cleared",
        description: `Removed ${result.deleted} pending recipients.`,
      });
      setClearConfirmOpen(false);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Failed to clear",
        description: "Could not clear recipients. Please try again.",
      });
    }
  };

  if (!hasHtmlEmail) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Email Recipients
          </CardTitle>
          <CardDescription>
            Generate an HTML email first to manage recipients and send emails.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Email Recipients
            </CardTitle>
            <CardDescription>
              Manage recipients and send your marketing email
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Dialog open={addRecipientsOpen} onOpenChange={setAddRecipientsOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Recipients
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>Add Recipients</DialogTitle>
                  <DialogDescription>
                    Enter email addresses, one per line. Optionally add names after a comma.
                  </DialogDescription>
                </DialogHeader>
                <div className="py-4">
                  <Textarea
                    placeholder={`email@example.com
another@example.com, John Doe
Jane Smith <jane@example.com>`}
                    value={recipientInput}
                    onChange={(e) => setRecipientInput(e.target.value)}
                    rows={8}
                    className="font-mono text-sm"
                  />
                  <p className="text-xs text-muted-foreground mt-2">
                    Supported formats: email, email with comma-separated name, or Name &lt;email&gt;
                  </p>
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setAddRecipientsOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleAddRecipients}
                    disabled={addRecipients.isPending}
                  >
                    {addRecipients.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Adding...
                      </>
                    ) : (
                      "Add Recipients"
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Button
              onClick={handleSendEmails}
              disabled={!canSend || sendEmails.isPending}
            >
              {sendEmails.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  Send Emails
                </>
              )}
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Stats */}
        <div className="grid grid-cols-4 gap-4">
          <div className="rounded-lg border p-3 text-center">
            <p className="text-2xl font-bold">{stats.total}</p>
            <p className="text-xs text-muted-foreground">Total</p>
          </div>
          <div className="rounded-lg border p-3 text-center">
            <div className="flex items-center justify-center gap-1">
              <Clock className="h-4 w-4 text-yellow-500" />
              <p className="text-2xl font-bold">{stats.pending}</p>
            </div>
            <p className="text-xs text-muted-foreground">Pending</p>
          </div>
          <div className="rounded-lg border p-3 text-center">
            <div className="flex items-center justify-center gap-1">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <p className="text-2xl font-bold">{stats.sent}</p>
            </div>
            <p className="text-xs text-muted-foreground">Sent</p>
          </div>
          <div className="rounded-lg border p-3 text-center">
            <div className="flex items-center justify-center gap-1">
              <XCircle className="h-4 w-4 text-red-500" />
              <p className="text-2xl font-bold">{stats.failed}</p>
            </div>
            <p className="text-xs text-muted-foreground">Failed</p>
          </div>
        </div>

        {/* Active Status Warning */}
        {!isActive && stats.pending > 0 && (
          <div className="flex items-center gap-2 rounded-lg border border-yellow-200 bg-yellow-50 p-3 text-yellow-800 dark:border-yellow-900 dark:bg-yellow-950 dark:text-yellow-200">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            <p className="text-sm">
              Campaign must be <strong>active</strong> to send emails. Current status:{" "}
              <span className="capitalize">{campaign.status.replace("_", " ")}</span>
            </p>
          </div>
        )}

        {/* Progress Bar */}
        {stats.total > 0 && (stats.sent > 0 || stats.failed > 0) && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Sending Progress</span>
              <span>{Math.round(sendProgress)}%</span>
            </div>
            <Progress value={sendProgress} className="h-2" />
          </div>
        )}

        {/* Recent Recipients */}
        {recipients && recipients.results.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">Recent Recipients</p>
              {stats.pending > 0 && (
                <Dialog open={clearConfirmOpen} onOpenChange={setClearConfirmOpen}>
                  <DialogTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Clear Pending
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Clear pending recipients?</DialogTitle>
                      <DialogDescription>
                        This will remove all {stats.pending} pending recipients. This action
                        cannot be undone.
                      </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setClearConfirmOpen(false)}>
                        Cancel
                      </Button>
                      <Button
                        variant="destructive"
                        onClick={handleClearRecipients}
                        disabled={clearRecipients.isPending}
                      >
                        {clearRecipients.isPending ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Clearing...
                          </>
                        ) : (
                          "Clear Recipients"
                        )}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              )}
            </div>
            <div className="rounded-lg border">
              <div className="max-h-[200px] overflow-y-auto">
                {recipients.results.slice(0, 10).map((recipient) => (
                  <div
                    key={recipient.id}
                    className="flex items-center justify-between px-4 py-2 border-b last:border-0"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{recipient.email}</p>
                      {recipient.name && (
                        <p className="text-xs text-muted-foreground truncate">
                          {recipient.name}
                        </p>
                      )}
                    </div>
                    <Badge
                      variant={
                        recipient.status === "sent"
                          ? "default"
                          : recipient.status === "failed"
                          ? "destructive"
                          : "secondary"
                      }
                    >
                      {recipient.status}
                    </Badge>
                  </div>
                ))}
              </div>
              {recipients.count > 10 && (
                <div className="px-4 py-2 border-t bg-muted/50">
                  <p className="text-xs text-muted-foreground text-center">
                    And {recipients.count - 10} more recipients...
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Empty State */}
        {stats.total === 0 && (
          <div className="text-center py-6">
            <Users className="h-12 w-12 mx-auto text-muted-foreground/50" />
            <p className="mt-2 text-sm text-muted-foreground">
              No recipients added yet. Click &quot;Add Recipients&quot; to get started.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
