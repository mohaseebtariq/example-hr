import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { LiveBalancePanel } from './LiveBalancePanel';

const freshBalance = {
  employeeId: 'e-100',
  locationId: 'loc-annual',
  locationName: 'Annual Leave',
  available: 15,
  pending: 0,
  fetchedAt: Date.now(),
};

const meta: Meta<typeof LiveBalancePanel> = {
  title: 'Manager/LiveBalancePanel',
  component: LiveBalancePanel,
  parameters: { layout: 'padded' },
};

export default meta;
type Story = StoryObj<typeof LiveBalancePanel>;

// State: manager-balance-loading (CLAUDE.md §11)
export const Loading: Story = {
  args: { isLoading: true, isError: false, requiredDays: 3 },
};

// State: loaded with sufficient balance
export const SufficientBalance: Story = {
  args: {
    balance: freshBalance,
    isLoading: false,
    isError: false,
    requiredDays: 3,
  },
};

// State: loaded with INSUFFICIENT balance — approve button blocked
export const InsufficientBalance: Story = {
  args: {
    balance: { ...freshBalance, available: 2 },
    isLoading: false,
    isError: false,
    requiredDays: 5,
  },
};

// State: error loading live balance
export const Error: Story = {
  args: { isLoading: false, isError: true, requiredDays: 3 },
};
