# Agent Notes (Tsonic)

This repo is “airplane-grade”: correctness > speed, but we still want fast iteration loops.

## Remote Safety (IMPORTANT)

- Never delete remote branches/tags, and never force-push.
- Only push new branches and open PRs; the maintainer will handle remote cleanup.

## Work Hygiene (IMPORTANT)

- Never use `git stash` (it hides work and creates dangling/unreviewed changes).
- No dangling local work: if something matters, put it on a branch as commits (and ideally push + PR it).
- Before switching tasks/repos, ensure `git status` is clean; otherwise commit to a branch or explicitly discard.
- Use `.temp/` for all temporary/debug work inside this repo.
- Do not use `/tmp` for Tsonic-specific scratch work.
- Do not create scratch workspaces under `packages/`; put them under `.temp/` instead.
- Do not delete anything under `.temp/` unless the maintainer explicitly asks for that exact cleanup.
- Treat `.temp/` contents as maintainer-owned scratch state that must be preserved by default.

## Branch Discipline (IMPORTANT)

- Hard rule: **no unmerged parallel branches with unique commits**. Any branch that’s ahead of `main` must be either:
  - the current active PR branch, or
  - immediately turned into a PR (or explicitly abandoned) before starting new work.
- Before starting work, and again before creating a new branch, run:
  - `bash scripts/check-branch-hygiene.sh`
- Do not proceed if that script reports warnings unless the maintainer explicitly says to ignore them for the current task.
- **Do not create a new branch without explicit maintainer approval.**
  - Before branching, first verify all current work is already PR’ed and merged (or is the one active PR branch).
  - If any “dangling” branches exist (ahead of `main`), stop and ask what to do with them.
- Prefer “one active branch” per repo: keep adding commits to the current PR branch until it’s merged.

## PR Hygiene (IMPORTANT)

- Never open/announce a PR while the working tree is dirty.
  - Before creating or sharing a PR, run `git status --porcelain` and ensure it is empty.
  - If there are local changes, either commit them to the PR branch (and push) or explicitly discard them first.
- After a PR is opened, do not continue unrelated local edits on that branch. Keep PR commits intentional and synchronized with what is pushed/reviewed.

## Testing Workflow

- Treat the Tsonic test suite and documented language rules as canonical. External/downstream repositories may expose bugs or missing coverage, but they must not redefine the language or compiler contract.
- A change in language/spec/surface behavior requires explicit maintainer approval before implementation. Do not infer a spec change from downstream pressure, failing external tests, or convenience.
- When downstream source relies on behavior outside the approved spec, fix the downstream source or bring the spec question back to the maintainer; do not weaken the compiler.
- Never add code branches, heuristics, compatibility shims, or special cases just to make tests pass.
- Never add bridge code, temporary compatibility layers, or product-path debug helpers as a “final” fix.
- If temporary instrumentation or debug code is necessary during investigation, keep it under `.temp/` and out of product codepaths.
- When a test fails, fix the underlying compiler/runtime/package root cause or remove the invalid assumption from the test.

## NativeAOT First (IMPORTANT)

- Tsonic is strict compile-time native-binary-first. Emitting/debugging MSIL is allowed only as a secondary path; every product compiler/runtime/codegen design must remain compatible with publishing to pure native code.
- Do not use runtime reflection, member discovery, dynamic invocation, generated `dynamic`, `System.Reflection` fallbacks, `GetProperty`/`GetProperties`, `GetMethod`/`GetMethods`, `MethodInfo.Invoke`, `MakeGenericMethod`, `Activator.CreateInstance`, or `Assembly.Load` as language/runtime semantics.
- If a feature needs member access, method dispatch, object projection, serialization metadata, or structural conversion, the compiler must prove it statically and emit closed generated code, source-generated metadata, or calls into closed runtime-owned carriers.
- Broad carriers such as `unknown`, `object`, `JsValue`, dictionaries, and dynamic JSON objects may only use deterministic closed-carrier operations; they must not reflect over arbitrary CLR objects.
- If semantics cannot be proven without runtime reflection, emit a deterministic diagnostic instead of guessing or falling back.
- Build-time tooling may inspect assemblies as tooling input, but that reflection must not appear in product runtime paths or generated user code.

## Reports and Analysis

- All technical reports, plans, status updates, and failure analyses must include concrete source-level examples unless the maintainer explicitly says examples are unnecessary.
- Examples must be detailed enough to follow the full flow step by step: user-facing TypeScript input, inferred/semantic IR meaning when relevant, runtime/storage carrier choice, emitted C# shape, expected behavior, actual behavior, and why the difference matters.
- Reports must explain the causal chain from source code to compiler decision to emitted output; do not give only summaries, labels, or TODO lists when the maintainer is asking for analysis.
- When classifying issues, group repeated symptoms by root cause and identify which failures are fallout rather than separate bugs.

Fast iteration (OK while developing / on external testbed projects):

