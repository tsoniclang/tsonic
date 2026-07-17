# TSTS Issue: Selected Receiver Evidence and Deferred Checked-Operation Finalization

Reported: 2026-07-17 08:28:46 IST

## Affected Contract

- Tsonic vendored TSTS code: isolated `/home/jeswin/temp/tsts` commit `691ceb8006ea8e8be32cb9614879032060e4bbdb`.
- Isolated TSTS checkout head: `85d12a8cccce1aefdd034e3ee7dba179f78de2e6`; the commits after `691ceb80` are traceability records and do not change the built extension contract.
- Tsonic vendor commit: `88f3935e`.
- Tsonic-CSharp branch: `fix/selected-evidence-proof-closure-20260713`.

This report supersedes the status correction in `20260709-233804-deferred-checked-operation-evidence-replay.md`. That earlier report correctly rejected a C# checker-driven replay walker, but it was later marked non-blocking after narrower selected-target retention fixes made its then-focused examples pass. The strict selected-evidence cleanup and the current compiler-session tests now isolate two operations that still require the generic TSTS contract described here.

## Summary

TSTS invokes target checked-operation mappers during normal source checking. Some target mappings require a closed receiver carrier that is finalized later during `semantics.beforeFinalized` from already-selected source/provider facts.

The current checked-call request preserves selected callee/signature/parameter/return evidence, but it does not preserve the checker-selected receiver type, receiver symbol, or receiver declaration. The current checked-operator request preserves only the syntax operands and operator. It does not preserve the selected nested property/element operation evidence, and TSTS does not replay the original request after lifecycle facts are finalized.

Consequently, Tsonic-CSharp has no compliant way to close receiver-dependent calls and mutations:

1. using the receiver syntax node alone is insufficient because its closed generic carrier is not yet attached;
2. asking the checker for the receiver type from C# is selected-evidence reconstruction and is forbidden;
3. inferring `Map<K,V>`, `Set<T>`, or `Array<T>` from source spelling is forbidden;
4. accepting an incomplete target member or operation would put unproved target semantics into finalized facts;
5. returning `defer` or failing closed is safe, but TSTS currently has no later selected-request replay/inventory from which the operation can be finalized.

## Concrete Failure 1: Generic Collection Receiver Calls

### Source

```ts
import type { int32 } from "@tsonic/csharp/types.js";

export function read(): int32 | undefined {
  const values = new Map<string, int32>();
  values.set("a", 1);
  return values.get("a");
}

export function add(): Set<int32> {
  const values = new Set<int32>();
  values.add(1);
  return values;
}
```

### Expected semantic chain

```text
TSTS checks new Map<string, int32>()
→ C# accepts the selected constructor from exact source declaration/signature evidence
→ constructor target is Tsonic.CSharp.Js.Map<string, int32>
→ lifecycle propagates that closed carrier to values

TSTS checks values.get("a")
→ request retains exact selected Map.get source identity
→ request also retains the checker-selected receiver type Map<string, int32>
→ C# maps that selected receiver type through finalized source/runtime-carrier facts
→ C# selects Map.get:value with declaring carrier Map<string, int32>
→ emitted C# calls the closed runtime helper/member
```

The same contract must cover zero-argument operations whose generic receiver arguments cannot be recovered from arguments or return type, for example:

```ts
values.clear();
values.keys();
values.values();
values.entries();
```

### Actual semantic chain

```text
TSTS checks values.get("a") before C# lifecycle carrier propagation
→ CheckedCallMappingRequest contains selected Map.get callee/signature evidence
→ request has no selected receiver semantic type/symbol/declaration
→ C# sees no finalized runtimeCarrierFact on the values identifier
→ collection target-member materialization has no closed Map<K,V> declaring type
→ C# fails closed with TS9100131
→ lifecycle later records the constructor/variable carrier
→ TSTS does not replay or expose the original selected call request
→ no selected target call fact can be finalized
```

Observed diagnostics:

