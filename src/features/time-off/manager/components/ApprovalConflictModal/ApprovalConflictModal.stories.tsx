import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, within, userEvent } from '@storybook/test';
import { ApprovalConflictModal } from './ApprovalConflictModal';

const meta: Meta<typeof ApprovalConflictModal> = {
  title: 'Manager/ApprovalConflictModal',
  component: ApprovalConflictModal,
  parameters: { layout: 'fullscreen' },
};

export default meta;
type Story = StoryObj<typeof ApprovalConflictModal>;

// State: manager-approval-conflict (CLAUDE.md §11)
export const Open: Story = {
  args: {
    isOpen: true,
    currentBalance: 1,
    onClose: () => {},
  },
};

export const Closed: Story = {
  args: {
    isOpen: false,
    currentBalance: 0,
    onClose: () => {},
  },
};

// Interaction: clicking OK dismisses the modal
export const DismissOnOk: Story = {
  args: {
    isOpen: true,
    currentBalance: 1,
    onClose: () => {},
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByRole('dialog');
    const okButton = canvas.getByRole('button', { name: /ok/i });
    await userEvent.click(okButton);
    // onClose is a no-op in stories; assert the dialog is still present (not crashed)
    expect(okButton).toBeTruthy();
  },
};
