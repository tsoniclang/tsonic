# 04 — Source-Backed Drift Inventory

Date: 2026-07-20. Method: read-only cross-repository source audit (no tests
run), re-verified against current worktrees where noted. Includes the dirty
`tsonic-csharp` worktree (30 entries) — see §WIP. These are the confirmed drift
classes from searched product roots; per-feature exhaustiveness is not claimed
until cleanup step 1 produces the independent connected inventory.

Verdict: the macro architecture is intact and worth preserving, but the
implementation has drifted at its most important enforcement boundary:

> TSTS-selected source meaning → immutable finalized target facts →
> facts-only backend.

Each entry names its owning layer per `01-canonical-four-layer-architecture.md`.

---

## 1. Architecture Authority Is Contradictory — owner: process

Ignored `.analysis` documents call themselves live/authoritative
(`.analysis/consolidated-final-architecture-20260626/README.md:5`,
`.analysis/consolidated-final-architecture-20260626/00-authority-and-intake.md:11`)
while `.analysis` is gitignored
(`.gitignore:18`) and their content is obsolete (Node as a surface, retired
`createOperationMappers`, old target-pack interfaces, stale row counts).

**Fix:** create tracked authority under `docs/architecture/**` (index and
precedence; plugin/target/capability contract; source profile/surface
contract; finalized-fact/backend boundary; toolchain boundary;
diagnostic/test-evidence contract). `.analysis` is for investigations only.

## 2. Host Composition Has Two Semantic Paths — owner: L3

`compileProject` creates a preliminary bare TSTS session to scan imports and
select capabilities (`packages/host/src/build.ts:73`, `:210`), then the real
session at `:118`; runtime activation does another AST import pass at `:141`.

Consequences: provider registration is import-scan dependent; runtime
inclusion is syntax-based, so an unused value import can add runtime
assemblies and an emitted runtime-backed type can be missed by a syntax-only
type/value classifier.

**Fix:** prepare all installed capabilities for the selected target and
register module-bound binding providers in the one real session. Registration
is availability, not activation: exact module ownership permits a provider to
answer only its imported modules; target and explicitly selected surfaces own
global source-profile declarations; installed provider packages do not add
globals. Emit runtime requirements only from finalized selected types and
operations. Remove the preliminary session and runtime AST rescan.

## 3. Module Ownership Cannot Prove Uniqueness — owner: L3

Ownership is one ambiguous `specifierPrefix` string
(`packages/target-api/src/pack.ts:41`); conflict detection compares equal
strings, not intersecting ranges (`packages/host/src/target/extensions.ts:148`),
so `node:` and `node:fs` can overlap without a diagnostic.

**Fix:** discriminated ownership model (exact specifier, canonical alias,
bounded package subpath, explicit namespace prefix); compile all claims into
one immutable ownership table; reject intersections.

## 4. Backend API Exposes a Semantic Escape Hatch — owner: L3

`TargetCompileInput` exposes `Program`, `AstReader`, `TypeShapeQueries`, raw
source files, checker-like source-analysis methods, and global fact queries
(`packages/target-api/src/pack.ts:143`, `:174`), permitting a backend to
reselect source members after finalization.

**Fix:** frozen `FinalizedTargetProgram`: typed syntax traversal, stable
source declaration identities, finalized operation/carrier/conversion/shape
plans, target payloads, diagnostics, runtime requirements. AST traversal stays;
checker/member/signature reselection goes.

## 5. Standard and C# Facts Have Unclassified Authority — owner: L2/L4

19 C# fact keys exist
(`../tsonic-csharp/src/source/csharp-facts/keys.ts:55`). Several demonstrably
overlap standard TSTS meanings: `csharpTargetOperationFactKey` versus
`targetOperationFactKey`, `csharpTargetConversionOperationFactKey` versus the
standard conversion decision, and `csharpRuntimeCarrierFactKey` versus
`runtimeCarrierFactKey`. Other C# facts may be legitimate target-specific
payloads and must be classified individually. Existing overlap precedence is
inconsistent: custom first in
`../tsonic-csharp/src/backend/planner/locals.ts:90`, standard first in
`../tsonic-csharp/src/source/csharp-source-semantics/target-type-subject-facts.ts:158`. Node call
mapping returns the standard signature while C# records its custom fact on a repeated observation
(`../tsonic-csharp/src/source/csharp-source-semantics/checked-call-mapping/index.ts:150`);
property/element contributions write
custom facts directly (`../csharp-nodejs/nodejs/src/provider/index.ts:181`,
`:212`).

