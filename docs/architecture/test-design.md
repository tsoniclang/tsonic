# Test design

This contract separates source admission, sealed semantic evidence, native
compilation, execution and cost. Passing one layer does not certify the next.
The Keel test migration implements this contract; existing source-text assertions
and unrun acceptance programs are not evidence that migration is complete.
Workspace policy remains authoritative for semantics, verification reuse,
resource guards and review. This document defines test responsibilities, not a
second policy or a new fixture framework.

## Test the owning layer

| Responsibility | Required proof |
| --- | --- |
| Shared source evidence | Checked declaration and member identity, substitutions, storage correspondence and finite accounting; target-neutral inputs and results |
| Providers | Exact selected declarations, native carriers and invocation contracts; missing, conflicting or malformed evidence rejects |
| Target policy | One-construct selection from complete immutable inputs, including positive and negative cases |
| Target analysis | Closed cross-construct proofs and complete sealed records, with conflicts and missing prerequisites rejected before sealing |
| Planning | Target AST structure derived from sealed records; no new semantic decisions, provider reopening or checker reconstruction |
| Printing | Exact spelling, escaping, syntax and formatting of an already-selected target AST |
| Native integration | The accepted generated project builds with the selected native compiler and executes the required observations |
| Runtime and downstream | Supported API behavior, ordering, identity, resource lifecycle and costs through the real selected surface |

Units may exercise an individual producer before sealing. Consumer-facing units
must use its sealed result, not a manually invented record that bypasses the
producer. Test attempted writes after sealing and conflicting writes before it.
A pure sealed lookup is not lazy analysis merely because its method is named
`get` or its receiver came from analysis. Architecture tests must distinguish
lookup from computation using actual ownership and call relationships.

## Explicit fixture modes

Every compilation fixture declares its output mode, selected surfaces and
provider capabilities. Helpers must make their defaults explicit and preserve
an explicit caller selection. Do not infer library mode from an exported
function, a generated filename or the absence of a top-level statement.

| Intent | C# `outputType` | Rust `outputType` | Execution |
| --- | --- | --- | --- |
| Binary program | `Exe` | `bin` | Entry module's authored top-level code |
| Library contract | `Library` | `lib` | Separate native consumer calls the exported API |

These option spellings are native target vocabulary, not competing semantics.
The entry migration removes Rust's implicit exported-`main` call. A binary
fixture that exports an uncalled `main` must assert
`TSONIC_UNCALLED_BINARY_ENTRY_MAIN`, not rely on a helper to call it. Library
exports are not binary entry errors. A native library harness may call `run`,
but must not manufacture execution that the binary source did not request.

A fixture also states its observation: compile-only, run, rejection, sealed
record, target AST, printer or cost. Record source filenames, entrypoint,
capability versions and toolchain inputs alongside the observation. A
compile-only result is not an execution or performance pass.

## Shared oracle fixtures

The planned shared oracle sources live in `tsonic/test/fixtures/node-oracle/`.
Both targets consume the same authored program. Target-native launch and
observation code belongs in the corresponding target's `test/helpers/`; it
must not replace the source with a target-specific imitation. Existing shared
fixtures under `tsonic/test/fixtures/` establish this source-sharing pattern.

Each oracle case retains:

- the complete authored source and explicit compilation mode;
- the Node version, command, stdout, stderr and exit status;
- ordered observations and the exact expected identities or values;
- selected surfaces and capabilities for each native target;
- any applicable signed divergence and its dedicated pinning test.

Use Node for the supported behavior of explicitly selected JS and Node APIs.
Use equivalent handwritten native programs for native operations and carriers.
Node cannot redefine native integer width, string units, absence or ownership.
Do not route an exact integer through a float just to compare it with Node.
Type erasure for a Node run may remove type syntax; it must not rewrite calls,
evaluation order, values or ownership-sensitive operations.

Carrier proofs and API proofs are independent. An exact native file-size
integer must survive without a floating round trip, even on the Node surface.
An explicitly selected JS `Math.min` must still propagate NaN; selecting native
carriers does not silently replace it with a different native API. Prove both
the selected producer representation and the operation's supported behavior.

