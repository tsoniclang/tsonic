import type { bool, int, uint } from "@tsonic/core/types.js";
import type { GoPtr } from "../../go/compat.js";
import type { Node, SourceFile } from "../ast/ast.js";
import type { Symbol } from "../ast/symbol.js";
import type { SymbolFlags } from "../ast/symbolflags.js";

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/nodebuilder/types.go::type::SymbolTracker","kind":"type","status":"implemented","sigHash":"26b43a48169d1c79acfa978c9744770335c5a2d9095fdf93009281e487346220","bodyHash":"9d29dcb20ae9b48d48e110f003a56d95043ec4b923b7bbcbb944be964c029061"}
 *
 * Go source:
 * SymbolTracker interface {
 * 	TrackSymbol(symbol *ast.Symbol, enclosingDeclaration *ast.Node, meaning ast.SymbolFlags) bool
 * 	ReportInaccessibleThisError()
 * 	ReportPrivateInBaseOfClassExpression(propertyName string)
 * 	ReportInaccessibleUniqueSymbolError()
 * 	ReportCyclicStructureError()
 * 	ReportLikelyUnsafeImportRequiredError(specifier string, symbolName string)
 * 	ReportTruncationError()
 * 	ReportNonlocalAugmentation(containingFile *ast.SourceFile, parentSymbol *ast.Symbol, augmentingSymbol *ast.Symbol)
 * 	ReportNonSerializableProperty(propertyName string)
 * 
 * 	ReportInferenceFallback(node *ast.Node)
 * 	PushErrorFallbackNode(node *ast.Node)
 * 	PopErrorFallbackNode()
 * }
 */
