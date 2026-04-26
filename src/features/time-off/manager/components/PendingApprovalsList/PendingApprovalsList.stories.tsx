import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { PendingApprovalsList } from './PendingApprovalsList';

const meta: Meta<typeof PendingApprovalsList> = {
  title: 'Manager/PendingApprovalsList',
  component: PendingApprovalsList,
  parameters: { layout: 'padded' },
  args: { managerId: 'm-100' },
};

export default meta;
type Story = StoryObj<typeof PendingApprovalsList>;

export const Default: Story = {};

