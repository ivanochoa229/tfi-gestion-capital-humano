import { configDefaults, defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

/** Tests contra PostgreSQL real (requiere `docker compose up -d db`). */
export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    root: './',
    include: ['**/*.int.spec.ts'],
    exclude: [...configDefaults.exclude, 'dist/**'],
    setupFiles: ['reflect-metadata'],
    testTimeout: 60_000,
    hookTimeout: 60_000,
    fileParallelism: false,
  },
});
