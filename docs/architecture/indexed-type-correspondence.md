# Indexed type correspondence

A resolved query has no member rows only when the checker selects `never` for
an empty (`never`) key domain. This is distinct from a missing key, which is
rejected, and a deferred generic selection, whose members are not yet known.

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

A deferred selection retains the exact object and index type handles. Its
result need not be the same object as an alias-bearing type from authored
syntax: the checker's cache also distinguishes alias identity. Compare the
selected relationship or use the checker's type-identity query; do not discard
alias evidence to force two handles to match.

## Alias applications

```ts
type Values<T = string> = T[];
function first(values: Values): string | undefined { return values[0]; }
```

`aliasApplication(type)` retains the selected `Values` declaration, its
parameter-to-argument bindings and its result. Here the binding is `T` to
`string`, even though the source supplies no type argument. `instantiateAlias`
uses the checker's declared defaults for omitted optional arguments, including
defaults that depend on earlier arguments. Missing required arguments, excess
arguments, failed constraints and foreign-program handles are rejected.

`typeArguments(type)` is the reference-type query. A conditional or other
non-reference type returns an empty list; that is not evidence that it lacks
alias bindings. Use `aliasApplication` for those bindings. If the checker has
erased the alias provenance, the query returns no application rather than
reconstructing one from a name or an equivalent type.

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
