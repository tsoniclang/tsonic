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
