# TS-Go Schema Pin

TSTS vendors the TS-Go AST schema as the exact frontend contract.

| Field | Value |
| --- | --- |
| Upstream | `microsoft/typescript-go` |
| Commit | `879968116c1dc9110249dd7e74ba47558e68621b` |
| `ast.json` SHA-256 | `b51eb936a91ac24b61ea5ad7fa83d99b92c7329c4676c675c8b71713bcf28db3` |
| `ast.schema.json` SHA-256 | `c614df46892e8623fcb4ba9d2cbdc4da2537af140674776f3dbb78e96cdf16d2` |
| `protocol.ts` SHA-256 | `02662b99b9e40190fc56b7210139175d043e369c59345b61fb5c5533bdd42830` |
| `nodeflags.go` SHA-256 | `9f4095b280fa37ee638cd2d01efe5cc1b6b7306e9ee2471c9e736bd0cb64f2c4` |
| `symbolflags.go` SHA-256 | `eb2c56aac8513ac676f48313eb5c3fa65ba90990474b7e873ff9ec6cdb35ebca` |

## Policy

- Generated AST contract code must be derived from these files.
- Schema drift is a hard failure.
- Updating the schema requires updating this file, regenerating artifacts, and explaining the upstream TS-Go change.

## Refresh — 2026-05-20

Refreshed from prior pin `515d036f927aba8b468011098e2721335f0e2d00` (May 11) to current TS-Go HEAD `879968116c1dc9110249dd7e74ba47558e68621b` (May 20). 158 commits worth of TS-Go changes.

Schema drift across these 158 commits:

- `ast.json` — unchanged
- `ast.schema.json` — unchanged
- `protocol.ts` — content unchanged; relocated upstream from `_scripts/protocol.ts` to `_packages/native-preview/src/api/node/protocol.ts`. TSTS `tools/checkSchema.ts` already tracks the new location.
- `nodeflags.go` — unchanged
- `symbolflags.go` — changed. Accessor/property excludes semantics tightened so that accessor and property symbols correctly exclude one another and themselves where appropriate. New SHA reflects this bug fix.

The AST contract itself is unchanged. Generated bindings did not require regeneration. Compiler semantics affected by `symbolflags.go` will surface in binder/checker behavior; these will be validated by the test suite as it comes online.
