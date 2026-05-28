# acref Phase 1: Pipeline Skeleton Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** v0.0.1 — 모든 monorepo 패키지 골격을 세우고, 합성 fixture extractor 1개로 end-to-end 파이프라인(extract → validate → build → `@acref/data` import)이 동작함을 증명한다. 진짜 AOSP 파싱은 이후 phase.

**Architecture:** pnpm monorepo (7 패키지). Zod 기반 schema가 모든 패키지의 의존성 root. extractor-core가 머지/버전/ID/provenance 알고리즘을 담당. fixture extractor가 실 추출기 자리를 대신해 3종 node kind와 1종 trace edge를 emit. validators 4종 + indexer + data API + cli orchestrator가 spec과 동일 인터페이스로 구현됨. Phase 2+ 에서 fixture extractor가 실 extractor-aosp/javadoc/docs로 교체됨.

**Tech Stack:** TypeScript 5.x, pnpm 9.x (via corepack), Vitest 1.x, fast-check 3.x, Zod 3.x, ESLint 8.x, prettier 3.x, yaml (npm), cac (CLI parser), minisearch (검색).

**Phase 1 비-범위:**
- 실 AOSP 소스 파싱 (Java/C++/AIDL/HIDL) → Phase 2
- 실 트레이스 조이너 (스텁만 둠) → Phase 2
- javadoc/docs 추출기 → Phase 3
- AOSP sparse checkout → Phase 2
- npm publish CI / GitHub Releases → Phase 4
- extract.yml / poll.yml 워크플로우 → Phase 4

**Spec 참조:** `docs/superpowers/specs/2026-05-28-android-camera-reference-design.md`

---

## File Structure (Phase 1 종료 시점)

```
acr/
├── package.json                          # workspace root
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── vitest.workspace.ts
├── .eslintrc.cjs
├── .prettierrc
├── .gitignore                            # generated/, dist/, node_modules/, .cache/ 등
├── .tool-versions                        # nodejs 20.9.0 (이미 있음)
├── .github/workflows/
│   └── ci.yml                            # lint + test (Phase 4에서 extract.yml/poll.yml 추가)
├── docs/                                 # spec + plan (이미 있음)
└── packages/
    ├── schema/                           # @acref/schema
    │   ├── package.json, tsconfig.json, vitest.config.ts
    │   └── src/
    │       ├── index.ts                  # public exports
    │       ├── primitives.ts             # ApiLevel, Family, SourceId
    │       ├── version-range.ts          # VersionRangeKey + parser
    │       ├── versioned.ts              # Versioned<T> combinator
    │       ├── provenance.ts             # ProvenanceEntry
    │       ├── id.ts                     # ID compose / parse / short ID
    │       └── nodes/
    │           ├── base.ts               # NodeBase
    │           ├── api-class.ts          # ApiClassNode
    │           ├── api-method.ts         # ApiMethodNode
    │           ├── framework-symbol.ts   # FrameworkSymbolNode
    │           ├── hal-symbol.ts         # HalSymbolNode
    │           └── permission.ts         # PermissionNode
    ├── extractor-core/                   # @acref/extractor-core
    │   └── src/
    │       ├── index.ts
    │       ├── source-priority.ts        # GLOBAL_PRIORITY 상수
    │       ├── affinity.ts               # FIELD_AFFINITY 상수
    │       ├── merger.ts                 # 노드 머지 알고리즘
    │       ├── version-merger.ts         # cross-target 버전 키 자동 압축
    │       ├── trace-joiner.ts           # Phase 1: 인터페이스 + identity 스텁
    │       ├── provenance-helpers.ts     # ISO timestamp, ProvenanceEntry 생성
    │       └── yaml-io.ts                # YAML 직렬화/역직렬화
    ├── extractor-fixture/                # @acref/extractor-fixture (Phase 1 전용)
    │   └── src/
    │       └── index.ts                  # 합성 노드 3-5개 emit
    ├── validators/                       # @acref/validators
    │   └── src/
    │       ├── index.ts
    │       ├── schema-validator.ts
    │       ├── xref-validator.ts
    │       ├── coverage-validator.ts     # Phase 1: 입력 expected list 없으면 empty pass
    │       ├── freshness-validator.ts    # Phase 1: stub (warn 0개)
    │       └── runner.ts                 # 전체 실행 + summary.json + 산출물
    ├── indexer/                          # @acref/indexer
    │   └── src/
    │       ├── index.ts
    │       ├── consolidate.ts            # per-target generated → 단일 노드 (cross-target 버전 키 머지)
    │       ├── reverse-index.ts          # byHal, byFrameworkSymbol, byTag, byPermission
    │       └── build.ts                  # dist/{index,reverse/*,meta}.json emit
    ├── data/                             # @acref/data
    │   └── src/
    │       ├── index.ts                  # public exports
    │       ├── loader.ts                 # dist/*.json eager load
    │       ├── lookup.ts                 # getNode, getNodes, findByShortId, findBySimpleName
    │       ├── version.ts                # resolveVersioned
    │       ├── trace.ts                  # tracesToFrameworkOf, tracesToHalOf, reverseTraceFromHal
    │       ├── migration.ts              # migrationsOf
    │       └── search.ts                 # search (minisearch)
    └── cli/                              # @acref/cli (bin: acref)
        ├── package.json                  # "bin": { "acref": "./dist/cli.js" }
        └── src/
            ├── cli.ts                    # entry + cac command 라우팅
            ├── extract-cmd.ts            # acref extract
            ├── validate-cmd.ts           # acref validate
            └── build-cmd.ts              # acref build
```

각 패키지 디렉토리에 동일 패턴: `package.json`, `tsconfig.json`, `vitest.config.ts`, `src/`, `test/` (또는 `*.test.ts` 인-소스).

테스트 파일 위치 규약: 각 소스 파일 옆에 `*.test.ts` 동일 디렉토리. fixture는 `test/fixtures/`.

---

## Phase 1에서 *결정*하는 spec §8 미해결 질문

- **#4 HAL version 표기**: ID에서 `_v3.4` 형식 (밑줄+v+점). 이유: URL-safe, FS-safe, 정렬 가능. 코드: `hal/ICameraDeviceSession::processCaptureRequest_v3.4`.

나머지 #1, #2, #3, #5, #6 는 Phase 2+에서.

---

## Task Group 1 — Monorepo Skeleton

### Task 1.1: pnpm workspace 초기화

**Files:**
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `tsconfig.base.json`
- Create: `.gitignore`
- Modify: `.tool-versions` (pnpm 라인 추가)

- [ ] **Step 1.1.1: corepack로 pnpm 활성화 확인**

```bash
corepack enable
corepack prepare pnpm@9.12.0 --activate
pnpm --version
```

Expected: `9.12.0` 출력.

- [ ] **Step 1.1.2: `package.json` 작성**

```json
{
  "name": "acref-monorepo",
  "version": "0.0.1",
  "private": true,
  "packageManager": "pnpm@9.12.0",
  "engines": { "node": ">=20.9.0", "pnpm": ">=9.0.0" },
  "scripts": {
    "build": "pnpm -r build",
    "lint": "eslint .",
    "test": "vitest run",
    "test:unit": "vitest run -t unit",
    "test:integration": "vitest run -t integration",
    "test:golden": "vitest run -t golden",
    "test:property": "vitest run -t property",
    "format": "prettier --write ."
  },
  "devDependencies": {
    "typescript": "^5.4.0",
    "vitest": "^1.6.0",
    "fast-check": "^3.19.0",
    "@vitest/coverage-v8": "^1.6.0",
    "eslint": "^8.57.0",
    "@typescript-eslint/eslint-plugin": "^7.8.0",
    "@typescript-eslint/parser": "^7.8.0",
    "prettier": "^3.2.5"
  }
}
```

- [ ] **Step 1.1.3: `pnpm-workspace.yaml` 작성**

```yaml
packages:
  - "packages/*"
```

- [ ] **Step 1.1.4: `tsconfig.base.json` 작성**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2022"],
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "verbatimModuleSyntax": false
  }
}
```

- [ ] **Step 1.1.5: `.gitignore` 작성**

```
node_modules/
dist/
generated/
.cache/
*.tsbuildinfo
.DS_Store
coverage/
```

- [ ] **Step 1.1.6: `.tool-versions` 수정**

기존:
```
nodejs 20.9.0
```

변경:
```
nodejs 20.9.0
pnpm 9.12.0
```

- [ ] **Step 1.1.7: 의존성 설치**

```bash
pnpm install
```

Expected: `node_modules/` 생성, lockfile 생성.

- [ ] **Step 1.1.8: Commit**

```bash
git add package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json .gitignore .tool-versions
git commit -m "chore: pnpm workspace skeleton (Phase 1.1)"
```

### Task 1.2: ESLint + Prettier 설정

**Files:**
- Create: `.eslintrc.cjs`
- Create: `.prettierrc`
- Create: `.eslintignore`

- [ ] **Step 1.2.1: `.eslintrc.cjs` 작성**

```javascript
module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
  ],
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
  },
  rules: {
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    '@typescript-eslint/consistent-type-imports': 'error',
  },
};
```

- [ ] **Step 1.2.2: `.prettierrc` 작성**

```json
{
  "semi": true,
  "singleQuote": true,
  "trailingComma": "all",
  "printWidth": 100,
  "arrowParens": "always"
}
```

- [ ] **Step 1.2.3: `.eslintignore` 작성**

```
dist/
generated/
.cache/
node_modules/
*.config.ts
*.config.cjs
```

- [ ] **Step 1.2.4: lint 실행 확인**

```bash
pnpm lint
```

Expected: 통과 (현재 lint 대상 파일이 없으니 "0 errors").

- [ ] **Step 1.2.5: Commit**

```bash
git add .eslintrc.cjs .prettierrc .eslintignore
git commit -m "chore: eslint + prettier config (Phase 1.2)"
```

### Task 1.3: Vitest workspace 설정

**Files:**
- Create: `vitest.workspace.ts`
- Create: `vitest.config.ts`

- [ ] **Step 1.3.1: `vitest.config.ts` 루트 작성**

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['packages/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
    },
  },
});
```

- [ ] **Step 1.3.2: `vitest.workspace.ts` 작성**

```typescript
export default ['packages/*'];
```

- [ ] **Step 1.3.3: 실행 가능 확인**

```bash
pnpm test
```

Expected: "No tests found" 또는 빈 통과 (아직 테스트 없음). 에러 없어야 함.

- [ ] **Step 1.3.4: Commit**

```bash
git add vitest.workspace.ts vitest.config.ts
git commit -m "chore: vitest workspace config (Phase 1.3)"
```

---

## Task Group 2 — @acref/schema

### Task 2.1: 패키지 골격

**Files:**
- Create: `packages/schema/package.json`
- Create: `packages/schema/tsconfig.json`
- Create: `packages/schema/src/index.ts`
- Create: `packages/schema/src/index.test.ts`

- [ ] **Step 2.1.1: `packages/schema/package.json` 작성**

```json
{
  "name": "@acref/schema",
  "version": "0.0.1",
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": { ".": "./src/index.ts" },
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "test": "vitest run"
  },
  "dependencies": {
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "typescript": "^5.4.0",
    "vitest": "^1.6.0",
    "fast-check": "^3.19.0"
  }
}
```

- [ ] **Step 2.1.2: `packages/schema/tsconfig.json` 작성**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"]
}
```

- [ ] **Step 2.1.3: `src/index.ts` 임시 export**

```typescript
export const SCHEMA_VERSION = '0.0.1';
```

- [ ] **Step 2.1.4: `src/index.test.ts` 임시 테스트**

```typescript
import { describe, expect, it } from 'vitest';
import { SCHEMA_VERSION } from './index.js';

describe('schema package smoke', () => {
  it('unit: exports SCHEMA_VERSION constant', () => {
    expect(SCHEMA_VERSION).toBe('0.0.1');
  });
});
```

- [ ] **Step 2.1.5: 설치 + 테스트 실행**

```bash
pnpm install
pnpm -F @acref/schema test
```

Expected: 1 passed.

- [ ] **Step 2.1.6: Commit**

```bash
git add packages/schema
git commit -m "feat(schema): package skeleton (Phase 2.1)"
```

### Task 2.2: Primitives — ApiLevel, Family, SourceId

**Files:**
- Create: `packages/schema/src/primitives.ts`
- Create: `packages/schema/src/primitives.test.ts`

- [ ] **Step 2.2.1: failing test 작성 `primitives.test.ts`**

```typescript
import { describe, expect, it } from 'vitest';
import { ApiLevel, Family, SourceId } from './primitives.js';

describe('primitives', () => {
  describe('unit: ApiLevel', () => {
    it('accepts 21', () => expect(ApiLevel.parse(21)).toBe(21));
    it('rejects 0', () => expect(() => ApiLevel.parse(0)).toThrow());
    it('rejects non-integer', () => expect(() => ApiLevel.parse(21.5)).toThrow());
    it('rejects 100', () => expect(() => ApiLevel.parse(100)).toThrow());
  });

  describe('unit: Family', () => {
    it('accepts cameraX', () => expect(Family.parse('cameraX')).toBe('cameraX'));
    it('accepts camera1', () => expect(Family.parse('camera1')).toBe('camera1'));
    it('accepts camera2', () => expect(Family.parse('camera2')).toBe('camera2'));
    it('rejects camera3', () => expect(() => Family.parse('camera3')).toThrow());
  });

  describe('unit: SourceId', () => {
    it('accepts all 5 sources', () => {
      ['aosp-code', 'aidl', 'javadoc-html', 'developer-docs', 'behavior-changes'].forEach((s) =>
        expect(SourceId.parse(s)).toBe(s),
      );
    });
    it('rejects unknown', () => expect(() => SourceId.parse('reddit')).toThrow());
  });
});
```

- [ ] **Step 2.2.2: 실행 확인 — fail expected**

```bash
pnpm -F @acref/schema test
```

Expected: "Cannot find module './primitives.js'" 에러.

- [ ] **Step 2.2.3: 구현 `primitives.ts`**

```typescript
import { z } from 'zod';

export const ApiLevel = z.number().int().min(1).max(99);
export type ApiLevel = z.infer<typeof ApiLevel>;

export const Family = z.enum(['camera1', 'camera2', 'cameraX']);
export type Family = z.infer<typeof Family>;

