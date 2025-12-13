import { expect, afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import * as matchers from '@testing-library/jest-dom/matchers';

// Extend Vitest's expect with jest-dom matchers
expect.extend(matchers);

// Mock import.meta.env for tests
vi.stubGlobal('import', {
  meta: {
    env: {
      VITE_OPENROUTER_API_KEY: '',
      VITE_GEMINI_API_KEY: '',
      VITE_OPENROUTER_API_ENDPOINT: '',
    },
  },
});

// Cleanup after each test
afterEach(() => {
  cleanup();
});
