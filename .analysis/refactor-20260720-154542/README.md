# Tsonic Refactor Packet

Date: 2026-07-20 15:45 IST
Status: **review packet — no product code changes until this packet is reviewed and accepted.**

## Baseline

| Repository | Branch | Head | Worktree |
|---|---|---|---|
| `tsonic` | `fix/selected-evidence-proof-closure-20260713` | `94b9262b` | clean |
| `tsonic-csharp` | `fix/selected-evidence-proof-closure-20260713` | `24533fcc` | 30 dirty worktree entries (mixed cleanup + dual-fact work; see `04-drift-inventory.md` §WIP) |
| `csharp-nodejs` | `fix/selected-evidence-proof-closure-20260713` | `08fd339b` | 3 modified test files plus one untracked self-symlink |
| `csharp-js` | `fix/selected-evidence-proof-closure-20260713` | `df8a8f90` | 1 untracked self-symlink |
| `csharp-runtime` | `main` | `6e25cee1` | 1 untracked self-symlink |
| `efcore` | `fix/selected-evidence-proof-closure-20260713` | `97f17ce8` | clean |

## Correction Pass

The 2026-07-20 structural review accepted the packet shape and corrected it in
place rather than rewriting it. Material corrections include:

- separating measured source/file counts from public API counts;
- distinguishing valid Layer-3 syntax traversal from semantic-identity
  reconstruction in source-core;
- removing false name-policy findings for explicit `Array.from`/`isArray`
  rows and closed internal `IsN`/`AsN` helpers;
- distinguishing the stale semantic-host cache from correctly compiler-scoped
  memoization and from a non-transactional fact side index;
- retaining the validator-plus-Node-oracle RegExp subset as a sound boundary;
- classifying C# options by actual semantic/provider/toolchain ownership rather
  than deleting every framework/reference input categorically.

Mechanical validation covers all seven files, every intra-packet Markdown
link, 121 explicit repository-path citations, line bounds for 85 cited source
locations, table shape, fence balance, and trailing whitespace. The only
nonexistent cited product test paths are the three stale ledger-evidence paths
that §19 intentionally reports; `docs/architecture` is intentionally absent
because creating it is cleanup step 1.

## What This Packet Is

A single, self-contained plan for the four-layer cleanup of the Tsonic product
family. It was produced by distilling the 2026-07-20 architecture review (the
`readFileSync` layer trace, the four-layer placement model, and the 20-class
cross-repository drift audit) and then checking the cited contracts against
the current worktrees. Counts in this packet use the executable or exported
product model where one exists; source-text counts are labeled only as
repository-size observations.

This packet is **not** architecture authority. `.analysis/` is gitignored
(`.gitignore:18`), and one of the findings here is that ignored documents must
never claim live authority (`04-drift-inventory.md` §1). On acceptance, the
canonical architecture moves to tracked `docs/architecture/**`; this packet
remains the historical review record.

## Files

1. [`01-canonical-four-layer-architecture.md`](01-canonical-four-layer-architecture.md)
   — the governing layer model: what each layer owns, dependency and evidence
   direction, the full `readFileSync` trace, the feature-placement procedure,
   and the sound foundations that must be retained.
2. [`02-feature-inventory.md`](02-feature-inventory.md)
   — the mechanical inventory method (one connected feature graph, ten node
   kinds, no ledger-only shortcuts) and the verified current snapshot with
   reproducible count commands.
3. [`03-layer-conformance-matrix.md`](03-layer-conformance-matrix.md)
   — per-feature conformance verdicts against the four layers, with the drift
   reference for every non-conformant row.
4. [`04-drift-inventory.md`](04-drift-inventory.md)
   — the source-backed inventory of 20 confirmed drift classes with file:line
   evidence, the TSTS contract-gap register (37 issues), and the current-WIP
   hazard. Cleanup step 1 supplies the mechanical exhaustiveness proof.
5. [`05-cleanup-plan.md`](05-cleanup-plan.md)
   — the ordered, no-dual-path repair plan: one WIP-triage step plus ten
   numbered cleanup steps, each with owner layer, exact deletions, and an exit
   gate. Feature work stays paused until step 10.
6. [`06-tests-scanners-acceptance.md`](06-tests-scanners-acceptance.md)
   — the proof contract per layer, the machine-readable ledger evidence
   schema, scanner requirements, and the acceptance checklist.

## Review Protocol

- Review in file order. `01` is this packet's proposed baseline against which
  the other files are measured; reject or amend it first, since everything
  downstream re-derives. It becomes authority only after promotion into the
  tracked `docs/architecture/**` contract.
- Every count in `02` names the exact command that produced it; reproduce
  before trusting.
- Every drift claim in `04` names file:line evidence. Dispute by pointing at
  the same evidence, not by summary disagreement.
- Acceptance means: `01` becomes the source for tracked
  `docs/architecture/**`, and `05` becomes the execution order. Rejection of
  any step sends the whole packet back — the steps are load-bearing on each
  other.

## Non-Goals For This Packet

- No product code changes.
- No new features, no Proof Pudding work, no performance work.
- No reconciliation with `.analysis/consolidated-final-architecture-20260626`
  beyond recording its retirement (drift §1).
