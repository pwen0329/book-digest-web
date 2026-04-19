import path from 'node:path';
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const rootDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup-vitest.ts'],
    include: ['tests/**/*.test.ts?(x)'],
    restoreMocks: true,
    clearMocks: true,
  },
  plugins: [react()], // This handles the JSX automatically!
  resolve: {
    alias: {
      '@': path.resolve(rootDir, '.'),
      'server-only': path.resolve(rootDir, 'tests/mocks/server-only.ts'),
    },
  },
});