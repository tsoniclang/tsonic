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

## Fresh checkout gate

A new contributor should be able to clone the repo, install dependencies, and
build the compiler without relying on a globally installed `tsonic`.

```bash
npm ci
npm run build
```

Important details:

- `npm ci` must agree with `package-lock.json`.
- `npm run build` must use the repo-local workspace CLI packages.
- build scripts must not rewrite source files; formatting is a separate command.
- synthetic fixture packages under fixture-local `node_modules` are checked in
  when they are test input, not generated dependencies.

For the full compiler gate, use the tsoniclang developer checkout layout. The
gate includes tests that prove source-package graph traversal against authored
first-party packages, so `../js` and `../nodejs` are required source-package
sibling repos, not replaceable by published binding packages. Build the sibling
runtime first:

```bash
cd ../runtime
dotnet build -c Release
cd ../tsonic
./test/scripts/run-all.sh
```

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

## Local package resolution during tests

Most tests may prefer sibling first-party package repos when they are present.
That is intentional for wave development, but it must be proven by package
metadata:

- sibling roots are used only when the expected `package.json` exists
- installed npm packages are used otherwise
- typecheck fixture path mappings are generated from resolved package roots
- missing required packages fail explicitly instead of being guessed from names

The exception is source-package graph coverage for authored first-party source
repos. Those tests validate source-package manifests, source exports, and
transitive source traversal. They intentionally require the sibling source
package checkout because the published binding package is a different artifact.
