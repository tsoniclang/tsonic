---
title: Architecture
---

# Architecture

This section is the detailed architecture companion to the main compiler guide.

## Read in this order

- [Overview](overview.md)
- [Pipeline](pipeline.md)
- [Frontend](frontend.md)
- [IR](ir.md)
- [Emitter](emitter.md)
- [Backend](backend.md)
- [Packages](packages.md)
- [Diagnostics](diagnostics.md)
- [Type Mappings](type-mappings.md)

## Design rules

- compiler-owned core globals are injected virtually by the frontend
- ambient surfaces are resolved through surface manifests
- `@tsonic/nodejs` is package-driven, not a surface
- first-party source packages are compiled as part of the same TypeScript
  program
- the emitter is AST-only: `IR -> CSharpAst -> printer`
