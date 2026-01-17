"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, Search, FileText } from "lucide-react";
import { useTemplates } from "@/hooks/use-templates";
import { useBrands } from "@/hooks/use-brands";
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
import { CAMPAIGN_TYPES } from "@/types/campaign";
import type { CampaignTemplate } from "@/types";

function TemplateRow({ template }: { template: CampaignTemplate }) {
  return (
    <TableRow>
      <TableCell className="font-medium">{template.name}</TableCell>
      <TableCell>{template.brand_name || "-"}</TableCell>
      <TableCell>
        <Badge variant="outline">{template.campaign_type}</Badge>
      </TableCell>
      <TableCell>
        <Badge variant={template.is_active ? "success" : "secondary"}>
          {template.is_active ? "Active" : "Inactive"}
        </Badge>
      </TableCell>
      <TableCell>{template.campaign_count ?? 0}</TableCell>
      <TableCell>
        <Button variant="ghost" size="sm">
          Edit
        </Button>
      </TableCell>
    </TableRow>
  );
}

export default function TemplatesPage() {
  const [page, setPage] = useState(1);
  const [brandFilter, setBrandFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  const { data: brandsData } = useBrands({});
  const { data, isLoading, isError, refetch } = useTemplates({
    page,
    brand: brandFilter !== "all" ? brandFilter : undefined,
    campaign_type: typeFilter !== "all" ? typeFilter : undefined,
  });

  if (isLoading) {
    return <PageLoader message="Loading templates..." />;
  }

  if (isError) {
    return (
      <ErrorState
        title="Failed to load templates"
        message="There was an error loading templates. Please try again."
        onRetry={() => refetch()}
      />
    );
  }

  const templates = data?.results || [];
  const totalPages = Math.ceil((data?.count || 0) / 10);
  const brands = brandsData?.results || [];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Templates</h1>
          <p className="text-muted-foreground">
            Manage campaign templates for content generation.
          </p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          New Template
        </Button>
      </div>

      {/* Filters & Table */}
      <Card>
        <CardHeader>
          <CardTitle>Campaign Templates</CardTitle>
          <CardDescription>
            Templates define the structure and variables for campaign content
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
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

            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {CAMPAIGN_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {data?.count !== undefined && (
              <Badge variant="secondary" className="ml-auto">
                {data.count} templates
              </Badge>
            )}
          </div>

          {templates.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="No templates found"
              description={
                brandFilter !== "all" || typeFilter !== "all"
                  ? "No templates match your filters."
                  : "Create your first template to get started."
              }
              action={
                brandFilter === "all" &&
                typeFilter === "all" && (
                  <Button>
                    <Plus className="mr-2 h-4 w-4" />
                    New Template
                  </Button>
                )
              }
              className="min-h-[300px]"
            />
          ) : (
            <>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Brand</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Campaigns</TableHead>
                      <TableHead className="w-[80px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {templates.map((template) => (
                      <TemplateRow key={template.id} template={template} />
                    ))}
                  </TableBody>
                </Table>
              </div>

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
        </CardContent>
      </Card>
    </div>
  );
}
