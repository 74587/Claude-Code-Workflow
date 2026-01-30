// ========================================
// Query Client Configuration
// ========================================
// TanStack Query client configuration for React

import { QueryClient } from '@tanstack/react-query';

/**
 * Query client instance with default configuration
 */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Time in milliseconds that data remains fresh
      staleTime: 1000 * 60 * 5, // 5 minutes
      // Time in milliseconds that unused data is cached
      gcTime: 1000 * 60 * 10, // 10 minutes
      // Number of times to retry failed queries
      retry: 1,
      // Disable refetch on window focus for better UX
      refetchOnWindowFocus: false,
    },
    mutations: {
      // Number of times to retry failed mutations
      retry: 1,
    },
  },
});

export default queryClient;
