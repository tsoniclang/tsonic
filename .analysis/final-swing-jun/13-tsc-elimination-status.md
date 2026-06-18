# TSC Elimination Status

## Verified product rule

Tsonic product code must not import the TypeScript compiler API or route source semantics through `ts.Program`, `ts.TypeChecker`, `ts.SourceFile`, `ts.Node`, `ts.Symbol`, `ts.Type`, or `ts.Signature`.

Current product audit command:

```bash
rg -n "from ['\"]typescript['\"]|require\(['\"]typescript['\"]\)|\bts\." packages/cli/src packages/frontend/src packages/targets/csharp --glob '!**/dist/**' --glob '!**/node_modules/**'
```

Current product result: no product imports of `typescript`. The remaining matches are banned-string assertions and ordinary words inside comments.

## Build-tool boundary

The root `typescript` devDependency currently remains for the monorepo build bootstrap only. Package build scripts still invoke `tsc -b` because the repository does not yet have a reproducible self-host bootstrap for TSTS from a clean checkout.

This is not product frontend semantics. The product frontend uses TSTS as the semantic source engine, and the TSC-backed semantic view has been removed from the product path.

## Failed direct replacement attempt

A direct `node packages/tsts/dist/src/cli/index.js -b ...` replacement is not ready. It currently crashes before diagnostics in the TSTS build orchestrator:

```text
TypeError: Cannot read properties of undefined (reading 'length')
    at GetEncodedRootLength
    at Orchestrator_toPath
    at Orchestrator_setupBuildTask
```

Keeping package scripts pointed at that path would create a broken build-tool cutover. The correct final removal requires fixing TSTS build-mode self-hosting first.

## Final target

The final target is:

1. TSTS build mode works for this monorepo from a clean checkout.
2. `packages/tsts/package.json` no longer invokes `tsc -b`.
3. all package `build` scripts use the TSTS compiler or a TSTS-owned bootstrap.
4. root `package.json` removes the direct `typescript` devDependency.
5. the product audit above remains clean.
