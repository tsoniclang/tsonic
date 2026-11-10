# @tsonic/js-source-profile

Canonical, target-independent JavaScript source-profile declaration fragments and source identity vocabulary used by Tsonic target packs.

This package describes TypeScript/JavaScript source semantics. It does not contain target carriers, lowering, or runtime implementations.

Native TypeScript `string` remains the default source string. The explicit
`JsString` type from `@tsonic/js/types.js` represents JavaScript's exact UTF-16
code-unit domain, and `jsstr` from `@tsonic/js/lang.js` is the sole authored
native-to-`JsString` conversion marker. Targets must not infer this lane from a
string literal, selected surface, API spelling, or target carrier.

`jsSurfaceSourceProfileDeclarations` is the single complete JS global
inventory shared by target packs. It includes the union of supported target
members; unsupported operations are refused by the selected target's binding
layer, not removed from the declarations.

Primitive width aliases refer to the existing source-core primitive identities.
Native lengths, sizes, indexes and offsets are `int32`; typed-array elements
and DataView getters retain their exact primitive widths. Nullable native
results use one `undefined` absence state, and read-only native members remain
read-only in Source.
