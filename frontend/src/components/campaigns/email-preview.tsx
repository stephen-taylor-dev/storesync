"use client";

import { useState } from "react";
import { Mail, Monitor, Smartphone, RefreshCw, Send, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useEmailPreview, useGenerateHtmlEmail, useSendTestEmail } from "@/hooks/use-email";
import { LocationCampaign } from "@/types";

interface EmailPreviewProps {
  campaign: LocationCampaign;
  onEmailGenerated?: () => void;
}

export function EmailPreview({ campaign, onEmailGenerated }: EmailPreviewProps) {
  const { toast } = useToast();
  const [viewMode, setViewMode] = useState<"desktop" | "mobile">("desktop");
  const [testEmailDialogOpen, setTestEmailDialogOpen] = useState(false);
  const [testEmail, setTestEmail] = useState("");

  const {
    data: emailPreview,
    isLoading: isLoadingPreview,
    refetch: refetchPreview,
  } = useEmailPreview(campaign.id, true);

  const generateHtmlEmail = useGenerateHtmlEmail();
  const sendTestEmail = useSendTestEmail();

  const hasContent = !!campaign.generated_content;
  const hasHtmlEmail = emailPreview?.has_html_email ?? campaign.has_html_email;

  const handleGenerateHtmlEmail = async () => {
    if (!hasContent) {
      toast({
        variant: "destructive",
        title: "No content",
        description: "Generate campaign content first before creating the HTML email.",
      });
      return;
    }

    try {
      await generateHtmlEmail.mutateAsync({ campaignId: campaign.id });
      toast({
        title: "HTML email generated",
        description: "Your email is ready for preview and sending.",
      });
      refetchPreview();
      onEmailGenerated?.();
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Generation failed",
        description: "Failed to generate HTML email. Please try again.",
      });
    }
  };

  const handleSendTestEmail = async () => {
    if (!testEmail) {
      toast({
        variant: "destructive",
        title: "Email required",
        description: "Please enter an email address.",
      });
      return;
    }

    try {
      await sendTestEmail.mutateAsync({
        campaignId: campaign.id,
        email: testEmail,
      });
      toast({
        title: "Test email sent",
        description: `Test email sent to ${testEmail}`,
      });
      setTestEmailDialogOpen(false);
      setTestEmail("");
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Failed to send",
        description: "Could not send test email. Please check your email configuration.",
      });
    }
  };

  if (!hasContent) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            HTML Email
          </CardTitle>
          <CardDescription>
            Generate campaign content first to create an HTML email.
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
              <Mail className="h-5 w-5" />
              HTML Email
            </CardTitle>
            <CardDescription>
              {hasHtmlEmail
                ? "Preview and send your marketing email"
                : "Generate an HTML version of your campaign content"}
            </CardDescription>
          </div>
          <div className="flex gap-2">
            {hasHtmlEmail && (
              <Dialog open={testEmailDialogOpen} onOpenChange={setTestEmailDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Send className="mr-2 h-4 w-4" />
                    Send Test
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Send Test Email</DialogTitle>
                    <DialogDescription>
                      Send a test email to preview how it will look in an inbox.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="py-4">
                    <Label htmlFor="test-email">Email Address</Label>
                    <Input
                      id="test-email"
                      type="email"
                      placeholder="your@email.com"
                      value={testEmail}
                      onChange={(e) => setTestEmail(e.target.value)}
                    />
                  </div>
                  <DialogFooter>
                    <Button
                      variant="outline"
                      onClick={() => setTestEmailDialogOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleSendTestEmail}
                      disabled={sendTestEmail.isPending}
                    >
                      {sendTestEmail.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Sending...
                        </>
                      ) : (
                        "Send Test"
                      )}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
            <Button
              variant={hasHtmlEmail ? "outline" : "default"}
              size="sm"
              onClick={handleGenerateHtmlEmail}
              disabled={generateHtmlEmail.isPending}
            >
              {generateHtmlEmail.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  {hasHtmlEmail ? "Regenerate" : "Generate HTML Email"}
                </>
              )}
            </Button>
          </div>
        </div>
      </CardHeader>

      {hasHtmlEmail && emailPreview && (
        <CardContent className="space-y-4">
          {/* Subject and Preview Text */}
          <div className="space-y-2">
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground mb-1">Subject Line</p>
              <p className="font-medium">{emailPreview.email_subject || "No subject"}</p>
            </div>
            {emailPreview.email_preview_text && (
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground mb-1">Preview Text</p>
                <p className="text-sm text-muted-foreground">
                  {emailPreview.email_preview_text}
                </p>
              </div>
            )}
          </div>

          {/* View Mode Tabs */}
          <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as "desktop" | "mobile")}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="desktop" className="flex items-center gap-2">
                <Monitor className="h-4 w-4" />
                Desktop
              </TabsTrigger>
              <TabsTrigger value="mobile" className="flex items-center gap-2">
                <Smartphone className="h-4 w-4" />
                Mobile
              </TabsTrigger>
            </TabsList>

            <TabsContent value="desktop" className="mt-4">
              <div className="rounded-lg border bg-white overflow-hidden">
                <iframe
                  srcDoc={emailPreview.generated_html_email}
                  title="Email Preview (Desktop)"
                  className="w-full h-[500px] border-0"
                  sandbox="allow-same-origin"
                />
              </div>
            </TabsContent>

            <TabsContent value="mobile" className="mt-4">
              <div className="flex justify-center">
                <div
                  className="rounded-lg border bg-white overflow-hidden"
                  style={{ width: "375px" }}
                >
                  <iframe
                    srcDoc={emailPreview.generated_html_email}
                    title="Email Preview (Mobile)"
                    className="w-full h-[600px] border-0"
                    sandbox="allow-same-origin"
                  />
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      )}

      {isLoadingPreview && (
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      )}
    </Card>
  );
}
