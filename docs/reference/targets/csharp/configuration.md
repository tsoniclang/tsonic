# C# target configuration

All fields belong under the selected target's `options` object. Unknown fields
are rejected.

| Option | Type | Default | Contract |
| --- | --- | --- | --- |
| `assemblyName` | nonempty string | `TsonicGenerated` | File-safe .NET assembly name |
| `implicitUsings` | boolean | `false` | Generated project `ImplicitUsings` |
| `languageDialect` | `csharp14` or `csharp15-preview` | `csharp14` | C# syntax/specification dialect |
| `memorySafetyRules` | `csharp14` or `preview` | `csharp14` | Independent C# memory-safety rules |
| `namespace` | nonempty string | `Tsonic.Generated` | Dot-separated C# identifier path |
| `nullable` | boolean | `true` | Generated project nullable context |
| `outputType` | `Exe` or `Library` | `Library` | Generated project output kind |
| `providerReferences` | object | empty | Assemblies available to .NET declaration reflection |
| `projectFile` | nonempty string | none | Existing user-owned `.csproj` |
| `properties` | scalar object | empty | Additional non-target-owned MSBuild properties |
| `publishAot` | boolean | omitted | Generated `PublishAot` property when supplied |
| `references` | object | empty | Generated native project references |
| `targetFramework` | nonempty string | `net10.0` | Generated target framework and framework-pack lookup |

`memorySafetyRules: "preview"` requires
`languageDialect: "csharp15-preview"`.

## Generated and user-owned projects

| Option | Generated project | User-owned project |
| --- | --- | --- |
| `assemblyName`, `namespace`, `outputType` | controls emitted C# and project identity | still controls emitted C# semantics where applicable |
| `languageDialect`, `memorySafetyRules` | controls accepted/emitted C# | same |
| `targetFramework` | emits `TargetFramework` and selects the framework reference pack | selects the framework reference pack; the `.csproj` must agree |
| `references` | emits project references; framework/assembly entries also feed reflection | not written to the `.csproj`; framework/assembly entries may feed reflection |
| `properties`, `implicitUsings`, `nullable`, `publishAot` | emitted into the generated project | not written to the user project |
| `providerReferences` | reflection input only | reflection input only |
| `projectFile` | absent | selects the existing `.csproj` |

Tsonic never edits a user-owned project. Configuration that belongs to that
project—SDK selection, item inclusion, package restore, target RID, signing,
and deployment—must be written in the `.csproj`.

## `references`

| Field | Entry shape |
| --- | --- |
| `projects` | nonempty project path strings |
| `packages` | `{ include, version?, privateAssets?, includeAssets? }` |
| `frameworks` | framework names such as `Microsoft.AspNetCore.App` |
| `assemblies` | `{ include, hintPath? }` |

Duplicate `(kind, include)` identities are rejected.

## `providerReferences`

| Field | Meaning |
| --- | --- |
| `assemblies` | Explicit assembly paths, relative to the project directory or absolute |
| `directories` | Existing directories whose sorted `.dll` files form reflection inputs |

An empty or nonexistent provider directory is rejected. Duplicate canonical
assembly paths are rejected.

## `properties`

Names must be XML element names and values must be strings, numbers, or
booleans. These target-owned properties cannot be overridden through
`properties`:

`AllowUnsafeBlocks`, `Features`, `ImplicitUsings`, `LangVersion`, `Nullable`,
`OutputType`, `PublishAot`, and `TargetFramework`.

Use the dedicated option instead. For example, set `publishAot`, not
`properties.PublishAot`. The target may also enable `AllowUnsafeBlocks` when
the sealed program contains an explicitly authorized unsafe requirement; a
free-form property cannot bypass that analysis.

## Complete generated example

```json
{
  "id": "csharp",
  "surfaces": ["js"],
  "options": {
    "assemblyName": "Acme.Tool",
    "namespace": "Acme.Generated",
    "outputType": "Exe",
    "targetFramework": "net10.0",
    "languageDialect": "csharp14",
    "nullable": true,
    "references": {
      "frameworks": ["Microsoft.AspNetCore.App"],
      "packages": [{
        "include": "Microsoft.Extensions.Logging.Abstractions",
        "version": "10.0.0"
      }]
    },
    "properties": {
      "RuntimeIdentifier": "linux-x64",
      "SelfContained": true
    }
  }
}
```
