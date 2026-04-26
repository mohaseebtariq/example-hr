import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, within } from '@storybook/test';
import { BalanceRefreshedToast } from './BalanceRefreshedToast';

const meta = {
  title: 'Time-Off/Shared/BalanceRefreshedToast',
  component: BalanceRefreshedToast,
  parameters: { layout: 'padded' },
  args: { onDismiss: () => {} },
} satisfies Meta<typeof BalanceRefreshedToast>;

export default meta;
type Story = StoryObj<typeof meta>;

// §11 state: balance-refreshed-up (anniversary bonus)
export const BalanceUp: Story = {
  args: {
    type: 'balance-refreshed-up',
    locationName: 'Annual Leave',
    newAvailable: 20,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/Annual Leave balance was updated to 20 days/)).toBeInTheDocument();
  },
};

// §11 state: balance-refreshed-down (external reduction)
export const BalanceDown: Story = {
  args: {
    type: 'balance-refreshed-down',
    locationName: 'Annual Leave',
    newAvailable: 8,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/Annual Leave balance was reduced to 8 days/)).toBeInTheDocument();
    await expect(canvas.getByText(/external update/)).toBeInTheDocument();
  },
};
