# Provider type-family runtime carrier conflicts on shared public symbol

## Status

Blocked at the generic TSTS runtime-carrier publication boundary.

## Exact artifact

- Isolated repository: `/home/jeswin/temp/tsts`
- Branch: `tsts-v0-fixes`
- Commit: `fac382a0525cf75a1f9d3c9be0e55b70c477f01a`
- Built and vendored files: `1,808`
- Sorted relative-path/content manifest SHA-256: `b233c07154a850ce112449f3dbde37cc4ff0afd2373cb50d34cf27f6fb150d21`
- Byte equivalence: `diff -qr` produced no output
- Official `/home/jeswin/repos/tsoniclang/tsts` checkout: untouched

## Source-level trigger

The focused C# source-profile proof is ordinary source:

```ts
import { Console, Span } from "@tsonic/dotnet/System.js";
import type { int, long } from "@tsonic/csharp/types.js";

const path = "/todos/42";
const parts = path.Split("/");
const values: int[] = [1, 2, 3];
const span = new Span<int>(values);
Console.WriteLine(`${parts.Length}:${span.Length}`);
```

Resolving the selected provider declaration closure encounters both variants of the public provider type family `Task`:

```ts
Task
Task<double>
```

The provider model correctly keeps separate target variants:

```text
Task         -> System.Threading.Tasks.Task
Task<double> -> System.Threading.Tasks.Task`1<double>
```

No C# source-name inference or arity-suffix inference is involved. The variants are selected from TSTS provider type-family facts attached to the exact source type reference.

## Actual result

The target mapper accepts both exact references with different, correct target carriers. TSTS then publishes its canonical `runtimeCarrierFactKey` to four subjects in `publishExtensionRuntimeCarrierFact`:

```text
type
sourceTypeReference
sourceSymbol
type.symbol
```

For a provider type family, `sourceSymbol` and/or `type.symbol` can be the one shared public family symbol. That symbol cannot identify an arity-specific instantiation.

The first family variant leaves this fact on the shared symbol:

```json
{
  "carrier": {
    "kind": "target-named",
    "id": "System.Private.CoreLib, Version=10.0.0.0, Culture=neutral, PublicKeyToken=7cec85d7bea7798e::System.Threading.Tasks.Task"
  }
}
```

The later exact `Task<double>` reference correctly produces:

```json
{
  "carrier": {
    "kind": "target-named",
    "id": "System.Private.CoreLib, Version=10.0.0.0, Culture=neutral, PublicKeyToken=7cec85d7bea7798e::System.Threading.Tasks.Task`1",
    "typeArguments": [
      { "kind": "source-primitive", "name": "float64" }
    ]
  }
}
```

TSTS attempts to write that second carrier onto the same shared family symbol. The exact fact-store result is:

```text
key: tsts.target-bindings/runtimeCarrier
result: conflict
existing: System.Threading.Tasks.Task
incoming: System.Threading.Tasks.Task`1<float64>
error: Cannot commit an extension fact savepoint after a fact write failed.
```

The two source type references and their selected target carriers are distinct. The collision subject is the shared compiler symbol, not either exact type-reference subject.

## Causal chain

```text
provider closure contains Task and Task<double>
  -> TSTS selects each provider type-family variant by exact source arity
  -> C# maps each selected variant to its exact target carrier
  -> TSTS publishes the arity-zero carrier to a shared family symbol
  -> TSTS later publishes the arity-one instantiated carrier to that same symbol
  -> runtimeCarrierFactKey correctly detects incompatible values
  -> the enclosing fact savepoint cannot commit
  -> source diagnostics/finalization abort before backend emission
```

## Why this is a TSTS contract blocker

TSTS owns publication of the canonical `runtimeCarrierFactKey`. The C# mapper cannot control which subjects receive the accepted result.

An instantiated target carrier is use-site evidence. A shared provider-family symbol represents all arities and instantiations, so it cannot own one concrete carrier unless TSTS has mechanically proved that carrier is invariant across the whole family.

Suppressing the conflict, choosing one variant, broadening imports, changing source order, or making the C# mapper return the same carrier would all destroy exact provider-family semantics.

## Required generic contract

For provider type-family references, TSTS must retain arity/instantiation-specific runtime-carrier evidence only on subjects that identify that exact selected reference. At minimum:

1. `sourceTypeReference` must retain the exact selected carrier.
2. An instantiated semantic `type` may retain it when that compiler subject has stable instantiation identity.
3. A symbol carrying `providerTypeFamilyFactKey` must not receive a concrete variant carrier merely because it is `sourceSymbol` or `type.symbol`.
4. Repeated observation of the same exact reference remains idempotent.
5. Different carriers on the same genuinely exact subject still produce `FACT_CONFLICT`.

This should be implemented in TSTS's canonical publication policy, not by target-specific filtering.

## Required neutral regression

Use a fake provider family with one public source name and two variants:

```ts
import type { Family } from "@acme/provider/family.js";

export function consume(left: Family, right: Family<number>): void {
  void left;
  void right;
}
```

The fake semantic provider should map the exact references to different target refs:

```text
Family         -> Acme.Family0
Family<number> -> Acme.Family1<Acme.Number>
```

Prove in both resolution orders that:

- normal source checking and extension finalization succeed;
- each exact source type reference has its exact runtime-carrier fact;
- the shared public family symbol does not acquire an ambiguous instantiated carrier;
- repeated exact observations are idempotent;
- incompatible values on one exact reference still conflict;
- no target name, source spelling, hidden provider filename, or resolution order participates in the decision.

## C# consumer follow-up

Tsonic-CSharp also records a target-owned carrier fact on `request.type`, `request.sourceTypeReference`, and `request.sourceSymbol`. That subject policy will be audited against the same exact-versus-shared provenance rule. It cannot repair this blocker because TSTS independently performs the failing canonical write after mapper acceptance.

No C# workaround will be added while this contract is open.

## Acceptance after the TSTS fix

1. Vendor the exact isolated artifact byte-for-byte and record count/hash.
2. Run the focused provider-family regression.
3. Run the original Split/Length source-profile bank.
4. Run the complete selected-evidence/provider banks.
5. Run Proof Pudding unchanged.
6. Run the complete parallel host/C#/runtime gate.
