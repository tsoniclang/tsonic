# Tsoniclang Workspace Agent Policy

This file owns policy shared by every repository under this `tsoniclang`
workspace. Repository-level `AGENTS.md` files may add only genuine local
commands, ownership boundaries, or target semantics; they must not restate this
policy.

## Engineering Standard

- This workspace is airplane-grade: correctness and sound architecture take
  precedence over speed, while iteration should remain deliberate and bounded.
- WCBUBWHB means “What Can Be, Unburdened By What Has Been.” Design the final
  from-scratch architecture directly. Do not preserve stale shapes merely
  because they already exist.
- Fix root causes at the highest correct owner. Do not add one-off downstream
  workarounds for missing shared facts, provider contracts, or compiler
  semantics.
- Keep changes focused. Do not repair unrelated failures, but report them
  precisely.
- Modify only repositories and product scopes the maintainer assigned to the
  task. Read-only inspection may establish a contract; it does not grant change
  ownership.

### Direct Solutions, Not Patch Accumulation

- Apply this rule to every edit and issue resolution, including all existing
  changes in the current PR: never keep bolting corrective layers onto an
  incorrect implementation when a direct solution exists.
- Reassess the owning model, data structures, contracts and complete call path,
  not just the latest failing line. Correct the earliest layer that actually
  owns the decision, update its consumers, and remove superseded logic in the
  same change. A previous fix or passing checkpoint does not justify keeping
  redundant branches, adapters, conversions or competing decisions.
- Prefer the smallest clean, complete canonical mechanism. Reuse genuine common
  requirements; do not hide repeated corrections behind a generic wrapper or
  invent a framework to preserve an accidental design. Independently necessary
  boundary validation remains mandatory, not redundant patching.
- For example, if a provider exposes an exact native integer but the compiler
  selects a floating carrier, do not retain that mistake and add conversions,
  large-value exceptions and target-specific caller repairs. Preserve the exact
  integer in the provider/semantic contract, select its native target carrier,
  and remove the erroneous conversions and compensating branches. Both targets
  consume the corrected evidence through their existing ownership layers.
- Review the entire current PR against this rule before certification. For each
  change family, the necessity ledger must identify the direct owner, the
  simpler complete alternative considered, removed or demonstrably necessary
  surrounding logic, and correctness/performance proof. Passing tests alone
  cannot certify a layered workaround. Do not expand scope into unrelated
  rewrites; record any concrete architectural conflict for the maintainer.

### Necessity Ledger

- Every product change set must maintain a task-local necessity ledger under
  `.analysis/` from design through certification.
- Each independent change class records the concrete user-visible need, the
  owning architectural layer, why the existing contract is insufficient, the
  smallest complete mechanism, explicit exclusions, affected product paths,
  and its proof gate. An accepted entry ends with: “So yes, really, really
  needed.”
- Every product-code, schema, configuration, fixture, and behavioral-test
  change must map to an accepted ledger entry. Remove changes that cannot be
  mapped; passing tests do not establish necessity.
- Final certification includes a complete diff-to-ledger reconciliation and
  reports both necessity and verification independently.

## Repository Safety

- Never force-push or delete remote branches or tags. Push branches and let the
  maintainer merge and clean up remotely.
- Never use `git stash`, `git add -f`, or `git add --force`.
- `.gitignore` is authoritative. If ignored content must become product input,
  change `.gitignore` in its own reviewed commit; never bypass it per file.
- Keep meaningful work committed and pushed on the one active branch before
  changing repositories or tasks. Never leave hidden or dangling work.
- Do not create a branch before the maintainer approves the task. Approval to
  start a task includes permission to create the necessary task branches in
  every assigned repository; do not ask again for branch permission during that
  task. Before branching, run the repository's branch-hygiene check when one
  exists and resolve every branch ahead of `main` except the one active PR
  branch.
- Never announce a PR from a dirty worktree. Verify `git status --porcelain` is
  empty and the branch is synchronized with its upstream.
- Once a PR is opened, keep its commits intentional; do not add unrelated work
  to that branch.
