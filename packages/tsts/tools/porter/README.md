# TSTS Porter Tooling

This directory is the mechanical-port backbone for TSTS. The tooling reads the real vendored TS-Go checkout, extracts Go declarations with Go's own parser, and compares those extracted units against TypeScript files that carry embedded `@tsgo-unit` metadata.

## Commands

- `npm run porter:scan` extracts a full TS-Go snapshot into `.temp/porter/tsgo-snapshot.json`.
- `npm run porter:status` extracts TS-Go, scans TypeScript metadata, and writes `.temp/porter/status.json` plus `.temp/porter/status.md`.
- `npm run porter:verify` fails on Go parse errors, duplicate Go IDs, duplicate TS IDs, orphan TS metadata, TypeScript files without `@tsgo-unit`, or stale hashes. Add `-- --strict-port` to also fail while units are missing.
- `npm run porter:scaffold -- --limit 25` previews missing-unit scaffolds. Add `-- --write` to create files.
- `npm run porter:scaffold-all` creates or appends scaffolds for every active missing Go unit, refreshes porter status, and fails if any active unit remains missing.
- `npm run porter:facades -- --out packages/tsts/src` regenerates the checked-in Go compatibility/facade layer from the full TS-Go snapshot. Existing differing files are never overwritten unless `-- --force` is also supplied.
- `npm run porter:facades -- --check` verifies the checked-in Go compatibility/facade layer is exactly the deterministic output for the current TS-Go snapshot.
- `npm run porter:large-files` verifies every active literal-port Go file over the configured LOC threshold has a semantic split plan.
- `npm run porter:large-files -- --write-draft` writes a draft semantic split plan from the current TS-Go declaration inventory. Existing differing plans are never overwritten unless `-- --force` is also supplied. Treat this as a bootstrap command, not the normal update path for a reviewed plan.
- `npm run porter:skeleton-check` renders the complete missing-unit skeleton corpus into `.temp/porter/skeleton` and runs `tsc --noEmit` against it.

## Embedded Metadata

Each ported unit carries one JSON metadata line:

```ts
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/debug/debug.go::func::Fail","kind":"func","status":"implemented","sigHash":"...","bodyHash":"..."}
 */
```

The ID already contains the Go module, Go file path, artifact kind, and qualified Go name. Do not repeat filename metadata in generated TypeScript files. When a large Go file is split into many TypeScript files, the split is represented in `packages/tsts/porter.large-splits.json`, not by duplicating path metadata in every unit.

## Status Model

- `missing`: the Go unit has no TypeScript `@tsgo-unit`.
- `stub`: the TypeScript unit exists but intentionally throws or contains type-only placeholder shape.
- `implemented`: the TypeScript unit is complete for the recorded Go hashes.
- `stale`: the Go signature/body hash changed since the TypeScript unit was written.
- `orphan`: a TypeScript `@tsgo-unit` refers to no current Go unit.
- `untracked TS file`: a TypeScript source file exists under `src/` but carries no `@tsgo-unit`.
- `excluded`: the Go unit is explicitly outside the active standalone compiler porter scope and must not be scaffolded. Generated units, Go tests, language-service/editor surfaces, and other non-production policy classes are excluded from production scaffold coverage even though they remain visible in the inventory.
- `forbidden TS file`: a TypeScript source file exists in a path that must not exist in the active standalone compiler tree.

Generated, test, host-native, out-of-scope, and manual-required categories are explicit policy classifications in `porter.config.json`; they are not silent omissions. Production scaffold coverage is active only for `literal-port`, `manual-required`, and `host-native` units. Generated code is checked through generated-artifact gates, and test parity belongs to the test harness rather than production source scaffolding.

## Out-of-Scope Language-Service Surface

The standalone compiler porter excludes the language-service/editor surface completely:

- `internal/ls/**`
- `internal/lsp/**`
- `internal/api/**`
- `internal/project/**`
- `internal/format/**`
- `cmd/tsgo/lsp.go`
- fourslash/editor harness paths
- upstream repository tools under `_tools/**`
- upstream test harness/helper paths such as `internal/testutil/**`, `internal/testrunner/**`, and `internal/execute/tsctests/**`

