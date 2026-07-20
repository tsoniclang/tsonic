# 05 — Cleanup Plan (Ordered, No-Dual-Path)

Date: 2026-07-20. Status: proposed execution order. Feature work remains
paused until step 10's gate passes; the next work is the semantic-authority
and lifecycle redesign, not another local Proof Pudding fix.

## Invariants For Every Step

1. **No dual paths.** Each step installs one authoritative owner, migrates all
   producers and consumers, and deletes the superseded path in the same
   change. No compatibility readers, old/new flags, fallback precedence, or
   parallel fact stores survive any step.
2. **Fail closed.** Missing evidence is a deterministic diagnostic, never a
   guess, a name match, a receiver-type fallback, or a checker re-entry.
3. **Generic policy first.** Concrete source/target names are data in
   declarative rows, never algorithm branches in generic paths.
4. **Layer obedience.** Every change lands at its owning layer per
   `01-canonical-four-layer-architecture.md`; cross-layer shortcuts are the
   drift being removed.
5. **Branch discipline.** One active branch per repo
   (`fix/selected-evidence-proof-closure-20260713` family); clean tree before
   each step lands; no force-push; per AGENTS.md.
6. **Single-owner execution.** This cleanup is executed sequentially without
   parallel agents unless the maintainer explicitly changes that constraint.

## Step 0 — Triage The Current WIP

Before step 1. `tsonic-csharp`'s 30 dirty worktree entries mix conformant
selected-evidence cleanup with the custom/standard dual-fact work condemned by
drift §5.

- Inventory every dirty hunk against the four-layer model before deciding its
  disposition. Keep exact selected-evidence consumption and fail-closed
  behavior. Delete second-observation recording and fallback precedence.
  Preserve target-specific facts only after their non-overlapping ownership is
  proven in step 4; do not blanket-delete them during triage.
- Exit: `git status` clean in every repo; the kept work committed with its
  focused tests green.

## Step 1 — Establish Tracked Architecture Authority

Owner: process/L3. Drift §1.

- Create `docs/architecture/**`: index and precedence; plugin/target/capability
  contract; source profile/surface contract; finalized-fact/backend boundary;
  target-toolchain boundary; diagnostic/test-evidence contract.
- Proposed source is this packet's `01`; it becomes authority only when
  reviewed, amended as needed, promoted, and tracked.
- Correct the Node capability, plugin hook, and toolchain boundary
  documentation.
- Create the canonical domain-split inventory under
  `test/capabilities/inventory/*.mjs`, atomically migrate ledger consumers, and
  remove the monolithic registry rather than retaining dual authorities.
  Independently extract source-profile/provider exports, Layer-2 contracts,
  Layer-3 capabilities, target operation rows/facts, compiled public runtime
  symbols, artifact contracts, diagnostics, and discovered test IDs; join
  them into the feature graph and regenerate `03`.
- **Delete:** "live/authoritative" claims in
  `.analysis/consolidated-final-architecture-20260626/**`; ledger-only
  inventory claims.
- Exit: docs tracked; inventory emits with zero `unclassified` public rows and
  an explicit disposition for every row; CI check that `docs/architecture` is the
  only authority path.

## Step 2 — Prepare Plugins And Composition

Owner: L3. Drift §2, §3, §13.

- Immutable validated `PreparedPluginRegistry` and `PreparedTargetComposition`.
- Discriminated module-ownership model (exact / canonical alias / bounded
  subpath / namespace prefix) compiled into one immutable ownership table;
  intersections rejected.
- One authoritative semantic session: prepare all installed capabilities for
  the selected target and register their module-bound binding providers there.
  Registration means availability only. Exact imported module ownership and
  selected provider facts determine semantic use; target/explicit surfaces
  alone provide globals; finalized facts determine runtime activation.
- Harden `createTargetContributions`: frozen before checking, owner-stamped,
  generic envelope validation in core, target-owned payload validation by the
  consuming target, deterministic conflict keys, overlap rejection, no
  first-non-defer ambiguity resolution.
- **Delete:** the preliminary bare TSTS session (`build.ts:73`/`:210`), the
  runtime AST rescan (`build.ts:141`), `specifierPrefix` string equality
  conflict checks.
- Exit: a program using zero Node imports may have the installed provider
  registered but produces zero Node-selected declarations/operations, zero
  Node global source declarations, and zero Node runtime artifacts. An
  ownership overlap between two packages fails at composition, not emission.

## Step 3 — Resolve TSTS And Source-Core Contracts

Owner: L1/L2/L3. Drift §10, §14, and the 37-issue register (`04`, TSTS
gaps).

- Exact field-initializer context and rejection identity
  (`.analysis/tsts-issues/20260720-100927-source-call-field-context-and-rejection-identity.md`).
