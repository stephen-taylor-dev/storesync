"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useTemplate } from "@/hooks/use-templates";
import { Button } from "@/components/ui/button";
import { TemplateForm } from "@/components/templates/template-form";
import { PageLoader } from "@/components/shared/loading-spinner";
import { ErrorState } from "@/components/shared/error-state";

interface TemplateDetailPageProps {
  params: { templateId: string };
}

export default function TemplateDetailPage({ params }: TemplateDetailPageProps) {
  const { templateId } = params;
  const { data: template, isLoading, isError, refetch } = useTemplate(templateId);

  if (isLoading) {
    return <PageLoader message="Loading template..." />;
  }

  if (isError || !template) {
    return (
      <ErrorState
        title="Failed to load template"
        message="There was an error loading this template. Please try again."
        onRetry={() => refetch()}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/dashboard/templates">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Edit Template</h1>
          <p className="text-muted-foreground">{template.name}</p>
        </div>
      </div>

      {/* Form */}
      <TemplateForm template={template} />
    </div>
  );
}
