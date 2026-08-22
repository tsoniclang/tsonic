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

## Repository Safety

- Never force-push or delete remote branches or tags. Push branches and let the
  maintainer merge and clean up remotely.
- Never use `git stash`, `git add -f`, or `git add --force`.
- `.gitignore` is authoritative. If ignored content must become product input,
  change `.gitignore` in its own reviewed commit; never bypass it per file.
- Keep meaningful work committed and pushed on the one active branch before
  changing repositories or tasks. Never leave hidden or dangling work.
- Do not create a branch without explicit maintainer approval. Before branching,
  run the repository's branch-hygiene check when one exists and resolve every
  branch ahead of `main` except the one active PR branch.
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

## Development and Verification

- The repository's documented language rules and tests are canonical.
  Downstream projects can reveal defects but cannot redefine the contract.
- A language, surface, schema, or semantic change requires explicit maintainer
  approval. Fix invalid downstream assumptions downstream instead of weakening
  the compiler.
- Use focused tests while iterating. Before merge or publication, run the
  repository's documented complete gate unless the exact exception below
  applies.
- Never change product code, fixtures, tests, or expected output merely to make
  a test pass. Determine and fix the owning root cause.
- Temporary instrumentation belongs under `.temp/`, never in a final product
  path.
- Do not run a complete suite repeatedly after each small implementation. Batch
  coherent edits, collect all diagnostics from a run, fix the complete class,
  then rerun at the appropriate scope.

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

- Backward compatibility is absent unless the maintainer explicitly requests a
  specific compatibility contract.
- Never land bridge architecture, temporary product paths, dual readers,
  old-or-new schema handling, compatibility aliases, legacy fallback, or
  “clean it later” code.
- When a canonical shape changes, break stale assumptions and repair every
  first-party producer and consumer against the final shape.

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
  ledger evidence.

### Explicit Target Semantics

- Preserve every independently controllable target behavior as an independent
  fact, marker, policy choice, dialect rule, or project setting.
- Never infer one target control from another unless the pinned target-language
  specification defines that implication. Compiler convention or current
  acceptance is not specification evidence.
- Absence means the behavior was not selected. Emit exactly the target
  language's documented coupling for the selected version, or reject an
  unrepresentable combination precisely.

### TypeScript Source Discipline

- Product TypeScript is a type-annotation layer over standard modern
  JavaScript. Do not use TypeScript-only runtime-shape features as compiler
  signals or implementation mechanisms.
- In particular, do not use explicit `public`, parameter properties,
  namespaces, decorators, or non-ECMAScript class modifiers as compiler
  signals, test aids, or source-package workarounds.
- Type-only annotations, interfaces, imports, and deterministic assertions may
  erase normally; runtime-facing syntax must retain ECMAScript meaning.
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
- Child `AGENTS.md` files maintained by this workstream contain only repository-
  specific deltas. Separately owned repositories retain their existing local
  policy until their owners migrate it.
- In migrated scopes, `CLAUDE.md` imports its same-scope `AGENTS.md`; it does not
  duplicate policy prose.
