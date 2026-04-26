import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { StatusBadge } from './StatusBadge';

const meta = {
  title: 'Time-Off/Shared/StatusBadge',
  component: StatusBadge,
  parameters: { layout: 'centered' },
} satisfies Meta<typeof StatusBadge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Draft: Story = { args: { status: 'draft' } };
export const PendingHCM: Story = { args: { status: 'pending-hcm' } };
export const PendingManager: Story = { args: { status: 'pending-manager' } };
export const Approved: Story = { args: { status: 'approved' } };
export const Denied: Story = { args: { status: 'denied' } };
export const RolledBack: Story = { args: { status: 'rolled-back' } };
