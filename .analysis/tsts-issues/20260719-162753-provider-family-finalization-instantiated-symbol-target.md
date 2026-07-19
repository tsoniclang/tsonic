# Provider family finalization dereferences a missing instantiated-symbol target

## Status

Blocked at TSTS semantic validation of a contract-valid provider type-family declaration.

## Exact artifact

- Isolated repository: `/home/jeswin/temp/tsts`
- Branch: `tsts-v0-fixes`
- Vendored commit: `c8b97365aa4dc436a248b69261d36191dc44c5d8`
- Implementation commit: `3407b2f8139877f5c4ff0625131994722ad40147`
- Built and vendored files: `1,808`
- Sorted relative-path/content manifest SHA-256: `c15f97ff87d121116b1de115c3f2f98ffc4bbc87e549fd605a7b9f6fd5e7e9a3`
- Byte equivalence: `diff -qr` produced no output
- Official `/home/jeswin/repos/tsoniclang/tsts` checkout: untouched

## Minimal source-level trigger

The arity-zero use alone reproduces the failure:

```ts
import type { Task } from "@tsonic/dotnet/System.Threading.Tasks.js";

declare const value: Task;
value;
```

The combined family proof also fails:

```ts
import type { Task } from "@tsonic/dotnet/System.Threading.Tasks.js";

declare const plain: Task;
declare const closed: Task<string>;
plain;
closed;
```

Both programs use `noLib: true`, the explicit C# source-profile declarations, and the normal .NET target-binding provider. No broad import, hidden provider filename, source-name inference, checker re-entry from C#, or arity-suffix inference participates.

## Provider model evidence

The exact closed provider declaration model requested for `Task` is available locally at:

```text
/home/jeswin/repos/tsoniclang/tsonic-csharp/.temp/provider-family-task-model.json
```

Its evidence is:

```text
pretty JSON bytes: 1,383,228
SHA-256: 6ff2881dd040b5f87d39a4d608f8a588f8e141ac9c50bea0829bb33148adc660
compact model characters: 743,182
exports: 10
C# provider contract diagnostic: none
```

The family variants are separate and structurally valid:

```text
Task
  kind: class
  source type-family arity: 0
  members: 32
  target: System.Threading.Tasks.Task

Task_1<TResult>
  kind: class
  public source family: Task
  source type-family arity: 1
  extends provider-ref Task in the same public module
  members: 7
  target: System.Threading.Tasks.Task`1<TResult>
```

`validateDotnetProviderDeclarationModelContract` accepts the complete model. TSTS accepts and resolves the public import during normal source checking.

## Exact failing phase

The source file checks successfully:

```text
plain:before-ensure
plain:ensure=
plain:before-finalize
```

`CompilerSession.finalizeExtensions()` then asks TSTS for complete semantic diagnostics. While checking a generated provider class declaration, TS-Go compares class member/static-side types. It encounters an instantiated symbol whose internal symbol links have no `target`, then dereferences that missing value:

```text
TypeError: Cannot read properties of undefined (reading 'CheckFlags')
    at Checker_getTypeOfSymbol (.../checker/symbols.js:11176:18)
    at Checker_getTypeOfInstantiatedSymbol (.../checker/inference.js:406:64)
    at Checker_getTypeOfSymbol (.../checker/symbols.js:11180:16)
    at Checker_getNonMissingTypeOfSymbol (.../checker/symbols.js:11214:48)
    at Relater_isPropertySymbolTypeRelated (.../checker/relater.js:8612:23)
    at Relater_propertyRelatedTo (.../checker/relater.js:8580:21)
    at Relater_propertiesRelatedTo (.../checker/relater.js:8467:33)
    at Checker_checkTypeAssignableTo (.../checker/relater.js:710:12)
    at Checker_checkClassLikeDeclaration (.../checker/symbols.js:2147:18)
    at Checker_checkClassDeclaration (.../checker/symbols.js:2000:5)
    at Program_GetSemanticDiagnostics (.../compiler/program.js:1414:25)
    at finalizeExtensionSemantics (.../extensions/compiler-integration.js:39:5)
```

The immediate invalid state is exact:

```text
Checker_getTypeOfInstantiatedSymbol(symbol)
  -> links = valueSymbolLinks.get(symbol)
  -> links.target === undefined
  -> Checker_getTypeOfSymbol(undefined)
  -> undefined.CheckFlags throws
