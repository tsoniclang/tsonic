# Shared source-storage design

Source storage is target-neutral analysis of the checked program. It records
logical values, concrete storage producers, invocation substitutions and exact
member correspondence. It does not select native carriers or reconstruct the
checker. C# and Rust consume the same public query contract.

## Status and scope

The public queries and limits below describe the existing implementation.
The staged paths are the approved Phase 1 placement; that move changes imports,
not query answers, public signatures, resource accounting or assertions.
The persistent-key redesign, equivalence harness and scaling gates are Phase 3
implementation obligations, not completed verification claims.

This document owns the storage-specific design. Workspace engineering,
ownership, absence and performance policy remains in its canonical owner:

- [Workspace agent policy](workspace-agent-policy.md)

## Public boundary

`@tsonic/target-api/analysis` exports `createSourceStorageQuery`,
`SourceStorageQueries`, `SourceStorageLimits`, `SourceStorageEffects` and
`defaultSourceStorageLimits`. Construction retains this signature:

```ts
createSourceStorageQuery(source, sourceFiles, limits = defaultSourceStorageLimits, effects = {})
```

The query belongs to one `TargetSourceProgram` and one set of checked source
files. Subjects, declarations, bindings and projections from another query or
program cannot certify an answer. `SourceStorageEffects` supplies selected call
effects; it is not authority to assert an unproved native retention guarantee.

| Query | Establishes | Does not establish |
| --- | --- | --- |
| `subjectFor`, `storageSubjectFor`, `memberSubjectFor` | A checked, graph-owned subject and exact component projection | Native ownership or a closed producer domain |
| `typeFor` | The subject's checked component type and source file | Complete transitive origins |
| `incomingFor` | Exact immediate incoming edges, rejecting locally missing evidence | Transitive provenance or native storage compatibility |
| `closedOriginsFor` | A complete logical value domain, an open domain with boundaries, or unresolved evidence | A native ABI for unknown external values |
| `storageProducersFor` | Typed concrete producers with their invocation bindings, preserving open boundaries | Closure of an external member's logical value domain |
| `invocationImplementationsFor`, `bindingsForInvocation`, `argumentTransportsFor` | Checked implementation selection and formal-to-actual correspondence | A retained owner or suspension-aware liveness |
| `executionRegionsFor` | Callable execution regions, including relevant initializer regions | Proof that an `await` can become pending |

For example, a readonly callback initializer can supply its class field's
concrete storage ABI while the value read through a public parameter remains
logically open. A complete producer answer must not close that external value
domain. Initializer and assignment stores use checked structural/computed
member correspondence; compound stores describe the operation result, not
merely the right operand. Opaque writers and missing store evidence remain
explicit. The target separately proves each producer's native representation.

## Stages and dependencies

All paths below are relative to
`packages/target-api/src/target-analysis/source-storage/`.

| Stage | Responsibilities | Representative owners |
| --- | --- | --- |
| `model/` | Subjects, projections, checked types, construction vocabulary and the resource budget | `subjects.ts`, `types.ts`, `resource-budget.ts`, `structural-flow.ts` |
| `graph/` | Exact edges, lexical/execution regions, component/location relations, graph indexes and context footprints | `edges.ts`, `execution-regions.ts`, `context-footprints.ts`, `key-encoding.ts` |
| `scoped/` | Bound applications, activation scopes, substitutions, recursion and context-sensitive equations | `context-applications.ts`, `scoped-keys.ts`, `scoped-recursion.ts`, `substitutions.ts` |
| `transport/` | Invocation-result transport and complete logical/storage domain assembly | `invocation-results.ts`, `transport.ts`, `domain-inputs.ts`, `domains.ts` |
| `queries.ts` | Query construction, graph/context ownership validation and the public typed readers | `createSourceStorageQuery` |

Dependencies point toward lower stages:

```text
queries -> transport -> scoped -> graph -> model
```

A module may depend on its own stage or any lower stage; the complete graph
must remain acyclic. No lower stage imports the public reader or an upper
stage. Imports, re-exports and inline `import(...)` type queries all count.
The architecture check AC8 enforces this boundary. Neither target may import
private stages to obtain a second storage algorithm.

## Persistent identity and exact invalidation

The Phase 3 rebuild removes repeated construction and encoding of equivalent
scoped keys and repeated footprint traversal. It must preserve the following
data distinctions, using the existing checked identities and scoped model:

- The query/program owner and canonical subject, including its component path.
- The selected operation or query kind: logical values and storage producers
  are not interchangeable domains.
