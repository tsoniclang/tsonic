# .NET native APIs

`@tsonic/dotnet/<namespace>.js` modules are generated lazily from exact .NET
metadata available to the compilation.

```ts
import { Console, DateTime } from "@tsonic/dotnet/System.js";
import { List } from "@tsonic/dotnet/System.Collections.Generic.js";
```

## Resolution

1. The module specifier identifies a .NET namespace.
2. Requested exports select exact public type families.
3. The provider loads the required declaration closure, including base types,
   interfaces, member signatures, generic constraints, and referenced types.
4. TSTS performs TypeScript source overload resolution.
5. C# provider relations map the selected source identity to one target member
   or a deterministic ambiguity/rejection.

Type families preserve arity. A public family name may represent non-generic
and generic CLR types, while class heritage selects the exact class-backed
arity required by metadata.

## Reference sources

- the selected .NET target framework reference pack;
- configured framework references;
- `references.assemblies`;
- explicit `providerReferences.assemblies`;
- sorted `.dll` files from `providerReferences.directories`.

Provider reference snapshots are immutable for one compilation. Each unique
assembly is hashed once per provider session; mutation during compilation fails
closed.

## Supported metadata families

The provider models classes, structs, interfaces, enums, delegates,
constructors, methods, properties, fields, indexers, events where representable,
generic constraints, nullable metadata, optional/default parameters,
parameter modes, arrays, pointers, function pointers, inheritance, attributes,
and cross-module type references. Unsupported metadata receives a provider
diagnostic instead of a partial declaration.