export const SourceId = z.enum([
  'aosp-code',
  'aidl',
  'javadoc-html',
  'developer-docs',
  'behavior-changes',
]);
export type SourceId = z.infer<typeof SourceId>;
```

- [ ] **Step 2.2.4: 테스트 재실행 — pass expected**

```bash
pnpm -F @acref/schema test
```

Expected: 9 passed.

- [ ] **Step 2.2.5: Commit**

```bash
git add packages/schema/src/primitives.ts packages/schema/src/primitives.test.ts
git commit -m "feat(schema): ApiLevel, Family, SourceId primitives (Phase 2.2)"
```

### Task 2.3: VersionRangeKey 문법 + 파서 + property test

**Files:**
- Create: `packages/schema/src/version-range.ts`
- Create: `packages/schema/src/version-range.test.ts`

- [ ] **Step 2.3.1: failing test 작성**

```typescript
import { describe, expect, it } from 'vitest';
import * as fc from 'fast-check';
import {
  VersionRangeKey,
  parseVersionRange,
  rangeContains,
  rangesOverlap,
} from './version-range.js';

describe('version-range', () => {
  describe('unit: VersionRangeKey regex', () => {
    it('accepts exact level "21"', () => expect(VersionRangeKey.parse('21')).toBe('21'));
    it('accepts closed range "21..28"', () =>
      expect(VersionRangeKey.parse('21..28')).toBe('21..28'));
    it('accepts open-upper "29.."', () => expect(VersionRangeKey.parse('29..')).toBe('29..'));
    it('accepts open-lower "..28"', () => expect(VersionRangeKey.parse('..28')).toBe('..28'));
    it('accepts wildcard ".."', () => expect(VersionRangeKey.parse('..')).toBe('..'));
    it('rejects invalid "abc"', () => expect(() => VersionRangeKey.parse('abc')).toThrow());
    it('rejects "21..28..30"', () => expect(() => VersionRangeKey.parse('21..28..30')).toThrow());
  });

  describe('unit: parseVersionRange', () => {
    it('parses "21..28" to {low:21, high:28}', () =>
      expect(parseVersionRange('21..28')).toEqual({ low: 21, high: 28 }));
    it('parses "29.." to {low:29}', () =>
      expect(parseVersionRange('29..')).toEqual({ low: 29 }));
    it('parses "..28" to {high:28}', () =>
      expect(parseVersionRange('..28')).toEqual({ high: 28 }));
    it('parses ".." to {}', () => expect(parseVersionRange('..')).toEqual({}));
    it('parses "21" to {low:21,high:21}', () =>
      expect(parseVersionRange('21')).toEqual({ low: 21, high: 21 }));
  });

  describe('unit: rangeContains', () => {
    it('"21..28" contains 25', () => expect(rangeContains('21..28', 25)).toBe(true));
    it('"21..28" contains 21', () => expect(rangeContains('21..28', 21)).toBe(true));
    it('"21..28" contains 28', () => expect(rangeContains('21..28', 28)).toBe(true));
    it('"21..28" does not contain 29', () => expect(rangeContains('21..28', 29)).toBe(false));
    it('"29.." contains 100', () => expect(rangeContains('29..', 100)).toBe(true));
    it('".." contains anything', () => expect(rangeContains('..', 50)).toBe(true));
  });

  describe('unit: rangesOverlap', () => {
    it('"21..28" overlaps "27..30"', () => expect(rangesOverlap('21..28', '27..30')).toBe(true));
    it('"21..28" does not overlap "29..30"', () =>
      expect(rangesOverlap('21..28', '29..30')).toBe(false));
    it('".." overlaps everything', () => expect(rangesOverlap('..', '21..28')).toBe(true));
    it('"29.." overlaps "30..40"', () => expect(rangesOverlap('29..', '30..40')).toBe(true));
  });

  describe('property: parse → format round-trips', () => {
    it('exact level round-trips', () => {
      fc.assert(
        fc.property(fc.integer({ min: 1, max: 99 }), (n) => {
          const key = String(n);
          const parsed = parseVersionRange(key);
          expect(parsed.low).toBe(n);
          expect(parsed.high).toBe(n);
        }),
      );
    });

    it('closed range round-trips when low <= high', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 50 }),
          fc.integer({ min: 50, max: 99 }),
          (low, high) => {
            const key = `${low}..${high}`;
            const parsed = parseVersionRange(key);
            expect(parsed.low).toBe(low);
            expect(parsed.high).toBe(high);
          },
        ),
      );
    });
  });
});
```

- [ ] **Step 2.3.2: 실행 fail 확인**

```bash
pnpm -F @acref/schema test version-range
```

Expected: import 에러.

- [ ] **Step 2.3.3: 구현 `version-range.ts`**

```typescript
import { z } from 'zod';

export const VersionRangeKey = z
  .string()
  .regex(/^(\d+(\.\.\d+)?|\d+\.\.|\.\.\d+|\.\.)$/);
export type VersionRangeKey = z.infer<typeof VersionRangeKey>;

export interface ParsedRange {
  low?: number;
  high?: number;
}

export function parseVersionRange(key: string): ParsedRange {
  if (key === '..') return {};
  if (key.startsWith('..')) return { high: Number(key.slice(2)) };
  if (key.endsWith('..')) return { low: Number(key.slice(0, -2)) };
  if (key.includes('..')) {
    const [lo, hi] = key.split('..');
    return { low: Number(lo), high: Number(hi) };
  }
  const n = Number(key);
  return { low: n, high: n };
}

export function rangeContains(key: string, level: number): boolean {
  const { low, high } = parseVersionRange(key);
  if (low !== undefined && level < low) return false;
  if (high !== undefined && level > high) return false;
  return true;
}

export function rangesOverlap(a: string, b: string): boolean {
  const ra = parseVersionRange(a);
  const rb = parseVersionRange(b);
  const aLow = ra.low ?? -Infinity;
  const aHigh = ra.high ?? Infinity;
  const bLow = rb.low ?? -Infinity;
  const bHigh = rb.high ?? Infinity;
  return aLow <= bHigh && bLow <= aHigh;
}
```

- [ ] **Step 2.3.4: 테스트 재실행 — pass expected**

```bash
pnpm -F @acref/schema test version-range
```

Expected: 모든 테스트 통과.

- [ ] **Step 2.3.5: Commit**

```bash
git add packages/schema/src/version-range.ts packages/schema/src/version-range.test.ts
git commit -m "feat(schema): VersionRangeKey + parser + property tests (Phase 2.3)"
```

### Task 2.4: Versioned<T> combinator + ProvenanceEntry

**Files:**
- Create: `packages/schema/src/versioned.ts`
- Create: `packages/schema/src/versioned.test.ts`
- Create: `packages/schema/src/provenance.ts`
- Create: `packages/schema/src/provenance.test.ts`

- [ ] **Step 2.4.1: `versioned.test.ts` failing test**

```typescript
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { Versioned } from './versioned.js';

describe('versioned', () => {
  const VersionedString = Versioned(z.string());

  describe('unit: plain value', () => {
    it('accepts plain string', () => expect(VersionedString.parse('hello')).toBe('hello'));
  });

  describe('unit: range-keyed map', () => {
    it('accepts {"21..28": "v1", "29..": "v2"}', () => {
      const v = { '21..28': 'v1', '29..': 'v2' };
      expect(VersionedString.parse(v)).toEqual(v);
    });

    it('rejects invalid range key', () => {
      expect(() => VersionedString.parse({ abc: 'v1' })).toThrow();
    });
  });
});
```

- [ ] **Step 2.4.2: `versioned.ts` 구현**

```typescript
import { z, type ZodTypeAny } from 'zod';
import { VersionRangeKey } from './version-range.js';

export const Versioned = <T extends ZodTypeAny>(inner: T) =>
  z.union([inner, z.record(VersionRangeKey, inner)]);

export type Versioned<T> = T | Record<string, T>;
```

- [ ] **Step 2.4.3: `versioned` 테스트 실행 — pass**

```bash
pnpm -F @acref/schema test versioned
```

Expected: 3 passed.

- [ ] **Step 2.4.4: `provenance.test.ts` failing test**

```typescript
import { describe, expect, it } from 'vitest';
import { ProvenanceEntry } from './provenance.js';

describe('provenance', () => {
  describe('unit: ProvenanceEntry', () => {
    it('accepts minimal aosp-code entry', () => {
      const e = {
        source: 'aosp-code',
        repo: 'https://android.googlesource.com/platform/frameworks/base',
        ref: 'android-15.0.0_r1',
        path: 'core/java/android/hardware/Camera.java',
        lineRange: [100, 120],
        fetchedAt: '2026-05-29T00:17:00Z',
      };
      expect(ProvenanceEntry.parse(e)).toEqual(e);
    });

    it('accepts URL-only javadoc-html entry', () => {
      const e = {
        source: 'javadoc-html',
        url: 'https://developer.android.com/reference/foo',
        fetchedAt: '2026-05-29T00:17:00Z',
      };
      expect(ProvenanceEntry.parse(e)).toEqual(e);
    });

    it('rejects missing fetchedAt', () => {
      const e = { source: 'aosp-code', url: 'https://example.com' };
      expect(() => ProvenanceEntry.parse(e)).toThrow();
    });
  });
});
```

- [ ] **Step 2.4.5: `provenance.ts` 구현**

```typescript
import { z } from 'zod';
import { SourceId } from './primitives.js';

export const ProvenanceEntry = z.object({
  source: SourceId,
  repo: z.string().url().optional(),
  ref: z.string().optional(),
  path: z.string().optional(),
  lineRange: z.tuple([z.number().int().nonnegative(), z.number().int().nonnegative()]).optional(),
  url: z.string().url().optional(),
  fetchedAt: z.string().datetime(),
});
export type ProvenanceEntry = z.infer<typeof ProvenanceEntry>;
```

- [ ] **Step 2.4.6: 테스트 + Commit**

```bash
pnpm -F @acref/schema test
git add packages/schema/src/{versioned,provenance}{,.test}.ts
git commit -m "feat(schema): Versioned + ProvenanceEntry (Phase 2.4)"
```

### Task 2.5: ID 합성 utilities + property tests

**Files:**
- Create: `packages/schema/src/id.ts`
- Create: `packages/schema/src/id.test.ts`

- [ ] **Step 2.5.1: failing test 작성**

```typescript
import { describe, expect, it } from 'vitest';
import * as fc from 'fast-check';
import {
  composeApiMethodId,
  composeApiClassId,
  composeFrameworkId,
  composeHalId,
  composePermissionId,
  parseApiMethodId,
  canonicalizeParams,
  shortApiMethodId,
} from './id.js';

describe('id', () => {
  describe('unit: canonicalizeParams', () => {
    it('strips generics', () =>
      expect(canonicalizeParams(['List<Surface>'])).toEqual(['java.util.List'])); // 의도적 단순화: List만 인식

    it('preserves nested class', () =>
      expect(canonicalizeParams(['androidx.camera.core.ImageCapture$OnImageCapturedCallback'])).toEqual(
        ['androidx.camera.core.ImageCapture$OnImageCapturedCallback'],
      ));

    it('keeps multiple params', () =>
      expect(
        canonicalizeParams([
          'java.util.concurrent.Executor',
          'androidx.camera.core.ImageCapture$OnImageCapturedCallback',
        ]),
      ).toEqual([
        'java.util.concurrent.Executor',
        'androidx.camera.core.ImageCapture$OnImageCapturedCallback',
      ]));
  });

  describe('unit: composeApiClassId', () => {
    it('builds cameraX/.../ImageCapture', () =>
      expect(
        composeApiClassId({ family: 'cameraX', classPath: 'androidx/camera/core/ImageCapture' }),
      ).toBe('cameraX/androidx/camera/core/ImageCapture'));
  });

  describe('unit: composeApiMethodId', () => {
    it('builds full method id with canonical params', () =>
      expect(
        composeApiMethodId({
          family: 'cameraX',
          classPath: 'androidx/camera/core/ImageCapture',
          methodName: 'takePicture',
          canonicalParams: [
            'java.util.concurrent.Executor',
            'androidx.camera.core.ImageCapture$OnImageCapturedCallback',
          ],
        }),
      ).toBe(
        'cameraX/androidx/camera/core/ImageCapture/takePicture(java.util.concurrent.Executor,androidx.camera.core.ImageCapture$OnImageCapturedCallback)',
      ));
  });

  describe('unit: composeHalId', () => {
    it('uses _v notation', () =>
      expect(
        composeHalId({
          interfaceName: 'ICameraDeviceSession',
          memberName: 'processCaptureRequest',
          halVersion: '3.4',
        }),
      ).toBe('hal/ICameraDeviceSession::processCaptureRequest_v3.4'));
  });

  describe('unit: composePermissionId', () => {
    it('builds permission/...', () =>
      expect(composePermissionId({ permName: 'android.permission.CAMERA' })).toBe(
        'permission/android.permission.CAMERA',
      ));
  });

  describe('unit: composeFrameworkId', () => {
    it('builds framework/...#...', () =>
      expect(
        composeFrameworkId({
          classPath: 'android/hardware/camera2/CameraCaptureSession',
          methodName: 'capture',
          canonicalParams: ['android.hardware.camera2.CaptureRequest'],
        }),
      ).toBe(
        'framework/android/hardware/camera2/CameraCaptureSession#capture(android.hardware.camera2.CaptureRequest)',
      ));
  });

  describe('unit: parseApiMethodId', () => {
    it('round-trips simple', () => {
      const input = {
        family: 'cameraX' as const,
        classPath: 'androidx/camera/core/ImageCapture',
        methodName: 'takePicture',
        canonicalParams: ['java.util.concurrent.Executor'],
      };
      const id = composeApiMethodId(input);
      expect(parseApiMethodId(id)).toEqual(input);
    });
  });

  describe('unit: shortApiMethodId', () => {
    it('emits SimpleClass#method~0', () =>
      expect(
        shortApiMethodId(
          { family: 'cameraX', simpleClassName: 'ImageCapture', methodName: 'takePicture' },
          0,
        ),
      ).toBe('cameraX/ImageCapture#takePicture~0'));
  });

  describe('property: composeApiMethodId then parse round-trips', () => {
    it('any well-formed input survives round-trip', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('camera1', 'camera2', 'cameraX'),
          fc.stringMatching(/^[a-z]+(\/[A-Za-z][A-Za-z0-9]*)+$/),
          fc.stringMatching(/^[a-zA-Z_][a-zA-Z0-9_]*$/),
          fc.array(fc.stringMatching(/^[a-z][a-z0-9.]*[A-Z][A-Za-z0-9$]*$/), { maxLength: 4 }),
          (family, classPath, methodName, canonicalParams) => {
            const input = { family: family as 'cameraX', classPath, methodName, canonicalParams };
            const id = composeApiMethodId(input);
            expect(parseApiMethodId(id)).toEqual(input);
          },
        ),
      );
    });
  });
});
```

- [ ] **Step 2.5.2: 실행 fail 확인**

```bash
pnpm -F @acref/schema test id
```

Expected: import error.

- [ ] **Step 2.5.3: `id.ts` 구현**

```typescript
import type { Family } from './primitives.js';

