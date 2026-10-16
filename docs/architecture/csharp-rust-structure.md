# C# and Rust source structure

C# and Rust use the same compiler layers. A responsibility has one owner in
both targets; different native algorithms do not justify different layers.
This is a structure contract, not a claim of identical supported features.

The skeleton checkpoint establishes the destination below. Phase 1 performs
layer-legal moves and typed-reader migration without changing behavior.
Phase 3 replaces mixed owners and cross-layer semantic reconstruction in those
same slots. A destination or approved contract is not a completed implementation
or certification claim. Workspace rules remain in `workspace-agent-policy.md`.

## Target pipeline

```text
host-owned compilation session
  -> source and provider evidence
  -> target policy and analysis
  -> sealed target program
  -> planner: native AST and complete artifact plan
  -> printer and materializer
  -> host publication and native toolchain
```

The shared host selects and composes plugins. It does not contain C#, Rust,
.NET or Cargo semantic branches.

## Layer contract

| Layer | Owns | Boundary |
| --- | --- | --- |
| `source/` | Checked navigation, marker contracts and source extensions | No native-form selection |
| `providers/` | Native metadata acquisition, projection, relations and package composition | No choice of user-code representation |
| `target-model/` | Pure native vocabulary, carriers, record interfaces, names and lifetimes | No semantic decisions or dependency on another compiler layer |
| `policy/` | One construct's native form from exact source evidence and frozen policy ports | No cross-construct propagation, program worklist or source diagnostic; return unsupported as a value |
| `analysis/` | Cross-construct storage, ownership, reachability, demand, fallibility, all source admission and sealed-program construction | Invoke policy for individual native-form choices |
| `backend/planner/` | Native AST/artifact construction from sealed decisions | No new selection, lazy proof construction, source rejection or semantic inspection of generated syntax |
| `backend/target-ast/` | Native syntax and purely syntactic normalization | No dataflow-driven move, clone, liveness or dead-code decision |
| `print/`, `toolchain/` | Native printing and build handoff | No reconstructed source semantics |

Classify by checked dependencies, reads, writes, callers and traversal scope.
A `select`/`choose` prefix cannot determine whether a function is a per-construct
selector or whole-program analysis. A finite traversal closing one input differs
from propagation over dependent source constructs.

Both target repositories use this source tree:

```text
src/
  index.ts
  public/                 exported compiler and provider SDK entrypoints
  descriptor/             plugin declaration
  options/                validated target configuration
  compilation/            one per-build session and contribution composition
  source/
    extension/            native marker declarations and checked identities
    profiles/             selected source-profile evidence
  providers/
    builtins/             declared native baseline packages
    model/                immutable provider vocabulary
    packages/             installed provider/capability composition
    native/
      model/              immutable native metadata
      acquisition/        reflection or compiler/rustdoc acquisition
      projection/         native metadata to checked source declarations/facts
      relations/          exact native/source declaration correspondence
    runtime/              runtime source references
  target-model/
    configuration/ conversions/ identities/ metadata/ names/ operations/
    project/ records/ syntax/ types/
    types/carriers/       native carrier vocabulary and explicit registry
    lifetimes/            Rust lifetime vocabulary
    foundation/           Rust core/alloc/std vocabulary
  policy/
    model/                frozen policy-input port
    identities/ constraints/ conversions/ ownership/
    operations/
      collections/ control-flow/ flow/ iteration/ js-values/ members/
      numeric/ operators/ pointers/ resources/ safety/ source-profiles/
      strings/ syntax/ typed-locations/
    types/
      callables/ collections/ model/ objects/ project/ resolution/ storage/
      conditional-numeric-carrier.ts
  analysis/
    program/records/      one records container and construction boundary
    callables/ control-flow/ conversions/ declarations/ expected-types/
    module-initialization/ names/ numeric/ objects/ operations/ project/
    project-types/ safety/ source-evidence/ source-modules/ storage/
    attributes/           C# CLR attribute classification
    ownership/ errors/ reachability/ foundation/
                          native Rust responsibilities; register below
  backend/
    compile.ts            pipeline coordination
    planner/
      artifacts/ bindings/ declarations/ expressions/ names/ objects/
      program/ project/ safety/ statements/ types/
      foundation/         Rust foundation imports/verification
    target-ast/
      syntax/             native AST nodes and syntactic helpers
      normalization/      syntax-only normalization
    artifact-model/       complete output descriptions
    emission/             materialization through printers
  print/                  native syntax and project printing
  toolchain/              native build handoff
```

