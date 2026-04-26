import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';
import { playwright } from '@vitest/browser-playwright';

const dirname =
  typeof __dirname !== 'undefined' ? __dirname : path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    projects: [
      // Unit and hook tests — jsdom, co-located with source
      {
        plugins: [react()],
        test: {
          name: 'unit',
          environment: 'jsdom',
          globals: true,
          setupFiles: ['./src/test-setup.ts'],
          include: [
            'src/**/*.test.ts',
            'src/**/*.test.tsx',
          ],
          exclude: ['src/**/*.stories.*'],
        },
        resolve: {
          alias: { '@': path.resolve(dirname, './src') },
        },
      },
      // Integration tests — node environment by default; individual files may override
      // to jsdom (e.g. component-rendering tests). testTimeout is raised because
      // jsdom tests compete with the Chromium pool under full-suite runs.
      {
        plugins: [react()],
        test: {
          name: 'integration',
          environment: 'node',
          globals: true,
          testTimeout: 15_000,
          include: ['tests/integration/**/*.test.ts'],
          setupFiles: ['./src/test-setup.ts'],
        },
        resolve: {
          alias: { '@': path.resolve(dirname, './src') },
        },
      },
      // Storybook interaction tests — browser/playwright
      {
        extends: true,
        plugins: [
          storybookTest({ configDir: path.join(dirname, '.storybook') }),
        ],
        test: {
          name: 'storybook',
          browser: {
            enabled: true,
            headless: true,
            provider: playwright({}),
            instances: [{ browser: 'chromium' }],
          },
        },
      },
    ],
  },
});
