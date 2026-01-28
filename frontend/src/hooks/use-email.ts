"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import {
  AddRecipientsResult,
  EmailPreview,
  EmailRecipient,
  EmailStats,
  EmailGenerationResult,
  PaginatedResponse,
  SendEmailsResult,
} from "@/types";

// Query keys
export const emailKeys = {
  all: ["email"] as const,
  preview: (campaignId: string) => [...emailKeys.all, "preview", campaignId] as const,
  status: (campaignId: string) => [...emailKeys.all, "status", campaignId] as const,
  recipients: (campaignId: string) => [...emailKeys.all, "recipients", campaignId] as const,
};

// Fetch email preview data
export function useEmailPreview(campaignId: string, enabled = true) {
  return useQuery({
    queryKey: emailKeys.preview(campaignId),
    queryFn: async () => {
      const response = await api.campaigns.getEmailPreview(campaignId);
      return response.data as EmailPreview;
    },
    enabled,
    staleTime: 30000, // 30 seconds
  });
}

// Fetch email sending stats
export function useEmailStats(campaignId: string, enabled = true) {
  return useQuery({
    queryKey: emailKeys.status(campaignId),
    queryFn: async () => {
      const response = await api.campaigns.getEmailStatus(campaignId);
      return response.data as EmailStats;
    },
    enabled,
    refetchInterval: 5000, // Poll every 5 seconds when enabled
  });
}

// Fetch email recipients
export function useEmailRecipients(
  campaignId: string,
  options?: { status?: string; page?: number },
  enabled = true
) {
  return useQuery({
    queryKey: [...emailKeys.recipients(campaignId), options],
    queryFn: async () => {
      const response = await api.campaigns.getRecipients(campaignId, options);
      return response.data as PaginatedResponse<EmailRecipient>;
    },
    enabled,
  });
}

// Generate HTML email mutation
export function useGenerateHtmlEmail() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      campaignId,
      asyncGeneration = false,
    }: {
      campaignId: string;
      asyncGeneration?: boolean;
    }) => {
      const response = await api.campaigns.generateHtmlEmail(campaignId, asyncGeneration);
      return response.data as EmailGenerationResult;
    },
    onSuccess: (_, { campaignId }) => {
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: emailKeys.preview(campaignId) });
      queryClient.invalidateQueries({ queryKey: ["campaigns", campaignId] });
    },
  });
}

// Add recipients mutation
export function useAddRecipients() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      campaignId,
      recipients,
    }: {
      campaignId: string;
      recipients: Array<{ email: string; name?: string }>;
    }) => {
      const response = await api.campaigns.addRecipients(campaignId, recipients);
      return response.data as AddRecipientsResult;
    },
    onSuccess: (_, { campaignId }) => {
      queryClient.invalidateQueries({ queryKey: emailKeys.recipients(campaignId) });
      queryClient.invalidateQueries({ queryKey: emailKeys.status(campaignId) });
      queryClient.invalidateQueries({ queryKey: ["campaigns", campaignId] });
    },
  });
}

// Send emails mutation
export function useSendEmails() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      campaignId,
      recipientIds,
      asyncSending = true,
    }: {
      campaignId: string;
      recipientIds?: string[];
      asyncSending?: boolean;
    }) => {
      const response = await api.campaigns.sendEmails(campaignId, {
        recipient_ids: recipientIds,
        async_sending: asyncSending,
      });
      return response.data as SendEmailsResult;
    },
    onSuccess: (_, { campaignId }) => {
      queryClient.invalidateQueries({ queryKey: emailKeys.status(campaignId) });
      queryClient.invalidateQueries({ queryKey: emailKeys.recipients(campaignId) });
    },
  });
}

// Send test email mutation
export function useSendTestEmail() {
  return useMutation({
    mutationFn: async ({
      campaignId,
      email,
    }: {
      campaignId: string;
      email: string;
    }) => {
      const response = await api.campaigns.sendTestEmail(campaignId, email);
      return response.data;
    },
  });
}

// Clear recipients mutation
export function useClearRecipients() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (campaignId: string) => {
      const response = await api.campaigns.clearRecipients(campaignId);
      return response.data as { deleted: number };
    },
    onSuccess: (_, campaignId) => {
      queryClient.invalidateQueries({ queryKey: emailKeys.recipients(campaignId) });
      queryClient.invalidateQueries({ queryKey: emailKeys.status(campaignId) });
      queryClient.invalidateQueries({ queryKey: ["campaigns", campaignId] });
    },
  });
}
