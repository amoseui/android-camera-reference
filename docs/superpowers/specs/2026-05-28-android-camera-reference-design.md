# Android Camera Reference (acref) — 디자인 사양

| Field | Value |
|---|---|
| Status | Design (pre-implementation) |
| Drafted | 2026-05-28 ~ 2026-05-29 |
| Author | Amos Lim (with Claude) |
| Spec path | `docs/superpowers/specs/2026-05-28-android-camera-reference-design.md` |
| Build log | `~/Obsidian/amoseui/1. Projects/project-journal/android-camera-reference/build-log.md` |

---

## 요약

`android-camera-reference` (약자 `acref`, npm scope `@acref/*`)는 **자동 추출 기반의 Android 카메라 knowledge graph 키트**다. AOSP 소스 / developer.android.com 문서 / javadoc HTML 로부터 정적 분석으로 노드와 엣지를 추출해, App API entry point에서 시작해 Framework → HAL까지 trace 가능한 구조화된 지식을 생산한다. 결과는 `@acref/data` npm 패키지 + GitHub Releases artifact로 배포되며, 외부 surface(MCP 서버 · CLI · AI 에이전트 플러그인 · IDE 플러그인 · 브라우저 익스텐션) 들이 이를 소비한다.

**v1.0 범위**: Core(지식 레이어)만. 모든 surface는 별도 sub-project로 분기한다.

**v1.0 지원 콘텐츠**: `camera1` · `camera2` · `cameraX` 세 family + Framework · HAL. AOSP API 21+ 다중 버전 인지(per-field versioned). 초기 콘텐츠 드롭은 최신 안정 AOSP 태그 3개부터 시작해 후속 릴리즈에서 옛 버전 백필.

---

## 1. 목표 · 비목표

### 1.1 사용자

- **1차 사용자(개인)**: 본인 — Android App / Flutter / Robolectric 개발 시 카메라 API를 다룰 때 빠른 참조와 trace 정보를 얻고자 한다. 옛 framework 개발 경험으로 Framework·HAL 용어는 프라이머 불필요.
- **2차 사용자(AI 에이전트)**: Claude Code / Cursor 등에서 카메라 코드를 다룰 때 MCP/플러그인을 통해 grounding을 받는다.
- **3차 사용자(OSS 커뮤니티)**: 자료가 빈약한 Android 카메라 레이어 트레이스 정보를 공개 자료로 활용.
- **비-사용자**: OEM/SoC 벤더의 vendor HAL 구현 작업은 본 프로젝트 대상이 아니다.

### 1.2 목표 (v1.0)

1. App API(Camera1/Camera2/CameraX) 노드 각각에 대해 Framework 및 HAL trace 엣지를 best-effort로 제공
2. AOSP API 21+ 다중 버전을 *데이터 모델에서 지원*하고, 최신 3개 태그를 *실제 추출*해 publish
3. 모든 사실은 source provenance(repo/ref/path/lineRange 또는 URL + fetchedAt) 첨부
4. 재실행 가능한 결정적 파이프라인 — 같은 입력 → 같은 출력
5. 분리된 검증 단계로 schema · cross-reference · coverage · freshness 점검, strict 모드에서 publish 게이팅
6. `@acref/data` 단일 npm 패키지로 surface가 typed import

### 1.3 비-목표 (v1.0)

- Surface 영역 전체: MCP/CLI/Agent/IDE/Browser는 별 sub-project (`acref-mcp` 등)
- 사람이 직접 작성한 콘텐츠 레이어 — 정정·보강은 추출기 코드 개선으로
- 임베딩/시맨틱 검색 — surface 단계 결정
- vendor HAL 구현체 분석 — NDA/접근 제한
- 런타임 분석 (dumpsys/logcat/atrace) — 정적 분석만
- Kotlin source — Java 시그니처만
- libclang 정밀 C++ 분석 — tree-sitter로 시작
- behavior-changes 추출기 — v1.x 후보
- `apps/docs` 정적 사이트 — 후속 sub-project
- lazy slice 로드 / CDN / delta 업데이트 / SBOM 서명

---

## 2. 아키텍처 개요

### 2.1 파이프라인

```
┌─────────────────────────────────────────────────────────────────┐
│  Extractors (multi-source)                                      │
│  ┌──────────────────┐ ┌──────────────────┐ ┌─────────────────┐ │
│  │ extractor-aosp   │ │ extractor-javadoc│ │ extractor-docs  │ │
│  │ (Java/AIDL/HIDL/ │ │ (HTML reference) │ │ (guides + AOSP  │ │
│  │  C++ AST)        │ │                  │ │  source docs)   │ │
│  └────────┬─────────┘ └────────┬─────────┘ └────────┬────────┘ │
└──────────┼────────────────────┼────────────────────┼──────────┘
           ▼                    ▼                    ▼
┌─────────────────────────────────────────────────────────────────┐
│  extractor-core: source priority + field affinity merger +      │
│  provenance attachment + trace joiner + ID composition          │
└──────────────────────────────┬──────────────────────────────────┘
                               ▼
              ┌─────────────────────────────────┐
              │  generated/<target>/<family>/   │  (gitignore)
              │    <id>.yaml                    │  canonical YAML
              └────────────────┬────────────────┘
                               ▼
              ┌─────────────────────────────────┐
              │  validators                     │
              │  - schema (fail-fast)           │
              │  - xref (fail-fast)             │
              │  - coverage (warn @ v1.0)       │
              │  - freshness (warn)             │
              │  - conflicts (보고)             │
              └────────────────┬────────────────┘
                               ▼
              ┌─────────────────────────────────┐
              │  indexer → dist/                │
              │  - index.json                   │
              │  - reverse/{byHal,byFramework,  │
              │      byTag,byPermission}.json   │
              │  - meta.json                    │
              └────────────────┬────────────────┘
                               ▼
              ┌─────────────────────────────────┐
              │  publish                        │
              │  - npm @acref/data              │
              │  - GitHub Release artifact      │
              └─────────────────────────────────┘
```

### 2.2 Monorepo 패키지 구조

