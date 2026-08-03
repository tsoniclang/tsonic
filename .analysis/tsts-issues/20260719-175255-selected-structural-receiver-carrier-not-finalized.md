# Selected structural receiver carrier is never finalized

## Status

Blocked at the target-neutral TSTS checked-operation/runtime-carrier boundary.

## Exact artifact

- Isolated repository: `/home/jeswin/temp/tsts`
- Branch: `tsts-v0-fixes`
- Vendored commit: `c8b97365aa4dc436a248b69261d36191dc44c5d8`
- Implementation commit: `3407b2f8139877f5c4ff0625131994722ad40147`
- Built and vendored files: `1,808`
- Sorted relative-path/content manifest SHA-256: `c15f97ff87d121116b1de115c3f2f98ffc4bbc87e549fd605a7b9f6fd5e7e9a3`
- Byte equivalence: `diff -qr` produced no output
- Official `/home/jeswin/repos/tsoniclang/tsts` checkout: untouched

## Neutral source-level reproduction

The reproduction uses only the public `@tsonic/tsts` root API and a fake target:

```ts
const one = 1 as const;

export function read(pair: [number, string]): string {
  return pair[one];
}
```

It registers one target semantic provider with:

```ts
resolveRuntimeCarrier(request) {
  runtimeRequests.push(request);
  return acceptObservation({
    carrier: { kind: "opaque", id: "acme.structural" },
  });
}

mapCheckedElementAccess(request, context) {
  const carrier = context.factResolver.resolve(
    request.sourceReceiver.type,
    runtimeCarrierFactKey,
  );
  if (carrier !== undefined) {
    return acceptObservation({ operation: exactIndexerOperation });
  }
  return context.phase === "checking"
    ? deferObservation
    : rejectObservation(missingCarrierDiagnostic);
}
```

The executable reproduction is:

```text
/home/jeswin/repos/tsoniclang/tsonic/.temp/tsts-unowned-structural-carrier-repro.mjs
```

Run:

```bash
NODE_OPTIONS=--max-old-space-size=2048 \
  node .temp/tsts-unowned-structural-carrier-repro.mjs
```

Exact result:

```json
{
  "sourceDiagnostics": "",
  "runtimeRequestCount": 0,
  "elementRequests": [
    { "phase": "checking", "elementIndex": 1 },
    { "phase": "finalization", "elementIndex": 1 }
  ],
  "extensionDiagnostics": [
    {
      "extensionCode": "ACME_STRUCTURAL_CARRIER_MISSING",
      "message": "Exact selected receiver type has no finalized runtime-carrier fact."
    }
  ]
}
```

## Exact evidence that works

TSTS retains the checked element operation correctly:

- `request.sourceReceiver.expression` is the exact `pair` expression;
- `request.sourceReceiver.type` is the exact checker-selected tuple type;
- `request.sourceArgument` is the exact selected index expression/type;
- `request.sourceSelectedElementIndex` is `1`;
- the mapper is replayed in `checking` and `finalization` phases.

The missing evidence is not member selection or tuple ordinal evidence. It is the target-carrier prerequisite for the exact selected receiver type.

## Causal chain

```text
TS-Go checks pair[one]
  -> TSTS retains exact receiver Type and tuple ordinal 1
  -> the fake target owns checked element-access mapping
  -> TSTS never invokes the same target's resolveRuntimeCarrier hook for the tuple Type
  -> checking-phase mapper has no runtimeCarrierFactKey and defers
  -> lifecycle finalization cannot create the missing carrier because no carrier request exists
  -> finalization-phase mapper receives the same exact Type but still no carrier fact
  -> target must reject rather than infer tuple shape from names, syntax, or checker re-entry
```

The gating implementation is visible in the vendored package:

```text
packages/tsts/dist/src/extensions/checker-integration.js
  publishExtensionRuntimeCarrierFact(...)
  hasExtensionOwnedSubject(...)
```