An unused family does not need an empty directory. `index.ts` files are export
barrels, not alternate implementation owners. Internal moves do not change
native symbols or require forwarding files at old paths.

File-versus-folder shape can differ only where it implements the same named
responsibility: `analysis/project-types/catalog`,
`providers/packages/validation` and `print/source/expressions` are the recorded
cases. This does not permit a same-named implementation file beside a competing
implementation directory. Native organization is not a general exception for
one-sided owners or invented extra layers.

## Responsibility map

Paths below are relative to each target's `src/` directory.

| Responsibility | Canonical owner in both targets | Native detail |
| --- | --- | --- |
| Object classification | `analysis/objects/` | CLR structural views or Rust field/storage proofs |
| Contextual/expected types | `analysis/expected-types/` | Both targets reconcile checked callable/expression contexts; local native carrier choice stays in policy |
| Source evidence | `analysis/source-evidence/` | Exact checked identities and refinements; not native selection |
| Operation policy | `policy/operations/` | Members, operators, pointers and selected source-profile operations |
| Native handler policy | `policy/operations/pointers/native-handlers.ts` | Native adapters pass payloads to the shared `target-api/target-analysis/native-handlers.ts` root and pointer-priority owners |
| Native handler publication | `analysis/operations/native-handlers.ts`, `target-model/records/native-handlers.ts` | Finalizers select once over the full checked storage-node domain and publish immutable chosen-payload descriptors before sealing |
| Native handler rendering | `backend/planner/expressions/` | Root dispatch reads `records.nativeHandler` once; selected renderers receive its payload without re-probing native candidates |
| JS operation data | `policy/operations/source-profiles/js/` | Native carrier and operation rows remain target-owned |
| Native API metadata | `providers/native/` | .NET reflection versus Rust compiler/rustdoc metadata |
| Metadata acquisition | `providers/native/acquisition/` | Native acquisition protocols belong here, not in projection or policy |
| Metadata projection | `providers/native/projection/` | Native metadata becomes source declarations and target facts |
| Runtime references | `providers/runtime/` | `source-projects.ts` for MSBuild; `source-crates.ts` for Cargo |
| Callable declarations | `backend/planner/declarations/callables/` | Parameters, return types and native callable syntax |
| Class declarations | `backend/planner/declarations/classes/` | CLR class members or Rust struct/impl members |
| Interfaces and enums | `backend/planner/declarations/interfaces/`, `enums/` | Native declaration forms are not interchangeable |
| Binding patterns | `backend/planner/bindings/` | Locals and destructuring, not callable signature policy |
| Generic naming contexts | `backend/planner/names/type-parameters.ts` | Exact binder identities select generated names; type syntax stays under `types/` |

Analysis may need different native proofs. Both targets analyze expected types,
member use and source admission. Rust additionally requires explicit lifetime,
borrow, fallibility and foundation evidence. These decisions are sealed before
planning; already-built lifetime indexes are legitimate immutable readers,
not lazy analysis merely because their method is called `resolve` or `canMove`.

## Skeletal moves and producer replacement

