# Porter as a change-tracking tool — findings, approach, and review

Status: landed hardening. Covers (1) how an upstream-delta is computed today, (2) the
measured delta from our pin to current `main`, (3) a full review of whether the
porter is geared to track upstream changes, (4) the one completeness hardening
shipped on this branch, and (5) the real latent incoherence that hardening
immediately surfaced and this branch reconciles. Policy lens throughout, per maintainer direction:
**never miss a real change; false positives are free; prefer simplicity.**

---

## 0. TL;DR

- The porter is an **airtight completeness ledger** for "am I still in exact sync
  with the pinned TS-Go source?" — `verify --strict-port` cannot pass with any
  stale / missing / orphan / duplicate / untracked unit or any generated-artifact
  drift. Behavioural change lives in func/method bodies, type defs, and const
  values, all of which are SHA-256 hashed per unit; nothing behavioural slips by.
- It is **not** a bump-*planner*: it has no "delta vs a candidate rev" mode, no
  per-unit diff, and no stale re-port / re-stamp assist. Those are ergonomic gaps,
  not completeness gaps — under the policy lens they do not matter and are
  deliberately **not** built.
- The delta to current `main` (285 commits / ~7 weeks) is **~610 real unit-actions**
  out of ~9,200 in-scope (~6.6%), concentrated in the checker — a normal batched
  bump. The scary raw "463 missing / 45 orphan" is >half phantom (a new
  host-native watch library + moves).
- There **was** exactly one place a real change could hide behind a green gate:
  the AST schema dir holds verbatim copies of source files, validated against the
  *copies*, never against live source. This branch closes it with a byte-sync
  check.
- That check immediately caught a **real pre-existing incoherence**: the schema
  copy of `symbolflags.go` is pinned ahead of the source pin, and the AST
  generator baked the newer symbol-merge masks into `generated/flags.ts`. Runtime
  is unaffected (the binder uses the hand-ported `ast/symbolflags.ts`), but the
  generated duplicate disagreed with its source. This branch reconciles the schema
  copy and regenerated AST artifacts so the primary porter gates can stay green.

---

## 1. Context

- **Pin:** TS-Go submodule at `515d036f` (2026-04-24).
- **Upstream `main`:** `c78d39e7` (2026-06-12) — **285 commits / ~7 weeks ahead**.
- The port is ~13.6k catalogued units; ~9.2k in-scope (the rest excluded:
  LS / lsp / api / project / format / tests). Each in-scope unit carries a
  `@tsgo-unit` header with the SHA-256 `sigHash`/`bodyHash` of its Go source at
  port time.

## 2. How an upstream delta is computed today

The porter has **no dedicated bump/delta command** — but its comparison engine is
already rev-agnostic. `buildStatus()` simply reconciles "Go units at
`config.sourceRoot`" against "`@tsgo-unit` hashes in our TS source." Nothing pins
`sourceRoot` to the current checkout except a config string. So the delta was
produced by pointing that engine at a new rev:

1. `git fetch` in the submodule (objects only; no checkout moved).
2. `git worktree add --detach <new-rev>` — materialise the new tree beside the pin.
3. A ~40-line driver (`.analysis/porter-delta/delta.mjs`): load `porter.config.json`,
   override `sourceRoot` → the worktree, call the exported `runScan` (hash Go units
   at the new rev) + `scanTsUnits` (our pin-time header hashes) + `buildStatus`.

Output was validated against ground truth by hand (fswatch is real-and-new;
nodeflags drift is real; `isJSDocTypedefTag` genuinely gone). **The capability to
track across revs already exists; only a convenience flag is missing.**

### How "current inventory" is known
No stored database — the **source files are the inventory**. `scanTsUnits()` walks
`packages/tsts/src` on every run, regex-extracts every `@tsgo-unit {…}` header, and
that reconstructed set is "what we have + which Go hash each was ported against."
The Go side is likewise re-extracted fresh each run. It is fresh-vs-fresh
reconciliation every time; there is no cache to go stale. A ported unit missing its
header → its Go unit shows `missing` (flagged); a file that should carry headers but
has none → `untracked` (flagged).

## 3. The measured delta (pin → `c78d39e7`)

| Bucket | Raw | Real (phantoms removed) |
|---|---:|---|
| implemented (hashes match) | 8,797 | — no work |
| **stale** (sig/body drift) | 395 | 395 to review |
| **missing** (new Go units) | 463 | **193** |
| **orphan** (gone upstream) | 45 | **~21** |
| excluded (out-of-scope) | 16,281 | — |
| parse errors | 0 | — |

