"use client";

import Link from "next/link";
import { MapPin, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/shared/error-state";

export default function LocationsPage() {
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Locations</h1>
        <p className="text-muted-foreground">
          View and manage store locations across all your brands.
        </p>
      </div>

      {/* Content */}
      <Card>
        <CardHeader>
          <CardTitle>All Locations</CardTitle>
          <CardDescription>
            Locations are organized by brand. Select a brand to view its locations.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <EmptyState
            icon={MapPin}
            title="Select a brand to view locations"
            description="Locations are managed within each brand. Navigate to a brand to see its locations."
            action={
              <Button asChild>
                <Link href="/dashboard/brands">
                  <Building2 className="mr-2 h-4 w-4" />
                  View Brands
                </Link>
              </Button>
            }
            className="min-h-[300px]"
          />
        </CardContent>
      </Card>
    </div>
  );
}