export interface SymbolTracker {
  TrackSymbol(symbol_: GoPtr<Symbol>, enclosingDeclaration: GoPtr<Node>, meaning: SymbolFlags): bool;
  ReportInaccessibleThisError(): void;
  ReportPrivateInBaseOfClassExpression(propertyName: string): void;
  ReportInaccessibleUniqueSymbolError(): void;
  ReportCyclicStructureError(): void;
  ReportLikelyUnsafeImportRequiredError(specifier: string, symbolName: string): void;
  ReportTruncationError(): void;
  ReportNonlocalAugmentation(containingFile: GoPtr<SourceFile>, parentSymbol: GoPtr<Symbol>, augmentingSymbol: GoPtr<Symbol>): void;
  ReportNonSerializableProperty(propertyName: string): void;
  ReportInferenceFallback(node: GoPtr<Node>): void;
  PushErrorFallbackNode(node: GoPtr<Node>): void;
  PopErrorFallbackNode(): void;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/nodebuilder/types.go::type::Flags","kind":"type","status":"implemented","sigHash":"35e85ac044b21065a025313a94bcdb2debbcca435127893fa7bbb32bd19c7904","bodyHash":"de79cc4f5e88e1a6633bf979d13ad1c2ce5ef161b52bdb56e87abbc1c317fcc1"}
 *
 * Go source:
 * Flags uint32
 */
export type Flags = uint;

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/nodebuilder/types.go::constGroup::FlagsNone+FlagsNoTruncation+FlagsWriteArrayAsGenericType+FlagsGenerateNamesForShadowedTypeParams+FlagsUseStructuralFallback+FlagsForbidIndexedAccessSymbolReferences+FlagsWriteTypeArgumentsOfSignature+FlagsUseFullyQualifiedType+FlagsUseOnlyExternalAliasing+FlagsSuppressAnyReturnType+FlagsWriteTypeParametersInQualifiedName+FlagsMultilineObjectLiterals+FlagsWriteClassExpressionAsTypeLiteral+FlagsUseTypeOfFunction+FlagsOmitParameterModifiers+FlagsUseAliasDefinedOutsideCurrentScope+FlagsUseSingleQuotesForStringLiteralType+FlagsNoTypeReduction+FlagsUseInstantiationExpressions+FlagsOmitThisParameter+FlagsWriteCallStyleSignature+FlagsAllowThisInObjectLiteral+FlagsAllowQualifiedNameInPlaceOfIdentifier+FlagsAllowAnonymousIdentifier+FlagsAllowEmptyUnionOrIntersection+FlagsAllowEmptyTuple+FlagsAllowUniqueESSymbolType+FlagsAllowEmptyIndexInfoType+FlagsAllowNodeModulesRelativePaths+FlagsIgnoreErrors+FlagsInObjectTypeLiteral+FlagsInTypeAlias+FlagsInInitialEntityName","kind":"constGroup","status":"implemented","sigHash":"6c6eab77a2768c9d09f2fbc10657c1f230c8f7acd402219f8feb2ddd81f59828","bodyHash":"cccd0ddbcef32023a14b92216596e6af65b23c8dddee08383c865a41025474d4"}
 *
 * Go source:
 * const (
 * 	FlagsNone Flags = 0
 * 	// Options
 * 	FlagsNoTruncation                        Flags = 1 << 0
 * 	FlagsWriteArrayAsGenericType             Flags = 1 << 1
 * 	FlagsGenerateNamesForShadowedTypeParams  Flags = 1 << 2
 * 	FlagsUseStructuralFallback               Flags = 1 << 3
 * 	FlagsForbidIndexedAccessSymbolReferences Flags = 1 << 4
 * 	FlagsWriteTypeArgumentsOfSignature       Flags = 1 << 5
 * 	FlagsUseFullyQualifiedType               Flags = 1 << 6
 * 	FlagsUseOnlyExternalAliasing             Flags = 1 << 7
 * 	FlagsSuppressAnyReturnType               Flags = 1 << 8
 * 	FlagsWriteTypeParametersInQualifiedName  Flags = 1 << 9
 * 	FlagsMultilineObjectLiterals             Flags = 1 << 10
 * 	FlagsWriteClassExpressionAsTypeLiteral   Flags = 1 << 11
 * 	FlagsUseTypeOfFunction                   Flags = 1 << 12
 * 	FlagsOmitParameterModifiers              Flags = 1 << 13
 * 	FlagsUseAliasDefinedOutsideCurrentScope  Flags = 1 << 14
 * 	FlagsUseSingleQuotesForStringLiteralType Flags = 1 << 28
 * 	FlagsNoTypeReduction                     Flags = 1 << 29
 * 	FlagsUseInstantiationExpressions         Flags = 1 << 30
 * 	FlagsOmitThisParameter                   Flags = 1 << 25
 * 	FlagsWriteCallStyleSignature             Flags = 1 << 27
 * 	// Error handling
 * 	FlagsAllowThisInObjectLiteral              Flags = 1 << 15
 * 	FlagsAllowQualifiedNameInPlaceOfIdentifier Flags = 1 << 16
 * 	FlagsAllowAnonymousIdentifier              Flags = 1 << 17
 * 	FlagsAllowEmptyUnionOrIntersection         Flags = 1 << 18
 * 	FlagsAllowEmptyTuple                       Flags = 1 << 19
 * 	FlagsAllowUniqueESSymbolType               Flags = 1 << 20
 * 	FlagsAllowEmptyIndexInfoType               Flags = 1 << 21
 * 	// Errors (cont.)
 * 	FlagsAllowNodeModulesRelativePaths Flags = 1 << 26
 * 	FlagsIgnoreErrors                  Flags = FlagsAllowThisInObjectLiteral | FlagsAllowQualifiedNameInPlaceOfIdentifier | FlagsAllowAnonymousIdentifier | FlagsAllowEmptyUnionOrIntersection | FlagsAllowEmptyTuple | FlagsAllowEmptyIndexInfoType | FlagsAllowNodeModulesRelativePaths
 * 	// State
 * 	FlagsInObjectTypeLiteral Flags = 1 << 22
 * 	FlagsInTypeAlias         Flags = 1 << 23
 * 	FlagsInInitialEntityName Flags = 1 << 24
 * )
 */
export const FlagsNone: Flags = 0 as Flags;
export const FlagsNoTruncation: Flags = 1 << 0 as Flags;
export const FlagsWriteArrayAsGenericType: Flags = 1 << 1 as Flags;
export const FlagsGenerateNamesForShadowedTypeParams: Flags = 1 << 2 as Flags;
export const FlagsUseStructuralFallback: Flags = 1 << 3 as Flags;
export const FlagsForbidIndexedAccessSymbolReferences: Flags = 1 << 4 as Flags;
export const FlagsWriteTypeArgumentsOfSignature: Flags = 1 << 5 as Flags;
export const FlagsUseFullyQualifiedType: Flags = 1 << 6 as Flags;
export const FlagsUseOnlyExternalAliasing: Flags = 1 << 7 as Flags;
export const FlagsSuppressAnyReturnType: Flags = 1 << 8 as Flags;
export const FlagsWriteTypeParametersInQualifiedName: Flags = 1 << 9 as Flags;
export const FlagsMultilineObjectLiterals: Flags = 1 << 10 as Flags;
export const FlagsWriteClassExpressionAsTypeLiteral: Flags = 1 << 11 as Flags;
export const FlagsUseTypeOfFunction: Flags = 1 << 12 as Flags;
export const FlagsOmitParameterModifiers: Flags = 1 << 13 as Flags;
export const FlagsUseAliasDefinedOutsideCurrentScope: Flags = 1 << 14 as Flags;
export const FlagsUseSingleQuotesForStringLiteralType: Flags = 1 << 28 as Flags;
export const FlagsNoTypeReduction: Flags = 1 << 29 as Flags;
export const FlagsUseInstantiationExpressions: Flags = 1 << 30 as Flags;
export const FlagsOmitThisParameter: Flags = 1 << 25 as Flags;
export const FlagsWriteCallStyleSignature: Flags = 1 << 27 as Flags;
export const FlagsAllowThisInObjectLiteral: Flags = 1 << 15 as Flags;
export const FlagsAllowQualifiedNameInPlaceOfIdentifier: Flags = 1 << 16 as Flags;
export const FlagsAllowAnonymousIdentifier: Flags = 1 << 17 as Flags;
export const FlagsAllowEmptyUnionOrIntersection: Flags = 1 << 18 as Flags;
export const FlagsAllowEmptyTuple: Flags = 1 << 19 as Flags;
export const FlagsAllowUniqueESSymbolType: Flags = 1 << 20 as Flags;
export const FlagsAllowEmptyIndexInfoType: Flags = 1 << 21 as Flags;
export const FlagsAllowNodeModulesRelativePaths: Flags = 1 << 26 as Flags;
export const FlagsIgnoreErrors: Flags = (FlagsAllowThisInObjectLiteral | FlagsAllowQualifiedNameInPlaceOfIdentifier | FlagsAllowAnonymousIdentifier | FlagsAllowEmptyUnionOrIntersection | FlagsAllowEmptyTuple | FlagsAllowEmptyIndexInfoType | FlagsAllowNodeModulesRelativePaths) as Flags;
export const FlagsInObjectTypeLiteral: Flags = 1 << 22 as Flags;
export const FlagsInTypeAlias: Flags = 1 << 23 as Flags;
export const FlagsInInitialEntityName: Flags = 1 << 24 as Flags;

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/nodebuilder/types.go::type::InternalFlags","kind":"type","status":"implemented","sigHash":"8b43ac46a51e12a9ff91c6cf16502b78b6eeff4b5f5f3c574ffa73379f437e26","bodyHash":"ea17b00948a4185cf12714173de63f900f5f4637f2d01943a86305bbd1b6c86e"}
 *
 * Go source:
 * InternalFlags int32
 */
export type InternalFlags = int;

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/nodebuilder/types.go::constGroup::InternalFlagsNone+InternalFlagsWriteComputedProps+InternalFlagsNoSyntacticPrinter+InternalFlagsDoNotIncludeSymbolChain+InternalFlagsAllowUnresolvedNames","kind":"constGroup","status":"implemented","sigHash":"e338c3597dbc4f56f75a060492fea22a6194cc4f55d746a1850ab3de52719d98","bodyHash":"8982e89bc683b60bb18506efa7b2a2021f26e0f5385c071c6739f0bd5145308f"}
 *
 * Go source:
 * const (
 * 	InternalFlagsNone                    InternalFlags = 0
 * 	InternalFlagsWriteComputedProps      InternalFlags = 1 << 0
 * 	InternalFlagsNoSyntacticPrinter      InternalFlags = 1 << 1
 * 	InternalFlagsDoNotIncludeSymbolChain InternalFlags = 1 << 2
 * 	InternalFlagsAllowUnresolvedNames    InternalFlags = 1 << 3
 * )
 */
export const InternalFlagsNone: InternalFlags = 0 as InternalFlags;
export const InternalFlagsWriteComputedProps: InternalFlags = 1 << 0 as InternalFlags;
export const InternalFlagsNoSyntacticPrinter: InternalFlags = 1 << 1 as InternalFlags;
export const InternalFlagsDoNotIncludeSymbolChain: InternalFlags = 1 << 2 as InternalFlags;
export const InternalFlagsAllowUnresolvedNames: InternalFlags = 1 << 3 as InternalFlags;
