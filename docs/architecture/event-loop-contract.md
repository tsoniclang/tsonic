# JavaScript event-loop contract

This is the approved runtime contract for C# and Rust JS/Node surfaces. The
initial skeleton checkpoint documents the destination; it does not implement
or certify it. Runtime integration, compiler admission, ordering, lifecycle and
cost tests must establish the contract together.

Workspace policy remains owned by `workspace-agent-policy.md`. This document
defines the asynchronous boundary, not a second performance or language policy.

## Responsibility and native boundary

Native paths below are relative to the core, JS and Node source roots in the
structure contract. Each row identifies the owning package and responsibility.

| Responsibility | C# owner | Rust owner |
| --- | --- | --- |
| JS loop, admission and reaction queue | JS `Asynchronous/JsEventLoop.cs` | JS `event_loop.rs`, `promise_jobs.rs` |
| Promise settlement and reactions | JS `Asynchronous/PromiseRuntime.cs`, `PromiseContinuations.cs` | JS `promise.rs`, `promise/` |
| Native completion | .NET `Task` and its native awaiter | Native `Future`, pinned before polling; core `async_runtime.rs` |
| Generic resource dispatch | Generic phase/dispatch contracts | Core `dispatch.rs`, `dispatch_queue.rs`, `ordered_dispatch.rs` |
| Node resources and phase registration | Node `BackgroundDispatch.cs` and module resource owners | Node event loop and module resource owners |
| Source result-use and borrow admission | Shared checked evidence, consumed by C# analysis | The same shared evidence, consumed by Rust analysis |

Native paths do not acquire a JS loop or Promise object merely because the
project selects a JS surface. Direct source `await f()` consumes the single
selected native body where its sealed contract permits that representation.
An owned Promise entry delegates to that body; it does not duplicate the body
or wrap an already boxed native future in a second executor.

Rust native error types remain exact outside the JS Promise-object boundary.
C# retains its native exception and Task mechanisms. Explicit imported native
`Future`, `Task` and `ValueTask` signatures retain their native contracts.

## Ordering

Both JS surfaces have the following execution rules:

1. Calling a source async function starts its body on the current owner thread
   immediately, up to its first genuinely pending suspension or completion.
   Dropping the returned object cannot erase that prefix or ready queued work.
2. Awaiting an already settled Promise continues inline. This is an explicit
   divergence from JavaScript microtask ordering, not an accidental optimization.
3. `then`, `catch` and `finally` reactions always execute later through the
   loop's job queue, including when their input is already settled. Registration
   must not invoke the callback inline.
4. Each queue's admitted jobs retain FIFO order. A reaction registered during a
   callback runs after the current callback and previously admitted ready jobs.
   Foreign wakeups do not execute user code on the waking thread.

For example, this complete binary entry uses top-level code:

```typescript
async function body(): Promise<void> {
  console.log("start");
  await Promise.resolve(0);
  console.log("resumed");
}

body();
console.log("after-call");
Promise.resolve(1).then(value => console.log("reaction", value));
```

Expected target output is `start`, `resumed`, `after-call`, `reaction 1`.
Node prints `start`, `after-call`, `resumed`, `reaction 1`. The only registered
ordering difference here is settled-`await`; reaction deferral is required on
both targets. This is an acceptance example, not a claim that the skeleton
checkpoint already emits it correctly.

## One loop owner

An active loop owns its thread, local FIFO, registered resources, finite task
admission and shutdown. At most one owner runs on a thread; reentrant activation
must reject rather than create a competing scheduler. User callbacks, Promise
settlement and access to non-thread-safe captures execute only on that owner.

Same-thread reaction admission uses the local FIFO. On a warmed queue it adds
no lock, wake pulse, resource keep-alive operation or queue-node allocation.
Completion producers on other threads use synchronized ingress and wake the
owner. Ingress moves only native thread-safe notification/scheduling data; it
cannot move a non-`Send` capture to another thread or access it there.

