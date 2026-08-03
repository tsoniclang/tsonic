# TSTS Blocker: Truthful .NET Provider Model Exceeds the Provider Graph Scalar Budget

## Status

- State: blocked in TSTS provider declaration contract
- Tsonic branch: `fix/selected-evidence-proof-closure-20260713`
- Vendored TSTS source: `/home/jeswin/temp/tsts`
- Vendored TSTS commit: `59f9fab4ef25d245e4f8ec680d79729e64941508`
- Vendored file count: `1,752`
- Vendored manifest SHA-256: `9722f3e3e540b34f69ea1dfeb17d82f4ed74cf5d320fb33b81ce9662fce5bd04`
- Official checkout `/home/jeswin/repos/tsoniclang/tsts`: untouched

## Source Reproduction

The smallest product-level reproduction is an ordinary named import from the .NET provider:

```ts
import { Console } from "@tsonic/dotnet/System.js";

Console.WriteLine("hello");
```

The current source-profile gate also proves generic span operations:

```ts
import { Console, Span } from "@tsonic/dotnet/System.js";
import type { int } from "@tsonic/csharp/types.js";

const values: int[] = [1, 2, 3];
const span = new Span<int>(values);
const chunk = span.Slice(0, 2);
Console.WriteLine(chunk.Length);
```

Run from `/home/jeswin/repos/tsoniclang/tsonic`:

```text
node --test test/cli-build/source-profile-contract.test.mjs
```

Observed result:

```text
ERROR tsts.extension-host:TS9000018: Provider 'tsonic.csharp.dotnet-reflection-provider' returned an unsafe declaration graph for '@tsonic/dotnet/System.js'.
  evidence: Declaration graph rejection: {"reason":"complexity","path":"$.exports[12].members[48].signatures[4].returnType.id","depth":6,"limit":262144}
```

TSTS then reports `TS2307` because the provider module was rejected. C# correctly emits no artifacts. The later missing-operation and strict-native diagnostics are fallout from the rejected source module, not separate root causes.

## Source-to-Fact Causal Chain

1. The source imports only `Console` or `Console` plus `Span`.
2. TSTS supplies the exact named `importSlice` to the selected .NET target binding provider.
3. The provider reflects only the requested public export family and computes the same-module source declaration closure required to bind every `provider-ref` truthfully.
4. `Console` contains supported overloads whose source types include `ReadOnlySpan<T>`, `ConsoleColor`, `ConsoleKeyInfo`, and related public types.
5. Those declarations contain source-visible members with further same-module source types. For example:

```text
Console
  -> ReadOnlySpan<T>
  -> Span<T>
  -> IFormatProvider
  -> Type
  -> Guid
  -> DateTimeOffset
  -> DateTime / DateOnly / TimeOnly / TimeSpan
```

6. TSTS currently requires every same-module `provider-ref` to name a real export in the returned declaration model. The C# provider therefore cannot return an unbound reference or a declaration shell that lies about the source-visible type.
7. TSTS snapshots and validates the truthful model before rendering it.
8. `providerBoundaryMaxTotalStringCodeUnits` is `262_144`. The valid model exceeds that bound, so TSTS rejects the complete provider module before TypeScript checking or target fact selection.

## Verified C# Closure Correction

The C# provider had one independent over-closure defect: `targetDeclaringType` is target-only extension-dispatch metadata, but the same-module source-closure walker traversed it. That incorrectly pulled the declaring extension container into the source closure.

The C# branch now excludes `targetDeclaringType` from source closure and has a regression proving that `MemoryExtensions` is not included merely as target-only declaring metadata. Required source dependencies such as `Range`, `SpanSplitEnumerator`, and `TryWriteInterpolatedStringHandler` remain present.

Focused result after that correction:

```text
node --test test/dotnet-provider-part-03-net-target-binding-provider-preserves-requested.test.mjs
20/20 pass, 0 fail, 0 skip, 0 todo
```

The corrected provider model still exceeds the TSTS bound:

| Requested source exports | Provider exports | JSON code units | Scalar code units | TSTS limit |
|---|---:|---:|---:|---:|
| `Console` | 35 | 1,125,347 | 773,160 | 262,144 |
| `Span` | 27 | 994,632 | 688,050 | 262,144 |

For `Console`, scalar data is distributed as follows:

| Field | Code units | Occurrences |
|---|---:|---:|
| `id` | 563,315 | 3,055 |
| `kind` | 78,910 | 6,926 |
| `moduleSpecifier` | 35,669 | 1,346 |
| `name` | 33,536 | 5,592 |
| `displayName` | 29,052 | 1,375 |

There are 1,691 unique identity strings occupying 410,266 code units. Sharing repeated objects alone cannot bring the model under the current 262,144-code-unit bound: all unique strings together occupy 422,509 code units.

Reproduce the measurements from `/home/jeswin/repos/tsoniclang/tsonic-csharp`:

```text
TSONIC_ANALYZE_DEPENDENCIES_ONLY=1 node .temp/analyze-dotnet-model-size.mjs
```

## Why This Must Not Be Repaired in C#

The following local responses are invalid:

- omitting supported overloads or members;
- returning unbound same-module provider refs;
- replacing dependencies with incomplete structural shells;
- broadening imports or loading the entire namespace;
- selecting members from source spelling;
- shortening identities with an uncontracted C#-only hash scheme;
- interning objects merely to evade the boundary budget;
- retrying with a different provider answer;
- suppressing `TS9000018` or recovering in the backend.

Each option either changes the public source contract, loses selected provider identity, violates the hardened immutable provider boundary, or moves source selection into C# inference.

## Required Generic Contract Decision

TSTS needs a generic bounded contract that can represent real provider SDK surfaces. Architecture-safe solution families include:

1. Calibrate the per-model and aggregate provider graph budgets against legitimate provider models while retaining deterministic finite bounds and hostile-provider rejection.
2. Allow same-public-module dependencies to close transactionally through canonical export owners without requiring every dependency's complete declaration to be embedded in one candidate model.
3. Add a generic canonical identity/reference representation that avoids repeating long opaque provider identities while preserving exact selected declaration/member/signature evidence.

The final contract may combine these. The solution must remain target-neutral and must not contain C#, CLR, `Console`, `Span`, or source-name special cases.

## Acceptance Gate

1. A neutral fake provider regression covers a legitimate declaration graph larger than the former scalar bound or exercises the new chunked/canonical-reference contract.
2. The contract retains explicit finite limits for physical entries, expanded semantic nodes, nesting, scalar data, recursive candidates, exports, references, and owner visits.
3. Inputs beyond the supported bound still fail closed with deterministic provider diagnostics and no public partial artifacts.
4. The exact C# `Console` and `Span` models above pass provider graph validation without broad imports, source filtering, name inference, or incomplete declarations.
5. `import { Console } from "@tsonic/dotnet/System.js"` reaches normal TypeScript checking and selected provider facts.
6. The source-profile CLI gate reaches its intended results: the positive CLR program builds/runs, and the incompatible `Span.Slice` call fails for its target-carrier mismatch rather than provider graph rejection.
7. TSTS build, package contract, complete source suite, TS-Go harness, Porter, strict Porter, and provider canonical-graph tests remain green.

## Consumer Work After TSTS Resolution

Tsonic will vendor the exact isolated TSTS artifact byte-for-byte, rerun the focused provider and source-profile gates, run proof-pudding unchanged through ASP.NET, and then run the complete parallel C#/host/runtime gate. No C# identity or graph-budget workaround will be retained.
