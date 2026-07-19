# Source-core attribute builder cannot publish selected source semantics

## Status

Blocked at the TSTS source-semantics ownership/extension contract.

## Exact artifact

- Isolated repository: `/home/jeswin/temp/tsts`
- Branch: `tsts-v0-fixes`
- Vendored commit: `c8b97365aa4dc436a248b69261d36191dc44c5d8`
- Implementation commit: `3407b2f8139877f5c4ff0625131994722ad40147`
- Built and vendored files: `1,808`
- Sorted relative-path/content manifest SHA-256: `c15f97ff87d121116b1de115c3f2f98ffc4bbc87e549fd605a7b9f6fd5e7e9a3`
- Byte equivalence: `diff -qr` produced no output
- Official `/home/jeswin/repos/tsoniclang/tsts` checkout: untouched

## Source-level trigger

The portable source-core API is a selected builder protocol:

```ts
import { attribute } from "@tsonic/core/lang.js";

class User {
  constructor(id: string) {}
}

attribute<User>().add(SerializableAttribute);
attribute<User>().constructor().add(ObsoleteAttribute, "constructor");
attribute<User>().constructor().parameter("id").add(ObsoleteAttribute, "id");
```

The full focused proof also covers selected methods, properties, parameters, return targets, and backing fields.

Normal TS-Go checking succeeds. During `binder.afterSourceFileBound`, `tsonic.source-core` attempts to publish the finalized builder application through TSTS's public `attributeFactKey`.

Actual diagnostics:

```text
FACT_WRITER_OWNERSHIP_VIOLATION:
Extension 'tsonic.source-core' cannot write fact key
'tsts.source-semantics:attribute' owned by 'tsts.source-semantics'.

LIFECYCLE_HOOK_FAILED:
Extension 'tsonic.source-core' failed during lifecycle event
'binder.afterSourceFileBound'.
```

Focused command:

```bash
NODE_OPTIONS=--max-old-space-size=2048 \
  node --test \
  --test-name-pattern='provider-backed attribute selector facts' \
  test/source-semantics.test.mjs
```

Result: `0/1`, with the exact ownership violation above.

## Existing TSTS source semantics

TSTS correctly owns and records the direct marker form:

```ts
const route = attribute<RouteAttribute>("/users");
```

Its `AttributeFact` means:

```text
target        = RouteAttribute type node
attributeName = RouteAttribute
arguments     = ["/users"]
```

The source-core builder is a different semantic operation:

```ts
attribute<User>().method(x => x.save).parameter("route").add(ObsoleteAttribute, "reason");
```

It must retain both sides:

```text
application target = selected User.save parameter "route"
attribute type      = selected ObsoleteAttribute expression/provider identity
attribute arguments = ["reason"]
```

The root `attribute<User>()` fact alone cannot represent the selected `.add(...)` application.

## Causal chain

```text
source imports source-core attribute builder
  -> TSTS source semantics records the root attribute<User>() marker fact
  -> TS-Go checks the provider-backed builder chain normally
  -> source-core needs an exact fact for the terminal selected add call
  -> current source-core lifecycle scans the call and writes TSTS attributeFactKey
  -> hardened fact ownership rejects the cross-owner write
  -> the lifecycle transaction fails
  -> C# never receives a finalized portable attribute application fact
  -> no attribute target operation or emitted C# attribute can be proven
```

## Why the current source-core path cannot be retained

The ownership rejection is correct. `attributeFactKey` belongs to `tsts.source-semantics`; source-core must not write it directly.

The current fallback implementation is also not acceptable as final architecture because it runs at `afterSourceFileBound` and reconstructs the builder protocol by:

- walking every call expression;
- matching the source spelling `add`;
- following a hardcoded set of chain method spellings;
- deriving the selected application from AST shape before checked-operation finalization.

Changing only the fact key to a source-core-owned key would remove the ownership error but preserve source-name/AST reconstruction. That is not sufficient.

The target semantic provider cannot solve this either:

- C# owns the active target checked-call mapper;
- source-core is target-neutral and cannot become a second target mapper owner;
- `beforeSemanticsFinalized` lifecycle hooks run before retained checked operations commit;
- source-core therefore cannot consume finalized `selectedTargetSignatureFactKey` there;
- C# must not infer portable source-core meaning from member names.

## Required generic contract

TSTS needs one target-neutral way for a source-semantics extension to declare or observe a selected source operation protocol whose fact is owned by that source extension.

The contract must:

1. deliver exact checker-selected call/member/declaration/signature evidence after normal TypeScript validation;
2. allow the source extension to own its result fact key;
3. support chained protocols without source-name matching or raw AST traversal;
4. compose with the active target mapper without creating a second target-operation owner;
5. participate in TSTS-owned checked-operation ordering, deferral, rollback, and finalization;
6. expose exact terminal arguments and selected receiver/member identity;
7. publish nothing for local/shadowed same-spelling functions or invalid calls;
8. let targets consume only the finalized source-owned fact.

An alternative is a generic declarative source-marker protocol in `createSourceSemanticsExtension` that can describe a root marker plus provider-identity-backed fluent terminal operation. The architecture, not the source-core names, must be generic.

No C# target refs or attribute-specific C# placement rules belong in TSTS. TSTS/source-core should prove only the portable selected builder application; C# remains responsible for mapping that fact to C# attributes.

## Required neutral regression

Use a fake source module and fake provider-backed fluent builder:

```ts
mark<Owner>()
  .select(x => x.member)
  .terminal(Metadata, "argument");
```

Prove:

- exact root owner type evidence is retained;
- exact selected fluent member identities are retained;
- exact terminal metadata expression and argument subjects are retained;
- the source extension publishes only its own fact key;
- the active fake target mapper can independently consume the source-owned fact;
- local/shadowed `mark`, `select`, or `terminal` spellings produce no facts;
- invalid source calls retain normal TypeScript diagnostics and publish no facts;
- a sibling rejection rolls back the complete source operation transaction;
- no source text scan, checker re-entry, raw AST field probe, or target-name inference is used.

## Forbidden consumer workarounds

- allowing cross-owner writes to `attributeFactKey`;
- disabling `FACT_WRITER_OWNERSHIP_VIOLATION`;
- defining a new key while retaining source spelling/AST-chain reconstruction;
- making source-core a target semantic provider;
- making C# infer `.add`, `.method`, `.property`, or other builder meaning;
- checker re-entry or local selected-signature reconstruction;
- accepting incomplete application facts.

## Acceptance after the TSTS contract

1. Source-core uses the generic selected source-operation contract and owns its builder-application fact.
2. The current raw builder call scanner is deleted.
3. Direct TSTS `attribute<T>(...)` semantics remain unchanged.
4. Source-core direct, alias, namespace, shadowing, invalid-call, selector, and chained-placement tests pass.
5. C# attribute source-semantics and CLI/toolchain proofs pass without source-name inference.
6. The complete source-semantics bank passes `40/40`.
7. Proof Pudding and the full parallel host/C#/runtime gate pass.
