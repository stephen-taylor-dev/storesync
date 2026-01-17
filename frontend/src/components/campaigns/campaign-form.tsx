"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useBrands, useLocations } from "@/hooks/use-brands";
import { useTemplates } from "@/hooks/use-templates";
import { useCreateCampaign, useUpdateCampaign } from "@/hooks/use-campaigns";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { InlineLoader } from "@/components/shared/loading-spinner";
import type { LocationCampaign, CampaignTemplate } from "@/types";

const campaignSchema = z.object({
  brand: z.string().min(1, "Brand is required"),
  location: z.string().min(1, "Location is required"),
  template: z.string().min(1, "Template is required"),
  scheduled_start: z.string().optional(),
  scheduled_end: z.string().optional(),
});

type CampaignFormData = z.infer<typeof campaignSchema>;

interface CampaignFormProps {
  campaign?: LocationCampaign;
}

export function CampaignForm({ campaign }: CampaignFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const isEditing = !!campaign;

  const [selectedBrand, setSelectedBrand] = useState<string>(
    campaign?.location ? "" : ""
  );
  const [selectedTemplate, setSelectedTemplate] = useState<CampaignTemplate | null>(
    null
  );
  const [customizations, setCustomizations] = useState<Record<string, string>>({});

  const { data: brandsData, isLoading: brandsLoading } = useBrands({});
  const { data: locationsData, isLoading: locationsLoading } = useLocations(
    selectedBrand,
    { is_active: true }
  );
  const { data: templatesData, isLoading: templatesLoading } = useTemplates({
    brand: selectedBrand || undefined,
    is_active: true,
  });

  const createCampaign = useCreateCampaign();
  const updateCampaign = useUpdateCampaign();

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<CampaignFormData>({
    resolver: zodResolver(campaignSchema),
    defaultValues: {
      brand: "",
      location: campaign?.location || "",
      template: campaign?.template || "",
      scheduled_start: campaign?.scheduled_start?.slice(0, 16) || "",
      scheduled_end: campaign?.scheduled_end?.slice(0, 16) || "",
    },
  });

  const watchBrand = watch("brand");
  const watchTemplate = watch("template");

  // Update selected brand when it changes
  useEffect(() => {
    if (watchBrand && watchBrand !== selectedBrand) {
      setSelectedBrand(watchBrand);
      setValue("location", "");
      setValue("template", "");
      setSelectedTemplate(null);
      setCustomizations({});
    }
  }, [watchBrand, selectedBrand, setValue]);

  // Update selected template and initialize customizations
  useEffect(() => {
    if (watchTemplate && templatesData?.results) {
      const template = templatesData.results.find((t) => t.id === watchTemplate);
      if (template) {
        setSelectedTemplate(template);
        // Initialize customizations with empty values for required variables
        const initial: Record<string, string> = {};
        template.required_variables.forEach((v) => {
          initial[v] = customizations[v] || "";
        });
        setCustomizations(initial);
      }
    }
  }, [watchTemplate, templatesData?.results]);

  const brands = brandsData?.results || [];
  const locations = locationsData?.results || [];
  const templates = templatesData?.results || [];

  const onSubmit = async (data: CampaignFormData) => {
    try {
      const payload = {
        location: data.location,
        template: data.template,
        customizations,
        scheduled_start: data.scheduled_start || null,
        scheduled_end: data.scheduled_end || null,
      };

      if (isEditing && campaign) {
        await updateCampaign.mutateAsync({
          id: campaign.id,
          data: payload,
        });
        toast({
          title: "Campaign updated",
          description: "Your changes have been saved.",
        });
        router.push(`/dashboard/campaigns/${campaign.id}`);
      } else {
        const result = await createCampaign.mutateAsync(payload);
        toast({
          title: "Campaign created",
          description: "Your campaign has been created as a draft.",
        });
        router.push(`/dashboard/campaigns/${result.id}`);
      }
    } catch {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to save campaign. Please try again.",
      });
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Brand & Location Selection */}
      <Card>
        <CardHeader>
          <CardTitle>Location</CardTitle>
          <CardDescription>
            Select the brand and location for this campaign
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="brand">Brand *</Label>
              {brandsLoading ? (
                <InlineLoader />
              ) : (
                <Select
                  value={watchBrand}
                  onValueChange={(value) => setValue("brand", value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a brand" />
                  </SelectTrigger>
                  <SelectContent>
                    {brands.map((brand) => (
                      <SelectItem key={brand.id} value={brand.id}>
                        {brand.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {errors.brand && (
                <p className="text-sm text-destructive">{errors.brand.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="location">Location *</Label>
              {locationsLoading && selectedBrand ? (
                <InlineLoader />
              ) : (
                <Select
                  value={watch("location")}
                  onValueChange={(value) => setValue("location", value)}
                  disabled={!selectedBrand}
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={
                        selectedBrand ? "Select a location" : "Select brand first"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {locations.map((location) => (
                      <SelectItem key={location.id} value={location.id}>
                        {location.name} ({location.store_number})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {errors.location && (
                <p className="text-sm text-destructive">
                  {errors.location.message}
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Template Selection */}
      <Card>
        <CardHeader>
          <CardTitle>Template</CardTitle>
          <CardDescription>
            Choose a template to generate campaign content
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="template">Campaign Template *</Label>
            {templatesLoading && selectedBrand ? (
              <InlineLoader />
            ) : (
              <Select
                value={watchTemplate}
                onValueChange={(value) => setValue("template", value)}
                disabled={!selectedBrand}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      selectedBrand ? "Select a template" : "Select brand first"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((template) => (
                    <SelectItem key={template.id} value={template.id}>
                      {template.name} - {template.campaign_type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {errors.template && (
              <p className="text-sm text-destructive">{errors.template.message}</p>
            )}
          </div>

          {selectedTemplate && (
            <div className="rounded-lg border bg-muted/50 p-4">
              <h4 className="font-medium">{selectedTemplate.name}</h4>
              {selectedTemplate.description && (
                <p className="mt-1 text-sm text-muted-foreground">
                  {selectedTemplate.description}
                </p>
              )}
              <div className="mt-2">
                <span className="text-xs font-medium text-muted-foreground">
                  Type: {selectedTemplate.campaign_type}
                </span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Customizations */}
      {selectedTemplate &&
        selectedTemplate.required_variables.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Customizations</CardTitle>
              <CardDescription>
                Fill in the required variables for this template
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {selectedTemplate.required_variables.map((variable) => (
                <div key={variable} className="space-y-2">
                  <Label htmlFor={variable}>
                    {variable.replace(/_/g, " ").replace(/\b\w/g, (l) =>
                      l.toUpperCase()
                    )}
                  </Label>
                  <Input
                    id={variable}
                    value={customizations[variable] || ""}
                    onChange={(e) =>
                      setCustomizations((prev) => ({
                        ...prev,
                        [variable]: e.target.value,
                      }))
                    }
                    placeholder={`Enter ${variable.replace(/_/g, " ")}`}
                  />
                </div>
              ))}
            </CardContent>
          </Card>
        )}

      {/* Schedule */}
      <Card>
        <CardHeader>
          <CardTitle>Schedule (Optional)</CardTitle>
          <CardDescription>
            Set when this campaign should run
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="scheduled_start">Start Date</Label>
              <Input
                id="scheduled_start"
                type="datetime-local"
                {...register("scheduled_start")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="scheduled_end">End Date</Label>
              <Input
                id="scheduled_end"
                type="datetime-local"
                {...register("scheduled_end")}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex justify-end gap-4">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting
            ? "Saving..."
            : isEditing
            ? "Save Changes"
            : "Create Campaign"}
        </Button>
      </div>
    </form>
  );
}