**Fix:** standard facts own source selection, provenance, result type,
conversions, and operation identity. Classify every C# fact by meaning and
subject identity. Preserve target-specific facts only as complementary
immutable payloads referenced by the standard operation/type identity; commit
standard selection and target payload atomically. Delete only proven mirrors,
dead keys, and fallback precedence. The intended carrier authority is the
standard `runtimeCarrierFactKey`, whose `TargetTypeRef` supports target-owned
carriers, but migration still requires proving that no C#-specific carrier
metadata is lost.

## 6. C# Reconstructs Selected Meaning — owner: L1→L4 violation

- target type from syntax:
  `../tsonic-csharp/src/source/csharp-source-semantics/target-type-checked-expression-syntax.ts:76`
- constructed type from `new` syntax:
  `../tsonic-csharp/src/source/csharp-source-semantics/target-type-constructed-expression-syntax.ts:26`
- declaration fallback during member selection:
  `../tsonic-csharp/src/source/csharp-source-semantics/referenced-declaration-target.ts:21`
- exact TSTS argument-binding evidence is flattened into parallel positional
  arrays and then rematched to target parameters:
  `../tsonic-csharp/src/source/csharp-source-semantics/target-member-selection.ts:61`
  and
  `../tsonic-csharp/src/source/csharp-source-semantics/target-member-arguments/selection.ts:68`
- "non-array wins" type preference:
  `../tsonic-csharp/src/source/csharp-source-semantics/target-type-subject-resolution/preference.ts:5`
- provider overload-group/static identity inferred from encoded strings:
  `../tsonic-csharp/src/source/csharp-source-semantics/target-member-selection.ts:374`

**Fix:** exact immutable records: per-argument binding objects; exact selected
declaration/signature identity; explicit provenance-ranked type candidates;
deterministic conflict diagnostics; no source/member/staticness inference from
strings.

## 7. Lifecycle Policy Runs Before Checked Operations Are Final — owner: L2/L4

JS array carrier policy walks source during `beforeSemanticsFinalized`
(`../tsonic-csharp/src/source/csharp-source-semantics/surfaces/js/array-carrier-lifecycle/lifecycle.ts:27`), reading selected
signatures/carriers only if earlier checker activity happened to publish
them — checker query order can affect chosen storage. Object-shape processing
performs multiple source/checker walks and fans facts across nodes, symbols,
types, and side indexes
(`../tsonic-csharp/src/source/csharp-source-semantics/object-shape-facts.ts:118`,
`../tsonic-csharp/src/source/csharp-source-semantics/object-shape-recorded-facts.ts:41`).

**Fix:** explicit lifecycle: (1) finalized prerequisite source-core/shared
facts; (2) TSTS retains checked operations and exact dependencies; (3)
surface/provider target policy executes as part of checking/finalization; (4)
standard selection plus target payload commits atomically; (5) aggregate
`CsharpArrayPlan`/`CsharpObjectShapePlan` production after operation
finalization; (6) fact sealing; (7) backend consumption. A C# array plan includes storage, ABI carrier, element carrier,
hole/mutation requirements, conversions, selected operations. An
object-shape plan distinguishes required property, absent-capable optional,
present nullable value, explicit `undefined`.

## 8. Target Name Policy Is Duplicated Or Inferred — owner: L4

Concrete names are valid **data** when selected source identity points to an
explicit provider/target policy row. The drift is where that policy is
duplicated in algorithms or invented without such metadata:

- array target names are split between an algorithmic `Length`/`length`/`Count`
  path in
  `../tsonic-csharp/src/source/csharp-source-semantics/surfaces/js/array-carriers.ts:56`
  and declarative target-member rows in
  `../tsonic-csharp/src/source/csharp-source-semantics/surfaces/js/properties/member-providers/target-member-rows.ts:135`;
- source-owned element access assumes the CLR indexer name `Item` without an
  exact provider/target protocol fact in
  `../tsonic-csharp/src/source/csharp-source-semantics/checked-member-access-mapping/element-indexer-facts.ts:330`.

`Array.from` and `Array.isArray` in
`../tsonic-csharp/src/source/csharp-source-semantics/surfaces/js/array-carrier-lifecycle/array-use-rules.ts:94`
are explicit selected-identity policy data, not source-name guessing. Internal
generated runtime-union members such as `IsN`/`AsN` are also permitted when
they belong to one closed target protocol and are never exposed as aliases for
source APIs.

