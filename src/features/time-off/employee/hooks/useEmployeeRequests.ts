'use client';

import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';
import { hcmClient } from '@/lib/hcm-client';

export function useEmployeeRequests(employeeId: string) {
  return useQuery({
    queryKey: queryKeys.requests.employee(employeeId),
    queryFn: () => hcmClient.getRequestsForEmployee(employeeId),
    staleTime: 60_000,
    refetchOnWindowFocus: true,
  });
}
