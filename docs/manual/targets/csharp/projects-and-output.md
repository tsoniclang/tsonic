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

## Runtime source and framework selection

The npm packages `@tsonic/csharp-runtime`, `@tsonic/csharp-js`, and
`@tsonic/csharp-nodejs` contain native source projects. Tsonic creates small,
framework-specific import projects in its cache and references the ones the
program needs. MSBuild builds their source for the same
framework as the application and restores their NuGet dependencies. There is
no separate runtime build command and no precompiled runtime DLL to replace.

The default framework is `net10.0`. Choose another in the C# target entry:

```json
{
  "id": "csharp",
  "options": {
    "targetFramework": "net11.0",
    "outputType": "Exe"
  }
}
```

Select an SDK that supports that framework using the normal .NET `global.json`
mechanism. Run `dotnet --list-sdks` and `dotnet --list-runtimes` to check the
installation. Tsonic reports an unavailable framework instead of substituting
another. The C# language dialect remains separately configured.

Build outputs are stored under `.tsonic/cache/csharp/runtime`, outside installed
packages. MSBuild owns incremental rebuilds. Source delivery adds a cold native
runtime build; it does not add runtime interpretation to the application.

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
    <ProjectReference Include="runtime/Tsonic.CSharp.Runtime.csproj" />
  </ItemGroup>
</Project>
```

Adjust the relative path to match the project layout. Use a user-owned project
for a different SDK, such as `Microsoft.NET.Sdk.Web`, a test SDK, desktop UI,
MAUI, or a custom build pipeline.

Keep its framework consistent with `targetFramework` in `tsonic.json`. The
referenced `native/runtime/Tsonic.CSharp.Runtime.csproj` imports the installed
source project:

```xml
<Project>
  <PropertyGroup>
    <TargetFramework>net10.0</TargetFramework>
    <DirectoryBuildPropsPath>$(MSBuildThisFileDirectory)../../node_modules/@tsonic/csharp-runtime/Directory.Build.props</DirectoryBuildPropsPath>
    <TsonicRuntimeArtifactsPath>$(MSBuildThisFileDirectory)../../.tsonic/cache/csharp/runtime/</TsonicRuntimeArtifactsPath>
  </PropertyGroup>
  <Import Project="../../node_modules/@tsonic/csharp-runtime/src/Tsonic.CSharp.Runtime/Tsonic.CSharp.Runtime.csproj" />
</Project>
```

For JS or Node, add equivalent import projects for their `runtime.csproj` and
`runtime.props` package exports. Before the import, set
`TsonicCsharpRuntimeProject` to the core import project; Node also needs
`TsonicCsharpJsProject` pointing to the JS import project. Use absolute paths or
paths based on `$(MSBuildThisFileDirectory)`. Keep one core project in that graph.
Native source stays in npm packages, while build products stay in your cache.

These examples use npm's default hoisted layout. For a nested installation,
resolve the package exports with Node's `import.meta.resolve` and use those exact
paths. Generated-project mode does this automatically. Do not carry framework
or output selection through `ProjectReference.AdditionalProperties`: NuGet's
restore walk does not preserve that metadata. Each import project must declare
the same configuration for restore and build.

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
