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

The public `getResolvedCallInfo` query distinguishes ordinary signature calls
from intrinsic-only provider references. An `outcome: "intrinsic"` selection
contains the exact provider reference, not a fabricated callable signature,
result type or execution contract. Selecting it does not check its token inputs
as an ordinary argument list. Selection alone does not make the call valid:
without native elaboration, normal source diagnostics still apply. Shared
parameter/result queries return no ordinary evidence for that selection.

Source extensions register each demand-computed fact with
`registerFactResolver`. Its callback receives the current `source` queries,
read-only `facts`, `factResolver` and diagnostic writer. Source elaboration and
final analysis use this same resolver; attribute roots, selectors and
applications do not have a separate early implementation. A selected fact is
memoized for that source epoch, not proof that the whole program is valid.

Quoted attribute input can select an applicable ordinary call/construction or
an exact provider intrinsic invocation. The shared fact retains its original
source node. An intrinsic has no invented constructor or callable signature;
its target must establish native validity. Without that elaboration, ordinary
source diagnostics still reject it. C# continues to require an applicable
attribute construction, not an intrinsic or an arbitrary function call.

Source reference navigation uses the current program's queries, not a fabricated
finalized program. A forward lookup selects only the requested reference through
the existing shared selector. Reverse lookups and complete statistics demand one
bounded traversal, reusing those selections and preserving source order. Cached
answers cannot outlive their source epoch. Missing references remain missing;
lazy selection does not suppress ordinary diagnostics or prove native validity.

Only the registered owner publishes its result. Nested requests must respect
each owner's declared dependencies. Cycles fail, callback capabilities expire,
and a failed or suspended transaction does not retain provisional facts.
Replaying an elaboration request creates a fresh source epoch; its data-only
answer cannot carry old AST objects into that epoch. Final consumers continue
to read sealed facts without reopening source checking or resolution.

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
