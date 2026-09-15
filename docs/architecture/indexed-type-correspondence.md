# Indexed type correspondence

An indexed TypeScript type can select different native value types:

```ts
function change<Source, Key extends keyof Source>(
  source: Source,
  key: Key,
  copy: (value: Source[Key]) => Source[Key],
): void {
  source[key] = copy(source[key]);
}

const item = { count: 3, label: "old" };
change(item, "count", value => value + 1);
change(item, "label", value => value + "!");
```

The first selected value type is `number`; the second is `string`. Both keys
being strings does not make the two generic selections interchangeable.

## Shared queries

Targets use the checked source program's `SourceFinalTypeQueries`:

- `indexedAccessComponents(type)` returns the exact object and index types of
  a deferred indexed type, such as `Source[Key]`. It returns `undefined` for a
  non-indexed type or a type from another checked program.
- `selectIndexedAccess(objectType, indexType)` asks the owning checker for the
  indexed read and write types. A `deferred` result retains the relationship
  without inventing members. A `resolved` result includes each selected key's
  property or index-signature evidence. Invalid or unavailable selections
  return `undefined`, never partial member lists.

```ts
const selected = semantics.types.selectIndexedAccess(objectType, keyType);
if (selected?.kind === "resolved") {
  for (const member of selected.members) {
    if (member.kind === "property") {
      const declarationOwners = member.property.rootSymbols;
    }
  }
}
```

`objectType` and `keyType` must belong to the same checker in this checked
program. Use the exact types from one selected generic application, rather
than combining opaque handles from independently checked files or programs.
Cross-file declarations remain visible through that application's types and
selected root symbols.

## Ownership and limits

Legacy owns TypeScript index selection. Shared Tsonic exposes it without
changing its meaning. Targets own native representations, storage selection,
generic closure and emission; planners consume finalized target facts only.
Do not reproduce TypeScript property lookup in a target using property names.

These are type-level queries, not substitutes for expression evidence. For
an actual `object[key]`, the selected operation also carries flow narrowing,
access mode and expression-position rules such as `noUncheckedIndexedAccess`.
Read and write types remain separate. A union of keys may have a union read
type and an intersection write type. Property `optional` and `readonly` flags
remain independently available; the query does not add an operation to source
code or authorize a rejected write.

Results and member arrays are immutable; compiler type/symbol handles remain
opaque identities. This contract supplies evidence. It does not by itself
certify native support for every generic callback or indexed operation.