The owner drains ingress into its local scheduling domain. It must not hold an
ingress lock or a Rust mutable cell borrow while invoking user code, polling a
future or destroying its captures. Reentrant admission is supported without
duplicate polling, lost wakeups or callback-order changes. Repeated wakeups
coalesce; only ready tasks are resumed, not every pending task each turn.

C# uses one `LoopContext` per loop thread and restores the caller's previous
synchronization context when the loop exits. Removing `ForceYielding` is valid
only when the explicit reaction queue preserves deferral for all existing
continuation paths. Native background I/O is separate from reaction scheduling;
it is not evidence that reaction execution requires a thread hop.

Rust uses the approved `async-task = "=4.7.1"` local-task mechanism. Its native
task frame replaces the previous pinned body box. Retained task handles belong
to the loop owner, so owner shutdown can cancel and release them. A
detach-only design that leaks never-settling captures is not the contract.

The demonstrated Rust factory proof covers owning/static work. Existing generic
and scoped constructions require their own lifetime proof before migration.
Do not erase a lifetime, add an unsafe static conversion, narrow previously
passing signatures or retain a lazy fallback to bypass that boundary.

## Finite admission and missing-loop behavior

Ready jobs, pending tasks and synchronized ingress have explicit finite limits.
Admission reserves capacity before retaining or polling work. Failure releases
the reservation and captures exactly once and produces the native boundary's
error; it cannot silently drop a callback or partially admit a task.

Backing storage grows lazily within those bounds and reuses released slots.
A million-entry inline scratch registry or eager full-capacity allocation is
not justified by a finite limit. Cold-owner, capacity-growth and overflow
behavior must be measured separately from warmed per-operation costs.

The required posting boundary rejects loop-owned work without an active owner
with the exact message:

```text
No JavaScript event loop is running on this thread.
```

C# reports `InvalidOperationException`; Rust's public posting boundary panics
with that message. Internal fallible admission may return its native error to
that boundary; a missing owner is not converted into an ordinary Promise
rejection. Neither target initializes an invisible loop or executes the
deferred callback synchronously. Merely constructing a settled value or taking
a native direct-await path must not initialize the job queue.

Rust's public `require_dispatch_owner` enforces admission before a factory,
reaction, adoption, JS/Node timer or the covered task/background boundary
retains work or performs its side effects. An owning potentially pending
Rust Promise factory therefore requires a loop. C# uses its native eager Task
construction without that prerequisite; its reaction-posting boundary still
requires an owner. A settled Rust Promise value does not itself post work.

The current audit does not certify every posting root. D-TK046 retains these
open obligations: Rust Node signals, worker ports, resource registration and
worker spawn (which can start its child before checking an owner); C#'s
TaskCompletion executor catch (GAP-01) and generic
BackgroundDispatch.RunReferenced (GAP-02). They are implementation gaps, not
approved native divergences or exceptions to the required boundary above.
Recording them does not implement them or authorize widening another lease.

## Driver liveness and shutdown

An explicitly awaited root keeps the driver active until that root completes.
On every Rust turn, a woken root is polled before referenced native work and
ready jobs. A root woken by that turn's native work or jobs resumes on the next
turn, after the current turn's jobs have run. This ordering applies to later
resumptions too, not only the initial eager prefix.
After completion, the driver retains its output while draining already-ready
jobs and jobs made ready by them. It cannot return early and abandon a queued
`then` callback. An entry without an awaited root still drains ready jobs.

Rust selects the binary owner before publishing the target program. A
synchronous JS entry uses `run_entry_with_contexts(entry, contexts)` and returns
`Result<(Output, LoopExitStatus), ContextError>`. An asynchronous JS entry uses
`block_on_with_contexts(root, contexts)` and returns
`Result<(Option<Output>, LoopExitStatus), ContextError>`. The entry, initializers
and workers execute inside that one owner; an initializer already inside an
async root is awaited without starting a second driver. Requested exit passes
through shutdown and is inspected before unwrapping the root output or running
after-entry hooks.

Provider lifecycle phases distinguish the synchronous `entry-execution` input
from the `async-entry-execution` future input. Each takes exactly one ordinary
input, followed by its selected dispatch contexts. The native `async-execution`
executor contract remains separate; selecting JS does not reinterpret a native
executor's return value as the JS status tuple. C# keeps its existing native
`JsEventLoop.Run` root rather than adopting the Rust tuple representation.

