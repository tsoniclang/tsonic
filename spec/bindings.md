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
  "SelectMany": {
    "Kind": "method",
    "Name": "SelectMany",
    "Alias": "selectMany",
    "FullName": "System.Linq.Enumerable.SelectMany"
  },
  "Enumerable": {
    "Kind": "class",
    "Name": "Enumerable",
    "Alias": "enumerable",
    "FullName": "System.Linq.Enumerable"
  },
  "System.Linq": {
    "Kind": "namespace",
    "Name": "System.Linq",
    "Alias": "systemLinq",
    "FullName": "System.Linq"
  }
}
```

- `Name` is the CLR identifier (e.g., "SelectMany", "Enumerable", "System.Linq")
- `Alias` is the TypeScript-facing identifier emitted in the `.d.ts` (e.g., "selectMany", "enumerable", "systemLinq")
- `Kind` describes the type of entity: "namespace", "class", "interface", "method", "property", "enumMember"
- `FullName` contains the fully-qualified CLR name for the entity
- Dictionary keys are the CLR identifiers for quick lookup
- The manifest is emitted only when a naming transform changes at least one identifier.

## Runtime consumption

- Load the manifest alongside `AssemblyName.metadata.json`.
- When you have a TypeScript identifier (e.g., `selectMany`):
  - Iterate through dictionary values to find an entry where `Alias` matches
  - Read the `Name` field to get the CLR identifier (`SelectMany`)
  - Use `FullName` for the fully-qualified CLR target
- When you have a CLR identifier (e.g., `SelectMany`):
  - Use it as the dictionary key: `bindings["SelectMany"]`
  - Read the `Alias` field to get the TypeScript identifier
- If an entry is missing, emit the CLR identifier unchanged (no transform).

## Versioning

The manifest is additive: future iterations may add new fields but existing
ones (`name`, `alias`, `binding`) will remain. Consumers should ignore unknown
fields.
