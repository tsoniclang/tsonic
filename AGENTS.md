# Agent Notes (Tsonic Host)

Read and follow `docs/architecture/workspace-agent-policy.md` before any work,
including its mandatory "Agent Delegation" and "One Current Architecture" rules,
"Direct Solutions, Not Patch Accumulation" rule, owning-layer review and examples,
"Compiler-Understood Ownership", "Native Semantics and Best-Effort JS Surfaces"
and "Native Performance From Exact Metadata" contracts for every decision.
This file contains only host-repository deltas.

## Host Ownership

- Tsonic owns generic project orchestration, target/plugin composition, source
  collection, capability selection, artifact reconstruction, transactional
  publication, and target toolchain handoff.
- The host must not contain C#, Rust, .NET, Cargo, framework, or package-family
  semantic branches. Targets and providers express those facts through public
  contracts.
- User-owned project modes emit generated target sources without mutating the
  user's native project configuration.

## Branch Check

- Before starting work and before creating a branch, run
  `bash scripts/check-branch-hygiene.sh`.
- Do not proceed while it reports warnings unless the maintainer explicitly
  approves that exact exception.

## Testing

- Run focused cases through the existing guard, for example
  `bash test/scripts/bounded-run.sh host node --test test/host-units/front.test.mjs`.
  Use `--test-name-pattern` for a narrower check and ensure any loaded build
  output matches the source being verified.
- Final verification is the unfiltered `npm test`. It builds first and then
  runs the configured architecture, Host case, and Host unit banks. Apply the
  workspace's exact expectation-only rerun rule when its conditions hold.

## Publishing

- Inspect the read-only release decision with `./scripts/release-status.sh`.
- Publish from `main` only through `./scripts/publish-npm.sh`.
- Run the publisher from one coherent sibling workspace. The host must be on
  `main`; every package repository must equal `origin/main`, with detached
  linked worktrees permitted when their shared `main` branch is checked out
  elsewhere.
- If local versions equal npm, the script prepares a release bump branch; merge
  that branch before publishing.
- If local versions are ahead, the script runs the complete build and test gate
  before publication.
- If npm is ahead of `main`, do not rewrite history; bump `main` to the next
  patch and publish from there.
- Determine publish need from local-vs-npm versions and certified source
  provenance in the exact published package. The wave declares each package's
  source/build inputs. Never infer publication from a version-bump commit.
- npm is the sole distribution for first-party compiler and runtime packages.
  A wave includes every affected npm package; do not omit runtime packages.
  External NuGet dependencies still restore normally; do not publish our own
  runtime NuGet packages.
- Stage exact npm artifacts before changing `latest`. Promote only after fresh
  public-registry C#, Rust, and Node-capability projects install and execute
  without a source checkout, local links, workspace roots, or global Tsonic.