- Use each repository's `.temp/` for scratch work; never use `/tmp` for
  workspace-specific state and never create scratch workspaces under product
  package directories.
- Treat `.temp/` as maintainer-owned state. Do not delete it, or recursively
  delete another directory, unless the maintainer explicitly requests that
  exact cleanup.
- Keep ignored analysis, logs, generated output, build products, and local test
  state untracked.
- Never commit or push `.analysis` contents. Ignore rules do not untrack files
  already in Git: remove such entries from the index while preserving the local
  notes, and verify that no `.analysis` paths remain tracked. Do not rewrite
  published history as part of this cleanup.

## Agent Delegation

- Do not start parallel agents or delegate new work to subagents unless the
  maintainer explicitly requests it. General task approval or an instruction
  to continue does not authorize agent delegation.
- The coordinating assistant retains full responsibility for integrating,
  reviewing, correcting, and verifying all delegated work. Responsibility is
  not transferred to a worker when a task is assigned or reported complete.
- Inspect every worker's actual diff against scope, architecture, necessity
  ledgers, and interacting changes before integration. Resolve conflicts and
  defects rather than trusting completion summaries.
- Certify the final integrated tree with the required verification gates.
  Worker-local passing tests are supporting evidence, not a substitute for
  integration review and testing. Report failures and unverified work plainly.

## Development and Verification

- The repository's documented language rules and tests are canonical.
  Downstream projects can reveal defects but cannot redefine the contract.
- A language, surface, schema, or semantic change requires explicit maintainer
  approval. Fix invalid downstream assumptions downstream instead of weakening
  the compiler.
- Use focused tests while iterating. Before merge or publication, run the
  repository's documented applicable gates, reusing current verified coverage
  under the input-scoped rule below. The expectation-only exception also applies
  under its exact stated conditions.
- Never change product code, fixtures, tests, or expected output merely to make
  a test pass. Determine and fix the owning root cause.
- Temporary instrumentation belongs under `.temp/`, never in a final product
  path.
- Do not run a complete suite repeatedly after each small implementation. Batch
  coherent edits, collect all diagnostics from a run, fix the complete class,
  then rerun at the appropriate scope.
- Test execution is expensive. All publishing entrypoints must automatically
  reuse valid existing verification and run only checks invalidated by actual
  input changes. Documentation-only edits require their owning documentation
  checks, not another compiler/runtime run. Isolated release-tooling changes
  require their owning verification checks. Declare and verify those input
  boundaries; do not infer them from a commit message or a broad extension
  filter. Retain original evidence and record any required focused checks
  separately. Never rewrite a certificate or omit a necessary artifact/public
  installation proof merely to avoid execution.
- Finish an already-started certification suite and collect its failures, but
  do not start another suite while known failures remain. Do not reinterpret a
  multi-suite certification queue as one suite. An explicit maintainer request
  may cancel a run; retain its observed failures and label its coverage partial.
- Use the highest useful test parallelism permitted by effective CPUs, available
  memory and actual isolation constraints. Configure repeatable resource budgets
  for both outer test workers and native child builds; do not fix every machine
  at two workers or multiply both levels without bounds. Preserve OOM, swap,
  process, timeout and log guards. Explicitly designated throughput calibration
  runs may be aborted when utilization targets are unmet; they never substitute
  for complete certification or justify weakening tests.

### Expectation-Only Rerun Exception

- If a completed full run has exactly one failure, inspection proves only its
  expectation is stale, and the sole subsequent edit changes that expectation
  without changing product code, build/configuration, fixture input, semantics,
  or generated behavior, rerun only the owning focused test.
- Certify this as the preceding full run plus the corrected focused test; do not
  repeat the expensive full suite.
- A changed expectation that accepts different behavior, semantics, output,
  fixtures, or toolchain policy is not expectation-only and still requires the
  normal complete gate.

## Architecture

### Source-To-Source and Static Closure

- Tsonic compilers emit target source projects and let the target ecosystem own
  build, publish, deployment, and platform configuration.
