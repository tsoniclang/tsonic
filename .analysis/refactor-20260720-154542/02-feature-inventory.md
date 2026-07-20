# 02 — Feature Inventory

Date: 2026-07-20. Status: method + verified current snapshot. The full
machine-joined inventory is step 1 of the cleanup plan (`05-cleanup-plan.md`);
this file defines the method and pins the current measured state.

## Method: One Connected Feature Graph

The inventory is hierarchical, not a flat ledger-only list. Ten node kinds
are reconciled into one graph, and every discovered public item must map to a
feature or an explicit non-product classification:

| Node kind | Where it lives today | Example |
|---|---|---|
| 1. Compiler/source decisions | TSTS public compiler contract | selected call signature, flow type, tuple ordinal |
| 2. Extension evidence contracts | TSTS extension API | checked-call request, retained operation, standard fact |
| 3. Shared Tsonic capabilities | `source-core`, `target-api`, host composition | portable marker fact, plugin ownership, source profile |
| 4. Source-visible APIs | source profiles and provider declarations | `node:fs.readFileSync` overloads |
| 5. Target-specific policy/facts | provider mapping rows and target plans | `calls.ts:157` readFileSync row, C# payload fact |
| 6. Backend lowering kinds | `tsonic-csharp/src/backend/planner/**` | `InvocationExpression` planning |
| 7. Runtime public APIs | exported .NET API metadata, not source-file counts | `fs.readFileSync` overloads |
| 8. Artifact/toolchain contracts | runtime descriptors and target artifacts | runtime DLL requirement, generated C# project |
| 9. Diagnostics/rejections | source, extension, target, and toolchain diagnostics | unmapped selected provider signature |
| 10. Proofs | discovered test IDs and execution reports | CLI generated-C#/runtime proof |

Reconciliation rules:

- The capability ledger is one input, **not** the sole authority. Declarations,
  extension hooks/facts, plugin contributions, backend planner entrypoints,
  runtime exports, and executable tests are independently enumerated and
  joined by canonical identity.
- Undocumented public items cannot disappear: every exported runtime member,
  provider row, shared capability, and planner entrypoint appears in the graph with a feature
  owner or an explicit `non-product` / `hard-reject` / `internal` disposition.
- Every edge is named: `declares`, `selects`, `maps`, `lowers`, `implements`,
  `proves`.
- Conflicting counts are resolved by canonical identity join, never by
  choosing one report.

### Mechanical Discovery And Join

Discovery is independent of the inventory records it validates:

| Domain | Discovery source | Canonical identity |
|---|---|---|
| Compiler/extension contracts | exported `@tsonic/tsts` declarations plus registered observation/fact keys | package export + request/fact key |
| Shared Tsonic capabilities | workspace packages, plugin manifests, source-core registrations, target-api envelopes | package/plugin/capability ID |
| Source-visible APIs | execute deterministic source-profile/provider declaration registries without user source | owner + module + export + member/signature identity |
| Target policy | enumerate declarative contribution rows; callbacks must declare stable conflict/operation identities | target + contribution owner + operation identity |
| Backend coverage | exhaustively enumerate target plan discriminants and supported public AST-handler entrypoints | target + plan/syntax kind |
| Runtime API | inspect built reference assemblies with deterministic build-time metadata tooling | assembly + namespace + type + exact member signature |
| Artifacts | enumerate immutable package/runtime descriptors | owner + artifact kind + canonical path/identity |
| Diagnostics | enumerate structured diagnostic definitions and rejection rows | owner + diagnostic code |
| Tests | use suite-definition discovery and machine-readable run reports | repository + file + exact test title/ID |

The join fails for every orphan: a provider declaration with no disposition,
a target row with no source identity, a backend plan with no producer, a
public runtime member with no provider/internal/remove classification, a
claimed proof absent from the runner report, or a product feature without the
proofs applicable to its kind. Static parsing and build-time metadata
inspection are inventory tooling only; they never become product semantic
input.

