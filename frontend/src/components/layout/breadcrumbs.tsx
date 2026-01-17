"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, Home } from "lucide-react";
import { cn } from "@/lib/utils";

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbsProps {
  items?: BreadcrumbItem[];
  className?: string;
}

const pathLabels: Record<string, string> = {
  dashboard: "Dashboard",
  brands: "Brands",
  locations: "Locations",
  templates: "Templates",
  campaigns: "Campaigns",
  users: "Users",
  settings: "Settings",
  profile: "Profile",
  new: "New",
  edit: "Edit",
};

export function Breadcrumbs({ items, className }: BreadcrumbsProps) {
  const pathname = usePathname();

  // Auto-generate breadcrumbs from pathname if items not provided
  const breadcrumbs: BreadcrumbItem[] = items || generateBreadcrumbs(pathname);

  if (breadcrumbs.length === 0) {
    return null;
  }

  return (
    <nav className={cn("flex items-center text-sm", className)}>
      <ol className="flex items-center gap-1">
        <li>
          <Link
            href="/dashboard"
            className="flex items-center text-muted-foreground hover:text-foreground transition-colors"
          >
            <Home className="h-4 w-4" />
            <span className="sr-only">Dashboard</span>
          </Link>
        </li>
        {breadcrumbs.map((item, index) => (
          <li key={index} className="flex items-center gap-1">
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
            {item.href && index < breadcrumbs.length - 1 ? (
              <Link
                href={item.href}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                {item.label}
              </Link>
            ) : (
              <span className="font-medium text-foreground">{item.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

function generateBreadcrumbs(pathname: string): BreadcrumbItem[] {
  const segments = pathname.split("/").filter(Boolean);

  // Remove 'dashboard' from the beginning for breadcrumb display
  if (segments[0] === "dashboard") {
    segments.shift();
  }

  if (segments.length === 0) {
    return [];
  }

  const breadcrumbs: BreadcrumbItem[] = [];
  let currentPath = "/dashboard";

  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    currentPath += `/${segment}`;

    // Check if this is a UUID or ID (skip adding label)
    const isId = /^[0-9a-f-]{36}$/.test(segment) || /^\d+$/.test(segment);

    if (isId) {
      // For IDs, we might want to show a generic label or skip
      breadcrumbs.push({
        label: "Details",
        href: i < segments.length - 1 ? currentPath : undefined,
      });
    } else {
      const label = pathLabels[segment] || capitalize(segment);
      breadcrumbs.push({
        label,
        href: i < segments.length - 1 ? currentPath : undefined,
      });
    }
  }

  return breadcrumbs;
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1).replace(/-/g, " ");
}
