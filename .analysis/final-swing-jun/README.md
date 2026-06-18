# Final Swing Plan — June

This directory is the execution plan for the TSTS-backed Tsonic frontend migration. It is written as the plan for the new branch `feature/final-swing-jun`.

The work has one product goal:

```text
Tsonic consumes TSTS as its TypeScript compiler substrate, adds Tsonic source-language facts through a generic extension model, lowers those facts into backend-ready plans, and removes the permanent TypeScript compiler API frontend.
```

The work has three non-negotiable constraints:

```text
No C#, CLR, .NET, or backend-rendering facts in TSTS core or the Tsonic source frontend.
No long-term dual frontend path, compatibility shim, legacy manifest bridge, or fallback TypeScript compiler API path.
No user-visible source workaround for compiler limitations; the compiler or extension model must carry the semantics.
```

## Document Set

Read these in order:

1. `01-end-state-architecture.md` — final architecture and ownership boundaries.
2. `02-current-to-target-map.md` — what changes from the current frontend/IR stack.
3. `03-module-plan.md` — concrete modules/packages/files to add or reshape.
4. `04-phase-order-and-work-items.md` — implementation order, dependencies, and acceptance gates.
5. `05-example-walkthroughs.md` — source-level examples from TS source to TSTS AST, facts, lowering, and C# emission.
6. `06-testing-and-validation.md` — required tests, downstream gates, and deletion gates.
7. `07-risk-register-and-guardrails.md` — risks, banned shortcuts, and automated guardrails.
8. `08-definition-of-done.md` — final completion criteria.
9. `09-current-frontend-inventory.md` — inspected current Tsonic frontend ownership, counts, and final disposition.
10. `10-exhaustive-ownership-contract.md` — comprehensive owner table for every semantic domain.
11. `11-public-tsts-api-contract.md` — exact public TSTS APIs Tsonic may consume.
12. `12-deletion-and-enforcement-ledger.md` — deletion ledger, migration gates, and forbidden dual-path checks.
13. `16-old-lowering-removal-audit-2026-06-17.md` — fresh audit of old type-projection/lowering/emitter semantic paths that must be removed.

## Execution Shape

The migration should be done in large, coherent vertical slices. The right sequence is:

```text
1. Lock the TSTS embedding/extension contract.
2. Add a frontend-provider abstraction around the current frontend.
3. Add TSTS adapter and Tsonic extension facts.
4. Build AST-backed lowering plans.
5. Migrate semantic domains one by one.
6. Delete the old TypeScript compiler API path.
7. Run full Tsonic and downstream validation.
```

The final product must look like a single architecture, not a TSTS path bolted beside the old one.

## Immediate Branch State

The branch should begin with:

```text
base: main
branch: feature/final-swing-jun
first change: this plan only
next change after plan review: frontend-provider seam
```

No implementation should start until the plan in this directory is internally consistent.

## Canonical Status

This directory is the canonical final-swing spec. Older `.analysis/tsts-tsonic-integration-plan/` material is historical context only and must not be used to justify a weaker boundary.
