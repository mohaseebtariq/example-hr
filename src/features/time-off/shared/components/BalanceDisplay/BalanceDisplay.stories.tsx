import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, within } from '@storybook/test';
import { BalanceDisplay } from './BalanceDisplay';

const freshBalance = {
  employeeId: 'emp-1',
  locationId: 'loc-annual',
  locationName: 'Annual Leave',
  available: 15,
  pending: 0,
  fetchedAt: Date.now(),
};

const meta = {
  title: 'Time-Off/Shared/BalanceDisplay',
  component: BalanceDisplay,
  parameters: { layout: 'centered' },
  args: { balance: freshBalance },
} satisfies Meta<typeof BalanceDisplay>;

export default meta;
type Story = StoryObj<typeof meta>;

// §11 state: loaded
export const Fresh: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('15')).toBeInTheDocument();
    await expect(canvas.getByText('days available')).toBeInTheDocument();
    await expect(canvas.queryByText(/Balance as of/)).not.toBeInTheDocument();
  },
};

// §11 state: optimistic-pending
export const WithPendingDays: Story = {
  args: { balance: { ...freshBalance, available: 12, pending: 3 } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('12')).toBeInTheDocument();
    await expect(canvas.getByText(/3 days pending confirmation/)).toBeInTheDocument();
  },
};

// §11 state: stale
export const Stale: Story = {
  args: { balance: { ...freshBalance, fetchedAt: Date.now() - 120_000 } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/Balance as of/)).toBeInTheDocument();
  },
};

export const StaleWithRefresh: Story = {
  args: {
    balance: { ...freshBalance, fetchedAt: Date.now() - 300_000 },
    onRefresh: () => alert('Refreshing…'),
  },
};

export const ZeroBalance: Story = {
  args: { balance: { ...freshBalance, available: 0 } },
};
