# Tsonic Engineering Specifications

**For contributors working on the Tsonic compiler.**

This directory contains engineering specifications and internal architecture documentation. If you're looking to **use** Tsonic, see the [user documentation](../docs/index.md) instead.

---

## Contract Specifications

These define the interfaces and guarantees between compiler phases:

- **[bindings.md](bindings.md)** - `.bindings.json` schema for name transformation tracking
- **[metadata.md](metadata.md)** - `.metadata.json` schema for CLR-specific information
- **[dependency-graph.md](dependency-graph.md)** - Dependency analysis output format
- **[validation.md](validation.md)** - Validation rules and diagnostic codes
- **[runtime-contract.md](runtime-contract.md)** - Runtime asset loading and type roots

---

## Architecture Documentation

Detailed internal design of each compiler phase:

- **[architecture/README.md](architecture/README.md)** - How to read architecture docs
- **[architecture/00-overview.md](architecture/00-overview.md)** - Compiler principles, state management
- **[architecture/01-pipeline-flow.md](architecture/01-pipeline-flow.md)** - Phase sequence and data flow
- **[architecture/02-phase-program.md](architecture/02-phase-program.md)** - TypeScript Program creation
- **[architecture/03-phase-resolver.md](architecture/03-phase-resolver.md)** - Module resolution internals
- **[architecture/04-phase-validation.md](architecture/04-phase-validation.md)** - Validation passes
- **[architecture/05-phase-ir.md](architecture/05-phase-ir.md)** - IR structures and builder
- **[architecture/06-phase-analysis.md](architecture/06-phase-analysis.md)** - Dependency graph and symbol linking
- **[architecture/07-phase-emitter.md](architecture/07-phase-emitter.md)** - C# code generation
- **[architecture/08-phase-backend.md](architecture/08-phase-backend.md)** - .NET compilation
- **[architecture/09-phase-runtime.md](architecture/09-phase-runtime.md)** - Runtime packaging
- **[architecture/10-cli-orchestration.md](architecture/10-cli-orchestration.md)** - CLI command flow
- **[architecture/11-diagnostics-flow.md](architecture/11-diagnostics-flow.md)** - Error reporting system
- **[architecture/12-call-graphs.md](architecture/12-call-graphs.md)** - Detailed call chains
- **[architecture/13-renaming.md](architecture/13-renaming.md)** - Name transformation infrastructure

---

## Appendices

Deep-dive topics:

- **[appendices/implementation-plan.md](appendices/implementation-plan.md)** - 10-phase development roadmap
- **[appendices/generics-deep-dive.md](appendices/generics-deep-dive.md)** - Generic implementation details

---

## Legacy Specifications

The following files are being migrated to the new structure:

- `overview.md`, `architecture.md`, `module-resolution.md` → Split between docs/ and spec/architecture/
- `code-generation.md` → `architecture/07-phase-emitter.md`
- `cli.md` → `docs/cli.md` (user) + `architecture/10-cli-orchestration.md` (engineering)
- `diagnostics.md` → `docs/diagnostics.md` (user) + `architecture/11-diagnostics-flow.md` (engineering)

See `.analysis/restructure-mapping.md` for complete migration tracking.

---

## For Users

If you're looking to use Tsonic (not contribute to it), see:

- **[User Documentation](../docs/index.md)** - Getting started, CLI, language guide
- **[Examples](../docs/examples/index.md)** - Code examples
- **[Troubleshooting](../docs/troubleshooting.md)** - Common issues

---

## Contributing

When contributing to Tsonic:

1. Read [CLAUDE.md](../CLAUDE.md) for coding guidelines
2. Read [CODING-STANDARDS.md](../CODING-STANDARDS.md) for functional programming patterns
3. Review the relevant architecture docs for the area you're working on
4. Follow the phase-based organization when adding features
