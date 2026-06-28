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
export const FlagsNone = 0;
export const FlagsNoTruncation = 1 << 0;
export const FlagsWriteArrayAsGenericType = 1 << 1;
export const FlagsGenerateNamesForShadowedTypeParams = 1 << 2;
export const FlagsUseStructuralFallback = 1 << 3;
export const FlagsForbidIndexedAccessSymbolReferences = 1 << 4;
export const FlagsWriteTypeArgumentsOfSignature = 1 << 5;
export const FlagsUseFullyQualifiedType = 1 << 6;
export const FlagsUseOnlyExternalAliasing = 1 << 7;
export const FlagsSuppressAnyReturnType = 1 << 8;
export const FlagsWriteTypeParametersInQualifiedName = 1 << 9;
export const FlagsMultilineObjectLiterals = 1 << 10;
export const FlagsWriteClassExpressionAsTypeLiteral = 1 << 11;
export const FlagsUseTypeOfFunction = 1 << 12;
export const FlagsOmitParameterModifiers = 1 << 13;
export const FlagsUseAliasDefinedOutsideCurrentScope = 1 << 14;
export const FlagsUseSingleQuotesForStringLiteralType = 1 << 28;
export const FlagsNoTypeReduction = 1 << 29;
export const FlagsUseInstantiationExpressions = 1 << 30;
export const FlagsOmitThisParameter = 1 << 25;
export const FlagsWriteCallStyleSignature = 1 << 27;
export const FlagsAllowThisInObjectLiteral = 1 << 15;
export const FlagsAllowQualifiedNameInPlaceOfIdentifier = 1 << 16;
export const FlagsAllowAnonymousIdentifier = 1 << 17;
export const FlagsAllowEmptyUnionOrIntersection = 1 << 18;
export const FlagsAllowEmptyTuple = 1 << 19;
export const FlagsAllowUniqueESSymbolType = 1 << 20;
export const FlagsAllowEmptyIndexInfoType = 1 << 21;
export const FlagsAllowNodeModulesRelativePaths = 1 << 26;
export const FlagsIgnoreErrors = (FlagsAllowThisInObjectLiteral | FlagsAllowQualifiedNameInPlaceOfIdentifier | FlagsAllowAnonymousIdentifier | FlagsAllowEmptyUnionOrIntersection | FlagsAllowEmptyTuple | FlagsAllowEmptyIndexInfoType | FlagsAllowNodeModulesRelativePaths);
export const FlagsInObjectTypeLiteral = 1 << 22;
export const FlagsInTypeAlias = 1 << 23;
export const FlagsInInitialEntityName = 1 << 24;
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
export const InternalFlagsNone = 0;
export const InternalFlagsWriteComputedProps = 1 << 0;
export const InternalFlagsNoSyntacticPrinter = 1 << 1;
export const InternalFlagsDoNotIncludeSymbolChain = 1 << 2;
export const InternalFlagsAllowUnresolvedNames = 1 << 3;
//# sourceMappingURL=types.js.map