```
acr/
├── package.json, pnpm-workspace.yaml, tsconfig.base.json, .tool-versions
├── packages/
│   ├── schema/                  # @acref/schema — Zod, TS 타입, ID 규칙
│   ├── extractor-core/          # @acref/extractor-core
│   ├── extractor-aosp/          # @acref/extractor-aosp
│   ├── extractor-docs/          # @acref/extractor-docs
│   ├── extractor-javadoc/       # @acref/extractor-javadoc
│   ├── validators/              # @acref/validators
│   ├── indexer/                 # @acref/indexer
│   ├── data/                    # @acref/data (publish 단위)
│   └── cli/                     # @acref/cli (bin: acref)
├── apps/                        # 비어 있음 (apps/docs는 v1.x)
├── scripts/
│   └── poll-aosp-tags.ts
├── .github/workflows/{extract,poll,ci}.yml
└── generated/                   # gitignored
```

**의존 방향**: `schema`는 누구도 의존하지 않음. 모든 패키지가 `schema`에 의존. extractor-core는 schema에만 의존. 각 extractor-*는 schema + extractor-core 에 의존. validators / indexer는 schema에만 의존. data는 schema + indexer 출력. cli는 모두 호출 (thin orchestrator).

### 2.3 데이터 단위 분리

- `generated/` — 추출기 raw 출력. gitignored. 빌드 산출물.
- `dist/` — 머지·검증·인덱스 후. publish 단위.
- 코드(`packages/*`)와 데이터(`generated/`, `dist/`) 디렉토리는 절대 섞이지 않음.

---

## 3. 데이터 모델

### 3.1 lightweight knowledge graph 선언

본 시스템의 데이터 모델은 **타입 있는 노드 + 타입 있는 엣지**로 구성된 knowledge graph다. 무거운 graph DB(Neo4j/RDF/SPARQL) 는 v1에서 사용하지 않는다. canonical 표현은 YAML 파일이며, 빌드 시 JSON index로 머터리얼라이즈된다.

### 3.2 노드 타입 (v1)

| Kind | 무엇 | 예 |
|---|---|---|
| `ApiClass` | App 레이어 클래스/인터페이스/enum | `androidx.camera.core.ImageCapture` |
| `ApiMethod` | App 레이어 메서드 (entry point) | `ImageCapture.takePicture(Executor, OnImageCapturedCallback)` |
| `FrameworkSymbol` | Framework 심볼 (Java/AIDL) | `android.hardware.camera2.CameraCaptureSession#capture` |
| `HalSymbol` | HAL 심볼 (HIDL/AIDL HAL) | `ICameraDeviceSession::processCaptureRequest_v3.4` |
| `Permission` | Android 권한 | `android.permission.CAMERA` |

비-스코프: `Capability` / `Concept` 상위 추상, `ApiField`/`ApiConstant`, Kotlin extension 노드.

### 3.3 엣지 타입 (v1)

| Edge | 시발 → 목적지 | 버전 키 |
|---|---|---|
| `methodOf` | ApiMethod → ApiClass | — |
| `tracesToFramework` | ApiMethod → FrameworkSymbol[] | 가능 |
| `tracesToHal` | ApiMethod / FrameworkSymbol → HalSymbol[] | 가능 |
| `replacedBy` | ApiMethod / ApiClass → ApiMethod / ApiClass | — |
| `migratedFrom` | (역방향, 빌드 시 자동) | — |
| `requiresPermission` | ApiMethod → Permission[] | — |
| `parameterType` | ApiMethod → ApiClass[] | — |
| `returnsType` | ApiMethod → ApiClass | — |
| `relatedTo` | 임의 → 임의 (약한 연관) | — |

### 3.4 버전 인코딩

다중 버전 모델링(multi-version C). 한 노드에 N개 스냅샷을 두지 않고, **변화하는 필드만 버전 구간 키로** 가진다 (per-field versioned F).

#### 구간 키 문법

```
versionKey :=
  | exactLevel                       # "21"
  | lowBound ".." highBound          # "21..28" (양끝 포함)
  | lowBound ".."                    # "29.."
  | ".." highBound                   # "..28"
  | ".."                             # 모든 알려진 버전 (디폴트)
```

한 필드의 구간들은 서로 겹치면 안 된다 (validator가 검사). 비어 있는 구간은 fallback이 없으므로 "그 구간엔 정보 없음"으로 해석된다.

#### 데이터 모델 vs 초기 콘텐츠 커버리지

- 데이터 모델: API 21+ 다중 버전 지원
- v1 first content drop: 최신 3개 안정 AOSP 태그만 실제 추출
- 옛 버전은 후속 마이너 릴리즈에서 backfill

### 3.5 노드 ID 규칙

ID 포맷:

```
ApiClass     := family "/" classPath
ApiMethod    := ApiClassId "/" methodName "(" [canonicalParams] ")"
Framework    := "framework/" classPath "#" methodName "(" [canonicalParams] ")"
HAL          := "hal/" Interface "::" Member "_v" HalVersion
Permission   := "permission/" permName
```

- `classPath`: FQN을 `/`로 join한 형태. 예: `androidx/camera/core/ImageCapture`
- `canonicalParams`: 파라미터 타입의 FQN 리스트(쉼표 join). 제네릭/와일드카드 제거(`List<Surface>` → `java.util.List`), 변수명 제거. 외부 nested class는 `Class$Inner` 보존.

#### Short ID

```
apiMethodShortId := family "/" SimpleClassName "#" methodName "~" overloadIndex
```

`overloadIndex`는 같은 (family, class, methodName) 그룹 안에서 `canonicalParams` 사전순 정렬 후의 0-based 위치. 정렬이 결정론적이므로 안정.

#### 다중 버전 안정성

같은 (family, classPath, methodName, canonicalParams) 튜플은 모든 AOSP 태그에 걸쳐 같은 ID를 갖는다. 시그니처가 바뀌면 새 ID이며, 옛 ID는 `until: N`, 새 ID는 `since: N` 메타로 표시되고 사이에 `replacedBy` 엣지가 추출기 휴리스틱으로 자동 생성된다.

#### rename / 이동

자동 검출이 불가능하므로 `aliases.yaml` 추출기 메타 파일에 명시:

```yaml
aliases:
  - from: <old-id>
    to:   <new-id>
    since: <api-level-or-androidx-version>
```

