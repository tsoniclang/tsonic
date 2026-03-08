# Architecture

Tsonic is split into four main layers:

- CLI
- frontend
- emitter
- backend

The important current architectural facts are:

- compiler-owned core globals are injected virtually by the frontend
- ambient surfaces are resolved through surface manifests
- Node is package-driven, not a surface
- first-party source packages are compiled as part of the same TS program
- the emitter is now AST-only (`IR -> CSharpAst -> printer`)

## Reading Order

- `overview.md`
- `pipeline.md`
- `frontend.md`
- `ir.md`
- `emitter.md`
- `backend.md`
- `runtime.md`
- `packages.md`
- `type-mappings.md`
- `diagnostics.md`
