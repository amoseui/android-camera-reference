# acref Phase 1.x: Cleanup Implementation Plan

> **For agentic workers:** Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Address the four Important issues identified in the Phase 1 final code review so the CLI bin runs directly, type safety is restored, dist artifacts are clean, and the extract command doesn't silently drop overload nodes.

**Architecture:** Targeted refactors to existing Phase 1 packages. No new packages or fundamental shape changes. Vitest dev path must remain unbroken (no `pnpm build` required for testing).

**Tech Stack:** Same as Phase 1 (TypeScript, pnpm workspaces, Zod, Vitest).

**Baseline:** `worktree-phase1x-cleanup` branch from main at `43b17f5`. 107 tests passing.

---

## Task 1: Workspace package exports — runtime resolves to dist, dev resolves to src

**Problem:** Every `@acref/*` package has `"main": "./src/index.ts"`, so when compiled `packages/cli/dist/cli.js` imports a workspace dep, Node tries to load `.ts` source and crashes with `ERR_UNKNOWN_FILE_EXTENSION`.

**Fix approach:** Use Node's [conditional exports](https://nodejs.org/api/packages.html#conditional-exports). Set the runtime path to `./dist/index.js` while keeping a `development` (or vitest-friendly) condition that resolves to `./src/index.ts` so tests still work without building.

**Files:**
- Modify: `packages/{schema, extractor-core, extractor-fixture, validators, indexer, data}/package.json`
- Modify: `packages/cli/package.json` (bin still points at `./dist/cli.js`)
- Verify: `pnpm -r build` then `node packages/cli/dist/cli.js --help` exits 0
- Verify: `pnpm test` still passes (vitest must resolve `@acref/schema` etc. to source for fast dev iteration)

**Per-package edit pattern (6 packages):**

Replace:
```json
"main": "./src/index.ts",
"types": "./src/index.ts",
"exports": { ".": "./src/index.ts" }
```

With:
```json
"main": "./dist/index.js",
"types": "./dist/index.d.ts",
"exports": {
  ".": {
    "types": "./dist/index.d.ts",
    "import": "./dist/index.js",
    "default": "./dist/index.js"
  }
}
```

**Vitest dev path:** Vitest must resolve `@acref/X` to source (not dist) so tests run without a build step.

Add `vitest.config.ts` at root (replace current content) with a `resolve.alias` map:

```typescript
import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

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
```

This keeps vitest reading source while letting `node dist/cli.js` use the built `.js`.

**Steps:**

- [ ] **Step 1.1: Edit each of 6 package.jsons** as shown above (schema, extractor-core, extractor-fixture, validators, indexer, data).
- [ ] **Step 1.2: Update root `vitest.config.ts`** with the resolve.alias map.
- [ ] **Step 1.3: `pnpm install`** to refresh the workspace dep links.
- [ ] **Step 1.4: `pnpm test`** — verify 107 still pass.
- [ ] **Step 1.5: `pnpm -r build`** — verify all packages build cleanly.
- [ ] **Step 1.6: `node packages/cli/dist/cli.js --help`** — expect cac help output, exit 0.
- [ ] **Step 1.7: Smoke through the pipeline:**
  ```bash
  rm -rf /tmp/acref-smoke && \
    node packages/cli/dist/cli.js extract --target 35 --out /tmp/acref-smoke/generated && \
    node packages/cli/dist/cli.js validate --in /tmp/acref-smoke/generated --out /tmp/acref-smoke/val --strict && \
    node packages/cli/dist/cli.js build --in /tmp/acref-smoke/generated --out /tmp/acref-smoke/dist --data-version 0.0.1 && \
    ls /tmp/acref-smoke/dist
  ```
  Expected: 5 yaml files in generated/, "Validation: PASS", "Built N files", dist contains index.json + reverse/ + meta.json.
- [ ] **Step 1.8: Commit**:
  ```bash
  git add packages/*/package.json vitest.config.ts
  git commit -m "fix(workspace): runtime resolves @acref/* to dist; vitest aliases to src (Phase 1.x.1)"
  ```

---

## Task 2: Remove `as never` casts (restore real type narrowing)

**Problem:** 3 places use `as never` to silence the type checker over a real shape mismatch. Each one is a latent bug.

**Files:**

### 2a. `packages/data/src/trace.ts`

Current:
```typescript
return resolveVersioned(node.tracesToFramework as never, apiLevel) ?? [];
return resolveVersioned(node.tracesToHal as never, apiLevel) ?? [];
```

Replace by typing the input properly. `node.tracesToFramework` is `unknown` (since nodes are `Record<string, unknown>`). The cleanest fix: change `resolveVersioned`'s signature to accept `unknown`:

