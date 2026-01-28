import { Badge } from "@/components/ui/badge";
import type { User } from "@/types";

type UserRole = User["role"];

const ROLE_CONFIG: Record<UserRole, { label: string; variant: "default" | "secondary" | "destructive" | "outline" | "success" | "warning" }> = {
  admin: {
    label: "Administrator",
    variant: "destructive",
  },
  brand_manager: {
    label: "Brand Manager",
    variant: "default",
  },
  location_manager: {
    label: "Location Manager",
    variant: "warning",
  },
  viewer: {
    label: "Viewer",
    variant: "secondary",
  },
};

interface RoleBadgeProps {
  role: UserRole;
}

export function RoleBadge({ role }: RoleBadgeProps) {
  const config = ROLE_CONFIG[role] || {
    label: role,
    variant: "secondary" as const,
  };

  return <Badge variant={config.variant}>{config.label}</Badge>;
}

export function getRoleLabel(role: UserRole): string {
  return ROLE_CONFIG[role]?.label || role;
}

export const USER_ROLES: { value: UserRole; label: string }[] = [
  { value: "admin", label: "Administrator" },
  { value: "brand_manager", label: "Brand Manager" },
  { value: "location_manager", label: "Location Manager" },
  { value: "viewer", label: "Viewer" },
];
