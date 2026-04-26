import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, userEvent, within } from '@storybook/test';
import { RollbackBanner } from './RollbackBanner';

const meta = {
  title: 'Time-Off/Shared/RollbackBanner',
  component: RollbackBanner,
  parameters: { layout: 'padded' },
  args: { onDismiss: () => {} },
} satisfies Meta<typeof RollbackBanner>;

export default meta;
type Story = StoryObj<typeof meta>;

export const DefaultMessage: Story = {};

export const HCMSilentlyWrong: Story = {
  args: { reason: 'HCM did not record the deduction. Your balance was unchanged.' },
};

export const HCMTimeout: Story = {
  args: { reason: 'Request timed out after 8 seconds. Please try again.' },
};

export const HCMError: Story = {
  args: { reason: 'HCM returned an error. Please contact support if this persists.' },
};

export const DismissInteraction: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole('button', { name: /dismiss/i });
    await userEvent.click(button);
    await expect(button).toBeInTheDocument();
  },
};
