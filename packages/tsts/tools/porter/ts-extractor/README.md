# Signature & type-equivalence checker

`porter sig-check` compares every ported `@tsgo-unit`'s **actual** TS signature
(parsed from the `.ts` file) against the signature **derived from the Go** source
it claims to port. It closes the gap where a hand-edited TS signature can drift
while the Go hash, `tsc` build, and conformance baselines all stay green.

```
node packages/tsts/tools/porter/porter.mjs sig-check [--id <glob>] [--json] [--no-gate]
# or
npm run porter:sig-check
```

`--id <glob>` scopes to matching unit ids; `--json` prints the full machine
report; `--no-gate` exits 0 regardless (local exploration). Without `--no-gate`
the command exits non-zero when mismatches remain. `porter verify` always runs
the same signature check as a hard gate.

## How it works

- **Actual side** (`extract-signatures.mjs` + `ast-signatures.mjs`): parses each
  ported `.ts` with TSTS's own compiled parser and builds a canonical structured
  type descriptor per unit, resolving type references through imports/re-exports
  to their defining module.
- **Expected side** (`expected-from-go.mjs`): builds the same descriptor shape
  directly from the Go extractor's structured type model, resolving each Go type
  to the TS module where its `@tsgo-unit` actually lives (split-aware).
- **Compare** (`sig-check.mjs`): structural equality (`ast-signatures.typesEqual`)
  with re-export-aware identity, after normalizing both sides through the
  configurable convention engine.

Gated mismatch kinds: `arity`, `param-order`, `param-type`, `variadic-position`,
`return-type`, `type-param-count`/`-constraint`, `member-type`, `missing-member`,
`extra-member`, `value-type`, `value-annotation-missing`, `value-type-unresolved`.

## Configuration — `signatureCheck` in `porter.config.json`

All Go→TS mapping knowledge is config, defaulting to the tsts profile in
`profile.mjs`. Override any of it under `signatureCheck`:

```jsonc
"signatureCheck": {
  // Go->TS mapping (defaults shown in profile.mjs; override per project):
  "modules":   { "core": "packages/tsts/src/go/scalars.ts", "compat": "packages/tsts/src/go/compat.ts" },
  "bridge":    { "pointer": "GoPtr", "slice": "GoSlice", "array": "GoArray", "map": "GoMap", "chan": "GoChan" },
  "primitives":{ "keyword": { "string": "string", "any": "unknown" }, "core": { "int": "int", "uint64": "ulong" }, "compat": { "error": "GoError" } },
  "stdlibTypes": { "iter.Seq": "GoSeq" },
  "facadeTemplate": "packages/tsts/src/go/{importPath}.ts",
  "annotation": { "tag": "@tsgo-unit", "idSeparator": "::", "methodNameJoin": "_" },
  "parser": { "distRoot": "packages/tsts/dist/src/internal", "freshnessSrcDirs": ["…/parser", "…/ast", "…/scanner", "…/core"] },

  // Editable porting conventions (a => b), accepted without per-unit overrides:
  "conventions": {
    "equivalences": [
      { "as": "go-comparable", "match": [ { "name": "comparable" }, { "refName": "GoComparable" } ] }
    ],
    "structural": {
      "acceptNullable": false,        // T | undefined  ==  T
      "unwrapPtrFunc": false,         // GoPtr<(..)=>R>  ==  (..)=>R
      "anyMapKey": false,             // GoMap<K,V> key types must match
      "ptrValueEquivStruct": false,   // GoPtr<X> == X
      "acceptErasedConstraints": false // non-trivial Go constraints must be preserved in TS
    }
  }
}
```

Per-unit signature acceptances are intentionally not configured here. They live
next to the declaration as local `@tsgo-override` metadata with full
`goSignature` and `tsSignature` snapshots. The verifier fails if either snapshot
drifts.

## Using it outside tsts

The engine carries **no** tsts-specific type names — they all live in the profile.
Another Go→TS port project runs the checker by supplying its own `signatureCheck`
profile (its bridge/module/primitive names, facade layout, annotation scheme,
parser dist path) plus its conventions. See the `portability:` unit test in
`sig-check.test.mjs` for a worked non-tsts profile.

The one code-level extension point (not config) is the **parser AST shape**: the
actual side reads the TSTS (Go-port) AST. A project using a different TS parser
supplies a thin parser adapter exposing the same accessors (`Kind`, `As*` casts,
`.Parameters/.Type/.Members`, `Node_Pos/Node_End`). Everything else is config.
