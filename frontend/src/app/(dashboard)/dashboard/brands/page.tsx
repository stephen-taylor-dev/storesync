"use client";

import { useState } from "react";
import Link from "next/link";
import { Building2, MapPin, Plus, Search } from "lucide-react";
import { useBrands } from "@/hooks/use-brands";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageLoader } from "@/components/shared/loading-spinner";
import { ErrorState, EmptyState } from "@/components/shared/error-state";
import type { Brand } from "@/types";

function BrandCard({ brand }: { brand: Brand }) {
  return (
    <Link href={`/dashboard/brands/${brand.id}`}>
      <Card className="h-full transition-all hover:shadow-md hover:border-primary/50">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              {brand.logo ? (
                <img
                  src={brand.logo}
                  alt={brand.name}
                  className="h-10 w-10 rounded-md object-cover"
                />
              ) : (
                <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10">
                  <Building2 className="h-5 w-5 text-primary" />
                </div>
              )}
              <div>
                <CardTitle className="text-lg">{brand.name}</CardTitle>
                <CardDescription className="text-xs">
                  {brand.slug}
                </CardDescription>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <MapPin className="h-4 w-4" />
              <span>
                {brand.location_count ?? 0}{" "}
                {brand.location_count === 1 ? "location" : "locations"}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

export default function BrandsPage() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const { data, isLoading, isError, refetch } = useBrands({
    page,
    search: search || undefined,
  });

  if (isLoading) {
    return <PageLoader message="Loading brands..." />;
  }

  if (isError) {
    return (
      <ErrorState
        title="Failed to load brands"
        message="There was an error loading your brands. Please try again."
        onRetry={() => refetch()}
      />
    );
  }

  const brands = data?.results || [];
  const totalPages = Math.ceil((data?.count || 0) / 10);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Brands</h1>
          <p className="text-muted-foreground">
            Manage your brand portfolio and their locations.
          </p>
        </div>
        <Button asChild>
          <Link href="/dashboard/brands/new">
            <Plus className="mr-2 h-4 w-4" />
            Add Brand
          </Link>
        </Button>
      </div>

      {/* Search */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search brands..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="pl-9"
          />
        </div>
        {data?.count !== undefined && (
          <Badge variant="secondary">{data.count} brands</Badge>
        )}
      </div>

      {/* Brand Grid */}
      {brands.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="No brands found"
          description={
            search
              ? "No brands match your search. Try a different query."
              : "Get started by creating your first brand."
          }
          action={
            !search && (
              <Button asChild>
                <Link href="/dashboard/brands/new">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Brand
                </Link>
              </Button>
            )
          }
        />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {brands.map((brand) => (
              <BrandCard key={brand.id} brand={brand} />
            ))}
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
    </div>
  );
}
