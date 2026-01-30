// ========================================
// useReviewSession Hook
// ========================================
// Custom hook for fetching and managing review session data

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchReviewSessions, fetchReviewSession, type ReviewSession, type ReviewFinding } from '@/lib/api';

interface UseReviewSessionsOptions {
  enabled?: boolean;
  refetchInterval?: number;
}

/**
 * Hook for fetching all review sessions
 */
export function useReviewSessions(options: UseReviewSessionsOptions = {}) {
  const queryClient = useQueryClient();

  const {
    data = [],
    isLoading,
    error,
    refetch,
  } = useQuery<ReviewSession[]>({
    queryKey: ['reviewSessions'],
    queryFn: fetchReviewSessions,
    staleTime: 30000,
    refetchInterval: options.refetchInterval,
    enabled: options.enabled ?? true,
  });

  // Prefetch a specific session
  const prefetchSession = (sessionId: string) => {
    queryClient.prefetchQuery({
      queryKey: ['reviewSession', sessionId],
      queryFn: () => fetchReviewSession(sessionId),
      staleTime: 60000,
    });
  };

  return {
    reviewSessions: data,
    isLoading,
    error,
    refetch,
    prefetchSession,
  };
}

/**
 * Hook for fetching a single review session
 */
export function useReviewSession(sessionId: string | undefined) {
  const {
    data: reviewSession,
    isLoading,
    error,
    refetch,
  } = useQuery<ReviewSession | null>({
    queryKey: ['reviewSession', sessionId],
    queryFn: () => (sessionId ? fetchReviewSession(sessionId) : Promise.resolve(null)),
    enabled: !!sessionId,
    staleTime: 60000,
  });

  // Flatten findings with dimension info
  const flattenedFindings = React.useMemo(() => {
    if (!reviewSession?.reviewDimensions) return [];
    const findings: Array<ReviewFinding & { dimension: string }> = [];
    reviewSession.reviewDimensions.forEach(dim => {
      (dim.findings || []).forEach(f => {
        findings.push({ ...f, dimension: dim.name });
      });
    });
    return findings;
  }, [reviewSession]);

  // Get severity counts
  const severityCounts = React.useMemo(() => {
    const counts = { critical: 0, high: 0, medium: 0, low: 0 };
    flattenedFindings.forEach(f => {
      const sev = (f.severity || 'medium').toLowerCase() as keyof typeof counts;
      if (counts[sev] !== undefined) {
        counts[sev]++;
      }
    });
    return counts;
  }, [flattenedFindings]);

  return {
    reviewSession,
    flattenedFindings,
    severityCounts,
    isLoading,
    error,
    refetch,
  };
}

import React from 'react';