Only referenced native resources keep an otherwise idle process alive: for
example, a referenced timer, active I/O or registered worker. A pending Promise
is not itself a resource reference. A discarded, never-settling Promise with
no resource can therefore exit; a timer-backed pending operation can complete.
Queuing a local reaction does not increment the resource count.

Normal idle exit, an entry error, an exception/panic or explicit cancellation
all pass through owner shutdown. Shutdown stops new admission, detaches or
cancels owned registrations, cancels retained local tasks, drains cancellation
runnables and releases frames/captures on the owner thread. Late foreign wakes
must not revive a closed owner or access released captures. Repeated loop use
must not inherit stale jobs, references, failures or task slots.

A Rust root passed by value is destroyed inside its closing owner, before
that owner is removed. Closing does not permit new posting: Rust panics at
that boundary and C# throws. Rust can still report an observation belonging
to this closing generation; C# rejects observation as well as posting while
closing. These native failure paths are not converted into another JS
rejection or used to reopen an owner.

## Result-use and rejection reporting

Shared analysis owns the checked source result-use decision; target analysis
seals it before planning. Runtime observers consume that decision, not a
function-name heuristic or universal Promise registry.

| Source use | Contract on both targets |
| --- | --- |
| Direct, scoped await | Native lowering where proven; preserve the actual lease and completion type |
| Promise parameter, field, collection or package boundary | A genuine Promise object; no producer-specific JS rejection type |
| Discarded JS Promise-valued call | Eager execution; observe rejection at this call site |
| Discarded native source async result | Pre-seal `TSONIC_NATIVE_ASYNC_RESULT_DISCARDED` |
| Potentially pending borrowed JS body whose result escapes by discard, storage or return | Pre-seal `TSONIC_BORROWED_ASYNC_RESULT_ESCAPES`, from checked neutral lease/suspension evidence |
| Stored Promise that is never observed | Stored-rejection reporting is the explicitly frozen follow-up V-06 |

A temporary Rust `&self` chosen by lowering is not, by itself, proof of an
escaping source lease. Scoped borrowed calls awaited in place remain valid.
The owning shared evidence must establish the suspended dependency, potential
pending completion and escape before enabling the diagnostic on either target.

An installed discarded-result observation belongs to the loop generation
that installed it. A later loop on the same thread is a different owner;
stale settlement must not report into it or revive the old owner.

On retirement C# cancels the owned reaction Task, while Rust drops its job and
leaves the derived Promise unsettled; neither target runs a user branch or
settles the still-pending source Promise.

For a discarded JS call that rejects, Rust `observe_discarded` and C#
`ObserveDiscarded` preserve its original reason, report to stderr and terminate
with exit code 1 after the current job. They observe existing settlement:
no additional Promise object, no success-report job, and at most one deferred
rejection-report job. Stored-unobserved reporting must not be introduced as a
side effect of this observer.

## Promise-object ABI

The replacement Rust JS ABI is `JsPromise<T>`, with rejection `JsValue`.
There is no task-lifetime or per-producer `Error` type parameter at this
completion-state boundary. `JsValue`
retains its existing layout, including native `String`, exact numeric variants
and closed Error payloads. C# uses `Task<T>`/`Task` and `object?` rejection
reasons through its existing native thrown-value exception transport.

The following native entry names are retained or completed, not renamed public
source APIs. A settled completion may carry a borrowed `T`; a genuinely owned,
potentially pending factory must prove the retained body's own native lifetime
and payload requirements. Direct native bodies keep their independent lifetime
and exact error contracts. This table is not permission to make every
construction `'static` or to add unconditional payload clones.

