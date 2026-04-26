'use client';

import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';
import { hcmClient } from '@/lib/hcm-client';

export function useManagerRequests(managerId: string) {
  return useQuery({
    queryKey: queryKeys.requests.manager(managerId),
    queryFn: () => hcmClient.getRequestsForManager(managerId),
    staleTime: 15_000,
    refetchInterval: 15_000,
    refetchOnWindowFocus: true,
  });
}

