# 01 — Canonical Four-Layer Architecture

Date: 2026-07-20. Status: proposed governing model for the cleanup. Everything
else in this packet measures conformance against this file.

## WCBUBWHB Statement

The observed problem is not one bug; it is that semantic meaning is decided in
more than one place. The audit (`04-drift-inventory.md`) shows backends
re-querying the checker, target mappers re-deriving overloads, names selecting
semantics, and two fact systems competing. The highest correct fix is one
authority-and-dependency stack in which **every semantic decision has exactly
one owning layer**, code may only depend downward, and semantic evidence may
only flow upward. This file defines that stack.

## The Stack

```text
┌──────────────────────────────────────────────────────────────┐
│ 4. Specific Tsonic code                                      │
│    C# target, JS surface, .NET/Node providers, backend,      │
│    C#/Node runtimes, concrete operation policies             │
├──────────────────────────────────────────────────────────────┤
│ 3. Shared Tsonic capabilities                                │
│    plugin composition, module ownership, source profiles,    │
│    target contribution envelopes, artifact requirements,     │
│    finalized target-program contracts                        │
├──────────────────────────────────────────────────────────────┤
│ 2. TSTS extension API                                        │
│    selected-evidence requests, provider declarations, facts, │
│    checked-operation lifecycle, deferral and finalization    │
├──────────────────────────────────────────────────────────────┤
│ 1. TSTS compiler substrate                                   │
│    TS-Go AST, symbols, types, signatures, checker decisions, │
│    source diagnostics and control-flow-selected meaning      │
└──────────────────────────────────────────────────────────────┘

Code dependencies:  4 → 3 → 2 → 1
Semantic evidence:  1 → 2 → 3 → 4
```

Layer 1 contains both TS-Go-shaped syntax **and** checker-owned semantic
identities. A selected `Symbol`, `Type`, or `Signature` must never be reduced
to AST spelling.

## Layer Ownership

| Layer | Owns | Must Not Own |
|---|---|---|
| **1. Compiler** | AST shape, symbol resolution, overload selection, instantiated signatures, flow types, tuple ordinal selection, source diagnostics | Tsonic plugins, C#, CLR, Node, runtime carriers |
| **2. Extension API** | Public delivery of exact compiler evidence, provider virtual declaration machinery, fact framework and subjects, checked-operation requests, deferral, transactional finalization | Tsonic source-core meaning, C# target refs, Node operation names, package activation policy |
| **3. Shared Tsonic** | Portable source-core semantics, installed plugin preparation, module ownership, source-profile composition, target contribution envelope, shared analyses, diagnostics/artifact contracts, finalized target-program envelope | `System.String`, Roslyn syntax, `node:fs`, target-specific operation schemas |
| **4. Specific Tsonic** | C# mapping, JS semantics, .NET/Node provider rows, backend plans, emitted C#, closed runtime implementation | Reconstructing checker decisions or changing source meaning |

Layer 4 keeps internal separation; it is not one miscellaneous layer:

```text
specific declaration/policy
        ↓
target semantic contribution
        ↓
target backend plan
        ↓
runtime/toolchain implementation
```

## Feature Classification Table

For every new feature, first classify it:

| Feature kind | Correct owner |
|---|---|
| TypeScript checking/selection evidence | TSTS (Layer 1) |
| Portable source marker/intrinsic | `source-core` (Layer 3 capability implemented through Layer-2 APIs) |
| Target-native API | provider metadata (Layer 4) |
| JS semantic operation | selected JS surface (Layer 4) |
| Target representation/carrier | target policy/facts (Layer 4) |
| C# syntax construction | backend (Layer 4) |
| Observable helper behavior | closed runtime (Layer 4) |
| SDK/NuGet/publish configuration | user `.csproj`/MSBuild (toolchain, outside the compiler) |

If the existing row schema cannot represent the feature, change the generic
abstraction first. Do not add a per-feature switch.

## Worked Example: `readFileSync`

```ts
import { readFileSync } from "node:fs";

export function load(path: string): string {
  return readFileSync(path, "utf8");
}
```

### Layer 1 — Compiler Meaning

TS-Go/TSTS owns: the `ImportDeclaration` and `CallExpression` syntax;
resolution of `"node:fs"` through the installed provider declaration; the
exact `readFileSync` symbol and declaration; selection of the overload whose
second parameter accepts `"utf8"`; the selected result type `string`; any
source diagnostic. It does **not** know C# will call
`Tsonic.CSharp.Node.fs.readFileSync`. An invalid call
(`readFileSync(123, "utf8")`) is rejected here; no target mapper may rescue it.

