# Compiler model

Tsonic is a source-to-source compiler, not a JavaScript runtime and not a
bytecode virtual machine.

Consider:

```ts
import { List } from "@tsonic/dotnet/System.Collections.Generic.js";
import type { int } from "@tsonic/csharp/types.js";

export function count(): int {
  const values = new List<int>();
  values.Add(42);
  return values.Count;
}
```

The compilation stages are:

1. **TSTS source semantics.** TSTS parses and checks the TypeScript program. It
   selects the exact virtual `List<int>` constructor, `Add(int)` method, and
   `Count` property and retains those checker decisions.
2. **Tsonic orchestration.** The host collects the project, composes installed
   target and capability plugins, and creates one checked source program.
3. **Target analysis.** The C# target maps selected source declarations and
   types to exact C# carriers and operations. It does not select members by the
   spelling `Add` or `Count`.
4. **Target planning.** The target creates a C# AST and target project artifact
   graph.
5. **Printing and publication.** Only the C# printer creates C# text. Tsonic
   atomically publishes the complete target output after every required
   artifact resolves.
6. **Native build.** `dotnet` compiles the generated C# project.

The equivalent Rust pipeline has the same high-level boxes. Its analysis owns
Rust-specific representation, ownership, fallibility, lifetime, and Cargo
decisions; its planner creates a Rust AST; Cargo owns the native build.

## Exact evidence instead of reconstruction

For this call:

```ts
declare function convert(value: int32): string;
convert(1);
```

the target receives the selected call, signature, parameter, argument, and
result evidence. It does not ask a later checker query to infer the call again,
inspect raw AST fields, or match the name `convert`. If the required evidence
is absent or contradictory, the target emits a deterministic diagnostic.

## Closed native output

Generated programs use statically selected target operations. Tsonic does not
fall back to runtime reflection, arbitrary member lookup, dynamic invocation,
or embedded JavaScript. Broad TypeScript values such as `unknown` are handled
only through finite target-owned carriers and operations that were proved at
compile time.