| Responsibility | Phase 1 destination | Phase 3 work |
| --- | --- | --- |
| Native acquisition | Both `providers/native/acquisition/`; C# reflection, Rust protocol/snapshot/rustdoc | Keep acquisition separate from native-form decisions |
| Metadata projection and relations | C# declarations/modules under `projection/`, relation indexes under `native/relations/` | Extract Rust provider identity corroboration from mixed policy code; do not import policy context into providers |
| Source extensions | Rust `source/semantics/` becomes `source/extension/` | Preserve exact marker identity and native lifetime declarations |
| Policy families | C# JS-value operations under `operations/js-values/`; conversions flattened; Rust safety under `operations/safety/` and identities under `identities/` | Split cross-construct proof from local native choice by checked responsibility |
| Rust type policy | All 25 former flat files assigned to the `types/` families above or the owning operations/constraints/conversions family; numeric conditional stays at the root | Do not move mixed selectors solely because of their names |
| Project analysis | Rust runtime contribution assembly becomes `analysis/project/` | Keep resource/ABI proofs with their owning analysis family |
| Records | Pure interfaces under `target-model/records/`; typed readers and construction under `analysis/program/records/` | Complete one producer owner per family before sealing |
| Native syntax | C# Roslyn-shaped nodes and Rust root node helpers under `backend/target-ast/syntax/` | Remove semantic generated-AST inspection; retain syntax-only helpers |
| C# construction demand | No illegal mechanical move | Rebuild the policy-imported worklist under `analysis/objects/` with a frozen input port |
| Rust ownership and reachability | No illegal move of planner-dependent implementations | Replace cross-layer generated-name reasoning with source-identity analysis and sealed records |
| Contextual-type analysis | Existing bodies retained until responsibilities are split | Both targets' cross-context inference belongs under `analysis/expected-types/` |

Only Rust's omitted-argument and runtime-callable-generic contract selectors can
move mechanically from `analysis/operations/provider/calls/` to
`policy/types/callables/`. Other mixed selection/proof implementations require
decomposition first. C# demand and Rust planner-dependent liveness likewise
cannot be made layer-legal by a directory rename.

## One sealed-records transport

Both targets expose `program.records.<family>.get(subject)`. Record interfaces
are pure vocabulary under `target-model/records/`; policy reads them through
its `policy/model/` port. The records container and writers live under
`analysis/program/records/`. Construction uses the single family writer API
inside analysis only; sealing forbids later mutation or semantic computation.

The reader is a typed lookup, not a second semantic path. For example,
`records.runtimeCarrier.get(node)` and `records.targetOperation.get(node)` read
the decisions already produced for exact source subjects. Missing required
evidence is a pre-seal admission failure, not a request for planner fallback.
Planner defects use the owning target's single invariant helper and
`TSONIC_INTERNAL_PLANNER_INVARIANT`, not a second source-admission path.

Private typed generic storage is permitted behind the family API. Preserve
source identity, equality/conflict checking, specialization and foundation-demand
accounting. Key access does not escape the construction/storage owner; banning
an implementation data structure is not the architectural objective. Shared
TSTS extension facts remain source evidence, not target records.

Phase 1 migrates readers without changing facts or decisions. Phase 3 removes
competing or computing owners and gives every family one producer. An immutable
lookup over a previously completed lifetime/shape index need not be replaced
with recomputation or an unnecessary new index.

## Shared analysis stages

The shared target API remains target-neutral:

```text
packages/target-api/src/
  source-navigation/      checked navigation, entry and result-use evidence
  source-semantics/ source-packages/ source-profiles/
  target/ target-artifacts/ public/
  target-analysis/
    error-storage/       neutral error/storage relationships
    ownership/           neutral retained/transferred/scoped-borrowed evidence
    source-storage/
      model/             vocabulary and construction inputs
      graph/             local graph, keys, footprints and projections
      scoped/            context applications, substitutions and reachability
      transport/         invocation/domain result transport
      queries.ts         one public reader
```

Stage dependencies stay within their stage or point to an earlier stage in
`model`, `graph`, `scoped`, `transport`, `queries` order; the checked module graph
must remain acyclic. Staging is the Phase 1 move; query equivalence and the
algorithmic storage/scaling correction are Phase 3 work. The public storage
reader and resource-accounting owner remain singular.