| Rust entry | Required result or input contract |
| --- | --- |
| `resolved(value)` | `JsPromise<T>` already fulfilled with `T` |
| `rejected(reason)` | `JsPromise<T>` rejected with `JsValue` |
| `from_result(result)` | An already settled `Result<T, JsValue>`, without retaining a task body |
| `from_infallible_factory(factory)` | One native body with `Future<Output = T>` |
| `from_fallible_factory(factory)` | One native body with `Future<Output = Result<T, JsValue>>` |
| `create(executor)` | Checked synchronous executor, resolve/reject handles and owning settlement |
| `into_result(self)`, `await_result(&self)` | `Result<T, JsValue>`; consume versus retain the selected handle |
| `into_value(self)`, `await_value(&self)` | `T` only on a compiler-proven infallible path |
| `then`, `then_async` | Deferred checked callbacks; rejected callback receives `JsValue`; Promise-returning callback is adopted |
| `catch` | Deferred rejected callback receives `JsValue`; fulfilled result is preserved |
| `finally`, `finally_default` | Deferred cleanup preserves settlement unless the cleanup fails |
| `observe_discarded` | Call-site observer described above; no second Promise |
| `promise_all` | Ordered result collection, rejection propagation and empty-input fulfillment |
| `promise_all_settled` | Ordered `PromiseSettledResult<T>` values with `JsValue` reasons |
| `promise_race` | First settlement; empty input remains pending without creating keep-alive |
| `promise_any` | First fulfillment; all-rejected/empty input produces the supported aggregate-error contract |

`PromiseResolution<T>`, resolve/reject/executor handles and settlement-result
types use that same reason contract. The public ABI re-exports all retained
combinators. Registration, empty inputs, out-of-order completion, callback
failure and package-crossing reason identity require executable coverage.

`JsValue::from_error(error: impl Into<RetainedError>) -> JsValue` is the existing
Error-admission operation. Moving an existing owned string or retained Error
into the reason carrier adds no allocation or payload copy and preserves Error
identity. Constructing an Error or wrapping a raw native error is a separate
operation with its own measured cost; this does not authorize implicit stack
capture or claim all error conversions are free.

## Generic dispatch and typed operators

Core dispatch owns ordered phase registration and native scheduling primitives,
not a Node-domain enum. JS owns JS timer/reaction registration. Node registers
its own HTTP, network, TLS, watcher, worker, port and signal phases through the
generic contract. Registration order and resource identity are explicit inputs;
core has no package-name branching or Node identifiers.

Closed dynamic operations are selected from their checked operator kind before
sealing. The runtime exposes a typed entry for each supported operation rather
than receiving a string and selecting the operation again. The existing
supported operator set is:

| Family | Operations | Required evaluation |
| --- | --- | --- |
| Value binary | `+`, `-`, `*`, `/`, `%` | Left then right, each once; selected native carriers |
| Boolean binary | `==`, `!=`, `===`, `!==`, `<`, `<=`, `>`, `>=` | Exact closed-carrier equality/comparison |
| Logical | `&&`, `\|\|`, `??` | Selected native conditional; evaluate the right side only when selected |
| Value unary | Unary `+`, unary `-`, `~` | Operand once, selected native numeric operation |
| Boolean unary | `!` | Closed truth test |
| Classification | `typeof` | Closed native-carrier classification |
| Discard | `void` | Evaluate operand once, produce the single native absence state |

This is not an expansion to every JavaScript operator. Unsupported operations
reject before sealing. Existing native arithmetic and identity rules remain
authoritative. Typed entry selection removes the string-dispatch owner; it
does not move the same switch into another wrapper or manufacture eager
evaluation of a conditional branch.

## Cost targets and verification

These counts are case-specific acceptance targets, not a universal object-size
ABI. Byte figures are the measured x64 controls; final toolchain measurements
must include the complete generated path and all threads.