이는 추출기 *설정*이지 콘텐츠가 아니다. 결정 #1("자동 only")에 위배되지 않는다.

### 3.6 Provenance

모든 노드는 `provenance: [...]`에 최소 1개의 출처를 갖는다.

```yaml
provenance:
  - source: aosp-code
    repo: https://android.googlesource.com/platform/frameworks/support
    ref: androidx-camera-release
    path: camera/camera-core/src/main/java/androidx/camera/core/ImageCapture.java
    lineRange: [1234, 1289]
    fetchedAt: "2026-05-29T00:17:00Z"
```

`source` 식별자는 다음 중 하나:

```
aosp-code | aidl | javadoc-html | developer-docs | behavior-changes
```

### 3.7 Alternatives (소스 충돌 보존)

친화도(§4.3)를 통과한 비-1순위 소스 값은 노드 본문에 들어가지 않지만 `alternatives.<fieldPath>`에 보존된다:

```yaml
alternatives:
  description:
    - value: "(developer-docs version)"
      provenance:
        source: developer-docs
        url: "..."
        fetchedAt: "..."
```

정보 손실을 0으로 만들기 위함이며, surface가 필요 시 alternative를 노출할 수 있다.

### 3.8 스키마 패키지

`@acref/schema` (Zod 기반):

```typescript
import { z } from 'zod';

export const ApiLevel = z.number().int().min(1).max(99);

const VersionRangeKey = z.string().regex(
  /^(\d+(\.\.\d+)?|\d+\.\.|\.\.\d+|\.\.)$/
);

export const Versioned = <T extends z.ZodTypeAny>(inner: T) =>
  z.union([inner, z.record(VersionRangeKey, inner)]);

export const SourceId = z.enum([
  'aosp-code', 'aidl', 'javadoc-html', 'developer-docs', 'behavior-changes',
]);

export const ProvenanceEntry = z.object({
  source: SourceId,
  repo: z.string().url().optional(),
  ref: z.string().optional(),
  path: z.string().optional(),
  lineRange: z.tuple([z.number(), z.number()]).optional(),
  url: z.string().url().optional(),
  fetchedAt: z.string().datetime(),
});

const NodeBase = z.object({
  id: z.string().min(1),
  shortId: z.string().optional(),
  kind: z.enum(['ApiClass', 'ApiMethod', 'FrameworkSymbol', 'HalSymbol', 'Permission']),
  displayName: z.string(),
  since: ApiLevel.optional(),
  deprecatedSince: ApiLevel.optional(),
  removedSince: ApiLevel.optional(),
  description: Versioned(z.string()).optional(),
  provenance: z.array(ProvenanceEntry).min(1),
  alternatives: z.record(z.string(), z.array(z.object({
    value: z.unknown(),
    provenance: ProvenanceEntry,
  }))).optional(),
});

const Family = z.enum(['camera1', 'camera2', 'cameraX']);

export const ApiMethodNode = NodeBase.extend({
  kind: z.literal('ApiMethod'),
  family: Family,
  ownerClass: z.string(),
  methodName: z.string(),
  canonicalParams: z.array(z.string()),
  returnType: z.string().optional(),
  signature: Versioned(z.object({
    parameters: z.array(z.object({ name: z.string(), type: z.string() })),
    returnType: z.string(),
    modifiers: z.array(z.string()),
  })),
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

// ApiClass / FrameworkSymbol / HalSymbol / Permission 도 동일한 패턴으로 정의
```

전체 노드 YAML 예시는 **부록 A** 참조.

---

## 4. 추출기 · 소스 해소

### 4.1 패키지별 책임

#### `@acref/extractor-core`

추출기 *자체가 아닌* 공통 인프라.

- 소스 우선순위 + 필드 친화도 머저 (§4.3)
- Provenance 헬퍼 (ISO timestamp, `ProvenanceEntry` 생성)
- 트레이스 조이너 (§4.4)
- ID 합성 유틸 (canonical params 정규화, short ID 생성)
- Sparse checkout 캐시 헬퍼 (ref 기반 immutable cache)

#### `@acref/extractor-aosp`

가장 무거움. AOSP 트리를 sparse checkout으로 가져와 raw 심볼·호출 엣지·HAL 인터페이스를 emit.

```typescript
interface AospExtractInput {
  target: string;
  family: 'camera1' | 'camera2' | 'cameraX' | 'framework' | 'hal';
  cacheDir: string;
}

interface AospExtractOutput {
  nodes: Node[];
  callEdges: CallEdge[];
  binderAnchors: BinderAnchor[];
}
```

**처리 대상 서브트리**:
- camera1 / camera2: `frameworks/base/core/java/android/hardware/camera*`
- CameraX: `platform/frameworks/support` 의 androidx-camera 모듈 (별 ref tag)
- Framework C++ 서비스: `frameworks/av/services/camera`, `frameworks/av/camera`
- HAL 인터페이스: `hardware/interfaces/camera`
- 권한: `frameworks/base/core/res/AndroidManifest.xml`

**파서 선택 (v1)**:
- Java → `java-parser` (chevrotain 기반)
- C++ → `tree-sitter-cpp` (libclang은 v1 비스코프)
- AIDL → 자체 미니 PEG/chevrotain 파서
- HIDL → 자체 미니 PEG/chevrotain 파서
- XML → `fast-xml-parser`

#### `@acref/extractor-javadoc`

javadoc HTML(developer.android.com/reference 또는 로컬 javadoc 빌드)로 description/since/deprecatedSince 보강. 이미 aosp가 만든 노드의 본문 필드를 채우는 게 주 역할.

- HTML 파서: `cheerio`
- 캐시: URL + ETag/Last-Modified 조건부 GET
- Rate limit: 페이지당 200-500ms, 동시 4 connection

#### `@acref/extractor-docs`

`developer.android.com/training/camerax/...` 가이드 + `source.android.com/docs/core/camera/...` Framework 문서. v1에서는 가이드 안 코드 스니펫에 함께 언급되는 API들을 `relatedTo` 약한 엣지로 추출.

#### (옵션) `@acref/extractor-behavior-changes`

`developer.android.com/about/versions/<n>/behavior-changes-<n>`. v1.x 후보, v1.0 비포함.

