# Mojo native APIs

Native imports use compiler-backed package declarations. Configure the package
identity, version and roots in `providerPackages`; the provider obtains the
selected module declarations and exact native call information.

Package alias `geometry` and native module `vectors.mojo` have the virtual path
`@tsonic/mojo/packages/geometry/vectors.js`. For a package exporting `length`:

```ts
import { length } from "@tsonic/mojo/packages/geometry/vectors.js";

export function distance(x: number, y: number): number {
  return length(x, y);
}
```

This illustrates the import contract, not a bundled geometry package. The
configured provider must expose that exact export and signature. Standard-library
modules use `@tsonic/mojo/std/<module>.js` instead.

For example, a native API taking an owned value and another API taking a mutable
reference are different contracts even if their TypeScript value types look
alike. The provider must retain the distinction before target planning.

The compiler command is shared by native queries and formatting. The associated
language server can supply compiler-selected semantic details. The target does
not derive an ABI by parsing display names, guessing pointer layouts or probing
overloads during printing.

See [configuration](configuration.md) for package and command fields, and the
[provider API](provider-api.md) for packages that supply explicit declarations.
If a native declaration cannot be represented exactly by the provider, the
import is rejected; another target accepting a similar API does not prove Mojo
can call it.
