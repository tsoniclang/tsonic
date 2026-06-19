import type { bool, byte, int } from "../../go/scalars.js";
import { AppendIfUnique, Every, FindIndex, IfElse, Map as core_Map, Coalesce, OrElse, SameMap, Some } from "../core/core.js";
import type { GoMap, GoPtr, GoSlice } from "../../go/compat.js";
import { NewGoStructMap } from "../../go/compat.js";
import type { Node, NodeList } from "../ast/spine.js";
import { Node_FlowNodeData, Node_ForEachChild, Node_Name, Node_Pos, Node_End, NodeList_Pos } from "../ast/spine.js";
import { Node_Arguments, Node_AsFlowReduceLabelData, Node_AsFlowSwitchClauseData, Node_Elements, Node_Expression, Node_Initializer, Node_Parameters, Node_PropertyNameOrName, Node_StatementList, Node_Text, Node_Type } from "../ast/ast.js";
import type { BinaryExpression, ElementAccessExpression, LiteralExpression, TypeOfExpression } from "../ast/ast_generated.js";
import { AsBinaryExpression, AsBindingElement, AsCaseBlock, AsClassStaticBlockDeclaration, AsConstructorDeclaration, AsElementAccessExpression, AsExportDeclaration, AsExportSpecifier, AsForInOrOfStatement, AsMetaProperty, AsPrefixUnaryExpression, AsQualifiedName, AsShorthandPropertyAssignment, AsSwitchStatement, AsTypeOfExpression } from "../ast/generated/casts.js";
import { IsAccessExpression, IsAssignmentExpression, IsBooleanLiteral, IsBindingPattern, IsClassLike, IsEntityNameExpression, IsExpressionOfOptionalChainRoot, IsFunctionLike, IsFunctionOrModuleBlock, IsFunctionOrSourceFile, IsFunctionExpressionOrArrowFunction, IsObjectLiteralMethod, IsOptionalChain, IsStatic, IsStringLiteralLike, IsStringOrNumericLiteralLike, IsTypeNode, SkipParentheses, GetRootDeclaration, GetSourceFileOfNode, GetThisContainer, FindAncestor, TryGetTextOfPropertyName, IsThisInTypeQuery, HasStaticModifier, IsPushOrUnshiftIdentifier, IsAssignmentTarget, IsInJSFile, IsVarConstLike } from "../ast/utilities.js";
import { IsArrowFunction, IsArrayBindingPattern, IsArrayLiteralExpression, IsBinaryExpression, IsBindingElement, IsCallExpression, IsCatchClause, IsElementAccessExpression, IsEnumMember, IsExpressionStatement, IsExportSpecifier, IsForInStatement, IsForOfStatement, IsIdentifier, IsMetaProperty, IsNonNullExpression, IsObjectBindingPattern, IsParameterDeclaration, IsParenthesizedExpression, IsPrivateIdentifier, IsPropertyAccessExpression, IsPropertyAssignment, IsPropertyDeclaration, IsPropertySignatureDeclaration, IsShorthandPropertyAssignment, IsStringLiteral, IsTypeOfExpression, IsVariableDeclaration } from "../ast/generated/predicates.js";
import { NodeFlagsInWithStatement, NodeFlagsNone } from "../ast/generated/flags.js";
import type { NodeFlags } from "../ast/generated/flags.js";
import { NewDiagnostic } from "../ast/diagnostic.js";
import type { DiagnosticsCollection } from "../ast/diagnostic.js";
import type { Diagnostic } from "../ast/diagnostic.js";
import type { FlowList, FlowNode, FlowReduceLabelData, FlowSwitchClauseData } from "../ast/flow.js";
import { FlowFlagsAssignment, FlowFlagsArrayMutation, FlowFlagsBranchLabel, FlowFlagsCall, FlowFlagsCondition, FlowFlagsLoopLabel, FlowFlagsReduceLabel, FlowFlagsShared, FlowFlagsStart, FlowFlagsSwitchClause, FlowFlagsTrueCondition, FlowFlagsUnreachable, FlowSwitchClauseData_IsEmpty } from "../ast/flow.js";
import type { Kind } from "../ast/kind_generated.js";
import { KindAmpersandAmpersandEqualsToken, KindAmpersandAmpersandToken, KindArrowFunction, KindArrayLiteralExpression, KindBarBarEqualsToken, KindBarBarToken, KindBinaryExpression, KindBindingElement, KindCallExpression, KindCaseClause, KindClassDeclaration, KindCommaToken, KindDefaultClause, KindDeleteExpression, KindDoStatement, KindEqualsEqualsEqualsToken, KindEqualsEqualsToken, KindEqualsToken, KindExclamationEqualsEqualsToken, KindExclamationEqualsToken, KindExclamationToken, KindExpressionStatement, KindFalseKeyword, KindForInStatement, KindForOfStatement, KindForStatement, KindFunctionDeclaration, KindFunctionExpression, KindIdentifier, KindIfStatement, KindInKeyword, KindInstanceOfKeyword, KindMetaProperty, KindMethodDeclaration, KindObjectBindingPattern, KindArrayBindingPattern, KindParenthesizedExpression, KindNonNullExpression, KindPrefixUnaryExpression, KindPrivateIdentifier, KindPropertyAccessExpression, KindElementAccessExpression, KindPropertyAssignment, KindQualifiedName, KindQuestionQuestionEqualsToken, KindQuestionQuestionToken, KindSatisfiesExpression, KindShorthandPropertyAssignment, KindSpreadElement, KindSuperKeyword, KindSwitchStatement, KindThisKeyword, KindTrueKeyword, KindTryStatement, KindTypeAliasDeclaration, KindTypeOfExpression, KindVariableDeclaration, KindVariableStatement, KindWhileStatement, KindWithStatement, KindEnumDeclaration, KindInterfaceDeclaration, KindJSTypeAliasDeclaration } from "../ast/generated/kinds.js";
import type { SymbolFlags } from "../ast/generated/flags.js";
import type { CheckFlags } from "../ast/checkflags.js";
import { SymbolFlagsEnumMember, SymbolFlagsOptional, SymbolFlagsValue } from "../ast/symbolflags.js";
import { CheckFlagsPartial } from "../ast/checkflags.js";
import { InternalSymbolNamePrefix } from "../ast/symbol.js";
import type { Symbol } from "../ast/symbol.js";
import { GetRangeOfTokenAtPosition } from "../scanner/scanner.js";
import type { SourceFile } from "../ast/ast.js";
import { The_containing_function_or_module_body_is_too_large_for_control_flow_analysis } from "../diagnostics/generated/messages.js";
import { Checker_addDiagnostic } from "./checker.js";
import type { CacheHashKey, Checker, keyBuilder, TypeFacts, UnionReduction } from "./checker/state.js";
import type { CachedTypeKey, NarrowedTypeKey, AssignmentReducedKey } from "./checker/state.js";
import { CachedTypeKindEvolvingArrayType, CheckModeNormal, TypeFactsAllTypeofNE, TypeFactsEQNull, TypeFactsEQUndefined, TypeFactsEQUndefinedOrNull, TypeFactsFalsy, TypeFactsNENull, TypeFactsNEUndefined, TypeFactsNEUndefinedOrNull, TypeFactsNone, TypeFactsTruthy, TypeFactsTypeofEQBigInt, TypeFactsTypeofEQBoolean, TypeFactsTypeofEQFunction, TypeFactsTypeofEQHostObject, TypeFactsTypeofEQNumber, TypeFactsTypeofEQObject, TypeFactsTypeofEQString, TypeFactsTypeofEQSymbol, TypeFactsTypeofNEBigInt, TypeFactsTypeofNEBoolean, TypeFactsTypeofNEFunction, TypeFactsTypeofNEHostObject, TypeFactsTypeofNENumber, TypeFactsTypeofNEObject, TypeFactsTypeofNEString, TypeFactsTypeofNESymbol } from "./checker/state.js";
import type { FlowLoopInfo, FlowLoopKey } from "./checker/state.js";
import { UnionReductionLiteral, UnionReductionSubtype } from "./checker/state.js";
import { NodeCheckFlagsAssignmentsMarked, ExhaustiveStateComputing, ExhaustiveStateFalse, ExhaustiveStateTrue, ExhaustiveStateUnknown } from "./types.js";
import type { MappedSymbolLinks, MarkedAssignmentSymbolLinks, NodeLinks, SignatureLinks, SwitchStatementLinks, TypeNodeLinks } from "./types.js";
import type { LinkStore } from "../core/linkstore.js";
import { LinkStore_Get, LinkStore_Has } from "../core/linkstore.js";
import { CacheHashKey_IsZero, keyBuilder_writeByte, keyBuilder_writeString } from "./checker/support.js";
import { keyBuilder_hash } from "./checker/support-queries.js";
import { keyBuilder_writeNode } from "./checker/syntax-checking.js";
import { keyBuilder_writeSymbol } from "./checker/symbols.js";
import { keyBuilder_writeType } from "./checker/types.js";
import { Tracer_Instant } from "./tracer.js";
import { PhaseCheckTypes } from "../tracing/tracing.js";
import type { EvolvingArrayType, Signature, Type, TypePredicate } from "./types.js";
import { ObjectFlagsClass, ObjectFlagsEvolvingArray, TypeFlagsAny, TypeFlagsAnyOrUnknown, TypeFlagsBigInt, TypeFlagsBigIntLiteral, TypeFlagsBoolean, TypeFlagsBooleanLiteral, TypeFlagsInstantiable, TypeFlagsNever, TypeFlagsNonPrimitive, TypeFlagsNull, TypeFlagsNullable, TypeFlagsNumber, TypeFlagsNumberLike, TypeFlagsNumberLiteral, TypeFlagsPrimitive, TypeFlagsObject, TypeFlagsString, TypeFlagsStringLiteral, TypeFlagsStringMapping, TypeFlagsStringOrNumberLiteral, TypeFlagsTemplateLiteral, TypeFlagsUndefined, TypeFlagsUnion, TypeFlagsUnknown, TypeFlagsUniqueESSymbol } from "./types.js";
import type { ExhaustiveState, TypePredicateKind } from "./types.js";
import { TypePredicateKindAssertsIdentifier, TypePredicateKindAssertsThis, TypePredicateKindIdentifier, TypePredicateKindThis, SignatureKindCall, SignatureKindConstruct } from "./types.js";
import { Type_AsEvolvingArrayType, Type_AsLiteralType, Type_AsUnionType, Type_AsUnionOrIntersectionType, Type_AsInterfaceType, Type_AsUniqueESSymbolType, Type_Types } from "./types.js";
import { everyType, isFreshLiteralType, isLiteralType, isNeitherUnitTypeNorNever, isUnitType, someType, getStringLiteralValue } from "./checker/state.js";
import { isTypeUsableAsPropertyName, getPropertyNameFromType } from "./utilities.js";
import { Checker_newObjectType, Checker_convertAutoToAny, Checker_isUnitLikeType } from "./checker/types.js";
import { Checker_getBaseTypeOfLiteralType, Checker_getWidenedLiteralType, Checker_mapType, Checker_filterType, Checker_getUnionType, Checker_getUnionTypeEx, Checker_getIntersectionType, Checker_getTypeWithFacts, Checker_getAdjustedTypeWithFacts, Checker_getFreshTypeOfLiteralType, Checker_recombineUnknownType, Checker_getRegularTypeOfLiteralType, Checker_extractTypesOfKind, Checker_getOptionalType, Checker_getRegularTypeOfObjectLiteral, Checker_getApparentType, Checker_getOptionalExpressionType } from "./checker/types.js";
import { Checker_getTypeAliasInstantiation, Checker_getBaseConstraintOfType, Checker_getBaseConstraintOrType } from "./checker/inference.js";
import { Checker_maybeTypeOfKind, Checker_hasTypeFacts, Checker_getTypeFacts, Checker_extractUnitType, Checker_isPatternLiteralType, Checker_removeType, Checker_IsEmptyAnonymousObjectType } from "./checker/types.js";
import { Checker_isTypeRelatedTo, Checker_isTypeSubtypeOf, Checker_isTypeStrictSubtypeOf, Checker_isTypeAssignableTo, Checker_isTypeDerivedFrom, Checker_isTypeSubsetOf, Checker_areTypesComparable, Checker_getKeyPropertyName, Checker_getConstituentTypeForKeyType, Checker_isDiscriminantProperty } from "./relater.js";
import { Checker_isTypeAssignableToKind, Checker_allTypesAssignableToKind } from "./checker/relations.js";
import { Checker_getTypeOfPropertyOfType, Checker_getDeclaredTypeOfSymbol, Checker_getTypeOfSymbol } from "./checker/symbols.js";
import { Checker_getTypeOfPropertyOrIndexSignatureOfType } from "./checker/signatures.js";
import { Checker_createArrayType, Checker_isTupleLikeType, Checker_getTupleElementType, Checker_checkIteratedTypeOrElementType } from "./checker/types.js";
import { Checker_getApplicableIndexInfoForName } from "./checker/signatures.js";
import { Checker_getPropertyOfType } from "./checker/symbols.js";
import { Checker_isVarConstLike } from "./checker/support-queries.js";
import { Checker_getNonUndefinedType, Checker_getNonNullableTypeIfNeeded } from "./checker/types.js";
import { IsTypeAny } from "./utilities.js";
import { Checker_getExportSymbolOfValueSymbolIfExported, Checker_getResolvedSymbol, Checker_resolveSymbol, Checker_getSymbolOfDeclaration, Checker_resolveEntityName, Checker_isReadonlySymbol, Checker_isSomeSymbolAssigned, Checker_getSymbolForPrivateIdentifierExpression, Checker_getResolvedSymbolOrNil } from "./checker/symbols.js";
import { Checker_isConstantVariable, Checker_isParameterOrMutableLocalVariable, AssignmentKindCompound, AssignmentKindDefinite, AssignmentKindNone } from "./utilities.js";
import { Checker_checkNonNullExpression, Checker_checkNonNullType, Checker_getContextFreeTypeOfExpression, Checker_getTypeOfExpression, Checker_isFunctionType, Checker_IsNullableType } from "./checker/types.js";
import { Checker_checkExpression, Checker_checkExpressionCached, Checker_checkRightHandSideOfForOf, Checker_checkSuperExpression } from "./checker/syntax-checking.js";
import { Checker_getResolvedSignature, Checker_isConstructorType, Checker_getSignatureFromDeclaration, Checker_getErasedSignature, Checker_getSignaturesOfType, Checker_getReturnTypeFromAnnotation } from "./checker/signatures.js";
import { Checker_getTypePredicateOfSignature } from "./relater.js";
import { Checker_getReturnTypeOfSignature } from "./checker/signatures.js";
import { Checker_tryGetTypeFromTypeNode } from "./checker/types.js";
import { Checker_getLiteralTypeFromPropertyName, Checker_isBlockScopedNameDeclaredBeforeUse } from "./checker/symbols.js";
import { Checker_getFlowTypeOfProperty, Checker_getNarrowableTypeForReference } from "./checker/flow-narrowing.js";
import { getAssignmentTargetKind, isEmptyArrayLiteral, isCallChain, isInCompoundLikeAssignment, hasDotDotDotToken, isNonNullAccess, getBindingElementPropertyName, hasOnlyExpressionInitializer } from "./utilities.js";
import { GetSymbolNameForPrivateIdentifier } from "../binder/binder.js";
import { IterationUseDestructuring, IterationUseForAwaitOf, IterationUseForOf } from "./checker/state.js";
import type { Hasher } from "../../go/github.com/zeebo/xxh3.js";
import { HashString128, New as NewXxh3 } from "../../go/github.com/zeebo/xxh3.js";
import type { Tracer } from "./tracer.js";
import { AnyToString } from "../evaluator/evaluator.js";
import { IsFunctionExpression } from "../ast/generated/predicates.js";
import { SymbolFlagsFunction, SymbolFlagsMethod, SymbolFlagsClass, SymbolFlagsValueModule, SymbolFlagsVariable, SymbolFlagsProperty } from "../ast/generated/flags.js";
import { CheckFlagsMapped } from "../ast/checkflags.js";
import { createDiagnosticForNode } from "./checker/state.js";
import { X_0_needs_an_explicit_type_annotation } from "../diagnostics/generated/messages.js";
import { Diagnostic_AddRelatedInfo } from "../ast/diagnostic.js";
import { Checker_symbolToString, Checker_TypeToString } from "./printer.js";
import { TSTrue } from "../core/tristate.js";
import { NewIdentifier, NewPrivateIdentifier, NewPropertyAccessExpression, NewKeywordExpression } from "../ast/generated/factory.js";
import { Checker_error } from "./checker/support.js";
import { Member_0_implicitly_has_an_1_type } from "../diagnostics/generated/messages.js";

function getMarkedAssignmentSymbolLinks(receiver: GoPtr<Checker>, symbol_: GoPtr<Symbol>): MarkedAssignmentSymbolLinks {
  const links = LinkStore_Get<GoPtr<Symbol>, MarkedAssignmentSymbolLinks>(
    receiver!.markedAssignmentSymbolLinks as unknown as LinkStore<GoPtr<Symbol>, MarkedAssignmentSymbolLinks>,
    symbol_,
  )!;
  links.lastAssignmentPos ??= 0 as int;
  links.hasDefiniteAssignment ??= false as bool;
  return links;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/flow.go::type::FlowType","kind":"type","status":"implemented","sigHash":"bc02a5461036608265091398679db2e7b0cb752f9d0a59b23a5678f16c24f02c","bodyHash":"7465c9c089b5303ec8615aa727b2669e5592a430905d1a3987212c329855f3d4"}
 *
 * Go source:
 * FlowType struct {
 * 	t          *Type
 * 	incomplete bool
 * }
 */
export interface FlowType {
  t: GoPtr<Type>;
  incomplete: bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/flow.go::method::FlowType.isNil","kind":"method","status":"implemented","sigHash":"7989a8e788b0b1728b346131924804035184e9f83b24c32fd1585507c52c7bdd","bodyHash":"378d5f866ebbda6f3ae44fd48853b2e2ef6d6ddeeef77986242cfb2740271956"}
 *
 * Go source:
 * func (ft *FlowType) isNil() bool {
 * 	return ft.t == nil
 * }
 */
export function FlowType_isNil(receiver: GoPtr<FlowType>): bool {
  return receiver?.t === undefined;
}

const flowLoopKeys = new WeakMap<FlowNode, globalThis.Map<CacheHashKey, FlowLoopKey>>();

function getFlowLoopKey(flow: GoPtr<FlowNode>, refKey: CacheHashKey): FlowLoopKey {
  let byRefKey = flowLoopKeys.get(flow!);
  if (byRefKey === undefined) {
    byRefKey = NewGoStructMap<CacheHashKey, FlowLoopKey>();
    flowLoopKeys.set(flow!, byRefKey);
  }
  let key = byRefKey.get(refKey);
  if (key === undefined) {
    key = { flowNode: flow, refKey };
    byRefKey.set(refKey, key);
  }
  return key;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/flow.go::method::Checker.newFlowType","kind":"method","status":"implemented","sigHash":"83cfb5b6741c497ac5c9162a9bd2812937af41ff5d7c80fa36e2dd9c785974d1","bodyHash":"88de6537352db89ace11ef3a3204b8c72d272c03765bc6602a80b3f598f1fc72"}
 *
 * Go source:
 * func (c *Checker) newFlowType(t *Type, incomplete bool) FlowType {
 * 	if incomplete && t.flags&TypeFlagsNever != 0 {
 * 		t = c.silentNeverType
 * 	}
 * 	return FlowType{t: t, incomplete: incomplete}
 * }
 */
export function Checker_newFlowType(receiver: GoPtr<Checker>, t: GoPtr<Type>, incomplete: bool): FlowType {
  let resolvedT = t;
  if (incomplete && (resolvedT!.flags & TypeFlagsNever) !== 0) {
    resolvedT = receiver!.silentNeverType;
  }
  return { t: resolvedT, incomplete };
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/flow.go::type::SharedFlow","kind":"type","status":"implemented","sigHash":"787b3fcb7e50568b7942ae6dcca6257ab12f9ced5f9cde63f334523932b72995","bodyHash":"99caec8338f5898c9c150c692974a1276a97dc9cde23cb72bce2ef586b6d8aa4"}
 *
 * Go source:
 * SharedFlow struct {
 * 	flow     *ast.FlowNode
 * 	flowType FlowType
 * }
 */
export interface SharedFlow {
  flow: GoPtr<FlowNode>;
  flowType: FlowType;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/flow.go::type::FlowState","kind":"type","status":"implemented","sigHash":"46df3c12b9f8fde1d4d141ef6bbc3c0f644f3dbeaa603ae02f171ee45e35f821","bodyHash":"eb27780cc8668408cbb7dc110659c02ae81fc931fe46785439856c79b8056950"}
 *
 * Go source:
 * FlowState struct {
 * 	reference       *ast.Node
 * 	declaredType    *Type
 * 	initialType     *Type
 * 	flowContainer   *ast.Node
 * 	refKey          CacheHashKey
 * 	depth           int
 * 	sharedFlowStart int
 * 	reduceLabels    []*ast.FlowReduceLabelData
 * 	next            *FlowState
 * }
 */
export interface FlowState {
  reference: GoPtr<Node>;
  declaredType: GoPtr<Type>;
  initialType: GoPtr<Type>;
  flowContainer: GoPtr<Node>;
  refKey: CacheHashKey;
  depth: int;
  sharedFlowStart: int;
  reduceLabels: GoSlice<GoPtr<FlowReduceLabelData>>;
  next: GoPtr<FlowState>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/flow.go::method::Checker.getFlowState","kind":"method","status":"implemented","sigHash":"92f48cd0143bdcf0bc99161bce4ee3ed11f89a2a1a146cbc3b8a1e99228de846","bodyHash":"6e80147cbe6cbf79d0b5f37b2800a545d1c0f1f264193a6536bfe47e7ac8c5b4"}
 *
 * Go source:
 * func (c *Checker) getFlowState() *FlowState {
 * 	f := c.freeFlowState
 * 	if f == nil {
 * 		f = &FlowState{}
 * 	}
 * 	c.freeFlowState = f.next
 * 	return f
 * }
 */
export function Checker_getFlowState(receiver: GoPtr<Checker>): GoPtr<FlowState> {
  let f = receiver!.freeFlowState;
  if (f === undefined) {
    f = {} as FlowState;
    // A fresh FlowState must start at Go zero-values (the recycled path is reset by putFlowState).
    // Otherwise depth is undefined -> depth++ is NaN so the depth===2000 recursion guard never
    // fires, and sharedFlowStart is undefined so the shared-flow loop is skipped.
    f.depth = 0;
    f.sharedFlowStart = 0;
    f.reduceLabels = [];
  }
  receiver!.freeFlowState = f.next;
  return f;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/flow.go::method::Checker.putFlowState","kind":"method","status":"implemented","sigHash":"142b2404e4976aceb723e6dff9798b142577ada3b0733209a904857df1a4d096","bodyHash":"afed1c0741fbb1af5209528d19a8a5edf3a7633c9567c3c91ae999a252299a3d"}
 *
 * Go source:
 * func (c *Checker) putFlowState(f *FlowState) {
 * 	*f = FlowState{
 * 		reduceLabels: f.reduceLabels[:0],
 * 		next:         c.freeFlowState,
 * 	}
 * 	c.freeFlowState = f
 * }
 */
export function Checker_putFlowState(receiver: GoPtr<Checker>, f: GoPtr<FlowState>): void {
  const reduceLabels = f!.reduceLabels ?? [];
  reduceLabels.length = 0;
  f!.reference = undefined;
  f!.declaredType = undefined;
  f!.initialType = undefined;
  f!.flowContainer = undefined;
  f!.refKey = undefined as unknown as CacheHashKey;
  f!.depth = 0;
  f!.sharedFlowStart = 0;
  f!.reduceLabels = reduceLabels;
  f!.next = receiver!.freeFlowState;
  receiver!.freeFlowState = f;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/flow.go::func::getFlowNodeOfNode","kind":"func","status":"implemented","sigHash":"854a4f5aad2622c05921710f884193012b043e25332e8c1b63732032a4c23936","bodyHash":"77a2443beac2039f6832c342147e8b08a8ccfc6179702f52bc7f5a10a83e0eab"}
 *
 * Go source:
 * func getFlowNodeOfNode(node *ast.Node) *ast.FlowNode {
 * 	flowNodeData := node.FlowNodeData()
 * 	if flowNodeData != nil {
 * 		return flowNodeData.FlowNode
 * 	}
 * 	return nil
 * }
 */
export function getFlowNodeOfNode(node: GoPtr<Node>): GoPtr<FlowNode> {
  const flowNodeData = Node_FlowNodeData(node);
  if (flowNodeData !== undefined) {
    return (flowNodeData as unknown as { FlowNode?: GoPtr<FlowNode> }).FlowNode;
  }
  return undefined;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/flow.go::method::Checker.getFlowTypeOfReference","kind":"method","status":"implemented","sigHash":"bbb0f344b74a30afb8e41dda2293611e8987455aeb8b74e9fd27acc6630ae5f5","bodyHash":"38797ee1f4af3749c815a8df6f7ac317bf51b1d4b998b97d40ed325f66fc9c8f"}
 *
 * Go source:
 * func (c *Checker) getFlowTypeOfReference(reference *ast.Node, declaredType *Type) *Type {
 * 	return c.getFlowTypeOfReferenceEx(reference, declaredType, declaredType, nil, nil)
 * }
 */
export function Checker_getFlowTypeOfReference(receiver: GoPtr<Checker>, reference: GoPtr<Node>, declaredType: GoPtr<Type>): GoPtr<Type> {
  return Checker_getFlowTypeOfReferenceEx(receiver, reference, declaredType, declaredType, undefined, undefined);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/flow.go::method::Checker.getFlowTypeOfReferenceEx","kind":"method","status":"implemented","sigHash":"1c11e251cea700e81318aa61c754cd41eb053a1b9cbe28d5010d2011567e76da","bodyHash":"7360f480e39ad46701cb6ec12ad6cbfe048ae59f8c7ff3ed5199cc2bc45f849a"}
 *
 * Go source:
 * func (c *Checker) getFlowTypeOfReferenceEx(reference *ast.Node, declaredType *Type, initialType *Type, flowContainer *ast.Node, flowNode *ast.FlowNode) *Type {
 * 	if c.flowAnalysisDisabled {
 * 		return c.errorType
 * 	}
 * 	if flowNode == nil {
 * 		flowNode = getFlowNodeOfNode(reference)
 * 		if flowNode == nil {
 * 			return declaredType
 * 		}
 * 	}
 * 	f := c.getFlowState()
 * 	f.reference = reference
 * 	f.declaredType = declaredType
 * 	f.initialType = core.Coalesce(initialType, declaredType)
 * 	f.flowContainer = flowContainer
 * 	f.sharedFlowStart = len(c.sharedFlows)
 * 	c.flowInvocationCount++
 * 	evolvedType := c.getTypeAtFlowNode(f, flowNode).t
 * 	c.sharedFlows = c.sharedFlows[:f.sharedFlowStart]
 * 	c.putFlowState(f)
 * 	// When the reference is 'x' in an 'x.length', 'x.push(value)', 'x.unshift(value)' or x[n] = value' operation,
 * 	// we give type 'any[]' to 'x' instead of using the type determined by control flow analysis such that operations
 * 	// on empty arrays are possible without implicit any errors and new element types can be inferred without
 * 	// type mismatch errors.
 * 	var resultType *Type
 * 	if evolvedType.objectFlags&ObjectFlagsEvolvingArray != 0 && c.isEvolvingArrayOperationTarget(reference) {
 * 		resultType = c.autoArrayType
 * 	} else {
 * 		resultType = c.finalizeEvolvingArrayType(evolvedType)
 * 	}
 * 	if resultType == c.unreachableNeverType || reference.Parent != nil && ast.IsNonNullExpression(reference.Parent) && resultType.flags&TypeFlagsNever == 0 && c.getTypeWithFacts(resultType, TypeFactsNEUndefinedOrNull).flags&TypeFlagsNever != 0 {
 * 		return declaredType
 * 	}
 * 	return resultType
 * }
 */
export function Checker_getFlowTypeOfReferenceEx(receiver: GoPtr<Checker>, reference: GoPtr<Node>, declaredType: GoPtr<Type>, initialType: GoPtr<Type>, flowContainer: GoPtr<Node>, flowNode: GoPtr<FlowNode>): GoPtr<Type> {
  if (receiver!.flowAnalysisDisabled) {
    return receiver!.errorType;
  }
  let resolvedFlowNode = flowNode;
  if (resolvedFlowNode === undefined) {
    resolvedFlowNode = getFlowNodeOfNode(reference);
    if (resolvedFlowNode === undefined) {
      return declaredType;
    }
  }
  const f = Checker_getFlowState(receiver);
  f!.reference = reference;
  f!.declaredType = declaredType;
  f!.initialType = Coalesce(initialType, declaredType);
  f!.flowContainer = flowContainer;
  f!.sharedFlowStart = receiver!.sharedFlows.length;
  receiver!.flowInvocationCount++;
  const evolvedType = Checker_getTypeAtFlowNode(receiver, f, resolvedFlowNode).t;
  receiver!.sharedFlows.length = f!.sharedFlowStart;
  Checker_putFlowState(receiver, f);
  let resultType: GoPtr<Type>;
  if ((evolvedType!.objectFlags & ObjectFlagsEvolvingArray) !== 0 && Checker_isEvolvingArrayOperationTarget(receiver, reference)) {
    resultType = receiver!.autoArrayType;
  } else {
    resultType = Checker_finalizeEvolvingArrayType(receiver, evolvedType);
  }
  if (
    resultType === receiver!.unreachableNeverType ||
    (reference!.Parent !== undefined &&
      IsNonNullExpression(reference!.Parent) &&
      (resultType!.flags & TypeFlagsNever) === 0 &&
      (Checker_getTypeWithFacts(receiver, resultType, TypeFactsNEUndefinedOrNull)!.flags & TypeFlagsNever) !== 0)
  ) {
    return declaredType;
  }
  return resultType;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/flow.go::method::Checker.getTypeAtFlowNode","kind":"method","status":"implemented","sigHash":"55af1481b7fe5741efa3a24d52755df23309642f7d85543c347801cb017d1aa5","bodyHash":"424812b081a5a7f9594277e208a7558fa2af9ddde1c4b2f519bc22905d8a0bac"}
 *
 * Go source:
 * func (c *Checker) getTypeAtFlowNode(f *FlowState, flow *ast.FlowNode) FlowType {
 * 	if f.depth == 2000 {
 * 		// We have made 2000 recursive invocations. To avoid overflowing the call stack we report an error
 * 		// and disable further control flow analysis in the containing function or module body.
 * 		if tr := c.tracer; tr != nil {
 * 			tr.Instant(tracing.PhaseCheckTypes, "getTypeAtFlowNode_DepthLimit", map[string]any{"depth": f.depth})
 * 		}
 * 		c.flowAnalysisDisabled = true
 * 		c.reportFlowControlError(f.reference)
 * 		return FlowType{t: c.errorType}
 * 	}
 * 	f.depth++
 * 	var sharedFlow *ast.FlowNode
 * 	for {
 * 		flags := flow.Flags
 * 		if flags&ast.FlowFlagsShared != 0 {
 * 			// We cache results of flow type resolution for shared nodes that were previously visited in
 * 			// the same getFlowTypeOfReference invocation. A node is considered shared when it is the
 * 			// antecedent of more than one node.
 * 			for i := f.sharedFlowStart; i < len(c.sharedFlows); i++ {
 * 				if c.sharedFlows[i].flow == flow {
 * 					f.depth--
 * 					return c.sharedFlows[i].flowType
 * 				}
 * 			}
 * 			sharedFlow = flow
 * 		}
 * 		var t FlowType
 * 		switch {
 * 		case flags&ast.FlowFlagsAssignment != 0:
 * 			t = c.getTypeAtFlowAssignment(f, flow)
 * 			if t.isNil() {
 * 				flow = flow.Antecedent
 * 				continue
 * 			}
 * 		case flags&ast.FlowFlagsCall != 0:
 * 			t = c.getTypeAtFlowCall(f, flow)
 * 			if t.isNil() {
 * 				flow = flow.Antecedent
 * 				continue
 * 			}
 * 		case flags&ast.FlowFlagsCondition != 0:
 * 			t = c.getTypeAtFlowCondition(f, flow)
 * 		case flags&ast.FlowFlagsSwitchClause != 0:
 * 			t = c.getTypeAtSwitchClause(f, flow)
 * 		case flags&ast.FlowFlagsBranchLabel != 0:
 * 			antecedents := getBranchLabelAntecedents(flow, f.reduceLabels)
 * 			if antecedents.Next == nil {
 * 				flow = antecedents.Flow
 * 				continue
 * 			}
 * 			t = c.getTypeAtFlowBranchLabel(f, flow, antecedents)
 * 		case flags&ast.FlowFlagsLoopLabel != 0:
 * 			if flow.Antecedents.Next == nil {
 * 				flow = flow.Antecedents.Flow
 * 				continue
 * 			}
 * 			t = c.getTypeAtFlowLoopLabel(f, flow)
 * 		case flags&ast.FlowFlagsArrayMutation != 0:
 * 			t = c.getTypeAtFlowArrayMutation(f, flow)
 * 			if t.isNil() {
 * 				flow = flow.Antecedent
 * 				continue
 * 			}
 * 		case flags&ast.FlowFlagsReduceLabel != 0:
 * 			f.reduceLabels = append(f.reduceLabels, flow.Node.AsFlowReduceLabelData())
 * 			t = c.getTypeAtFlowNode(f, flow.Antecedent)
 * 			f.reduceLabels = f.reduceLabels[:len(f.reduceLabels)-1]
 * 		case flags&ast.FlowFlagsStart != 0:
 * 			// Check if we should continue with the control flow of the containing function.
 * 			container := flow.Node
 * 			if container != nil && container != f.flowContainer && !ast.IsPropertyAccessExpression(f.reference) && !ast.IsElementAccessExpression(f.reference) && !(f.reference.Kind == ast.KindThisKeyword && !ast.IsArrowFunction(container)) {
 * 				flow = container.FlowNodeData().FlowNode
 * 				continue
 * 			}
 * 			// At the top of the flow we have the initial type.
 * 			t = FlowType{t: f.initialType}
 * 		default:
 * 			// Unreachable code errors are reported in the binding phase. Here we
 * 			// simply return the non-auto declared type to reduce follow-on errors.
 * 			t = FlowType{t: c.convertAutoToAny(f.declaredType)}
 * 		}
 * 		if sharedFlow != nil {
 * 			// Record visited node and the associated type in the cache.
 * 			c.sharedFlows = append(c.sharedFlows, SharedFlow{flow: sharedFlow, flowType: t})
 * 		}
 * 		f.depth--
 * 		return t
 * 	}
 * }
 */
export function Checker_getTypeAtFlowNode(receiver: GoPtr<Checker>, f: GoPtr<FlowState>, flow: GoPtr<FlowNode>): FlowType {
  if (f!.depth === 2000) {
    if (receiver!.tracer !== undefined) {
      Tracer_Instant(receiver!.tracer, PhaseCheckTypes, "getTypeAtFlowNode_DepthLimit", new Map([["depth", f!.depth]]));
    }
    receiver!.flowAnalysisDisabled = true;
    Checker_reportFlowControlError(receiver, f!.reference);
    return { t: receiver!.errorType, incomplete: false };
  }
  f!.depth++;
  let sharedFlow: GoPtr<FlowNode> = undefined;
  let currentFlow = flow;
  for (;;) {
    const flags = currentFlow!.Flags;
    if ((flags & FlowFlagsShared) !== 0) {
      for (let i = f!.sharedFlowStart; i < receiver!.sharedFlows.length; i++) {
        if (receiver!.sharedFlows[i]!.flow === currentFlow) {
          f!.depth--;
          return receiver!.sharedFlows[i]!.flowType;
        }
      }
      sharedFlow = currentFlow;
    }
    let t: FlowType;
    if ((flags & FlowFlagsAssignment) !== 0) {
      t = Checker_getTypeAtFlowAssignment(receiver, f, currentFlow);
      if (FlowType_isNil(t)) {
        currentFlow = currentFlow!.Antecedent;
        continue;
      }
    } else if ((flags & FlowFlagsCall) !== 0) {
      t = Checker_getTypeAtFlowCall(receiver, f, currentFlow);
      if (FlowType_isNil(t)) {
        currentFlow = currentFlow!.Antecedent;
        continue;
      }
    } else if ((flags & FlowFlagsCondition) !== 0) {
      t = Checker_getTypeAtFlowCondition(receiver, f, currentFlow);
    } else if ((flags & FlowFlagsSwitchClause) !== 0) {
      t = Checker_getTypeAtSwitchClause(receiver, f, currentFlow);
    } else if ((flags & FlowFlagsBranchLabel) !== 0) {
      const antecedents = getBranchLabelAntecedents(currentFlow, f!.reduceLabels);
      if (antecedents!.Next === undefined) {
        currentFlow = antecedents!.Flow;
        continue;
      }
      t = Checker_getTypeAtFlowBranchLabel(receiver, f, currentFlow, antecedents);
    } else if ((flags & FlowFlagsLoopLabel) !== 0) {
      if (currentFlow!.Antecedents!.Next === undefined) {
        currentFlow = currentFlow!.Antecedents!.Flow;
        continue;
      }
      t = Checker_getTypeAtFlowLoopLabel(receiver, f, currentFlow);
    } else if ((flags & FlowFlagsArrayMutation) !== 0) {
      t = Checker_getTypeAtFlowArrayMutation(receiver, f, currentFlow);
      if (FlowType_isNil(t)) {
        currentFlow = currentFlow!.Antecedent;
        continue;
      }
    } else if ((flags & FlowFlagsReduceLabel) !== 0) {
      f!.reduceLabels ??= [];
      f!.reduceLabels.push(Node_AsFlowReduceLabelData(currentFlow!.Node));
      t = Checker_getTypeAtFlowNode(receiver, f, currentFlow!.Antecedent);
      f!.reduceLabels.pop();
    } else if ((flags & FlowFlagsStart) !== 0) {
      const container = currentFlow!.Node;
      if (
        container !== undefined &&
        container !== f!.flowContainer &&
        !IsPropertyAccessExpression(f!.reference) &&
        !IsElementAccessExpression(f!.reference) &&
        !(f!.reference!.Kind === KindThisKeyword && !IsArrowFunction(container))
      ) {
        currentFlow = (Node_FlowNodeData(container) as unknown as { FlowNode?: GoPtr<FlowNode> })!.FlowNode;
        continue;
      }
      t = { t: f!.initialType, incomplete: false };
    } else {
      t = { t: Checker_convertAutoToAny(receiver, f!.declaredType), incomplete: false };
    }
    if (sharedFlow !== undefined) {
      receiver!.sharedFlows.push({ flow: sharedFlow, flowType: t });
    }
    f!.depth--;
    return t;
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/flow.go::func::getBranchLabelAntecedents","kind":"func","status":"implemented","sigHash":"ef9d439f0957db69ce555e3c2da88307382234f35786c61d56c8c8b77d2187d8","bodyHash":"53fcf9ec39bf05c4bb099c5086bfe5f6c62518d57ee811061efa0356bc1a6f7e"}
 *
 * Go source:
 * func getBranchLabelAntecedents(flow *ast.FlowNode, reduceLabels []*ast.FlowReduceLabelData) *ast.FlowList {
 * 	i := len(reduceLabels)
 * 	for i != 0 {
 * 		i--
 * 		data := reduceLabels[i]
 * 		if data.Target == flow {
 * 			return data.Antecedents
 * 		}
 * 	}
 * 	return flow.Antecedents
 * }
 */
export function getBranchLabelAntecedents(flow: GoPtr<FlowNode>, reduceLabels: GoPtr<GoSlice<GoPtr<FlowReduceLabelData>>>): GoPtr<FlowList> {
  let i = reduceLabels?.length ?? 0;
  while (i !== 0) {
    i--;
    const data = reduceLabels![i];
    if (data!.Target === flow) {
      return data!.Antecedents;
    }
  }
  return flow!.Antecedents;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/flow.go::method::Checker.getTypeAtFlowAssignment","kind":"method","status":"implemented","sigHash":"b626c91fb7d62abb74aa665a7ff59642f9204ca5b044cc7dc68fcc4975097c43","bodyHash":"734ba0ea054bb2f51989f4eb204752e231e0e6182c43c41cd2d0ab8f02582599"}
 *
 * Go source:
 * func (c *Checker) getTypeAtFlowAssignment(f *FlowState, flow *ast.FlowNode) FlowType {
 * 	node := flow.Node
 * 	// Assignments only narrow the computed type if the declared type is a union type. Thus, we
 * 	// only need to evaluate the assigned type if the declared type is a union type.
 * 	if c.isMatchingReference(f.reference, node) {
 * 		if !c.isReachableFlowNode(flow) {
 * 			return FlowType{t: c.unreachableNeverType}
 * 		}
 * 		if getAssignmentTargetKind(node) == AssignmentKindCompound {
 * 			flowType := c.getTypeAtFlowNode(f, flow.Antecedent)
 * 			return c.newFlowType(c.getBaseTypeOfLiteralType(flowType.t), flowType.incomplete)
 * 		}
 * 		if f.declaredType == c.autoType || f.declaredType == c.autoArrayType {
 * 			if c.isEmptyArrayAssignment(node) {
 * 				return FlowType{t: c.getEvolvingArrayType(c.neverType)}
 * 			}
 * 			assignedType := c.getWidenedLiteralType(c.getInitialOrAssignedType(f, flow))
 * 			if c.isTypeAssignableTo(assignedType, f.declaredType) {
 * 				return FlowType{t: assignedType}
 * 			}
 * 			return FlowType{t: c.anyArrayType}
 * 		}
 * 		t := f.declaredType
 * 		if isInCompoundLikeAssignment(node) {
 * 			t = c.getBaseTypeOfLiteralType(t)
 * 		}
 * 		if t.flags&TypeFlagsUnion != 0 {
 * 			return FlowType{t: c.getAssignmentReducedType(t, c.getInitialOrAssignedType(f, flow))}
 * 		}
 * 		return FlowType{t: t}
 * 	}
 * 	// We didn't have a direct match. However, if the reference is a dotted name, this
 * 	// may be an assignment to a left hand part of the reference. For example, for a
 * 	// reference 'x.y.z', we may be at an assignment to 'x.y' or 'x'. In that case,
 * 	// return the declared type.
 * 	if c.containsMatchingReference(f.reference, node) {
 * 		if !c.isReachableFlowNode(flow) {
 * 			return FlowType{t: c.unreachableNeverType}
 * 		}
 * 		// A matching dotted name might also be an expando property on a function *expression*,
 * 		// in which case we continue control flow analysis back to the function's declaration
 * 		if ast.IsVariableDeclaration(node) && (ast.IsInJSFile(node) || ast.IsVarConstLike(node)) {
 * 			if init := node.Initializer(); init != nil && ast.IsFunctionExpressionOrArrowFunction(init) {
 * 				return c.getTypeAtFlowNode(f, flow.Antecedent)
 * 			}
 * 		}
 * 		return FlowType{t: f.declaredType}
 * 	}
 * 	// for (const _ in ref) acts as a nonnull on ref
 * 	if ast.IsVariableDeclaration(node) && ast.IsForInStatement(node.Parent.Parent) && (c.isMatchingReference(f.reference, node.Parent.Parent.Expression()) || c.optionalChainContainsReference(node.Parent.Parent.Expression(), f.reference)) {
 * 		return FlowType{t: c.getNonNullableTypeIfNeeded(c.finalizeEvolvingArrayType(c.getTypeAtFlowNode(f, flow.Antecedent).t))}
 * 	}
 * 	// Assignment doesn't affect reference
 * 	return FlowType{}
 * }
 */
export function Checker_getTypeAtFlowAssignment(receiver: GoPtr<Checker>, f: GoPtr<FlowState>, flow: GoPtr<FlowNode>): FlowType {
  const node = flow!.Node;
  if (Checker_isMatchingReference(receiver, f!.reference, node)) {
    if (!Checker_isReachableFlowNode(receiver, flow)) {
      return { t: receiver!.unreachableNeverType, incomplete: false };
    }
    if (getAssignmentTargetKind(node) === AssignmentKindCompound) {
      const flowType = Checker_getTypeAtFlowNode(receiver, f, flow!.Antecedent);
      return Checker_newFlowType(receiver, Checker_getBaseTypeOfLiteralType(receiver, flowType.t), flowType.incomplete);
    }
    if (f!.declaredType === receiver!.autoType || f!.declaredType === receiver!.autoArrayType) {
      if (Checker_isEmptyArrayAssignment(receiver, node)) {
        return { t: Checker_getEvolvingArrayType(receiver, receiver!.neverType), incomplete: false };
      }
      const assignedType = Checker_getWidenedLiteralType(receiver, Checker_getInitialOrAssignedType(receiver, f, flow));
      if (Checker_isTypeAssignableTo(receiver, assignedType, f!.declaredType)) {
        return { t: assignedType, incomplete: false };
      }
      return { t: receiver!.anyArrayType, incomplete: false };
    }
    let t = f!.declaredType;
    if (isInCompoundLikeAssignment(node)) {
      t = Checker_getBaseTypeOfLiteralType(receiver, t);
    }
    if ((t!.flags & TypeFlagsUnion) !== 0) {
      return { t: Checker_getAssignmentReducedType(receiver, t, Checker_getInitialOrAssignedType(receiver, f, flow)), incomplete: false };
    }
    return { t: t, incomplete: false };
  }
  if (Checker_containsMatchingReference(receiver, f!.reference, node)) {
    if (!Checker_isReachableFlowNode(receiver, flow)) {
      return { t: receiver!.unreachableNeverType, incomplete: false };
    }
    // A matching dotted name might also be an expando property on a function *expression*,
    // in which case we continue control flow analysis back to the function's declaration
    if (IsVariableDeclaration(node) && (IsInJSFile(node) || IsVarConstLike(node))) {
      const init = Node_Initializer(node);
      if (init !== undefined && IsFunctionExpressionOrArrowFunction(init)) {
        return Checker_getTypeAtFlowNode(receiver, f, flow!.Antecedent);
      }
    }
    return { t: f!.declaredType, incomplete: false };
  }
  if (
    IsVariableDeclaration(node) &&
    IsForInStatement(node!.Parent!.Parent) &&
    (Checker_isMatchingReference(receiver, f!.reference, Node_Expression(node!.Parent!.Parent)) ||
      Checker_optionalChainContainsReference(receiver, Node_Expression(node!.Parent!.Parent), f!.reference))
  ) {
    return { t: Checker_getNonNullableTypeIfNeeded(receiver, Checker_finalizeEvolvingArrayType(receiver, Checker_getTypeAtFlowNode(receiver, f, flow!.Antecedent).t)), incomplete: false };
  }
  return { t: undefined, incomplete: false };
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/flow.go::method::Checker.getInitialOrAssignedType","kind":"method","status":"implemented","sigHash":"7e5c40ea9d895dbed70ef4a28e2f53f65831eb66a573c14f90abde723f8891a5","bodyHash":"8fc666a799b4edb329b47ad7b1a8e3b0764de907d66e7b02d62fe9be3d065df8"}
 *
 * Go source:
 * func (c *Checker) getInitialOrAssignedType(f *FlowState, flow *ast.FlowNode) *Type {
 * 	if ast.IsVariableDeclaration(flow.Node) || ast.IsBindingElement(flow.Node) {
 * 		return c.getNarrowableTypeForReference(c.getInitialType(flow.Node), f.reference, CheckModeNormal)
 * 	}
 * 	return c.getNarrowableTypeForReference(c.getAssignedType(flow.Node), f.reference, CheckModeNormal)
 * }
 */
export function Checker_getInitialOrAssignedType(receiver: GoPtr<Checker>, f: GoPtr<FlowState>, flow: GoPtr<FlowNode>): GoPtr<Type> {
  if (IsVariableDeclaration(flow!.Node) || IsBindingElement(flow!.Node)) {
    return Checker_getNarrowableTypeForReference(receiver, Checker_getInitialType(receiver, flow!.Node), f!.reference, CheckModeNormal);
  }
  return Checker_getNarrowableTypeForReference(receiver, Checker_getAssignedType(receiver, flow!.Node), f!.reference, CheckModeNormal);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/flow.go::method::Checker.isEmptyArrayAssignment","kind":"method","status":"implemented","sigHash":"ec118b393bca9a47e21850dcf9894263f24da28584d48f5fd0d97e298d5c0281","bodyHash":"7167667ae824660c82363bd17b39f02032692403f10dde3993f425ab5a5a47ac"}
 *
 * Go source:
 * func (c *Checker) isEmptyArrayAssignment(node *ast.Node) bool {
 * 	return ast.IsVariableDeclaration(node) && node.Initializer() != nil && isEmptyArrayLiteral(node.Initializer()) ||
 * 		!ast.IsBindingElement(node) && ast.IsBinaryExpression(node.Parent) && isEmptyArrayLiteral(node.Parent.AsBinaryExpression().Right)
 * }
 */
export function Checker_isEmptyArrayAssignment(receiver: GoPtr<Checker>, node: GoPtr<Node>): bool {
  return (
    (IsVariableDeclaration(node) && Node_Initializer(node) !== undefined && isEmptyArrayLiteral(Node_Initializer(node))) ||
    (!IsBindingElement(node) && IsBinaryExpression(node!.Parent) && isEmptyArrayLiteral(AsBinaryExpression(node!.Parent)!.Right))
  );
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/flow.go::method::Checker.getTypeAtFlowCall","kind":"method","status":"implemented","sigHash":"2486993576a879dcf8c6d85ce44190e7da20a8bc6255c1b59d3cabad5509c36a","bodyHash":"56552bab8eadc7553ff56fd3138ded333931a5453c36b157287fbadb9829d55f"}
 *
 * Go source:
 * func (c *Checker) getTypeAtFlowCall(f *FlowState, flow *ast.FlowNode) FlowType {
 * 	signature := c.getEffectsSignature(flow.Node)
 * 	if signature != nil {
 * 		predicate := c.getTypePredicateOfSignature(signature)
 * 		if predicate != nil && (predicate.kind == TypePredicateKindAssertsThis || predicate.kind == TypePredicateKindAssertsIdentifier) {
 * 			flowType := c.getTypeAtFlowNode(f, flow.Antecedent)
 * 			t := c.finalizeEvolvingArrayType(flowType.t)
 * 			var narrowedType *Type
 * 			switch {
 * 			case predicate.t != nil:
 * 				narrowedType = c.narrowTypeByTypePredicate(f, t, predicate, flow.Node, true /*assumeTrue* /)
 * 			case predicate.kind == TypePredicateKindAssertsIdentifier && predicate.parameterIndex >= 0 && int(predicate.parameterIndex) < len(flow.Node.Arguments()):
 * 				narrowedType = c.narrowTypeByAssertion(f, t, flow.Node.Arguments()[predicate.parameterIndex])
 * 			default:
 * 				narrowedType = t
 * 			}
 * 			if narrowedType == t {
 * 				return flowType
 * 			}
 * 			return c.newFlowType(narrowedType, flowType.incomplete)
 * 		}
 * 		if c.getReturnTypeOfSignature(signature).flags&TypeFlagsNever != 0 {
 * 			return FlowType{t: c.unreachableNeverType}
 * 		}
 * 	}
 * 	return FlowType{}
 * }
 */
export function Checker_getTypeAtFlowCall(receiver: GoPtr<Checker>, f: GoPtr<FlowState>, flow: GoPtr<FlowNode>): FlowType {
  const signature = Checker_getEffectsSignature(receiver, flow!.Node);
  if (signature !== undefined) {
    const predicate = Checker_getTypePredicateOfSignature(receiver, signature);
    if (predicate !== undefined && (predicate!.kind === TypePredicateKindAssertsThis || predicate!.kind === TypePredicateKindAssertsIdentifier)) {
      const flowType = Checker_getTypeAtFlowNode(receiver, f, flow!.Antecedent);
      const t = Checker_finalizeEvolvingArrayType(receiver, flowType.t);
      let narrowedType: GoPtr<Type>;
      if (predicate!.t !== undefined) {
        narrowedType = Checker_narrowTypeByTypePredicate(receiver, f, t, predicate, flow!.Node, true);
      } else if (predicate!.kind === TypePredicateKindAssertsIdentifier && predicate!.parameterIndex >= 0 && predicate!.parameterIndex < Node_Arguments(flow!.Node)!.length) {
        narrowedType = Checker_narrowTypeByAssertion(receiver, f, t, Node_Arguments(flow!.Node)![predicate!.parameterIndex]);
      } else {
        narrowedType = t;
      }
      if (narrowedType === t) {
        return flowType;
      }
      return Checker_newFlowType(receiver, narrowedType, flowType.incomplete);
    }
    if ((Checker_getReturnTypeOfSignature(receiver, signature)!.flags & TypeFlagsNever) !== 0) {
      return { t: receiver!.unreachableNeverType, incomplete: false };
    }
  }
  return { t: undefined, incomplete: false };
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/flow.go::method::Checker.narrowTypeByTypePredicate","kind":"method","status":"implemented","sigHash":"557196706086033223b3f2dd4c4cecf8b8e57e74ed39db8e36a46c22cbd5b59b","bodyHash":"a98e89dd32caa69a3bdc3f28f7c12df621194c977c673e3731ac4741f5f69941"}
 *
 * Go source:
 * func (c *Checker) narrowTypeByTypePredicate(f *FlowState, t *Type, predicate *TypePredicate, callExpression *ast.Node, assumeTrue bool) *Type {
 * 	// Don't narrow from 'any' if the predicate type is exactly 'Object' or 'Function'
 * 	if predicate.t != nil && !(IsTypeAny(t) && (predicate.t == c.globalObjectType || predicate.t == c.globalFunctionType)) {
 * 		predicateArgument := c.getTypePredicateArgument(predicate, callExpression)
 * 		if predicateArgument != nil {
 * 			if c.isMatchingReference(f.reference, predicateArgument) {
 * 				return c.getNarrowedType(t, predicate.t, assumeTrue, false /*checkDerived* /)
 * 			}
 * 			if c.strictNullChecks && c.optionalChainContainsReference(predicateArgument, f.reference) && (assumeTrue && !c.hasTypeFacts(predicate.t, TypeFactsEQUndefined) || !assumeTrue && everyType(predicate.t, c.IsNullableType)) {
 * 				t = c.getAdjustedTypeWithFacts(t, TypeFactsNEUndefinedOrNull)
 * 			}
 * 			access := c.getDiscriminantPropertyAccess(f, predicateArgument, t)
 * 			if access != nil {
 * 				return c.narrowTypeByDiscriminant(t, access, func(t *Type) *Type {
 * 					return c.getNarrowedType(t, predicate.t, assumeTrue, false /*checkDerived* /)
 * 				})
 * 			}
 * 		}
 * 	}
 * 	return t
 * }
 */
export function Checker_narrowTypeByTypePredicate(receiver: GoPtr<Checker>, f: GoPtr<FlowState>, t: GoPtr<Type>, predicate: GoPtr<TypePredicate>, callExpression: GoPtr<Node>, assumeTrue: bool): GoPtr<Type> {
  if (predicate!.t !== undefined && !(IsTypeAny(t) && (predicate!.t === receiver!.globalObjectType || predicate!.t === receiver!.globalFunctionType))) {
    const predicateArgument = Checker_getTypePredicateArgument(receiver, predicate, callExpression);
    if (predicateArgument !== undefined) {
      if (Checker_isMatchingReference(receiver, f!.reference, predicateArgument)) {
        return Checker_getNarrowedType(receiver, t, predicate!.t, assumeTrue, false);
      }
      let localT = t;
      if (
        receiver!.strictNullChecks &&
        Checker_optionalChainContainsReference(receiver, predicateArgument, f!.reference) &&
        (
          (assumeTrue && !Checker_hasTypeFacts(receiver, predicate!.t, TypeFactsEQUndefined)) ||
          (!assumeTrue && everyType(predicate!.t, (x) => Checker_IsNullableType(receiver, x)))
        )
      ) {
        localT = Checker_getAdjustedTypeWithFacts(receiver, localT, TypeFactsNEUndefinedOrNull);
      }
      const access = Checker_getDiscriminantPropertyAccess(receiver, f, predicateArgument, localT);
      if (access !== undefined) {
        return Checker_narrowTypeByDiscriminant(receiver, localT, access, (innerT) => Checker_getNarrowedType(receiver, innerT, predicate!.t, assumeTrue, false));
      }
      return localT;
    }
  }
  return t;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/flow.go::method::Checker.narrowTypeByAssertion","kind":"method","status":"implemented","sigHash":"bc8f74fe1e189c145babfe309089c44158c7ae744dd3367d1b747ee3dc1f9975","bodyHash":"e0121e3ab37c737ac3be8b3db2dad409df7876e0d792faa9920c489148351d49"}
 *
 * Go source:
 * func (c *Checker) narrowTypeByAssertion(f *FlowState, t *Type, expr *ast.Node) *Type {
 * 	node := ast.SkipParentheses(expr)
 * 	if node.Kind == ast.KindFalseKeyword {
 * 		return c.unreachableNeverType
 * 	}
 * 	if node.Kind == ast.KindBinaryExpression {
 * 		if node.AsBinaryExpression().OperatorToken.Kind == ast.KindAmpersandAmpersandToken {
 * 			return c.narrowTypeByAssertion(f, c.narrowTypeByAssertion(f, t, node.AsBinaryExpression().Left), node.AsBinaryExpression().Right)
 * 		}
 * 		if node.AsBinaryExpression().OperatorToken.Kind == ast.KindBarBarToken {
 * 			return c.getUnionType([]*Type{c.narrowTypeByAssertion(f, t, node.AsBinaryExpression().Left), c.narrowTypeByAssertion(f, t, node.AsBinaryExpression().Right)})
 * 		}
 * 	}
 * 	return c.narrowType(f, t, node, true /*assumeTrue* /)
 * }
 */
export function Checker_narrowTypeByAssertion(receiver: GoPtr<Checker>, f: GoPtr<FlowState>, t: GoPtr<Type>, expr: GoPtr<Node>): GoPtr<Type> {
  const node = SkipParentheses(expr);
  if (node!.Kind === KindFalseKeyword) {
    return receiver!.unreachableNeverType;
  }
  if (node!.Kind === KindBinaryExpression) {
    const bin = AsBinaryExpression(node);
    if (bin!.OperatorToken!.Kind === KindAmpersandAmpersandToken) {
      return Checker_narrowTypeByAssertion(receiver, f, Checker_narrowTypeByAssertion(receiver, f, t, bin!.Left), bin!.Right);
    }
    if (bin!.OperatorToken!.Kind === KindBarBarToken) {
      return Checker_getUnionType(receiver, [Checker_narrowTypeByAssertion(receiver, f, t, bin!.Left), Checker_narrowTypeByAssertion(receiver, f, t, bin!.Right)]);
    }
  }
  return Checker_narrowType(receiver, f, t, node, true);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/flow.go::method::Checker.getTypeAtFlowCondition","kind":"method","status":"implemented","sigHash":"1f1a34e69429579fa90eeb586e4ef2d8220a89a4492b3a465b1ce6fdb41cb5b3","bodyHash":"a23c49b7287b3163ade9234bb9172b5ac0c8dddfcba729be609626e2596c354d"}
 *
 * Go source:
 * func (c *Checker) getTypeAtFlowCondition(f *FlowState, flow *ast.FlowNode) FlowType {
 * 	flowType := c.getTypeAtFlowNode(f, flow.Antecedent)
 * 	if flowType.t.flags&TypeFlagsNever != 0 {
 * 		return flowType
 * 	}
 * 	// If we have an antecedent type (meaning we're reachable in some way), we first
 * 	// attempt to narrow the antecedent type. If that produces the never type, and if
 * 	// the antecedent type is incomplete (i.e. a transient type in a loop), then we
 * 	// take the type guard as an indication that control *could* reach here once we
 * 	// have the complete type. We proceed by switching to the silent never type which
 * 	// doesn't report errors when operators are applied to it. Note that this is the
 * 	// *only* place a silent never type is ever generated.
 * 	assumeTrue := flow.Flags&ast.FlowFlagsTrueCondition != 0
 * 	nonEvolvingType := c.finalizeEvolvingArrayType(flowType.t)
 * 	narrowedType := c.narrowType(f, nonEvolvingType, flow.Node, assumeTrue)
 * 	if narrowedType == nonEvolvingType {
 * 		return flowType
 * 	}
 * 	return c.newFlowType(narrowedType, flowType.incomplete)
 * }
 */
export function Checker_getTypeAtFlowCondition(receiver: GoPtr<Checker>, f: GoPtr<FlowState>, flow: GoPtr<FlowNode>): FlowType {
  const flowType = Checker_getTypeAtFlowNode(receiver, f, flow!.Antecedent);
  if ((flowType.t!.flags & TypeFlagsNever) !== 0) {
    return flowType;
  }
  const assumeTrue = (flow!.Flags & FlowFlagsTrueCondition) !== 0;
  const nonEvolvingType = Checker_finalizeEvolvingArrayType(receiver, flowType.t);
  const narrowedType = Checker_narrowType(receiver, f, nonEvolvingType, flow!.Node, assumeTrue);
  if (narrowedType === nonEvolvingType) {
    return flowType;
  }
  return Checker_newFlowType(receiver, narrowedType, flowType.incomplete);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/flow.go::method::Checker.narrowType","kind":"method","status":"implemented","sigHash":"cd99dc4aecbace4d6243cedf9f493bd693d2a2e1000b2060024232755647452d","bodyHash":"5f7abd26da5cbcaf57dc4edf14d381bf49020a65f63132b1402841fa2396699a"}
 *
 * Go source:
 * func (c *Checker) narrowType(f *FlowState, t *Type, expr *ast.Node, assumeTrue bool) *Type {
 * 	// for `a?.b`, we emulate a synthetic `a !== null && a !== undefined` condition for `a`
 * 	if ast.IsExpressionOfOptionalChainRoot(expr) || ast.IsBinaryExpression(expr.Parent) && (expr.Parent.AsBinaryExpression().OperatorToken.Kind == ast.KindQuestionQuestionToken || expr.Parent.AsBinaryExpression().OperatorToken.Kind == ast.KindQuestionQuestionEqualsToken) && expr.Parent.AsBinaryExpression().Left == expr {
 * 		return c.narrowTypeByOptionality(f, t, expr, assumeTrue)
 * 	}
 * 	switch expr.Kind {
 * 	case ast.KindIdentifier:
 * 		// When narrowing a reference to a const variable, non-assigned parameter, or readonly property, we inline
 * 		// up to five levels of aliased conditional expressions that are themselves declared as const variables.
 * 		if !c.isMatchingReference(f.reference, expr) && c.inlineLevel < 5 {
 * 			symbol := c.getResolvedSymbol(expr)
 * 			if c.isConstantVariable(symbol) {
 * 				declaration := symbol.ValueDeclaration
 * 				if declaration != nil && ast.IsVariableDeclaration(declaration) && declaration.Type() == nil && declaration.Initializer() != nil && c.isConstantReference(f.reference) {
 * 					c.inlineLevel++
 * 					result := c.narrowType(f, t, declaration.Initializer(), assumeTrue)
 * 					c.inlineLevel--
 * 					return result
 * 				}
 * 			}
 * 		}
 * 		fallthrough
 * 	case ast.KindThisKeyword, ast.KindSuperKeyword, ast.KindPropertyAccessExpression, ast.KindElementAccessExpression:
 * 		return c.narrowTypeByTruthiness(f, t, expr, assumeTrue)
 * 	case ast.KindCallExpression:
 * 		return c.narrowTypeByCallExpression(f, t, expr, assumeTrue)
 * 	case ast.KindParenthesizedExpression, ast.KindNonNullExpression, ast.KindSatisfiesExpression:
 * 		return c.narrowType(f, t, expr.Expression(), assumeTrue)
 * 	case ast.KindBinaryExpression:
 * 		return c.narrowTypeByBinaryExpression(f, t, expr.AsBinaryExpression(), assumeTrue)
 * 	case ast.KindPrefixUnaryExpression:
 * 		if expr.AsPrefixUnaryExpression().Operator == ast.KindExclamationToken {
 * 			return c.narrowType(f, t, expr.AsPrefixUnaryExpression().Operand, !assumeTrue)
 * 		}
 * 	}
 * 	return t
 * }
 */
export function Checker_narrowType(receiver: GoPtr<Checker>, f: GoPtr<FlowState>, t: GoPtr<Type>, expr: GoPtr<Node>, assumeTrue: bool): GoPtr<Type> {
  if (
    IsExpressionOfOptionalChainRoot(expr) ||
    (IsBinaryExpression(expr!.Parent) &&
      (AsBinaryExpression(expr!.Parent)!.OperatorToken!.Kind === KindQuestionQuestionToken ||
        AsBinaryExpression(expr!.Parent)!.OperatorToken!.Kind === KindQuestionQuestionEqualsToken) &&
      AsBinaryExpression(expr!.Parent)!.Left === expr)
  ) {
    return Checker_narrowTypeByOptionality(receiver, f, t, expr, assumeTrue);
  }
  switch (expr!.Kind) {
    case KindIdentifier: {
      if (!Checker_isMatchingReference(receiver, f!.reference, expr) && receiver!.inlineLevel < 5) {
        const symbol = Checker_getResolvedSymbol(receiver, expr);
        if (Checker_isConstantVariable(receiver, symbol)) {
          const declaration = symbol!.ValueDeclaration;
          if (
            declaration !== undefined &&
            IsVariableDeclaration(declaration) &&
            Node_Type(declaration) === undefined &&
            Node_Initializer(declaration) !== undefined &&
            Checker_isConstantReference(receiver, f!.reference)
          ) {
            receiver!.inlineLevel++;
            const result = Checker_narrowType(receiver, f, t, Node_Initializer(declaration), assumeTrue);
            receiver!.inlineLevel--;
            return result;
          }
        }
      }
      // fallthrough to truthiness
      return Checker_narrowTypeByTruthiness(receiver, f, t, expr, assumeTrue);
    }
    case KindThisKeyword:
    case KindSuperKeyword:
    case KindPropertyAccessExpression:
    case KindElementAccessExpression:
      return Checker_narrowTypeByTruthiness(receiver, f, t, expr, assumeTrue);
    case KindCallExpression:
      return Checker_narrowTypeByCallExpression(receiver, f, t, expr, assumeTrue);
    case KindParenthesizedExpression:
    case KindNonNullExpression:
    case KindSatisfiesExpression:
      return Checker_narrowType(receiver, f, t, Node_Expression(expr), assumeTrue);
    case KindBinaryExpression:
      return Checker_narrowTypeByBinaryExpression(receiver, f, t, AsBinaryExpression(expr), assumeTrue);
    case KindPrefixUnaryExpression: {
      const prefix = AsPrefixUnaryExpression(expr);
      if (prefix!.Operator === KindExclamationToken) {
        return Checker_narrowType(receiver, f, t, prefix!.Operand, !assumeTrue);
      }
      break;
    }
  }
  return t;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/flow.go::method::Checker.narrowTypeByOptionality","kind":"method","status":"implemented","sigHash":"1506c5d24287925fc34ebfc9d08ea74deb1571a213389e7c7b456fe450ae1b94","bodyHash":"283e98e4f2ce714b52b29aeb56814d48f0aa6a8967626bdcafe89f08f8eb8265"}
 *
 * Go source:
 * func (c *Checker) narrowTypeByOptionality(f *FlowState, t *Type, expr *ast.Node, assumePresent bool) *Type {
 * 	if c.isMatchingReference(f.reference, expr) {
 * 		return c.getAdjustedTypeWithFacts(t, core.IfElse(assumePresent, TypeFactsNEUndefinedOrNull, TypeFactsEQUndefinedOrNull))
 * 	}
 * 	access := c.getDiscriminantPropertyAccess(f, expr, t)
 * 	if access != nil {
 * 		return c.narrowTypeByDiscriminant(t, access, func(t *Type) *Type {
 * 			return c.getTypeWithFacts(t, core.IfElse(assumePresent, TypeFactsNEUndefinedOrNull, TypeFactsEQUndefinedOrNull))
 * 		})
 * 	}
 * 	return t
 * }
 */
export function Checker_narrowTypeByOptionality(receiver: GoPtr<Checker>, f: GoPtr<FlowState>, t: GoPtr<Type>, expr: GoPtr<Node>, assumePresent: bool): GoPtr<Type> {
  if (Checker_isMatchingReference(receiver, f!.reference, expr)) {
    return Checker_getAdjustedTypeWithFacts(receiver, t, IfElse(assumePresent, TypeFactsNEUndefinedOrNull, TypeFactsEQUndefinedOrNull));
  }
  const access = Checker_getDiscriminantPropertyAccess(receiver, f, expr, t);
  if (access !== undefined) {
    return Checker_narrowTypeByDiscriminant(receiver, t, access, (innerT) =>
      Checker_getTypeWithFacts(receiver, innerT, IfElse(assumePresent, TypeFactsNEUndefinedOrNull, TypeFactsEQUndefinedOrNull))
    );
  }
  return t;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/flow.go::method::Checker.narrowTypeByTruthiness","kind":"method","status":"implemented","sigHash":"eaf5b33824fae43eeff53b6131e0037e38604cbb4301805914526cb516dd1488","bodyHash":"055bfe29b9446f4776142649690489d04e645a2c477738c5c14cbde797681483"}
 *
 * Go source:
 * func (c *Checker) narrowTypeByTruthiness(f *FlowState, t *Type, expr *ast.Node, assumeTrue bool) *Type {
 * 	if c.isMatchingReference(f.reference, expr) {
 * 		return c.getAdjustedTypeWithFacts(t, core.IfElse(assumeTrue, TypeFactsTruthy, TypeFactsFalsy))
 * 	}
 * 	if c.strictNullChecks && assumeTrue && c.optionalChainContainsReference(expr, f.reference) {
 * 		t = c.getAdjustedTypeWithFacts(t, TypeFactsNEUndefinedOrNull)
 * 	}
 * 	access := c.getDiscriminantPropertyAccess(f, expr, t)
 * 	if access != nil {
 * 		return c.narrowTypeByDiscriminant(t, access, func(t *Type) *Type {
 * 			return c.getTypeWithFacts(t, core.IfElse(assumeTrue, TypeFactsTruthy, TypeFactsFalsy))
 * 		})
 * 	}
 * 	return t
 * }
 */
export function Checker_narrowTypeByTruthiness(receiver: GoPtr<Checker>, f: GoPtr<FlowState>, t: GoPtr<Type>, expr: GoPtr<Node>, assumeTrue: bool): GoPtr<Type> {
  if (Checker_isMatchingReference(receiver, f!.reference, expr)) {
    return Checker_getAdjustedTypeWithFacts(receiver, t, IfElse(assumeTrue, TypeFactsTruthy, TypeFactsFalsy));
  }
  let localT = t;
  if (receiver!.strictNullChecks && assumeTrue && Checker_optionalChainContainsReference(receiver, expr, f!.reference)) {
    localT = Checker_getAdjustedTypeWithFacts(receiver, localT, TypeFactsNEUndefinedOrNull);
  }
  const access = Checker_getDiscriminantPropertyAccess(receiver, f, expr, localT);
  if (access !== undefined) {
    return Checker_narrowTypeByDiscriminant(receiver, localT, access, (innerT) =>
      Checker_getTypeWithFacts(receiver, innerT, IfElse(assumeTrue, TypeFactsTruthy, TypeFactsFalsy))
    );
  }
  return localT;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/flow.go::method::Checker.narrowTypeByCallExpression","kind":"method","status":"implemented","sigHash":"007e34ca9ff50fa2a9fde12a5b76981360041d65164efaf52902244259c79816","bodyHash":"7349cd95a6af7ada15559f5195a1495e7de3a5bf8fff6ae3fc2573081f291cdc"}
 *
 * Go source:
 * func (c *Checker) narrowTypeByCallExpression(f *FlowState, t *Type, callExpression *ast.Node, assumeTrue bool) *Type {
 * 	if c.hasMatchingArgument(callExpression, f.reference) {
 * 		var predicate *TypePredicate
 * 		if assumeTrue || !isCallChain(callExpression) {
 * 			signature := c.getEffectsSignature(callExpression)
 * 			if signature != nil {
 * 				predicate = c.getTypePredicateOfSignature(signature)
 * 			}
 * 		}
 * 		if predicate != nil && (predicate.kind == TypePredicateKindThis || predicate.kind == TypePredicateKindIdentifier) {
 * 			return c.narrowTypeByTypePredicate(f, t, predicate, callExpression, assumeTrue)
 * 		}
 * 	}
 * 	if c.containsMissingType(t) && ast.IsAccessExpression(f.reference) && ast.IsPropertyAccessExpression(callExpression.Expression()) {
 * 		callAccess := callExpression.Expression()
 * 		if c.isMatchingReference(f.reference.Expression(), c.getReferenceCandidate(callAccess.Expression())) && ast.IsIdentifier(callAccess.Name()) && callAccess.Name().Text() == "hasOwnProperty" && len(callExpression.Arguments()) == 1 {
 * 			argument := callExpression.Arguments()[0]
 * 			if accessedName, ok := c.getAccessedPropertyName(f.reference); ok && ast.IsStringLiteralLike(argument) && accessedName == argument.Text() {
 * 				return c.getTypeWithFacts(t, core.IfElse(assumeTrue, TypeFactsNEUndefined, TypeFactsEQUndefined))
 * 			}
 * 		}
 * 	}
 * 	return t
 * }
 */
export function Checker_narrowTypeByCallExpression(receiver: GoPtr<Checker>, f: GoPtr<FlowState>, t: GoPtr<Type>, callExpression: GoPtr<Node>, assumeTrue: bool): GoPtr<Type> {
  if (Checker_hasMatchingArgument(receiver, callExpression, f!.reference)) {
    let predicate: GoPtr<TypePredicate> = undefined;
    if (assumeTrue || !isCallChain(callExpression)) {
      const signature = Checker_getEffectsSignature(receiver, callExpression);
      if (signature !== undefined) {
        predicate = Checker_getTypePredicateOfSignature(receiver, signature);
      }
    }
    if (predicate !== undefined && (predicate!.kind === TypePredicateKindThis || predicate!.kind === TypePredicateKindIdentifier)) {
      return Checker_narrowTypeByTypePredicate(receiver, f, t, predicate, callExpression, assumeTrue);
    }
  }
  if (receiver!.containsMissingType(t) && IsAccessExpression(f!.reference) && IsPropertyAccessExpression(Node_Expression(callExpression))) {
    const callAccess = Node_Expression(callExpression);
    if (
      Checker_isMatchingReference(receiver, Node_Expression(f!.reference), Checker_getReferenceCandidate(receiver, Node_Expression(callAccess))) &&
      IsIdentifier(Node_Name(callAccess)) &&
      Node_Text(Node_Name(callAccess)) === "hasOwnProperty" &&
      Node_Arguments(callExpression)!.length === 1
    ) {
      const argument = Node_Arguments(callExpression)![0];
      const [accessedName, ok] = Checker_getAccessedPropertyName(receiver, f!.reference);
      if (ok && IsStringLiteralLike(argument) && accessedName === Node_Text(argument)) {
        return Checker_getTypeWithFacts(receiver, t, IfElse(assumeTrue, TypeFactsNEUndefined, TypeFactsEQUndefined));
      }
    }
  }
  return t;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/flow.go::method::Checker.narrowTypeByBinaryExpression","kind":"method","status":"implemented","sigHash":"45987e8902856537bead5d1ae2dd62ec4acb914b2cdb37615c2e061ce39548a7","bodyHash":"e8de5b78cb036fdecd1ae0691cafc8b748946fb1136b4a4b2e4d82ef679bfe8a"}
 *
 * Go source:
 * func (c *Checker) narrowTypeByBinaryExpression(f *FlowState, t *Type, expr *ast.BinaryExpression, assumeTrue bool) *Type {
 * 	switch expr.OperatorToken.Kind {
 * 	case ast.KindEqualsToken, ast.KindBarBarEqualsToken, ast.KindAmpersandAmpersandEqualsToken, ast.KindQuestionQuestionEqualsToken:
 * 		return c.narrowTypeByTruthiness(f, c.narrowType(f, t, expr.Right, assumeTrue), expr.Left, assumeTrue)
 * 	case ast.KindEqualsEqualsToken, ast.KindExclamationEqualsToken, ast.KindEqualsEqualsEqualsToken, ast.KindExclamationEqualsEqualsToken:
 * 		operator := expr.OperatorToken.Kind
 * 		left := c.getReferenceCandidate(expr.Left)
 * 		right := c.getReferenceCandidate(expr.Right)
 * 		if left.Kind == ast.KindTypeOfExpression && ast.IsStringLiteralLike(right) {
 * 			return c.narrowTypeByTypeof(f, t, left.AsTypeOfExpression(), operator, right, assumeTrue)
 * 		}
 * 		if right.Kind == ast.KindTypeOfExpression && ast.IsStringLiteralLike(left) {
 * 			return c.narrowTypeByTypeof(f, t, right.AsTypeOfExpression(), operator, left, assumeTrue)
 * 		}
 * 		if c.isMatchingReference(f.reference, left) {
 * 			return c.narrowTypeByEquality(t, operator, right, assumeTrue)
 * 		}
 * 		if c.isMatchingReference(f.reference, right) {
 * 			return c.narrowTypeByEquality(t, operator, left, assumeTrue)
 * 		}
 * 		if c.strictNullChecks {
 * 			if c.optionalChainContainsReference(left, f.reference) {
 * 				t = c.narrowTypeByOptionalChainContainment(f, t, operator, right, assumeTrue)
 * 			} else if c.optionalChainContainsReference(right, f.reference) {
 * 				t = c.narrowTypeByOptionalChainContainment(f, t, operator, left, assumeTrue)
 * 			}
 * 		}
 * 		leftAccess := c.getDiscriminantPropertyAccess(f, left, t)
 * 		if leftAccess != nil {
 * 			return c.narrowTypeByDiscriminantProperty(t, leftAccess, operator, right, assumeTrue)
 * 		}
 * 		rightAccess := c.getDiscriminantPropertyAccess(f, right, t)
 * 		if rightAccess != nil {
 * 			return c.narrowTypeByDiscriminantProperty(t, rightAccess, operator, left, assumeTrue)
 * 		}
 * 		if c.isMatchingConstructorReference(f, left) {
 * 			return c.narrowTypeByConstructor(t, operator, right, assumeTrue)
 * 		}
 * 		if c.isMatchingConstructorReference(f, right) {
 * 			return c.narrowTypeByConstructor(t, operator, left, assumeTrue)
 * 		}
 * 		if ast.IsBooleanLiteral(right) && !ast.IsAccessExpression(left) {
 * 			return c.narrowTypeByBooleanComparison(f, t, left, right, operator, assumeTrue)
 * 		}
 * 		if ast.IsBooleanLiteral(left) && !ast.IsAccessExpression(right) {
 * 			return c.narrowTypeByBooleanComparison(f, t, right, left, operator, assumeTrue)
 * 		}
 * 	case ast.KindInstanceOfKeyword:
 * 		return c.narrowTypeByInstanceof(f, t, expr, assumeTrue)
 * 	case ast.KindInKeyword:
 * 		if ast.IsPrivateIdentifier(expr.Left) {
 * 			return c.narrowTypeByPrivateIdentifierInInExpression(f, t, expr, assumeTrue)
 * 		}
 * 		target := c.getReferenceCandidate(expr.Right)
 * 		if c.containsMissingType(t) && ast.IsAccessExpression(f.reference) && c.isMatchingReference(f.reference.Expression(), target) {
 * 			leftType := c.getTypeOfExpression(expr.Left)
 * 			if isTypeUsableAsPropertyName(leftType) {
 * 				if accessedName, ok := c.getAccessedPropertyName(f.reference); ok && accessedName == getPropertyNameFromType(leftType) {
 * 					return c.getTypeWithFacts(t, core.IfElse(assumeTrue, TypeFactsNEUndefined, TypeFactsEQUndefined))
 * 				}
 * 			}
 * 		}
 * 		if c.isMatchingReference(f.reference, target) {
 * 			leftType := c.getTypeOfExpression(expr.Left)
 * 			if isTypeUsableAsPropertyName(leftType) {
 * 				return c.narrowTypeByInKeyword(f, t, leftType, assumeTrue)
 * 			}
 * 		}
 * 	case ast.KindCommaToken:
 * 		return c.narrowType(f, t, expr.Right, assumeTrue)
 * 	case ast.KindAmpersandAmpersandToken:
 * 		// Ordinarily we won't see && and || expressions in control flow analysis because the Binder breaks those
 * 		// expressions down to individual conditional control flows. However, we may encounter them when analyzing
 * 		// aliased conditional expressions.
 * 		if assumeTrue {
 * 			return c.narrowType(f, c.narrowType(f, t, expr.Left, true /*assumeTrue* /), expr.Right, true /*assumeTrue* /)
 * 		}
 * 		return c.getUnionType([]*Type{c.narrowType(f, t, expr.Left, false /*assumeTrue* /), c.narrowType(f, t, expr.Right, false /*assumeTrue* /)})
 * 	case ast.KindBarBarToken:
 * 		if assumeTrue {
 * 			return c.getUnionType([]*Type{c.narrowType(f, t, expr.Left, true /*assumeTrue* /), c.narrowType(f, t, expr.Right, true /*assumeTrue* /)})
 * 		}
 * 		return c.narrowType(f, c.narrowType(f, t, expr.Left, false /*assumeTrue* /), expr.Right, false /*assumeTrue* /)
 * 	}
 * 	return t
 * }
 */
export function Checker_narrowTypeByBinaryExpression(receiver: GoPtr<Checker>, f: GoPtr<FlowState>, t: GoPtr<Type>, expr: GoPtr<BinaryExpression>, assumeTrue: bool): GoPtr<Type> {
  switch (expr!.OperatorToken!.Kind) {
    case KindEqualsToken:
    case KindBarBarEqualsToken:
    case KindAmpersandAmpersandEqualsToken:
    case KindQuestionQuestionEqualsToken:
      return Checker_narrowTypeByTruthiness(receiver, f, Checker_narrowType(receiver, f, t, expr!.Right, assumeTrue), expr!.Left, assumeTrue);
    case KindEqualsEqualsToken:
    case KindExclamationEqualsToken:
    case KindEqualsEqualsEqualsToken:
    case KindExclamationEqualsEqualsToken: {
      const operator = expr!.OperatorToken!.Kind;
      const left = Checker_getReferenceCandidate(receiver, expr!.Left);
      const right = Checker_getReferenceCandidate(receiver, expr!.Right);
      if (left!.Kind === KindTypeOfExpression && IsStringLiteralLike(right)) {
        return Checker_narrowTypeByTypeof(receiver, f, t, AsTypeOfExpression(left), operator, right, assumeTrue);
      }
      if (right!.Kind === KindTypeOfExpression && IsStringLiteralLike(left)) {
        return Checker_narrowTypeByTypeof(receiver, f, t, AsTypeOfExpression(right), operator, left, assumeTrue);
      }
      if (Checker_isMatchingReference(receiver, f!.reference, left)) {
        return Checker_narrowTypeByEquality(receiver, t, operator, right, assumeTrue);
      }
      if (Checker_isMatchingReference(receiver, f!.reference, right)) {
        return Checker_narrowTypeByEquality(receiver, t, operator, left, assumeTrue);
      }
      let localT = t;
      if (receiver!.strictNullChecks) {
        if (Checker_optionalChainContainsReference(receiver, left, f!.reference)) {
          localT = Checker_narrowTypeByOptionalChainContainment(receiver, f, localT, operator, right, assumeTrue);
        } else if (Checker_optionalChainContainsReference(receiver, right, f!.reference)) {
          localT = Checker_narrowTypeByOptionalChainContainment(receiver, f, localT, operator, left, assumeTrue);
        }
      }
      const leftAccess = Checker_getDiscriminantPropertyAccess(receiver, f, left, localT);
      if (leftAccess !== undefined) {
        return Checker_narrowTypeByDiscriminantProperty(receiver, localT, leftAccess, operator, right, assumeTrue);
      }
      const rightAccess = Checker_getDiscriminantPropertyAccess(receiver, f, right, localT);
      if (rightAccess !== undefined) {
        return Checker_narrowTypeByDiscriminantProperty(receiver, localT, rightAccess, operator, left, assumeTrue);
      }
      if (Checker_isMatchingConstructorReference(receiver, f, left)) {
        return Checker_narrowTypeByConstructor(receiver, localT, operator, right, assumeTrue);
      }
      if (Checker_isMatchingConstructorReference(receiver, f, right)) {
        return Checker_narrowTypeByConstructor(receiver, localT, operator, left, assumeTrue);
      }
      if (IsBooleanLiteral(right) && !IsAccessExpression(left)) {
        return Checker_narrowTypeByBooleanComparison(receiver, f, localT, left, right, operator, assumeTrue);
      }
      if (IsBooleanLiteral(left) && !IsAccessExpression(right)) {
        return Checker_narrowTypeByBooleanComparison(receiver, f, localT, right, left, operator, assumeTrue);
      }
      return localT;
    }
    case KindInstanceOfKeyword:
      return Checker_narrowTypeByInstanceof(receiver, f, t, expr, assumeTrue);
    case KindInKeyword: {
      if (IsPrivateIdentifier(expr!.Left)) {
        return Checker_narrowTypeByPrivateIdentifierInInExpression(receiver, f, t, expr, assumeTrue);
      }
      const target = Checker_getReferenceCandidate(receiver, expr!.Right);
      if (receiver!.containsMissingType(t) && IsAccessExpression(f!.reference) && Checker_isMatchingReference(receiver, Node_Expression(f!.reference), target)) {
        const leftType = Checker_getTypeOfExpression(receiver, expr!.Left);
        if (isTypeUsableAsPropertyName(leftType)) {
          const [accessedName, ok] = Checker_getAccessedPropertyName(receiver, f!.reference);
          if (ok && accessedName === getPropertyNameFromType(leftType)) {
            return Checker_getTypeWithFacts(receiver, t, IfElse(assumeTrue, TypeFactsNEUndefined, TypeFactsEQUndefined));
          }
        }
      }
      if (Checker_isMatchingReference(receiver, f!.reference, target)) {
        const leftType = Checker_getTypeOfExpression(receiver, expr!.Left);
        if (isTypeUsableAsPropertyName(leftType)) {
          return Checker_narrowTypeByInKeyword(receiver, f, t, leftType, assumeTrue);
        }
      }
      return t;
    }
    case KindCommaToken:
      return Checker_narrowType(receiver, f, t, expr!.Right, assumeTrue);
    case KindAmpersandAmpersandToken:
      if (assumeTrue) {
        return Checker_narrowType(receiver, f, Checker_narrowType(receiver, f, t, expr!.Left, true), expr!.Right, true);
      }
      return Checker_getUnionType(receiver, [Checker_narrowType(receiver, f, t, expr!.Left, false), Checker_narrowType(receiver, f, t, expr!.Right, false)]);
    case KindBarBarToken:
      if (assumeTrue) {
        return Checker_getUnionType(receiver, [Checker_narrowType(receiver, f, t, expr!.Left, true), Checker_narrowType(receiver, f, t, expr!.Right, true)]);
      }
      return Checker_narrowType(receiver, f, Checker_narrowType(receiver, f, t, expr!.Left, false), expr!.Right, false);
  }
  return t;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/flow.go::method::Checker.narrowTypeByEquality","kind":"method","status":"implemented","sigHash":"3c20b362bc3ffacf7d31ba8189ffb6d9cd02ee08790bdb7a6f70d064ae0c76bf","bodyHash":"42bb2e1e964d74ac57249382bb7cb8e6af9d866cdb216c0be19cf2489fd85049"}
 *
 * Go source:
 * func (c *Checker) narrowTypeByEquality(t *Type, operator ast.Kind, value *ast.Node, assumeTrue bool) *Type {
 * 	if t.flags&TypeFlagsAny != 0 {
 * 		return t
 * 	}
 * 	if operator == ast.KindExclamationEqualsToken || operator == ast.KindExclamationEqualsEqualsToken {
 * 		assumeTrue = !assumeTrue
 * 	}
 * 	valueType := c.getTypeOfExpression(value)
 * 	doubleEquals := operator == ast.KindEqualsEqualsToken || operator == ast.KindExclamationEqualsToken
 * 	if valueType.flags&TypeFlagsNullable != 0 {
 * 		if !c.strictNullChecks {
 * 			return t
 * 		}
 * 		var facts TypeFacts
 * 		switch {
 * 		case doubleEquals:
 * 			facts = core.IfElse(assumeTrue, TypeFactsEQUndefinedOrNull, TypeFactsNEUndefinedOrNull)
 * 		case valueType.flags&TypeFlagsNull != 0:
 * 			facts = core.IfElse(assumeTrue, TypeFactsEQNull, TypeFactsNENull)
 * 		default:
 * 			facts = core.IfElse(assumeTrue, TypeFactsEQUndefined, TypeFactsNEUndefined)
 * 		}
 * 		return c.getAdjustedTypeWithFacts(t, facts)
 * 	}
 * 	if assumeTrue {
 * 		if !doubleEquals && (t.flags&TypeFlagsUnknown != 0 || someType(t, c.IsEmptyAnonymousObjectType)) {
 * 			if valueType.flags&(TypeFlagsPrimitive|TypeFlagsNonPrimitive) != 0 || c.IsEmptyAnonymousObjectType(valueType) {
 * 				return valueType
 * 			}
 * 			if valueType.flags&TypeFlagsObject != 0 {
 * 				return c.nonPrimitiveType
 * 			}
 * 		}
 * 		filteredType := c.filterType(t, func(t *Type) bool {
 * 			return c.areTypesComparable(t, valueType) || doubleEquals && isCoercibleUnderDoubleEquals(t, valueType)
 * 		})
 * 		return c.replacePrimitivesWithLiterals(filteredType, valueType)
 * 	}
 * 	if isUnitType(valueType) {
 * 		return c.filterType(t, func(t *Type) bool {
 * 			return !(c.isUnitLikeType(t) && c.areTypesComparable(t, valueType))
 * 		})
 * 	}
 * 	return t
 * }
 */
export function Checker_narrowTypeByEquality(receiver: GoPtr<Checker>, t: GoPtr<Type>, operator: Kind, value: GoPtr<Node>, assumeTrue: bool): GoPtr<Type> {
  if (t!.flags & TypeFlagsAny) {
    return t;
  }
  if (operator === KindExclamationEqualsToken || operator === KindExclamationEqualsEqualsToken) {
    assumeTrue = !assumeTrue;
  }
  const valueType = Checker_getTypeOfExpression(receiver, value);
  const doubleEquals = operator === KindEqualsEqualsToken || operator === KindExclamationEqualsToken;
  if (valueType!.flags & TypeFlagsNullable) {
    if (!receiver!.strictNullChecks) {
      return t;
    }
    let facts: TypeFacts;
    if (doubleEquals) {
      facts = IfElse(assumeTrue, TypeFactsEQUndefinedOrNull, TypeFactsNEUndefinedOrNull);
    } else if (valueType!.flags & TypeFlagsNull) {
      facts = IfElse(assumeTrue, TypeFactsEQNull, TypeFactsNENull);
    } else {
      facts = IfElse(assumeTrue, TypeFactsEQUndefined, TypeFactsNEUndefined);
    }
    return Checker_getAdjustedTypeWithFacts(receiver, t, facts);
  }
  if (assumeTrue) {
    if (!doubleEquals && (t!.flags & TypeFlagsUnknown || someType(t, (x) => Checker_IsEmptyAnonymousObjectType(receiver, x)))) {
      if (valueType!.flags & (TypeFlagsPrimitive | TypeFlagsNonPrimitive) || Checker_IsEmptyAnonymousObjectType(receiver, valueType)) {
        return valueType;
      }
      if (valueType!.flags & TypeFlagsObject) {
        return receiver!.nonPrimitiveType;
      }
    }
    const filteredType = Checker_filterType(receiver, t, (t) => Checker_areTypesComparable(receiver, t, valueType) || doubleEquals && isCoercibleUnderDoubleEquals(t, valueType));
    return Checker_replacePrimitivesWithLiterals(receiver, filteredType, valueType);
  }
  if (isUnitType(valueType)) {
    return Checker_filterType(receiver, t, (t) => !(Checker_isUnitLikeType(receiver, t) && Checker_areTypesComparable(receiver, t, valueType)));
  }
  return t;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/flow.go::method::Checker.narrowTypeByTypeof","kind":"method","status":"implemented","sigHash":"ced679635cefd49fa7fb02bc7c3998d3e93f8dc14ed27bd258d686045d941a2f","bodyHash":"dd2bd44183bac85b2e7c6d77a5a5f84dca32174e5e31151cb957514f1221e223"}
 *
 * Go source:
 * func (c *Checker) narrowTypeByTypeof(f *FlowState, t *Type, typeOfExpr *ast.TypeOfExpression, operator ast.Kind, literal *ast.Node, assumeTrue bool) *Type {
 * 	// We have '==', '!=', '===', or !==' operator with 'typeof xxx' and string literal operands
 * 	if operator == ast.KindExclamationEqualsToken || operator == ast.KindExclamationEqualsEqualsToken {
 * 		assumeTrue = !assumeTrue
 * 	}
 * 	target := c.getReferenceCandidate(typeOfExpr.Expression)
 * 	if !c.isMatchingReference(f.reference, target) {
 * 		if c.strictNullChecks && c.optionalChainContainsReference(target, f.reference) && assumeTrue == (literal.Text() != "undefined") {
 * 			t = c.getAdjustedTypeWithFacts(t, TypeFactsNEUndefinedOrNull)
 * 		}
 * 		propertyAccess := c.getDiscriminantPropertyAccess(f, target, t)
 * 		if propertyAccess != nil {
 * 			return c.narrowTypeByDiscriminant(t, propertyAccess, func(t *Type) *Type {
 * 				return c.narrowTypeByLiteralExpression(t, literal, assumeTrue)
 * 			})
 * 		}
 * 		return t
 * 	}
 * 	return c.narrowTypeByLiteralExpression(t, literal, assumeTrue)
 * }
 */
export function Checker_narrowTypeByTypeof(receiver: GoPtr<Checker>, f: GoPtr<FlowState>, t: GoPtr<Type>, typeOfExpr: GoPtr<TypeOfExpression>, operator: Kind, literal: GoPtr<Node>, assumeTrue: bool): GoPtr<Type> {
  // We have '==', '!=', '===', or '!==' operator with 'typeof xxx' and string literal operands
  if (operator === KindExclamationEqualsToken || operator === KindExclamationEqualsEqualsToken) {
    assumeTrue = !assumeTrue;
  }
  const target = Checker_getReferenceCandidate(receiver, Node_Expression(typeOfExpr as GoPtr<Node>));
  if (!Checker_isMatchingReference(receiver, f!.reference, target)) {
    if (receiver!.strictNullChecks && Checker_optionalChainContainsReference(receiver, target, f!.reference) && assumeTrue === (Node_Text(literal) !== "undefined")) {
      t = Checker_getAdjustedTypeWithFacts(receiver, t, TypeFactsNEUndefinedOrNull);
    }
    const propertyAccess = Checker_getDiscriminantPropertyAccess(receiver, f, target, t);
    if (propertyAccess !== undefined) {
      return Checker_narrowTypeByDiscriminant(receiver, t, propertyAccess, (t) => Checker_narrowTypeByLiteralExpression(receiver, t, literal as GoPtr<LiteralExpression>, assumeTrue));
    }
    return t;
  }
  return Checker_narrowTypeByLiteralExpression(receiver, t, literal as GoPtr<LiteralExpression>, assumeTrue);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/flow.go::varGroup::typeofNEFacts","kind":"varGroup","status":"implemented","sigHash":"89bd1307af65ec16e5166d7ab6f05d11ef6fe6b5a07d372a56d682eb786b5482","bodyHash":"d0a80f511125817407938eb1be1e14d4a4d9fbc3d2182475c107a744ac696cf3"}
 *
 * Go source:
 * var typeofNEFacts = map[string]TypeFacts{
 * 	"string":    TypeFactsTypeofNEString,
 * 	"number":    TypeFactsTypeofNENumber,
 * 	"bigint":    TypeFactsTypeofNEBigInt,
 * 	"boolean":   TypeFactsTypeofNEBoolean,
 * 	"symbol":    TypeFactsTypeofNESymbol,
 * 	"undefined": TypeFactsNEUndefined,
 * 	"object":    TypeFactsTypeofNEObject,
 * 	"function":  TypeFactsTypeofNEFunction,
 * }
 */
class LazyTypeofNEFacts extends Map<string, TypeFacts> {
  private initialized = false;

  private ensureInitialized(): void {
    if (this.initialized) {
      return;
    }
    this.initialized = true;
    this.set("string", TypeFactsTypeofNEString);
    this.set("number", TypeFactsTypeofNENumber);
    this.set("bigint", TypeFactsTypeofNEBigInt);
    this.set("boolean", TypeFactsTypeofNEBoolean);
    this.set("symbol", TypeFactsTypeofNESymbol);
    this.set("undefined", TypeFactsNEUndefined);
    this.set("object", TypeFactsTypeofNEObject);
    this.set("function", TypeFactsTypeofNEFunction);
  }

  override get(key: string): TypeFacts | undefined {
    this.ensureInitialized();
    return super.get(key);
  }

  override has(key: string): boolean {
    this.ensureInitialized();
    return super.has(key);
  }

  override keys(): MapIterator<string> {
    this.ensureInitialized();
    return super.keys();
  }

  override entries(): MapIterator<[string, TypeFacts]> {
    this.ensureInitialized();
    return super.entries();
  }

  override [Symbol.iterator](): MapIterator<[string, TypeFacts]> {
    this.ensureInitialized();
    return super[Symbol.iterator]();
  }
}

export const typeofNEFacts: GoMap<string, TypeFacts> = new LazyTypeofNEFacts();

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/flow.go::method::Checker.narrowTypeByLiteralExpression","kind":"method","status":"implemented","sigHash":"21f112067eb9ee2d1c20d821f0c06352592156aef66b408a5ee1d5afe6cf4ce3","bodyHash":"2af8f66909bca82bc04efb990224cf0b49b9bbb9aceb5c13febd5ee0024e9f5c"}
 *
 * Go source:
 * func (c *Checker) narrowTypeByLiteralExpression(t *Type, literal *ast.LiteralExpression, assumeTrue bool) *Type {
 * 	if assumeTrue {
 * 		return c.narrowTypeByTypeName(t, literal.Text())
 * 	}
 * 	facts, ok := typeofNEFacts[literal.Text()]
 * 	if !ok {
 * 		facts = TypeFactsTypeofNEHostObject
 * 	}
 * 	return c.getAdjustedTypeWithFacts(t, facts)
 * }
 */
export function Checker_narrowTypeByLiteralExpression(receiver: GoPtr<Checker>, t: GoPtr<Type>, literal: GoPtr<LiteralExpression>, assumeTrue: bool): GoPtr<Type> {
  if (assumeTrue) {
    return Checker_narrowTypeByTypeName(receiver, t, Node_Text(literal as GoPtr<Node>));
  }
  const text = Node_Text(literal as GoPtr<Node>);
  const facts = typeofNEFacts.get(text) ?? TypeFactsTypeofNEHostObject;
  return Checker_getAdjustedTypeWithFacts(receiver, t, facts);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/flow.go::method::Checker.narrowTypeByTypeName","kind":"method","status":"implemented","sigHash":"fe3656475c8c64d5ac35be23df5aae41cf07d0b98f01db52ee6157f34090e95f","bodyHash":"1131a95b0d5aa138c7f7a36778e70293a079802c9a8fcf58e6462f2a7dcbda0e"}
 *
 * Go source:
 * func (c *Checker) narrowTypeByTypeName(t *Type, typeName string) *Type {
 * 	switch typeName {
 * 	case "string":
 * 		return c.narrowTypeByTypeFacts(t, c.stringType, TypeFactsTypeofEQString)
 * 	case "number":
 * 		return c.narrowTypeByTypeFacts(t, c.numberType, TypeFactsTypeofEQNumber)
 * 	case "bigint":
 * 		return c.narrowTypeByTypeFacts(t, c.bigintType, TypeFactsTypeofEQBigInt)
 * 	case "boolean":
 * 		return c.narrowTypeByTypeFacts(t, c.booleanType, TypeFactsTypeofEQBoolean)
 * 	case "symbol":
 * 		return c.narrowTypeByTypeFacts(t, c.esSymbolType, TypeFactsTypeofEQSymbol)
 * 	case "object":
 * 		if t.flags&TypeFlagsAny != 0 {
 * 			return t
 * 		}
 * 		return c.getUnionType([]*Type{c.narrowTypeByTypeFacts(t, c.nonPrimitiveType, TypeFactsTypeofEQObject), c.narrowTypeByTypeFacts(t, c.nullType, TypeFactsEQNull)})
 * 	case "function":
 * 		if t.flags&TypeFlagsAny != 0 {
 * 			return t
 * 		}
 * 		return c.narrowTypeByTypeFacts(t, c.globalFunctionType, TypeFactsTypeofEQFunction)
 * 	case "undefined":
 * 		return c.narrowTypeByTypeFacts(t, c.undefinedType, TypeFactsEQUndefined)
 * 	}
 * 	return c.narrowTypeByTypeFacts(t, c.nonPrimitiveType, TypeFactsTypeofEQHostObject)
 * }
 */
export function Checker_narrowTypeByTypeName(receiver: GoPtr<Checker>, t: GoPtr<Type>, typeName: string): GoPtr<Type> {
  switch (typeName) {
    case "string":
      return Checker_narrowTypeByTypeFacts(receiver, t, receiver!.stringType, TypeFactsTypeofEQString);
    case "number":
      return Checker_narrowTypeByTypeFacts(receiver, t, receiver!.numberType, TypeFactsTypeofEQNumber);
    case "bigint":
      return Checker_narrowTypeByTypeFacts(receiver, t, receiver!.bigintType, TypeFactsTypeofEQBigInt);
    case "boolean":
      return Checker_narrowTypeByTypeFacts(receiver, t, receiver!.booleanType, TypeFactsTypeofEQBoolean);
    case "symbol":
      return Checker_narrowTypeByTypeFacts(receiver, t, receiver!.esSymbolType, TypeFactsTypeofEQSymbol);
    case "object":
      if (t!.flags & TypeFlagsAny) {
        return t;
      }
      return Checker_getUnionType(receiver, [Checker_narrowTypeByTypeFacts(receiver, t, receiver!.nonPrimitiveType, TypeFactsTypeofEQObject), Checker_narrowTypeByTypeFacts(receiver, t, receiver!.nullType, TypeFactsEQNull)]);
    case "function":
      if (t!.flags & TypeFlagsAny) {
        return t;
      }
      return Checker_narrowTypeByTypeFacts(receiver, t, receiver!.globalFunctionType, TypeFactsTypeofEQFunction);
    case "undefined":
      return Checker_narrowTypeByTypeFacts(receiver, t, receiver!.undefinedType, TypeFactsEQUndefined);
  }
  return Checker_narrowTypeByTypeFacts(receiver, t, receiver!.nonPrimitiveType, TypeFactsTypeofEQHostObject);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/flow.go::method::Checker.narrowTypeByTypeFacts","kind":"method","status":"implemented","sigHash":"e6669e52ad11f0e303207ebcf555facab1d3e07b7cd759d0eb11aa2dcbc00e00","bodyHash":"6788a50ec4488918761c3858433f30ca72ac6cdec8611edb1667615a87992a34"}
 *
 * Go source:
 * func (c *Checker) narrowTypeByTypeFacts(t *Type, impliedType *Type, facts TypeFacts) *Type {
 * 	return c.mapType(t, func(t *Type) *Type {
 * 		switch {
 * 		case c.isTypeRelatedTo(t, impliedType, c.strictSubtypeRelation):
 * 			if c.hasTypeFacts(t, facts) {
 * 				return t
 * 			}
 * 			return c.neverType
 * 		case c.isTypeSubtypeOf(impliedType, t):
 * 			return impliedType
 * 		case c.hasTypeFacts(t, facts):
 * 			return c.getIntersectionType([]*Type{t, impliedType})
 * 		}
 * 		return c.neverType
 * 	})
 * }
 */
export function Checker_narrowTypeByTypeFacts(receiver: GoPtr<Checker>, t: GoPtr<Type>, impliedType: GoPtr<Type>, facts: TypeFacts): GoPtr<Type> {
  return Checker_mapType(receiver, t, (t) => {
    if (Checker_isTypeRelatedTo(receiver, t, impliedType, receiver!.strictSubtypeRelation)) {
      if (Checker_hasTypeFacts(receiver, t, facts)) {
        return t;
      }
      return receiver!.neverType;
    }
    if (Checker_isTypeSubtypeOf(receiver, impliedType, t)) {
      return impliedType;
    }
    if (Checker_hasTypeFacts(receiver, t, facts)) {
      return Checker_getIntersectionType(receiver, [t, impliedType]);
    }
    return receiver!.neverType;
  });
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/flow.go::method::Checker.narrowTypeByDiscriminantProperty","kind":"method","status":"implemented","sigHash":"0657e911a17641e1a5fa20b88777aa2e1403b61f365abcba80fbcfefb9339530","bodyHash":"05ef49e32496625560be6ee6a5c6596ed12896165286a17618fc4ea7d00b9c2c"}
 *
 * Go source:
 * func (c *Checker) narrowTypeByDiscriminantProperty(t *Type, access *ast.Node, operator ast.Kind, value *ast.Node, assumeTrue bool) *Type {
 * 	if (operator == ast.KindEqualsEqualsEqualsToken || operator == ast.KindExclamationEqualsEqualsToken) && t.flags&TypeFlagsUnion != 0 {
 * 		keyPropertyName := c.getKeyPropertyName(t)
 * 		if keyPropertyName != "" {
 * 			if accessedName, ok := c.getAccessedPropertyName(access); ok && keyPropertyName == accessedName {
 * 				candidate := c.getConstituentTypeForKeyType(t, c.getTypeOfExpression(value))
 * 				if candidate != nil {
 * 					if assumeTrue && operator == ast.KindEqualsEqualsEqualsToken || !assumeTrue && operator == ast.KindExclamationEqualsEqualsToken {
 * 						return candidate
 * 					}
 * 					if propType := c.getTypeOfPropertyOfType(candidate, keyPropertyName); propType != nil && isUnitType(propType) {
 * 						return c.removeType(t, candidate)
 * 					}
 * 					return t
 * 				}
 * 			}
 * 		}
 * 	}
 * 	return c.narrowTypeByDiscriminant(t, access, func(t *Type) *Type {
 * 		return c.narrowTypeByEquality(t, operator, value, assumeTrue)
 * 	})
 * }
 */
export function Checker_narrowTypeByDiscriminantProperty(receiver: GoPtr<Checker>, t: GoPtr<Type>, access: GoPtr<Node>, operator: Kind, value: GoPtr<Node>, assumeTrue: bool): GoPtr<Type> {
  if ((operator === KindEqualsEqualsEqualsToken || operator === KindExclamationEqualsEqualsToken) && t!.flags & TypeFlagsUnion) {
    const keyPropertyName = Checker_getKeyPropertyName(receiver, t);
    if (keyPropertyName !== "") {
      const [accessedName, ok] = Checker_getAccessedPropertyName(receiver, access);
      if (ok && keyPropertyName === accessedName) {
        const candidate = Checker_getConstituentTypeForKeyType(receiver, t, Checker_getTypeOfExpression(receiver, value));
        if (candidate !== undefined) {
          if (assumeTrue && operator === KindEqualsEqualsEqualsToken || !assumeTrue && operator === KindExclamationEqualsEqualsToken) {
            return candidate;
          }
          const propType = Checker_getTypeOfPropertyOfType(receiver, candidate, keyPropertyName);
          if (propType !== undefined && isUnitType(propType)) {
            return Checker_removeType(receiver, t, candidate);
          }
          return t;
        }
      }
    }
  }
  return Checker_narrowTypeByDiscriminant(receiver, t, access, (t) => Checker_narrowTypeByEquality(receiver, t, operator, value, assumeTrue));
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/flow.go::method::Checker.narrowTypeByDiscriminant","kind":"method","status":"implemented","sigHash":"b62804ec8d761260406138f88d1ecbe97b9b0664a012940784909ea1585e5582","bodyHash":"d154879ed560a52e5174b7229962d53dc6884027e2f5fdf74977c58da00e74f1"}
 *
 * Go source:
 * func (c *Checker) narrowTypeByDiscriminant(t *Type, access *ast.Node, narrowType func(t *Type) *Type) *Type {
 * 	propName, ok := c.getAccessedPropertyName(access)
 * 	if !ok {
 * 		return t
 * 	}
 * 	optionalChain := ast.IsOptionalChain(access)
 * 	removeNullable := c.strictNullChecks && (optionalChain || isNonNullAccess(access)) && c.maybeTypeOfKind(t, TypeFlagsNullable)
 * 	nonNullType := t
 * 	if removeNullable {
 * 		nonNullType = c.getTypeWithFacts(t, TypeFactsNEUndefinedOrNull)
 * 	}
 * 	propType := c.getTypeOfPropertyOfType(nonNullType, propName)
 * 	if propType == nil {
 * 		return t
 * 	}
 * 	if removeNullable && optionalChain {
 * 		propType = c.getOptionalType(propType, false)
 * 	}
 * 	narrowedPropType := narrowType(propType)
 * 	return c.filterType(t, func(t *Type) bool {
 * 		discriminantType := core.OrElse(c.getTypeOfPropertyOrIndexSignatureOfType(t, propName), c.unknownType)
 * 		return discriminantType.flags&TypeFlagsNever == 0 && narrowedPropType.flags&TypeFlagsNever == 0 && c.areTypesComparable(narrowedPropType, discriminantType)
 * 	})
 * }
 */
export function Checker_narrowTypeByDiscriminant(receiver: GoPtr<Checker>, t: GoPtr<Type>, access: GoPtr<Node>, narrowType: (t: GoPtr<Type>) => GoPtr<Type>): GoPtr<Type> {
  const [propName, ok] = Checker_getAccessedPropertyName(receiver, access);
  if (!ok) {
    return t;
  }
  const optionalChain = IsOptionalChain(access);
  const removeNullable = receiver!.strictNullChecks && (optionalChain || isNonNullAccess(access)) && Checker_maybeTypeOfKind(receiver, t, TypeFlagsNullable);
  let nonNullType = t;
  if (removeNullable) {
    nonNullType = Checker_getTypeWithFacts(receiver, t, TypeFactsNEUndefinedOrNull);
  }
  let propType = Checker_getTypeOfPropertyOfType(receiver, nonNullType, propName);
  if (propType === undefined) {
    return t;
  }
  if (removeNullable && optionalChain) {
    propType = Checker_getOptionalType(receiver, propType, false);
  }
  const narrowedPropType = narrowType(propType);
  return Checker_filterType(receiver, t, (t) => {
    const discriminantType = OrElse(Checker_getTypeOfPropertyOrIndexSignatureOfType(receiver, t, propName), receiver!.unknownType);
    return !(discriminantType!.flags & TypeFlagsNever) && !(narrowedPropType!.flags & TypeFlagsNever) && Checker_areTypesComparable(receiver, narrowedPropType, discriminantType);
  });
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/flow.go::method::Checker.isMatchingConstructorReference","kind":"method","status":"implemented","sigHash":"984ea0cfa44696d09b90f93ae53196ded6176c592f566416e971ee528b0d4304","bodyHash":"3bc95a7d559bdf377784513b76dc782e7f2fef6124e05ea8936f4eaa2205cfa9"}
 *
 * Go source:
 * func (c *Checker) isMatchingConstructorReference(f *FlowState, expr *ast.Node) bool {
 * 	if ast.IsAccessExpression(expr) {
 * 		if accessedName, ok := c.getAccessedPropertyName(expr); ok && accessedName == "constructor" && c.isMatchingReference(f.reference, expr.Expression()) {
 * 			return true
 * 		}
 * 	}
 * 	return false
 * }
 */
export function Checker_isMatchingConstructorReference(receiver: GoPtr<Checker>, f: GoPtr<FlowState>, expr: GoPtr<Node>): bool {
  if (IsAccessExpression(expr)) {
    const [accessedName, ok] = Checker_getAccessedPropertyName(receiver, expr);
    if (ok && accessedName === "constructor" && Checker_isMatchingReference(receiver, f!.reference, Node_Expression(expr))) {
      return true;
    }
  }
  return false;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/flow.go::method::Checker.narrowTypeByConstructor","kind":"method","status":"implemented","sigHash":"1a1b32630bb291015447d6d140a8ba7104679c775c63d82107d44c20f08f22cc","bodyHash":"550c875256a8e17a92640e5ee6a02a94eebfaf4ad78f20f781275a81d8b89525"}
 *
 * Go source:
 * func (c *Checker) narrowTypeByConstructor(t *Type, operator ast.Kind, identifier *ast.Node, assumeTrue bool) *Type {
 * 	// Do not narrow when checking inequality.
 * 	if assumeTrue && operator != ast.KindEqualsEqualsToken && operator != ast.KindEqualsEqualsEqualsToken || !assumeTrue && operator != ast.KindExclamationEqualsToken && operator != ast.KindExclamationEqualsEqualsToken {
 * 		return t
 * 	}
 * 	// Get the type of the constructor identifier expression, if it is not a function then do not narrow.
 * 	identifierType := c.getTypeOfExpression(identifier)
 * 	if !c.isFunctionType(identifierType) && !c.isConstructorType(identifierType) {
 * 		return t
 * 	}
 * 	// Get the prototype property of the type identifier so we can find out its type.
 * 	prototypeProperty := c.getPropertyOfType(identifierType, "prototype")
 * 	if prototypeProperty == nil {
 * 		return t
 * 	}
 * 	// Get the type of the prototype, if it is undefined, or the global `Object` or `Function` types then do not narrow.
 * 	prototypeType := c.getTypeOfSymbol(prototypeProperty)
 * 	var candidate *Type
 * 	if !IsTypeAny(prototypeType) {
 * 		candidate = prototypeType
 * 	}
 * 	if candidate == nil || candidate == c.globalObjectType || candidate == c.globalFunctionType {
 * 		return t
 * 	}
 * 	// If the type that is being narrowed is `any` then just return the `candidate` type since every type is a subtype of `any`.
 * 	if IsTypeAny(t) {
 * 		return candidate
 * 	}
 * 	// Filter out types that are not considered to be "constructed by" the `candidate` type.
 * 	return c.filterType(t, func(t *Type) bool {
 * 		return c.isConstructedBy(t, candidate)
 * 	})
 * }
 */
export function Checker_narrowTypeByConstructor(receiver: GoPtr<Checker>, t: GoPtr<Type>, operator: Kind, identifier: GoPtr<Node>, assumeTrue: bool): GoPtr<Type> {
  // Do not narrow when checking inequality.
  if (assumeTrue && operator !== KindEqualsEqualsToken && operator !== KindEqualsEqualsEqualsToken || !assumeTrue && operator !== KindExclamationEqualsToken && operator !== KindExclamationEqualsEqualsToken) {
    return t;
  }
  // Get the type of the constructor identifier expression, if it is not a function then do not narrow.
  const identifierType = Checker_getTypeOfExpression(receiver, identifier);
  if (!Checker_isFunctionType(receiver, identifierType) && !Checker_isConstructorType(receiver, identifierType)) {
    return t;
  }
  // Get the prototype property of the type identifier so we can find out its type.
  const prototypeProperty = Checker_getPropertyOfType(receiver, identifierType, "prototype");
  if (prototypeProperty === undefined) {
    return t;
  }
  // Get the type of the prototype, if it is undefined, or the global `Object` or `Function` types then do not narrow.
  const prototypeType = Checker_getTypeOfSymbol(receiver, prototypeProperty);
  const candidate = !IsTypeAny(prototypeType) ? prototypeType : undefined;
  if (candidate === undefined || candidate === receiver!.globalObjectType || candidate === receiver!.globalFunctionType) {
    return t;
  }
  // If the type that is being narrowed is `any` then just return the `candidate` type since every type is a subtype of `any`.
  if (IsTypeAny(t)) {
    return candidate;
  }
  // Filter out types that are not considered to be "constructed by" the `candidate` type.
  return Checker_filterType(receiver, t, (t) => Checker_isConstructedBy(receiver, t, candidate));
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/flow.go::method::Checker.isConstructedBy","kind":"method","status":"implemented","sigHash":"f050e78f89ed5dc50f81020df700cdea3481683343a858b5ab217fe853b687f2","bodyHash":"4ad480aee0b6bb30e3163e8a78800840f21b0fb643bb6731956741b7572e9dd3"}
 *
 * Go source:
 * func (c *Checker) isConstructedBy(source *Type, target *Type) bool {
 * 	// If either the source or target type are a class type then we need to check that they are the same exact type.
 * 	// This is because you may have a class `A` that defines some set of properties, and another class `B`
 * 	// that defines the same set of properties as class `A`, in that case they are structurally the same
 * 	// type, but when you do something like `instanceOfA.constructor === B` it will return false.
 * 	if source.flags&TypeFlagsObject != 0 && source.objectFlags&ObjectFlagsClass != 0 || target.flags&TypeFlagsObject != 0 && target.objectFlags&ObjectFlagsClass != 0 {
 * 		return source.symbol == target.symbol
 * 	}
 * 	// For all other types just check that the `source` type is a subtype of the `target` type.
 * 	return c.isTypeSubtypeOf(source, target)
 * }
 */
export function Checker_isConstructedBy(receiver: GoPtr<Checker>, source: GoPtr<Type>, target: GoPtr<Type>): bool {
  // If either the source or target type are a class type then we need to check that they are the same exact type.
  if ((source!.flags & TypeFlagsObject && source!.objectFlags & ObjectFlagsClass) || (target!.flags & TypeFlagsObject && target!.objectFlags & ObjectFlagsClass)) {
    return source!.symbol === target!.symbol;
  }
  // For all other types just check that the `source` type is a subtype of the `target` type.
  return Checker_isTypeSubtypeOf(receiver, source, target);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/flow.go::method::Checker.narrowTypeByBooleanComparison","kind":"method","status":"implemented","sigHash":"8c076afc71cf5280ad5c3feaacb266f36faf27dd8f84daae1cbc581d43eac554","bodyHash":"4fb083342fdd578e8a441cf73bf1c98c0b237287817bd1b7035ff3440e1aea72"}
 *
 * Go source:
 * func (c *Checker) narrowTypeByBooleanComparison(f *FlowState, t *Type, expr *ast.Node, boolValue *ast.Node, operator ast.Kind, assumeTrue bool) *Type {
 * 	assumeTrue = (assumeTrue != (boolValue.Kind == ast.KindTrueKeyword)) != (operator != ast.KindExclamationEqualsEqualsToken && operator != ast.KindExclamationEqualsToken)
 * 	return c.narrowType(f, t, expr, assumeTrue)
 * }
 */
export function Checker_narrowTypeByBooleanComparison(receiver: GoPtr<Checker>, f: GoPtr<FlowState>, t: GoPtr<Type>, expr: GoPtr<Node>, boolValue: GoPtr<Node>, operator: Kind, assumeTrue: bool): GoPtr<Type> {
  const newAssumeTrue = (assumeTrue !== (boolValue!.Kind === KindTrueKeyword)) !== (operator !== KindExclamationEqualsEqualsToken && operator !== KindExclamationEqualsToken);
  return Checker_narrowType(receiver, f, t, expr, newAssumeTrue);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/flow.go::method::Checker.narrowTypeByInstanceof","kind":"method","status":"implemented","sigHash":"cfd8514f33217ddeb41df678394a8fd74b5afecf1202ca5ce87f4ab790a6d0be","bodyHash":"e14ef6e3e214d4d04c234134bd7b9d783f24d27dd830e75064426a7da5413620"}
 *
 * Go source:
 * func (c *Checker) narrowTypeByInstanceof(f *FlowState, t *Type, expr *ast.BinaryExpression, assumeTrue bool) *Type {
 * 	left := c.getReferenceCandidate(expr.Left)
 * 	if !c.isMatchingReference(f.reference, left) {
 * 		if assumeTrue && c.strictNullChecks && c.optionalChainContainsReference(left, f.reference) {
 * 			return c.getAdjustedTypeWithFacts(t, TypeFactsNEUndefinedOrNull)
 * 		}
 * 		return t
 * 	}
 * 	right := expr.Right
 * 	rightType := c.getTypeOfExpression(right)
 * 	if !c.isTypeDerivedFrom(rightType, c.globalObjectType) {
 * 		return t
 * 	}
 * 	// if the right-hand side has an object type with a custom `[Symbol.hasInstance]` method, and that method
 * 	// has a type predicate, use the type predicate to perform narrowing. This allows normal `object` types to
 * 	// participate in `instanceof`, as per Step 2 of https://tc39.es/ecma262/#sec-instanceofoperator.
 * 	var predicate *TypePredicate
 * 	if signature := c.getEffectsSignature(expr.AsNode()); signature != nil {
 * 		predicate = c.getTypePredicateOfSignature(signature)
 * 	}
 * 	if predicate != nil && predicate.kind == TypePredicateKindIdentifier && predicate.parameterIndex == 0 {
 * 		return c.getNarrowedType(t, predicate.t, assumeTrue, true /*checkDerived* /)
 * 	}
 * 	if !c.isTypeDerivedFrom(rightType, c.globalFunctionType) {
 * 		return t
 * 	}
 * 	instanceType := c.mapType(rightType, c.getInstanceType)
 * 	// Don't narrow from `any` if the target type is exactly `Object` or `Function`, and narrow
 * 	// in the false branch only if the target is a non-empty object type.
 * 	if IsTypeAny(t) && (instanceType == c.globalObjectType || instanceType == c.globalFunctionType) || !assumeTrue && !(instanceType.flags&TypeFlagsObject != 0 && !c.IsEmptyAnonymousObjectType(instanceType)) {
 * 		return t
 * 	}
 * 	return c.getNarrowedType(t, instanceType, assumeTrue, true /*checkDerived* /)
 * }
 */
export function Checker_narrowTypeByInstanceof(receiver: GoPtr<Checker>, f: GoPtr<FlowState>, t: GoPtr<Type>, expr: GoPtr<BinaryExpression>, assumeTrue: bool): GoPtr<Type> {
  const left = Checker_getReferenceCandidate(receiver, expr!.Left);
  if (!Checker_isMatchingReference(receiver, f!.reference, left)) {
    if (assumeTrue && receiver!.strictNullChecks && Checker_optionalChainContainsReference(receiver, left, f!.reference)) {
      return Checker_getAdjustedTypeWithFacts(receiver, t, TypeFactsNEUndefinedOrNull);
    }
    return t;
  }
  const right = expr!.Right;
  const rightType = Checker_getTypeOfExpression(receiver, right);
  if (!Checker_isTypeDerivedFrom(receiver, rightType, receiver!.globalObjectType)) {
    return t;
  }
  // if the right-hand side has an object type with a custom `[Symbol.hasInstance]` method, and that method
  // has a type predicate, use the type predicate to perform narrowing.
  let predicate: GoPtr<TypePredicate> = undefined;
  const signature = Checker_getEffectsSignature(receiver, expr as unknown as GoPtr<Node>);
  if (signature !== undefined) {
    predicate = Checker_getTypePredicateOfSignature(receiver, signature);
  }
  if (predicate !== undefined && predicate!.kind === TypePredicateKindIdentifier && predicate!.parameterIndex === 0) {
    return Checker_getNarrowedType(receiver, t, predicate!.t, assumeTrue, true /*checkDerived*/);
  }
  if (!Checker_isTypeDerivedFrom(receiver, rightType, receiver!.globalFunctionType)) {
    return t;
  }
  const instanceType = Checker_mapType(receiver, rightType, (t) => Checker_getInstanceType(receiver, t));
  // Don't narrow from `any` if the target type is exactly `Object` or `Function`, and narrow
  // in the false branch only if the target is a non-empty object type.
  if (IsTypeAny(t) && (instanceType === receiver!.globalObjectType || instanceType === receiver!.globalFunctionType) || !assumeTrue && !(instanceType!.flags & TypeFlagsObject && !Checker_IsEmptyAnonymousObjectType(receiver, instanceType))) {
    return t;
  }
  return Checker_getNarrowedType(receiver, t, instanceType, assumeTrue, true /*checkDerived*/);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/flow.go::method::Checker.getNarrowedType","kind":"method","status":"implemented","sigHash":"bb81d79ca9d874b4dde80bfc636608d2450045854f572cbf4dc6b215e063faa8","bodyHash":"ea2e2102f803c66eb77c2801be239b7579a1e30d6b4232811aaaa15f3ab65a3c"}
 *
 * Go source:
 * func (c *Checker) getNarrowedType(t *Type, candidate *Type, assumeTrue bool, checkDerived bool) *Type {
 * 	if t.flags&TypeFlagsUnion == 0 {
 * 		return c.getNarrowedTypeWorker(t, candidate, assumeTrue, checkDerived)
 * 	}
 * 	key := NarrowedTypeKey{t, candidate, assumeTrue, checkDerived}
 * 	if narrowedType, ok := c.narrowedTypes[key]; ok {
 * 		return narrowedType
 * 	}
 * 	narrowedType := c.getNarrowedTypeWorker(t, candidate, assumeTrue, checkDerived)
 * 	c.narrowedTypes[key] = narrowedType
 * 	return narrowedType
 * }
 */
export function Checker_getNarrowedType(receiver: GoPtr<Checker>, t: GoPtr<Type>, candidate: GoPtr<Type>, assumeTrue: bool, checkDerived: bool): GoPtr<Type> {
  if (!(t!.flags & TypeFlagsUnion)) {
    return Checker_getNarrowedTypeWorker(receiver, t, candidate, assumeTrue, checkDerived);
  }
  const key: NarrowedTypeKey = { t, candidate, assumeTrue, checkDerived };
  const cached = receiver!.narrowedTypes.get(key);
  if (cached !== undefined) {
    return cached;
  }
  const narrowedType = Checker_getNarrowedTypeWorker(receiver, t, candidate, assumeTrue, checkDerived);
  receiver!.narrowedTypes.set(key, narrowedType);
  return narrowedType;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/flow.go::method::Checker.getNarrowedTypeWorker","kind":"method","status":"implemented","sigHash":"4be1f4c91349604615c7e778cb01a73c47a46f6f33396e4eb58f17c017a48dfa","bodyHash":"4c9aac87556fdc94f0609b6ddf971263428389c7812292766823cda9dcfda4cd"}
 *
 * Go source:
 * func (c *Checker) getNarrowedTypeWorker(t *Type, candidate *Type, assumeTrue bool, checkDerived bool) *Type {
 * 	if !assumeTrue {
 * 		if t == candidate {
 * 			return c.neverType
 * 		}
 * 		if checkDerived {
 * 			return c.filterType(t, func(t *Type) bool {
 * 				return !c.isTypeDerivedFrom(t, candidate)
 * 			})
 * 		}
 * 		if t.flags&TypeFlagsUnknown != 0 {
 * 			t = c.unknownUnionType
 * 		}
 * 		trueType := c.getNarrowedType(t, candidate, true /*assumeTrue* /, false /*checkDerived* /)
 * 		return c.recombineUnknownType(c.filterType(t, func(t *Type) bool {
 * 			return !c.isTypeSubsetOf(t, trueType)
 * 		}))
 * 	}
 * 	if t.flags&TypeFlagsAnyOrUnknown != 0 {
 * 		return candidate
 * 	}
 * 	if t == candidate {
 * 		return candidate
 * 	}
 * 	// We first attempt to filter the current type, narrowing constituents as appropriate and removing
 * 	// constituents that are unrelated to the candidate.
 * 	var keyPropertyName string
 * 	if t.flags&TypeFlagsUnion != 0 {
 * 		keyPropertyName = c.getKeyPropertyName(t)
 * 	}
 * 	narrowedType := c.mapType(candidate, func(n *Type) *Type {
 * 		// If a discriminant property is available, use that to reduce the type.
 * 		matching := t
 * 		if keyPropertyName != "" {
 * 			if discriminant := c.getTypeOfPropertyOfType(n, keyPropertyName); discriminant != nil {
 * 				if constituent := c.getConstituentTypeForKeyType(t, discriminant); constituent != nil {
 * 					matching = constituent
 * 				}
 * 			}
 * 		}
 * 		// For each constituent t in the current type, if t and c are directly related, pick the most
 * 		// specific of the two. When t and c are related in both directions, we prefer c for type predicates
 * 		// because that is the asserted type, but t for `instanceof` because generics aren't reflected in
 * 		// prototype object types.
 * 		var mapType func(*Type) *Type
 * 		if checkDerived {
 * 			mapType = func(t *Type) *Type {
 * 				switch {
 * 				case c.isTypeDerivedFrom(t, n):
 * 					return t
 * 				case c.isTypeDerivedFrom(n, t):
 * 					return n
 * 				}
 * 				return c.neverType
 * 			}
 * 		} else {
 * 			mapType = func(t *Type) *Type {
 * 				switch {
 * 				case c.isTypeStrictSubtypeOf(t, n):
 * 					return t
 * 				case c.isTypeStrictSubtypeOf(n, t):
 * 					return n
 * 				case c.isTypeSubtypeOf(t, n):
 * 					return t
 * 				case c.isTypeSubtypeOf(n, t):
 * 					return n
 * 				}
 * 				return c.neverType
 * 			}
 * 		}
 * 		directlyRelated := c.mapType(matching, mapType)
 * 		if directlyRelated.flags&TypeFlagsNever == 0 {
 * 			return directlyRelated
 * 		}
 * 		// If no constituents are directly related, create intersections for any generic constituents that
 * 		// are related by constraint.
 * 		var isRelated func(*Type, *Type) bool
 * 		if checkDerived {
 * 			isRelated = c.isTypeDerivedFrom
 * 		} else {
 * 			isRelated = c.isTypeSubtypeOf
 * 		}
 * 		return c.mapType(t, func(t *Type) *Type {
 * 			if c.maybeTypeOfKind(t, TypeFlagsInstantiable) {
 * 				constraint := c.getBaseConstraintOfType(t)
 * 				if constraint == nil || isRelated(n, constraint) {
 * 					return c.getIntersectionType([]*Type{t, n})
 * 				}
 * 			}
 * 			return c.neverType
 * 		})
 * 	})
 * 	// If filtering produced a non-empty type, return that. Otherwise, pick the most specific of the two
 * 	// based on assignability, or as a last resort produce an intersection.
 * 	switch {
 * 	case narrowedType.flags&TypeFlagsNever == 0:
 * 		return narrowedType
 * 	case c.isTypeSubtypeOf(candidate, t):
 * 		return candidate
 * 	case c.isTypeAssignableTo(t, candidate):
 * 		return t
 * 	case c.isTypeAssignableTo(candidate, t):
 * 		return candidate
 * 	}
 * 	return c.getIntersectionType([]*Type{t, candidate})
 * }
 */
export function Checker_getNarrowedTypeWorker(receiver: GoPtr<Checker>, t: GoPtr<Type>, candidate: GoPtr<Type>, assumeTrue: bool, checkDerived: bool): GoPtr<Type> {
  if (!assumeTrue) {
    if (t === candidate) {
      return receiver!.neverType;
    }
    if (checkDerived) {
      return Checker_filterType(receiver, t, (t) => !Checker_isTypeDerivedFrom(receiver, t, candidate));
    }
    let localT = t;
    if (t!.flags & TypeFlagsUnknown) {
      localT = receiver!.unknownUnionType;
    }
    const trueType = Checker_getNarrowedType(receiver, localT, candidate, true /*assumeTrue*/, false /*checkDerived*/);
    return Checker_recombineUnknownType(receiver, Checker_filterType(receiver, localT, (t) => !Checker_isTypeSubsetOf(receiver, t, trueType)));
  }
  if (t!.flags & TypeFlagsAnyOrUnknown) {
    return candidate;
  }
  if (t === candidate) {
    return candidate;
  }
  // We first attempt to filter the current type, narrowing constituents as appropriate and removing
  // constituents that are unrelated to the candidate.
  let keyPropertyName = "";
  if (t!.flags & TypeFlagsUnion) {
    keyPropertyName = Checker_getKeyPropertyName(receiver, t);
  }
  const narrowedType = Checker_mapType(receiver, candidate, (n) => {
    // If a discriminant property is available, use that to reduce the type.
    let matching = t;
    if (keyPropertyName !== "") {
      const discriminant = Checker_getTypeOfPropertyOfType(receiver, n, keyPropertyName);
      if (discriminant !== undefined) {
        const constituent = Checker_getConstituentTypeForKeyType(receiver, t, discriminant);
        if (constituent !== undefined) {
          matching = constituent;
        }
      }
    }
    // For each constituent t in the current type, if t and c are directly related, pick the most specific.
    let mapTypeFn: (t: GoPtr<Type>) => GoPtr<Type>;
    if (checkDerived) {
      mapTypeFn = (t) => {
        if (Checker_isTypeDerivedFrom(receiver, t, n)) {
          return t;
        }
        if (Checker_isTypeDerivedFrom(receiver, n, t)) {
          return n;
        }
        return receiver!.neverType;
      };
    } else {
      mapTypeFn = (t) => {
        if (Checker_isTypeStrictSubtypeOf(receiver, t, n)) {
          return t;
        }
        if (Checker_isTypeStrictSubtypeOf(receiver, n, t)) {
          return n;
        }
        if (Checker_isTypeSubtypeOf(receiver, t, n)) {
          return t;
        }
        if (Checker_isTypeSubtypeOf(receiver, n, t)) {
          return n;
        }
        return receiver!.neverType;
      };
    }
    const directlyRelated = Checker_mapType(receiver, matching, mapTypeFn);
    if (directlyRelated!.flags & TypeFlagsNever) {
      // If no constituents are directly related, create intersections for any generic constituents
      // that are related by constraint.
      const isRelated: (a: GoPtr<Type>, b: GoPtr<Type>) => bool = checkDerived
        ? (a, b) => Checker_isTypeDerivedFrom(receiver, a, b)
        : (a, b) => Checker_isTypeSubtypeOf(receiver, a, b);
      return Checker_mapType(receiver, t, (t) => {
        if (Checker_maybeTypeOfKind(receiver, t, TypeFlagsInstantiable)) {
          const constraint = Checker_getBaseConstraintOfType(receiver, t);
          if (constraint === undefined || isRelated(n, constraint)) {
            return Checker_getIntersectionType(receiver, [t, n]);
          }
        }
        return receiver!.neverType;
      });
    }
    return directlyRelated;
  });
  // If filtering produced a non-empty type, return that. Otherwise, pick the most specific of the
  // two based on assignability, or as a last resort produce an intersection.
  if (!(narrowedType!.flags & TypeFlagsNever)) {
    return narrowedType;
  }
  if (Checker_isTypeSubtypeOf(receiver, candidate, t)) {
    return candidate;
  }
  if (Checker_isTypeAssignableTo(receiver, t, candidate)) {
    return t;
  }
  if (Checker_isTypeAssignableTo(receiver, candidate, t)) {
    return candidate;
  }
  return Checker_getIntersectionType(receiver, [t, candidate]);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/flow.go::method::Checker.getInstanceType","kind":"method","status":"implemented","sigHash":"6c5da604ce20d99f024e833728a1a35e04073f40d6542124e25446148c4ec182","bodyHash":"55b52b337225845ccc41a561b5bbb06a0b138c24667c0f9c835c6d004120a562"}
 *
 * Go source:
 * func (c *Checker) getInstanceType(constructorType *Type) *Type {
 * 	prototypePropertyType := c.getTypeOfPropertyOfType(constructorType, "prototype")
 * 	if prototypePropertyType != nil && !IsTypeAny(prototypePropertyType) {
 * 		return prototypePropertyType
 * 	}
 * 	constructSignatures := c.getSignaturesOfType(constructorType, SignatureKindConstruct)
 * 	if len(constructSignatures) != 0 {
 * 		return c.getUnionType(core.Map(constructSignatures, func(signature *Signature) *Type {
 * 			return c.getReturnTypeOfSignature(c.getErasedSignature(signature))
 * 		}))
 * 	}
 * 	// We use the empty object type to indicate we don't know the type of objects created by
 * 	// this constructor function.
 * 	return c.emptyObjectType
 * }
 */
export function Checker_getInstanceType(receiver: GoPtr<Checker>, constructorType: GoPtr<Type>): GoPtr<Type> {
  const prototypePropertyType = Checker_getTypeOfPropertyOfType(receiver, constructorType, "prototype");
  if (prototypePropertyType !== undefined && !IsTypeAny(prototypePropertyType)) {
    return prototypePropertyType;
  }
  const constructSignatures = Checker_getSignaturesOfType(receiver, constructorType, SignatureKindConstruct);
  if (constructSignatures.length !== 0) {
    return Checker_getUnionType(receiver, core_Map(constructSignatures, (signature) => Checker_getReturnTypeOfSignature(receiver, Checker_getErasedSignature(receiver, signature))));
  }
  // We use the empty object type to indicate we don't know the type of objects created by
  // this constructor function.
  return receiver!.emptyObjectType;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/flow.go::method::Checker.narrowTypeByPrivateIdentifierInInExpression","kind":"method","status":"implemented","sigHash":"3bae8d365d91f4e9a1d5698b81361a3008317e437cdc5ce740897ef1402b13f2","bodyHash":"87609afa9dcd229319e788cf7e476ce8c21dd75b321f682ec9615f1a01c2178e"}
 *
 * Go source:
 * func (c *Checker) narrowTypeByPrivateIdentifierInInExpression(f *FlowState, t *Type, expr *ast.BinaryExpression, assumeTrue bool) *Type {
 * 	target := c.getReferenceCandidate(expr.Right)
 * 	if !c.isMatchingReference(f.reference, target) {
 * 		return t
 * 	}
 * 	symbol := c.getSymbolForPrivateIdentifierExpression(expr.Left)
 * 	if symbol == nil {
 * 		return t
 * 	}
 * 	classSymbol := symbol.Parent
 * 	var targetType *Type
 * 	if ast.HasStaticModifier(symbol.ValueDeclaration) {
 * 		targetType = c.getTypeOfSymbol(classSymbol)
 * 	} else {
 * 		targetType = c.getDeclaredTypeOfSymbol(classSymbol)
 * 	}
 * 	return c.getNarrowedType(t, targetType, assumeTrue, true /*checkDerived* /)
 * }
 */
export function Checker_narrowTypeByPrivateIdentifierInInExpression(receiver: GoPtr<Checker>, f: GoPtr<FlowState>, t: GoPtr<Type>, expr: GoPtr<BinaryExpression>, assumeTrue: bool): GoPtr<Type> {
  const target = Checker_getReferenceCandidate(receiver, expr!.Right);
  if (!Checker_isMatchingReference(receiver, f!.reference, target)) {
    return t;
  }
  const symbol = Checker_getSymbolForPrivateIdentifierExpression(receiver, expr!.Left);
  if (symbol === undefined) {
    return t;
  }
  const classSymbol = symbol!.Parent;
  let targetType: GoPtr<Type>;
  if (HasStaticModifier(symbol!.ValueDeclaration)) {
    targetType = Checker_getTypeOfSymbol(receiver, classSymbol);
  } else {
    targetType = Checker_getDeclaredTypeOfSymbol(receiver, classSymbol);
  }
  return Checker_getNarrowedType(receiver, t, targetType, assumeTrue, true /*checkDerived*/);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/flow.go::method::Checker.narrowTypeByInKeyword","kind":"method","status":"implemented","sigHash":"f268d0392ddf217bfe9a2c786084be92eec207c4ecddb874306d36c213eaffde","bodyHash":"016890de4f265d347b38b228d6cb316f8a4965150cee12ff31057093c57228ef"}
 *
 * Go source:
 * func (c *Checker) narrowTypeByInKeyword(f *FlowState, t *Type, nameType *Type, assumeTrue bool) *Type {
 * 	name := getPropertyNameFromType(nameType)
 * 	isKnownProperty := someType(t, func(t *Type) bool {
 * 		return c.isTypePresencePossible(t, name, true /*assumeTrue* /)
 * 	})
 * 	if isKnownProperty {
 * 		// If the check is for a known property (i.e. a property declared in some constituent of
 * 		// the target type), we filter the target type by presence of absence of the property.
 * 		return c.filterType(t, func(t *Type) bool {
 * 			return c.isTypePresencePossible(t, name, assumeTrue)
 * 		})
 * 	}
 * 	if assumeTrue {
 * 		// If the check is for an unknown property, we intersect the target type with `Record<X, unknown>`,
 * 		// where X is the name of the property.
 * 		recordSymbol := c.getGlobalRecordSymbol()
 * 		if recordSymbol != nil {
 * 			return c.getIntersectionType([]*Type{t, c.getTypeAliasInstantiation(recordSymbol, []*Type{nameType, c.unknownType}, nil)})
 * 		}
 * 	}
 * 	return t
 * }
 */
export function Checker_narrowTypeByInKeyword(receiver: GoPtr<Checker>, f: GoPtr<FlowState>, t: GoPtr<Type>, nameType: GoPtr<Type>, assumeTrue: bool): GoPtr<Type> {
  const name = getPropertyNameFromType(nameType);
  const isKnownProperty = someType(t, (t) => Checker_isTypePresencePossible(receiver, t, name, true /*assumeTrue*/));
  if (isKnownProperty) {
    // If the check is for a known property, we filter the target type by presence or absence of the property.
    return Checker_filterType(receiver, t, (t) => Checker_isTypePresencePossible(receiver, t, name, assumeTrue));
  }
  if (assumeTrue) {
    // If the check is for an unknown property, we intersect the target type with `Record<X, unknown>`,
    // where X is the name of the property.
    const recordSymbol = receiver!.getGlobalRecordSymbol();
    if (recordSymbol !== undefined) {
      return Checker_getIntersectionType(receiver, [t, Checker_getTypeAliasInstantiation(receiver, recordSymbol, [nameType, receiver!.unknownType], undefined)]);
    }
  }
  return t;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/flow.go::method::Checker.isTypePresencePossible","kind":"method","status":"implemented","sigHash":"a4d07db3f5433660df2c65cf9cc3f3a40fd510fe5f35853b215dee63aab0f4c9","bodyHash":"14d41633b6ab3b1e3af0060828591667716c164da0871c09fa1b19b4eb6d9650"}
 *
 * Go source:
 * func (c *Checker) isTypePresencePossible(t *Type, propName string, assumeTrue bool) bool {
 * 	prop := c.getPropertyOfType(t, propName)
 * 	if prop != nil {
 * 		return prop.Flags&ast.SymbolFlagsOptional != 0 || prop.CheckFlags&ast.CheckFlagsPartial != 0 || assumeTrue
 * 	}
 * 	return c.getApplicableIndexInfoForName(t, propName) != nil || !assumeTrue
 * }
 */
export function Checker_isTypePresencePossible(receiver: GoPtr<Checker>, t: GoPtr<Type>, propName: string, assumeTrue: bool): bool {
  const prop = Checker_getPropertyOfType(receiver, t, propName);
  if (prop !== undefined) {
    return !!(prop!.Flags & SymbolFlagsOptional) || !!(prop!.CheckFlags & CheckFlagsPartial) || assumeTrue;
  }
  return Checker_getApplicableIndexInfoForName(receiver, t, propName) !== undefined || !assumeTrue;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/flow.go::method::Checker.narrowTypeByOptionalChainContainment","kind":"method","status":"implemented","sigHash":"d081bfe21807b829436eff36e7519ee2c6f857a8361b2f4cce7443b79bda4cb3","bodyHash":"0aed83db8f064b1d31933de6936cb1b1eaa84e951937449c4e6b0919ce3c2f31"}
 *
 * Go source:
 * func (c *Checker) narrowTypeByOptionalChainContainment(f *FlowState, t *Type, operator ast.Kind, value *ast.Node, assumeTrue bool) *Type {
 * 	// We are in a branch of obj?.foo === value (or any one of the other equality operators). We narrow obj as follows:
 * 	// When operator is === and type of value excludes undefined, null and undefined is removed from type of obj in true branch.
 * 	// When operator is !== and type of value excludes undefined, null and undefined is removed from type of obj in false branch.
 * 	// When operator is == and type of value excludes null and undefined, null and undefined is removed from type of obj in true branch.
 * 	// When operator is != and type of value excludes null and undefined, null and undefined is removed from type of obj in false branch.
 * 	// When operator is === and type of value is undefined, null and undefined is removed from type of obj in false branch.
 * 	// When operator is !== and type of value is undefined, null and undefined is removed from type of obj in true branch.
 * 	// When operator is == and type of value is null or undefined, null and undefined is removed from type of obj in false branch.
 * 	// When operator is != and type of value is null or undefined, null and undefined is removed from type of obj in true branch.
 * 	equalsOperator := operator == ast.KindEqualsEqualsToken || operator == ast.KindEqualsEqualsEqualsToken
 * 	var nullableFlags TypeFlags
 * 	if operator == ast.KindEqualsEqualsToken || operator == ast.KindExclamationEqualsToken {
 * 		nullableFlags = TypeFlagsNullable
 * 	} else {
 * 		nullableFlags = TypeFlagsUndefined
 * 	}
 * 	valueType := c.getTypeOfExpression(value)
 * 	// Note that we include any and unknown in the exclusion test because their domain includes null and undefined.
 * 	removeNullable := equalsOperator != assumeTrue && everyType(valueType, func(t *Type) bool { return t.flags&nullableFlags != 0 }) ||
 * 		equalsOperator == assumeTrue && everyType(valueType, func(t *Type) bool { return t.flags&(TypeFlagsAnyOrUnknown|nullableFlags) == 0 })
 * 	if removeNullable {
 * 		return c.getAdjustedTypeWithFacts(t, TypeFactsNEUndefinedOrNull)
 * 	}
 * 	return t
 * }
 */
export function Checker_narrowTypeByOptionalChainContainment(receiver: GoPtr<Checker>, f: GoPtr<FlowState>, t: GoPtr<Type>, operator: Kind, value: GoPtr<Node>, assumeTrue: bool): GoPtr<Type> {
  const equalsOperator = operator === KindEqualsEqualsToken || operator === KindEqualsEqualsEqualsToken;
  const nullableFlags: number = (operator === KindEqualsEqualsToken || operator === KindExclamationEqualsToken)
    ? TypeFlagsNullable
    : TypeFlagsUndefined;
  const valueType = Checker_getTypeOfExpression(receiver, value);
  // Note that we include any and unknown in the exclusion test because their domain includes null and undefined.
  const removeNullable = (equalsOperator !== assumeTrue && everyType(valueType, (t) => !!(t!.flags & nullableFlags))) ||
    (equalsOperator === assumeTrue && everyType(valueType, (t) => !(t!.flags & (TypeFlagsAnyOrUnknown | nullableFlags))));
  if (removeNullable) {
    return Checker_getAdjustedTypeWithFacts(receiver, t, TypeFactsNEUndefinedOrNull);
  }
  return t;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/flow.go::method::Checker.getTypeAtSwitchClause","kind":"method","status":"implemented","sigHash":"84d932c0cc3ea59fa6abf7c46447bf9073179c845e73f7aad98f219f738f720f","bodyHash":"915f49a5d11d31f066972b0aa4be244ddcdd1bde319b6349b1925e889e504643"}
 *
 * Go source:
 * func (c *Checker) getTypeAtSwitchClause(f *FlowState, flow *ast.FlowNode) FlowType {
 * 	data := flow.Node.AsFlowSwitchClauseData()
 * 	expr := ast.SkipParentheses(data.SwitchStatement.Expression())
 * 	flowType := c.getTypeAtFlowNode(f, flow.Antecedent)
 * 	t := flowType.t
 * 	switch {
 * 	case c.isMatchingReference(f.reference, expr):
 * 		t = c.narrowTypeBySwitchOnDiscriminant(t, data)
 * 	case expr.Kind == ast.KindTypeOfExpression && c.isMatchingReference(f.reference, expr.Expression()):
 * 		t = c.narrowTypeBySwitchOnTypeOf(t, data)
 * 	case expr.Kind == ast.KindTrueKeyword:
 * 		t = c.narrowTypeBySwitchOnTrue(f, t, data)
 * 	default:
 * 		if c.strictNullChecks {
 * 			if c.optionalChainContainsReference(expr, f.reference) {
 * 				t = c.narrowTypeBySwitchOptionalChainContainment(t, data, func(t *Type) bool {
 * 					return t.flags&(TypeFlagsUndefined|TypeFlagsNever) == 0
 * 				})
 * 			} else if ast.IsTypeOfExpression(expr) && c.optionalChainContainsReference(expr.Expression(), f.reference) {
 * 				t = c.narrowTypeBySwitchOptionalChainContainment(t, data, func(t *Type) bool {
 * 					return !(t.flags&TypeFlagsNever != 0 || t.flags&TypeFlagsStringLiteral != 0 && getStringLiteralValue(t) == "undefined")
 * 				})
 * 			}
 * 		}
 * 		access := c.getDiscriminantPropertyAccess(f, expr, t)
 * 		if access != nil {
 * 			t = c.narrowTypeBySwitchOnDiscriminantProperty(t, access, data)
 * 		}
 * 	}
 * 	return c.newFlowType(t, flowType.incomplete)
 * }
 */
export function Checker_getTypeAtSwitchClause(receiver: GoPtr<Checker>, f: GoPtr<FlowState>, flow: GoPtr<FlowNode>): FlowType {
  const data = Node_AsFlowSwitchClauseData(flow!.Node);
  const expr = SkipParentheses(Node_Expression(data!.SwitchStatement));
  const flowType = Checker_getTypeAtFlowNode(receiver, f, flow!.Antecedent);
  let t = flowType.t;
  if (Checker_isMatchingReference(receiver, f!.reference, expr)) {
    t = Checker_narrowTypeBySwitchOnDiscriminant(receiver, t, data);
  } else if (expr!.Kind === KindTypeOfExpression && Checker_isMatchingReference(receiver, f!.reference, Node_Expression(expr))) {
    t = Checker_narrowTypeBySwitchOnTypeOf(receiver, t, data);
  } else if (expr!.Kind === KindTrueKeyword) {
    t = Checker_narrowTypeBySwitchOnTrue(receiver, f, t, data);
  } else {
    if (receiver!.strictNullChecks) {
      if (Checker_optionalChainContainsReference(receiver, expr, f!.reference)) {
        t = Checker_narrowTypeBySwitchOptionalChainContainment(receiver, t, data, (t) => !(t!.flags & (TypeFlagsUndefined | TypeFlagsNever)));
      } else if (IsTypeOfExpression(expr) && Checker_optionalChainContainsReference(receiver, Node_Expression(expr), f!.reference)) {
        t = Checker_narrowTypeBySwitchOptionalChainContainment(receiver, t, data, (t) => !(t!.flags & TypeFlagsNever || t!.flags & TypeFlagsStringLiteral && getStringLiteralValue(t) === "undefined"));
      }
    }
    const access = Checker_getDiscriminantPropertyAccess(receiver, f, expr, t);
    if (access !== undefined) {
      t = Checker_narrowTypeBySwitchOnDiscriminantProperty(receiver, t, access, data);
    }
  }
  return Checker_newFlowType(receiver, t, flowType.incomplete);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/flow.go::method::Checker.narrowTypeBySwitchOnDiscriminant","kind":"method","status":"implemented","sigHash":"12acee73f1e8fcfdcdfb0ae8dc4c4e865b280d8d94325f836e6fdb66eaf301e1","bodyHash":"a83ebb1f88b25d1ff9eb6079c5be8d410d9629fbefc0ae5984cdd1b30a8e3fde"}
 *
 * Go source:
 * func (c *Checker) narrowTypeBySwitchOnDiscriminant(t *Type, data *ast.FlowSwitchClauseData) *Type {
 * 	// We only narrow if all case expressions specify
 * 	// values with unit types, except for the case where
 * 	// `type` is unknown. In this instance we map object
 * 	// types to the nonPrimitive type and narrow with that.
 * 	switchTypes := c.getSwitchClauseTypes(data.SwitchStatement)
 * 	if len(switchTypes) == 0 {
 * 		return t
 * 	}
 * 	clauseTypes := switchTypes[data.ClauseStart:data.ClauseEnd]
 * 	hasDefaultClause := data.ClauseStart == data.ClauseEnd || slices.Contains(clauseTypes, c.neverType)
 * 	if (t.flags&TypeFlagsUnknown != 0) && !hasDefaultClause {
 * 		var groundClauseTypes []*Type
 * 		for i, s := range clauseTypes {
 * 			if s.flags&(TypeFlagsPrimitive|TypeFlagsNonPrimitive) != 0 {
 * 				if groundClauseTypes != nil {
 * 					groundClauseTypes = append(groundClauseTypes, s)
 * 				}
 * 			} else if s.flags&TypeFlagsObject != 0 {
 * 				if groundClauseTypes == nil {
 * 					groundClauseTypes = clauseTypes[:i:i]
 * 				}
 * 				groundClauseTypes = append(groundClauseTypes, c.nonPrimitiveType)
 * 			} else {
 * 				return t
 * 			}
 * 		}
 * 		return c.getUnionType(core.IfElse(groundClauseTypes == nil, clauseTypes, groundClauseTypes))
 * 	}
 * 	discriminantType := c.getUnionType(clauseTypes)
 * 	var caseType *Type
 * 	if discriminantType.flags&TypeFlagsNever != 0 {
 * 		caseType = c.neverType
 * 	} else {
 * 		filtered := c.filterType(t, func(t *Type) bool { return c.areTypesComparable(discriminantType, t) })
 * 		caseType = c.replacePrimitivesWithLiterals(filtered, discriminantType)
 * 	}
 * 	if !hasDefaultClause {
 * 		return caseType
 * 	}
 * 	defaultType := c.filterType(t, func(t *Type) bool {
 * 		if !c.isUnitLikeType(t) {
 * 			return true
 * 		}
 * 		u := c.undefinedType
 * 		if t.flags&TypeFlagsUndefined == 0 {
 * 			u = c.getRegularTypeOfLiteralType(c.extractUnitType(t))
 * 		}
 * 		return !slices.ContainsFunc(switchTypes, func(st *Type) bool {
 * 			return isUnitType(st) && c.areTypesComparable(st, u)
 * 		})
 * 	})
 * 	if caseType.flags&TypeFlagsNever != 0 {
 * 		return defaultType
 * 	}
 * 	return c.getUnionType([]*Type{caseType, defaultType})
 * }
 */
export function Checker_narrowTypeBySwitchOnDiscriminant(receiver: GoPtr<Checker>, t: GoPtr<Type>, data: GoPtr<FlowSwitchClauseData>): GoPtr<Type> {
  // We only narrow if all case expressions specify values with unit types, except for the case where
  // `type` is unknown. In this instance we map object types to the nonPrimitive type and narrow with that.
  const switchTypes = Checker_getSwitchClauseTypes(receiver, data!.SwitchStatement);
  if (switchTypes.length === 0) {
    return t;
  }
  const clauseTypes = switchTypes.slice(data!.ClauseStart, data!.ClauseEnd);
  const hasDefaultClause = data!.ClauseStart === data!.ClauseEnd || clauseTypes.includes(receiver!.neverType);
  if ((t!.flags & TypeFlagsUnknown) && !hasDefaultClause) {
    let groundClauseTypes: GoSlice<GoPtr<Type>> | undefined = undefined;
    for (let i = 0; i < clauseTypes.length; i++) {
      const s = clauseTypes[i];
      if (s!.flags & (TypeFlagsPrimitive | TypeFlagsNonPrimitive)) {
        if (groundClauseTypes !== undefined) {
          groundClauseTypes = [...groundClauseTypes, s];
        }
      } else if (s!.flags & TypeFlagsObject) {
        if (groundClauseTypes === undefined) {
          groundClauseTypes = clauseTypes.slice(0, i);
        }
        groundClauseTypes = [...groundClauseTypes, receiver!.nonPrimitiveType];
      } else {
        return t;
      }
    }
    return Checker_getUnionType(receiver, groundClauseTypes === undefined ? clauseTypes : groundClauseTypes);
  }
  const discriminantType = Checker_getUnionType(receiver, clauseTypes);
  let caseType: GoPtr<Type>;
  if (discriminantType!.flags & TypeFlagsNever) {
    caseType = receiver!.neverType;
  } else {
    const filtered = Checker_filterType(receiver, t, (t) => Checker_areTypesComparable(receiver, discriminantType, t));
    caseType = Checker_replacePrimitivesWithLiterals(receiver, filtered, discriminantType);
  }
  if (!hasDefaultClause) {
    return caseType;
  }
  const defaultType = Checker_filterType(receiver, t, (t) => {
    if (!Checker_isUnitLikeType(receiver, t)) {
      return true;
    }
    const u = (t!.flags & TypeFlagsUndefined) ? receiver!.undefinedType : Checker_getRegularTypeOfLiteralType(receiver, Checker_extractUnitType(receiver, t));
    return !switchTypes.some((st) => isUnitType(st) && Checker_areTypesComparable(receiver, st, u));
  });
  if (caseType!.flags & TypeFlagsNever) {
    return defaultType;
  }
  return Checker_getUnionType(receiver, [caseType, defaultType]);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/flow.go::method::Checker.narrowTypeBySwitchOnTypeOf","kind":"method","status":"implemented","sigHash":"2ca20136be5650b1e7aa2d366e610a5a03cc4231d241619b52a0cc2b8157b85b","bodyHash":"7da76c7f45d578f5821271b3ac5170d25cadce841c6d8f9ed81672515deb4041"}
 *
 * Go source:
 * func (c *Checker) narrowTypeBySwitchOnTypeOf(t *Type, data *ast.FlowSwitchClauseData) *Type {
 * 	witnesses := c.getSwitchClauseTypeOfWitnesses(data.SwitchStatement)
 * 	if witnesses == nil {
 * 		return t
 * 	}
 * 	clauses := data.SwitchStatement.AsSwitchStatement().CaseBlock.AsCaseBlock().Clauses.Nodes
 * 	// Equal start and end denotes implicit fallthrough; undefined marks explicit default clause.
 * 	defaultIndex := core.FindIndex(clauses, func(clause *ast.Node) bool {
 * 		return clause.Kind == ast.KindDefaultClause
 * 	})
 * 	clauseStart := int(data.ClauseStart)
 * 	clauseEnd := int(data.ClauseEnd)
 * 	hasDefaultClause := clauseStart == clauseEnd || (defaultIndex >= clauseStart && defaultIndex < clauseEnd)
 * 	if hasDefaultClause {
 * 		// In the default clause we filter constituents down to those that are not-equal to all handled cases.
 * 		notEqualFacts := c.getNotEqualFactsFromTypeofSwitch(clauseStart, clauseEnd, witnesses)
 * 		return c.filterType(t, func(t *Type) bool {
 * 			return c.getTypeFacts(t, notEqualFacts) == notEqualFacts
 * 		})
 * 	}
 * 	// In the non-default cause we create a union of the type narrowed by each of the listed cases.
 * 	clauseWitnesses := witnesses[clauseStart:clauseEnd]
 * 	return c.getUnionType(core.Map(clauseWitnesses, func(text string) *Type {
 * 		if text != "" {
 * 			return c.narrowTypeByTypeName(t, text)
 * 		}
 * 		return c.neverType
 * 	}))
 * }
 */
export function Checker_narrowTypeBySwitchOnTypeOf(receiver: GoPtr<Checker>, t: GoPtr<Type>, data: GoPtr<FlowSwitchClauseData>): GoPtr<Type> {
  const witnesses = Checker_getSwitchClauseTypeOfWitnesses(receiver, data!.SwitchStatement);
  if (witnesses === undefined) {
    return t;
  }
  const switchStmt = AsSwitchStatement(data!.SwitchStatement);
  const clauses: GoSlice<GoPtr<Node>> = AsCaseBlock(switchStmt!.CaseBlock as GoPtr<Node>)!.Clauses!.Nodes;
  // Equal start and end denotes implicit fallthrough; undefined marks explicit default clause.
  const defaultIndex = FindIndex(clauses, (clause) => clause!.Kind === KindDefaultClause);
  const clauseStart = data!.ClauseStart;
  const clauseEnd = data!.ClauseEnd;
  const hasDefaultClause = clauseStart === clauseEnd || (defaultIndex >= clauseStart && defaultIndex < clauseEnd);
  if (hasDefaultClause) {
    // In the default clause we filter constituents down to those that are not-equal to all handled cases.
    const notEqualFacts = Checker_getNotEqualFactsFromTypeofSwitch(receiver, clauseStart, clauseEnd, witnesses);
    return Checker_filterType(receiver, t, (t) => Checker_getTypeFacts(receiver, t, notEqualFacts) === notEqualFacts);
  }
  // In the non-default case we create a union of the type narrowed by each of the listed cases.
  const clauseWitnesses = witnesses.slice(clauseStart, clauseEnd);
  return Checker_getUnionType(receiver, core_Map(clauseWitnesses, (text) => {
    if (text !== "") {
      return Checker_narrowTypeByTypeName(receiver, t, text);
    }
    return receiver!.neverType;
  }));
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/flow.go::method::Checker.narrowTypeBySwitchOnTrue","kind":"method","status":"implemented","sigHash":"e555de3ef645e0efcdf217dd2da50178d2775e79c64d5dfb820297e7a9e0996f","bodyHash":"c986372dcbe6185cd6d78700d7f1259ce7706a5971b426ed525156f4af02eceb"}
 *
 * Go source:
 * func (c *Checker) narrowTypeBySwitchOnTrue(f *FlowState, t *Type, data *ast.FlowSwitchClauseData) *Type {
 * 	clauses := data.SwitchStatement.AsSwitchStatement().CaseBlock.AsCaseBlock().Clauses.Nodes
 * 	defaultIndex := core.FindIndex(clauses, func(clause *ast.Node) bool {
 * 		return clause.Kind == ast.KindDefaultClause
 * 	})
 * 	clauseStart := int(data.ClauseStart)
 * 	clauseEnd := int(data.ClauseEnd)
 * 	hasDefaultClause := clauseStart == clauseEnd || (defaultIndex >= clauseStart && defaultIndex < clauseEnd)
 * 	// First, narrow away all of the cases that preceded this set of cases.
 * 	for i := range clauseStart {
 * 		clause := clauses[i]
 * 		if clause.Kind == ast.KindCaseClause {
 * 			t = c.narrowType(f, t, clause.Expression(), false /*assumeTrue* /)
 * 		}
 * 	}
 * 	// If our current set has a default, then none the other cases were hit either.
 * 	// There's no point in narrowing by the other cases in the set, since we can
 * 	// get here through other paths.
 * 	if hasDefaultClause {
 * 		for i := clauseEnd; i < len(clauses); i++ {
 * 			clause := clauses[i]
 * 			if clause.Kind == ast.KindCaseClause {
 * 				t = c.narrowType(f, t, clause.Expression(), false /*assumeTrue* /)
 * 			}
 * 		}
 * 		return t
 * 	}
 * 	// Now, narrow based on the cases in this set.
 * 	return c.getUnionType(core.Map(clauses[clauseStart:clauseEnd], func(clause *ast.Node) *Type {
 * 		if clause.Kind == ast.KindCaseClause {
 * 			return c.narrowType(f, t, clause.Expression(), true /*assumeTrue* /)
 * 		}
 * 		return c.neverType
 * 	}))
 * }
 */
export function Checker_narrowTypeBySwitchOnTrue(receiver: GoPtr<Checker>, f: GoPtr<FlowState>, t: GoPtr<Type>, data: GoPtr<FlowSwitchClauseData>): GoPtr<Type> {
  const clauses = AsCaseBlock(AsSwitchStatement(data!.SwitchStatement)!.CaseBlock as GoPtr<Node>)!.Clauses!.Nodes;
  const defaultIndex = FindIndex(clauses, (clause) => clause!.Kind === KindDefaultClause);
  const clauseStart = data!.ClauseStart;
  const clauseEnd = data!.ClauseEnd;
  const hasDefaultClause = clauseStart === clauseEnd || (defaultIndex >= clauseStart && defaultIndex < clauseEnd);
  // First, narrow away all of the cases that preceded this set of cases.
  let localT = t;
  for (let i = 0; i < clauseStart; i++) {
    const clause = clauses[i];
    if (clause!.Kind === KindCaseClause) {
      localT = Checker_narrowType(receiver, f, localT, Node_Expression(clause), false /*assumeTrue*/);
    }
  }
  // If our current set has a default, then none the other cases were hit either.
  // There's no point in narrowing by the other cases in the set, since we can
  // get here through other paths.
  if (hasDefaultClause) {
    for (let i = clauseEnd; i < clauses.length; i++) {
      const clause = clauses[i];
      if (clause!.Kind === KindCaseClause) {
        localT = Checker_narrowType(receiver, f, localT, Node_Expression(clause), false /*assumeTrue*/);
      }
    }
    return localT;
  }
  // Now, narrow based on the cases in this set.
  return Checker_getUnionType(receiver, core_Map(clauses.slice(clauseStart, clauseEnd), (clause) => {
    if (clause!.Kind === KindCaseClause) {
      return Checker_narrowType(receiver, f, localT, Node_Expression(clause), true /*assumeTrue*/);
    }
    return receiver!.neverType;
  }));
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/flow.go::method::Checker.narrowTypeBySwitchOptionalChainContainment","kind":"method","status":"implemented","sigHash":"5df1d85c8d0d38e68a8250dd80e164356aecd43dedb2019b09ea18562acb11dd","bodyHash":"238ac6d519703d462525f267487231cd065a74a2314ab9949cfaafce7c9c7b74"}
 *
 * Go source:
 * func (c *Checker) narrowTypeBySwitchOptionalChainContainment(t *Type, data *ast.FlowSwitchClauseData, clauseCheck func(t *Type) bool) *Type {
 * 	everyClauseChecks := data.ClauseStart != data.ClauseEnd && core.Every(c.getSwitchClauseTypes(data.SwitchStatement)[data.ClauseStart:data.ClauseEnd], clauseCheck)
 * 	if everyClauseChecks {
 * 		return c.getTypeWithFacts(t, TypeFactsNEUndefinedOrNull)
 * 	}
 * 	return t
 * }
 */
export function Checker_narrowTypeBySwitchOptionalChainContainment(receiver: GoPtr<Checker>, t: GoPtr<Type>, data: GoPtr<FlowSwitchClauseData>, clauseCheck: (t: GoPtr<Type>) => bool): GoPtr<Type> {
  const everyClauseChecks = data!.ClauseStart !== data!.ClauseEnd && Every(Checker_getSwitchClauseTypes(receiver, data!.SwitchStatement).slice(data!.ClauseStart, data!.ClauseEnd), clauseCheck);
  if (everyClauseChecks) {
    return Checker_getTypeWithFacts(receiver, t, TypeFactsNEUndefinedOrNull);
  }
  return t;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/flow.go::method::Checker.narrowTypeBySwitchOnDiscriminantProperty","kind":"method","status":"implemented","sigHash":"3720f94fd790a63b1e1476a4ae8cf287787c29ebd0783fa23fb7fe4c9ee1407d","bodyHash":"caee8debca5f19f0b2906010910361f104fc1a91267120bbfc48833b9390ed20"}
 *
 * Go source:
 * func (c *Checker) narrowTypeBySwitchOnDiscriminantProperty(t *Type, access *ast.Node, data *ast.FlowSwitchClauseData) *Type {
 * 	if data.ClauseStart < data.ClauseEnd && t.flags&TypeFlagsUnion != 0 {
 * 		accessedName, _ := c.getAccessedPropertyName(access)
 * 		if accessedName != "" && c.getKeyPropertyName(t) == accessedName {
 * 			clauseTypes := c.getSwitchClauseTypes(data.SwitchStatement)[data.ClauseStart:data.ClauseEnd]
 * 			candidate := c.getUnionType(core.Map(clauseTypes, func(s *Type) *Type {
 * 				result := c.getConstituentTypeForKeyType(t, s)
 * 				if result != nil {
 * 					return result
 * 				}
 * 				return c.unknownType
 * 			}))
 * 			if candidate != c.unknownType {
 * 				return candidate
 * 			}
 * 		}
 * 	}
 * 	return c.narrowTypeByDiscriminant(t, access, func(t *Type) *Type {
 * 		return c.narrowTypeBySwitchOnDiscriminant(t, data)
 * 	})
 * }
 */
export function Checker_narrowTypeBySwitchOnDiscriminantProperty(receiver: GoPtr<Checker>, t: GoPtr<Type>, access: GoPtr<Node>, data: GoPtr<FlowSwitchClauseData>): GoPtr<Type> {
  if (data!.ClauseStart < data!.ClauseEnd && t!.flags & TypeFlagsUnion) {
    const [accessedName] = Checker_getAccessedPropertyName(receiver, access);
    if (accessedName !== "" && Checker_getKeyPropertyName(receiver, t) === accessedName) {
      const clauseTypes = Checker_getSwitchClauseTypes(receiver, data!.SwitchStatement).slice(data!.ClauseStart, data!.ClauseEnd);
      const candidate = Checker_getUnionType(receiver, core_Map(clauseTypes, (s) => {
        const result = Checker_getConstituentTypeForKeyType(receiver, t, s);
        if (result !== undefined) {
          return result;
        }
        return receiver!.unknownType;
      }));
      if (candidate !== receiver!.unknownType) {
        return candidate;
      }
    }
  }
  return Checker_narrowTypeByDiscriminant(receiver, t, access, (t) => Checker_narrowTypeBySwitchOnDiscriminant(receiver, t, data));
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/flow.go::method::Checker.getTypeAtFlowBranchLabel","kind":"method","status":"implemented","sigHash":"cb03b39a28c6f458843db91b8c9103d7f25b38cce896f975496b6be9a627fe44","bodyHash":"6b6e01a05334913024cbfc3b5a22e704848996a68a97e9098c7399823f7ba890"}
 *
 * Go source:
 * func (c *Checker) getTypeAtFlowBranchLabel(f *FlowState, flow *ast.FlowNode, antecedents *ast.FlowList) FlowType {
 * 	antecedentStart := len(c.antecedentTypes)
 * 	subtypeReduction := false
 * 	seenIncomplete := false
 * 	var bypassFlow *ast.FlowNode
 * 	for list := antecedents; list != nil; list = list.Next {
 * 		antecedent := list.Flow
 * 		if bypassFlow == nil && antecedent.Flags&ast.FlowFlagsSwitchClause != 0 && antecedent.Node.AsFlowSwitchClauseData().IsEmpty() {
 * 			// The antecedent is the bypass branch of a potentially exhaustive switch statement.
 * 			bypassFlow = antecedent
 * 			continue
 * 		}
 * 		flowType := c.getTypeAtFlowNode(f, antecedent)
 * 		// If the type at a particular antecedent path is the declared type and the
 * 		// reference is known to always be assigned (i.e. when declared and initial types
 * 		// are the same), there is no reason to process more antecedents since the only
 * 		// possible outcome is subtypes that will be removed in the final union type anyway.
 * 		if flowType.t == f.declaredType && f.declaredType == f.initialType {
 * 			c.antecedentTypes = c.antecedentTypes[:antecedentStart]
 * 			return FlowType{t: flowType.t}
 * 		}
 * 		if !slices.Contains(c.antecedentTypes[antecedentStart:], flowType.t) {
 * 			c.antecedentTypes = append(c.antecedentTypes, flowType.t)
 * 		}
 * 		// If an antecedent type is not a subset of the declared type, we need to perform
 * 		// subtype reduction. This happens when a "foreign" type is injected into the control
 * 		// flow using the instanceof operator or a user defined type predicate.
 * 		if !c.isTypeSubsetOf(flowType.t, f.initialType) {
 * 			subtypeReduction = true
 * 		}
 * 		if flowType.incomplete {
 * 			seenIncomplete = true
 * 		}
 * 	}
 * 	if bypassFlow != nil {
 * 		flowType := c.getTypeAtFlowNode(f, bypassFlow)
 * 		// If the bypass flow contributes a type we haven't seen yet and the switch statement
 * 		// isn't exhaustive, process the bypass flow type. Since exhaustiveness checks increase
 * 		// the risk of circularities, we only want to perform them when they make a difference.
 * 		if flowType.t.flags&TypeFlagsNever == 0 && !slices.Contains(c.antecedentTypes[antecedentStart:], flowType.t) && !c.isExhaustiveSwitchStatement(bypassFlow.Node.AsFlowSwitchClauseData().SwitchStatement) {
 * 			if flowType.t == f.declaredType && f.declaredType == f.initialType {
 * 				c.antecedentTypes = c.antecedentTypes[:antecedentStart]
 * 				return FlowType{t: flowType.t}
 * 			}
 * 			c.antecedentTypes = append(c.antecedentTypes, flowType.t)
 * 			if !c.isTypeSubsetOf(flowType.t, f.initialType) {
 * 				subtypeReduction = true
 * 			}
 * 			if flowType.incomplete {
 * 				seenIncomplete = true
 * 			}
 * 		}
 * 	}
 * 	result := c.newFlowType(c.getUnionOrEvolvingArrayType(f, c.antecedentTypes[antecedentStart:], core.IfElse(subtypeReduction, UnionReductionSubtype, UnionReductionLiteral)), seenIncomplete)
 * 	c.antecedentTypes = c.antecedentTypes[:antecedentStart]
 * 	return result
 * }
 */
export function Checker_getTypeAtFlowBranchLabel(receiver: GoPtr<Checker>, f: GoPtr<FlowState>, flow: GoPtr<FlowNode>, antecedents: GoPtr<FlowList>): FlowType {
  const antecedentStart = receiver!.antecedentTypes.length;
  let subtypeReduction = false;
  let seenIncomplete = false;
  let bypassFlow: GoPtr<FlowNode> = undefined;
  for (let list = antecedents; list !== undefined; list = list!.Next) {
    const antecedent = list!.Flow;
    if (bypassFlow === undefined && antecedent!.Flags & FlowFlagsSwitchClause && FlowSwitchClauseData_IsEmpty(Node_AsFlowSwitchClauseData(antecedent!.Node))) {
      // The antecedent is the bypass branch of a potentially exhaustive switch statement.
      bypassFlow = antecedent;
      continue;
    }
    const flowType = Checker_getTypeAtFlowNode(receiver, f, antecedent);
    // If the type at a particular antecedent path is the declared type and the
    // reference is known to always be assigned, there is no reason to process more antecedents.
    if (flowType.t === f!.declaredType && f!.declaredType === f!.initialType) {
      receiver!.antecedentTypes.length = antecedentStart;
      return { t: flowType.t, incomplete: false };
    }
    if (!receiver!.antecedentTypes.slice(antecedentStart).includes(flowType.t)) {
      receiver!.antecedentTypes.push(flowType.t);
    }
    // If an antecedent type is not a subset of the declared type, we need to perform subtype reduction.
    if (!Checker_isTypeSubsetOf(receiver, flowType.t, f!.initialType)) {
      subtypeReduction = true;
    }
    if (flowType.incomplete) {
      seenIncomplete = true;
    }
  }
  if (bypassFlow !== undefined) {
    const flowType = Checker_getTypeAtFlowNode(receiver, f, bypassFlow);
    // If the bypass flow contributes a type we haven't seen yet and the switch statement
    // isn't exhaustive, process the bypass flow type.
    if (!(flowType.t!.flags & TypeFlagsNever) && !receiver!.antecedentTypes.slice(antecedentStart).includes(flowType.t) && !Checker_isExhaustiveSwitchStatement(receiver, Node_AsFlowSwitchClauseData(bypassFlow!.Node)!.SwitchStatement)) {
      if (flowType.t === f!.declaredType && f!.declaredType === f!.initialType) {
        receiver!.antecedentTypes.length = antecedentStart;
        return { t: flowType.t, incomplete: false };
      }
      receiver!.antecedentTypes.push(flowType.t);
      if (!Checker_isTypeSubsetOf(receiver, flowType.t, f!.initialType)) {
        subtypeReduction = true;
      }
      if (flowType.incomplete) {
        seenIncomplete = true;
      }
    }
  }
  const result = Checker_newFlowType(receiver, Checker_getUnionOrEvolvingArrayType(receiver, f, receiver!.antecedentTypes.slice(antecedentStart), IfElse(subtypeReduction, UnionReductionSubtype, UnionReductionLiteral)), seenIncomplete);
  receiver!.antecedentTypes.length = antecedentStart;
  return result;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/flow.go::method::Checker.getUnionOrEvolvingArrayType","kind":"method","status":"implemented","sigHash":"21f78d60a66eb87ee9c177163c01ea656494136a70ce93880385afe2b46bbbbc","bodyHash":"3ef82c2a6274796f0270cb6933a2394395b6356b1b03654fe4df9bdf705b5a2e"}
 *
 * Go source:
 * func (c *Checker) getUnionOrEvolvingArrayType(f *FlowState, types []*Type, subtypeReduction UnionReduction) *Type {
 * 	if isEvolvingArrayTypeList(types) {
 * 		return c.getEvolvingArrayType(c.getUnionType(core.Map(types, c.getElementTypeOfEvolvingArrayType)))
 * 	}
 * 	result := c.recombineUnknownType(c.getUnionTypeEx(core.SameMap(types, c.finalizeEvolvingArrayType), subtypeReduction, nil, nil))
 * 	if result != f.declaredType && result.flags&f.declaredType.flags&TypeFlagsUnion != 0 && slices.Equal(result.AsUnionType().types, f.declaredType.AsUnionType().types) {
 * 		return f.declaredType
 * 	}
 * 	return result
 * }
 */
export function Checker_getUnionOrEvolvingArrayType(receiver: GoPtr<Checker>, f: GoPtr<FlowState>, types: GoSlice<GoPtr<Type>>, subtypeReduction: UnionReduction): GoPtr<Type> {
  if (isEvolvingArrayTypeList(types)) {
    return Checker_getEvolvingArrayType(receiver, Checker_getUnionType(receiver, core_Map(types, (t) => Checker_getElementTypeOfEvolvingArrayType(receiver, t))));
  }
  const result = Checker_recombineUnknownType(receiver, Checker_getUnionTypeEx(receiver, SameMap(types, (t) => Checker_finalizeEvolvingArrayType(receiver, t)), subtypeReduction, undefined, undefined));
  // If the result is the same types as declared type's union, return declared type for identity
  if (result !== f!.declaredType && (result!.flags & f!.declaredType!.flags & TypeFlagsUnion)) {
    const resultUnion = Type_AsUnionOrIntersectionType(result);
    const declaredUnion = Type_AsUnionOrIntersectionType(f!.declaredType);
    if (resultUnion !== undefined && declaredUnion !== undefined &&
        resultUnion!.types.length === declaredUnion!.types.length &&
        resultUnion!.types.every((t, i) => t === declaredUnion!.types[i])) {
      return f!.declaredType;
    }
  }
  return result;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/flow.go::method::Checker.getTypeAtFlowLoopLabel","kind":"method","status":"implemented","sigHash":"2afb99ad9f9e5ce8c294e53c6b498a9da800bdd8870f23d8eaf2014d8875bc08","bodyHash":"46d55ddd89877ec566bb807f56ee2a6fcbc959f309941ce90a83675af0df170c"}
 *
 * Go source:
 * func (c *Checker) getTypeAtFlowLoopLabel(f *FlowState, flow *ast.FlowNode) FlowType {
 * 	if f.refKey.IsZero() {
 * 		f.refKey = c.getFlowReferenceKey(f)
 * 	}
 * 	if f.refKey == nonDottedNameCacheKey {
 * 		// No cache key is generated when binding patterns are in unnarrowable situations
 * 		return FlowType{t: f.declaredType}
 * 	}
 * 	key := FlowLoopKey{flowNode: flow, refKey: f.refKey}
 * 	// If we have previously computed the control flow type for the reference at
 * 	// this flow loop junction, return the cached type.
 * 	if cached := c.flowLoopCache[key]; cached != nil {
 * 		return FlowType{t: cached}
 * 	}
 * 	// If this flow loop junction and reference are already being processed, return
 * 	// the union of the types computed for each branch so far, marked as incomplete.
 * 	// It is possible to see an empty array in cases where loops are nested and the
 * 	// back edge of the outer loop reaches an inner loop that is already being analyzed.
 * 	// In such cases we restart the analysis of the inner loop, which will then see
 * 	// a non-empty in-process array for the outer loop and eventually terminate because
 * 	// the first antecedent of a loop junction is always the non-looping control flow
 * 	// path that leads to the top.
 * 	for _, loopInfo := range c.flowLoopStack {
 * 		if loopInfo.key == key && len(loopInfo.types) != 0 {
 * 			return c.newFlowType(c.getUnionOrEvolvingArrayType(f, loopInfo.types, UnionReductionLiteral), true /*incomplete* /)
 * 		}
 * 	}
 * 	// Add the flow loop junction and reference to the in-process stack and analyze
 * 	// each antecedent code path.
 * 	antecedentTypes := make([]*Type, 0, 4)
 * 	subtypeReduction := false
 * 	var firstAntecedentType FlowType
 * 	for list := flow.Antecedents; list != nil; list = list.Next {
 * 		var flowType FlowType
 * 		if firstAntecedentType.isNil() {
 * 			// The first antecedent of a loop junction is always the non-looping control
 * 			// flow path that leads to the top.
 * 			firstAntecedentType = c.getTypeAtFlowNode(f, list.Flow)
 * 			flowType = firstAntecedentType
 * 		} else {
 * 			// All but the first antecedent are the looping control flow paths that lead
 * 			// back to the loop junction. We track these on the flow loop stack.
 * 			c.flowLoopStack = append(c.flowLoopStack, FlowLoopInfo{key: key, types: antecedentTypes})
 * 			saveFlowTypeCache := c.flowTypeCache
 * 			c.flowTypeCache = nil
 * 			flowType = c.getTypeAtFlowNode(f, list.Flow)
 * 			c.flowTypeCache = saveFlowTypeCache
 * 			c.flowLoopStack = c.flowLoopStack[:len(c.flowLoopStack)-1]
 * 			// If we see a value appear in the cache it is a sign that control flow analysis
 * 			// was restarted and completed by checkExpressionCached. We can simply pick up
 * 			// the resulting type and bail out.
 * 			if cached := c.flowLoopCache[key]; cached != nil {
 * 				return FlowType{t: cached}
 * 			}
 * 		}
 * 		antecedentTypes = core.AppendIfUnique(antecedentTypes, flowType.t)
 * 		// If an antecedent type is not a subset of the declared type, we need to perform
 * 		// subtype reduction. This happens when a "foreign" type is injected into the control
 * 		// flow using the instanceof operator or a user defined type predicate.
 * 		if !c.isTypeSubsetOf(flowType.t, f.initialType) {
 * 			subtypeReduction = true
 * 		}
 * 		// If the type at a particular antecedent path is the declared type there is no
 * 		// reason to process more antecedents since the only possible outcome is subtypes
 * 		// that will be removed in the final union type anyway.
 * 		if flowType.t == f.declaredType {
 * 			break
 * 		}
 * 	}
 * 	// The result is incomplete if the first antecedent (the non-looping control flow path)
 * 	// is incomplete.
 * 	result := c.getUnionOrEvolvingArrayType(f, antecedentTypes, core.IfElse(subtypeReduction, UnionReductionSubtype, UnionReductionLiteral))
 * 	if firstAntecedentType.incomplete {
 * 		return c.newFlowType(result, true /*incomplete* /)
 * 	}
 * 	c.flowLoopCache[key] = result
 * 	return FlowType{t: result}
 * }
 */
export function Checker_getTypeAtFlowLoopLabel(receiver: GoPtr<Checker>, f: GoPtr<FlowState>, flow: GoPtr<FlowNode>): FlowType {
  if (CacheHashKey_IsZero(f!.refKey)) {
    f!.refKey = Checker_getFlowReferenceKey(receiver, f);
  }
  if (f!.refKey === nonDottedNameCacheKey) {
    // No cache key is generated when binding patterns are in unnarrowable situations
    return { t: f!.declaredType, incomplete: false };
  }
  const key = getFlowLoopKey(flow, f!.refKey);
  // If we have previously computed the control flow type for the reference at
  // this flow loop junction, return the cached type.
  const cached = receiver!.flowLoopCache.get(key);
  if (cached !== undefined) {
    return { t: cached, incomplete: false };
  }
  // If this flow loop junction and reference are already being processed, return
  // the union of the types computed for each branch so far, marked as incomplete.
  for (const loopInfo of receiver!.flowLoopStack) {
    if (loopInfo.key === key && loopInfo.types.length !== 0) {
      return Checker_newFlowType(receiver, Checker_getUnionOrEvolvingArrayType(receiver, f, loopInfo.types, UnionReductionLiteral), true /*incomplete*/);
    }
  }
  // Add the flow loop junction and reference to the in-process stack and analyze each antecedent code path.
  let antecedentTypes: GoSlice<GoPtr<Type>> = [];
  let subtypeReduction = false;
  let firstAntecedentType: FlowType = { t: undefined, incomplete: false };
  let firstAntecedentSeen = false;
  for (let list = flow!.Antecedents; list !== undefined; list = list!.Next) {
    let flowType: FlowType;
    if (!firstAntecedentSeen) {
      // The first antecedent of a loop junction is always the non-looping control
      // flow path that leads to the top.
      firstAntecedentType = Checker_getTypeAtFlowNode(receiver, f, list!.Flow);
      flowType = firstAntecedentType;
      firstAntecedentSeen = true;
    } else {
      // All but the first antecedent are the looping control flow paths that lead
      // back to the loop junction. We track these on the flow loop stack.
      receiver!.flowLoopStack.push({ key, types: antecedentTypes });
      const saveFlowTypeCache = receiver!.flowTypeCache;
      receiver!.flowTypeCache = undefined as never;
      flowType = Checker_getTypeAtFlowNode(receiver, f, list!.Flow);
      receiver!.flowTypeCache = saveFlowTypeCache;
      receiver!.flowLoopStack.pop();
      // If we see a value appear in the cache it is a sign that control flow analysis
      // was restarted and completed by checkExpressionCached. We can simply pick up
      // the resulting type and bail out.
      const cachedAfter = receiver!.flowLoopCache.get(key);
      if (cachedAfter !== undefined) {
        return { t: cachedAfter, incomplete: false };
      }
    }
    antecedentTypes = AppendIfUnique(antecedentTypes, flowType.t);
    // If an antecedent type is not a subset of the declared type, we need to perform subtype reduction.
    if (!Checker_isTypeSubsetOf(receiver, flowType.t, f!.initialType)) {
      subtypeReduction = true;
    }
    // If the type at a particular antecedent path is the declared type there is no
    // reason to process more antecedents.
    if (flowType.t === f!.declaredType) {
      break;
    }
  }
  // The result is incomplete if the first antecedent (the non-looping control flow path) is incomplete.
  const result = Checker_getUnionOrEvolvingArrayType(receiver, f, antecedentTypes, IfElse(subtypeReduction, UnionReductionSubtype, UnionReductionLiteral));
  if (firstAntecedentType.incomplete) {
    return Checker_newFlowType(receiver, result, true /*incomplete*/);
  }
  receiver!.flowLoopCache.set(key, result);
  return { t: result, incomplete: false };
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/flow.go::method::Checker.getTypeAtFlowArrayMutation","kind":"method","status":"implemented","sigHash":"988d4c7809d22db064c68fac4f6578af9cbf9026a989e63124833c7a2145de07","bodyHash":"a8d4c17e3f651bf70d674915b3be7ad2aad5d3aa883dda593cd485d415e05061"}
 *
 * Go source:
 * func (c *Checker) getTypeAtFlowArrayMutation(f *FlowState, flow *ast.FlowNode) FlowType {
 * 	if f.declaredType == c.autoType || f.declaredType == c.autoArrayType {
 * 		node := flow.Node
 * 		var expr *ast.Node
 * 		if ast.IsCallExpression(node) {
 * 			expr = node.Expression().Expression()
 * 		} else {
 * 			expr = node.AsBinaryExpression().Left.Expression()
 * 		}
 * 		if c.isMatchingReference(f.reference, c.getReferenceCandidate(expr)) {
 * 			flowType := c.getTypeAtFlowNode(f, flow.Antecedent)
 * 			if flowType.t.objectFlags&ObjectFlagsEvolvingArray != 0 {
 * 				evolvedType := flowType.t
 * 				if ast.IsCallExpression(node) {
 * 					for _, arg := range node.Arguments() {
 * 						evolvedType = c.addEvolvingArrayElementType(evolvedType, arg)
 * 					}
 * 				} else {
 * 					// We must get the context free expression type so as to not recur in an uncached fashion on the LHS (which causes exponential blowup in compile time)
 * 					indexType := c.getContextFreeTypeOfExpression(node.AsBinaryExpression().Left.AsElementAccessExpression().ArgumentExpression)
 * 					if c.isTypeAssignableToKind(indexType, TypeFlagsNumberLike) {
 * 						evolvedType = c.addEvolvingArrayElementType(evolvedType, node.AsBinaryExpression().Right)
 * 					}
 * 				}
 * 				return c.newFlowType(evolvedType, flowType.incomplete)
 * 			}
 * 			return flowType
 * 		}
 * 	}
 * 	return FlowType{}
 * }
 */
export function Checker_getTypeAtFlowArrayMutation(receiver: GoPtr<Checker>, f: GoPtr<FlowState>, flow: GoPtr<FlowNode>): FlowType {
  if (f!.declaredType === receiver!.autoType || f!.declaredType === receiver!.autoArrayType) {
    const node = flow!.Node;
    let expr: GoPtr<Node>;
    if (IsCallExpression(node)) {
      expr = Node_Expression(Node_Expression(node));
    } else {
      expr = Node_Expression(AsBinaryExpression(node)!.Left);
    }
    if (Checker_isMatchingReference(receiver, f!.reference, Checker_getReferenceCandidate(receiver, expr))) {
      const flowType = Checker_getTypeAtFlowNode(receiver, f, flow!.Antecedent);
      if (flowType.t!.objectFlags & ObjectFlagsEvolvingArray) {
        let evolvedType = flowType.t;
        if (IsCallExpression(node)) {
          for (const arg of Node_Arguments(node)!) {
            evolvedType = Checker_addEvolvingArrayElementType(receiver, evolvedType, arg);
          }
        } else {
          // We must get the context free expression type so as to not recur in an uncached fashion on the LHS
          const indexType = Checker_getContextFreeTypeOfExpression(receiver, AsElementAccessExpression(AsBinaryExpression(node)!.Left)!.ArgumentExpression);
          if (Checker_isTypeAssignableToKind(receiver, indexType, TypeFlagsNumberLike)) {
            evolvedType = Checker_addEvolvingArrayElementType(receiver, evolvedType, AsBinaryExpression(node)!.Right);
          }
        }
        return Checker_newFlowType(receiver, evolvedType, flowType.incomplete);
      }
      return flowType;
    }
  }
  return { t: undefined, incomplete: false };
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/flow.go::method::Checker.getDiscriminantPropertyAccess","kind":"method","status":"implemented","sigHash":"7154d003755ad34bcd0bbc9b76e47d134be21d9e4c5bcf374f99e01782a8902c","bodyHash":"acb5273a113ebbe0eaaebf3e6d69af4fffd3d07a2161e36fa15c0385398f03b3"}
 *
 * Go source:
 * func (c *Checker) getDiscriminantPropertyAccess(f *FlowState, expr *ast.Node, computedType *Type) *ast.Node {
 * 	// As long as the computed type is a subset of the declared type, we use the full declared type to detect
 * 	// a discriminant property. In cases where the computed type isn't a subset, e.g because of a preceding type
 * 	// predicate narrowing, we use the actual computed type.
 * 	if f.declaredType.flags&TypeFlagsUnion != 0 || computedType.flags&TypeFlagsUnion != 0 {
 * 		access := c.getCandidateDiscriminantPropertyAccess(f, expr)
 * 		if access != nil {
 * 			if name, ok := c.getAccessedPropertyName(access); ok {
 * 				t := computedType
 * 				if f.declaredType.flags&TypeFlagsUnion != 0 && c.isTypeSubsetOf(computedType, f.declaredType) {
 * 					t = f.declaredType
 * 				}
 * 				if c.isDiscriminantProperty(t, name) {
 * 					return access
 * 				}
 * 			}
 * 		}
 * 	}
 * 	return nil
 * }
 */
export function Checker_getDiscriminantPropertyAccess(receiver: GoPtr<Checker>, f: GoPtr<FlowState>, expr: GoPtr<Node>, computedType: GoPtr<Type>): GoPtr<Node> {
  // As long as the computed type is a subset of the declared type, we use the full declared type to detect
  // a discriminant property.
  if ((f!.declaredType!.flags & TypeFlagsUnion) || (computedType!.flags & TypeFlagsUnion)) {
    const access = Checker_getCandidateDiscriminantPropertyAccess(receiver, f, expr);
    if (access !== undefined) {
      const [name, ok] = Checker_getAccessedPropertyName(receiver, access);
      if (ok) {
        let t = computedType;
        if ((f!.declaredType!.flags & TypeFlagsUnion) && Checker_isTypeSubsetOf(receiver, computedType, f!.declaredType)) {
          t = f!.declaredType;
        }
        if (Checker_isDiscriminantProperty(receiver, t, name)) {
          return access;
        }
      }
    }
  }
  return undefined;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/flow.go::method::Checker.getCandidateDiscriminantPropertyAccess","kind":"method","status":"implemented","sigHash":"113a3686ab572ef10dfb29de82d7ec3b4211bd3a519d6d0c9f6b603385b7d5eb","bodyHash":"eca0a141c8a3bb182c2a66e40e834d9aaeee76aa07ba1520b68ca951c6cf300c"}
 *
 * Go source:
 * func (c *Checker) getCandidateDiscriminantPropertyAccess(f *FlowState, expr *ast.Node) *ast.Node {
 * 	switch {
 * 	case ast.IsBindingPattern(f.reference) || ast.IsFunctionExpressionOrArrowFunction(f.reference) || ast.IsObjectLiteralMethod(f.reference):
 * 		// When the reference is a binding pattern or function or arrow expression, we are narrowing a pseudo-reference in
 * 		// getNarrowedTypeOfSymbol. An identifier for a destructuring variable declared in the same binding pattern or
 * 		// parameter declared in the same parameter list is a candidate.
 * 		if ast.IsIdentifier(expr) {
 * 			symbol := c.getResolvedSymbol(expr)
 * 			declaration := c.getExportSymbolOfValueSymbolIfExported(symbol).ValueDeclaration
 * 			if declaration != nil && (ast.IsBindingElement(declaration) || ast.IsParameterDeclaration(declaration)) && f.reference == declaration.Parent && declaration.Initializer() == nil && !hasDotDotDotToken(declaration) {
 * 				return declaration
 * 			}
 * 		}
 * 	case ast.IsAccessExpression(expr):
 * 		// An access expression is a candidate if the reference matches the left hand expression.
 * 		if c.isMatchingReference(f.reference, expr.Expression()) {
 * 			return expr
 * 		}
 * 	case ast.IsIdentifier(expr):
 * 		symbol := c.getResolvedSymbol(expr)
 * 		if c.isConstantVariable(symbol) {
 * 			declaration := symbol.ValueDeclaration
 * 			initializer := getCandidateVariableDeclarationInitializer(declaration)
 * 			// Given 'const x = obj.kind', allow 'x' as an alias for 'obj.kind'
 * 			if initializer != nil && ast.IsAccessExpression(initializer) && c.isMatchingReference(f.reference, initializer.Expression()) {
 * 				return initializer
 * 			}
 * 			// Given 'const { kind: x } = obj', allow 'x' as an alias for 'obj.kind'
 * 			if ast.IsBindingElement(declaration) && declaration.Initializer() == nil {
 * 				initializer = getCandidateVariableDeclarationInitializer(declaration.Parent.Parent)
 * 				if initializer != nil && (ast.IsIdentifier(initializer) || ast.IsAccessExpression(initializer)) && c.isMatchingReference(f.reference, initializer) {
 * 					return declaration
 * 				}
 * 			}
 * 		}
 * 	}
 * 	return nil
 * }
 */
export function Checker_getCandidateDiscriminantPropertyAccess(receiver: GoPtr<Checker>, f: GoPtr<FlowState>, expr: GoPtr<Node>): GoPtr<Node> {
  if (IsBindingPattern(f!.reference) || IsFunctionExpressionOrArrowFunction(f!.reference) || IsObjectLiteralMethod(f!.reference)) {
    if (IsIdentifier(expr)) {
      const symbol = Checker_getResolvedSymbol(receiver, expr);
      const declaration = Checker_getExportSymbolOfValueSymbolIfExported(receiver, symbol)!.ValueDeclaration;
      if (declaration !== undefined && (IsBindingElement(declaration) || IsParameterDeclaration(declaration)) && f!.reference === declaration!.Parent && Node_Initializer(declaration) === undefined && !hasDotDotDotToken(declaration)) {
        return declaration;
      }
    }
  } else if (IsAccessExpression(expr)) {
    if (Checker_isMatchingReference(receiver, f!.reference, Node_Expression(expr))) {
      return expr;
    }
  } else if (IsIdentifier(expr)) {
    const symbol = Checker_getResolvedSymbol(receiver, expr);
    if (Checker_isConstantVariable(receiver, symbol)) {
      const declaration = symbol!.ValueDeclaration;
      let initializer = getCandidateVariableDeclarationInitializer(declaration);
      if (initializer !== undefined && IsAccessExpression(initializer) && Checker_isMatchingReference(receiver, f!.reference, Node_Expression(initializer))) {
        return initializer;
      }
      if (IsBindingElement(declaration) && Node_Initializer(declaration) === undefined) {
        initializer = getCandidateVariableDeclarationInitializer(declaration!.Parent!.Parent);
        if (initializer !== undefined && (IsIdentifier(initializer) || IsAccessExpression(initializer)) && Checker_isMatchingReference(receiver, f!.reference, initializer)) {
          return declaration;
        }
      }
    }
  }
  return undefined;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/flow.go::func::getCandidateVariableDeclarationInitializer","kind":"func","status":"implemented","sigHash":"be663a52a59e0984d5942375508cbf7712d41fa4b2259181145d979cca7dc4ee","bodyHash":"fdbf31f5abd88a79122939a59da5391736a0cb826cc0628b4e4619f9cc06a3d0"}
 *
 * Go source:
 * func getCandidateVariableDeclarationInitializer(node *ast.Node) *ast.Node {
 * 	if ast.IsVariableDeclaration(node) && node.Type() == nil {
 * 		if initializer := node.Initializer(); initializer != nil {
 * 			return ast.SkipParentheses(initializer)
 * 		}
 * 	}
 * 	return nil
 * }
 */
export function getCandidateVariableDeclarationInitializer(node: GoPtr<Node>): GoPtr<Node> {
  if (IsVariableDeclaration(node) && Node_Type(node) === undefined) {
    const initializer = Node_Initializer(node);
    if (initializer !== undefined) {
      return SkipParentheses(initializer);
    }
  }
  return undefined;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/flow.go::method::Checker.getEvolvingArrayType","kind":"method","status":"implemented","sigHash":"c87ada02a9d1f753f5e5deeae38c28116aa7d78a5943f9669bf8cc0d764ac22c","bodyHash":"3a8de5d8cbad1f73768144f4199f6077c95bd925e552f0852d6d59db2587bcc0"}
 *
 * Go source:
 * func (c *Checker) getEvolvingArrayType(elementType *Type) *Type {
 * 	key := CachedTypeKey{kind: CachedTypeKindEvolvingArrayType, typeId: elementType.id}
 * 	result := c.cachedTypes[key]
 * 	if result == nil {
 * 		result = c.newObjectType(ObjectFlagsEvolvingArray, nil)
 * 		result.AsEvolvingArrayType().elementType = elementType
 * 		c.cachedTypes[key] = result
 * 	}
 * 	return result
 * }
 */
export function Checker_getEvolvingArrayType(receiver: GoPtr<Checker>, elementType: GoPtr<Type>): GoPtr<Type> {
  const key: CachedTypeKey = { kind: CachedTypeKindEvolvingArrayType, typeId: elementType!.id };
  let result = receiver!.cachedTypes.get(key);
  if (result === undefined) {
    result = Checker_newObjectType(receiver, ObjectFlagsEvolvingArray, undefined);
    Type_AsEvolvingArrayType(result)!.elementType = elementType;
    receiver!.cachedTypes.set(key, result);
  }
  return result;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/flow.go::method::Checker.getElementTypeOfEvolvingArrayType","kind":"method","status":"implemented","sigHash":"71d74a4a5007d220926ae0d2d786a1fcebdbbdeeef37aab2cc6c65934319cd97","bodyHash":"1b0e085daf56435681041ac300c89d1b31274a938be095a9946b742468d7edaf"}
 *
 * Go source:
 * func (c *Checker) getElementTypeOfEvolvingArrayType(t *Type) *Type {
 * 	if t.objectFlags&ObjectFlagsEvolvingArray != 0 {
 * 		return t.AsEvolvingArrayType().elementType
 * 	}
 * 	return c.neverType
 * }
 */
export function Checker_getElementTypeOfEvolvingArrayType(receiver: GoPtr<Checker>, t: GoPtr<Type>): GoPtr<Type> {
  if (t!.objectFlags & ObjectFlagsEvolvingArray) {
    return Type_AsEvolvingArrayType(t)!.elementType;
  }
  return receiver!.neverType;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/flow.go::func::isEvolvingArrayTypeList","kind":"func","status":"implemented","sigHash":"747a0bffa1482fc55ef4f6e9ee3197e5e95b13ce7b0084f370507fa77ddff3ce","bodyHash":"275d2c700d2a27df4d9e9b08813fbed9c0db0eac0e576b9ad765ffc6f2ccfe91"}
 *
 * Go source:
 * func isEvolvingArrayTypeList(types []*Type) bool {
 * 	hasEvolvingArrayType := false
 * 	for _, t := range types {
 * 		if t.flags&TypeFlagsNever == 0 {
 * 			if t.objectFlags&ObjectFlagsEvolvingArray == 0 {
 * 				return false
 * 			}
 * 			hasEvolvingArrayType = true
 * 		}
 * 	}
 * 	return hasEvolvingArrayType
 * }
 */
export function isEvolvingArrayTypeList(types: GoSlice<GoPtr<Type>>): bool {
  let hasEvolvingArrayType = false;
  for (const t of types) {
    if (!(t!.flags & TypeFlagsNever)) {
      if (!(t!.objectFlags & ObjectFlagsEvolvingArray)) {
        return false;
      }
      hasEvolvingArrayType = true;
    }
  }
  return hasEvolvingArrayType;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/flow.go::method::Checker.isEvolvingArrayOperationTarget","kind":"method","status":"implemented","sigHash":"a171a9bf88c1602fa0bcdf6fd22bcf87ab649767d6d5c09d369e3f6b6eec2737","bodyHash":"f3996ee72382610c32994e12a842a5adc815d839781f9742b3868499db988233"}
 *
 * Go source:
 * func (c *Checker) isEvolvingArrayOperationTarget(node *ast.Node) bool {
 * 	root := c.getReferenceRoot(node)
 * 	parent := root.Parent
 * 	isLengthPushOrUnshift := ast.IsPropertyAccessExpression(parent) && (parent.Name().Text() == "length" ||
 * 		ast.IsCallExpression(parent.Parent) && ast.IsIdentifier(parent.Name()) && ast.IsPushOrUnshiftIdentifier(parent.Name()))
 * 	isElementAssignment := ast.IsElementAccessExpression(parent) && parent.Expression() == root &&
 * 		ast.IsBinaryExpression(parent.Parent) && parent.Parent.AsBinaryExpression().OperatorToken.Kind == ast.KindEqualsToken &&
 * 		parent.Parent.AsBinaryExpression().Left == parent && !ast.IsAssignmentTarget(parent.Parent) &&
 * 		c.isTypeAssignableToKind(c.getTypeOfExpression(parent.AsElementAccessExpression().ArgumentExpression), TypeFlagsNumberLike)
 * 	return isLengthPushOrUnshift || isElementAssignment
 * }
 */
export function Checker_isEvolvingArrayOperationTarget(receiver: GoPtr<Checker>, node: GoPtr<Node>): bool {
  const root = Checker_getReferenceRoot(receiver, node);
  const parent = root!.Parent;
  const isLengthPushOrUnshift = IsPropertyAccessExpression(parent) &&
    (Node_Text(Node_Name(parent)) === "length" ||
      IsCallExpression(parent!.Parent) && IsIdentifier(Node_Name(parent)) && IsPushOrUnshiftIdentifier(Node_Name(parent)));
  const isElementAssignment = IsElementAccessExpression(parent) && Node_Expression(parent) === root &&
    IsBinaryExpression(parent!.Parent) && AsBinaryExpression(parent!.Parent!)!.OperatorToken!.Kind === KindEqualsToken &&
    AsBinaryExpression(parent!.Parent!)!.Left === parent && !IsAssignmentTarget(parent!.Parent) &&
    Checker_isTypeAssignableToKind(receiver, Checker_getTypeOfExpression(receiver, AsElementAccessExpression(parent)!.ArgumentExpression), TypeFlagsNumberLike);
  return isLengthPushOrUnshift || isElementAssignment;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/flow.go::method::Checker.addEvolvingArrayElementType","kind":"method","status":"implemented","sigHash":"6ee7f29739ac71556518319eb81ed3aaabf7f82a934c70e933e0177864c70438","bodyHash":"58cd05c1713c15c4d1ede8d9293ba7b1e9312ac9eb2150d0ab7404ac06900537"}
 *
 * Go source:
 * func (c *Checker) addEvolvingArrayElementType(evolvingArrayType *Type, node *ast.Node) *Type {
 * 	newElementType := c.getRegularTypeOfObjectLiteral(c.getBaseTypeOfLiteralType(c.getContextFreeTypeOfExpression(node)))
 * 	elementType := evolvingArrayType.AsEvolvingArrayType().elementType
 * 	if c.isTypeSubsetOf(newElementType, elementType) {
 * 		return evolvingArrayType
 * 	}
 * 	return c.getEvolvingArrayType(c.getUnionType([]*Type{elementType, newElementType}))
 * }
 */
export function Checker_addEvolvingArrayElementType(receiver: GoPtr<Checker>, evolvingArrayType: GoPtr<Type>, node: GoPtr<Node>): GoPtr<Type> {
  const newElementType = Checker_getRegularTypeOfObjectLiteral(receiver, Checker_getBaseTypeOfLiteralType(receiver, Checker_getContextFreeTypeOfExpression(receiver, node)));
  const elementType = Type_AsEvolvingArrayType(evolvingArrayType)!.elementType;
  if (Checker_isTypeSubsetOf(receiver, newElementType, elementType)) {
    return evolvingArrayType;
  }
  return Checker_getEvolvingArrayType(receiver, Checker_getUnionType(receiver, [elementType, newElementType]));
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/flow.go::method::Checker.finalizeEvolvingArrayType","kind":"method","status":"implemented","sigHash":"9d7852d770e766df30fa9d986c0cae930f9a07d5518c4209d3abf799ea013f36","bodyHash":"ad964b499ce869fed12127746f608c8828e4400d1b088ea8e76057f335cd817c"}
 *
 * Go source:
 * func (c *Checker) finalizeEvolvingArrayType(t *Type) *Type {
 * 	if t.objectFlags&ObjectFlagsEvolvingArray != 0 {
 * 		return c.getFinalArrayType(t.AsEvolvingArrayType())
 * 	}
 * 	return t
 * }
 */
export function Checker_finalizeEvolvingArrayType(receiver: GoPtr<Checker>, t: GoPtr<Type>): GoPtr<Type> {
  if (t!.objectFlags & ObjectFlagsEvolvingArray) {
    return Checker_getFinalArrayType(receiver, Type_AsEvolvingArrayType(t));
  }
  return t;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/flow.go::method::Checker.getFinalArrayType","kind":"method","status":"implemented","sigHash":"f1c2f931fa1747f0e336b4204f1c1d26609d2fb2bd2a92ca6c93d6df5f06adb9","bodyHash":"0d051e9339a43d022f61d1659b6e26d12f68842c8c5d03e765282a58b4c9e533"}
 *
 * Go source:
 * func (c *Checker) getFinalArrayType(t *EvolvingArrayType) *Type {
 * 	if t.finalArrayType == nil {
 * 		t.finalArrayType = c.createFinalArrayType(t.elementType)
 * 	}
 * 	return t.finalArrayType
 * }
 */
export function Checker_getFinalArrayType(receiver: GoPtr<Checker>, t: GoPtr<EvolvingArrayType>): GoPtr<Type> {
  if (t!.finalArrayType === undefined) {
    t!.finalArrayType = Checker_createFinalArrayType(receiver, t!.elementType);
  }
  return t!.finalArrayType;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/flow.go::method::Checker.createFinalArrayType","kind":"method","status":"implemented","sigHash":"aae8ff70349b1d82c6185e0ce8957ab6315df86100d70a298e8b6e09b899cf50","bodyHash":"18015ddc7fea97fea8a5121d409fec83f04d2b38de6c45c3d3cb2c06105f62a1"}
 *
 * Go source:
 * func (c *Checker) createFinalArrayType(elementType *Type) *Type {
 * 	switch {
 * 	case elementType.flags&TypeFlagsNever != 0:
 * 		return c.autoArrayType
 * 	case elementType.flags&TypeFlagsUnion != 0:
 * 		return c.createArrayType(c.getUnionTypeEx(elementType.Types(), UnionReductionSubtype, nil, nil))
 * 	}
 * 	return c.createArrayType(elementType)
 * }
 */
export function Checker_createFinalArrayType(receiver: GoPtr<Checker>, elementType: GoPtr<Type>): GoPtr<Type> {
  if (elementType!.flags & TypeFlagsNever) {
    return receiver!.autoArrayType;
  }
  if (elementType!.flags & TypeFlagsUnion) {
    return Checker_createArrayType(receiver, Checker_getUnionTypeEx(receiver, Type_AsUnionOrIntersectionType(elementType)!.types, UnionReductionSubtype, undefined, undefined));
  }
  return Checker_createArrayType(receiver, elementType);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/flow.go::method::Checker.reportFlowControlError","kind":"method","status":"implemented","sigHash":"68ed81198cbced5a42afc2c55cfb67a63d396056ca54bd7eb77ddd22275f91b5","bodyHash":"9891d9d77ef6a30a484b82f09b41483c4f82ee8012e11874ed76fbc3660e70d7"}
 *
 * Go source:
 * func (c *Checker) reportFlowControlError(node *ast.Node) {
 * 	block := ast.FindAncestor(node, ast.IsFunctionOrModuleBlock)
 * 	sourceFile := ast.GetSourceFileOfNode(node)
 * 	span := scanner.GetRangeOfTokenAtPosition(sourceFile, block.StatementList().Pos())
 * 	c.addDiagnostic(ast.NewDiagnostic(sourceFile, span, diagnostics.The_containing_function_or_module_body_is_too_large_for_control_flow_analysis))
 * }
 */
export function Checker_reportFlowControlError(receiver: GoPtr<Checker>, node: GoPtr<Node>): void {
  const block = FindAncestor(node, IsFunctionOrModuleBlock);
  const sourceFile = GetSourceFileOfNode(node);
  const span = GetRangeOfTokenAtPosition(sourceFile, NodeList_Pos(Node_StatementList(block)));
  Checker_addDiagnostic(receiver, NewDiagnostic(sourceFile, span, The_containing_function_or_module_body_is_too_large_for_control_flow_analysis));
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/flow.go::method::Checker.isMatchingReference","kind":"method","status":"implemented","sigHash":"a9f05a8d7485c45580baad56aad930bf3105ae661c8a7fcf11dab5ed5361a285","bodyHash":"16b635c45eeeea54e754ed7d764e8ab9d66fcc15da956937d7509010a4a68a97"}
 *
 * Go source:
 * func (c *Checker) isMatchingReference(source *ast.Node, target *ast.Node) bool {
 * 	switch target.Kind {
 * 	case ast.KindParenthesizedExpression, ast.KindNonNullExpression:
 * 		return c.isMatchingReference(source, target.Expression())
 * 	case ast.KindBinaryExpression:
 * 		return ast.IsAssignmentExpression(target, false) && c.isMatchingReference(source, target.AsBinaryExpression().Left) ||
 * 			ast.IsBinaryExpression(target) && target.AsBinaryExpression().OperatorToken.Kind == ast.KindCommaToken &&
 * 				c.isMatchingReference(source, target.AsBinaryExpression().Right)
 * 	}
 * 	switch source.Kind {
 * 	case ast.KindMetaProperty:
 * 		return ast.IsMetaProperty(target) && source.AsMetaProperty().KeywordToken == target.AsMetaProperty().KeywordToken && source.Name().Text() == target.Name().Text()
 * 	case ast.KindIdentifier, ast.KindPrivateIdentifier:
 * 		if ast.IsThisInTypeQuery(source) {
 * 			return target.Kind == ast.KindThisKeyword
 * 		}
 * 		return ast.IsIdentifier(target) && c.getResolvedSymbol(source) == c.getResolvedSymbol(target) ||
 * 			(ast.IsVariableDeclaration(target) || ast.IsBindingElement(target)) && c.getExportSymbolOfValueSymbolIfExported(c.getResolvedSymbol(source)) == c.getSymbolOfDeclaration(target)
 * 	case ast.KindThisKeyword:
 * 		return target.Kind == ast.KindThisKeyword
 * 	case ast.KindSuperKeyword:
 * 		return target.Kind == ast.KindSuperKeyword
 * 	case ast.KindNonNullExpression, ast.KindParenthesizedExpression, ast.KindSatisfiesExpression:
 * 		return c.isMatchingReference(source.Expression(), target)
 * 	case ast.KindPropertyAccessExpression, ast.KindElementAccessExpression:
 * 		if sourcePropertyName, ok := c.getAccessedPropertyName(source); ok {
 * 			if ast.IsAccessExpression(target) {
 * 				if targetPropertyName, ok := c.getAccessedPropertyName(target); ok {
 * 					return targetPropertyName == sourcePropertyName && c.isMatchingReference(source.Expression(), target.Expression())
 * 				}
 * 			}
 * 		}
 * 		if ast.IsElementAccessExpression(source) && ast.IsElementAccessExpression(target) {
 * 			sourceArg := source.AsElementAccessExpression().ArgumentExpression
 * 			targetArg := target.AsElementAccessExpression().ArgumentExpression
 * 			if ast.IsIdentifier(sourceArg) && ast.IsIdentifier(targetArg) {
 * 				symbol := c.getResolvedSymbol(sourceArg)
 * 				if symbol == c.getResolvedSymbol(targetArg) && (c.isConstantVariable(symbol) || c.isParameterOrMutableLocalVariable(symbol) && !c.isSymbolAssigned(symbol)) {
 * 					return c.isMatchingReference(source.Expression(), target.Expression())
 * 				}
 * 			}
 * 		}
 * 	case ast.KindQualifiedName:
 * 		if ast.IsAccessExpression(target) {
 * 			if targetPropertyName, ok := c.getAccessedPropertyName(target); ok {
 * 				return source.AsQualifiedName().Right.Text() == targetPropertyName && c.isMatchingReference(source.AsQualifiedName().Left, target.Expression())
 * 			}
 * 		}
 * 	case ast.KindBinaryExpression:
 * 		return ast.IsBinaryExpression(source) && source.AsBinaryExpression().OperatorToken.Kind == ast.KindCommaToken && c.isMatchingReference(source.AsBinaryExpression().Right, target)
 * 	}
 * 	return false
 * }
 */
export function Checker_isMatchingReference(receiver: GoPtr<Checker>, source: GoPtr<Node>, target: GoPtr<Node>): bool {
  switch (target!.Kind) {
    case KindParenthesizedExpression:
    case KindNonNullExpression:
      return Checker_isMatchingReference(receiver, source, Node_Expression(target));
    case KindBinaryExpression:
      return IsAssignmentExpression(target, false) && Checker_isMatchingReference(receiver, source, AsBinaryExpression(target)!.Left) ||
        IsBinaryExpression(target) && AsBinaryExpression(target)!.OperatorToken!.Kind === KindCommaToken &&
          Checker_isMatchingReference(receiver, source, AsBinaryExpression(target)!.Right);
  }
  switch (source!.Kind) {
    case KindMetaProperty:
      return IsMetaProperty(target) && AsMetaProperty(source)!.KeywordToken === AsMetaProperty(target)!.KeywordToken && Node_Text(Node_Name(source)) === Node_Text(Node_Name(target));
    case KindIdentifier:
    case KindPrivateIdentifier:
      if (IsThisInTypeQuery(source)) {
        return target!.Kind === KindThisKeyword;
      }
      return IsIdentifier(target) && Checker_getResolvedSymbol(receiver, source) === Checker_getResolvedSymbol(receiver, target) ||
        (IsVariableDeclaration(target) || IsBindingElement(target)) && Checker_getExportSymbolOfValueSymbolIfExported(receiver, Checker_getResolvedSymbol(receiver, source)) === Checker_getSymbolOfDeclaration(receiver, target);
    case KindThisKeyword:
      return target!.Kind === KindThisKeyword;
    case KindSuperKeyword:
      return target!.Kind === KindSuperKeyword;
    case KindNonNullExpression:
    case KindParenthesizedExpression:
    case KindSatisfiesExpression:
      return Checker_isMatchingReference(receiver, Node_Expression(source), target);
    case KindPropertyAccessExpression:
    case KindElementAccessExpression: {
      const [sourcePropertyName, sourceOk] = Checker_getAccessedPropertyName(receiver, source);
      if (sourceOk) {
        if (IsAccessExpression(target)) {
          const [targetPropertyName, targetOk] = Checker_getAccessedPropertyName(receiver, target);
          if (targetOk) {
            return targetPropertyName === sourcePropertyName && Checker_isMatchingReference(receiver, Node_Expression(source), Node_Expression(target));
          }
        }
      }
      if (IsElementAccessExpression(source) && IsElementAccessExpression(target)) {
        const sourceArg = AsElementAccessExpression(source)!.ArgumentExpression;
        const targetArg = AsElementAccessExpression(target)!.ArgumentExpression;
        if (IsIdentifier(sourceArg) && IsIdentifier(targetArg)) {
          const symbol = Checker_getResolvedSymbol(receiver, sourceArg);
          if (symbol === Checker_getResolvedSymbol(receiver, targetArg) && (Checker_isConstantVariable(receiver, symbol) || Checker_isParameterOrMutableLocalVariable(receiver, symbol) && !Checker_isSymbolAssigned(receiver, symbol))) {
            return Checker_isMatchingReference(receiver, Node_Expression(source), Node_Expression(target));
          }
        }
      }
      break;
    }
    case KindQualifiedName:
      if (IsAccessExpression(target)) {
        const [targetPropertyName, targetOk] = Checker_getAccessedPropertyName(receiver, target);
        if (targetOk) {
          return Node_Text(AsQualifiedName(source)!.Right) === targetPropertyName && Checker_isMatchingReference(receiver, AsQualifiedName(source)!.Left as GoPtr<Node>, Node_Expression(target));
        }
      }
      break;
    case KindBinaryExpression:
      return IsBinaryExpression(source) && AsBinaryExpression(source)!.OperatorToken!.Kind === KindCommaToken && Checker_isMatchingReference(receiver, AsBinaryExpression(source)!.Right, target);
  }
  return false;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/flow.go::varGroup::nonDottedNameCacheKey","kind":"varGroup","status":"implemented","sigHash":"2723c19787ca3fdd595b182dcc271ddf4eefec17c04f535afdb74cba2cdd64ff","bodyHash":"56cb355c836935b0f9d66c2d48a84bc0f7d7fc91e44b954149a31fbbf5d95af2"}
 *
 * Go source:
 * var nonDottedNameCacheKey = CacheHashKey(xxh3.HashString128("?"))
 */
export const nonDottedNameCacheKey: CacheHashKey = HashString128("?");

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/flow.go::method::Checker.getFlowReferenceKey","kind":"method","status":"implemented","sigHash":"7f9c86a333fc3319345e1d2e40cd94e84184cc42804dbda3e0deebe4b4fa8c87","bodyHash":"8bcfb16a0b81f307700c2d8c04c39c9d3419508117866e6fecd4abfdf9d6257b"}
 *
 * Go source:
 * func (c *Checker) getFlowReferenceKey(f *FlowState) CacheHashKey {
 * 	var b keyBuilder
 * 	if c.writeFlowCacheKey(&b, f.reference, f.declaredType, f.initialType, f.flowContainer) {
 * 		return b.hash()
 * 	}
 * 	return nonDottedNameCacheKey // Reference isn't a dotted name
 * }
 */
export function Checker_getFlowReferenceKey(receiver: GoPtr<Checker>, f: GoPtr<FlowState>): CacheHashKey {
  const b: keyBuilder = { h: NewXxh3() as Hasher };
  if (Checker_writeFlowCacheKey(receiver, b, f!.reference, f!.declaredType, f!.initialType, f!.flowContainer)) {
    return keyBuilder_hash(b);
  }
  return nonDottedNameCacheKey;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/flow.go::method::Checker.writeFlowCacheKey","kind":"method","status":"implemented","sigHash":"b16aa6930f8f0b2029b4323c4cda06c08cafbfd41b711ff0416a40e15d1c2e83","bodyHash":"6178d245bdcfba7b96c67da18b366b69418832cde81498fd0e30564cb853e3be"}
 *
 * Go source:
 * func (c *Checker) writeFlowCacheKey(b *keyBuilder, node *ast.Node, declaredType *Type, initialType *Type, flowContainer *ast.Node) bool {
 * 	switch node.Kind {
 * 	case ast.KindIdentifier:
 * 		if !ast.IsThisInTypeQuery(node) {
 * 			symbol := c.getResolvedSymbol(node)
 * 			if symbol == c.unknownSymbol {
 * 				return false
 * 			}
 * 			b.writeSymbol(symbol)
 * 		}
 * 		fallthrough
 * 	case ast.KindThisKeyword:
 * 		b.writeByte(':')
 * 		b.writeType(declaredType)
 * 		if initialType != declaredType {
 * 			b.writeByte('=')
 * 			b.writeType(initialType)
 * 		}
 * 		if flowContainer != nil {
 * 			b.writeByte('@')
 * 			b.writeNode(flowContainer)
 * 		}
 * 		return true
 * 	case ast.KindNonNullExpression, ast.KindParenthesizedExpression:
 * 		return c.writeFlowCacheKey(b, node.Expression(), declaredType, initialType, flowContainer)
 * 	case ast.KindQualifiedName:
 * 		if !c.writeFlowCacheKey(b, node.AsQualifiedName().Left, declaredType, initialType, flowContainer) {
 * 			return false
 * 		}
 * 		b.writeByte('.')
 * 		b.writeString(node.AsQualifiedName().Right.Text())
 * 		return true
 * 	case ast.KindPropertyAccessExpression, ast.KindElementAccessExpression:
 * 		if propName, ok := c.getAccessedPropertyName(node); ok {
 * 			if !c.writeFlowCacheKey(b, node.Expression(), declaredType, initialType, flowContainer) {
 * 				return false
 * 			}
 * 			b.writeByte('.')
 * 			b.writeString(propName)
 * 			return true
 * 		}
 * 		if ast.IsElementAccessExpression(node) && ast.IsIdentifier(node.AsElementAccessExpression().ArgumentExpression) {
 * 			symbol := c.getResolvedSymbol(node.AsElementAccessExpression().ArgumentExpression)
 * 			if c.isConstantVariable(symbol) || c.isParameterOrMutableLocalVariable(symbol) && !c.isSymbolAssigned(symbol) {
 * 				if !c.writeFlowCacheKey(b, node.Expression(), declaredType, initialType, flowContainer) {
 * 					return false
 * 				}
 * 				b.writeString(".@")
 * 				b.writeSymbol(symbol)
 * 				return true
 * 			}
 * 		}
 * 	case ast.KindObjectBindingPattern, ast.KindArrayBindingPattern, ast.KindFunctionDeclaration,
 * 		ast.KindFunctionExpression, ast.KindArrowFunction, ast.KindMethodDeclaration:
 * 		b.writeNode(node)
 * 		b.writeByte('#')
 * 		b.writeType(declaredType)
 * 		return true
 * 	}
 * 	return false
 * }
 */
export function Checker_writeFlowCacheKey(receiver: GoPtr<Checker>, b: GoPtr<keyBuilder>, node: GoPtr<Node>, declaredType: GoPtr<Type>, initialType: GoPtr<Type>, flowContainer: GoPtr<Node>): bool {
  let writeThisOrIdentifierSuffix = false;
  switch (node!.Kind) {
    case KindIdentifier:
      if (!IsThisInTypeQuery(node)) {
        const symbol = Checker_getResolvedSymbol(receiver, node);
        if (symbol === receiver!.unknownSymbol) {
          return false;
        }
        keyBuilder_writeSymbol(b, symbol);
      }
      writeThisOrIdentifierSuffix = true;
      break;
    case KindThisKeyword:
      writeThisOrIdentifierSuffix = true;
      break;
    case KindNonNullExpression:
    case KindParenthesizedExpression:
      return Checker_writeFlowCacheKey(receiver, b, Node_Expression(node), declaredType, initialType, flowContainer);
    case KindQualifiedName:
      if (!Checker_writeFlowCacheKey(receiver, b, AsQualifiedName(node)!.Left as unknown as GoPtr<Node>, declaredType, initialType, flowContainer)) {
        return false;
      }
      keyBuilder_writeByte(b, 46); // '.'
      keyBuilder_writeString(b, Node_Text(AsQualifiedName(node)!.Right));
      return true;
    case KindPropertyAccessExpression:
    case KindElementAccessExpression: {
      const [propName, ok] = Checker_getAccessedPropertyName(receiver, node);
      if (ok) {
        if (!Checker_writeFlowCacheKey(receiver, b, Node_Expression(node), declaredType, initialType, flowContainer)) {
          return false;
        }
        keyBuilder_writeByte(b, 46); // '.'
        keyBuilder_writeString(b, propName);
        return true;
      }
      if (IsElementAccessExpression(node) && IsIdentifier(AsElementAccessExpression(node)!.ArgumentExpression)) {
        const symbol = Checker_getResolvedSymbol(receiver, AsElementAccessExpression(node)!.ArgumentExpression);
        if (Checker_isConstantVariable(receiver, symbol) || Checker_isParameterOrMutableLocalVariable(receiver, symbol) && !Checker_isSymbolAssigned(receiver, symbol)) {
          if (!Checker_writeFlowCacheKey(receiver, b, Node_Expression(node), declaredType, initialType, flowContainer)) {
            return false;
          }
          keyBuilder_writeString(b, ".@");
          keyBuilder_writeSymbol(b, symbol);
          return true;
        }
      }
      break;
    }
    case KindObjectBindingPattern:
    case KindArrayBindingPattern:
    case KindFunctionDeclaration:
    case KindFunctionExpression:
    case KindArrowFunction:
    case KindMethodDeclaration:
      keyBuilder_writeNode(b, node);
      keyBuilder_writeByte(b, 35); // '#'
      keyBuilder_writeType(b, declaredType);
      return true;
  }
  if (writeThisOrIdentifierSuffix) {
    keyBuilder_writeByte(b, 58); // ':'
    keyBuilder_writeType(b, declaredType);
    if (initialType !== declaredType) {
      keyBuilder_writeByte(b, 61); // '='
      keyBuilder_writeType(b, initialType);
    }
    if (flowContainer !== undefined) {
      keyBuilder_writeByte(b, 64); // '@'
      keyBuilder_writeNode(b, flowContainer);
    }
    return true;
  }
  return false;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/flow.go::method::Checker.getAccessedPropertyName","kind":"method","status":"implemented","sigHash":"d702337ff19dad241d09896ed83757638ca2a7b6996e3d7d5f684a84a54b7e1b","bodyHash":"48c56d2015994394a61fd036d7a65cda2a748f3c21f0f3fd7df79a8b643d69ae"}
 *
 * Go source:
 * func (c *Checker) getAccessedPropertyName(access *ast.Node) (string, bool) {
 * 	if ast.IsPropertyAccessExpression(access) {
 * 		return access.Name().Text(), true
 * 	}
 * 	if ast.IsElementAccessExpression(access) {
 * 		return c.tryGetElementAccessExpressionName(access.AsElementAccessExpression())
 * 	}
 * 	if ast.IsBindingElement(access) {
 * 		return c.getDestructuringPropertyName(access)
 * 	}
 * 	if ast.IsParameterDeclaration(access) {
 * 		return strconv.Itoa(slices.Index(access.Parent.Parameters(), access)), true
 * 	}
 * 	return "", false
 * }
 */
export function Checker_getAccessedPropertyName(receiver: GoPtr<Checker>, access: GoPtr<Node>): [string, bool] {
  if (IsPropertyAccessExpression(access)) {
    return [Node_Text(Node_Name(access)), true];
  }
  if (IsElementAccessExpression(access)) {
    return Checker_tryGetElementAccessExpressionName(receiver, AsElementAccessExpression(access));
  }
  if (IsBindingElement(access)) {
    return Checker_getDestructuringPropertyName(receiver, access);
  }
  if (IsParameterDeclaration(access)) {
    const params = Node_Parameters(access!.Parent);
    return [String(params.indexOf(access)), true];
  }
  return ["", false];
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/flow.go::method::Checker.tryGetElementAccessExpressionName","kind":"method","status":"implemented","sigHash":"86a979c899cba265eac97c23ad51aebadaefa00ebf6d6690e4a16cc7269b4719","bodyHash":"9da0f5e9f0255c073b4bc2adf5f7a24cc2c1b57577a0000cf4642de861c771e0"}
 *
 * Go source:
 * func (c *Checker) tryGetElementAccessExpressionName(node *ast.ElementAccessExpression) (string, bool) {
 * 	switch {
 * 	case ast.IsStringOrNumericLiteralLike(node.ArgumentExpression):
 * 		return node.ArgumentExpression.Text(), true
 * 	case ast.IsEntityNameExpression(node.ArgumentExpression):
 * 		return c.tryGetNameFromEntityNameExpression(node.ArgumentExpression)
 * 	}
 * 	return "", false
 * }
 */
export function Checker_tryGetElementAccessExpressionName(receiver: GoPtr<Checker>, node: GoPtr<ElementAccessExpression>): [string, bool] {
  if (IsStringOrNumericLiteralLike(node!.ArgumentExpression)) {
    return [Node_Text(node!.ArgumentExpression), true];
  }
  if (IsEntityNameExpression(node!.ArgumentExpression)) {
    return Checker_tryGetNameFromEntityNameExpression(receiver, node!.ArgumentExpression);
  }
  return ["", false];
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/flow.go::method::Checker.tryGetNameFromEntityNameExpression","kind":"method","status":"implemented","sigHash":"36059e48b51fdcc0a41a83ab79f0e06982bafb6531b74130e9ae40b60f3dc2fd","bodyHash":"6784cd11c45f35d76aefd2f2ad8f5a5b66194b42d99eb167e03aa66dce8e1c17"}
 *
 * Go source:
 * func (c *Checker) tryGetNameFromEntityNameExpression(node *ast.Node) (string, bool) {
 * 	symbol := c.resolveEntityName(node, ast.SymbolFlagsValue, true /*ignoreErrors* /, false, nil)
 * 	if symbol == nil || !(c.isConstantVariable(symbol) || (symbol.Flags&ast.SymbolFlagsEnumMember != 0)) {
 * 		return "", false
 * 	}
 * 	declaration := symbol.ValueDeclaration
 * 	if declaration == nil {
 * 		return "", false
 * 	}
 * 	t := c.tryGetTypeFromTypeNode(declaration)
 * 	if t != nil {
 * 		if name, ok := tryGetNameFromType(t); ok {
 * 			return name, true
 * 		}
 * 	}
 * 	// We exclude binding elements because their initializers don't solely determine their types and resolving
 * 	// full types can cause circularities (see https://github.com/microsoft/TypeScript/issues/63192).
 * 	if hasOnlyExpressionInitializer(declaration) && !ast.IsBindingElement(declaration) && c.isBlockScopedNameDeclaredBeforeUse(declaration, node) {
 * 		if initializer := declaration.Initializer(); initializer != nil {
 * 			if initializerType := c.getTypeOfExpression(initializer); initializerType != nil {
 * 				return tryGetNameFromType(initializerType)
 * 			}
 * 		} else if ast.IsEnumMember(declaration) {
 * 			return ast.TryGetTextOfPropertyName(declaration.Name())
 * 		}
 * 	}
 * 	return "", false
 * }
 */
export function Checker_tryGetNameFromEntityNameExpression(receiver: GoPtr<Checker>, node: GoPtr<Node>): [string, bool] {
  const symbol = Checker_resolveEntityName(receiver, node, SymbolFlagsValue, true, false, undefined);
  if (symbol === undefined || !(Checker_isConstantVariable(receiver, symbol) || (symbol!.Flags & SymbolFlagsEnumMember))) {
    return ["", false];
  }
  const declaration = symbol!.ValueDeclaration;
  if (declaration === undefined) {
    return ["", false];
  }
  const t = Checker_tryGetTypeFromTypeNode(receiver, declaration);
  if (t !== undefined) {
    const [name, ok] = tryGetNameFromType(t);
    if (ok) {
      return [name, true];
    }
  }
  // We exclude binding elements because their initializers don't solely determine their types and resolving
  // full types can cause circularities (see https://github.com/microsoft/TypeScript/issues/63192).
  if (hasOnlyExpressionInitializer(declaration) && !IsBindingElement(declaration) && Checker_isBlockScopedNameDeclaredBeforeUse(receiver, declaration, node)) {
    const initializer = Node_Initializer(declaration);
    if (initializer !== undefined) {
      const initializerType = Checker_getTypeOfExpression(receiver, initializer);
      if (initializerType !== undefined) {
        return tryGetNameFromType(initializerType);
      }
    } else if (IsEnumMember(declaration)) {
      return TryGetTextOfPropertyName(Node_Name(declaration));
    }
  }
  return ["", false];
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/flow.go::func::tryGetNameFromType","kind":"func","status":"implemented","sigHash":"d9dc738c4d6f348bceaafbfcbfbe988620bc9c31b41cd9453b5bae4830f0fc05","bodyHash":"35b7311380888bbeca9f3ae4a7016eca3de42a8438b77704adf26607bbd8d6c6"}
 *
 * Go source:
 * func tryGetNameFromType(t *Type) (string, bool) {
 * 	switch {
 * 	case t.flags&TypeFlagsUniqueESSymbol != 0:
 * 		return t.AsUniqueESSymbolType().name, true
 * 	case t.flags&TypeFlagsStringOrNumberLiteral != 0:
 * 		return evaluator.AnyToString(t.AsLiteralType().value), true
 * 	}
 * 	return "", false
 * }
 */
export function tryGetNameFromType(t: GoPtr<Type>): [string, bool] {
  if (t!.flags & TypeFlagsUniqueESSymbol) {
    return [Type_AsUniqueESSymbolType(t)!.name, true];
  }
  if (t!.flags & TypeFlagsStringOrNumberLiteral) {
    return [AnyToString(Type_AsLiteralType(t)!.value), true];
  }
  return ["", false];
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/flow.go::method::Checker.getDestructuringPropertyName","kind":"method","status":"implemented","sigHash":"f839d4644fc070e20c862aaa42d89068a929b08a01fc16323abe23c51a63aa91","bodyHash":"797ac910e0827cd417ea73bbe1fdb7a7727f3fdd878aa6b2696ed93d0c2b634f"}
 *
 * Go source:
 * func (c *Checker) getDestructuringPropertyName(node *ast.Node) (string, bool) {
 * 	parent := node.Parent
 * 	if ast.IsBindingElement(node) && ast.IsObjectBindingPattern(parent) {
 * 		return c.getLiteralPropertyNameText(getBindingElementPropertyName(node))
 * 	}
 * 	if ast.IsPropertyAssignment(node) || ast.IsShorthandPropertyAssignment(node) {
 * 		return c.getLiteralPropertyNameText(node.Name())
 * 	}
 * 	if ast.IsArrayLiteralExpression(parent) || ast.IsArrayBindingPattern(parent) {
 * 		return strconv.Itoa(slices.Index(parent.Elements(), node)), true
 * 	}
 * 	return "", false
 * }
 */
export function Checker_getDestructuringPropertyName(receiver: GoPtr<Checker>, node: GoPtr<Node>): [string, bool] {
  const parent = node!.Parent;
  if (IsBindingElement(node) && IsObjectBindingPattern(parent)) {
    return Checker_getLiteralPropertyNameText(receiver, getBindingElementPropertyName(node));
  }
  if (IsPropertyAssignment(node) || IsShorthandPropertyAssignment(node)) {
    return Checker_getLiteralPropertyNameText(receiver, Node_Name(node));
  }
  if (IsArrayLiteralExpression(parent) || IsArrayBindingPattern(parent)) {
    return [String(Node_Elements(parent)!.indexOf(node)), true];
  }
  return ["", false];
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/flow.go::method::Checker.getLiteralPropertyNameText","kind":"method","status":"implemented","sigHash":"aaab1dc8155ad3f949a35cd826066cd5106978c41c9442cfdf29a59daa6a9127","bodyHash":"ae91bac288779d0784e5ecfe11b2c7371f636290c2e31067fb55784e9e44991f"}
 *
 * Go source:
 * func (c *Checker) getLiteralPropertyNameText(name *ast.Node) (string, bool) {
 * 	t := c.getLiteralTypeFromPropertyName(name)
 * 	if t.flags&(TypeFlagsStringLiteral|TypeFlagsNumberLiteral) != 0 {
 * 		return evaluator.AnyToString(t.AsLiteralType().value), true
 * 	}
 * 	return "", false
 * }
 */
export function Checker_getLiteralPropertyNameText(receiver: GoPtr<Checker>, name: GoPtr<Node>): [string, bool] {
  const t = Checker_getLiteralTypeFromPropertyName(receiver, name);
  if (t!.flags & (TypeFlagsStringLiteral | TypeFlagsNumberLiteral)) {
    return [AnyToString(Type_AsLiteralType(t)!.value), true];
  }
  return ["", false];
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/flow.go::method::Checker.isConstantReference","kind":"method","status":"implemented","sigHash":"37d8459a35ee6d7278909453851a85c3c3a7a97106f009afcc7730643233353b","bodyHash":"99ff8ad35cba27b63f3a3ae8a95f596e283a82fee81fe6b8e732377cb4e1665b"}
 *
 * Go source:
 * func (c *Checker) isConstantReference(node *ast.Node) bool {
 * 	switch node.Kind {
 * 	case ast.KindThisKeyword:
 * 		return true
 * 	case ast.KindIdentifier:
 * 		if !ast.IsThisInTypeQuery(node) {
 * 			symbol := c.getResolvedSymbol(node)
 * 			return c.isConstantVariable(symbol) || c.isParameterOrMutableLocalVariable(symbol) && !c.isSymbolAssigned(symbol) || symbol.ValueDeclaration != nil && ast.IsFunctionExpression(symbol.ValueDeclaration)
 * 		}
 * 	case ast.KindPropertyAccessExpression, ast.KindElementAccessExpression:
 * 		// The resolvedSymbol property is initialized by checkPropertyAccess or checkElementAccess before we get here.
 * 		if c.isConstantReference(node.Expression()) {
 * 			symbol := c.getResolvedSymbolOrNil(node)
 * 			if symbol != nil {
 * 				return c.isReadonlySymbol(symbol)
 * 			}
 * 		}
 * 	case ast.KindObjectBindingPattern, ast.KindArrayBindingPattern:
 * 		rootDeclaration := ast.GetRootDeclaration(node.Parent)
 * 		if ast.IsParameterDeclaration(rootDeclaration) || ast.IsVariableDeclaration(rootDeclaration) && ast.IsCatchClause(rootDeclaration.Parent) {
 * 			return !c.isSomeSymbolAssigned(rootDeclaration)
 * 		}
 * 		return ast.IsVariableDeclaration(rootDeclaration) && c.isVarConstLike(rootDeclaration)
 * 	}
 * 	return false
 * }
 */
export function Checker_isConstantReference(receiver: GoPtr<Checker>, node: GoPtr<Node>): bool {
  switch (node!.Kind) {
    case KindThisKeyword:
      return true;
    case KindIdentifier:
      if (!IsThisInTypeQuery(node)) {
        const symbol = Checker_getResolvedSymbol(receiver, node);
        return Checker_isConstantVariable(receiver, symbol) || Checker_isParameterOrMutableLocalVariable(receiver, symbol) && !Checker_isSymbolAssigned(receiver, symbol) || symbol!.ValueDeclaration !== undefined && IsFunctionExpression(symbol!.ValueDeclaration);
      }
      break;
    case KindPropertyAccessExpression:
    case KindElementAccessExpression:
      if (Checker_isConstantReference(receiver, Node_Expression(node))) {
        const symbol = Checker_getResolvedSymbolOrNil(receiver, node);
        if (symbol !== undefined) {
          return Checker_isReadonlySymbol(receiver, symbol);
        }
      }
      break;
    case KindObjectBindingPattern:
    case KindArrayBindingPattern: {
      const rootDeclaration = GetRootDeclaration(node!.Parent);
      if (IsParameterDeclaration(rootDeclaration) || IsVariableDeclaration(rootDeclaration) && IsCatchClause(rootDeclaration!.Parent)) {
        return !Checker_isSomeSymbolAssigned(receiver, rootDeclaration);
      }
      return IsVariableDeclaration(rootDeclaration) && Checker_isVarConstLike(receiver, rootDeclaration);
    }
  }
  return false;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/flow.go::method::Checker.containsMatchingReference","kind":"method","status":"implemented","sigHash":"8d670e63b816123ee178073cfa367ded31350479732628c7ccb3ada0c832d62c","bodyHash":"2b0cf28e73c91f278c87acdc6ffdfcb00d7392c1d20dc88d41bbf1f099d7c063"}
 *
 * Go source:
 * func (c *Checker) containsMatchingReference(source *ast.Node, target *ast.Node) bool {
 * 	for ast.IsAccessExpression(source) {
 * 		source = source.Expression()
 * 		if c.isMatchingReference(source, target) {
 * 			return true
 * 		}
 * 	}
 * 	return false
 * }
 */
export function Checker_containsMatchingReference(receiver: GoPtr<Checker>, source: GoPtr<Node>, target: GoPtr<Node>): bool {
  let s = source;
  while (IsAccessExpression(s)) {
    s = Node_Expression(s);
    if (Checker_isMatchingReference(receiver, s, target)) {
      return true;
    }
  }
  return false;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/flow.go::method::Checker.optionalChainContainsReference","kind":"method","status":"implemented","sigHash":"a0f8f646feb5a66b07373c1819813407bba083f17206517f506f3e6104ce1461","bodyHash":"4da17e05c72a58493216a8c4761c87eea646fe896a0efe61479313b587f318e5"}
 *
 * Go source:
 * func (c *Checker) optionalChainContainsReference(source *ast.Node, target *ast.Node) bool {
 * 	for ast.IsOptionalChain(source) {
 * 		source = source.Expression()
 * 		if c.isMatchingReference(source, target) {
 * 			return true
 * 		}
 * 	}
 * 	return false
 * }
 */
export function Checker_optionalChainContainsReference(receiver: GoPtr<Checker>, source: GoPtr<Node>, target: GoPtr<Node>): bool {
  let s = source;
  while (IsOptionalChain(s)) {
    s = Node_Expression(s);
    if (Checker_isMatchingReference(receiver, s, target)) {
      return true;
    }
  }
  return false;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/flow.go::method::Checker.getReferenceCandidate","kind":"method","status":"implemented","sigHash":"b695382aeb318dd098ce20bcc1acc440a18c64ae6774df6a401b9ca0af881603","bodyHash":"8bb4c93306c5b519398c02d1a4402c223e3ff1370bfc1eb9fa97fb0e622853d2"}
 *
 * Go source:
 * func (c *Checker) getReferenceCandidate(node *ast.Node) *ast.Node {
 * 	switch node.Kind {
 * 	case ast.KindParenthesizedExpression:
 * 		return c.getReferenceCandidate(node.Expression())
 * 	case ast.KindBinaryExpression:
 * 		switch node.AsBinaryExpression().OperatorToken.Kind {
 * 		case ast.KindEqualsToken, ast.KindBarBarEqualsToken, ast.KindAmpersandAmpersandEqualsToken, ast.KindQuestionQuestionEqualsToken:
 * 			return c.getReferenceCandidate(node.AsBinaryExpression().Left)
 * 		case ast.KindCommaToken:
 * 			return c.getReferenceCandidate(node.AsBinaryExpression().Right)
 * 		}
 * 	}
 * 	return node
 * }
 */
export function Checker_getReferenceCandidate(receiver: GoPtr<Checker>, node: GoPtr<Node>): GoPtr<Node> {
  switch (node!.Kind) {
    case KindParenthesizedExpression:
      return Checker_getReferenceCandidate(receiver, Node_Expression(node));
    case KindBinaryExpression:
      switch (AsBinaryExpression(node)!.OperatorToken!.Kind) {
        case KindEqualsToken:
        case KindBarBarEqualsToken:
        case KindAmpersandAmpersandEqualsToken:
        case KindQuestionQuestionEqualsToken:
          return Checker_getReferenceCandidate(receiver, AsBinaryExpression(node)!.Left);
        case KindCommaToken:
          return Checker_getReferenceCandidate(receiver, AsBinaryExpression(node)!.Right);
      }
  }
  return node;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/flow.go::method::Checker.getReferenceRoot","kind":"method","status":"implemented","sigHash":"995bfff480955548f3f57b83c4a7aa6bdc9409bd572101a56e7f7c8c25f744c2","bodyHash":"734a49518762369beb3d01a8fa399390a7bd05943b5194122aef72d152027f18"}
 *
 * Go source:
 * func (c *Checker) getReferenceRoot(node *ast.Node) *ast.Node {
 * 	parent := node.Parent
 * 	if ast.IsParenthesizedExpression(parent) ||
 * 		ast.IsBinaryExpression(parent) && parent.AsBinaryExpression().OperatorToken.Kind == ast.KindEqualsToken && parent.AsBinaryExpression().Left == node ||
 * 		ast.IsBinaryExpression(parent) && parent.AsBinaryExpression().OperatorToken.Kind == ast.KindCommaToken && parent.AsBinaryExpression().Right == node {
 * 		return c.getReferenceRoot(parent)
 * 	}
 * 	return node
 * }
 */
export function Checker_getReferenceRoot(receiver: GoPtr<Checker>, node: GoPtr<Node>): GoPtr<Node> {
  const parent = node!.Parent;
  if (IsParenthesizedExpression(parent) ||
    IsBinaryExpression(parent) && AsBinaryExpression(parent)!.OperatorToken!.Kind === KindEqualsToken && AsBinaryExpression(parent)!.Left === node ||
    IsBinaryExpression(parent) && AsBinaryExpression(parent)!.OperatorToken!.Kind === KindCommaToken && AsBinaryExpression(parent)!.Right === node) {
    return Checker_getReferenceRoot(receiver, parent);
  }
  return node;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/flow.go::method::Checker.hasMatchingArgument","kind":"method","status":"implemented","sigHash":"ea07181f108809bdec36e952a6d233eed4fe1fa2f983aaede47e113d8a588c62","bodyHash":"d357d8c9bff66982e14eff72e0bb63cfc0a87790ad2bc88b9339f2415fb28be1"}
 *
 * Go source:
 * func (c *Checker) hasMatchingArgument(expression *ast.Node, reference *ast.Node) bool {
 * 	for _, argument := range expression.Arguments() {
 * 		if c.isOrContainsMatchingReference(reference, argument) || c.optionalChainContainsReference(argument, reference) {
 * 			return true
 * 		}
 * 	}
 * 	if ast.IsPropertyAccessExpression(expression.Expression()) && c.isOrContainsMatchingReference(reference, expression.Expression().Expression()) {
 * 		return true
 * 	}
 * 	return false
 * }
 */
export function Checker_hasMatchingArgument(receiver: GoPtr<Checker>, expression: GoPtr<Node>, reference: GoPtr<Node>): bool {
  for (const argument of Node_Arguments(expression) ?? []) {
    if (Checker_isOrContainsMatchingReference(receiver, reference, argument) || Checker_optionalChainContainsReference(receiver, argument, reference)) {
      return true;
    }
  }
  if (IsPropertyAccessExpression(Node_Expression(expression)) && Checker_isOrContainsMatchingReference(receiver, reference, Node_Expression(Node_Expression(expression)))) {
    return true;
  }
  return false;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/flow.go::method::Checker.isOrContainsMatchingReference","kind":"method","status":"implemented","sigHash":"31f20b40f76e173ebe38b52e088fb3f8d74e7671ad20ad3bd0bec4aa98b4c0b3","bodyHash":"dec4c6b838492e3e0ed4477a6e7578c36e13014f394090135d01e414a95081d7"}
 *
 * Go source:
 * func (c *Checker) isOrContainsMatchingReference(source *ast.Node, target *ast.Node) bool {
 * 	return c.isMatchingReference(source, target) || c.containsMatchingReference(source, target)
 * }
 */
export function Checker_isOrContainsMatchingReference(receiver: GoPtr<Checker>, source: GoPtr<Node>, target: GoPtr<Node>): bool {
  return Checker_isMatchingReference(receiver, source, target) || Checker_containsMatchingReference(receiver, source, target);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/flow.go::method::Checker.replacePrimitivesWithLiterals","kind":"method","status":"implemented","sigHash":"37e88b7b978b39697421b50173c4684633c985de28c2304939445a89627c9e52","bodyHash":"0c937f116c20822949f8173814328c4c3b79a34c4edd2586a23d3c0d39c6475c"}
 *
 * Go source:
 * func (c *Checker) replacePrimitivesWithLiterals(typeWithPrimitives *Type, typeWithLiterals *Type) *Type {
 * 	if c.maybeTypeOfKind(typeWithPrimitives, TypeFlagsString|TypeFlagsTemplateLiteral|TypeFlagsNumber|TypeFlagsBigInt) &&
 * 		c.maybeTypeOfKind(typeWithLiterals, TypeFlagsStringLiteral|TypeFlagsTemplateLiteral|TypeFlagsStringMapping|TypeFlagsNumberLiteral|TypeFlagsBigIntLiteral) {
 * 		return c.mapType(typeWithPrimitives, func(t *Type) *Type {
 * 			switch {
 * 			case t.flags&TypeFlagsString != 0:
 * 				return c.extractTypesOfKind(typeWithLiterals, TypeFlagsString|TypeFlagsStringLiteral|TypeFlagsTemplateLiteral|TypeFlagsStringMapping)
 * 			case c.isPatternLiteralType(t) && !c.maybeTypeOfKind(typeWithLiterals, TypeFlagsString|TypeFlagsTemplateLiteral|TypeFlagsStringMapping):
 * 				return c.extractTypesOfKind(typeWithLiterals, TypeFlagsStringLiteral)
 * 			case t.flags&TypeFlagsNumber != 0:
 * 				return c.extractTypesOfKind(typeWithLiterals, TypeFlagsNumber|TypeFlagsNumberLiteral)
 * 			case t.flags&TypeFlagsBigInt != 0:
 * 				return c.extractTypesOfKind(typeWithLiterals, TypeFlagsBigInt|TypeFlagsBigIntLiteral)
 * 			default:
 * 				return t
 * 			}
 * 		})
 * 	}
 * 	return typeWithPrimitives
 * }
 */
export function Checker_replacePrimitivesWithLiterals(receiver: GoPtr<Checker>, typeWithPrimitives: GoPtr<Type>, typeWithLiterals: GoPtr<Type>): GoPtr<Type> {
  if (Checker_maybeTypeOfKind(receiver, typeWithPrimitives, TypeFlagsString | TypeFlagsTemplateLiteral | TypeFlagsNumber | TypeFlagsBigInt) &&
    Checker_maybeTypeOfKind(receiver, typeWithLiterals, TypeFlagsStringLiteral | TypeFlagsTemplateLiteral | TypeFlagsStringMapping | TypeFlagsNumberLiteral | TypeFlagsBigIntLiteral)) {
    return Checker_mapType(receiver, typeWithPrimitives, (t) => {
      if (t!.flags & TypeFlagsString) {
        return Checker_extractTypesOfKind(receiver, typeWithLiterals, TypeFlagsString | TypeFlagsStringLiteral | TypeFlagsTemplateLiteral | TypeFlagsStringMapping);
      } else if (Checker_isPatternLiteralType(receiver, t) && !Checker_maybeTypeOfKind(receiver, typeWithLiterals, TypeFlagsString | TypeFlagsTemplateLiteral | TypeFlagsStringMapping)) {
        return Checker_extractTypesOfKind(receiver, typeWithLiterals, TypeFlagsStringLiteral);
      } else if (t!.flags & TypeFlagsNumber) {
        return Checker_extractTypesOfKind(receiver, typeWithLiterals, TypeFlagsNumber | TypeFlagsNumberLiteral);
      } else if (t!.flags & TypeFlagsBigInt) {
        return Checker_extractTypesOfKind(receiver, typeWithLiterals, TypeFlagsBigInt | TypeFlagsBigIntLiteral);
      } else {
        return t;
      }
    });
  }
  return typeWithPrimitives;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/flow.go::func::isCoercibleUnderDoubleEquals","kind":"func","status":"implemented","sigHash":"5986d7a16707fb47e2666d518a09782c4d3108e2ba962c1c9bd04311456e260e","bodyHash":"df9ea4ed5535138ff1c62a080ee9f6ba24e3b48770997c28a3ffc8b98a1295eb"}
 *
 * Go source:
 * func isCoercibleUnderDoubleEquals(source *Type, target *Type) bool {
 * 	return source.flags&(TypeFlagsNumber|TypeFlagsString|TypeFlagsBooleanLiteral) != 0 &&
 * 		target.flags&(TypeFlagsNumber|TypeFlagsString|TypeFlagsBoolean) != 0
 * }
 */
export function isCoercibleUnderDoubleEquals(source: GoPtr<Type>, target: GoPtr<Type>): bool {
  return !!(source!.flags & (TypeFlagsNumber | TypeFlagsString | TypeFlagsBooleanLiteral)) &&
    !!(target!.flags & (TypeFlagsNumber | TypeFlagsString | TypeFlagsBoolean));
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/flow.go::method::Checker.isExhaustiveSwitchStatement","kind":"method","status":"implemented","sigHash":"99ccb54840cdae14a6d5d19238942ac11a0e789688d1f1b618c81b574718f898","bodyHash":"e2d7ea51fb6647a34959ec934c1c2f9dc34db0bbbe9c6885e024fb3caa4b37de"}
 *
 * Go source:
 * func (c *Checker) isExhaustiveSwitchStatement(node *ast.Node) bool {
 * 	links := c.switchStatementLinks.Get(node)
 * 	if links.exhaustiveState == ExhaustiveStateUnknown {
 * 		// Indicate resolution is in process
 * 		links.exhaustiveState = ExhaustiveStateComputing
 * 		isExhaustive := c.computeExhaustiveSwitchStatement(node)
 * 		if links.exhaustiveState == ExhaustiveStateComputing {
 * 			links.exhaustiveState = core.IfElse(isExhaustive, ExhaustiveStateTrue, ExhaustiveStateFalse)
 * 		}
 * 	} else if links.exhaustiveState == ExhaustiveStateComputing {
 * 		// Resolve circularity to false
 * 		links.exhaustiveState = ExhaustiveStateFalse
 * 	}
 * 	return links.exhaustiveState == ExhaustiveStateTrue
 * }
 */
export function Checker_isExhaustiveSwitchStatement(receiver: GoPtr<Checker>, node: GoPtr<Node>): bool {
  const links = LinkStore_Get<GoPtr<Node>, SwitchStatementLinks>(receiver!.switchStatementLinks as LinkStore<GoPtr<Node>, SwitchStatementLinks>, node);
  const exhaustiveState = links!.exhaustiveState ?? ExhaustiveStateUnknown;
  if (exhaustiveState === ExhaustiveStateUnknown) {
    links!.exhaustiveState = ExhaustiveStateComputing;
    const isExhaustive = Checker_computeExhaustiveSwitchStatement(receiver, node);
    if (links!.exhaustiveState === ExhaustiveStateComputing) {
      links!.exhaustiveState = IfElse(isExhaustive, ExhaustiveStateTrue, ExhaustiveStateFalse);
    }
  } else if (exhaustiveState === ExhaustiveStateComputing) {
    links!.exhaustiveState = ExhaustiveStateFalse;
  }
  return links!.exhaustiveState === ExhaustiveStateTrue;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/flow.go::method::Checker.computeExhaustiveSwitchStatement","kind":"method","status":"implemented","sigHash":"186abe2b5e0f19883087f209710e6859c34ea801a2f8b7b6573e2db3e0bd0e09","bodyHash":"d144262d9b6579bb13234c5ecb7f51029fc4eb306b8831f54f6090fa328123ef"}
 *
 * Go source:
 * func (c *Checker) computeExhaustiveSwitchStatement(node *ast.Node) bool {
 * 	if ast.IsTypeOfExpression(node.Expression()) {
 * 		witnesses := c.getSwitchClauseTypeOfWitnesses(node)
 * 		if witnesses == nil {
 * 			return false
 * 		}
 * 		operandConstraint := c.getBaseConstraintOrType(c.checkExpressionCached(node.Expression().Expression()))
 * 		// Get the not-equal flags for all handled cases.
 * 		notEqualFacts := c.getNotEqualFactsFromTypeofSwitch(0, 0, witnesses)
 * 		if operandConstraint.flags&TypeFlagsAnyOrUnknown != 0 {
 * 			// We special case the top types to be exhaustive when all cases are handled.
 * 			return TypeFactsAllTypeofNE&notEqualFacts == TypeFactsAllTypeofNE
 * 		}
 * 		// A missing not-equal flag indicates that the type wasn't handled by some case.
 * 		return !someType(operandConstraint, func(t *Type) bool {
 * 			return c.getTypeFacts(t, notEqualFacts) == notEqualFacts
 * 		})
 * 	}
 * 	t := c.getBaseConstraintOrType(c.checkExpressionCached(node.Expression()))
 * 	if !isLiteralType(t) {
 * 		return false
 * 	}
 * 	switchTypes := c.getSwitchClauseTypes(node)
 * 	if len(switchTypes) == 0 || core.Some(switchTypes, isNeitherUnitTypeNorNever) {
 * 		return false
 * 	}
 * 	return c.eachTypeContainedIn(c.mapType(t, c.getRegularTypeOfLiteralType), switchTypes)
 * }
 */
export function Checker_computeExhaustiveSwitchStatement(receiver: GoPtr<Checker>, node: GoPtr<Node>): bool {
  if (IsTypeOfExpression(Node_Expression(node))) {
    const witnesses = Checker_getSwitchClauseTypeOfWitnesses(receiver, node);
    if (witnesses === undefined) {
      return false;
    }
    const operandConstraint = Checker_getBaseConstraintOrType(receiver, Checker_checkExpressionCached(receiver, Node_Expression(Node_Expression(node))));
    const notEqualFacts = Checker_getNotEqualFactsFromTypeofSwitch(receiver, 0, 0, witnesses);
    if (operandConstraint!.flags & TypeFlagsAnyOrUnknown) {
      return (TypeFactsAllTypeofNE & notEqualFacts) === TypeFactsAllTypeofNE;
    }
    return !someType(operandConstraint, (t) => Checker_getTypeFacts(receiver, t, notEqualFacts) === notEqualFacts);
  }
  const t = Checker_getBaseConstraintOrType(receiver, Checker_checkExpressionCached(receiver, Node_Expression(node)));
  if (!isLiteralType(t)) {
    return false;
  }
  const switchTypes = Checker_getSwitchClauseTypes(receiver, node);
  if (switchTypes.length === 0 || Some(switchTypes, isNeitherUnitTypeNorNever)) {
    return false;
  }
  return Checker_eachTypeContainedIn(receiver, Checker_mapType(receiver, t, (x) => Checker_getRegularTypeOfLiteralType(receiver, x)), switchTypes);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/flow.go::method::Checker.eachTypeContainedIn","kind":"method","status":"implemented","sigHash":"7cd52ee20e152f59fef8f0eb32b0689234e9d8990580ad8a56224e60548d7606","bodyHash":"6b8ca65d7063df6b22ee0679dfe74698ae73ee0e73efda19362a5aead58aa987"}
 *
 * Go source:
 * func (c *Checker) eachTypeContainedIn(source *Type, types []*Type) bool {
 * 	if source.flags&TypeFlagsUnion != 0 {
 * 		return !core.Some(source.AsUnionType().types, func(t *Type) bool {
 * 			return !slices.Contains(types, t)
 * 		})
 * 	}
 * 	return slices.Contains(types, source)
 * }
 */
export function Checker_eachTypeContainedIn(receiver: GoPtr<Checker>, source: GoPtr<Type>, types: GoSlice<GoPtr<Type>>): bool {
  if (source!.flags & TypeFlagsUnion) {
    return !Some(Type_Types(source), (t: GoPtr<Type>) => !types.includes(t));
  }
  return types.includes(source);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/flow.go::method::Checker.getSwitchClauseTypeOfWitnesses","kind":"method","status":"implemented","sigHash":"fee9f9536b569c461a61593e508dfd249091668086dd9494d6c7568096751794","bodyHash":"27cd2073cc54e7704ae75dc98c0133bf88136d8e9f61621119d6d35f221bf5ec"}
 *
 * Go source:
 * func (c *Checker) getSwitchClauseTypeOfWitnesses(node *ast.Node) []string {
 * 	links := c.switchStatementLinks.Get(node)
 * 	if !links.witnessesComputed {
 * 		clauses := node.AsSwitchStatement().CaseBlock.AsCaseBlock().Clauses.Nodes
 * 		witnesses := make([]string, len(clauses))
 * 		for i, clause := range clauses {
 * 			if clause.Kind == ast.KindCaseClause {
 * 				if !ast.IsStringLiteralLike(clause.Expression()) {
 * 					witnesses = nil
 * 					break
 * 				}
 * 				if text := clause.Expression().Text(); !slices.Contains(witnesses, text) {
 * 					witnesses[i] = text
 * 				}
 * 			}
 * 		}
 * 		links.witnesses = witnesses
 * 		links.witnessesComputed = true
 * 	}
 * 	return links.witnesses
 * }
 */
export function Checker_getSwitchClauseTypeOfWitnesses(receiver: GoPtr<Checker>, node: GoPtr<Node>): GoSlice<string> {
  const links = LinkStore_Get<GoPtr<Node>, SwitchStatementLinks>(receiver!.switchStatementLinks as LinkStore<GoPtr<Node>, SwitchStatementLinks>, node);
  if (!links!.witnessesComputed) {
    const clauses = AsCaseBlock(AsSwitchStatement(node)!.CaseBlock as unknown as GoPtr<Node>)!.Clauses!.Nodes;
    const witnesses: string[] = new Array(clauses.length).fill("");
    let valid = true;
    for (let i = 0; i < clauses.length; i++) {
      const clause = clauses[i];
      if (clause!.Kind === KindCaseClause) {
        if (!IsStringLiteralLike(Node_Expression(clause))) {
          valid = false;
          break;
        }
        const text = Node_Text(Node_Expression(clause));
        if (!witnesses.includes(text)) {
          witnesses[i] = text;
        }
      }
    }
    links!.witnesses = valid ? witnesses : (undefined as never);
    links!.witnessesComputed = true;
  }
  return links!.witnesses;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/flow.go::method::Checker.getNotEqualFactsFromTypeofSwitch","kind":"method","status":"implemented","sigHash":"1693b22b69eb8b995a4221b8cd1d1b39fa229847f220baa8f5bc650cca139aaa","bodyHash":"9618154099b08617dd96c8aabd17e9127f4f8be0f39bf1fd17f47ead7e08231b"}
 *
 * Go source:
 * func (c *Checker) getNotEqualFactsFromTypeofSwitch(start int, end int, witnesses []string) TypeFacts {
 * 	var facts TypeFacts = TypeFactsNone
 * 	for i, witness := range witnesses {
 * 		if (i < start || i >= end) && witness != "" {
 * 			f, ok := typeofNEFacts[witness]
 * 			if !ok {
 * 				f = TypeFactsTypeofNEHostObject
 * 			}
 * 			facts |= f
 * 		}
 * 	}
 * 	return facts
 * }
 */
export function Checker_getNotEqualFactsFromTypeofSwitch(receiver: GoPtr<Checker>, start: int, end: int, witnesses: GoSlice<string>): TypeFacts {
  let facts: TypeFacts = TypeFactsNone;
  for (let i = 0; i < witnesses.length; i++) {
    const witness = witnesses[i];
      if ((i < start || i >= end) && witness !== undefined && witness !== "") {
      const f = typeofNEFacts.get(witness);
      facts |= (f !== undefined ? f : TypeFactsTypeofNEHostObject);
    }
  }
  return facts;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/flow.go::method::Checker.getSwitchClauseTypes","kind":"method","status":"implemented","sigHash":"f516fe08e5566e5cac58c41809ad933f32ed2126f49b7aab7e957b8024ee3eaf","bodyHash":"c15c0d90f214708c1259c32486ca8e5fe96d6f8102ad8684f4aef13593dd0789"}
 *
 * Go source:
 * func (c *Checker) getSwitchClauseTypes(node *ast.Node) []*Type {
 * 	links := c.switchStatementLinks.Get(node)
 * 	if !links.switchTypesComputed {
 * 		clauses := node.AsSwitchStatement().CaseBlock.AsCaseBlock().Clauses.Nodes
 * 		types := make([]*Type, len(clauses))
 * 		for i, clause := range clauses {
 * 			types[i] = c.getTypeOfSwitchClause(clause)
 * 		}
 * 		links.switchTypes = types
 * 		links.switchTypesComputed = true
 * 	}
 * 	return links.switchTypes
 * }
 */
export function Checker_getSwitchClauseTypes(receiver: GoPtr<Checker>, node: GoPtr<Node>): GoSlice<GoPtr<Type>> {
  const links = LinkStore_Get<GoPtr<Node>, SwitchStatementLinks>(receiver!.switchStatementLinks as LinkStore<GoPtr<Node>, SwitchStatementLinks>, node);
  if (!links!.switchTypesComputed) {
    const clauses = AsCaseBlock(AsSwitchStatement(node)!.CaseBlock as unknown as GoPtr<Node>)!.Clauses!.Nodes;
    const types: GoPtr<Type>[] = new Array(clauses.length);
    for (let i = 0; i < clauses.length; i++) {
      types[i] = Checker_getTypeOfSwitchClause(receiver, clauses[i]);
    }
    links!.switchTypes = types;
    links!.switchTypesComputed = true;
  }
  return links!.switchTypes;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/flow.go::method::Checker.getTypeOfSwitchClause","kind":"method","status":"implemented","sigHash":"99b1f904d6789c5694bc055ea968def7413f1d8aaa95d346a7cbcd05c3c84686","bodyHash":"9fedce3be65fa0820be8e717332341a9a0a58a7ec3ab1b3593cfa0eb15e33c88"}
 *
 * Go source:
 * func (c *Checker) getTypeOfSwitchClause(clause *ast.Node) *Type {
 * 	if clause.Kind == ast.KindCaseClause {
 * 		return c.getRegularTypeOfLiteralType(c.getTypeOfExpression(clause.Expression()))
 * 	}
 * 	return c.neverType
 * }
 */
export function Checker_getTypeOfSwitchClause(receiver: GoPtr<Checker>, clause: GoPtr<Node>): GoPtr<Type> {
  if (clause!.Kind === KindCaseClause) {
    return Checker_getRegularTypeOfLiteralType(receiver, Checker_getTypeOfExpression(receiver, Node_Expression(clause)));
  }
  return receiver!.neverType;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/flow.go::method::Checker.getEffectsSignature","kind":"method","status":"implemented","sigHash":"88211a47e808ab3a83de08132ae9af558d5355ab15ec6a4f0ba4311b78dcd912","bodyHash":"65f5743e24ae22f1daf88fa1352bab70455f42aec5d2aefa6907e076f124e00f"}
 *
 * Go source:
 * func (c *Checker) getEffectsSignature(node *ast.Node) *Signature {
 * 	links := c.signatureLinks.Get(node)
 * 	signature := links.effectsSignature
 * 	if signature == nil {
 * 		// A call expression parented by an expression statement is a potential assertion. Other call
 * 		// expressions are potential type predicate function calls. In order to avoid triggering
 * 		// circularities in control flow analysis, we use getTypeOfDottedName when resolving the call
 * 		// target expression of an assertion.
 * 		var funcType *Type
 * 		if ast.IsBinaryExpression(node) {
 * 			rightType := c.checkNonNullExpression(node.AsBinaryExpression().Right)
 * 			funcType = c.getSymbolHasInstanceMethodOfObjectType(rightType)
 * 		} else if ast.IsExpressionStatement(node.Parent) {
 * 			funcType = c.getTypeOfDottedName(node.Expression(), nil /*diagnostic* /)
 * 		} else if node.Expression().Kind != ast.KindSuperKeyword {
 * 			if ast.IsOptionalChain(node) {
 * 				funcType = c.checkNonNullType(c.getOptionalExpressionType(c.checkExpression(node.Expression()), node.Expression()), node.Expression())
 * 			} else {
 * 				funcType = c.checkNonNullExpression(node.Expression())
 * 			}
 * 		}
 * 		var apparentType *Type
 * 		if funcType != nil {
 * 			apparentType = c.getApparentType(funcType)
 * 		}
 * 		signatures := c.getSignaturesOfType(core.OrElse(apparentType, c.unknownType), SignatureKindCall)
 * 		switch {
 * 		case len(signatures) == 1 && len(signatures[0].typeParameters) == 0:
 * 			signature = signatures[0]
 * 		case core.Some(signatures, c.hasTypePredicateOrNeverReturnType):
 * 			signature = c.getResolvedSignature(node, nil, CheckModeNormal)
 * 		}
 * 		if !(signature != nil && c.hasTypePredicateOrNeverReturnType(signature)) {
 * 			signature = c.unknownSignature
 * 		}
 * 		links.effectsSignature = signature
 * 	}
 * 	if signature == c.unknownSignature {
 * 		return nil
 * 	}
 * 	return signature
 * }
 */
export function Checker_getEffectsSignature(receiver: GoPtr<Checker>, node: GoPtr<Node>): GoPtr<Signature> {
  const links = LinkStore_Get<GoPtr<Node>, SignatureLinks>(receiver!.signatureLinks as LinkStore<GoPtr<Node>, SignatureLinks>, node);
  let signature = links!.effectsSignature;
  if (signature === undefined) {
    let funcType: GoPtr<Type>;
    if (IsBinaryExpression(node)) {
      const rightType = Checker_checkNonNullExpression(receiver, AsBinaryExpression(node)!.Right);
      funcType = Checker_getSymbolHasInstanceMethodOfObjectType(receiver, rightType);
    } else if (IsExpressionStatement(node!.Parent)) {
      funcType = Checker_getTypeOfDottedName(receiver, Node_Expression(node), undefined);
    } else if (Node_Expression(node)!.Kind !== KindSuperKeyword) {
      if (IsOptionalChain(node)) {
        funcType = Checker_checkNonNullType(receiver, Checker_getOptionalExpressionType(receiver, Checker_checkExpression(receiver, Node_Expression(node)), Node_Expression(node)), Node_Expression(node));
      } else {
        funcType = Checker_checkNonNullExpression(receiver, Node_Expression(node));
      }
    }
    let apparentType: GoPtr<Type>;
    if (funcType !== undefined) {
      apparentType = Checker_getApparentType(receiver, funcType);
    }
    const signatures = Checker_getSignaturesOfType(receiver, OrElse(apparentType, receiver!.unknownType), SignatureKindCall);
    if (signatures.length === 1 && signatures[0]!.typeParameters === undefined) {
      signature = signatures[0];
    } else if (Some(signatures, (s) => Checker_hasTypePredicateOrNeverReturnType(receiver, s))) {
      signature = Checker_getResolvedSignature(receiver, node, undefined, CheckModeNormal);
    }
    if (!(signature !== undefined && Checker_hasTypePredicateOrNeverReturnType(receiver, signature))) {
      signature = receiver!.unknownSignature;
    }
    links!.effectsSignature = signature;
  }
  if (signature === receiver!.unknownSignature) {
    return undefined;
  }
  return signature;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/flow.go::method::Checker.getSymbolHasInstanceMethodOfObjectType","kind":"method","status":"implemented","sigHash":"f84175cd9cbc1b26d2a4211916c5f8e82c63e2afe4f5d21baf987745ef844a66","bodyHash":"18c979d9eb840ac83fbedfd1912bad03df2c5b3446481ed699f805d1b7caa215"}
 *
 * Go source:
 * func (c *Checker) getSymbolHasInstanceMethodOfObjectType(t *Type) *Type {
 * 	hasInstancePropertyName := c.getPropertyNameForKnownSymbolName("hasInstance")
 * 	if c.allTypesAssignableToKind(t, TypeFlagsNonPrimitive) {
 * 		hasInstanceProperty := c.getPropertyOfType(t, hasInstancePropertyName)
 * 		if hasInstanceProperty != nil {
 * 			hasInstancePropertyType := c.getTypeOfSymbol(hasInstanceProperty)
 * 			if hasInstancePropertyType != nil && len(c.getSignaturesOfType(hasInstancePropertyType, SignatureKindCall)) != 0 {
 * 				return hasInstancePropertyType
 * 			}
 * 		}
 * 	}
 * 	return nil
 * }
 */
export function Checker_getSymbolHasInstanceMethodOfObjectType(receiver: GoPtr<Checker>, t: GoPtr<Type>): GoPtr<Type> {
  const hasInstancePropertyName = Checker_getPropertyNameForKnownSymbolName(receiver, "hasInstance");
  if (Checker_allTypesAssignableToKind(receiver, t, TypeFlagsNonPrimitive)) {
    const hasInstanceProperty = Checker_getPropertyOfType(receiver, t, hasInstancePropertyName);
    if (hasInstanceProperty !== undefined) {
      const hasInstancePropertyType = Checker_getTypeOfSymbol(receiver, hasInstanceProperty);
      if (hasInstancePropertyType !== undefined && Checker_getSignaturesOfType(receiver, hasInstancePropertyType, SignatureKindCall).length !== 0) {
        return hasInstancePropertyType;
      }
    }
  }
  return undefined;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/flow.go::method::Checker.getPropertyNameForKnownSymbolName","kind":"method","status":"implemented","sigHash":"4dd639c5b23f5f3462934a400a4ee9d8d8a1098d42000b3dfa956328426be429","bodyHash":"4f7c2c060b465ca2d6ab51bd608511b7d1d5f0e52fb23eb6d02bcb1a75626f5d"}
 *
 * Go source:
 * func (c *Checker) getPropertyNameForKnownSymbolName(symbolName string) string {
 * 	ctorType := c.getGlobalESSymbolConstructorSymbolOrNil()
 * 	if ctorType != nil {
 * 		uniqueType := c.getTypeOfPropertyOfType(c.getTypeOfSymbol(ctorType), symbolName)
 * 		if uniqueType != nil && isTypeUsableAsPropertyName(uniqueType) {
 * 			return getPropertyNameFromType(uniqueType)
 * 		}
 * 	}
 * 	return ast.InternalSymbolNamePrefix + "@" + symbolName
 * }
 */
export function Checker_getPropertyNameForKnownSymbolName(receiver: GoPtr<Checker>, symbolName: string): string {
  const ctorType = receiver!.getGlobalESSymbolConstructorSymbolOrNil();
  if (ctorType !== undefined) {
    const uniqueType = Checker_getTypeOfPropertyOfType(receiver, Checker_getTypeOfSymbol(receiver, ctorType), symbolName);
    if (uniqueType !== undefined && isTypeUsableAsPropertyName(uniqueType)) {
      return getPropertyNameFromType(uniqueType);
    }
  }
  return InternalSymbolNamePrefix + "@" + symbolName;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/flow.go::method::Checker.getTypeOfDottedName","kind":"method","status":"implemented","sigHash":"62dbd99f176adb5e0be7d605fbf7d414f09da5d5dfc1e35edc64df756d4c18d3","bodyHash":"0a8241339cb3468195ce6e065d8c4f2f053482933dd1b2cf00091627ce096830"}
 *
 * Go source:
 * func (c *Checker) getTypeOfDottedName(node *ast.Node, diagnostic *ast.Diagnostic) *Type {
 * 	if node.Flags&ast.NodeFlagsInWithStatement == 0 {
 * 		switch node.Kind {
 * 		case ast.KindIdentifier:
 * 			symbol := c.getExportSymbolOfValueSymbolIfExported(c.getResolvedSymbol(node))
 * 			return c.getExplicitTypeOfSymbol(symbol, diagnostic)
 * 		case ast.KindThisKeyword:
 * 			return c.getExplicitThisType(node)
 * 		case ast.KindSuperKeyword:
 * 			return c.checkSuperExpression(node)
 * 		case ast.KindPropertyAccessExpression:
 * 			t := c.getTypeOfDottedName(node.Expression(), diagnostic)
 * 			if t != nil {
 * 				name := node.Name()
 * 				var prop *ast.Symbol
 * 				if ast.IsPrivateIdentifier(name) {
 * 					if t.symbol != nil {
 * 						prop = c.getPropertyOfType(t, binder.GetSymbolNameForPrivateIdentifier(t.symbol, name.Text()))
 * 					}
 * 				} else {
 * 					prop = c.getPropertyOfType(t, name.Text())
 * 				}
 * 				if prop != nil {
 * 					return c.getExplicitTypeOfSymbol(prop, diagnostic)
 * 				}
 * 			}
 * 		case ast.KindParenthesizedExpression:
 * 			return c.getTypeOfDottedName(node.Expression(), diagnostic)
 * 		}
 * 	}
 * 	return nil
 * }
 */
export function Checker_getTypeOfDottedName(receiver: GoPtr<Checker>, node: GoPtr<Node>, diagnostic: GoPtr<Diagnostic>): GoPtr<Type> {
  if (!(node!.Flags & NodeFlagsInWithStatement)) {
    switch (node!.Kind) {
      case KindIdentifier: {
        const symbol = Checker_getExportSymbolOfValueSymbolIfExported(receiver, Checker_getResolvedSymbol(receiver, node));
        return Checker_getExplicitTypeOfSymbol(receiver, symbol, diagnostic);
      }
      case KindThisKeyword:
        return Checker_getExplicitThisType(receiver, node);
      case KindSuperKeyword:
        return Checker_checkSuperExpression(receiver, node);
      case KindPropertyAccessExpression: {
        const t = Checker_getTypeOfDottedName(receiver, Node_Expression(node), diagnostic);
        if (t !== undefined) {
          const name = Node_Name(node);
          let prop: GoPtr<Symbol>;
          if (IsPrivateIdentifier(name)) {
            if (t!.symbol !== undefined) {
              prop = Checker_getPropertyOfType(receiver, t, GetSymbolNameForPrivateIdentifier(t!.symbol, Node_Text(name)));
            }
          } else {
            prop = Checker_getPropertyOfType(receiver, t, Node_Text(name));
          }
          if (prop !== undefined) {
            return Checker_getExplicitTypeOfSymbol(receiver, prop, diagnostic);
          }
        }
        break;
      }
      case KindParenthesizedExpression:
        return Checker_getTypeOfDottedName(receiver, Node_Expression(node), diagnostic);
    }
  }
  return undefined;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/flow.go::method::Checker.getExplicitTypeOfSymbol","kind":"method","status":"implemented","sigHash":"57b603ede7d68fe10e37d7d09635f86d00b81e68459bc5e7682a18a58e3ab973","bodyHash":"32ece9f6148767f3fdc5b4fed7d719c4b32124afbb819e93e4eb15e3da32a946"}
 *
 * Go source:
 * func (c *Checker) getExplicitTypeOfSymbol(symbol *ast.Symbol, diagnostic *ast.Diagnostic) *Type {
 * 	symbol = c.resolveSymbol(symbol)
 * 	if symbol.Flags&(ast.SymbolFlagsFunction|ast.SymbolFlagsMethod|ast.SymbolFlagsClass|ast.SymbolFlagsValueModule) != 0 {
 * 		return c.getTypeOfSymbol(symbol)
 * 	}
 * 	if symbol.Flags&(ast.SymbolFlagsVariable|ast.SymbolFlagsProperty) != 0 {
 * 		if symbol.CheckFlags&ast.CheckFlagsMapped != 0 {
 * 			origin := c.mappedSymbolLinks.Get(symbol).syntheticOrigin
 * 			if origin != nil && c.getExplicitTypeOfSymbol(origin, diagnostic) != nil {
 * 				return c.getTypeOfSymbol(symbol)
 * 			}
 * 		}
 * 		declaration := symbol.ValueDeclaration
 * 		if declaration != nil {
 * 			if c.isDeclarationWithExplicitTypeAnnotation(declaration) {
 * 				return c.getTypeOfSymbol(symbol)
 * 			}
 * 			if ast.IsVariableDeclaration(declaration) && ast.IsForOfStatement(declaration.Parent.Parent) {
 * 				statement := declaration.Parent.Parent
 * 				expressionType := c.getTypeOfDottedName(statement.Expression(), nil /*diagnostic* /)
 * 				if expressionType != nil {
 * 					var use IterationUse
 * 					if statement.AsForInOrOfStatement().AwaitModifier != nil {
 * 						use = IterationUseForAwaitOf
 * 					} else {
 * 						use = IterationUseForOf
 * 					}
 * 					return c.checkIteratedTypeOrElementType(use, expressionType, c.undefinedType, nil /*errorNode* /)
 * 				}
 * 			}
 * 			if diagnostic != nil {
 * 				diagnostic.AddRelatedInfo(createDiagnosticForNode(declaration, diagnostics.X_0_needs_an_explicit_type_annotation, c.symbolToString(symbol)))
 * 			}
 * 		}
 * 	}
 * 	return nil
 * }
 */
export function Checker_getExplicitTypeOfSymbol(receiver: GoPtr<Checker>, symbol_: GoPtr<Symbol>, diagnostic: GoPtr<Diagnostic>): GoPtr<Type> {
  const symbol = Checker_resolveSymbol(receiver, symbol_);
  if (symbol!.Flags & (SymbolFlagsFunction | SymbolFlagsMethod | SymbolFlagsClass | SymbolFlagsValueModule)) {
    return Checker_getTypeOfSymbol(receiver, symbol);
  }
  if (symbol!.Flags & (SymbolFlagsVariable | SymbolFlagsProperty)) {
    if (symbol!.CheckFlags & CheckFlagsMapped) {
      const origin = LinkStore_Get<GoPtr<Symbol>, MappedSymbolLinks>(receiver!.mappedSymbolLinks as LinkStore<GoPtr<Symbol>, MappedSymbolLinks>, symbol)!.syntheticOrigin;
      if (origin !== undefined && Checker_getExplicitTypeOfSymbol(receiver, origin, diagnostic) !== undefined) {
        return Checker_getTypeOfSymbol(receiver, symbol);
      }
    }
    const declaration = symbol!.ValueDeclaration;
    if (declaration !== undefined) {
      if (Checker_isDeclarationWithExplicitTypeAnnotation(receiver, declaration)) {
        return Checker_getTypeOfSymbol(receiver, symbol);
      }
      if (IsVariableDeclaration(declaration) && IsForOfStatement(declaration!.Parent!.Parent)) {
        const statement = declaration!.Parent!.Parent;
        const expressionType = Checker_getTypeOfDottedName(receiver, Node_Expression(statement), undefined);
        if (expressionType !== undefined) {
          const use: typeof IterationUseForAwaitOf | typeof IterationUseForOf = AsForInOrOfStatement(statement)!.AwaitModifier !== undefined ? IterationUseForAwaitOf : IterationUseForOf;
          return Checker_checkIteratedTypeOrElementType(receiver, use, expressionType, receiver!.undefinedType, undefined);
        }
      }
      if (diagnostic !== undefined) {
        Diagnostic_AddRelatedInfo(diagnostic, createDiagnosticForNode(declaration, X_0_needs_an_explicit_type_annotation, Checker_symbolToString(receiver, symbol)));
      }
    }
  }
  return undefined;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/flow.go::method::Checker.isDeclarationWithExplicitTypeAnnotation","kind":"method","status":"implemented","sigHash":"eeb9d24f15b2e6ed4d8272031f04e5df4b03734d67d8b88863eaf7c14007b49e","bodyHash":"b1601b464c974dc74bdd698169335e1fb1e13ec3e0e5ba90c46ed6749b56aa90"}
 *
 * Go source:
 * func (c *Checker) isDeclarationWithExplicitTypeAnnotation(node *ast.Node) bool {
 * 	return (ast.IsVariableDeclaration(node) || ast.IsPropertyDeclaration(node) || ast.IsPropertySignatureDeclaration(node) || ast.IsParameterDeclaration(node)) && node.Type() != nil ||
 * 		c.isExpandoPropertyFunctionWithReturnTypeAnnotation(node)
 * }
 */
export function Checker_isDeclarationWithExplicitTypeAnnotation(receiver: GoPtr<Checker>, node: GoPtr<Node>): bool {
  return ((IsVariableDeclaration(node) || IsPropertyDeclaration(node) || IsPropertySignatureDeclaration(node) || IsParameterDeclaration(node)) && Node_Type(node) !== undefined) ||
    Checker_isExpandoPropertyFunctionWithReturnTypeAnnotation(receiver, node);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/flow.go::method::Checker.isExpandoPropertyFunctionWithReturnTypeAnnotation","kind":"method","status":"implemented","sigHash":"e3fbec1ac48c413501816ae9248cc4486a9af13d7093940b62b006ed956bf209","bodyHash":"108dfaba309a8ae267e3f9fba7c65547e584f28bf4f31637b71ec2103bda1845"}
 *
 * Go source:
 * func (c *Checker) isExpandoPropertyFunctionWithReturnTypeAnnotation(node *ast.Node) bool {
 * 	if ast.IsBinaryExpression(node) {
 * 		if expr := node.AsBinaryExpression().Right; ast.IsFunctionLike(expr) && expr.Type() != nil {
 * 			return true
 * 		}
 * 	}
 * 	return false
 * }
 */
export function Checker_isExpandoPropertyFunctionWithReturnTypeAnnotation(receiver: GoPtr<Checker>, node: GoPtr<Node>): bool {
  if (IsBinaryExpression(node)) {
    const expr = AsBinaryExpression(node)!.Right;
    if (IsFunctionLike(expr) && Node_Type(expr) !== undefined) {
      return true;
    }
  }
  return false;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/flow.go::method::Checker.hasTypePredicateOrNeverReturnType","kind":"method","status":"implemented","sigHash":"d58e75abcc54db62f92e1af33103a6d697c8bf5c19bf06db8a68bbf8c926bc25","bodyHash":"b03039a2cb684d823755eb96dab1551f3a5d6dd2a137ce7722f5d65b796860e2"}
 *
 * Go source:
 * func (c *Checker) hasTypePredicateOrNeverReturnType(sig *Signature) bool {
 * 	return c.getTypePredicateOfSignature(sig) != nil || sig.declaration != nil && core.OrElse(c.getReturnTypeFromAnnotation(sig.declaration), c.unknownType).flags&TypeFlagsNever != 0
 * }
 */
export function Checker_hasTypePredicateOrNeverReturnType(receiver: GoPtr<Checker>, sig: GoPtr<Signature>): bool {
  return Checker_getTypePredicateOfSignature(receiver, sig) !== undefined || sig!.declaration !== undefined && !!(OrElse(Checker_getReturnTypeFromAnnotation(receiver, sig!.declaration), receiver!.unknownType)!.flags & TypeFlagsNever);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/flow.go::method::Checker.getExplicitThisType","kind":"method","status":"implemented","sigHash":"51fdb849437df032c10d1faa988010cfef13103e7d07b815fb25001be1f71afc","bodyHash":"9452c961dec1148a9d102f2205080a01451a8d9e167801d24c734083da027c8a"}
 *
 * Go source:
 * func (c *Checker) getExplicitThisType(node *ast.Node) *Type {
 * 	container := ast.GetThisContainer(node, false /*includeArrowFunctions* /, false /*includeClassComputedPropertyName* /)
 * 	if ast.IsFunctionLike(container) {
 * 		signature := c.getSignatureFromDeclaration(container)
 * 		if signature.thisParameter != nil {
 * 			return c.getExplicitTypeOfSymbol(signature.thisParameter, nil)
 * 		}
 * 	}
 * 	if container.Parent != nil && ast.IsClassLike(container.Parent) {
 * 		symbol := c.getSymbolOfDeclaration(container.Parent)
 * 		if ast.IsStatic(container) {
 * 			return c.getTypeOfSymbol(symbol)
 * 		} else {
 * 			return c.getDeclaredTypeOfSymbol(symbol).AsInterfaceType().thisType
 * 		}
 * 	}
 * 	return nil
 * }
 */
export function Checker_getExplicitThisType(receiver: GoPtr<Checker>, node: GoPtr<Node>): GoPtr<Type> {
  const container = GetThisContainer(node, false, false);
  if (IsFunctionLike(container)) {
    const signature = Checker_getSignatureFromDeclaration(receiver, container);
    if (signature!.thisParameter !== undefined) {
      return Checker_getExplicitTypeOfSymbol(receiver, signature!.thisParameter, undefined);
    }
  }
  if (container!.Parent !== undefined && IsClassLike(container!.Parent)) {
    const symbol = Checker_getSymbolOfDeclaration(receiver, container!.Parent);
    if (IsStatic(container)) {
      return Checker_getTypeOfSymbol(receiver, symbol);
    } else {
      return Type_AsInterfaceType(Checker_getDeclaredTypeOfSymbol(receiver, symbol))!.thisType;
    }
  }
  return undefined;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/flow.go::method::Checker.getInitialType","kind":"method","status":"implemented","sigHash":"dec4f2f0cb2bf5e4ff2b235fd6288000ce8211c2eaa7a4410c5624b17389ac39","bodyHash":"0f0a839fe956b155849b96cb219747e0061b89107063085fb54214ab50bce89d"}
 *
 * Go source:
 * func (c *Checker) getInitialType(node *ast.Node) *Type {
 * 	switch node.Kind {
 * 	case ast.KindVariableDeclaration:
 * 		return c.getInitialTypeOfVariableDeclaration(node)
 * 	case ast.KindBindingElement:
 * 		return c.getInitialTypeOfBindingElement(node)
 * 	}
 * 	panic("Unhandled case in getInitialType")
 * }
 */
export function Checker_getInitialType(receiver: GoPtr<Checker>, node: GoPtr<Node>): GoPtr<Type> {
  switch (node!.Kind) {
    case KindVariableDeclaration:
      return Checker_getInitialTypeOfVariableDeclaration(receiver, node);
    case KindBindingElement:
      return Checker_getInitialTypeOfBindingElement(receiver, node);
  }
  throw new globalThis.Error("Unhandled case in getInitialType");
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/flow.go::method::Checker.getInitialTypeOfVariableDeclaration","kind":"method","status":"implemented","sigHash":"58522122623ee1628f836e8444e32f3520fb7177e95199d416e438c42a0576c8","bodyHash":"fd1ffe956d0b057dc0941c4863ed80ff08ef0fa065a7a8ac06ec9a09ff787a67"}
 *
 * Go source:
 * func (c *Checker) getInitialTypeOfVariableDeclaration(node *ast.Node) *Type {
 * 	if node.Initializer() != nil {
 * 		return c.getTypeOfInitializer(node.Initializer())
 * 	}
 * 	if ast.IsForInStatement(node.Parent.Parent) {
 * 		return c.stringType
 * 	}
 * 	if ast.IsForOfStatement(node.Parent.Parent) {
 * 		t := c.checkRightHandSideOfForOf(node.Parent.Parent)
 * 		if t != nil {
 * 			return t
 * 		}
 * 	}
 * 	return c.errorType
 * }
 */
export function Checker_getInitialTypeOfVariableDeclaration(receiver: GoPtr<Checker>, node: GoPtr<Node>): GoPtr<Type> {
  const initializer = Node_Initializer(node);
  if (initializer !== undefined) {
    return Checker_getTypeOfInitializer(receiver, initializer);
  }
  if (IsForInStatement(node!.Parent!.Parent)) {
    return receiver!.stringType;
  }
  if (IsForOfStatement(node!.Parent!.Parent)) {
    const t = Checker_checkRightHandSideOfForOf(receiver, node!.Parent!.Parent);
    if (t !== undefined) { return t; }
  }
  return receiver!.errorType;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/flow.go::method::Checker.getTypeOfInitializer","kind":"method","status":"implemented","sigHash":"d3d7c104b20fed6ea84999f3e80d2bb94e046632d8df210f108bb169889f4d5f","bodyHash":"ddf823bc7f66ff5eeaa31a183a8cb6f8e09ca7c37fc8191c5149640ceff11030"}
 *
 * Go source:
 * func (c *Checker) getTypeOfInitializer(node *ast.Node) *Type {
 * 	// Return the cached type if one is available. If the type of the variable was inferred
 * 	// from its initializer, we'll already have cached the type. Otherwise we compute it now
 * 	// without caching such that transient types are reflected.
 * 	if c.typeNodeLinks.Has(node) {
 * 		t := c.typeNodeLinks.Get(node).resolvedType
 * 		if t != nil {
 * 			return t
 * 		}
 * 	}
 * 	return c.getTypeOfExpression(node)
 * }
 */
export function Checker_getTypeOfInitializer(receiver: GoPtr<Checker>, node: GoPtr<Node>): GoPtr<Type> {
  if (LinkStore_Has<GoPtr<Node>, TypeNodeLinks>(receiver!.typeNodeLinks as unknown as LinkStore<GoPtr<Node>, TypeNodeLinks>, node)) {
    const t = LinkStore_Get<GoPtr<Node>, TypeNodeLinks>(receiver!.typeNodeLinks as unknown as LinkStore<GoPtr<Node>, TypeNodeLinks>, node)!.resolvedType;
    if (t !== undefined) { return t; }
  }
  return Checker_getTypeOfExpression(receiver, node);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/flow.go::method::Checker.getInitialTypeOfBindingElement","kind":"method","status":"implemented","sigHash":"76dbc8c43c168cf642b8ca9476a2e56cf589c400a9ac9f70a8d14e62da5c2d10","bodyHash":"9e42e520c973cec372522884420182fed47b92888b5adc65342272e5050890fd"}
 *
 * Go source:
 * func (c *Checker) getInitialTypeOfBindingElement(node *ast.Node) *Type {
 * 	pattern := node.Parent
 * 	parentType := c.getInitialType(pattern.Parent)
 * 	var t *Type
 * 	switch {
 * 	case ast.IsObjectBindingPattern(pattern):
 * 		t = c.getTypeOfDestructuredProperty(parentType, getBindingElementPropertyName(node))
 * 	case !hasDotDotDotToken(node):
 * 		t = c.getTypeOfDestructuredArrayElement(parentType, slices.Index(pattern.Elements(), node))
 * 	default:
 * 		t = c.getTypeOfDestructuredSpreadExpression(parentType)
 * 	}
 * 	return c.getTypeWithDefault(t, node.Initializer())
 * }
 */
export function Checker_getInitialTypeOfBindingElement(receiver: GoPtr<Checker>, node: GoPtr<Node>): GoPtr<Type> {
  const pattern = node!.Parent;
  const parentType = Checker_getInitialType(receiver, pattern!.Parent);
  let t: GoPtr<Type>;
  if (IsObjectBindingPattern(pattern)) {
    t = Checker_getTypeOfDestructuredProperty(receiver, parentType, getBindingElementPropertyName(node));
  } else if (!hasDotDotDotToken(node)) {
    t = Checker_getTypeOfDestructuredArrayElement(receiver, parentType, Node_Elements(pattern!)!.indexOf(node));
  } else {
    t = Checker_getTypeOfDestructuredSpreadExpression(receiver, parentType);
  }
  return Checker_getTypeWithDefault(receiver, t, Node_Initializer(node));
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/flow.go::method::Checker.getAssignedType","kind":"method","status":"implemented","sigHash":"6b5c4c672db1e5da27c6cf34f7a909efafd11dcf4608ccbe825fa86c406db920","bodyHash":"a462e9d28e093c0023dbbb714f5610cbe279b2b52dfaa3eb27c58ce27d1b9010"}
 *
 * Go source:
 * func (c *Checker) getAssignedType(node *ast.Node) *Type {
 * 	parent := node.Parent
 * 	switch parent.Kind {
 * 	case ast.KindForInStatement:
 * 		return c.stringType
 * 	case ast.KindForOfStatement:
 * 		t := c.checkRightHandSideOfForOf(parent)
 * 		if t != nil {
 * 			return t
 * 		}
 * 	case ast.KindBinaryExpression:
 * 		return c.getAssignedTypeOfBinaryExpression(parent)
 * 	case ast.KindDeleteExpression:
 * 		return c.undefinedType
 * 	case ast.KindArrayLiteralExpression:
 * 		return c.getAssignedTypeOfArrayLiteralElement(parent, node)
 * 	case ast.KindSpreadElement:
 * 		return c.getAssignedTypeOfSpreadExpression(parent)
 * 	case ast.KindPropertyAssignment:
 * 		return c.getAssignedTypeOfPropertyAssignment(parent)
 * 	case ast.KindShorthandPropertyAssignment:
 * 		return c.getAssignedTypeOfShorthandPropertyAssignment(parent)
 * 	}
 * 	return c.errorType
 * }
 */
export function Checker_getAssignedType(receiver: GoPtr<Checker>, node: GoPtr<Node>): GoPtr<Type> {
  const parent = node!.Parent;
  switch (parent!.Kind) {
    case KindForInStatement:
      return receiver!.stringType;
    case KindForOfStatement: {
      const t = Checker_checkRightHandSideOfForOf(receiver, parent);
      if (t !== undefined) { return t; }
      break;
    }
    case KindBinaryExpression:
      return Checker_getAssignedTypeOfBinaryExpression(receiver, parent);
    case KindDeleteExpression:
      return receiver!.undefinedType;
    case KindArrayLiteralExpression:
      return Checker_getAssignedTypeOfArrayLiteralElement(receiver, parent, node);
    case KindSpreadElement:
      return Checker_getAssignedTypeOfSpreadExpression(receiver, parent);
    case KindPropertyAssignment:
      return Checker_getAssignedTypeOfPropertyAssignment(receiver, parent);
    case KindShorthandPropertyAssignment:
      return Checker_getAssignedTypeOfShorthandPropertyAssignment(receiver, parent);
  }
  return receiver!.errorType;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/flow.go::method::Checker.getAssignedTypeOfBinaryExpression","kind":"method","status":"implemented","sigHash":"0a81c4fd79b6ebf80a91e72500d71219127b23ef1203399151790d1cadfb2eb3","bodyHash":"cc039e3a1bf953e89e440935ba0e94bae27aba2c3c89d0466f89b204e312bcb1"}
 *
 * Go source:
 * func (c *Checker) getAssignedTypeOfBinaryExpression(node *ast.Node) *Type {
 * 	isDestructuringDefaultAssignment := ast.IsArrayLiteralExpression(node.Parent) && c.isDestructuringAssignmentTarget(node.Parent) ||
 * 		ast.IsPropertyAssignment(node.Parent) && c.isDestructuringAssignmentTarget(node.Parent.Parent)
 * 	if isDestructuringDefaultAssignment {
 * 		return c.getTypeWithDefault(c.getAssignedType(node), node.AsBinaryExpression().Right)
 * 	}
 * 	return c.getTypeOfExpression(node.AsBinaryExpression().Right)
 * }
 */
export function Checker_getAssignedTypeOfBinaryExpression(receiver: GoPtr<Checker>, node: GoPtr<Node>): GoPtr<Type> {
  const isDestructuringDefaultAssignment = IsArrayLiteralExpression(node!.Parent) && Checker_isDestructuringAssignmentTarget(receiver, node!.Parent) ||
    IsPropertyAssignment(node!.Parent) && Checker_isDestructuringAssignmentTarget(receiver, node!.Parent!.Parent);
  if (isDestructuringDefaultAssignment) {
    return Checker_getTypeWithDefault(receiver, Checker_getAssignedType(receiver, node), AsBinaryExpression(node)!.Right);
  }
  return Checker_getTypeOfExpression(receiver, AsBinaryExpression(node)!.Right);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/flow.go::method::Checker.getAssignedTypeOfArrayLiteralElement","kind":"method","status":"implemented","sigHash":"6a140530ad3dc217bdf7dc386682565de9c69a2724ea8570189dfdc5b9560d7a","bodyHash":"1f7215cca64e0333d9a6c5a3e2041240c0b57f24a2fcf398a119aea0f56da40c"}
 *
 * Go source:
 * func (c *Checker) getAssignedTypeOfArrayLiteralElement(node *ast.Node, element *ast.Node) *Type {
 * 	return c.getTypeOfDestructuredArrayElement(c.getAssignedType(node), slices.Index(node.Elements(), element))
 * }
 */
export function Checker_getAssignedTypeOfArrayLiteralElement(receiver: GoPtr<Checker>, node: GoPtr<Node>, element: GoPtr<Node>): GoPtr<Type> {
  return Checker_getTypeOfDestructuredArrayElement(receiver, Checker_getAssignedType(receiver, node), Node_Elements(node!)!.indexOf(element));
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/flow.go::method::Checker.getTypeOfDestructuredArrayElement","kind":"method","status":"implemented","sigHash":"e7b20127630a50fce4a9167d00bf2347a5a58bd0afab74f194fe9443cd36e6f5","bodyHash":"fbc82a53d126b8df14ce5197d6ec85c088f3ea5ca3742e7890035ef1945626b7"}
 *
 * Go source:
 * func (c *Checker) getTypeOfDestructuredArrayElement(t *Type, index int) *Type {
 * 	if everyType(t, c.isTupleLikeType) {
 * 		if elementType := c.getTupleElementType(t, index); elementType != nil {
 * 			return elementType
 * 		}
 * 	}
 * 	if elementType := c.checkIteratedTypeOrElementType(IterationUseDestructuring, t, c.undefinedType, nil /*errorNode* /); elementType != nil {
 * 		return c.includeUndefinedInIndexSignature(elementType)
 * 	}
 * 	return c.errorType
 * }
 */
export function Checker_getTypeOfDestructuredArrayElement(receiver: GoPtr<Checker>, t: GoPtr<Type>, index: int): GoPtr<Type> {
  if (everyType(t, (x) => Checker_isTupleLikeType(receiver, x))) {
    const elementType = Checker_getTupleElementType(receiver, t, index);
    if (elementType !== undefined) { return elementType; }
  }
  const elementType = Checker_checkIteratedTypeOrElementType(receiver, IterationUseDestructuring, t, receiver!.undefinedType, undefined);
  if (elementType !== undefined) {
    return Checker_includeUndefinedInIndexSignature(receiver, elementType);
  }
  return receiver!.errorType;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/flow.go::method::Checker.includeUndefinedInIndexSignature","kind":"method","status":"implemented","sigHash":"433ef66bddd072c7aae1e627c3435d172e56e359140ee8629e21b3e4a855a139","bodyHash":"f0245095b7e0223ac723ba8bc096cf9dec94e5bb171cfd5f3a419ef8ad55c361"}
 *
 * Go source:
 * func (c *Checker) includeUndefinedInIndexSignature(t *Type) *Type {
 * 	if t == nil {
 * 		return nil
 * 	}
 * 	if c.compilerOptions.NoUncheckedIndexedAccess == core.TSTrue {
 * 		return c.getUnionType([]*Type{t, c.missingType})
 * 	}
 * 	return t
 * }
 */
export function Checker_includeUndefinedInIndexSignature(receiver: GoPtr<Checker>, t: GoPtr<Type>): GoPtr<Type> {
  if (t === undefined) {
    return undefined;
  }
  if (receiver!.compilerOptions!.NoUncheckedIndexedAccess === TSTrue) {
    return Checker_getUnionType(receiver, [t, receiver!.missingType]);
  }
  return t;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/flow.go::method::Checker.getAssignedTypeOfSpreadExpression","kind":"method","status":"implemented","sigHash":"3ae6af3eb0c0f932e0db34d301667880c5313584ff7e36414cfe52a4e824340f","bodyHash":"5e159f26ef992ac9ede777dfae54ab356734038197dccb471da3e9f78c3b466e"}
 *
 * Go source:
 * func (c *Checker) getAssignedTypeOfSpreadExpression(node *ast.Node) *Type {
 * 	return c.getTypeOfDestructuredSpreadExpression(c.getAssignedType(node.Parent))
 * }
 */
export function Checker_getAssignedTypeOfSpreadExpression(receiver: GoPtr<Checker>, node: GoPtr<Node>): GoPtr<Type> {
  return Checker_getTypeOfDestructuredSpreadExpression(receiver, Checker_getAssignedType(receiver, node!.Parent));
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/flow.go::method::Checker.getTypeOfDestructuredSpreadExpression","kind":"method","status":"implemented","sigHash":"f825a094cb9e24e5a9596d9da505642fc0ae4f0914665d8fc85b232140074a5d","bodyHash":"aa8d53465ac1875a0bba52ff5abc2e854fd2731fe6471e4943b6e172bd811a7e"}
 *
 * Go source:
 * func (c *Checker) getTypeOfDestructuredSpreadExpression(t *Type) *Type {
 * 	elementType := c.checkIteratedTypeOrElementType(IterationUseDestructuring, t, c.undefinedType, nil /*errorNode* /)
 * 	if elementType == nil {
 * 		elementType = c.errorType
 * 	}
 * 	return c.createArrayType(elementType)
 * }
 */
export function Checker_getTypeOfDestructuredSpreadExpression(receiver: GoPtr<Checker>, t: GoPtr<Type>): GoPtr<Type> {
  let elementType = Checker_checkIteratedTypeOrElementType(receiver, IterationUseDestructuring, t, receiver!.undefinedType, undefined);
  if (elementType === undefined) { elementType = receiver!.errorType; }
  return Checker_createArrayType(receiver, elementType);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/flow.go::method::Checker.getAssignedTypeOfPropertyAssignment","kind":"method","status":"implemented","sigHash":"e5e341efcf550bea8dff09d4cd3a9b54c71c56c27bc0ca2f75aa493b9cae5c7c","bodyHash":"b3ae9bdaa0d4405c2a9cf351ee10ea4461165344fe9e95cac4595c60c6288a9f"}
 *
 * Go source:
 * func (c *Checker) getAssignedTypeOfPropertyAssignment(node *ast.Node) *Type {
 * 	return c.getTypeOfDestructuredProperty(c.getAssignedType(node.Parent), node.Name())
 * }
 */
export function Checker_getAssignedTypeOfPropertyAssignment(receiver: GoPtr<Checker>, node: GoPtr<Node>): GoPtr<Type> {
  return Checker_getTypeOfDestructuredProperty(receiver, Checker_getAssignedType(receiver, node!.Parent), Node_Name(node));
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/flow.go::method::Checker.getTypeOfDestructuredProperty","kind":"method","status":"implemented","sigHash":"da56f7686ecfb98f5c32e90546d6a0439f70e5c13cf61febcc152a33649c495c","bodyHash":"cb9abd55b5b6136a0cf05f2b90c2632e8166e816b89213c8420b5bccf4228ad8"}
 *
 * Go source:
 * func (c *Checker) getTypeOfDestructuredProperty(t *Type, name *ast.Node) *Type {
 * 	nameType := c.getLiteralTypeFromPropertyName(name)
 * 	if !isTypeUsableAsPropertyName(nameType) {
 * 		return c.errorType
 * 	}
 * 	text := getPropertyNameFromType(nameType)
 * 	if propType := c.getTypeOfPropertyOfType(t, text); propType != nil {
 * 		return propType
 * 	}
 * 	if indexInfo := c.getApplicableIndexInfoForName(t, text); indexInfo != nil {
 * 		return c.includeUndefinedInIndexSignature(indexInfo.valueType)
 * 	}
 * 	return c.errorType
 * }
 */
export function Checker_getTypeOfDestructuredProperty(receiver: GoPtr<Checker>, t: GoPtr<Type>, name: GoPtr<Node>): GoPtr<Type> {
  const nameType = Checker_getLiteralTypeFromPropertyName(receiver, name);
  if (!isTypeUsableAsPropertyName(nameType)) { return receiver!.errorType; }
  const text = getPropertyNameFromType(nameType);
  const propType = Checker_getTypeOfPropertyOfType(receiver, t, text);
  if (propType !== undefined) { return propType; }
  const indexInfo = Checker_getApplicableIndexInfoForName(receiver, t, text);
  if (indexInfo !== undefined) { return Checker_includeUndefinedInIndexSignature(receiver, indexInfo!.valueType); }
  return receiver!.errorType;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/flow.go::method::Checker.getAssignedTypeOfShorthandPropertyAssignment","kind":"method","status":"implemented","sigHash":"ee9e509dce20d41ad3f76a8aed3024b2dbfe339873e74e46d2365e05e176f5e3","bodyHash":"2dd6d6a25ddc2827120f37df31a5fb92c29d0464d093dd523169aaa8bb4d4278"}
 *
 * Go source:
 * func (c *Checker) getAssignedTypeOfShorthandPropertyAssignment(node *ast.Node) *Type {
 * 	return c.getTypeWithDefault(c.getAssignedTypeOfPropertyAssignment(node), node.AsShorthandPropertyAssignment().ObjectAssignmentInitializer)
 * }
 */
export function Checker_getAssignedTypeOfShorthandPropertyAssignment(receiver: GoPtr<Checker>, node: GoPtr<Node>): GoPtr<Type> {
  return Checker_getTypeWithDefault(receiver, Checker_getAssignedTypeOfPropertyAssignment(receiver, node), AsShorthandPropertyAssignment(node)!.ObjectAssignmentInitializer as unknown as GoPtr<Node>);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/flow.go::method::Checker.isDestructuringAssignmentTarget","kind":"method","status":"implemented","sigHash":"7815607d91092a69986a2e56732f206eb9bea881736b59acac6dbb77a527f0d9","bodyHash":"d8b4ab10ce91b7cf8a04b37f51ff21ad549b0dfa964bd1dcfc118aa66b4448aa"}
 *
 * Go source:
 * func (c *Checker) isDestructuringAssignmentTarget(parent *ast.Node) bool {
 * 	return ast.IsBinaryExpression(parent.Parent) && parent.Parent.AsBinaryExpression().Left == parent ||
 * 		ast.IsForOfStatement(parent.Parent) && parent.Parent.Initializer() == parent
 * }
 */
export function Checker_isDestructuringAssignmentTarget(receiver: GoPtr<Checker>, parent: GoPtr<Node>): bool {
  return IsBinaryExpression(parent!.Parent) && AsBinaryExpression(parent!.Parent)!.Left === parent ||
    IsForOfStatement(parent!.Parent) && Node_Initializer(parent!.Parent) === parent;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/flow.go::method::Checker.getTypeWithDefault","kind":"method","status":"implemented","sigHash":"ecdf5c7d3626f658edea449a1c2c92d9564777dd417552caa75229b6456a5528","bodyHash":"4c00ad0240ba16c1f96c3ad4ccc704d6ca47e420fb9032dc6a4b49a06a1dbc63"}
 *
 * Go source:
 * func (c *Checker) getTypeWithDefault(t *Type, defaultExpression *ast.Node) *Type {
 * 	if defaultExpression != nil {
 * 		return c.getUnionType([]*Type{c.getNonUndefinedType(t), c.getTypeOfExpression(defaultExpression)})
 * 	}
 * 	return t
 * }
 */
export function Checker_getTypeWithDefault(receiver: GoPtr<Checker>, t: GoPtr<Type>, defaultExpression: GoPtr<Node>): GoPtr<Type> {
  if (defaultExpression !== undefined) {
    return Checker_getUnionType(receiver, [Checker_getNonUndefinedType(receiver, t), Checker_getTypeOfExpression(receiver, defaultExpression)]);
  }
  return t;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/flow.go::method::Checker.getAssignmentReducedType","kind":"method","status":"implemented","sigHash":"2b8b401b3606bfe8cdc57179da10359b0354ec0335dbb8d66ad7a641dc721381","bodyHash":"eb5904fcc457a213649515ed234b52aafc0018b6a33196d255fe979f0d4130ad"}
 *
 * Go source:
 * func (c *Checker) getAssignmentReducedType(declaredType *Type, assignedType *Type) *Type {
 * 	if declaredType == assignedType {
 * 		return declaredType
 * 	}
 * 	if assignedType.flags&TypeFlagsNever != 0 {
 * 		return assignedType
 * 	}
 * 	key := AssignmentReducedKey{id1: declaredType.id, id2: assignedType.id}
 * 	result := c.assignmentReducedTypes[key]
 * 	if result == nil {
 * 		result = c.getAssignmentReducedTypeWorker(declaredType, assignedType)
 * 		c.assignmentReducedTypes[key] = result
 * 	}
 * 	return result
 * }
 */
export function Checker_getAssignmentReducedType(receiver: GoPtr<Checker>, declaredType: GoPtr<Type>, assignedType: GoPtr<Type>): GoPtr<Type> {
  if (declaredType === assignedType) { return declaredType; }
  if (assignedType!.flags & TypeFlagsNever) { return assignedType; }
  const key: AssignmentReducedKey = { id1: declaredType!.id, id2: assignedType!.id };
  let result = receiver!.assignmentReducedTypes.get(key);
  if (result === undefined) {
    result = Checker_getAssignmentReducedTypeWorker(receiver, declaredType, assignedType);
    receiver!.assignmentReducedTypes.set(key, result);
  }
  return result;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/flow.go::method::Checker.getAssignmentReducedTypeWorker","kind":"method","status":"implemented","sigHash":"4a27bc35d2c19cbb6d0a8ef34b9754d28288e34917954a8b751e6ecb9060765c","bodyHash":"67f8532b6a9240a9105b0c13768885ef034cc2b9700c394d3c577323d3295711"}
 *
 * Go source:
 * func (c *Checker) getAssignmentReducedTypeWorker(declaredType *Type, assignedType *Type) *Type {
 * 	filteredType := c.filterType(declaredType, func(t *Type) bool {
 * 		return c.typeMaybeAssignableTo(assignedType, t)
 * 	})
 * 	// Ensure that we narrow to fresh types if the assignment is a fresh boolean literal type.
 * 	reducedType := filteredType
 * 	if assignedType.flags&TypeFlagsBooleanLiteral != 0 && isFreshLiteralType(assignedType) {
 * 		reducedType = c.mapType(filteredType, c.getFreshTypeOfLiteralType)
 * 	}
 * 	// Our crude heuristic produces an invalid result in some cases: see GH#26130.
 * 	// For now, when that happens, we give up and don't narrow at all.  (This also
 * 	// means we'll never narrow for erroneous assignments where the assigned type
 * 	// is not assignable to the declared type.)
 * 	if c.isTypeAssignableTo(assignedType, reducedType) {
 * 		return reducedType
 * 	}
 * 	return declaredType
 * }
 */
export function Checker_getAssignmentReducedTypeWorker(receiver: GoPtr<Checker>, declaredType: GoPtr<Type>, assignedType: GoPtr<Type>): GoPtr<Type> {
  const filteredType = Checker_filterType(receiver, declaredType, (t) => Checker_typeMaybeAssignableTo(receiver, assignedType, t));
  let reducedType = filteredType;
  if ((assignedType!.flags & TypeFlagsBooleanLiteral) !== 0 && isFreshLiteralType(assignedType)) {
    reducedType = Checker_mapType(receiver, filteredType, (t) => Checker_getFreshTypeOfLiteralType(receiver, t));
  }
  if (Checker_isTypeAssignableTo(receiver, assignedType, reducedType)) { return reducedType; }
  return declaredType;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/flow.go::method::Checker.typeMaybeAssignableTo","kind":"method","status":"implemented","sigHash":"aba7fbd9e6abbe7120d2029ebf4cf205f73a4e6fbde189f32e4d87e00e386a2b","bodyHash":"7702bdf215641c69525da6977710cdb2ec37adef9571480c8edfe967ffc94e17"}
 *
 * Go source:
 * func (c *Checker) typeMaybeAssignableTo(source *Type, target *Type) bool {
 * 	if source.flags&TypeFlagsUnion == 0 {
 * 		return c.isTypeAssignableTo(source, target)
 * 	}
 * 	for _, t := range source.AsUnionType().types {
 * 		if c.isTypeAssignableTo(t, target) {
 * 			return true
 * 		}
 * 	}
 * 	return false
 * }
 */
export function Checker_typeMaybeAssignableTo(receiver: GoPtr<Checker>, source: GoPtr<Type>, target: GoPtr<Type>): bool {
  if (!(source!.flags & TypeFlagsUnion)) {
    return Checker_isTypeAssignableTo(receiver, source, target);
  }
  for (const t of Type_AsUnionOrIntersectionType(source)!.types) {
    if (Checker_isTypeAssignableTo(receiver, t, target)) { return true; }
  }
  return false;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/flow.go::method::Checker.getTypePredicateArgument","kind":"method","status":"implemented","sigHash":"0838c9cad802b4134c05a34cc99ef3211b5f983d157de2539fc54c07ebb63985","bodyHash":"a7241c2217ef6f35047eee8f61e77c2ec0b36953aa6335ce5a276a659fef4297"}
 *
 * Go source:
 * func (c *Checker) getTypePredicateArgument(predicate *TypePredicate, callExpression *ast.Node) *ast.Node {
 * 	if predicate.kind == TypePredicateKindIdentifier || predicate.kind == TypePredicateKindAssertsIdentifier {
 * 		arguments := callExpression.Arguments()
 * 		if predicate.parameterIndex >= 0 && int(predicate.parameterIndex) < len(arguments) {
 * 			return arguments[predicate.parameterIndex]
 * 		}
 * 	} else {
 * 		invokedExpression := ast.SkipParentheses(callExpression.Expression())
 * 		if ast.IsAccessExpression(invokedExpression) {
 * 			return ast.SkipParentheses(invokedExpression.Expression())
 * 		}
 * 	}
 * 	return nil
 * }
 */
export function Checker_getTypePredicateArgument(receiver: GoPtr<Checker>, predicate: GoPtr<TypePredicate>, callExpression: GoPtr<Node>): GoPtr<Node> {
  if (predicate!.kind === TypePredicateKindIdentifier || predicate!.kind === TypePredicateKindAssertsIdentifier) {
    const arguments_ = Node_Arguments(callExpression)!;
    if (predicate!.parameterIndex >= 0 && predicate!.parameterIndex < arguments_.length) {
      return arguments_[predicate!.parameterIndex];
    }
  } else {
    const invokedExpression = SkipParentheses(Node_Expression(callExpression));
    if (IsAccessExpression(invokedExpression)) {
      return SkipParentheses(Node_Expression(invokedExpression));
    }
  }
  return undefined;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/flow.go::method::Checker.getFlowTypeInConstructor","kind":"method","status":"implemented","sigHash":"43a96ae6dbde2e4c8eec4890863729215b9ec764af3460bc7519b1a3e11a75b3","bodyHash":"15abf2d054a405d564882d8018b2312d82a8387fedf086afb89d2d8356446e53"}
 *
 * Go source:
 * func (c *Checker) getFlowTypeInConstructor(symbol *ast.Symbol, constructor *ast.Node) *Type {
 * 	var accessName *ast.Node
 * 	if strings.HasPrefix(symbol.Name, ast.InternalSymbolNamePrefix+"#") {
 * 		accessName = c.factory.NewPrivateIdentifier(symbol.Name[strings.Index(symbol.Name, "@")+1:])
 * 	} else {
 * 		accessName = c.factory.NewIdentifier(symbol.Name)
 * 	}
 * 	reference := c.factory.NewPropertyAccessExpression(c.factory.NewKeywordExpression(ast.KindThisKeyword), nil, accessName, ast.NodeFlagsNone)
 * 	reference.Expression().Parent = reference
 * 	reference.Parent = constructor
 * 	reference.FlowNodeData().FlowNode = constructor.AsConstructorDeclaration().ReturnFlowNode
 * 	flowType := c.getFlowTypeOfProperty(reference, symbol)
 * 	if c.noImplicitAny && (flowType == c.autoType || flowType == c.autoArrayType) {
 * 		c.error(symbol.ValueDeclaration, diagnostics.Member_0_implicitly_has_an_1_type, c.symbolToString(symbol), c.TypeToString(flowType))
 * 	}
 * 	// We don't infer a type if assignments are only null or undefined.
 * 	if everyType(flowType, c.IsNullableType) {
 * 		return nil
 * 	}
 * 	return c.convertAutoToAny(flowType)
 * }
 */
export function Checker_getFlowTypeInConstructor(receiver: GoPtr<Checker>, symbol_: GoPtr<Symbol>, constructor_: GoPtr<Node>): GoPtr<Type> {
  let accessName: GoPtr<Node>;
  if (symbol_!.Name.startsWith(InternalSymbolNamePrefix + "#")) {
    accessName = NewPrivateIdentifier(receiver!.factory, symbol_!.Name.slice(symbol_!.Name.indexOf("@") + 1));
  } else {
    accessName = NewIdentifier(receiver!.factory, symbol_!.Name);
  }
  const reference = NewPropertyAccessExpression(receiver!.factory, NewKeywordExpression(receiver!.factory, KindThisKeyword), undefined, accessName as unknown as GoPtr<Node>, NodeFlagsNone);
  Node_Expression(reference)!.Parent = reference;
  reference!.Parent = constructor_;
  (Node_FlowNodeData(reference) as unknown as { FlowNode: GoPtr<FlowNode> }).FlowNode = (AsConstructorDeclaration(constructor_) as unknown as Record<string, GoPtr<FlowNode>>)["ReturnFlowNode"];
  const flowType = Checker_getFlowTypeOfProperty(receiver, reference, symbol_);
  if (receiver!.noImplicitAny && (flowType === receiver!.autoType || flowType === receiver!.autoArrayType)) {
    Checker_error(receiver, symbol_!.ValueDeclaration, Member_0_implicitly_has_an_1_type, Checker_symbolToString(receiver, symbol_), Checker_TypeToString(receiver, flowType));
  }
  if (everyType(flowType, (t) => Checker_IsNullableType(receiver, t))) { return undefined; }
  return Checker_convertAutoToAny(receiver, flowType);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/flow.go::method::Checker.getFlowTypeInStaticBlocks","kind":"method","status":"implemented","sigHash":"f683c7ef9344e3ef71ec66887453f9aec636833528ac4bb10b4d7a3f0f931952","bodyHash":"7abb66beb1260ea3e55d4976c63b02806d8045305111ffb017d73cf32ab0046d"}
 *
 * Go source:
 * func (c *Checker) getFlowTypeInStaticBlocks(symbol *ast.Symbol, staticBlocks []*ast.Node) *Type {
 * 	var accessName *ast.Node
 * 	if strings.HasPrefix(symbol.Name, ast.InternalSymbolNamePrefix+"#") {
 * 		accessName = c.factory.NewPrivateIdentifier(symbol.Name[strings.Index(symbol.Name, "@")+1:])
 * 	} else {
 * 		accessName = c.factory.NewIdentifier(symbol.Name)
 * 	}
 * 	for _, staticBlock := range staticBlocks {
 * 		reference := c.factory.NewPropertyAccessExpression(c.factory.NewKeywordExpression(ast.KindThisKeyword), nil, accessName, ast.NodeFlagsNone)
 * 		reference.Expression().Parent = reference
 * 		reference.Parent = staticBlock
 * 		reference.FlowNodeData().FlowNode = staticBlock.AsClassStaticBlockDeclaration().ReturnFlowNode
 * 		flowType := c.getFlowTypeOfProperty(reference, symbol)
 * 		if c.noImplicitAny && (flowType == c.autoType || flowType == c.autoArrayType) {
 * 			c.error(symbol.ValueDeclaration, diagnostics.Member_0_implicitly_has_an_1_type, c.symbolToString(symbol), c.TypeToString(flowType))
 * 		}
 * 		// We don't infer a type if assignments are only null or undefined.
 * 		if everyType(flowType, c.IsNullableType) {
 * 			continue
 * 		}
 * 		return c.convertAutoToAny(flowType)
 * 	}
 * 	return nil
 * }
 */
export function Checker_getFlowTypeInStaticBlocks(receiver: GoPtr<Checker>, symbol_: GoPtr<Symbol>, staticBlocks: GoSlice<GoPtr<Node>>): GoPtr<Type> {
  let accessName: GoPtr<Node>;
  if (symbol_!.Name.startsWith(InternalSymbolNamePrefix + "#")) {
    accessName = NewPrivateIdentifier(receiver!.factory, symbol_!.Name.slice(symbol_!.Name.indexOf("@") + 1));
  } else {
    accessName = NewIdentifier(receiver!.factory, symbol_!.Name);
  }
  for (const staticBlock of staticBlocks) {
    const reference = NewPropertyAccessExpression(receiver!.factory, NewKeywordExpression(receiver!.factory, KindThisKeyword), undefined, accessName as unknown as GoPtr<Node>, NodeFlagsNone);
    Node_Expression(reference)!.Parent = reference;
    reference!.Parent = staticBlock;
    (Node_FlowNodeData(reference) as unknown as { FlowNode: GoPtr<FlowNode> }).FlowNode = (AsClassStaticBlockDeclaration(staticBlock) as unknown as Record<string, GoPtr<FlowNode>>)["ReturnFlowNode"];
    const flowType = Checker_getFlowTypeOfProperty(receiver, reference, symbol_);
    if (receiver!.noImplicitAny && (flowType === receiver!.autoType || flowType === receiver!.autoArrayType)) {
      Checker_error(receiver, symbol_!.ValueDeclaration, Member_0_implicitly_has_an_1_type, Checker_symbolToString(receiver, symbol_), Checker_TypeToString(receiver, flowType));
    }
    if (everyType(flowType, (t) => Checker_IsNullableType(receiver, t))) { continue; }
    return Checker_convertAutoToAny(receiver, flowType);
  }
  return undefined;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/flow.go::method::Checker.isReachableFlowNode","kind":"method","status":"implemented","sigHash":"76e25a771ccffd80b1828353cc66207b80824a0711f4ab8f28afb70ac9d031f6","bodyHash":"42236073bc3ab9e13c4bf4548dbcf01059c59611b2891aa7160e9a0af6a718e4"}
 *
 * Go source:
 * func (c *Checker) isReachableFlowNode(flow *ast.FlowNode) bool {
 * 	f := c.getFlowState()
 * 	result := c.isReachableFlowNodeWorker(f, flow, false /*noCacheCheck* /)
 * 	c.putFlowState(f)
 * 	c.lastFlowNode = flow
 * 	c.lastFlowNodeReachable = result
 * 	return result
 * }
 */
export function Checker_isReachableFlowNode(receiver: GoPtr<Checker>, flow: GoPtr<FlowNode>): bool {
  const f = Checker_getFlowState(receiver);
  const result = Checker_isReachableFlowNodeWorker(receiver, f, flow, false);
  Checker_putFlowState(receiver, f);
  receiver!.lastFlowNode = flow;
  receiver!.lastFlowNodeReachable = result;
  return result;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/flow.go::method::Checker.isReachableFlowNodeWorker","kind":"method","status":"implemented","sigHash":"7a18799c97405bdc7d8be7cb6617743271572ab7d05e87e980067e4820cf3f60","bodyHash":"becf5e17c616fa301cce778e07b835aac4562d18ad60ad41e18077dbdb5a8cf9"}
 *
 * Go source:
 * func (c *Checker) isReachableFlowNodeWorker(f *FlowState, flow *ast.FlowNode, noCacheCheck bool) bool {
 * 	for {
 * 		if flow == c.lastFlowNode {
 * 			return c.lastFlowNodeReachable
 * 		}
 * 		flags := flow.Flags
 * 		if flags&ast.FlowFlagsShared != 0 {
 * 			if !noCacheCheck {
 * 				if reachable, ok := c.flowNodeReachable[flow]; ok {
 * 					return reachable
 * 				}
 * 				reachable := c.isReachableFlowNodeWorker(f, flow, true /*noCacheCheck* /)
 * 				c.flowNodeReachable[flow] = reachable
 * 				return reachable
 * 			}
 * 			noCacheCheck = false
 * 		}
 * 		switch {
 * 		case flags&(ast.FlowFlagsAssignment|ast.FlowFlagsCondition|ast.FlowFlagsArrayMutation) != 0:
 * 			flow = flow.Antecedent
 * 		case flags&ast.FlowFlagsCall != 0:
 * 			if signature := c.getEffectsSignature(flow.Node); signature != nil {
 * 				if predicate := c.getTypePredicateOfSignature(signature); predicate != nil && predicate.kind == TypePredicateKindAssertsIdentifier && predicate.t == nil {
 * 					if arguments := flow.Node.Arguments(); predicate.parameterIndex >= 0 && int(predicate.parameterIndex) < len(arguments) && c.isFalseExpression(arguments[predicate.parameterIndex]) {
 * 						return false
 * 					}
 * 				}
 * 				if c.getReturnTypeOfSignature(signature).flags&TypeFlagsNever != 0 {
 * 					return false
 * 				}
 * 			}
 * 			flow = flow.Antecedent
 * 		case flags&ast.FlowFlagsBranchLabel != 0:
 * 			// A branching point is reachable if any branch is reachable.
 * 			for list := getBranchLabelAntecedents(flow, f.reduceLabels); list != nil; list = list.Next {
 * 				if c.isReachableFlowNodeWorker(f, list.Flow, false /*noCacheCheck* /) {
 * 					return true
 * 				}
 * 			}
 * 			return false
 * 		case flags&ast.FlowFlagsLoopLabel != 0:
 * 			if flow.Antecedents == nil {
 * 				return false
 * 			}
 * 			// A loop is reachable if the control flow path that leads to the top is reachable.
 * 			flow = flow.Antecedents.Flow
 * 		case flags&ast.FlowFlagsSwitchClause != 0:
 * 			// The control flow path representing an unmatched value in a switch statement with
 * 			// no default clause is unreachable if the switch statement is exhaustive.
 * 			data := flow.Node.AsFlowSwitchClauseData()
 * 			if data.ClauseStart == data.ClauseEnd && c.isExhaustiveSwitchStatement(data.SwitchStatement) {
 * 				return false
 * 			}
 * 			flow = flow.Antecedent
 * 		case flags&ast.FlowFlagsReduceLabel != 0:
 * 			// Cache is unreliable once we start adjusting labels
 * 			c.lastFlowNode = nil
 * 			f.reduceLabels = append(f.reduceLabels, flow.Node.AsFlowReduceLabelData())
 * 			result := c.isReachableFlowNodeWorker(f, flow.Antecedent, false /*noCacheCheck* /)
 * 			f.reduceLabels = f.reduceLabels[:len(f.reduceLabels)-1]
 * 			return result
 * 		default:
 * 			return flags&ast.FlowFlagsUnreachable == 0
 * 		}
 * 	}
 * }
 */
export function Checker_isReachableFlowNodeWorker(receiver: GoPtr<Checker>, f: GoPtr<FlowState>, flow: GoPtr<FlowNode>, noCacheCheck: bool): bool {
  for (;;) {
    if (flow === receiver!.lastFlowNode) { return receiver!.lastFlowNodeReachable; }
    const flags = flow!.Flags;
    if (flags & FlowFlagsShared) {
      if (!noCacheCheck) {
        const cached = receiver!.flowNodeReachable.get(flow);
        if (cached !== undefined) { return cached; }
        const reachable = Checker_isReachableFlowNodeWorker(receiver, f, flow, true);
        receiver!.flowNodeReachable.set(flow, reachable);
        return reachable;
      }
      noCacheCheck = false;
    }
    if (flags & (FlowFlagsAssignment | FlowFlagsCondition | FlowFlagsArrayMutation)) {
      flow = flow!.Antecedent!;
    } else if (flags & FlowFlagsCall) {
      const signature = Checker_getEffectsSignature(receiver, flow!.Node);
      if (signature !== undefined) {
        const predicate = Checker_getTypePredicateOfSignature(receiver, signature);
        if (predicate !== undefined && predicate!.kind === TypePredicateKindAssertsIdentifier && predicate!.t === undefined) {
          const arguments_ = Node_Arguments(flow!.Node)!;
          if (predicate!.parameterIndex >= 0 && predicate!.parameterIndex < arguments_.length && Checker_isFalseExpression(receiver, arguments_[predicate!.parameterIndex])) {
            return false;
          }
        }
        if (Checker_getReturnTypeOfSignature(receiver, signature)!.flags & TypeFlagsNever) { return false; }
      }
      flow = flow!.Antecedent!;
    } else if (flags & FlowFlagsBranchLabel) {
      for (let list = getBranchLabelAntecedents(flow, f!.reduceLabels); list !== undefined; list = list!.Next!) {
        if (Checker_isReachableFlowNodeWorker(receiver, f, list!.Flow!, false)) { return true; }
      }
      return false;
    } else if (flags & FlowFlagsLoopLabel) {
      if (flow!.Antecedents === undefined) { return false; }
      flow = flow!.Antecedents!.Flow!;
    } else if (flags & FlowFlagsSwitchClause) {
      const data = Node_AsFlowSwitchClauseData(flow!.Node);
      if (data!.ClauseStart === data!.ClauseEnd && Checker_isExhaustiveSwitchStatement(receiver, data!.SwitchStatement)) { return false; }
      flow = flow!.Antecedent!;
    } else if (flags & FlowFlagsReduceLabel) {
      receiver!.lastFlowNode = undefined;
      f!.reduceLabels ??= [];
      f!.reduceLabels.push(Node_AsFlowReduceLabelData(flow!.Node)!);
      const result = Checker_isReachableFlowNodeWorker(receiver, f, flow!.Antecedent!, false);
      f!.reduceLabels.pop();
      return result;
    } else {
      return !(flags & FlowFlagsUnreachable);
    }
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/flow.go::method::Checker.isFalseExpression","kind":"method","status":"implemented","sigHash":"ea8e6426ee53ff608ecb83b76de630fe95b81597e94b8a2f7b6c04b23e7a43c6","bodyHash":"c43cd1d8f3c2ebe01e8a41ea0c0765cfd6c39c46971d45e612f48315dfa34f7d"}
 *
 * Go source:
 * func (c *Checker) isFalseExpression(expr *ast.Node) bool {
 * 	node := ast.SkipParentheses(expr)
 * 	if node.Kind == ast.KindFalseKeyword {
 * 		return true
 * 	}
 * 	if ast.IsBinaryExpression(node) {
 * 		binary := node.AsBinaryExpression()
 * 		return binary.OperatorToken.Kind == ast.KindAmpersandAmpersandToken && (c.isFalseExpression(binary.Left) || c.isFalseExpression(binary.Right)) ||
 * 			binary.OperatorToken.Kind == ast.KindBarBarToken && c.isFalseExpression(binary.Left) && c.isFalseExpression(binary.Right)
 * 	}
 * 	return false
 * }
 */
export function Checker_isFalseExpression(receiver: GoPtr<Checker>, expr: GoPtr<Node>): bool {
  const node = SkipParentheses(expr);
  if (node!.Kind === KindFalseKeyword) { return true; }
  if (IsBinaryExpression(node)) {
    const binary = AsBinaryExpression(node);
    return binary!.OperatorToken!.Kind === KindAmpersandAmpersandToken && (Checker_isFalseExpression(receiver, binary!.Left as unknown as GoPtr<Node>) || Checker_isFalseExpression(receiver, binary!.Right as unknown as GoPtr<Node>)) ||
      binary!.OperatorToken!.Kind === KindBarBarToken && Checker_isFalseExpression(receiver, binary!.Left as unknown as GoPtr<Node>) && Checker_isFalseExpression(receiver, binary!.Right as unknown as GoPtr<Node>);
  }
  return false;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/flow.go::method::Checker.isPostSuperFlowNode","kind":"method","status":"implemented","sigHash":"a055ff4802402605906c1e42fa75598cafbffc73189f0b81f291bcd1e864fc4f","bodyHash":"ed81d0e5821756a47bf67fa6c88c2c66d36302ce57f66285c3f0a70a9fe855e6"}
 *
 * Go source:
 * func (c *Checker) isPostSuperFlowNode(flow *ast.FlowNode, noCacheCheck bool) bool {
 * 	f := c.getFlowState()
 * 	result := c.isPostSuperFlowNodeWorker(f, flow, noCacheCheck)
 * 	c.putFlowState(f)
 * 	return result
 * }
 */
export function Checker_isPostSuperFlowNode(receiver: GoPtr<Checker>, flow: GoPtr<FlowNode>, noCacheCheck: bool): bool {
  const f = Checker_getFlowState(receiver);
  const result = Checker_isPostSuperFlowNodeWorker(receiver, f, flow, noCacheCheck);
  Checker_putFlowState(receiver, f);
  return result;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/flow.go::method::Checker.isPostSuperFlowNodeWorker","kind":"method","status":"implemented","sigHash":"3a8d7f3b6cd8dcfc066ced64097626d2c3d5d5962a1e27b904ce23b5c72f98d5","bodyHash":"a3ba96f33532d30c01d86318b3d8aa94bd7400cf7c052b7291f666dcdd95244d"}
 *
 * Go source:
 * func (c *Checker) isPostSuperFlowNodeWorker(f *FlowState, flow *ast.FlowNode, noCacheCheck bool) bool {
 * 	for {
 * 		flags := flow.Flags
 * 		if flags&ast.FlowFlagsShared != 0 {
 * 			if !noCacheCheck {
 * 				if postSuper, ok := c.flowNodePostSuper[flow]; ok {
 * 					return postSuper
 * 				}
 * 				postSuper := c.isPostSuperFlowNodeWorker(f, flow, true /*noCacheCheck* /)
 * 				c.flowNodePostSuper[flow] = postSuper
 * 			}
 * 			noCacheCheck = false
 * 		}
 * 		switch {
 * 		case flags&(ast.FlowFlagsAssignment|ast.FlowFlagsCondition|ast.FlowFlagsArrayMutation|ast.FlowFlagsSwitchClause) != 0:
 * 			flow = flow.Antecedent
 * 		case flags&ast.FlowFlagsCall != 0:
 * 			if flow.Node.Expression().Kind == ast.KindSuperKeyword {
 * 				return true
 * 			}
 * 			flow = flow.Antecedent
 * 		case flags&ast.FlowFlagsBranchLabel != 0:
 * 			for list := getBranchLabelAntecedents(flow, f.reduceLabels); list != nil; list = list.Next {
 * 				if !c.isPostSuperFlowNodeWorker(f, list.Flow, false /*noCacheCheck* /) {
 * 					return false
 * 				}
 * 			}
 * 			return true
 * 		case flags&ast.FlowFlagsLoopLabel != 0:
 * 			// A loop is post-super if the control flow path that leads to the top is post-super.
 * 			flow = flow.Antecedents.Flow
 * 		case flags&ast.FlowFlagsReduceLabel != 0:
 * 			f.reduceLabels = append(f.reduceLabels, flow.Node.AsFlowReduceLabelData())
 * 			result := c.isPostSuperFlowNodeWorker(f, flow.Antecedent, false /*noCacheCheck* /)
 * 			f.reduceLabels = f.reduceLabels[:len(f.reduceLabels)-1]
 * 			return result
 * 		default:
 * 			// Unreachable nodes are considered post-super to silence errors
 * 			return flags&ast.FlowFlagsUnreachable != 0
 * 		}
 * 	}
 * }
 */
export function Checker_isPostSuperFlowNodeWorker(receiver: GoPtr<Checker>, f: GoPtr<FlowState>, flow: GoPtr<FlowNode>, noCacheCheck: bool): bool {
  for (;;) {
    const flags = flow!.Flags;
    if (flags & FlowFlagsShared) {
      if (!noCacheCheck) {
        const cached = receiver!.flowNodePostSuper.get(flow);
        if (cached !== undefined) { return cached; }
        const postSuper = Checker_isPostSuperFlowNodeWorker(receiver, f, flow, true);
        receiver!.flowNodePostSuper.set(flow, postSuper);
      }
      noCacheCheck = false;
    }
    if (flags & (FlowFlagsAssignment | FlowFlagsCondition | FlowFlagsArrayMutation | FlowFlagsSwitchClause)) {
      flow = flow!.Antecedent!;
    } else if (flags & FlowFlagsCall) {
      if (Node_Expression(flow!.Node)!.Kind === KindSuperKeyword) { return true; }
      flow = flow!.Antecedent!;
    } else if (flags & FlowFlagsBranchLabel) {
      for (let list = getBranchLabelAntecedents(flow, f!.reduceLabels); list !== undefined; list = list!.Next!) {
        if (!Checker_isPostSuperFlowNodeWorker(receiver, f, list!.Flow!, false)) { return false; }
      }
      return true;
    } else if (flags & FlowFlagsLoopLabel) {
      flow = flow!.Antecedents!.Flow!;
    } else if (flags & FlowFlagsReduceLabel) {
      f!.reduceLabels ??= [];
      f!.reduceLabels.push(Node_AsFlowReduceLabelData(flow!.Node)!);
      const result = Checker_isPostSuperFlowNodeWorker(receiver, f, flow!.Antecedent!, false);
      f!.reduceLabels.pop();
      return result;
    } else {
      return !!(flags & FlowFlagsUnreachable);
    }
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/flow.go::method::Checker.isSymbolAssignedDefinitely","kind":"method","status":"implemented","sigHash":"78a82847889560ec4d2e88e1b0f0788a79b4f180a68c3edbf2c0f8f18a71c973","bodyHash":"4b4ca0c33576e0d18bf7abac07c5175ae70650274c5a881472b1d9de1be520dc"}
 *
 * Go source:
 * func (c *Checker) isSymbolAssignedDefinitely(symbol *ast.Symbol) bool {
 * 	c.ensureAssignmentsMarked(symbol)
 * 	return c.markedAssignmentSymbolLinks.Get(symbol).hasDefiniteAssignment
 * }
 */
export function Checker_isSymbolAssignedDefinitely(receiver: GoPtr<Checker>, symbol_: GoPtr<Symbol>): bool {
  Checker_ensureAssignmentsMarked(receiver, symbol_);
  return getMarkedAssignmentSymbolLinks(receiver, symbol_).hasDefiniteAssignment;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/flow.go::method::Checker.isSymbolAssigned","kind":"method","status":"implemented","sigHash":"3753a162109a73e08e245c3f594164b1fab7b38a2798320195630803864762a6","bodyHash":"69d165afde1727dd5e2ac42127cee94e951768d6b7bfe6072a0e10b83eba6f25"}
 *
 * Go source:
 * func (c *Checker) isSymbolAssigned(symbol *ast.Symbol) bool {
 * 	c.ensureAssignmentsMarked(symbol)
 * 	return c.markedAssignmentSymbolLinks.Get(symbol).lastAssignmentPos != 0
 * }
 */
export function Checker_isSymbolAssigned(receiver: GoPtr<Checker>, symbol_: GoPtr<Symbol>): bool {
  Checker_ensureAssignmentsMarked(receiver, symbol_);
  return getMarkedAssignmentSymbolLinks(receiver, symbol_).lastAssignmentPos !== 0;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/flow.go::method::Checker.isPastLastAssignment","kind":"method","status":"implemented","sigHash":"9bbd9b743a29bd71471fe35565b2ffb4954f5e0db33f284f629ef8275ef691bb","bodyHash":"bb87ee5ae773f7b89985f9b1128281a5131f59a4a17cc92ea5d2ee634395d6c8"}
 *
 * Go source:
 * func (c *Checker) isPastLastAssignment(symbol *ast.Symbol, location *ast.Node) bool {
 * 	c.ensureAssignmentsMarked(symbol)
 * 	lastAssignmentPos := c.markedAssignmentSymbolLinks.Get(symbol).lastAssignmentPos
 * 	return lastAssignmentPos == 0 || location != nil && int(lastAssignmentPos) < location.Pos()
 * }
 */
export function Checker_isPastLastAssignment(receiver: GoPtr<Checker>, symbol_: GoPtr<Symbol>, location: GoPtr<Node>): bool {
  Checker_ensureAssignmentsMarked(receiver, symbol_);
  const lastAssignmentPos = getMarkedAssignmentSymbolLinks(receiver, symbol_).lastAssignmentPos;
  return lastAssignmentPos === 0 || (location !== undefined && lastAssignmentPos < Node_Pos(location));
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/flow.go::method::Checker.ensureAssignmentsMarked","kind":"method","status":"implemented","sigHash":"9619e437521ee129e7cf327a47a721fed18c24f3b9d741a0aa05f1b38db730af","bodyHash":"3d88adcf87da8b0359ea2c985f298f65966c172be6cbd1a8529b0828c3b8a97f"}
 *
 * Go source:
 * func (c *Checker) ensureAssignmentsMarked(symbol *ast.Symbol) {
 * 	if c.markedAssignmentSymbolLinks.Get(symbol).lastAssignmentPos != 0 {
 * 		return
 * 	}
 * 	parent := ast.FindAncestor(symbol.ValueDeclaration, ast.IsFunctionOrSourceFile)
 * 	if parent == nil {
 * 		return
 * 	}
 * 	links := c.nodeLinks.Get(parent)
 * 	if links.flags&NodeCheckFlagsAssignmentsMarked == 0 {
 * 		links.flags |= NodeCheckFlagsAssignmentsMarked
 * 		if !c.hasParentWithAssignmentsMarked(parent) {
 * 			c.markNodeAssignments(parent)
 * 		}
 * 	}
 * }
 */
export function Checker_ensureAssignmentsMarked(receiver: GoPtr<Checker>, symbol_: GoPtr<Symbol>): void {
  if (getMarkedAssignmentSymbolLinks(receiver, symbol_).lastAssignmentPos !== 0) { return; }
  const parent = FindAncestor(symbol_!.ValueDeclaration, IsFunctionOrSourceFile);
  if (parent === undefined) { return; }
  const links = LinkStore_Get<GoPtr<Node>, NodeLinks>(receiver!.nodeLinks as unknown as LinkStore<GoPtr<Node>, NodeLinks>, parent)!;
  if (!(links.flags & NodeCheckFlagsAssignmentsMarked)) {
    links.flags |= NodeCheckFlagsAssignmentsMarked;
    if (!Checker_hasParentWithAssignmentsMarked(receiver, parent)) {
      receiver!.markNodeAssignments(parent);
    }
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/flow.go::method::Checker.hasParentWithAssignmentsMarked","kind":"method","status":"implemented","sigHash":"2d68661bdd2642fddd2d04df0b5b87cd76c611cca8bb87f6a904f5447dec747e","bodyHash":"f9e6df021bf0f8366ceac8991dfd494e41f34ccb53a7bb225fbac57c3a24b8d4"}
 *
 * Go source:
 * func (c *Checker) hasParentWithAssignmentsMarked(node *ast.Node) bool {
 * 	return ast.FindAncestor(node.Parent, func(node *ast.Node) bool {
 * 		return ast.IsFunctionOrSourceFile(node) && c.nodeLinks.Get(node).flags&NodeCheckFlagsAssignmentsMarked != 0
 * 	}) != nil
 * }
 */
export function Checker_hasParentWithAssignmentsMarked(receiver: GoPtr<Checker>, node: GoPtr<Node>): bool {
  return FindAncestor(node!.Parent, (n) => IsFunctionOrSourceFile(n) && !!(LinkStore_Get<GoPtr<Node>, NodeLinks>(receiver!.nodeLinks as unknown as LinkStore<GoPtr<Node>, NodeLinks>, n)!.flags & NodeCheckFlagsAssignmentsMarked)) !== undefined;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/flow.go::method::Checker.markNodeAssignmentsWorker","kind":"method","status":"implemented","sigHash":"fe94d1085af3a2e6bcd7629e552475b70353a642ef97cd6efe6a2ec18531231b","bodyHash":"cbe6cb178f2d5298636716dbb8dd4ad7689716ac36c84b27a51aca4bc46ec68c"}
 *
 * Go source:
 * func (c *Checker) markNodeAssignmentsWorker(node *ast.Node) bool {
 * 	switch node.Kind {
 * 	case ast.KindIdentifier:
 * 		assignmentKind := getAssignmentTargetKind(node)
 * 		if assignmentKind != AssignmentKindNone {
 * 			symbol := c.getResolvedSymbol(node)
 * 			if c.isParameterOrMutableLocalVariable(symbol) {
 * 				links := c.markedAssignmentSymbolLinks.Get(symbol)
 * 				if pos := links.lastAssignmentPos; pos == 0 || pos != math.MaxInt32 {
 * 					referencingFunction := ast.FindAncestor(node, ast.IsFunctionOrSourceFile)
 * 					declaringFunction := ast.FindAncestor(symbol.ValueDeclaration, ast.IsFunctionOrSourceFile)
 * 					if referencingFunction == declaringFunction {
 * 						links.lastAssignmentPos = int32(c.extendAssignmentPosition(node, symbol.ValueDeclaration))
 * 					} else {
 * 						links.lastAssignmentPos = math.MaxInt32
 * 					}
 * 				}
 * 				if assignmentKind == AssignmentKindDefinite {
 * 					links.hasDefiniteAssignment = true
 * 				}
 * 			}
 * 		}
 * 		return false
 * 	case ast.KindExportSpecifier:
 * 		exportDeclaration := node.AsExportSpecifier().Parent.Parent.AsExportDeclaration()
 * 		name := node.PropertyNameOrName()
 * 		if !node.IsTypeOnly() && !exportDeclaration.IsTypeOnly && exportDeclaration.ModuleSpecifier == nil && !ast.IsStringLiteral(name) {
 * 			symbol := c.resolveEntityName(name, ast.SymbolFlagsValue, true /*ignoreErrors* /, true /*dontResolveAlias* /, nil)
 * 			if symbol != nil && c.isParameterOrMutableLocalVariable(symbol) {
 * 				links := c.markedAssignmentSymbolLinks.Get(symbol)
 * 				links.lastAssignmentPos = math.MaxInt32
 * 			}
 * 		}
 * 		return false
 * 	case ast.KindInterfaceDeclaration,
 * 		ast.KindTypeAliasDeclaration,
 * 		ast.KindJSTypeAliasDeclaration,
 * 		ast.KindEnumDeclaration:
 * 		return false
 * 	}
 * 	if ast.IsTypeNode(node) {
 * 		return false
 * 	}
 * 	return node.ForEachChild(c.markNodeAssignments)
 * }
 */
export function Checker_markNodeAssignmentsWorker(receiver: GoPtr<Checker>, node: GoPtr<Node>): bool {
  switch (node!.Kind) {
    case KindIdentifier: {
      const assignmentKind = getAssignmentTargetKind(node);
      if (assignmentKind !== AssignmentKindNone) {
        const symbol = Checker_getResolvedSymbol(receiver, node);
        if (Checker_isParameterOrMutableLocalVariable(receiver, symbol)) {
          const links = getMarkedAssignmentSymbolLinks(receiver, symbol);
          const pos = links.lastAssignmentPos;
          if (pos === 0 || pos !== 2147483647) {
            const referencingFunction = FindAncestor(node, IsFunctionOrSourceFile);
            const declaringFunction = FindAncestor(symbol!.ValueDeclaration, IsFunctionOrSourceFile);
            if (referencingFunction === declaringFunction) {
              links.lastAssignmentPos = Checker_extendAssignmentPosition(receiver, node, symbol!.ValueDeclaration);
            } else {
              links.lastAssignmentPos = 2147483647;
            }
          }
          if (assignmentKind === AssignmentKindDefinite) { links.hasDefiniteAssignment = true; }
        }
      }
      return false;
    }
    case KindEnumDeclaration:
    case KindTypeAliasDeclaration:
    case KindJSTypeAliasDeclaration:
    case KindInterfaceDeclaration:
      return false;
  }
  if (IsExportSpecifier(node)) {
    const exportDeclaration = AsExportDeclaration(AsExportSpecifier(node)!.Parent!.Parent);
    const name = Node_PropertyNameOrName(node);
    if (!AsExportSpecifier(node)!.IsTypeOnly && !exportDeclaration!.IsTypeOnly && exportDeclaration!.ModuleSpecifier === undefined && !IsStringLiteral(name)) {
      const symbol = Checker_resolveEntityName(receiver, name, SymbolFlagsValue, true, true, undefined);
      if (symbol !== undefined && Checker_isParameterOrMutableLocalVariable(receiver, symbol)) {
        const links = getMarkedAssignmentSymbolLinks(receiver, symbol);
        links.lastAssignmentPos = 2147483647;
      }
    }
    return false;
  }
  if (IsTypeNode(node)) { return false; }
  return Node_ForEachChild(node, receiver!.markNodeAssignments);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/flow.go::method::Checker.extendAssignmentPosition","kind":"method","status":"implemented","sigHash":"cc0b28ad564cf0e462a823cfc7bc96c37346e1dfe16d540db381a6cbf5869eec","bodyHash":"6cc53f702f78aab4d98a01520b26fc4b03170f7bde8ea487a2907d7f436097ed"}
 *
 * Go source:
 * func (c *Checker) extendAssignmentPosition(node *ast.Node, declaration *ast.Node) int {
 * 	pos := node.Pos()
 * 	for node != nil && node.Pos() > declaration.Pos() {
 * 		switch node.Kind {
 * 		case ast.KindVariableStatement, ast.KindExpressionStatement, ast.KindIfStatement, ast.KindDoStatement, ast.KindWhileStatement,
 * 			ast.KindForStatement, ast.KindForInStatement, ast.KindForOfStatement, ast.KindWithStatement, ast.KindSwitchStatement,
 * 			ast.KindTryStatement, ast.KindClassDeclaration:
 * 			pos = node.End()
 * 		}
 * 		node = node.Parent
 * 	}
 * 	return pos
 * }
 */
export function Checker_extendAssignmentPosition(receiver: GoPtr<Checker>, node: GoPtr<Node>, declaration: GoPtr<Node>): int {
  let pos = Node_Pos(node);
  let cur = node;
  while (cur !== undefined && Node_Pos(cur) > Node_Pos(declaration)) {
    switch (cur!.Kind) {
      case KindVariableStatement:
      case KindExpressionStatement:
      case KindIfStatement:
      case KindDoStatement:
      case KindWhileStatement:
      case KindForStatement:
      case KindForInStatement:
      case KindForOfStatement:
      case KindWithStatement:
      case KindSwitchStatement:
      case KindTryStatement:
      case KindClassDeclaration:
        pos = Node_End(cur);
        break;
    }
    cur = cur!.Parent;
  }
  return pos;
}