### 4.2 파이프라인 오케스트레이션

CLI(`@acref/cli`)가 thin orchestrator:

```
acref extract --target=android-15.0.0_r1 --target=android-14.0.0_r36
  │
  ├─ per target × family (CI matrix, 병렬)
  │    ├─ extractor-aosp
  │    ├─ extractor-javadoc
  │    └─ extractor-docs
  │
  ├─ stage/<target>/<extractor>/<family>/*.yaml
  │
  ├─ extractor-core merger (per target):
  │    1. 노드 ID 그룹핑
  │    2. 필드 친화도 필터링
  │    3. 전역 우선순위로 1순위 결정
  │    4. 비-1순위 친화 값을 alternatives에 추가
  │    5. 트레이스 조이너 실행
  │    6. generated/<target>/<family>/<...>.yaml emit
  │
  └─ 모든 target 완료 → validate → build → publish
```

병렬성 단위는 `target × extractor × family`. merger는 target 단위에 모인다.

### 4.3 소스 우선순위 · 필드 친화도

#### 전역 우선순위 (높은 → 낮은)

```
1. aosp-code        (컴파일러가 검증한 사실)
2. aidl/hidl        (인터페이스 진실 소스)
3. javadoc-html     (관용 서술, since/deprecated 주석)
4. developer-docs   (가이드, 의도)
5. behavior-changes (버전 차이 메타)
```

#### 필드 친화도 표 (v1)

| 필드 | 신뢰 소스 |
|---|---|
| `signature.parameters` | `[aosp-code, aidl]` |
| `signature.returnType` | `[aosp-code, aidl]` |
| `signature.modifiers` | `[aosp-code]` |
| `tracesToFramework` | `[aosp-code]` |
| `tracesToHal` | `[aosp-code]` |
| `methodOf` / `ownerClass` | `[aosp-code]` |
| `description` | `[javadoc-html, developer-docs]` |
| `since` | `[aosp-code, javadoc-html]` |
| `deprecatedSince` | `[aosp-code, javadoc-html]` |
| `removedSince` | `[aosp-code]` |
| `requiresPermission` | `[aosp-code, javadoc-html]` |
| `replacedBy` | `[aosp-code, javadoc-html, developer-docs]` |
| `tags` | `[developer-docs, javadoc-html]` |
| `behaviorChangedIn` (v1.x) | `[behavior-changes, javadoc-html]` — behavior-changes 추출기 자체가 v1.x 후보이므로 필드도 그때 활성화 |

이 표는 `@acref/extractor-core` 안에 코드 룰로 둔다 (콘텐츠 아님).

#### 머지 알고리즘

```
for each (nodeId, fieldPath):
  candidates = streams 중 fieldPath에 값을 가진 (source, value) 들
  affinity = 필드 친화도 표.lookup(fieldPath) || allSources
  filtered = candidates where source in affinity
  if filtered empty: 필드 누락 (validators가 잡음)
  else:
    sorted = filtered.sortBy(source -> globalPriority.index)
    chosen = sorted[0]
    alternatives = sorted[1:].map(c -> { value: c.value, provenance: c.prov })
    setField(node, fieldPath, chosen.value)
    if alternatives non-empty:
      node.alternatives[fieldPath] = alternatives
```

### 4.4 트레이스 엣지 추출 전략

`tracesToFramework` / `tracesToHal` 은 정적 분석의 산물. App → Framework → HAL 사이 여러 언어/바인더 경계를 단일 컴파일러로 풀 수 없다.

#### 1단계: 레이어별 raw call graph

extractor-aosp가 각 레이어 안에서 호출 그래프 산출:

- **Java→Java**: 메서드 본문이 호출하는 다른 메서드. import + 같은 패키지로 resolution. 미해결은 `unresolved` 마킹.
- **Java→AIDL stub mapping**: AIDL 파서로 `interface ICameraService {...}` 정의 → Java 코드의 `ICameraService.Stub` / `Stub.Proxy` 호출을 AIDL 메서드로 매핑.
- **C++ binder→AIDL impl**: C++ 측 `BnCameraService` 같은 상속, `onTransact` 분기 추출.
- **C++→C++**: tree-sitter-cpp 기반 호출 식별.
- **C++→HIDL/AIDL HAL call**: HAL 인터페이스 호출 (`ICameraDeviceSession::processCaptureRequest`) 식별.

#### 2단계: extractor-core 트레이스 조이너

```
입력: 모든 추출기의 callEdges + binderAnchors

for each ApiMethod node m_app:
  frontier = { m_app }
  visited = {}
  framework_hits = []
  hal_hits = []
  while frontier and depth <= MAX_DEPTH:
    next = expand(frontier, callEdges)
    for n in next:
      if n is FrameworkSymbol: framework_hits.append((n, depth))
      if n is HalSymbol: hal_hits.append((n, depth))
      if n is at binder boundary: follow binderAnchors mapping
    frontier = next - visited
    visited += next
  m_app.tracesToFramework = closest-k(framework_hits)
  m_app.tracesToHal       = closest-k(hal_hits)
```

#### 3단계: 버전 키 자동 생성

같은 m_app의 trace 결과가 target tag별로 다르면 extractor-core가 모든 target의 결과를 모아 per-field version map 자동 생성. 인접한 target에 같은 값이면 구간 키로 압축.

#### 4단계: 품질 한계 인정

정적 분석 한계 — lambda · virtual dispatch · reflection · dlopen · JNI 경계에서 호출이 끊긴다. v1.0은 best-effort + provenance 명시.

v1.x에서는 끊김 지점에 **트레이스 앵커**를 `@acref/extractor-core` 코드로 추가한다. 예: "CameraDeviceClient.cpp의 mServer.callOnX() → ICameraService.onX" 같은 known binding을 코드 룰로 명시. 이는 컴파일러가 풀 수 없는 dispatch에 대한 *정적 사실*의 기술이지 콘텐츠가 아니다.

### 4.5 캐싱 · 결정성