- Declaration-only provider carrier suppression
  (`.analysis/tsts-issues/20260720-103456-provider-declaration-runtime-carrier-demand.md`).
- Public `AstReader` structural accessors and subject/package provenance
  accessors, as minimal repros require.
- Propagate source-core identities through normal ESM/provider identities and
  delete source-spelling re-export rejection. Retain struct syntax traversal
  only with one exact finalized field-fact subject and one immutable shared
  struct plan; delete subject-fallback fan-out.
- Split private attribute-builder chain state from the public terminal
  attribute-application fact. The terminal fact carries exact selected
  type/member/constructor/parameter identity rather than parameter strings or
  unresolved raw expressions.
- **Delete:** the need for backend shadow AST mirrors (lands with step 6).
- Exit: every `tsts-issues` entry has an explicit disposition (fixed,
  accepted-contract, or scheduled with gate); the two current blockers closed;
  source-core alias/namespace/re-export, struct-subject, builder shadowing, and
  invalid-chain proofs pass without source-name recovery.

## Step 4 — Unify Semantic Authority

Owner: L2/L4. Drift §5.

- Standard TSTS facts own source selection, provenance, result type,
  conversions, and operation identity.
- Classify all 19 C# keys by exact meaning and subject identity. C# keeps
  complementary immutable target payloads referenced by standard identities;
  standard selection and C# payload commit in one TSTS transaction.
- Migrate carrier authority to standard `runtimeCarrierFactKey` only after
  proving its `TargetTypeRef` preserves every required target-owned carrier
  property.
- **Delete:** custom/standard fallback precedence everywhere (custom-first in
  `backend/planner/locals.ts:90`, standard-first in
  `target-type-subject-facts.ts:158`); fact keys proven to mirror standard
  meanings; keys proven producerless/dead; direct custom-fact writes from providers
  (`csharp-nodejs/nodejs/src/provider/index.ts:181`, `:212`).
- Exit: one fact authority per meaning; a scanner proves no consumer reads a
  deleted key.

## Step 5 — Fix Lifecycle Ordering

Owner: L2/L4. Drift §6, §7.

- Canonical order: prerequisite source-core/shared facts → retained checked
  operation graph → surface/provider policy during checking/finalization →
  atomic standard selection plus target payload → post-operation aggregate
  target plans (`CsharpArrayPlan`, `CsharpObjectShapePlan`) → fact sealing →
  backend consumption.
- Replace order-dependent array/object semantic walks with canonical target
  plans; exact
  immutable records for argument binding, selected identity, provenance-ranked
  type candidates.
- **Delete:** `beforeSemanticsFinalized` source walks that read order-dependent
  checker state (`array-carrier-lifecycle/lifecycle.ts:27`); object-shape
  multi-walk fan-out; transactional state stored in side indexes outside the
  fact store; syntax/name-based reconstructions listed in drift §6. Retain
  correctly compiler-scoped memoization.
- Exit: checker query order cannot change any chosen carrier — proven by a
  mutation test that permutes observation order.

## Step 6 — Make The Backend Semantic-Query Free

Owner: L4. Drift §4, §8, §9, §10, §11.

- Replace `TargetCompileInput` with frozen `FinalizedTargetProgram`: typed
  syntax traversal + finalized plans + diagnostics + runtime requirements.
- Backend traverses public TSTS syntax and directly lowers constructs whose
  target shape follows mechanically from syntax. It consumes closed plans for
  every selected semantic choice: operations, conversions, carriers,
  ownership, unions/projections, target array/object protocols, attributes,
  exceptions, and runtime behavior. It emits only typed Roslyn AST; do not
  introduce a second all-syntax semantic IR.
- Selected identity points to policy rows; backend prints selected names and
  never invents CLR source-protocol conventions such as indexer `Item`.
  Consolidate duplicated `Length`/`Count` policy. Closed internal helper names
  such as runtime-union `IsN`/`AsN` remain valid when owned by typed target
  protocol metadata rather than inferred from source spelling.
- Semantic indexes move into the immutable prepared composition or a
  compilation-scoped `CsharpPlanningContext`.
- **Delete:** checker/type/member reselection, `source-ast-types/casts/kinds`
  mirrors after public AstReader replacement, raw
  `.TypeArguments`/`.Text`/`.Kind` probing, semantic name inference,
  invented protocols, and caches whose keys omit semantic composition inputs.
- Exit: backend compiles with no checker access in its input type; a scanner
  proves zero semantic re-entry call sites.

## Step 7 — Harden Providers And Artifacts

Owner: L4/L3. Drift §12, §16.

- One exhaustive typed provider-type visitor; complete model validation before
  conversion; full slice identity preserved; duplicate/contradictory rows
  rejected.
