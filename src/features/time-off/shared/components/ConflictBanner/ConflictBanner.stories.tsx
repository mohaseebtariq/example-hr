import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { ConflictBanner } from './ConflictBanner';

const meta = {
  title: 'Time-Off/Shared/ConflictBanner',
  component: ConflictBanner,
  parameters: { layout: 'padded' },
} satisfies Meta<typeof ConflictBanner>;

export default meta;
type Story = StoryObj<typeof meta>;

export const BalanceChangedExternally: Story = {
  args: {
    message: 'Your Annual Leave balance was reduced to 8 days by an external update.',
    onDismiss: () => {},
  },
};

export const ApprovalConflict: Story = {
  args: {
    message: 'Balance changed since this request was submitted — current balance is 1 day.',
    onDismiss: () => {},
  },
};

export const WithoutDismiss: Story = {
  args: {
    message: 'Your balance was updated externally.',
  },
};