- **Sparse checkout 캐시**: `cacheDir/<ref>/<subtree>`. ref가 tag면 immutable.
- **파서 출력 캐시**: `(path, sha)` → AST 캐시.
- **HTTP 캐시**: ETag + `If-None-Match`.
- **결정성**: 같은 `(target, family, source config)` → 같은 출력 보장.
- **fetchedAt 정규화**: 인덱스 빌드 시 날짜만 보존 (시각 drop), noise 감소.

### 4.6 속도 목표

v1.0 first run: 최신 3 target × all extractors → GitHub-hosted ubuntu-latest 4코어에서 약 30분 이내. 초과 시 self-hosted runner 옵션은 v1.x.

---

## 5. 검증 · 테스트

### 5.1 Validator 4종 + 1 보고

| Validator | 입력 | Fail vs Warn |
|---|---|---|
| `schema` | generated YAML | **fail** |
| `xref` | generated 전체 (참조 그래프) | **fail** |
| `coverage` | AOSP `api/current.txt` + CameraX `api/<v>.txt` 대비 누락 | **warn** (v1.0; 후속에서 fail로 승격) |
| `freshness` | provenance ref vs target spec | **warn** |
| `conflicts` (보고) | 친화도 통과 비-1순위 alternatives | **warn**, 데이터엔 보존됨 |

### 5.2 Validator 출력

```
dist/validation/
├── summary.json
├── schema-errors.json
├── xref-broken.json
├── coverage-missing.json
├── freshness-drift.json
└── conflicts.json
```

매 빌드 CI artifact 업로드, 빌드간 diff 가능.

### 5.3 실행 순서 및 strict 모드

```
schema  → fail-fast
xref    → fail-fast
coverage → warn (v1.0)
freshness → warn
conflicts → 항상 emit
```

`acref validate --strict`: 모든 warn = fail. publish CI는 기본 strict, PR CI는 non-strict (개발 중 부분 데이터 허용).

### 5.4 Coverage 데이터 소스

- AOSP `frameworks/base/api/current.txt` — Android SDK public API 시그니처. `android.hardware.camera*` 필터링.
- AndroidX `camera/camera-core/api/<version>.txt` (각 CameraX 모듈)

빌드 시 expected node ID set 생성 → 실제 generated 노드 ID set과 diff. `removedSince` 마킹 노드는 제외.

### 5.5 테스트 5층

1. **단위** (Vitest 또는 node:test): 각 패키지. 스키마 만족/불만족, 버전 키 regex edge case, ID round-trip, 머저 결정 트리, 트레이스 조이너 그래프 알고리즘, 파서 미니 스니펫.
2. **통합** (mini-aosp fixture): `extractor-aosp/test/fixtures/mini-aosp/` 가짜 트리에 실제 파이프라인 실행. 노드 set / trace 엣지 / coverage 100% 검증.
3. **스냅샷**: mini-aosp 추출 결과 YAML을 `__snapshots__/`. PR 본문에 변경 요약 의무.
4. **골든** (트레이스 조이너): 명시적 trace assertion 표 (yaml). 알고리즘 변경 민감, 별도 세트.
5. **속성** (`fast-check`): 버전 키 비-겹침, ID round-trip, 머저 순서 독립성.

(옵션) **E2E AOSP smoke** (월 1회 cron): 실 AOSP 최신 1 태그 풀 추출 시도. schema/xref만 PASS면 OK. 추출기 깨짐 조기 감지.

### 5.6 Fixture 디자인

- 최소 + 의미: 200줄 Java + 100줄 C++로 한 layer 한 trace 시연
- 버전 차이 흉내: `mini-aosp/v1`, `mini-aosp/v2`
- 에러 시드: `broken-aosp/` 로 validator 양/음성 검증
- AOSP 원본 인용 금지: 재현 코드만 (라이선스/저작권 회피)

### 5.7 CI 게이팅 (PR vs extract vs publish)

| 단계 | PR | extract workflow | publish |
|---|---|---|---|
| lint + 단위 | ✅ | ✅ | ✅ |
| 통합 (mini-aosp) | ✅ | ✅ | ✅ |
| 스냅샷 | ✅ | — | — |
| 골든 | ✅ | ✅ | ✅ |
| 속성 (작은 N) | ✅ | — | ✅ (큰 N) |
| 실 AOSP 풀 추출 | ❌ | ✅ | ✅ strict |
| schema validator | — | fail-fast | fail-fast |
| xref validator | — | fail-fast | fail-fast |
| coverage validator | — | warn | warn (v1.0) |
| freshness validator | — | warn | warn |

---

## 6. 배포 · CI

### 6.1 `@acref/data` 패키지

```
packages/data/
├── package.json
├── dist/
│   ├── index.json
│   ├── index.json.gz
│   ├── reverse/{byHal,byFrameworkSymbol,byTag,byPermission}.json
│   └── meta.json
├── src/
│   ├── index.ts
│   ├── lookup.ts
│   ├── trace.ts
│   ├── version.ts
│   └── search.ts
└── README.md
```

API:

```typescript
import {
  getNode, getNodes,
  resolveVersioned,
  findByShortId, findBySimpleName,
  tracesToFrameworkOf, tracesToHalOf,
  reverseTraceFromHal,
  migrationsOf,
  search,
  meta,
} from '@acref/data';
```

v1.0은 eager 로드. lazy slice는 v1.x.

### 6.2 GitHub Releases

`v0.X.Y` 태그마다 artifact:

| 파일 | 무엇 |
|---|---|
| `acref-data-v0.X.Y.tar.gz` | dist 전체 |
| `index.json.gz` | 단일 파일 |
| `validation-report-v0.X.Y.tar.gz` | dist/validation/ |
| `manifest.json` | targets, schemaVersion, build env |

### 6.3 버전 정책

semver:

```
v0.X.Y
   │ │ └── PATCH: 같은 target, 추출 개선/추출기 버그 수정
   │ └──── MINOR: 신규 target, 신규 노드 종류, 비-깨짐 schema 확장
   └────── MAJOR: schema breaking, ID 형식 변경, edge 의미 변경
```

v1.0 도달 전(0.x): MINOR도 breaking 가능 명시.

`meta.json`에 `schemaVersion` 별도 박아 surface 호환 검사 가능:

```json
{ "dataVersion": "0.3.0", "schemaVersion": "0.2.1", "targets": ["..."] }
```

### 6.4 워크플로우 3종

