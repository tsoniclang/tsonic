# Mojo provider API

Provider authors import `createMojoProviderPackage` and its declaration types
from `@tsonic/target-mojo/provider`.

A provider package supplies source modules, exact target operations/types and
native runtime package inputs. For example, the `node:fs` declaration for
`readFileSync(path, "utf8")` must identify its native string result, argument
conventions, error behavior and runtime entrypoint. A module name and a string
containing a native call are not a complete contract.

Rest parameters may declare `restPacking: "list"` on the final target argument.
This means the native function receives one list, not native variadic arguments.
Arguments and spread inputs are evaluated in source order. Native imported
variadic functions keep their own declared ABI.

Native package manifests declare source assets and native translation units
explicitly, including language and standard. The native build manifest records
these requirements for the Pixi build. See the target-owned [native package
contract](https://github.com/tsoniclang/tsonic-mojo/blob/main/docs/providers/native-runtime-packages.md)
and [surface member contract](https://github.com/tsoniclang/tsonic-mojo/blob/main/docs/providers/surface-members.md).
