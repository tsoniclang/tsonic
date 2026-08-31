# Rust target manual

The Rust target compiles checked TypeScript into a sealed Rust target program,
plans a Rust AST, prints Rust source, and emits either a complete Cargo crate or
sources for a user-owned Cargo project. It owns Rust carriers, ownership and
lifetime contracts, provider selection, crate dependencies, foundation
requirements, planning, printing, and Cargo handoff.

## First native API

```ts
import type { int32 } from "@tsonic/core/types.js";
import { HashMap } from "@tsonic/rust/std/collections.js";

export function answer(): int32 {
  const values = new HashMap<string, int32>();
  values.insert("answer", 42);
  return values.get("answer") ?? 0;
}
```

The virtual import is produced from the selected Rust sysroot. TSTS selects the
exact TypeScript declaration. Rust analysis closes the generic carriers,
ownership, operation ABI, fallibility, foundation, and crate requirement.
Planning then emits the selected `std::collections::HashMap` operations; it
does not match `HashMap`, `insert`, or `get` by source spelling.

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

## Read next

- [Source profile and native APIs](source-profile.md)
- [Ownership, lifetimes, and safety](ownership-and-safety.md)
- [Projects and output](projects-and-output.md)
- [Rust configuration reference](../../../reference/targets/rust/configuration.md)
- [Rust language support](../../../reference/targets/rust/language-support.md)
- [Rust limitations](../../../reference/targets/rust/limitations.md)
