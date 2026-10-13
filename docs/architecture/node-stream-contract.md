# Node stream delivery and lifecycle

This is the approved stream contract for Keel P3B-05. P1-11 records the
contract; it does not implement or certify the runtime corrections below.
The C# and Rust Node runtimes own the same delivery, listener and resource
lifecycle responsibilities. Their native synchronization and error transport
may differ; their observable supported stream operations may not.

Workspace-wide semantics, ownership and performance rules have one owner:

- [Workspace agent policy](workspace-agent-policy.md)

The Node oracle establishes supported Node API observations, not JavaScript
numeric carriers, separate null/undefined representations or a new allocation
policy. Native resource and callback safety remain authoritative.

## Ownership and boundaries

| Responsibility | Owner | Required counterpart |
| --- | --- | --- |
| Producer initialization and synchronous-read guard | Readable's native read/admission protocol | Both runtimes |
| Direct data delivery versus buffering | One Readable admission decision | Both runtimes |
| Buffered flow and readiness notifications | Readable, using the existing loop/dispatch owner | Both runtimes |
| Listener registration, identity, mutation and once consumption | Existing native event storage | Both runtimes |
| Readable EOF, writable completion and resource closure | Their actual native lifecycle owners | Both runtimes |
| Checked event and property exposure | Node provider declarations and operation rows | Both providers |
| Retained source object/callback representation | Compiler analysis, sealed records and native callable/storage policy | Both compilers |

The host does not select delivery behavior. Providers describe the actual
native receiver, callback, result and property; they do not invent lifecycle
facts or replace missing runtime behavior. Compilers consume exact checked
evidence rather than recognizing a class or generated variable by name.

These responsibilities remain in the corresponding Node `stream/` and
filesystem owners, not the core runtime. The loop/dispatch machinery remains
the existing runtime service. There is no second stream scheduler, buffer,
derived-class pump or compatibility implementation.

## Producer readiness and data admission

Initialization and the synchronous-read guard are related but not equivalent
to an asynchronous read being pending. Ordinary Readable producers begin
guarded. Calling a producer's read callback establishes the guard for that
callback's synchronous execution; leaving it must restore the protocol even
if the callback fails. An initialized write-fed producer completes the same
read protocol before accepting its first output chunk.

The initialization protocol may share native state with the read guard; this
contract does not require two flags or a new public marker. It requires the
correct state transitions. Transform and PassThrough use that protocol; their
class names are not admission predicates.

After validating that the input is admissible, Readable delivers a data chunk
directly when all of the following hold:

- the stream is flowing, with an active data subscription;
- producer/read initialization permits delivery outside the synchronous-read
  guard;
- no earlier chunk remains buffered;
- destruction, failure and EOF have not made the new data inadmissible.

Direct delivery calls the existing data-event dispatch with the incoming chunk,
outside the native state lock or `RefCell` borrow. It does not buffer and remove
the chunk again, manufacture an empty flow job or invoke another read callback
merely to deliver that chunk. Valid reentrant event behavior remains valid.

Otherwise, admission retains the chunk in the one finite native buffer with
checked size/capacity accounting and the existing coalesced dispatch. It must
not lose data or pretend acceptance after a capacity/scheduler failure.
`pause`, listener changes and reentrant writes affect subsequent admission and
flow according to the current state. Recheck state after user callbacks where
their effects matter; do not keep a borrow or lock open while doing so.

An empty buffer alone is insufficient. The recorded Node observations are:

| Ordinary Readable state when a chunk is pushed | Delivery inside `push` |
| --- | --- |
| Data listener attached, before the first read/turn | No |
| After `read(0)` establishes the read protocol | Yes |
| After `resume()`, before the first turn | No |
| After `resume()` and the first turn | Yes |

For an initialized, empty, flowing Transform or PassThrough, an output chunk
produced synchronously by `write` is observed before that `write` returns.
Already-buffered ordinary Readable chunks still flow on the loop turn; changing
`resume()` into an unconditional synchronous drain is not the fix.

One complete recorded Node example is:

```ts
import assert from "node:assert/strict";
import { Transform } from "node:stream";

const source = new Transform({
  transform(chunk, _encoding, callback) {
    callback(null, chunk);
  },
});
const received: string[] = [];
source.on("data", chunk => received.push(String(chunk)));
source.resume();
source.write("test data");
assert.deepEqual(received, ["test data"]);
await new Promise<void>(resolve => setImmediate(resolve));
assert.deepEqual(received, ["test data"]);
```