## Verified Current Snapshot (2026-07-20, measured)

Each number names its command. Reproduce before trusting.

### Tsonic (this repo, `94b9262b`, clean)

| Measure | Value | Command |
|---|---|---|
| Workspace packages | 5 (`tsts`, `source-core`, `target-api`, `host`, `cli`) | `package.json` `workspaces` |
| `host/src` TypeScript files | 22 | `find packages/host/src -name '*.ts' \| wc -l` |
| `source-core/src` TypeScript files | 10 | `find packages/source-core/src -name '*.ts' \| wc -l` |
| `target-api/src` TypeScript files | 9 | `find packages/target-api/src -name '*.ts' \| wc -l` |
| `packages/tsts` | vendored build artifact only (`dist/`, no `src/`) | `ls packages/tsts` |
| `packages/target-csharp` | empty directory (not a workspace) | `ls packages/target-csharp` |
| Root `test/*.mjs` | 18 | `ls test/*.mjs \| wc -l` |
| `test/cli-build/*.mjs` | 61: 60 `*.test.mjs` files plus `harness.mjs` | `find test/cli-build -maxdepth 1 -type f -name '*.mjs' \| wc -l` plus `find test/cli-build -maxdepth 1 -type f -name '*.test.mjs' \| wc -l` |
| Capability ledger rows | **328** (320 `complete`, 8 `not-started`) | `node --input-type=module -e 'import {capabilityLedger} from "./test/capabilities/ledger.mjs"; console.log(capabilityLedger.length)'` plus status grouping |
| Literal ledger tuples | 280; not the ledger size | `grep -cE '^\s+\["[a-z]' test/capabilities/ledger.mjs` |
| Generated ledger rows | 48 (12 source-core contract, 21 provider-call contract, 15 .NET contract) | import `capabilityLedger` and subtract literal tuple identities |
| TSTS issue register | 37 documents | `find .analysis/tsts-issues -maxdepth 1 -type f -name '*.md' \| wc -l` |

Ledger count note: `grep` sees only literal tuples and undercounts the
executable ledger. The exported `capabilityLedger` is authoritative for its
current row count: 328 rows, 320 complete, and eight Rust-future
`not-started` rows. The 48 generated rows come from the three contract-row
`.map(...)` expansions in `ledger.mjs`.

### tsonic-csharp (`24533fcc`, 30 dirty worktree entries)

| Measure | Value | Command |
|---|---|---|
| `src/source/csharp-source-semantics/**` files | 274 | `find src/source/csharp-source-semantics -name '*.ts' \| wc -l` |
| `src/backend/**` files | 185 | `find src/backend -name '*.ts' \| wc -l` |
| C# fact keys | 19 declarations; a line-based `FactKey` grep reports 20 because the import line also matches | `rg -c '^export const .*FactKey = defineExtensionFactKey' src/source/csharp-facts/keys.ts` |
| Top-level areas | `backend/{planner,roslyn}`, `descriptor`, `options`, `print/csharp-printer`, `providers/dotnet`, `source/{csharp-facts,csharp-source-semantics}`, `toolchain` | `find src -maxdepth 2 -type d` |

### csharp-nodejs (`08fd339b`, 3 modified files plus one self-symlink)

| Measure | Value | Command |
|---|---|---|
| Provider top-level filesystem entries | 24 (files and directories; not a feature count) | `find nodejs/src/provider -maxdepth 1 -mindepth 1 -printf '%f\n' \| wc -l` |
| Runtime `.cs` files | 283 | `find csharp/src -name '*.cs' \| wc -l` |
| Runtime child directories | 38 (`assert` … `zlib`; not a public-module count) | `find csharp/src/Tsonic.CSharp.Node -maxdepth 1 -mindepth 1 -type d \| wc -l` |
| Provider/runtime closure | not yet mechanically joined; source-file and directory counts are repository-size signals only | cleanup step 1 public-symbol/provider-export extraction |

### csharp-js (`df8a8f90`, 1 untracked self-symlink)

