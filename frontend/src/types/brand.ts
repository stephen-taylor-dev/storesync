// Re-export base types
export type { Brand, Location, Address, PaginatedResponse } from "./index";

// Form types for creating/updating
export interface BrandFormData {
  name: string;
  slug: string;
  settings?: Record<string, unknown>;
}

export interface LocationFormData {
  name: string;
  store_number: string;
  address: {
    street?: string;
    city?: string;
    state?: string;
    zip?: string;
  };
  attributes?: Record<string, unknown>;
  is_active: boolean;
}

// Filter/query types
export interface BrandFilters {
  page?: number;
  search?: string;
}

export interface LocationFilters {
  page?: number;
  search?: string;
  is_active?: boolean;
}

// Table sorting
export type SortDirection = "asc" | "desc";

export interface SortConfig {
  key: string;
  direction: SortDirection;
}