For example, this JS-surface ordering fixture observes a deferred reaction:

```ts
console.log("before");
Promise.resolve(1).then(value => console.log(value));
console.log("after");
```

Its required output is:

```text
before
after
1
```

That does not make a settled `await` deferred. Under the approved async
contract, JS-surface calls start eagerly, a settled `await` continues inline,
and `then`/`catch`/`finally` reactions use the loop's job queue. Pin each behavior
separately, including ready and pending inputs, nested jobs, rejection identity,
discarded-call rejection and shutdown. Registered ordering differences must be
named explicitly; do not normalize logs to hide them. Native discarded async
results and escaping borrowed JS async results have their own admission tests,
not a Node compatibility workaround.

Stream cases distinguish readiness from consumption. Observe initial
notification, guarded reentrancy, repeated pushes, consumption, EOF, pressure,
finish and physical closure. Deferred/coalesced readiness assertions must state
the guard and producer state that require them; not every native or Node
`readable` notification is universally deferred. Use actual stream constructors,
options and lifetime cleanup. Timing delays are not substitutes for an observed
completion or readiness transition.

## Assertions preserve semantics

Execution tests compare complete required output, exit status and ordered
effects. Native consumer tests may assert exact values and reference identity
inside the generated program instead of serializing an object graph. Empty
output is valid only when the fixture's contract says nothing runs.

For object, error, buffer and callback identity, prove the same selected value
survives the relevant boundary. Comparing message text, shape or contents alone
does not prove identity. Cover source mutation, aliasing and lifetime where the
operation depends on them.

Source `null` and `undefined` use one native absence state. Tests must cover
present zero, false and empty string separately from absence, and exercise
nullable structs, classes, unions, optional members, coalescing and calls.
They must not demand separate JavaScript null/undefined tags. Keep independently
specified native distinctions, such as a missing dictionary entry versus an
explicit JSON-null value. This is an oracle-boundary rule, not permission to
discard an identity or safety assertion.

Keep diagnostics bounded by asserting the identical scalar predicate:

```js
assert.equal(selection === undefined, true, caseName);
assert.equal(actual === expected, true, caseName);
```

These forms retain absence and identity checks without formatting an entire AST
on failure. They do not replace a required deep structural comparison. Report
its necessary differing fields with bounded scalar labels instead. Never turn
an assertion into a log, skip, broad success alternative or swallowed exception.

## Replace semantic source-text checks

A regular expression over generated code cannot prove ordering, borrowing,
identity, narrowing, native safety or the absence of runtime allocations.
Replace such checks at the layer that owns the original requirement:

- exact selected carrier or conversion: assert the sealed record;
- native ownership or unsafe scope: compile and execute a native consumer;
- evaluation and callback order: assert the ordered runtime effects;
- required target syntax: inspect the typed target AST;
- formatting, escaping or authored spelling: retain a printer assertion;
- rejection behavior: assert the exact diagnostic code and relevant span,
  retaining message comparison when wording is itself the contract.

Printer snapshots and spelling checks remain useful for their stated purpose;
they do not stand in for semantic execution. Rewriting an output-shape test
must preserve every requirement it previously intended to prove. A native
compiler failure is not repaired by changing a generated-text expectation.
In particular, unsafe native calls need correct lexical scope, not a regex that
merely finds the word `unsafe` elsewhere in the file.

## Acceptance implies native compilation

For each retained acceptance case, require all of source checking, target
analysis, planning/publication and native compilation to succeed. A checker
pass with invalid emitted Rust or C# is a compiler defect. Positive fixtures
must fail the gate on native compiler diagnostics, crashes or timeouts; never
treat those as expected target rejections.

Unsupported patterns reject at their owning source/analysis boundary before
the target program is sealed, with a stable, precise diagnostic and no partial
published project. Negative fixtures assert that boundary, diagnostic and
publication behavior. If an unapproved capability is moved to a follow-up,
preserve its positive fixture there and add the corresponding rejection proof
here. Passing retained tests stay; a test's creation date does not decide scope.

