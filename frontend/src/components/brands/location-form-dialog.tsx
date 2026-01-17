"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useCreateLocation, useUpdateLocation } from "@/hooks/use-brands";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import type { Location } from "@/types";

const locationSchema = z.object({
  name: z.string().min(1, "Name is required"),
  store_number: z.string().min(1, "Store number is required"),
  street: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zip: z.string().optional(),
  is_active: z.boolean(),
});

type LocationFormData = z.infer<typeof locationSchema>;

interface LocationFormDialogProps {
  brandId: string;
  location?: Location | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function LocationFormDialog({
  brandId,
  location,
  open,
  onOpenChange,
}: LocationFormDialogProps) {
  const { toast } = useToast();
  const isEditing = !!location;

  const createLocation = useCreateLocation();
  const updateLocation = useUpdateLocation();

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<LocationFormData>({
    resolver: zodResolver(locationSchema),
    defaultValues: {
      name: "",
      store_number: "",
      street: "",
      city: "",
      state: "",
      zip: "",
      is_active: true,
    },
  });

  const isActive = watch("is_active");

  // Reset form when dialog opens/closes or location changes
  useEffect(() => {
    if (open) {
      if (location) {
        reset({
          name: location.name,
          store_number: location.store_number,
          street: location.address?.street || "",
          city: location.address?.city || "",
          state: location.address?.state || "",
          zip: location.address?.zip || "",
          is_active: location.is_active,
        });
      } else {
        reset({
          name: "",
          store_number: "",
          street: "",
          city: "",
          state: "",
          zip: "",
          is_active: true,
        });
      }
    }
  }, [open, location, reset]);

  const onSubmit = async (data: LocationFormData) => {
    const payload = {
      name: data.name,
      store_number: data.store_number,
      address: {
        street: data.street || undefined,
        city: data.city || undefined,
        state: data.state || undefined,
        zip: data.zip || undefined,
      },
      is_active: data.is_active,
    };

    try {
      if (isEditing && location) {
        await updateLocation.mutateAsync({
          brandId,
          id: location.id,
          data: payload,
        });
        toast({
          title: "Location updated",
          description: `${data.name} has been updated.`,
        });
      } else {
        await createLocation.mutateAsync({
          brandId,
          data: payload,
        });
        toast({
          title: "Location created",
          description: `${data.name} has been added.`,
        });
      }
      onOpenChange(false);
    } catch {
      toast({
        variant: "destructive",
        title: isEditing ? "Failed to update" : "Failed to create",
        description: "There was an error saving the location.",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Edit Location" : "Add Location"}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Update the location details below."
              : "Fill in the details to add a new location."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">Location Name *</Label>
              <Input
                id="name"
                placeholder="e.g., Downtown Store"
                {...register("name")}
              />
              {errors.name && (
                <p className="text-sm text-destructive">{errors.name.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="store_number">Store Number *</Label>
              <Input
                id="store_number"
                placeholder="e.g., STR-001"
                {...register("store_number")}
              />
              {errors.store_number && (
                <p className="text-sm text-destructive">
                  {errors.store_number.message}
                </p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="street">Street Address</Label>
            <Input
              id="street"
              placeholder="e.g., 123 Main St"
              {...register("street")}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="city">City</Label>
              <Input
                id="city"
                placeholder="e.g., New York"
                {...register("city")}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="state">State</Label>
              <Input
                id="state"
                placeholder="e.g., NY"
                {...register("state")}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="zip">ZIP Code</Label>
              <Input
                id="zip"
                placeholder="e.g., 10001"
                {...register("zip")}
              />
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
              <Label htmlFor="is_active">Active Status</Label>
              <p className="text-sm text-muted-foreground">
                {isActive
                  ? "Location is active and visible"
                  : "Location is inactive and hidden"}
              </p>
            </div>
            <Switch
              id="is_active"
              checked={isActive}
              onCheckedChange={(checked) => setValue("is_active", checked)}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting
                ? "Saving..."
                : isEditing
                ? "Save Changes"
                : "Add Location"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