`publishExtensionRuntimeCarrierFact` invokes `resolveRuntimeCarrier` only when the type, type reference, symbol, or type symbol already owns one of a fixed set of extension facts. A plain TypeScript tuple over intrinsic `number` and `string` has none of those facts, so the target provider is never asked to map it.

Checked-operation contexts intentionally expose no compiler/checker/type-shape query surface. Therefore the target cannot map the opaque `sourceReceiver.type` during checked-operation replay unless TSTS has already requested and finalized its target carrier.

## C# fallout

The same contract gap produces this valid source failure:

```ts
const one = 1 as const;

export function read(pair: [number, string]): string {
  return pair[one];
}
```

Actual final diagnostic:

```text
CSHARP_ELEMENT_ACCESS_NOT_MAPPED:
C# element access must be selected by TSTS/provider facts before emission.
```

C# previously could rediscover tuple shape by re-entering checker/type-shape APIs. That path is intentionally removed. Restoring it would violate the selected-evidence contract.

The same failure class affects plain source arrays, object shapes, intrinsic operands, and other selected operations whose receiver/operand/result Types have no prior extension ownership.

## Why this is a TSTS contract gap

The target receives exact source identity but no legal way to translate that opaque source Type into a target carrier:

- checked-operation contexts have no compiler query API;
- no target fact exists on the exact Type;
- `resolveRuntimeCarrier` was never called;
- a target-owned source walker would reconstruct dependencies and lifecycle ordering outside TSTS;
- mapping from source names, syntax text, or raw Type fields is forbidden;
- accepting an operation without a proven receiver carrier would weaken target safety.

## Required generic contract

1. Before evaluating a checked operation that exposes selected source type evidence, TSTS must make the owning target's runtime-carrier observation available for each exact prerequisite Type that requires target translation.
2. Carrier requests must include the exact authored type reference when one exists and the exact checker-selected semantic Type in all cases.
3. Carrier resolution must participate in TSTS-owned dependency ordering, deferral, rollback, and finalization. The consumer must not replay operations or walk source files.
4. An unowned intrinsic/structural Type must not be excluded merely because it lacks a pre-existing extension fact when an active target semantic provider owns `resolveRuntimeCarrier`.
5. Genuine absence or rejection must remain deterministic; TSTS must not synthesize target carriers itself.
6. The behavior must cover calls, properties, elements, operators, conversions, assertions, and iteration using their retained selected evidence.

## Required neutral regression

Use the fake-target reproduction above and prove:

- source checking succeeds;
- `resolveRuntimeCarrier` receives the exact tuple receiver Type;
- the resulting `runtimeCarrierFactKey` is finalized on that exact Type;
- checked element mapping defers during checking if necessary and accepts during finalization;
- the selected ordinal remains `1`;
- no checker query is available or required inside the checked-operation mapper;
- incompatible writes to the same exact Type still conflict;
- failure in a carrier dependency rolls back the parent checked operation atomically.

Add equivalent neutral cases for a structural object property, a plain source array index, and a primitive binary operator so this is fixed as an evidence class rather than a tuple exception.

## Forbidden consumer workarounds

- checker or type-shape re-entry from C#;
- raw Type object inspection;
- source AST walking to preseed operation dependencies;
- tuple/array/object name or syntax special cases;
- accepting a target operation without a closed carrier;
- attaching instantiated carriers to shared declaration Symbols;
- consumer-owned replay or lifecycle ordering.

## Acceptance after the TSTS fix

1. Vendor the exact isolated artifact byte-for-byte and record count/hash.
2. Run the neutral fake-target reproduction.
3. Run the C# tuple, source-array, object-shape, and operator source-semantics bank: `40/40`.
4. Run complete selected-evidence/provider/source-profile banks.
5. Run Proof Pudding unchanged.
6. Run the complete parallel host/C#/runtime gate.
