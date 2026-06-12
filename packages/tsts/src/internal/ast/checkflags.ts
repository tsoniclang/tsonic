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
export const CheckFlagsNone: CheckFlags = 0;
export const CheckFlagsInstantiated: CheckFlags = 1 << 0;
export const CheckFlagsSyntheticProperty: CheckFlags = 1 << 1;
export const CheckFlagsSyntheticMethod: CheckFlags = 1 << 2;
export const CheckFlagsReadonly: CheckFlags = 1 << 3;
export const CheckFlagsReadPartial: CheckFlags = 1 << 4;
export const CheckFlagsWritePartial: CheckFlags = 1 << 5;
export const CheckFlagsHasNonUniformType: CheckFlags = 1 << 6;
export const CheckFlagsHasLiteralType: CheckFlags = 1 << 7;
export const CheckFlagsContainsPublic: CheckFlags = 1 << 8;
export const CheckFlagsContainsProtected: CheckFlags = 1 << 9;
export const CheckFlagsContainsPrivate: CheckFlags = 1 << 10;
export const CheckFlagsContainsStatic: CheckFlags = 1 << 11;
export const CheckFlagsLate: CheckFlags = 1 << 12;
export const CheckFlagsReverseMapped: CheckFlags = 1 << 13;
export const CheckFlagsOptionalParameter: CheckFlags = 1 << 14;
export const CheckFlagsRestParameter: CheckFlags = 1 << 15;
export const CheckFlagsDeferredType: CheckFlags = 1 << 16;
export const CheckFlagsHasNeverType: CheckFlags = 1 << 17;
export const CheckFlagsMapped: CheckFlags = 1 << 18;
export const CheckFlagsStripOptional: CheckFlags = 1 << 19;
export const CheckFlagsUnresolved: CheckFlags = 1 << 20;
export const CheckFlagsIsDiscriminantComputed: CheckFlags = 1 << 21;
export const CheckFlagsIsDiscriminant: CheckFlags = 1 << 22;
export const CheckFlagsIndexSymbol: CheckFlags = 1 << 23;
export const CheckFlagsSynthetic: int = CheckFlagsSyntheticProperty | CheckFlagsSyntheticMethod;
export const CheckFlagsNonUniformAndLiteral: int = CheckFlagsHasNonUniformType | CheckFlagsHasLiteralType;
export const CheckFlagsPartial: int = CheckFlagsReadPartial | CheckFlagsWritePartial;
