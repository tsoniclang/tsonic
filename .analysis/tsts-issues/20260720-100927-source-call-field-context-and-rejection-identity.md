# TSTS blocker: source-call field context and rejection diagnostic identity

## Affected artifact

- Isolated TSTS repository: `/home/jeswin/temp/tsts`
- Vendored commit: `b2e5d695568360d3cf7627ed291bf6959d82e167`
- Vendored file count: `1,932`
- Vendored aggregate path/content SHA-256: `b3ef0492bfab20db6af329cd3bb1a70ea87b045bdd943ad8b566c2977cae0b12`
- Official TSTS checkout was not touched.

## Source-level reproduction

```ts
import { field, struct } from "@tsonic/core/lang.js";
import type { bool, int32 } from "@tsonic/core/types.js";

class Counter {
  value = field<int32>();
}

const Shape = struct({ enabled: field<bool>() });
const orphan = field<int32>();
```

The selected `field<T>()` calls all resolve to the same exact provider-owned source signature. The expected source facts are:

| Call | Expected source fact |
| --- | --- |
| `Counter.value = field<int32>()` | `FieldFact { name: "value", type: explicit int32 type node }` on the exact call/property subjects |
| `enabled: field<bool>()` | `FieldFact { name: "enabled", type: explicit bool type node }` on the exact call/property subjects |
| `const orphan = field<int32>()` | no field fact; one deterministic `SOURCE_SEMANTICS_FIELD_CONTEXT_NOT_PROVEN` diagnostic |

## Failure 1: class property context is not represented

TSTS `recordFieldMarker` in `packages/tsts/src/extensions/source-semantics.ts` accepts only a direct `KindPropertyAssignment` parent. The object-literal field therefore receives the expected fact, but the class property declaration does not.

The Tsonic source extension must not repair this by walking parents, reading raw AST fields, matching `field` by spelling, or re-querying the checker. Its exact checked-source-call producer can see the selected provider signature and source type argument, but the public operation evidence does not include a proven initializer owner or static member name.

Required generic resolution: either the TSTS source-semantics `field` marker contract must support exact class `PropertyDeclaration` initializer contexts, or the checked-source-call operation contract must expose an exact checker/schema-owned initializer context sufficient for the source owner to produce the fact. This must remain target-neutral and identity-based.

## Failure 2: repeated producer rejections conflict

The source-core checked-source-call producer correctly defers during checking and rejects during finalization when no `fieldFactKey` fact exists. Because the class property fact is missing, both the class field call and the actual orphan call return the same diagnostic code/message with different exact call nodes.

Actual exception:

```text
Error: Extension diagnostic identity '[["string","diagnostic-derived"],["string","tsonic.source-core"],["string","SOURCE_SEMANTICS_FIELD_CONTEXT_NOT_PROVEN"],["number",9901108],["string","error"],["string","field<T>() requires a proven static field-containing context."]]' resolved to conflicting immutable diagnostics.
```

The stack enters `ExtensionDiagnosticStore.#appendSnapshot` while `CheckedOperationInventory.prepareFinalization` publishes the second rejected operation.

`getDiagnosticIdentity` derives an omitted identity only from owner, code, numeric code, category, and message. It excludes the retained operation. The producer context exposes the exact call subject but no stable public operation identity or source-span accessor, so a source extension cannot create a stable operation-scoped string identity without forbidden raw node/object probing or extension-local ordering state.

This is independently reproducible with two invalid calls:

```ts
const first = field<int32>();
const second = field<int32>();
```

Both should produce two distinct diagnostics. They must not conflict, collapse, or require source extensions to derive identity from compiler object internals.

Required generic resolution: rejected checked-source-call diagnostics must be scoped by the exact retained operation when the producer omits `identity`, or TSTS must expose an immutable host-owned operation diagnostic identity. Replays of the same retained operation must stay idempotent; different operations with identical diagnostics must remain distinct.

## Acceptance gates

1. The unchanged class/object/orphan source above finalizes without throwing.
2. The class field and object-literal field receive exact `FieldFact` values; the orphan does not.
3. Exactly one orphan diagnostic is emitted for the mixed reproduction.
4. Two invalid orphan calls emit two distinct diagnostics without conflict.
5. Deferred checking/finalization replay remains idempotent for the same operation.
6. No C#, CLR, `field` spelling, source-text scan, checker re-entry, raw AST/object probing, or target workaround is introduced.
7. Existing checked-source-call atomic rollback and diagnostic-conflict tests remain green.

## Current Tsonic boundary

Tsonic will not add a local workaround. The source-core producer remains exact-signature selected and fail-closed. Independent provider-contract migration can continue, but Proof Pudding and the complete gate are blocked until this source contract is resolved.
