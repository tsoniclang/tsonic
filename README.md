# Tsonic

Tsonic is being rebuilt as a source-to-source compiler from TypeScript to target-native source projects.

The active architecture is:

- TSTS owns TypeScript parsing, binding, checking, flow, narrowing, contextual typing, generic inference, overload resolution, and extension facts.
- Tsonic owns project orchestration, target selection, source generation, artifact layout, and target toolchain handoff.
- Target packs own provider semantics, target AST planning, target source printing, runtime references, and target-native project/toolchain integration.

NativeAOT is a supported C# target outcome through normal .NET project configuration. It is not the generic compiler architecture.

## Flow

```text
TypeScript source
  -> TSTS parse/bind/check/finalized extension facts
  -> Tsonic host project orchestration
  -> Target pack planner and target AST
  -> Target printer writes source/project artifacts
  -> Target toolchain owns build/publish/native output
```

## Example

`tsonic.json`:

```json
{
  "entryPoint": "index.ts",
  "rootDir": "src",
  "outDir": "out",
  "targets": [
    {
      "id": "csharp",
      "options": {
        "namespace": "Example.Generated",
        "assemblyName": "ExampleGenerated",
        "targetFramework": "net10.0",
        "publishAot": true,
        "properties": {
          "LangVersion": "preview"
        }
      }
    }
  ]
}
```

`src/index.ts`:

```ts
import type { int } from "@tsonic/csharp/types.js";

export function add(left: int, right: int): int {
  return left + right;
}
```

Build:

```sh
tsonic build --project tsonic.json
dotnet build out/csharp/ExampleGenerated.csproj
```

## Architecture rules

- TSTS diagnostics stop target emission for that target.
- Target backends consume TSTS checker queries and finalized extension facts; they do not redo TypeScript inference or narrowing.
- `outDir` is compiler-owned generated output. A successful build publishes one complete staged tree and replaces the previous tree atomically.
- A build with errors or an incomplete artifact set leaves the last successfully published `outDir` unchanged.
- C# source rendering is AST-only: planner builds `Csharp*` AST nodes, and only the C# printer turns those nodes into C# text.
- Target-specific behavior lives in target packs. Generic host and target API packages do not know C# or .NET semantics.
- Unsupported semantics produce deterministic diagnostics instead of fallback guesses.
