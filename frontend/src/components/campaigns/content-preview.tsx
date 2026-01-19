"use client";

import { useState } from "react";
import { Copy, Check, Edit2, Save, X, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useUpdateCampaign } from "@/hooks/use-campaigns";
import { useToast } from "@/hooks/use-toast";
import { AIGenerateButton } from "./ai-generate-button";
import type { LocationCampaign } from "@/types";

interface ContentPreviewProps {
  campaign: LocationCampaign;
  onContentUpdate?: () => void;
  editable?: boolean;
}

export function ContentPreview({
  campaign,
  onContentUpdate,
  editable = true,
}: ContentPreviewProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState(
    campaign.generated_content || ""
  );
  const [copied, setCopied] = useState(false);

  const { toast } = useToast();
  const updateCampaign = useUpdateCampaign();

  const handleCopy = async () => {
    if (!campaign.generated_content) return;

    try {
      await navigator.clipboard.writeText(campaign.generated_content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({
        title: "Copied to clipboard",
        description: "The campaign content has been copied.",
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Copy failed",
        description: "Failed to copy content to clipboard.",
      });
    }
  };

  const handleSave = async () => {
    try {
      await updateCampaign.mutateAsync({
        id: campaign.id,
        data: { generated_content: editedContent },
      });
      toast({
        title: "Content saved",
        description: "The campaign content has been updated.",
      });
      setIsEditing(false);
      onContentUpdate?.();
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Save failed",
        description: "Failed to save content changes.",
      });
    }
  };

  const handleCancel = () => {
    setEditedContent(campaign.generated_content || "");
    setIsEditing(false);
  };

  const canEdit =
    editable && ["draft", "rejected"].includes(campaign.status);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              Campaign Content
              {campaign.generated_content && (
                <Badge variant="secondary" className="ml-2">
                  <Sparkles className="mr-1 h-3 w-3" />
                  AI Generated
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              {campaign.generated_content
                ? `${campaign.generated_content.length} characters`
                : "No content generated yet"}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {campaign.generated_content && !isEditing && (
              <Button variant="outline" size="sm" onClick={handleCopy}>
                {copied ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            )}
            {canEdit && !isEditing && campaign.generated_content && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsEditing(true)}
              >
                <Edit2 className="mr-2 h-4 w-4" />
                Edit
              </Button>
            )}
            {canEdit && (
              <AIGenerateButton
                campaign={campaign}
                onSuccess={onContentUpdate}
                variant="outline"
                size="sm"
                isRegenerate={!!campaign.generated_content}
              />
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isEditing ? (
          <div className="space-y-4">
            <Textarea
              value={editedContent}
              onChange={(e) => setEditedContent(e.target.value)}
              rows={10}
              className="font-mono text-sm"
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={handleCancel}>
                <X className="mr-2 h-4 w-4" />
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                disabled={updateCampaign.isPending}
              >
                <Save className="mr-2 h-4 w-4" />
                Save Changes
              </Button>
            </div>
          </div>
        ) : campaign.generated_content ? (
          <div className="prose prose-sm max-w-none dark:prose-invert">
            <pre className="whitespace-pre-wrap rounded-lg bg-muted p-4 text-sm font-normal">
              {campaign.generated_content}
            </pre>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Sparkles className="mb-4 h-12 w-12 text-muted-foreground/50" />
            <p className="mb-4 text-muted-foreground">
              No content has been generated for this campaign yet.
            </p>
            {canEdit && (
              <AIGenerateButton
                campaign={campaign}
                onSuccess={onContentUpdate}
              />
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
