"use client";

import { useState, useMemo } from "react";
import {
  ArrowUpDown,
  ChevronDown,
  MoreHorizontal,
  Pencil,
  Trash2,
  Search,
  Filter,
} from "lucide-react";
import { useLocations, useDeleteLocation } from "@/hooks/use-brands";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { InlineLoader } from "@/components/shared/loading-spinner";
import { EmptyState } from "@/components/shared/error-state";
import { LocationFormDialog } from "./location-form-dialog";
import { useToast } from "@/hooks/use-toast";
import type { Location } from "@/types";
import type { SortConfig, SortDirection } from "@/types/brand";

interface LocationTableProps {
  brandId: string;
}

export function LocationTable({ brandId }: LocationTableProps) {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [activeFilter, setActiveFilter] = useState<boolean | undefined>(
    undefined
  );
  const [sortConfig, setSortConfig] = useState<SortConfig>({
    key: "name",
    direction: "asc",
  });
  const [editingLocation, setEditingLocation] = useState<Location | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const { data, isLoading, isError } = useLocations(brandId, {
    page,
    search: search || undefined,
    is_active: activeFilter,
  });

  const deleteLocation = useDeleteLocation();

  const locations = data?.results || [];
  const totalPages = Math.ceil((data?.count || 0) / 10);

  // Client-side sorting
  const sortedLocations = useMemo(() => {
    if (!locations.length) return locations;

    return [...locations].sort((a, b) => {
      let aValue: string | number | boolean = "";
      let bValue: string | number | boolean = "";

      switch (sortConfig.key) {
        case "name":
          aValue = a.name.toLowerCase();
          bValue = b.name.toLowerCase();
          break;
        case "store_number":
          aValue = a.store_number.toLowerCase();
          bValue = b.store_number.toLowerCase();
          break;
        case "city":
          aValue = (a.address?.city || "").toLowerCase();
          bValue = (b.address?.city || "").toLowerCase();
          break;
        case "is_active":
          aValue = a.is_active ? 1 : 0;
          bValue = b.is_active ? 1 : 0;
          break;
        default:
          return 0;
      }

      if (aValue < bValue) return sortConfig.direction === "asc" ? -1 : 1;
      if (aValue > bValue) return sortConfig.direction === "asc" ? 1 : -1;
      return 0;
    });
  }, [locations, sortConfig]);

  const handleSort = (key: string) => {
    setSortConfig((prev) => ({
      key,
      direction:
        prev.key === key && prev.direction === "asc" ? "desc" : "asc",
    }));
  };

  const handleDelete = async (location: Location) => {
    if (!confirm(`Are you sure you want to delete "${location.name}"?`)) {
      return;
    }

    try {
      await deleteLocation.mutateAsync({ brandId, id: location.id });
      toast({
        title: "Location deleted",
        description: `${location.name} has been deleted.`,
      });
    } catch {
      toast({
        variant: "destructive",
        title: "Failed to delete",
        description: "There was an error deleting the location.",
      });
    }
  };

  const handleEdit = (location: Location) => {
    setEditingLocation(location);
    setIsDialogOpen(true);
  };

  const handleDialogClose = () => {
    setIsDialogOpen(false);
    setEditingLocation(null);
  };

  const SortableHeader = ({
    column,
    children,
  }: {
    column: string;
    children: React.ReactNode;
  }) => (
    <Button
      variant="ghost"
      size="sm"
      className="-ml-3 h-8"
      onClick={() => handleSort(column)}
    >
      {children}
      <ArrowUpDown className="ml-2 h-4 w-4" />
    </Button>
  );

  if (isLoading) {
    return <InlineLoader />;
  }

  if (isError) {
    return (
      <p className="text-sm text-destructive">Failed to load locations.</p>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search locations..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="pl-9"
          />
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              <Filter className="mr-2 h-4 w-4" />
              {activeFilter === undefined
                ? "All"
                : activeFilter
                ? "Active"
                : "Inactive"}
              <ChevronDown className="ml-2 h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setActiveFilter(undefined)}>
              All Locations
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setActiveFilter(true)}>
              Active Only
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setActiveFilter(false)}>
              Inactive Only
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        {data?.count !== undefined && (
          <Badge variant="secondary" className="ml-auto">
            {data.count} locations
          </Badge>
        )}
      </div>

      {/* Table */}
      {sortedLocations.length === 0 ? (
        <EmptyState
          title="No locations found"
          description={
            search || activeFilter !== undefined
              ? "No locations match your filters. Try adjusting your search."
              : "Add your first location to get started."
          }
          className="min-h-[200px]"
        />
      ) : (
        <>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    <SortableHeader column="name">Name</SortableHeader>
                  </TableHead>
                  <TableHead>
                    <SortableHeader column="store_number">
                      Store #
                    </SortableHeader>
                  </TableHead>
                  <TableHead>
                    <SortableHeader column="city">City</SortableHeader>
                  </TableHead>
                  <TableHead>
                    <SortableHeader column="is_active">Status</SortableHeader>
                  </TableHead>
                  <TableHead className="w-[70px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedLocations.map((location) => (
                  <TableRow key={location.id}>
                    <TableCell className="font-medium">
                      {location.name}
                    </TableCell>
                    <TableCell>{location.store_number}</TableCell>
                    <TableCell>
                      {location.address?.city && location.address?.state
                        ? `${location.address.city}, ${location.address.state}`
                        : location.address?.city ||
                          location.address?.state ||
                          "-"}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={location.is_active ? "success" : "secondary"}
                      >
                        {location.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                            <span className="sr-only">Actions</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => handleEdit(location)}
                          >
                            <Pencil className="mr-2 h-4 w-4" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => handleDelete(location)}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                Previous
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {page} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
              >
                Next
              </Button>
            </div>
          )}
        </>
      )}

      {/* Edit Dialog */}
      <LocationFormDialog
        brandId={brandId}
        location={editingLocation}
        open={isDialogOpen}
        onOpenChange={handleDialogClose}
      />
    </div>
  );
}