**Fix:** centralize each source-identity-to-target-operation decision in one
typed policy row. The backend prints the selected target protocol member; it
does not derive CLR conventions such as `Item`. Keep closed internal helper
names owned by target protocol metadata.

## 9. Backend Still Acts as a Semantic Front End — owner: L4

The backend may traverse syntax and mechanically lower syntax whose target
shape is already fixed. The confirmed drift is narrower: some planner paths
still make target semantic choices, including semantic-type recursion,
ownership inference for source calls/properties/new, undefined carrier choice,
base-receiver projection by class-name search, array helper protocol choice,
BigInt construction, JSON serialization protocol, exception wrapping,
attribute parameter lookup by string, and struct-marker reparsing.

Representative files:
`../tsonic-csharp/src/backend/planner/csharp-type-node/index.ts:79`,
`../tsonic-csharp/src/backend/planner/semantic-source-ownership.ts:31`,
`../tsonic-csharp/src/backend/planner/expression-target-members/property-access.ts:270`,
`../tsonic-csharp/src/backend/planner/value-types.ts:80`, and
`../tsonic-csharp/src/backend/planner/attributes/resolution.ts:81`.

**Fix:** the backend traverses public TSTS syntax and lowers syntax whose
meaning is purely structural. Whenever target output depends on selected
source identity, type, conversion, carrier, protocol, or runtime behavior, it
must consume a finalized plan/fact. It creates only typed Roslyn AST and may
not perform checker/member/signature reselection. Do not replace checker
re-entry with a second all-syntax semantic IR.

## 10. C# Maintains a Shadow TSTS AST Contract — owner: L2/L4

Backend mirrors raw TS-Go fields and casts:
`../tsonic-csharp/src/backend/planner/source-ast-types.ts:3`,
`../tsonic-csharp/src/backend/planner/source-ast-casts.ts:6`, and
`../tsonic-csharp/src/backend/planner/source-ast-kinds.ts:3`. Currently categorized as TSTS-contract gaps rather
than removed.

**Fix:** add required structural accessors to public TSTS `AstReader`; keep
syntax traversal through those exact accessors; move semantic decisions to
finalized facts; ban raw `.TypeArguments`, `.Text`, `.Kind`, field mirrors,
object probing, and hand-maintained kind tables.

## 11. Semantic Cache And Side-Index Ownership Is Inconsistent — owner: L2/L3/L4

- `../tsonic-csharp/src/source/csharp-source-semantics/semantic-hosts.ts:122`
  caches a semantic host by target object alone even though the host also
  depends on project directory, capabilities, surfaces, and references. That
  can reuse stale composition context.
- `../tsonic-csharp/src/source/csharp-source-semantics/object-shape-facts/recording.ts:27`
  stores a side index outside the fact store's transaction/sealing boundary;
  it can diverge after rollback even though its WeakMap key is compilation
  scoped.

The WeakMap in
`../tsonic-csharp/src/source/csharp-source-semantics/source-type-classification.ts:35`
is keyed first by the owning compiler and then by type; source inspection does
not show a cross-compilation leak there, so it is not a confirmed violation.

**Fix:** key retained caches by every semantic input or own them directly by
one immutable prepared composition/compilation context. Put transactional
semantic indexes in the fact mechanism (or make them derived immutable plans),
not a side channel. Retain correctly compiler-scoped caches. Backend planning
caches become an explicit `CsharpPlanningContext`.

## 12. Provider Exactness Is Incomplete — owner: L4

.NET provider: requested slices broaden several import-slice kinds and lose
kind/type-only distinctions
(`../tsonic-csharp/src/providers/dotnet/provider-slices.ts`); the module-ref
qualifier omits type-parameter defaults/constraints even though the collector
handles them
(`../tsonic-csharp/src/providers/dotnet/declaration-model/module-refs.ts`);
`sameModuleProviderRefs(value: unknown)` recursively walks raw model objects
with `Object.entries` outside one exhaustive typed provider-type visitor.
The existing model validator is substantial; the missing requirement is
field-complete parity between validation, collection, qualification, and
rendering rather than a blanket claim that validation is absent.

