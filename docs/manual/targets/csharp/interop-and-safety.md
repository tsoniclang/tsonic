# C# interop and safety

## By-reference calls

Provider metadata preserves C# parameter modes:

```ts
import { Int32 } from "@tsonic/dotnet/System.js";
import { out } from "@tsonic/csharp/lang.js";
import type { int } from "@tsonic/csharp/types.js";

let value: int = 0;
const parsed = Int32.TryParse("42", out(value));
```

The target accepts `out(value)` only when the selected parameter is writable
and the argument identifies exact storage. It does not infer by-reference mode
from the method name.

## Attributes

Use the neutral attribute builder with provider-backed attribute types:

```ts
attribute<Controller>()
  .method((controller) => controller.handle)
  .add(AuthorizeAttribute);
```

Selectors identify exact source declarations. The .NET provider resolves the
attribute constructor and legal argument values; the C# planner emits Roslyn
attribute nodes. Marker calls erase from runtime code.

## Safe typed locations

```ts
let value: int32 = 1;
const location = addressOf(value);
storePointer(location, loadPointer(location) + 1);
```

The C# target lowers this to the closed
`Tsonic.CSharp.Runtime.Location<int>` carrier. It preserves local, parameter,
field, property, array-element, and projected value-type storage identity when
the exact location can be proven.

## Native C# pointers

```ts
import { loadNativePointer, unsafeContext } from "@tsonic/core/lang.js";
import type { NativePointer, int32 } from "@tsonic/core/types.js";

export function read(pointer: NativePointer<int32>): int32 {
  return unsafeContext(loadNativePointer(pointer));
}
```

Native pointer representation, unsafe lexical context, declaration-level
requires-unsafe, and project permission are separate controls. The target emits
`AllowUnsafeBlocks` only when the sealed target program contains an authorized
unsafe requirement. Other marker use does not imply unsafe output.

`languageDialect` and `memorySafetyRules` independently select the C# language
and memory-safety specifications. Preview memory-safety rules require the C# 15
preview dialect.

## Generators and resources

Ordinary representable generators use native C# iterators:

```ts
export function* values(): Generator<int32, void, unknown> {
  yield 1;
  yield 2;
}
```

Bidirectional and asynchronous generator contracts that cannot be represented
by native iterator syntax use closed runtime protocols. `using`, `await using`,
`for await...of`, cleanup, completion, injected `next(value)`, `return`, and
`throw` behavior are selected from exact generator/resource evidence. Native
C# restrictions such as illegal `yield` placement produce deterministic target
diagnostics rather than a hand-written state-machine rewrite.
