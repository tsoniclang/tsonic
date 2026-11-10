# Structural source members

```ts
declare function open(path: string, options: { flags?: string; highWaterMark?: number }): void;
const options = { highWaterMark: 3 };
open("output.txt", options);
```

The two `highWaterMark` properties have different symbols. An identity query
cannot prove their structural correspondence. After obtaining the checked
call and selected parameter, a target uses the public source boundary:

```ts
const semantics = source.semantics.forNode(callNode);
const call = semantics.operations.call(callNode);
const relation = semantics.types.structuralMembers(
  call.sourceArguments[1].type,
  call.sourceSelectedSignatureParameters[1].selectedType,
);
```

An available result records each destination property in destination order.
Each row is either `present`, with both exact property symbols, root symbols,
effective selected types, optional flags and read/accessor declarations; or
`absent`, for an optional property not found on the source type. An optional
source property is still `present`: its runtime presence must be handled by
the target. This differs from an absent property and from a present property
whose value is `undefined`. Extra source properties are not projected.

The shared owner resolves the destination symbol's compiler key through
TSTS's public property query and joins by the resulting source symbol, not by
target-side string comparisons. Generic and mapped property types are the
checker's instantiated property types. Results are cached per source/destination
type pair and immutable; compiler type, symbol and syntax handles retain their
existing identity contracts.

This is **member correspondence, not an assignability test**. The accepted
call/assignment remains the source of assignment evidence. Index signatures,
call signatures and construct signatures are returned separately for both
types; a member map does not discharge those obligations or select a callable
overload. Generic member types remain compiler types, not proof of native closure.
Unions must be narrowed or selected first. Unresolved types, missing
required properties, inconsistent member evidence and write-only source accessors
return explicit `unavailable` reasons.

No expression is evaluated by this query. Native snapshot construction, reading
an accessor at the correct time, evaluating the source receiver once, preserving
object identity and rejecting unsupported native conversions remain target work.
There is no target-specific field matching or new checker state.