The catalogue compile gate, both Puddings, both Tsumos and installed Express
exercise this contract on both targets. Compile-only and run receipts remain
separate; the downstream programs' real provider preparation and native
toolchain steps cannot be replaced with guessed declarations. NativeAOT
observations are informational for Keel, not substitutes for its required
native build and execution gates.

## Isolation and resource evidence

Use the repository's bounded runner for every build and test, including pure
owner units and delegated checks. Select useful parallelism from effective
CPUs, memory and native child demand; process-group memory, swap, task, timeout
and log limits apply to the whole run. A Node heap limit is not that protection.
Keep native children inside the guard, and retain resource reports with the
complete test results. The parent owns integration/full-bank scheduling.

Fixtures own their scratch roots, ports, generated projects and native build
artifacts. Parallel native consumers must not race over shared transitive
runtime outputs. The C# construction helper now supplies a fixture-local
`TsonicRuntimeArtifactsPath` to MSBuild; its concurrent construction test checks
separate output and restore paths for all three runtime projects. Do not hide
that collision with serial execution or a shared-DLL fallback. Rust fixtures
must likewise isolate mutable build state while preserving declared immutable
inputs.

The C# Node `pipeline_ShouldResolveForSimpleStreams` and
`question_ShouldResolveAnswer` fixtures now install their required
`JsEventLoop.Run` owner. Their operations and assertions remain intact. This
repairs missing-loop test setup, not stream semantics: the complete C# Node
baseline still exposed stream, codec, structure and artifact-isolation failures.
An event-loop-dependent test must use the real loop; a missing-loop rejection
test must prove fail-fast behavior, not wait for a deadline.

## Failure inventory and verification reuse

Maintain one input-pinned inventory for all banks and acceptance programs.
Each failing row records file, test name, first diagnostic, capability, root
family, scope and resource receipt. Include observed hangs, native failures and
partial-run diagnostics; do not count only the most recently filtered bank.
Architecture and behavior ratchets track exact cases as well as totals: an
unchanged failure count can conceal a regression replacing a fixed defect.

Classify by capability and cause: regression, approved capability, harness
migration, unapproved capability or invalid harness assumption. New tests for
approved behavior are not optional merely because they are new. Harness
migrations state the changed observation and its oracle evidence; they never
erase a genuine compiler or runtime failure.

Retain run receipts with exact source/build inputs, commands, counts,
toolchains and bounds. Reuse only coverage whose declared inputs are unchanged;
shared owner edits can invalidate both targets. Apply the canonical policy's
input-scoped verification and exact expectation-only rerun exception, without
a separate exception here. A focused or aborted run is never relabeled a full
bank. Documentation-only changes use their owning documentation checks.

Keel certification requires converged retained roots, executable downstream
acceptance, determinism and measured costs on the integrated tree. Equal counts,
an architecture inventory or a worker's passing isolated run do not certify
those requirements. Double generation must compare the complete relevant
artifact sets and bytes under the same inputs, not a regex-selected subset.

Cost tests compare equivalent observable behavior and exact allocation, byte,
copy, job-post and thread-hop counts. C# async measurements run inside the real
event loop and count allocations on all threads. A deferred reaction's baseline
must also defer. Use each row's own baseline; meeting a timing ceiling does not
excuse avoidable costs or weakened semantics. Pin toolchain and optimized build
settings, retain raw measurements, and keep inherited deferred work explicitly
uncertified rather than absorbing it into a successful aggregate number.

## Contract references

- [Canonical workspace policy](workspace-agent-policy.md)
- [Resource configuration and execution commands](test-execution.md)
- [Compilation lifecycle and sealing boundary](compilation-lifecycle.md)
- [C#/Rust architectural responsibilities](csharp-rust-structure.md)
- [C# native fixture artifact isolation](../../../tsonic-csharp/test/integration/generated/native-construction-isolation.test.mjs)
