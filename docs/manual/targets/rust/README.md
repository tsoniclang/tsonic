# Rust target manual

The Rust target turns checked TypeScript into Rust source. It can also create a
normal Cargo crate for that source.

## First Rust application

```ts
import type { int32 } from "@tsonic/core/types.js";
import { HashMap } from "@tsonic/rust/std/collections.js";

export function main(): void {
  const values = new HashMap<string, int32>();
  values.insert("answer", 42);
  if ((values.get("answer") ?? 0) !== 42) {
    throw new Error("missing answer");
  }
}
```

For binary output, the entry module exports `main` returning `void`. An async
entry may return `Promise<void>`. The target emits native Rust `main`, performs
module initialization, and calls that function.

The standard-library import is produced from the selected Rust toolchain.
TypeScript checking selects the source declaration. Rust analysis then closes
its exact native item, generic arguments, ownership, errors, foundation, and
Cargo requirements before any Rust syntax is planned.

## Normal TypeScript stays normal

Most code does not mention Rust lifetimes or borrows:

```ts
export function title(name: string): string {
  return `Hello, ${name}`;
}
```

The target chooses ordinary owned or borrowed Rust carriers when the complete
use graph proves that choice. Explicit Rust reference and lifetime types are
for authored native API contracts whose distinction must be visible in the
TypeScript type system.

Use `surfaces: ["js"]` when the program needs JavaScript globals and built-ins.
Install `@tsonic/rust-nodejs` when it imports `node:*`. Those are independent
choices.

## Read next

- [Source profile and native APIs](source-profile.md)
- [Ownership, lifetimes, and safety](ownership-and-safety.md)
- [Projects and output](projects-and-output.md)
- [Rust configuration reference](../../../reference/targets/rust/configuration.md)
- [Rust language support](../../../reference/targets/rust/language-support.md)
- [Rust limitations](../../../reference/targets/rust/limitations.md)
