# JS-surface carriers

This is the approved closed-carrier contract for C# and Rust JS/Node surfaces.
The initial skeleton does not implement the Promise ABI replacement, parameter
carrier corrections or the carrier registry. The tables distinguish the
required destination from existing vocabulary; executable and cost gates must
establish the complete implementation.

Workspace policy is owned by `workspace-agent-policy.md`. Native semantics,
absence, ownership and performance follow that policy. This document specifies
where a supported JS API needs a closed carrier, not a second policy or a
general JavaScript object model.

## Selection and ownership

One per-construct type policy selects the carrier from exact checked evidence.
Analysis preserves it in the relevant sealed record and owns cross-construct
agreement. Planners render the admitted carrier; printers do not rediscover it.

| Responsibility | C# | Rust |
| --- | --- | --- |
| Carrier vocabulary | `target-model/types/carriers/` | `target-model/types/carriers/` |
| Checked type selection | `policy/types/resolution/` | `policy/types/resolution/` |
| Cross-construct agreement and publication | `analysis/`, `analysis/program/records/` | `analysis/`, `analysis/program/records/` |
| Closed broad values | Core `Values/TsValue.cs`, closed object/callable carriers | JS `value/mod.rs` and core closed carriers |
| Promise settlement and reactions | JS `Asynchronous/` | JS `promise.rs`, `promise/` |
| Rejection boundary | `object?`, existing thrown-value exception transport | `JsValue`, existing retained Error conversion |

Native imported declarations retain their exact selected types and qualifiers.
The JS surface does not wrap an imported native map, reference, future or value
merely because another value in the program needs a JS carrier. Compiler
understood signatures, traits, source uses and lifetimes determine ownership;
library wrapper names are not an optimization authority.

## Required carrier table

`T` and `V` below denote their exact selected native payload types, not broad
values substituted to make a signature uniform. `unknown` selects a broad
closed carrier only where its actual source/native contract requires one.

| Source contract | C# destination | Rust destination | Boundary rule |
| --- | --- | --- | --- |
| Direct source `await f()` | Native body/awaiter using the admitted .NET completion | Ordinary native body if non-suspending; native future if suspending | One body; no JS object solely for the direct call |
| Local stored Promise awaited later | Existing `Task<T>` contract | `JsPromise<'a, T>` | Remains an object in this PR |
| Promise parameter, field, collection element or package ABI | `Task<T>`; `Task` for void | `JsPromise<'a, T>` | One JS rejection contract, independent of producer |
| `Promise<int32 \| null \| undefined>` | `Task<int?>` | `JsPromise<'a, Option<i32>>` | One optional payload, not separate null/undefined variants |
| JS rejection reason | `object?` and `TsThrownValueException` | `JsValue` | Preserve exact thrown value/Error identity |
| Authored broad `unknown` value | Core `TsValue` | JS `JsValue` | Closed payload admission; no arbitrary object reflection |
| Variadic `unknown[]` callback | Dense sequence of `TsValue` with exact delegate/rest contract | Dense sequence of `JsValue` with exact callable/rest contract | Preserve arity, selected argument types and ownership |
| `Record<string, V>` | `Dictionary<string, V>` through its checked native binding | Core `Record<String, V>` | Checked string-index contract, exact `V`, closed key operations |
| `Record<string, unknown>` | `Dictionary<string, TsValue>` | Core `Record<String, JsValue>` | No erased opaque parameter requiring member discovery |
| Explicit native declaration | That declaration's native type | That declaration's native type | No additional JS wrapper or representation rewrite |
| Source null/undefined | One native absence | One native absence | Payload availability and dictionary membership stay distinct |

The callback row is a representation obligation, not an instruction to convert
all typed callbacks into broad callables. A fixed `int32` argument/result remains
`int`/`i32`; an existing borrowed argument view is not copied into an owned list
without checked retention evidence. Rest storage must match the selected public
API and preserve argument order without reflective invocation.

The dictionary row is not permission to view an arbitrary class as a map.
Selection requires the actual checked index signature and its value type.
Declared methods/properties and additional native contracts must be handled
through their own checked forms. An absent key and a present nullish payload
can be observed through dictionary membership without inventing two source
absence tags.

A broad value already admitting the single absence state does not acquire an
extra optional wrapper for `unknown | null | undefined`. Generic optional
storage consumes the same selected type/absence policy; it must not treat a
present integer zero as an absent default value.

