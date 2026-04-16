---
title: Testing and Quality
---

# Testing and Quality Bar

## Compiler gate

The main compiler gate is:

```bash
./test/scripts/run-all.sh
```

This suite covers:

- frontend
- emitter
- CLI
- typecheck fixtures
- E2E .NET fixtures
- negative fixtures

This is the authoritative compiler gate.

## Package gates

First-party packages also carry package-local selftests where appropriate:

- `js`
- `nodejs`
- `express`

These catch package-local regressions that do not necessarily appear in a
single downstream app.

## Downstream gates

The release bar also includes:

- `proof-is-in-the-pudding`
- `tsumo`
- `clickmeter`
- Jotster

This is necessary because many regressions only surface after full package
graphs are compiled, published, or run.

In the current wave discipline, those downstream checks are normally run against
local sibling repos for first-party packages and generated bindings. That avoids
declaring a wave green while it still depends on stale published packages.

## Wave discipline

The current release discipline is:

1. get the compiler green
2. get first-party packages green
3. rerun downstream apps
4. verify version drift and publish preflight
5. publish a coherent wave

That is why compiler, package, binding, and downstream repos are often treated
as one ship decision rather than independent islands.