- Generated programs must remain compatible with pure native output whenever
  the selected target supports it.
- Runtime reflection, dynamic member discovery/invocation, arbitrary-object
  projection, and best-effort runtime fallback are forbidden language
  semantics. Build-time tooling may inspect explicit metadata inputs.
- Broad carriers such as `unknown`, `object`, `JsValue`, dictionaries, or
  dynamic JSON may expose only deterministic closed-carrier operations; they
  must not reflect over arbitrary target objects.
- Prove operations statically and emit closed generated code, source-generated
  metadata, or closed runtime carriers. If proof is unavailable, emit a
  deterministic diagnostic.
- Open-ended target toolchain settings belong in native target configuration,
  not generic Tsonic configuration. Tsonic configuration is limited to compiler
  semantic input, source/profile/provider selection, and deterministic codegen
  policy.
- Native project configuration may declare a build capability, but it must not
  become hidden semantic evidence or a target-code fallback.

### One Current Architecture

- Every project is greenfield. Legacy paths, dual paths, and backward
  compatibility are absolutely prohibited.
- Never design, implement, or land legacy support, bridge architecture,
  temporary product paths, dual readers,
  old-or-new schema handling, compatibility aliases, legacy fallback, or
  “clean it later” code.
- When a canonical shape changes, break stale assumptions and repair every
  first-party producer and consumer against the final shape.
- An API replacement is one complete migration, not an additional supported
  form. Remove superseded signatures, handlers and adapters; update all owned
  callers, declarations, facts, documentation, fixtures and tests together.
  Prove that the removed form is rejected. Temporary compatibility overloads
  and staged old/new acceptance are prohibited.
- For example, replacing `add(AttributeType, ...args)` with an inline lambda
  containing a checked attribute invocation means deleting the flat form, not
  accepting both. Preserve independent placement selectors and native attribute
  restrictions; the new argument syntax does not justify losing capabilities
  or weakening validation.

### Truth Over Heuristics

- Never guess semantic identity from names, spelling, source text, raw object
  shape, target output, partial metadata, or fallback checker queries.
- Consume exact selected compiler evidence, provider identities, finalized
  facts, and declared policy. Missing evidence fails closed with a precise
  diagnostic.
- Optional discovery must prove existence before reading; do not probe and then
  silently recover.

### Generic Policy First

- Implement a mechanism at the most generic policy, fact, provider, or shared
  semantic layer that owns it.
- Concrete names such as `Map`, `Set`, `Date`, `Array`, `fs`, `C#`, or `Rust`
  are declarative data, not branches in generic resolution algorithms.
- When one case exposes a family, design the reusable contract first and encode
  the case as policy data.
- A hardcoded exception requires explicit source and target identity, rationale,
  required evidence, diagnostic behavior, positive and negative tests, and
  ledger evidence. A ledger entry does not authorize an exception to the
  compiler-understood ownership requirement below.

### Explicit Target Semantics

- Preserve every independently controllable target behavior as an independent
  fact, marker, policy choice, dialect rule, or project setting.
- Never infer one target control from another unless the pinned target-language
  specification defines that implication. Compiler convention or current
  acceptance is not specification evidence.
- Absence means the behavior was not selected. Emit exactly the target
  language's documented coupling for the selected version, or reject an
  unrepresentable combination precisely.

### Compiler-Understood Ownership

- Hard requirement: ownership, borrowing, moves, copies, storage and wrapper
  elimination must use checked source-use evidence and guarantees understood
  by the selected native compiler. Every semantic premise must trace to an
  exact compiler fact or the target language's specified rule for the selected
  type, trait, signature, qualifier or lifetime. Do not invent library-specific
  optimization knowledge beyond what that compiler knows.
- Providers may transport those exact native facts; they may not manufacture
  ownership authority with custom "already shared", "interior mutable",
  "nonretaining" or "cheap clone" assertions. Moving a hardcoded assumption
  from compiler code into provider data does not satisfy this rule. Ordinary
  native API identity and invocation mapping remain provider responsibilities;
  they are not evidence for an additional ownership optimization.