Current vocabulary already includes C# `TsValue` and dictionary contracts and
Rust `JsValue`/`Record`. That does not prove all parameter admission sites use
them. Correcting those sites must remove the competing unresolved carrier
decision, not add an Express-specific fallback or loosen the checker.

## One JS Promise rejection boundary

The required public Rust shape is `JsPromise<'a, T>`. Its rejection is
`JsValue`, not a third generic error argument chosen per producing function.
All object-form promises, including combinators, reactions and public provider
boundaries, use that same rule. It removes producer-specific type disagreement
without erasing the output payload or native error contracts.

C# uses the existing native `Task<T>`/`Task` representation. A thrown reason is
carried through `TsThrownValueException` where needed and recovered as the
original `object?`; existing native exceptions retain identity. Rust converts
an existing retained Error through `JsValue::from_error(RetainedError)`, rather
than formatting its message or inventing a generic conversion from every native
error type.

Exact native `Result<T, E>`, infallibility, imported futures and C# native
exception/`ValueTask` declarations remain exact outside this JS object boundary.
Do not replace every native error with `JsValue`, or every native completion with
a shared Promise merely to simplify a planner.

### Exact payload across producers

This complete library source demonstrates the same Promise parameter receiving
two different producers:

```typescript
import type { int32 } from "@tsonic/core/types.js";

async function left(value: int32): Promise<int32> {
  return value;
}

async function right(value: int32): Promise<int32> {
  if (value < 0) {
    throw "negative";
  }
  return value;
}

async function twice(pending: Promise<int32>): Promise<int32> {
  return (await pending) * 2;
}

export async function run(flag: boolean, value: int32): Promise<int32> {
  return await twice(flag ? left(value) : right(value));
}
```

Required object-form signatures are `JsPromise<'static, i32>` and `Task<int>`.
`twice` consumes one object parameter regardless of producer. Both paths retain
the selected integer payload; the negative branch preserves the thrown string.
This is a contract example, not certified generated output from the skeletal
checkpoint. Generic native future parameters are not added by this PR.

### Direct await and object use are distinct

A direct source call `await left(value)` may use the single selected native
body. A saved local, a Promise argument or an exported object entry uses the
object representation above. A necessary object entry delegates to that body;
it never contains a second copy of the authored statements.

The Rust direct-await inner path must add zero Promise objects, heap blocks,
payload copies, jobs or thread hops. C# consumes its idiomatic native awaiter;
its native state-machine costs are compared with equivalent handwritten .NET
code, not incorrectly reported as universally allocation-free. A source async
return contract remains valid even when its native body completes ordinarily.

Eager start, settled-await continuation, deferred reactions, discarded results,
borrow escape admission and loop shutdown are defined by the event-loop and
ownership contracts. Carrier selection must consume those records, not invent
a second rule based on temporary generated borrows or task names.

## Closed broad values and collections

The runtime's admitted payload set is closed. Typed operators, member access,
indexing and invocation operate on that set or statically generated exact
projection metadata. They do not reflect over arbitrary target objects, inspect
private fields or install dynamic Proxy semantics.

For example, this is a complete library function:

```typescript
export function first(values: Record<string, unknown>): unknown {
  return values["first"];
}

export function invoke(callback: (...values: unknown[]) => unknown): unknown {
  return callback(1, "two", null);
}
```

The dictionary's element carrier and callback's rest/result carrier agree:
`TsValue` on C# and `JsValue` on Rust. The call admits the present numeric and
string payloads and one absence payload. It must not instantiate a per-call
opaque callable type from a guessed runtime shape. Checked native parameters
already more precise than `unknown` remain precise.

Cross-package declarations expose the selected carrier and exact input/output
contracts so another package can type-check and emit the same boundary. Local
analysis artifacts or producer-specific rejected-type parameters cannot become
hidden prerequisites for consuming a published JS API.

Admitting a primitive into a closed value may have a real native cost. C#'s
existing `TsValue` stores `object?`; a value-type payload can box. Rust's
`JsValue` stores its declared variants and some identity-bearing payloads own
handles. These are not free merely because a carrier already exists. Keep
ordinary precise native paths out of broad admission, preserve identity and
measure necessary conversion/clone/boxing operations against the same behavior.
Do not reopen `JsValue` layout as part of this contract.

