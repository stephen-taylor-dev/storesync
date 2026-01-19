"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { X } from "lucide-react";
import { useBrands } from "@/hooks/use-brands";
import {
  useCreateTemplate,
  useUpdateTemplate,
} from "@/hooks/use-templates";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
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
import { CAMPAIGN_TYPES } from "@/types/campaign";
import type { CampaignTemplate } from "@/types";

const templateSchema = z.object({
  brand: z.string().min(1, "Brand is required"),
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  content_template: z.string().min(1, "Content template is required"),
  campaign_type: z.string().min(1, "Campaign type is required"),
  is_active: z.boolean(),
});

type TemplateFormData = z.infer<typeof templateSchema>;

interface TemplateFormProps {
  template?: CampaignTemplate;
}

export function TemplateForm({ template }: TemplateFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const isEditing = !!template;

  const [requiredVariables, setRequiredVariables] = useState<string[]>(
    template?.required_variables || []
  );
  const [newVariable, setNewVariable] = useState("");

  const { data: brandsData, isLoading: brandsLoading } = useBrands({});
  const createTemplate = useCreateTemplate();
  const updateTemplate = useUpdateTemplate();

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<TemplateFormData>({
    resolver: zodResolver(templateSchema),
    defaultValues: {
      brand: template?.brand || "",
      name: template?.name || "",
      description: template?.description || "",
      content_template: template?.content_template || "",
      campaign_type: template?.campaign_type || "",
      is_active: template?.is_active ?? true,
    },
  });

  const brands = brandsData?.results || [];
  const watchIsActive = watch("is_active");

  const addVariable = () => {
    const trimmed = newVariable.trim().toLowerCase().replace(/\s+/g, "_");
    if (trimmed && !requiredVariables.includes(trimmed)) {
      setRequiredVariables([...requiredVariables, trimmed]);
      setNewVariable("");
    }
  };

  const removeVariable = (variable: string) => {
    setRequiredVariables(requiredVariables.filter((v) => v !== variable));
  };

  const onSubmit = async (data: TemplateFormData) => {
    try {
      const payload = {
        ...data,
        required_variables: requiredVariables,
      };

      if (isEditing && template) {
        await updateTemplate.mutateAsync({
          id: template.id,
          data: payload,
        });
        toast({
          title: "Template updated",
          description: "Your changes have been saved.",
        });
      } else {
        await createTemplate.mutateAsync(payload);
        toast({
          title: "Template created",
          description: "Your template has been created.",
        });
      }
      router.push("/dashboard/templates");
    } catch {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to save template. Please try again.",
      });
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Basic Info */}
      <Card>
        <CardHeader>
          <CardTitle>Basic Information</CardTitle>
          <CardDescription>
            Set the name, brand, and type for this template
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                placeholder="e.g., Summer Sale Template"
                {...register("name")}
              />
              {errors.name && (
                <p className="text-sm text-destructive">{errors.name.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="brand">Brand *</Label>
              {brandsLoading ? (
                <InlineLoader />
              ) : (
                <Select
                  value={watch("brand")}
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
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="campaign_type">Campaign Type *</Label>
              <Select
                value={watch("campaign_type")}
                onValueChange={(value) => setValue("campaign_type", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a type" />
                </SelectTrigger>
                <SelectContent>
                  {CAMPAIGN_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.campaign_type && (
                <p className="text-sm text-destructive">
                  {errors.campaign_type.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="is_active">Status</Label>
              <div className="flex items-center gap-2 pt-2">
                <Switch
                  id="is_active"
                  checked={watchIsActive}
                  onCheckedChange={(checked) => setValue("is_active", checked)}
                />
                <span className="text-sm">
                  {watchIsActive ? "Active" : "Inactive"}
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="Describe what this template is for..."
              {...register("description")}
            />
          </div>
        </CardContent>
      </Card>

      {/* Content Template */}
      <Card>
        <CardHeader>
          <CardTitle>Content Template</CardTitle>
          <CardDescription>
            Write your template using Jinja2 syntax. Use {"{{variable_name}}"} for
            dynamic content.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="content_template">Template Content *</Label>
            <Textarea
              id="content_template"
              placeholder={`Example:\n🎉 Big Sale at {{location_name}}!\n\nGet {{discount_percentage}}% off all items!\nVisit us at {{full_address}}`}
              className="min-h-[200px] font-mono text-sm"
              {...register("content_template")}
            />
            {errors.content_template && (
              <p className="text-sm text-destructive">
                {errors.content_template.message}
              </p>
            )}
          </div>

          <div className="rounded-lg bg-muted p-4">
            <h4 className="text-sm font-medium mb-2">Available Variables</h4>
            <p className="text-xs text-muted-foreground mb-2">
              These are automatically available for all templates:
            </p>
            <div className="flex flex-wrap gap-1">
              {[
                "brand_name",
                "location_name",
                "store_number",
                "city",
                "state",
                "full_address",
              ].map((v) => (
                <Badge key={v} variant="secondary" className="font-mono text-xs">
                  {`{{${v}}}`}
                </Badge>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Required Variables */}
      <Card>
        <CardHeader>
          <CardTitle>Required Variables</CardTitle>
          <CardDescription>
            Define custom variables that must be provided when creating campaigns
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="e.g., discount_percentage"
              value={newVariable}
              onChange={(e) => setNewVariable(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addVariable();
                }
              }}
            />
            <Button type="button" variant="outline" onClick={addVariable}>
              Add
            </Button>
          </div>

          {requiredVariables.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {requiredVariables.map((variable) => (
                <Badge
                  key={variable}
                  variant="secondary"
                  className="font-mono text-xs py-1 px-2"
                >
                  {`{{${variable}}}`}
                  <button
                    type="button"
                    onClick={() => removeVariable(variable)}
                    className="ml-2 hover:text-destructive"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No custom variables defined. Add variables that campaign creators
              will need to fill in.
            </p>
          )}
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
            : "Create Template"}
        </Button>
      </div>
    </form>
  );
}
