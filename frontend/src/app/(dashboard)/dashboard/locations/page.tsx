"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { MapPin, Plus, Search, Building2, ChevronLeft, ChevronRight, List, Map } from "lucide-react";
import { useDebounce } from "@/hooks/use-debounce";
import { useAllLocations, useMapLocations } from "@/hooks/use-brands";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageLoader } from "@/components/shared/loading-spinner";
import { ErrorState, EmptyState } from "@/components/shared/error-state";
import type { Location } from "@/types";

// Dynamic import — Leaflet requires `window`
const LocationMap = dynamic(
  () => import("@/components/locations/location-map"),
  { ssr: false }
);

interface LocationWithBrand extends Location {
  brand_name: string;
  campaign_count: number;
}

function Pagination({
  currentPage,
  totalPages,
  totalCount,
  pageSize,
  onPageChange,
}: {
  currentPage: number;
  totalPages: number;
  totalCount: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}) {
  const startItem = (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalCount);

  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    const maxVisible = 5;

    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      if (currentPage <= 3) {
        for (let i = 1; i <= 4; i++) pages.push(i);
        pages.push("...");
        pages.push(totalPages);
      } else if (currentPage >= totalPages - 2) {
        pages.push(1);
        pages.push("...");
        for (let i = totalPages - 3; i <= totalPages; i++) pages.push(i);
      } else {
        pages.push(1);
        pages.push("...");
        pages.push(currentPage - 1);
        pages.push(currentPage);
        pages.push(currentPage + 1);
        pages.push("...");
        pages.push(totalPages);
      }
    }
    return pages;
  };

  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-between border-t pt-4">
      <p className="text-sm text-muted-foreground">
        Showing {startItem} to {endItem} of {totalCount} locations
      </p>
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
        >
          <ChevronLeft className="h-4 w-4" />
          Previous
        </Button>

        {getPageNumbers().map((page, idx) =>
          typeof page === "number" ? (
            <Button
              key={idx}
              variant={page === currentPage ? "default" : "outline"}
              size="sm"
              className="w-9"
              onClick={() => onPageChange(page)}
            >
              {page}
            </Button>
          ) : (
            <span key={idx} className="px-2 text-muted-foreground">
              {page}
            </span>
          )
        )}

        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
        >
          Next
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