- Run a focused unit/golden subset (Mocha `--grep` works):
  - `npm run test:emitter -- --grep <pattern>`
  - `npm run test:frontend -- --grep <pattern>`
  - `npm run test:cli -- --grep <pattern>`
- Run focused fixtures (typecheck + E2E) without unit/golden:
  - `./test/scripts/run-e2e.sh --filter <pattern>`
  - (equivalent) `./test/scripts/run-all.sh --no-unit --filter <pattern>`

Final verification (REQUIRED before merge/publish):

- `./test/scripts/run-all.sh` (no `--quick` / no `--filter`)

Policy:

- Filtered runs are for iteration only; they must never be used as the final gate.
- `--no-unit` / `run-e2e.sh` are for iteration only; final verification must include unit + golden tests.
- If a change is substantial (emitter/type system/CLI/runtime behavior), run the full suite even during development.
- Never change code, tests, fixtures, or expectations merely to make tests pass.
- If a test fails, fix the root cause in product/compiler/runtime behavior rather than weakening coverage or encoding the current bug into the expected output.

## Publishing Workflow (to avoid main/npm drift)

This repo uses PRs for `main`. The goal is that `main` is never behind the versions already published to npm.

- Always publish from `main` (never from `release/*` branches).
- Use `./scripts/publish-npm.sh`:
  - If versions are already published (local == npm), it prepares a `release/vX.Y.Z` bump branch and exits.
    - Open a PR for that branch, merge it to `main`, then re-run `./scripts/publish-npm.sh` to publish.
  - If versions are ahead (local > npm), it runs the full build + full test suite and publishes.
- If you ever discover npm has a higher version than `main`, do not rewrite history: bump `main` to the next patch and publish from there.

### Publish Need Verification (MANDATORY)

- When asked whether publishing is needed, **do not rely on version numbers alone**.
- Always verify both:
  - version comparison (`local` vs `npm`), and
  - content drift since the last version bump commit for each published package path.
- Treat this as “needs publish” when package content changed after the last published-version commit, even if `local == npm` (indicates missing version bump).
- In monorepos, run this check per publishable package (not just once at repo root).
- When the maintainer says “wave publish”, treat that as the full wave:
  - npm packages and NuGet packages
  - no implicit omission of runtime packages.

## Compatibility Policy (IMPORTANT)

- Backward compatibility is not required unless specifically and explicitly requested by the maintainer.
- Always attempt the final-grade architecture directly. Do not land temporary bridge code, intermediate compatibility paths, or staged “fix it now, clean it later” product changes.
- Do not preserve, add, or route through compatibility shims, bridge code, dual-path behavior, or legacy codepaths for native first-party packages.
- Prefer breaking stale assumptions and fixing the real architecture over keeping old paths alive.

## Truth Over Heuristics (IMPORTANT)

- Do not add heuristic resolution, recovery, guessing, fallback binding, name-based inference, or best-effort behavior in compiler/runtime/package code.
- If the compiler does not know something deterministically, it must fail with a real diagnostic rather than infer semantics from names, patterns, or partial metadata.
- If a path or artifact is optional, discovery must prove it exists before reading it; do not probe and then silently recover.
- Remove existing heuristic/native-compat code when touching that area unless the maintainer explicitly requests otherwise.

## Source Syntax Discipline (IMPORTANT)

- Treat TypeScript as a type-annotation layer over standard modern JavaScript. Runtime-shape syntax in product code, runtime-facing tests, fixtures, docs, and first-party source packages must stay compatible with modern ECMAScript semantics.
- Do not use TypeScript-only runtime-shape features as implementation mechanisms or compiler signals, including explicit `public`, parameter properties, namespaces, decorators, non-ECMAScript class modifiers, or syntax whose runtime meaning does not exist in standard JavaScript.
- Type-only syntax is allowed only when it is erased and does not affect runtime shape: type annotations, `type`/`interface` declarations, `import type`, and type-only assertions required for deterministic compiler typing.
- Do not add explicit `public` modifiers as compiler signals, test aids, overload matching aids, or source-package workarounds.
- Omitted class member accessibility is semantically public; compiler logic must canonicalize it instead of requiring explicit modifiers.
- If compiler behavior depends on a spelling difference between equivalent TypeScript forms, fix compiler normalization rather than changing source spelling.

## ESM Only (IMPORTANT)

- ESM only. Do not introduce or keep non-ESM module wiring in source, declarations, tests, or generated package entrypoints.
- Triple-slash TypeScript references such as `/// <reference ... />` are banned.
- Do not use CommonJS patterns (`require`, `module.exports`, `export =`) or TypeScript namespace-style module shims as compatibility shortcuts.
- Do not rely on ambient/preprocessing hacks to inject globals across modules; use explicit ESM imports/exports or compiler-managed package loading instead.
- Prefer explicit exported ESM subpaths with extensions (for example `@tsonic/js/index.js`, `@tsonic/js/console.js`) over package-root bootstrap imports.
- Do not use package-root imports like `@tsonic/js` or `@tsonic/nodejs` as implicit global bootstrap shims unless the maintainer explicitly approves that exact usage.
