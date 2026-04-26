'use client';

import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';
import { hcmClient } from '@/lib/hcm-client';

export function useBalances(employeeId: string) {
  return useQuery({
    queryKey: queryKeys.balances(employeeId),
    queryFn: () => hcmClient.getBalances(employeeId),
    staleTime: 30_000,
    refetchOnMount: 'always',
    refetchInterval: 30_000,
  });
}
