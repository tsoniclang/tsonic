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

## Native build

Tsonic's toolchain stage records generated artifacts; the .NET SDK performs the
actual compile or publish:

```sh
npx tsonic build -p tsonic.json
dotnet build out/csharp/Example.App.csproj
dotnet publish out/csharp/Example.App.csproj -c Release
```
