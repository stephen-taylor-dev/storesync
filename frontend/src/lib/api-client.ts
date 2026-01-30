import axios, { AxiosError, AxiosInstance, AxiosRequestConfig } from "axios";
import { useAuthStore } from "@/stores/auth-store";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// Token management
let accessToken: string | null = null;
let refreshToken: string | null = null;

export function setTokens(access: string, refresh: string) {
  accessToken = access;
  refreshToken = refresh;
  if (typeof window !== "undefined") {
    localStorage.setItem("access_token", access);
    localStorage.setItem("refresh_token", refresh);
  }
}

export function getAccessToken(): string | null {
  if (accessToken) return accessToken;
  if (typeof window !== "undefined") {
    accessToken = localStorage.getItem("access_token");
  }
  return accessToken;
}

export function getRefreshToken(): string | null {
  if (refreshToken) return refreshToken;
  if (typeof window !== "undefined") {
    refreshToken = localStorage.getItem("refresh_token");
  }
  return refreshToken;
}

export function clearTokens() {
  accessToken = null;
  refreshToken = null;
  if (typeof window !== "undefined") {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
  }
}

// Create axios instance
const apiClient: AxiosInstance = axios.create({
  baseURL: `${API_URL}/api/v1`,
  headers: {
    "Content-Type": "application/json",
  },
});

// Request interceptor to add auth token
apiClient.interceptors.request.use(
  (config) => {
    const token = getAccessToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor to handle token refresh
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as AxiosRequestConfig & {
      _retry?: boolean;
    };

    // If 401 and we haven't retried yet, try refreshing the token
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      const refresh = getRefreshToken();
      if (refresh) {
        try {
          const response = await axios.post(`${API_URL}/api/v1/auth/token/refresh/`, {
            refresh,
          });

          const { access } = response.data;
          setTokens(access, refresh);

          // Retry the original request with new token
          if (originalRequest.headers) {
            originalRequest.headers.Authorization = `Bearer ${access}`;
          }
          return apiClient(originalRequest);
        } catch (refreshError) {
          // Refresh failed, clear tokens and redirect to login
          clearTokens();
          // Clear auth store state
          useAuthStore.getState().logout();
          if (typeof window !== "undefined") {
            window.location.href = "/login";
          }
          return Promise.reject(refreshError);
        }
      }
    }

    return Promise.reject(error);
  }
);

