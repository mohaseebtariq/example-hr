import type { Preview } from '@storybook/nextjs-vite';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import '../src/app/globals.css';
import { resetMswStore } from '../src/mocks/msw-store';
import { worker } from '../src/mocks/browser';

// Reset QueryClient between stories so cache never bleeds across stories
const withFreshQueryClient = (Story: React.ComponentType) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
  return (
    <QueryClientProvider client={queryClient}>
      <Story />
    </QueryClientProvider>
  );
};

if (typeof window !== 'undefined') {
  worker.start({ onUnhandledRequest: 'bypass' });
}

const preview: Preview = {
  decorators: [withFreshQueryClient],
  loaders: [
    async () => {
      resetMswStore();
      return {};
    },
  ],
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    a11y: {
      test: 'todo',
    },
  },
};

export default preview;
