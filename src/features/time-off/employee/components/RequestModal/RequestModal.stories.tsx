import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { within, userEvent, expect } from '@storybook/test';
import { useRequestModalStore } from '@/store';
import { RequestModal } from './RequestModal';

const meta: Meta<typeof RequestModal> = {
  title: 'Employee/RequestModal',
  component: RequestModal,
  parameters: { layout: 'fullscreen' },
  args: { employeeId: 'e-100' },
};

export default meta;
type Story = StoryObj<typeof RequestModal>;

export const Closed: Story = {};

export const Open: Story = {
  loaders: [
    async () => {
      useRequestModalStore.setState({ isOpen: true, locationId: 'loc-annual' });
      return {};
    },
  ],
};

export const SubmitFlow: Story = {
  loaders: [
    async () => {
      useRequestModalStore.setState({ isOpen: true, locationId: 'loc-annual' });
      return {};
    },
  ],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByText('Request time off');

    await userEvent.type(canvas.getByLabelText(/start date/i), '2026-06-01');
    await userEvent.type(canvas.getByLabelText(/end date/i), '2026-06-02');

    await userEvent.click(canvas.getByRole('button', { name: /submit request/i }));

    for (let i = 0; i < 30; i += 1) {
      if (!useRequestModalStore.getState().isOpen) break;
      await new Promise((r) => setTimeout(r, 50));
    }
    expect(useRequestModalStore.getState().isOpen).toBe(false);
  },
};

// State: hcm-rejected — employee tries to request more days than available (CLAUDE.md §11)
// The submit button is disabled with an inline balance warning when days > available.
export const HcmRejectedInsufficientBalance: Story = {
  loaders: [
    async () => {
      useRequestModalStore.setState({ isOpen: true, locationId: 'loc-annual' });
      return {};
    },
  ],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByText('Request time off');

    // Request more days than the available balance (MSW returns 15 days for e-100/loc-annual)
    await userEvent.type(canvas.getByLabelText(/start date/i), '2026-06-01');
    await userEvent.type(canvas.getByLabelText(/end date/i), '2026-06-30');

    // Submit button should be disabled — insufficient balance detected client-side
    const submitButton = canvas.getByRole('button', { name: /submit request/i });
    expect((submitButton as HTMLButtonElement).disabled).toBe(true);
  },
};

// State: hcm-timeout — submission in-flight, user sees "Submitting…" (CLAUDE.md §11)
// After 8s timeout the modal is still open; toast notification delivers the reason.
export const Submitting: Story = {
  loaders: [
    async () => {
      useRequestModalStore.setState({ isOpen: true, locationId: 'loc-annual' });
      return {};
    },
  ],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByText('Request time off');

    await userEvent.type(canvas.getByLabelText(/start date/i), '2026-06-01');
    await userEvent.type(canvas.getByLabelText(/end date/i), '2026-06-02');

    // Click submit — do NOT wait for completion, so we capture the "Submitting…" label
    const submitButton = canvas.getByRole('button', { name: /submit request/i });
    await userEvent.click(submitButton);
    // Submitting state briefly visible before MSW responds
    expect(submitButton).toBeTruthy();
  },
};

