# tsgo-suite profiling

Two composable tools to measure *where TSTS spends time* and *how it compares to
the pinned native `tsgo` and official `tsc`* — so the cost of running a Go
compiler ported to TypeScript-on-Node is quantified, and the recoverable
JS-emulation overhead (the part a native Tsonic→C# build would erase) is isolated.

## `bench.mjs` — cross-compiler benchmark

Runs TSTS, `tsgo`, and `tsc` on the same projects with `--extendedDiagnostics`
(all three expose it) and reports per-phase time + memory side by side with
`TSTS÷tsgo` and `TSTS÷tsc` ratios.

```bash
node packages/tsts/tools/profiling/bench.mjs --corpus corpus.json [--runs 3] [--profile] [--json]
```

- **corpus**: `--corpus <file>` or a `corpus.json` next to the harness. See
  `corpus.example.json`. Each project: `{ name, cwd (abs dir), args }`; the
  harness appends `--extendedDiagnostics`. Use modern-config projects
  (`target >= ES2015`, `module esnext/nodenext`) so `tsgo`/TSTS support them.
- **`--runs N`**: N runs per compiler; the cold first run is dropped, the rest
  median-aggregated.
- **`--profile`**: also capture a TSTS CPU + heap profile per project and run the
  attributor (below) — one command for "compare *and* explain".
- **Compiler paths**: TSTS dist CLI is computed; override `tsgo` via `TSGO_BIN`
  (default `/tmp/tsgo`), `tsc` via `TSC_BIN` (default `node_modules/.bin/tsc`).
  Build `tsgo`: `go build -C packages/tsts/_vendor/typescript-go -o /tmp/tsgo ./cmd/tsgo`.

Memory is captured externally via `/usr/bin/time -v` (maxRSS) — TSTS's own
`--extendedDiagnostics` reports `Memory used: 0K` because the memory fields live
in the **porter-tracked** `internal/execute/tsc/statistics.ts` (Go populates them
from `runtime.MemStats`). Populating them from `process.memoryUsage()` is a
deliberate host divergence from the Go port and is left for maintainer approval;
maxRSS gives the comparison in the meantime.

## `self-compile-bench.mjs` — mandatory whole-program benchmark

Runs the built TSTS compiler and official `tsc` against TSTS itself:

```bash
npx tsc -p packages/tsts/tsconfig.json
npm run profile:self
```

The command compiles `packages/tsts/tsconfig.json --noEmit` with
`--extendedDiagnostics`, drops the cold first run, and reports warm-run median
phase time, wall time, and maxRSS. This is the mandatory whole-program benchmark
for changes to compiler hot paths. Popular-project corpus runs remain useful,
but they depend on machine-local checkout paths and belong in `profile:bench`.

## `attribute.mjs` — cost-category attribution

Aggregates a V8 CPU profile (`.cpuprofile`, self-time) and/or heap profile
(`.heapprofile`, allocation bytes) into named cost buckets and reports the
**RECOVERABLE** share — the JS-emulation tax a native build erases.

```bash
node --cpu-prof  --cpu-prof-dir=. --cpu-prof-name=p.cpuprofile  <tsts-cli> <args>
node --heap-prof --heap-prof-dir=. --heap-prof-name=p.heapprofile <tsts-cli> <args>
node packages/tsts/tools/profiling/attribute.mjs --cpu p.cpuprofile --heap p.heapprofile --label TSTS
```

Categories: `utf8-conv` (Go UTF-8 bytes emulated on UTF-16 JS strings),
`value-key` (Go struct map keys serialized to strings), `gc`, `ast-build`
(per-node `{} as T` + 22-closure adapter), `go-runtime`, then phase buckets
`scanner/parser/binder/checker/emit`, and `other`. The first five are
`RECOVERABLE` (value structs, `byte[]`/`Span`, `Dictionary<struct,V>` in C#).

It runs on **both** TSTS's and `tsgo`'s profiles (Corsa also emits v8 cpuprofiles),
so you can compare bucket-for-bucket. The **heap** profile matters: the dominant
cost (per-node allocation) shows up as `gc` in the CPU profile, but as the actual
allocation *sites* (`ast-build`, arena, tuples) in the heap profile.

## What it shows today (baseline)
- Per-phase: **Parse ~90–220× tsgo** (UTF-8 conversion), **Check ~45×**, Bind ~14×; maxRSS ~12–16× tsgo.
- Attribution: **~70–80% of TSTS's time is recoverable JS-emulation tax**
  (zod: gc 30% + utf8 25% + ast-build 7% + value-key 6%); the real type-checking
  is ~10–20%. This sizes each native-C# opportunity and is a regression gate.

Outputs go to `.tests/profiling/` (gitignored). `corpus.json` is gitignored
(machine paths); commit changes to `corpus.example.json` instead.

## `utf8-bench.mjs` — focused source-text benchmark

Measures the exact UTF-8/UTF-16 bridge optimized in the source-text hot path.
It compares the current built TSTS helpers against legacy-equivalent
`TextEncoder`/`TextDecoder` implementations on large ASCII and mixed-Unicode
source strings:

```bash
npx tsc -p packages/tsts/tsconfig.json
npm run profile:utf8
```

Cases include repeated byte-length queries, rune decoding by byte offset,
`SplitLines`, `UTF16Len`, and case-insensitive comparison. This is a stable
micro-regression gate for the JS/.NET-compatible UTF-16 source-text direction;
whole-project cost still belongs to `profile:bench --profile`.

## `scanner-bench.mjs` — scanner hot-path benchmark

Measures the built scanner directly on large ASCII, mixed-Unicode, and JSX
source strings:

```bash
npx tsc -p packages/tsts/tsconfig.json
npm run profile:scanner
```

This is the focused gate for scanner-local source-text cache changes. It checks
token count and checksum stability across runs, then reports median scan time
and tokens/ms. Whole-program validation still belongs to `profile:self`; this
microbenchmark exists so a scanner-only optimization is not justified solely by
helper-level UTF-8 timings.