The target ASTs remain native: C# uses Roslyn-shaped nodes and Rust uses Rust
nodes. Rust formatting belongs to `rustfmt`; the compiler does not implement
a competing layout engine.

## Node capability providers

Both Node packages use this ownership model:

```text
nodejs/src/
  index.ts                public exports
  capability.ts           installed-plugin entrypoint
  provider/
    package.ts            one public target-SDK factory call
    model/                immutable package-wide vocabulary
    declarations/         reusable declaration construction
    assembly/             native package assembly, when needed
    modules/
      process/            declarations and module-specific data
      filesystem/         calls, path operations and other cohesive parts
      ...
```

A small single-part module can remain `modules/path.ts`. A module with several
parts has one directory, not a file beside a same-named directory. Module
carriers belong to their module, not a growing package-wide `model.ts`.

`package.ts` composes modules; it does not author their declarations. The target
SDK owns provider transport, identity rebasing and registration. A capability
must not recreate these. Immutable model files cannot depend on declaration
builders or module assembly. Module data cannot import package assembly.

C#'s relation indexes/runtime contributions and Rust's carrier/fallibility/
borrow rows retain their native contracts. These data differences are not
separate source-provider architectures. The skeleton places both composers at
`assembly/modules.ts` for module assembly and `declarations/specifiers.ts` for
public specifier ownership; modules own their declarations and operation data.

At the skeleton fork, both registries expose the following canonical families:
`assert`, `buffer`, `child_process`, `crypto`, `dns`, `dns/promises`, `events`,
`fs`, `fs/promises`, `http`, `https`, `net`, `os`, `path`, `process`, `readline`,
`stream`, `timers`, `tls`, `url`, `util`, `v8`, `worker_threads` and `zlib`.
Rust also exposes `perf_hooks`; C# exposure is missing. Named exports,
signatures and native capability coverage still differ: equal registry owners
or family counts do not establish API parity.

`perf_hooks`, differing native import subpaths and other actual API gaps are
capability work, not target-mandated architecture exceptions. Preserve reachable
native implementations and their tests, including direct fetch, SQLite, cluster
and punycode users. Rust's private `sync.rs` is a synchronization dependency,
not an absent Node module. Missing provider exposure never proves dead code.

## Native runtime source

The responsibilities match, while native project roots remain conventional:

| Family | C# root | Rust root |
| --- | --- | --- |
| Core | `csharp-runtime/src/Tsonic.CSharp.Runtime/` | `rust-runtime/crates/tsonic_rust_runtime/src/` |
| JS | `csharp-js/src/Tsonic.CSharp.Js/` | `rust-js/crates/tsonic_rust_js/src/` |
| Node | `csharp-nodejs/csharp/src/Tsonic.CSharp.Node/` | `rust-nodejs/rust/crates/tsonic_rust_node/src/` |

The following tables assign native responsibilities without changing public
names. Paths are relative to the native roots above. Rust `.rs` means that
module and its private children; CLR family folders do not define namespaces.

### Core runtime families

| Family | C# implementation | Rust implementation |
| --- | --- | --- |
| Absence | `Absence/OptionalStorage.cs` | `optional_storage.rs` |
| Arrays | `Arrays/` | Native `Vec`/slice operations and `raw_memory/array.rs` for explicit layout-backed storage |
| Asynchronous | `Asynchronous/TaskCompletion.cs`, native .NET scheduler | `async_runtime.rs`, `dispatch.rs`, `dispatch_queue.rs`, `ordered_dispatch.rs`, `timer_queue.rs` |
| Callables | `Callables/TsFunction.cs`, native delegates | `callable.rs`, `frame_callable.rs`, `frame_callable_family.rs` |
| Errors | `Errors/` | `error.rs`, `retained_error.rs` |
| Iteration | `Iteration/` | `iteration.rs`, `generator/` |
| Memory | `Memory/` | `location/`, `raw_memory/mod.rs` |
| Numeric | `Numeric/` | `bigint.rs`, `numeric.rs`, `operators.rs`, `conversions/` |
| Records | `Records/` | `field.rs`, `record.rs`, `record_field.rs` |
| Resources | `Resources/ResourceStacks.cs` | Resource/finally completion in `control_flow.rs`, native drop/disposal contracts |
| Values | `Values/`, native reference/value identity | `empty_object.rs`, `ts_value.rs`, `object_handle.rs`, `object_identity.rs`, `object_ref.rs`, `module_cell.rs`, `source_string.rs`, `reachability.rs` |

