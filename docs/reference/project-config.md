# `tsonic.json` reference

The project file is a strict JSON object. Unknown fields are rejected. It is
not a `tsconfig.json`, and fields such as `compilerOptions`, `baseUrl`, `paths`,
`tsconfig`, `extends`, and `references` are deliberately unsupported.

## Project fields

| Field | Required | Type | Default | Contract |
| --- | --- | --- | --- | --- |
| `$schema` | No | string | none | Editor metadata; accepted but not semantic input |
| `entryPoint` | Yes | nonempty string | none | Final `.ts` or `.mts` source below `rootDir`; declaration files are rejected |
| `rootFiles` | No | nonempty distinct string array | `[entryPoint]` | Additional final `.ts`/`.mts` roots; must include `entryPoint` after resolution |
| `rootDir` | No | nonempty string | project-file directory | Root for source resolution |
| `outDir` | No | nonempty string | `dist/tsonic` | Compiler-owned publication root |
| `targets` | Yes | nonempty target array | none | One entry per unique target id |

Every resolved root file must remain strictly inside the resolved project root.

## Target fields

| Field | Required | Type | Contract |
| --- | --- | --- | --- |
| `id` | Yes | string | Lowercase ASCII id with single hyphen-separated segments |
| `surfaces` | No | distinct string array | Explicit source-surface ids; an empty array is valid |
| `options` | No | object | Validated strictly by the selected target pack |

`packages` is not a target field. Install a capability package through npm
instead.

## Complete example

```json
{
  "$schema": "https://tsonic.org/schema/project/v1.json",
  "entryPoint": "index.ts",
  "rootFiles": ["index.ts", "startup.ts"],
  "rootDir": "src",
  "outDir": "out",
  "targets": [
    {
      "id": "csharp",
      "surfaces": ["js"],
      "options": {
        "namespace": "Example.Generated",
        "outputType": "Exe"
      }
    },
    {
      "id": "rust",
      "surfaces": ["js"],
      "options": {
        "crateName": "example_generated",
        "outputType": "bin"
      }
    }
  ]
}
```

See the exact [C# options](targets/csharp/configuration.md) and
[Rust options](targets/rust/configuration.md).