Node provider: declaration validation checks too little of provider identity
(`../csharp-nodejs/nodejs/src/provider/identity.ts:110`); alias normalization
can rewrite contradictory identity instead of rejecting
(`../csharp-nodejs/nodejs/src/provider/members/provider-identity.ts:13`);
duplicate metadata maps silently overwrite
(`../csharp-nodejs/nodejs/src/provider/members/metadata-index.ts:75`); element access falls back from
receiver target type when exact index evidence is absent
(`../csharp-nodejs/nodejs/src/provider/index.ts:190`); callable property access
synthesizes a method-like operation without an explicit callable-value policy
row (`../csharp-nodejs/nodejs/src/provider/index.ts:170`). That operation may
be required for selected call-callee flow, but its identity and payload must
be modeled explicitly rather than fabricated implicitly.

**Fix:** one exhaustive typed provider-type visitor; validate the complete
model before conversion; preserve full slice identity; reject duplicate and
contradictory rows; require exact selected declaration/signature/index
evidence; function-value extraction requires explicit delegate metadata; no
receiver-type uniqueness fallback.

## 13. Generic Contribution Hook Should Stay — But Be Hardened — owner: L3

An external audit recommended deleting `createTargetContributions`; that
recommendation is rejected. The standardized hook is the intended architecture
(`packages/target-api/src/plugins.ts:31`). Core retains: generic plugin
envelope, `createExtensions`, runtime contributions,
`createTargetContributions`, opaque target-owned kind-tagged payloads.

**Fix (hardening):** prepare and freeze contributions before checking; stamp
every contribution with its plugin owner; core validates only the generic
envelope, ownership, and target routing; the consuming target validates its
kind-tagged payload during composition. Use deterministic conflict keys;
reject overlapping providers/operation rows; remove first-non-defer order as
ambiguity resolution; prefer declarative rows, callbacks only where exact
retained facts require computation.

## 14. Source-Core Identity And Fact Ownership Are Mixed — owner: L3 using L2 APIs

`packages/source-core/src/source-extension.ts:50` registers one post-bind
source walk with two different responsibilities. The re-export branch matches
module/export syntax and rejects local re-exports; normal ESM/provider symbol
identity should propagate instead of source-core deciding identity from source
spelling. The struct branch traverses object-literal syntax through public
`AstReader` APIs and consumes finalized field facts, which can be a legitimate
Layer-3 shared analysis, but it currently probes several possible fact subjects
(property, initializer, and name) rather than one exact ownership contract.

Attribute-builder state is separately too weak: intermediate builder state and
terminal application share one public fact key; `.parameter("name")` retains a
string rather than an exact selected parameter; terminal application retains
raw expressions.

**Fix:** delete the re-export spelling policy and propagate source-core
identity through normal ESM/provider identities. Keep the struct traversal
only if it consumes one exact finalized field-fact subject and emits one
immutable source-core struct plan; remove subject fan-out/fallback. Keep
builder-chain state private and publish a distinct terminal, exact
attribute-application fact whose target type/member/constructor/parameter
identity is resolved before C# consumes it. Do not delete AST traversal merely
because it is a walker; delete it when it reconstructs semantic identity.

## 15. Target Toolchain Configuration Leaks Into `tsonic.json` — owner: L4/toolchain

C# options combine several authorities in one schema
(`../tsonic-csharp/src/options/csharp-target-options.ts:27`). Arbitrary MSBuild
properties, `publishAot`, SDK/project behavior, NuGet package references, and
native publish settings belong to `.csproj`/MSBuild. By contrast, target
framework and assembly/framework/provider references can affect deterministic
provider reflection and source-visible semantic inputs; they are not invalid
merely because .NET also represents them in project configuration.

**Fix:** classify every option by its actual consumer and authority. Keep only
compiler-semantic input, explicit provider-metadata selection, deterministic
codegen policy, and closed generated-project defaults. Remove open-ended
MSBuild/NuGet/publish/AOT configuration and any reference option used only to
control native build plumbing. Generated-project mode may expose a
target-neutral artifact/entrypoint mode; advanced .NET behavior belongs in a
user-owned `.csproj`.

## 16. Runtime and Toolchain Artifacts Are Not Closed — owner: L3

Runtime references use open strings and attributes
(`packages/target-api/src/artifacts.ts:45`); merge deduplicates mainly by
kind/include and rejects duplicate keys without an owner-aware descriptor or
equivalence comparison for version/attributes
(`packages/host/src/target/runtime-contributions.ts:57`); missing DLL
existence is not proven before project emission; toolchain diagnostics are
`string[]` demoted to suggestions (`packages/target-api/src/pack.ts:199`,
`packages/host/src/build.ts:192`).

**Fix:** `RuntimeArtifactRequirementFact`; immutable package-owned
`RuntimeArtifactDescriptor`; owner-preserving `RuntimeArtifactLedger`; file
existence/hash/dependency validation; structured diagnostics; pure
`TargetArtifactPlan`. Native build/publish stays outside generic compiler
semantics.