```

## Causal chain

```text
user imports public provider family Task
  -> C# provider supplies a contract-valid arity-0/arity-1 family model
  -> TSTS canonical provider closure accepts the model and source checking succeeds
  -> finalizeExtensions requests complete semantic diagnostics
  -> TS-Go checks a generated provider class declaration
  -> class assignability compares an instantiated member symbol
  -> that instantiated symbol has no linked target symbol
  -> Checker_getTypeOfSymbol dereferences undefined
  -> extension finalization aborts before facts or backend emission can be proved
```

The public TSTS program API intentionally hides canonical owner documents, so the C# consumer cannot and must not inspect the internal owner filename or generated hidden family names to identify the class. The complete accepted provider model and public source reproduction are supplied instead.

## Why this is a TSTS blocker

This failure occurs inside TSTS/TS-Go semantic validation before C# backend planning and before the new exact runtime-carrier assertions are queried. A provider model can be rejected deterministically if it violates the provider contract, but an accepted model must not create an instantiated checker symbol with a missing target and crash the process.

C# cannot safely repair this by:

- removing family members;
- broadening provider imports;
- changing source order;
- referring to hidden TSTS family names;
- suppressing semantic diagnostics;
- catching the checker exception;
- rewriting `Task`/`Task_1` names;
- or inferring the family arity locally.

Those paths would either weaken the source contract or depend on compiler-internal representation.

## Required generic contract

1. Every instantiated symbol created while rendering/binding/checking provider type-family declarations must retain a valid original target symbol and mapper.
2. Provider class-family static-side and instance-side assignability must work for arity-zero and generic variants with inheritance between exact variants.
3. Complete semantic diagnostics must never dereference a missing linked target; malformed internal provider artifacts must fail closed with a structured provider diagnostic before publication.
4. The result must be independent of requested slice order and whether source uses only `Task`, only `Task<T>`, or both.
5. Canonical owner documents and hidden family names remain internal; no consumer API exposing them is requested.

## Required neutral regression

Use a fake provider family with a nontrivial base and derived generic variant whose members force class/static-side relation checking:

```ts
import type { Family } from "@acme/provider/family.js";

declare const plain: Family;
declare const closed: Family<string>;
void plain;
void closed;
```

The declaration model should contain:

```text
Family arity 0: class with callable/property members
Family arity 1: class<T> extends the exact arity-0 variant, with instantiated members
```

Prove each of these independently and in both orders:

- arity-zero use only;
- generic use only;
- both uses in one source file;
- source checking and complete semantic diagnostics succeed;
- extension finalization succeeds;
- no instantiated symbol has an absent target;
- an actually invalid heritage/member contract still rejects deterministically.

## Local reproductions and logs

```text
/home/jeswin/repos/tsoniclang/tsonic-csharp/.temp/provider-family-cardinality-repro.mjs
/home/jeswin/repos/tsoniclang/tsonic-csharp/.temp/focused-logs/provider-family-cardinality-plain-c8.log
/home/jeswin/repos/tsoniclang/tsonic-csharp/.temp/focused-logs/provider-family-plain-first-c8-stack100.log
```

Focused committed-test path under development:

```text
/home/jeswin/repos/tsoniclang/tsonic-csharp/test/dotnet-provider-type-family-reference-identity.test.mjs
```

Latest exact-artifact verification after the C# symbol-owned carrier path was removed:

```text
focused C#/provider/source-profile bank: 170/172
plain-first provider-family carrier proof: failed in finalizeExtensions
closed-first provider-family carrier proof: failed in finalizeExtensions
all other 170 focused tests: passed
```

Both failures have the identical `Checker_getTypeOfInstantiatedSymbol` missing-target stack recorded above. This proves the crash remains before either exact carrier assertion can run and is independent of family reference order.

## Acceptance after the TSTS fix

1. Vendor the exact isolated artifact byte-for-byte and record count/hash.
2. Run arity-zero, arity-one, plain-first, and closed-first provider-family regressions.
3. Prove canonical and C# runtime carriers exist only on exact type-reference and semantic-Type subjects, never on the shared family Symbol.
4. Run provider-family/source-profile and complete selected-evidence/provider banks.
5. Run Proof Pudding unchanged.
6. Run the complete parallel host/C#/runtime gate.
