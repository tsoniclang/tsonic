# Agent Notes (Tsonic)

This repo is “airplane-grade”: correctness > speed, but we still want fast iteration loops.

## Remote Safety (IMPORTANT)

- Never delete remote branches/tags, and never force-push.
- Only push new branches and open PRs; the maintainer will handle remote cleanup.

## Work Hygiene (IMPORTANT)

- Never use `git stash` (it hides work and creates dangling/unreviewed changes).
- No dangling local work: if something matters, put it on a branch as commits (and ideally push + PR it).
- Before switching tasks/repos, ensure `git status` is clean; otherwise commit to a branch or explicitly discard.

## Branch Discipline (IMPORTANT)

- Hard rule: **no unmerged parallel branches with unique commits**. Any branch that’s ahead of `main` must be either:
  - the current active PR branch, or
  - immediately turned into a PR (or explicitly abandoned) before starting new work.
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

## Publishing Workflow (to avoid main/npm drift)

This repo uses PRs for `main`. The goal is that `main` is never behind the versions already published to npm.

- Always publish from `main` (never from `release/*` branches).
- Use `./scripts/publish-npm.sh`:
  - If versions are already published (local == npm), it prepares a `release/vX.Y.Z` bump branch and exits.
    - Open a PR for that branch, merge it to `main`, then re-run `./scripts/publish-npm.sh` to publish.
  - If versions are ahead (local > npm), it runs the full build + full test suite and publishes.
- If you ever discover npm has a higher version than `main`, do not rewrite history: bump `main` to the next patch and publish from there.

## Compatibility Policy (IMPORTANT)

- Backward compatibility is not required unless specifically and explicitly requested by the maintainer.
