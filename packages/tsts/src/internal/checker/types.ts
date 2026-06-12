import type { bool, byte, int, sbyte, uint } from "@tsonic/core/types.js";
import type { GoArray, GoMap, GoPtr, GoSlice } from "../../go/compat.js";
import type { GoInterfaceValue, Node } from "../ast/spine.js";
import { goReceiverKey } from "../ast/spine.js";
import type { ConditionalTypeNodeNode, EntityName, MappedTypeNodeNode } from "../ast/generated/unions.js";
import type { SymbolFlags } from "../ast/generated/flags.js";
import type { NodeId } from "../ast/ids.js";
import type { Symbol as Symbol_62f2f8bf, SymbolTable } from "../ast/symbol.js";
import type { OrderedSet } from "../collections/ordered_set.js";
import type { ScriptTarget } from "../core/compileroptions.js";
import {
  ScriptTargetES2016,
  ScriptTargetES2017,
  ScriptTargetES2018,
  ScriptTargetES2019,
  ScriptTargetES2020,
  ScriptTargetES2021,
  ScriptTargetES2022,
  ScriptTargetESNext,
} from "../core/compileroptions.js";
import type { Tristate } from "../core/tristate.js";
import type { Result } from "../evaluator/evaluator.js";
import type { CacheHashKey, Checker } from "./checker/state.js";
import { isTupleType } from "./checker/state.js";
import type { TypeMapper } from "./mapper.js";
import { ValueToString } from "./utilities.js";

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::type::ParseFlags","kind":"type","status":"implemented","sigHash":"351ebf721cd2754016dc44fcbdf16dc89d33b4fc6a92eed1f9db4696eed47fcd","bodyHash":"ec2c138c6126fd16db739ef0b467090e9d970a145b42a30cb3dfebf6b442776b"}
 *
 * Go source:
 * ParseFlags uint32
 */
export type ParseFlags = uint;

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::constGroup::ParseFlagsNone+ParseFlagsYield+ParseFlagsAwait+ParseFlagsType+ParseFlagsIgnoreMissingOpenBrace+ParseFlagsJSDoc","kind":"constGroup","status":"implemented","sigHash":"c1c0a30e1330ab6084823a9cec03c70fecd0e68844959d06e1c3bb28f6b7c3c3","bodyHash":"304b8d76415a4fb4ebbf1b0bdb9808b96888c28ca1f5ff5da235c83e6e82610a"}
 *
 * Go source:
 * const (
 * 	ParseFlagsNone                   ParseFlags = 0
 * 	ParseFlagsYield                  ParseFlags = 1 << 0
 * 	ParseFlagsAwait                  ParseFlags = 1 << 1
 * 	ParseFlagsType                   ParseFlags = 1 << 2
 * 	ParseFlagsIgnoreMissingOpenBrace ParseFlags = 1 << 4
 * 	ParseFlagsJSDoc                  ParseFlags = 1 << 5
 * )
 */
export const ParseFlagsNone: ParseFlags = 0;
export const ParseFlagsYield: ParseFlags = 1 << 0;
export const ParseFlagsAwait: ParseFlags = 1 << 1;
export const ParseFlagsType: ParseFlags = 1 << 2;
export const ParseFlagsIgnoreMissingOpenBrace: ParseFlags = 1 << 4;
export const ParseFlagsJSDoc: ParseFlags = 1 << 5;

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::type::SignatureKind","kind":"type","status":"implemented","sigHash":"5040fe89b5d9badb5c6b3e59f963a4ddc0b654c7a24d8481500858718b820972","bodyHash":"58ced086295abddef1ae9fb80a027ba24372badaa9b7c3f85b833b22683ffc5c"}
 *
 * Go source:
 * SignatureKind int32
 */
export type SignatureKind = int;

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::constGroup::SignatureKindCall+SignatureKindConstruct","kind":"constGroup","status":"implemented","sigHash":"b80c561477dde1c5424bd41e83faab8d3595115fc22bf8d1b384bbfe29d72e7a","bodyHash":"e225b0415aee3cd5998d2afc86b3cf6a3c09021ea30d36ffb11fd4a5554c3259"}
 *
 * Go source:
 * const (
 * 	SignatureKindCall SignatureKind = iota
 * 	SignatureKindConstruct
 * )
 */
export const SignatureKindCall: SignatureKind = 0;
export const SignatureKindConstruct: SignatureKind = 1;

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::type::ContextFlags","kind":"type","status":"implemented","sigHash":"eb1aba7dd7b2e4341b0b259dc3706d8c910ecffef00cd0d3dba8f93f4f388b07","bodyHash":"da9d50fa9efba7f8a4aaad30fecbcacd03477b39a9761ea659ea4d3a6b458a69"}
 *
 * Go source:
 * ContextFlags uint32
 */
export type ContextFlags = uint;

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::constGroup::ContextFlagsNone+ContextFlagsSignature+ContextFlagsNoConstraints+ContextFlagsIgnoreNodeInferences+ContextFlagsSkipBindingPatterns","kind":"constGroup","status":"implemented","sigHash":"9034bbcd30a8ae567952b360d29a8bec3cdb50caed2dabab7da95435e4f2e761","bodyHash":"c211aacf3c48b059d378a90a8e8d686db5432376ac351abf3dddf210f0ded3c4"}
 *
 * Go source:
 * const (
 * 	ContextFlagsNone                 ContextFlags = 0
 * 	ContextFlagsSignature            ContextFlags = 1 << 0 // Obtaining contextual signature
 * 	ContextFlagsNoConstraints        ContextFlags = 1 << 1 // Don't obtain type variable constraints
 * 	ContextFlagsIgnoreNodeInferences ContextFlags = 1 << 2 // Ignore inference to current node and parent nodes out to the containing call for, for example, completions
 * 	ContextFlagsSkipBindingPatterns  ContextFlags = 1 << 3 // Ignore contextual types applied by binding patterns
 * )
 */
export const ContextFlagsNone: ContextFlags = 0;
export const ContextFlagsSignature: ContextFlags = 1 << 0;
export const ContextFlagsNoConstraints: ContextFlags = 1 << 1;
export const ContextFlagsIgnoreNodeInferences: ContextFlags = 1 << 2;
export const ContextFlagsSkipBindingPatterns: ContextFlags = 1 << 3;

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::type::TypeFormatFlags","kind":"type","status":"implemented","sigHash":"61d945eb8adf5e440dd8345585630bebe48f29624432e341e1fb1d507dea6392","bodyHash":"499d6addc486b23ceebf24a36101f8e4959ec553d00a9fc6094bef75c3cebb52"}
 *
 * Go source:
 * TypeFormatFlags uint32
 */
export type TypeFormatFlags = uint;

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::constGroup::TypeFormatFlagsNone+TypeFormatFlagsNoTruncation+TypeFormatFlagsWriteArrayAsGenericType+TypeFormatFlagsGenerateNamesForShadowedTypeParams+TypeFormatFlagsUseStructuralFallback+TypeFormatFlagsWriteTypeArgumentsOfSignature+TypeFormatFlagsUseFullyQualifiedType+TypeFormatFlagsSuppressAnyReturnType+TypeFormatFlagsMultilineObjectLiterals+TypeFormatFlagsWriteClassExpressionAsTypeLiteral+TypeFormatFlagsUseTypeOfFunction+TypeFormatFlagsOmitParameterModifiers+TypeFormatFlagsUseAliasDefinedOutsideCurrentScope+TypeFormatFlagsUseSingleQuotesForStringLiteralType+TypeFormatFlagsNoTypeReduction+TypeFormatFlagsUseInstantiationExpressions+TypeFormatFlagsOmitThisParameter+TypeFormatFlagsWriteCallStyleSignature+TypeFormatFlagsAllowUniqueESSymbolType+TypeFormatFlagsAddUndefined+TypeFormatFlagsWriteArrowStyleSignature+TypeFormatFlagsInArrayType+TypeFormatFlagsInElementType+TypeFormatFlagsInFirstTypeArgument+TypeFormatFlagsInTypeAlias","kind":"constGroup","status":"implemented","sigHash":"b7b6208447ec2e7eced952ed3b794c15a545fad5d1752b9eaf3411323dc18f9a","bodyHash":"79b5350af2c1ff5c841a7e09df488ce9505ab56f4938de383dce8b3cf3ae929e"}
 *
 * Go source:
 * const (
 * 	TypeFormatFlagsNone                               TypeFormatFlags = 0
 * 	TypeFormatFlagsNoTruncation                       TypeFormatFlags = 1 << 0 // Don't truncate typeToString result
 * 	TypeFormatFlagsWriteArrayAsGenericType            TypeFormatFlags = 1 << 1 // Write Array<T> instead T[]
 * 	TypeFormatFlagsGenerateNamesForShadowedTypeParams TypeFormatFlags = 1 << 2 // When a type parameter T is shadowing another T, generate a name for it so it can still be referenced
 * 	TypeFormatFlagsUseStructuralFallback              TypeFormatFlags = 1 << 3 // When an alias cannot be named by its symbol, rather than report an error, fallback to a structural printout if possible
 * 	// hole because there's a hole in node builder flags
 * 	TypeFormatFlagsWriteTypeArgumentsOfSignature TypeFormatFlags = 1 << 5 // Write the type arguments instead of type parameters of the signature
 * 	TypeFormatFlagsUseFullyQualifiedType         TypeFormatFlags = 1 << 6 // Write out the fully qualified type name (eg. Module.Type, instead of Type)
 * 	// hole because `UseOnlyExternalAliasing` is here in node builder flags, but functions which take old flags use `SymbolFormatFlags` instead
 * 	TypeFormatFlagsSuppressAnyReturnType TypeFormatFlags = 1 << 8 // If the return type is any-like, don't offer a return type.
 * 	// hole because `WriteTypeParametersInQualifiedName` is here in node builder flags, but functions which take old flags use `SymbolFormatFlags` for this instead
 * 	TypeFormatFlagsMultilineObjectLiterals             TypeFormatFlags = 1 << 10 // Always print object literals across multiple lines (only used to map into node builder flags)
 * 	TypeFormatFlagsWriteClassExpressionAsTypeLiteral   TypeFormatFlags = 1 << 11 // Write a type literal instead of (Anonymous class)
 * 	TypeFormatFlagsUseTypeOfFunction                   TypeFormatFlags = 1 << 12 // Write typeof instead of function type literal
 * 	TypeFormatFlagsOmitParameterModifiers              TypeFormatFlags = 1 << 13 // Omit modifiers on parameters
 * 	TypeFormatFlagsUseAliasDefinedOutsideCurrentScope  TypeFormatFlags = 1 << 14 // For a `type T = ... ` defined in a different file, write `T` instead of its value, even though `T` can't be accessed in the current scope.
 * 	TypeFormatFlagsUseSingleQuotesForStringLiteralType TypeFormatFlags = 1 << 28 // Use single quotes for string literal type
 * 	TypeFormatFlagsNoTypeReduction                     TypeFormatFlags = 1 << 29 // Don't call getReducedType
 * 	TypeFormatFlagsUseInstantiationExpressions         TypeFormatFlags = 1 << 30 // Use instantiation expressions for qualified instantiated names like Foo<string>.Bar
 * 	TypeFormatFlagsOmitThisParameter                   TypeFormatFlags = 1 << 25
 * 	TypeFormatFlagsWriteCallStyleSignature             TypeFormatFlags = 1 << 27 // Write construct signatures as call style signatures
 * 	// Error Handling
 * 	TypeFormatFlagsAllowUniqueESSymbolType TypeFormatFlags = 1 << 20 // This is bit 20 to align with the same bit in `NodeBuilderFlags`
 * 	// TypeFormatFlags exclusive
 * 	TypeFormatFlagsAddUndefined             TypeFormatFlags = 1 << 17 // Add undefined to types of initialized, non-optional parameters
 * 	TypeFormatFlagsWriteArrowStyleSignature TypeFormatFlags = 1 << 18 // Write arrow style signature
 * 	// State
 * 	TypeFormatFlagsInArrayType         TypeFormatFlags = 1 << 19 // Writing an array element type
 * 	TypeFormatFlagsInElementType       TypeFormatFlags = 1 << 21 // Writing an array or union element type
 * 	TypeFormatFlagsInFirstTypeArgument TypeFormatFlags = 1 << 22 // Writing first type argument of the instantiated type
 * 	TypeFormatFlagsInTypeAlias         TypeFormatFlags = 1 << 23 // Writing type in type alias declaration
 * )
 */
export const TypeFormatFlagsNone: TypeFormatFlags = 0;
export const TypeFormatFlagsNoTruncation: TypeFormatFlags = 1 << 0;
export const TypeFormatFlagsWriteArrayAsGenericType: TypeFormatFlags = 1 << 1;
export const TypeFormatFlagsGenerateNamesForShadowedTypeParams: TypeFormatFlags = 1 << 2;
export const TypeFormatFlagsUseStructuralFallback: TypeFormatFlags = 1 << 3;
export const TypeFormatFlagsWriteTypeArgumentsOfSignature: TypeFormatFlags = 1 << 5;
export const TypeFormatFlagsUseFullyQualifiedType: TypeFormatFlags = 1 << 6;
export const TypeFormatFlagsSuppressAnyReturnType: TypeFormatFlags = 1 << 8;
export const TypeFormatFlagsMultilineObjectLiterals: TypeFormatFlags = 1 << 10;
export const TypeFormatFlagsWriteClassExpressionAsTypeLiteral: TypeFormatFlags = 1 << 11;
export const TypeFormatFlagsUseTypeOfFunction: TypeFormatFlags = 1 << 12;
export const TypeFormatFlagsOmitParameterModifiers: TypeFormatFlags = 1 << 13;
export const TypeFormatFlagsUseAliasDefinedOutsideCurrentScope: TypeFormatFlags = 1 << 14;
export const TypeFormatFlagsUseSingleQuotesForStringLiteralType: TypeFormatFlags = 1 << 28;
export const TypeFormatFlagsNoTypeReduction: TypeFormatFlags = 1 << 29;
export const TypeFormatFlagsUseInstantiationExpressions: TypeFormatFlags = 1 << 30;
export const TypeFormatFlagsOmitThisParameter: TypeFormatFlags = 1 << 25;
export const TypeFormatFlagsWriteCallStyleSignature: TypeFormatFlags = 1 << 27;
export const TypeFormatFlagsAllowUniqueESSymbolType: TypeFormatFlags = 1 << 20;
export const TypeFormatFlagsAddUndefined: TypeFormatFlags = 1 << 17;
export const TypeFormatFlagsWriteArrowStyleSignature: TypeFormatFlags = 1 << 18;
export const TypeFormatFlagsInArrayType: TypeFormatFlags = 1 << 19;
export const TypeFormatFlagsInElementType: TypeFormatFlags = 1 << 21;
export const TypeFormatFlagsInFirstTypeArgument: TypeFormatFlags = 1 << 22;
export const TypeFormatFlagsInTypeAlias: TypeFormatFlags = 1 << 23;

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::constGroup::TypeFormatFlagsNodeBuilderFlagsMask","kind":"constGroup","status":"implemented","sigHash":"552fd4c502bfd3aab7d7945a722a4e3c92ddb8fccba1f57d8e8dbc36c5867e5e","bodyHash":"664db6b1dec97fa5576d77e69819eff33591368ae45deefa40efe1934b6554a1"}
 *
 * Go source:
 * const TypeFormatFlagsNodeBuilderFlagsMask = TypeFormatFlagsNoTruncation | TypeFormatFlagsWriteArrayAsGenericType | TypeFormatFlagsGenerateNamesForShadowedTypeParams | TypeFormatFlagsUseStructuralFallback | TypeFormatFlagsWriteTypeArgumentsOfSignature |
 * 	TypeFormatFlagsUseFullyQualifiedType | TypeFormatFlagsSuppressAnyReturnType | TypeFormatFlagsMultilineObjectLiterals | TypeFormatFlagsWriteClassExpressionAsTypeLiteral |
 * 	TypeFormatFlagsUseTypeOfFunction | TypeFormatFlagsOmitParameterModifiers | TypeFormatFlagsUseAliasDefinedOutsideCurrentScope | TypeFormatFlagsAllowUniqueESSymbolType | TypeFormatFlagsInTypeAlias |
 * 	TypeFormatFlagsUseInstantiationExpressions |
 * 	TypeFormatFlagsUseSingleQuotesForStringLiteralType | TypeFormatFlagsNoTypeReduction | TypeFormatFlagsOmitThisParameter
 */
export const TypeFormatFlagsNodeBuilderFlagsMask: int =
  TypeFormatFlagsNoTruncation |
  TypeFormatFlagsWriteArrayAsGenericType |
  TypeFormatFlagsGenerateNamesForShadowedTypeParams |
  TypeFormatFlagsUseStructuralFallback |
  TypeFormatFlagsWriteTypeArgumentsOfSignature |
  TypeFormatFlagsUseFullyQualifiedType |
  TypeFormatFlagsSuppressAnyReturnType |
  TypeFormatFlagsMultilineObjectLiterals |
  TypeFormatFlagsWriteClassExpressionAsTypeLiteral |
  TypeFormatFlagsUseTypeOfFunction |
  TypeFormatFlagsOmitParameterModifiers |
  TypeFormatFlagsUseAliasDefinedOutsideCurrentScope |
  TypeFormatFlagsAllowUniqueESSymbolType |
  TypeFormatFlagsInTypeAlias |
  TypeFormatFlagsUseInstantiationExpressions |
  TypeFormatFlagsUseSingleQuotesForStringLiteralType |
  TypeFormatFlagsNoTypeReduction |
  TypeFormatFlagsOmitThisParameter;

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::type::SymbolFormatFlags","kind":"type","status":"implemented","sigHash":"6e0a266c281751e0f20860bb8a07d9ea817fb98f2f50c44cfce2906f55c44261","bodyHash":"635b36267f3172fac7baf6bbdf7c5e978554bc88cfd0a83960efb6f043e601e0"}
 *
 * Go source:
 * SymbolFormatFlags uint32
 */