export default function LocationsPage() {
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [brandFilter, setBrandFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"list" | "map">("list");

  // Debounce search query to avoid excessive API calls
  const debouncedSearch = useDebounce(searchQuery, 300);

  // Reset to page 1 when filters change
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, brandFilter, statusFilter]);

  const filterParams = {
    brand: brandFilter !== "all" ? brandFilter : undefined,
    search: debouncedSearch || undefined,
    is_active: statusFilter !== "all" ? statusFilter === "active" : undefined,
  };

  const {
    data: locations,
    brands,
    isLoading,
    isError,
    refetch,
    totalCount,
    totalPages,
    currentPage,
    pageSize,
  } = useAllLocations({
    page,
    pageSize: 20,
    ...filterParams,
  });

  const {
    data: mapPoints,
    isLoading: mapLoading,
  } = useMapLocations(filterParams);

  if (isLoading && page === 1 && viewMode === "list") {
    return <PageLoader message="Loading locations..." />;
  }

  if (isError) {
    return (
      <ErrorState
        title="Failed to load locations"
        message="There was an error loading locations. Please try again."
        onRetry={() => refetch()}
      />
    );
  }

  // Get current brand name for filtered view
  const currentBrandName = brandFilter !== "all"
    ? brands.find(b => b.id === brandFilter)?.name
    : null;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Locations</h1>
          <p className="text-muted-foreground">
            {currentBrandName
              ? `Viewing locations for ${currentBrandName}`
              : "View and manage store locations across all your brands."
            }
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href="/dashboard/brands">
              <Building2 className="mr-2 h-4 w-4" />
              Manage Brands
            </Link>
          </Button>
        </div>
      </div>

      {/* Filters & Table */}
      <Card>
        <CardHeader>
          <CardTitle>
            {currentBrandName ? `${currentBrandName} Locations` : "All Locations"}
          </CardTitle>
          <CardDescription>
            {viewMode === "map"
              ? `${mapPoints?.length ?? 0} locations with coordinates`
              : (
                <>
                  {totalCount} {currentBrandName ? "" : "total "}locations
                  {!currentBrandName && ` across ${brands.length} brands`}
                </>
              )
            }
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search locations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            <Select value={brandFilter} onValueChange={setBrandFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All Brands" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Brands</SelectItem>
                {brands.map((brand) => (
                  <SelectItem key={brand.id} value={brand.id}>
                    {brand.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>

            {/* View mode toggle */}
            <div className="flex rounded-md border">
              <Button
                variant={viewMode === "list" ? "default" : "ghost"}
                size="sm"
                className="rounded-r-none"
                onClick={() => setViewMode("list")}
              >
                <List className="mr-1 h-4 w-4" />
                List
              </Button>
              <Button
                variant={viewMode === "map" ? "default" : "ghost"}
                size="sm"
                className="rounded-l-none"
                onClick={() => setViewMode("map")}
              >
                <Map className="mr-1 h-4 w-4" />
                Map
              </Button>
            </div>
          </div>

          {/* Loading indicator for page changes */}
          {isLoading && page > 1 && viewMode === "list" && (
            <div className="flex justify-center py-4">
              <div className="text-sm text-muted-foreground">Loading...</div>
            </div>
          )}

          {/* Map View */}
          {viewMode === "map" && (
            mapLoading ? (
              <div className="flex justify-center py-12">
                <div className="text-sm text-muted-foreground">Loading map...</div>
              </div>
            ) : (
              <LocationMap points={mapPoints ?? []} />
            )
          )}

          {/* List View */}
          {viewMode === "list" && (
            <>
              {!isLoading && locations.length === 0 ? (
                <EmptyState
                  icon={MapPin}
                  title="No locations found"
                  description={
                    searchQuery || brandFilter !== "all" || statusFilter !== "all"
                      ? "No locations match your filters. Try adjusting your search criteria."
                      : "No locations have been created yet. Add locations to your brands to get started."
                  }
                  action={
                    !searchQuery && brandFilter === "all" && statusFilter === "all" && brands.length > 0 && (
                      <Button asChild>
                        <Link href={`/dashboard/brands/${brands[0].id}`}>
                          <Plus className="mr-2 h-4 w-4" />
                          Add First Location
                        </Link>
                      </Button>
                    )
                  }
                  className="min-h-[300px]"
                />
              ) : !isLoading && (
                <>
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Brand</TableHead>
                          <TableHead>Store #</TableHead>
                          <TableHead>City, State</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Campaigns</TableHead>
                          <TableHead className="w-[80px]"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(locations as LocationWithBrand[]).map((location) => (
                          <TableRow key={location.id} className="hover:bg-muted/50">
                            <TableCell className="font-medium">
                              <Link
                                href={`/dashboard/brands/${location.brand}`}
                                className="hover:underline"
                              >
                                {location.name}
                              </Link>
                            </TableCell>
                            <TableCell>
                              <Link
                                href={`/dashboard/brands/${location.brand}`}
                                className="hover:underline text-muted-foreground"
                              >
                                {location.brand_name}
                              </Link>
                            </TableCell>
                            <TableCell>{location.store_number}</TableCell>
                            <TableCell>
                              {location.address?.city && location.address?.state
                                ? `${location.address.city}, ${location.address.state}`
                                : location.full_address || "-"}
                            </TableCell>
                            <TableCell>
                              <Badge variant={location.is_active ? "success" : "secondary"}>
                                {location.is_active ? "Active" : "Inactive"}
                              </Badge>
                            </TableCell>
                            <TableCell>{location.campaign_count ?? 0}</TableCell>
                            <TableCell>
                              <Button variant="ghost" size="sm" asChild>
                                <Link href={`/dashboard/brands/${location.brand}`}>
                                  View
                                </Link>
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Pagination */}
                  <Pagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    totalCount={totalCount}
                    pageSize={pageSize}
                    onPageChange={setPage}
                  />
                </>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