This example records Node's API behavior. It is not a claim that these Node
constructor/callback forms already compile on both targets. Paired target
fixtures must use the checked provider contracts and preserve the same
observations, not replace execution with a generated-source regex.

## Readiness, EOF and terminal events

Data delivery and the `readable` readiness notification are separate decisions
of the same Readable owner. Guarded readiness uses one coalesced deferred
notification through the existing loop. Repeated admissions in that readiness
batch do not enqueue a notification per chunk. A later legitimate readiness
transition can notify again; coalescing does not mean once for the stream's
entire lifetime.

At dispatch, verify that data or EOF still warrants notification and that
destruction/failure has not suppressed it. Dispatch the applicable current
listener set under the native event-mutation contract. Do not keep obsolete
listeners or stream captures alive merely because a notification was queued.

D-07's I-0009 requires zero immediate `readable` callbacks for the recorded
initial guarded `push`, followed by the recorded readiness and end callbacks
on the loop turn. C# must stop directly emitting that readiness callback from
its current `push`; Rust must supply the real typed event and dispatcher.

This does not infer that every Node EOF notification is deferred. The captured
Node `onEofChunk` also invokes readiness immediately outside its synchronous
guard. P3B-05 must pin that transition with a paired oracle before applying a
blanket timing assertion to it. The six existing oracle cases do not establish
that extra case. Do not confuse deferred guarded readiness with a global rule
that all event emissions become queued.

Readable EOF means no more producer data; it does not mean buffered data has
been consumed. `readableEnded` and the once-only `end` notification follow the
actual consumption/terminal transition. In I-0006, unread data plus EOF remains
un-ended across a turn; reading the final chunk returns it before the later
end notification. Repeated reads or turns do not repeat `end`.

Duplex writable completion is independent. I-0012 can have `writableEnded`
true and one `finish` while readable data is still unread and `readableEnded`
false. Consuming that data subsequently permits one readable `end`. Neither
side's EOF/finish is a substitute for the other side or resource closure.

## Typed listeners, reentrancy and native ownership

Rust must add readiness to the existing `StreamEvent` owner and the provider's
`eventMembers` and `eventRows` mechanisms. `on("readable", callback)`,
`once("readable", callback)` and `off("readable", callback)` select the same
checked zero-argument event callback identity, with the native fallibility and
retention contract. Declaring the source event without native registration,
removal, dispatch and teardown is incomplete.

Keep the following properties for data, readiness and terminal events:

- Repeated listeners execute in registration order. Retained callback identity
  is the identity used for removal, including through inherited/native views.
- Consume a once listener before entering it, so recursive emission cannot
  invoke it twice. Native listener mutation preserves the current emission's
  snapshot semantics and affects subsequent emissions as specified.
- No user callback executes while a Readable, Writable, lifecycle or event
  state mutex is held, or while its mutable `RefCell` state is borrowed. Capture
  the needed owned emission state, release the guard, then invoke callbacks.
- A callback can pause, resume, read, write, remove listeners or destroy its
  stream without deadlocking, borrowing panics, lost pressure accounting or a
  second competing pump.
- Callback failure preserves the original source/native reason and identity.
  Dispatch and scheduling state must be restored on failure. Do not swallow a
  throwing error listener, substitute cancellation, replay consumed listeners
  or fabricate a successful finish to settle an acknowledgment.
- Destruction and terminal consumption release queued payloads, removed
  listeners and captured stream owners when their native lifetimes permit.
  In-flight native work still owns what it actually needs until completion.

C# uses its native synchronization/event storage; Rust uses owner-thread state
and native retained emissions. This is an implementation difference, not a
different listener contract. Background I/O posts completion to the real owner;
it must not access owner-thread `Rc`/`RefCell` state on a worker thread. The
running-loop and shutdown requirements are owned by the loop contract; missing
loop ownership must not produce a hidden synchronous fallback.

## Pipe and retained source identity

The `nativePipe` acceptance concern is retained destination identity, not a
new API or a spelling-based optimization. `source.pipe(destination)` returns
that destination's selected native/source identity, including when its checked
type is a subtype or generic destination. Retaining pipeline callbacks must
not copy the destination's mutable state or substitute a wrapper with a new
observable identity. Backpressure pauses consumption until the actual drain;
the final readable chunk is forwarded before requesting the destination's end.

Where compiler analysis selects a retained source activation/frame, pipe and
inherited stream views reuse that owner. A generated binding such as
`retainedFrame` is not evidence that a new owner is required, and its name must
not trigger a compiler decision. Prove sharing, lifetime and mutation through
the selected native types and sealed storage/callable records. Rust `Clone`
alone does not prove shared identity or inexpensive payload copying.

