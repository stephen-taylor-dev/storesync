import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import type { UserPreferences, UserPreferencesUpdate } from "@/types";

// Query keys
export const settingsKeys = {
  all: ["settings"] as const,
  preferences: () => [...settingsKeys.all, "preferences"] as const,
  user: () => ["auth", "me"] as const,
};

// Hook to get user preferences
export function usePreferences() {
  return useQuery({
    queryKey: settingsKeys.preferences(),
    queryFn: async () => {
      const response = await api.auth.getPreferences();
      return response.data as UserPreferences;
    },
  });
}

// Hook to update user preferences
export function useUpdatePreferences() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: UserPreferencesUpdate) => {
      const response = await api.auth.updatePreferences(data);
      return response.data as UserPreferences;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: settingsKeys.preferences() });
      queryClient.invalidateQueries({ queryKey: settingsKeys.user() });
    },
  });
}

// Hook to update user profile
export function useUpdateProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      first_name?: string;
      last_name?: string;
      email?: string;
    }) => {
      const response = await api.auth.updateMe(data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: settingsKeys.user() });
    },
  });
}

// Hook to change password
export function useChangePassword() {
  return useMutation({
    mutationFn: async (data: { old_password: string; new_password: string }) => {
      const response = await api.auth.changePassword(
        data.old_password,
        data.new_password
      );
      return response.data;
    },
  });
}
