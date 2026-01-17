import { useEffect, useRef, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";

interface UsePollingOptions {
  /** Polling interval in milliseconds */
  interval?: number;
  /** Whether polling is enabled */
  enabled?: boolean;
  /** Query keys to invalidate on each poll */
  queryKeys?: readonly unknown[][];
  /** Custom callback to run on each poll */
  onPoll?: () => void | Promise<void>;
}

/**
 * Hook for polling/refreshing data at regular intervals
 */
export function usePolling({
  interval = 30000, // 30 seconds default
  enabled = true,
  queryKeys = [],
  onPoll,
}: UsePollingOptions = {}) {
  const queryClient = useQueryClient();
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const poll = useCallback(async () => {
    // Invalidate specified query keys
    for (const key of queryKeys) {
      await queryClient.invalidateQueries({ queryKey: key });
    }

    // Run custom callback if provided
    if (onPoll) {
      await onPoll();
    }
  }, [queryClient, queryKeys, onPoll]);

  useEffect(() => {
    if (!enabled) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    // Start polling
    intervalRef.current = setInterval(poll, interval);

    // Cleanup on unmount or when dependencies change
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [enabled, interval, poll]);

  // Manual refresh function
  const refresh = useCallback(() => {
    poll();
  }, [poll]);

  return { refresh };
}

/**
 * Hook specifically for polling campaign/approval updates
 */
export function useApprovalPolling(enabled = true) {
  const queryClient = useQueryClient();

  return usePolling({
    interval: 15000, // 15 seconds for approvals
    enabled,
    onPoll: async () => {
      // Invalidate campaigns list
      await queryClient.invalidateQueries({ queryKey: ["campaigns"] });
    },
  });
}

/**
 * Hook for polling a single campaign's status
 */
export function useCampaignPolling(campaignId: string, enabled = true) {
  const queryClient = useQueryClient();

  return usePolling({
    interval: 10000, // 10 seconds for single campaign
    enabled: enabled && !!campaignId,
    onPoll: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["campaigns", "detail", campaignId],
      });
    },
  });
}
