// Re-export base types
export type {
  CampaignTemplate,
  LocationCampaign,
  ApprovalStep,
  CampaignStatus,
  PaginatedResponse,
} from "./index";

// Form types for creating/updating
export interface CampaignTemplateFormData {
  brand: string;
  name: string;
  description?: string;
  content_template: string;
  required_variables: string[];
  campaign_type: string;
  is_active: boolean;
}

export interface LocationCampaignFormData {
  location: string;
  template: string;
  customizations?: Record<string, unknown>;
  scheduled_start?: string | null;
  scheduled_end?: string | null;
}

// Filter/query types
export interface TemplateFilters {
  page?: number;
  brand?: string;
  campaign_type?: string;
  is_active?: boolean;
}

export interface CampaignFilters {
  page?: number;
  status?: string;
  brand?: string;
  location?: string;
}

// Status display configuration
export interface StatusConfig {
  label: string;
  variant: "default" | "secondary" | "destructive" | "outline" | "success" | "warning";
  description: string;
}

export const CAMPAIGN_STATUS_CONFIG: Record<string, StatusConfig> = {
  draft: {
    label: "Draft",
    variant: "secondary",
    description: "Campaign is being edited",
  },
  pending_review: {
    label: "Pending Review",
    variant: "warning",
    description: "Awaiting approval",
  },
  approved: {
    label: "Approved",
    variant: "success",
    description: "Ready to be scheduled",
  },
  rejected: {
    label: "Rejected",
    variant: "destructive",
    description: "Changes requested",
  },
  scheduled: {
    label: "Scheduled",
    variant: "default",
    description: "Will go live on scheduled date",
  },
  active: {
    label: "Active",
    variant: "success",
    description: "Currently running",
  },
  completed: {
    label: "Completed",
    variant: "outline",
    description: "Campaign has ended",
  },
};

// Campaign type options
export const CAMPAIGN_TYPES = [
  { value: "social_media", label: "Social Media" },
  { value: "email", label: "Email" },
  { value: "sms", label: "SMS" },
  { value: "print", label: "Print" },
  { value: "in_store", label: "In-Store" },
  { value: "digital_signage", label: "Digital Signage" },
] as const;

export type CampaignType = (typeof CAMPAIGN_TYPES)[number]["value"];