전체 YAML은 **부록 B** 참조. 핵심:

#### `.github/workflows/extract.yml`

- 트리거: `workflow_dispatch` (inputs: `targets`, `publish`, `strict`)
- Matrix: `target × family` 병렬
- 단계: sparse checkout 캐시 → extract → upload artifact → merge → validate → build → (옵션) publish
- **publish job은 GitHub Environment `npm-publish`의 required reviewers로 사람 승인 게이트**

#### `.github/workflows/poll.yml`

- 트리거: `schedule: cron '0 3 1 * *'` (매월 1일 03:00 UTC) + `workflow_dispatch`
- `scripts/poll-aosp-tags.ts`가 `git ls-remote android.googlesource.com` 결과를 known-tags와 diff
- 새 태그 발견 시 이슈 자동 생성 (label: `aosp-tag`, `extraction`)

#### `.github/workflows/ci.yml`

- 트리거: push/pull_request
- 단계: lint → unit → integration(mini-aosp) → golden → property(작은 N) → build (publish 안 함)

### 6.5 시크릿 · 권한

| 시크릿 | 용도 |
|---|---|
| `NPM_TOKEN` | `@acref/data` publish |
| `GITHUB_TOKEN` | 자동 (Releases / issue) |

Workflow permissions: `contents: write`, `issues: write`, `packages: write`.

### 6.6 `apps/docs` 정적 사이트 — v1.0 비포함

공개 열람은 본질상 "surface" — 결정 #0에 따라 별 sub-project. monorepo 구조에 자리(`apps/docs/`)만 비워둔다.

---

## 7. 비스코프 · 미래 자리 · 위험

### 7.1 v1.0 비스코프 (재확인)

§1.3 + §F에 분산된 내용 통합:

**Surface 영역 전체** (별 sub-project):
- `acref-mcp` (MCP 서버)
- `acref-tui` (사용자용 CLI)
- `acref-agent` (Claude Code 등 skill)
- `acref-ide` (Android Studio/IntelliJ 플러그인)
- `acref-browser-ext` (브라우저 익스텐션)

**Core 안의 부재**:
- 사람 작성 콘텐츠 레이어 (overlay)
- 임베딩/시맨틱 검색
- vendor HAL 구현체 분석
- 런타임 trace (dumpsys/logcat/atrace)
- Kotlin source
- libclang 정밀 C++
- AOSP CI 산출물 활용 (`framework.xml` 등)
- behavior-changes 추출기
- `apps/docs` 정적 사이트
- lazy slice 로드
- CDN/delta 업데이트
- 카메라 도메인 룰 validator
- SBOM/Sigstore 서명

**추상화 미루기**:
- `Capability` / `Concept` 상위 추상 노드
- `ApiField` / `ApiConstant` 노드 종류

### 7.2 미래 자리 (monorepo hook)

```
acr/
├── packages/
│   ├── extractor-behavior-changes/  ⬜ v1.x
│   └── extractor-kotlin/            ⬜ v1.x
├── apps/
│   └── docs/                        ⬜ v1.x
├── scripts/
│   └── stats.ts                     ⬜ v1.x
└── .github/workflows/
    └── e2e-smoke.yml                ⬜ 옵션
```

구조 재변경 없이 drop-in.

### 7.3 위험

1. **트레이스 엣지 품질**: 정적 분석 한계 — lambda/virtual/JNI 끊김. *대응*: 골든 N개를 baseline으로, v1.x에서 트레이스 앵커 추가.
2. **AOSP 디렉토리 변경**: sparse checkout 경로 깨짐. *대응*: 추출기 시작에 구조 sanity check, 월간 poll로 조기 감지.
3. **npm 패키지 크기**: gzip 5-10MB 추정. browser surface 등장 시 부담. *대응*: v1.0은 측정만, lazy slice v1.x.
4. **추출 CI 비용**: 정상 운영은 무료 한도, 백필 1회성. *대응*: 백필은 한 번 잘 돌리면 끝.
5. **developer.android.com URL 안정성**: 리뉴얼 시 selector 깨짐. *대응*: selector를 한 파일에 모음, 단일 PR 복구.
6. **추출기-스키마 동시 진화**: 스키마만 바꾸고 추출기를 안 따라가면 vacuous 통과 가능. *대응*: validator coverage가 "필수 필드 빈 노드 N개" 카운트 → 회귀 감지.

### 7.4 Sub-project 분기 우선순위 (참고)

본인 즉시 가치 + 데이터 검증 효과:

1. `acref-mcp`
2. `acref-tui`
3. `acref-ide`
4. `acref-browser-ext`
5. `acref-agent`

각 sub-project는 별도로 brainstorming → spec → plan 사이클.

### 7.5 라이선스 점검 메모

- 코드: 본 repo `LICENSE` (현재 MIT). 변경 시 별도 결정.
- 추출 데이터: AOSP는 Apache 2.0. 추출 메타데이터는 fair use 영역으로 추정.
- **v1.0 publish 전 OSS 라이선스 점검 도구 (예: ScanCode)로 매트릭스 확인 필요.**

---

## 8. 미해결 질문

디자인 단계에서 *결정 미룬* 항목 (대부분 implementation plan에서 다룸):

1. **트레이스 조이너 MAX_DEPTH 및 closest-k 휴리스틱 구체값**: 실제 콜 그래프 모양 보고 v0.x에서 튜닝.
2. **CameraX androidx ref tag와 AOSP target tag 매핑**: 두 릴리즈 사이클이 다름. v0.x에서 매핑 규칙 결정.
3. **Java parser의 unresolved import 처리**: warning vs error. 첫 통합 테스트에서 결정.
4. **HAL version 표기 (`_v3.4` vs `@3.4`)**: ID 표기와 surface URL 안정성 동시 만족하는 선택. 첫 구현에서 결정.
5. **빌드 산출물 크기 한계**: gzip 후 몇 MB까지 npm publish 허용할지. 실 측정 후.
6. **OSS 라이선스 최종 결정**: 위 §7.5.

---

## 9. 결정 로그 요약