- Standard-library and third-party types follow the same rules. Do not use
  wrapper-name lists, package names, private-field scans or arbitrary marker
  traits to infer ownership behavior. Preserve an imported native carrier
  without requiring it to be recognized as a particular smart pointer.
- Use each trait only for its compiler-understood guarantees. For example,
  Rust `Clone` establishes a cloning operation, not cheap copying or shared
  identity; `Copy` does not establish that copying a large value is cheap.
  `Deref` does not establish reference counting. Benchmark observations cannot
  manufacture missing semantic guarantees either.
- Genuine native compiler special cases are permitted only for the exact rule
  and declaration identity that the compiler recognizes. For example, Rust's
  special `Rc<Self>` method-receiver support is not authority to infer payload
  sharing or eliminate a captured-binding cell. `UnsafeCell` does not waive
  exclusive-borrow uniqueness or thread-safety requirements. Delegate native
  checking to the native compiler rather than extending its rules ourselves.
- If compiler-understood evidence is missing, identify the precise missing
  guarantee and do not perform that optimization. Never fill the gap with a
  name heuristic, bespoke provider promise, unsafe cast or hidden runtime
  fallback. Preserve safety and existing required behavior; report an unresolved
  correctness/performance conflict rather than claiming completion or silently
  rejecting previously supported code.
- Native execution and cost proofs remain mandatory. Compiler acceptance alone
  proves neither preservation of source observations nor minimal runtime cost.
  Apply this rule symmetrically using each target's own native semantics.

### Native Semantics and Best-Effort JS Surfaces

- Source `null` and `undefined` denote one native absence state in generated
  C# and Rust, including JS and Node surfaces. Use native nullable storage or
  `Option<T>`; never manufacture separate null/undefined tags, nested options,
  wrappers or allocation merely to reproduce JavaScript's platform distinction.
  Normalize the relationship once in target type policy; preserve exact source
  checker evidence and native API/data-model distinctions such as a missing
  dictionary entry versus an explicit JSON-null value. Zero, false and empty
  strings are present values. Construction, comparison, narrowing, generic
  instantiation, optional chaining and coalescing must consume the same policy.
- Without a JS surface, code follows the selected target's native semantics
  completely. TypeScript supplies source syntax, checked types and explicit
  metadata, not a JavaScript runtime.
- A JS or Node surface does not change native carriers, widths, string encoding,
  storage, ownership or allocation policy. An API exposing a native integer
  retains its native domain: no int53 carrier, 53-bit admission cap or floating
  round trip is introduced merely for JavaScript compatibility.
- An explicitly selected JS/Node API retains its supported API semantics within
  those native representations. JS Math.min must propagate NaN; JS Math.round
  must not silently become System.Math.Round or f64::round. Native primitives
  implement these APIs only where their behavior matches. Users select native
  APIs explicitly for different native behavior. Native representation is not
  permission to silently replace a supported library operation's semantics.
- Retain efficient compatible behavior. Compatibility is not itself a defect
  or a reason to delete working behavior. Conversely, an API name never
  authorizes hidden emulation costs, lossy conversions, carrier restrictions or
  overhead on unrelated ordinary code. Necessary work of an explicitly selected
  operation remains local to that operation; compare its implementation with
  efficient native code performing the same requested operation.
- Expensive, impractical or unrepresentable compatibility may remain
  unsupported even on a JS surface. Document the exact supported contract and
  reject unsupported operations precisely. Do not weaken safety, invent results
  or create a slow fallback to claim conformance. This clarification supersedes
  both blanket JS-conformance requirements and blanket removal of compatibility.
- Do not cap native integers at JavaScript's 53-bit safe-integer boundary or
  invent an int53 representation. Annotated int32/int64 and unsigned integers
  use their selected native widths and signedness. Remove artificial JS-only
  restrictions and the tests that require those restrictions; replace them with
  the native contract's boundary, correctness and safety proofs.
