# Change Clusters and Correctness Review

## Cluster 1: `in` Operator Restricted To String-Key Dictionary Carriers

Files:

- `packages/frontend/src/validation/features.ts`
- `packages/frontend/src/ir/converters/expressions/operators.ts`
- `packages/frontend/src/ir/types/expressions-core.ts`
- `packages/emitter/src/expressions/operators/binary-dispatch.ts`
- frontend feature-gating tests
- docs language/pipeline updates

### Source Shape

```ts
type WorkspaceOwned = { WorkspaceId: string };

declare const value: WorkspaceOwned;

if ("WorkspaceId" in value) {
  // This used to be accepted as a closed declared-property check.
}
```

### Why That Was Unsound

A declared TypeScript property proves a static member shape; it does not prove JavaScript own-property existence semantics in emitted NativeAOT code. Emitting a dynamic own-property probe would require runtime reflection or object-shape discovery. Emitting `true` for declared members would silently change JavaScript semantics because `"WorkspaceId" in value` can be false for a value whose static type has `WorkspaceId`.

### Correct Accepted Shape

```ts
const bag: Record<string, string> = {};

if ("WorkspaceId" in bag) {
  bag["WorkspaceId"] = "workspace-1";
}
```

This is deterministic because the carrier has a string-key dictionary/indexer operation. The compiler can lower the check to a typed key operation without reflection.

### Genericness Review

- Generic: yes.
- Product-specific: no.
- Correctness: strong. The fix removes a semantic overreach instead of adding a compatibility path.
- NativeAOT: compatible. It only permits closed dictionary/indexer operations.

### Remaining Gap

This does not solve full structural `unknown` narrowing. That remains a separate closed-carrier design task. The correct follow-up is not to re-add declared-property `in` support through reflection; it is to model any approved unknown/object carrier in frontend IR with a closed NativeAOT-safe materialization plan.

## Cluster 2: Numeric Proof Before Integral Casts

Files:

- `packages/emitter/src/expressions/post-emission-adaptation.ts`
- `packages/frontend/src/ir/validation/numeric-classification.ts`
- `packages/frontend/src/ir/validation/numeric-expression-validation.ts`
- `packages/frontend/src/ir/validation/numeric-statement-processing.ts`
- numeric docs
- emitter regression tests

### Source Shape

```ts
import type { int } from "@tsonic/core/types.js";

declare function takeInt(value: int): void;

export function run(value: number): void {
  takeInt(value);
}
```

### Bad Behavior Before

The emitter could insert an integral cast as a materialization convenience:

```csharp
takeInt((int)value);
```

That was too weak. A JavaScript `number` is a double carrier. `value` might be `1.5`, `NaN`, or outside `Int32` range. A compiler-generated cast would silently narrow runtime values.

### Correct Behavior Now

The frontend validation rejects the implicit narrowing:

```text
TSN5101: Implicit narrowing not allowed
```

Users must provide deterministic proof:

```ts
import type { int } from "@tsonic/core/types.js";
import { Convert } from "@tsonic/dotnet/System.js";

declare function takeInt(value: int): void;

export function run(value: number): void {
  if (!Number.isInteger(value)) {
    throw new RangeError("value must be an integer");
  }

  takeInt(Convert.ToInt32(value));
}
```

### Genericness Review

- Generic: yes.
- Product-specific: no.
- Correctness: strong. The rule applies across calls, constructors, assignments, property initializers, arrow returns, loops, getters, setters, and exported declarations.
- NativeAOT: compatible. The emitted conversion is explicit and closed.

### Remaining Gap

Numeric classification still exists in more than one layer. `numeric-classification.ts` classifies numeric IR for validation, while `union-typeof-matching.ts` has its own number/boolean carrier sets for `typeof` materialization. This is not a functional hack, but it is duplicated semantic authority. The remaining plan must centralize numeric type facts so frontend validation and emitter materialization consume the same authority.

## Cluster 3: Emitter Test Pipeline Runs Numeric Validation

Files:

- `packages/emitter/src/integration-cases/helpers.ts`
- emitter integration tests

### Source Shape

```ts
import type { int } from "@tsonic/core/types.js";

declare function takeInt(value: int): void;

export const numeric = (minimumLength: number = 0): int => {
  return takeInt(minimumLength);
};
```

### Why This Mattered

Emitter integration helpers previously let some source shapes reach emission without the same numeric coercion validation used by the normal pipeline. That created test-only acceptance for code the product compiler should reject.

### Correct Behavior Now

The integration helper runs numeric validation before emission, so tests and product compilation follow the same rule:

```text
number -> int requires explicit proof or conversion
```

### Genericness Review

- Generic: yes.
- Product-specific: no.
- Correctness: strong. It removes a test harness blind spot.
- NativeAOT: compatible.

### Remaining Gap

All other test helper paths should be audited against the same standard: helpers must not skip frontend validation or surface/package resolution phases unless the test explicitly targets a lower layer and states that boundary.

## Cluster 4: Runtime-Union `typeof` Guard Alignment

Files:

- `packages/emitter/src/core/semantic/union-typeof-matching.ts`
- `packages/emitter/src/statements/control/conditionals/if-emit-typeof-array-guards.ts`
- emitter regression tests

### Source Shape

```ts
export function read(value?: number | string): string {
  if (typeof value === "number") {
    return value.toString();
  }

  return value ?? "";
}
```

### Bad Shape Before

For nullable runtime-union carriers, guard emission could project a runtime arm without guarding nullish storage first:

```csharp
if (value.Is1()) {
  ...
}
```

If `value` is nullable, that is an invalid carrier probe.

### Correct Shape Now

The guard uses aligned runtime-union members and emits nullish-safe carrier checks when required:

```csharp
if (((object)value) != null && value.Is1()) {
  ...
}
```

For broad object storage, it does not pretend that the semantic union is still the runtime carrier:

```ts
declare function acceptsRest(callback: (...args: unknown[]) => void): void;

acceptsRest((value: number | string) => {
  if (typeof value === "number") {
    // Broad rest storage must not emit value.IsN().
  }
});
```

### Genericness Review

- Generic: yes for runtime-union carrier materialization.
- Product-specific: no.
- Correctness: good for the bug fixed.
- NativeAOT: compatible; no reflection/dynamic behavior is introduced.

### Remaining Gap

The emitter still decides portions of `typeof` guard matching through `matchesTypeofTag`. That is materialization-adjacent, but it still contains semantic knowledge about numeric and boolean carriers. The remaining plan should move guard proof authority into frontend IR and leave the emitter to consume explicit arm-proof/materialization facts.

## Cluster 5: Strict `in`/Numeric Rules Reflected In Fixtures And Docs

Files:

- `docs/architecture/pipeline.md`
- `docs/language.md`
- `docs/numeric-types.md`
- shadowing fixture and expected output
- emitter regression fixtures

### Source Shape

```ts
import type { int } from "@tsonic/core/types.js";

export function run(totalLength: int): int {
  const result = (totalLength + 1) as int;
  return result;
}
```

The docs and fixtures now describe the absolute rule: implicit broad `number` to integral narrowing is not compiler-inserted. Explicit type proof or explicit conversion is required.

### Genericness Review

- Generic: yes.
- Product-specific: no.
- Correctness: good.
- NativeAOT: compatible.

### Remaining Gap

The broader docs still need reconciliation after the remaining `unknown`, JSON, flow-fact, and centralization tasks. The merged docs are correct for the checkpoint but not complete for the entire plan.

## Cluster 6: Historical Comment Cleanup

Files:

- frontend IR/binding/type-system files
- emitter semantic comments

### What Changed

Historical/change-tracking comments were removed or rewritten into current absolute descriptions.

### Genericness Review

- Generic: yes.
- Product-specific: no.
- Correctness: good.
- NativeAOT: neutral.

### Remaining Gap

No functional gap from this cluster. Continue enforcing no historical/change-tracking comments in new code and docs.