```text
/src/index.ts(6,24): error TS9100131: [TSEXT9100131]
C# JS surface has no target mapping for checked Tsonic JS source-profile call 'Map.get'.

/src/index.ts(8,7): error TS9100131: [TSEXT9100131]
C# JS surface has no target mapping for checked Tsonic JS source-profile call 'Set.add'.
```

The broader chain reports the same root cause for `Map.set`, `Map.entries`, `Map.values`, `Set.add`, and `Set.values`.

### Evidence already available

`CheckedCallMappingRequest` currently includes:

```text
sourceSelectedSignature
sourceSelectedDeclaration
sourceSelectedMethodTypeArguments
sourceSelectedSignatureParameters
sourceSelectedSignatureKind
sourceCalleeSymbol / sourceCalleeDeclaration
sourceSelectedCalleeSymbol / sourceSelectedCalleeDeclaration
sourceReturnType
```

It does not include the selected receiver type or equivalent declaration-backed receiver evidence. For generic instance operations, the selected method declaration alone contains open `K`, `V`, or `T`; it does not identify the receiver's instantiated type arguments.

The gap cannot be filled from selected parameters and return type in general. `clear()` returns `void` and has no arguments. `keys()`, `values()`, and `entries()` expose only part or a transformed form of the receiver arguments. Receiver instantiation is source semantic evidence and must not be reverse-inferred by the target.

## Concrete Failure 2: Array Length Assignment

### Source

```ts
import type { int32 } from "@tsonic/csharp/types.js";

export function reset(values: int32[], size: int32): int32 {
  return values.length = size;
}
```

### Expected semantic chain

```text
TSTS selects the source-profile Array.length property
→ C# maps it to target operation tsonic.csharp.js.Array.length
→ TSTS checks the enclosing assignment operator with the selected left-operation evidence
→ C# may retain/defer the exact selected mutation until values has its finalized JSArray<int32> carrier
→ TSTS replays or exposes the original checked-operator request after lifecycle facts exist
→ C# records csharp target mutation tsonic.csharp.js.array.setLength
→ emitted C# calls the closed setLength operation and returns its int32 result
```

### Actual semantic chain

```text
TSTS selects values.length correctly
→ targetOperationFact exists on the property access
→ CheckedOperatorMappingRequest arrives while the receiver carrier is not finalized
→ request contains expression/operator/left/right only
→ C# cannot prove the closed JSArray receiver and returns no JS mutation mapping
→ generic assignment mapping wins
→ lifecycle later records the array carrier
→ original checked-operator request is not replayed or available from an inventory
→ csharpTargetMutationOperationFact is absent
```

Observed focused assertion:

```text
expected: tsonic.csharp.js.array.setLength
actual:   undefined
```

Direct mapper tests pass when the same checked request is supplied with the selected property fact and a finalized receiver carrier. The compiler-session test fails only because those facts become available after the one checked-operator observation.

## Why This Is Not a C# Name or Emitter Bug

The target data already contains exact declarative policies for the selected source operations and exact C# runtime members. The failure occurs before backend emission because the closed receiver carrier is unavailable at the checked-observation point.

The following local paths are explicitly rejected:

- `checker.getTypeAtLocation(receiver)` from C# semantic mapping or lifecycle code;
- `checker.getResolvedSignature`, `getResolvedSymbol`, `getSymbolAtLocation`, or `getPropertyOfType` replay/recovery;
- source-name branches for `Map`, `Set`, `Array`, `get`, `add`, or `length`;
- raw AST/object-field probing;
- reconstructing collection type arguments from call arguments, callback types, or result spelling;
- broad imports or source-profile widening;
- a source-file walker whose purpose is to trigger checker re-observation;
- accepting a placeholder target operation without a deterministic final selected target member;
- suppressing TS9100131 or emitting a fallback operation.

## Required Generic TSTS Contract

TSTS should provide a target-neutral way to finalize a checked operation from the exact source evidence selected during normal checking. TSTS owns the exact API shape. Two compatible designs are:

