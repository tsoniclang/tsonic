# Tsonic User Guide

This guide documents the current `main` behavior of Tsonic V1.

## Start Here

- `getting-started.md` — install, init, build, run
- `cli.md` — command reference
- `configuration.md` — workspace and project config
- `language.md` — supported TypeScript subset

## Core Topics

- `lang-intrinsics.md` — `stackalloc`, `sizeof`, `nameof`, `defaultof`, `trycast`, `asinterface`, modifiers, attributes
- `numeric-types.md` — `number` vs `int` / `long` / `double` policy
- `type-system.md` — deterministic typing and current generic rules
- `bindings.md` — CLR packages, source packages, Aikya manifests
- `dotnet-interop.md` — BCL and external CLR interop
- `build-output.md` — generated layout and output types
- `diagnostics.md` — diagnostic guide
- `limitations.md` — explicit out-of-scope cases
- `troubleshooting.md` — common failures and fixes

## Runtime-Oriented Topics

- `async-patterns.md`
- `callbacks.md`
- `generators.md`

## Architecture

- `architecture/README.md`

## Examples

- `examples/README.md`

## Surfaces in One Sentence

- compiler core = always-on noLib baseline
- `clr` = default ambient CLR-first surface
- `@tsonic/js` = JS ambient surface
- `@tsonic/nodejs` = normal package for `node:*` modules
