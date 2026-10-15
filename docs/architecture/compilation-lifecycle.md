# Compilation lifecycle

This document describes the approved pipeline and its phase boundaries.
Existing source-storage semantics and bounds remain current. Shared explicit
entry validation and paired immutable family readers are implemented; their
focused gates do not certify the complete workspace. Keel's ownership/result-use
reconstruction and unconditional final gates remain implementation obligations.

The sole workspace policy owner governs native semantics, performance,
absence, identifier preservation and greenfield replacements:

- [Workspace agent policy](workspace-agent-policy.md)

Consider:

```ts
import { statSync } from "node:fs";

export function directory(path: string): boolean {
  return statSync(path).isDirectory();
}
```

## 1. Project collection

The host resolves `tsonic.json`, root files, imported source files, installed
plugins, selected surfaces, and capabilities. The `node:fs` import activates
the installed target-specific Node capability; package installation alone does
not.

## 2. Source compilation

TSTS parses and checks the complete source program plus virtual declarations.
It selects the exact `statSync(string)` signature and `Stats.isDirectory()`
member and retains their source-semantic evidence.

Parsing, binding, narrowing, overload selection and generic inference stay
with that checker. Shared navigation and providers retain its exact identities;
they do not create another checking path or inspect target output for evidence.

### Binary entry contract

The entry module's top-level code is the program on both targets. An exported
function is a declaration, not an implicit invocation. For example:

```ts
export function main(): void {
  console.log("main ran");
}

main();
```

With the JS surface selected, this program prints `main ran` once. A program
with only top-level operations also runs; it need not declare `main`. A binary
entry exporting `main` but never calling that checked declaration rejects with
`TSONIC_UNCALLED_BINARY_ENTRY_MAIN`. Library exports and non-entry modules do
not acquire that binary-entry requirement.

Shared `source-navigation/entry-validation.ts` is the validator owner.
It uses checked declaration/call correspondence, including aliases, rather
than matching the text `main`. Each target consumes the same validation and
its own module-initialization analysis orders imports and top-level work.
Startup planners translate that admitted initialization record; Rust must not
also auto-call the export. Entry migration is Phase 2, not a behavior change
authorized by the mechanical skeleton move.

## 3. Target session

The host creates one explicit target compilation session. The target receives
one immutable target-source program and owns all target-local caches, provider
sessions, analysis state, and diagnostics for that compilation.

Shared closed-source evidence follows that same lifetime. The integer-constant
owner in `target-api/source-semantics/` provides one scoped reader and the scalar
operation over the same engine. Its source graph and literal-reader results
are final and stable: absence means no closed integer value, not pending
inference. A postorder extractor supplies its completed literal facts before
querying ancestors. Cached subtrees retain expanded logical work and relative
height, including repeated DAG edges; reuse never raises the per-root work,
depth or intermediate-magnitude bounds. Only completed successes and refused
roots are retained. Interrupted descendants remain independently queryable.

## 4. Analysis and classification

The selected target maps the source operations to target facts:

- C# selects `Tsonic.CSharp.Node.fs.statSync` and `Stats.IsDirectory` with
  exact CLR carriers.
- Rust selects `tsonic_rust_node` operations with exact Rust result and
  fallibility contracts.

Target analysis closes dependencies and required callable/artifact revisions
before planning. Missing or conflicting facts reject at this boundary.

| Layer | Responsibility before sealing |
| --- | --- |
| `source/` | Checked navigation and source-extension contracts, not native form selection |
| `providers/` | Native metadata acquisition/projection and exact invocation relations, not user-program representation selection |
| `target-model/` | Pure native vocabulary and immutable record shapes, not analyses or decisions |
| `policy/` | Selection for one construct from source evidence and admitted records; unsupported choices are values returned to analysis |
| `analysis/` | Cross-construct storage, ownership, reachability, demand and fallibility; dependency closure; all source admission/rejection; record construction |

These responsibilities are symmetric for C# and Rust. A native-specific
algorithm or lifetime model does not authorize moving the same responsibility
to a planner on one target. Actual target-mandated differences belong to the
architecture register, with their native evidence and pinning tests.

Shared storage queries distinguish logical values from concrete storage
producers. Through `@tsonic/target-api/analysis`, `closedOriginsFor` proves a
logical value domain; `storageProducersFor` selects the exact authored producers
of a concrete declaration's storage ABI. Both use one source-storage owner,
original checked identities, invocation substitutions and finite accounting.
The latter returns immutable typed `producers`, not a certificate about unknown
external input values.

`typeFor` returns the subject's checked storage type; `incomingFor` inventories
its exact immediate edges and rejects locally missing edge evidence. Neither
query proves complete transitive origins or executes the provenance solver.
For example, an external object's member can have an exact checked type while
its physical producer remains unknown. Consumers requiring closed producers
must request the corresponding origin or storage-domain proof. Every query
still validates graph ownership, component identity and the shared finite budget.

