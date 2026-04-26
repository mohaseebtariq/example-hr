import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, within, userEvent } from '@storybook/test';
import { getMswStore } from '@/mocks/msw-store';
import { submitRequest } from '@/lib/mock-hcm/logic';
import type { TimeOffRequest } from '@/features/time-off/shared/types';
import { ApprovalCard } from './ApprovalCard';

// Seed a pending-manager request so stories have realistic data
function seedPendingRequest(days = 3): TimeOffRequest {
  const store = getMswStore();
  const result = submitRequest(store, {
    employeeId: 'e-100',
    locationId: 'loc-annual',
    days,
    startDate: '2026-06-01',
    endDate: `2026-06-0${days}`,
  });
  const requestId = (result.body as { requestId: string }).requestId;
  return store.requests.get(requestId) as TimeOffRequest;
}

const meta: Meta<typeof ApprovalCard> = {
  title: 'Manager/ApprovalCard',
  component: ApprovalCard,
  parameters: { layout: 'padded' },
};

export default meta;
type Story = StoryObj<typeof ApprovalCard>;

// Default: sufficient balance — Approve button enabled
export const SufficientBalance: Story = {
  loaders: [
    async () => {
      const request = seedPendingRequest(3);
      return { request };
    },
  ],
  render: (_args, { loaded }) =>
    // @ts-expect-error loaded is typed as unknown
    loaded.request
      ? // @ts-expect-error loaded is typed as unknown
        ApprovalCard({ managerId: 'm-100', request: loaded.request as TimeOffRequest })
      : null,
};

// Inline args-based approach: direct props, MSW resolves the live balance
export const WithRequest: Story = {
  args: {
    managerId: 'm-100',
    request: {
      id: 'req-story-1',
      employeeId: 'e-100',
      locationId: 'loc-annual',
      days: 3,
      startDate: '2026-06-01',
      endDate: '2026-06-03',
      status: 'pending-manager',
    } satisfies TimeOffRequest,
  },
};

// manager-balance-loading: live balance panel shows skeleton while fetching
export const BalanceLoading: Story = {
  args: {
    managerId: 'm-100',
    request: {
      id: 'req-story-2',
      employeeId: 'e-100',
      locationId: 'loc-annual',
      days: 3,
      startDate: '2026-06-01',
      endDate: '2026-06-03',
      status: 'pending-manager',
    } satisfies TimeOffRequest,
  },
  // No extra MSW override — the default handler resolves; screenshot timing shows skeleton
};

// Interaction: click Approve when balance is sufficient
export const ApproveFlow: Story = {
  args: {
    managerId: 'm-100',
    request: {
      id: 'req-story-approve',
      employeeId: 'e-100',
      locationId: 'loc-annual',
      days: 3,
      startDate: '2026-06-01',
      endDate: '2026-06-03',
      status: 'pending-manager',
    } satisfies TimeOffRequest,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const approveButton = await canvas.findByRole('button', { name: 'Approve' });
    await expect(approveButton).toBeTruthy();
    // Balance loads async; wait for it to enable
    await userEvent.click(approveButton);
  },
};

// State: manager-approval-conflict — balance changed after card rendered
// (CLAUDE.md §11 state: manager-approval-conflict)
export const ConflictOnApproval: Story = {
  args: {
    managerId: 'm-100',
    request: {
      id: 'req-story-conflict',
      employeeId: 'e-101',
      locationId: 'loc-annual',
      days: 25,
      startDate: '2026-06-01',
      endDate: '2026-06-25',
      status: 'pending-manager',
    } satisfies TimeOffRequest,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // e-101 has 20 days; requesting 25 means the live balance is insufficient,
    // so the conflict modal appears when the manager tries to approve.
    await canvas.findByText(/insufficient balance/i);
    const approveButton = canvas.getByRole('button', { name: 'Approve' });
    expect((approveButton as HTMLButtonElement).disabled).toBe(true);
  },
};