## S4: carrier registry design

Each target keeps one declarative registry as test and audit data in
`test/target-model/types/carriers/registry/`, read by its registry test and
by the shared parity test; the compiler packages do not contain or read it.
It describes existing carrier vocabulary; it is not a runtime registry,
representation kind, reflection mechanism or alternate selector. Neither
target's registry names the other target.

Each registry row contains:

| Field | Meaning |
| --- | --- |
| `id` | Unique existing carrier family/contract identity |
| `kinds` | Exact native `TargetTypeRef` discriminants represented by the row |
| `declaration` | Owning pure model declaration, with its module and symbol |
| `responsibility` | Target-neutral responsibility key (`family/name`); rows with the same key on both targets are paired |
| `frozen` | Whether the existing E71 capability is frozen for this PR |

Use exact existing type/contract identities, not a library-name classifier.
Named carrier rows retain native generic arguments, lifetimes and qualifiers.
If multiple concrete families share the `target-named` discriminant, their
existing exact identities distinguish them. Imported user-native names retain
the generic imported-type contract; the registry does not enumerate or
recognize particular smart-pointer libraries.

The same row shape and responsibility taxonomy apply on both targets. Pairing
lives only in the shared tree: `test/architecture/carrier-parity.mjs` joins the
two registries by `responsibility`. A responsibility present on one target
only, or a native difference inside a pair, has an entry there naming the
target, the row's declaration symbol, a signed register entry of
`csharp-rust-structure.md` and the reason. The registry does not require Rust
trait objects to become C# trait objects, or C# CLR delegates to become Rust
delegates.
Selection remains in policy; registry entries contain no selecting closures,
policy imports or dispatch routes, mutable caches, runtime factories or claimed
cost numbers. Producer/policy ownership is checked at the corresponding layer,
not reconstructed by resolving function-name strings from this pure registry.

The registry's coverage test must enumerate both the native type vocabulary and
the declared concrete carrier factories/contracts. Checking only the top-level
`TargetTypeRef["kind"]` union misses Promise, optional, closed-value and callable
families encoded as named types. Structural kind coverage and concrete family
coverage are separate checks, not two selecting paths. Generic imported named
types and first-party identity-bearing contracts must each have one owner;
duplicates, missing entries, stale declaration symbols, unknown discriminants
and unexplained one-sided responsibilities fail closed. Frozen E71 rows
describe retained vocabulary and justify no new capability.

## Verification and cost obligations

Test the complete source-to-native boundary on both targets, including:

1. Different Promise producers in conditionals, parameters, fields, collections
   and separate packages; exact `int32` payloads and arbitrary supported reasons.
2. Existing retained Error identity through rejection, catch and rethrow, without
   message-only replacement, eager stack capture or extra payload boxing.
3. Direct-await body reuse and exported object entries, including suspended and
   non-suspending bodies, native exact errors and real scoped borrowing.
4. `unknown`, rest callbacks and string-index records, with checked closed
   operations, aliasing/identity and precise native values in the same program.
5. One absence state in optional payloads and broad values, without losing
   dictionary membership or allowing zero/false/empty string to become absence.
6. Explicit native carriers remain unwrapped; unsupported arbitrary object
   operations reject before sealing rather than fall back at runtime.
7. Registry completeness, duplicate/omitted/stale entries and target symmetry.

Admission of an already-owned string whose ownership transfers, or an existing
retained Error, must not copy its payload. A borrowed input retains its checked
lease; it cannot become an owned value through an unproved lifetime extension.
Converting a raw native error and constructing a new Error are different
operations with separate cost evidence. The selected closed rejection changes
settlement layout where required; measure that width rather than call it free.

For Promise object entries, measure ready and pending paths separately: object
count, heap blocks/bytes, captures, completion, reactions and shutdown. The
approved task-frame prototype is feasibility evidence, not a universal
allocation mandate or a production cost certificate. A settled scalar value
must not acquire a pending task frame solely for representation uniformity.
Measurements and gates belong to the performance and runtime acceptance owners.

## Related contracts

- [Workspace policy](workspace-agent-policy.md)
- [Sealed target programs](sealed-program.md)
- [Ownership and result-use contract](ownership-contract.md)
- [JavaScript event-loop contract](event-loop-contract.md)
- [C#/Rust structural symmetry](csharp-rust-structure.md)
