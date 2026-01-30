"use client";

import { useState } from "react";
import { Sparkles, Loader2, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useGenerateContent, useRegenerateContent } from "@/hooks/use-campaigns";
import { useToast } from "@/hooks/use-toast";
import type { LocationCampaign } from "@/types";

interface AIGenerateButtonProps {
  campaign: LocationCampaign;
  onSuccess?: () => void;
  variant?: "default" | "outline" | "secondary";
  size?: "default" | "sm" | "lg";
  isRegenerate?: boolean;
}

export function AIGenerateButton({
  campaign,
  onSuccess,
  variant = "default",
  size = "default",
  isRegenerate = false,
}: AIGenerateButtonProps) {
  const [open, setOpen] = useState(false);
  const [useAI, setUseAI] = useState(true);
  const [asyncGeneration, setAsyncGeneration] = useState(false);
  const [additionalInstructions, setAdditionalInstructions] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);

  const { toast } = useToast();
  const generateContent = useGenerateContent();
  const regenerateContent = useRegenerateContent();

  const isLoading = generateContent.isPending || regenerateContent.isPending;
  const hasContent = !!campaign.generated_content;

  const handleGenerate = async () => {
    try {
      const options = {
        use_ai: useAI,
        additional_instructions: additionalInstructions || undefined,
        async_generation: asyncGeneration,
      };

      let result;
      if (isRegenerate || hasContent) {
        result = await regenerateContent.mutateAsync({
          id: campaign.id,
          options,
        });
      } else {
        result = await generateContent.mutateAsync({
          id: campaign.id,
          options,
        });
      }

      if (result.status === "queued") {
        toast({
          title: "Content generation started",
          description: "The content is being generated. Refresh to see updates.",
        });
      } else if (result.status === "success") {
        let description: string;
        if (result.used_ai) {
          description = `Generated ${result.content_length} characters using AI.`;
        } else if (result.fallback_reason) {
          description = `Generated ${result.content_length} characters using template (AI unavailable).`;
        } else {
          description = `Generated ${result.content_length} characters from template.`;
        }
        toast({
          title: "Content generated",
          description,
        });
      }

      setOpen(false);
      setAdditionalInstructions("");
      onSuccess?.();
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Generation failed",
        description: "Failed to generate content. Please try again.",
      });
    }
  };

  const buttonLabel = isRegenerate
    ? "Regenerate"
    : hasContent
    ? "Regenerate Content"
    : "Generate Content";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={variant} size={size}>
          <Sparkles className="mr-2 h-4 w-4" />
          {buttonLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            {hasContent ? "Regenerate Campaign Content" : "Generate Campaign Content"}
          </DialogTitle>
          <DialogDescription>
            {hasContent
              ? "Generate new content for this campaign. The existing content will be replaced."
              : "Use AI to generate personalized marketing content based on the template and location data."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* AI Toggle */}
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
              <Label htmlFor="use-ai" className="text-base">
                Use AI Generation
              </Label>
              <p className="text-sm text-muted-foreground">
                Generate creative content using AI. If disabled, uses template
                substitution only.
              </p>
            </div>
            <Switch
              id="use-ai"
              checked={useAI}
              onCheckedChange={setUseAI}
            />
          </div>

          {/* Additional Instructions */}
          {useAI && (
            <div className="space-y-2">
              <Label htmlFor="instructions">
                Additional Instructions (Optional)
              </Label>
              <Textarea
                id="instructions"
                placeholder="E.g., Make it more festive, include a call to action, emphasize the discount..."
                value={additionalInstructions}
                onChange={(e) => setAdditionalInstructions(e.target.value)}
                rows={3}
              />
              <p className="text-xs text-muted-foreground">
                Provide extra guidance for the AI to customize the generated content.
              </p>
            </div>
          )}

          {/* Advanced Options */}
          <Collapsible open={showAdvanced} onOpenChange={setShowAdvanced}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="w-full justify-start">
                <Settings2 className="mr-2 h-4 w-4" />
                Advanced Options
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-4 pt-4">
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <Label htmlFor="async" className="text-base">
                    Async Generation
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Process in background. Faster response but requires polling
                    for results.
                  </p>
                </div>
                <Switch
                  id="async"
                  checked={asyncGeneration}
                  onCheckedChange={setAsyncGeneration}
                />
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* Context Info */}
          <div className="rounded-lg bg-muted p-4 text-sm">
            <p className="font-medium">Generation Context:</p>
            <ul className="mt-2 space-y-1 text-muted-foreground">
              <li>Template: {campaign.template_name}</li>
              <li>Location: {campaign.location_name}</li>
              <li>Brand: {campaign.brand_name}</li>
              {campaign.customizations &&
                Object.keys(campaign.customizations).length > 0 && (
                  <li>
                    Customizations: {Object.keys(campaign.customizations).join(", ")}
                  </li>
                )}
            </ul>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleGenerate} disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                {hasContent ? "Regenerate" : "Generate"}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