- Actual native bounds still apply: floating-point precision, representable
  integer ranges, valid shift widths, addressable memory, collection capacity
  and resource budgets. An f64 cannot exactly represent every 64-bit integer.
  Never route exact native integers through an imprecise floating-point value.
  A compiler-host or wire-format check preventing precision loss is not a
  native int53 contract: use lossless metadata/transport where larger values
  are required rather than simply deleting a necessary validation guard.
- Native behavior and any supported surface compatibility must be explicit and
  consistent across declarations, retained
  evidence, target policy, generated code, runtimes, documentation and tests.
  Correctness is measured against that documented contract. A Node oracle is
  appropriate for supported JS API behavior, not for overriding native
  arithmetic, representation, range or performance requirements. Explicit
  Number.isSafeInteger queries may test the JS Number precision domain; they
  must never become native-value admission restrictions.
  Keep safety, identity, aliasing, lifetime and explicitly selected operations
  intact; do not replace them with no-ops or unproved casts. Record removals and
  replacement proof gates in the necessity ledger.

### Native Performance From Exact Metadata

- Apply this contract to every design and implementation decision, not only
  optimizations. Judge representation, ownership, allocation, calls and emitted
  syntax against efficient, idiomatic handwritten code for the selected native
  target. Shared architecture does not require copying one target's runtime
  idioms into another. Record the target-native alternative and why the chosen
  representation preserves correctness and avoids unnecessary cost in the
  necessity ledger before implementing it.
- **Hard rule: native performance by default; no silent runtime overhead of any
  kind.** Apply the target-native semantics contract above. JS and Node APIs
  do not authorize hidden copying, conversion, storage, bookkeeping or a slower
  emulation path. Document native differences; do not simulate another runtime
  merely to avoid those differences.
- This applies across generated code, analysis-selected representations,
  provider adapters, call boundaries, runtimes and benchmark dispatchers, not
  only individual runtime functions. Audit implicit copies, allocations,
  reference counting, conversions, boxing, checks, scans, repeated syscalls and
  work for unused values or capabilities. For example, querying file size must
  not copy an unrelated payload; a read-only call must not acquire an owned
  string merely because its generated signature was designed that way.
- **Allocation placement must be idiomatic and no more expensive than the
  equivalent handwritten native implementation.** Prefer value storage,
  borrowing and bounded local buffers when exact escape, aliasing, identity,
  size and lifetime evidence permits them. Do not default to heap boxes,
  shared handles, captured environments, reference-counted wrappers or owned
  copies merely to simplify lowering. Heap allocation required by the program
  remains valid; justify the particular owner, representation and lifetime,
  rather than treating every allocation as a defect or moving unbounded data
  onto the stack. Preserve observable mutation, identity and memory safety.
- Allocation reviews must inspect representative application and proof output
  for both C# and Rust, including callees and runtime carriers. Distinguish
  inline value storage from guaranteed stack placement, an empty collection
  from an allocated buffer, and source-level allocation sites from allocations
  remaining after native optimization. A `struct`, native type or passing test
  alone is not proof of optimal placement; claims of allocation elimination
  require native evidence.
- A native type, a native API call, an existing implementation or an aggregate
  benchmark win does not establish an acceptable cost. Use exact evidence to
  remove avoidable work at its owning layer; do not require extra source
  annotations when the compiler can prove the efficient operation. Necessary
  costs of the requested semantics must be explicit in the contract and review,
  not silently accepted as compiler overhead. If performance and correctness
  cannot both be met, disclose the concrete conflict and obtain an explicit
  supported choice rather than quietly accepting a slowdown.
- An explicit per-value or per-operation capability may have necessary native
  costs, which must be justified and visible in its contract. JavaScript or
  Node conformance alone is never that justification. Correctness and memory
  safety remain mandatory; reject an unrepresentable operation rather than
  fake it or silently tax unrelated values.
- Ordinary Rust strings use native UTF-8 units and operations; exact UTF-16 is an
  explicit `JsString` value. Ordinary arrays prioritize dense native storage;
  sparse/hole behavior must not tax every element. Preserve declared aliasing,
  lifetime and memory-safety guarantees; never invent values or access
  uninitialized storage to remove a check.
