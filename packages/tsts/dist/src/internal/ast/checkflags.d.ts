import type { int, uint } from "@tsonic/core/types.js";
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/checkflags.go::type::CheckFlags","kind":"type","status":"implemented","sigHash":"8783fe522e6fb728eda21975eac65cc4e65e974800f115a4801bc8cffe63fa24","bodyHash":"bc5b0aaffe170f45300b26c2000cf73afff3e70e2b4884987366c08876b2f849"}
 *
 * Go source:
 * CheckFlags uint32
 */
export type CheckFlags = uint;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/checkflags.go::constGroup::CheckFlagsNone+CheckFlagsInstantiated+CheckFlagsSyntheticProperty+CheckFlagsSyntheticMethod+CheckFlagsReadonly+CheckFlagsReadPartial+CheckFlagsWritePartial+CheckFlagsHasNonUniformType+CheckFlagsHasLiteralType+CheckFlagsContainsPublic+CheckFlagsContainsProtected+CheckFlagsContainsPrivate+CheckFlagsContainsStatic+CheckFlagsLate+CheckFlagsReverseMapped+CheckFlagsOptionalParameter+CheckFlagsRestParameter+CheckFlagsDeferredType+CheckFlagsHasNeverType+CheckFlagsMapped+CheckFlagsStripOptional+CheckFlagsUnresolved+CheckFlagsIsDiscriminantComputed+CheckFlagsIsDiscriminant+CheckFlagsIndexSymbol+CheckFlagsSynthetic+CheckFlagsNonUniformAndLiteral+CheckFlagsPartial","kind":"constGroup","status":"implemented","sigHash":"57e1c6ccbeb0fdd2def846a1d0a96dbcda51d95c9ae0f4b1b528dff91e62403f","bodyHash":"d47848dd3cc88429023447214b3e07f10a8a65a3fc8819b7dccb30b0002429bc"}
 *
 * Go source:
 * const (
 * 	CheckFlagsNone                   CheckFlags = 0
 * 	CheckFlagsInstantiated           CheckFlags = 1 << 0  // Instantiated symbol
 * 	CheckFlagsSyntheticProperty      CheckFlags = 1 << 1  // Property in union or intersection type
 * 	CheckFlagsSyntheticMethod        CheckFlags = 1 << 2  // Method in union or intersection type
 * 	CheckFlagsReadonly               CheckFlags = 1 << 3  // Readonly transient symbol
 * 	CheckFlagsReadPartial            CheckFlags = 1 << 4  // Synthetic property present in some but not all constituents
 * 	CheckFlagsWritePartial           CheckFlags = 1 << 5  // Synthetic property present in some but only satisfied by an index signature in others
 * 	CheckFlagsHasNonUniformType      CheckFlags = 1 << 6  // Synthetic property with non-uniform type in constituents
 * 	CheckFlagsHasLiteralType         CheckFlags = 1 << 7  // Synthetic property with at least one literal type in constituents
 * 	CheckFlagsContainsPublic         CheckFlags = 1 << 8  // Synthetic property with public constituent(s)
 * 	CheckFlagsContainsProtected      CheckFlags = 1 << 9  // Synthetic property with protected constituent(s)
 * 	CheckFlagsContainsPrivate        CheckFlags = 1 << 10 // Synthetic property with private constituent(s)
 * 	CheckFlagsContainsStatic         CheckFlags = 1 << 11 // Synthetic property with static constituent(s)
 * 	CheckFlagsLate                   CheckFlags = 1 << 12 // Late-bound symbol for a computed property with a dynamic name
 * 	CheckFlagsReverseMapped          CheckFlags = 1 << 13 // Property of reverse-inferred homomorphic mapped type
 * 	CheckFlagsOptionalParameter      CheckFlags = 1 << 14 // Optional parameter
 * 	CheckFlagsRestParameter          CheckFlags = 1 << 15 // Rest parameter
 * 	CheckFlagsDeferredType           CheckFlags = 1 << 16 // Calculation of the type of this symbol is deferred due to processing costs, should be fetched with `getTypeOfSymbolWithDeferredType`
 * 	CheckFlagsHasNeverType           CheckFlags = 1 << 17 // Synthetic property with at least one never type in constituents
 * 	CheckFlagsMapped                 CheckFlags = 1 << 18 // Property of mapped type
 * 	CheckFlagsStripOptional          CheckFlags = 1 << 19 // Strip optionality in mapped property
 * 	CheckFlagsUnresolved             CheckFlags = 1 << 20 // Unresolved type alias symbol
 * 	CheckFlagsIsDiscriminantComputed CheckFlags = 1 << 21 // IsDiscriminant flags has been computed
 * 	CheckFlagsIsDiscriminant         CheckFlags = 1 << 22 // Discriminant property
 * 	CheckFlagsIndexSymbol            CheckFlags = 1 << 23 // Synthetic property created from index signature
 * 	CheckFlagsSynthetic                         = CheckFlagsSyntheticProperty | CheckFlagsSyntheticMethod
 * 	CheckFlagsNonUniformAndLiteral              = CheckFlagsHasNonUniformType | CheckFlagsHasLiteralType
 * 	CheckFlagsPartial                           = CheckFlagsReadPartial | CheckFlagsWritePartial
 * )
 */
export declare const CheckFlagsNone: CheckFlags;
export declare const CheckFlagsInstantiated: CheckFlags;
export declare const CheckFlagsSyntheticProperty: CheckFlags;
export declare const CheckFlagsSyntheticMethod: CheckFlags;
export declare const CheckFlagsReadonly: CheckFlags;
export declare const CheckFlagsReadPartial: CheckFlags;
export declare const CheckFlagsWritePartial: CheckFlags;
export declare const CheckFlagsHasNonUniformType: CheckFlags;
export declare const CheckFlagsHasLiteralType: CheckFlags;
export declare const CheckFlagsContainsPublic: CheckFlags;
export declare const CheckFlagsContainsProtected: CheckFlags;
export declare const CheckFlagsContainsPrivate: CheckFlags;
export declare const CheckFlagsContainsStatic: CheckFlags;
export declare const CheckFlagsLate: CheckFlags;
export declare const CheckFlagsReverseMapped: CheckFlags;
export declare const CheckFlagsOptionalParameter: CheckFlags;
export declare const CheckFlagsRestParameter: CheckFlags;
export declare const CheckFlagsDeferredType: CheckFlags;
export declare const CheckFlagsHasNeverType: CheckFlags;
export declare const CheckFlagsMapped: CheckFlags;
export declare const CheckFlagsStripOptional: CheckFlags;
export declare const CheckFlagsUnresolved: CheckFlags;
export declare const CheckFlagsIsDiscriminantComputed: CheckFlags;
export declare const CheckFlagsIsDiscriminant: CheckFlags;
export declare const CheckFlagsIndexSymbol: CheckFlags;
export declare const CheckFlagsSynthetic: int;
export declare const CheckFlagsNonUniformAndLiteral: int;
export declare const CheckFlagsPartial: int;
//# sourceMappingURL=checkflags.d.ts.map