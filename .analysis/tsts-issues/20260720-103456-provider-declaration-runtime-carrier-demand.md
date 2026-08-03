# Provider declaration runtime-carrier demand blocks selected operations

## Affected Artifact

- Isolated TSTS repository: `/home/jeswin/temp/tsts`
- Vendored commit: `b2e5d695568360d3cf7627ed291bf6959d82e167`
- Vendored file count: `1,932`
- Vendored aggregate path/content SHA-256: `b3ef0492bfab20db6af329cd3bb1a70ea87b045bdd943ad8b566c2977cae0b12`
- Official `/home/jeswin/repos/tsoniclang/tsts` checkout was not touched.

## Neutral Source Shape

```ts
import { Buffer } from "node:buffer";

export function value(): Buffer {
  return Buffer.from("x", "utf8");
}
```

The provider declaration model contains a concrete `Buffer` class and a synthetic module-facade interface named `NodeBufferModule`. `Buffer` has an exact provider target binding. `NodeBufferModule` intentionally has no concrete runtime carrier because selected module operations lower directly through their provider member identities.

## Exact Failure

Source checking succeeds with no TypeScript diagnostics. During TSTS source-decision publication, `type.resolveRuntimeCarrier` receives two relevant requests:

1. User-authored `/src/index.ts` `Buffer` type reference:
   - `sourceTypeReference`: exact `KindTypeReference` in `/src/index.ts`;
   - `sourceSymbol`: exact provider `node:buffer#Buffer` symbol;
   - `targetBindingFactKey` on that symbol: `Tsonic.CSharp.Node.Buffer`;
   - provider identity target: `{ kind: "target-named", id: "Tsonic.CSharp.Node.Buffer" }`.

2. Provider-internal declaration-only type reference:
   - source file: `tsts-provider://tsts-internal/...tsts-export-owner-....d.ts`;
   - `sourceTypeReference`: `KindTypeReference`;
   - `sourceSymbol`: exact provider `node:buffer#NodeBufferModule` symbol;
   - no `targetBindingFactKey` and no exact runtime carrier, by design.

The C# mapper now resolves the first request only from finalized exact type-reference and declaration-invariant symbol facts. It performs no checker re-entry. It correctly defers the second request because no runtime carrier is proven. TSTS then emits:

```text
OBSERVATION_OWNER_DEFERRED
Extension 'tsonic.csharp.target-semantics' owns semantic observation point
'type.resolveRuntimeCarrier' but deferred observation.
```

The same class appears for synthetic default-module façade declarations such as `NodeProcessModule`. Downstream `CSHARP_OPERATOR_NOT_MAPPED` diagnostics for `??` and `+` are fallout when the failed carrier transaction prevents the exact operand carrier facts from finalizing.

## Source-to-Fact Causal Chain

1. TS-Go accepts `Buffer.from("x", "utf8")` and selects the exact provider declaration/signature.
2. TSTS retains the selected call, callee, argument, result, receiver, and provider evidence.
3. The C# capability maps the call from that exact provider identity; it does not match `Buffer` or `from` by spelling.
4. TSTS publishes runtime-carrier source decisions.
5. The user-authored `Buffer` reference maps from its exact source type reference plus provider-symbol target binding.
6. TSTS also requires a carrier for a type reference that exists only inside its provider virtual `.d.ts` owner document.
7. No runtime carrier exists for the declaration-only module façade, so C# returns `deferObservation` rather than inventing one.
8. TSTS reports the owner as unresolved and the implementation proof cannot finalize.

## Required Generic Contract

Declaration-only/provider-virtual type references that cannot participate in runtime execution must not create required runtime-carrier observations. This should follow the same boundary already applied to checked calls/properties/elements/operators inside `.d.ts`, ambient, and type-only syntax.

If a provider declaration type reference is needed only to check another declaration, it must not require a target runtime carrier. If an implementation expression uses a type selected from that declaration, TSTS must retain and publish the exact implementation-side type evidence instead.

## Acceptance Gates

1. The source above has zero TypeScript and extension diagnostics.
2. The implementation-side `Buffer` request remains observable with its exact source type reference, provider symbol, and provider target binding.
3. No required runtime-carrier request is published for `NodeBufferModule` or another declaration-only provider type reference.
4. Default provider-module calls can finalize through exact selected member/signature evidence without inventing a runtime carrier for their synthetic module façade.
5. A real implementation value whose runtime carrier is unresolved still fails closed with `OBSERVATION_OWNER_DEFERRED`.
6. No target-specific suppression, module-name exception, source-name inference, checker re-entry, broad import, or fallback carrier is introduced.
7. Focused Node provider test `test/node-surface-completion.test.mjs` returns 13/13; the current exact result is 10/13, with the three remaining failures containing this unresolved carrier class and its operator fallout.

## Consumer Boundary

Tsonic-CSharp must not work around this by assigning `NodeBufferModule`, `NodeProcessModule`, or similar provider façade declarations an arbitrary C# type. It must continue to consume exact selected operation evidence and fail closed when a real implementation runtime carrier is missing.
