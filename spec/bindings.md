# Bindings Manifest

`generatedts` now emits a `<Assembly>.bindings.json` file alongside each
`.d.ts`/`.metadata.json`. The manifest maps the JavaScript-facing names to their
original CLR members so the runtime can honour naming transforms (e.g.
camelCase).

## Location

For each processed assembly:

```
types/
  AssemblyName.d.ts
  AssemblyName.metadata.json
  AssemblyName.bindings.json  ← new
```

## JSON structure

```json
{
  "assembly": "System.Linq",
  "namespaces": [
    {
      "name": "systemLinq",
      "alias": "System.Linq",
      "types": [
        {
          "name": "enumerable",
          "alias": "Enumerable",
          "kind": "class",
          "members": [
            {
              "kind": "method",
              "signature": "selectMany<TSource, TResult>(source: IEnumerable<TSource>, selector: (TSource) => IEnumerable<TResult>)",
              "name": "selectMany",
              "alias": "SelectMany",
              "binding": {
                "assembly": "System.Linq",
                "type": "System.Linq.Enumerable",
                "member": "SelectMany"
              }
            }
          ]
        }
      ]
    }
  ]
}
```

Field meanings:

- `assembly`: CLR assembly name.
- `namespaces[]`: list of namespaces exposed in the `.d.ts`. `name` is the
  TypeScript-facing identifier; `alias` is the CLR namespace.
- `types[]`: individual types. `kind` is `class`, `interface`, `struct`, or
  `enum` (mirrors the declaration).
- `members[]`: methods/properties under each type. `name` is the identifier in
  `.d.ts`; `alias` is the CLR member; `binding` tells the runtime which member to
  call when generating C#.
- `signature`: optional TypeScript signature string for diagnostics/tooling.

## Runtime consumption

- Load the manifest together with `AssemblyName.metadata.json`.
- When emitting C# for a TypeScript call, resolve the namespace/type/member by
  the transformed `name`. Use `binding.type` + `binding.member` (and
  `binding.assembly` if the call crosses assemblies) to reference the CLR
  member.
- If a name is missing from the manifest, fall back to the CLR name (meaning no
  transform was applied).

## Versioning

The manifest is additive: future iterations may add new fields but existing
ones (`name`, `alias`, `binding`) will remain. Consumers should ignore unknown
fields.
