import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { LoadingSkeleton } from './LoadingSkeleton';

const meta = {
  title: 'Time-Off/Shared/LoadingSkeleton',
  component: LoadingSkeleton,
  parameters: { layout: 'padded' },
} satisfies Meta<typeof LoadingSkeleton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const SingleRow: Story = { args: { rows: 1 } };

export const ManyRows: Story = { args: { rows: 6 } };
