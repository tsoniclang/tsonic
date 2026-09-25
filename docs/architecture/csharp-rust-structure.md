# C# and Rust source structure

C# and Rust use the same compiler layers. A responsibility has one owner in
both targets; different native algorithms do not justify different layers.
This is a structure contract, not a claim of identical supported features.

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
.NET or Cargo semantic branches. See [compilation lifecycle](compilation-lifecycle.md).

Both target repositories use this source tree:

```text
src/
  index.ts
  public/                 exported compiler and provider SDK entrypoints
  descriptor/             plugin declaration
  options/                validated target configuration
  compilation/            one per-build session and contribution composition
  source/                 checked source navigation and native marker contracts
  providers/
    model/                immutable provider vocabulary
    packages/             installed provider/capability composition
    native/               native metadata acquisition and projection
    runtime/              runtime source references
  target-model/           pure native type/operation vocabulary
  policy/                 target selections over exact source evidence
  analysis/               classifications and the sealed target program
  backend/
    compile.ts            pipeline coordination
    planner/              syntax construction from sealed classifications
    target-ast/           native syntax and normalization
    artifact-model/       complete output descriptions
    emission/             materialization through printers
  print/                  native syntax and project printing
  toolchain/              native build handoff
```

An unused family does not need an empty directory. `index.ts` files are export
barrels, not alternate implementation owners. Internal moves do not change
native symbols or require forwarding files at old paths.

## Responsibility map

Paths below are relative to each target's `src/` directory.

| Responsibility | Canonical owner in both targets | Native detail |
| --- | --- | --- |
| Object classification | `analysis/objects/` | CLR structural views or Rust field/storage proofs |
| Operation policy | `policy/operations/` | Members, operators, pointers and selected source-profile operations |
| JS operation data | `policy/operations/source-profiles/js/` | Native carrier and operation rows remain target-owned |
| Native API metadata | `providers/native/` | .NET reflection versus Rust compiler/rustdoc metadata |
| Metadata projection | `providers/native/projection/` | Native metadata becomes source declarations and target facts |
| Runtime references | `providers/runtime/` | `source-projects.ts` for MSBuild; `source-crates.ts` for Cargo |
| Callable declarations | `backend/planner/declarations/callables/` | Parameters, return types and native callable syntax |
| Class declarations | `backend/planner/declarations/classes/` | CLR class members or Rust struct/impl members |
| Interfaces and enums | `backend/planner/declarations/interfaces/`, `enums/` | Native declaration forms are not interchangeable |
| Binding patterns | `backend/planner/bindings/` | Locals and destructuring, not callable signature policy |

Analysis may need different algorithms. C# selects members and expected types;
Rust also proves ownership, fallibility, lifetimes and layout. Both must seal
those decisions before planning. The planner cannot reopen the checker, create
a provider or select policy. Printing cannot reconstruct semantics.

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
separate source-provider architectures.

## Native runtime source

The responsibilities match, while native project roots remain conventional:

| Family | C# root | Rust root |
| --- | --- | --- |
| Core | `csharp-runtime/src/Tsonic.CSharp.Runtime/` | `rust-runtime/crates/tsonic_rust_runtime/src/` |
| JS | `csharp-js/src/Tsonic.CSharp.Js/` | `rust-js/crates/tsonic_rust_js/src/` |
| Node | `csharp-nodejs/csharp/src/Tsonic.CSharp.Node/` | `rust-nodejs/rust/crates/tsonic_rust_node/src/` |

Group arrays, numeric operations, memory locations, absence, records, closed
values, errors, iteration and resources by responsibility. JS adds strings,
binary data, collections, JSON, Intl, RegExp and asynchronous APIs. Node groups
its native implementations by API module.

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

Target-local adapters supply exact native SDK/model paths and native-only
checks. They do not copy generic rules. Mutation tests exercise the shared
rules and each target's selected adapter.

`test/fixtures/target-parity/` contains shared source-reference inventories.
Their paths must resolve, but a source reference is not executable coverage.
The native runtime public-API reference checks have the same limited meaning.
Only an executed behavioral test establishes the behavior it asserts.

See [test execution](test-execution.md) for resource configuration. Both target
families use the same budget and discovery owners; Cargo, xUnit and Node retain
their own native runners. No universal replacement runner is required.

## Downstream projects

Both Puddings use `native/`, `js/`, `nodejs/` and `workspaces/`. C# additionally
declares `aspnetcore/` as a native-only family. Existing scenario identities,
inputs and assertions remain independent of the directory names.

Both Tsumos already share engine/CLI/test package and source-family structure.
Their native Markdown, image, project and test adapters stay native. A compiler
reorganization does not justify an application rewrite.

## Differences that remain intentional

| Difference | Reason and boundary |
| --- | --- |
| Reflection versus compiler metadata | Different native APIs; both belong under `providers/native/` |
| CLR types versus ownership/trait/lifetime proofs | Different native legality; both are classified before planning |
| Exceptions versus `Result` and ownership-aware control flow | Native runtime mechanisms; no added universal carrier |
| `.csproj`/MSBuild versus Cargo and Rust foundations | Native project controls; the shared host does not interpret them |
| Partial classes versus inherent impl modules | Native source organization; no public API or runtime wrapper change |
| Roslyn syntax versus Rust AST and `rustfmt` | Native syntax/formatting; both consume complete target plans |
| xUnit versus Cargo unit/integration tests | Native discovery and access boundaries; common resource policy |
| ASP.NET/EF versus native crate proof scenarios | Different APIs; common proof result/scenario contract |

Directory similarity is not evidence of feature parity. Missing capabilities
and missing behavioral proofs require their own approved implementation scope.
