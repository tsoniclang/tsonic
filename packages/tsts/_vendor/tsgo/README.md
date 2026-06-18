# Vendored TS-Go assets

Files in this directory are vendored from `microsoft/typescript-go` at the
TS-Go schema pin (see `schema/tsgo/VERSION.md`).

These are NOT under `schema/tsgo/` because they aren't part of the AST
contract — they're supporting assets like diagnostic messages, test
fixtures, etc.

## Contents

### `extraDiagnosticMessages.json`

TS-Go-specific diagnostic messages (codes 100000+). These supplement
the upstream TypeScript `diagnosticMessages.json` (codes 1001-9999).

**Upstream source:** `internal/diagnostics/extraDiagnosticMessages.json`
in TS-Go at pin `879968116c1dc9110249dd7e74ba47558e68621b`.

**Vendored on:** 2026-05-20.

**Refresh:** when TS-Go schema pin updates (every monthly or so),
re-copy this file from the new pin commit.

## Pending vendor — upstream TypeScript `diagnosticMessages.json`

The canonical TypeScript diagnostic message catalog lives in the upstream
TypeScript repo at `src/compiler/diagnosticMessages.json`. TS-Go vendors
it via the `_submodules/TypeScript` submodule (pinned to `tsgo-port`
branch).

TSTS will mirror this once the submodule is initialized in TSTS.
Until then, the diagnostic-message infrastructure can use only the
extra messages from this file.

Action item: when test-infrastructure work begins (vendoring
`_submodules/TypeScript` for the test corpus), also wire the diagnostic
generator to read upstream `diagnosticMessages.json`.