Preserve the existing allocation-free retained-emission storage mechanism; do
not allocate a listener-array snapshot for every chunk or duplicate retained
source frames as a delivery repair. Necessary native handle retention is
distinct from payload copying. Its actual cost must be measured against the
equivalent retained native pipeline.

## `WriteStream.closed` is resource completion

Expose readonly `WriteStream.closed: boolean` through the exact provider
property and native owner on both targets. It reports completed native resource
closure, not that close was requested or an unrelated channel stopped accepting
messages. Reading the property adds no polling job, resource probe, payload copy
or independently reconstructed lifecycle state.

| Observation | Meaning; not a substitute for `closed` |
| --- | --- |
| `close()` requested | Completion/drain may still be pending |
| Destruction started | Cancellation and resource release may still be pending |
| Writable ended/finished | Input/finish state, not proof of resource release |
| Completion channel closed or no queued chunks | Scheduler/buffer state, not file-handle closure |
| `close` callback delivered | Notification state, distinct from physical closure completion |

The filesystem backend owns actual disposal/drop of its resource, including
pending open/write work. Its completion reaches the one lifecycle owner, which
publishes the closure fact and guards the notification's once-only consumption.
Error-listener or close-listener failures do not reopen a closed resource or
create a second resource owner. Physical closure and notification bookkeeping
must not be conflated when a callback interrupts event delivery.

At the inspected pins:

- Rust already has `WriteStreamState.closed` and `WriteStream::closed`; finish,
  error and destruction completion update that actual filesystem state. Its
  source provider lacks the property. Bind the existing getter; do not infer
  `closed` from the generic Writable or add another filesystem state flag.
- C# has no WriteStream property. `Stream._closeEmitted` currently guards a
  close event in `destroy`, but `WriteStream.FinalizeAsync` disposes the file and
  emits `close` separately. Merely exposing `_closeEmitted` would not cover that
  normal completion, and notification state alone is not resource completion.
  Bring both filesystem completion paths through the real lifecycle owner and
  expose its authoritative fact. Do not maintain a second Writable facade's
  version of the same fact.

The C# filesystem owner is `fs/stream/Streams.cs`, not a presumed
`fs/WriteStream.cs`. Provider declarations and operation metadata must agree
with the completed native lifecycle. Do not patch Express to use `destroyed`,
invent a declaration-only property or substitute a different close predicate.

## Evidence and implementation obligations

The retained planning packet is
`tsonic/.analysis/pr-closure-plan-20261013-065534/evidence/round2/peer-stream/`.
`REPORT.md` records the guarded observations; `cases.md` contains complete
before/after methods, target observations and Node programs; `results.json`
records outcomes and expected cost deltas. `node-oracle.mjs` contains all six
stream cases plus the two native-harness counterparts. These ignored notes are
supporting evidence, not a distributed runtime input or a CI dependency.

The observations used Node 26.8.1 and these native inputs:

| Repository | Observed input revision |
| --- | --- |
| `csharp-nodejs` | `41746c059a1b9a1c24b28f5fa80b7025c8de9db7` |
| `csharp-js` | `e971eafb2cadb2fae89bb9f15c090145616d1468` |
| `rust-nodejs` | `8c134dde0cd0f4af3fc86c43bbbaf766f915b15c` |
| `rust-runtime` | `3daf1b00fe0ca46793682bd48b5e830bd28e2159` |

| Case | Required disposition | Recorded native evidence; not final certification |
| --- | --- | --- |
| I-0006 | Explicit observation migration; retain payload/end/once checks | Stronger C# after-case and Rust consumed/deferred-end observation pass |
| I-0008 | Explicit observation migration; retain complete ordered chunk sequence | Stronger C# after-case passes; Rust buffered-flow observation passes |
| I-0009 | Explicit observation migration plus real readiness correction | Stronger C# immediate-readiness check fails; Rust readiness API absent |
| I-0012 | Explicit observation migration; retain independent finish/end counts | Stronger C# after-case passes; combined Rust counterpart remains unproved |
| I-0005 | Runtime correction; original Transform assertions stay unchanged | Original C# test fails; Rust observation also delivers after, not inside, write |
| I-0010 | Runtime correction; original PassThrough assertions stay unchanged | Original C# test fails; current Rust handle lacks the needed typed readable/listener view |
| I-0801/I-0802 | Correct only the native test-loop owner | Original pipeline/question methods pass inside `JsEventLoop.Run` |