export interface ApiClassIdInput {
  family: Family;
  classPath: string;
}

export interface ApiMethodIdInput extends ApiClassIdInput {
  methodName: string;
  canonicalParams: string[];
}

export interface FrameworkIdInput {
  classPath: string;
  methodName: string;
  canonicalParams: string[];
}

export interface HalIdInput {
  interfaceName: string;
  memberName: string;
  halVersion: string;
}

export interface PermissionIdInput {
  permName: string;
}

// canonical params: 제네릭/와일드카드 제거. 알려진 boxed→fqn 매핑은 표로 (v0.1은 List만)
const TYPE_NORMALIZE: Record<string, string> = {
  'List<Surface>': 'java.util.List',
  'List<OutputConfiguration>': 'java.util.List',
};

export function canonicalizeParams(params: string[]): string[] {
  return params.map((p) => TYPE_NORMALIZE[p] ?? p.replace(/<.*>/g, ''));
}

export function composeApiClassId({ family, classPath }: ApiClassIdInput): string {
  return `${family}/${classPath}`;
}

export function composeApiMethodId(input: ApiMethodIdInput): string {
  const params = input.canonicalParams.join(',');
  return `${composeApiClassId(input)}/${input.methodName}(${params})`;
}

export function composeFrameworkId(input: FrameworkIdInput): string {
  return `framework/${input.classPath}#${input.methodName}(${input.canonicalParams.join(',')})`;
}

export function composeHalId(input: HalIdInput): string {
  return `hal/${input.interfaceName}::${input.memberName}_v${input.halVersion}`;
}

export function composePermissionId({ permName }: PermissionIdInput): string {
  return `permission/${permName}`;
}

const API_METHOD_RE = /^(camera1|camera2|cameraX)\/(.+)\/([^/(]+)\(([^)]*)\)$/;

export function parseApiMethodId(id: string): ApiMethodIdInput {
  const m = API_METHOD_RE.exec(id);
  if (!m) throw new Error(`Not a valid ApiMethod id: ${id}`);
  const [, family, classPath, methodName, paramsStr] = m;
  return {
    family: family as Family,
    classPath: classPath!,
    methodName: methodName!,
    canonicalParams: paramsStr ? paramsStr.split(',') : [],
  };
}

export function shortApiMethodId(
  input: { family: Family; simpleClassName: string; methodName: string },
  overloadIndex: number,
): string {
  return `${input.family}/${input.simpleClassName}#${input.methodName}~${overloadIndex}`;
}
```

- [ ] **Step 2.5.4: 테스트 재실행 — pass**

```bash
pnpm -F @acref/schema test id
```

Expected: 모든 테스트 통과 (property 포함).

- [ ] **Step 2.5.5: Commit**

```bash
git add packages/schema/src/id.ts packages/schema/src/id.test.ts
git commit -m "feat(schema): ID compose/parse utilities + property tests (Phase 2.5)"
```

### Task 2.6: NodeBase + 5종 Node kind

**Files:**
- Create: `packages/schema/src/nodes/base.ts`
- Create: `packages/schema/src/nodes/api-class.ts`
- Create: `packages/schema/src/nodes/api-method.ts`
- Create: `packages/schema/src/nodes/framework-symbol.ts`
- Create: `packages/schema/src/nodes/hal-symbol.ts`
- Create: `packages/schema/src/nodes/permission.ts`
- Create: `packages/schema/src/nodes/index.ts`
- Create: `packages/schema/src/nodes/nodes.test.ts`

- [ ] **Step 2.6.1: failing test (5 nodes × valid + invalid)**

```typescript
import { describe, expect, it } from 'vitest';
import {
  ApiClassNode,
  ApiMethodNode,
  FrameworkSymbolNode,
  HalSymbolNode,
  PermissionNode,
  NodeUnion,
} from './index.js';

const baseProv = {
  source: 'aosp-code' as const,
  repo: 'https://android.googlesource.com/platform/frameworks/support',
  ref: 'androidx-camera-release',
  path: 'foo.java',
  lineRange: [1, 10] as [number, number],
  fetchedAt: '2026-05-29T00:17:00Z',
};

describe('nodes', () => {
  describe('unit: ApiClassNode', () => {
    it('accepts minimal valid', () => {
      const n = {
        id: 'cameraX/androidx/camera/core/ImageCapture',
        kind: 'ApiClass' as const,
        family: 'cameraX' as const,
        displayName: 'ImageCapture',
        packageName: 'androidx.camera.core',
        className: 'ImageCapture',
        classKind: 'class' as const,
        methods: [],
        provenance: [baseProv],
      };
      expect(ApiClassNode.parse(n)).toEqual(n);
    });

    it('rejects empty provenance', () => {
      expect(() => ApiClassNode.parse({ ...{}, provenance: [] })).toThrow();
    });
  });

  describe('unit: ApiMethodNode', () => {
    it('accepts minimal valid with versioned trace', () => {
      const n = {
        id: 'cameraX/androidx/camera/core/ImageCapture/takePicture(java.util.concurrent.Executor)',
        kind: 'ApiMethod' as const,
        family: 'cameraX' as const,
        displayName: 'takePicture',
        ownerClass: 'cameraX/androidx/camera/core/ImageCapture',
        methodName: 'takePicture',
        canonicalParams: ['java.util.concurrent.Executor'],
        signature: {
          '..': {
            parameters: [{ name: 'executor', type: 'java.util.concurrent.Executor' }],
            returnType: 'void',
            modifiers: ['public'],
          },
        },
        tracesToHal: { '29..': ['hal/X::y_v3.4'] },
        provenance: [baseProv],
      };
      expect(ApiMethodNode.parse(n)).toEqual(n);
    });
  });

  describe('unit: FrameworkSymbolNode', () => {
    it('accepts', () => {
      const n = {
        id: 'framework/android/hardware/camera2/CameraCaptureSession#capture(android.hardware.camera2.CaptureRequest)',
        kind: 'FrameworkSymbol' as const,
        displayName: 'CameraCaptureSession.capture',
        symbolKind: 'method' as const,
        fqName: 'android.hardware.camera2.CameraCaptureSession.capture',
        provenance: [baseProv],
      };
      expect(FrameworkSymbolNode.parse(n)).toEqual(n);
    });
  });

  describe('unit: HalSymbolNode', () => {
    it('accepts _v3.4', () => {
      const n = {
        id: 'hal/ICameraDeviceSession::processCaptureRequest_v3.4',
        kind: 'HalSymbol' as const,
        displayName: 'processCaptureRequest',
        symbolKind: 'method' as const,
        interface: 'ICameraDeviceSession',
        member: 'processCaptureRequest',
        halVersion: '3.4',
        provenance: [baseProv],
      };
      expect(HalSymbolNode.parse(n)).toEqual(n);
    });
  });

  describe('unit: PermissionNode', () => {
    it('accepts', () => {
      const n = {
        id: 'permission/android.permission.CAMERA',
        kind: 'Permission' as const,
        displayName: 'CAMERA',
        permName: 'android.permission.CAMERA',
        provenance: [baseProv],
      };
      expect(PermissionNode.parse(n)).toEqual(n);
    });
  });

  describe('unit: NodeUnion', () => {
    it('discriminates on kind', () => {
      const n = {
        id: 'permission/android.permission.CAMERA',
        kind: 'Permission' as const,
        displayName: 'CAMERA',
        permName: 'android.permission.CAMERA',
        provenance: [baseProv],
      };
      const parsed = NodeUnion.parse(n);
      expect(parsed.kind).toBe('Permission');
    });
  });
});
```

- [ ] **Step 2.6.2: `nodes/base.ts` 구현**

```typescript
import { z } from 'zod';
import { ApiLevel } from '../primitives.js';
import { ProvenanceEntry } from '../provenance.js';
import { Versioned } from '../versioned.js';

const Alternative = z.object({
  value: z.unknown(),
  provenance: ProvenanceEntry,
});

export const NodeBase = z.object({
  id: z.string().min(1),
  shortId: z.string().optional(),
  displayName: z.string(),
  since: ApiLevel.optional(),
  deprecatedSince: ApiLevel.optional(),
  removedSince: ApiLevel.optional(),
  description: Versioned(z.string()).optional(),
  provenance: z.array(ProvenanceEntry).min(1),
  alternatives: z.record(z.string(), z.array(Alternative)).optional(),
});
```

- [ ] **Step 2.6.3: `nodes/api-class.ts` 구현**

```typescript
import { z } from 'zod';
import { NodeBase } from './base.js';
import { Family } from '../primitives.js';

export const ApiClassNode = NodeBase.extend({
  kind: z.literal('ApiClass'),
  family: Family,
  packageName: z.string(),
  className: z.string(),
  classKind: z.enum(['class', 'interface', 'enum', 'abstract']),
  methods: z.array(z.string()),
  extends: z.string().optional(),
  implements: z.array(z.string()).optional(),
});
export type ApiClassNode = z.infer<typeof ApiClassNode>;
```

- [ ] **Step 2.6.4: `nodes/api-method.ts` 구현**

```typescript
import { z } from 'zod';
import { NodeBase } from './base.js';
import { Family } from '../primitives.js';
import { Versioned } from '../versioned.js';

const SignatureShape = z.object({
  parameters: z.array(z.object({ name: z.string(), type: z.string() })),
  returnType: z.string(),
  modifiers: z.array(z.string()),
});

export const ApiMethodNode = NodeBase.extend({
  kind: z.literal('ApiMethod'),
  family: Family,
  ownerClass: z.string(),
  methodName: z.string(),
  canonicalParams: z.array(z.string()),
  returnType: z.string().optional(),
  signature: Versioned(SignatureShape),
  tracesToFramework: Versioned(z.array(z.string())).optional(),
  tracesToHal: Versioned(z.array(z.string())).optional(),
  replacedBy: z.array(z.string()).optional(),
  migratedFrom: z.array(z.string()).optional(),
  requiresPermission: z.array(z.string()).optional(),
  parameterType: z.array(z.string()).optional(),
  returnsType: z.string().optional(),
  relatedTo: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
});
export type ApiMethodNode = z.infer<typeof ApiMethodNode>;
```

- [ ] **Step 2.6.5: `nodes/framework-symbol.ts` 구현**

```typescript
import { z } from 'zod';
import { NodeBase } from './base.js';
import { Versioned } from '../versioned.js';

export const FrameworkSymbolNode = NodeBase.extend({
  kind: z.literal('FrameworkSymbol'),
  symbolKind: z.enum(['method', 'class', 'aidl']),
  fqName: z.string(),
  tracesToHal: Versioned(z.array(z.string())).optional(),
});
export type FrameworkSymbolNode = z.infer<typeof FrameworkSymbolNode>;
```

- [ ] **Step 2.6.6: `nodes/hal-symbol.ts` 구현**

```typescript
import { z } from 'zod';
import { NodeBase } from './base.js';

export const HalSymbolNode = NodeBase.extend({
  kind: z.literal('HalSymbol'),
  symbolKind: z.enum(['method', 'interface', 'struct']),
  interface: z.string(),
  member: z.string(),
  halVersion: z.string().regex(/^\d+\.\d+$/),
});
export type HalSymbolNode = z.infer<typeof HalSymbolNode>;
```

- [ ] **Step 2.6.7: `nodes/permission.ts` 구현**

```typescript
import { z } from 'zod';
import { NodeBase } from './base.js';

export const PermissionNode = NodeBase.extend({
  kind: z.literal('Permission'),
  permName: z.string(),
});
export type PermissionNode = z.infer<typeof PermissionNode>;
```

- [ ] **Step 2.6.8: `nodes/index.ts` 구현 (union)**

```typescript
import { z } from 'zod';
import { ApiClassNode } from './api-class.js';
import { ApiMethodNode } from './api-method.js';
import { FrameworkSymbolNode } from './framework-symbol.js';
import { HalSymbolNode } from './hal-symbol.js';
import { PermissionNode } from './permission.js';

export {
  ApiClassNode,
  ApiMethodNode,
  FrameworkSymbolNode,
  HalSymbolNode,
  PermissionNode,
};

export const NodeUnion = z.discriminatedUnion('kind', [
  ApiClassNode,
  ApiMethodNode,
  FrameworkSymbolNode,
  HalSymbolNode,
  PermissionNode,
]);
export type NodeUnion = z.infer<typeof NodeUnion>;
```

- [ ] **Step 2.6.9: 테스트 실행 — 모두 pass**

```bash
pnpm -F @acref/schema test nodes
```

Expected: 모든 케이스 통과.

- [ ] **Step 2.6.10: Commit**

```bash
git add packages/schema/src/nodes
git commit -m "feat(schema): 5 node kinds + discriminated union (Phase 2.6)"
```

### Task 2.7: `@acref/schema` public exports

**Files:**
- Modify: `packages/schema/src/index.ts`

- [ ] **Step 2.7.1: `index.ts` 전체 export로 교체**

```typescript
export * from './primitives.js';
export * from './version-range.js';
export * from './versioned.js';
export * from './provenance.js';
export * from './id.js';
export * from './nodes/index.js';

export const SCHEMA_VERSION = '0.0.1';
```

- [ ] **Step 2.7.2: 빌드 확인**

```bash
pnpm -F @acref/schema build
```

Expected: `packages/schema/dist/` 생성, 에러 없음.

- [ ] **Step 2.7.3: Commit**

```bash
git add packages/schema/src/index.ts
git commit -m "feat(schema): public exports barrel (Phase 2.7)"
```

---

## Task Group 3 — @acref/extractor-core

### Task 3.1: 패키지 골격

**Files:**
- Create: `packages/extractor-core/package.json`
- Create: `packages/extractor-core/tsconfig.json`
- Create: `packages/extractor-core/src/index.ts`

- [ ] **Step 3.1.1: `package.json` 작성**

```json
{
  "name": "@acref/extractor-core",
  "version": "0.0.1",
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": { ".": "./src/index.ts" },
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "test": "vitest run"
  },
  "dependencies": {
    "@acref/schema": "workspace:^",
    "yaml": "^2.4.5",
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "typescript": "^5.4.0",
    "vitest": "^1.6.0"
  }
}
```

- [ ] **Step 3.1.2: `tsconfig.json` 작성**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "outDir": "./dist", "rootDir": "./src" },
  "include": ["src/**/*"]
}
```

- [ ] **Step 3.1.3: `src/index.ts` 빈 파일로 시작**

```typescript
export const EXTRACTOR_CORE_VERSION = '0.0.1';
```

- [ ] **Step 3.1.4: 설치 + 빌드 확인 + Commit**

```bash
pnpm install
pnpm -F @acref/extractor-core build
git add packages/extractor-core
git commit -m "feat(extractor-core): package skeleton (Phase 3.1)"
```

### Task 3.2: 소스 우선순위 + 친화도 표

