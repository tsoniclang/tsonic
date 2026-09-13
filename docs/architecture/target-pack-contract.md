# Target-pack contract

A target pack is a plugin that contributes one target id, source profile,
optional surfaces, runtime references, target analysis, artifact planning,
printing, and toolchain integration.

## Shared outer shape

```text
Target pack
├── descriptor and strict options
├── immutable starter-project descriptor
├── source profile and surfaces
├── compilation session
├── analysis and target facts
├── sealed target program
├── artifact planner
├── target AST
├── printer
└── native project/toolchain integration
```

C# and Rust retain this shape. Their inner algorithms differ:

- C# analysis closes expected target types, provider selections, conversions,
  object shapes, call signatures, and native project requirements.
- Rust analysis closes ownership, borrows, lifetimes, fallibility, layouts,
  generic requirements, provider operations, and Cargo requirements.

Those are different facts inside the same architectural phase, not different
architectures.

Targets obtain TypeScript structural member correspondence through the public
[source member query](structural-member-correspondence.md). Native option
construction and ownership remain target decisions; targets do not match source
property names themselves.

## Source layout

Both target repositories use the same outer source directories:

```text
src/
├── index.ts                 public plugin entry
├── public/                  target and provider SDK exports
├── descriptor/              plugin description and starter projects
├── compilation/             per-build session and composition
├── options/                 strict target option contracts
├── source/                  native source profile and virtual declarations
├── providers/               native metadata and packaged capabilities
├── target-model/            closed native semantic vocabulary
├── policy/                  native selection rules
├── analysis/                classification and sealed target program
├── backend/
│   ├── compile.ts           stage coordination
│   ├── target-ast/          native syntax nodes and structural operations
│   ├── artifact-model/      complete output-plan contracts
│   ├── planner/             syntax construction from sealed facts
│   └── emission/            materialize complete output plans
├── print/
│   ├── source/              native source printer
│   └── project/             native project printer
└── toolchain/               native build handoff
```

Within a layer, group a responsibility in one subtree. For example,
`backend/planner/objects/object-literals/` owns object-literal planning;
the expression dispatcher calls it rather than owning a second implementation.
File names and inner algorithms can differ where the native responsibilities
differ. C# reflection member readers do not need Rust lifetime-reader twins.

The shared layer contract in
`test/architecture/tooling/target-layer-contract.mjs` defines allowed imports.
Each target classifies its files against that contract. A legal import graph
is necessary, but does not prove that an operation preserved its semantics.

For example, this call selects an ordinary imported native method:

```ts
return probe.is_some() === false;
```

Rust must emit `!probe.is_some()`, not invent an `is_none()` call. A native
Option presence test may use `is_none()`, but only when its exact Option
identity has already been proved and retained in the target AST. The printer
spells a selected operation; it does not recover identity from method names.

## Starter boundary

An official target may expose one pure starter-project function from its
plugin. Given an already-validated project name, it returns target options,
build/start/check scripts, authored starter files, and declarative native
toolchain checks. The generic creator validates the complete result before it
writes anything into the requested destination.

The host does not choose source, native commands, SDK versions, assembly names,
or crate names for a target. Starter creation does not run target analysis and
does not create a second compilation path.

## Planning boundary

Planning may query:

- immutable source syntax and source navigation;
- finalized TSTS evidence;
- the sealed target program;
- exact target provider relations;
- artifact dependency contracts.

Planning may not:

- re-enter the checker;
- infer semantic identity from names or emitted text;
- mutate target analysis;
- reopen provider discovery;
- fall back to runtime reflection or dynamic invocation.

## Artifact revisions

Target artifacts expose public and implementation facets. If analysis later
strengthens a public requirement, such as a Rust generic bound or a C# object
shape adapter, every exact dependent is reconsidered. A failed revision may
remain internally for rollback but cannot be emitted as successful output.

## Toolchain ownership

The target may generate a native project or emit sources for a user-owned
project. Open-ended native settings remain in `.csproj` or `Cargo.toml`; the
generic host never grows target-specific configuration branches.

## Proof alignment

`csharp-pudding` and `rust-pudding` describe their checks in
`scripts/verify/scenarios.json`. A shared scenario ID means the same declared
bounded contract, not identical project contents or proof strength. Native-only
and unpaired assertions
remain explicit. For example, both suites check calculator addition, while
an ASP.NET server and a Rust lifetime signature have separate contracts.

From `csharp-pudding`, inspect those declarations without compiling projects:

```sh
node scripts/verify-all.mjs --scenarios --peer ../rust-pudding
```

This checks project coverage, source anchors and declared pairs. It does not
run the assertions. The complete `bash scripts/verify-all.sh` gate writes
`.tests/verify-*/scenarios.json` alongside its report. That artifact records
source hashes and project execution results. A compiled library with no
executed caller remains compile-only, even when its Cargo or .NET build passes.
