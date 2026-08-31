# C# target manual

The C# target compiles checked TypeScript into Roslyn-shaped C# source and a
.NET project. It owns .NET provider semantics, C# target analysis, C# AST
planning, printing, runtime references, project generation, and .NET toolchain
handoff.

## First native API

```ts
import { Console } from "@tsonic/dotnet/System.js";
import { List } from "@tsonic/dotnet/System.Collections.Generic.js";
import type { int } from "@tsonic/csharp/types.js";

export function main(): int {
  const values = new List<int>();
  values.Add(42);
  Console.WriteLine(values.Count);
  return values.Count;
}
```

The virtual imports are backed by .NET metadata. TSTS performs source overload
selection against legal TypeScript declarations; the C# target then resolves
the exact CLR member through provider identities.

## Read next

- [Source profile and native APIs](source-profile.md)
- [Interop and safety](interop-and-safety.md)
- [Projects and output](projects-and-output.md)
- [C# configuration reference](../../../reference/targets/csharp/configuration.md)
- [C# language support](../../../reference/targets/csharp/language-support.md)
- [C# limitations](../../../reference/targets/csharp/limitations.md)
