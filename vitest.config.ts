import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = (sub: string) => resolve(__dirname, sub);

export default defineConfig({
  test: {
    coverage: { provider: 'v8', reporter: ['text', 'json', 'html'] },
  },
  resolve: {
    alias: {
      '@acref/schema': root('packages/schema/src/index.ts'),
      '@acref/extractor-core': root('packages/extractor-core/src/index.ts'),
      '@acref/extractor-fixture': root('packages/extractor-fixture/src/index.ts'),
      '@acref/validators': root('packages/validators/src/index.ts'),
      '@acref/indexer': root('packages/indexer/src/index.ts'),
      '@acref/data': root('packages/data/src/index.ts'),
    },
  },
});
