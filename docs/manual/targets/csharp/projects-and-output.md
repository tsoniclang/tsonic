# C# projects and output

## Generated project

Without `projectFile`, Tsonic emits a complete SDK-style project:

```text
out/csharp/
├── TsonicGenerated.csproj
├── src/
│   └── <source-owned C# files>
└── generated/
    └── <compiler-owned helpers and startup>
```

The generated project always uses `Microsoft.NET.Sdk`. Choose a user-owned
project when another SDK is required.

The assembly name controls the project filename. Generated source paths are
stable content/owner identities rather than source basenames that can collide.

```json
{
  "targets": [{
    "id": "csharp",
    "options": {
      "assemblyName": "Example.App",
      "namespace": "Example.Generated",
      "outputType": "Exe",
      "targetFramework": "net10.0",
      "publishAot": true
    }
  }]
}
```

`outputType: "Exe"` creates `TsonicEntrypoint.Main`. It initializes imported
modules in ESM order and runs the TypeScript entry module. Put startup work at
top level:

```ts
import { Console } from "@tsonic/dotnet/System.js";

function run(): void {
  Console.WriteLine("ready");
}

run();
```

`outputType: "Library"` emits public native declarations for supported
TypeScript exports. Synchronous top-level initialization uses a CLR module
initializer. A library with top-level `await` is rejected because CLR module
initializers are synchronous.

## References

Generated projects can declare project, NuGet package, framework, and assembly
references:

```json
{
  "references": {
    "projects": ["../Shared/Shared.csproj"],
    "packages": [{
      "include": "Microsoft.Extensions.Logging.Abstractions",
      "version": "10.0.0"
    }],
    "frameworks": ["Microsoft.AspNetCore.App"],
    "assemblies": [{
      "include": "Acme.Native",
      "hintPath": "lib/Acme.Native.dll"
    }]
  }
}
```

`providerReferences` controls assemblies available to declaration reflection.
It does not silently add a build reference. If source both imports an assembly
and emitted C# links it, declare the appropriate build reference as well.

## User-owned project

```json
{
  "targets": [{
    "id": "csharp",
    "options": {
      "projectFile": "native/Example.csproj",
      "providerReferences": {
        "directories": ["native/bin/Debug/net10.0"]
      }
    }
  }]
}
```

The `.csproj` must exist outside generated output. Tsonic emits sources only and
does not mutate it. The project owns package restore, framework references,
RID, target triple, signing, trimming, NativeAOT, deployment, and inclusion of
generated files.

For a project at `native/Example.csproj` and generated files under
`out/csharp`, a minimal project can be:

```xml
<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <TargetFramework>net10.0</TargetFramework>
    <Nullable>enable</Nullable>
  </PropertyGroup>
  <ItemGroup>
    <Compile Include="../out/csharp/**/*.cs" LinkBase="Generated" />
  </ItemGroup>
</Project>
```

Adjust the relative path to match the project layout. Use a user-owned project
for a different SDK, such as `Microsoft.NET.Sdk.Web`, a test SDK, desktop UI,
MAUI, or a custom build pipeline.

## What each setting controls

| Need | Put it here |
| --- | --- |
| C# output kind, namespace, nullable mode, language rules | dedicated C# target option |
| Generated project package, framework, project, or assembly reference | `references` |
| Assembly used only for source declaration reflection | `providerReferences` |
| Open MSBuild scalar such as `RuntimeIdentifier` | `properties` |
| Custom SDK, item graph, build targets, signing, packaging | user-owned `.csproj` |

Dedicated target settings cannot be overridden through `properties`. This
keeps the checked source contract and generated project in agreement.

## Native build

Tsonic's toolchain stage records generated artifacts; the .NET SDK performs the
actual compile or publish:

```sh
npx --no-install tsonic build -p tsonic.json
dotnet build out/csharp/Example.App.csproj
dotnet publish out/csharp/Example.App.csproj -c Release
```

In user-owned mode, build the configured project instead:

```sh
dotnet build native/Example.csproj
```