`packages/data/src/version.ts` — change signature:

Current:
```typescript
export function resolveVersioned<T>(
  versioned: T | Record<string, T> | undefined,
  apiLevel: number,
): T | undefined {
```

To:
```typescript
export function resolveVersioned<T>(
  versioned: unknown,
  apiLevel: number,
): T | undefined {
```

Then in trace.ts simply:
```typescript
return resolveVersioned<string[]>(node.tracesToFramework, apiLevel) ?? [];
return resolveVersioned<string[]>(node.tracesToHal, apiLevel) ?? [];
```

This keeps generics for caller-side ergonomics but stops lying inside the function.

### 2b. `packages/cli/src/validate-cmd.ts:23` and `packages/cli/src/build-cmd.ts:17, build-cmd.ts:38`

Current:
```typescript
let entries: { name: string; isDirectory: () => boolean; isFile: () => boolean }[] = [];
try {
  entries = (await readdir(dir, { withFileTypes: true })) as never;
} catch { ... }
```

Replace by importing `Dirent` from `node:fs`:

```typescript
import type { Dirent } from 'node:fs';
// ...
let entries: Dirent[] = [];
try {
  entries = await readdir(dir, { withFileTypes: true });
} catch { ... }
```

Do the same at the recursive `walk` function inside build-cmd.ts.

### 2c. `packages/validators/src/runner.ts:40`

Current:
```typescript
const freshness = validateFreshness({
  nodes: input.nodes as Record<string, { provenance: never[] }>,
  currentRefByRepo: input.currentRefByRepo ?? {},
});
```

The cast lies: `validateFreshness` expects `provenance: ProvenanceEntry[]`, the field is also `unknown` from upstream. The cleanest fix: make `validateFreshness` accept `Record<string, Record<string, unknown>>` and narrow internally:

`packages/validators/src/freshness-validator.ts` — change input signature:

```typescript
export interface FreshnessInput {
  nodes: Record<string, Record<string, unknown>>;
  currentRefByRepo: Record<string, string>;
}

export function validateFreshness(input: FreshnessInput): FreshnessResult {
  const warnings: FreshnessWarning[] = [];
  for (const [nodeId, node] of Object.entries(input.nodes)) {
    const provs = node.provenance;
    if (!Array.isArray(provs)) continue;
    for (const prov of provs) {
      if (typeof prov !== 'object' || prov === null) continue;
      const p = prov as { repo?: string; ref?: string };
      if (!p.repo || !p.ref) continue;
      const current = input.currentRefByRepo[p.repo];
      if (current && current !== p.ref) {
        warnings.push({ nodeId, providedRef: p.ref, currentRef: current });
      }
    }
  }
  return { warnings };
}
```

Then runner.ts:
```typescript
const freshness = validateFreshness({
  nodes: input.nodes,
  currentRefByRepo: input.currentRefByRepo ?? {},
});
```

**Steps:**

- [ ] **Step 2.1:** Edit `packages/data/src/version.ts` (signature change).
- [ ] **Step 2.2:** Edit `packages/data/src/trace.ts` — replace 2 `as never` casts with typed calls.
- [ ] **Step 2.3:** Edit `packages/cli/src/validate-cmd.ts` — `Dirent[]` typing.
- [ ] **Step 2.4:** Edit `packages/cli/src/build-cmd.ts` — `Dirent[]` typing in two places (`loadGeneratedByTarget` and inner `walk`).
- [ ] **Step 2.5:** Edit `packages/validators/src/freshness-validator.ts` and `runner.ts` — drop cast, narrow inside validator.
- [ ] **Step 2.6:** `pnpm -r build` — confirm no TS errors.
- [ ] **Step 2.7:** `pnpm test` — confirm 107 still pass.
- [ ] **Step 2.8: Commit**:
  ```bash
  git add packages/data/src/version.ts packages/data/src/trace.ts \
          packages/cli/src/validate-cmd.ts packages/cli/src/build-cmd.ts \
          packages/validators/src/freshness-validator.ts packages/validators/src/runner.ts
  git commit -m "refactor: remove 'as never' casts; restore real type narrowing (Phase 1.x.2)"
  ```

---

## Task 3: tsconfig exclude test files from dist emit

**Problem:** Every package's `tsconfig.json` extends the base with no `exclude`, so `dist/loader.test.js`, `dist/helpers.test.d.ts`, etc. get emitted.

**Fix:** Add `exclude` to `tsconfig.base.json` so all packages inherit it.

**Files:**
- Modify: `tsconfig.base.json`