For example, a class's readonly callback initializer supplies its original
native field ABI even when a public function accepts that class. The public
parameter's member value remains logically unknown. Its selected concrete
field ABI still survives checked value/return transport. Producer selection
never certifies the logical `closedOriginsFor` domain of that external read,
suppresses an external/opaque writer, or manufactures an initializer for an
ambient or structural-signature member.
Initializer and selected assignment stores include exact structural/computed
member correspondence. Compound stores retain the operation result, not its
right operand. Missing write evidence rejects instead of publishing a partial
producer inventory. Targets must still prove that every contributing producer
has the required native carrier and ownership relationship.

Each source-storage query instance shares one budget with independent checks:
1,048,576 source
nodes, 262,144 edges, 1,048,576 subject rows, 4,194,304 live transport rows and
33,554,432 analysis-work steps. `defaultSourceStorageLimits` and
`createSourceStorageQuery` are exported from `@tsonic/target-api/analysis`.
An explicit selection may tighten these limits, never increase them. Selections
must contain positive safe-integer data fields; executable getters are rejected.
Temporary row owners release only their own reservations. Exhaustion is sticky
and rejects analysis rather than publishing incomplete ownership evidence.
The limits bound compiler analysis, not native value ranges or runtime storage;
raising a ceiling does not allocate that capacity eagerly.

The staged implementation is `model/ -> graph/ -> scoped/ -> transport/` in
construction order, with `queries.ts` the public owner. Imports flow back
toward lower stages only. One shared budget charges every stage and retained
cache. The stage move preserves the public contract and all existing bounds;
it does not approve a larger budget or a second solver.

Detailed responsibilities, persistent identity/invalidation and the mandatory
equivalence/scaling proof are specified separately:

- [Shared source-storage design](source-storage-design.md)

Shared ownership analysis distinguishes retained/transferred values from real
scoped non-owning leases and classifies async result use. Native lifetime and
representation selection remains target-owned. A target-selected temporary
borrow is not authority to invent a source lease. Native discarded async
results, JS discarded-rejection observation and suspended-lease escapes are
decided here before sealing, from exact source/interop evidence:

- [Shared ownership and async result-use contract](ownership-contract.md)

Source-storage solvers and ownership dependency closure may compute within
analysis. A record read after sealing must not trigger that work. Reachability,
move/borrow/clone choice and source rejection consume checked source evidence
before target AST construction; they cannot be recovered by inspecting emitted
clones, variable names or syntax. No pending or partial analysis result is
published as an admitted record.

## 5. Sealed target program

After analysis, the target seals an immutable program containing the complete
facts and queries planning may consume. Planning cannot re-enter source
checking, publish new semantic facts, or reopen providers.

Both targets expose the canonical typed record-family reader:
`program.records.<family>.get(subject)`. Shapes belong to
`target-model/records/`; construction and the private container belong to
`analysis/program/records/`. Policy reads through its `policy/model/` port.
Only analysis may write, and sealing prohibits later mutation. One private
typed generic store may implement those families; direct cross-layer key
access and competing readers are not permitted. The source checker's finalized
extension facts retain their own public identity/query boundary.

## 6. Planning and target AST

Each source owner is planned into target AST nodes and target artifact
requirements. If a public generated contract changes, the artifact dependency
graph marks its users dirty and reconstructs them to a fixed point.

This artifact reconstruction consumes the sealed semantic decisions. A change
requiring new semantic evidence must return to analysis and produce a newly
sealed program; a planner cannot patch the existing record set or reopen a
provider. Planners perform translation, not representation selection, lazy
whole-program analysis or user-source rejection.

The only planner diagnostic is an internal broken-contract report through the
target's invariant helper, `TSONIC_INTERNAL_PLANNER_INVARIANT`. Calling an
ordinary source rejection an invariant does not satisfy the boundary: analysis
must already have admitted the construct and proved its required records.
Target AST normalization is syntactic, not a second ownership/liveness pass.

## 7. Printing

Only the target printer turns target AST nodes into text. Semantic policy does
not live in string templates.

## 8. Publication and native build

The host publishes one complete artifact set atomically. The native toolchain
then compiles that project. A diagnostic at any earlier stage prevents partial
publication.

## Verification of the lifecycle

Proof obligations are paired across targets: top-level-only programs run;
explicit `main()` executes once; uncalled binary exports reject; library
exports remain legal; source failures occur before sealing; missing planner
records are internal failures, not another source-analysis path. Directly
awaited scoped borrows remain admitted, and unsupported discarded/escaping
results get their exact pre-seal diagnostics.

Record tests establish the decisions, native compile/run tests establish the
translated behavior, and architecture checks establish phase/import boundaries.
None substitutes for the others. The skeleton documents and mechanical moves
do not certify acceptance, cost, determinism or resource-scaling gates.
