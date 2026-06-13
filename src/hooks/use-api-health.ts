/**
 * React Query hook for GET /api/health
 *
 * Polls the NestJS API health endpoint every 30 seconds so the dev diagnostics
 * page always shows a live status without a manual refresh.
 *
 * Usage:
 *   const { data, isLoading, isError } = useApiHealth();
 */
import { useQuery } from '@tanstack/react-query';
import { apiClient, type HealthResponse } from '@/lib/api-client';

export function useApiHealth() {
  return useQuery<HealthResponse, Error>({
    queryKey: ['api', 'health'],
    queryFn: () => apiClient.health(),
    refetchInterval: 30_000,    // poll every 30 s
    retry: 2,
    staleTime: 10_000,
  });
}
