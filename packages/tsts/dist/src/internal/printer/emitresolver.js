/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/emitresolver.go::constGroup::SymbolAccessibilityAccessible+SymbolAccessibilityNotAccessible+SymbolAccessibilityCannotBeNamed+SymbolAccessibilityNotResolved","kind":"constGroup","status":"implemented","sigHash":"8c6be8bbcbbda4c9658c6b57526f69b309e1d9f0af2e81e6ddc0b59bfe9606a0","bodyHash":"13015621c74ffbdf501551eff909a820fd5cf32f58d98322b21af728040e96ce"}
 *
 * Go source:
 * const (
 * 	SymbolAccessibilityAccessible SymbolAccessibility = iota
 * 	SymbolAccessibilityNotAccessible
 * 	SymbolAccessibilityCannotBeNamed
 * 	SymbolAccessibilityNotResolved
 * )
 */
export const SymbolAccessibilityAccessible = 0;
export const SymbolAccessibilityNotAccessible = 1;
export const SymbolAccessibilityCannotBeNamed = 2;
export const SymbolAccessibilityNotResolved = 3;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/emitresolver.go::constGroup::TypeReferenceSerializationKindUnknown+TypeReferenceSerializationKindTypeWithConstructSignatureAndValue+TypeReferenceSerializationKindVoidNullableOrNeverType+TypeReferenceSerializationKindNumberLikeType+TypeReferenceSerializationKindBigIntLikeType+TypeReferenceSerializationKindStringLikeType+TypeReferenceSerializationKindBooleanType+TypeReferenceSerializationKindArrayLikeType+TypeReferenceSerializationKindESSymbolType+TypeReferenceSerializationKindPromise+TypeReferenceSerializationKindTypeWithCallSignature+TypeReferenceSerializationKindObjectType","kind":"constGroup","status":"implemented","sigHash":"442cdf6d43448bbf5c2ed98442abcfa6d81a7b049fe634fc623d0718ecce6a6d","bodyHash":"71dec1f8d1af06e81a5259d0182bdb623983d4167ba2affe8e823e01a5572487"}
 *
 * Go source:
 * const (
 * 	// The TypeReferenceNode could not be resolved.
 * 	// The type name should be emitted using a safe fallback.
 * 	TypeReferenceSerializationKindUnknown = iota
 *
 * 	// The TypeReferenceNode resolves to a type with a constructor
 * 	// function that can be reached at runtime (e.g. a `class`
 * 	// declaration or a `var` declaration for the static side
 * 	// of a type, such as the global `Promise` type in lib.d.ts).
 * 	TypeReferenceSerializationKindTypeWithConstructSignatureAndValue
 *
 * 	// The TypeReferenceNode resolves to a Void-like, Nullable, or Never type.
 * 	TypeReferenceSerializationKindVoidNullableOrNeverType
 *
 * 	// The TypeReferenceNode resolves to a Number-like type.
 * 	TypeReferenceSerializationKindNumberLikeType
 *
 * 	// The TypeReferenceNode resolves to a BigInt-like type.
 * 	TypeReferenceSerializationKindBigIntLikeType
 *
 * 	// The TypeReferenceNode resolves to a String-like type.
 * 	TypeReferenceSerializationKindStringLikeType
 *
 * 	// The TypeReferenceNode resolves to a Boolean-like type.
 * 	TypeReferenceSerializationKindBooleanType
 *
 * 	// The TypeReferenceNode resolves to an Array-like type.
 * 	TypeReferenceSerializationKindArrayLikeType
 *
 * 	// The TypeReferenceNode resolves to the ESSymbol type.
 * 	TypeReferenceSerializationKindESSymbolType
 *
 * 	// The TypeReferenceNode resolved to the global Promise constructor symbol.
 * 	TypeReferenceSerializationKindPromise
 *
 * 	// The TypeReferenceNode resolves to a Function type or a type with call signatures.
 * 	TypeReferenceSerializationKindTypeWithCallSignature
 *
 * 	// The TypeReferenceNode resolves to any other type.
 * 	TypeReferenceSerializationKindObjectType
 * )
 */
export const TypeReferenceSerializationKindUnknown = 0;
export const TypeReferenceSerializationKindTypeWithConstructSignatureAndValue = 1;
export const TypeReferenceSerializationKindVoidNullableOrNeverType = 2;
export const TypeReferenceSerializationKindNumberLikeType = 3;
export const TypeReferenceSerializationKindBigIntLikeType = 4;
export const TypeReferenceSerializationKindStringLikeType = 5;
export const TypeReferenceSerializationKindBooleanType = 6;
export const TypeReferenceSerializationKindArrayLikeType = 7;
export const TypeReferenceSerializationKindESSymbolType = 8;
export const TypeReferenceSerializationKindPromise = 9;
export const TypeReferenceSerializationKindTypeWithCallSignature = 10;
export const TypeReferenceSerializationKindObjectType = 11;
//# sourceMappingURL=emitresolver.js.map