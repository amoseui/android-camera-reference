import { defineWorkspace } from 'vitest/config';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = (sub: string) => resolve(__dirname, sub);

const aliases = {
  '@acref/schema': root('packages/schema/src/index.ts'),
  '@acref/extractor-core': root('packages/extractor-core/src/index.ts'),
  '@acref/extractor-fixture': root('packages/extractor-fixture/src/index.ts'),
  '@acref/validators': root('packages/validators/src/index.ts'),
  '@acref/indexer': root('packages/indexer/src/index.ts'),
  '@acref/data': root('packages/data/src/index.ts'),
};

const projects = [
  '@acref/schema',
  '@acref/extractor-core',
  '@acref/extractor-fixture',
  '@acref/validators',
  '@acref/indexer',
  '@acref/data',
  '@acref/cli',
];

export default defineWorkspace(
  projects.map((name) => ({
    test: {
      name,
      root: root(`packages/${name.replace('@acref/', '')}`),
    },
    resolve: { alias: aliases },
  })),
);
