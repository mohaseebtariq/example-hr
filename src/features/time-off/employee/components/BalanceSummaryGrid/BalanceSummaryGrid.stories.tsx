import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { queryKeys } from '@/lib/query-keys';
import { BalanceSummaryGrid } from './BalanceSummaryGrid';

const EMPLOYEE_ID = 'emp-1';

const mockBalances = [
  { employeeId: EMPLOYEE_ID, locationId: 'loc-annual', locationName: 'Annual Leave', available: 15, pending: 0, fetchedAt: Date.now() },
  { employeeId: EMPLOYEE_ID, locationId: 'loc-sick',   locationName: 'Sick Leave',   available: 10, pending: 2, fetchedAt: Date.now() },
  { employeeId: EMPLOYEE_ID, locationId: 'loc-personal', locationName: 'Personal Days', available: 3, pending: 0, fetchedAt: Date.now() },
];

function withSeededCache(balances: typeof mockBalances) {
  const Decorator = (Story: React.ComponentType) => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
    queryClient.setQueryData(queryKeys.balances(EMPLOYEE_ID), balances);
    return (
      <QueryClientProvider client={queryClient}>
        <Story />
      </QueryClientProvider>
    );
  };
  Decorator.displayName = 'withSeededCache';
  return Decorator;
}

const meta: Meta<typeof BalanceSummaryGrid> = {
  title: 'Employee/BalanceSummaryGrid',
  component: BalanceSummaryGrid,
  parameters: { layout: 'padded' },
  args: { employeeId: EMPLOYEE_ID },
};

export default meta;
type Story = StoryObj<typeof BalanceSummaryGrid>;

export const Loaded: Story = {
  decorators: [withSeededCache(mockBalances)],
};

export const WithPendingDays: Story = {
  decorators: [
    withSeededCache([
      { ...mockBalances[0], available: 12, pending: 3 },
      mockBalances[1],
      mockBalances[2],
    ]),
  ],
};

export const Loading: Story = {
  // No cached data → grid shows LoadingSkeleton
};

// State: empty — employee has no balance rows (CLAUDE.md §11)
export const Empty: Story = {
  decorators: [withSeededCache([])],
};