## 17. JS Runtime Semantics Are Not Closed — owner: L4 runtime

These are not isolated method bugs: several runtime families still lack shared
closed ECMAScript abstractions. This does not invalidate families that already
have an explicit closed contract, such as the retained RegExp subset below.

| Root abstraction | Confirmed examples |
|---|---|
| Top-level-tagged `TsValue` with recursively unvalidated `object` payloads | `../csharp-js/src/Tsonic.CSharp.Js/TsValue.cs:273`, `../csharp-js/src/Tsonic.CSharp.Js/JSObject.cs:11` |
| Partial property/object protocol | `../csharp-js/src/Tsonic.CSharp.Js/Object.cs:59` |
| CLR-based coercion/formatting | `../csharp-js/src/Tsonic.CSharp.Js/Globals.cs:341`, `../csharp-js/src/Tsonic.CSharp.Js/Number.cs:313` |
| Heuristic union arm selection | `../csharp-js/src/Tsonic.CSharp.Js/TsUnion.cs:290` |
| Inconsistent array identity | `../csharp-js/src/Tsonic.CSharp.Js/Array.cs:58`, `../csharp-js/src/Tsonic.CSharp.Js/JSArrayStatics.cs:12` |
| Sparse slots exist, but typed reads collapse absent/hole to `default(T)` | `../csharp-js/src/Tsonic.CSharp.Js/JSArray.cs:156` |
| Typed-array subarrays copy storage | `../csharp-js/src/Tsonic.CSharp.Js/Int8Array.cs:76` |
| JSON closed dispatch has incomplete position/context semantics | `../csharp-js/src/Tsonic.CSharp.Js/JSON.cs:74` |
| Map/Set iterators: mutation-invalidating CLR enumerators | `../csharp-js/src/Tsonic.CSharp.Js/Map.cs:145` |
| Date uses `DateTimeOffset` as semantic state | `../csharp-js/src/Tsonic.CSharp.Js/Date.cs:96` |
| Timers use concurrent CLR timers | `../csharp-js/src/Tsonic.CSharp.Js/Timers.cs:92` |

Concrete failures: `(1e20).toString()` can use CLR exponent formatting;
`new Date("bad").getTime()` can expose a finite sentinel instead of `NaN`;
`const b = a.subarray(0); b[0] = 2` does not update `a`; a missing
`WeakMap<object, number>` value can become `0`; array callback iteration uses
live list length rather than the required captured length;
`JSON.stringify({x: undefined, y: NaN})` is not closed to JS behavior.

**Fix:** shared runtime abstractions, not method-by-method patches: (1)
recursively closed/self-describing `TsValue` payloads; (2) closed
property/object protocol; (3) canonical array identity with typed reads that
preserve hole/absence semantics; (4) shared ArrayBuffer/typed-array views; (5)
ECMAScript abstract operations; (6) exact number formatting/parsing; (7)
closed JS error taxonomy; (8) explicit JSON/Date policies; (9) oracle-backed
operation contracts.

**Retained foundation:** RegExp is already a deliberately closed subset. The
runtime validator rejects unsupported ECMAScript and .NET-only constructs
before `Regex` execution
(`../csharp-js/src/Tsonic.CSharp.Js/RegExpPatternValidator.cs:47`), and
`../csharp-js/tests/Tsonic.CSharp.Js.Tests/RegExpTests.cs:63` compares admitted
behavior with `../csharp-js/tools/node-regexp-oracle.mjs`. Preserve that
boundary; broaden it only through an explicit oracle-backed source/runtime
contract.

**Promise/Task pushback:** `Promise<T>` → `Task<T>` is an intended
target-carrier choice, not drift. Rule: supported async/await and Promise
operations must have proven Task-equivalent lowering; thenable assimilation,
microtask ordering, arbitrary rejection values, and other non-equivalent APIs
must be implemented by a closed scheduler/carrier or rejected; do not
implement a full event loop merely because the carrier is `Task<T>`.

## 18. Node Runtime Contains Semantic Substitutions — owner: L4 runtime

- `path.normalize` calls `Path.GetFullPath`, producing absolute paths:
  `../csharp-nodejs/csharp/src/Tsonic.CSharp.Node/path/normalize.cs:10`
- `Buffer.slice/subarray` copy instead of sharing storage:
  `../csharp-nodejs/csharp/src/Tsonic.CSharp.Node/buffer/Buffer.slice.cs:7`