| # | 결정 항목 | 값 |
|---|---|---|
| 0 | 프로젝트 형태 | monorepo 키트 (Core + 미래 surfaces). v1 Core만 |
| 1 | 콘텐츠 소스 | 자동 추출 only, 사람 작성 레이어 없음 |
| 2 | 토픽 스코프 | App entry + Framework/HAL trace (교차) |
| 3 | API family | camera1 / camera2 / cameraX. family간 마이그레이션 edge 1급 |
| 4 | 데이터 모델 | lightweight knowledge graph, canonical YAML, JSON index |
| 5 | AOSP 버전 | C(다중 버전) + F(per-field versioned), API 21+, v1 first drop은 최신 3개 |
| 6 | 소스 충돌 | 전역 우선순위 + 필드 친화도, alternatives 보존 |
| 7 | generated/ git | gitignore + GitHub Releases + npm `@acref/data` |
| 8 | 재추출 트리거 | 수동 `workflow_dispatch` + 월간 cron AOSP 폴링 이슈 |
| 9 | 노드 ID | 구조화 + canonical signature + display/short + `aliases.yaml` |
| 10 | 이름 / 약자 | `android-camera-reference` / `acref` (CLI, npm scope) |
| §A | repo layout | monorepo, packages/{schema, extractor-{core,aosp,docs,javadoc}, validators, indexer, data, cli} |
| §B | 스키마 | Zod, NodeBase + 5종 kind, 버전 구간 키, provenance 1급, alternatives 보존 |
| §C | 추출기 | 책임 분리, Java/cpp/aidl/hidl 파서 선택, 트레이스 조이너 |
| §D | 검증·테스트 | validators 4+1, 테스트 5층, fixture 원칙 |
| §E | 배포·CI | `@acref/data` npm + Releases, 3개 워크플로우, publish 승인 게이트 |
| §F | 비스코프 | surfaces 전체 + Core 안 부재 항목 명시, 미래 자리 + 위험 |

---

## 10. 용어

- **acref**: android-camera-reference 의 약자. CLI · npm scope · short ref.
- **knowledge graph**: 타입 있는 노드 + 타입 있는 엣지로 표현된 지식 구조. 본 프로젝트에서는 graph DB 없이 YAML + JSON index로 인코딩.
- **canonical params**: 메서드 파라미터 타입의 FQN 리스트, 제네릭/와일드카드/이름 제거 형태. 노드 ID의 일부.
- **per-field versioned**: 한 노드가 N개 버전 스냅샷을 갖지 않고, 변화하는 필드만 버전 구간 키로 다중 값을 갖는 모델.
- **provenance**: 한 사실의 출처 메타. repo/ref/path/lineRange 또는 URL + fetchedAt.
- **친화도 (affinity)**: 어느 필드를 어느 소스에서 채울지 명시한 매핑. 전역 우선순위에 우선하여 적용됨.
- **alternatives**: 친화도 통과한 비-1순위 소스 값들. 노드 본문엔 못 들어가나 손실되지 않게 보존.
- **트레이스 조이너 (trace joiner)**: extractor-core 안의 컴포넌트. 레이어별 raw call graph + binder anchor를 결합해 `tracesToFramework` / `tracesToHal` 엣지 생성.
- **트레이스 앵커**: 정적 분석으로 끊긴 호출 경로를 코드 룰로 명시한 매핑. 콘텐츠가 아니라 컴파일러 한계에 대한 정적 사실의 기술.
- **mini-aosp fixture**: 통합 테스트용 가짜 AOSP 트리. AOSP 원본을 인용하지 않은 재현 코드.

---

## 부록 A: 노드 YAML 예시 (전체)

`generated/android-15.0.0_r1/cameraX/androidx/camera/core/ImageCapture/takePicture~0.yaml`:

```yaml
id: "cameraX/androidx/camera/core/ImageCapture/takePicture(java.util.concurrent.Executor,androidx.camera.core.ImageCapture$OnImageCapturedCallback)"
shortId: "cameraX/ImageCapture#takePicture~0"
kind: ApiMethod
family: cameraX
displayName: "ImageCapture.takePicture(Executor, OnImageCapturedCallback)"
ownerClass: "cameraX/androidx/camera/core/ImageCapture"
methodName: takePicture
canonicalParams:
  - java.util.concurrent.Executor
  - androidx.camera.core.ImageCapture$OnImageCapturedCallback
returnType: void
since: 21
description:
  "..": |
    이미지 한 장을 캡처하여 콜백으로 전달한다. 내부적으로 CameraX의
    UseCase 머징 단계를 거쳐 Camera2의 CaptureRequest로 변환된다.
signature:
  "..":
    parameters:
      - { name: executor, type: java.util.concurrent.Executor }
      - { name: callback, type: androidx.camera.core.ImageCapture$OnImageCapturedCallback }
    returnType: void
    modifiers: [public]
tracesToFramework:
  "21..28":
    - "framework/android/hardware/camera2/CameraCaptureSession#capture(android.hardware.camera2.CaptureRequest,android.hardware.camera2.CameraCaptureSession$CaptureCallback,android.os.Handler)"
  "29..":
    - "framework/android/hardware/camera2/CameraCaptureSession#capture(android.hardware.camera2.CaptureRequest,java.util.concurrent.Executor,android.hardware.camera2.CameraCaptureSession$CaptureCallback)"
tracesToHal:
  "21..27":
    - "hal/ICameraDeviceSession::processCaptureRequest_v3.2"
  "28..33":
    - "hal/ICameraDeviceSession::processCaptureRequest_v3.4"
  "34..":
    - "hal/ICameraDeviceSession::processCaptureRequest_v3.7"
replacedBy: []
migratedFrom:
  - "camera1/android/hardware/Camera/takePicture(android.hardware.Camera$ShutterCallback,android.hardware.Camera$PictureCallback,android.hardware.Camera$PictureCallback)"
  - "camera2/android/hardware/camera2/CameraCaptureSession/capture(android.hardware.camera2.CaptureRequest,android.hardware.camera2.CameraCaptureSession$CaptureCallback,android.os.Handler)"
requiresPermission:
  - "permission/android.permission.CAMERA"
tags: [still-capture, jpeg]
provenance:
  - source: aosp-code
    repo: https://android.googlesource.com/platform/frameworks/support
    ref: androidx-camera-release
    path: camera/camera-core/src/main/java/androidx/camera/core/ImageCapture.java
    lineRange: [1234, 1289]
    fetchedAt: "2026-05-29T00:17:00Z"
  - source: javadoc-html
    url: "https://developer.android.com/reference/androidx/camera/core/ImageCapture#takePicture(java.util.concurrent.Executor,androidx.camera.core.ImageCapture.OnImageCapturedCallback)"
    fetchedAt: "2026-05-29T00:17:00Z"
alternatives:
  description:
    - value: "(developer-docs version of description)"
      provenance:
        source: developer-docs
        url: "https://developer.android.com/training/camerax/take-photo"
        fetchedAt: "2026-05-29T00:17:00Z"
```