**Files:**
- Create: `packages/extractor-core/src/source-priority.ts`
- Create: `packages/extractor-core/src/affinity.ts`
- Create: `packages/extractor-core/src/source-priority.test.ts`

- [ ] **Step 3.2.1: failing test**

```typescript
import { describe, expect, it } from 'vitest';
import { GLOBAL_PRIORITY, comparePriority } from './source-priority.js';
import { FIELD_AFFINITY, isSourceAllowed } from './affinity.js';

describe('source priority', () => {
  describe('unit: GLOBAL_PRIORITY order', () => {
    it('aosp-code is highest', () => expect(GLOBAL_PRIORITY[0]).toBe('aosp-code'));
    it('behavior-changes is lowest', () =>
      expect(GLOBAL_PRIORITY[GLOBAL_PRIORITY.length - 1]).toBe('behavior-changes'));
  });

  describe('unit: comparePriority', () => {
    it('aosp-code > developer-docs', () =>
      expect(comparePriority('aosp-code', 'developer-docs')).toBeLessThan(0));
    it('developer-docs < aosp-code', () =>
      expect(comparePriority('developer-docs', 'aosp-code')).toBeGreaterThan(0));
    it('same source = 0', () => expect(comparePriority('aidl', 'aidl')).toBe(0));
  });
});

describe('field affinity', () => {
  describe('unit: isSourceAllowed', () => {
    it('signature.parameters allows aosp-code', () =>
      expect(isSourceAllowed('signature.parameters', 'aosp-code')).toBe(true));
    it('signature.parameters rejects javadoc-html', () =>
      expect(isSourceAllowed('signature.parameters', 'javadoc-html')).toBe(false));
    it('description allows javadoc-html', () =>
      expect(isSourceAllowed('description', 'javadoc-html')).toBe(true));
    it('unknown field allows all sources (default)', () =>
      expect(isSourceAllowed('tags', 'developer-docs')).toBe(true));
  });
});
```

- [ ] **Step 3.2.2: `source-priority.ts` 구현**

```typescript
import type { SourceId } from '@acref/schema';

export const GLOBAL_PRIORITY: SourceId[] = [
  'aosp-code',
  'aidl',
  'javadoc-html',
  'developer-docs',
  'behavior-changes',
];

const PRIORITY_INDEX = new Map<SourceId, number>(
  GLOBAL_PRIORITY.map((s, i) => [s, i]),
);

export function comparePriority(a: SourceId, b: SourceId): number {
  return (PRIORITY_INDEX.get(a) ?? 99) - (PRIORITY_INDEX.get(b) ?? 99);
}
```

- [ ] **Step 3.2.3: `affinity.ts` 구현**

```typescript
import type { SourceId } from '@acref/schema';

export const FIELD_AFFINITY: Record<string, SourceId[]> = {
  'signature.parameters': ['aosp-code', 'aidl'],
  'signature.returnType': ['aosp-code', 'aidl'],
  'signature.modifiers': ['aosp-code'],
  tracesToFramework: ['aosp-code'],
  tracesToHal: ['aosp-code'],
  methodOf: ['aosp-code'],
  ownerClass: ['aosp-code'],
  description: ['javadoc-html', 'developer-docs'],
  since: ['aosp-code', 'javadoc-html'],
  deprecatedSince: ['aosp-code', 'javadoc-html'],
  removedSince: ['aosp-code'],
  requiresPermission: ['aosp-code', 'javadoc-html'],
  replacedBy: ['aosp-code', 'javadoc-html', 'developer-docs'],
  tags: ['developer-docs', 'javadoc-html'],
};

export function isSourceAllowed(fieldPath: string, source: SourceId): boolean {
  const allowed = FIELD_AFFINITY[fieldPath];
  if (!allowed) return true; // unknown field: 기본 허용
  return allowed.includes(source);
}
```

- [ ] **Step 3.2.4: 테스트 실행 + Commit**

```bash
pnpm -F @acref/extractor-core test source-priority
git add packages/extractor-core/src/{source-priority,affinity,source-priority.test}.ts
git commit -m "feat(extractor-core): source priority + field affinity (Phase 3.2)"
```

### Task 3.3: Merger 알고리즘 (단일 노드 + alternatives)

**Files:**
- Create: `packages/extractor-core/src/merger.ts`
- Create: `packages/extractor-core/src/merger.test.ts`

- [ ] **Step 3.3.1: failing test**

```typescript
import { describe, expect, it } from 'vitest';
import { mergeNodeStreams, type RawNodeStream } from './merger.js';

const PROV_AOSP = {
  source: 'aosp-code' as const,
  ref: 'r1',
  fetchedAt: '2026-05-29T00:00:00Z',
};
const PROV_JAVADOC = {
  source: 'javadoc-html' as const,
  url: 'https://x.example/y',
  fetchedAt: '2026-05-29T00:00:00Z',
};

describe('merger', () => {
  describe('unit: single stream emits node unchanged', () => {
    it('one source, single field', () => {
      const streams: RawNodeStream[] = [
        {
          source: 'aosp-code',
          provenance: PROV_AOSP,
          nodes: {
            'permission/android.permission.CAMERA': {
              id: 'permission/android.permission.CAMERA',
              kind: 'Permission',
              displayName: 'CAMERA',
              permName: 'android.permission.CAMERA',
            },
          },
        },
      ];
      const merged = mergeNodeStreams(streams);
      const node = merged['permission/android.permission.CAMERA']!;
      expect(node.kind).toBe('Permission');
      expect(node.provenance).toHaveLength(1);
      expect(node.provenance[0]!.source).toBe('aosp-code');
    });
  });

  describe('unit: two streams same field, priority wins, other → alternatives', () => {
    it('aosp-code wins, javadoc-html goes to alternatives', () => {
      const streams: RawNodeStream[] = [
        {
          source: 'aosp-code',
          provenance: PROV_AOSP,
          nodes: {
            'permission/android.permission.CAMERA': {
              id: 'permission/android.permission.CAMERA',
              kind: 'Permission',
              displayName: 'CAMERA (aosp)',
              permName: 'android.permission.CAMERA',
            },
          },
        },
        {
          source: 'javadoc-html',
          provenance: PROV_JAVADOC,
          nodes: {
            'permission/android.permission.CAMERA': {
              id: 'permission/android.permission.CAMERA',
              kind: 'Permission',
              displayName: 'CAMERA (javadoc)',
              permName: 'android.permission.CAMERA',
            },
          },
        },
      ];
      const merged = mergeNodeStreams(streams);
      const node = merged['permission/android.permission.CAMERA']!;
      expect(node.displayName).toBe('CAMERA (aosp)');
      expect(node.alternatives?.displayName).toHaveLength(1);
      expect(node.alternatives?.displayName?.[0]?.value).toBe('CAMERA (javadoc)');
      expect(node.provenance).toHaveLength(2);
    });
  });

  describe('unit: affinity filter drops disallowed source', () => {
    it('description from aosp-code is dropped (affinity = javadoc/developer-docs)', () => {
      const streams: RawNodeStream[] = [
        {
          source: 'aosp-code',
          provenance: PROV_AOSP,
          nodes: {
            'permission/x': {
              id: 'permission/x',
              kind: 'Permission',
              displayName: 'x',
              permName: 'x',
              description: 'from aosp',
            },
          },
        },
        {
          source: 'javadoc-html',
          provenance: PROV_JAVADOC,
          nodes: {
            'permission/x': {
              id: 'permission/x',
              kind: 'Permission',
              displayName: 'x',
              permName: 'x',
              description: 'from javadoc',
            },
          },
        },
      ];
      const merged = mergeNodeStreams(streams);
      const node = merged['permission/x']!;
      expect(node.description).toBe('from javadoc');
      // aosp-code description은 친화도 밖 — alternatives에도 없어야 함
      expect(node.alternatives?.description).toBeUndefined();
    });
  });
});
```

- [ ] **Step 3.3.2: `merger.ts` 구현**

```typescript
import type { ProvenanceEntry, SourceId } from '@acref/schema';
import { comparePriority } from './source-priority.js';
import { isSourceAllowed } from './affinity.js';

export interface RawNodeStream {
  source: SourceId;
  provenance: ProvenanceEntry;
  nodes: Record<string, Record<string, unknown>>;
}

interface Alternative {
  value: unknown;
  provenance: ProvenanceEntry;
}

type Merged = Record<string, unknown> & {
  provenance: ProvenanceEntry[];
  alternatives?: Record<string, Alternative[]>;
};

const META_FIELDS = new Set(['id', 'kind', 'provenance', 'alternatives']);

export function mergeNodeStreams(streams: RawNodeStream[]): Record<string, Merged> {
  const allIds = new Set<string>();
  for (const s of streams) for (const id of Object.keys(s.nodes)) allIds.add(id);

  const result: Record<string, Merged> = {};

  for (const id of allIds) {
    const contributors = streams.filter((s) => s.nodes[id]);
    if (contributors.length === 0) continue;

    const node: Merged = { id, kind: '', provenance: [] };
    const allFields = new Set<string>();
    for (const c of contributors) for (const f of Object.keys(c.nodes[id]!)) allFields.add(f);

    for (const fieldPath of allFields) {
      if (META_FIELDS.has(fieldPath)) continue;

      const fieldContribs = contributors
        .filter((c) => c.nodes[id]![fieldPath] !== undefined)
        .filter((c) => isSourceAllowed(fieldPath, c.source));

      if (fieldContribs.length === 0) continue;

      const sorted = [...fieldContribs].sort((a, b) => comparePriority(a.source, b.source));
      const winner = sorted[0]!;
      node[fieldPath] = winner.nodes[id]![fieldPath];

      const losers = sorted.slice(1);
      if (losers.length > 0) {
        node.alternatives ??= {};
        node.alternatives[fieldPath] = losers.map((c) => ({
          value: c.nodes[id]![fieldPath],
          provenance: c.provenance,
        }));
      }
    }

    // id, kind, provenance 채우기
    const sample = contributors[0]!.nodes[id]!;
    node.id = sample.id as string;
    node.kind = sample.kind as string;
    node.provenance = contributors.map((c) => c.provenance);

    result[id] = node;
  }

  return result;
}
```

- [ ] **Step 3.3.3: 테스트 실행 — pass**

```bash
pnpm -F @acref/extractor-core test merger
```

Expected: 3 passed.

- [ ] **Step 3.3.4: Commit**

```bash
git add packages/extractor-core/src/{merger,merger.test}.ts
git commit -m "feat(extractor-core): merger with priority + affinity + alternatives (Phase 3.3)"
```

### Task 3.4: Cross-target 버전 키 자동 압축

**Files:**
- Create: `packages/extractor-core/src/version-merger.ts`
- Create: `packages/extractor-core/src/version-merger.test.ts`

- [ ] **Step 3.4.1: failing test**

```typescript
import { describe, expect, it } from 'vitest';
import { consolidatePerTarget } from './version-merger.js';

describe('version-merger', () => {
  describe('unit: same value across all targets becomes plain', () => {
    it('"void" everywhere', () => {
      const perTarget = { 33: 'void', 34: 'void', 35: 'void' };
      expect(consolidatePerTarget(perTarget)).toBe('void');
    });
  });

  describe('unit: different values become range-keyed', () => {
    it('changes at 34', () => {
      const perTarget = { 33: 'A', 34: 'B', 35: 'B' };
      expect(consolidatePerTarget(perTarget)).toEqual({ '33': 'A', '34..35': 'B' });
    });

    it('three distinct values', () => {
      const perTarget = { 33: 'A', 34: 'B', 35: 'C' };
      expect(consolidatePerTarget(perTarget)).toEqual({ '33': 'A', '34': 'B', '35': 'C' });
    });
  });

  describe('unit: array values consolidated by deep equality', () => {
    it('same array becomes plain', () => {
      const perTarget = { 33: ['x', 'y'], 34: ['x', 'y'] };
      expect(consolidatePerTarget(perTarget)).toEqual(['x', 'y']);
    });
  });

  describe('unit: single target value becomes plain', () => {
    it('only target 35', () => {
      const perTarget = { 35: 'lonely' };
      expect(consolidatePerTarget(perTarget)).toBe('lonely');
    });
  });
});
```

- [ ] **Step 3.4.2: `version-merger.ts` 구현**

```typescript
type PerTarget<T> = Record<number, T>;

export function consolidatePerTarget<T>(perTarget: PerTarget<T>): T | Record<string, T> {
  const entries = Object.entries(perTarget)
    .map(([k, v]) => [Number(k), v] as [number, T])
    .sort((a, b) => a[0] - b[0]);

  if (entries.length === 0) return {} as Record<string, T>;
  if (entries.length === 1) return entries[0]![1];

  // 인접한 같은 값을 묶어서 구간으로
  const groups: Array<{ low: number; high: number; value: T }> = [];
  for (const [level, value] of entries) {
    const last = groups[groups.length - 1];
    if (last && deepEqual(last.value, value) && last.high + 1 === level) {
      last.high = level;
    } else {
      groups.push({ low: level, high: level, value });
    }
  }

  if (groups.length === 1) return groups[0]!.value;

  const result: Record<string, T> = {};
  for (const g of groups) {
    const key = g.low === g.high ? String(g.low) : `${g.low}..${g.high}`;
    result[key] = g.value;
  }
  return result;
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (a === null || b === null) return false;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((v, i) => deepEqual(v, b[i]));
  }
  if (typeof a === 'object' && typeof b === 'object') {
    const ak = Object.keys(a as object);
    const bk = Object.keys(b as object);
    if (ak.length !== bk.length) return false;
    return ak.every((k) => deepEqual((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]));
  }
  return false;
}
```

- [ ] **Step 3.4.3: 테스트 실행 + Commit**

```bash
pnpm -F @acref/extractor-core test version-merger
git add packages/extractor-core/src/{version-merger,version-merger.test}.ts
git commit -m "feat(extractor-core): cross-target version range auto-compaction (Phase 3.4)"
```

### Task 3.5: Provenance helpers + YAML I/O + trace-joiner 스텁

**Files:**
- Create: `packages/extractor-core/src/provenance-helpers.ts`
- Create: `packages/extractor-core/src/yaml-io.ts`
- Create: `packages/extractor-core/src/trace-joiner.ts`
- Create: `packages/extractor-core/src/yaml-io.test.ts`

- [ ] **Step 3.5.1: `provenance-helpers.ts` 구현 (작은 유틸)**

```typescript
import type { ProvenanceEntry, SourceId } from '@acref/schema';

export function nowIso(): string {
  return new Date().toISOString();
}

export function provenance(
  partial: Omit<ProvenanceEntry, 'fetchedAt'> & { source: SourceId },
): ProvenanceEntry {
  return { ...partial, fetchedAt: nowIso() };
}
```

