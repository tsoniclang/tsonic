# Provider and runtime ownership

Providers make external native APIs visible as legal TypeScript declarations
and map selected source identities to target operations.

## Provider declaration flow

```text
native metadata or declarative model
  -> immutable provider declaration model
  -> provider-backed virtual TypeScript module
  -> TSTS source checking and source overload selection
  -> exact provider identity on selected evidence
  -> target operation relation
  -> target AST
```

For example:

```ts
import { List } from "@tsonic/dotnet/System.Collections.Generic.js";
const values = new List<string>();
values.Add("one");
```

The .NET provider supplies legal TypeScript declarations for the generic type,
constructor, and overload family. TSTS selects one source signature. The C#
provider relation then selects the exact native member from that source
identity. Neither phase chooses by the string `Add` alone.

## Canonical identity

Provider module, export, member, signature, parameter, and type identities are
opaque semantic identifiers. Physical generated filenames, import aliases,
source spelling, overload-group names, and target text are not identity.

Provider declarations are immutable snapshots. Recursive provider graphs may
share canonical declarations, but contradictory declarations fail closed.

## Runtime ownership

Runtimes implement operations already selected by target analysis:

- base runtimes contain carriers required without optional surfaces;
- JS runtimes implement JavaScript source-profile operations;
- Node runtimes implement installed Node capability operations.

Runtime code does not discover which source operation was intended. It does
not inspect arbitrary target objects or repair missing compile-time evidence.

## Project contributions

Capabilities and providers contribute target-native references explicitly:

- assembly references for C#;
- crate paths, features, and registry-patch relationships for Rust.

The host combines declared contributions and rejects conflicts. It never
infers a dependency from an import spelling or copied runtime directory.
