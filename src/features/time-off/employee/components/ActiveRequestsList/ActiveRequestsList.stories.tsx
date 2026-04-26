import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, within } from '@storybook/test';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { queryKeys } from '@/lib/query-keys';
import type { TimeOffRequest } from '@/features/time-off/shared/types';
import { ActiveRequestsList } from './ActiveRequestsList';

const EMPLOYEE_ID = 'e-100';

function withSeededRequests(requests: TimeOffRequest[]) {
  const Decorator = (Story: React.ComponentType) => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: Infinity } },
    });
    queryClient.setQueryData(queryKeys.requests.employee(EMPLOYEE_ID), requests);
    return (
      <QueryClientProvider client={queryClient}>
        <Story />
      </QueryClientProvider>
    );
  };
  Decorator.displayName = 'withSeededRequests';
  return Decorator;
}

const pendingManagerRequest: TimeOffRequest = {
  id: 'req-1',
  employeeId: EMPLOYEE_ID,
  locationId: 'loc-annual',
  days: 3,
  startDate: '2026-06-01',
  endDate: '2026-06-03',
  status: 'pending-manager',
};

const approvedRequest: TimeOffRequest = {
  id: 'req-2',
  employeeId: EMPLOYEE_ID,
  locationId: 'loc-sick',
  days: 1,
  startDate: '2026-05-10',
  endDate: '2026-05-10',
  status: 'approved',
};

const deniedRequest: TimeOffRequest = {
  id: 'req-3',
  employeeId: EMPLOYEE_ID,
  locationId: 'loc-personal',
  days: 2,
  startDate: '2026-05-20',
  endDate: '2026-05-21',
  status: 'denied',
};

const rolledBackRequest: TimeOffRequest = {
  id: 'req-4',
  employeeId: EMPLOYEE_ID,
  locationId: 'loc-annual',
  days: 5,
  startDate: '2026-07-01',
  endDate: '2026-07-05',
  status: 'rolled-back',
  hcmRejectionReason: 'HCM did not record the deduction. Your balance was unchanged.',
};

const meta: Meta<typeof ActiveRequestsList> = {
  title: 'Employee/ActiveRequestsList',
  component: ActiveRequestsList,
  parameters: { layout: 'padded' },
  args: { employeeId: EMPLOYEE_ID },
};

export default meta;
type Story = StoryObj<typeof ActiveRequestsList>;

// State: loading
export const Loading: Story = {};

// State: empty — no requests yet
export const Empty: Story = {
  decorators: [withSeededRequests([])],
};

// State: loaded with mixed statuses
export const Loaded: Story = {
  decorators: [withSeededRequests([pendingManagerRequest, approvedRequest, deniedRequest])],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByText('Pending approval');
    expect(canvas.getByText('Approved')).toBeTruthy();
    expect(canvas.getByText('Denied')).toBeTruthy();
  },
};

// State: request-approved (CLAUDE.md §11)
export const Approved: Story = {
  decorators: [withSeededRequests([approvedRequest])],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(await canvas.findByText('Approved')).toBeTruthy();
  },
};

// State: request-denied (CLAUDE.md §11)
export const Denied: Story = {
  decorators: [withSeededRequests([deniedRequest])],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(await canvas.findByText('Denied')).toBeTruthy();
  },
};

// State: optimistic-rolled-back / hcm-silently-wrong (CLAUDE.md §11)
export const RolledBack: Story = {
  decorators: [withSeededRequests([rolledBackRequest])],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(await canvas.findByText('Rolled back')).toBeTruthy();
    expect(canvas.getByRole('alert')).toBeTruthy();
  },
};