- [ ] **Step 3.5.2: `yaml-io.ts` 구현**

```typescript
import { parse, stringify } from 'yaml';
import { writeFile, readFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

export async function writeYaml(filePath: string, data: unknown): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, stringify(data), 'utf8');
}

export async function readYaml<T>(filePath: string): Promise<T> {
  const text = await readFile(filePath, 'utf8');
  return parse(text) as T;
}
```

- [ ] **Step 3.5.3: `yaml-io.test.ts` 작성**

```typescript
import { describe, expect, it } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { writeYaml, readYaml } from './yaml-io.js';

describe('yaml-io', () => {
  it('unit: round-trips a node-like object', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'acref-yaml-'));
    const file = join(dir, 'sub', 'node.yaml');
    const node = {
      id: 'permission/android.permission.CAMERA',
      kind: 'Permission',
      provenance: [{ source: 'aosp-code', fetchedAt: '2026-05-29T00:00:00Z' }],
    };
    try {
      await writeYaml(file, node);
      const back = await readYaml(file);
      expect(back).toEqual(node);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
```

- [ ] **Step 3.5.4: `trace-joiner.ts` 스텁 + 테스트**

`packages/extractor-core/src/trace-joiner.ts`:

```typescript
// Phase 2에서 실 알고리즘 구현. Phase 1은 인터페이스만 고정.
export interface CallEdge {
  from: string; // node id
  to: string;   // node id
  via?: 'binder' | 'jni' | 'java-call' | 'cpp-call';
}

export interface BinderAnchor {
  aidlInterface: string;
  aidlMember: string;
  cppImpl?: string;
}

export interface JoinerOptions {
  maxDepth: number; // Phase 2에서 튜닝
}

export const DEFAULT_JOINER_OPTIONS: JoinerOptions = { maxDepth: 8 };

/**
 * Phase 1 스텁: 입력된 callEdges를 그대로 통과시킴. 모든 ApiMethod의
 * tracesToFramework / tracesToHal는 노드 자신이 이미 가진 값이 사용됨.
 * Phase 2에서 실제 frontier expansion 알고리즘 구현 예정.
 */
export function joinTraces(
  _edges: CallEdge[],
  _anchors: BinderAnchor[],
  _options: JoinerOptions = DEFAULT_JOINER_OPTIONS,
): { tracesAdded: number } {
  return { tracesAdded: 0 };
}
```

`packages/extractor-core/src/trace-joiner.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { joinTraces, DEFAULT_JOINER_OPTIONS } from './trace-joiner.js';

describe('trace-joiner (Phase 1 stub)', () => {
  it('unit: returns 0 additions on empty inputs', () => {
    expect(joinTraces([], []).tracesAdded).toBe(0);
  });

  it('unit: DEFAULT_JOINER_OPTIONS.maxDepth is 8', () => {
    expect(DEFAULT_JOINER_OPTIONS.maxDepth).toBe(8);
  });
});
```

- [ ] **Step 3.5.5: index.ts 확장 + 테스트 + Commit**

`packages/extractor-core/src/index.ts`:

```typescript
export * from './source-priority.js';
export * from './affinity.js';
export * from './merger.js';
export * from './version-merger.js';
export * from './provenance-helpers.js';
export * from './yaml-io.js';
export * from './trace-joiner.js';

export const EXTRACTOR_CORE_VERSION = '0.0.1';
```

```bash
pnpm -F @acref/extractor-core test
git add packages/extractor-core/src
git commit -m "feat(extractor-core): provenance helpers + yaml IO + trace-joiner stub (Phase 3.5)"
```

---

## Task Group 4 — @acref/extractor-fixture (합성 추출기)

### Task 4.1: 패키지 골격

**Files:**
- Create: `packages/extractor-fixture/package.json`
- Create: `packages/extractor-fixture/tsconfig.json`
- Create: `packages/extractor-fixture/src/index.ts`

- [ ] **Step 4.1.1: `package.json` 작성**

```json
{
  "name": "@acref/extractor-fixture",
  "version": "0.0.1",
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": { ".": "./src/index.ts" },
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "test": "vitest run"
  },
  "dependencies": {
    "@acref/schema": "workspace:^",
    "@acref/extractor-core": "workspace:^"
  },
  "devDependencies": {
    "typescript": "^5.4.0",
    "vitest": "^1.6.0"
  }
}
```

- [ ] **Step 4.1.2: `tsconfig.json` 작성**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "outDir": "./dist", "rootDir": "./src" },
  "include": ["src/**/*"]
}
```

- [ ] **Step 4.1.3: 빈 `index.ts` + 설치 + Commit**

```typescript
export const FIXTURE_VERSION = '0.0.1';
```

```bash
pnpm install
git add packages/extractor-fixture
git commit -m "feat(extractor-fixture): package skeleton (Phase 4.1)"
```

### Task 4.2: 합성 노드 5개 emit

**Files:**
- Create: `packages/extractor-fixture/src/fixture-nodes.ts`
- Create: `packages/extractor-fixture/src/index.test.ts`

- [ ] **Step 4.2.1: failing test**

```typescript
import { describe, expect, it } from 'vitest';
import { NodeUnion } from '@acref/schema';
import { extractFixture } from './fixture-nodes.js';

describe('extractor-fixture', () => {
  describe('unit: emits 5 valid nodes covering all kinds', () => {
    const result = extractFixture({ target: 35 });

    it('has exactly 5 nodes', () => {
      expect(Object.keys(result.nodes)).toHaveLength(5);
    });

    it('all nodes pass schema validation', () => {
      for (const [, node] of Object.entries(result.nodes)) {
        expect(() => NodeUnion.parse(node)).not.toThrow();
      }
    });

    it('covers all 5 node kinds', () => {
      const kinds = new Set(Object.values(result.nodes).map((n) => n.kind));
      expect(kinds).toEqual(new Set(['ApiClass', 'ApiMethod', 'FrameworkSymbol', 'HalSymbol', 'Permission']));
    });

    it('the ApiMethod has tracesToHal', () => {
      const apiMethod = Object.values(result.nodes).find((n) => n.kind === 'ApiMethod');
      expect(apiMethod).toBeDefined();
      expect((apiMethod as { tracesToHal?: unknown }).tracesToHal).toBeDefined();
    });
  });
});
```

- [ ] **Step 4.2.2: `fixture-nodes.ts` 구현**

```typescript
import type { NodeUnion } from '@acref/schema';
import { provenance } from '@acref/extractor-core';

export interface FixtureExtractInput {
  target: number;
}

export interface FixtureExtractOutput {
  nodes: Record<string, NodeUnion>;
}

export function extractFixture(_input: FixtureExtractInput): FixtureExtractOutput {
  const prov = provenance({
    source: 'aosp-code',
    repo: 'https://example.invalid/fixture',
    ref: 'fixture-v0',
    path: 'fixture/ImageCapture.java',
    lineRange: [1, 10],
  });

  const classNode = {
    id: 'cameraX/androidx/camera/core/ImageCapture',
    kind: 'ApiClass' as const,
    family: 'cameraX' as const,
    displayName: 'ImageCapture',
    packageName: 'androidx.camera.core',
    className: 'ImageCapture',
    classKind: 'class' as const,
    methods: ['cameraX/androidx/camera/core/ImageCapture/takePicture(java.util.concurrent.Executor)'],
    provenance: [prov],
  };

  const methodNode = {
    id: 'cameraX/androidx/camera/core/ImageCapture/takePicture(java.util.concurrent.Executor)',
    kind: 'ApiMethod' as const,
    family: 'cameraX' as const,
    displayName: 'ImageCapture.takePicture(Executor)',
    shortId: 'cameraX/ImageCapture#takePicture~0',
    ownerClass: 'cameraX/androidx/camera/core/ImageCapture',
    methodName: 'takePicture',
    canonicalParams: ['java.util.concurrent.Executor'],
    returnType: 'void',
    signature: {
      '..': {
        parameters: [{ name: 'executor', type: 'java.util.concurrent.Executor' }],
        returnType: 'void',
        modifiers: ['public'],
      },
    },
    tracesToFramework: [
      'framework/android/hardware/camera2/CameraCaptureSession#capture(android.hardware.camera2.CaptureRequest)',
    ],
    tracesToHal: { '34..': ['hal/ICameraDeviceSession::processCaptureRequest_v3.7'] },
    requiresPermission: ['permission/android.permission.CAMERA'],
    tags: ['still-capture'],
    provenance: [prov],
  };

  const frameworkNode = {
    id: 'framework/android/hardware/camera2/CameraCaptureSession#capture(android.hardware.camera2.CaptureRequest)',
    kind: 'FrameworkSymbol' as const,
    displayName: 'CameraCaptureSession.capture',
    symbolKind: 'method' as const,
    fqName: 'android.hardware.camera2.CameraCaptureSession.capture',
    provenance: [prov],
  };

  const halNode = {
    id: 'hal/ICameraDeviceSession::processCaptureRequest_v3.7',
    kind: 'HalSymbol' as const,
    displayName: 'processCaptureRequest',
    symbolKind: 'method' as const,
    interface: 'ICameraDeviceSession',
    member: 'processCaptureRequest',
    halVersion: '3.7',
    provenance: [prov],
  };

  const permissionNode = {
    id: 'permission/android.permission.CAMERA',
    kind: 'Permission' as const,
    displayName: 'CAMERA',
    permName: 'android.permission.CAMERA',
    provenance: [prov],
  };

  return {
    nodes: {
      [classNode.id]: classNode,
      [methodNode.id]: methodNode,
      [frameworkNode.id]: frameworkNode,
      [halNode.id]: halNode,
      [permissionNode.id]: permissionNode,
    },
  };
}
```

- [ ] **Step 4.2.3: `index.ts` export**

```typescript
export * from './fixture-nodes.js';
export const FIXTURE_VERSION = '0.0.1';
```

- [ ] **Step 4.2.4: 테스트 실행 + Commit**

```bash
pnpm -F @acref/extractor-fixture test
git add packages/extractor-fixture/src
git commit -m "feat(extractor-fixture): synthetic 5-node extractor covering all kinds (Phase 4.2)"
```

---

## Task Group 5 — @acref/validators

### Task 5.1: 패키지 골격 + schema validator

**Files:**
- Create: `packages/validators/package.json`
- Create: `packages/validators/tsconfig.json`
- Create: `packages/validators/src/index.ts`
- Create: `packages/validators/src/schema-validator.ts`
- Create: `packages/validators/src/schema-validator.test.ts`

- [ ] **Step 5.1.1: 패키지 골격**

`packages/validators/package.json`:

```json
{
  "name": "@acref/validators",
  "version": "0.0.1",
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": { ".": "./src/index.ts" },
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "test": "vitest run"
  },
  "dependencies": {
    "@acref/schema": "workspace:^",
    "@acref/extractor-core": "workspace:^",
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "typescript": "^5.4.0",
    "vitest": "^1.6.0"
  }
}
```

`packages/validators/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "outDir": "./dist", "rootDir": "./src" },
  "include": ["src/**/*"]
}
```

- [ ] **Step 5.1.2: failing schema-validator test**

```typescript
import { describe, expect, it } from 'vitest';
import { validateSchema } from './schema-validator.js';

const VALID = {
  id: 'permission/android.permission.CAMERA',
  kind: 'Permission',
  displayName: 'CAMERA',
  permName: 'android.permission.CAMERA',
  provenance: [{ source: 'aosp-code', ref: 'r1', fetchedAt: '2026-05-29T00:00:00Z' }],
};

describe('schema-validator', () => {
  it('unit: passes valid nodes', () => {
    const result = validateSchema({ [VALID.id]: VALID });
    expect(result.errors).toEqual([]);
  });

  it('unit: reports schema error on missing required field', () => {
    const bad = { ...VALID, provenance: [] };
    const result = validateSchema({ [bad.id]: bad });
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]!.nodeId).toBe(bad.id);
  });
});
```

- [ ] **Step 5.1.3: 구현**

```typescript
import { NodeUnion } from '@acref/schema';

export interface SchemaError {
  nodeId: string;
  path: string;
  message: string;
}

export interface SchemaResult {
  errors: SchemaError[];
  validNodeIds: string[];
}

export function validateSchema(nodes: Record<string, unknown>): SchemaResult {
  const errors: SchemaError[] = [];
  const validNodeIds: string[] = [];
  for (const [id, node] of Object.entries(nodes)) {
    const parsed = NodeUnion.safeParse(node);
    if (parsed.success) {
      validNodeIds.push(id);
    } else {
      for (const issue of parsed.error.issues) {
        errors.push({
          nodeId: id,
          path: issue.path.join('.'),
          message: issue.message,
        });
      }
    }
  }
  return { errors, validNodeIds };
}
```

- [ ] **Step 5.1.4: 테스트 + Commit**

```bash
pnpm install
pnpm -F @acref/validators test
git add packages/validators
git commit -m "feat(validators): schema validator (Phase 5.1)"
```

### Task 5.2: xref validator

**Files:**
- Create: `packages/validators/src/xref-validator.ts`
- Create: `packages/validators/src/xref-validator.test.ts`

- [ ] **Step 5.2.1: failing test**

```typescript
import { describe, expect, it } from 'vitest';
import { validateXref } from './xref-validator.js';

describe('xref-validator', () => {
  it('unit: passes when all references resolve', () => {
    const nodes = {
      A: { id: 'A', kind: 'ApiMethod', tracesToHal: ['B'] },
      B: { id: 'B', kind: 'HalSymbol' },
    };
    expect(validateXref(nodes).broken).toEqual([]);
  });

  it('unit: reports broken reference', () => {
    const nodes = {
      A: { id: 'A', kind: 'ApiMethod', tracesToHal: ['B'] },
    };
    const r = validateXref(nodes);
    expect(r.broken).toHaveLength(1);
    expect(r.broken[0]!.missingId).toBe('B');
    expect(r.broken[0]!.fromNode).toBe('A');
  });

  it('unit: detects broken refs inside versioned map', () => {
    const nodes = {
      A: { id: 'A', kind: 'ApiMethod', tracesToHal: { '..': ['MISSING'] } },
    };
    const r = validateXref(nodes);
    expect(r.broken).toHaveLength(1);
    expect(r.broken[0]!.missingId).toBe('MISSING');
  });
});
```

- [ ] **Step 5.2.2: 구현**

```typescript
const REF_FIELDS = [
  'methods',
  'tracesToFramework',
  'tracesToHal',
  'replacedBy',
  'migratedFrom',
  'requiresPermission',
  'parameterType',
  'returnsType',
  'relatedTo',
  'ownerClass',
  'extends',
  'implements',
];

export interface BrokenRef {
  fromNode: string;
  fieldPath: string;
  missingId: string;
}

