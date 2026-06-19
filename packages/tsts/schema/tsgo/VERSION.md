# TS-Go Schema Pin

TSTS vendors the TS-Go AST schema as the exact frontend contract.

| Field | Value |
| --- | --- |
| Upstream | `microsoft/typescript-go` |
| Commit | `c78d39e7075b4fc641b12b1f35d905c54cdc13ef` |
| `ast.json` SHA-256 | `9259791a628105b1ed375a1a69f2002ad478f10e60ae68e01e5527e0fe619546` |
| `ast.schema.json` SHA-256 | `c614df46892e8623fcb4ba9d2cbdc4da2537af140674776f3dbb78e96cdf16d2` |
| `protocol.ts` SHA-256 | `02662b99b9e40190fc56b7210139175d043e369c59345b61fb5c5533bdd42830` |
| `nodeflags.go` SHA-256 | `8be5737c5cfe5478fcef3f0b50847d7ca4045157a6d039ffaac658977a181dc2` |
| `symbolflags.go` SHA-256 | `eb2c56aac8513ac676f48313eb5c3fa65ba90990474b7e873ff9ec6cdb35ebca` |

## Policy

- Generated AST contract code must be derived from these files.
- Schema drift is a hard failure.
- Updating the schema requires updating this file, regenerating artifacts, and explaining the upstream TS-Go change.
- The AST schema inputs must not be pinned on a separate track from the source
  submodule. `porter:verify` compares every schema-directory copy that has a live
  upstream counterpart against the checked-out source tree and fails on any
  byte-level drift.

## Pin bump — 2026-06-13

Bumped the schema directory and the TS-Go source submodule together from
`515d036f927aba8b468011098e2721335f0e2d00` (2026-04-24) to
`c78d39e7075b4fc641b12b1f35d905c54cdc13ef` (2026-06-12), 285 upstream commits.

Schema input drift across that range:

- `ast.json` — changed (new AST node shapes / kinds).
- `nodeflags.go` — changed (new node flags).
- `symbolflags.go` — changed (symbol-merge exclusion masks now exclude accessor/
  property cross-merges; this is the upstream behaviour the bump adopts).
- `ast.schema.json`, `protocol.ts` — unchanged.

Generated AST artifacts were regenerated from these inputs; the hand-ported
`internal/ast/symbolflags.ts` was re-ported to the new masks as part of the bump.
