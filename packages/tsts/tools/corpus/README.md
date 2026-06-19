# TSTS Corpus AST Parity

This tooling compares TSTS parser output against the pinned TS-Go parser on real
world projects without vendoring those projects into the repository.

The checked-in source of truth is `packages/tsts/corpus/realworld.json`: project
repository URLs, exact commits, and file-selection policy. `corpus:setup` clones
or fetches those commits into `.temp/corpus/repos`, and `corpus:ast` parses the
same files with both compilers and compares a canonical AST representation.

The gate is intentionally AST-first. Byte-identical JavaScript output can miss
type-syntax and parser-shape drift because TypeScript emit erases most types.
AST parity catches that class of drift directly.

## Commands

```sh
npm run corpus:setup
npm run corpus:ast
```

Useful development filters:

```sh
node packages/tsts/tools/corpus/ast-parity.mjs ast --project zod --limit 25
node packages/tsts/tools/corpus/ast-parity.mjs ast --project zod --file src/index.ts
```

## What Is Compared

For each selected source file, the tool compares:

- `Kind` numeric value and string name.
- `Loc.Pos`, `Loc.End`, and `Flags`.
- Literal/text-bearing node text and raw template text where applicable.
- Child node order as exposed by the TS-Go/TSTS `ForEachChild` AST contract.
- JSDoc child trees returned by the source-file JSDoc cache.
- Parse, JS, and JSDoc diagnostic code/position/end triples.
- SourceFile metadata that is part of the parse result: script kind,
  declaration-file flag, non-ASCII flag, and top-level counters.

The comparison is source-level parser parity. It does not replace the TS-Go
suite or porter validation; it adds real-world AST coverage before release.

## TS-Go Helper

The Go helper source lives in `tools/corpus/tsgo-ast-dump/main.go`, but it is
materialized into `.temp/corpus/tsgo-build/<key>/cmd/tsts-ast-dump` before
building. That is required by Go `internal` import rules because the helper must
import `github.com/microsoft/typescript-go/internal/parser` and related
packages from the pinned TS-Go module.

The build cache key includes the pinned TS-Go commit and the helper source hash.
When TS-Go is bumped, the helper is rebuilt against that exact upstream commit.
