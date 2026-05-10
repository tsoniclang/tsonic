# Gaps To Carry Forward

The merged PR is safe as a checkpoint, but it does not finish the full cleanup plan. These gaps are now explicit worklist inputs.

## Gap 1: Centralize Numeric Type Facts

Current duplicated authority:

- `packages/frontend/src/ir/validation/numeric-classification.ts`
- `packages/emitter/src/core/semantic/union-typeof-matching.ts`
- `packages/emitter/src/expressions/post-emission-adaptation.ts`

Example:

```ts
function f(value: number | int): void {
  if (typeof value === "number") {
    // Both TS number and Tsonic exact integral carriers satisfy JS typeof number.
  }
}
```

The validation layer decides whether a numeric expression may flow into an integral target. The emitter decides whether a runtime-union arm satisfies `typeof "number"`. These are related facts and should not evolve independently.

Required direction:

- Introduce one numeric type-fact service in the frontend/type-system layer.
- Expose enough IR/proof metadata for the emitter to materialize checks without maintaining independent numeric carrier sets.
- Keep emitter casts limited to explicit/proven conversions.

## Gap 2: Move `typeof` Guard Proof Out Of Emitter Semantics

Current remaining emitter authority:

- `matchesTypeofTag` decides type/tag compatibility.
- `if-emit-typeof-array-guards.ts` aligns runtime-union members and nullish carrier checks.

Example:

```ts
export function f(value?: number | string): string {
  if (typeof value === "number") {
    return value.toString();
  }
  return "";
}
```

The frontend should record that the condition proves a specific runtime-union arm when the proof is deterministic. The emitter should only emit the recorded carrier check.

Required direction:

- Frontend records branch/condition proof facts for `typeof`.
- Runtime-union arm mapping is stored as IR/proof metadata.
- Emitter consumes proof facts and materializes `IsN`/nullish checks only when explicitly proven.

## Gap 3: Test Helpers Must Not Bypass Product Validation

Current fixed path:

- `compileToCSharp` integration helpers now run numeric validation.

Remaining concern:

- Other helper or fixture paths may still test lower layers without clearly stating the validation boundary.

Example:

```ts
declare function takeInt(value: int): void;
takeInt(1.5);
```

Any full-pipeline test helper must reject this before emission. A lower-layer emitter unit may still build hand-authored IR, but it must not be mistaken for product acceptance.

Required direction:

- Audit all test helper entrypoints.
- Name/structure helpers by pipeline boundary.
- Ensure full-pipeline helpers run the same validation sequence as CLI builds.

## Gap 4: `unknown` Closed Carrier Semantics Remain Open

The merged PR rejected unsound dynamic object probing but did not implement the approved `unknown` flow/carry policy.

Example target behavior still pending:

```ts
const parsed: unknown = JSON.parse(json);

if (
  parsed !== null &&
  typeof parsed === "object" &&
  "WorkspaceId" in parsed
) {
  // This must only be allowed if the compiler has a closed NativeAOT-safe carrier story.
}
```

Required direction:

- Opaque `unknown` storage/pass-through may be allowed.
- Structural use requires TypeScript flow facts plus Tsonic closed carrier proof.
- Unsupported broad structural use must be a deterministic diagnostic.

## Gap 5: Object Literal And Union Arm Selection Still Need Central Authority

The merged PR tightened numeric and guard paths but did not finish object-literal target planning or ambiguous union-arm diagnostics.

Example:

```ts
type A = { kind: "a"; value: int };
type B = { kind: "b"; value: number };

declare function take(value: A | B): void;

take({ kind: "a", value: 1 });
```

The frontend should choose the union arm or reject ambiguity. The emitter should not rediscover object compatibility or choose a carrier based on emitted shape.

Required direction:

- Frontend records selected union/object materialization plan.
- Ambiguous union/object target selection is a diagnostic.
- Emitter only materializes the selected plan.

## Gap 6: Downstream/Upstream Package Branches Are Not Part Of The Merged Tsonic PR

Current state:

- `js` has a pushed `apr28-refactor` source fix and unrelated generated-file drift remains local.
- `nodejs` has pushed `apr28-refactor` source-package numeric conversion fixes.
- Other sibling repos remain on `apr28-refactor` branches per maintainer direction.

Required direction:

- Keep sibling repos on `apr28-refactor`.
- Do not mix generated-file drift into source-package PRs unless it is intentionally regenerated and validated.
- Finish upstream Tsonic plan first, then validate downstream with updated packages.
