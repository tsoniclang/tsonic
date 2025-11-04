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

- `name` is the identifier written to the declaration file; `alias` is the CLR identifier.
- `binding` records the fully-qualified CLR target that must be called.
- `signature` is optional and may be omitted if not available.
- The manifest is emitted only when a naming transform changes at least one identifier.

## Runtime consumption

- Load the manifest alongside `AssemblyName.metadata.json`.
- Walk the namespace/type/member hierarchy to locate the transformed name and
  use the `binding` information to call the CLR member.
- If a name is missing, emit the CLR identifier unchanged (no transform).

## Versioning

The manifest is additive: future iterations may add new fields but existing
ones (`name`, `alias`, `binding`) will remain. Consumers should ignore unknown
fields.