export type SymbolFormatFlags = uint;

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::constGroup::SymbolFormatFlagsNone+SymbolFormatFlagsWriteTypeParametersOrArguments+SymbolFormatFlagsUseOnlyExternalAliasing+SymbolFormatFlagsAllowAnyNodeKind+SymbolFormatFlagsUseAliasDefinedOutsideCurrentScope+SymbolFormatFlagsWriteComputedProps+SymbolFormatFlagsDoNotIncludeSymbolChain","kind":"constGroup","status":"implemented","sigHash":"2090027a4340072c37edd8e1dbdc2d55a25573a12b04b7474c4059e72540b656","bodyHash":"bbea4353b1049eeeefd1deb8686ab045b536497d5b978ce7a12c489a20606e2c"}
 *
 * Go source:
 * const (
 * 	SymbolFormatFlagsNone SymbolFormatFlags = 0
 * 	// Write symbols's type argument if it is instantiated symbol
 * 	// eg. class C<T> { p: T }   <-- Show p as C<T>.p here
 * 	//     var a: C<number>;
 * 	//     var p = a.p; <--- Here p is property of C<number> so show it as C<number>.p instead of just C.p
 * 	SymbolFormatFlagsWriteTypeParametersOrArguments SymbolFormatFlags = 1 << 0
 * 	// Use only external alias information to get the symbol name in the given context
 * 	// eg.  module m { export class c { } } import x = m.c;
 * 	// When this flag is specified m.c will be used to refer to the class instead of alias symbol x
 * 	SymbolFormatFlagsUseOnlyExternalAliasing SymbolFormatFlags = 1 << 1
 * 	// Build symbol name using any nodes needed, instead of just components of an entity name
 * 	SymbolFormatFlagsAllowAnyNodeKind SymbolFormatFlags = 1 << 2
 * 	// Prefer aliases which are not directly visible
 * 	SymbolFormatFlagsUseAliasDefinedOutsideCurrentScope SymbolFormatFlags = 1 << 3
 * 	// { [E.A]: 1 }
 * 	/** @internal * /
 * 	SymbolFormatFlagsWriteComputedProps SymbolFormatFlags = 1 << 4
 * 	// Skip building an accessible symbol chain
 * 	/** @internal * /
 * 	SymbolFormatFlagsDoNotIncludeSymbolChain SymbolFormatFlags = 1 << 5
 * )
 */
export const SymbolFormatFlagsNone: SymbolFormatFlags = 0;
export const SymbolFormatFlagsWriteTypeParametersOrArguments: SymbolFormatFlags = 1 << 0;
export const SymbolFormatFlagsUseOnlyExternalAliasing: SymbolFormatFlags = 1 << 1;
export const SymbolFormatFlagsAllowAnyNodeKind: SymbolFormatFlags = 1 << 2;
export const SymbolFormatFlagsUseAliasDefinedOutsideCurrentScope: SymbolFormatFlags = 1 << 3;
export const SymbolFormatFlagsWriteComputedProps: SymbolFormatFlags = 1 << 4;
export const SymbolFormatFlagsDoNotIncludeSymbolChain: SymbolFormatFlags = 1 << 5;

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::type::TypeId","kind":"type","status":"implemented","sigHash":"d668dd6b5968591e5c5613cca2d2be3143ae2409565fe3e7511b04dc47b31a91","bodyHash":"c917c67ee6facc506c65f8fca44f5f54a27d38c4388b43560967f8add59893e5"}
 *
 * Go source:
 * TypeId uint32
 */
export type TypeId = uint;

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::type::SymbolReferenceLinks","kind":"type","status":"implemented","sigHash":"63c0b9194c48be0467d0a3aeb8714daae75e2ec3b595bf6d37c35119744da7ee","bodyHash":"df6b2920d00f1f72f3894d1714351bf4d547ba855b1c186ad2d051ce55fffebf"}
 *
 * Go source:
 * SymbolReferenceLinks struct {
 * 	referenceKinds ast.SymbolFlags // Flags for the meanings of the symbol that were referenced
 * }
 */
export interface SymbolReferenceLinks {
  referenceKinds: SymbolFlags;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::type::ValueSymbolLinks","kind":"type","status":"implemented","sigHash":"cd1e1ae881d5f54928b2653f4bba62a9f0d9eecb49c78e255ab2d6843c67046f","bodyHash":"1cf25825d8f5476f6c3afb929a9010811f5e2f37accf06563d8795360c5bc461"}
 *
 * Go source:
 * ValueSymbolLinks struct {
 * 	resolvedType                 *Type // Type of value symbol
 * 	writeType                    *Type
 * 	target                       *ast.Symbol
 * 	mapper                       *TypeMapper
 * 	nameType                     *Type
 * 	containingType               *Type // Mapped type for mapped type property, containing union or intersection type for synthetic property
 * 	functionOrConstructorChecked bool
 * }
 */
export interface ValueSymbolLinks {
  resolvedType: GoPtr<Type>;
  writeType: GoPtr<Type>;
  target: GoPtr<Symbol_62f2f8bf>;
  mapper: GoPtr<TypeMapper>;
  nameType: GoPtr<Type>;
  containingType: GoPtr<Type>;
  functionOrConstructorChecked: bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::type::MappedSymbolLinks","kind":"type","status":"implemented","sigHash":"9931466f3fccbf6d1a103006b34cc4f536347dac878180f13ba7c0386b5d06f3","bodyHash":"eca7060b712787861a88e6b5a9bd7fdf9ff0a470790ef19e1bc2cba375e3d026"}
 *
 * Go source:
 * MappedSymbolLinks struct {
 * 	keyType         *Type       // Key type for mapped type member
 * 	syntheticOrigin *ast.Symbol // For a property on a mapped or spread type, points back to the original property
 * }
 */
export interface MappedSymbolLinks {
  keyType: GoPtr<Type>;
  syntheticOrigin: GoPtr<Symbol_62f2f8bf>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::type::DeferredSymbolLinks","kind":"type","status":"implemented","sigHash":"72320f70c145740d6df7473148a738de974743ba2583eb1e4085113a5655e519","bodyHash":"b242be7517104d64adebe1da9331c79d46365274a4852b012b11623880ef0cde"}
 *
 * Go source:
 * DeferredSymbolLinks struct {
 * 	parent            *Type   // Source union/intersection of a deferred type
 * 	constituents      []*Type // Calculated list of constituents for a deferred type
 * 	writeConstituents []*Type // Constituents of a deferred `writeType`
 * }
 */
export interface DeferredSymbolLinks {
  parent: GoPtr<Type>;
  constituents: GoSlice<GoPtr<Type>>;
  writeConstituents: GoSlice<GoPtr<Type>>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::type::AliasSymbolLinks","kind":"type","status":"implemented","sigHash":"2382f765aa7550658e62ca026e5ae05e6b85aeb5330acd2f4d3843d948d97bb6","bodyHash":"c72aaf0fa7b15e17301de8ca8c1983331d7378eca2abda2d5d2508a2e3eaad2e"}
 *
 * Go source:
 * AliasSymbolLinks struct {
 * 	immediateTarget     *ast.Symbol // Immediate target of an alias. May be another alias. Do not access directly, use `checker.getImmediateAliasedSymbol` instead.
 * 	aliasTarget         *ast.Symbol // Resolved (non-alias) target of an alias
 * 	referenced          bool        // True if alias symbol has been referenced as a value that can be emitted
 * 	typeOnlyDeclaration *ast.Node   // First resolved alias declaration that makes the symbol only usable in type constructs
 * }
 */
export interface AliasSymbolLinks {
  immediateTarget: GoPtr<Symbol_62f2f8bf>;
  aliasTarget: GoPtr<Symbol_62f2f8bf>;
  referenced: bool;
  typeOnlyDeclaration: GoPtr<Node>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::type::ModuleSymbolLinks","kind":"type","status":"implemented","sigHash":"0562a62618d9e8ba3150e5162b811ca69dcef3c4f680f7ea4bd016e6458b58cd","bodyHash":"5dce7ab5d79605a40ef5990b7889ca43c4bc8ab2463d3b9f99e64808bb24d7d8"}
 *
 * Go source:
 * ModuleSymbolLinks struct {
 * 	resolvedExports       ast.SymbolTable      // Resolved exports of module or combined early- and late-bound static members of a class.
 * 	typeOnlyExportStarMap map[string]*ast.Node // Set on a module symbol when some of its exports were resolved through a 'export type * from "mod"' declaration
 * 	exportsChecked        bool
 * }
 */
export interface ModuleSymbolLinks {
  resolvedExports: SymbolTable;
  typeOnlyExportStarMap: GoPtr<GoMap<string, GoPtr<Node>>>;
  exportsChecked: bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::type::ReverseMappedSymbolLinks","kind":"type","status":"implemented","sigHash":"9611cbf5197ab9a1026e66ed8cb861f4b7974ed8c6cc42c4e78aacd21ad8778b","bodyHash":"45f010a5576725c76c5945c54f8e5ef9a11776b35d7ed5472f51bef6086eb948"}
 *
 * Go source:
 * ReverseMappedSymbolLinks struct {
 * 	propertyType   *Type
 * 	mappedType     *Type // References a mapped type
 * 	constraintType *Type // References an index type
 * }
 */
export interface ReverseMappedSymbolLinks {
  propertyType: GoPtr<Type>;
  mappedType: GoPtr<Type>;
  constraintType: GoPtr<Type>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::type::LateBoundLinks","kind":"type","status":"implemented","sigHash":"01d6c52d6793211737721909a54924cc99e595ff61279f62bbdaa4767155cd20","bodyHash":"f8154a54a78a340e92e023e660fc7c6b41352e3ed3525a2df642ba749171cc33"}
 *
 * Go source:
 * LateBoundLinks struct {
 * 	lateSymbol *ast.Symbol
 * }
 */
export interface LateBoundLinks {
  lateSymbol: GoPtr<Symbol_62f2f8bf>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::type::ExportTypeLinks","kind":"type","status":"implemented","sigHash":"1dcf5d66b7265b22df9b8c9d22dc8a6f85759ef6290e07b046a11afaef04db6c","bodyHash":"549cc1f8ff0ab366e89c70f34d8b40bcfb90ab9a9ce7f74999e8704de0cc95ee"}
 *
 * Go source:
 * ExportTypeLinks struct {
 * 	target            *ast.Symbol // Target symbol
 * 	originatingImport *ast.Node   // Import declaration which produced the symbol, present if the symbol is marked as uncallable but had call signatures in `resolveESModuleSymbol`
 * }
 */
export interface ExportTypeLinks {
  target: GoPtr<Symbol_62f2f8bf>;
  originatingImport: GoPtr<Node>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::type::TypeAliasLinks","kind":"type","status":"implemented","sigHash":"ab4b0620979030f322a011e203c8bc0ebf5a9258ffb933f2ed37b7c5245216e0","bodyHash":"80469d6a75a0cbcdf7e82cee18f5ce3ba53fa313fc7d139a2c3d19014feac264"}
 *
 * Go source:
 * TypeAliasLinks struct {
 * 	declaredType                  *Type
 * 	typeParameters                []*Type                // Type parameters of type alias (undefined if non-generic)
 * 	instantiations                map[CacheHashKey]*Type // Instantiations of generic type alias (undefined if non-generic)
 * 	isConstructorDeclaredProperty bool
 * }
 */
export interface TypeAliasLinks {
  declaredType: GoPtr<Type>;
  typeParameters: GoSlice<GoPtr<Type>>;
  instantiations: GoMap<CacheHashKey, GoPtr<Type>>;
  isConstructorDeclaredProperty: bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::type::DeclaredTypeLinks","kind":"type","status":"implemented","sigHash":"96aa0fe094abea887fa7483eefc3d98b540e2eb5d1e6eecdcfe66a630a78ce39","bodyHash":"cb71d636ce4b9cf3a9669c3153a72a5703766f08d4f3cd4845427143982f5a97"}
 *
 * Go source:
 * DeclaredTypeLinks struct {
 * 	declaredType           *Type
 * 	interfaceChecked       bool
 * 	indexSignaturesChecked bool
 * 	typeParametersChecked  bool
 * 	enumChecked            bool
 * }
 */
export interface DeclaredTypeLinks {
  declaredType: GoPtr<Type>;
  interfaceChecked: bool;
  indexSignaturesChecked: bool;
  typeParametersChecked: bool;
  enumChecked: bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::type::ExhaustiveState","kind":"type","status":"implemented","sigHash":"f14b7f271c04cf96a640bb579b581c062fc14426802790a466f3610d803f2f59","bodyHash":"2ed24226352508f5ed6f209cf360a90e818f712e08815dca1bde618dec385aba"}
 *
 * Go source:
 * ExhaustiveState byte
 */
export type ExhaustiveState = byte;

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::constGroup::ExhaustiveStateUnknown+ExhaustiveStateComputing+ExhaustiveStateFalse+ExhaustiveStateTrue","kind":"constGroup","status":"implemented","sigHash":"f1dec9836acfed71718429224dacd81c05322c477a25da5ee051fb8bafc9f3a8","bodyHash":"e09c796b62051e6a164d1142c8d7aa5b164b5f877a238558032967cd9f3eb508"}
 *
 * Go source:
 * const (
 * 	ExhaustiveStateUnknown   ExhaustiveState = iota // Exhaustive state not computed
 * 	ExhaustiveStateComputing                        // Exhaustive state computation in progress
 * 	ExhaustiveStateFalse                            // Switch statement is not exhaustive
 * 	ExhaustiveStateTrue                             // Switch statement is exhaustive
 * )
 */
export const ExhaustiveStateUnknown: ExhaustiveState = 0;
export const ExhaustiveStateComputing: ExhaustiveState = 1;
export const ExhaustiveStateFalse: ExhaustiveState = 2;
export const ExhaustiveStateTrue: ExhaustiveState = 3;

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::type::SwitchStatementLinks","kind":"type","status":"implemented","sigHash":"5712ff63334a4a4c3edaca3ffa03f5d82858a32157f34642cf04a9ab8aedd03a","bodyHash":"1ddb1f4f2baab1210d28ba540bbf605ebac6b5b066968f28181a9cce74b86657"}
 *
 * Go source:
 * SwitchStatementLinks struct {
 * 	exhaustiveState     ExhaustiveState // Switch statement exhaustiveness
 * 	switchTypesComputed bool
 * 	witnessesComputed   bool
 * 	switchTypes         []*Type
 * 	witnesses           []string
 * }
 */
export interface SwitchStatementLinks {
  exhaustiveState: ExhaustiveState;
  switchTypesComputed: bool;
  witnessesComputed: bool;
  switchTypes: GoSlice<GoPtr<Type>>;
  witnesses: GoSlice<string>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::type::ArrayLiteralLinks","kind":"type","status":"implemented","sigHash":"fa3c94556cf92a171667be3e6eb78a290b02ceb1aea760a38ff89f94666f2dc3","bodyHash":"6dc5956326d5f1dca9a834f3da018da1e6c5c1913ab20632fe820d6d44433587"}
 *
 * Go source:
 * ArrayLiteralLinks struct {
 * 	indicesComputed  bool
 * 	firstSpreadIndex int // Index of first spread expression (or -1 if none)
 * 	lastSpreadIndex  int // Index of last spread expression (or -1 if none)
 * }
 */
export interface ArrayLiteralLinks {
  indicesComputed: bool;
  firstSpreadIndex: int;
  lastSpreadIndex: int;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::type::MembersOrExportsResolutionKind","kind":"type","status":"implemented","sigHash":"c73015f71a7f9de5d658e85806ddf85c8a1c36f632c66f05735d0322f4fd983b","bodyHash":"c502aeb871c63e882ebaa3ab7e04ebbd9e63df01059d0451ac6457e36b970a91"}
 *
 * Go source:
 * MembersOrExportsResolutionKind int
 */
export type MembersOrExportsResolutionKind = int;

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::constGroup::MembersOrExportsResolutionKindResolvedExports+MembersOrExportsResolutionKindResolvedMembers","kind":"constGroup","status":"implemented","sigHash":"187f7e9d2011030d1eafec863e9bc4743360489acda77fe4ec55818c5e7fbeed","bodyHash":"06370d06c8eb2b8ececcf8ed23b3d7fa7e5f9659f1ec589944e826b5e9e50776"}
 *
 * Go source:
 * const (
 * 	MembersOrExportsResolutionKindResolvedExports MembersOrExportsResolutionKind = 0
 * 	MembersOrExportsResolutionKindResolvedMembers MembersOrExportsResolutionKind = 1
 * )
 */
export const MembersOrExportsResolutionKindResolvedExports: MembersOrExportsResolutionKind = 0;
export const MembersOrExportsResolutionKindResolvedMembers: MembersOrExportsResolutionKind = 1;

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::type::MembersAndExportsLinks","kind":"type","status":"implemented","sigHash":"1dd656697c25eb49748aef278b35eb24bfa01d4d3fc12f42c29adf0fa4635204","bodyHash":"451cb96ddbfc1c422c2f421631131bf0553d5a41db5519ab711bfe2e2f2079d3"}
 *
 * Go source:
 * MembersAndExportsLinks [2]ast.SymbolTable
 */
export type MembersAndExportsLinks = GoArray<SymbolTable, "2">;

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::type::SpreadLinks","kind":"type","status":"implemented","sigHash":"1c992f97e091eeed457c350946cb8abeb7b629381d4d92bebce697bf6cc958f7","bodyHash":"46defd26aa9e28b1c58fad76e068a0f1970f567ce7799327904f083efe45fa20"}
 *
 * Go source:
 * SpreadLinks struct {
 * 	leftSpread  *ast.Symbol // Left source for synthetic spread property
 * 	rightSpread *ast.Symbol // Right source for synthetic spread property
 * }
 */
export interface SpreadLinks {
  leftSpread: GoPtr<Symbol_62f2f8bf>;
  rightSpread: GoPtr<Symbol_62f2f8bf>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::type::VarianceLinks","kind":"type","status":"implemented","sigHash":"67711eb1af6828630d933ceee7f73dcba446b405b41b66df535ace87288f48e1","bodyHash":"6415f441457fef12a9da408b26f1d349dddb072385f6f06c9515ae94daebcb5e"}
 *
 * Go source:
 * VarianceLinks struct {
 * 	variances []VarianceFlags
 * }
 */
export interface VarianceLinks {
  variances: GoSlice<VarianceFlags>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::type::VarianceFlags","kind":"type","status":"implemented","sigHash":"e58bc9aa0312d4acaa5b9623612e2f8361a48a22f180414597249da8c1d9ab60","bodyHash":"dafbe2eb10b346350e8407ff15809ad3191c41a1f9dbe9f707ef779243824564"}
 *
 * Go source:
 * VarianceFlags uint32
 */
export type VarianceFlags = uint;

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::constGroup::VarianceFlagsInvariant+VarianceFlagsCovariant+VarianceFlagsContravariant+VarianceFlagsBivariant+VarianceFlagsIndependent+VarianceFlagsVarianceMask+VarianceFlagsUnmeasurable+VarianceFlagsUnreliable+VarianceFlagsAllowsStructuralFallback","kind":"constGroup","status":"implemented","sigHash":"6da7bd90835c94d51e05bb2a23ef313065331916fe2b77c9478d71036e644341","bodyHash":"153ac08f1e7ce50f230e6253adf0a106f1a330a841a79396c91529febbd66dca"}
 *
 * Go source:
 * const (
 * 	VarianceFlagsInvariant                VarianceFlags = 0                                                                                                       // Neither covariant nor contravariant
 * 	VarianceFlagsCovariant                VarianceFlags = 1 << 0                                                                                                  // Covariant
 * 	VarianceFlagsContravariant            VarianceFlags = 1 << 1                                                                                                  // Contravariant
 * 	VarianceFlagsBivariant                VarianceFlags = VarianceFlagsCovariant | VarianceFlagsContravariant                                                     // Both covariant and contravariant
 * 	VarianceFlagsIndependent              VarianceFlags = 1 << 2                                                                                                  // Unwitnessed type parameter
 * 	VarianceFlagsVarianceMask             VarianceFlags = VarianceFlagsInvariant | VarianceFlagsCovariant | VarianceFlagsContravariant | VarianceFlagsIndependent // Mask containing all measured variances without the unmeasurable flag
 * 	VarianceFlagsUnmeasurable             VarianceFlags = 1 << 3                                                                                                  // Variance result is unusable - relationship relies on structural comparisons which are not reflected in generic relationships
 * 	VarianceFlagsUnreliable               VarianceFlags = 1 << 4                                                                                                  // Variance result is unreliable - checking may produce false negatives, but not false positives
 * 	VarianceFlagsAllowsStructuralFallback               = VarianceFlagsUnmeasurable | VarianceFlagsUnreliable
 * )
 */
export const VarianceFlagsInvariant: VarianceFlags = 0;
export const VarianceFlagsCovariant: VarianceFlags = 1 << 0;
export const VarianceFlagsContravariant: VarianceFlags = 1 << 1;
export const VarianceFlagsBivariant: VarianceFlags = VarianceFlagsCovariant | VarianceFlagsContravariant;
export const VarianceFlagsIndependent: VarianceFlags = 1 << 2;
export const VarianceFlagsVarianceMask: VarianceFlags =
  VarianceFlagsInvariant | VarianceFlagsCovariant | VarianceFlagsContravariant | VarianceFlagsIndependent;
export const VarianceFlagsUnmeasurable: VarianceFlags = 1 << 3;
export const VarianceFlagsUnreliable: VarianceFlags = 1 << 4;
export const VarianceFlagsAllowsStructuralFallback: int = VarianceFlagsUnmeasurable | VarianceFlagsUnreliable;

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::type::MarkedAssignmentSymbolLinks","kind":"type","status":"implemented","sigHash":"a1edd3b0155b4555e9e68c8e58b5045653059808fa1bedde3391c95865d93f23","bodyHash":"62deb588e15217b368c23fa93e1c4dfdcdddd3e846fd10a646a0f5e7e06d143a"}
 *
 * Go source:
 * MarkedAssignmentSymbolLinks struct {
 * 	lastAssignmentPos     int32
 * 	hasDefiniteAssignment bool // Symbol is definitely assigned somewhere
 * }
 */
export interface MarkedAssignmentSymbolLinks {
  lastAssignmentPos: int;
  hasDefiniteAssignment: bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::type::accessibleChainCacheKey","kind":"type","status":"implemented","sigHash":"1db64ba827cb1588eb0481642160db7ea0bfc5bd93c68bf27488555cdfbc4c06","bodyHash":"609fa96a76a3cedd29b3e24ff9f6a5cd38e0207abfb5762c192d377c55028711"}
 *
 * Go source:
 * accessibleChainCacheKey struct {
 * 	useOnlyExternalAliasing bool
 * 	location                *ast.Node
 * 	meaning                 ast.SymbolFlags
 * }
 */
export interface accessibleChainCacheKey {
  useOnlyExternalAliasing: bool;
  location: GoPtr<Node>;
  meaning: SymbolFlags;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::type::ContainingSymbolLinks","kind":"type","status":"implemented","sigHash":"2307451c5b8482ec31ca7f528de6b3304234e7a4a940a8c1862d4aba08d42b83","bodyHash":"3bbec2b082eb7b5b50f071917b90f4df5cccb64d07c8d3c481f02a9853289314"}
 *
 * Go source:
 * ContainingSymbolLinks struct {
 * 	extendedContainersByFile map[ast.NodeId][]*ast.Symbol // Symbols of nodes which which logically contain this one, cached by file the request is made within
 * 	extendedContainers       *[]*ast.Symbol               // Containers (other than the parent) which this symbol is aliased in
 * 	accessibleChainCache     map[accessibleChainCacheKey][]*ast.Symbol
 * }
 */
export interface ContainingSymbolLinks {
  extendedContainersByFile: GoMap<NodeId, GoSlice<GoPtr<Symbol_62f2f8bf>>>;
  extendedContainers: GoPtr<GoSlice<GoPtr<Symbol_62f2f8bf>>>;
  accessibleChainCache: GoMap<accessibleChainCacheKey, GoSlice<GoPtr<Symbol_62f2f8bf>>>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::type::AccessFlags","kind":"type","status":"implemented","sigHash":"802892a337a8aa44646bde08969b3813e19cb556d31fb080ff409b7990d27fb6","bodyHash":"110552a5ba20ef8f5d285aa8bd9d0e1dbc0991525fa9f00183a63fc6eefb385d"}
 *
 * Go source:
 * AccessFlags uint32
 */
export type AccessFlags = uint;

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::constGroup::AccessFlagsNone+AccessFlagsIncludeUndefined+AccessFlagsNoIndexSignatures+AccessFlagsWriting+AccessFlagsCacheSymbol+AccessFlagsAllowMissing+AccessFlagsExpressionPosition+AccessFlagsReportDeprecated+AccessFlagsSuppressNoImplicitAnyError+AccessFlagsContextual+AccessFlagsPersistent","kind":"constGroup","status":"implemented","sigHash":"f3c32f19650778904a418e71e7c32f340f538e77a2aa6931d4a08493be68ec6b","bodyHash":"ba75db7ed523691573d77d5c52f2e5cc4a0dddb4190f018fe92cbf14e7f6a21b"}
 *
 * Go source:
 * const (
 * 	AccessFlagsNone                       AccessFlags = 0
 * 	AccessFlagsIncludeUndefined           AccessFlags = 1 << 0
 * 	AccessFlagsNoIndexSignatures          AccessFlags = 1 << 1
 * 	AccessFlagsWriting                    AccessFlags = 1 << 2
 * 	AccessFlagsCacheSymbol                AccessFlags = 1 << 3
 * 	AccessFlagsAllowMissing               AccessFlags = 1 << 4
 * 	AccessFlagsExpressionPosition         AccessFlags = 1 << 5
 * 	AccessFlagsReportDeprecated           AccessFlags = 1 << 6
 * 	AccessFlagsSuppressNoImplicitAnyError AccessFlags = 1 << 7
 * 	AccessFlagsContextual                 AccessFlags = 1 << 8
 * 	AccessFlagsPersistent                             = AccessFlagsIncludeUndefined
 * )
 */
export const AccessFlagsNone: AccessFlags = 0;
export const AccessFlagsIncludeUndefined: AccessFlags = 1 << 0;
export const AccessFlagsNoIndexSignatures: AccessFlags = 1 << 1;
export const AccessFlagsWriting: AccessFlags = 1 << 2;
export const AccessFlagsCacheSymbol: AccessFlags = 1 << 3;
export const AccessFlagsAllowMissing: AccessFlags = 1 << 4;
export const AccessFlagsExpressionPosition: AccessFlags = 1 << 5;
export const AccessFlagsReportDeprecated: AccessFlags = 1 << 6;
export const AccessFlagsSuppressNoImplicitAnyError: AccessFlags = 1 << 7;
export const AccessFlagsContextual: AccessFlags = 1 << 8;
export const AccessFlagsPersistent: AccessFlags = AccessFlagsIncludeUndefined;

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::type::NodeCheckFlags","kind":"type","status":"implemented","sigHash":"5dcb5d859b3f2ff7cd70042b75620f4d13fba05fad77e32251969a2b9c772578","bodyHash":"cb5b03d852c9e5660e4ac8d12ce427684d0d6258caef622a0510ca144f2c2970"}
 *
 * Go source:
 * NodeCheckFlags uint32
 */
export type NodeCheckFlags = uint;

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::constGroup::NodeCheckFlagsNone+NodeCheckFlagsTypeChecked+NodeCheckFlagsContextChecked+NodeCheckFlagsEnumValuesComputed+NodeCheckFlagsAssignmentsMarked+NodeCheckFlagsContainsClassWithPrivateIdentifiers+NodeCheckFlagsContainsSuperPropertyInStaticInitializer+NodeCheckFlagsInCheckIdentifier+NodeCheckFlagsInitializerIsUndefined+NodeCheckFlagsInitializerIsUndefinedComputed","kind":"constGroup","status":"implemented","sigHash":"8303b8b101c6029e3359020146d3cba3ec60339a21f0e36312edb8158d08a93c","bodyHash":"04461a1cdf460d62a20e0213d9f078b25a3e55c01bda51452b83bb0c4c333b09"}
 *
 * Go source:
 * const (
 * 	NodeCheckFlagsNone                                     NodeCheckFlags = 0
 * 	NodeCheckFlagsTypeChecked                              NodeCheckFlags = 1 << 0  // Node has been type checked
 * 	NodeCheckFlagsContextChecked                           NodeCheckFlags = 1 << 6  // Contextual types have been assigned
 * 	NodeCheckFlagsEnumValuesComputed                       NodeCheckFlags = 1 << 10 // Values for enum members have been computed, and any errors have been reported for them.
 * 	NodeCheckFlagsAssignmentsMarked                        NodeCheckFlags = 1 << 17 // Parameter assignments have been marked
 * 	NodeCheckFlagsContainsClassWithPrivateIdentifiers      NodeCheckFlags = 1 << 20 // Marked on all block-scoped containers containing a class with private identifiers.
 * 	NodeCheckFlagsContainsSuperPropertyInStaticInitializer NodeCheckFlags = 1 << 21 // Marked on all block-scoped containers containing a static initializer with 'super.x' or 'super[x]'.
 * 	NodeCheckFlagsInCheckIdentifier                        NodeCheckFlags = 1 << 22
 * 	NodeCheckFlagsInitializerIsUndefined                   NodeCheckFlags = 1 << 24
 * 	NodeCheckFlagsInitializerIsUndefinedComputed           NodeCheckFlags = 1 << 25
 * )
 */
export const NodeCheckFlagsNone: NodeCheckFlags = 0;
export const NodeCheckFlagsTypeChecked: NodeCheckFlags = 1 << 0;
export const NodeCheckFlagsContextChecked: NodeCheckFlags = 1 << 6;
export const NodeCheckFlagsEnumValuesComputed: NodeCheckFlags = 1 << 10;
export const NodeCheckFlagsAssignmentsMarked: NodeCheckFlags = 1 << 17;
export const NodeCheckFlagsContainsClassWithPrivateIdentifiers: NodeCheckFlags = 1 << 20;
export const NodeCheckFlagsContainsSuperPropertyInStaticInitializer: NodeCheckFlags = 1 << 21;
export const NodeCheckFlagsInCheckIdentifier: NodeCheckFlags = 1 << 22;
export const NodeCheckFlagsInitializerIsUndefined: NodeCheckFlags = 1 << 24;
export const NodeCheckFlagsInitializerIsUndefinedComputed: NodeCheckFlags = 1 << 25;

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::type::NodeLinks","kind":"type","status":"implemented","sigHash":"bd590e6f5400ae09b28e5727ed6248a2d37e091372315daced254882f1bd9068","bodyHash":"856e653cb8e47d6489ff9bc700098ab09d3eff754541a4e19c74c630c6440bf2"}
 *
 * Go source:
 * NodeLinks struct {
 * 	flags                                NodeCheckFlags // Set of flags specific to Node
 * 	declarationRequiresScopeChange       core.Tristate  // Set by `useOuterVariableScopeInParameter` in checker when downlevel emit would change the name resolution scope inside of a parameter.
 * 	hasReportedStatementInAmbientContext bool           // Cache boolean if we report statements in ambient context
 * }
 */
export interface NodeLinks {
  flags: NodeCheckFlags;
  declarationRequiresScopeChange: Tristate;
  hasReportedStatementInAmbientContext: bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::type::SymbolNodeLinks","kind":"type","status":"implemented","sigHash":"89abee6a144d3c12d35aae2dafa85f43053a44ca076f706149c4a8a6b46bc41f","bodyHash":"3faf90619306b4dfc2120b485483753ef9d58f708195079aafbad05751e49d4c"}
 *
 * Go source:
 * SymbolNodeLinks struct {
 * 	resolvedSymbol *ast.Symbol // Resolved symbol associated with node
 * }
 */
export interface SymbolNodeLinks {
  resolvedSymbol: GoPtr<Symbol_62f2f8bf>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::type::TypeNodeLinks","kind":"type","status":"implemented","sigHash":"d179da5ea97af8b4e01f810926a7545f82b426592ab5165ddf4d80ecc0cd4e3d","bodyHash":"63f2e3ade12086f877faba2842deb70032ef48351c0a8a14043706ec94966b6a"}
 *
 * Go source:
 * TypeNodeLinks struct {
 * 	resolvedType        *Type   // Resolved type associated with node
 * 	outerTypeParameters []*Type // Outer type parameters of anonymous object type
 * }
 */
export interface TypeNodeLinks {
  resolvedType: GoPtr<Type>;
  outerTypeParameters: GoSlice<GoPtr<Type>>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::type::EnumMemberLinks","kind":"type","status":"implemented","sigHash":"36404442f2fc2ca29651dc60685cdfa474dd7436f67a79886b11574ead3c754f","bodyHash":"300bf7a1da89d657d940c8095bddf33f21118e8b3fea24006d4bd8e40c4fb3f9"}
 *
 * Go source:
 * EnumMemberLinks struct {
 * 	value evaluator.Result // Constant value of enum member
 * }
 */
export interface EnumMemberLinks {
  value: Result;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::type::AssertionLinks","kind":"type","status":"implemented","sigHash":"6457416d44fb811750771dd328248210271dfdd39ce371575738913d0db6e7d2","bodyHash":"6a6f9f0ae26d168e482ec0ccb8fd63f8463c1181d728de588ee6ea643785390f"}
 *
 * Go source:
 * AssertionLinks struct {
 * 	exprType *Type // Assertion expression type
 * }
 */
export interface AssertionLinks {
  exprType: GoPtr<Type>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::type::SourceFileLinks","kind":"type","status":"implemented","sigHash":"5dd853bef6c2926129d6cdcecfedb6620736cd2ed3e23a6f409d48ad43f6285b","bodyHash":"6af9fa6cd639c0c8f78d577a32258a634f3fbaa2ca73aac0f23097312b2e6c3d"}
 *
 * Go source:
 * SourceFileLinks struct {
 * 	typeChecked               bool
 * 	unusedChecked             bool
 * 	deferredNodes             collections.OrderedSet[*ast.Node]
 * 	identifierCheckNodes      []*ast.Node
 * 	localJsxNamespace         string
 * 	localJsxFragmentNamespace string
 * 	localJsxFactory           *ast.EntityName
 * 	localJsxFragmentFactory   *ast.EntityName
 * 	jsxFragmentType           *Type
 * }
 */
export interface SourceFileLinks {
  typeChecked: bool;
  unusedChecked: bool;
  deferredNodes: OrderedSet<GoPtr<Node>>;
  identifierCheckNodes: GoSlice<GoPtr<Node>>;
  localJsxNamespace: string;
  localJsxFragmentNamespace: string;
  localJsxFactory: GoPtr<EntityName>;
  localJsxFragmentFactory: GoPtr<EntityName>;
  jsxFragmentType: GoPtr<Type>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::type::SignatureLinks","kind":"type","status":"implemented","sigHash":"a347e845fe887e23f08134d6a7c13472dcdb4602c6c632618c72b27e056bdc28","bodyHash":"4bf2baf0e113cf93bff152edafa4b1d395e4fdfca289065c748d902c87e78b3e"}
 *
 * Go source:
 * SignatureLinks struct {
 * 	resolvedSignature  *Signature // Cached signature of signature node or call expression
 * 	effectsSignature   *Signature // Signature with possible control flow effects
 * 	decoratorSignature *Signature // Signature for decorator as if invoked by the runtime
 * }
 */
export interface SignatureLinks {
  resolvedSignature: GoPtr<Signature>;
  effectsSignature: GoPtr<Signature>;
  decoratorSignature: GoPtr<Signature>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::type::TypeFlags","kind":"type","status":"implemented","sigHash":"f25175c625db0f67dfd7e928ddb1b660e03ad62f59d0c4ee937cfa78968b53ec","bodyHash":"06d2339bb07513679d9db9d3361917653e5f784b5a3d9fda1db10a4184c759c9"}
 *
 * Go source:
 * TypeFlags uint32
 */
export type TypeFlags = uint;

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::constGroup::TypeFlagsNone+TypeFlagsAny+TypeFlagsUnknown+TypeFlagsUndefined+TypeFlagsNull+TypeFlagsVoid+TypeFlagsString+TypeFlagsNumber+TypeFlagsBigInt+TypeFlagsBoolean+TypeFlagsESSymbol+TypeFlagsStringLiteral+TypeFlagsNumberLiteral+TypeFlagsBigIntLiteral+TypeFlagsBooleanLiteral+TypeFlagsUniqueESSymbol+TypeFlagsEnumLiteral+TypeFlagsEnum+TypeFlagsNonPrimitive+TypeFlagsNever+TypeFlagsTypeParameter+TypeFlagsObject+TypeFlagsIndex+TypeFlagsTemplateLiteral+TypeFlagsStringMapping+TypeFlagsSubstitution+TypeFlagsIndexedAccess+TypeFlagsConditional+TypeFlagsUnion+TypeFlagsIntersection+TypeFlagsReserved1+TypeFlagsReserved2+TypeFlagsReserved3+TypeFlagsAnyOrUnknown+TypeFlagsNullable+TypeFlagsLiteral+TypeFlagsUnit+TypeFlagsFreshable+TypeFlagsStringOrNumberLiteral+TypeFlagsStringOrNumberLiteralOrUnique+TypeFlagsDefinitelyFalsy+TypeFlagsPossiblyFalsy+TypeFlagsIntrinsic+TypeFlagsStringLike+TypeFlagsNumberLike+TypeFlagsBigIntLike+TypeFlagsBooleanLike+TypeFlagsEnumLike+TypeFlagsESSymbolLike+TypeFlagsVoidLike+TypeFlagsPrimitive+TypeFlagsDefinitelyNonNullable+TypeFlagsDisjointDomains+TypeFlagsUnionOrIntersection+TypeFlagsStructuredType+TypeFlagsTypeVariable+TypeFlagsInstantiableNonPrimitive+TypeFlagsInstantiablePrimitive+TypeFlagsInstantiable+TypeFlagsStructuredOrInstantiable+TypeFlagsObjectFlagsType+TypeFlagsSimplifiable+TypeFlagsSingleton+TypeFlagsNarrowable+TypeFlagsIncludesMask+TypeFlagsIncludesMissingType+TypeFlagsIncludesNonWideningType+TypeFlagsIncludesWildcard+TypeFlagsIncludesEmptyObject+TypeFlagsIncludesInstantiable+TypeFlagsIncludesConstrainedTypeVariable+TypeFlagsIncludesError+TypeFlagsNotPrimitiveUnion","kind":"constGroup","status":"implemented","sigHash":"79e0a5b4d4e3bfa731cbf0af0f5d78713e49dfbbfb53cbee19852ac3b59ac2e2","bodyHash":"83deca7e1d2860e77c78d95b3f6f15e6755cd9eee323d9e875fd5e0f444c19bc"}
 *
 * Go source:
 * const (
 * 	TypeFlagsNone            TypeFlags = 0
 * 	TypeFlagsAny             TypeFlags = 1 << 0
 * 	TypeFlagsUnknown         TypeFlags = 1 << 1
 * 	TypeFlagsUndefined       TypeFlags = 1 << 2
 * 	TypeFlagsNull            TypeFlags = 1 << 3
 * 	TypeFlagsVoid            TypeFlags = 1 << 4
 * 	TypeFlagsString          TypeFlags = 1 << 5
 * 	TypeFlagsNumber          TypeFlags = 1 << 6
 * 	TypeFlagsBigInt          TypeFlags = 1 << 7
 * 	TypeFlagsBoolean         TypeFlags = 1 << 8
 * 	TypeFlagsESSymbol        TypeFlags = 1 << 9 // Type of symbol primitive introduced in ES6
 * 	TypeFlagsStringLiteral   TypeFlags = 1 << 10
 * 	TypeFlagsNumberLiteral   TypeFlags = 1 << 11
 * 	TypeFlagsBigIntLiteral   TypeFlags = 1 << 12
 * 	TypeFlagsBooleanLiteral  TypeFlags = 1 << 13
 * 	TypeFlagsUniqueESSymbol  TypeFlags = 1 << 14 // unique symbol
 * 	TypeFlagsEnumLiteral     TypeFlags = 1 << 15 // Always combined with StringLiteral, NumberLiteral, or Union
 * 	TypeFlagsEnum            TypeFlags = 1 << 16 // Numeric computed enum member value (must be right after EnumLiteral, see getSortOrderFlags)
 * 	TypeFlagsNonPrimitive    TypeFlags = 1 << 17 // intrinsic object type
 * 	TypeFlagsNever           TypeFlags = 1 << 18 // Never type
 * 	TypeFlagsTypeParameter   TypeFlags = 1 << 19 // Type parameter
 * 	TypeFlagsObject          TypeFlags = 1 << 20 // Object type
 * 	TypeFlagsIndex           TypeFlags = 1 << 21 // keyof T
 * 	TypeFlagsTemplateLiteral TypeFlags = 1 << 22 // Template literal type
 * 	TypeFlagsStringMapping   TypeFlags = 1 << 23 // Uppercase/Lowercase type
 * 	TypeFlagsSubstitution    TypeFlags = 1 << 24 // Type parameter substitution
 * 	TypeFlagsIndexedAccess   TypeFlags = 1 << 25 // T[K]
 * 	TypeFlagsConditional     TypeFlags = 1 << 26 // T extends U ? X : Y
 * 	TypeFlagsUnion           TypeFlags = 1 << 27 // Union (T | U)
 * 	TypeFlagsIntersection    TypeFlags = 1 << 28 // Intersection (T & U)
 * 	TypeFlagsReserved1       TypeFlags = 1 << 29 // Used by union/intersection type construction
 * 	TypeFlagsReserved2       TypeFlags = 1 << 30 // Used by union/intersection type construction
 * 	TypeFlagsReserved3       TypeFlags = 1 << 31
 * 
 * 	TypeFlagsAnyOrUnknown                  = TypeFlagsAny | TypeFlagsUnknown
 * 	TypeFlagsNullable                      = TypeFlagsUndefined | TypeFlagsNull
 * 	TypeFlagsLiteral                       = TypeFlagsStringLiteral | TypeFlagsNumberLiteral | TypeFlagsBigIntLiteral | TypeFlagsBooleanLiteral
 * 	TypeFlagsUnit                          = TypeFlagsEnum | TypeFlagsLiteral | TypeFlagsUniqueESSymbol | TypeFlagsNullable
 * 	TypeFlagsFreshable                     = TypeFlagsEnum | TypeFlagsLiteral
 * 	TypeFlagsStringOrNumberLiteral         = TypeFlagsStringLiteral | TypeFlagsNumberLiteral
 * 	TypeFlagsStringOrNumberLiteralOrUnique = TypeFlagsStringLiteral | TypeFlagsNumberLiteral | TypeFlagsUniqueESSymbol
 * 	TypeFlagsDefinitelyFalsy               = TypeFlagsStringLiteral | TypeFlagsNumberLiteral | TypeFlagsBigIntLiteral | TypeFlagsBooleanLiteral | TypeFlagsVoid | TypeFlagsUndefined | TypeFlagsNull
 * 	TypeFlagsPossiblyFalsy                 = TypeFlagsDefinitelyFalsy | TypeFlagsString | TypeFlagsNumber | TypeFlagsBigInt | TypeFlagsBoolean
 * 	TypeFlagsIntrinsic                     = TypeFlagsAny | TypeFlagsUnknown | TypeFlagsString | TypeFlagsNumber | TypeFlagsBigInt | TypeFlagsESSymbol | TypeFlagsVoid | TypeFlagsUndefined | TypeFlagsNull | TypeFlagsNever | TypeFlagsNonPrimitive
 * 	TypeFlagsStringLike                    = TypeFlagsString | TypeFlagsStringLiteral | TypeFlagsTemplateLiteral | TypeFlagsStringMapping
 * 	TypeFlagsNumberLike                    = TypeFlagsNumber | TypeFlagsNumberLiteral | TypeFlagsEnum
 * 	TypeFlagsBigIntLike                    = TypeFlagsBigInt | TypeFlagsBigIntLiteral
 * 	TypeFlagsBooleanLike                   = TypeFlagsBoolean | TypeFlagsBooleanLiteral
 * 	TypeFlagsEnumLike                      = TypeFlagsEnum | TypeFlagsEnumLiteral
 * 	TypeFlagsESSymbolLike                  = TypeFlagsESSymbol | TypeFlagsUniqueESSymbol
 * 	TypeFlagsVoidLike                      = TypeFlagsVoid | TypeFlagsUndefined
 * 	TypeFlagsPrimitive                     = TypeFlagsStringLike | TypeFlagsNumberLike | TypeFlagsBigIntLike | TypeFlagsBooleanLike | TypeFlagsEnumLike | TypeFlagsESSymbolLike | TypeFlagsVoidLike | TypeFlagsNull
 * 	TypeFlagsDefinitelyNonNullable         = TypeFlagsStringLike | TypeFlagsNumberLike | TypeFlagsBigIntLike | TypeFlagsBooleanLike | TypeFlagsEnumLike | TypeFlagsESSymbolLike | TypeFlagsObject | TypeFlagsNonPrimitive
 * 	TypeFlagsDisjointDomains               = TypeFlagsNonPrimitive | TypeFlagsStringLike | TypeFlagsNumberLike | TypeFlagsBigIntLike | TypeFlagsBooleanLike | TypeFlagsESSymbolLike | TypeFlagsVoidLike | TypeFlagsNull
 * 	TypeFlagsUnionOrIntersection           = TypeFlagsUnion | TypeFlagsIntersection
 * 	TypeFlagsStructuredType                = TypeFlagsObject | TypeFlagsUnion | TypeFlagsIntersection
 * 	TypeFlagsTypeVariable                  = TypeFlagsTypeParameter | TypeFlagsIndexedAccess
 * 	TypeFlagsInstantiableNonPrimitive      = TypeFlagsTypeVariable | TypeFlagsConditional | TypeFlagsSubstitution
 * 	TypeFlagsInstantiablePrimitive         = TypeFlagsIndex | TypeFlagsTemplateLiteral | TypeFlagsStringMapping
 * 	TypeFlagsInstantiable                  = TypeFlagsInstantiableNonPrimitive | TypeFlagsInstantiablePrimitive
 * 	TypeFlagsStructuredOrInstantiable      = TypeFlagsStructuredType | TypeFlagsInstantiable
 * 	TypeFlagsObjectFlagsType               = TypeFlagsAny | TypeFlagsNullable | TypeFlagsNever | TypeFlagsObject | TypeFlagsUnion | TypeFlagsIntersection
 * 	TypeFlagsSimplifiable                  = TypeFlagsIndexedAccess | TypeFlagsConditional | TypeFlagsIndex
 * 	TypeFlagsSingleton                     = TypeFlagsAny | TypeFlagsUnknown | TypeFlagsString | TypeFlagsNumber | TypeFlagsBoolean | TypeFlagsBigInt | TypeFlagsESSymbol | TypeFlagsVoid | TypeFlagsUndefined | TypeFlagsNull | TypeFlagsNever | TypeFlagsNonPrimitive
 * 	// 'TypeFlagsNarrowable' types are types where narrowing actually narrows.
 * 	// This *should* be every type other than null, undefined, void, and never
 * 	TypeFlagsNarrowable = TypeFlagsAny | TypeFlagsUnknown | TypeFlagsStructuredOrInstantiable | TypeFlagsStringLike | TypeFlagsNumberLike | TypeFlagsBigIntLike | TypeFlagsBooleanLike | TypeFlagsESSymbol | TypeFlagsUniqueESSymbol | TypeFlagsNonPrimitive
 * 	// The following flags are aggregated during union and intersection type construction
 * 	TypeFlagsIncludesMask = TypeFlagsAny | TypeFlagsUnknown | TypeFlagsPrimitive | TypeFlagsNever | TypeFlagsObject | TypeFlagsUnion | TypeFlagsIntersection | TypeFlagsNonPrimitive | TypeFlagsTemplateLiteral | TypeFlagsStringMapping
 * 	// The following flags are used for different purposes during union and intersection type construction
 * 	TypeFlagsIncludesMissingType             = TypeFlagsTypeParameter
 * 	TypeFlagsIncludesNonWideningType         = TypeFlagsIndex
 * 	TypeFlagsIncludesWildcard                = TypeFlagsIndexedAccess
 * 	TypeFlagsIncludesEmptyObject             = TypeFlagsConditional
 * 	TypeFlagsIncludesInstantiable            = TypeFlagsSubstitution
 * 	TypeFlagsIncludesConstrainedTypeVariable = TypeFlagsReserved1
 * 	TypeFlagsIncludesError                   = TypeFlagsReserved2
 * 	TypeFlagsNotPrimitiveUnion               = TypeFlagsAny | TypeFlagsUnknown | TypeFlagsVoid | TypeFlagsNever | TypeFlagsObject | TypeFlagsIntersection | TypeFlagsIncludesInstantiable
 * )
 */
export const TypeFlagsNone: TypeFlags = 0;
export const TypeFlagsAny: TypeFlags = 1 << 0;
export const TypeFlagsUnknown: TypeFlags = 1 << 1;
export const TypeFlagsUndefined: TypeFlags = 1 << 2;
export const TypeFlagsNull: TypeFlags = 1 << 3;
export const TypeFlagsVoid: TypeFlags = 1 << 4;
export const TypeFlagsString: TypeFlags = 1 << 5;
export const TypeFlagsNumber: TypeFlags = 1 << 6;
export const TypeFlagsBigInt: TypeFlags = 1 << 7;
export const TypeFlagsBoolean: TypeFlags = 1 << 8;
export const TypeFlagsESSymbol: TypeFlags = 1 << 9;
export const TypeFlagsStringLiteral: TypeFlags = 1 << 10;
export const TypeFlagsNumberLiteral: TypeFlags = 1 << 11;
export const TypeFlagsBigIntLiteral: TypeFlags = 1 << 12;
export const TypeFlagsBooleanLiteral: TypeFlags = 1 << 13;
export const TypeFlagsUniqueESSymbol: TypeFlags = 1 << 14;
export const TypeFlagsEnumLiteral: TypeFlags = 1 << 15;
export const TypeFlagsEnum: TypeFlags = 1 << 16;
export const TypeFlagsNonPrimitive: TypeFlags = 1 << 17;
export const TypeFlagsNever: TypeFlags = 1 << 18;
export const TypeFlagsTypeParameter: TypeFlags = 1 << 19;
export const TypeFlagsObject: TypeFlags = 1 << 20;
export const TypeFlagsIndex: TypeFlags = 1 << 21;
export const TypeFlagsTemplateLiteral: TypeFlags = 1 << 22;
export const TypeFlagsStringMapping: TypeFlags = 1 << 23;
export const TypeFlagsSubstitution: TypeFlags = 1 << 24;
export const TypeFlagsIndexedAccess: TypeFlags = 1 << 25;
export const TypeFlagsConditional: TypeFlags = 1 << 26;
export const TypeFlagsUnion: TypeFlags = 1 << 27;
export const TypeFlagsIntersection: TypeFlags = 1 << 28;
export const TypeFlagsReserved1: TypeFlags = 1 << 29;
export const TypeFlagsReserved2: TypeFlags = 1 << 30;
export const TypeFlagsReserved3: TypeFlags = 2147483648;
export const TypeFlagsAnyOrUnknown: int = (TypeFlagsAny | TypeFlagsUnknown) >>> 0;
export const TypeFlagsNullable: int = (TypeFlagsUndefined | TypeFlagsNull) >>> 0;
export const TypeFlagsLiteral: int =
  (TypeFlagsStringLiteral | TypeFlagsNumberLiteral | TypeFlagsBigIntLiteral | TypeFlagsBooleanLiteral) >>> 0;
export const TypeFlagsUnit: int =
  (TypeFlagsEnum | TypeFlagsLiteral | TypeFlagsUniqueESSymbol | TypeFlagsNullable) >>> 0;
export const TypeFlagsFreshable: int = (TypeFlagsEnum | TypeFlagsLiteral) >>> 0;
export const TypeFlagsStringOrNumberLiteral: int = (TypeFlagsStringLiteral | TypeFlagsNumberLiteral) >>> 0;
export const TypeFlagsStringOrNumberLiteralOrUnique: int =
  (TypeFlagsStringLiteral | TypeFlagsNumberLiteral | TypeFlagsUniqueESSymbol) >>> 0;
export const TypeFlagsDefinitelyFalsy: int =
  (TypeFlagsStringLiteral |
    TypeFlagsNumberLiteral |
    TypeFlagsBigIntLiteral |
    TypeFlagsBooleanLiteral |
    TypeFlagsVoid |
    TypeFlagsUndefined |
    TypeFlagsNull) >>>
  0;
export const TypeFlagsPossiblyFalsy: int =
  (TypeFlagsDefinitelyFalsy |
    TypeFlagsString |
    TypeFlagsNumber |
    TypeFlagsBigInt |
    TypeFlagsBoolean) >>>
  0;
export const TypeFlagsIntrinsic: int =
  (TypeFlagsAny |
    TypeFlagsUnknown |
    TypeFlagsString |
    TypeFlagsNumber |
    TypeFlagsBigInt |
    TypeFlagsESSymbol |
    TypeFlagsVoid |
    TypeFlagsUndefined |
    TypeFlagsNull |
    TypeFlagsNever |
    TypeFlagsNonPrimitive) >>>
  0;
export const TypeFlagsStringLike: int =
  (TypeFlagsString | TypeFlagsStringLiteral | TypeFlagsTemplateLiteral | TypeFlagsStringMapping) >>> 0;
export const TypeFlagsNumberLike: int = (TypeFlagsNumber | TypeFlagsNumberLiteral | TypeFlagsEnum) >>> 0;
export const TypeFlagsBigIntLike: int = (TypeFlagsBigInt | TypeFlagsBigIntLiteral) >>> 0;
export const TypeFlagsBooleanLike: int = (TypeFlagsBoolean | TypeFlagsBooleanLiteral) >>> 0;
export const TypeFlagsEnumLike: int = (TypeFlagsEnum | TypeFlagsEnumLiteral) >>> 0;
export const TypeFlagsESSymbolLike: int = (TypeFlagsESSymbol | TypeFlagsUniqueESSymbol) >>> 0;
export const TypeFlagsVoidLike: int = (TypeFlagsVoid | TypeFlagsUndefined) >>> 0;
export const TypeFlagsPrimitive: int =
  (TypeFlagsStringLike |
    TypeFlagsNumberLike |
    TypeFlagsBigIntLike |
    TypeFlagsBooleanLike |
    TypeFlagsEnumLike |
    TypeFlagsESSymbolLike |
    TypeFlagsVoidLike |
    TypeFlagsNull) >>>
  0;
export const TypeFlagsDefinitelyNonNullable: int =
  (TypeFlagsStringLike |
    TypeFlagsNumberLike |
    TypeFlagsBigIntLike |
    TypeFlagsBooleanLike |
    TypeFlagsEnumLike |
    TypeFlagsESSymbolLike |
    TypeFlagsObject |
    TypeFlagsNonPrimitive) >>>
  0;
export const TypeFlagsDisjointDomains: int =
  (TypeFlagsNonPrimitive |
    TypeFlagsStringLike |
    TypeFlagsNumberLike |
    TypeFlagsBigIntLike |
    TypeFlagsBooleanLike |
    TypeFlagsESSymbolLike |
    TypeFlagsVoidLike |
    TypeFlagsNull) >>>
  0;
export const TypeFlagsUnionOrIntersection: int = (TypeFlagsUnion | TypeFlagsIntersection) >>> 0;
export const TypeFlagsStructuredType: int = (TypeFlagsObject | TypeFlagsUnion | TypeFlagsIntersection) >>> 0;
export const TypeFlagsTypeVariable: int = (TypeFlagsTypeParameter | TypeFlagsIndexedAccess) >>> 0;
export const TypeFlagsInstantiableNonPrimitive: int =
  (TypeFlagsTypeVariable | TypeFlagsConditional | TypeFlagsSubstitution) >>> 0;
export const TypeFlagsInstantiablePrimitive: int =
  (TypeFlagsIndex | TypeFlagsTemplateLiteral | TypeFlagsStringMapping) >>> 0;
export const TypeFlagsInstantiable: int =
  (TypeFlagsInstantiableNonPrimitive | TypeFlagsInstantiablePrimitive) >>> 0;
export const TypeFlagsStructuredOrInstantiable: int =
  (TypeFlagsStructuredType | TypeFlagsInstantiable) >>> 0;
export const TypeFlagsObjectFlagsType: int =
  (TypeFlagsAny |
    TypeFlagsNullable |
    TypeFlagsNever |
    TypeFlagsObject |
    TypeFlagsUnion |
    TypeFlagsIntersection) >>>
  0;
export const TypeFlagsSimplifiable: int =
  (TypeFlagsIndexedAccess | TypeFlagsConditional | TypeFlagsIndex) >>> 0;
export const TypeFlagsSingleton: int =
  (TypeFlagsAny |
    TypeFlagsUnknown |
    TypeFlagsString |
    TypeFlagsNumber |
    TypeFlagsBoolean |
    TypeFlagsBigInt |
    TypeFlagsESSymbol |
    TypeFlagsVoid |
    TypeFlagsUndefined |
    TypeFlagsNull |
    TypeFlagsNever |
    TypeFlagsNonPrimitive) >>>
  0;
export const TypeFlagsNarrowable: int =
  (TypeFlagsAny |
    TypeFlagsUnknown |
    TypeFlagsStructuredOrInstantiable |
    TypeFlagsStringLike |
    TypeFlagsNumberLike |
    TypeFlagsBigIntLike |
    TypeFlagsBooleanLike |
    TypeFlagsESSymbol |
    TypeFlagsUniqueESSymbol |
    TypeFlagsNonPrimitive) >>>
  0;
export const TypeFlagsIncludesMask: int =
  (TypeFlagsAny |
    TypeFlagsUnknown |
    TypeFlagsPrimitive |
    TypeFlagsNever |
    TypeFlagsObject |
    TypeFlagsUnion |
    TypeFlagsIntersection |
    TypeFlagsNonPrimitive |
    TypeFlagsTemplateLiteral |
    TypeFlagsStringMapping) >>>
  0;
export const TypeFlagsIncludesMissingType: TypeFlags = TypeFlagsTypeParameter;
export const TypeFlagsIncludesNonWideningType: TypeFlags = TypeFlagsIndex;
export const TypeFlagsIncludesWildcard: TypeFlags = TypeFlagsIndexedAccess;
export const TypeFlagsIncludesEmptyObject: TypeFlags = TypeFlagsConditional;
export const TypeFlagsIncludesInstantiable: TypeFlags = TypeFlagsSubstitution;
export const TypeFlagsIncludesConstrainedTypeVariable: TypeFlags = TypeFlagsReserved1;
export const TypeFlagsIncludesError: TypeFlags = TypeFlagsReserved2;
export const TypeFlagsNotPrimitiveUnion: int =
  (TypeFlagsAny |
    TypeFlagsUnknown |
    TypeFlagsVoid |
    TypeFlagsNever |
    TypeFlagsObject |
    TypeFlagsIntersection |
    TypeFlagsIncludesInstantiable) >>>
  0;

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::varGroup::typeFlagNames","kind":"varGroup","status":"implemented","sigHash":"c753024a4232d6b27b9d88418e5396ae0f39c1250d4ef3db0aebe1a1771100f5","bodyHash":"0c308b06afa0145efe922e75f54f9b2278a37d3a2baec18d5f3af4f65f0761b5"}
 *
 * Go source:
 * var typeFlagNames = [...]struct {
 * 	flag TypeFlags
 * 	name string
 * }{
 * 	{TypeFlagsAny, "Any"},
 * 	{TypeFlagsUnknown, "Unknown"},
 * 	{TypeFlagsUndefined, "Undefined"},
 * 	{TypeFlagsNull, "Null"},
 * 	{TypeFlagsVoid, "Void"},
 * 	{TypeFlagsString, "String"},
 * 	{TypeFlagsNumber, "Number"},
 * 	{TypeFlagsBigInt, "BigInt"},
 * 	{TypeFlagsBoolean, "Boolean"},
 * 	{TypeFlagsESSymbol, "ESSymbol"},
 * 	{TypeFlagsStringLiteral, "StringLiteral"},
 * 	{TypeFlagsNumberLiteral, "NumberLiteral"},
 * 	{TypeFlagsBigIntLiteral, "BigIntLiteral"},
 * 	{TypeFlagsBooleanLiteral, "BooleanLiteral"},
 * 	{TypeFlagsUniqueESSymbol, "UniqueESSymbol"},
 * 	{TypeFlagsEnumLiteral, "EnumLiteral"},
 * 	{TypeFlagsEnum, "Enum"},
 * 	{TypeFlagsNonPrimitive, "NonPrimitive"},
 * 	{TypeFlagsNever, "Never"},
 * 	{TypeFlagsTypeParameter, "TypeParameter"},
 * 	{TypeFlagsObject, "Object"},
 * 	{TypeFlagsIndex, "Index"},
 * 	{TypeFlagsTemplateLiteral, "TemplateLiteral"},
 * 	{TypeFlagsStringMapping, "StringMapping"},
 * 	{TypeFlagsSubstitution, "Substitution"},
 * 	{TypeFlagsIndexedAccess, "IndexedAccess"},
 * 	{TypeFlagsConditional, "Conditional"},
 * 	{TypeFlagsUnion, "Union"},
 * 	{TypeFlagsIntersection, "Intersection"},
 * }
 */
export const typeFlagNames: GoArray<{ flag: TypeFlags; name: string }, "..."> = [
  { flag: TypeFlagsAny, name: "Any" },
  { flag: TypeFlagsUnknown, name: "Unknown" },
  { flag: TypeFlagsUndefined, name: "Undefined" },
  { flag: TypeFlagsNull, name: "Null" },
  { flag: TypeFlagsVoid, name: "Void" },
  { flag: TypeFlagsString, name: "String" },
  { flag: TypeFlagsNumber, name: "Number" },
  { flag: TypeFlagsBigInt, name: "BigInt" },
  { flag: TypeFlagsBoolean, name: "Boolean" },
  { flag: TypeFlagsESSymbol, name: "ESSymbol" },
  { flag: TypeFlagsStringLiteral, name: "StringLiteral" },
  { flag: TypeFlagsNumberLiteral, name: "NumberLiteral" },
  { flag: TypeFlagsBigIntLiteral, name: "BigIntLiteral" },
  { flag: TypeFlagsBooleanLiteral, name: "BooleanLiteral" },
  { flag: TypeFlagsUniqueESSymbol, name: "UniqueESSymbol" },
  { flag: TypeFlagsEnumLiteral, name: "EnumLiteral" },
  { flag: TypeFlagsEnum, name: "Enum" },
  { flag: TypeFlagsNonPrimitive, name: "NonPrimitive" },
  { flag: TypeFlagsNever, name: "Never" },
  { flag: TypeFlagsTypeParameter, name: "TypeParameter" },
  { flag: TypeFlagsObject, name: "Object" },
  { flag: TypeFlagsIndex, name: "Index" },
  { flag: TypeFlagsTemplateLiteral, name: "TemplateLiteral" },
  { flag: TypeFlagsStringMapping, name: "StringMapping" },
  { flag: TypeFlagsSubstitution, name: "Substitution" },
  { flag: TypeFlagsIndexedAccess, name: "IndexedAccess" },
  { flag: TypeFlagsConditional, name: "Conditional" },
  { flag: TypeFlagsUnion, name: "Union" },
  { flag: TypeFlagsIntersection, name: "Intersection" },
] as GoArray<{ flag: TypeFlags; name: string }, "...">;

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::func::FormatTypeFlags","kind":"func","status":"implemented","sigHash":"e927368847a2a91161816e5cb84351d111911678d373a466bf7d6ec7e8f3fd10","bodyHash":"ef37e91a659a9939e009b4ace805de296079a2d2c5f7c3b0e2b23676166193f7"}
 *
 * Go source:
 * func FormatTypeFlags(flags TypeFlags) []string {
 * 	result := make([]string, 0, bits.OnesCount32(uint32(flags)))
 * 	for _, fn := range typeFlagNames {
 * 		if flags&fn.flag != 0 {
 * 			result = append(result, fn.name)
 * 		}
 * 	}
 * 	if len(result) == 0 {
 * 		result = append(result, "None")
 * 	}
 * 	return result
 * }
 */
export function FormatTypeFlags(flags: TypeFlags): GoSlice<string> {
  const result: GoSlice<string> = typeFlagNames
    .filter((fn) => (flags & fn.flag) !== 0)
    .map((fn) => fn.name);
  if (result.length === 0) {
    return ["None"];
  }
  return result;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::method::TypeFlags.String","kind":"method","status":"implemented","sigHash":"bbcbeb6f8b572483c758dc290ce29cfd71f395d4a907202d81930ac6022a8067","bodyHash":"7d19bbb614040e07cf804b9cd284c18c2eb4196bd1d24d64fb2b13098acb4747"}
 *
 * Go source:
 * func (f TypeFlags) String() string {
 * 	return strings.Join(FormatTypeFlags(f), "|")
 * }
 */
export function TypeFlags_String(receiver: TypeFlags): string {
  return FormatTypeFlags(receiver).join("|");
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::method::VarianceFlags.String","kind":"method","status":"implemented","sigHash":"e53e39f56ea8e176a06f7994240619336fad8cffd42180c7b5aa28d05dd9c6b5","bodyHash":"f6154e056605de3f3d2bfd2ca5bb61e6da854bb0ce58be909eeb1c0cae74b673"}
 *
 * Go source:
 * func (v VarianceFlags) String() string {
 * 	variance := v & VarianceFlagsVarianceMask
 * 	var result string
 * 	switch variance {
 * 	case VarianceFlagsInvariant:
 * 		result = "in out"
 * 	case VarianceFlagsBivariant:
 * 		result = "[bivariant]"
 * 	case VarianceFlagsContravariant:
 * 		result = "in"
 * 	case VarianceFlagsCovariant:
 * 		result = "out"
 * 	case VarianceFlagsIndependent:
 * 		result = "[independent]"
 * 	default:
 * 		result = ""
 * 	}
 * 	if v&VarianceFlagsUnmeasurable != 0 {
 * 		result += " (unmeasurable)"
 * 	} else if v&VarianceFlagsUnreliable != 0 {
 * 		result += " (unreliable)"
 * 	}
 * 	return result
 * }
 */
export function VarianceFlags_String(receiver: VarianceFlags): string {
  const variance: VarianceFlags = receiver & VarianceFlagsVarianceMask;
  const base: string =
    variance === VarianceFlagsInvariant
      ? "in out"
      : variance === VarianceFlagsBivariant
        ? "[bivariant]"
        : variance === VarianceFlagsContravariant
          ? "in"
          : variance === VarianceFlagsCovariant
            ? "out"
            : variance === VarianceFlagsIndependent
              ? "[independent]"
              : "";
  if ((receiver & VarianceFlagsUnmeasurable) !== 0) {
    return base + " (unmeasurable)";
  } else if ((receiver & VarianceFlagsUnreliable) !== 0) {
    return base + " (unreliable)";
  }
  return base;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::type::ObjectFlags","kind":"type","status":"implemented","sigHash":"15c7d7c74b9e4609aec26eba8dd4a99a8a5b756ad44797ddf34016a36a66864a","bodyHash":"985cc5687be0c748355864d9a03ebdf3a9faa8df90aff2b840df33c501cf09c4"}
 *
 * Go source:
 * ObjectFlags uint32
 */
export type ObjectFlags = uint;

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::constGroup::ObjectFlagsNone+ObjectFlagsClass+ObjectFlagsInterface+ObjectFlagsReference+ObjectFlagsTuple+ObjectFlagsAnonymous+ObjectFlagsMapped+ObjectFlagsInstantiated+ObjectFlagsObjectLiteral+ObjectFlagsEvolvingArray+ObjectFlagsObjectLiteralPatternWithComputedProperties+ObjectFlagsReverseMapped+ObjectFlagsJsxAttributes+ObjectFlagsJSLiteral+ObjectFlagsFreshLiteral+ObjectFlagsArrayLiteral+ObjectFlagsPrimitiveUnion+ObjectFlagsContainsWideningType+ObjectFlagsContainsObjectOrArrayLiteral+ObjectFlagsNonInferrableType+ObjectFlagsCouldContainTypeVariablesComputed+ObjectFlagsCouldContainTypeVariables+ObjectFlagsMembersResolved+ObjectFlagsClassOrInterface+ObjectFlagsRequiresWidening+ObjectFlagsPropagatingFlags+ObjectFlagsInstantiatedMapped+ObjectFlagsObjectTypeKindMask+ObjectFlagsContainsSpread+ObjectFlagsObjectRestType+ObjectFlagsInstantiationExpressionType+ObjectFlagsSingleSignatureType+ObjectFlagsIsClassInstanceClone+ObjectFlagsIdenticalBaseTypeCalculated+ObjectFlagsIdenticalBaseTypeExists+ObjectFlagsUnresolvedMembers+ObjectFlagsIsGenericTypeComputed+ObjectFlagsIsGenericObjectType+ObjectFlagsIsGenericIndexType+ObjectFlagsIsGenericType+ObjectFlagsContainsIntersections+ObjectFlagsIsUnknownLikeUnionComputed+ObjectFlagsIsUnknownLikeUnion+ObjectFlagsIsNeverIntersectionComputed+ObjectFlagsIsNeverIntersection+ObjectFlagsIsConstrainedTypeVariable","kind":"constGroup","status":"implemented","sigHash":"6c840bef57000fbe5bac3057ae6926d6558998dafa08db035160ddcbfbfb5c2e","bodyHash":"014781a8668979fdae4cf62ddd6a668cd9da7601ddba500ae3c7868476be6406"}
 *
 * Go source:
 * const (
 * 	ObjectFlagsNone                                       ObjectFlags = 0
 * 	ObjectFlagsClass                                      ObjectFlags = 1 << 0  // Class
 * 	ObjectFlagsInterface                                  ObjectFlags = 1 << 1  // Interface
 * 	ObjectFlagsReference                                  ObjectFlags = 1 << 2  // Generic type reference
 * 	ObjectFlagsTuple                                      ObjectFlags = 1 << 3  // Synthesized generic tuple type
 * 	ObjectFlagsAnonymous                                  ObjectFlags = 1 << 4  // Anonymous
 * 	ObjectFlagsMapped                                     ObjectFlags = 1 << 5  // Mapped
 * 	ObjectFlagsInstantiated                               ObjectFlags = 1 << 6  // Instantiated anonymous or mapped type
 * 	ObjectFlagsObjectLiteral                              ObjectFlags = 1 << 7  // Originates in an object literal
 * 	ObjectFlagsEvolvingArray                              ObjectFlags = 1 << 8  // Evolving array type
 * 	ObjectFlagsObjectLiteralPatternWithComputedProperties ObjectFlags = 1 << 9  // Object literal pattern with computed properties
 * 	ObjectFlagsReverseMapped                              ObjectFlags = 1 << 10 // Object contains a property from a reverse-mapped type
 * 	ObjectFlagsJsxAttributes                              ObjectFlags = 1 << 11 // Jsx attributes type
 * 	ObjectFlagsJSLiteral                                  ObjectFlags = 1 << 12 // Object type declared in JS - disables errors on read/write of nonexisting members
 * 	ObjectFlagsFreshLiteral                               ObjectFlags = 1 << 13 // Fresh object literal
 * 	ObjectFlagsArrayLiteral                               ObjectFlags = 1 << 14 // Originates in an array literal
 * 	ObjectFlagsPrimitiveUnion                             ObjectFlags = 1 << 15 // Union of only primitive types
 * 	ObjectFlagsContainsWideningType                       ObjectFlags = 1 << 16 // Type is or contains undefined or null widening type
 * 	ObjectFlagsContainsObjectOrArrayLiteral               ObjectFlags = 1 << 17 // Type is or contains object literal type
 * 	ObjectFlagsNonInferrableType                          ObjectFlags = 1 << 18 // Type is or contains anyFunctionType or silentNeverType
 * 	ObjectFlagsCouldContainTypeVariablesComputed          ObjectFlags = 1 << 19 // CouldContainTypeVariables flag has been computed
 * 	ObjectFlagsCouldContainTypeVariables                  ObjectFlags = 1 << 20 // Type could contain a type variable
 * 	ObjectFlagsMembersResolved                            ObjectFlags = 1 << 21 // Members have been resolved
 * 
 * 	ObjectFlagsClassOrInterface   = ObjectFlagsClass | ObjectFlagsInterface
 * 	ObjectFlagsRequiresWidening   = ObjectFlagsContainsWideningType | ObjectFlagsContainsObjectOrArrayLiteral
 * 	ObjectFlagsPropagatingFlags   = ObjectFlagsContainsWideningType | ObjectFlagsContainsObjectOrArrayLiteral | ObjectFlagsNonInferrableType
 * 	ObjectFlagsInstantiatedMapped = ObjectFlagsMapped | ObjectFlagsInstantiated
 * 	// Object flags that uniquely identify the kind of ObjectType
 * 	ObjectFlagsObjectTypeKindMask = ObjectFlagsClassOrInterface | ObjectFlagsReference | ObjectFlagsTuple | ObjectFlagsAnonymous | ObjectFlagsMapped | ObjectFlagsReverseMapped | ObjectFlagsEvolvingArray | ObjectFlagsInstantiationExpressionType | ObjectFlagsSingleSignatureType
 * 	// Flags that require TypeFlags.Object
 * 	ObjectFlagsContainsSpread              = 1 << 22 // Object literal contains spread operation
 * 	ObjectFlagsObjectRestType              = 1 << 23 // Originates in object rest declaration
 * 	ObjectFlagsInstantiationExpressionType = 1 << 24 // Originates in instantiation expression
 * 	ObjectFlagsSingleSignatureType         = 1 << 25 // A single signature type extracted from a potentially broader type
 * 	ObjectFlagsIsClassInstanceClone        = 1 << 26 // Type is a clone of a class instance type
 * 	// Flags that require TypeFlags.Object and ObjectFlags.Reference
 * 	ObjectFlagsIdenticalBaseTypeCalculated = 1 << 27 // has had `getSingleBaseForNonAugmentingSubtype` invoked on it already
 * 	ObjectFlagsIdenticalBaseTypeExists     = 1 << 28 // has a defined cachedEquivalentBaseType member
 * 	ObjectFlagsUnresolvedMembers           = 1 << 29 // Member resolution in process
 * 	// Flags that require TypeFlags.UnionOrIntersection or TypeFlags.Substitution
 * 	ObjectFlagsIsGenericTypeComputed = 1 << 22 // IsGenericObjectType flag has been computed
 * 	ObjectFlagsIsGenericObjectType   = 1 << 23 // Union or intersection contains generic object type
 * 	ObjectFlagsIsGenericIndexType    = 1 << 24 // Union or intersection contains generic index type
 * 	ObjectFlagsIsGenericType         = ObjectFlagsIsGenericObjectType | ObjectFlagsIsGenericIndexType
 * 	// Flags that require TypeFlags.Union
 * 	ObjectFlagsContainsIntersections      = 1 << 25 // Union contains intersections
 * 	ObjectFlagsIsUnknownLikeUnionComputed = 1 << 26 // IsUnknownLikeUnion flag has been computed
 * 	ObjectFlagsIsUnknownLikeUnion         = 1 << 27 // Union of null, undefined, and empty object type
 * 	// Flags that require TypeFlags.Intersection
 * 	ObjectFlagsIsNeverIntersectionComputed = 1 << 25 // IsNeverLike flag has been computed
 * 	ObjectFlagsIsNeverIntersection         = 1 << 26 // Intersection reduces to never
 * 	ObjectFlagsIsConstrainedTypeVariable   = 1 << 27 // T & C, where T's constraint and C are primitives, object, or {}
 * )
 */
export const ObjectFlagsNone: ObjectFlags = 0;
export const ObjectFlagsClass: ObjectFlags = 1 << 0;
export const ObjectFlagsInterface: ObjectFlags = 1 << 1;
export const ObjectFlagsReference: ObjectFlags = 1 << 2;
export const ObjectFlagsTuple: ObjectFlags = 1 << 3;
export const ObjectFlagsAnonymous: ObjectFlags = 1 << 4;
export const ObjectFlagsMapped: ObjectFlags = 1 << 5;
export const ObjectFlagsInstantiated: ObjectFlags = 1 << 6;
export const ObjectFlagsObjectLiteral: ObjectFlags = 1 << 7;
export const ObjectFlagsEvolvingArray: ObjectFlags = 1 << 8;
export const ObjectFlagsObjectLiteralPatternWithComputedProperties: ObjectFlags = 1 << 9;
export const ObjectFlagsReverseMapped: ObjectFlags = 1 << 10;
export const ObjectFlagsJsxAttributes: ObjectFlags = 1 << 11;
export const ObjectFlagsJSLiteral: ObjectFlags = 1 << 12;
export const ObjectFlagsFreshLiteral: ObjectFlags = 1 << 13;
export const ObjectFlagsArrayLiteral: ObjectFlags = 1 << 14;
export const ObjectFlagsPrimitiveUnion: ObjectFlags = 1 << 15;
export const ObjectFlagsContainsWideningType: ObjectFlags = 1 << 16;
export const ObjectFlagsContainsObjectOrArrayLiteral: ObjectFlags = 1 << 17;
export const ObjectFlagsNonInferrableType: ObjectFlags = 1 << 18;
export const ObjectFlagsCouldContainTypeVariablesComputed: ObjectFlags = 1 << 19;
export const ObjectFlagsCouldContainTypeVariables: ObjectFlags = 1 << 20;
export const ObjectFlagsMembersResolved: ObjectFlags = 1 << 21;
export const ObjectFlagsClassOrInterface: int = (ObjectFlagsClass | ObjectFlagsInterface) >>> 0;
export const ObjectFlagsRequiresWidening: int =
  (ObjectFlagsContainsWideningType | ObjectFlagsContainsObjectOrArrayLiteral) >>> 0;
export const ObjectFlagsPropagatingFlags: int =
  (ObjectFlagsContainsWideningType | ObjectFlagsContainsObjectOrArrayLiteral | ObjectFlagsNonInferrableType) >>> 0;
export const ObjectFlagsInstantiatedMapped: int = (ObjectFlagsMapped | ObjectFlagsInstantiated) >>> 0;
export const ObjectFlagsContainsSpread: int = 1 << 22;
export const ObjectFlagsObjectRestType: int = 1 << 23;
export const ObjectFlagsInstantiationExpressionType: int = 1 << 24;
export const ObjectFlagsSingleSignatureType: int = 1 << 25;
export const ObjectFlagsIsClassInstanceClone: int = 1 << 26;
export const ObjectFlagsObjectTypeKindMask: int =
  (ObjectFlagsClassOrInterface |
    ObjectFlagsReference |
    ObjectFlagsTuple |
    ObjectFlagsAnonymous |
    ObjectFlagsMapped |
    ObjectFlagsReverseMapped |
    ObjectFlagsEvolvingArray |
    ObjectFlagsInstantiationExpressionType |
    ObjectFlagsSingleSignatureType) >>>
  0;
export const ObjectFlagsIdenticalBaseTypeCalculated: int = 1 << 27;
export const ObjectFlagsIdenticalBaseTypeExists: int = 1 << 28;
export const ObjectFlagsUnresolvedMembers: int = 1 << 29;
export const ObjectFlagsIsGenericTypeComputed: int = 1 << 22;
export const ObjectFlagsIsGenericObjectType: int = 1 << 23;
export const ObjectFlagsIsGenericIndexType: int = 1 << 24;
export const ObjectFlagsIsGenericType: int = (ObjectFlagsIsGenericObjectType | ObjectFlagsIsGenericIndexType) >>> 0;
export const ObjectFlagsContainsIntersections: int = 1 << 25;
export const ObjectFlagsIsUnknownLikeUnionComputed: int = 1 << 26;
export const ObjectFlagsIsUnknownLikeUnion: int = 1 << 27;
export const ObjectFlagsIsNeverIntersectionComputed: int = 1 << 25;
export const ObjectFlagsIsNeverIntersection: int = 1 << 26;
export const ObjectFlagsIsConstrainedTypeVariable: int = 1 << 27;

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::type::TypeAlias","kind":"type","status":"implemented","sigHash":"ac31cd554edf60bdb87690df0da0f914d5ea5d6200e1d23f439d5e995fe23407","bodyHash":"6b302ee2ca3d3aa440faae4a150d6dd86dd562e71461887666ecb08303a0d335"}
 *
 * Go source:
 * TypeAlias struct {
 * 	symbol        *ast.Symbol
 * 	typeArguments []*Type
 * }
 */
export interface TypeAlias {
  "symbol": GoPtr<Symbol_62f2f8bf>;
  typeArguments: GoSlice<GoPtr<Type>>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::method::TypeAlias.Symbol","kind":"method","status":"implemented","sigHash":"03f2c0317d6c373b2319092b7b3526584d13575c973317de60d5bb22acac6ff1","bodyHash":"94dac0d2bf5f1b870af1f8c25b4ced582af4e6d6a5595868c3ecd34527672fc5"}
 *
 * Go source:
 * func (a *TypeAlias) Symbol() *ast.Symbol {
 * 	if a == nil {
 * 		return nil
 * 	}
 * 	return a.symbol
 * }
 */
export function TypeAlias_Symbol(receiver: GoPtr<TypeAlias>): GoPtr<Symbol_62f2f8bf> {
  if (receiver === undefined) {
    return undefined;
  }
  return receiver.symbol;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::method::TypeAlias.TypeArguments","kind":"method","status":"implemented","sigHash":"d9ec20c58e98fbec383d651b650d376b181246db0cfb567dd34d2a72b1e0566b","bodyHash":"5938a33d1e200988652a121e1bdf681648d7d01f570821a3eb6e6dcc28e33afa"}
 *
 * Go source:
 * func (a *TypeAlias) TypeArguments() []*Type {
 * 	if a == nil {
 * 		return nil
 * 	}
 * 	return a.typeArguments
 * }
 */
export function TypeAlias_TypeArguments(receiver: GoPtr<TypeAlias>): GoSlice<GoPtr<Type>> {
  if (receiver === undefined) {
    return [];
  }
  return receiver.typeArguments;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::type::Type","kind":"type","status":"implemented","sigHash":"2aaaa3ca2ce668390a4deaf3dd2632b4ac0244a3c723df8f29ba82e064fc5098","bodyHash":"29510f2042b5d0a917dacec7367f7db171846b3d7d97bae51007c5cdcbdc7759"}
 *
 * Go source:
 * Type struct {
 * 	flags       TypeFlags
 * 	objectFlags ObjectFlags
 * 	id          TypeId
 * 	symbol      *ast.Symbol
 * 	alias       *TypeAlias
 * 	checker     *Checker
 * 	data        TypeData // Type specific data
 * }
 */
export interface Type {
  flags: TypeFlags;
  objectFlags: ObjectFlags;
  id: TypeId;
  "symbol": GoPtr<Symbol_62f2f8bf>;
  alias: GoPtr<TypeAlias>;
  checker: GoPtr<Checker>;
  data: TypeData;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::method::Type.Id","kind":"method","status":"implemented","sigHash":"518f3d45f8647a78a1e3535877ae7aa529b9ccfc1877c75c14c3a7ce82f199d8","bodyHash":"12353cfbe2f88fd5b38b4047a81dcb78d25931473e50e854281e9b8112c9396e"}
 *
 * Go source:
 * func (t *Type) Id() TypeId {
 * 	return t.id
 * }
 */
export function Type_Id(receiver: GoPtr<Type>): TypeId {
  return receiver!.id;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::method::Type.Flags","kind":"method","status":"implemented","sigHash":"be75c891bf532e9ba5a61543f9d32db38e5754fa447e16fbe4b8b08c2d64abe0","bodyHash":"752888fa38b61f441e9a8f47b3dad7164aed9d6fabb0ccaf7d605db6c1b9efd6"}
 *
 * Go source:
 * func (t *Type) Flags() TypeFlags {
 * 	return t.flags
 * }
 */
export function Type_Flags(receiver: GoPtr<Type>): TypeFlags {
  return receiver!.flags;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::method::Type.ObjectFlags","kind":"method","status":"implemented","sigHash":"60f63cfd3c80a9ca4f09ec14bda620045275abcd1379844393850dd0576eaced","bodyHash":"a12faa41ce3ba5eb1bdf657d86dfa471a0259793c79e80b6930685ac61fff2eb"}
 *
 * Go source:
 * func (t *Type) ObjectFlags() ObjectFlags {
 * 	return t.objectFlags
 * }
 */
export function Type_ObjectFlags(receiver: GoPtr<Type>): ObjectFlags {
  return receiver!.objectFlags;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::method::Type.AsIntrinsicType","kind":"method","status":"implemented","sigHash":"bafa2bf5db9ed4509b66f16166bf7ebde5d99a0377e360adb4fd928dc616d295","bodyHash":"4864df5ef00c757973d90152aa5ddd07b5a6d4002e0e4db250b4231eaa0b0f09"}
 *
 * Go source:
 * func (t *Type) AsIntrinsicType() *IntrinsicType           { return t.data.(*IntrinsicType) }
 */
export function Type_AsIntrinsicType(receiver: GoPtr<Type>): GoPtr<IntrinsicType> {
  return receiver!.data as unknown as GoPtr<IntrinsicType>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::method::Type.AsLiteralType","kind":"method","status":"implemented","sigHash":"d081823d72424d92910f6a6af433f67e554b98c8e56b5b68b51d71dfaf31d06c","bodyHash":"c04a281c2075565b94a8641a0503e40c3574f97744ea6a6f34ec623c22afb6d1"}
 *
 * Go source:
 * func (t *Type) AsLiteralType() *LiteralType               { return t.data.(*LiteralType) }
 */
export function Type_AsLiteralType(receiver: GoPtr<Type>): GoPtr<LiteralType> {
  return receiver!.data as unknown as GoPtr<LiteralType>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::method::Type.AsUniqueESSymbolType","kind":"method","status":"implemented","sigHash":"d0cb68b1a774ed5a474976d50336b8f211791532e2ccdc386505f7be97d3b7fc","bodyHash":"27be6ae326f8a232c1dd4a029770a34d0f853379db877faea4a97ffd9014cbfe"}
 *
 * Go source:
 * func (t *Type) AsUniqueESSymbolType() *UniqueESSymbolType { return t.data.(*UniqueESSymbolType) }
 */
export function Type_AsUniqueESSymbolType(receiver: GoPtr<Type>): GoPtr<UniqueESSymbolType> {
  return receiver!.data as unknown as GoPtr<UniqueESSymbolType>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::method::Type.AsTupleType","kind":"method","status":"implemented","sigHash":"87a6244ee7a1556ef6f22cd73b56c58d9a2d7813fce71fd8c0c9ea2f9c337f4e","bodyHash":"cac9e0bde782555d884a31fb72a5eaebaa069f75d32d77ac7709faf6ff91c9cf"}
 *
 * Go source:
 * func (t *Type) AsTupleType() *TupleType                   { return t.data.(*TupleType) }
 */
export function Type_AsTupleType(receiver: GoPtr<Type>): GoPtr<TupleType> {
  return receiver!.data as unknown as GoPtr<TupleType>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::method::Type.AsInstantiationExpressionType","kind":"method","status":"implemented","sigHash":"388e7aba0d3d7083193298dbce1a0a160a24ebd5849ac250b10c109d8d6d236b","bodyHash":"25e8e4688edb1e0710d6b8b57479ace401ce696261c7f7e31d11660e7bc3edab"}
 *
 * Go source:
 * func (t *Type) AsInstantiationExpressionType() *InstantiationExpressionType {
 * 	return t.data.(*InstantiationExpressionType)
 * }
 */
export function Type_AsInstantiationExpressionType(receiver: GoPtr<Type>): GoPtr<InstantiationExpressionType> {
  return receiver!.data as unknown as GoPtr<InstantiationExpressionType>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::method::Type.AsMappedType","kind":"method","status":"implemented","sigHash":"426cf1c601b4e4293f4286ecd4d75b177c928ac8a2295a12a14add33ab7e7113","bodyHash":"99ac4e9cdb8fb89a84256f34159794b8319ed915a0041e69acc7b056dfd6ff3f"}
 *
 * Go source:
 * func (t *Type) AsMappedType() *MappedType                   { return t.data.(*MappedType) }
 */
export function Type_AsMappedType(receiver: GoPtr<Type>): GoPtr<MappedType> {
  return receiver!.data as unknown as GoPtr<MappedType>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::method::Type.AsReverseMappedType","kind":"method","status":"implemented","sigHash":"7ebfa87e3c5eae1ed51cafadf832529d59920f56fa97fba8289c851175fbcee0","bodyHash":"765b489bcf4d1f3039c563a0c09fa4688bf6a1b0648d3d7a64ee97e10fcdcb0f"}
 *
 * Go source:
 * func (t *Type) AsReverseMappedType() *ReverseMappedType     { return t.data.(*ReverseMappedType) }
 */
export function Type_AsReverseMappedType(receiver: GoPtr<Type>): GoPtr<ReverseMappedType> {
  return receiver!.data as unknown as GoPtr<ReverseMappedType>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::method::Type.AsEvolvingArrayType","kind":"method","status":"implemented","sigHash":"06e45dd2705910c80e62ef39581c8bfabcc8b37decf2ddbbcfbf053274365fed","bodyHash":"18c2fe5d61349ed471300a5032a5ba427b44d9e87a791070bde708da7b9ea376"}
 *
 * Go source:
 * func (t *Type) AsEvolvingArrayType() *EvolvingArrayType     { return t.data.(*EvolvingArrayType) }
 */
export function Type_AsEvolvingArrayType(receiver: GoPtr<Type>): GoPtr<EvolvingArrayType> {
  return receiver!.data as unknown as GoPtr<EvolvingArrayType>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::method::Type.AsTypeParameter","kind":"method","status":"implemented","sigHash":"6f39183439fb1457462463d7fcbc5ab57e065eaf6a038782df50ad414d7fb8ce","bodyHash":"0ed3979981809261dc9748ef97ba593e9c17896626562c4a6ea21280a7bc0a87"}
 *
 * Go source:
 * func (t *Type) AsTypeParameter() *TypeParameter             { return t.data.(*TypeParameter) }
 */
export function Type_AsTypeParameter(receiver: GoPtr<Type>): GoPtr<TypeParameter> {
  return receiver!.data as unknown as GoPtr<TypeParameter>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::method::Type.AsUnionType","kind":"method","status":"implemented","sigHash":"136091f1163310e107053fee430ab40ba210c1ab91a08b15416cc2ee9b284c2c","bodyHash":"eaa29c3acbf536dc64e8ae120a80863fb7bf2cdc508cbdde5d2ba6b07d713825"}
 *
 * Go source:
 * func (t *Type) AsUnionType() *UnionType                     { return t.data.(*UnionType) }
 */
export function Type_AsUnionType(receiver: GoPtr<Type>): GoPtr<UnionType> {
  return receiver!.data as unknown as GoPtr<UnionType>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::method::Type.AsIntersectionType","kind":"method","status":"implemented","sigHash":"d583537b5bf8e5811adb00f0a8b15d3c805c0571991c7172c01de64f7ada0fa4","bodyHash":"b1a955f5e9e27d878f88735ef4e147a794132fd53169b260e0b0bb90b7134349"}
 *
 * Go source:
 * func (t *Type) AsIntersectionType() *IntersectionType       { return t.data.(*IntersectionType) }
 */
export function Type_AsIntersectionType(receiver: GoPtr<Type>): GoPtr<IntersectionType> {
  return receiver!.data as unknown as GoPtr<IntersectionType>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::method::Type.AsIndexType","kind":"method","status":"implemented","sigHash":"43098053b544c1e90e7f382c6aa9839726a57da1f17a7f98f46797919859cdd5","bodyHash":"19eb76a1a3b86ee7120f809774045520453f5f2686240067af44aef612da1b93"}
 *
 * Go source:
 * func (t *Type) AsIndexType() *IndexType                     { return t.data.(*IndexType) }
 */
export function Type_AsIndexType(receiver: GoPtr<Type>): GoPtr<IndexType> {
  return receiver!.data as unknown as GoPtr<IndexType>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::method::Type.AsIndexedAccessType","kind":"method","status":"implemented","sigHash":"e17cbd5aa71ba9571419598c20a4a4a3c1881646fd369185e34052a41237ba38","bodyHash":"aeaf82d682bb2dbebcbfff65fe3a0ba782c10277e38ae18cf0f1ec305d8b510f"}
 *
 * Go source:
 * func (t *Type) AsIndexedAccessType() *IndexedAccessType     { return t.data.(*IndexedAccessType) }
 */
export function Type_AsIndexedAccessType(receiver: GoPtr<Type>): GoPtr<IndexedAccessType> {
  return receiver!.data as unknown as GoPtr<IndexedAccessType>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::method::Type.AsTemplateLiteralType","kind":"method","status":"implemented","sigHash":"97be9b2d9fad4c21e5f0c29f9037c59f430ea1f08c643de4ccafd368c84c31e4","bodyHash":"77c7565c61b701025d36b2febe5f74d3df25f4df9b85664d33fc53ab15388d05"}
 *
 * Go source:
 * func (t *Type) AsTemplateLiteralType() *TemplateLiteralType { return t.data.(*TemplateLiteralType) }
 */
export function Type_AsTemplateLiteralType(receiver: GoPtr<Type>): GoPtr<TemplateLiteralType> {
  return receiver!.data as unknown as GoPtr<TemplateLiteralType>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::method::Type.AsStringMappingType","kind":"method","status":"implemented","sigHash":"9ff7467fbc4a0c985c3bb653a83185ee638863d80a02b7fc70c1d0d3dfe1f79a","bodyHash":"a67b1c8fbba65fbd71ea9a0619fb8c76f1081507448df5f0775bf91a57adad75"}
 *
 * Go source:
 * func (t *Type) AsStringMappingType() *StringMappingType     { return t.data.(*StringMappingType) }
 */
export function Type_AsStringMappingType(receiver: GoPtr<Type>): GoPtr<StringMappingType> {
  return receiver!.data as unknown as GoPtr<StringMappingType>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::method::Type.AsSubstitutionType","kind":"method","status":"implemented","sigHash":"c6b48a24a585afe46371390a644f6a079082a878b51195c6a97d0377c15c01ad","bodyHash":"bb3ba4a83618d45634c7fb6c9cd4d2fde4ec01adb7e31c4f74540e67ee02f13e"}
 *
 * Go source:
 * func (t *Type) AsSubstitutionType() *SubstitutionType       { return t.data.(*SubstitutionType) }
 */
export function Type_AsSubstitutionType(receiver: GoPtr<Type>): GoPtr<SubstitutionType> {
  return receiver!.data as unknown as GoPtr<SubstitutionType>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::method::Type.AsConditionalType","kind":"method","status":"implemented","sigHash":"158a4febf73f669bb544732c49e04d23706f97c74197c495e2c7a34f1d9bad6c","bodyHash":"91558796a6f8d1fa8e942f6ab131f0592a20e750e440238013f6c7936aaff91f"}
 *
 * Go source:
 * func (t *Type) AsConditionalType() *ConditionalType         { return t.data.(*ConditionalType) }
 */
export function Type_AsConditionalType(receiver: GoPtr<Type>): GoPtr<ConditionalType> {
  return receiver!.data as unknown as GoPtr<ConditionalType>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::method::Type.AsConstrainedType","kind":"method","status":"implemented","sigHash":"0a1aa0583fe9a45708c0610ad0ed6b1e0b3302c4f605cca478598e81095760d4","bodyHash":"0271f36b4e00e2959438da3918f263e193a5d12fbfd96d6d3faacf3ba0493043"}
 *
 * Go source:
 * func (t *Type) AsConstrainedType() *ConstrainedType { return t.data.AsConstrainedType() }
 */
export function Type_AsConstrainedType(receiver: GoPtr<Type>): GoPtr<ConstrainedType> {
  return receiver!.data.AsConstrainedType();
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::method::Type.AsStructuredType","kind":"method","status":"implemented","sigHash":"a25f906f2c7508f52455bda1fc74fd5941bd15d8d5a78fc622493471d48db5ea","bodyHash":"6934d7373d95416fd23501722f86357966ebc06b3bb69da2ce4020db747878ed"}
 *
 * Go source:
 * func (t *Type) AsStructuredType() *StructuredType   { return t.data.AsStructuredType() }
 */
export function Type_AsStructuredType(receiver: GoPtr<Type>): GoPtr<StructuredType> {
  return receiver!.data.AsStructuredType();
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::method::Type.AsObjectType","kind":"method","status":"implemented","sigHash":"994b136944e27fdaf9ac19ddae957a2e83a40c764290a7cbf7182ed735e1d4bf","bodyHash":"4d70058161f29b833cbeda72b133d938951aff1a5e3f3803fa871ec716e4a0b1"}
 *
 * Go source:
 * func (t *Type) AsObjectType() *ObjectType           { return t.data.AsObjectType() }
 */
export function Type_AsObjectType(receiver: GoPtr<Type>): GoPtr<ObjectType> {
  return receiver!.data.AsObjectType();
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::method::Type.AsTypeReference","kind":"method","status":"implemented","sigHash":"af35e46575166a6d2b958b70c866654d358ee253439cde1c9cf3fff7b0c73ab4","bodyHash":"5d47e32a9def8f6c152333bb8ec753d8c3c65059fb8e8bcbdc09493270076df6"}
 *
 * Go source:
 * func (t *Type) AsTypeReference() *TypeReference     { return t.data.AsTypeReference() }
 */
export function Type_AsTypeReference(receiver: GoPtr<Type>): GoPtr<TypeReference> {
  return receiver!.data.AsTypeReference();
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::method::Type.AsInterfaceType","kind":"method","status":"implemented","sigHash":"9f9bf1e073a8bbd88eb30b2649400eb9e6e8494e5e7137fd521f918b6d7b174a","bodyHash":"65e1c92005c34769fecb840986278ee338ca30f875ab63e70a59911f191acba6"}
 *
 * Go source:
 * func (t *Type) AsInterfaceType() *InterfaceType     { return t.data.AsInterfaceType() }
 */
export function Type_AsInterfaceType(receiver: GoPtr<Type>): GoPtr<InterfaceType> {
  return receiver!.data.AsInterfaceType();
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::method::Type.AsUnionOrIntersectionType","kind":"method","status":"implemented","sigHash":"007cb64fcc9a687151fe86cc95d364eade94d072d8fcd725026a00e5b0b14916","bodyHash":"e0b269a3ee1c06698987a16df5bf486be57204998b50390e036df9c545caa62e"}
 *
 * Go source:
 * func (t *Type) AsUnionOrIntersectionType() *UnionOrIntersectionType {
 * 	return t.data.AsUnionOrIntersectionType()
 * }
 */
export function Type_AsUnionOrIntersectionType(receiver: GoPtr<Type>): GoPtr<UnionOrIntersectionType> {
  return receiver!.data.AsUnionOrIntersectionType();
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::method::Type.Distributed","kind":"method","status":"implemented","sigHash":"0afe44ed5106ce9b540080812ada8a576d717fe3203cfa9dd8ef8391c354c4bc","bodyHash":"45be6a4f1acdbe3eebee960e0803b96f9ff800b225bee6bf9260eb2efad94a4b"}
 *
 * Go source:
 * func (t *Type) Distributed() []*Type {
 * 	switch {
 * 	case t.flags&TypeFlagsUnion != 0:
 * 		return t.AsUnionType().types
 * 	case t.flags&TypeFlagsNever != 0:
 * 		return nil
 * 	}
 * 	return []*Type{t}
 * }
 */
export function Type_Distributed(receiver: GoPtr<Type>): GoSlice<GoPtr<Type>> {
  if ((receiver!.flags & TypeFlagsUnion) !== 0) {
    return Type_Types(receiver);
  }
  if ((receiver!.flags & TypeFlagsNever) !== 0) {
    return [] as GoSlice<GoPtr<Type>>;
  }
  return [receiver];
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::method::Type.Target","kind":"method","status":"implemented","sigHash":"639e2f08a40f08aa283add5f5714a8b78b447267f9fa6b48bccb98e17d0dbbf1","bodyHash":"c35f1c1304f8a62dbe21cd6f496ee2f2e97df7baaa198c4b075915296b35cecd"}
 *
 * Go source:
 * func (t *Type) Target() *Type {
 * 	switch {
 * 	case t.flags&TypeFlagsObject != 0:
 * 		return t.AsObjectType().target
 * 	case t.flags&TypeFlagsTypeParameter != 0:
 * 		return t.AsTypeParameter().target
 * 	case t.flags&TypeFlagsIndex != 0:
 * 		return t.AsIndexType().target
 * 	case t.flags&TypeFlagsStringMapping != 0:
 * 		return t.AsStringMappingType().target
 * 	case t.flags&TypeFlagsObject != 0 && t.objectFlags&ObjectFlagsMapped != 0:
 * 		return t.AsMappedType().target
 * 	}
 * 	panic("Unhandled case in Type.Target")
 * }
 */
export function Type_Target(receiver: GoPtr<Type>): GoPtr<Type> {
  if ((receiver!.flags & TypeFlagsObject) !== 0) {
    return Type_AsObjectType(receiver)!.target;
  }
  if ((receiver!.flags & TypeFlagsTypeParameter) !== 0) {
    return Type_AsTypeParameter(receiver)!.target;
  }
  if ((receiver!.flags & TypeFlagsIndex) !== 0) {
    return Type_AsIndexType(receiver)!.target;
  }
  if ((receiver!.flags & TypeFlagsStringMapping) !== 0) {
    return Type_AsStringMappingType(receiver)!.target;
  }
  if ((receiver!.flags & TypeFlagsObject) !== 0 && (receiver!.objectFlags & ObjectFlagsMapped) !== 0) {
    return Type_AsMappedType(receiver)!.__tsgoEmbedded0!.target;
  }
  throw new globalThis.Error("Unhandled case in Type.Target");
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::method::Type.Mapper","kind":"method","status":"implemented","sigHash":"87756a05b39fe728017dabeba662b4de2a5a466abadf9d5fc453cb0ba48c72ef","bodyHash":"c47137c46e61a4ba44b7a3ac46dfc102358f4aa13fec4ba20634ff14c46df87b"}
 *
 * Go source:
 * func (t *Type) Mapper() *TypeMapper {
 * 	switch {
 * 	case t.flags&TypeFlagsObject != 0:
 * 		return t.AsObjectType().mapper
 * 	case t.flags&TypeFlagsTypeParameter != 0:
 * 		return t.AsTypeParameter().mapper
 * 	case t.flags&TypeFlagsConditional != 0:
 * 		return t.AsConditionalType().mapper
 * 	}
 * 	panic("Unhandled case in Type.Mapper")
 * }
 */
export function Type_Mapper(receiver: GoPtr<Type>): GoPtr<TypeMapper> {
  if ((receiver!.flags & TypeFlagsObject) !== 0) {
    return Type_AsObjectType(receiver)!.mapper;
  }
  if ((receiver!.flags & TypeFlagsTypeParameter) !== 0) {
    return Type_AsTypeParameter(receiver)!.mapper;
  }
  if ((receiver!.flags & TypeFlagsConditional) !== 0) {
    return Type_AsConditionalType(receiver)!.mapper;
  }
  throw new globalThis.Error("Unhandled case in Type.Mapper");
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::method::Type.Types","kind":"method","status":"implemented","sigHash":"77acb477a1bc9608a1aacc5a0bc1f5a8896878c4cb9c01b1418fdd59ece9d62f","bodyHash":"46cd31baea11fdf046c30ef4e33d3ca049db07d7f444f1ff4051bf3e79ed9854"}
 *
 * Go source:
 * func (t *Type) Types() []*Type {
 * 	switch {
 * 	case t.flags&TypeFlagsUnionOrIntersection != 0:
 * 		return t.AsUnionOrIntersectionType().types
 * 	case t.flags&TypeFlagsTemplateLiteral != 0:
 * 		return t.AsTemplateLiteralType().types
 * 	}
 * 	panic("Unhandled case in Type.Types")
 * }
 */
export function Type_Types(receiver: GoPtr<Type>): GoSlice<GoPtr<Type>> {
  if ((receiver!.flags & TypeFlagsUnionOrIntersection) !== 0) {
    return Type_AsUnionOrIntersectionType(receiver)!.types;
  }
  if ((receiver!.flags & TypeFlagsTemplateLiteral) !== 0) {
    return Type_AsTemplateLiteralType(receiver)!.types;
  }
  throw new globalThis.Error("Unhandled case in Type.Types");
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::method::Type.TargetInterfaceType","kind":"method","status":"implemented","sigHash":"70291551ad346997a2cdc44373dd81a04f3aa4e22645727b5279200b1980933f","bodyHash":"7c2376bcf743a0875ca4cacbb011159b6ff1585fe2aad9d2e37b95191699f031"}
 *
 * Go source:
 * func (t *Type) TargetInterfaceType() *InterfaceType {
 * 	return t.AsTypeReference().target.AsInterfaceType()
 * }
 */
export function Type_TargetInterfaceType(receiver: GoPtr<Type>): GoPtr<InterfaceType> {
  return Type_AsInterfaceType(Type_Target(receiver));
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::method::Type.TargetTupleType","kind":"method","status":"implemented","sigHash":"1fea9c5b0efe228163ee00d7c3a8c02487a87592a298a5abeea386548738e51c","bodyHash":"74c45cf6e234909df717ce8a74b4120640baf6fa5032ca36b56cf35087576b17"}
 *
 * Go source:
 * func (t *Type) TargetTupleType() *TupleType {
 * 	return t.AsTypeReference().target.AsTupleType()
 * }
 */
export function Type_TargetTupleType(receiver: GoPtr<Type>): GoPtr<TupleType> {
  return Type_AsTupleType(Type_Target(receiver));
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::method::Type.Symbol","kind":"method","status":"implemented","sigHash":"1320d383095dcf79a15f6abc6b9cc17237406a3e73d1d39ae28e4f3a22f6c39f","bodyHash":"a6f852f5cabdd113001d35c74be3ce9bfe69f49ad43ead0fb1852cc0390a5588"}
 *
 * Go source:
 * func (t *Type) Symbol() *ast.Symbol {
 * 	return t.symbol
 * }
 */
export function Type_Symbol(receiver: GoPtr<Type>): GoPtr<Symbol_62f2f8bf> {
  return receiver!.symbol;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::method::Type.IsUnion","kind":"method","status":"implemented","sigHash":"e2db35f5282304268763587807ec788b48853145056a0159fb73766c0020702e","bodyHash":"33600854d4aeab6e34b494f064e36d6a1c50f2b258ae425abeef64afa8786438"}
 *
 * Go source:
 * func (t *Type) IsUnion() bool {
 * 	return t.flags&TypeFlagsUnion != 0
 * }
 */
export function Type_IsUnion(receiver: GoPtr<Type>): bool {
  return (receiver!.flags & TypeFlagsUnion) !== 0;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::method::Type.IsString","kind":"method","status":"implemented","sigHash":"b67e49df65686a11fab01148042c8230e3c7cb29d8c679a0c7a6671ee0dd6d40","bodyHash":"3fa19e4b927f6a4dd73de5ac77e3486cafedfe5015e6f3ed324abfb8073b2d84"}
 *
 * Go source:
 * func (t *Type) IsString() bool {
 * 	return t.flags&TypeFlagsString != 0
 * }
 */
export function Type_IsString(receiver: GoPtr<Type>): bool {
  return (receiver!.flags & TypeFlagsString) !== 0;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::method::Type.IsIntersection","kind":"method","status":"implemented","sigHash":"3a17a65fe9a2a8f69ce4937389fca08f6b9e32c26a13ed10c94ee0aba9b9fa9f","bodyHash":"af41031ba2ab10293fff506624d19181a9e8def02bfa5608db41736a4e7d99b5"}
 *
 * Go source:
 * func (t *Type) IsIntersection() bool {
 * 	return t.flags&TypeFlagsIntersection != 0
 * }
 */
export function Type_IsIntersection(receiver: GoPtr<Type>): bool {
  return (receiver!.flags & TypeFlagsIntersection) !== 0;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::method::Type.IsStringLiteral","kind":"method","status":"implemented","sigHash":"1fd4a4149fa59c55eef94bc551165b9a4e7e315138e147e6d913f7b9f8e539c4","bodyHash":"1aa8ec5b9cc3177fe964569c77ba0f989553c0ee169532bb7d07da1811044d6e"}
 *
 * Go source:
 * func (t *Type) IsStringLiteral() bool {
 * 	return t.flags&TypeFlagsStringLiteral != 0
 * }
 */
export function Type_IsStringLiteral(receiver: GoPtr<Type>): bool {
  return (receiver!.flags & TypeFlagsStringLiteral) !== 0;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::method::Type.IsNumberLiteral","kind":"method","status":"implemented","sigHash":"e186ec9ed6bcafdf61d78fca1c6fdbbfb97cc4dc5c0417f0637379c1c706b080","bodyHash":"c2c81d8ab657864a373be5f4664ab6c5a199c152030bd11f5049b6ec167f2255"}
 *
 * Go source:
 * func (t *Type) IsNumberLiteral() bool {
 * 	return t.flags&TypeFlagsNumberLiteral != 0
 * }
 */
export function Type_IsNumberLiteral(receiver: GoPtr<Type>): bool {
  return (receiver!.flags & TypeFlagsNumberLiteral) !== 0;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::method::Type.IsBigIntLiteral","kind":"method","status":"implemented","sigHash":"7e83d64a3a2631d6270f61c753acd1033c453e69ab51f0554378bf9e1e276ecc","bodyHash":"74de7b18746d539d4c4285933b5c29e3589d705125a8d1f69caef7a1548607fc"}
 *
 * Go source:
 * func (t *Type) IsBigIntLiteral() bool {
 * 	return t.flags&TypeFlagsBigIntLiteral != 0
 * }
 */
export function Type_IsBigIntLiteral(receiver: GoPtr<Type>): bool {
  return (receiver!.flags & TypeFlagsBigIntLiteral) !== 0;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::method::Type.IsEnumLiteral","kind":"method","status":"implemented","sigHash":"4e509bd2c30802ebc9d5a7273994cf93c319a363fd9aaa7914922fcb69bb66ac","bodyHash":"30ab0850245e31a0cce28793805afdd366a90983069d6f6c2f87bdd08cb8ec2b"}
 *
 * Go source:
 * func (t *Type) IsEnumLiteral() bool {
 * 	return t.flags&TypeFlagsEnumLiteral != 0
 * }
 */
export function Type_IsEnumLiteral(receiver: GoPtr<Type>): bool {
  return (receiver!.flags & TypeFlagsEnumLiteral) !== 0;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::method::Type.IsBooleanLike","kind":"method","status":"implemented","sigHash":"511dbdb6881a55ad470d472fd09104e0f23884421c100390d244654c4cac8149","bodyHash":"348e0a9a63a4518673483151213f9196cd691b8baa9093ffe25d1d815e01e589"}
 *
 * Go source:
 * func (t *Type) IsBooleanLike() bool {
 * 	return t.flags&TypeFlagsBooleanLike != 0
 * }
 */
export function Type_IsBooleanLike(receiver: GoPtr<Type>): bool {
  return (receiver!.flags & TypeFlagsBooleanLike) !== 0;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::method::Type.IsStringLike","kind":"method","status":"implemented","sigHash":"233292245556b527c8610babd2b5dd58387e85d0e35112b34d5285ba26a91844","bodyHash":"22f8d966fc3f5f71d410fbe35828aae77e26925c5f4a9659cccb4e56d183fa21"}
 *
 * Go source:
 * func (t *Type) IsStringLike() bool {
 * 	return t.flags&TypeFlagsStringLike != 0
 * }
 */
export function Type_IsStringLike(receiver: GoPtr<Type>): bool {
  return (receiver!.flags & TypeFlagsStringLike) !== 0;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::method::Type.IsClass","kind":"method","status":"implemented","sigHash":"ba5578976a5776b516727a8ba62d533a4b29af3f0502e0529db723d401855a01","bodyHash":"393afbf44b1732893361f672cdb79e6cec50fd55c7b7ae00deb768aa6561e958"}
 *
 * Go source:
 * func (t *Type) IsClass() bool {
 * 	return t.objectFlags&ObjectFlagsClass != 0
 * }
 */
export function Type_IsClass(receiver: GoPtr<Type>): bool {
  return (receiver!.objectFlags & ObjectFlagsClass) !== 0;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::method::Type.IsTypeParameter","kind":"method","status":"implemented","sigHash":"c4fb9230835fe3cea5461cb6802c42ca4f1e3fd6aa8cd8ed0542b353a27a28f5","bodyHash":"10d6f07c4e3c511f1aea9a2b781c70acba94eeff50455d62e65efefbb61df8cc"}
 *
 * Go source:
 * func (t *Type) IsTypeParameter() bool {
 * 	return t.flags&TypeFlagsTypeParameter != 0
 * }
 */
export function Type_IsTypeParameter(receiver: GoPtr<Type>): bool {
  return (receiver!.flags & TypeFlagsTypeParameter) !== 0;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::method::Type.IsIndex","kind":"method","status":"implemented","sigHash":"71f0f14f3b2ace6c9eaa782eaa6c7e799c69d0cfaacd7556f170d6a0517569f4","bodyHash":"2622ebb62d3ac2a06e646be1600a95fadc9a66bab4294947277bbb763791b692"}
 *
 * Go source:
 * func (t *Type) IsIndex() bool {
 * 	return t.flags&TypeFlagsIndex != 0
 * }
 */
export function Type_IsIndex(receiver: GoPtr<Type>): bool {
  return (receiver!.flags & TypeFlagsIndex) !== 0;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::method::Type.IsTupleType","kind":"method","status":"implemented","sigHash":"312167a2123a0d7b3480d35154a7bad0d1c75d9c12c2a3f830061d183652a8b4","bodyHash":"912db9aeeae571619ec18a89e9f682450644941d381590e5910e5aa6489f60ce"}
 *
 * Go source:
 * func (t *Type) IsTupleType() bool {
 * 	return isTupleType(t)
 * }
 */
export function Type_IsTupleType(receiver: GoPtr<Type>): bool {
  return isTupleType(receiver);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::type::TypeData","kind":"type","status":"implemented","sigHash":"cb9773d76e7a0ca25b0cd133e7f903b1a70e4bb9ae7367d8248fd99da5646634","bodyHash":"0ec5506009102c9c902d214d0208a83965f94cc90c3b565daedd757c8c90926f"}
 *
 * Go source:
 * TypeData interface {
 * 	AsType() *Type
 * 	AsConstrainedType() *ConstrainedType
 * 	AsStructuredType() *StructuredType
 * 	AsObjectType() *ObjectType
 * 	AsTypeReference() *TypeReference
 * 	AsInterfaceType() *InterfaceType
 * 	AsUnionOrIntersectionType() *UnionOrIntersectionType
 * }
 */
export interface TypeData extends GoInterfaceValue<unknown> {
  AsType(): GoPtr<Type>;
  AsConstrainedType(): GoPtr<ConstrainedType>;
  AsStructuredType(): GoPtr<StructuredType>;
  AsObjectType(): GoPtr<ObjectType>;
  AsTypeReference(): GoPtr<TypeReference>;
  AsInterfaceType(): GoPtr<InterfaceType>;
  AsUnionOrIntersectionType(): GoPtr<UnionOrIntersectionType>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::type::TypeBase","kind":"type","status":"implemented","sigHash":"e46ccdcb77acb513abe916aedfd55389afe55a0be1bf46f08ae6586d680062e7","bodyHash":"12e53ba07002f6261f6f37b6462a637b55f055c33d5d917e1e699a0973a8e289"}
 *
 * Go source:
 * TypeBase struct {
 * 	Type
 * }
 */
export interface TypeBase {
  readonly __tsgoEmbedded0?: Type;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::method::TypeBase.AsType","kind":"method","status":"implemented","sigHash":"f55eba3fb643aef5b1ca790bfb78ff0a5d9f26304d6d1f033ca88077b212f4f7","bodyHash":"415886abcb19bc720e1d4cafdbeb71a2b122fac17f0ff530f65fe3ed529c5ca9"}
 *
 * Go source:
 * func (t *TypeBase) AsType() *Type                                       { return &t.Type }
 */
export function TypeBase_AsType(receiver: GoPtr<TypeBase>): GoPtr<Type> {
  return receiver!.__tsgoEmbedded0;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::method::TypeBase.AsConstrainedType","kind":"method","status":"implemented","sigHash":"a7900fef2295fb0d2bf1cf25443a892737fbc843a2727d4bb8e63b20453a32f1","bodyHash":"bf9e7913bdb774b1af75dd2de8c038e32aea9e547365a15110bc81f959084338"}
 *
 * Go source:
 * func (t *TypeBase) AsConstrainedType() *ConstrainedType                 { return nil }
 */
export function TypeBase_AsConstrainedType(receiver: GoPtr<TypeBase>): GoPtr<ConstrainedType> {
  return undefined;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::method::TypeBase.AsStructuredType","kind":"method","status":"implemented","sigHash":"176316684357fce4ca029288a7ed31182404c73760dd4324bdeb54dd837c1d81","bodyHash":"38b20be9d2b986e935ccad9ce3a34e29a052c28acfee414b4a5a3334e6fb6e67"}
 *
 * Go source:
 * func (t *TypeBase) AsStructuredType() *StructuredType                   { return nil }
 */
export function TypeBase_AsStructuredType(receiver: GoPtr<TypeBase>): GoPtr<StructuredType> {
  return undefined;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::method::TypeBase.AsObjectType","kind":"method","status":"implemented","sigHash":"5f699180ec63e8da21100cbf62b6a6812dfabbe23c341f6030b10a0484f0cc0d","bodyHash":"61dbc0ccb40079e46cb296f7f77a3c5fa033977134b39be73c76acec193750d5"}
 *
 * Go source:
 * func (t *TypeBase) AsObjectType() *ObjectType                           { return nil }
 */
export function TypeBase_AsObjectType(receiver: GoPtr<TypeBase>): GoPtr<ObjectType> {
  return undefined;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::method::TypeBase.AsTypeReference","kind":"method","status":"implemented","sigHash":"e38fd0ac3d7a74464dbc601d1d54b84a0480918ba786e930c37b59e7c5a38a5a","bodyHash":"451c1cc8334dab681c55748f06d9c7eaf440586275fd70de7ac919912ccd7d03"}
 *
 * Go source:
 * func (t *TypeBase) AsTypeReference() *TypeReference                     { return nil }
 */
export function TypeBase_AsTypeReference(receiver: GoPtr<TypeBase>): GoPtr<TypeReference> {
  return undefined;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::method::TypeBase.AsInterfaceType","kind":"method","status":"implemented","sigHash":"5eb7e0a3d477b9a374b18516fa4807807f75e4bfd46171258a8bb0c1e6ee1dfd","bodyHash":"08bfa62c62aaddb19f10f3ec4800cc75354555df600b13e031160bcbb78d4182"}
 *
 * Go source:
 * func (t *TypeBase) AsInterfaceType() *InterfaceType                     { return nil }
 */
export function TypeBase_AsInterfaceType(receiver: GoPtr<TypeBase>): GoPtr<InterfaceType> {
  return undefined;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::method::TypeBase.AsUnionOrIntersectionType","kind":"method","status":"implemented","sigHash":"9e97670b5afcc3a967e5f722e2cf3b9af9f4f0695656a4716d8d8e5357b9d250","bodyHash":"87fe033e2524c8dce2caa2296e9c8d53f585a02cdfa1fe8eee9d51c9c6a20102"}
 *
 * Go source:
 * func (t *TypeBase) AsUnionOrIntersectionType() *UnionOrIntersectionType { return nil }
 */
export function TypeBase_AsUnionOrIntersectionType(receiver: GoPtr<TypeBase>): GoPtr<UnionOrIntersectionType> {
  return undefined;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::type::IntrinsicType","kind":"type","status":"implemented","sigHash":"1bf22cd08e15779ef3bcc888dc0d4e81237413a5825c77658f6fc65868ff50d7","bodyHash":"d1d1d09acd96bd166bb1096b05665542a0079a673ebf0aa0971385a8f42f9163"}
 *
 * Go source:
 * IntrinsicType struct {
 * 	TypeBase
 * 	intrinsicName string
 * }
 */
export interface IntrinsicType {
  readonly __tsgoEmbedded0?: TypeBase;
  intrinsicName: string;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::method::IntrinsicType.IntrinsicName","kind":"method","status":"implemented","sigHash":"236e47edf74e1dc797fc5e9f641fab9b6852b84d1257a05adde3cd6e16f559cd","bodyHash":"c53ee6d2c6318860fd39284cd549553614c874f2b493d82c9b36d625cefad96d"}
 *
 * Go source:
 * func (t *IntrinsicType) IntrinsicName() string { return t.intrinsicName }
 */
export function IntrinsicType_IntrinsicName(receiver: GoPtr<IntrinsicType>): string {
  return receiver!.intrinsicName;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::type::LiteralType","kind":"type","status":"implemented","sigHash":"a40cc0de4cfcf3b923397a37713aa7b387de1c2f8789f8f8c9ca5506d57ad83a","bodyHash":"ad55932d673a27ce02d4957d624b80d20031a9c3319757fbd5d37ee054b06328"}
 *
 * Go source:
 * LiteralType struct {
 * 	TypeBase
 * 	value       any   // string | jsnum.Number | bool | PseudoBigInt | nil (computed enum)
 * 	freshType   *Type // Fresh version of type
 * 	regularType *Type // Regular version of type
 * }
 */
export interface LiteralType {
  readonly __tsgoEmbedded0?: TypeBase;
  value: unknown;
  freshType: GoPtr<Type>;
  regularType: GoPtr<Type>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::method::LiteralType.Value","kind":"method","status":"implemented","sigHash":"35fa47edebde1c30983475f238ceb22a545437b46afc8b0fea3ee19e0b50015f","bodyHash":"a648243d4c354794d5cf3f8ccb23e41c6c72b08a769242fc047f2fc2b1b0943a"}
 *
 * Go source:
 * func (t *LiteralType) Value() any {
 * 	return t.value
 * }
 */
export function LiteralType_Value(receiver: GoPtr<LiteralType>): unknown {
  return receiver!.value;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::method::LiteralType.String","kind":"method","status":"implemented","sigHash":"d4e06d0004c75c13ce4be9e7159fdea5ff817ea6adcfcc9d413a79c1023969fe","bodyHash":"e1e817395ac5239c25e25559aad1821e36effe99fcf8857243390414e1679ae8"}
 *
 * Go source:
 * func (t *LiteralType) String() string {
 * 	return ValueToString(t.value)
 * }
 */
export function LiteralType_String(receiver: GoPtr<LiteralType>): string {
  return ValueToString(receiver!.value);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::type::UniqueESSymbolType","kind":"type","status":"implemented","sigHash":"2027d6cd4d7825e6f709f3f4248d96353f998084c3cd9b4f4f401f92aa410e52","bodyHash":"6052753be10e596d8059b4fe678041d070ff4b414e037279363871d19cf1ed2a"}
 *
 * Go source:
 * UniqueESSymbolType struct {
 * 	TypeBase
 * 	name string
 * }
 */
export interface UniqueESSymbolType {
  readonly __tsgoEmbedded0?: TypeBase;
  name: string;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::type::ConstrainedType","kind":"type","status":"implemented","sigHash":"ce82fbf1012be5db9a85e0bd58b4baed6d4d045779ecb0142369632905a9818a","bodyHash":"0e56d3d2cbee140c3de25d0b6769cd814bad19795908a916adcbd0b1893eab3e"}
 *
 * Go source:
 * ConstrainedType struct {
 * 	TypeBase
 * 	resolvedBaseConstraint *Type
 * }
 */
export interface ConstrainedType {
  readonly __tsgoEmbedded0?: TypeBase;
  resolvedBaseConstraint: GoPtr<Type>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::method::ConstrainedType.AsConstrainedType","kind":"method","status":"implemented","sigHash":"c880ecaae9699882dcd6669d38654a50ababcea5d3be40f99b1952ccdaa8c371","bodyHash":"e3ca4f6c30a46b34184d3d00cca7e905d02066873d6a70e0cf613aa21d4083e2"}
 *
 * Go source:
 * func (t *ConstrainedType) AsConstrainedType() *ConstrainedType { return t }
 */
export function ConstrainedType_AsConstrainedType(receiver: GoPtr<ConstrainedType>): GoPtr<ConstrainedType> {
  return receiver;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::type::StructuredType","kind":"type","status":"implemented","sigHash":"41db2d621cac9009453b89086219ba06dc816be099afff985eb148fe23e70a7c","bodyHash":"291dea22693e23a0dc4319edb02d8ffb9856fd084b9029dbd97c8d64d4dd2ff3"}
 *
 * Go source:
 * StructuredType struct {
 * 	ConstrainedType
 * 	members            ast.SymbolTable
 * 	properties         []*ast.Symbol
 * 	signatures         []*Signature // Signatures (call + construct)
 * 	callSignatureCount int          // Count of call signatures
 * 	indexInfos         []*IndexInfo
 * 
 * 	objectTypeWithoutAbstractConstructSignatures *Type
 * }
 */
export interface StructuredType {
  readonly __tsgoEmbedded0?: ConstrainedType;
  members: SymbolTable;
  properties: GoSlice<GoPtr<Symbol_62f2f8bf>>;
  signatures: GoSlice<GoPtr<Signature>>;
  callSignatureCount: int;
  indexInfos: GoSlice<GoPtr<IndexInfo>>;
  objectTypeWithoutAbstractConstructSignatures: GoPtr<Type>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::method::StructuredType.AsStructuredType","kind":"method","status":"implemented","sigHash":"e97ed18efc8fdb481da5d6cd26383cdeeaee9d8cc3a2bb7c84cd1339559c478f","bodyHash":"ea1ae0005777e116ac073ab783e1281dd0ad6db488f4084809bfa69fd3965a7f"}
 *
 * Go source:
 * func (t *StructuredType) AsStructuredType() *StructuredType { return t }
 */
export function StructuredType_AsStructuredType(receiver: GoPtr<StructuredType>): GoPtr<StructuredType> {
  return receiver;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::method::StructuredType.CallSignatures","kind":"method","status":"implemented","sigHash":"9ee91e522a9cdc1dd4e12e51caf3dcaa20617b8ad869dc68d329a645e504e510","bodyHash":"dec07d038e31011d835941b91acce08e00bd16ccd6651b9f9905586cca4e02a5"}
 *
 * Go source:
 * func (t *StructuredType) CallSignatures() []*Signature {
 * 	return slices.Clip(t.signatures[:t.callSignatureCount])
 * }
 */
export function StructuredType_CallSignatures(receiver: GoPtr<StructuredType>): GoSlice<GoPtr<Signature>> {
  return (receiver!.signatures ?? []).slice(0, receiver!.callSignatureCount ?? 0);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::method::StructuredType.ConstructSignatures","kind":"method","status":"implemented","sigHash":"e3bd4814ac0551e38894fd3534b20e4cef3786360c4409d1ec414df65a702a1d","bodyHash":"d5864224e7e209055b61047cb5d4b142d081b967d73d755760c440403e769a0a"}
 *
 * Go source:
 * func (t *StructuredType) ConstructSignatures() []*Signature {
 * 	return slices.Clip(t.signatures[t.callSignatureCount:])
 * }
 */
export function StructuredType_ConstructSignatures(receiver: GoPtr<StructuredType>): GoSlice<GoPtr<Signature>> {
  return (receiver!.signatures ?? []).slice(receiver!.callSignatureCount ?? 0);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::method::StructuredType.Properties","kind":"method","status":"implemented","sigHash":"9f309724b998ab56beaec07f3ba1bcb7de3db8821e3f18616524be80398db100","bodyHash":"8f49322a439369dbdf71f192e07995bd1f5cc6f399f01e4ef25794db4422f3c1"}
 *
 * Go source:
 * func (t *StructuredType) Properties() []*ast.Symbol {
 * 	return t.properties
 * }
 */
export function StructuredType_Properties(receiver: GoPtr<StructuredType>): GoSlice<GoPtr<Symbol_62f2f8bf>> {
  return receiver!.properties;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::type::ObjectType","kind":"type","status":"implemented","sigHash":"11abaec9fce3692a4d66a221189409e1def09c52c3ef7e13ee1fe1376e073dac","bodyHash":"e560f8338ef61361ce03e4210582ff763a75d71ca99cd2dfa164ed96cbec9a2a"}
 *
 * Go source:
 * ObjectType struct {
 * 	StructuredType
 * 	target         *Type                  // Target of instantiated type
 * 	mapper         *TypeMapper            // Type mapper for instantiated type
 * 	instantiations map[CacheHashKey]*Type // Map of type instantiations
 * }
 */
export interface ObjectType {
  readonly __tsgoEmbedded0?: StructuredType;
  target: GoPtr<Type>;
  mapper: GoPtr<TypeMapper>;
  instantiations: GoMap<CacheHashKey, GoPtr<Type>>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::method::ObjectType.AsObjectType","kind":"method","status":"implemented","sigHash":"ce03b37145521609901c50507789fe7b1d7580fc7835781cb57108a8363f5f5f","bodyHash":"7b91e13ccddb2994120deb09b2de1a24e293f94f323030900c90e846c08b7502"}
 *
 * Go source:
 * func (t *ObjectType) AsObjectType() *ObjectType { return t }
 */
export function ObjectType_AsObjectType(receiver: GoPtr<ObjectType>): GoPtr<ObjectType> {
  return receiver;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::type::TypeReference","kind":"type","status":"implemented","sigHash":"ca9caf6089f505886e94e7ddbe6e0a1409410747fcd5ac2501f5759901de4639","bodyHash":"d5ad0dde2430c89d919b5289823b2cdfbfc2eaf79209f57bd478bb8c1a641f06"}
 *
 * Go source:
 * TypeReference struct {
 * 	ObjectType
 * 	node                  *ast.Node // TypeReferenceNode | ArrayTypeNode | TupleTypeNode when deferred, else nil
 * 	resolvedTypeArguments []*Type
 * }
 */
export interface TypeReference {
  readonly __tsgoEmbedded0?: ObjectType;
  node: GoPtr<Node>;
  resolvedTypeArguments: GoSlice<GoPtr<Type>>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::method::TypeReference.AsTypeReference","kind":"method","status":"implemented","sigHash":"c353fde55c4299c3d55529f4a20f9c83d527b2672d9eff43cf444f55e3b0a326","bodyHash":"6ccb9abbbaa9d3cf1b7947256c58129b8ea14014014a31fe4bf9831d4ac685aa"}
 *
 * Go source:
 * func (t *TypeReference) AsTypeReference() *TypeReference { return t }
 */
export function TypeReference_AsTypeReference(receiver: GoPtr<TypeReference>): GoPtr<TypeReference> {
  return receiver;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::type::InterfaceType","kind":"type","status":"implemented","sigHash":"c5ea41529ab8a4f55adb1e521d551bdeffc9a653b62f9a6cbba6957c5c694ec3","bodyHash":"14e4691a1e6bc44f0ebe95b01e75e4632eab1cc3754bcd9597264ee9ab9c5381"}
 *
 * Go source:
 * InterfaceType struct {
 * 	TypeReference
 * 	allTypeParameters           []*Type // Type parameters (outer + local + thisType)
 * 	outerTypeParameterCount     int     // Count of outer type parameters
 * 	thisType                    *Type   // The "this" type (nil if none)
 * 	baseTypesResolved           bool
 * 	declaredMembersResolved     bool
 * 	resolvedBaseConstructorType *Type
 * 	resolvedBaseTypes           []*Type
 * 	declaredMembers             ast.SymbolTable // Declared members
 * 	declaredCallSignatures      []*Signature    // Declared call signatures
 * 	declaredConstructSignatures []*Signature    // Declared construct signatures
 * 	declaredIndexInfos          []*IndexInfo    // Declared index signatures
 * }
 */
export interface InterfaceType {
  readonly __tsgoEmbedded0?: TypeReference;
  allTypeParameters: GoSlice<GoPtr<Type>>;
  outerTypeParameterCount: int;
  thisType: GoPtr<Type>;
  baseTypesResolved: bool;
  declaredMembersResolved: bool;
  resolvedBaseConstructorType: GoPtr<Type>;
  resolvedBaseTypes: GoSlice<GoPtr<Type>>;
  declaredMembers: SymbolTable;
  declaredCallSignatures: GoSlice<GoPtr<Signature>>;
  declaredConstructSignatures: GoSlice<GoPtr<Signature>>;
  declaredIndexInfos: GoSlice<GoPtr<IndexInfo>>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::method::InterfaceType.AsInterfaceType","kind":"method","status":"implemented","sigHash":"57cf879b8eeb9b318674bae6a5d86135b14cd272b619557100294ae987619811","bodyHash":"64a005fa36aae4a5d0bbbc8f9ab0d9ddfc6fe7fe94c2d8c479c7059b53e03c5e"}
 *
 * Go source:
 * func (t *InterfaceType) AsInterfaceType() *InterfaceType { return t }
 */
export function InterfaceType_AsInterfaceType(receiver: GoPtr<InterfaceType>): GoPtr<InterfaceType> {
  return receiver;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::method::InterfaceType.OuterTypeParameters","kind":"method","status":"implemented","sigHash":"cbb4a1786e726d57c2e34410a1e95e8bb63945125d7162e8d7eaa9208d9240ed","bodyHash":"8e0c743677bce738493f73cb5df94a87313c09c01c33289cb0b65881f8ab0321"}
 *
 * Go source:
 * func (t *InterfaceType) OuterTypeParameters() []*Type {
 * 	if len(t.allTypeParameters) == 0 {
 * 		return nil
 * 	}
 * 	return slices.Clip(t.allTypeParameters[:t.outerTypeParameterCount])
 * }
 */
export function InterfaceType_OuterTypeParameters(receiver: GoPtr<InterfaceType>): GoSlice<GoPtr<Type>> {
  if (receiver!.allTypeParameters.length === 0) {
    return [] as GoSlice<GoPtr<Type>>;
  }
  return receiver!.allTypeParameters.slice(0, receiver!.outerTypeParameterCount);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::method::InterfaceType.LocalTypeParameters","kind":"method","status":"implemented","sigHash":"156f045ad185e87091082c4afeb8e81f83124b39a49a8b9eadb9650cd0448ac0","bodyHash":"9d5e176cbaa9a1239ecc78f99811165f5d0cc53db01e5c4d97059807ed9bc869"}
 *
 * Go source:
 * func (t *InterfaceType) LocalTypeParameters() []*Type {
 * 	if len(t.allTypeParameters) == 0 {
 * 		return nil
 * 	}
 * 	return slices.Clip(t.allTypeParameters[t.outerTypeParameterCount : len(t.allTypeParameters)-1])
 * }
 */
export function InterfaceType_LocalTypeParameters(receiver: GoPtr<InterfaceType>): GoSlice<GoPtr<Type>> {
  if (receiver!.allTypeParameters.length === 0) {
    return [] as GoSlice<GoPtr<Type>>;
  }
  return receiver!.allTypeParameters.slice(receiver!.outerTypeParameterCount, receiver!.allTypeParameters.length - 1);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::method::InterfaceType.TypeParameters","kind":"method","status":"implemented","sigHash":"59aab3955045e9e6f84eb4162f605651d04496626dad902d536164878f5fe7a8","bodyHash":"474067d7b54d306cbf09cd3b4953a7dfc6d430806e373ac7ea2d1e00d9b0f432"}
 *
 * Go source:
 * func (t *InterfaceType) TypeParameters() []*Type {
 * 	if len(t.allTypeParameters) == 0 {
 * 		return nil
 * 	}
 * 	return slices.Clip(t.allTypeParameters[:len(t.allTypeParameters)-1])
 * }
 */
export function InterfaceType_TypeParameters(receiver: GoPtr<InterfaceType>): GoSlice<GoPtr<Type>> {
  if (receiver!.allTypeParameters.length === 0) {
    return [] as GoSlice<GoPtr<Type>>;
  }
  return receiver!.allTypeParameters.slice(0, receiver!.allTypeParameters.length - 1);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::type::ElementFlags","kind":"type","status":"implemented","sigHash":"8173b36778cf9799a951d9a35b3d6f48342b3aff1cf8d89e00251b4f30fc47c9","bodyHash":"ac082d2e1b5aec09d512610abc268b2aa3a44e61696fc5e985e0664d01e04ec2"}
 *
 * Go source:
 * ElementFlags uint32
 */
export type ElementFlags = uint;

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::constGroup::ElementFlagsNone+ElementFlagsRequired+ElementFlagsOptional+ElementFlagsRest+ElementFlagsVariadic+ElementFlagsFixed+ElementFlagsVariable+ElementFlagsNonRequired+ElementFlagsNonRest","kind":"constGroup","status":"implemented","sigHash":"0f5ddf04737bcaef8d95b4882ef0388a9b79e768877cd1639c1652d35f870793","bodyHash":"30c2a79fea33d8117d1001e15f6ecff5dc1eeb8e096f8318828d53830f01c6b6"}
 *
 * Go source:
 * const (
 * 	ElementFlagsNone        ElementFlags = 0
 * 	ElementFlagsRequired    ElementFlags = 1 << 0 // T
 * 	ElementFlagsOptional    ElementFlags = 1 << 1 // T?
 * 	ElementFlagsRest        ElementFlags = 1 << 2 // ...T[]
 * 	ElementFlagsVariadic    ElementFlags = 1 << 3 // ...T
 * 	ElementFlagsFixed                    = ElementFlagsRequired | ElementFlagsOptional
 * 	ElementFlagsVariable                 = ElementFlagsRest | ElementFlagsVariadic
 * 	ElementFlagsNonRequired              = ElementFlagsOptional | ElementFlagsRest | ElementFlagsVariadic
 * 	ElementFlagsNonRest                  = ElementFlagsRequired | ElementFlagsOptional | ElementFlagsVariadic
 * )
 */
export const ElementFlagsNone: ElementFlags = 0;
export const ElementFlagsRequired: ElementFlags = 1 << 0;
export const ElementFlagsOptional: ElementFlags = 1 << 1;
export const ElementFlagsRest: ElementFlags = 1 << 2;
export const ElementFlagsVariadic: ElementFlags = 1 << 3;
export const ElementFlagsFixed: int = (ElementFlagsRequired | ElementFlagsOptional) >>> 0;
export const ElementFlagsVariable: int = (ElementFlagsRest | ElementFlagsVariadic) >>> 0;
export const ElementFlagsNonRequired: int = (ElementFlagsOptional | ElementFlagsRest | ElementFlagsVariadic) >>> 0;
export const ElementFlagsNonRest: int = (ElementFlagsRequired | ElementFlagsOptional | ElementFlagsVariadic) >>> 0;

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::type::TupleElementInfo","kind":"type","status":"implemented","sigHash":"b0e3725aee7eb05c6512f213d449b4219ef8d185d3f0c7de27323318e7acecc1","bodyHash":"1571113b5527514f78d28f8ff301066429517ca40498bb57d38ce3002c001052"}
 *
 * Go source:
 * TupleElementInfo struct {
 * 	flags              ElementFlags
 * 	labeledDeclaration *ast.Node // NamedTupleMember | ParameterDeclaration | nil
 * }
 */
export interface TupleElementInfo {
  flags: ElementFlags;
  labeledDeclaration: GoPtr<Node>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::method::TupleElementInfo.TupleElementFlags","kind":"method","status":"implemented","sigHash":"355ad4488ed1b95c13b99386b6cacf18b08a428879611b1be24b7db39bb3ffab","bodyHash":"0fc88f762f268081bd8fcaaaf2541509d49428a912f1442fd7a1c0efb9a010fb"}
 *
 * Go source:
 * func (t *TupleElementInfo) TupleElementFlags() ElementFlags { return t.flags }
 */
export function TupleElementInfo_TupleElementFlags(receiver: GoPtr<TupleElementInfo>): ElementFlags {
  return receiver!.flags;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::method::TupleElementInfo.LabeledDeclaration","kind":"method","status":"implemented","sigHash":"8b520c8ee4de8405dad3464a7200e4b61e590053568094a5c60dfb8822a3dfad","bodyHash":"8e504f76b4638593573e9316b3efe5436510f420d8606fd4921ffc98f349728c"}
 *
 * Go source:
 * func (t *TupleElementInfo) LabeledDeclaration() *ast.Node   { return t.labeledDeclaration }
 */
export function TupleElementInfo_LabeledDeclaration(receiver: GoPtr<TupleElementInfo>): GoPtr<Node> {
  return receiver!.labeledDeclaration;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::type::TupleType","kind":"type","status":"implemented","sigHash":"576882c2dbd6dea2abcc1ccb8d2100af1e041bddff1f6df3083ac640e4a96081","bodyHash":"15096f4880f63d84cddd7d65d2dd69414a4592bf89b3015d9206dc977ff53b6d"}
 *
 * Go source:
 * TupleType struct {
 * 	InterfaceType
 * 	elementInfos  []TupleElementInfo
 * 	minLength     int // Number of required or variadic elements
 * 	fixedLength   int // Number of initial required or optional elements
 * 	combinedFlags ElementFlags
 * 	readonly      bool
 * }
 */
export interface TupleType {
  readonly __tsgoEmbedded0?: InterfaceType;
  elementInfos: GoSlice<TupleElementInfo>;
  minLength: int;
  fixedLength: int;
  combinedFlags: ElementFlags;
  readonly: bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::method::TupleType.FixedLength","kind":"method","status":"implemented","sigHash":"1c1313f89a7632f9a1b53be6130b0723f4a977adce3a7830cd00f1fa45fac869","bodyHash":"87d3a9a16dbeefd79abd3e5f484e8f07d81033fa9a83924b29074168c44dfe3f"}
 *
 * Go source:
 * func (t *TupleType) FixedLength() int { return t.fixedLength }
 */
export function TupleType_FixedLength(receiver: GoPtr<TupleType>): int {
  return receiver!.fixedLength;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::method::TupleType.IsReadonly","kind":"method","status":"implemented","sigHash":"466790d78eb0ce996d251e855729e1e7013b01b1cb76b47d9d10efe9fb173499","bodyHash":"e2eafef36c370754e051c0cbe9c3fbd00dcffbddb95b07de328f8e31157b5428"}
 *
 * Go source:
 * func (t *TupleType) IsReadonly() bool { return t.readonly }
 */
export function TupleType_IsReadonly(receiver: GoPtr<TupleType>): bool {
  return receiver!.readonly;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::method::TupleType.ElementFlags","kind":"method","status":"implemented","sigHash":"c7173d24b254b34116e09387864937ea26237272735e8cc9e4de2c723a13d7b1","bodyHash":"f18b6f19f39208cbc7cb109e09cbd091b218353f6fc93445996f71ad5efc8ece"}
 *
 * Go source:
 * func (t *TupleType) ElementFlags() []ElementFlags {
 * 	elementFlags := make([]ElementFlags, len(t.elementInfos))
 * 	for i, info := range t.elementInfos {
 * 		elementFlags[i] = info.flags
 * 	}
 * 	return elementFlags
 * }
 */
export function TupleType_ElementFlags(receiver: GoPtr<TupleType>): GoSlice<ElementFlags> {
  return receiver!.elementInfos.map((info) => info.flags);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::method::TupleType.ElementInfos","kind":"method","status":"implemented","sigHash":"5783e5665a3a66e09dea7662982b1f11c5d2200cc01a75470953d47e41765dd5","bodyHash":"db835ee4620bd64ca1be63e1c9be5ce26f83d507bd379556178edade26cd7a9a"}
 *
 * Go source:
 * func (t *TupleType) ElementInfos() []TupleElementInfo { return t.elementInfos }
 */
export function TupleType_ElementInfos(receiver: GoPtr<TupleType>): GoSlice<TupleElementInfo> {
  return receiver!.elementInfos;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::type::InstantiationExpressionType","kind":"type","status":"implemented","sigHash":"b18c75669ed789f8b02ac27b2c703829ec18afd004cd79e5dc26009268cdc185","bodyHash":"957aa6779a36b14bdb5965364423ad84f054e4237ce2438a3d0c7b97c7e6fa64"}
 *
 * Go source:
 * InstantiationExpressionType struct {
 * 	ObjectType
 * 	node *ast.Node
 * }
 */
export interface InstantiationExpressionType {
  readonly __tsgoEmbedded0?: ObjectType;
  node: GoPtr<Node>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::type::MappedType","kind":"type","status":"implemented","sigHash":"070097adc44f4d165e04994aa119f05f475f5fecc5720921cacbe1863e71204e","bodyHash":"e95dd42afdb903964244c5a6d609500c63d2c8b3f4c39c73ac6a26669e0c91df"}
 *
 * Go source:
 * MappedType struct {
 * 	ObjectType
 * 	declaration          *ast.MappedTypeNode
 * 	typeParameter        *Type
 * 	constraintType       *Type
 * 	nameType             *Type
 * 	templateType         *Type
 * 	modifiersType        *Type
 * 	resolvedApparentType *Type
 * 	containsError        bool
 * }
 */
export interface MappedType {
  readonly __tsgoEmbedded0?: ObjectType;
  declaration: GoPtr<MappedTypeNodeNode>;
  typeParameter: GoPtr<Type>;
  constraintType: GoPtr<Type>;
  nameType: GoPtr<Type>;
  templateType: GoPtr<Type>;
  modifiersType: GoPtr<Type>;
  resolvedApparentType: GoPtr<Type>;
  containsError: bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::type::ReverseMappedType","kind":"type","status":"implemented","sigHash":"7dae44fba3a9d4d0a6e24563d76cceded5c05625801d0b857c716d0981335134","bodyHash":"78f05e2e21951f0783d7303f670e0fad2b5032afaedf8a2a258affa3ebdc34cd"}
 *
 * Go source:
 * ReverseMappedType struct {
 * 	ObjectType
 * 	source         *Type
 * 	mappedType     *Type
 * 	constraintType *Type
 * }
 */
export interface ReverseMappedType {
  readonly __tsgoEmbedded0?: ObjectType;
  source: GoPtr<Type>;
  mappedType: GoPtr<Type>;
  constraintType: GoPtr<Type>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::type::EvolvingArrayType","kind":"type","status":"implemented","sigHash":"2e2158b5cf9c05cb7c8cee88c12cd0df276a7c61fe7d258e13da06e5e4240f3f","bodyHash":"54826118169c995f10b3c51b9c18d6ec5e1a956ca9c157ea702364b922fe60ef"}
 *
 * Go source:
 * EvolvingArrayType struct {
 * 	ObjectType
 * 	elementType    *Type
 * 	finalArrayType *Type
 * }
 */
export interface EvolvingArrayType {
  readonly __tsgoEmbedded0?: ObjectType;
  elementType: GoPtr<Type>;
  finalArrayType: GoPtr<Type>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::type::UnionOrIntersectionType","kind":"type","status":"implemented","sigHash":"b6134fce3a624180fbb8f633c08b60268b4c23eb5b2c7fe58272cb3e0b364b58","bodyHash":"3630b6a7a9959024244f24dc47637d781efc754ed09697edadfa42d8d195fc80"}
 *
 * Go source:
 * UnionOrIntersectionType struct {
 * 	StructuredType
 * 	types                                       []*Type
 * 	propertyCache                               ast.SymbolTable
 * 	propertyCacheWithoutFunctionPropertyAugment ast.SymbolTable
 * 	resolvedProperties                          []*ast.Symbol
 * }
 */
export interface UnionOrIntersectionType {
  readonly __tsgoEmbedded0?: StructuredType;
  types: GoSlice<GoPtr<Type>>;
  propertyCache: SymbolTable;
  propertyCacheWithoutFunctionPropertyAugment: SymbolTable;
  resolvedProperties: GoSlice<GoPtr<Symbol_62f2f8bf>>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::method::UnionOrIntersectionType.AsUnionOrIntersectionType","kind":"method","status":"implemented","sigHash":"a463b976a7b49efcf96dba1ada20581738ec8afdb843ad312d335b2a18c87cfa","bodyHash":"916414d2e00721ba670593bde5c0c4358f884213766a1b62f7bbe30380a32cdd"}
 *
 * Go source:
 * func (t *UnionOrIntersectionType) AsUnionOrIntersectionType() *UnionOrIntersectionType { return t }
 */
export function UnionOrIntersectionType_AsUnionOrIntersectionType(receiver: GoPtr<UnionOrIntersectionType>): GoPtr<UnionOrIntersectionType> {
  return receiver;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::method::UnionOrIntersectionType.Types","kind":"method","status":"implemented","sigHash":"65393c27769c1456436f678a289d5055fa63c5e286e80e18209329c621008896","bodyHash":"825bb48f24e4646286187b610762eeb1b961f6b63df3844e304a8b1503df05e9"}
 *
 * Go source:
 * func (t *UnionOrIntersectionType) Types() []*Type {
 * 	return t.types
 * }
 */
export function UnionOrIntersectionType_Types(receiver: GoPtr<UnionOrIntersectionType>): GoSlice<GoPtr<Type>> {
  return receiver!.types;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::type::UnionType","kind":"type","status":"implemented","sigHash":"6034ad0b7153fbbbabc172c1f454cf32bdae4fb0adf552f7d60eda5dad8c3b81","bodyHash":"d37aa462da97726b2e5a52b0888e9500f89e60396e58e59b19ab4fa389d6abb7"}
 *
 * Go source:
 * UnionType struct {
 * 	UnionOrIntersectionType
 * 	resolvedReducedType *Type
 * 	regularType         *Type
 * 	origin              *Type           // Denormalized union, intersection, or index type in which union originates
 * 	keyPropertyName     string          // Property with unique unit type that exists in every object/intersection in union type
 * 	constituentMap      map[*Type]*Type // Constituents keyed by unit type discriminants
 * }
 */
export interface UnionType {
  readonly __tsgoEmbedded0?: UnionOrIntersectionType;
  resolvedReducedType: GoPtr<Type>;
  regularType: GoPtr<Type>;
  origin: GoPtr<Type>;
  keyPropertyName: string;
  constituentMap: GoMap<GoPtr<Type>, GoPtr<Type>>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::type::IntersectionType","kind":"type","status":"implemented","sigHash":"8050412a17ecac2a23a68f53f1703934ab314bfee575c2098999e92aff86081a","bodyHash":"ad4fbbb2dbdce2e993f7cefd0efbb25f77adf0cdfec0397a56421b6ca6362363"}
 *
 * Go source:
 * IntersectionType struct {
 * 	UnionOrIntersectionType
 * 	resolvedApparentType             *Type
 * 	uniqueLiteralFilledInstantiation *Type // Instantiation with type parameters mapped to never type
 * }
 */
export interface IntersectionType {
  readonly __tsgoEmbedded0?: UnionOrIntersectionType;
  resolvedApparentType: GoPtr<Type>;
  uniqueLiteralFilledInstantiation: GoPtr<Type>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::type::TypeParameter","kind":"type","status":"implemented","sigHash":"4b7d8bcd7065490042679bc4d328be62d66c4d42dff3ffb6d9654f4fb7a0209b","bodyHash":"6ef5ab739a7f045965f98d932e8587c7c4f820a677c556529ba28a1a8b2eb1bc"}
 *
 * Go source:
 * TypeParameter struct {
 * 	ConstrainedType
 * 	constraint          *Type
 * 	target              *Type
 * 	mapper              *TypeMapper
 * 	isThisType          bool
 * 	resolvedDefaultType *Type
 * }
 */
export interface TypeParameter {
  readonly __tsgoEmbedded0?: ConstrainedType;
  constraint: GoPtr<Type>;
  target: GoPtr<Type>;
  mapper: GoPtr<TypeMapper>;
  isThisType: bool;
  resolvedDefaultType: GoPtr<Type>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::method::TypeParameter.IsThisType","kind":"method","status":"implemented","sigHash":"00696bd2c3f26af607bd49395a5a451cb3c0a9e52abafbcce9a27d0073d8ec38","bodyHash":"7027cb00d9e8557e9a8d74c794430e88bcc8a795b994b5338a845c4d13e59aae"}
 *
 * Go source:
 * func (t *TypeParameter) IsThisType() bool { return t.isThisType }
 */
export function TypeParameter_IsThisType(receiver: GoPtr<TypeParameter>): bool {
  return receiver!.isThisType;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::type::IndexFlags","kind":"type","status":"implemented","sigHash":"20ca46e5ca1c7ed18acc57789a84a7468d3ec64ff92e4657497f7cef63ace52a","bodyHash":"b9b0cc34acee35b2c3df8e1bb230b2933ba319269c3bf7963a0f9b3b53e679e8"}
 *
 * Go source:
 * IndexFlags uint32
 */
export type IndexFlags = uint;

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::constGroup::IndexFlagsNone+IndexFlagsStringsOnly+IndexFlagsNoIndexSignatures+IndexFlagsNoReducibleCheck","kind":"constGroup","status":"implemented","sigHash":"848a3389b1917b42dc0a810f471216e938348fca2d76c2eb23a41239ec1a1b72","bodyHash":"fca0a0027b8b3d06ba8999b5833c97e10ddff90a38ba1c0a16919c06b9654c8f"}
 *
 * Go source:
 * const (
 * 	IndexFlagsNone              IndexFlags = 0
 * 	IndexFlagsStringsOnly       IndexFlags = 1 << 0
 * 	IndexFlagsNoIndexSignatures IndexFlags = 1 << 1
 * 	IndexFlagsNoReducibleCheck  IndexFlags = 1 << 2
 * )
 */
export const IndexFlagsNone: IndexFlags = 0;
export const IndexFlagsStringsOnly: IndexFlags = 1 << 0;
export const IndexFlagsNoIndexSignatures: IndexFlags = 1 << 1;
export const IndexFlagsNoReducibleCheck: IndexFlags = 1 << 2;

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::type::IndexType","kind":"type","status":"implemented","sigHash":"0de423dcbef20d158775780bd5ad01b92c653184c977adccc739e402cf1aca77","bodyHash":"4824d34ed908b74d4a1ce2df88d4170e00c0463a161420b4d1f8268e992ee2dc"}
 *
 * Go source:
 * IndexType struct {
 * 	ConstrainedType
 * 	target     *Type
 * 	indexFlags IndexFlags
 * }
 */
export interface IndexType {
  readonly __tsgoEmbedded0?: ConstrainedType;
  target: GoPtr<Type>;
  indexFlags: IndexFlags;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::method::IndexType.Target","kind":"method","status":"implemented","sigHash":"a75ca0dadaddd6a747f48644d50224ea9ab02b125743d9a03e3b9271ed892988","bodyHash":"408e70a61b99d8f4c4bbeb7bddeec9325edf21a33ce582b7849a740d91b1a5c0"}
 *
 * Go source:
 * func (t *IndexType) Target() *Type { return t.target }
 */
export function IndexType_Target(receiver: GoPtr<IndexType>): GoPtr<Type> {
  return receiver!.target;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::type::IndexedAccessType","kind":"type","status":"implemented","sigHash":"20f66ba167735dddb85b1796950cfbcb3ff1fb0114c33c7940edb005d0e2bbdb","bodyHash":"39fce82cce215bc332cbe5e44bd41f82d9cba41b0bf24ee36ab7eb109e26aa9d"}
 *
 * Go source:
 * IndexedAccessType struct {
 * 	ConstrainedType
 * 	objectType  *Type
 * 	indexType   *Type
 * 	accessFlags AccessFlags // Only includes AccessFlags.Persistent
 * }
 */
export interface IndexedAccessType {
  readonly __tsgoEmbedded0?: ConstrainedType;
  objectType: GoPtr<Type>;
  indexType: GoPtr<Type>;
  accessFlags: AccessFlags;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::method::IndexedAccessType.ObjectType","kind":"method","status":"implemented","sigHash":"1bdaed5612d3752bd50286d11ce692fb5a41aa51f1d58c5d1aaeeddb46c41676","bodyHash":"20a1e92acc2798d61a1bc55ece2e07a1f1a568d744b1db8a74eb41ffc6f8e634"}
 *
 * Go source:
 * func (t *IndexedAccessType) ObjectType() *Type { return t.objectType }
 */
export function IndexedAccessType_ObjectType(receiver: GoPtr<IndexedAccessType>): GoPtr<Type> {
  return receiver!.objectType;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::method::IndexedAccessType.IndexType","kind":"method","status":"implemented","sigHash":"85b57c26fdc41372fd2fdf634275cf0a8ffbfd3ae583c22bc1f7b908e1ddd1d9","bodyHash":"ead29838b5a98e267312a1c948b231972b684ce11a021d3b80faa790013a3c6d"}
 *
 * Go source:
 * func (t *IndexedAccessType) IndexType() *Type  { return t.indexType }
 */
export function IndexedAccessType_IndexType(receiver: GoPtr<IndexedAccessType>): GoPtr<Type> {
  return receiver!.indexType;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::type::TemplateLiteralType","kind":"type","status":"implemented","sigHash":"e8aa3d5cb34be471e462b60d8c1e18269887850610c22da8fcc0c95b750aa3c8","bodyHash":"24277d2aba9de116b4e8a3acd6e469db7a6749d27d25f2efc87dbdc0f80b1f33"}
 *
 * Go source:
 * TemplateLiteralType struct {
 * 	ConstrainedType
 * 	texts []string // Always one element longer than types
 * 	types []*Type  // Always at least one element
 * }
 */
export interface TemplateLiteralType {
  readonly __tsgoEmbedded0?: ConstrainedType;
  texts: GoSlice<string>;
  types: GoSlice<GoPtr<Type>>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::method::TemplateLiteralType.Texts","kind":"method","status":"implemented","sigHash":"3c3d535d1b0b673e77c07b2bf18d3cccb15605f0d6b4082a9867316270025f6d","bodyHash":"ec45fa890960c4d86be310aebe34ea48b060915fdbcb3e433bfd288cf7a02894"}
 *
 * Go source:
 * func (t *TemplateLiteralType) Texts() []string { return t.texts }
 */
export function TemplateLiteralType_Texts(receiver: GoPtr<TemplateLiteralType>): GoSlice<string> {
  return receiver!.texts;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::method::TemplateLiteralType.Types","kind":"method","status":"implemented","sigHash":"1ef235d267d5be4c214e3d0d2d2c70ea94eabb57ab844b3e68e50c31e93db792","bodyHash":"3b3d6e85b5098969c486c9e9bbf327879648537c9ae7b6ae24f4836b1c49b49b"}
 *
 * Go source:
 * func (t *TemplateLiteralType) Types() []*Type  { return t.types }
 */
export function TemplateLiteralType_Types(receiver: GoPtr<TemplateLiteralType>): GoSlice<GoPtr<Type>> {
  return receiver!.types;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::type::StringMappingType","kind":"type","status":"implemented","sigHash":"e591a7779cfff66883bd8e16f77f85aabf70296c17827a68b53b9fa8716d23b8","bodyHash":"9816d4ee3843e5d51ad13889fe800ed985eec792956d32dbc698fd4baae2fa77"}
 *
 * Go source:
 * StringMappingType struct {
 * 	ConstrainedType
 * 	target *Type
 * }
 */
export interface StringMappingType {
  readonly __tsgoEmbedded0?: ConstrainedType;
  target: GoPtr<Type>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::method::StringMappingType.Target","kind":"method","status":"implemented","sigHash":"1e4e315b6a72393451dc16c165e08d6fc6488c292fb520d9b54a3e1c37450ecf","bodyHash":"aa3ac37bc406e222851cffa8637df0df2bf8f87e1edb665e3073055b2e97b1ed"}
 *
 * Go source:
 * func (t *StringMappingType) Target() *Type { return t.target }
 */
export function StringMappingType_Target(receiver: GoPtr<StringMappingType>): GoPtr<Type> {
  return receiver!.target;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::type::SubstitutionType","kind":"type","status":"implemented","sigHash":"f42d362720ee24221c0b5e32ca805b3de189f024856d9304d953d9604faac3ba","bodyHash":"e58280f9c880ca999226f4d6af319759b8df2973b7c75c4d8e41a2357b4dc16c"}
 *
 * Go source:
 * SubstitutionType struct {
 * 	ConstrainedType
 * 	baseType   *Type // Target type
 * 	constraint *Type // Constraint that target type is known to satisfy
 * }
 */
export interface SubstitutionType {
  readonly __tsgoEmbedded0?: ConstrainedType;
  baseType: GoPtr<Type>;
  constraint: GoPtr<Type>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::method::SubstitutionType.BaseType","kind":"method","status":"implemented","sigHash":"d2ca47575a89587599e65fdeacc4f18d761fc009f209e197518717c467d50404","bodyHash":"896002876e9a1db796261a4ad46754216153e998f37fb2c5f8ad430d97ad0f55"}
 *
 * Go source:
 * func (t *SubstitutionType) BaseType() *Type        { return t.baseType }
 */
export function SubstitutionType_BaseType(receiver: GoPtr<SubstitutionType>): GoPtr<Type> {
  return receiver!.baseType;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::method::SubstitutionType.SubstConstraint","kind":"method","status":"implemented","sigHash":"ad3d534806d0d386fafb415e4ef6e41568afd74640b94ac927e304c45a66b5f6","bodyHash":"21df533375e8a7391758047cb8cf0650805b43cb8b8f022d6094c42ecc2f70ce"}
 *
 * Go source:
 * func (t *SubstitutionType) SubstConstraint() *Type { return t.constraint }
 */
export function SubstitutionType_SubstConstraint(receiver: GoPtr<SubstitutionType>): GoPtr<Type> {
  return receiver!.constraint;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::type::ConditionalRoot","kind":"type","status":"implemented","sigHash":"424b2c5b1128de1df0b948b7b7e4032257ff529e6a15490fed60ad1c4926a448","bodyHash":"10a7b0b739fe0b0606eed4560065892eef29df703c569817e6577f0baaec7de3"}
 *
 * Go source:
 * ConditionalRoot struct {
 * 	node                *ast.ConditionalTypeNode
 * 	checkType           *Type
 * 	extendsType         *Type
 * 	isDistributive      bool
 * 	inferTypeParameters []*Type
 * 	outerTypeParameters []*Type
 * 	instantiations      map[CacheHashKey]*Type
 * 	alias               *TypeAlias
 * }
 */
export interface ConditionalRoot {
  node: GoPtr<ConditionalTypeNodeNode>;
  checkType: GoPtr<Type>;
  extendsType: GoPtr<Type>;
  isDistributive: bool;
  inferTypeParameters: GoSlice<GoPtr<Type>>;
  outerTypeParameters: GoSlice<GoPtr<Type>>;
  instantiations: GoMap<CacheHashKey, GoPtr<Type>>;
  alias: GoPtr<TypeAlias>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::type::ConditionalType","kind":"type","status":"implemented","sigHash":"446fe53b743912847511aa8f4bb582aff2279e3068b5ce0350facaf993244552","bodyHash":"8b454bf7d4ee96ab1fecb6a844f5fc10cf9dffbbf1f447c504fbd7eed1fa27fa"}
 *
 * Go source:
 * ConditionalType struct {
 * 	ConstrainedType
 * 	root                             *ConditionalRoot
 * 	checkType                        *Type
 * 	extendsType                      *Type
 * 	resolvedTrueType                 *Type
 * 	resolvedFalseType                *Type
 * 	resolvedInferredTrueType         *Type // The `trueType` instantiated with the `combinedMapper`, if present
 * 	resolvedDefaultConstraint        *Type
 * 	resolvedConstraintOfDistributive *Type
 * 	mapper                           *TypeMapper
 * 	combinedMapper                   *TypeMapper
 * }
 */
export interface ConditionalType {
  readonly __tsgoEmbedded0?: ConstrainedType;
  root: GoPtr<ConditionalRoot>;
  checkType: GoPtr<Type>;
  extendsType: GoPtr<Type>;
  resolvedTrueType: GoPtr<Type>;
  resolvedFalseType: GoPtr<Type>;
  resolvedInferredTrueType: GoPtr<Type>;
  resolvedDefaultConstraint: GoPtr<Type>;
  resolvedConstraintOfDistributive: GoPtr<Type>;
  mapper: GoPtr<TypeMapper>;
  combinedMapper: GoPtr<TypeMapper>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::method::ConditionalType.CheckType","kind":"method","status":"implemented","sigHash":"f0748bda237c5a2383234d632d7108747c2ee67eae4b79c0349c76dd1d3adbca","bodyHash":"404e5dd922ea1ed1e82aa8eec1a5ed0384feaf6be200f63919b3193e49c443bb"}
 *
 * Go source:
 * func (t *ConditionalType) CheckType() *Type   { return t.checkType }
 */
export function ConditionalType_CheckType(receiver: GoPtr<ConditionalType>): GoPtr<Type> {
  return receiver!.checkType;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::method::ConditionalType.ExtendsType","kind":"method","status":"implemented","sigHash":"65bf8712cd27803e1e6072aed95b2442f81659ff4d369adbb90024be3353a3f0","bodyHash":"c6d78539cec634374669f96301f6cb90f70206e0afca6b2c238a05db40447c34"}
 *
 * Go source:
 * func (t *ConditionalType) ExtendsType() *Type { return t.extendsType }
 */
export function ConditionalType_ExtendsType(receiver: GoPtr<ConditionalType>): GoPtr<Type> {
  return receiver!.extendsType;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::type::SignatureFlags","kind":"type","status":"implemented","sigHash":"ab262bf311c08da6802b32ec1be7cf8dc5eb0c54624900cf70ef7749177f0f40","bodyHash":"df0cc8e817bb23d3d045ce768dfeb18f94209c5ef8e378bab641683555d96402"}
 *
 * Go source:
 * SignatureFlags uint32
 */
export type SignatureFlags = uint;

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::constGroup::SignatureFlagsNone+SignatureFlagsHasRestParameter+SignatureFlagsHasLiteralTypes+SignatureFlagsConstruct+SignatureFlagsAbstract+SignatureFlagsIsInnerCallChain+SignatureFlagsIsOuterCallChain+SignatureFlagsIsUntypedSignatureInJSFile+SignatureFlagsIsNonInferrable+SignatureFlagsIsSignatureCandidateForOverloadFailure+SignatureFlagsPropagatingFlags+SignatureFlagsCallChainFlags","kind":"constGroup","status":"implemented","sigHash":"114ed2f5c585c6b4e007dccfe55b1b491d244771e1047ff20f20948b5c5c8cf4","bodyHash":"2d0a9c1f8bcf55ac9e8162181f6c6a90fa642caf8bd5b7bea22e4d407d6adc6a"}
 *
 * Go source:
 * const (
 * 	SignatureFlagsNone SignatureFlags = 0
 * 	// Propagating flags
 * 	SignatureFlagsHasRestParameter SignatureFlags = 1 << 0 // Indicates last parameter is rest parameter
 * 	SignatureFlagsHasLiteralTypes  SignatureFlags = 1 << 1 // Indicates signature is specialized
 * 	SignatureFlagsConstruct        SignatureFlags = 1 << 2 // Indicates signature is a construct signature
 * 	SignatureFlagsAbstract         SignatureFlags = 1 << 3 // Indicates signature comes from an abstract class, abstract construct signature, or abstract constructor type
 * 	// Non-propagating flags
 * 	SignatureFlagsIsInnerCallChain                       SignatureFlags = 1 << 4 // Indicates signature comes from a CallChain nested in an outer OptionalChain
 * 	SignatureFlagsIsOuterCallChain                       SignatureFlags = 1 << 5 // Indicates signature comes from a CallChain that is the outermost chain of an optional expression
 * 	SignatureFlagsIsUntypedSignatureInJSFile             SignatureFlags = 1 << 6 // Indicates signature is from a js file and has no types
 * 	SignatureFlagsIsNonInferrable                        SignatureFlags = 1 << 7 // Indicates signature comes from a non-inferrable type
 * 	SignatureFlagsIsSignatureCandidateForOverloadFailure SignatureFlags = 1 << 8
 * 	// We do not propagate `IsInnerCallChain` or `IsOuterCallChain` to instantiated signatures, as that would result in us
 * 	// attempting to add `| undefined` on each recursive call to `getReturnTypeOfSignature` when
 * 	// instantiating the return type.
 * 	SignatureFlagsPropagatingFlags = SignatureFlagsHasRestParameter | SignatureFlagsHasLiteralTypes | SignatureFlagsConstruct | SignatureFlagsAbstract | SignatureFlagsIsUntypedSignatureInJSFile | SignatureFlagsIsSignatureCandidateForOverloadFailure
 * 	SignatureFlagsCallChainFlags   = SignatureFlagsIsInnerCallChain | SignatureFlagsIsOuterCallChain
 * )
 */
export const SignatureFlagsNone: SignatureFlags = 0;
export const SignatureFlagsHasRestParameter: SignatureFlags = 1 << 0;
export const SignatureFlagsHasLiteralTypes: SignatureFlags = 1 << 1;
export const SignatureFlagsConstruct: SignatureFlags = 1 << 2;
export const SignatureFlagsAbstract: SignatureFlags = 1 << 3;
export const SignatureFlagsIsInnerCallChain: SignatureFlags = 1 << 4;
export const SignatureFlagsIsOuterCallChain: SignatureFlags = 1 << 5;
export const SignatureFlagsIsUntypedSignatureInJSFile: SignatureFlags = 1 << 6;
export const SignatureFlagsIsNonInferrable: SignatureFlags = 1 << 7;
export const SignatureFlagsIsSignatureCandidateForOverloadFailure: SignatureFlags = 1 << 8;
export const SignatureFlagsPropagatingFlags: int =
  (SignatureFlagsHasRestParameter |
    SignatureFlagsHasLiteralTypes |
    SignatureFlagsConstruct |
    SignatureFlagsAbstract |
    SignatureFlagsIsUntypedSignatureInJSFile |
    SignatureFlagsIsSignatureCandidateForOverloadFailure) >>>
  0;
export const SignatureFlagsCallChainFlags: int =
  (SignatureFlagsIsInnerCallChain | SignatureFlagsIsOuterCallChain) >>> 0;

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::type::Signature","kind":"type","status":"implemented","sigHash":"d3a5a81eee7b1c3e3b367d3032eca4dea84378962d4e3644796db04c13f6e1c7","bodyHash":"2aa635e4411e9fe6132f76a0e64405f097e606ec5723eb3a6914d5e1f8a7c779"}
 *
 * Go source:
 * Signature struct {
 * 	flags                    SignatureFlags
 * 	minArgumentCount         int32
 * 	resolvedMinArgumentCount int32
 * 	declaration              *ast.Node
 * 	typeParameters           []*Type
 * 	parameters               []*ast.Symbol
 * 	thisParameter            *ast.Symbol
 * 	resolvedReturnType       *Type
 * 	resolvedTypePredicate    *TypePredicate
 * 	target                   *Signature
 * 	mapper                   *TypeMapper
 * 	isolatedSignatureType    *Type
 * 	composite                *CompositeSignature
 * }
 */
export interface Signature {
  flags: SignatureFlags;
  minArgumentCount: int;
  resolvedMinArgumentCount: int;
  declaration: GoPtr<Node>;
  typeParameters: GoSlice<GoPtr<Type>>;
  parameters: GoSlice<GoPtr<Symbol_62f2f8bf>>;
  thisParameter: GoPtr<Symbol_62f2f8bf>;
  resolvedReturnType: GoPtr<Type>;
  resolvedTypePredicate: GoPtr<TypePredicate>;
  target: GoPtr<Signature>;
  mapper: GoPtr<TypeMapper>;
  isolatedSignatureType: GoPtr<Type>;
  composite: GoPtr<CompositeSignature>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::method::Signature.Flags","kind":"method","status":"implemented","sigHash":"6f3ff5daa3a542647d0c2ded0db89c216b6a2d48bc2d631e498fdd1b70e2d4fd","bodyHash":"e845b833c8dc4abfed5abb5dc27c976f8bbd1d9bfa2220be11a85df075509904"}
 *
 * Go source:
 * func (s *Signature) Flags() SignatureFlags {
 * 	return s.flags
 * }
 */
export function Signature_Flags(receiver: GoPtr<Signature>): SignatureFlags {
  return receiver!.flags;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::method::Signature.TypeParameters","kind":"method","status":"implemented","sigHash":"cb28b2a07ded8b054d77d8909b0d924049bf8a9e405030d9a095d389d8d5ff0a","bodyHash":"92d8243140df2a5c9f8fe34dccd787e666d1dbfb5887a3aa28878dcd634e8db1"}
 *
 * Go source:
 * func (s *Signature) TypeParameters() []*Type {
 * 	return s.typeParameters
 * }
 */
export function Signature_TypeParameters(receiver: GoPtr<Signature>): GoSlice<GoPtr<Type>> {
  return receiver!.typeParameters;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::method::Signature.Declaration","kind":"method","status":"implemented","sigHash":"c5146de59f2e792a4981b08eb7e65e3851dfdf24f9cd25cb7264c7635e223195","bodyHash":"6a6e66cf8abd4c58592f7064dc3f541e0ce57f0ea9e76aa4614354cc63f25c37"}
 *
 * Go source:
 * func (s *Signature) Declaration() *ast.Node {
 * 	return s.declaration
 * }
 */
export function Signature_Declaration(receiver: GoPtr<Signature>): GoPtr<Node> {
  return receiver!.declaration;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::method::Signature.Target","kind":"method","status":"implemented","sigHash":"b370dc5ac0441bf818a7160561b39ac2ba42d797ec2b6355ad475824111fabe6","bodyHash":"b6e83e25e611ff8643eb5e6017dbdece6e5a3246596750314d2f9b13af806ca1"}
 *
 * Go source:
 * func (s *Signature) Target() *Signature {
 * 	return s.target
 * }
 */
export function Signature_Target(receiver: GoPtr<Signature>): GoPtr<Signature> {
  return receiver!.target;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::method::Signature.ThisParameter","kind":"method","status":"implemented","sigHash":"afad830f98f1efc13163ec150d3594e4af384dfb2efbdb42257404ce8955733e","bodyHash":"55228e4d838da02bd943bf4646774339f6cd0644e5cdd8db4a79c1e7e25215c9"}
 *
 * Go source:
 * func (s *Signature) ThisParameter() *ast.Symbol {
 * 	return s.thisParameter
 * }
 */
export function Signature_ThisParameter(receiver: GoPtr<Signature>): GoPtr<Symbol_62f2f8bf> {
  return receiver!.thisParameter;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::method::Signature.Parameters","kind":"method","status":"implemented","sigHash":"7f1ce56756365cc8cfafec0eebe56a2c9532da54d5b05632ac809ba3b2ea88b6","bodyHash":"336ca51be9de676155b13a44ff51c5841c4f21262849fd6f7c72c1b4a43d7ad2"}
 *
 * Go source:
 * func (s *Signature) Parameters() []*ast.Symbol {
 * 	return s.parameters
 * }
 */
export function Signature_Parameters(receiver: GoPtr<Signature>): GoSlice<GoPtr<Symbol_62f2f8bf>> {
  return receiver!.parameters;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::method::Signature.HasRestParameter","kind":"method","status":"implemented","sigHash":"0fe9edd757a45abbd20f9f78f63c275d1e84f311370c66f7beaa97574f7ab490","bodyHash":"350cd0ab4fc825a18939ef6b45fd65681d076a58262601eaac19308887aa0d83"}
 *
 * Go source:
 * func (s *Signature) HasRestParameter() bool {
 * 	return s.flags&SignatureFlagsHasRestParameter != 0
 * }
 */
export function Signature_HasRestParameter(receiver: GoPtr<Signature>): bool {
  return (receiver!.flags & SignatureFlagsHasRestParameter) !== 0;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::type::CompositeSignature","kind":"type","status":"implemented","sigHash":"e39032c93f95ea566e79718783a8a1210ed6c0142a0081b023a01f35211c28c1","bodyHash":"3772f4c15e650cd316631442f16b04d56116357fa776a268d07c62a4aa46f616"}
 *
 * Go source:
 * CompositeSignature struct {
 * 	isUnion    bool         // True for union, false for intersection
 * 	signatures []*Signature // Individual signatures
 * }
 */
export interface CompositeSignature {
  isUnion: bool;
  signatures: GoSlice<GoPtr<Signature>>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::type::TypePredicateKind","kind":"type","status":"implemented","sigHash":"9faa72bd03a0d91333779e1d44b4305bd26e6b840d4497024a10df4fc35f0adc","bodyHash":"219523222137bb5db02f6438c0e4bf50e2f57d34ac8f8d87b00a09583b1302b7"}
 *
 * Go source:
 * TypePredicateKind int32
 */
export type TypePredicateKind = int;

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::constGroup::TypePredicateKindThis+TypePredicateKindIdentifier+TypePredicateKindAssertsThis+TypePredicateKindAssertsIdentifier","kind":"constGroup","status":"implemented","sigHash":"4e16e530b5a4798b60c6dc07a2c3214aa25e59ff1dd16b3fe12976631062f424","bodyHash":"c4adb48a6eb2ddebc6a31cc899a5b7d35aa756fa3b169b6de21e6d25f69d77b3"}
 *
 * Go source:
 * const (
 * 	TypePredicateKindThis TypePredicateKind = iota
 * 	TypePredicateKindIdentifier
 * 	TypePredicateKindAssertsThis
 * 	TypePredicateKindAssertsIdentifier
 * )
 */
export const TypePredicateKindThis: TypePredicateKind = 0;
export const TypePredicateKindIdentifier: TypePredicateKind = 1;
export const TypePredicateKindAssertsThis: TypePredicateKind = 2;
export const TypePredicateKindAssertsIdentifier: TypePredicateKind = 3;

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::type::TypePredicate","kind":"type","status":"implemented","sigHash":"5805ec475d0857326ab4daa2551f7bffa257f9422c5454d7f72cd471985bdb54","bodyHash":"a7c781d616b964b7e61d877ccbb33408e487c129862f8cce1ea7c8969058a566"}
 *
 * Go source:
 * TypePredicate struct {
 * 	kind           TypePredicateKind
 * 	parameterIndex int32
 * 	parameterName  string
 * 	t              *Type
 * }
 */
export interface TypePredicate {
  kind: TypePredicateKind;
  parameterIndex: int;
  parameterName: string;
  t: GoPtr<Type>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::method::TypePredicate.Type","kind":"method","status":"implemented","sigHash":"aa6e3544a89469d96f16a0685594c278b3178a7e399bfd7bfb47c6fa706a3d6b","bodyHash":"1a429825ed99341d42943b764b2c7a3c5eef29bf4e6ef1b61a039b5697c2fcbf"}
 *
 * Go source:
 * func (typePredicate *TypePredicate) Type() *Type {
 * 	return typePredicate.t
 * }
 */
export function TypePredicate_Type(receiver: GoPtr<TypePredicate>): GoPtr<Type> {
  return receiver!.t;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::method::TypePredicate.Kind","kind":"method","status":"implemented","sigHash":"60a6572a6849a8345a741c8c59b8e2eabaf79782170cbd6a4b39f3c008d6019b","bodyHash":"c72b95b8ea204723883b9574bb2e483b44371237feb9045d29579cca50dc8c35"}
 *
 * Go source:
 * func (typePredicate *TypePredicate) Kind() TypePredicateKind {
 * 	return typePredicate.kind
 * }
 */
export function TypePredicate_Kind(receiver: GoPtr<TypePredicate>): TypePredicateKind {
  return receiver!.kind;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::method::TypePredicate.ParameterIndex","kind":"method","status":"implemented","sigHash":"bf7c9cf4270059f67323ae25a3a176c3bf4986e59e5d1ea9d046d3fbe2532a6d","bodyHash":"0cfc4b1f2576902cc3bd37f92702e13c792053e4c65f392b93d378ddab5e7691"}
 *
 * Go source:
 * func (typePredicate *TypePredicate) ParameterIndex() int32 {
 * 	return typePredicate.parameterIndex
 * }
 */
export function TypePredicate_ParameterIndex(receiver: GoPtr<TypePredicate>): int {
  return receiver!.parameterIndex;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::method::TypePredicate.ParameterName","kind":"method","status":"implemented","sigHash":"a8828236687dfe6c24ac2b087288285f7cb17c77c55d2511fd19da808b9ffef8","bodyHash":"0e11b77b1cb368853ed0afb1adea4bdd63a2503d3c9ed2e9c52a43e0e0cbef43"}
 *
 * Go source:
 * func (typePredicate *TypePredicate) ParameterName() string {
 * 	return typePredicate.parameterName
 * }
 */
export function TypePredicate_ParameterName(receiver: GoPtr<TypePredicate>): string {
  return receiver!.parameterName;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::type::IndexInfo","kind":"type","status":"implemented","sigHash":"206f6d34df1dc009195d4f975c81bb377c8cc22733d15ce66c2af60f8d4c861b","bodyHash":"9de72171592d665478a4260729be4ac8b27cda834761d80500f6eb60a4433233"}
 *
 * Go source:
 * IndexInfo struct {
 * 	keyType     *Type
 * 	valueType   *Type
 * 	isReadonly  bool
 * 	declaration *ast.Node   // IndexSignatureDeclaration
 * 	indexSymbol *ast.Symbol // Synthetic property symbol for this index signature
 * 	components  []*ast.Node // ElementWithComputedPropertyName
 * }
 */
export interface IndexInfo {
  keyType: GoPtr<Type>;
  valueType: GoPtr<Type>;
  isReadonly: bool;
  declaration: GoPtr<Node>;
  indexSymbol: GoPtr<Symbol_62f2f8bf>;
  components: GoSlice<GoPtr<Node>>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::method::IndexInfo.KeyType","kind":"method","status":"implemented","sigHash":"0caaccea0ed6ee3955aec6eb623f7cafe1a277165c5708fbc1cdaeff91c033e2","bodyHash":"bdcca6409c941758aa7e426f9159f749a9568f3349df1e330c19d648a10266cb"}
 *
 * Go source:
 * func (info *IndexInfo) KeyType() *Type {
 * 	return info.keyType
 * }
 */
export function IndexInfo_KeyType(receiver: GoPtr<IndexInfo>): GoPtr<Type> {
  return receiver!.keyType;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::method::IndexInfo.ValueType","kind":"method","status":"implemented","sigHash":"a29528c3cb956531d90088f47d6dfdd22edac860015e0fb2d2a934052f14fa95","bodyHash":"d8094544bf0cf8ae5dbbd71bb1a80edb45d1a42c7aa875c4194b0b641a4d9be2"}
 *
 * Go source:
 * func (info *IndexInfo) ValueType() *Type {
 * 	return info.valueType
 * }
 */
export function IndexInfo_ValueType(receiver: GoPtr<IndexInfo>): GoPtr<Type> {
  return receiver!.valueType;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::method::IndexInfo.IsReadonly","kind":"method","status":"implemented","sigHash":"950f96e1d03c2560eb088fc9f887ec106be221682203b7ba9b1ab13f948275aa","bodyHash":"3a690ab7bf086b4cc8fc74d23d6cb256621f71bb97b5b1842e42f5e1c3af5eed"}
 *
 * Go source:
 * func (info *IndexInfo) IsReadonly() bool {
 * 	return info.isReadonly
 * }
 */
export function IndexInfo_IsReadonly(receiver: GoPtr<IndexInfo>): bool {
  return receiver!.isReadonly;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::type::Ternary","kind":"type","status":"implemented","sigHash":"65225a2a63509ad6ae706f708e0b8f0c092f96ab9ce48631b6d0c0fb0a553282","bodyHash":"b37df4e6d3f066d222549b60141a3e22c039f7d5ddba53b7339216ec60661f91"}
 *
 * Go source:
 * Ternary int8
 */
export type Ternary = sbyte;

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::constGroup::TernaryFalse+TernaryUnknown+TernaryMaybe+TernaryTrue","kind":"constGroup","status":"implemented","sigHash":"766cd03a278156f040259af49ea9051351d1431e322285e2e843a1c7974ec4b7","bodyHash":"64970808fe183fa1b45478120c7c5817665ef1eb154438b0a30def096a8345f4"}
 *
 * Go source:
 * const (
 * 	TernaryFalse   Ternary = 0
 * 	TernaryUnknown Ternary = 1
 * 	TernaryMaybe   Ternary = 3
 * 	TernaryTrue    Ternary = -1
 * )
 */
export const TernaryFalse: Ternary = 0;
export const TernaryUnknown: Ternary = 1;
export const TernaryMaybe: Ternary = 3;
export const TernaryTrue: Ternary = -1;

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::type::TypeComparer","kind":"type","status":"implemented","sigHash":"e63b7abe915e7fcb49d662ed92de4e60ddf91a18c6d58380770eb65d1ebf71c5","bodyHash":"00c981ae5aa0dc7241fd2863141d7fc89fe52f2460240808960e493e5d9b9ec2"}
 *
 * Go source:
 * TypeComparer func(s *Type, t *Type, reportErrors bool) Ternary
 */
export type TypeComparer = (s: GoPtr<Type>, t: GoPtr<Type>, reportErrors: bool) => Ternary;

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::type::LanguageFeatureMinimumTargetMap","kind":"type","status":"implemented","sigHash":"09dde4006da9de6c518eb754e1b4afef60d3432668ab587704bfcdfbe99e267c","bodyHash":"a4e8fbf7840067676694ece6a4929081ad3c2dcade3ca8928b034f281c87313f"}
 *
 * Go source:
 * LanguageFeatureMinimumTargetMap struct {
 * 	Exponentiation                    core.ScriptTarget
 * 	AsyncFunctions                    core.ScriptTarget
 * 	ForAwaitOf                        core.ScriptTarget
 * 	AsyncGenerators                   core.ScriptTarget
 * 	AsyncIteration                    core.ScriptTarget
 * 	ObjectSpreadRest                  core.ScriptTarget
 * 	RegularExpressionFlagsDotAll      core.ScriptTarget
 * 	BindinglessCatch                  core.ScriptTarget
 * 	BigInt                            core.ScriptTarget
 * 	NullishCoalesce                   core.ScriptTarget
 * 	OptionalChaining                  core.ScriptTarget
 * 	LogicalAssignment                 core.ScriptTarget
 * 	TopLevelAwait                     core.ScriptTarget
 * 	ClassFields                       core.ScriptTarget
 * 	PrivateNamesAndClassStaticBlocks  core.ScriptTarget
 * 	RegularExpressionFlagsHasIndices  core.ScriptTarget
 * 	ShebangComments                   core.ScriptTarget
 * 	UsingAndAwaitUsing                core.ScriptTarget
 * 	ClassAndClassElementDecorators    core.ScriptTarget
 * 	RegularExpressionFlagsUnicodeSets core.ScriptTarget
 * }
 */
export interface LanguageFeatureMinimumTargetMap {
  Exponentiation: ScriptTarget;
  AsyncFunctions: ScriptTarget;
  ForAwaitOf: ScriptTarget;
  AsyncGenerators: ScriptTarget;
  AsyncIteration: ScriptTarget;
  ObjectSpreadRest: ScriptTarget;
  RegularExpressionFlagsDotAll: ScriptTarget;
  BindinglessCatch: ScriptTarget;
  BigInt: ScriptTarget;
  NullishCoalesce: ScriptTarget;
  OptionalChaining: ScriptTarget;
  LogicalAssignment: ScriptTarget;
  TopLevelAwait: ScriptTarget;
  ClassFields: ScriptTarget;
  PrivateNamesAndClassStaticBlocks: ScriptTarget;
  RegularExpressionFlagsHasIndices: ScriptTarget;
  ShebangComments: ScriptTarget;
  UsingAndAwaitUsing: ScriptTarget;
  ClassAndClassElementDecorators: ScriptTarget;
  RegularExpressionFlagsUnicodeSets: ScriptTarget;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::varGroup::LanguageFeatureMinimumTarget","kind":"varGroup","status":"implemented","sigHash":"b7fac77e692c413c3ae50b64bcefead96068fbec1d23b66d7b93164c3233c894","bodyHash":"6693821ceb30eca5cdc004e6743a1b93cf38f18edcf80c154dc913a854450af5"}
 *
 * Go source:
 * var LanguageFeatureMinimumTarget = LanguageFeatureMinimumTargetMap{
 * 	Exponentiation:                    core.ScriptTargetES2016,
 * 	AsyncFunctions:                    core.ScriptTargetES2017,
 * 	ForAwaitOf:                        core.ScriptTargetES2018,
 * 	AsyncGenerators:                   core.ScriptTargetES2018,
 * 	AsyncIteration:                    core.ScriptTargetES2018,
 * 	ObjectSpreadRest:                  core.ScriptTargetES2018,
 * 	RegularExpressionFlagsDotAll:      core.ScriptTargetES2018,
 * 	BindinglessCatch:                  core.ScriptTargetES2019,
 * 	BigInt:                            core.ScriptTargetES2020,
 * 	NullishCoalesce:                   core.ScriptTargetES2020,
 * 	OptionalChaining:                  core.ScriptTargetES2020,
 * 	LogicalAssignment:                 core.ScriptTargetES2021,
 * 	TopLevelAwait:                     core.ScriptTargetES2022,
 * 	ClassFields:                       core.ScriptTargetES2022,
 * 	PrivateNamesAndClassStaticBlocks:  core.ScriptTargetES2022,
 * 	RegularExpressionFlagsHasIndices:  core.ScriptTargetES2022,
 * 	ShebangComments:                   core.ScriptTargetESNext,
 * 	UsingAndAwaitUsing:                core.ScriptTargetESNext,
 * 	ClassAndClassElementDecorators:    core.ScriptTargetESNext,
 * 	RegularExpressionFlagsUnicodeSets: core.ScriptTargetESNext,
 * }
 */
export const LanguageFeatureMinimumTarget: LanguageFeatureMinimumTargetMap = {
  Exponentiation: ScriptTargetES2016,
  AsyncFunctions: ScriptTargetES2017,
  ForAwaitOf: ScriptTargetES2018,
  AsyncGenerators: ScriptTargetES2018,
  AsyncIteration: ScriptTargetES2018,
  ObjectSpreadRest: ScriptTargetES2018,
  RegularExpressionFlagsDotAll: ScriptTargetES2018,
  BindinglessCatch: ScriptTargetES2019,
  BigInt: ScriptTargetES2020,
  NullishCoalesce: ScriptTargetES2020,
  OptionalChaining: ScriptTargetES2020,
  LogicalAssignment: ScriptTargetES2021,
  TopLevelAwait: ScriptTargetES2022,
  ClassFields: ScriptTargetES2022,
  PrivateNamesAndClassStaticBlocks: ScriptTargetES2022,
  RegularExpressionFlagsHasIndices: ScriptTargetES2022,
  ShebangComments: ScriptTargetESNext,
  UsingAndAwaitUsing: ScriptTargetESNext,
  ClassAndClassElementDecorators: ScriptTargetESNext,
  RegularExpressionFlagsUnicodeSets: ScriptTargetESNext,
};

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::type::StringLiteralType","kind":"type","status":"implemented","sigHash":"4108fdc8fbd614a40a60fe1ed8ec922d142307644bb44059745466a24444a1fa","bodyHash":"a394c237938cf6cfaaca603244cfc23d0912642301ec74a9734fba649ab83c08"}
 *
 * Go source:
 * StringLiteralType = Type
 */
export type StringLiteralType = Type;