- `realpathSync` does not perform Node realpath semantics:
  `../csharp-nodejs/csharp/src/Tsonic.CSharp.Node/fs/realpathSync.cs:10`
- `path.posix`/`path.win32` share host-dependent behavior:
  `../csharp-nodejs/csharp/src/Tsonic.CSharp.Node/path/path.cs:19`
- URL delegates to `System.Uri`:
  `../csharp-nodejs/csharp/src/Tsonic.CSharp.Node/url/URL.cs:9`
- process versions fabricated:
  `../csharp-nodejs/csharp/src/Tsonic.CSharp.Node/process/version.cs:5`
- invented `IncomingMessage.readAll()`: `../csharp-nodejs/nodejs/src/provider/http.ts:125`
- assert deep equality serializes arbitrary objects, CLR equality fallback:
  `../csharp-nodejs/csharp/src/Tsonic.CSharp.Node/assert/assert.cs:274`

The runtime contains 283 `.cs` files across 38 child directories. Those are
repository-size observations, not public API counts. Provider exports and
compiled public runtime symbols have not yet been mechanically joined, so
closure remains unproven; this is not automatically a requirement to expose
all runtime code.

**Fix:** every shipped runtime API is classified as provider-reachable and
exactly supported; provider-reachable and deterministic hard-reject; internal
implementation detail; or removed from the shipped product. No unclassified
public compatibility APIs.

## 19. Capability Ledger Can Claim Proof Without Proof — owner: process

The executable exported ledger contains 328 rows, 320 marked complete, and
eight `not-started` Rust-future rows. It references 132 unique positive
evidence paths, 10 nonexistent, and 77 unique negative evidence paths, 9
nonexistent. A source-text `grep` sees only 280 literal tuples and misses 48
rows generated from three contract-row expansions; it is not a ledger count.
The validator largely checks nonempty evidence
arrays, not whether the path exists, the named test exists, the test is in the
runner, it passed, or it proves the required layer and polarity. Stale
aggregate paths include `test/cli-build/js-surface.test.mjs`,
`test/cli-build/object-shapes.test.mjs`,
`../tsonic-csharp/test/node-surface-completion.test.mjs`. The old-suite
inventory is partly tautological (the "discovered" old path set can be derived
from the classification inventory itself).

**Fix:** machine-readable evidence rows (test ID, file, suite, layer,
polarity, observable, runtime/toolchain requirement); validation independently
discovers tests/files and reconciles execution results.

## 20. Scanners Can Bless Entire Files — owner: process

Current scanners are regex/allowlist-heavy: host scanner scope hardcoded;
selected-evidence classifications apply to whole files; known TSTS gaps remain
classified without a closure deadline; count-based cast tests can bless new
casts by changing a number.

**Fix:** derive scanner roots from workspace/package inventory; classify
individual occurrences, not files; ban semantic dependencies structurally
where possible; compile documentation examples; reject missing ledger
evidence; scan generated output and all runtime/package roots; track every
TSTS gap as an explicit issue with an acceptance gate.

---

## TSTS Contract-Gap Register

37 issue documents under `.analysis/tsts-issues/` (2026-07-08 → 2026-07-20).
These are Layer-1/Layer-2 contract gaps the cleanup depends on; each must be
tracked as an explicit issue with an acceptance gate (drift §20), not left as
standing classifications. Current known blockers:

- `.analysis/tsts-issues/20260720-100927-source-call-field-context-and-rejection-identity.md`
- `.analysis/tsts-issues/20260720-103456-provider-declaration-runtime-carrier-demand.md`

## WIP Hazard (current uncommitted state)

- `tsonic-csharp` (head `24533fcc`): **30 dirty worktree entries** mixing good
  selected-evidence cleanup with new custom/standard fact fallback work that
  must not become final architecture (§5). Triage is step 0 of the cleanup
  plan: land the conformant parts, delete the fallback parts, then proceed.
- `csharp-nodejs` (head `08fd339b`): three modified test files and one
  untracked self-symlink.
- `csharp-js` (head `df8a8f90`): one untracked self-symlink.
- `csharp-runtime` (head `6e25cee1`): one untracked self-symlink.

## Out Of Scope For This Inventory

The audit was read-only and did not execute tests; conformance verdicts in
`03-layer-conformance-matrix.md` are source-evidence verdicts. Runtime
behavioral closure (§17/§18) additionally requires the oracle matrices in
cleanup step 9.