The pipeline/question observations do not justify changing runtime completion
to synchronous delivery. Their missing-loop harness corrections are independent
of the four D-07 observation migrations and the two unchanged runtime failures.
Rust must run a real PassThrough counterpart, not relabel a Transform result.

Current implementation anchors, from the sibling workspace:

- C#: `csharp-nodejs/csharp/src/Tsonic.CSharp.Node/stream/Readable.cs:93`
  (`ReadCore`),
  `csharp-nodejs/csharp/src/Tsonic.CSharp.Node/stream/Readable.cs:203` (`Flow`),
  `csharp-nodejs/csharp/src/Tsonic.CSharp.Node/stream/Readable.cs:301` (`push`) and
  `csharp-nodejs/csharp/src/Tsonic.CSharp.Node/stream/Readable.cs:401` (`RequestFlow`).
- C#: `csharp-nodejs/csharp/src/Tsonic.CSharp.Node/stream/Stream.cs:133`
  (`destroy`) and `csharp-nodejs/csharp/src/Tsonic.CSharp.Node/fs/stream/Streams.cs:183`
  (`WriteStream.destroy`),
  `csharp-nodejs/csharp/src/Tsonic.CSharp.Node/fs/stream/Streams.cs:220` (`FinalizeAsync`).
- Rust: `rust-nodejs/rust/crates/tsonic_rust_node/src/stream/readable.rs:381`
  (`enqueue`),
  `rust-nodejs/rust/crates/tsonic_rust_node/src/stream/readable_dispatch.rs:2`
  (`schedule_dispatch`),
  `rust-nodejs/rust/crates/tsonic_rust_node/src/stream/readable_dispatch.rs:28`
  (`dispatch`) and
  `rust-nodejs/rust/crates/tsonic_rust_node/src/stream/duplex_transform.rs:215`
  (`TransformBackend::write`).
- Rust: `rust-nodejs/rust/crates/tsonic_rust_node/src/stream/events.rs:80`
  (`StreamEvent::emission`) and
  `rust-nodejs/rust/crates/tsonic_rust_node/src/stream/readable_events.rs`
  (typed registration/removal).
- Providers: `rust-nodejs/nodejs/src/provider/modules/stream/declarations.ts:137`
  (event declarations),
  `rust-nodejs/nodejs/src/provider/modules/stream/declarations.ts:281` (generic pipe row),
  `rust-nodejs/nodejs/src/provider/modules/filesystem/calls.ts:211`
  (WriteStream declaration) and
  `csharp-nodejs/nodejs/src/provider/modules/filesystem/streams.ts:95`.
- Closure: `rust-nodejs/rust/crates/tsonic_rust_node/src/fs/write_stream.rs:264`
  (existing getter) and
  `rust-nodejs/rust/crates/tsonic_rust_node/src/fs/write_stream.rs:316`
  (filesystem work/completion owner).

P3B-05 must verify the complete source/provider/native paths on both targets:

1. Run all six paired stream cases against their recorded Node observations.
   Keep I-0005/I-0010 assertions unchanged; migrate only the four approved
   observation cases while retaining all payload, timing, order and once checks.
2. Exercise initialization, guarded read, resumed/buffered flow, reentrant pause,
   recursive emission, listener mutation and failure. Prove one admission owner,
   one buffer and no callbacks under state guards.
3. Compile and run Rust readiness `on`/`once`/`off`, inherited stream views and
   an actual PassThrough source/native fixture, including teardown and original
   failure-reason identity.
4. Verify real `closed` transitions during ordinary finish, pending I/O,
   destruction and failure; repeated close/destroy must not duplicate closure
   notification or native resource disposal. Check the property inside a close
   listener and when an error listener interrupts notification.
5. Verify pipe's destination/source-frame identity, pressure/drain behavior,
   final-chunk ordering and cleanup against equivalent native code.
6. Measure direct and buffered delivery separately. A ready direct admission
   has zero new flow jobs, extra scheduling allocations or payload copies.
   Deferred buffered/readiness batches coalesce their jobs. Existing listener,
   handle-retention and native I/O costs are not claimed to be zero. Include
   warmed emission-allocation checks and the complete retained pipeline, rather
   than presenting source inspection or a prototype as a cost certificate.

All of these remain implementation and proof obligations. A documentation
commit, a migrated harness or a passing partial observation cannot satisfy the
runtime, provider, architecture, downstream or performance certification gate.