`lib.rs`, crate features and public re-exports compose these owners; they are
not additional algorithm families. Core dispatch must be generic. The fork's
Rust `DispatchPhase` still contains Node domains; replacing them with generic
registration is Phase 3 work. Node resources and phase identities do not belong
in either core runtime.

### JS runtime families

| Family | C# implementation | Rust implementation |
| --- | --- | --- |
| Arrays | `Arrays/` | `array/` |
| Asynchronous | `Asynchronous/` | `event_loop.rs`, `promise_jobs.rs`, `promise.rs`, `promise/`, `timers.rs`, `timers/` |
| Binary | `Binary/` | `array_buffer/`, `atomics.rs`, `data_view.rs`, `typed_array/` |
| Collections | `Collections/` | `map.rs`, `set.rs`, `weak_collections.rs` |
| Errors | `Errors/SyntaxError.cs`, core Error types | `errors.rs`, core Error types |
| Intl | `Intl/` | `intl/` |
| Json | `Json/` | `json.rs` |
| Numeric | `Numeric/`, `Boolean.cs` | `bigint.rs`, `boolean.rs`, `math.rs`, `number/`, `numeric.rs`, `native_integer.rs` |
| Objects | `Objects/`, `Symbol.cs` | `object/`, `value/`, `equality.rs`, `symbol.rs` |
| Properties | `Properties/AssemblyInfo.cs` | Native Rust crate/export declarations in `lib.rs`; no CLR assembly metadata |
| RegExp | `RegExp/` | `regexp/` |
| Strings | `Strings/`, `Globals.String.cs` | `string.rs`, `js_string.rs`, `exact_string.rs`, `string_capacity.rs`, `string_number.rs`, `uri.rs` |
| Global/native composition | `Globals.cs`, `GlobalUsings.cs`, `Date.cs`, `console.cs` | `abi.rs`, `globals.rs`, `date/`, `console.rs`, `wrappers.rs`, `web/`; `lib.rs` composes modules |

Rust's `web/` contains public native platform APIs. Its presence is not proof
of a C# counterpart or a target-mandated exception. Audit actual APIs before
claiming feature parity; retain reachable native code. A responsibility may
use a native system API rather than a manufactured runtime helper.

C# paths do not define CLR namespaces. C# files can therefore move into these
families without changing native APIs. Rust module declarations do define the
native API: a multi-part module uses `family/mod.rs` and private child modules;
a cohesive public module can stay `family.rs`. Do not add umbrella modules,
public aliases or `#[path]` indirection merely to imitate CLR folders.

Split a large implementation only at real ownership boundaries. For example,
array callback algorithms can live in a C# partial class or Rust inherent-impl
child while storage remains in the parent. Neither changes dispatch, allocation
or the public method. Coherent overload tables and upstream-maintained RegExp
engines are not arbitrary numbered fragments.

The event-loop contract owns eager execution, deferred reactions, resource
liveness, finite admission and shutdown. Node implementations register their
own phases through generic dispatch. The core/runtime organization must not
create two schedulers or separate old/new Promise representations.

## Tests and executable enforcement

Target test domains are shared:

```text
test/
  analysis/ architecture/ backend/ integration/ policy/
  providers/native/ source/ target-model/ toolchain/
  fixtures/ helpers/
```

