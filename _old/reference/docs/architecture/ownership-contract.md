# Shared ownership and async result-use contract

This document records the approved source-domain contract for Keel.
The existing source/storage APIs provide checked identities, bindings and use
evidence. The neutral retention premises, continuation proof and D11/D12
decisions below are Phase 3 obligations; this document does not claim those
readers or diagnostics are already implemented.

Workspace policy remains authoritative for compiler-understood guarantees,
native costs, absence and greenfield replacements:

- [Workspace agent policy](workspace-agent-policy.md)

## Owners and boundaries

| Owner | Responsibility |
| --- | --- |
| TSTS and source extension facts | Checked declarations/types, source identity, selected calls, substitutions and authored contracts |
| Providers and source-profile contracts | Exact native declaration/lifetime/signature evidence and source-operation effects, transported through existing checked identities |
| `packages/target-api/src/target-analysis/ownership/` | The shared retention/dependency and result-use decisions, consuming existing source navigation and bounded storage evidence |
| Each target's `analysis/` | Native lifetime, storage and suspension demands; consuming the common decisions and publishing source diagnostics before sealing |
| Each target's `policy/` | One construct's physical ownership selection from checked evidence and admitted records |
| Each target's `backend/planner/` | Translating sealed decisions, without recomputing retention or repairing generated clones |
| Runtime | Executing the selected representation and discarded-rejection observation, not discovering source ownership |

The shared predicate has one implementation. The two targets cannot send
different unchecked `borrowedInputs` lists to a nominally common helper and
call that symmetry. A private typed keyed store is allowed behind the canonical
record-family readers; its equality, conflict and sealing guarantees remain.
Checker extension facts are not target-plan records and remain at their source
boundary.

## Retained, transferred and scoped-borrowed

Classify each captured or suspended dependency using its actual bound origin,
not a generic declaration or a chosen target parameter spelling.

| Relationship | Required evidence | Meaning |
| --- | --- | --- |
| Retained | An owning value, module owner or checked retained-owner relation valid for the computation | The computation keeps the needed owner alive without an outstanding source-scope lease |
| Transferred | Exact source-use evidence plus the native move/ownership contract | The computation owns the transferred value; later source uses and observable aliasing remain valid |
| Scoped-borrowed | A declared non-owning view, its exact owner, valid region and shared/mutable mode | The computation depends on that owner's valid scope and cannot invent an owning escape |

Unknown evidence remains unresolved. `Clone` establishes an operation, not
cheap sharing; a shared reference does not prove retained ownership. Plain
TypeScript `this` use, a generated `&self`, a generic lifetime spelling or a
wrapper's name cannot manufacture a lease. Providers transport native-compiler
guarantees; custom "already shared", "nonretaining" or "cheap clone" promises
are not substitute premises.

An ordinary owning source object used by an escaping computation creates an
owning-storage demand. If Rust previously selected a temporary receiver borrow,
the target must resolve that demand correctly. It must not impose an artificial
source lifetime restriction on C# or reject the source to conceal that choice.
An actual authored/native-contract non-owning lease is different: its owner and
region are part of the checked operation's requirements.
A proven program-duration owner does not become a non-static D12 dependency
merely because its native representation uses a reference. The restriction
concerns a real source-scoped lease whose owner cannot be retained independently.

## What D12 still needs

Existing `SourceStorageQueries` locate implementations, actual arguments,
bindings, origins and execution regions. `sourceExpressionResultUse` identifies
`consumed` or `discarded`; source navigation also inventories aliases, captures,
stores and returns. None alone proves the following three premises:

1. The exact lease/retained-owner correspondence of a checked value.
2. That a selected suspension operation can become pending.
3. That the dependency remains needed in a continuation after that operation.

The shared ownership owner must close these premises through the existing
checked contracts and one bounded source/storage owner. Include actual
substitutions, aliases, captures, relevant default initializers, control-flow
joins, loops, handlers and cleanup. Skip nested callable bodies unless their
checked execution relation invokes them. Open callees and incomplete effects
must remain unresolved, not become empty dependency sets.

An `async` modifier is not proof of pending work. Neither is syntactic `await`
of an ordinary integer. A dependency used only before suspension does not
become a suspended lease. Conversely, a borrowed completion payload still
needs its existing payload lifetime/escape proof even if the body cannot
suspend. Direct-await lowering cannot erase that payload obligation.

## Result disposition

Classify the selected call's result through checked parents, aliases and value
flow. Transparent assertions/parentheses do not change the disposition.