### Layer 2 — Extension Evidence

The extension API delivers the checker's completed decision as a checked-call
observation: call node, selected callee symbol/declaration, selected
signature, parameter slots, source arguments, source result, lifecycle phase.
It also provides provider declaration registration, exact fact subjects,
checking-phase deferral, deterministic finalization, and atomic publication or
rollback. The C#/Node extension consumes this evidence; it must not call the
checker again or infer an overload from `"utf8"`.

The fact mechanism belongs to Layer 2; individual fact meanings do not. A
portable `field<T>()` fact is Layer 3 source-core data. A C# operation payload
is Layer 4 target data. Both may use the Layer-2 fact store without becoming
Layer-2 semantics.

### Layer 3 — Shared Tsonic Capability

The generic host prepares the installed plugin, validates plugin identity and
target ownership, registers provider declarations, recognizes exact
`moduleOwnership` for `node:*`, routes the kind-tagged contribution
(`csharp-provider-operations`) to the selected target, and collects runtime
artifact requirements. Core treats the contribution payload as opaque
target-owned data. No central code may resemble
`if (providerPackage.id === "nodejs") { ... }`.

### Layer 4 — Specific Implementation

`@tsonic/csharp-nodejs` owns the `"node:fs"` declaration, the `readFileSync`
overload identities, the declarative mapping row
(`../csharp-nodejs/nodejs/src/provider/filesystem/calls.ts:157`) from exact
selected provider signature → C# target member, the required runtime DLL, and
the closed runtime implementation
(`../csharp-nodejs/csharp/src/Tsonic.CSharp.Node/fs/readFileSync.cs:12`). The
C# backend
(`../tsonic-csharp/src/backend/planner/expression-target-members/call.ts:45`)
reads the finalized selected target call and emits only a typed Roslyn
`InvocationExpression`. If selected evidence is missing, compilation fails
closed; Layer 4 never recovers by source-name matching.

## The Decision Pipeline (Canonical Flow)

```text
TypeScript source + tsonic config + installed packages
                         │
                         ▼
             Prepared plugin composition          (Layer 3)
                         │
            noLib + selected source profiles
            provider virtual declarations
                         │
                         ▼
                 TSTS front end                     (Layer 1)
             parse → bind → check
                         │
        exact selected source evidence
    declaration/signature/arguments/result
                         │
                         ▼
       retained operation + specific policy         (Layers 2 and 4)
                         │
       policy executes inside checked-operation
       checking/finalization and commits atomically
                         │
           finalized semantic graph
      operations + carriers + conversions
      shapes + diagnostics + runtime needs
                         │
                         ▼
               target backend/lowering              (Layer 4)
                typed C# target AST
                         │
                         ▼
                     printer
                         │
           generated .cs + project artifacts
                         │
                         ▼
            user-owned/generated .csproj
                     dotnet/MSBuild                 (toolchain)
```

Ownership rule:

- generic analysis records structure and use;
- TSTS owns checked source selection;
- source core is a shared Tsonic capability that owns portable source
  semantics through the extension API;
- surfaces own their semantic policy;
- provider packages own library declarations and target mappings;
- targets own target payloads and lowering policy;
- backend owns target AST construction only;
- runtimes own closed observable helpers;
- target toolchains own build/deployment configuration.

The key distinction:

- TSTS decides **what source operation TypeScript selected**.
- Provider/surface policy decides **what target operation implements it**.
- Finalized facts preserve that decision.
- The backend only constructs typed target syntax from those facts.
- The runtime implements closed observable behavior.

## How Placement Is Decided

Ask these questions in order for every feature:

1. **Is this a fact determined by normal TypeScript checking?**
   Put it in Layer 1. Expose it through Layer 2 if extensions need it.
2. **Is this a generic mechanism for delivering, retaining, or finalizing
   compiler evidence?**
   Put it in Layer 2.
3. **Is this reusable Tsonic product composition shared across targets,
   surfaces, providers, or analyzers?**
   Put it in Layer 3.
4. **Does it mention a concrete surface, provider, target, backend, runtime,
   or target operation?**
   Put it in Layer 4 as policy/data over the generic mechanisms.

A feature normally spans all four layers. It must be split vertically rather
than implemented wholly in whichever repository first encounters the failure.

### Diagnostic Placement Examples

**`pair[index]` has a selected tuple ordinal.** TS-Go knows the selected
ordinal → Layer 1. `sourceSelectedElementIndex` exposes it → Layer 2. A shared
checked-element plan envelope may live in Layer 3. C# chooses tuple
field/storage emission → Layer 4. Inferring the ordinal from an initializer in
C# is Layer 4 illegally reconstructing Layer 1 meaning.

