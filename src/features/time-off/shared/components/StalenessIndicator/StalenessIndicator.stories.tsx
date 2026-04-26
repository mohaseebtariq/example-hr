import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { StalenessIndicator } from './StalenessIndicator';

const meta = {
  title: 'Time-Off/Shared/StalenessIndicator',
  component: StalenessIndicator,
  parameters: { layout: 'centered' },
} satisfies Meta<typeof StalenessIndicator>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Fresh: Story = {
  name: 'Fresh (hidden)',
  args: { fetchedAt: Date.now() },
};

export const Stale: Story = {
  args: {
    fetchedAt: Date.now() - 120_000, // 2 minutes ago
  },
};

export const StaleWithRefresh: Story = {
  args: {
    fetchedAt: Date.now() - 300_000, // 5 minutes ago
    onRefresh: () => alert('Refresh triggered'),
  },
};