Phantom reconciliation:
- **270 of 463 "missing"** are one new module — `internal/fswatch`, a vendored
  fsnotify fork (Linux fanotify, macOS FSEvents, debounce) used only by
  `execute/watcher` + `lsp`. Host-native, same class as `vfs/vfswatch` (already
  out-of-scope). It **replaces** `vfswatch`, which accounts for **16 of the 45
  orphans**. → the entire watch story is a host-native swap = a config policy line,
  ~0 port work.
- **8 more orphans** are scanner unicode/identifier helpers **moved** to a new
  `internal/stringutil/identifier.go` + generated tables — a relocation, not a
  deletion (pairs with ~20 stringutil "missing").
- **~21 genuine** helper deletions/inlines (`isJSDocTypedefTag`,
  `getSetAccessorValueParameter` ×2, etc.).

Stale concentration: checker **174**, transformers 62, tsoptions 23, printer 22,
parser 20, scanner 18, … (checker is where TS's type-system fixes land).

**stale ≠ effort.** A unit flags on any AST-structural drift. Example from
`checker.go`: `getNarrowedTypeOfSymbol`'s whole change is `(core.IfElse(…))` →
`core.IfElse(…)` (a paren removal) — flagged, ~0 work; while right beside it,
genuinely new `addDiagnostic`/`addSuggestionDiagnostic` guarding recursion depth
is a real port. Total checker churn over the window: 21 files, +1,595/−467.

Generated-artifact delta: diagnostics catalog **0 new codes** (2,153=2,153, regen
≈ no-op); `nodeflags.go` +6 lines (small AST regen); bundled libs no new files.

**Real work ≈ 395 stale (mostly trivial) + 193 missing + ~21 cleanup ≈ ~610
unit-actions**, well-localised in the checker. A normal batched bump — days, not a
re-port.

## 4. Is the porter geared to track changes? (review)

Engine: a Go extractor (`go-extractor/main.go`) hashes every unit as **SHA-256 over
`go/printer`-canonicalised AST** (sig = signature; body = full decl), walking **all
`.go` files regardless of build tags** (platform variants covered). The Node driver
compares against `@tsgo-unit` header hashes. `verify --strict-port` fails on any
stale / missing (strict) / orphan / duplicate Go|TS ID / untracked|forbidden TS
file / generated-artifact drift, and enforces stub/throw discipline.

### Strengths (keep)
1. **Hard completeness gate** — cannot pass with unaddressed drift.
2. **Canonical-AST hashing** — pure gofmt/whitespace reflow does not false-flag.
3. **All-build-tag scan** — platform files tracked, not dropped.
4. Scope-policy engine; generated-artifact content-hashing; scaffold for new units;
   iota/const-value resolution.

### Gaps — and how they rank under "never miss / FP-free / simple"
Most gaps are **false-positive reduction or ergonomics** → explicitly *not worth
building*; leaving them out keeps the tool simpler, and over-reporting is the safe
direction:
- **Move/rename detection** — a move = orphan + missing = both flagged. No miss.
- **ID fragility** (path-embedded IDs; constGroup ID = concatenation of all member
  names, so adding one flag re-IDs the group) — produces orphan+missing pairs. Noise.
- **Comment quirk** — empirically the body hash drops inline comments (a
  behaviourally-inert blind spot) and includes-but-mis-positions doc comments
  (doc-only edits over-report). No behavioural miss.
- **No per-unit diff / no `delta --against` command / honor-system re-stamp** —
  ergonomics + a process rule (verify-clean is never trusted alone; always paired
  with the byte-exact corpus gate).

**Genuine completeness risks** (the only ones that matter under the lens):
- **(a) Schema-dir copies can silently lag live source.** The AST schema inputs
  (`schema/tsgo/{nodeflags,symbolflags}.go`, `ast.json`, `ast.schema.json`) are
  hand-copied and pinned on a *separate* track; `verify` checks generated artifacts
  against those copies, not against live source. Diagnostics and bundled-lib checks
  already read live source, so the AST schema is the lone exception. **→ closed on
  this branch (§5).**
- **(b) Corpus discovery must stay dynamic.** Verified: `discoverCases()` walks the
  testdata tree (`walkFiles`) with no frozen manifest, so new upstream cases
  auto-run byte-exact against their new baselines. New behaviour cannot be silently
  skipped. Must never regress to a static list.

Acknowledged inherent blind spots (not worth fixing): compat-layer/facade drift
(`go/*.ts` is authored, not ported — surfaces later as a port/compile error); no
per-unit source-rev provenance; pure behavioural const-value ripple referenced by
name (rare; caught by baselines).

**Bottom line:** for completeness the porter is sound — behavioural changes live in
hashed unit bodies; the strict gate forces every one to be addressed; the corpus
gate independently re-checks behaviour against dynamically-discovered new baselines.
The missing half is planning/assist, which the policy lens says not to build.

## 5. The hardening shipped (this branch)

`feat/porter-schema-source-sync-check` (commit `d0934b0a`).

`buildSchemaSourceSyncStatus(config)`: for each declared `{schema, source}` pair,
assert the schema-dir copy is byte-identical (CRLF-normalised) to its live source
file under `config.sourceRoot`; fail `verify` on any mismatch. Config-driven
(`schemaSourceSyncChecks`), so new copies are covered without code. Surfaced in
`printStatus` and `collectVerifyFailures`. The same check also gates `porter:ast`
before check or write mode, so generated AST artifacts cannot be trusted or
rewritten from a schema directory that disagrees with the checked-out source pin.
Bias toward over-reporting (any byte difference fails) per policy.

The sync list covers every schema-directory input with a live vendored upstream
counterpart: `ast.json`, `ast.schema.json`, `protocol.ts`, `nodeflags.go`, and
`symbolflags.go`.

This closes risk (a): the schema pin can no longer silently lag the source pin.

## 6. The incoherence the check immediately caught and reconciled

Running it on the current pin flagged **1 mismatch: `symbolflags.go`** — a real,
pre-existing issue that was sitting behind a green gate:

- `schema/tsgo/symbolflags.go` is pinned **ahead** (`879968116c`, May 20) of the
  source submodule (`515d036f`, Apr 24). The only content difference across that
  range is `symbolflags.go`'s symbol-merge exclusion masks, e.g.
  `GetAccessorExcludes = Value & ^SetAccessor` (source) →
  `Value & ^(SetAccessor | Property)` (schema).
- The AST generator consumes `schema/tsgo/symbolflags.go`, so it baked the newer
  masks into `generated/flags.ts` (`SymbolFlagsPropertyExcludes = 13243`, etc.).
- **But the live binder imports the masks from the hand-ported
  `ast/symbolflags.ts`** (`@tsgo-unit` at `515d036f`, `Value & ~Property`), not from
  `generated/flags.ts`. So **runtime behaviour is correct** for the pin (consistent
  with the full suite passing) — the generated file is a **divergent duplicate**.

This is exactly the never-miss value of the new check: a generated type-system
constant that disagrees with its source, with no active runtime symptom, now made
impossible to miss.

### Resolution applied on this branch

The schema copy of `symbolflags.go` has been brought back to the checked-out
`515d036f` source pin, `schema/tsgo/VERSION.md` now records that pin and the
matching SHA, and `porter:ast --write --force` regenerated the AST artifacts. The
generated `SymbolFlags*Excludes` values now match the hand-ported live-source
semantics used by the binder.

## 7. Recommendations / next steps

1. **Merge only with porter hygiene green.** This branch is intended to carry both
   the sync check and the `symbolflags` reconciliation so main never knowingly
   contains a red primary porter gate.
2. **Schedule the pin bump soon.** 7 weeks / 285 commits is on the high side; each
   delay grows the stale count and baseline drift, and Tsonic-TSTS landing is a
   forcing function to stay near TS 7.0 head. Real surface is ~610 well-localised
   units; budget a few focused days.
3. **Optional, low priority** (ergonomics only; skip unless a bump proves painful):
   a `porter delta --against <rev>` wrapper around the existing engine (the
   `.analysis` driver is a working prototype). Not a completeness need.

## Appendix — verification artifacts

- Delta driver + full lists: `.analysis/porter-delta/` (gitignored working area).
- New-rev worktree: `.analysis/porter-delta/tsgo-c78d39e7` (detached; pin untouched).
- Gate results on the memory-fixed dist (prior task, for context): submodule
  compiler 7,275/7,275 and conformance 7,694/7,694, 0 failures; peak RSS 2.26 GB.
- This branch: the expected final gate state is `porter:test`, `porter:ast`, and
  `porter:verify` green, with `Schema/source sync mismatches: 0`.
