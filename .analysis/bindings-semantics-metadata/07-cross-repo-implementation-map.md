# Cross-Repo Implementation Map

This file turns the plan into a concrete repo/file map.

It answers:

- where package authorship lives today
- which files would need to change for phase 1
- which files are merely consumers of the new metadata
- where phase 2 would continue after parity is complete

## 1. Current authoring points

For the current JS and Node package world, the package-generation authoring points already exist.

### JS surface package

Primary authoring file:

- `js-runtime/surface/10/tsbindgen.surface-package.json`

This file already defines:

- ambient/global declarations
- declaration-file shaping
- package-level surface projection inputs

Example current responsibility:

- declaring that `String`, `Array`, `Date`, `Map`, `Set`, `JSON`, `console`, etc. exist in the JS surface package

This is the most natural place for future authored semantics such as:

- whether `Date` contributes type identity
- whether `trim` emits as a receiver call

### Node package

Primary authoring file:

- `nodejs-clr/surface/10/tsbindgen.surface-package.json`

This file already defines:

- `node:*` and bare module aliases
- reexports from `@tsonic/nodejs/index.js`
- package-side projection of the Node module world

Example current responsibility:

- declaring that both `"node:fs"` and `"fs"` resolve to the same package module surface

This is the natural place for any future package-declared semantics that belong to Node bindings.

### Important note

Today these surface-package files do **not** carry the proposed new semantics fields.

They are only the current authoring/configuration point where those semantics would most naturally be added later.

## 2. Phase 1 repo-by-repo work

Phase 1 is parity-only.

That means all repo changes must preserve current emitted behavior exactly.

## 2.1 `tsbindgen`

Purpose:

- extend bindings schema
- emit explicit semantics fields from package authoring data

Likely touch points:

- `tsbindgen/src/tsbindgen/*`
- bindings-schema models
- package generation/projection code that currently writes `bindings.json`

Expected new responsibility:

- serialize explicit metadata such as:
  - `emitSemantics.callStyle`
  - `typeSemantics.contributesTypeIdentity`

Example:

If JS surface config says that `trim` is receiver-style, `tsbindgen` should write that into generated bindings instead of requiring compiler heuristics.

## 2.2 `tsonic`

Purpose:

- consume explicit metadata
- reproduce current behavior without namespace/capitalization guessing where metadata exists

Known current heuristic points:

- `tsonic/packages/emitter/src/expressions/calls/call-analysis.ts`
- `tsonic/packages/frontend/src/program/binding-registry.ts`
- `tsonic/packages/frontend/src/ir/program-context.ts`
- `tsonic/packages/frontend/src/ir/type-system/internal/universe/unified-universe.ts`

Expected new responsibility:

- binding loader reads explicit semantics
- emitter consults `emitSemantics.callStyle`
- frontend/type-space logic consults `typeSemantics.contributesTypeIdentity`

Example:

Current source:

```ts
const s = "  hi  ".trim();
```

Current compiler reason:

- CLR type starts with a retired JS CLR runtime namespace.

Phase 1 target:

- binding explicitly says receiver-style
- emitted output stays exactly the same

## 2.3 `js-runtime`

Purpose:

- author JS surface semantics at the package-generation level

Primary file:

- `js-runtime/surface/10/tsbindgen.surface-package.json`

Expected phase-1 work:

- annotate the relevant bindings/global declarations with explicit semantics inputs
- do **not** change the intended behavior

Examples:

- `Date` should still behave as type-like if that is current behavior
- `JSON` should still remain value/static-container only
- JS receiver helpers like `trim` should still emit receiver-style

## 2.4 `js`

Purpose:

- generated package output

Phase-1 role:

- regeneration target only
- validate that generated `bindings.json` and declaration outputs remain behaviorally stable

Do not hand-edit generated outputs as the source of truth.

## 2.5 `nodejs-clr`

Purpose:

- author Node package semantics at the package-generation level

Primary file:

- `nodejs-clr/surface/10/tsbindgen.surface-package.json`

Phase-1 role:

- add explicit authored semantics only where the Node package needs them
- preserve current binding behavior

## 2.6 `nodejs`

Purpose:

- generated package output

Phase-1 role:

- regeneration target only
- verify that package outputs still behave exactly the same

## 2.7 Other generated packages

Other packages may eventually participate if they currently rely on hardcoded call-style or type-identity heuristics.

Examples to inspect:

- `dotnet`
- `efcore`
- packages with LINQ/EF/query operator bindings

The parity matrix plus instrumentation must decide which of these actually need explicit metadata in phase 1.

Before implementation starts, ownership must be explicit for every currently hit heuristic family.

Current explicit owner/file assignments for currently known heuristic families:

- `System.Linq.Queryable.*`
  - owner repo: `dotnet`
  - authoring file: `dotnet/__build/templates/10/tsbindgen.bindings-semantics.json`
- `System.Linq.Enumerable`
  - owner repo: `dotnet`
  - authoring file: `dotnet/__build/templates/10/tsbindgen.bindings-semantics.json`
- `Microsoft.EntityFrameworkCore.*`
  - owner repo: `efcore`
  - authoring file: `efcore/__build/templates/10/tsbindgen.bindings-semantics.json`

“inspect later” is not sufficient once coding begins.

This means the first coding checkpoint is not “schema work starts”.

The first coding checkpoint is:

- preserved instrumentation artifact exists
- every currently hit LINQ / EF / other unresolved family has a concrete owner and authoring file

## 3. Exact migration ownership

The intended responsibility split is:

- package author decides semantics
- package generation config captures semantics
- `tsbindgen` serializes semantics into bindings
- `tsonic` consumes semantics
- generated packages are verification artifacts

This means:

- do not add new package-family hardcoding to `tsonic`
- do not hand-edit generated outputs in `js` or `nodejs`
- do not let `tsbindgen` invent semantics on its own without package/config input

## 4. Phase 1 concrete checklist

1. Instrument current heuristic paths and record real hits.
2. Build parity table from current compiler behavior plus those instrumented hits.
3. Identify which current cases are authored from:
   - `js-runtime/surface/10/tsbindgen.surface-package.json`
   - `nodejs-clr/surface/10/tsbindgen.surface-package.json`
   - any other package config inputs
4. Fill explicit owner/file for every currently hit heuristic family, including LINQ / EF participants where applicable.
5. Extend `tsbindgen` schema/output.
6. Regenerate `js` / `nodejs` and any other participating packages.
7. Update `tsonic` consumers to use metadata.
8. Prove no output drift.
9. Add a post-migration no-heuristic-hit gate for migrated families.

## 5. Phase 2 continuation

Once phase 1 parity is green, phase 2 can do policy lift.

Phase 2 is where the team may ask:

- should some current static calls become fluent?
- should some fluent calls become static?
- should some globals stop contributing type identity?
- should new packages be able to author these semantics without any compiler edits?

Phase 2 must not start until phase 1 parity is complete.