1. retain and deterministically replay deferred checked call/property/element/operator/iteration requests after lifecycle hooks have produced facts; or
2. expose an immutable checked-operation inventory to lifecycle hooks/consumers, preserving the original selected evidence and operation dependency order.

For receiver-dependent operations, the retained request/evidence must include the checker-selected receiver semantic type and stable receiver provenance (symbol/declaration/type reference where available). This is source evidence only. TSTS must not produce C# target refs.

Required behavior:

- exact selected source symbol/declaration/signature identity is preserved;
- selected receiver type is the checker-owned instantiated type used for the operation;
- call arguments, selected instantiated parameter types, return/result type, optional-chain state, and selected method type arguments remain available;
- operator requests preserve the already-selected nested property/element evidence needed by the target operation;
- replay/inventory ordering is deterministic and inner-before-outer where dependencies require it;
- target facts recorded during lifecycle are visible to replayed/finalized operations;
- replay is idempotent and cannot create duplicate fact conflicts;
- an operation still lacking target proof fails closed with a deterministic diagnostic;
- no extension-side checker re-entry is required.

An alternative narrow addition of selected receiver evidence to checked call/property/element/operator requests can close the collection examples only if TSTS also defines how operations deferred on lifecycle-produced target facts are finalized. Receiver evidence alone does not solve the array mutation ordering case.

## Neutral TSTS Regressions

Use neutral source-profile/provider names, not JS, C#, `Map`, `Set`, or `Array`.

1. Define `Box<T>` with `put(value: T): void`, `get(): T`, and `clear(): void` in a neutral no-lib source profile.
2. Register a neutral target semantic provider whose receiver carrier becomes available only in `beforeSemanticsFinalized` from a selected constructor/declaration fact.
3. Prove all three selected calls finalize from the original selected receiver evidence without checker re-entry.
4. Define a selected property plus an enclosing assignment operator whose target mutation requires a lifecycle-produced receiver carrier.
5. Prove the property is selected once, the operator is finalized afterward, and the exact original source evidence is retained.
6. Prove nested call/property/operator dependencies finalize in deterministic postorder.
7. Prove repeated finalization is idempotent and produces no `FACT_CONFLICT`.
8. Prove a genuinely missing receiver carrier produces one deterministic target diagnostic and no target artifact.
9. Prove two different generic receiver instantiations never share target facts.
10. Prove the API exposes source compiler subjects only; no target-specific canonical refs or source-name inference is introduced.

## Focused Tsonic-CSharp Evidence

Command:

```bash
node --test --test-reporter=tap \
  test/surface-boundary-part-02-js-surface-maps-number-static-methods-and-consta.test.mjs \
  test/surface-boundary-part-03-js-surface-maps-json-parse-from-selected-standar.test.mjs \
  test/surface-boundary-part-04-js-surface-maps-object-assign-only-from-selected.test.mjs \
  test/json-object-shape-lifecycle.test.mjs
```

Result:

```text
97 tests
94 pass
3 fail
0 skipped
0 todo
```

The three failures are exactly:

```text
selected JS surface preserves explicit source primitive Map and Set type arguments
selected JS surface finalizes Map and Set iterable-constructor size and Array.from length chains
selected JS surface finalizes Array length assignment as value-producing setLength operation
```

The corresponding direct mapper tests with explicit finalized receiver facts pass. This separates target operation policy correctness from the missing checked-operation lifecycle contract.

## Tsonic Acceptance Gate

After a generic TSTS fix is available, Tsonic will:

1. vendor the exact isolated TSTS artifact and verify its file/content manifest;
2. consume selected receiver/deferred-operation evidence directly;
3. remove any now-obsolete receiver checker re-query from selected operation paths;
4. keep the deleted checker-driven replay walker deleted;
5. run the 97-test focused bank at 97/97 with zero skip/todo;
6. run selected-evidence architecture scanners;
7. run source-profile/provider gates;
8. run Proof Pudding unchanged except already-approved project/config migration;
9. run the complete parallel host/C#/runtime gate.

No C# workaround is acceptable while this contract is absent.