- Exact selected declaration/signature/index evidence required; explicit
  delegate metadata for function-value extraction; no receiver-type
  uniqueness fallback.
- `RuntimeArtifactRequirementFact`, immutable package-owned
  `RuntimeArtifactDescriptor`, owner-preserving `RuntimeArtifactLedger`, file
  existence/hash/dependency validation, structured diagnostics, pure
  `TargetArtifactPlan`.
- **Delete:** alias rewriting of contradictory identity, silent metadata
  overwrite, implicit callable-property operation synthesis without an
  explicit policy row, open-string artifact references, and `string[]`
  toolchain diagnostics demoted to suggestions.
- Exit: two contradictory provider rows fail at composition; a missing runtime
  DLL fails before project emission with a structured diagnostic.

## Step 8 — Enforce The Target-Config Boundary

Owner: L4/toolchain. Drift §15.

- Classify each C# option by actual consumer as compiler-semantic input,
  provider-metadata selection, deterministic codegen policy, closed
  generated-project default, or native toolchain configuration. Remove the
  last category from Tsonic options; keep a framework/assembly/provider input
  only when source-visible provider reflection or deterministic semantics
  demonstrably consumes it.
- Model executable/library intent as a target-neutral artifact/entrypoint
  mode, not raw `OutputType`.
- **Delete:** `publishAot`, arbitrary MSBuild properties, native SDK/publish
  controls, NuGet/project wiring, and reference options used only for build
  plumbing from `csharp-target-options.ts`, after the per-option authority
  table proves their native `.csproj` replacement. Do not delete explicit
  semantic/provider inputs merely because MSBuild has a similarly named knob.
- Exit: user-owned `.csproj` mode unaffected (it is a retained foundation);
  removed knobs have documented `.csproj` equivalents.

## Step 9 — Close Runtime Semantics

Owner: L4 runtime. Drift §17, §18.

- Shared JS runtime model: recursively closed/self-describing `TsValue`;
  closed property/object protocol; canonical array identity + sparse carrier
  whose typed reads preserve absence; shared
  ArrayBuffer/typed-array views; ECMAScript abstract operations; exact number
  formatting/parsing; closed JS error taxonomy; explicit JSON/Date policies;
  oracle-backed operation contracts. Preserve and revalidate the existing
  validator-plus-Node-oracle RegExp subset rather than rewriting it.
- Node runtime: classify every shipped API (supported / hard-reject / internal
  / removed); fix or reject the §18 substitutions (`path.normalize`,
  `Buffer.slice`, `realpathSync`, `path.posix`/`win32`, `URL`,
  `process.versions`, invented provider APIs, assert deep equality).
- Promise rule enforced: Task-equivalent lowering proven or closed
  scheduler/carrier or rejection; no accidental event loop.
- **Delete:** unclassified public compatibility APIs; heuristic union arm
  selection; CLR-coercion shortcuts.
- Exit: JS/Node oracle matrices pass; every public runtime member has a
  disposition row in the inventory.

## Step 10 — Repair Proof Infrastructure

Owner: cross-cutting verification. Drift §19, §20.

- Machine-readable feature evidence (test ID, file, suite, layer, polarity,
  observable, applicability, runtime/toolchain requirement); validation independently
  discovers tests/files and reconciles execution results.
- Independent old-suite discovery (not derivable from the classification
  inventory).
- Per-occurrence scanners; workspace-derived roots; structural bans; compiled
  documentation examples; generated-output scanning; every TSTS gap tracked
  with an acceptance gate.
- **Delete:** count-based cast blessing; whole-file classifications; nonempty-
  array validation.
- Exit: proof-infrastructure focused checks and all prior step gates pass;
  then the full parallel suite runs as the final acceptance sub-gate in `06`.
  Feature work resumes only after the complete checklist, including that full
  run, passes.

## Ordering Rationale

- Authority first (1) so every later step has one place to point at; inventory
  generation rides with it because conformance is measured against it.
- Composition before facts (2 → 4): there is no point unifying fact authority
  while a preliminary session can still create meaning outside the real one.
- TSTS contracts before fact unification (3 → 4): standard facts can only own
  selection once the missing evidence contracts exist.
- Lifecycle before backend (5 → 6): target policy participates in retained
  operation finalization, and post-operation target plans become the backend's input;
  freezing the input type first would freeze the wrong shape.
- Backend before providers/artifacts (6 → 7): provider hardening is validated
  by a backend that can no longer absorb their ambiguity.
- Config boundary after semantics (8): option removal must not strand
  semantics that currently (wrongly) depend on those knobs.
- Runtime closure near the end (9): it is large but independent; its oracle
  matrices double as the proof infrastructure's first clients (10).
