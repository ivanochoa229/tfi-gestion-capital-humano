import { configDefaults, defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  // Resolves the path aliases declared in tsconfig.json, including the ones
  // added by `nest g library`.
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    root: './',
    include: ['**/*.spec.ts'],
    // Los de integración corren aparte: `npm run test:integracion`.
    exclude: [...configDefaults.exclude, '**/*.int.spec.ts'],
    setupFiles: ['reflect-metadata'],
  },
});