These files may exist only in the vendored TS-Go checkout as upstream reference input. They must not exist under `packages/tsts/src`. The porter reports matching Go units as `excluded`, and `porter:verify` fails if matching TypeScript files appear in the active source tree.

## Generated Go Facades

The porter generates `packages/tsts/src/go/**` from the current TS-Go corpus. This is the only boundary for Go standard-library and third-party packages. Generated TSTS source must import these facades instead of using untyped `GoExternal` placeholders.

Each generated artifact carries deterministic file-level metadata:

```ts
// Code generated by TSTS porter. DO NOT EDIT.
// @tsgo-generated {"schemaVersion":1,"kind":"go-facade","generator":"porter:facades","sourceRevision":"...","path":"go/io.ts","contentHash":"..."}
```

Generated artifacts are not hand-editable. `porter:verify` fails on:

- missing generated artifacts,
- stale generated artifacts whose text differs from current deterministic output,
- orphan generated artifacts no longer produced by the current TS-Go snapshot,
- untracked files under `packages/tsts/src/go/**` without `@tsgo-generated`,
- malformed generated metadata.

Facade generation has two inputs:

- Type-position selectors in Go signatures produce typed facades where the shape is known, such as `io.Writer`, `io.Reader`, `time.Duration`, and `context.Context`.
- Body-position selectors produce callable/value skeletons for later implementation work, such as `path/filepath.Join`, `os.ReadFile`, `regexp.MustCompile`, and `gotest.tools/v3/assert.Equal`.

Examples:

```ts
export interface Writer {
  Write(p: GoSlice<byte>): [int, GoError];
}

export function Join(...args: Array<unknown>): unknown {
  throw new globalThis.Error("TSGO_EXTERNAL_FACADE_UNIMPLEMENTED path/filepath.Join");
}
```

Body-only facade members intentionally start as skeletons when the Go AST alone does not expose a return type. The important invariant is that every observed external package symbol has a deterministic TypeScript home, so later implementation does not rediscover dependency surfaces manually.

## Generated Skeleton Quality

The skeleton renderer emits compilable TypeScript for every portable Go unit:

- Function and method parameters/results are derived from Go AST signatures.
- Go primitives map to `@tsonic/core` numeric/source types where available.
- Multiple Go return values become TypeScript tuples.
- Go generic type declarations receive `unknown` defaults so partially specialized Go uses compile as skeletons.
- Untyped values use syntactic inference for literals, `make(...)`, `new(...)`, function literals, composite literals, `errors.New(...)`, and same-package aliases.
- Every generated body throws with `globalThis.Error` so facade symbols named `Error` cannot shadow the runtime constructor.

The validation gate is `npm run porter:skeleton-check`; it must render all portable units with zero renderer diagnostics and a passing TypeScript compile.

## Coverage Safeguards

The extractor records every `.go` file it sees, including generated files, tests, package-doc-only files, and host-specific files. `porter:status` reports:

- Go parse errors.
- Go files with no top-level declaration units.
- Go units missing from TypeScript.
- TypeScript units whose Go hashes are stale.
- TypeScript `@tsgo-unit` metadata that no longer maps to current Go.
- TypeScript files that contain no `@tsgo-unit` metadata.

Normal port code cannot appear silently. If a TypeScript helper is genuinely needed, add an explicit source-file policy before it is accepted.

The intended full-coverage bootstrap invariant is stronger: every active Go unit must have exactly one TypeScript `@tsgo-unit` block. Use `npm run porter:scaffold-all` to create traceable stubs for the complete active missing set before judging implementation quality. After that point, `missing` should remain zero; ongoing work should move units from `stub` to `implemented`.

## Incremental Update Contract

When the TS-Go submodule advances, run:

```sh
npm run porter:status
npm run porter:verify
```