Node provider tests use `nodejs/test/{architecture,providers,integration}/`.
Native tests retain xUnit or Cargo conventions and group by the corresponding
runtime responsibility. Rust tests embedded in their owning module stay there:
moving private implementation tests into external integration crates changes
their access boundary.

The common enforcement owners are in the host:

- `test/architecture/tooling/target-layer-contract.mjs`: layer dependency graph,
  source rules, canonical families and target test domains.
- `test/architecture/tooling/node-provider-contract.mjs`: provider ownership,
  public SDK boundary, module reachability, imports and barrel rules.
- `test/scripts/node-test-files.mjs`: sorted recursive Node test discovery.
- `test/scripts/bounded-run.sh`: resource bounds and complete-run logging.
- `test/scripts/proof-scenarios.mjs`: Pudding scenario contracts and workspace
  families.
- `test/architecture/tooling/keel-*.mjs`: Keel responsibility, record-boundary,
  syntax, family and staged-import enforcement added at the skeleton checkpoint.

Target-local adapters supply exact native SDK/model paths and native-only
checks. They do not copy generic rules. Mutation tests exercise the shared
rules and each target's selected adapter.

`test/fixtures/target-parity/` contains shared source-reference inventories.
Their paths must resolve, but a source reference is not executable coverage.
The native runtime public-API reference checks have the same limited meaning.
Only an executed behavioral test establishes the behavior it asserts.

Both target families use the same budget and discovery owners; Cargo, xUnit and
Node retain their native runners. Checked dependency/call evidence establishes
layer roles; declaration names discover candidates only. Record writers must
stay in analysis, planners consume sealed readers, AST normalization stays
syntactic, staged storage imports stay one-way, and core packages have no Node
domains. The integrated architecture inventory may shrink but not hide new
violations. Final certification requires no outstanding violations; a reviewed
inventory during reconstruction is not a final waiver.

## Downstream projects

Both Puddings use `native/`, `js/`, `nodejs/` and `workspaces/`. C# additionally
declares `aspnetcore/` as a native-only family. Existing scenario identities,
inputs and assertions remain independent of the directory names.

Both Tsumos already share engine/CLI/test package and source-family structure.
Their native Markdown, image, project and test adapters stay native. A compiler
reorganization does not justify an application rewrite.

## Native difference register

These entries record native constraints, not convenient implementation choices.
The evidence paths are exact inspected owners; paired executable/structural
tests must pin each boundary before final certification. An existing API gap
or a missing implementation cannot be entered here as a native impossibility.

