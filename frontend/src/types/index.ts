// User types
export interface User {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  role: "admin" | "brand_manager" | "location_manager" | "viewer";
  brands: string[];
  date_joined: string;
}

// Brand types
export interface Brand {
  id: string;
  name: string;
  slug: string;
  logo: string | null;
  settings: Record<string, unknown>;
  location_count?: number;
  created_at: string;
  updated_at?: string;
}

// Location types
export interface Address {
  street?: string;
  city?: string;
  state?: string;
  zip?: string;
}

export interface Location {
  id: string;
  brand: string;
  brand_name?: string;
  name: string;
  store_number: string;
  address: Address;
  full_address?: string;
  attributes: Record<string, unknown>;
  is_active: boolean;
  campaign_count?: number;
  created_at: string;
  updated_at?: string;
}

// Campaign Template types
export interface CampaignTemplate {
  id: string;
  brand: string;
  brand_name?: string;
  name: string;
  description?: string;
  content_template: string;
  required_variables: string[];
  campaign_type: string;
  is_active: boolean;
  campaign_count?: number;
  created_at: string;
  updated_at?: string;
}

// Campaign types
export type CampaignStatus =
  | "draft"
  | "pending_review"
  | "approved"
  | "rejected"
  | "scheduled"
  | "active"
  | "completed";

export interface ApprovalStep {
  id: string;
  approver: number | null;
  approver_name: string | null;
  decision: "submitted" | "approved" | "rejected" | "requested_changes";
  comments: string;
  previous_status: string;
  new_status: string;
  created_at: string;
}

export interface LocationCampaign {
  id: string;
  location: string;
  location_name?: string;
  template: string;
  template_name?: string;
  brand?: string;
  brand_name?: string;
  created_by: number | null;
  created_by_name?: string | null;
  status: CampaignStatus;
  customizations: Record<string, unknown>;
  generated_content: string;
  scheduled_start: string | null;
  scheduled_end: string | null;
  approval_history?: ApprovalStep[];
  created_at: string;
  updated_at?: string;
}

// Pagination types
export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

// API Error type
export interface ApiError {
  detail?: string;
  error?: string;
  [key: string]: unknown;
}

// Import result types
export interface ImportResult {
  success: boolean;
  dry_run: boolean;
  totals: {
    created: number;
    updated: number;
    skipped: number;
    error: number;
  };
  errors: Array<{
    row: number;
    error: string;
  }>;
  message: string;
}