| Disposition | Example use shape | Required treatment |
| --- | --- | --- |
| Awaited in scope | `await operation(value)` | Completion is observed within the owner's region; prove that region remains valid |
| Discarded | `operation(value);`, `void operation(value)` | No returned async value is consumed; apply D-03 or D11 according to the selected surface |
| Stored | `const pending = operation(value)` | Promise-object storage in this PR, even if `pending` is awaited later |
| Returned | `return operation(value)` | The async value escapes the current region |
| Awaited completion returned | `return await operation(value)` | Not a return of the Promise object; preserve any completion-payload lease separately |
| Passed | `consume(operation(value))` | Resolve the selected consumer's parameter use, or leave unresolved; do not assume scoped consumption |

Comma-left values and loop initializer/incrementor results can also be discarded.
Conditional/short-circuit operands require their checked selected-value paths.
The current `consumed` category must not be treated as proof of immediate await.
A call passed to another function is not automatically an approved borrowed
escape rejection: establish its actual downstream disposition first.

## Admission and reporting decisions

| Decision | Pre-seal rule | Consumer |
| --- | --- | --- |
| D-03 | A discarded selected native source async-call result rejects with `TSONIC_NATIVE_ASYNC_RESULT_DISCARDED` on both targets | Target analysis emits the diagnostic; no native output is published |
| D11 | A discarded JS-surface Promise-valued call is marked for rejection observation | Both runtimes start it eagerly; rejection reports to stderr and exits with code 1 after the current job |
| D12 | A proven scoped-borrowed dependency needed across a possibly pending operation, with a discarded/stored/returned async result, rejects with `TSONIC_BORROWED_ASYNC_RESULT_ESCAPES` | Both targets consume the identical shared decision at the exact call site |

D11 does not add a universal registry of every stored, unobserved Promise.
That separate behavior remains follow-up scope. D12 permits directly awaited
scoped borrowing; eager scheduling must preserve those admitted cases safely.
Admission still requires stable backing storage, valid owner lifetime and the
native contract's shared/exclusive aliasing guarantees. An in-scope `await`
does not by itself discharge those proofs.
The decision is made before sealing, not inferred from native diagnostics or
generated lifetime names. Missing premises require a precise unresolved-proof
diagnostic, not a false claim that a source lease was demonstrated.

### Ordinary receiver example

With the JS surface selected, this complete source requires no suspended-input
lease merely because Rust can implement `read` using a temporary `&self`:

```ts
import type { int32 } from "@tsonic/core/types.js";

class Value {
  value: int32;
  constructor(value: int32) { this.value = value; }
  async read(): Promise<int32> { return this.value; }
}

export async function main(): Promise<void> {
  const value = new Value(3);
  if (await value.read() !== 3) throw new Error("incorrect value");
}

main();
```

Expected behavior is successful completion with no output. The body returns
an integer without pending work. Its native completion can be ordinary value
computation; its JS entry contract remains Promise-valued. A stored result of
this particular method is not a D12 violation without a demonstrated source
lease. This expected lowering is a proof obligation, not a claim that the
current emitter already performs it.

### Explicit lease proof cases

For a fixture whose checked native declaration establishes a non-owning lease
and a genuinely potentially pending `readLease` operation, the same-source
paired matrix is:

| Use inside the fixture | Expected D12 decision |
| --- | --- |
| `await readLease(lease)` while its owner is valid | Admit scoped borrowing |
| `readLease(lease);` | Reject the discarded suspended lease |
| `const pending = readLease(lease)` | Reject storage of the suspended lease |
| `return readLease(lease)` | Reject return of the suspended lease |
| `return await readLease(lease)` | Admit completion within scope; separately check payload ownership |
| A checked owned actual substituted into a lifetime-generic formal | Do not infer a lease from the generic signature alone |

`readLease` denotes a proof fixture's declared operation, not a new public
Tsonic API. The fixture must supply the exact selected declaration, checked
owner/region correspondence and pending effect for both native mappings.
Spelling a variable `lease` or returning a Promise is not that evidence.

## Completion gates

- Preserve the four historically observed scoped awaited call sites. Nine
  generic declaration occurrences are not nine concrete borrowed calls.
- Test ordinary receivers and non-suspending bodies separately from explicit
  non-owning leases. No extra source annotation is justified by a temporary
  native borrow alone.
- Run identical positive and negative source cases on C# and Rust for every
  result disposition, including aliases, conditional values and `return await`.
- Prove complete continuation dependencies or reject the missing proof before
  sealing; exercise cleanup, loops, default initializers, opaque calls and
  resource exhaustion without guessing admission.
- Re-run the acceptance census after Express and full Tsumos emit. Their
  earlier missing output cannot establish zero escaped leases.
- Verify native execution, aliasing, mutation, lifetime and actual retention
  costs. Shared semantic analysis itself adds no emitted runtime wrapper.

Retention that an acceptance program genuinely needs must be solved at its
owning representation layer, not diagnosed away to make certification pass.
Reusing an existing retaining owner and allocating a new retaining owner are
different costs; neither a reference-count operation nor native compilation
alone proves cost minimality. Runtime ordering and queue costs belong to the
runtime contract, not a competing implementation in this shared reader.
