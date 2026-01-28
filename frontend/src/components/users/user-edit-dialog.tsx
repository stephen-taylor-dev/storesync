"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useUpdateUser, type AdminUser } from "@/hooks/use-users";
import { useBrands } from "@/hooks/use-brands";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { USER_ROLES } from "./role-badge";

const userSchema = z.object({
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  email: z.string().email("Invalid email address").optional().or(z.literal("")),
  role: z.enum(["admin", "brand_manager", "location_manager", "viewer"]),
  brands: z.array(z.string()),
  is_active: z.boolean(),
});

type UserFormData = z.infer<typeof userSchema>;

interface UserEditDialogProps {
  user: AdminUser | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function UserEditDialog({
  user,
  open,
  onOpenChange,
}: UserEditDialogProps) {
  const { toast } = useToast();
  const updateUser = useUpdateUser();
  const { data: brandsData } = useBrands({});
  const brands = brandsData?.results || [];

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<UserFormData>({
    resolver: zodResolver(userSchema),
    defaultValues: {
      first_name: "",
      last_name: "",
      email: "",
      role: "viewer",
      brands: [],
      is_active: true,
    },
  });

  const isActive = watch("is_active");
  const selectedRole = watch("role");
  const selectedBrands = watch("brands");

  // Reset form when dialog opens/closes or user changes
  useEffect(() => {
    if (open && user) {
      reset({
        first_name: user.first_name || "",
        last_name: user.last_name || "",
        email: user.email || "",
        role: user.role,
        brands: user.brands.map(b => typeof b === 'string' ? b : String(b)),
        is_active: user.is_active,
      });
    }
  }, [open, user, reset]);

  const onSubmit = async (data: UserFormData) => {
    if (!user) return;

    try {
      await updateUser.mutateAsync({
        id: user.id,
        data: {
          first_name: data.first_name,
          last_name: data.last_name,
          email: data.email || undefined,
          role: data.role,
          brands: data.brands,
          is_active: data.is_active,
        },
      });
      toast({
        title: "User updated",
        description: `${user.username}'s profile has been updated.`,
      });
      onOpenChange(false);
    } catch {
      toast({
        variant: "destructive",
        title: "Failed to update user",
        description: "There was an error saving the user.",
      });
    }
  };

  const toggleBrand = (brandId: string) => {
    const current = selectedBrands || [];
    if (current.includes(brandId)) {
      setValue("brands", current.filter(id => id !== brandId));
    } else {
      setValue("brands", [...current, brandId]);
    }
  };

  if (!user) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Edit User</DialogTitle>
          <DialogDescription>
            Update user details and permissions for {user.username}.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="first_name">First Name</Label>
              <Input
                id="first_name"
                placeholder="John"
                {...register("first_name")}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="last_name">Last Name</Label>
              <Input
                id="last_name"
                placeholder="Doe"
                {...register("last_name")}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="john@example.com"
              {...register("email")}
            />
            {errors.email && (
              <p className="text-sm text-destructive">{errors.email.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="role">Role</Label>
            <Select
              value={selectedRole}
              onValueChange={(value) => setValue("role", value as UserFormData["role"])}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a role" />
              </SelectTrigger>
              <SelectContent>
                {USER_ROLES.map((role) => (
                  <SelectItem key={role.value} value={role.value}>
                    {role.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {brands.length > 0 && (
            <div className="space-y-2">
              <Label>Assigned Brands</Label>
              <div className="max-h-[120px] space-y-2 overflow-y-auto rounded-md border p-3">
                {brands.map((brand) => (
                  <div key={brand.id} className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id={`brand-${brand.id}`}
                      checked={selectedBrands?.includes(brand.id) || false}
                      onChange={() => toggleBrand(brand.id)}
                      className="h-4 w-4 rounded border-gray-300"
                    />
                    <label
                      htmlFor={`brand-${brand.id}`}
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                      {brand.name}
                    </label>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                {selectedBrands?.length || 0} brand(s) selected
              </p>
            </div>
          )}

          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
              <Label htmlFor="is_active">Active Status</Label>
              <p className="text-sm text-muted-foreground">
                {isActive
                  ? "User can log in and access the system"
                  : "User is disabled and cannot log in"}
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
              {isSubmitting ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