Add to compilerOptions or at top level:

```json
"exclude": ["**/*.test.ts", "**/test/**", "dist", "node_modules"]
```

Note: `exclude` is a top-level tsconfig field, not under compilerOptions. Add it as a sibling to `compilerOptions`.

**Steps:**

- [ ] **Step 3.1:** Edit `tsconfig.base.json` — add `"exclude"` at top level.
- [ ] **Step 3.2:** `rm -rf packages/*/dist` to clear stale test artifacts.
- [ ] **Step 3.3:** `pnpm -r build` — verify clean rebuild.
- [ ] **Step 3.4:** Confirm `find packages -name '*.test.js' -path '*/dist/*'` returns empty.
- [ ] **Step 3.5:** `pnpm test` — confirm vitest still finds the source-side tests.
- [ ] **Step 3.6: Commit**:
  ```bash
  git add tsconfig.base.json
  git commit -m "fix(build): exclude test files from dist emit (Phase 1.x.3)"
  ```

---

## Task 4: extract-cmd filename collision resilience

**Problem:** `extract-cmd.ts:20` does `id.replace(/[/:()$]/g, '_')`. Different overloads can collapse to the same filename (`takePicture(int)` and `takePicture(long)` both → `takePicture_int_` is unique by accident, but `takePicture()` and `takePicture(Foo)` → both contain `takePicture_`...). With real extractors emitting overloads, the build will silently lose nodes.

**Fix:** Append a short hash of the full ID to the filename to disambiguate.

**Files:**
- Modify: `packages/cli/src/extract-cmd.ts`

Replace the safeName line:

Current:
```typescript
const safeName = id.replace(/[\/:()$]/g, '_');
await writeYaml(join(outDir, `${safeName}.yaml`), node);
```

With:
```typescript
import { createHash } from 'node:crypto';
// ...
const safeName = id.replace(/[\/:()$]/g, '_').slice(0, 80);
const hash = createHash('sha1').update(id).digest('hex').slice(0, 8);
await writeYaml(join(outDir, `${safeName}_${hash}.yaml`), node);
```

The hash uses the full id, guaranteeing uniqueness across overloads. Filename is truncated to keep paths short on case-sensitive filesystems with max path lengths.

**Test the collision case** — add to `packages/cli/src/cli.test.ts` or a new file:

`packages/cli/src/extract-cmd.test.ts`:
```typescript
import { describe, expect, it } from 'vitest';
import { mkdtemp, rm, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { writeYaml } from '@acref/extractor-core';
import { extractCommand } from './extract-cmd.js';

describe('extract-cmd', () => {
  it('unit: writes one file per node id (no overload collisions)', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'acref-extract-test-'));
    try {
      // Use real fixture extractor (5 nodes, all distinct ids)
      const r = await extractCommand({ target: 35, out: dir });
      expect(r.nodeCount).toBe(5);
      const files = await readdir(r.outDir);
      expect(files.length).toBe(5);
      // All filenames must be unique
      expect(new Set(files).size).toBe(5);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
```

**Steps:**

- [ ] **Step 4.1:** Edit `packages/cli/src/extract-cmd.ts` — add hash suffix.
- [ ] **Step 4.2:** Create `packages/cli/src/extract-cmd.test.ts` with the uniqueness test.
- [ ] **Step 4.3:** `pnpm -F @acref/cli test extract-cmd` — verify pass.
- [ ] **Step 4.4:** `pnpm test` — full suite still 107+1 = 108 pass.
- [ ] **Step 4.5: Commit**:
  ```bash
  git add packages/cli/src/extract-cmd.ts packages/cli/src/extract-cmd.test.ts
  git commit -m "fix(cli): hash-suffix extract filenames to prevent overload collisions (Phase 1.x.4)"
  ```

---

## Phase 1.x 종료 체크리스트

- [ ] All 4 tasks committed (4 commits total)
- [ ] `pnpm test` → 108 pass (107 existing + 1 new)
- [ ] `pnpm -r build` clean
- [ ] `node packages/cli/dist/cli.js --help` works (exit 0, prints help)
- [ ] Full pipeline smoke runs via `node dist/cli.js` (extract → validate → build all return 0)
- [ ] `find packages -name '*.test.js' -path '*/dist/*'` is empty
- [ ] No `as never` remaining in src (grep check)
- [ ] All filenames in `generated/35/` unique

---

## Phase 1 Final Checklist Re-verification

After Phase 1.x, item #3 from Phase 1's checklist ("node packages/cli/dist/cli.js extract && validate && build end-to-end 동작") should be PASS — meaning the Phase 1 checklist is 7/7.
