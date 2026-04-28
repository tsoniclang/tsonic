# April 28 Cleanup Plan

This directory is the planning and tracking ledger for the strict-surface, NativeAOT-first cleanup wave.

The work is not a one-off downstream fix. It is a compiler/runtime/source-package alignment pass across:

- `tsonic`
- `globals`
- `core`
- `runtime`
- `js`
- `nodejs`
- `express-examples`
- `proof-is-in-the-pudding`
- `tsumo`
- `clickmeter`
- `jotster` validation after upstream fixes

The governing rule is that Tsonic is a strict compile-time language that lowers to C# and must remain compatible with pure native publication. Debuggable MSIL output is useful, but it is not allowed to define semantics that fail under NativeAOT.

## Current Priority Override

The immediate next task is not downstream cleanup, package publishing, or full-gate execution.

The interrupted task was the interim working-tree diff review. That review is now captured in:

- `.analysis/interim-review-apr28-A/00-index.md`
- `.analysis/interim-review-apr28-A/03-drift-and-airplane-review.md`
- `.analysis/interim-review-apr28-A/04-file-ledger.md`
- `.analysis/interim-review-apr28-A/05-required-actions.md`

The drift findings from that review are incorporated into `00-drift-first-recovery-plan.md`, which is now the first file in this plan and supersedes conflicting task ordering elsewhere in this directory.

The deeper semantic-authority review is incorporated into `11-semantic-authority-super-review.md`. That file is part of the active execution contract. It expands the drift block from individual symptoms into the core architectural repair: frontend/type-system proof first, emitter materialization second.

Execution order:

1. Preserve the interim diff review.
2. Fix drift from `00-drift-first-recovery-plan.md`.
3. Execute semantic-authority tasks from `11-semantic-authority-super-review.md`.
4. Reconcile remaining plan files against the repaired drift rules.
5. Resume compiler cleanup tasks.
6. Run the full Tsonic upstream gate with `./test/scripts/run-all.sh`.

For the `apr28-refactor` branch, downstream repositories are analysis inputs only. The execution goal is a clean upstream Tsonic run-all gate before opening the PR. Downstream cleanup resumes after this upstream branch is merged or explicitly re-scoped.

No further workstream may use downstream failures or convenience as permission to weaken the drift rules.

## Non-Negotiable Constraints

### TypeScript flow facts, Tsonic proof

Tsonic should not maintain a second, incomplete parser for TypeScript control-flow narrowing. TypeScript is the authority for whether a source expression is narrowed at a source site.

Tsonic remains the authority for whether the narrowed type can be represented, lowered, selected, and emitted safely.

The governing rule is:

```text
TypeScript proves the narrowed source type
+
Tsonic proves deterministic carrier, surface, numeric, overload, and NativeAOT lowering
=
accepted

otherwise
=
hard diagnostic
```

Accepted shape:

```ts
function read(value: unknown): string | undefined {
  if (typeof value === "string") {
    return value;
  }

  return undefined;
}
```

Rejected shape:

```ts
function readInt(value: unknown): int {
  if (typeof value === "number") {
    return value;
  }

  return 0;
}
```

Why rejected:

- TypeScript proves `number`.
- TypeScript does not prove Tsonic `int`.
- Numeric width/range/integrality proof belongs to Tsonic.

### Strict surfaces

The compiler must not invent JavaScript bridge behavior on the default/CLR surface.

Failing source shape:

```ts
export function size(xs: int[]): int {
  return xs.length;
}
```

Why this is invalid on the default surface:

- `xs` is a CLR array carrier.
- The CLR member is `Length`.
- JavaScript `.length` belongs to the JS surface.
- Accepting `.length` everywhere silently weakens the surface contract.

Correct default-surface source:

```ts
export function size(xs: int[]): int {
  return xs.Length;
}
```

Correct JS-surface source:

```ts
import "@tsonic/js/index.js";

export function size(xs: number[]): number {
  return xs.length;
}
```

