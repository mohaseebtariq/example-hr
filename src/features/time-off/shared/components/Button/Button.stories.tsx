import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Button } from './Button';

const meta: Meta<typeof Button> = {
  title: 'shared/Button',
  component: Button,
};

export default meta;
type Story = StoryObj<typeof Button>;

export const Primary: Story = {
  args: { variant: 'primary', children: 'Primary button' },
};

export const Secondary: Story = {
  args: { variant: 'secondary', children: 'Secondary button' },
};

export const Disabled: Story = {
  args: { variant: 'primary', children: 'Disabled', disabled: true },
};

export const Loading: Story = {
  args: { variant: 'primary', children: 'Approve', isLoading: true },
};