| ID | Difference | Native evidence and constrained owner |
| --- | --- | --- |
| S11-01 | Metadata acquisition | C# `providers/native/acquisition/` reflects .NET assemblies; Rust's same owner acquires rustc/rustdoc declarations. Both project and correlate metadata through the same provider responsibilities |
| S11-02 | CLR custom attributes versus Rust source admission | C# `analysis/attributes/` selects actual CLR metadata. Rust's existing checked marker path (`mapRustSourceMarkerCall` then `recordPolicySelection`) rejects CLR attribute requests before seal with `RUST_SOURCE_MARKER_UNSUPPORTED`; Rust macro authoring remains outside this PR |
| S11-03 | Explicit lifetime/ownership records | Rust `target-model/lifetimes/` and `analysis/ownership/` establish native borrow legality. C# native references/value storage have no equivalent Rust lifetime parameter. Shared source retention/lease evidence remains symmetric |
| S11-04 | Result completion and error regions | Rust `control_flow.rs::Completion` and `finish_finally`, plus target `analysis/errors/`; C# uses native exceptions and `Resources/ResourceStacks.cs`. JS boundaries still preserve the same reason/identity contract |
| S11-05 | Rust foundations | Rust runtime `lib.rs` selects core/alloc/std feature boundaries; `target-model/foundation/`, `analysis/foundation/`, `backend/planner/foundation/` express those native constraints. C# uses .NET reference assemblies, not fabricated Rust feature layers |
| S11-06 | Native completion driver | Rust `async_runtime.rs::block_on` explicitly polls a pinned native Future; C# `Asynchronous/TaskCompletion.cs` composes native Tasks. The JS loop lifecycle and ordering contract is identical |
| S11-07 | Source/project organization | CLR partial classes and assembly metadata versus Rust module/impl visibility and crate exports; `.csproj`/MSBuild versus Cargo. Native public paths remain unchanged |
| S11-08 | Syntax/printing | C# `backend/target-ast/syntax/` uses Roslyn-shaped syntax; Rust uses Rust nodes and `rustfmt`. Both translate sealed plans; no semantic cleanup in either printer |
| S11-09 | Native tests and proof APIs | xUnit versus Cargo unit/integration visibility; ASP.NET/EF versus explicit native crate proofs. Shared test responsibilities, source fixtures and resource guards remain paired |
| S11-10 | Private-item reachability | Rust's selected native warning gate (`test/helpers/cargo-projects.mjs`, Clippy `-D warnings`) and native item/lint rules govern generated-item admission under `analysis/reachability/`. C# does not have that Rust item/lint boundary; neither planner reconstructs program reachability |
| S11-11 | Native const-generic array extent | Rust `[T; N]` includes the exact `usize` constant in its native type; CLR `T[]` has no const-generic extent parameter. Rust `target-model/types/carriers/native.ts::rustFixedArrayTargetType` preserves the const argument and `backend/planner/types/render.ts` renders it as a native fixed array. C# keeps exact selected layout extents separately from its array type; `NativeArray<T>` is strided runtime storage on both targets, not a replacement for `[T; N]`. The paired carrier owner tests pin exact extents and the strict registry test pins this difference |
| S11-12 | Native trait-associated type projections | Rust `rust-runtime/crates/tsonic_rust_runtime/src/field.rs::Field` declares `type Output`; `target-model/types/carriers/indexed-fields.ts` represents the trait bound and `<Owner as Field<Key>>::Output` with the exact owner, key and associated name. CLR interfaces have no native associated-type member or Rust projection syntax. C# does not acquire a phantom associated-type carrier; the Rust carrier owner tests pin the native projection and missing native evidence remains a strict parity error |

Expected-type analysis is deliberately absent from this difference register:
both targets already perform it. Rust's checked callable-context reconciliation
must be re-homed by responsibility, not treated as a reason to omit its matching
`analysis/expected-types/` slot. Sealed lifetime reads likewise do not justify a
backend analysis exception.

### Surface contract differences

| ID | Explicit boundary | Required pinning coverage |
| --- | --- | --- |
| V-01 | Native Rust UTF-8 versus C# UTF-16 units; exact Rust UTF-16 is explicit | Multibyte/emoji length and offset cases; native and selected surface paths |
| V-02 | Native Rust `Result` versus C# exception transport | Existing Error identity and primitive/string reason across package boundaries |
| V-03 | Selected native numeric widths, ranges and overflow | Exact integer boundaries above 2^53 and native promotion; never a JS-only admission cap |
| V-04 | Settled await is inline; Promise reactions remain deferred | Same ordering programs on both targets and Node, with only the registered settled-await difference |
| V-05 | An explicitly imported native API has no target counterpart | Exact native declaration/compile evidence; not a shared-capability or architecture waiver |
| V-06 | Reporting for stored, never-observed rejected Promises remains follow-up work | Discarded-call rejection/exit-1 tests plus a stored-unobserved control; no global registry inferred |

Directory similarity is not evidence of feature parity. Missing capabilities
and missing behavioral proofs require their own approved implementation scope.

## Related contracts

- [Compilation lifecycle](compilation-lifecycle.md)
- [JavaScript event loop](event-loop-contract.md)
- [Provider and runtime ownership](provider-and-runtime-ownership.md)
- [Workspace agent policy](workspace-agent-policy.md)
- [Test execution](test-execution.md)