**`Task<string>` maps to CLR `Task<TResult>`.** Type-argument selection and
source family identity → Layer 1. Selected type-argument evidence and
provider-family declaration contract → Layer 2. Installed target/provider
contribution routing → Layer 3. Mapping to
``System.Threading.Tasks.Task`1<string>`` → Layer 4. TSTS must not produce a
C# target ref; C# must not infer generic arity from `_1`.

## Placement Of The Previously Proposed Abstractions

| Previous concept | Correct placement |
|---|---|
| `CheckedOperationSelection` | Layer 2 |
| `PreparedPluginRegistry` | Layer 3 |
| `SourceDeclarationPlan` | Layer 3 |
| `RuntimeArtifactLedger` envelope | Layer 3 |
| C# runtime-reference payloads | Layer 4 |
| `FinalizedTargetProgram` envelope | Layer 3 |
| C# operation/backend plans | Layer 4 |
| Generic `ArrayPlan` | too ambiguous — split |
| Source array-use semantics shared by independent target analyses | Layer 3 |
| CLR-array carrier/emission plan | Layer 4 |
| Generic `ObjectShapePlan` | too ambiguous — split |
| Checker-selected structural type evidence | Layer 1, exposed by Layer 2 |
| Tsonic portable object-shape/use analysis | Layer 3 |
| C# record/class/projection plan | Layer 4 |

The final semantic graph should expose explicitly placed concepts:
`PreparedPluginRegistry`, `PreparedTargetComposition`, and
`SourceDeclarationPlan` at Layer 3; `CheckedOperationSelection` and its
transactional lifecycle at Layer 2; portable `SourceArrayUse` and
`SourceObjectShapeUse` only where they are truly cross-feature Layer-3 data;
target-specific carrier/projection plans at Layer 4; and shared envelopes for
`DiagnosticPlan`, `RuntimeArtifactLedger`, `FinalizedTargetProgram`, and
`TargetArtifactPlan` whose payloads remain owner-specific.

## How Drift Maps To The Layers

- **Backend checker re-query:** Layer 4 reaches through Layers 3 and 2 into
  Layer 1.
- **Raw source scanning in the host:** Layer 3 attempts to replace Layer 1
  semantic analysis.
- **C# local type-argument inference:** Layer 4 reconstructs Layer 1 evidence
  missing from Layer 2.
- **Node special-casing in core:** Layer 4 policy leaks into Layer 3.
- **Duplicate standard/C# facts:** ownership between Layers 2–4 is undefined.
- **Target names in generic algorithms:** Layer 4 data has leaked into Layer 3
  logic.

## Required Feature Workflow

Every feature analysis contains this placement table before implementation:

```text
Source behavior:
Compiler-owned decision:
Required extension evidence:
Shared Tsonic capability:
Specific target/provider policy:
Finalized backend input:
Runtime/toolchain behavior:
Fail-closed condition:
Tests at each layer:
```

Implementation proceeds bottom-up:

1. Prove the compiler decision.
2. Add missing neutral TSTS evidence.
3. Add the shared Tsonic envelope only when genuinely reusable.
4. Add target/provider policy as declarative data.
5. Traverse compiler-owned syntax but make every semantic choice solely from
   finalized facts/plans.
6. Test each boundary independently and end-to-end.

## What Remains Sound (Retained Foundations)

- Strict product `noLib`: `packages/host/src/program-options.ts:35`
- Generic plugin contribution envelope: `packages/target-api/src/plugins.ts:31`
- Source-core exact producer direction:
  `packages/source-core/src/attribute-builder-producers.ts:73`
- TSTS retained checked-operation finalization
- Provider virtual declaration facts
- Exact selected method/callee/property/element evidence
- Typed C# target AST: `../tsonic-csharp/src/backend/roslyn/syntax/types.ts:1`
- Fail-closed printer: `../tsonic-csharp/src/print/csharp-printer/fail-closed.ts:1`
- No raw C# snippet channel
- No runtime member-discovery reflection or C# `dynamic` in compiler/backend
  paths
- User-owned project mode that does not mutate `.csproj`:
  `../tsonic-csharp/src/backend/planner/project-artifacts.ts:23`
- ESM-only plugin/package architecture
- Parallel test runner's recursive file inventory and disabled-test checks

Tsonic does not need a total rewrite. It needs a substantial semantic-boundary
refactor that makes these foundations the only paths.
