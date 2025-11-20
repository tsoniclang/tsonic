# Metadata Contract

## Purpose

`.metadata.json` files accompany generated .NET assemblies and provide CLR-specific information that can't be expressed in TypeScript.

## Schema

```typescript
{
  "version": "1.0",
  "assembly": "System.IO",
  "types": {
    "System.IO.File": {
      "methods": {
        "ReadAllText": {
          "isStatic": true,
          "isVirtual": false,
          "parameters": [
            { "name": "path", "type": "string", "isRef": false, "isOut": false }
          ],
          "returnType": "string"
        }
      },
      "properties": {},
      "isAbstract": false,
      "isSealed": true
    }
  },
  "omissions": {
    "indexers": ["System.Collections.Generic.List`1"],
    "genericStaticMembers": []
  }
}
```

## Fields

- **version** - Metadata schema version
- **assembly** - Assembly name
- **types** - Type-level metadata
  - **methods** - Method metadata (static, virtual, override, ref/out params)
  - **properties** - Property metadata
  - **isAbstract**, **isSealed** - Class modifiers
- **omissions** - Intentionally skipped members with reasons

## Usage

The emitter reads metadata to:
- Emit correct C# modifiers (override, virtual, static)
- Handle ref/out parameters correctly
- Apply .NET inheritance rules
- Identify intentional omissions (not errors)

## Location

Generated alongside .d.ts files by tsbindgen:
```
lib/System.IO/index.d.ts
lib/System.IO/metadata.json
```

## See Also

- [bindings.md](bindings.md) - Name transformation tracking
- [runtime-contract.md](runtime-contract.md) - Runtime loading