The JS surface may define `.length`, `.slice`, `.map`, `.push`, `JSON`, `Array`, `Object`, and similar JavaScript APIs. Other surfaces may define their own members. The compiler must load those members from surface metadata and type identity, not from general-purpose hardcoded bridge rules.

### NativeAOT first

Forbidden as product semantics:

- runtime reflection-based dispatch
- `dynamic`
- `System.Reflection` property/method discovery as user-code behavior
- `Activator.CreateInstance` as language semantics
- dynamic JSON object walkers
- broad dictionary/object fallback for unknown object literals
- best-effort member lookup

Permitted:

- compile-time binding inspection
- source-generated closed metadata
- generated strongly typed calls
- closed `System.Text.Json` serializer calls
- explicit nominal classes and deterministic storage carriers

Example of forbidden behavior:

```ts
const parsed: unknown = JSON.parse(text);
return parsed["WorkspaceId"];
```

This requires runtime dynamic probing unless the compiler has proven a closed carrier and property. The cleanup must either support a deterministic closed narrowing mechanism or reject the source with a diagnostic.

### Standard JavaScript runtime syntax

Runtime-facing source must stay compatible with modern ECMAScript. TypeScript-only runtime-shape features are not allowed as implementation mechanisms.

Invalid runtime source:

```ts
class User {
  public readonly id: string;

  constructor(public readonly name: string) {}
}
```

Correct runtime source:

```ts
class User {
  id: string;
  name: string;

  constructor(id: string, name: string) {
    this.id = id;
    this.name = name;
  }
}
```

Type-only syntax remains allowed when erased:

```ts
type UserId = string;
interface UserShape {
  readonly id: string;
}
import type { int } from "@tsonic/core/types.js";
```

## Workstreams

0. Drift-first recovery from the interim diff review.
1. Current diff audit and compliance review.
2. Compiler hardcoding cleanup.
3. Surface isolation cleanup.
4. Dynamic/runtime reflection removal.
5. Object literal and JSON policy cleanup.
6. TypeScript-flow-backed narrowing with Tsonic proof.
7. Union/narrowing/type-identity correctness.
8. Jotster-reported generic compiler fixes.
9. First-party package cleanup.
10. Downstream cleanup.
11. Full validation gate.
12. Semantic authority consolidation.

Each workstream has a dedicated file in this directory with examples, expected behavior, risks, and tracking state.

## Current Working State

The cleanup is mid-implementation. The plan is authoritative; validation status is not final.

Live dirty path counts from the current workspace checkpoint:

| Repo | Dirty Paths | Meaning |
| --- | ---: | --- |
| `tsonic` | 473 | compiler, runtime policy, tests, fixtures, docs |
| `nodejs` | 402 | source syntax cleanup and broad-value cleanup |
| `js` | 55 | NativeAOT cleanup and surface tightening |
| `proof-is-in-the-pudding` | 31 | dependency refresh and source audit pending |
| `express-examples` | 19 | dependency/surface alignment |
| `runtime` | 11 | dynamic runtime removal |
| `core` | 3 | runtime declaration/API alignment |
| `globals` | 3 | default-global surface reduction |
| `tsumo` | 2 | dependency refresh and source audit pending |

Known focused checkpoint before this plan refresh:

- `tsonic`: `npm run build` passed earlier in this cleanup wave, before the latest narrowing-policy update.
- `js`: `npm run selftest` passed earlier with `38` tests.
- `tsonic` focused regression batch had `8` passing and `2` failing before the latest plan refresh.

These are checkpoints only. They are not final pass claims.

## Required Final Verification

The final gate for this cleanup is:

1. `tsonic`: `./test/scripts/run-all.sh`
2. `js`: full selftest
3. `nodejs`: full selftest
4. `express-examples`: full verification
5. `proof-is-in-the-pudding`: full verification
6. `tsumo`: full verification
7. `clickmeter`: full verification
8. `jotster`: validation/build against the cleaned package wave

Filtered tests are allowed only for iteration. They are not the final gate.
