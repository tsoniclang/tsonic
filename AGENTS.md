# Agent Notes (Tsonic Host)

The workspace policy in `../AGENTS.md` applies. This file contains only host-
repository deltas.

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

- Focused emitter/frontend/CLI iteration may use:
  - `npm run test:emitter -- --grep <pattern>`
  - `npm run test:frontend -- --grep <pattern>`
  - `npm run test:cli -- --grep <pattern>`
- Focused fixture iteration may use:
  - `./test/scripts/run-e2e.sh --filter <pattern>`
  - `./test/scripts/run-all.sh --no-unit --filter <pattern>`
- Final verification is `./test/scripts/run-all.sh` with no quick mode, filter,
  or omitted unit/golden bank, except for the workspace's exact expectation-only
  rerun rule.

## Publishing

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
- Determine publish need per package from both local-vs-npm versions and content
  drift since that package's last version-bump commit.
- A wave publish includes every affected npm and NuGet package; do not omit
  runtime packages implicitly.