| Case | Required target and measurement boundary |
| --- | --- |
| C# settled `then` / `catch` / `finally` operation, cached source and callback | At most 184 / 176 / 176 B in the measured equivalent deferred controls |
| C# complete measured continuation rows | 520 / 512 / 512 B; eliminate the introduced fresh 64 B noncapturing delegate |
| C# initially pending `then` control | 272 B, including the measured 88 B completion observer; not the settled-source control |
| C# genuinely captured double control | Retain the necessary measured 88 B capture/delegate cost |
| Warmed local reaction scheduling | One deferred job; zero local locks, wake pulses, resource-reference operations, queue-node allocations or callback thread hops |
| Rust owning factory task, ready and pending controls | At most two allocations: shared settlement and pinned native task frame; wake/resume adds zero warmed-owner allocations |
| Rust direct native body/scalar completion | No inner Promise object or task-frame allocation merely to satisfy a two-allocation ceiling |
| Rust selected settled `i32` reason carrier control | 72 B instead of 64 B, the measured necessary +8 B width difference |
| Existing owned-string or retained-Error reason admission | Zero added allocation/copy; retain original Error identity |
| Discarded-call observer | No extra Promise object or success job; at most one rejection-report job; measure observer/frame bytes separately |

The safe Rust scratch factory measured ready 2 allocations/176 B and pending
2 allocations/208 B, respectively +96/+72 B against its matched lazy controls.
Those measurements establish feasibility for those frames only. They do not
prove production bytes/timing, minimal cost for every capture, non-static
factory safety or free queue capacity. The two-allocation bound is a ceiling,
never a request to add allocations to already settled or scalar paths.

The corrected harness runs C# async/Promise cases inside `JsEventLoop.Run`,
counts allocation on every thread and uses the equivalent deferred baseline
for each row. Pending, captured, cold-owner, growth, foreign-ingress and
shutdown cases are measured independently. Known frozen performance work is
reported separately; recording a missed required gate cannot make it pass.

Both targets must execute the same ordering and lifecycle programs covering
eager start, settled await, deferred reactions, queued work after root
completion, pure pending exit, referenced timer completion, discarded
rejection/exit 1, missing loop, admission overflow, reentrant callbacks,
foreign wake coalescing and capture release on normal/error/cancellation exit.
Source admission tests cover valid scoped awaits and both result-use diagnostics.
Compiler, runtime and downstream gates remain parent-owned certification work.

## Initial checkpoint and remaining gates

These are inspected fork-state distinctions, not claims that runtime work has
landed. The replacement is completed only after its source-to-native and
runtime gates pass together.

| Inspected fork owner | Existing state | Required integration |
| --- | --- | --- |
| Rust `promise.rs` | `JsPromise<'a, T, Error = TsonicError>`; factories store a lazy boxed body | Single `JsValue` object ABI and safe eager owning-task construction |
| Rust `promise_jobs.rs` | `FuturesUnordered` of boxed static jobs | One bounded ready-task owner, synchronized wake ingress and shutdown |
| Rust `event_loop.rs::drive` | Returns when the root becomes ready | Retain output while draining ready jobs; separate pending tasks from resources |
| Rust Promise/ABI combinator exports | `race`, `any`, `all_settled`; no `promise_all` | Complete the retained set and matching public ABI export |
| C# `JsEventLoop.TryEnqueue` and `RunCore` | Locked queue, wake pulse and fresh context per run | Local FIFO, synchronized ingress and one context per loop thread |
| C# `PromiseContinuations`/`PromiseRuntime` | Eight consumers of `ContinuationOptions` including `ForceYielding` | Explicit deferred reactions on every path; remove the superseded constant |
| C# `TsValue` dynamic operator entries | Runtime operator-string dispatch | Checked operator-specific native calls, preserving native conditional evaluation |
| Rust `DispatchPhase` | Core declares Node-domain names | Generic phase registration plus Node-owned integration |
| Both targets' source admission | Result-use and borrow contract not yet installed as this closure's gates | Shared evidence, sealed diagnostics and matching positive/negative tests |

The existing `JsValue::String` and `JsValue::from_error` are not missing APIs.
Existing immutable lifetime readers are not lazy computations. Neither can
justify a speculative replacement, new carrier or source restriction.

## Related contracts

- [C# and Rust structure](csharp-rust-structure.md)
- [Compilation lifecycle](compilation-lifecycle.md)
- [Provider and runtime ownership](provider-and-runtime-ownership.md)
- [Workspace agent policy](workspace-agent-policy.md)
- [Test execution](test-execution.md)
