# Native performance

C# and Rust use native storage and operations. Selecting the JavaScript or Node
APIs does not select a JavaScript engine or exact JavaScript behavior at any cost.
Where the native contract differs, the difference is explicit below. Neither
target reads uninitialized memory or discards aliasing guarantees to save work.

## Strings

Ordinary C# strings use .NET UTF-16. Ordinary Rust strings use UTF-8. Rust lengths,
search results, regular-expression indices and slice positions are byte offsets.
Slices must start and end on character boundaries.

```ts
const text = "é😀";
const length = text.length;
const position = text.indexOf("😀");
const face = text.slice(position);
```

In C#, `length` is 3 and `position` is 1. In Rust, they are 6 and 2. `face` is the
same text in both. Rust rejects a slice that splits a UTF-8 character; it does not
silently convert the entire string to UTF-16 to make the slice possible. JSON and
Node APIs retain native strings too.

Rust `String.fromCharCode` and `String.fromCodePoint` construct Unicode scalar
values from finite integer arguments. Fractional values, surrogate code points
and values beyond `0x10FFFF` reject instead of applying UTF-16 wrapping.

Use an explicit value when UTF-16 code-unit behavior is required:

```ts
import { jsstr } from "@tsonic/js/lang.js";

const text = jsstr("é😀");
const length = text.length;
```

`length` is 3 on both targets. The conversion and the exact UTF-16 operations
belong to this value, not every string in the program. A native Rust string cannot
contain lone surrogates. Parsing JSON containing one rejects; an explicit
`JsString` can retain it and JSON serialization escapes it.

## Arrays

Ordinary arrays have contiguous initialized elements. They do not store a
presence flag beside every element.

```ts
const values = new Array<number>(3);
values[1] = 7;
values.push(9);
const copy = Array.from(values);
```

The result is `[0, 7, 0, 9]`, not an array containing holes. `Array.from` creates
independent storage and preserves the identity of reference-valued elements.
This also works when the source is a parameter; the native carrier itself is
dense. Reserving capacity in a native collection leaves its length zero and is
different from constructing an initialized length.

Omitted literal elements, deleting an existing array element, increasing
`.length`, and assignments that jump beyond the next element are unsupported.
Use `push`, `splice`, initialized length construction or a native indexed map.
There is no automatic switch to sparse storage. Native initialization must be
available for the selected element type; no arbitrary reference is fabricated.

Absence is an explicit element type when needed:

```ts
const values: (number | undefined)[] = [1, undefined, 3];
```

All three indices exist. Unmatched regular-expression captures likewise use
optional values, not holes in the array representation.

Rust values that leave mutable shared storage still need a safe ownership
transfer. For example, retaining an array's string while a callback can replace
that element requires an owned string. Tsonic does not hold a borrow across an
arbitrary callback or silently change value semantics to avoid that copy.

## Fixed-size storage

`FixedArray<T, N>` preserves an exact extent. It is not a universal promise of
stack allocation. C# currently uses a managed `T[]`; Rust uses native fixed-array
storage through its selected carrier. Changing C# to an inline value struct would
change assignment and alias behavior and needs a separate storage contract.
Use the target's native storage APIs for allocation and lifetime controls that
are not expressed by ordinary arrays.

## Requested results only

- Hash updates retain incremental hash state, not the complete message history.
- Buffer views share a backing range; explicit copies allocate independent bytes.
- Boolean regular-expression tests on proven native expressions do not build
  discarded public match arrays. Unknown C# receivers retain virtual `exec`
  dispatch so an override's observable behavior is not erased.
- Number formatting writes text directly; `formatToParts` creates parts when asked.
- File statistics retain a numeric snapshot; Date objects are created on access.
- Errors capture no stack until `Error.captureStackTrace` is called.
- Rust async filesystem operations complete on a bounded worker pool. Ready
  network and worker events wake the event loop rather than waiting for a fixed
  polling interval.
- C# HTTP clients expose headers before reading the whole body. Streaming has
  bounded in-flight chunks; `readAll` and `readAllBuffer` explicitly request the
  complete body.

## Costs that remain necessary

First-class callbacks retain captured state and identity. Shared mutable values
retain shared ownership. Awaiting one shared promise more than once must preserve
its result for each consumer; a uniquely owned result can move. These are source
requirements, not optional emulation. Native direct functions, value types and
explicit borrow APIs remain available where their contracts fit.

Closed C# unions use typed value storage, avoiding allocation and boxing of a
primitive payload. A wide union occupies the combined inline field space, so
passing a large union by value still has a native copy cost. This is not a claim
that every union is free or that every program improves by the same amount.