- The exact callable/application, actual substitutions, activation and lexical
  storage location where those affect the answer.
- Relevant input ports and location dependencies from the context footprint.
- Open boundaries, unresolved reasons and recursive/in-progress state.

Persistent here means retained for this query's lifetime, not disk persistence
of checker handles or a process-global cache. A canonical context can share
an immutable key, footprint or completed answer only when the dependency
evidence proves equivalence. Source names, output text, object shape and
unverified hash equality cannot establish that equivalence.

An immutable checked source snapshot permits reuse without invalidation for
unchanged dependencies. If construction extends a scoped equation, selected
effect or application dependency, affected memoized answers must be invalidated
or distinguished by that exact dependency revision before reuse. An incomplete
key, recursion marker or partial domain is never published as a completed
answer. Querying a different program, source revision or effect configuration
creates a separate owner. Budget exhaustion cannot be cached as a successful
empty domain.

This is one representation and one query owner, not a cached fast path beside
an old solver. Replace superseded encoding/traversal work within the owning
stages; preserve justified cycle detection and exact structural correspondence.

## One bounded resource owner

`model/resource-budget.ts` owns one `SourceStorageBudget` per public query.
All stages share it; a cache, new index or ownership consumer cannot install
a separate unlimited allowance.

| Limit | Current default |
| --- | --- |
| `maximumNodes` | 1,048,576 |
| `maximumEdges` | 262,144 |
| `maximumSubjectRows` | 1,048,576 |
| `maximumTransportRows` | 4,194,304 |
| `maximumSteps` | 33,554,432 |

An explicit selection contains positive safe-integer data fields no larger
than their defaults. Getter-backed selections reject without execution.
Selections may tighten limits, not increase them. These bounds govern compiler
analysis, not native integer widths or native runtime capacity.

Every retained index, key, footprint, memo and binding view must have accounted
rows; every traversal must charge work. Temporary reservations release only
their own rows. Retained reservations remain charged while live. Failure is
sticky across the query: freeing rows does not admit later results after
exhaustion. Existing node, edge, subject and transport-row checks remain
independent. Phase 1 preserves their implementation and defaults exactly;
Phase 3 improves the algorithm rather than granting hidden larger ceilings.

## Equivalence and safety proof

The Phase 3 harness records every public query call over the passing B0 bank
on both targets, including its subject, bindings, selected operation and answer.
Compare logical identities by the same checked source correspondence, not
object addresses from separate compiler sessions. Normalize unordered result
sets only where the API declares them unordered; preserve ordered projections
and argument transports.

Existing successful answers must remain equivalent, including checked types,
producer bindings, open boundaries and identity relationships. A former
budget-only unresolved result may become complete only when the new solver
proves it within the same limits. A missing premise, opaque writer or unfinished
cycle cannot become complete merely because caching reduced the work count.

Required positive and negative cases include aliases; optional/computed members;
accessors and inherited members; generic/mapped substitutions; distinct
activations; recursive contexts; equivalent keys versus different location
owners; and logical-domain versus concrete-producer queries. Exercise foreign
subjects/bindings, invalid projections, unfinished encodings and every independent
budget. Repeated queries must not expose stale results, create unaccounted
memo rows or evade sticky failure. Preserve all existing assertions.

## Scaling and acceptance gates

Measure two genuinely nested source closures per target:
`engine` within `cli`, and `engine` within `tests`. Use the same pins, compiler
configuration and resource measurement method. For each nested pair, require:

```text
work(closure) / work(engine) <= 1.25 * nodes(closure) / nodes(engine)
peakRows(closure) / peakRows(engine) <= 1.25 * nodes(closure) / nodes(engine)
```

These are measured gates for those acceptance chains, not a universal claim
that arbitrary specialization graphs grow linearly. Non-nested small subsets
do not prove either relationship. Report the actual node count, charged work,
peak live rows, elapsed time and peak frontend RSS for every measurement.

The approved frontend time ceilings are 120 seconds per C# Tsumo package and
81.8 / 95.8 / 133.3 seconds for Rust engine / cli / tests respectively. Each
frontend must remain at or below 4 GiB peak RSS, with process-group guards
separately enforcing aggregate resource bounds. Both Tsumos must compile;
the Express C# native-construction proof and Rust storage-reason blockers must
be resolved without weakening their evidence requirements.

The earlier failed runs' work and row counts are lower bounds, not complete
capacity requirements. Passing equivalence alone does not pass scaling, and
recording a missed threshold does not waive it. No storage or performance
certification is established by this design document.