// API helper functions
export const api = {
  // Auth
  auth: {
    login: (username: string, password: string) =>
      apiClient.post("/auth/token/", { username, password }),
    refresh: (refresh: string) =>
      apiClient.post("/auth/token/refresh/", { refresh }),
    register: (data: {
      username: string;
      email: string;
      password: string;
      password_confirm: string;
    }) => apiClient.post("/auth/register/", data),
    me: () => apiClient.get("/auth/me/"),
    updateMe: (data: { first_name?: string; last_name?: string; email?: string }) =>
      apiClient.patch("/auth/me/", data),
    changePassword: (old_password: string, new_password: string) =>
      apiClient.post("/auth/change-password/", { old_password, new_password }),
    getPreferences: () => apiClient.get("/auth/me/preferences/"),
    updatePreferences: (data: {
      notifications?: {
        email_campaign_submitted?: boolean;
        email_campaign_approved?: boolean;
        email_campaign_rejected?: boolean;
      };
      display?: {
        theme?: "light" | "dark" | "system";
      };
    }) => apiClient.patch("/auth/me/preferences/", data),
  },

  // Brands
  brands: {
    list: (params?: { page?: number; search?: string; page_size?: number }) =>
      apiClient.get("/brands/", { params }),
    get: (id: string) => apiClient.get(`/brands/${id}/`),
    create: (data: { name: string; slug: string; settings?: object }) =>
      apiClient.post("/brands/", data),
    update: (id: string, data: Partial<{ name: string; slug: string; settings: object }>) =>
      apiClient.patch(`/brands/${id}/`, data),
    delete: (id: string) => apiClient.delete(`/brands/${id}/`),
  },

  // Locations (nested under brands)
  locations: {
    list: (brandId: string, params?: { page?: number; search?: string; is_active?: boolean }) =>
      apiClient.get(`/brands/${brandId}/locations/`, { params }),
    get: (brandId: string, id: string) =>
      apiClient.get(`/brands/${brandId}/locations/${id}/`),
    create: (
      brandId: string,
      data: {
        name: string;
        store_number: string;
        address?: object;
        attributes?: object;
        is_active?: boolean;
      }
    ) => apiClient.post(`/brands/${brandId}/locations/`, data),
    update: (brandId: string, id: string, data: object) =>
      apiClient.patch(`/brands/${brandId}/locations/${id}/`, data),
    delete: (brandId: string, id: string) =>
      apiClient.delete(`/brands/${brandId}/locations/${id}/`),
    bulkImport: (brandId: string, file: File, dryRun = false) => {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("dry_run", dryRun.toString());
      return apiClient.post(`/brands/${brandId}/locations/bulk_import/`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
    },
    importTemplate: (brandId: string) =>
      apiClient.get(`/brands/${brandId}/locations/import_template/`, {
        responseType: "blob",
      }),
  },

  // All Locations (across all brands)
  allLocations: {
    list: (params?: { page?: number; brand?: string; search?: string; is_active?: boolean; page_size?: number }) =>
      apiClient.get("/locations/", { params }),
    get: (id: string) => apiClient.get(`/locations/${id}/`),
  },

  // User Management (Admin only)
  users: {
    list: (params?: { page?: number; page_size?: number; search?: string; role?: string; is_active?: boolean }) =>
      apiClient.get("/users/", { params }),
    get: (id: number) => apiClient.get(`/users/${id}/`),
    update: (id: number, data: { first_name?: string; last_name?: string; email?: string; role?: string; brands?: string[]; is_active?: boolean }) =>
      apiClient.patch(`/users/${id}/`, data),
    delete: (id: number) => apiClient.delete(`/users/${id}/`),
  },

  // Campaign Templates
  templates: {
    list: (params?: { page?: number; brand?: string; campaign_type?: string }) =>
      apiClient.get("/campaigns/templates/", { params }),
    get: (id: string) => apiClient.get(`/campaigns/templates/${id}/`),
    create: (data: {
      brand: string;
      name: string;
      content_template: string;
      required_variables: string[];
      campaign_type: string;
    }) => apiClient.post("/campaigns/templates/", data),
    update: (id: string, data: object) =>
      apiClient.patch(`/campaigns/templates/${id}/`, data),
    delete: (id: string) => apiClient.delete(`/campaigns/templates/${id}/`),
    preview: (data: {
      content_template: string;
      use_ai?: boolean;
      sample_data?: Record<string, string>;
    }) => apiClient.post("/campaigns/templates/preview/", data),
  },

  // Location Campaigns
  campaigns: {
    list: (params?: {
      page?: number;
      status?: string;
      brand?: string;
      location?: string;
    }) => apiClient.get("/campaigns/", { params }),
    get: (id: string) => apiClient.get(`/campaigns/${id}/`),
    create: (data: {
      location: string;
      template: string;
      customizations?: object;
      scheduled_start?: string;
      scheduled_end?: string;
    }) => apiClient.post("/campaigns/", data),
    update: (id: string, data: object) => apiClient.patch(`/campaigns/${id}/`, data),
    delete: (id: string) => apiClient.delete(`/campaigns/${id}/`),
    // Workflow actions
    submit: (id: string, comments?: string) =>
      apiClient.post(`/campaigns/${id}/submit/`, { comments }),
    approve: (id: string, comments?: string) =>
      apiClient.post(`/campaigns/${id}/approve/`, { comments }),
    reject: (id: string, comments: string) =>
      apiClient.post(`/campaigns/${id}/reject/`, { comments }),
    schedule: (id: string) => apiClient.post(`/campaigns/${id}/schedule/`),
    revise: (id: string, comments?: string) =>
      apiClient.post(`/campaigns/${id}/revise/`, { comments }),
    // AI Content Generation
    generateContent: (
      id: string,
      options?: {
        use_ai?: boolean;
        additional_instructions?: string;
        async_generation?: boolean;
      }
    ) => apiClient.post(`/campaigns/${id}/generate_content/`, options || {}),
    regenerateContent: (
      id: string,
      options?: {
        additional_instructions?: string;
        async_generation?: boolean;
      }
    ) => apiClient.post(`/campaigns/${id}/regenerate_content/`, options || {}),
    // Similarity Search
    findSimilar: (params: {
      query?: string;
      campaign_id?: string;
      limit?: number;
      similarity_threshold?: number;
      brand_id?: string;
      same_brand_only?: boolean;
      status_filter?: string[];
    }) => apiClient.post("/campaigns/similar/", params),
    getSimilarTo: (
      id: string,
      params?: { limit?: number; threshold?: number; same_brand?: boolean }
    ) => apiClient.get(`/campaigns/${id}/similar_to/`, { params }),
    // Embeddings
    computeEmbedding: (id: string) =>
      apiClient.post(`/campaigns/${id}/compute_embedding/`),
    computeEmbeddings: (params?: {
      campaign_ids?: string[];
      recompute?: boolean;
      async_processing?: boolean;
    }) => apiClient.post("/campaigns/compute_embeddings/", params || {}),
    // HTML Email
    generateHtmlEmail: (id: string, asyncGeneration = false) =>
      apiClient.post(`/campaigns/${id}/generate_html_email/`, { async_generation: asyncGeneration }),
    getEmailPreview: (id: string) =>
      apiClient.get(`/campaigns/${id}/email_preview/`),
    addRecipients: (id: string, recipients: Array<{ email: string; name?: string }>) =>
      apiClient.post(`/campaigns/${id}/add_recipients/`, { recipients }),
    getRecipients: (id: string, params?: { status?: string; page?: number }) =>
      apiClient.get(`/campaigns/${id}/recipients/`, { params }),
    sendEmails: (
      id: string,
      options?: { recipient_ids?: string[]; async_sending?: boolean }
    ) => apiClient.post(`/campaigns/${id}/send_emails/`, options || { async_sending: true }),
    getEmailStatus: (id: string) =>
      apiClient.get(`/campaigns/${id}/email_status/`),
    sendTestEmail: (id: string, email: string) =>
      apiClient.post(`/campaigns/${id}/send_test_email/`, { email }),
    clearRecipients: (id: string) =>
      apiClient.post(`/campaigns/${id}/clear_recipients/`),
  },
};

export default apiClient;
