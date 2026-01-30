import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import type { LocationCampaign, PaginatedResponse } from "@/types";
import type { CampaignFilters, LocationCampaignFormData } from "@/types/campaign";

// Query keys
export const campaignKeys = {
  all: ["campaigns"] as const,
  lists: () => [...campaignKeys.all, "list"] as const,
  list: (filters: CampaignFilters) => [...campaignKeys.lists(), filters] as const,
  details: () => [...campaignKeys.all, "detail"] as const,
  detail: (id: string) => [...campaignKeys.details(), id] as const,
};

// Campaign hooks
export function useCampaigns(filters: CampaignFilters = {}) {
  return useQuery({
    queryKey: campaignKeys.list(filters),
    queryFn: async () => {
      const response = await api.campaigns.list(filters);
      return response.data as PaginatedResponse<LocationCampaign>;
    },
  });
}

export function useCampaign(id: string) {
  return useQuery({
    queryKey: campaignKeys.detail(id),
    queryFn: async () => {
      const response = await api.campaigns.get(id);
      return response.data as LocationCampaign;
    },
    enabled: !!id,
  });
}

export function useCreateCampaign() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: LocationCampaignFormData) => {
      const response = await api.campaigns.create(data);
      return response.data as LocationCampaign;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: campaignKeys.lists() });
    },
  });
}

export function useUpdateCampaign() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: Partial<LocationCampaignFormData>;
    }) => {
      const response = await api.campaigns.update(id, data);
      return response.data as LocationCampaign;
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: campaignKeys.lists() });
      queryClient.invalidateQueries({ queryKey: campaignKeys.detail(id) });
    },
  });
}

export function useDeleteCampaign() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await api.campaigns.delete(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: campaignKeys.lists() });
    },
  });
}

// Workflow action hooks
export function useSubmitCampaign() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, comments }: { id: string; comments?: string }) => {
      const response = await api.campaigns.submit(id, comments);
      return response.data as LocationCampaign;
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: campaignKeys.lists() });
      queryClient.invalidateQueries({ queryKey: campaignKeys.detail(id) });
    },
  });
}

export function useApproveCampaign() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, comments }: { id: string; comments?: string }) => {
      const response = await api.campaigns.approve(id, comments);
      return response.data as LocationCampaign;
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: campaignKeys.lists() });
      queryClient.invalidateQueries({ queryKey: campaignKeys.detail(id) });
    },
  });
}

export function useRejectCampaign() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, comments }: { id: string; comments: string }) => {
      const response = await api.campaigns.reject(id, comments);
      return response.data as LocationCampaign;
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: campaignKeys.lists() });
      queryClient.invalidateQueries({ queryKey: campaignKeys.detail(id) });
    },
  });
}

export function useScheduleCampaign() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await api.campaigns.schedule(id);
      return response.data as LocationCampaign;
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: campaignKeys.lists() });
      queryClient.invalidateQueries({ queryKey: campaignKeys.detail(id) });
    },
  });
}

export function useReviseCampaign() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, comments }: { id: string; comments?: string }) => {
      const response = await api.campaigns.revise(id, comments);
      return response.data as LocationCampaign;
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: campaignKeys.lists() });
      queryClient.invalidateQueries({ queryKey: campaignKeys.detail(id) });
    },
  });
}

// AI Content Generation hooks
interface GenerateContentOptions {
  use_ai?: boolean;
  additional_instructions?: string;
  async_generation?: boolean;
}

interface GenerateContentResponse {
  status: "success" | "queued" | "error";
  content?: string;
  content_length?: number;
  used_ai?: boolean;
  fallback_reason?: string;
  message?: string;
}

export function useGenerateContent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      options,
    }: {
      id: string;
      options?: GenerateContentOptions;
    }) => {
      const response = await api.campaigns.generateContent(id, options);
      return response.data as GenerateContentResponse;
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: campaignKeys.detail(id) });
    },
  });
}

export function useRegenerateContent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      options,
    }: {
      id: string;
      options?: GenerateContentOptions;
    }) => {
      const response = await api.campaigns.regenerateContent(id, options);
      return response.data as GenerateContentResponse;
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: campaignKeys.detail(id) });
    },
  });
}

// Similar campaigns hooks
export interface SimilarCampaign {
  campaign_id: string;
  template_name: string;
  location_name: string;
  brand_name: string;
  similarity_score: number;
  content_preview: string;
  status: string;
}

interface SimilarCampaignsResponse {
  results: SimilarCampaign[];
  total: number;
  query_campaign_id: string;
}

export function useSimilarCampaigns(
  campaignId: string,
  options?: { limit?: number; threshold?: number; sameBrand?: boolean }
) {
  return useQuery({
    queryKey: [...campaignKeys.detail(campaignId), "similar", options],
    queryFn: async () => {
      const response = await api.campaigns.getSimilarTo(campaignId, {
        limit: options?.limit,
        threshold: options?.threshold,
        same_brand: options?.sameBrand,
      });
      return response.data as SimilarCampaignsResponse;
    },
    enabled: !!campaignId,
  });
}
