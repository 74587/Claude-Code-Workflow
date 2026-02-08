/**
 * React Query hook for searching Unsplash photos with debounce.
 */
import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { searchUnsplash } from '@/lib/unsplash';
import type { UnsplashSearchResult } from '@/lib/unsplash';

export function useUnsplashSearch(query: string, page = 1, perPage = 20) {
  const [debouncedQuery, setDebouncedQuery] = useState(query);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
    }, 500);
    return () => clearTimeout(timer);
  }, [query]);

  return useQuery<UnsplashSearchResult>({
    queryKey: ['unsplash-search', debouncedQuery, page, perPage],
    queryFn: () => searchUnsplash(debouncedQuery, page, perPage),
    enabled: debouncedQuery.trim().length > 0,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 1,
  });
}
