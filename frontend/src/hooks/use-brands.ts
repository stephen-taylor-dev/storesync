import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import type { Brand, Location, PaginatedResponse } from "@/types";
import type {
  BrandFormData,
  LocationFormData,
  BrandFilters,
  LocationFilters,
} from "@/types/brand";

// Query keys
export const brandKeys = {
  all: ["brands"] as const,
  lists: () => [...brandKeys.all, "list"] as const,
  list: (filters: BrandFilters) => [...brandKeys.lists(), filters] as const,
  details: () => [...brandKeys.all, "detail"] as const,
  detail: (id: string) => [...brandKeys.details(), id] as const,
};

export const locationKeys = {
  all: ["locations"] as const,
  lists: () => [...locationKeys.all, "list"] as const,
  list: (brandId: string, filters: LocationFilters) =>
    [...locationKeys.lists(), brandId, filters] as const,
  details: () => [...locationKeys.all, "detail"] as const,
  detail: (brandId: string, id: string) =>
    [...locationKeys.details(), brandId, id] as const,
};

// Brand hooks
export function useBrands(filters: BrandFilters = {}) {
  return useQuery({
    queryKey: brandKeys.list(filters),
    queryFn: async () => {
      const response = await api.brands.list(filters);
      return response.data as PaginatedResponse<Brand>;
    },
  });
}

export function useBrand(id: string) {
  return useQuery({
    queryKey: brandKeys.detail(id),
    queryFn: async () => {
      const response = await api.brands.get(id);
      return response.data as Brand;
    },
    enabled: !!id,
  });
}

export function useCreateBrand() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: BrandFormData) => {
      const response = await api.brands.create(data);
      return response.data as Brand;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: brandKeys.lists() });
    },
  });
}

export function useUpdateBrand() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<BrandFormData> }) => {
      const response = await api.brands.update(id, data);
      return response.data as Brand;
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: brandKeys.lists() });
      queryClient.invalidateQueries({ queryKey: brandKeys.detail(id) });
    },
  });
}

export function useDeleteBrand() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await api.brands.delete(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: brandKeys.lists() });
    },
  });
}

// Location hooks
export function useLocations(brandId: string, filters: LocationFilters = {}) {
  return useQuery({
    queryKey: locationKeys.list(brandId, filters),
    queryFn: async () => {
      const response = await api.locations.list(brandId, filters);
      return response.data as PaginatedResponse<Location>;
    },
    enabled: !!brandId,
  });
}

export function useLocation(brandId: string, id: string) {
  return useQuery({
    queryKey: locationKeys.detail(brandId, id),
    queryFn: async () => {
      const response = await api.locations.get(brandId, id);
      return response.data as Location;
    },
    enabled: !!brandId && !!id,
  });
}

export function useCreateLocation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      brandId,
      data,
    }: {
      brandId: string;
      data: LocationFormData;
    }) => {
      const response = await api.locations.create(brandId, data);
      return response.data as Location;
    },
    onSuccess: (_, { brandId }) => {
      queryClient.invalidateQueries({ queryKey: locationKeys.list(brandId, {}) });
      queryClient.invalidateQueries({ queryKey: brandKeys.detail(brandId) });
    },
  });
}

export function useUpdateLocation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      brandId,
      id,
      data,
    }: {
      brandId: string;
      id: string;
      data: Partial<LocationFormData>;
    }) => {
      const response = await api.locations.update(brandId, id, data);
      return response.data as Location;
    },
    onSuccess: (_, { brandId, id }) => {
      queryClient.invalidateQueries({ queryKey: locationKeys.list(brandId, {}) });
      queryClient.invalidateQueries({ queryKey: locationKeys.detail(brandId, id) });
    },
  });
}

export function useDeleteLocation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ brandId, id }: { brandId: string; id: string }) => {
      await api.locations.delete(brandId, id);
    },
    onSuccess: (_, { brandId }) => {
      queryClient.invalidateQueries({ queryKey: locationKeys.list(brandId, {}) });
      queryClient.invalidateQueries({ queryKey: brandKeys.detail(brandId) });
    },
  });
}

export function useBulkImportLocations() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      brandId,
      file,
      dryRun = false,
    }: {
      brandId: string;
      file: File;
      dryRun?: boolean;
    }) => {
      const response = await api.locations.bulkImport(brandId, file, dryRun);
      return response.data;
    },
    onSuccess: (_, { brandId }) => {
      queryClient.invalidateQueries({ queryKey: locationKeys.list(brandId, {}) });
      queryClient.invalidateQueries({ queryKey: brandKeys.detail(brandId) });
    },
  });
}
