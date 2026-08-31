# C# target manual

The C# target turns checked TypeScript into C# source. It can also create a
normal SDK-style project for that source.

## First C# application

```ts
import { Console } from "@tsonic/dotnet/System.js";
import { List } from "@tsonic/dotnet/System.Collections.Generic.js";
import type { int } from "@tsonic/csharp/types.js";

export function run(): int {
  const values = new List<int>();
  values.Add(42);
  Console.WriteLine(values.Count);
  return values.Count;
}

run();
```

The entry module runs from top to bottom. An exported function named `main` is
not special; call the function if it should run.

The `@tsonic/dotnet/*` imports are virtual source modules built from .NET
metadata. TypeScript checking selects a source overload. The C# target then
uses the provider's exact identity to select the CLR member.

Use `surfaces: ["js"]` when the program needs JavaScript globals and built-ins.
Install `@tsonic/csharp-nodejs` when it imports `node:*`. Those are independent
choices.

## Read next

- [Source profile and native APIs](source-profile.md)
- [Interop and safety](interop-and-safety.md)
- [Projects and output](projects-and-output.md)
- [C# configuration reference](../../../reference/targets/csharp/configuration.md)
- [C# language support](../../../reference/targets/csharp/language-support.md)
- [C# limitations](../../../reference/targets/csharp/limitations.md)