export interface XrefResult {
  broken: BrokenRef[];
}

export function validateXref(nodes: Record<string, Record<string, unknown>>): XrefResult {
  const ids = new Set(Object.keys(nodes));
  const broken: BrokenRef[] = [];

  for (const [fromId, node] of Object.entries(nodes)) {
    for (const field of REF_FIELDS) {
      const value = node[field];
      if (value === undefined) continue;
      collectRefs(value, [], (ref, path) => {
        if (!ids.has(ref)) {
          broken.push({ fromNode: fromId, fieldPath: `${field}${path}`, missingId: ref });
        }
      });
    }
  }
  return { broken };
}

function collectRefs(value: unknown, path: string[], emit: (ref: string, path: string) => void) {
  if (typeof value === 'string') {
    emit(value, path.map((p) => `.${p}`).join(''));
  } else if (Array.isArray(value)) {
    value.forEach((v, i) => collectRefs(v, [...path, String(i)], emit));
  } else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      collectRefs(v, [...path, k], emit);
    }
  }
}
```

- [ ] **Step 5.2.3: Commit**

```bash
pnpm -F @acref/validators test xref
git add packages/validators/src/{xref-validator,xref-validator.test}.ts
git commit -m "feat(validators): xref validator with versioned-aware traversal (Phase 5.2)"
```

### Task 5.3: coverage / freshness validators + runner

**Files:**
- Create: `packages/validators/src/coverage-validator.ts`
- Create: `packages/validators/src/freshness-validator.ts`
- Create: `packages/validators/src/runner.ts`
- Create: `packages/validators/src/runner.test.ts`

- [ ] **Step 5.3.1: `coverage-validator.ts` 구현**

```typescript
export interface CoverageInput {
  expectedNodeIds: string[];
  actualNodeIds: string[];
}

export interface CoverageWarning {
  missingId: string;
}

export interface CoverageResult {
  warnings: CoverageWarning[];
}

export function validateCoverage(input: CoverageInput): CoverageResult {
  const actual = new Set(input.actualNodeIds);
  return {
    warnings: input.expectedNodeIds
      .filter((id) => !actual.has(id))
      .map((missingId) => ({ missingId })),
  };
}
```

- [ ] **Step 5.3.2: `freshness-validator.ts` 구현 (스텁)**

```typescript
import type { ProvenanceEntry } from '@acref/schema';

export interface FreshnessWarning {
  nodeId: string;
  providedRef: string | undefined;
  currentRef: string | undefined;
  ageDays?: number;
}

export interface FreshnessInput {
  nodes: Record<string, { provenance: ProvenanceEntry[] }>;
  currentRefByRepo: Record<string, string>;
}

export interface FreshnessResult {
  warnings: FreshnessWarning[];
}

export function validateFreshness(input: FreshnessInput): FreshnessResult {
  const warnings: FreshnessWarning[] = [];
  for (const [nodeId, node] of Object.entries(input.nodes)) {
    for (const prov of node.provenance) {
      if (!prov.repo || !prov.ref) continue;
      const current = input.currentRefByRepo[prov.repo];
      if (current && current !== prov.ref) {
        warnings.push({ nodeId, providedRef: prov.ref, currentRef: current });
      }
    }
  }
  return { warnings };
}
```

- [ ] **Step 5.3.3: `runner.ts` 구현 — 모든 validator 실행 + summary**

```typescript
import { validateSchema, type SchemaResult } from './schema-validator.js';
import { validateXref, type XrefResult } from './xref-validator.js';
import { validateCoverage, type CoverageResult } from './coverage-validator.js';
import { validateFreshness, type FreshnessResult } from './freshness-validator.js';

export interface RunOptions {
  strict?: boolean;
}

export interface RunInput {
  nodes: Record<string, Record<string, unknown>>;
  coverageExpected?: string[];
  currentRefByRepo?: Record<string, string>;
}

export interface RunSummary {
  schemaErrors: number;
  xrefBroken: number;
  coverageMissing: number;
  freshnessWarnings: number;
  status: 'PASS' | 'WARN' | 'FAIL';
}

export interface RunResult {
  summary: RunSummary;
  schema: SchemaResult;
  xref: XrefResult;
  coverage: CoverageResult;
  freshness: FreshnessResult;
}

export function runValidators(input: RunInput, options: RunOptions = {}): RunResult {
  const schema = validateSchema(input.nodes);
  const xref = validateXref(input.nodes);
  const coverage = validateCoverage({
    expectedNodeIds: input.coverageExpected ?? [],
    actualNodeIds: Object.keys(input.nodes),
  });
  const freshness = validateFreshness({
    nodes: input.nodes as Record<string, { provenance: never[] }>,
    currentRefByRepo: input.currentRefByRepo ?? {},
  });

  let status: RunSummary['status'] = 'PASS';
  const hasFailures = schema.errors.length > 0 || xref.broken.length > 0;
  const hasWarnings = coverage.warnings.length > 0 || freshness.warnings.length > 0;

  if (hasFailures) status = 'FAIL';
  else if (hasWarnings) status = options.strict ? 'FAIL' : 'WARN';

  return {
    summary: {
      schemaErrors: schema.errors.length,
      xrefBroken: xref.broken.length,
      coverageMissing: coverage.warnings.length,
      freshnessWarnings: freshness.warnings.length,
      status,
    },
    schema,
    xref,
    coverage,
    freshness,
  };
}
```

- [ ] **Step 5.3.4: runner test**

```typescript
import { describe, expect, it } from 'vitest';
import { runValidators } from './runner.js';

const VALID = {
  id: 'permission/android.permission.CAMERA',
  kind: 'Permission',
  displayName: 'CAMERA',
  permName: 'android.permission.CAMERA',
  provenance: [{ source: 'aosp-code', ref: 'r1', fetchedAt: '2026-05-29T00:00:00Z' }],
};

describe('runValidators', () => {
  it('unit: clean input → PASS', () => {
    const r = runValidators({ nodes: { [VALID.id]: VALID } });
    expect(r.summary.status).toBe('PASS');
  });

  it('unit: coverage miss → WARN in non-strict, FAIL in strict', () => {
    const r1 = runValidators({
      nodes: { [VALID.id]: VALID },
      coverageExpected: ['missing/x'],
    });
    expect(r1.summary.status).toBe('WARN');

    const r2 = runValidators(
      { nodes: { [VALID.id]: VALID }, coverageExpected: ['missing/x'] },
      { strict: true },
    );
    expect(r2.summary.status).toBe('FAIL');
  });

  it('unit: schema error → FAIL even in non-strict', () => {
    const bad = { ...VALID, provenance: [] };
    const r = runValidators({ nodes: { [bad.id]: bad } });
    expect(r.summary.status).toBe('FAIL');
  });
});
```

- [ ] **Step 5.3.5: index export + 테스트 + Commit**

`packages/validators/src/index.ts`:

```typescript
export * from './schema-validator.js';
export * from './xref-validator.js';
export * from './coverage-validator.js';
export * from './freshness-validator.js';
export * from './runner.js';
```

```bash
pnpm -F @acref/validators test
git add packages/validators/src
git commit -m "feat(validators): coverage, freshness, runner with strict mode (Phase 5.3)"
```

---

## Task Group 6 — @acref/indexer

### Task 6.1: 패키지 골격 + consolidate

**Files:**
- Create: `packages/indexer/package.json`
- Create: `packages/indexer/tsconfig.json`
- Create: `packages/indexer/src/index.ts`
- Create: `packages/indexer/src/consolidate.ts`
- Create: `packages/indexer/src/consolidate.test.ts`

- [ ] **Step 6.1.1: 패키지 골격 (Task 5.1 패턴 그대로)**

```json
{
  "name": "@acref/indexer",
  "version": "0.0.1",
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": { ".": "./src/index.ts" },
  "scripts": { "build": "tsc -p tsconfig.json", "test": "vitest run" },
  "dependencies": {
    "@acref/schema": "workspace:^",
    "@acref/extractor-core": "workspace:^"
  },
  "devDependencies": { "typescript": "^5.4.0", "vitest": "^1.6.0" }
}
```

(tsconfig.json은 다른 패키지와 동일 패턴)

- [ ] **Step 6.1.2: failing consolidate test**

```typescript
import { describe, expect, it } from 'vitest';
import { consolidateNodes } from './consolidate.js';

describe('consolidate', () => {
  it('unit: same field across all targets becomes plain', () => {
    const perTarget = {
      33: { A: { id: 'A', kind: 'Permission', displayName: 'CAM', permName: 'p' } },
      34: { A: { id: 'A', kind: 'Permission', displayName: 'CAM', permName: 'p' } },
    };
    const consolidated = consolidateNodes(perTarget);
    expect(consolidated.A!.displayName).toBe('CAM');
  });

  it('unit: changing field becomes versioned map', () => {
    const perTarget = {
      33: { A: { id: 'A', kind: 'Permission', displayName: 'OLD', permName: 'p' } },
      34: { A: { id: 'A', kind: 'Permission', displayName: 'NEW', permName: 'p' } },
    };
    const c = consolidateNodes(perTarget);
    expect(c.A!.displayName).toEqual({ '33': 'OLD', '34': 'NEW' });
  });
});
```

- [ ] **Step 6.1.3: 구현**

```typescript
import { consolidatePerTarget } from '@acref/extractor-core';

export function consolidateNodes(
  perTarget: Record<number, Record<string, Record<string, unknown>>>,
): Record<string, Record<string, unknown>> {
  const allIds = new Set<string>();
  for (const target of Object.values(perTarget)) for (const id of Object.keys(target)) allIds.add(id);

  const result: Record<string, Record<string, unknown>> = {};

  for (const id of allIds) {
    const consolidated: Record<string, unknown> = {};
    const allFields = new Set<string>();
    for (const target of Object.values(perTarget)) {
      const node = target[id];
      if (node) for (const f of Object.keys(node)) allFields.add(f);
    }

    for (const field of allFields) {
      const perTargetForField: Record<number, unknown> = {};
      for (const [targetStr, target] of Object.entries(perTarget)) {
        const node = target[id];
        if (node && node[field] !== undefined) {
          perTargetForField[Number(targetStr)] = node[field];
        }
      }
      consolidated[field] = consolidatePerTarget(perTargetForField);
    }
    result[id] = consolidated;
  }
  return result;
}
```

- [ ] **Step 6.1.4: 테스트 + Commit**

```bash
pnpm install
pnpm -F @acref/indexer test consolidate
git add packages/indexer
git commit -m "feat(indexer): cross-target consolidate (Phase 6.1)"
```

### Task 6.2: Reverse indexes + build

**Files:**
- Create: `packages/indexer/src/reverse-index.ts`
- Create: `packages/indexer/src/build.ts`
- Create: `packages/indexer/src/reverse-index.test.ts`

- [ ] **Step 6.2.1: failing test**

```typescript
import { describe, expect, it } from 'vitest';
import { buildReverseIndex } from './reverse-index.js';

describe('reverse-index', () => {
  it('unit: byHal maps HAL id to ApiMethod ids that trace to it', () => {
    const nodes = {
      'cameraX/Foo/bar()': {
        id: 'cameraX/Foo/bar()',
        kind: 'ApiMethod',
        tracesToHal: ['hal/X::y_v3.4'],
      },
      'hal/X::y_v3.4': { id: 'hal/X::y_v3.4', kind: 'HalSymbol' },
    };
    const idx = buildReverseIndex(nodes);
    expect(idx.byHal['hal/X::y_v3.4']).toEqual(['cameraX/Foo/bar()']);
  });

  it('unit: byPermission collects ApiMethods that require permission', () => {
    const nodes = {
      'cameraX/Foo/bar()': {
        id: 'cameraX/Foo/bar()',
        kind: 'ApiMethod',
        requiresPermission: ['permission/android.permission.CAMERA'],
      },
    };
    const idx = buildReverseIndex(nodes);
    expect(idx.byPermission['permission/android.permission.CAMERA']).toEqual(['cameraX/Foo/bar()']);
  });

  it('unit: byTag collects nodes by tag string', () => {
    const nodes = {
      'cameraX/Foo/bar()': { id: 'cameraX/Foo/bar()', kind: 'ApiMethod', tags: ['jpeg'] },
    };
    const idx = buildReverseIndex(nodes);
    expect(idx.byTag.jpeg).toEqual(['cameraX/Foo/bar()']);
  });
});
```

- [ ] **Step 6.2.2: `reverse-index.ts` 구현**

```typescript
export interface ReverseIndex {
  byHal: Record<string, string[]>;
  byFrameworkSymbol: Record<string, string[]>;
  byTag: Record<string, string[]>;
  byPermission: Record<string, string[]>;
}

function pushUnique(map: Record<string, string[]>, key: string, value: string): void {
  const arr = map[key] ?? (map[key] = []);
  if (!arr.includes(value)) arr.push(value);
}

function collectStrings(value: unknown, out: string[]): void {
  if (typeof value === 'string') out.push(value);
  else if (Array.isArray(value)) value.forEach((v) => collectStrings(v, out));
  else if (value && typeof value === 'object') {
    for (const v of Object.values(value)) collectStrings(v, out);
  }
}