---

## 부록 B: 워크플로우 YAML

### B.1 `.github/workflows/extract.yml`

```yaml
name: extract
on:
  workflow_dispatch:
    inputs:
      targets:
        description: "공백 구분 AOSP tag list (e.g. android-15.0.0_r1 android-14.0.0_r36)"
        required: true
      publish:
        description: "publish to npm + create release"
        type: boolean
        default: false
      strict:
        description: "strict validation"
        type: boolean
        default: true

permissions:
  contents: write
  packages: write

jobs:
  parse:
    runs-on: ubuntu-latest
    outputs:
      targets: ${{ steps.split.outputs.targets }}
    steps:
      - id: split
        run: |
          # "android-15.0.0_r1 android-14.0.0_r36" → ["android-15.0.0_r1","android-14.0.0_r36"]
          targets_json=$(echo "${{ inputs.targets }}" | jq -R 'split(" ") | map(select(length>0))')
          echo "targets=${targets_json}" >> "$GITHUB_OUTPUT"

  extract-matrix:
    needs: parse
    strategy:
      fail-fast: false
      matrix:
        target: ${{ fromJSON(needs.parse.outputs.targets) }}
        family: [camera1, camera2, cameraX, framework, hal]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20.9.0', cache: 'pnpm' }
      - uses: pnpm/action-setup@v3
      - run: pnpm install --frozen-lockfile

      - name: AOSP sparse checkout cache
        uses: actions/cache@v4
        with:
          path: .cache/aosp/${{ matrix.target }}
          key: aosp-${{ matrix.target }}-v1

      - name: Extract
        run: |
          pnpm acref extract \
            --target=${{ matrix.target }} \
            --family=${{ matrix.family }} \
            --cache-dir=.cache/aosp/${{ matrix.target }} \
            --out=stage/${{ matrix.target }}/${{ matrix.family }}

      - uses: actions/upload-artifact@v4
        with:
          name: stage-${{ matrix.target }}-${{ matrix.family }}
          path: stage/${{ matrix.target }}/${{ matrix.family }}

  merge-validate-build:
    needs: extract-matrix
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20.9.0', cache: 'pnpm' }
      - uses: pnpm/action-setup@v3
      - run: pnpm install --frozen-lockfile

      - uses: actions/download-artifact@v4
        with: { path: stage/ }

      - run: pnpm acref merge stage/ --out=generated/
      - run: pnpm acref validate ${{ inputs.strict && '--strict' || '' }} --out=dist/validation/
      - run: pnpm acref build --out=dist/

      - uses: actions/upload-artifact@v4
        with: { name: dist, path: dist/ }

  publish:
    if: ${{ inputs.publish }}
    needs: merge-validate-build
    runs-on: ubuntu-latest
    environment: npm-publish   # required reviewers 게이트
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20.9.0'
          registry-url: https://registry.npmjs.org
      - uses: actions/download-artifact@v4
        with: { name: dist, path: packages/data/dist }

      - run: pnpm install --frozen-lockfile

      - id: ver
        run: |
          version=$(node -p "require('./packages/data/package.json').version")
          echo "version=${version}" >> "$GITHUB_OUTPUT"

      - run: pnpm -F @acref/data publish --access public
        env: { NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }} }

      - name: Tarball
        run: |
          tar -czf acref-data-${{ steps.ver.outputs.version }}.tar.gz -C packages/data dist
          tar -czf validation-report-${{ steps.ver.outputs.version }}.tar.gz -C packages/data/dist validation
      - name: Release
        uses: softprops/action-gh-release@v2
        with:
          tag_name: v${{ steps.ver.outputs.version }}
          files: |
            acref-data-*.tar.gz
            validation-report-*.tar.gz
            packages/data/dist/index.json.gz
            packages/data/dist/meta.json
```

### B.2 `.github/workflows/poll.yml`

```yaml
name: poll-aosp-tags
on:
  schedule:
    - cron: '0 3 1 * *'
  workflow_dispatch:

permissions:
  issues: write
  contents: read

jobs:
  poll:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20.9.0' }
      - run: npm ci

      - id: poll
        run: |
          node scripts/poll-aosp-tags.ts \
            --known=.cache/known-tags.json \
            --out=poll-result.json

      - name: Open issue if new tag
        if: steps.poll.outputs.has-new == 'true'
        uses: actions/github-script@v7
        with:
          script: |
            const fs = require('fs');
            const result = JSON.parse(fs.readFileSync('poll-result.json', 'utf8'));
            await github.rest.issues.create({
              owner: context.repo.owner,
              repo: context.repo.repo,
              title: `AOSP 새 태그 감지: ${result.newTags.join(', ')}`,
              body: `\`scripts/poll-aosp-tags.ts\` 가 새 태그를 발견했습니다.\n\n` +
                    result.newTags.map(t => `- \`${t}\``).join('\n') +
                    `\n\n적절한 시점에 \`extract\` workflow를 \`targets=${result.newTags.join(' ')}\` 로 dispatch하세요.`,
              labels: ['aosp-tag', 'extraction']
            });
```

### B.3 `.github/workflows/ci.yml`

```yaml
name: ci
on:
  push: { branches: [main] }
  pull_request:

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20.9.0', cache: 'pnpm' }
      - uses: pnpm/action-setup@v3
      - run: pnpm install --frozen-lockfile

      - run: pnpm lint
      - run: pnpm test:unit
      - run: pnpm test:integration
      - run: pnpm test:golden
      - run: pnpm test:property
      - run: pnpm build
```