The status pass recomputes Go signature/body hashes from the current Go AST. Any TypeScript unit whose embedded hashes no longer match becomes `stale`. The tool never overwrites implemented TypeScript. Scaffold writes are explicit and append-only unless a new file is being created.

If a TS-Go update removes or renames a Go unit, the existing TypeScript `@tsgo-unit` becomes `orphan`. If the update adds the same concept under a new Go identity, that new identity is reported separately as `missing`. The tool does not guess that an orphan and a missing unit are the same change; a human must either delete the orphan, move the implementation, or update the metadata after reviewing the upstream delta.

If a generated facade disappears from the new snapshot, the old generated file becomes `orphan generated artifact`. The tool never deletes it automatically because deletion is a source-control decision. Regeneration plus verification makes the stale/orphan state explicit.

## Semantic Large-File Splits

Large files are not split randomly. File size is only the trigger for a required semantic review.

The porter enforces this flow:

1. `porter:large-files` finds every active literal-port Go file over `largeFileLineThreshold`.
2. Each required file must have one entry in `packages/tsts/porter.large-splits.json`.
3. Each target must have a semantic description and a stable target file path.
4. Every portable declaration in the large Go file must be assigned to exactly one target.
5. A declaration listed in the plan that no longer exists upstream is reported as stale.
6. A declaration claimed by two targets is reported as a duplicate assignment.
7. A random-looking target such as `part-001.ts`, `chunk-002.ts`, or `lines-5000.ts` is rejected.

Example:

```json
{
  "schemaVersion": 1,
  "files": {
    "internal/checker/checker.go": {
      "targetRoot": "packages/tsts/src/internal/checker/checker",
      "targets": [
        {
          "file": "relations.ts",
          "description": "Assignability, comparability, relation checks, identity checks, and excess-property logic.",
          "declarations": [
            "method::Checker.checkTypeAssignableTo",
            "method::Checker.isTypeRelatedTo"
          ]
        }
      ]
    }
  }
}
```

The declaration keys are local to the source file. They intentionally do not repeat the Go filename because the filename is already the key of the plan entry. The emitted TypeScript still carries only `@tsgo-unit` metadata, so split layout can change without changing the Go unit identity.

The current initial semantic plan covers:

- `internal/checker/checker.go`
- `internal/parser/parser.go`
- `internal/printer/printer.go`

Generated files, tests, LS/LSP, fourslash, host-native files, and manual-required files are not part of the semantic large-file split gate. They are handled by their own explicit porter policies.

### Overwrite Safety

Porter write commands are safe by default:

- Creating a missing file is allowed.
- Writing identical content to an existing file is a no-op.
- Writing different content to an existing file fails.
- `--force` is required before replacing existing different content.

This applies to generated facades and split-plan draft generation. The intent is that reviewed hand edits, reviewed semantic split boundaries, and manually implemented hot facades cannot be lost by a routine regeneration command.

Normal workflow:

```sh
npm run porter:large-files -- --check
npm run porter:facades -- --check
```

Only after reviewing the diff should a maintainer use:

```sh
npm run porter:large-files -- --write-draft --force
npm run porter:facades -- --out packages/tsts/src --force
```

The `--force` flag is intentionally explicit. It is a source-control operation, not a normal validation operation.

## Overrides

Policy entries classify units that are not literal mechanical ports:

- `generated`: regenerate from upstream schema/generator inputs.
- `manual-required`: port by hand because direct translation would be wrong, such as fixed-width numeric behavior.
- `host-native`: replace OS/runtime binding code with the TypeScript/Node host equivalent.
- `out-of-scope`: keep visible as excluded upstream inventory, never scaffold, and never allow active TypeScript source files for that surface.

These policies are explicit debt categories. A unit is never silently excluded from the status report.

## Future Translator Rules

The scaffolder is intentionally conservative: it emits traceable stubs, not guessed translations. The future translator must preserve Go unit IDs and should map Go numeric primitives to `@tsonic/core` types (`int`, `uint`, `int32`, `uint64`, etc.) where the TypeScript port needs fixed-width source-level meaning.