export function buildReverseIndex(
  nodes: Record<string, Record<string, unknown>>,
): ReverseIndex {
  const idx: ReverseIndex = {
    byHal: {},
    byFrameworkSymbol: {},
    byTag: {},
    byPermission: {},
  };

  for (const [id, node] of Object.entries(nodes)) {
    const halRefs: string[] = [];
    collectStrings(node.tracesToHal, halRefs);
    for (const h of halRefs) pushUnique(idx.byHal, h, id);

    const fwRefs: string[] = [];
    collectStrings(node.tracesToFramework, fwRefs);
    for (const f of fwRefs) pushUnique(idx.byFrameworkSymbol, f, id);

    const permRefs: string[] = [];
    collectStrings(node.requiresPermission, permRefs);
    for (const p of permRefs) pushUnique(idx.byPermission, p, id);

    const tags: string[] = [];
    collectStrings(node.tags, tags);
    for (const t of tags) pushUnique(idx.byTag, t, id);
  }
  return idx;
}
```

- [ ] **Step 6.2.3: `build.ts` 구현 — dist 파일 emit**

```typescript
import { writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { buildReverseIndex } from './reverse-index.js';

export interface BuildOptions {
  outDir: string;
  schemaVersion: string;
  dataVersion: string;
  targets: number[];
}

export interface BuildResult {
  files: string[];
}

export async function buildIndex(
  nodes: Record<string, Record<string, unknown>>,
  options: BuildOptions,
): Promise<BuildResult> {
  await mkdir(join(options.outDir, 'reverse'), { recursive: true });

  const indexPath = join(options.outDir, 'index.json');
  await writeFile(indexPath, JSON.stringify({ nodes }, null, 2));

  const reverse = buildReverseIndex(nodes);
  const reverseFiles: string[] = [];
  for (const [name, data] of Object.entries(reverse)) {
    const p = join(options.outDir, 'reverse', `${name}.json`);
    await writeFile(p, JSON.stringify(data, null, 2));
    reverseFiles.push(p);
  }

  const meta = {
    dataVersion: options.dataVersion,
    schemaVersion: options.schemaVersion,
    targets: options.targets,
    builtAt: new Date().toISOString(),
    nodeCount: Object.keys(nodes).length,
  };
  const metaPath = join(options.outDir, 'meta.json');
  await writeFile(metaPath, JSON.stringify(meta, null, 2));

  return { files: [indexPath, ...reverseFiles, metaPath] };
}
```

- [ ] **Step 6.2.4: `index.ts` export + 테스트 + Commit**

```typescript
export * from './consolidate.js';
export * from './reverse-index.js';
export * from './build.js';
```

```bash
pnpm -F @acref/indexer test
git add packages/indexer/src
git commit -m "feat(indexer): reverse index + dist build (Phase 6.2)"
```

---

## Task Group 7 — @acref/data

### Task 7.1: 패키지 골격 + loader

**Files:**
- Create: `packages/data/package.json`
- Create: `packages/data/tsconfig.json`
- Create: `packages/data/src/loader.ts`
- Create: `packages/data/src/loader.test.ts`
- Create: `packages/data/src/index.ts`

- [ ] **Step 7.1.1: 패키지 골격**

```json
{
  "name": "@acref/data",
  "version": "0.0.1",
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": { ".": "./src/index.ts" },
  "scripts": { "build": "tsc -p tsconfig.json", "test": "vitest run" },
  "dependencies": {
    "@acref/schema": "workspace:^",
    "minisearch": "^7.1.0"
  },
  "devDependencies": { "typescript": "^5.4.0", "vitest": "^1.6.0" }
}
```

- [ ] **Step 7.1.2: failing loader test**

```typescript
import { describe, expect, it } from 'vitest';
import { mkdtemp, writeFile, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { loadDataFromDist } from './loader.js';

describe('loader', () => {
  it('unit: loads index.json + reverse/ + meta.json from a dist dir', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'acref-data-'));
    try {
      const nodes = { 'permission/x': { id: 'permission/x', kind: 'Permission' } };
      await writeFile(join(dir, 'index.json'), JSON.stringify({ nodes }));
      await mkdir(join(dir, 'reverse'), { recursive: true });
      await writeFile(join(dir, 'reverse', 'byHal.json'), JSON.stringify({}));
      await writeFile(join(dir, 'reverse', 'byFrameworkSymbol.json'), JSON.stringify({}));
      await writeFile(join(dir, 'reverse', 'byTag.json'), JSON.stringify({}));
      await writeFile(join(dir, 'reverse', 'byPermission.json'), JSON.stringify({}));
      await writeFile(
        join(dir, 'meta.json'),
        JSON.stringify({ dataVersion: '0.0.1', schemaVersion: '0.0.1', targets: [35], builtAt: 'x', nodeCount: 1 }),
      );

      const data = await loadDataFromDist(dir);
      expect(data.nodes['permission/x']!.id).toBe('permission/x');
      expect(data.meta.dataVersion).toBe('0.0.1');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
```

- [ ] **Step 7.1.3: 구현 `loader.ts`**

```typescript
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

export interface AcrefMeta {
  dataVersion: string;
  schemaVersion: string;
  targets: number[];
  builtAt: string;
  nodeCount: number;
}

export interface AcrefData {
  nodes: Record<string, Record<string, unknown>>;
  reverse: {
    byHal: Record<string, string[]>;
    byFrameworkSymbol: Record<string, string[]>;
    byTag: Record<string, string[]>;
    byPermission: Record<string, string[]>;
  };
  meta: AcrefMeta;
}

async function readJson<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(path, 'utf8')) as T;
}

export async function loadDataFromDist(distDir: string): Promise<AcrefData> {
  const index = await readJson<{ nodes: Record<string, Record<string, unknown>> }>(
    join(distDir, 'index.json'),
  );
  const reverse = {
    byHal: await readJson<Record<string, string[]>>(join(distDir, 'reverse', 'byHal.json')),
    byFrameworkSymbol: await readJson<Record<string, string[]>>(
      join(distDir, 'reverse', 'byFrameworkSymbol.json'),
    ),
    byTag: await readJson<Record<string, string[]>>(join(distDir, 'reverse', 'byTag.json')),
    byPermission: await readJson<Record<string, string[]>>(
      join(distDir, 'reverse', 'byPermission.json'),
    ),
  };
  const meta = await readJson<AcrefMeta>(join(distDir, 'meta.json'));
  return { nodes: index.nodes, reverse, meta };
}
```

- [ ] **Step 7.1.4: 테스트 + Commit**

```bash
pnpm install
pnpm -F @acref/data test loader
git add packages/data
git commit -m "feat(data): loader skeleton (Phase 7.1)"
```

### Task 7.2: Lookup / version / trace / migration / search

**Files:**
- Create: `packages/data/src/lookup.ts`
- Create: `packages/data/src/version.ts`
- Create: `packages/data/src/trace.ts`
- Create: `packages/data/src/migration.ts`
- Create: `packages/data/src/search.ts`
- Create: `packages/data/src/helpers.test.ts`
- Modify: `packages/data/src/index.ts`

- [ ] **Step 7.2.1: 헬퍼 구현 (모든 모듈 통합 test로)**

`packages/data/src/lookup.ts`:

```typescript
import type { AcrefData } from './loader.js';

export function getNode(data: AcrefData, id: string): Record<string, unknown> | undefined {
  return data.nodes[id];
}

export function getNodes(data: AcrefData, ids: string[]): Array<Record<string, unknown>> {
  return ids.map((id) => data.nodes[id]).filter((n): n is Record<string, unknown> => !!n);
}

export function findByShortId(data: AcrefData, shortId: string): Record<string, unknown> | undefined {
  for (const node of Object.values(data.nodes)) {
    if (node.shortId === shortId) return node;
  }
  return undefined;
}

export function findBySimpleName(data: AcrefData, simpleName: string): Array<Record<string, unknown>> {
  return Object.values(data.nodes).filter((n) => {
    const display = n.displayName;
    return typeof display === 'string' && display.startsWith(simpleName);
  });
}
```

`packages/data/src/version.ts`:

```typescript
import { parseVersionRange } from '@acref/schema';

export function resolveVersioned<T>(
  versioned: T | Record<string, T> | undefined,
  apiLevel: number,
): T | undefined {
  if (versioned === undefined) return undefined;
  if (typeof versioned !== 'object' || versioned === null || Array.isArray(versioned)) {
    return versioned as T;
  }
  const obj = versioned as Record<string, T>;
  for (const [key, value] of Object.entries(obj)) {
    const r = parseVersionRange(key);
    const low = r.low ?? -Infinity;
    const high = r.high ?? Infinity;
    if (apiLevel >= low && apiLevel <= high) return value;
  }
  return undefined;
}
```

`packages/data/src/trace.ts`:

```typescript
import type { AcrefData } from './loader.js';
import { resolveVersioned } from './version.js';

export function tracesToFrameworkOf(
  data: AcrefData,
  nodeId: string,
  apiLevel: number,
): string[] {
  const node = data.nodes[nodeId];
  if (!node) return [];
  return resolveVersioned(node.tracesToFramework as never, apiLevel) ?? [];
}

export function tracesToHalOf(data: AcrefData, nodeId: string, apiLevel: number): string[] {
  const node = data.nodes[nodeId];
  if (!node) return [];
  return resolveVersioned(node.tracesToHal as never, apiLevel) ?? [];
}

export function reverseTraceFromHal(data: AcrefData, halId: string): string[] {
  return data.reverse.byHal[halId] ?? [];
}
```

`packages/data/src/migration.ts`:

```typescript
import type { AcrefData } from './loader.js';

export interface Migrations {
  replacedBy: string[];
  migratedFrom: string[];
}

export function migrationsOf(data: AcrefData, nodeId: string): Migrations {
  const node = data.nodes[nodeId];
  return {
    replacedBy: (node?.replacedBy as string[] | undefined) ?? [],
    migratedFrom: (node?.migratedFrom as string[] | undefined) ?? [],
  };
}
```

`packages/data/src/search.ts`:

```typescript
import MiniSearch from 'minisearch';
import type { AcrefData } from './loader.js';

export interface SearchHit {
  id: string;
  score: number;
}

export function createSearchIndex(data: AcrefData): MiniSearch {
  const idx = new MiniSearch({
    fields: ['id', 'displayName', 'tags'],
    storeFields: ['id'],
    extractField: (doc, field) => {
      const v = (doc as Record<string, unknown>)[field];
      return typeof v === 'string' ? v : Array.isArray(v) ? v.join(' ') : '';
    },
  });
  idx.addAll(Object.values(data.nodes) as Array<{ id: string }>);
  return idx;
}

export function search(idx: MiniSearch, query: string): SearchHit[] {
  return idx
    .search(query)
    .slice(0, 50)
    .map((r) => ({ id: r.id as string, score: r.score }));
}
```

- [ ] **Step 7.2.2: 통합 테스트 `helpers.test.ts`**

```typescript
import { describe, expect, it } from 'vitest';
import type { AcrefData } from './loader.js';
import { getNode, findByShortId } from './lookup.js';
import { resolveVersioned } from './version.js';
import { tracesToHalOf, reverseTraceFromHal } from './trace.js';
import { migrationsOf } from './migration.js';
import { createSearchIndex, search } from './search.js';

const DATA: AcrefData = {
  nodes: {
    'cameraX/X/m()': {
      id: 'cameraX/X/m()',
      kind: 'ApiMethod',
      displayName: 'X.m',
      shortId: 'cameraX/X#m~0',
      tracesToHal: { '..28': ['hal/A::a_v3.2'], '29..': ['hal/A::a_v3.4'] },
      replacedBy: [],
      migratedFrom: ['camera2/Y/n()'],
    },
  },
  reverse: {
    byHal: { 'hal/A::a_v3.4': ['cameraX/X/m()'] },
    byFrameworkSymbol: {},
    byTag: {},
    byPermission: {},
  },
  meta: { dataVersion: '0.0.1', schemaVersion: '0.0.1', targets: [33, 34, 35], builtAt: 'x', nodeCount: 1 },
};

describe('data helpers', () => {
  describe('unit: lookup', () => {
    it('getNode finds by id', () => expect(getNode(DATA, 'cameraX/X/m()')!.id).toBe('cameraX/X/m()'));
    it('findByShortId works', () =>
      expect(findByShortId(DATA, 'cameraX/X#m~0')!.id).toBe('cameraX/X/m()'));
  });

  describe('unit: resolveVersioned', () => {
    it('returns "..28" value for api level 25', () => {
      const r = resolveVersioned<string[]>(
        { '..28': ['hal/A::a_v3.2'], '29..': ['hal/A::a_v3.4'] },
        25,
      );
      expect(r).toEqual(['hal/A::a_v3.2']);
    });
    it('returns "29.." value for api level 30', () => {
      const r = resolveVersioned<string[]>(
        { '..28': ['hal/A::a_v3.2'], '29..': ['hal/A::a_v3.4'] },
        30,
      );
      expect(r).toEqual(['hal/A::a_v3.4']);
    });
  });

  describe('unit: trace helpers', () => {
    it('tracesToHalOf resolves by api level', () => {
      expect(tracesToHalOf(DATA, 'cameraX/X/m()', 34)).toEqual(['hal/A::a_v3.4']);
    });

    it('reverseTraceFromHal returns ApiMethod ids', () => {
      expect(reverseTraceFromHal(DATA, 'hal/A::a_v3.4')).toEqual(['cameraX/X/m()']);
    });
  });

  describe('unit: migrations', () => {
    it('migrationsOf returns both lists', () => {
      expect(migrationsOf(DATA, 'cameraX/X/m()')).toEqual({
        replacedBy: [],
        migratedFrom: ['camera2/Y/n()'],
      });
    });
  });

  describe('unit: search', () => {
    it('finds X.m by query "X"', () => {
      const idx = createSearchIndex(DATA);
      const hits = search(idx, 'X');
      expect(hits[0]?.id).toBe('cameraX/X/m()');
    });
  });
});
```

- [ ] **Step 7.2.3: `index.ts` export**

```typescript
export * from './loader.js';
export * from './lookup.js';
export * from './version.js';
export * from './trace.js';
export * from './migration.js';
export * from './search.js';
```

- [ ] **Step 7.2.4: 테스트 + Commit**

```bash
pnpm -F @acref/data test
git add packages/data/src
git commit -m "feat(data): lookup/version/trace/migration/search helpers (Phase 7.2)"
```

---

## Task Group 8 — @acref/cli

### Task 8.1: 패키지 골격 + cac command 라우팅

**Files:**
- Create: `packages/cli/package.json`
- Create: `packages/cli/tsconfig.json`
- Create: `packages/cli/src/cli.ts`

- [ ] **Step 8.1.1: 패키지 골격**

```json
{
  "name": "@acref/cli",
  "version": "0.0.1",
  "type": "module",
  "bin": { "acref": "./dist/cli.js" },
  "main": "./src/cli.ts",
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "test": "vitest run"
  },
  "dependencies": {
    "@acref/schema": "workspace:^",
    "@acref/extractor-core": "workspace:^",
    "@acref/extractor-fixture": "workspace:^",
    "@acref/validators": "workspace:^",
    "@acref/indexer": "workspace:^",
    "cac": "^6.7.14",
    "yaml": "^2.4.5"
  },
  "devDependencies": { "typescript": "^5.4.0", "vitest": "^1.6.0", "tsx": "^4.11.0" }
}
```

- [ ] **Step 8.1.2: `cli.ts` 스켈레톤**

```typescript
#!/usr/bin/env node
import { cac } from 'cac';
import { extractCommand } from './extract-cmd.js';
import { validateCommand } from './validate-cmd.js';
import { buildCommand } from './build-cmd.js';

const cli = cac('acref');

cli
  .command('extract', 'Extract knowledge nodes for given targets')
  .option('--target <n>', 'AOSP target API level (integer)', { default: 35 })
  .option('--out <dir>', 'generated/ output directory', { default: 'generated' })
  .action(async (opts: { target: number; out: string }) => {
    const r = await extractCommand({ target: Number(opts.target), out: opts.out });
    console.log(`Extracted ${r.nodeCount} nodes for target ${r.target} → ${r.outDir}`);
  });

cli
  .command('validate', 'Validate generated/ directory')
  .option('--in <dir>', 'generated/ input', { default: 'generated' })
  .option('--out <dir>', 'validation output', { default: 'dist/validation' })
  .option('--strict', 'fail on warn', { default: false })
  .action(async (opts: { in: string; out: string; strict: boolean }) => {
    const r = await validateCommand({ in: opts.in, out: opts.out, strict: opts.strict });
    console.log(`Validation: ${r.status} (schema=${r.schemaErrors}, xref=${r.xrefBroken})`);
    if (r.status === 'FAIL') process.exit(1);
  });

cli
  .command('build', 'Build dist/ index from generated/')
  .option('--in <dir>', 'generated/ input', { default: 'generated' })
  .option('--out <dir>', 'dist/ output', { default: 'packages/data/dist' })
  .option('--data-version <v>', 'package version label', { default: '0.0.1' })
  .action(async (opts: { in: string; out: string; dataVersion: string }) => {
    const r = await buildCommand(opts);
    console.log(`Built ${r.files.length} files in ${opts.out}`);
  });

cli.help();
cli.version('0.0.1');
cli.parse();
```

- [ ] **Step 8.1.3: tsconfig.json (build to dist 필요)**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "outDir": "./dist", "rootDir": "./src", "module": "ESNext" },
  "include": ["src/**/*"]
}
```

- [ ] **Step 8.1.4: 설치 + Commit (커맨드 모듈은 다음 task에서)**

```bash
pnpm install
git add packages/cli
git commit -m "feat(cli): cac-based command routing skeleton (Phase 8.1)"
```

### Task 8.2: extract / validate / build 커맨드 구현

**Files:**
- Create: `packages/cli/src/extract-cmd.ts`
- Create: `packages/cli/src/validate-cmd.ts`
- Create: `packages/cli/src/build-cmd.ts`

- [ ] **Step 8.2.1: `extract-cmd.ts` 구현**

```typescript
import { extractFixture } from '@acref/extractor-fixture';
import { writeYaml } from '@acref/extractor-core';
import { join } from 'node:path';

export interface ExtractInput {
  target: number;
  out: string;
}

export interface ExtractResult {
  target: number;
  outDir: string;
  nodeCount: number;
}

export async function extractCommand(input: ExtractInput): Promise<ExtractResult> {
  const { nodes } = extractFixture({ target: input.target });
  const outDir = join(input.out, String(input.target));
  for (const [id, node] of Object.entries(nodes)) {
    const safeName = id.replace(/[\/:()$]/g, '_');
    await writeYaml(join(outDir, `${safeName}.yaml`), node);
  }
  return { target: input.target, outDir, nodeCount: Object.keys(nodes).length };
}
```

- [ ] **Step 8.2.2: `validate-cmd.ts` 구현**

```typescript
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { readYaml } from '@acref/extractor-core';
import { runValidators } from '@acref/validators';
import { writeFile, mkdir } from 'node:fs/promises';

export interface ValidateInput {
  in: string;
  out: string;
  strict: boolean;
}

export interface ValidateResult {
  status: 'PASS' | 'WARN' | 'FAIL';
  schemaErrors: number;
  xrefBroken: number;
}

async function loadAllYaml(dir: string): Promise<Record<string, Record<string, unknown>>> {
  const result: Record<string, Record<string, unknown>> = {};
  let entries: { name: string; isDirectory: () => boolean; isFile: () => boolean }[] = [];
  try {
    entries = (await readdir(dir, { withFileTypes: true })) as never;
  } catch {
    return result;
  }
  for (const ent of entries) {
    const full = join(dir, ent.name);
    if (ent.isDirectory()) {
      Object.assign(result, await loadAllYaml(full));
    } else if (ent.isFile() && ent.name.endsWith('.yaml')) {
      const node = await readYaml<Record<string, unknown>>(full);
      const id = node.id as string;
      result[id] = node;
    }
  }
  return result;
}

export async function validateCommand(input: ValidateInput): Promise<ValidateResult> {
  const nodes = await loadAllYaml(input.in);
  const r = runValidators({ nodes }, { strict: input.strict });
  await mkdir(input.out, { recursive: true });
  await writeFile(join(input.out, 'summary.json'), JSON.stringify(r.summary, null, 2));
  await writeFile(join(input.out, 'schema-errors.json'), JSON.stringify(r.schema.errors, null, 2));
  await writeFile(join(input.out, 'xref-broken.json'), JSON.stringify(r.xref.broken, null, 2));
  return {
    status: r.summary.status,
    schemaErrors: r.summary.schemaErrors,
    xrefBroken: r.summary.xrefBroken,
  };
}
```

- [ ] **Step 8.2.3: `build-cmd.ts` 구현**

```typescript
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { readYaml } from '@acref/extractor-core';
import { consolidateNodes, buildIndex } from '@acref/indexer';
import { SCHEMA_VERSION } from '@acref/schema';

export interface BuildInput {
  in: string;
  out: string;
  dataVersion: string;
}

async function loadGeneratedByTarget(
  dir: string,
): Promise<Record<number, Record<string, Record<string, unknown>>>> {
  const result: Record<number, Record<string, Record<string, unknown>>> = {};
  let targetDirs: { name: string; isDirectory: () => boolean }[] = [];
  try {
    targetDirs = (await readdir(dir, { withFileTypes: true })) as never;
  } catch {
    return result;
  }
  for (const ent of targetDirs) {
    if (!ent.isDirectory()) continue;
    const target = Number(ent.name);
    if (Number.isNaN(target)) continue;
    const targetPath = join(dir, ent.name);
    const nodesByTarget: Record<string, Record<string, unknown>> = {};

    async function walk(d: string): Promise<void> {
      const entries = (await readdir(d, { withFileTypes: true })) as never as Array<{
        name: string;
        isDirectory(): boolean;
        isFile(): boolean;
      }>;
      for (const e of entries) {
        const full = join(d, e.name);
        if (e.isDirectory()) await walk(full);
        else if (e.isFile() && e.name.endsWith('.yaml')) {
          const node = await readYaml<Record<string, unknown>>(full);
          nodesByTarget[node.id as string] = node;
        }
      }
    }
    await walk(targetPath);
    result[target] = nodesByTarget;
  }
  return result;
}

export async function buildCommand(input: BuildInput): Promise<{ files: string[] }> {
  const perTarget = await loadGeneratedByTarget(input.in);
  const consolidated = consolidateNodes(perTarget);
  return buildIndex(consolidated, {
    outDir: input.out,
    schemaVersion: SCHEMA_VERSION,
    dataVersion: input.dataVersion,
    targets: Object.keys(perTarget).map(Number),
  });
}
```

- [ ] **Step 8.2.4: 빌드 후 bin 실행 가능 확인**

```bash
pnpm -F @acref/cli build
node packages/cli/dist/cli.js --help
```

Expected: cac help 출력 (extract, validate, build, --help).

- [ ] **Step 8.2.5: Commit**

```bash
git add packages/cli/src
git commit -m "feat(cli): extract/validate/build commands wired (Phase 8.2)"
```

---

## Task Group 9 — End-to-end smoke

### Task 9.1: 통합 테스트 — 파이프라인 풀 실행

**Files:**
- Create: `packages/cli/src/cli.test.ts`

- [ ] **Step 9.1.1: failing test 작성**

```typescript
import { describe, expect, it } from 'vitest';
import { mkdtemp, rm, readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { extractCommand } from './extract-cmd.js';
import { validateCommand } from './validate-cmd.js';
import { buildCommand } from './build-cmd.js';
import { loadDataFromDist, tracesToHalOf } from '@acref/data';

describe('integration: full pipeline on fixture', () => {
  it('integration: extract → validate → build → import @acref/data works', async () => {
    const workDir = await mkdtemp(join(tmpdir(), 'acref-e2e-'));
    try {
      const generatedDir = join(workDir, 'generated');
      const distDir = join(workDir, 'dist');
      const valDir = join(workDir, 'val');

      // extract target 35
      const ex = await extractCommand({ target: 35, out: generatedDir });
      expect(ex.nodeCount).toBe(5);
      const files = await readdir(ex.outDir);
      expect(files.length).toBe(5);

      // validate
      const v = await validateCommand({ in: generatedDir, out: valDir, strict: true });
      expect(v.status).toBe('PASS');

      // build
      const b = await buildCommand({ in: generatedDir, out: distDir, dataVersion: '0.0.1' });
      expect(b.files.length).toBeGreaterThanOrEqual(6);

      // import data
      const data = await loadDataFromDist(distDir);
      expect(Object.keys(data.nodes).length).toBe(5);
      const halTraces = tracesToHalOf(
        data,
        'cameraX/androidx/camera/core/ImageCapture/takePicture(java.util.concurrent.Executor)',
        35,
      );
      expect(halTraces).toEqual(['hal/ICameraDeviceSession::processCaptureRequest_v3.7']);

      // meta sanity
      expect(data.meta.targets).toEqual([35]);
      expect(data.meta.nodeCount).toBe(5);
    } finally {
      await rm(workDir, { recursive: true, force: true });
    }
  });
});
```

- [ ] **Step 9.1.2: @acref/cli에 @acref/data devDep 추가**

`packages/cli/package.json`의 `devDependencies`에 `"@acref/data": "workspace:^"` 추가 후 `pnpm install`.

- [ ] **Step 9.1.3: 테스트 실행**

```bash
pnpm -F @acref/cli test cli
```

Expected: 1 passed (integration).

- [ ] **Step 9.1.4: Commit**

```bash
git add packages/cli/package.json packages/cli/src/cli.test.ts pnpm-lock.yaml
git commit -m "test(cli): full pipeline integration smoke (Phase 9.1)"
```

### Task 9.2: 골든 트레이스 테스트

**Files:**
- Create: `packages/cli/test/golden/traces.yaml`
- Create: `packages/cli/test/golden/traces.test.ts`

- [ ] **Step 9.2.1: 골든 단언 파일 작성**

`packages/cli/test/golden/traces.yaml`:

```yaml
target: 35
expectations:
  - from: "cameraX/androidx/camera/core/ImageCapture/takePicture(java.util.concurrent.Executor)"
    tracesToHal:
      - "hal/ICameraDeviceSession::processCaptureRequest_v3.7"
    tracesToFramework:
      - "framework/android/hardware/camera2/CameraCaptureSession#capture(android.hardware.camera2.CaptureRequest)"
    requiresPermission:
      - "permission/android.permission.CAMERA"
```

- [ ] **Step 9.2.2: 골든 테스트 작성**

```typescript
import { describe, expect, it } from 'vitest';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { parse } from 'yaml';
import { extractCommand } from '../../src/extract-cmd.js';
import { buildCommand } from '../../src/build-cmd.js';
import {
  loadDataFromDist,
  tracesToHalOf,
  tracesToFrameworkOf,
} from '@acref/data';

interface GoldenSpec {
  target: number;
  expectations: Array<{
    from: string;
    tracesToHal?: string[];
    tracesToFramework?: string[];
    requiresPermission?: string[];
  }>;
}

describe('golden: trace assertions on fixture', () => {
  it('golden: traces match expected map for target 35', async () => {
    const goldenPath = new URL('./traces.yaml', import.meta.url).pathname;
    const golden = parse(await readFile(goldenPath, 'utf8')) as GoldenSpec;

    const workDir = await mkdtemp(join(tmpdir(), 'acref-golden-'));
    try {
      const generatedDir = join(workDir, 'generated');
      const distDir = join(workDir, 'dist');
      await extractCommand({ target: golden.target, out: generatedDir });
      await buildCommand({ in: generatedDir, out: distDir, dataVersion: '0.0.1' });
      const data = await loadDataFromDist(distDir);

      for (const exp of golden.expectations) {
        if (exp.tracesToHal) {
          expect(tracesToHalOf(data, exp.from, golden.target)).toEqual(exp.tracesToHal);
        }
        if (exp.tracesToFramework) {
          expect(tracesToFrameworkOf(data, exp.from, golden.target)).toEqual(exp.tracesToFramework);
        }
        if (exp.requiresPermission) {
          const node = data.nodes[exp.from];
          expect((node as { requiresPermission?: string[] }).requiresPermission).toEqual(
            exp.requiresPermission,
          );
        }
      }
    } finally {
      await rm(workDir, { recursive: true, force: true });
    }
  });
});
```

- [ ] **Step 9.2.3: 실행 + Commit**

```bash
pnpm -F @acref/cli test golden
git add packages/cli/test
git commit -m "test(cli): golden trace assertions on fixture (Phase 9.2)"
```

---

## Task Group 10 — CI (Phase 1 한정)

### Task 10.1: ci.yml 작성

**Files:**
- Create: `.github/workflows/ci.yml`

- [ ] **Step 10.1.1: workflow yaml 작성**

```yaml
name: ci
on:
  push:
    branches: [main]
  pull_request:

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20.9.0'

      - name: Enable pnpm via corepack
        run: |
          corepack enable
          corepack prepare pnpm@9.12.0 --activate

      - name: Install
        run: pnpm install --frozen-lockfile

      - name: Lint
        run: pnpm lint

      - name: Unit + Integration + Golden + Property tests
        run: pnpm test

      - name: Build all packages
        run: pnpm -r build
```

- [ ] **Step 10.1.2: 로컬에서 동등 명령 모두 통과 확인**

```bash
pnpm install --frozen-lockfile
pnpm lint
pnpm test
pnpm -r build
```

Expected: 모두 0 exit.

- [ ] **Step 10.1.3: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: add ci.yml for lint + test + build (Phase 10.1)"
```

---

## Phase 1 종료 체크리스트

- [ ] 모든 패키지가 build/test 통과
- [ ] `pnpm test` 전체 통과 (단위 + 통합 + 골든 + 속성)
- [ ] `node packages/cli/dist/cli.js extract && validate && build` end-to-end 동작
- [ ] `dist/index.json` + `reverse/*.json` + `meta.json` 생성됨
- [ ] `@acref/data`를 import해 fixture 노드 조회 가능
- [ ] CI 워크플로우 ci.yml 존재 및 로컬 등가 명령 통과
- [ ] spec §8 미해결 질문 #4 (HAL version 표기) 결정 — `_v3.4`

---

## 다음 Phase 후보 (별도 plan에서)

- **Phase 2**: 실 `@acref/extractor-aosp` (Java parser + AIDL parser + tree-sitter-cpp + sparse checkout) + 실 트레이스 조이너
- **Phase 3**: `@acref/extractor-javadoc` + `@acref/extractor-docs` + 다중 소스 통합 테스트
- **Phase 4**: GitHub Releases + npm publish + `extract.yml` + `poll.yml` + `scripts/poll-aosp-tags.ts`
- **Phase 5**: 도메인 룰 validator, behavior-changes 추출기, `apps/docs`, Kotlin source 등

각 Phase는 별 plan으로 brainstorming → writing-plans 사이클 다시 시작.
