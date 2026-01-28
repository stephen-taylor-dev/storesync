import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import type { User, PaginatedResponse } from "@/types";

export interface UserFilters {
  page?: number;
  pageSize?: number;
  search?: string;
  role?: string;
  is_active?: boolean;
}

export interface UserUpdateData {
  first_name?: string;
  last_name?: string;
  email?: string;
  role?: string;
  brands?: string[];
  is_active?: boolean;
}

// Extended User type with additional admin fields
export interface AdminUser extends User {
  is_active: boolean;
  brands_detail: { id: string; name: string }[];
}

// Query keys
export const userKeys = {
  all: ["users"] as const,
  lists: () => [...userKeys.all, "list"] as const,
  list: (filters: UserFilters) => [...userKeys.lists(), filters] as const,
  details: () => [...userKeys.all, "detail"] as const,
  detail: (id: number) => [...userKeys.details(), id] as const,
};

export function useUsers(filters: UserFilters = {}) {
  const page = filters.page || 1;
  const pageSize = filters.pageSize || 20;

  return useQuery({
    queryKey: userKeys.list(filters),
    queryFn: async () => {
      const response = await api.users.list({
        page,
        page_size: pageSize,
        search: filters.search,
        role: filters.role,
        is_active: filters.is_active,
      });
      return response.data as PaginatedResponse<AdminUser>;
    },
    placeholderData: (previousData) => previousData,
  });
}

export function useUser(id: number) {
  return useQuery({
    queryKey: userKeys.detail(id),
    queryFn: async () => {
      const response = await api.users.get(id);
      return response.data as AdminUser;
    },
    enabled: !!id,
  });
}

export function useUpdateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: number; data: UserUpdateData }) => {
      const response = await api.users.update(id, data);
      return response.data as AdminUser;
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: userKeys.lists() });
      queryClient.invalidateQueries({ queryKey: userKeys.detail(id) });
    },
  });
}

export function useDeleteUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: number) => {
      await api.users.delete(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: userKeys.lists() });
    },
  });
}
