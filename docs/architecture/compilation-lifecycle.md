# Compilation lifecycle

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

## 3. Target session

The host creates one explicit target compilation session. The target receives
one immutable target-source program and owns all target-local caches, provider
sessions, analysis state, and diagnostics for that compilation.

## 4. Analysis and classification

The selected target maps the source operations to target facts:

- C# selects `Tsonic.CSharp.Node.fs.statSync` and `Stats.IsDirectory` with
  exact CLR carriers.
- Rust selects `tsonic_rust_node` operations with exact Rust result and
  fallibility contracts.

Target analysis closes dependencies and required callable/artifact revisions
before planning. Missing or conflicting facts reject at this boundary.

## 5. Sealed target program

After analysis, the target seals an immutable program containing the complete
facts and queries planning may consume. Planning cannot re-enter source
checking, publish new semantic facts, or reopen providers.

## 6. Planning and target AST

Each source owner is planned into target AST nodes and target artifact
requirements. If a public generated contract changes, the artifact dependency
graph marks its users dirty and reconstructs them to a fixed point.

## 7. Printing

Only the target printer turns target AST nodes into text. Semantic policy does
not live in string templates.

## 8. Publication and native build

The host publishes one complete artifact set atomically. The native toolchain
then compiles that project. A diagnostic at any earlier stage prevents partial
publication.
