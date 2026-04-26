import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, within, userEvent } from '@storybook/test';
import { BalanceRow } from './BalanceRow';
import { useRequestModalStore } from '@/store';

const meta: Meta<typeof BalanceRow> = {
  title: 'Employee/BalanceRow',
  component: BalanceRow,
  parameters: { layout: 'padded' },
};

export default meta;
type Story = StoryObj<typeof BalanceRow>;

const freshBalance = {
  employeeId: 'emp-1',
  locationId: 'loc-annual',
  locationName: 'Annual Leave',
  available: 15,
  pending: 0,
  fetchedAt: Date.now(),
};

export const Default: Story = {
  args: { balance: freshBalance, onRefresh: () => {} },
};

export const WithPendingDays: Story = {
  args: {
    balance: { ...freshBalance, available: 12, pending: 3 },
    onRefresh: () => {},
  },
};

export const StaleData: Story = {
  args: {
    balance: { ...freshBalance, fetchedAt: Date.now() - 120_000 },
    onRefresh: () => {},
  },
};

export const LowBalance: Story = {
  args: {
    balance: { ...freshBalance, available: 2 },
    onRefresh: () => {},
  },
};

export const OpensModal: Story = {
  args: { balance: freshBalance, onRefresh: () => {} },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: /request time off/i }));
    expect(useRequestModalStore.getState().isOpen).toBe(true);
    expect(useRequestModalStore.getState().locationId).toBe('loc-annual');
  },
};
