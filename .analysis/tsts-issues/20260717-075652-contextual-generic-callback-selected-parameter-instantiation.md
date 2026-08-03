# Contextual Generic Callback Selected Parameter Is Not Instantiated

## Affected Artifact

- Tsonic vendored TSTS source: isolated `/home/jeswin/temp/tsts` commit `691ceb8006ea8e8be32cb9614879032060e4bbdb`
- Tsonic vendoring commit: `88f3935e`
- Official `/home/jeswin/repos/tsoniclang/tsts` checkout remains out of scope and must not be touched.
- Reproduction date: `2026-07-17T07:56:52+05:30`

The selected constructor evidence added at this TSTS revision is correct. The
remaining failure is the selected source parameter type on a call through a
contextually instantiated callback parameter.

## Source Reproduction

The unchanged source contract is the standard Promise resolution shape:

```ts
interface PromiseLike<T> {
  then<TResult1 = T, TResult2 = never>(
    onfulfilled?: ((value: T) => TResult1) | null,
    onrejected?: ((reason: unknown) => TResult2) | null,
  ): PromiseLike<TResult1 | TResult2>;
}

type Resolve<T> = (value: T | PromiseLike<T>) => void;

interface PromiseConstructor {
  new <T>(executor: (resolve: Resolve<T>) => void): Promise<T>;
}

declare const Promise: PromiseConstructor;

export function wrap(inner: Promise<number>): Promise<number> {
  return new Promise<number>(resolve => {
    resolve(inner);
  });
}
```

A target-neutral minimal form is:

```ts
interface Box<T> { readonly value: T }
type Resolve<T> = (value: T | Box<T>) => void;

declare function execute<T>(body: (resolve: Resolve<T>) => void): void;
declare const boxed: Box<number>;

execute<number>(resolve => resolve(boxed));
```

TSTS accepts the source. The inner checked call is therefore a resolved call to
the contextually instantiated `Resolve<number>` signature.

## Expected TSTS Evidence

For the inner `resolve(inner)` / `resolve(boxed)` call,
`CheckedCallMappingRequest.sourceSelectedSignatureParameters[0].selectedType`
must be the checker-owned instantiated source type:

```text
number | PromiseLike<number>
```

or, in the neutral reproduction:

```text
number | Box<number>
```

The authored declaration type node may remain the generic syntax
`T | PromiseLike<T>`. TSTS need not and must not construct a C# target type.
It only needs to expose the source type selected for this exact checked call.

## Actual TSTS Evidence

The finalized inner selected-call fact retains an open source parameter:

```text
T | PromiseLike<T>
```

Tsonic-CSharp maps the exact selected `PromiseLike<T>` source-profile identity
to its Task-backed carrier. Because the selected type remains open, the
source-owned call parameter consequently becomes:

```text
Tsonic.CSharp.Runtime.Union<T, System.Threading.Tasks.Task<T>>
```

while the actual argument has the finalized carrier:

```text
System.Threading.Tasks.Task<double>
```

The outer constructor evidence is already closed and correct:

```text
new Promise<number>(...)
  -> Tsonic.CSharp.Js.PromiseRuntime<double>.Create
  -> System.Threading.Tasks.Task<double>
```

The focused compiler gate now fails closed instead of emitting an invalid call:

```text
TS9100188 C# Task carrier conversion requires a finalized target operation;
Task values cannot be implicitly unwrapped or reinterpreted.

source: System.Threading.Tasks.Task<double>
target: Tsonic.CSharp.Runtime.Union<T, System.Threading.Tasks.Task<T>>
```

Evidence snapshot:

```text
/home/jeswin/repos/tsoniclang/tsonic-csharp/.temp/promise-assimilation-facts-20260717-after-promise-like-carrier.json
```

## Causal Chain

1. `new Promise<number>` contextually instantiates the executor callback with
   `T = number`.
2. The callback parameter `resolve` therefore has the checked callable type
   `Resolve<number>`.
3. The inner `resolve(inner)` call is accepted by ordinary TypeScript checking.
4. TSTS builds `sourceSelectedSignatureParameters` using the declaration-level
   parameter type and exposes the open `T | PromiseLike<T>` subject.
5. C# has no selected source substitution evidence for that callback-local `T`.
6. C# must not infer `T` from the outer constructor, callback syntax, argument
   spelling, return types, or target delegate metadata.
7. Without the instantiated selected source type, C# cannot mechanically map
   the two exact source arms to the closed target carriers `double` and
   `Task<double>`.

## Required Generic Contract

`SourceSelectedSignatureParameter.selectedType` must represent the instantiated
parameter type of the exact checker-selected signature at this call site. When
the selected signature carries a mapper/substitution, the exposed source type
must include that substitution rather than returning the declaration-level
open parameter type.

This must work for nested unions and other generic wrappers, not only Promise:

```text
T                 -> number
Box<T>            -> Box<number>
T | Box<T>        -> number | Box<number>
readonly T[]      -> readonly number[]
```

The authored type node remains separate provenance. It must not replace the
instantiated selected type.

## Forbidden Consumer Workarounds

- No C# inference from the outer `new Promise<number>` syntax.
- No callback return/parameter reconstruction.
- No checker re-entry from Tsonic-CSharp.
- No raw `TypeArguments`, `.Type`, `.Text`, or object-field probing.
- No source-name matching for `Promise`, `PromiseLike`, `Resolve`, or `Task`.
- No accepting an open target union and relying on C# implicit conversions.
- No narrowing the source Promise declaration to hide PromiseLike assimilation.
- No backend repair after source checking.

## Acceptance Gate

1. Add a neutral TSTS regression using `Resolve<T>` and `Box<T>` as above.
2. Prove the inner call's selected parameter is `number | Box<number>`, not
   `T | Box<T>`.
3. Preserve the generic authored type node as separate declaration provenance.
4. Prove inferred and explicit outer type arguments both instantiate the inner
   selected parameter.
5. Prove nested generic wrappers and unions are substituted recursively.
6. Prove an unresolved/error signature does not fabricate selected parameter
   evidence.
7. Preserve source checking, overload selection, and diagnostics unchanged.

After a generic TSTS fix is available in `/home/jeswin/temp/tsts`, Tsonic will
vendor that exact isolated artifact, map `PromiseLike<T>` to the explicit
Task-backed JS surface carrier through selected source-profile identity, rerun
the direct-value and Task-assimilation Promise proofs, rerun unchanged Proof
Pudding, and then run the complete parallel C#/host/runtime gate.