- Native performance must remain available and high performance is the default.
  Do not silently add diagnostic stack capture, symbol lookup, eager formatting
  or avoidable copying/allocation to ordinary runtime operations. Optional
  diagnostic enrichment requires an explicit source request, including in JS
  profiles. Preserve native language requirements and source identity/aliasing;
  measure changed hot paths rather than treating functional tests as a cost
  certificate.
- TypeScript/JavaScript bootstrap implementation limits must not become limits
  on Rust or C# code generation. Preserve the program's meaning, not inefficient
  implementation choices forced by the bootstrap platform.
- GoToTS retains lossless semantic metadata and annotations so native targets
  can use them. Inspect and consume the exact available evidence when choosing
  native representations, ownership, storage, integer operations and calls.
- Prefer efficient native operations whenever the evidence proves them correct.
  For example, a proven fixed-width integer may use native integer arithmetic;
  arbitrary-precision `bigint` still requires arbitrary precision. Do not erase
  width, signedness, aliasing, layout or lifetime guarantees for speed.
- Shared layers retain target-neutral evidence; each target owns its native
  optimization. No target semantics in shared code, spelling heuristics,
  speculative coercions, compatibility paths or extra user annotations when
  the existing evidence already suffices. Record necessity and verify semantic
  equivalence and performance before claiming an optimization certified.
- Certification must cover the entire affected source-to-native path. Inspect
  generated code and verify relevant allocation, copying, syscall and scaling
  behavior; inspect optimized code when claiming the native toolchain removes
  an apparent cost. Keep known avoidable overhead in scope open until fixed.
  Correct output, a faster aggregate result or measurement noise is not proof
  of zero overhead. Never weaken semantics, safety or assertions to improve a
  performance result.

### TypeScript Source Discipline

- Product TypeScript is a type-annotation layer over standard modern
  JavaScript. Do not use TypeScript-only runtime-shape features as compiler
  signals or implementation mechanisms.
- In particular, do not use explicit `public`, parameter properties,
  namespaces, decorators, or non-ECMAScript class modifiers as compiler
  signals, test aids, or source-package workarounds.
- Type-only annotations, interfaces, imports, and deterministic assertions
  remain checked source evidence. Generated runtime behavior follows the
  selected target's semantics under the target-native contract above; source
  syntax does not authorize JavaScript coercions or runtime emulation.
- Abstract declarations and readonly class fields are supported source
  annotations in both C# and Rust. Preserve their checker restrictions without
  introducing runtime freezing or weakening abstract implementation checks.
- Omitted class accessibility is public. Normalize equivalent syntax in the
  compiler instead of requiring spelling changes in source.
- All TypeScript/JavaScript module wiring is ESM. Do not introduce `require`,
  `module.exports`, `export =`, namespaces, triple-slash references, or ambient
  bootstrap shims. Prefer explicit exported subpaths with extensions.

## Reports and Reviews

- Technical reports must include concrete source-level examples and the causal
  chain from user TypeScript through semantic evidence and carrier selection to
  emitted target code and observed behavior.
- Examples must identify expected and actual behavior and explain why the
  difference matters; labels and TODO lists alone are not analysis.
- Group symptoms by root cause and distinguish fallout from independent defects.
- State verified facts and remaining unknowns exactly; avoid hedging where
  inspection can decide the answer.
- Review an in-progress checkpoint against the scope it claims complete, not the
  eventual project endpoint. Report checkpoint quality separately from total
  remaining work.

## Policy Placement

- This file is the sole owner of workspace-wide policy.
- Top-level child `AGENTS.md` files contain only repository-specific deltas and
  explicitly require reading and following this canonical policy. References
  must resolve from the containing repository; missing references are defects.
- `CLAUDE.md` imports this policy and its same-scope `AGENTS.md`; it does not
  duplicate policy prose.
- Vendored and submodule policy files remain owned by their upstream projects;
  do not rewrite them as workspace policy copies.
