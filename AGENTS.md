# Agent Notes (Tsonic)

This repo is “airplane-grade”: correctness > speed, but we still want fast iteration loops.

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
