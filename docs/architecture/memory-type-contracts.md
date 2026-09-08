# Memory type contracts

A memory layout may be defined in one source file and consumed in another.
Its TypeScript type, marker semantics and physical layout must still agree at
each use. Source-core owns that agreement. Targets own the native storage and
codec implementation.

## Example

An explicit ABI provider supplies `abi`. Both files use that same provider.

`layout.ts`:

```ts
import { abi } from "example:abi";
import type { Pointer, uint32 } from "@tsonic/core/types.js";
import { memoryLayout } from "@tsonic/core/lang.js";

export const layout = memoryLayout<Pointer<uint32> | undefined>(abi, 8, 8, 8);
```

`index.ts`:

```ts
import { layout } from "./layout.js";
import type { Pointer, uint32 } from "@tsonic/core/types.js";
import { allocatePointer, reinterpretRawPointer, toRawPointer } from "@tsonic/core/lang.js";

const slot = allocatePointer<Pointer<uint32> | undefined>(allocatePointer<uint32>(3));
export const view = reinterpretRawPointer(toRawPointer(slot, layout), layout);
```

The layout describes a nullable pointer word in the provider's explicit
64-bit ABI. It does not mean that every target can represent this layout;
the target must separately prove its storage representation.

## Source analysis

The ordinary checker owns source inference and overload selection. Its type
objects are local to a checker context. Two objects retained while checking
different files must not be handed to one checker's raw type comparison.

Source-core uses one existing public source-file query context for its memory
contract comparisons. It asks the compiler for the selected type arguments of
the exact memory calls in that context, checks the selected declaration, and
lets the compiler decide type identity. It does not clone types, change the
checker guard, parse another tree or infer types itself. This work is limited
to selected memory operations; it does not recheck every expression.

Source-core also preserves the selected marker meaning. For example,
`Pointer<int32>` and `Pointer<uint32>` must have different memory domains even
if their ordinary TypeScript numeric carriers coincide. Alias substitution
uses resolved declarations and type parameters, not names. Nullability,
nested pointers and closed generic arguments participate in identity.

For inferred pointer values, the same contract follows selected declarations,
array index signatures, call arguments and returns. This recovers the static
marker domain; it does not prove that storage is stable or that a pointer may
escape. Existing target assignment, backing-storage and lifetime checks still
apply.

Provider fields use their retained declaration models. During source analysis,
`context.factResolver.getVirtualDeclarationDocument(identity.artifactFileName)`
reads the already-published immutable document. It does not query the provider
again. For example, a provider's `source-primitive: uint32` field must agree
with a `uint32` layout even though its virtual TypeScript annotation is
`number`. The document's provider, version, module, export and member identity
must match before that evidence can be used.

This is a memory contract, not a second TypeScript type evaluator. Direct
annotations, resolved aliases, unions, arrays and closed generic references
retain their marker domains. A marker-bearing conditional or mapped type, or
a generic anonymous type that needs further semantic substitution, is rejected
if the selected marker domain is unavailable. Open types cannot receive a
closed identity, including type variables hidden in `typeof` properties,
call signatures or index signatures.

The result is an immutable `TsonicMemoryTypeFact` on each accepted layout,
physical field and raw conversion. A field's fact describes its field type.
Other facts describe their selected pointee type. Each fact contains:

- `call`: the exact authored operation;
- `sourceType`: that operation's original selected checker type;
- `identity`: an opaque, program-scoped memory-domain identity.

Equivalent contracts in the same checked program share `identity`. The token
is bound to its exact issued call/type selections. Copied, forged or
cross-program tokens cannot certify a different occurrence. Tokens are not
serialized identifiers and must not be reused between compilations.

## Target consumption

For a raw conversion, use the shared selection API:

```ts
import { selectTsonicRawLocationOperation } from "@tsonic/source-core/facts";

const selection = selectTsonicRawLocationOperation(source.ast, source.sourceFacts, call);
if (selection === undefined) throw new Error("Missing memory selection");
if (selection.kind === "rejected") throw new Error(selection.reason);
const { operation, expression, layout, memoryType } = selection;
```

A resolved selection certifies the exact operands, finalized layout and ABI,
child layout evidence, and pointee/layout memory-type agreement. The target
must not repeat that agreement check by comparing `layout.sourceType` with
`operation.pointeeType`: those original types may belong to different checker
contexts. Target-native carrier and representation checks are still required.

For independently declared layouts, read their contracts:

```ts
import { readTsonicMemoryType } from "@tsonic/source-core/facts";

const first = readTsonicMemoryType(source.sourceFacts, firstLayout.call);
const second = readTsonicMemoryType(source.sourceFacts, secondLayout.call);
const sameDomain = first !== undefined && second !== undefined && first.identity === second.identity;
```

This comparison answers only whether they represent the same source memory
domain. Reusing a codec also requires the same ABI provider identity and
fingerprint, byte order, address width, size, alignment, stride, and exact
child layouts. The target owns static codec placement, imports, initialization
ordering, runtime alias preservation, and any target-specific rejection.

Missing, unbound or unsupported evidence is a diagnostic, not permission to
guess from type spelling, source text or a broad runtime value map.
