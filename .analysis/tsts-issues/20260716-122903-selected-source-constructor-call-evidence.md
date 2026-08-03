# TSTS blocker: selected source constructor call evidence

## Consumer state

- Tsonic branch: `fix/selected-evidence-proof-closure-20260713`
- Tsonic-CSharp branch: `fix/selected-evidence-proof-closure-20260713`
- Vendored TSTS source: isolated `/home/jeswin/temp/tsts` commit `e38b1731790214cfadac4176b2e7832a488d836b`
- Official `/home/jeswin/repos/tsoniclang/tsts` checkout must remain untouched.

## Summary

Two related gaps prevent C# from closing project-source constructor calls solely from TSTS-selected evidence:

1. An imported source class construction exposes the import specifier as `sourceCalleeDeclaration`, not the resolved class declaration.
2. A same-file source constructor exposes `sourceSelectedSignature`, but the request does not expose selected parameter type subjects or authored parameter type nodes. Those facts are needed during checked-call observation, before C# lifecycle facts have been finalized.

C# must not resolve either gap by following aliases, re-querying the selected call, reading raw AST fields, inferring from names, or asking the checker for a type to see what works.

## Blocker A: imported source constructor declaration

### Source

`entities.ts`:

```ts
export class PostEntity {
  Id: int = 0;
}
```

`posts.ts`:

```ts
import { PostEntity } from "../db/entities.ts";

const post = new PostEntity();
```

### Actual checked-call request evidence

At `posts.ts:99:22`, the request has:

```text
sourceSelectedSignature: present
sourceSelectedDeclaration: absent
sourceCalleeSymbol: present
sourceCalleeDeclaration: KindImportSpecifier
sourceCalleeDeclaration file: posts.ts
```

The C# target therefore knows that TSTS selected a valid construction signature, but the only declaration subject identifies the local import syntax. It does not identify the selected project-source class in `entities.ts`.

### Actual diagnostic

```text
TS9100185 CSHARP_CHECKED_CALL_TARGET_BINDING_NOT_PROVEN
posts.ts:99:22
C# checked call has TSTS-selected source evidence, but no provider,
source-profile, or project-source target call contract owns it.
```

No C# artifacts are emitted.

### Why C# cannot close this safely

Following the import alias in C# would require `getAliasedSymbol`, symbol/declaration fallback chains, or project-source declaration rediscovery. That would make C# reconstruct the source operation identity that TSTS already selected. It is the rejected selected-evidence reconstruction class.

The request should expose the checker-resolved callee symbol/declaration. For this source, the selected declaration must identify `PostEntity` in `entities.ts`, not the import specifier in `posts.ts`.

### Neutral regression requested

```ts
// model.ts
export class Model {}

// consumer.ts
import { Model } from "./model.js";
export const value = new Model();
```

Observe `operation.mapCheckedCall` and prove:

- `sourceSelectedSignature` is present;
- selected callee evidence identifies the resolved `Model` class declaration;
- the import specifier remains available only as syntax provenance if TSTS intentionally exposes it separately;
- behavior is identical for direct imports, renamed imports, and re-exports;
- no consumer must call `getAliasedSymbol` or infer from `Model` spelling.

## Blocker B: selected source constructor parameter types

### Source

```ts
import { DbContext, DbContextOptions } from "@tsonic/efcore/Microsoft.EntityFrameworkCore.js";

export class Context extends DbContext {
  constructor(options: DbContextOptions) {
    super(options);
  }
}

export function create(options: DbContextOptions): Context {
  return new Context(options);
}
```

### Actual evidence and lifecycle

For `new Context(options)`:

- `sourceSelectedSignature` is present;
- `sourceSelectedDeclaration` identifies the constructor;
- `checker.getSignatureParameters(sourceSelectedSignature)` yields the exact selected parameter symbol;
- the parameter symbol/declaration does not yet have a finalized target carrier fact during `operation.mapCheckedCall`;
- C# lifecycle propagation that records the authored `DbContextOptions` target fact runs later.

The exact source parameter type is therefore not available through finalized facts at the observation point.

### Actual diagnostic

```text
TS9100183 CSHARP_SOURCE_CALL_PARAMETER_FACT_NOT_PROVEN
ContextConstruct.ts:13:10
C# source-owned call requires finalized parameter target facts for the exact
TSTS-selected source declaration.
```

No C# artifacts are emitted.

### Rejected consumer workarounds

C# must not:

- call `getResolvedSignature` on the call;
- call `getTypeOfSymbol` as a fallback after target facts are absent;
- inspect raw `Type` fields on parameter declarations;
- infer `DbContextOptions` from source spelling;
- defer and let the backend recover;
- accept an open or unrenderable target parameter type.

### Generic evidence requested

Please expose selected source parameter evidence on the checked-call request or through a public selected-signature query. The evidence should remain source-owned and target-neutral. A suitable shape would identify, for each selected source parameter:

```text
parameter name
parameter symbol
parameter declaration, when one exists
selected source type subject
authored type node, when one exists
```

This is analogous to `sourceSelectedMethodTypeArguments`: TSTS supplies selected source evidence; C# maps that evidence through provider/source facts into target refs. TSTS must not produce C# target refs.

Synthesized parameters must be represented explicitly or fail closed. The contract must cover implicit zero-parameter constructors without asking `AstReader.parameters(classDeclaration)`, because a class declaration is not a callable parameter-list node.

### Neutral regression requested

Use a neutral no-lib provider type:

```ts
import type { Options } from "@acme/native.js";

class Service {
  constructor(options: Options) {}
}

export function create(options: Options): Service {
  return new Service(options);
}
```

Prove that `operation.mapCheckedCall` exposes the selected constructor parameter's source type/provenance directly, including an imported provider-backed type and a source type alias. Also cover an implicit zero-argument constructor.

## Consumer behavior already fixed

C# now:

- uses `sourceSelectedSignature` for source-owned parameter identity;
- never calls `AstReader.parameters` on a class declaration;
- accepts exact parameter facts attached to the selected parameter symbol or its exact declaration;
- rejects missing parameter facts with `TS9100183`;
- rejects selected calls with no final owner using `TS9100185` and a concrete source span;
- does not follow the import alias or query raw AST fields.

Focused C# gates at the blocked consumer state:

```text
source-owned call closure + target type facts + provider fail-closed: 49/49
failures: 0
skips: 0
todos: 0
```

The EF-only provider reducer is green through LINQ and `ToArrayAsync` when it does not require the two missing project-source constructor evidence forms. Proof Pudding remains blocked unchanged at the imported `new PostEntity()` call.

## Acceptance sequence after a TSTS fix

1. Build and vendor the exact isolated TSTS artifact byte-for-byte.
2. Add a C# request-consumer test for the new selected source parameter evidence.
3. Run the same-file `new Context(options)` reducer; require artifacts and a successful generated C# build.
4. Run the imported `new PostEntity()` reducer; require artifacts and no alias reconstruction in C#.
5. Run focused source-owned/provider/source-profile gates.
6. Run Proof Pudding unchanged through ASP.NET + EF.
7. Run the complete parallel host/C#/runtime gate.

If the intended TSTS contract is different, please state the exact public request/query that supplies both the resolved imported class declaration and selected constructor parameter type provenance without consumer-side checker re-entry.
