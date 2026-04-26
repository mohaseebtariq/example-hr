'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { hcmClient } from '@/lib/hcm-client';
import { queryKeys } from '@/lib/query-keys';

export type DenyVariables = {
  requestId: string;
  employeeId: string;
  locationId: string;
};

export function useDenyRequest(managerId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ requestId }: DenyVariables) => hcmClient.denyRequest(requestId),
    onSuccess: (_, { employeeId, locationId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.requests.manager(managerId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.balance(employeeId, locationId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.balances(employeeId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.requests.employee(employeeId) });
    },
  });
}