| Measure | Value | Command |
|---|---|---|
| Runtime source `.cs` files | 48 (`TsValue`, `JSObject`, `Array`, `Map`, `Set`, `Date`, `RegExp`, typed arrays, …) | `find src -type f -name '*.cs' \| wc -l` |
| Runtime test `.cs` files | 29 | `find tests -type f -name '*.cs' \| wc -l` |
| Total source + test `.cs` files | 77 | `find src tests -type f -name '*.cs' \| wc -l` |

### csharp-runtime (`6e25cee1`, 1 untracked self-symlink)

| Measure | Value | Command |
|---|---|---|
| Runtime source `.cs` files | 6 | `find src -type f -name '*.cs' \| wc -l` |
| Runtime test `.cs` files | 3 | `find tests -type f -name '*.cs' \| wc -l` |

### efcore (`97f17ce8`, clean)

| Measure | Value | Command |
|---|---|---|
| TypeScript provider source files | 1 | `find src -type f -name '*.ts' \| wc -l` |
| JavaScript test files | 1 | `find test -type f -name '*.mjs' \| wc -l` |
| Provider project | one `.csproj` provider/tooling project | `find . -type f -name '*.csproj' -not -path './.temp/*'` |

## Per-Feature Record Schema (to be generated)

The tracked canonical inventory lives under
`test/capabilities/inventory/*.mjs`, split by domain and aggregated by one
index. It replaces the monolithic ledger as an atomic migration; reports are
generated from it, not maintained as a second registry. Each feature record
has this shape:

```ts
type ProofKind =
    | "source-positive"
    | "source-negative"
    | "selected-evidence"
    | "finalized-fact"
    | "generated-target"
    | "runtime-behavior"
    | "artifact-toolchain";

interface FeatureRecord {
    featureId: string;            // canonical, e.g. "node.fs.readFileSync.text"
    title: string;
    layerPlacement: {             // filled per 01-four-layer model
        compilerDecision: string;       // L1 fact or "none"
        extensionEvidence: string[];    // L2 request/fact keys
        sharedCapability: string[];     // L3 envelopes used
        specificPolicy: string[];       // L4 rows/plans/runtime
    };
    declarations: string[];       // zero or more source/provider contracts
    operationPlans: string[];     // mapping row path:line
    backendLowering: string[];    // planner path:line
    runtimeImplementation: string[]; // .cs path
    proofRequirements: Record<ProofKind, {
        applicability: "required" | "not-applicable";
        reason?: string;          // mandatory for not-applicable
        evidence: string[];       // exact test IDs, not path-only claims
    }>;
    conformance: "conformant" | "drift" | "unclassified";
    driftRefs: string[];          // §numbers into 04-drift-inventory.md
    disposition: "product" | "hard-reject" | "internal" | "remove";
}
```

`unclassified` is a failing state: the acceptance gate
(`06-tests-scanners-acceptance.md`) requires zero unclassified public items.

## Known Inventory Hazards (to be closed by the join)

- **Runtime/provider closure not reconciled** (drift §18): the Node runtime
  contains 283 `.cs` files across 38 child directories, but files and
  directories are not public API counts. Extract the actual exported .NET
  symbols and provider exports independently. Every shipped runtime API must
  land in exactly one
  disposition: provider-reachable supported, provider-reachable hard-reject,
  internal, or removed.
- **Stale aggregate evidence paths** (drift §19): 10 positive and 9 negative
  evidence paths in the ledger did not exist at audit time; rows claiming
  proof without existing tests must degrade to non-`complete` until re-proven.
- **Tautological old-suite inventory** (drift §19): the "discovered" old path
  set is partly derivable from the classification inventory itself; the new
  discovery must be independent.
- **Fact-authority ambiguity** (drift §5): 19 C# fact keys exist. Some mirror
  standard TSTS meanings; others are legitimate C#-specific payloads. The
  inventory must classify each key before duplicate authorities are deleted.
