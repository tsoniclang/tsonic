import type { bool, byte, int } from "@tsonic/core/types.js";
import type { GoPtr, GoSlice } from "../../../go/compat.js";
import { Node_End, Node_FlowNodeData, Node_ForEachChild, Node_Name, Node_Pos } from "../../ast/spine.js";
import type { Node } from "../../ast/spine.js";
import type { Expression } from "../../ast/generated/unions.js";
import type { Diagnostic } from "../../ast/diagnostic.js";
import { Diagnostic_AddRelatedInfo, Diagnostic_SetCategory, NewDiagnostic } from "../../ast/diagnostic.js";
import type { Kind } from "../../ast/generated/kinds.js";
import { KindEqualsEqualsEqualsToken, KindEqualsEqualsToken, KindExclamationEqualsEqualsToken, KindExclamationEqualsToken, KindExclamationToken, KindFalseKeyword, KindIdentifier, KindPropertyAccessExpression, KindElementAccessExpression, KindTrueKeyword } from "../../ast/generated/kinds.js";
import {
  KindArrayType,
  KindBindingElement,
  KindBlock,
  KindBreakStatement,
  KindCallSignature,
  KindClassDeclaration,
  KindClassStaticBlockDeclaration,
  KindConditionalType,
  KindConstructor,
  KindConstructorType,
  KindConstructSignature,
  KindContinueStatement,
  KindDebuggerStatement,
  KindDoStatement,
  KindEmptyStatement,
  KindEnumDeclaration,
  KindEnumMember,
  KindExportAssignment,
  KindExportDeclaration,
  KindForInStatement,
  KindForOfStatement,
  KindForStatement,
  KindFunctionDeclaration,
  KindFunctionType,
  KindGetAccessor,
  KindIfStatement,
  KindImportDeclaration,
  KindImportEqualsDeclaration,
  KindImportType,
  KindIndexedAccessType,
  KindIndexSignature,
  KindInferType,
  KindInterfaceDeclaration,
  KindIntersectionType,
  KindJSDocAllType,
  KindJSDocNullableType,
  KindJSDocNonNullableType,
  KindJSDocTypeLiteral,
  KindJSImportDeclaration,
  KindJSTypeAliasDeclaration,
  KindLabeledStatement,
  KindMappedType,
  KindMethodDeclaration,
  KindMethodSignature,
  KindMissingDeclaration,
  KindModuleBlock,
  KindModuleDeclaration,
  KindNamedTupleMember,
  KindOptionalType,
  KindParameter,
  KindParenthesizedType,
  KindPropertyDeclaration,
  KindPropertySignature,
  KindRestType,
  KindReturnStatement,
  KindSetAccessor,
  KindSwitchStatement,
  KindTemplateLiteralType,
  KindThisType,
  KindThrowStatement,
  KindTryStatement,
  KindTupleType,
  KindTypeAssertionExpression,
  KindTypeAliasDeclaration,
  KindTypeLiteral,
  KindTypeOperator,
  KindTypeParameter,
  KindTypePredicate,
  KindTypeQuery,
  KindTypeReference,
  KindUnionType,
  KindVariableDeclaration,
  KindVariableStatement,
  KindWhileStatement,
  KindWithStatement,
  KindExpressionStatement,
} from "../../ast/generated/kinds.js";
import type { Symbol, SymbolTable } from "../../ast/symbol.js";
import { NodeFlagsAmbient, NodeFlagsReparsed, NodeFlagsThisNodeOrAnySubNodesHasError, SymbolFlagsAlias, SymbolFlagsEnum, SymbolFlagsEnumMember, SymbolFlagsNone, SymbolFlagsOptional, SymbolFlagsValue } from "../../ast/generated/flags.js";
import type { SymbolFlags } from "../../ast/generated/flags.js";
import { IsClassExpression, IsFunctionExpression, IsIdentifier, IsVariableDeclaration } from "../../ast/generated/predicates.js";
import { AsBindingElement, AsElementAccessExpression, AsJSDoc } from "../../ast/generated/casts.js";
import { ModifierFlagsNone, ModifierFlagsNonPublicAccessibilityModifier } from "../../ast/modifierflags.js";
import type { ModifierFlags } from "../../ast/modifierflags.js";
import { AsSourceFile, Node_EagerJSDoc, Node_Elements, Node_Expression, Node_Initializer, Node_Locals, Node_Members, Node_Symbol, Node_Text, Node_PropertyName, Node_Type, SourceFile_FileName, SourceFile_Path, SourceFile_Text } from "../../ast/ast.js";
import type { FlowNode } from "../../ast/flow.js";
import { GetEnclosingBlockScopeContainer, GetExtendsHeritageClauseElement, GetSourceFileOfNode, IsEntityNameExpression, IsExternalOrCommonJSModule, IsGlobalScopeAugmentation, IsInfinityOrNaNString, IsInJSFile, IsPartOfParameterDeclaration, IsStringLiteralLike, NewHasFileName, SkipParentheses, WalkUpBindingElementsAndPatterns } from "../../ast/utilities.js";
import { Every, Some } from "../../core/core.js";
import { ModuleKindCommonJS, ModuleKindES2015, ModuleKindESNext, ModuleKindNode16, ModuleKindNodeNext, ModuleKindNone } from "../../core/compileroptions.js";
import { NewTextRange } from "../../core/text.js";
import { Tristate_IsTrue, TSTrue } from "../../core/tristate.js";
import type { Message } from "../../diagnostics/diagnostics.js";
import { CategorySuggestion } from "../../diagnostics/diagnostics.js";
import { Assert } from "../../debug/debug.js";
import {
  All_destructured_elements_are_unused,
  An_async_iterator_must_have_a_next_method,
  An_iterator_must_have_a_next_method,
  A_const_assertion_can_only_be_applied_to_references_to_enum_members_or_string_number_boolean_array_or_object_literals,
  Compiler_reserves_name_0_when_emitting_private_identifier_downlevel,
  Conversion_of_type_0_to_type_1_may_be_a_mistake_because_neither_type_sufficiently_overlaps_with_the_other_If_this_was_intentional_convert_the_expression_to_unknown_first,
  Declaration_name_conflicts_with_built_in_global_identifier_0,
  Did_you_mean_0,
  Duplicate_identifier_0_Compiler_reserves_name_1_when_emitting_super_references_in_static_initializers,
  The_0_property_of_an_async_iterator_must_be_a_method,
  The_0_property_of_an_iterator_must_be_a_method,
  This_condition_will_always_return_0,
  This_syntax_is_not_allowed_when_erasableSyntaxOnly_is_enabled,
  The_type_returned_by_the_0_method_of_an_async_iterator_must_be_a_promise_for_a_type_with_a_value_property,
  The_type_returned_by_the_0_method_of_an_iterator_must_have_a_value_property,
  Type_of_await_operand_must_either_be_a_valid_promise_or_must_not_contain_a_callable_then_member,
  We_can_only_write_a_type_for_0_by_adding_a_type_for_the_entire_parameter_here,
  X_0_is_an_unused_renaming_of_1_Did_you_intend_to_use_it_as_a_type_annotation,
} from "../../diagnostics/generated/messages.js";
import type { Result } from "../../evaluator/evaluator.js";
import { NewResult } from "../../evaluator/evaluator.js";
import { Map } from "../../core/core.js";
import { LinkStore_Get } from "../../core/linkstore.js";
import { RelationComparisonResultReportsUnmeasurable, RelationComparisonResultReportsUnreliable } from "../relater.js";
import { Checker_checkTypeComparableTo, Checker_compareTypesAssignableWorker, Checker_isTypeComparableTo } from "../relater.js";
import { Checker_isPostSuperFlowNode, Checker_markNodeAssignmentsWorker } from "../flow.js";
import { Checker_isCanceled, Checker_isConstantVariable } from "../utilities.js";
import { Checker_checkGrammarBindingElement, Checker_checkGrammarStatementInAmbientContext } from "../grammarchecks.js";
import { ObjectFlagsAnonymous, SignatureKindConstruct, Type_Types, TypeFlagsNonPrimitive, TypeFlagsPrimitive, TypeFlagsUnion } from "../types.js";
import { NodeCheckFlagsContainsClassWithPrivateIdentifiers, NodeCheckFlagsContainsSuperPropertyInStaticInitializer } from "../types.js";
import type { NodeLinks } from "../types.js";
import { newEmitResolver } from "../emitresolver.js";
import type { EmitResolver } from "../emitresolver.js";
import type { SymbolReferenceLinks, Ternary, Type } from "../types.js";
import { DiagnosticsCollection_Add } from "../../ast/diagnostic.js";
import { Diagnostic_SetSkippedOnNoEmit } from "../../ast/diagnostic.js";
import { entityNameToString, getDeclarationModifierFlagsFromSymbol, hasExportAssignmentSymbol, isConstTypeReference, isSyntacticDefault, NewDiagnosticForNode } from "../utilities.js";
import { SkipTrivia, TokenToString } from "../../scanner/scanner.js";
import { DeclarationNameToString } from "../../scanner/utilities.js";
import { TernaryFalse, TernaryTrue } from "../types.js";
import { Checker_addErrorOrSuggestion, Checker_addUndefinedToGlobalsOrErrorOnRedeclaration, Checker_checkSourceElementUnreachable, Checker_isErrorType, Checker_unusedIsError } from "./diagnostics.js";
import { Checker_checkArrayType, Checker_checkConditionalType, Checker_checkJSDocType, Checker_checkMappedType, Checker_checkTemplateLiteralType, Checker_checkTupleType, Checker_checkTypeLiteral, Checker_checkTypeOperator, Checker_checkTypeQuery, Checker_checkTypeReferenceNode, Checker_checkUnionOrIntersectionType, Checker_couldContainTypeVariablesWorker, Checker_createArrayType, Checker_getAwaitedTypeEx, Checker_getBaseTypeOfLiteralType, Checker_getRegularTypeOfLiteralType, Checker_getRegularTypeOfObjectLiteral, Checker_getTypeFromTypeNode, Checker_getWidenedType, Checker_IsEmptyAnonymousObjectType, Checker_newAnonymousType, Checker_newObjectType } from "./types.js";
import { Checker_checkConstructorDeclaration, Checker_checkParameter, Checker_checkPropertySignature, Checker_checkSignatureDeclaration, Checker_checkThisType, Checker_checkTypeParameter, Checker_getSignaturesOfType, Checker_isMixinConstructorType, Checker_isStringIndexSignatureOnlyTypeWorker, Checker_isValidConstAssertionArgument } from "./signatures.js";
import { Checker_checkAccessorDeclaration, Checker_checkClassDeclaration, Checker_checkClassStaticBlockDeclaration, Checker_checkEnumDeclaration, Checker_checkEnumMember, Checker_checkExportDeclaration, Checker_checkFunctionDeclaration, Checker_checkImportDeclaration, Checker_checkImportEqualsDeclaration, Checker_checkImportType, Checker_checkIndexedAccessType, Checker_checkInterfaceDeclaration, Checker_checkMethodDeclaration, Checker_checkMissingDeclaration, Checker_checkModuleDeclaration, Checker_checkNamedTupleMember, Checker_checkPropertyDeclaration, Checker_checkTypeAliasDeclaration, Checker_checkVariableDeclaration, Checker_checkVariableLikeDeclaration, Checker_classDeclarationExtendsNull, Checker_createTypeFromGenericGlobalType, Checker_evaluateEnumMember, Checker_getEnumMemberValue, Checker_getGlobalStrictFunctionType, Checker_getGlobalSymbol, Checker_getGlobalType, Checker_getGlobalTypesResolver, Checker_getNonMissingTypeOfSymbol, Checker_getSymbolFlagsEx, Checker_getTargetSymbol, Checker_isBlockScopedNameDeclaredBeforeUse, Checker_isGlobalNaN, Checker_isReadonlySymbol, Checker_isUnreferencedVariableDeclaration, Checker_mergeSymbolTable, Checker_reportUnusedVariableDeclarations, Checker_resolveEntityName, Checker_getSymbolOfDeclaration, Checker_resolveExportByName } from "./symbols.js";
import { Checker_checkBlock, Checker_checkBreakOrContinueStatement, Checker_checkDoStatement, Checker_checkExpressionEx, Checker_checkExpressionStatement, Checker_checkForInStatement, Checker_checkForOfStatement, Checker_checkForStatement, Checker_checkIfStatement, Checker_checkLabeledStatement, Checker_checkNodeDeferred, Checker_checkReturnStatement, Checker_checkSwitchStatement, Checker_checkThrowStatement, Checker_checkTryStatement, Checker_checkVariableStatement, Checker_checkWhileStatement, Checker_checkWithStatement, Checker_reportUnusedVariable } from "./syntax-checking.js";
import { createDiagnosticForNode } from "./state.js";
import type { CacheHashKey, Checker, CheckMode, IterationTypesResolver, keyBuilder, UnusedKind } from "./state.js";
import type { AssertionLinks } from "../types.js";
import { Checker_checkTypePredicate } from "./flow-narrowing.js";
import { Checker_checkInferType } from "./inference.js";
import { Checker_checkExportAssignment } from "./relations.js";
import { Checker_checkJSDocComments } from "./jsx-jsdoc-decorators.js";
import { FromString } from "../../jsnum/string.js";
import { InternalSymbolNameDefault } from "../../ast/symbol.js";
import { Checker_getEmitSyntaxForModuleSpecifierExpression, Checker_mergeModuleAugmentation } from "./modules.js";

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.reportUnreliableWorker","kind":"method","status":"implemented","sigHash":"f90db0ec4a1e83322abe295dd0931dd486677de0bc0daa2547e75d4b77b49bea","bodyHash":"8d084b2ab50308dd75d05babeaa46f57acd50919a51e340f5ef60f79180a97f8"}
 *
 * Go source:
 * func (c *Checker) reportUnreliableWorker(t *Type) *Type {
 * 	if t == c.markerSuperType || t == c.markerSubType || t == c.markerOtherType {
 * 		c.reliabilityFlags |= RelationComparisonResultReportsUnreliable
 * 	}
 * 	return t
 * }
 */
export function Checker_reportUnreliableWorker(receiver: GoPtr<Checker>, t: GoPtr<Type>): GoPtr<Type> {
  if (t === receiver!.markerSuperType || t === receiver!.markerSubType || t === receiver!.markerOtherType) {
    receiver!.reliabilityFlags |= RelationComparisonResultReportsUnreliable;
  }
  return t;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.reportUnmeasurableWorker","kind":"method","status":"implemented","sigHash":"5d5e2b6772444b92994ff5cb3edeb7acef48ada17fd1985a6ba1e703752fe871","bodyHash":"61f9e2339a5be311c34e28edd9ed45651be746140c6683fc066c5cbf0f3ee491"}
 *
 * Go source:
 * func (c *Checker) reportUnmeasurableWorker(t *Type) *Type {
 * 	if t == c.markerSuperType || t == c.markerSubType || t == c.markerOtherType {
 * 		c.reliabilityFlags |= RelationComparisonResultReportsUnmeasurable
 * 	}
 * 	return t
 * }
 */
export function Checker_reportUnmeasurableWorker(receiver: GoPtr<Checker>, t: GoPtr<Type>): GoPtr<Type> {
  if (t === receiver!.markerSuperType || t === receiver!.markerSubType || t === receiver!.markerOtherType) {
    receiver!.reliabilityFlags |= RelationComparisonResultReportsUnmeasurable;
  }
  return t;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.initializeClosures","kind":"method","status":"implemented","sigHash":"6b39b265d7e91408b4a1f7565b22b968f73ccd50192d093d036a295bb5e34156","bodyHash":"a0bee21fac4421ff1231109d00cb8356ef5659286ca7759cdb0879e0abcf6532"}
 *
 * Go source:
 * func (c *Checker) initializeClosures() {
 * 	c.isPrimitiveOrObjectOrEmptyType = func(t *Type) bool {
 * 		return t.flags&(TypeFlagsPrimitive|TypeFlagsNonPrimitive) != 0 || c.IsEmptyAnonymousObjectType(t)
 * 	}
 * 	c.containsMissingType = func(t *Type) bool {
 * 		return t == c.missingType || t.flags&TypeFlagsUnion != 0 && t.Types()[0] == c.missingType
 * 	}
 * 	c.couldContainTypeVariables = c.couldContainTypeVariablesWorker
 * 	c.isStringIndexSignatureOnlyType = c.isStringIndexSignatureOnlyTypeWorker
 * 	c.markNodeAssignments = c.markNodeAssignmentsWorker
 * 	c.compareTypesAssignable = c.compareTypesAssignableWorker
 * }
 */
export function Checker_initializeClosures(receiver: GoPtr<Checker>): void {
  receiver!.isPrimitiveOrObjectOrEmptyType = (t: GoPtr<Type>): bool => {
    return (t!.flags & (TypeFlagsPrimitive | TypeFlagsNonPrimitive)) !== 0 || Checker_IsEmptyAnonymousObjectType(receiver, t);
  };
  receiver!.containsMissingType = (t: GoPtr<Type>): bool => {
    return t === receiver!.missingType || ((t!.flags & TypeFlagsUnion) !== 0 && Type_Types(t)[0] === receiver!.missingType);
  };
  receiver!.couldContainTypeVariables = (t: GoPtr<Type>): bool => Checker_couldContainTypeVariablesWorker(receiver, t);
  receiver!.isStringIndexSignatureOnlyType = (t: GoPtr<Type>): bool => Checker_isStringIndexSignatureOnlyTypeWorker(receiver, t);
  receiver!.markNodeAssignments = (node: GoPtr<Node>): bool => Checker_markNodeAssignmentsWorker(receiver, node);
  receiver!.compareTypesAssignable = (s: GoPtr<Type>, t: GoPtr<Type>, reportErrors: bool): Ternary =>
    Checker_compareTypesAssignableWorker(receiver, s, t, reportErrors);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.initializeIterationResolvers","kind":"method","status":"implemented","sigHash":"8a872a7dea5689ae143df68cd6d1470054e2aa60f81dc6e07bc6a9b1b6b6f403","bodyHash":"f16a1445b73ffe9127886e3e2480abab48f8a5a6cd74e98eaccc95c34acb34dd"}
 *
 * Go source:
 * func (c *Checker) initializeIterationResolvers() {
 * 	c.syncIterationTypesResolver = &IterationTypesResolver{
 * 		iteratorSymbolName:                   "iterator",
 * 		getGlobalIteratorType:                c.getGlobalIteratorType,
 * 		getGlobalIterableType:                c.getGlobalIterableType,
 * 		getGlobalIterableTypeChecked:         c.getGlobalIterableTypeChecked,
 * 		getGlobalIterableIteratorType:        c.getGlobalIterableIteratorType,
 * 		getGlobalIterableIteratorTypeChecked: c.getGlobalIterableIteratorTypeChecked,
 * 		getGlobalIteratorObjectType:          c.getGlobalIteratorObjectType,
 * 		getGlobalGeneratorType:               c.getGlobalGeneratorType,
 * 		getGlobalBuiltinIteratorTypes:        c.getGlobalTypesResolver([]string{"ArrayIterator", "MapIterator", "SetIterator", "StringIterator"}, 1, false /*reportErrors* /),
 * 		resolveIterationType: func(t *Type, errorNode *ast.Node) *Type {
 * 			return t
 * 		},
 * 		mustHaveANextMethodDiagnostic: diagnostics.An_iterator_must_have_a_next_method,
 * 		mustBeAMethodDiagnostic:       diagnostics.The_0_property_of_an_iterator_must_be_a_method,
 * 		mustHaveAValueDiagnostic:      diagnostics.The_type_returned_by_the_0_method_of_an_iterator_must_have_a_value_property,
 * 	}
 * 	c.asyncIterationTypesResolver = &IterationTypesResolver{
 * 		iteratorSymbolName:                   "asyncIterator",
 * 		getGlobalIteratorType:                c.getGlobalAsyncIteratorType,
 * 		getGlobalIterableType:                c.getGlobalAsyncIterableType,
 * 		getGlobalIterableTypeChecked:         c.getGlobalAsyncIterableTypeChecked,
 * 		getGlobalIterableIteratorType:        c.getGlobalAsyncIterableIteratorType,
 * 		getGlobalIterableIteratorTypeChecked: c.getGlobalAsyncIterableIteratorTypeChecked,
 * 		getGlobalIteratorObjectType:          c.getGlobalAsyncIteratorObjectType,
 * 		getGlobalGeneratorType:               c.getGlobalAsyncGeneratorType,
 * 		getGlobalBuiltinIteratorTypes:        c.getGlobalTypesResolver([]string{"ReadableStreamAsyncIterator"}, 1, false /*reportErrors* /),
 * 		resolveIterationType: func(t *Type, errorNode *ast.Node) *Type {
 * 			return c.getAwaitedTypeEx(t, errorNode, diagnostics.Type_of_await_operand_must_either_be_a_valid_promise_or_must_not_contain_a_callable_then_member)
 * 		},
 * 		mustHaveANextMethodDiagnostic: diagnostics.An_async_iterator_must_have_a_next_method,
 * 		mustBeAMethodDiagnostic:       diagnostics.The_0_property_of_an_async_iterator_must_be_a_method,
 * 		mustHaveAValueDiagnostic:      diagnostics.The_type_returned_by_the_0_method_of_an_async_iterator_must_be_a_promise_for_a_type_with_a_value_property,
 * 	}
 * }
 */
export function Checker_initializeIterationResolvers(receiver: GoPtr<Checker>): void {
  receiver!.syncIterationTypesResolver = {
    iteratorSymbolName: "iterator",
    getGlobalIteratorType: receiver!.getGlobalIteratorType,
    getGlobalIterableType: receiver!.getGlobalIterableType,
    getGlobalIterableTypeChecked: receiver!.getGlobalIterableTypeChecked,
    getGlobalIterableIteratorType: receiver!.getGlobalIterableIteratorType,
    getGlobalIterableIteratorTypeChecked: receiver!.getGlobalIterableIteratorTypeChecked,
    getGlobalIteratorObjectType: receiver!.getGlobalIteratorObjectType,
    getGlobalGeneratorType: receiver!.getGlobalGeneratorType,
    getGlobalBuiltinIteratorTypes: Checker_getGlobalTypesResolver(receiver, ["ArrayIterator", "MapIterator", "SetIterator", "StringIterator"], 1, false),
    resolveIterationType: (t: GoPtr<Type>, _errorNode: GoPtr<Node>): GoPtr<Type> => t,
    mustHaveANextMethodDiagnostic: An_iterator_must_have_a_next_method,
    mustBeAMethodDiagnostic: The_0_property_of_an_iterator_must_be_a_method,
    mustHaveAValueDiagnostic: The_type_returned_by_the_0_method_of_an_iterator_must_have_a_value_property,
  } satisfies IterationTypesResolver;
  receiver!.asyncIterationTypesResolver = {
    iteratorSymbolName: "asyncIterator",
    getGlobalIteratorType: receiver!.getGlobalAsyncIteratorType,
    getGlobalIterableType: receiver!.getGlobalAsyncIterableType,
    getGlobalIterableTypeChecked: receiver!.getGlobalAsyncIterableTypeChecked,
    getGlobalIterableIteratorType: receiver!.getGlobalAsyncIterableIteratorType,
    getGlobalIterableIteratorTypeChecked: receiver!.getGlobalAsyncIterableIteratorTypeChecked,
    getGlobalIteratorObjectType: receiver!.getGlobalAsyncIteratorObjectType,
    getGlobalGeneratorType: receiver!.getGlobalAsyncGeneratorType,
    getGlobalBuiltinIteratorTypes: Checker_getGlobalTypesResolver(receiver, ["ReadableStreamAsyncIterator"], 1, false),
    resolveIterationType: (t: GoPtr<Type>, errorNode: GoPtr<Node>): GoPtr<Type> => Checker_getAwaitedTypeEx(receiver, t, errorNode, Type_of_await_operand_must_either_be_a_valid_promise_or_must_not_contain_a_callable_then_member),
    mustHaveANextMethodDiagnostic: An_async_iterator_must_have_a_next_method,
    mustBeAMethodDiagnostic: The_0_property_of_an_async_iterator_must_be_a_method,
    mustHaveAValueDiagnostic: The_type_returned_by_the_0_method_of_an_async_iterator_must_be_a_promise_for_a_type_with_a_value_property,
  } satisfies IterationTypesResolver;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.initializeChecker","kind":"method","status":"implemented","sigHash":"354ce66dc08c8b1ca3e621b8c9dd2830798117e69953308e1dd6998571784bb2","bodyHash":"a13d3cd95c213b4d0cad584a785d3f20e6d3a42bca2aa79156287cac5d5df3c7"}
 *
 * Go source:
 * func (c *Checker) initializeChecker() {
 * 	// Initialize global symbol table
 * 	augmentations := make([][]*ast.Node, 0, len(c.files))
 * 	for _, file := range c.files {
 * 		if !ast.IsExternalOrCommonJSModule(file) {
 * 			// It is an error for a non-external-module (i.e. script) to declare its own `globalThis`.
 * 			if fileGlobalThisSymbol := file.Locals["globalThis"]; fileGlobalThisSymbol != nil {
 * 				for _, d := range fileGlobalThisSymbol.Declarations {
 * 					c.diagnostics.Add(NewDiagnosticForNode(d, diagnostics.Declaration_name_conflicts_with_built_in_global_identifier_0, "globalThis"))
 * 				}
 * 			}
 * 			c.mergeSymbolTable(c.globals, file.Locals, false, nil)
 * 		}
 * 		c.patternAmbientModules = append(c.patternAmbientModules, file.PatternAmbientModules...)
 * 		augmentations = append(augmentations, file.ModuleAugmentations)
 * 		if file.Symbol != nil {
 * 			// Merge in UMD exports with first-in-wins semantics (see #9771)
 * 			for name, symbol := range file.GlobalExports {
 * 				if _, ok := c.globals[name]; !ok {
 * 					c.globals[name] = symbol
 * 				}
 * 			}
 * 		}
 * 	}
 * 	// We do global augmentations separately from module augmentations (and before creating global types) because they
 * 	//  1. Affect global types. We won't have the correct global types until global augmentations are merged. Also,
 * 	//  2. Module augmentation instantiation requires creating the type of a module, which, in turn, can require
 * 	//       checking for an export or property on the module (if export=) which, in turn, can fall back to the
 * 	//       apparent type of the module - either globalObjectType or globalFunctionType - which wouldn't exist if we
 * 	//       did module augmentations prior to finalizing the global types.
 * 	for _, list := range augmentations {
 * 		for _, augmentation := range list {
 * 			// Merge 'global' module augmentations. This needs to be done after global symbol table is initialized to
 * 			// make sure that all ambient modules are indexed
 * 			if ast.IsGlobalScopeAugmentation(augmentation.Parent) {
 * 				c.mergeModuleAugmentation(augmentation)
 * 			}
 * 		}
 * 	}
 * 	c.addUndefinedToGlobalsOrErrorOnRedeclaration()
 * 	c.valueSymbolLinks.Get(c.undefinedSymbol).resolvedType = c.undefinedWideningType
 * 	c.valueSymbolLinks.Get(c.argumentsSymbol).resolvedType = c.getGlobalType("IArguments", 0 /*arity* /, true /*reportErrors* /)
 * 	c.valueSymbolLinks.Get(c.unknownSymbol).resolvedType = c.errorType
 * 	c.valueSymbolLinks.Get(c.globalThisSymbol).resolvedType = c.newObjectType(ObjectFlagsAnonymous, c.globalThisSymbol)
 * 	// Initialize special types
 * 	c.globalArrayType = c.getGlobalType("Array", 1 /*arity* /, true /*reportErrors* /)
 * 	c.globalObjectType = c.getGlobalType("Object", 0 /*arity* /, true /*reportErrors* /)
 * 	c.globalFunctionType = c.getGlobalType("Function", 0 /*arity* /, true /*reportErrors* /)
 * 	c.globalCallableFunctionType = c.getGlobalStrictFunctionType("CallableFunction")
 * 	c.globalNewableFunctionType = c.getGlobalStrictFunctionType("NewableFunction")
 * 	c.globalStringType = c.getGlobalType("String", 0 /*arity* /, true /*reportErrors* /)
 * 	c.globalNumberType = c.getGlobalType("Number", 0 /*arity* /, true /*reportErrors* /)
 * 	c.globalBooleanType = c.getGlobalType("Boolean", 0 /*arity* /, true /*reportErrors* /)
 * 	c.globalRegExpType = c.getGlobalType("RegExp", 0 /*arity* /, true /*reportErrors* /)
 * 	c.anyArrayType = c.createArrayType(c.anyType)
 * 	c.autoArrayType = c.createArrayType(c.autoType)
 * 	if c.autoArrayType == c.emptyObjectType {
 * 		// autoArrayType is used as a marker, so even if global Array type is not defined, it needs to be a unique type
 * 		c.autoArrayType = c.newAnonymousType(nil, nil, nil, nil, nil)
 * 	}
 * 	c.globalReadonlyArrayType = c.getGlobalType("ReadonlyArray", 1 /*arity* /, false /*reportErrors* /)
 * 	if c.globalReadonlyArrayType == c.emptyGenericType {
 * 		c.globalReadonlyArrayType = c.globalArrayType
 * 	}
 * 	c.anyReadonlyArrayType = c.createTypeFromGenericGlobalType(c.globalReadonlyArrayType, []*Type{c.anyType})
 * 	c.globalThisType = c.getGlobalType("ThisType", 1 /*arity* /, false /*reportErrors* /)
 * 	// merge _nonglobal_ module augmentations.
 * 	// this needs to be done after global symbol table is initialized to make sure that all ambient modules are indexed
 * 	for _, list := range augmentations {
 * 		for _, augmentation := range list {
 * 			if !ast.IsGlobalScopeAugmentation(augmentation.Parent) {
 * 				c.mergeModuleAugmentation(augmentation)
 * 			}
 * 		}
 * 	}
 * }
 */
export function Checker_initializeChecker(receiver: GoPtr<Checker>): void {
  const augmentations: GoSlice<GoSlice<GoPtr<Node>>> = [];
  for (const file of receiver!.files) {
    if (!IsExternalOrCommonJSModule(file)) {
      const fileLocals = Node_Locals(file as GoPtr<Node>);
      const fileGlobalThisSymbol = fileLocals?.get("globalThis");
      if (fileGlobalThisSymbol !== undefined) {
        for (const declaration of fileGlobalThisSymbol!.Declarations ?? []) {
          DiagnosticsCollection_Add(receiver!.diagnostics, createDiagnosticForNode(declaration, Declaration_name_conflicts_with_built_in_global_identifier_0, "globalThis"));
        }
      }
      if (fileLocals !== undefined) {
        Checker_mergeSymbolTable(receiver, receiver!.globals, fileLocals, false, undefined);
      }
    }
    receiver!.patternAmbientModules.push(...(file!.PatternAmbientModules ?? []));
    augmentations.push(file!.ModuleAugmentations ?? []);
    if (Node_Symbol(file as GoPtr<Node>) !== undefined) {
      for (const [name, symbol_] of file!.GlobalExports ?? new globalThis.Map<string, GoPtr<Symbol>>()) {
        if (!receiver!.globals.has(name)) {
          receiver!.globals.set(name, symbol_);
        }
      }
    }
  }
  for (const list of augmentations) {
    for (const augmentation of list) {
      if (IsGlobalScopeAugmentation(augmentation!.Parent)) {
        Checker_mergeModuleAugmentation(receiver, augmentation);
      }
    }
  }
  Checker_addUndefinedToGlobalsOrErrorOnRedeclaration(receiver);
  LinkStore_Get(receiver!.valueSymbolLinks, receiver!.undefinedSymbol)!.resolvedType = receiver!.undefinedWideningType;
  LinkStore_Get(receiver!.valueSymbolLinks, receiver!.argumentsSymbol)!.resolvedType = Checker_getGlobalType(receiver, "IArguments", 0, true);
  LinkStore_Get(receiver!.valueSymbolLinks, receiver!.unknownSymbol)!.resolvedType = receiver!.errorType;
  LinkStore_Get(receiver!.valueSymbolLinks, receiver!.globalThisSymbol)!.resolvedType = Checker_newObjectType(receiver, ObjectFlagsAnonymous, receiver!.globalThisSymbol);
  receiver!.globalArrayType = Checker_getGlobalType(receiver, "Array", 1, true);
  receiver!.globalObjectType = Checker_getGlobalType(receiver, "Object", 0, true);
  receiver!.globalFunctionType = Checker_getGlobalType(receiver, "Function", 0, true);
  receiver!.globalCallableFunctionType = Checker_getGlobalStrictFunctionType(receiver, "CallableFunction");
  receiver!.globalNewableFunctionType = Checker_getGlobalStrictFunctionType(receiver, "NewableFunction");
  receiver!.globalStringType = Checker_getGlobalType(receiver, "String", 0, true);
  receiver!.globalNumberType = Checker_getGlobalType(receiver, "Number", 0, true);
  receiver!.globalBooleanType = Checker_getGlobalType(receiver, "Boolean", 0, true);
  receiver!.globalRegExpType = Checker_getGlobalType(receiver, "RegExp", 0, true);
  receiver!.anyArrayType = Checker_createArrayType(receiver, receiver!.anyType);
  receiver!.autoArrayType = Checker_createArrayType(receiver, receiver!.autoType);
  if (receiver!.autoArrayType === receiver!.emptyObjectType) {
    receiver!.autoArrayType = Checker_newAnonymousType(receiver, undefined, undefined as unknown as SymbolTable, [], [], []);
  }
  receiver!.globalReadonlyArrayType = Checker_getGlobalType(receiver, "ReadonlyArray", 1, false);
  if (receiver!.globalReadonlyArrayType === receiver!.emptyGenericType) {
    receiver!.globalReadonlyArrayType = receiver!.globalArrayType;
  }
  receiver!.anyReadonlyArrayType = Checker_createTypeFromGenericGlobalType(receiver, receiver!.globalReadonlyArrayType, [receiver!.anyType]);
  receiver!.globalThisType = Checker_getGlobalType(receiver, "ThisType", 1, false);
  for (const list of augmentations) {
    for (const augmentation of list) {
      if (!IsGlobalScopeAugmentation(augmentation!.Parent)) {
        Checker_mergeModuleAugmentation(receiver, augmentation);
      }
    }
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.symbolReferenced","kind":"method","status":"implemented","sigHash":"9d559ba705bd71a30f81d3ff86c7c3fd070af0c3b829dc3a2f1a8a765a19b850","bodyHash":"092dec53d97117e547064affd2a6356b852a4daad74c51ba6fc8087eb21bc901"}
 *
 * Go source:
 * func (c *Checker) symbolReferenced(symbol *ast.Symbol, meaning ast.SymbolFlags) {
 * 	c.symbolReferenceLinks.Get(symbol).referenceKinds |= meaning
 * }
 */
export function Checker_symbolReferenced(receiver: GoPtr<Checker>, symbol_: GoPtr<Symbol>, meaning: SymbolFlags): void {
  (LinkStore_Get(receiver!.symbolReferenceLinks, symbol_) as GoPtr<SymbolReferenceLinks>)!.referenceKinds |= meaning;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.checkSourceElements","kind":"method","status":"implemented","sigHash":"e90c6a3b735d0641fd58be4c7885a93495e07f4e69433afdd1810ec0e95e6d11","bodyHash":"f7f45356a90c2e5e019118f0ec71201a07d6d63f5add6a21b2435deefd0ca792"}
 *
 * Go source:
 * func (c *Checker) checkSourceElements(nodes []*ast.Node) {
 * 	for _, node := range nodes {
 * 		if c.isCanceled() {
 * 			break
 * 		}
 * 		c.checkSourceElement(node)
 * 	}
 * }
 */
export function Checker_checkSourceElements(receiver: GoPtr<Checker>, nodes: GoSlice<GoPtr<Node>>): void {
  for (const node of nodes) {
    if (Checker_isCanceled(receiver)) {
      break;
    }
    Checker_checkSourceElement(receiver, node);
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.checkSourceElement","kind":"method","status":"implemented","sigHash":"423b837552ee1d318a7c606386a1af9cc9e8c0d4d5d8a46a1d03e3ae75086334","bodyHash":"9b459177c1588a7e614bc9663b8a3afaaa922e634da3893056ef5ae533f6bf9b"}
 *
 * Go source:
 * func (c *Checker) checkSourceElement(node *ast.Node) bool {
 * 	if node != nil {
 * 		saveCurrentNode := c.currentNode
 * 		saveWithinUnreachableCode := c.withinUnreachableCode
 * 		c.currentNode = node
 * 		c.instantiationCount = 0
 * 		c.checkSourceElementWorker(node)
 * 		c.currentNode = saveCurrentNode
 * 		c.withinUnreachableCode = saveWithinUnreachableCode
 * 	}
 * 	return false
 * }
 */
export function Checker_checkSourceElement(receiver: GoPtr<Checker>, node: GoPtr<Node>): bool {
  if (node !== undefined) {
    const saveCurrentNode = receiver!.currentNode;
    const saveWithinUnreachableCode = receiver!.withinUnreachableCode;
    receiver!.currentNode = node;
    receiver!.instantiationCount = 0;
    Checker_checkSourceElementWorker(receiver, node);
    receiver!.currentNode = saveCurrentNode;
    receiver!.withinUnreachableCode = saveWithinUnreachableCode;
  }
  return false;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.checkSourceElementWorker","kind":"method","status":"implemented","sigHash":"7a7a80c7c468f1b601b722525a3ea6553ca95bf0d5546e820a1a0d8ce614dd0f","bodyHash":"20e8f840bc1422138f2013bec3412fe97aba68534d4005747b7f4d72d11cb59a"}
 *
 * Go source:
 * func (c *Checker) checkSourceElementWorker(node *ast.Node) {
 * 	for _, jsdoc := range node.EagerJSDoc(nil) {
 * 		c.checkJSDocComments(jsdoc)
 * 		if tags := jsdoc.AsJSDoc().Tags; tags != nil {
 * 			for _, tag := range tags.Nodes {
 * 				c.checkJSDocComments(tag)
 * 			}
 * 		}
 * 	}
 * 
 * 	if !c.withinUnreachableCode && c.compilerOptions.AllowUnreachableCode != core.TSTrue {
 * 		if c.checkSourceElementUnreachable(node) {
 * 			c.withinUnreachableCode = true
 * 		}
 * 	}
 * 
 * 	switch node.Kind {
 * 	case ast.KindTypeParameter:
 * 		c.checkTypeParameter(node)
 * 	case ast.KindParameter:
 * 		c.checkParameter(node)
 * 	case ast.KindPropertyDeclaration:
 * 		c.checkPropertyDeclaration(node)
 * 	case ast.KindPropertySignature:
 * 		c.checkPropertySignature(node)
 * 	case ast.KindConstructorType, ast.KindFunctionType, ast.KindCallSignature, ast.KindConstructSignature, ast.KindIndexSignature:
 * 		c.checkSignatureDeclaration(node)
 * 	case ast.KindMethodDeclaration, ast.KindMethodSignature:
 * 		c.checkMethodDeclaration(node)
 * 	case ast.KindClassStaticBlockDeclaration:
 * 		c.checkClassStaticBlockDeclaration(node)
 * 	case ast.KindConstructor:
 * 		c.checkConstructorDeclaration(node)
 * 	case ast.KindGetAccessor, ast.KindSetAccessor:
 * 		c.checkAccessorDeclaration(node)
 * 	case ast.KindTypeReference:
 * 		c.checkTypeReferenceNode(node)
 * 	case ast.KindTypePredicate:
 * 		c.checkTypePredicate(node)
 * 	case ast.KindTypeQuery:
 * 		c.checkTypeQuery(node)
 * 	case ast.KindTypeLiteral:
 * 		c.checkTypeLiteral(node)
 * 	case ast.KindArrayType:
 * 		c.checkArrayType(node)
 * 	case ast.KindTupleType:
 * 		c.checkTupleType(node)
 * 	case ast.KindUnionType, ast.KindIntersectionType:
 * 		c.checkUnionOrIntersectionType(node)
 * 	case ast.KindParenthesizedType, ast.KindOptionalType, ast.KindRestType:
 * 		node.ForEachChild(c.checkSourceElement)
 * 	case ast.KindThisType:
 * 		c.checkThisType(node)
 * 	case ast.KindTypeOperator:
 * 		c.checkTypeOperator(node)
 * 	case ast.KindConditionalType:
 * 		c.checkConditionalType(node)
 * 	case ast.KindInferType:
 * 		c.checkInferType(node)
 * 	case ast.KindTemplateLiteralType:
 * 		c.checkTemplateLiteralType(node)
 * 	case ast.KindImportType:
 * 		c.checkImportType(node)
 * 	case ast.KindNamedTupleMember:
 * 		c.checkNamedTupleMember(node)
 * 	case ast.KindIndexedAccessType:
 * 		c.checkIndexedAccessType(node)
 * 	case ast.KindMappedType:
 * 		c.checkMappedType(node)
 * 	case ast.KindFunctionDeclaration:
 * 		c.checkFunctionDeclaration(node)
 * 	case ast.KindBlock, ast.KindModuleBlock:
 * 		c.checkBlock(node)
 * 	case ast.KindVariableStatement:
 * 		c.checkVariableStatement(node)
 * 	case ast.KindExpressionStatement:
 * 		c.checkExpressionStatement(node)
 * 	case ast.KindIfStatement:
 * 		c.checkIfStatement(node)
 * 	case ast.KindDoStatement:
 * 		c.checkDoStatement(node)
 * 	case ast.KindWhileStatement:
 * 		c.checkWhileStatement(node)
 * 	case ast.KindForStatement:
 * 		c.checkForStatement(node)
 * 	case ast.KindForInStatement:
 * 		c.checkForInStatement(node)
 * 	case ast.KindForOfStatement:
 * 		c.checkForOfStatement(node)
 * 	case ast.KindContinueStatement, ast.KindBreakStatement:
 * 		c.checkBreakOrContinueStatement(node)
 * 	case ast.KindReturnStatement:
 * 		c.checkReturnStatement(node)
 * 	case ast.KindWithStatement:
 * 		c.checkWithStatement(node)
 * 	case ast.KindSwitchStatement:
 * 		c.checkSwitchStatement(node)
 * 	case ast.KindLabeledStatement:
 * 		c.checkLabeledStatement(node)
 * 	case ast.KindThrowStatement:
 * 		c.checkThrowStatement(node)
 * 	case ast.KindTryStatement:
 * 		c.checkTryStatement(node)
 * 	case ast.KindVariableDeclaration:
 * 		c.checkVariableDeclaration(node)
 * 	case ast.KindBindingElement:
 * 		c.checkBindingElement(node)
 * 	case ast.KindClassDeclaration:
 * 		c.checkClassDeclaration(node)
 * 	case ast.KindInterfaceDeclaration:
 * 		c.checkInterfaceDeclaration(node)
 * 	case ast.KindTypeAliasDeclaration, ast.KindJSTypeAliasDeclaration:
 * 		c.checkTypeAliasDeclaration(node)
 * 	case ast.KindEnumDeclaration:
 * 		c.checkEnumDeclaration(node)
 * 	case ast.KindEnumMember:
 * 		c.checkEnumMember(node)
 * 	case ast.KindModuleDeclaration:
 * 		c.checkModuleDeclaration(node)
 * 	case ast.KindImportDeclaration, ast.KindJSImportDeclaration:
 * 		c.checkImportDeclaration(node)
 * 	case ast.KindImportEqualsDeclaration:
 * 		c.checkImportEqualsDeclaration(node)
 * 	case ast.KindExportDeclaration:
 * 		c.checkExportDeclaration(node)
 * 	case ast.KindExportAssignment:
 * 		c.checkExportAssignment(node)
 * 	case ast.KindEmptyStatement:
 * 		c.checkGrammarStatementInAmbientContext(node)
 * 	case ast.KindDebuggerStatement:
 * 		c.checkGrammarStatementInAmbientContext(node)
 * 	case ast.KindMissingDeclaration:
 * 		c.checkMissingDeclaration(node)
 * 	case ast.KindJSDocNonNullableType, ast.KindJSDocNullableType, ast.KindJSDocAllType, ast.KindJSDocTypeLiteral:
 * 		c.checkJSDocType(node)
 * 	}
 * }
 */
export function Checker_checkSourceElementWorker(receiver: GoPtr<Checker>, node: GoPtr<Node>): void {
  for (const jsdoc of Node_EagerJSDoc(node, undefined)) {
    Checker_checkJSDocComments(receiver, jsdoc);
    const tags = AsJSDoc(jsdoc)!.Tags;
    if (tags !== undefined) {
      for (const tag of tags.Nodes) {
        Checker_checkJSDocComments(receiver, tag);
      }
    }
  }

  if (!receiver!.withinUnreachableCode && receiver!.compilerOptions!.AllowUnreachableCode !== TSTrue) {
    if (Checker_checkSourceElementUnreachable(receiver, node)) {
      receiver!.withinUnreachableCode = true;
    }
  }

  switch (node!.Kind) {
    case KindTypeParameter:
      Checker_checkTypeParameter(receiver, node);
      break;
    case KindParameter:
      Checker_checkParameter(receiver, node);
      break;
    case KindPropertyDeclaration:
      Checker_checkPropertyDeclaration(receiver, node);
      break;
    case KindPropertySignature:
      Checker_checkPropertySignature(receiver, node);
      break;
    case KindConstructorType:
    case KindFunctionType:
    case KindCallSignature:
    case KindConstructSignature:
    case KindIndexSignature:
      Checker_checkSignatureDeclaration(receiver, node);
      break;
    case KindMethodDeclaration:
    case KindMethodSignature:
      Checker_checkMethodDeclaration(receiver, node);
      break;
    case KindClassStaticBlockDeclaration:
      Checker_checkClassStaticBlockDeclaration(receiver, node);
      break;
    case KindConstructor:
      Checker_checkConstructorDeclaration(receiver, node);
      break;
    case KindGetAccessor:
    case KindSetAccessor:
      Checker_checkAccessorDeclaration(receiver, node);
      break;
    case KindTypeReference:
      Checker_checkTypeReferenceNode(receiver, node);
      break;
    case KindTypePredicate:
      Checker_checkTypePredicate(receiver, node);
      break;
    case KindTypeQuery:
      Checker_checkTypeQuery(receiver, node);
      break;
    case KindTypeLiteral:
      Checker_checkTypeLiteral(receiver, node);
      break;
    case KindArrayType:
      Checker_checkArrayType(receiver, node);
      break;
    case KindTupleType:
      Checker_checkTupleType(receiver, node);
      break;
    case KindUnionType:
    case KindIntersectionType:
      Checker_checkUnionOrIntersectionType(receiver, node);
      break;
    case KindParenthesizedType:
    case KindOptionalType:
    case KindRestType:
      Node_ForEachChild(node, (child: GoPtr<Node>): bool => Checker_checkSourceElement(receiver, child));
      break;
    case KindThisType:
      Checker_checkThisType(receiver, node);
      break;
    case KindTypeOperator:
      Checker_checkTypeOperator(receiver, node);
      break;
    case KindConditionalType:
      Checker_checkConditionalType(receiver, node);
      break;
    case KindInferType:
      Checker_checkInferType(receiver, node);
      break;
    case KindTemplateLiteralType:
      Checker_checkTemplateLiteralType(receiver, node);
      break;
    case KindImportType:
      Checker_checkImportType(receiver, node);
      break;
    case KindNamedTupleMember:
      Checker_checkNamedTupleMember(receiver, node);
      break;
    case KindIndexedAccessType:
      Checker_checkIndexedAccessType(receiver, node);
      break;
    case KindMappedType:
      Checker_checkMappedType(receiver, node);
      break;
    case KindFunctionDeclaration:
      Checker_checkFunctionDeclaration(receiver, node);
      break;
    case KindBlock:
    case KindModuleBlock:
      Checker_checkBlock(receiver, node);
      break;
    case KindVariableStatement:
      Checker_checkVariableStatement(receiver, node);
      break;
    case KindExpressionStatement:
      Checker_checkExpressionStatement(receiver, node);
      break;
    case KindIfStatement:
      Checker_checkIfStatement(receiver, node);
      break;
    case KindDoStatement:
      Checker_checkDoStatement(receiver, node);
      break;
    case KindWhileStatement:
      Checker_checkWhileStatement(receiver, node);
      break;
    case KindForStatement:
      Checker_checkForStatement(receiver, node);
      break;
    case KindForInStatement:
      Checker_checkForInStatement(receiver, node);
      break;
    case KindForOfStatement:
      Checker_checkForOfStatement(receiver, node);
      break;
    case KindContinueStatement:
    case KindBreakStatement:
      Checker_checkBreakOrContinueStatement(receiver, node);
      break;
    case KindReturnStatement:
      Checker_checkReturnStatement(receiver, node);
      break;
    case KindWithStatement:
      Checker_checkWithStatement(receiver, node);
      break;
    case KindSwitchStatement:
      Checker_checkSwitchStatement(receiver, node);
      break;
    case KindLabeledStatement:
      Checker_checkLabeledStatement(receiver, node);
      break;
    case KindThrowStatement:
      Checker_checkThrowStatement(receiver, node);
      break;
    case KindTryStatement:
      Checker_checkTryStatement(receiver, node);
      break;
    case KindVariableDeclaration:
      Checker_checkVariableDeclaration(receiver, node);
      break;
    case KindBindingElement:
      Checker_checkBindingElement(receiver, node);
      break;
    case KindClassDeclaration:
      Checker_checkClassDeclaration(receiver, node);
      break;
    case KindInterfaceDeclaration:
      Checker_checkInterfaceDeclaration(receiver, node);
      break;
    case KindTypeAliasDeclaration:
    case KindJSTypeAliasDeclaration:
      Checker_checkTypeAliasDeclaration(receiver, node);
      break;
    case KindEnumDeclaration:
      Checker_checkEnumDeclaration(receiver, node);
      break;
    case KindEnumMember:
      Checker_checkEnumMember(receiver, node);
      break;
    case KindModuleDeclaration:
      Checker_checkModuleDeclaration(receiver, node);
      break;
    case KindImportDeclaration:
    case KindJSImportDeclaration:
      Checker_checkImportDeclaration(receiver, node);
      break;
    case KindImportEqualsDeclaration:
      Checker_checkImportEqualsDeclaration(receiver, node);
      break;
    case KindExportDeclaration:
      Checker_checkExportDeclaration(receiver, node);
      break;
    case KindExportAssignment:
      Checker_checkExportAssignment(receiver, node);
      break;
    case KindEmptyStatement:
      Checker_checkGrammarStatementInAmbientContext(receiver, node);
      break;
    case KindDebuggerStatement:
      Checker_checkGrammarStatementInAmbientContext(receiver, node);
      break;
    case KindMissingDeclaration:
      Checker_checkMissingDeclaration(receiver, node);
      break;
    case KindJSDocNonNullableType:
    case KindJSDocNullableType:
    case KindJSDocAllType:
    case KindJSDocTypeLiteral:
      Checker_checkJSDocType(receiver, node);
      break;
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.shouldCheckErasableSyntax","kind":"method","status":"implemented","sigHash":"836956af34b9fa5bd7e018c3bdaa57e0544f5749f957348a71d96f504bc20fda","bodyHash":"ae6b82a11fbe7bcdcd6327f61a8a1e552a241651edb8543b1eadc1a306497b7b"}
 *
 * Go source:
 * func (c *Checker) shouldCheckErasableSyntax(node *ast.Node) bool {
 * 	return c.compilerOptions.ErasableSyntaxOnly.IsTrue() && !ast.IsInJSFile(node)
 * }
 */
export function Checker_shouldCheckErasableSyntax(receiver: GoPtr<Checker>, node: GoPtr<Node>): bool {
  return Tristate_IsTrue(receiver!.compilerOptions!.ErasableSyntaxOnly) && !IsInJSFile(node);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.checkBindingElement","kind":"method","status":"implemented","sigHash":"56e08921498addcf28e2e88231327fb337667618da7a88ba5dc74586dfb34b2d","bodyHash":"b5a085a4c34c048c8bb4c4e92d516e4b4189a99d0aaa53af8ecc8ab43d8e9b9d"}
 *
 * Go source:
 * func (c *Checker) checkBindingElement(node *ast.Node) {
 * 	c.checkGrammarBindingElement(node.AsBindingElement())
 * 	c.checkVariableLikeDeclaration(node)
 * }
 */
export function Checker_checkBindingElement(receiver: GoPtr<Checker>, node: GoPtr<Node>): void {
  Checker_checkGrammarBindingElement(receiver, AsBindingElement(node));
  Checker_checkVariableLikeDeclaration(receiver, node);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.reportUnused","kind":"method","status":"implemented","sigHash":"d0fdcd4a2f4df123542070547530a1c6ad6fce1b1a2ad9757927538f325a555d","bodyHash":"a3c47e82fca17e2defe9b7ce647b5543dc246f6a9a2977425e99ef01e57c6cc6"}
 *
 * Go source:
 * func (c *Checker) reportUnused(location *ast.Node, kind UnusedKind, diagnostic *ast.Diagnostic) {
 * 	if location.Flags&(ast.NodeFlagsAmbient|ast.NodeFlagsThisNodeOrAnySubNodesHasError) == 0 {
 * 		isError := c.unusedIsError(kind)
 * 		if isError {
 * 			c.diagnostics.Add(diagnostic)
 * 		} else {
 * 			suggestion := *diagnostic
 * 			suggestion.SetCategory(diagnostics.CategorySuggestion)
 * 			c.suggestionDiagnostics.Add(&suggestion)
 * 		}
 * 	}
 * }
 */
export function Checker_reportUnused(receiver: GoPtr<Checker>, location: GoPtr<Node>, kind: UnusedKind, diagnostic: GoPtr<Diagnostic>): void {
  if ((location!.Flags & (NodeFlagsAmbient | NodeFlagsThisNodeOrAnySubNodesHasError)) === 0) {
    const isError = Checker_unusedIsError(receiver, kind);
    if (isError) {
      DiagnosticsCollection_Add(receiver!.diagnostics, diagnostic);
    } else {
      const suggestion = { ...diagnostic } as Diagnostic;
      Diagnostic_SetCategory(suggestion, CategorySuggestion);
      DiagnosticsCollection_Add(receiver!.suggestionDiagnostics, suggestion);
    }
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.reportUnusedBindingElements","kind":"method","status":"implemented","sigHash":"79d8c5c3039cd02cab17851ce4902610d4245e0df2544112deb6644f58d3afdc","bodyHash":"e95c11c050c584e1eba13d636f913cac1c3db6862a2cae1b0683a561853dcadf"}
 *
 * Go source:
 * func (c *Checker) reportUnusedBindingElements(node *ast.Node) {
 * 	declarations := node.Elements()
 * 	if len(declarations) > 1 && core.Every(declarations, c.isUnreferencedVariableDeclaration) {
 * 		c.reportUnusedVariable(node, NewDiagnosticForNode(node, diagnostics.All_destructured_elements_are_unused))
 * 	} else {
 * 		c.reportUnusedVariableDeclarations(declarations)
 * 	}
 * }
 */
export function Checker_reportUnusedBindingElements(receiver: GoPtr<Checker>, node: GoPtr<Node>): void {
  const declarations = Node_Elements(node) ?? [];
  if (declarations.length > 1 && Every(declarations, (declaration) => Checker_isUnreferencedVariableDeclaration(receiver, declaration))) {
    Checker_reportUnusedVariable(receiver, node, NewDiagnosticForNode(node, All_destructured_elements_are_unused));
  } else {
    Checker_reportUnusedVariableDeclarations(receiver, declarations);
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.checkUnusedRenamedBindingElements","kind":"method","status":"implemented","sigHash":"f889348068bd3340278d76c67ae38aa138de5cfe292db30af0747b6e41e48cf4","bodyHash":"5daebdc8cbf486a5a272ab9207c55ea59e84a404e14109bf7466e35300ececc5"}
 *
 * Go source:
 * func (c *Checker) checkUnusedRenamedBindingElements() {
 * 	for _, node := range c.renamedBindingElementsInTypes {
 * 		if c.symbolReferenceLinks.Get(c.getSymbolOfDeclaration(node)).referenceKinds == 0 {
 * 			wrappingDeclaration := ast.WalkUpBindingElementsAndPatterns(node)
 * 			debug.Assert(ast.IsPartOfParameterDeclaration(wrappingDeclaration), "Only parameter declaration should be checked here")
 * 			diagnostic := NewDiagnosticForNode(node.Name(), diagnostics.X_0_is_an_unused_renaming_of_1_Did_you_intend_to_use_it_as_a_type_annotation, scanner.DeclarationNameToString(node.Name()), scanner.DeclarationNameToString(node.PropertyName()))
 * 			if wrappingDeclaration.Type() == nil {
 * 				// entire parameter does not have type annotation, suggest adding an annotation
 * 				diagnostic.AddRelatedInfo(ast.NewDiagnostic(ast.GetSourceFileOfNode(wrappingDeclaration), core.NewTextRange(wrappingDeclaration.End(), wrappingDeclaration.End()), diagnostics.We_can_only_write_a_type_for_0_by_adding_a_type_for_the_entire_parameter_here, scanner.DeclarationNameToString(node.PropertyName())))
 * 			}
 * 			c.diagnostics.Add(diagnostic)
 * 		}
 * 	}
 * }
 */
export function Checker_checkUnusedRenamedBindingElements(receiver: GoPtr<Checker>): void {
  for (const node of receiver!.renamedBindingElementsInTypes) {
    const links = LinkStore_Get(receiver!.symbolReferenceLinks, Checker_getSymbolOfDeclaration(receiver, node)) as GoPtr<SymbolReferenceLinks>;
    if ((links!.referenceKinds ?? SymbolFlagsNone) === 0) {
      const wrappingDeclaration = WalkUpBindingElementsAndPatterns(node);
      Assert(IsPartOfParameterDeclaration(wrappingDeclaration), "Only parameter declaration should be checked here");
      const name = Node_Name(node);
      const propertyName = Node_PropertyName(node);
      const diagnostic = NewDiagnosticForNode(
        name,
        X_0_is_an_unused_renaming_of_1_Did_you_intend_to_use_it_as_a_type_annotation,
        DeclarationNameToString(name),
        DeclarationNameToString(propertyName),
      );
      if (Node_Type(wrappingDeclaration) === undefined) {
        Diagnostic_AddRelatedInfo(
          diagnostic,
          NewDiagnostic(
            GetSourceFileOfNode(wrappingDeclaration),
            NewTextRange(Node_End(wrappingDeclaration), Node_End(wrappingDeclaration)),
            We_can_only_write_a_type_for_0_by_adding_a_type_for_the_entire_parameter_here,
            DeclarationNameToString(propertyName),
          ),
        );
      }
      DiagnosticsCollection_Add(receiver!.diagnostics, diagnostic);
    }
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.checkWeakMapSetCollision","kind":"method","status":"implemented","sigHash":"bb7888e1a365ce23ba310b30d195d2c7c2eb8f74938e6962d0f135c3f952807a","bodyHash":"6e89d07f86b96b1f09b994c0ec4672a9e308f5250489aa231f9434cd6b7850c7"}
 *
 * Go source:
 * func (c *Checker) checkWeakMapSetCollision(node *ast.Node) {
 * 	enclosingBlockScope := ast.GetEnclosingBlockScopeContainer(node)
 * 	if c.nodeLinks.Get(enclosingBlockScope).flags&NodeCheckFlagsContainsClassWithPrivateIdentifiers != 0 {
 * 		name := node.Name()
 * 		if name != nil && ast.IsIdentifier(name) {
 * 			c.errorSkippedOnNoEmit(node, diagnostics.Compiler_reserves_name_0_when_emitting_private_identifier_downlevel, name.Text())
 * 		}
 * 	}
 * }
 */
export function Checker_checkWeakMapSetCollision(receiver: GoPtr<Checker>, node: GoPtr<Node>): void {
  const enclosingBlockScope = GetEnclosingBlockScopeContainer(node);
  if (((LinkStore_Get(receiver!.nodeLinks, enclosingBlockScope) as GoPtr<NodeLinks>)!.flags & NodeCheckFlagsContainsClassWithPrivateIdentifiers) !== 0) {
    const name = Node_Name(node);
    if (name !== undefined && IsIdentifier(name)) {
      Checker_errorSkippedOnNoEmit(receiver, node, Compiler_reserves_name_0_when_emitting_private_identifier_downlevel, Node_Text(name));
    }
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.checkReflectCollision","kind":"method","status":"implemented","sigHash":"ca71b7a9ade89378f0b429ad5f1d50853b1d96405dcdf923ab93edb7c3b08a5d","bodyHash":"e82080bf9c42ce416ca8516953760cfdb50a1c33432571918aa38283faae822f"}
 *
 * Go source:
 * func (c *Checker) checkReflectCollision(node *ast.Node) {
 * 	hasCollision := false
 * 	if ast.IsClassExpression(node) {
 * 		// ClassExpression names don't contribute to their containers, but do matter for any of their block-scoped members.
 * 		for _, member := range node.Members() {
 * 			if c.nodeLinks.Get(member).flags&NodeCheckFlagsContainsSuperPropertyInStaticInitializer != 0 {
 * 				hasCollision = true
 * 				break
 * 			}
 * 		}
 * 	} else if ast.IsFunctionExpression(node) {
 * 		// FunctionExpression names don't contribute to their containers, but do matter for their contents
 * 		if c.nodeLinks.Get(node).flags&NodeCheckFlagsContainsSuperPropertyInStaticInitializer != 0 {
 * 			hasCollision = true
 * 		}
 * 	} else {
 * 		container := ast.GetEnclosingBlockScopeContainer(node)
 * 		if container != nil && c.nodeLinks.Get(container).flags&NodeCheckFlagsContainsSuperPropertyInStaticInitializer != 0 {
 * 			hasCollision = true
 * 		}
 * 	}
 * 	if hasCollision {
 * 		name := node.Name()
 * 		if name != nil && ast.IsIdentifier(name) {
 * 			c.errorSkippedOnNoEmit(node, diagnostics.Duplicate_identifier_0_Compiler_reserves_name_1_when_emitting_super_references_in_static_initializers, scanner.DeclarationNameToString(name), "Reflect")
 * 		}
 * 	}
 * }
 */
export function Checker_checkReflectCollision(receiver: GoPtr<Checker>, node: GoPtr<Node>): void {
  let hasCollision: bool = false;
  if (IsClassExpression(node)) {
    for (const member of Node_Members(node) ?? []) {
      if (((LinkStore_Get(receiver!.nodeLinks, member) as GoPtr<NodeLinks>)!.flags & NodeCheckFlagsContainsSuperPropertyInStaticInitializer) !== 0) {
        hasCollision = true;
        break;
      }
    }
  } else if (IsFunctionExpression(node)) {
    if (((LinkStore_Get(receiver!.nodeLinks, node) as GoPtr<NodeLinks>)!.flags & NodeCheckFlagsContainsSuperPropertyInStaticInitializer) !== 0) {
      hasCollision = true;
    }
  } else {
    const container = GetEnclosingBlockScopeContainer(node);
    if (container !== undefined && ((LinkStore_Get(receiver!.nodeLinks, container) as GoPtr<NodeLinks>)!.flags & NodeCheckFlagsContainsSuperPropertyInStaticInitializer) !== 0) {
      hasCollision = true;
    }
  }
  if (hasCollision) {
    const name = Node_Name(node);
    if (name !== undefined && IsIdentifier(name)) {
      Checker_errorSkippedOnNoEmit(receiver, node, Duplicate_identifier_0_Compiler_reserves_name_1_when_emitting_super_references_in_static_initializers, Node_Text(name), "Reflect");
    }
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.checkThisBeforeSuper","kind":"method","status":"implemented","sigHash":"33f64a4439dba3e8f7c87fb48ad95dea955ae149e07cd41163a41ef7dc2ca2d4","bodyHash":"9083e934801ce3d0fd25b26e5fb2ed47d2c2f837401f9c1ecc500ac6c5b0cee2"}
 *
 * Go source:
 * func (c *Checker) checkThisBeforeSuper(node *ast.Node, container *ast.Node, diagnosticMessage *diagnostics.Message) {
 * 	containingClassDecl := container.Parent
 * 	baseTypeNode := ast.GetExtendsHeritageClauseElement(containingClassDecl)
 * 	// If a containing class does not have extends clause or the class extends null
 * 	// skip checking whether super statement is called before "this" accessing.
 * 	if baseTypeNode != nil && !c.classDeclarationExtendsNull(containingClassDecl) {
 * 		if node.FlowNodeData() != nil && !c.isPostSuperFlowNode(node.FlowNodeData().FlowNode, false /*noCacheCheck* /) {
 * 			c.error(node, diagnosticMessage)
 * 		}
 * 	}
 * }
 */
export function Checker_checkThisBeforeSuper(receiver: GoPtr<Checker>, node: GoPtr<Node>, container: GoPtr<Node>, diagnosticMessage: GoPtr<Message>): void {
  const containingClassDecl = container!.Parent;
  const baseTypeNode = GetExtendsHeritageClauseElement(containingClassDecl);
  if (baseTypeNode !== undefined && !Checker_classDeclarationExtendsNull(receiver, containingClassDecl)) {
    const flowNodeData = Node_FlowNodeData(node);
    const flowNode = (flowNodeData as { FlowNode?: GoPtr<FlowNode> } | undefined)?.FlowNode;
    if (flowNodeData !== undefined && !Checker_isPostSuperFlowNode(receiver, flowNode, false /*noCacheCheck*/)) {
      Checker_error(receiver, node, diagnosticMessage);
    }
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.checkAssertion","kind":"method","status":"implemented","sigHash":"8464743512d29959302858e3075f01cc43e601f1a4b21ef39b69bc0cb695c540","bodyHash":"0e4265dec98b4873e5dda43af1245699304bf0dc299be5ad20342e568c731852"}
 *
 * Go source:
 * func (c *Checker) checkAssertion(node *ast.Node, checkMode CheckMode) *Type {
 * 	if node.Kind == ast.KindTypeAssertionExpression {
 * 		if c.shouldCheckErasableSyntax(node) {
 * 			c.diagnostics.Add(ast.NewDiagnostic(ast.GetSourceFileOfNode(node), core.NewTextRange(scanner.SkipTrivia(ast.GetSourceFileOfNode(node).Text(), node.Pos()), node.Expression().Pos()), diagnostics.This_syntax_is_not_allowed_when_erasableSyntaxOnly_is_enabled))
 * 		}
 * 	}
 * 	typeNode := node.Type()
 * 	exprType := c.checkExpressionEx(node.Expression(), checkMode)
 * 	if isConstTypeReference(typeNode) {
 * 		if !c.isValidConstAssertionArgument(node.Expression()) {
 * 			c.error(node.Expression(), diagnostics.A_const_assertion_can_only_be_applied_to_references_to_enum_members_or_string_number_boolean_array_or_object_literals)
 * 		}
 * 		return c.getRegularTypeOfLiteralType(exprType)
 * 	}
 * 	links := c.assertionLinks.Get(node)
 * 	links.exprType = exprType
 * 	c.checkSourceElement(typeNode)
 * 	c.checkNodeDeferred(node)
 * 	return c.getTypeFromTypeNode(typeNode)
 * }
 */
export function Checker_checkAssertion(receiver: GoPtr<Checker>, node: GoPtr<Node>, checkMode: CheckMode): GoPtr<Type> {
  if (node!.Kind === KindTypeAssertionExpression) {
    if (Checker_shouldCheckErasableSyntax(receiver, node)) {
      const sourceFile = GetSourceFileOfNode(node);
      DiagnosticsCollection_Add(receiver!.diagnostics, NewDiagnostic(
        sourceFile,
        NewTextRange(SkipTrivia(SourceFile_Text(sourceFile), Node_Pos(node)), Node_Pos(Node_Expression(node))),
        This_syntax_is_not_allowed_when_erasableSyntaxOnly_is_enabled,
      ));
    }
  }
  const typeNode = Node_Type(node);
  const exprType = Checker_checkExpressionEx(receiver, Node_Expression(node), checkMode);
  if (isConstTypeReference(typeNode)) {
    if (!Checker_isValidConstAssertionArgument(receiver, Node_Expression(node))) {
      Checker_error(receiver, Node_Expression(node), A_const_assertion_can_only_be_applied_to_references_to_enum_members_or_string_number_boolean_array_or_object_literals);
    }
    return Checker_getRegularTypeOfLiteralType(receiver, exprType);
  }
  const links = LinkStore_Get(receiver!.assertionLinks, node) as GoPtr<AssertionLinks>;
  links!.exprType = exprType;
  Checker_checkSourceElement(receiver, typeNode);
  Checker_checkNodeDeferred(receiver, node);
  return Checker_getTypeFromTypeNode(receiver, typeNode);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.checkAssertionDeferred","kind":"method","status":"implemented","sigHash":"973986c5f4c38a69995010d50136da4ea65daa63e67317dca64da6668fe1478e","bodyHash":"c115a1f302f9fed0371ebbe0074d0264037323087907d6494f44ee0cbaa89d46"}
 *
 * Go source:
 * func (c *Checker) checkAssertionDeferred(node *ast.Node) {
 * 	typeNode := node.Type()
 * 	exprType := c.getRegularTypeOfObjectLiteral(c.getBaseTypeOfLiteralType(c.assertionLinks.Get(node).exprType))
 * 	targetType := c.getTypeFromTypeNode(typeNode)
 * 	if !c.isErrorType(targetType) {
 * 		widenedType := c.getWidenedType(exprType)
 * 		if !c.isTypeComparableTo(targetType, widenedType) {
 * 			errNode := node
 * 			if typeNode.Flags&ast.NodeFlagsReparsed != 0 {
 * 				errNode = typeNode
 * 			}
 * 			c.checkTypeComparableTo(exprType, targetType, errNode, diagnostics.Conversion_of_type_0_to_type_1_may_be_a_mistake_because_neither_type_sufficiently_overlaps_with_the_other_If_this_was_intentional_convert_the_expression_to_unknown_first)
 * 		}
 * 	}
 * }
 */
export function Checker_checkAssertionDeferred(receiver: GoPtr<Checker>, node: GoPtr<Node>): void {
  const typeNode = Node_Type(node);
  const exprType = Checker_getRegularTypeOfObjectLiteral(receiver, Checker_getBaseTypeOfLiteralType(receiver, (LinkStore_Get(receiver!.assertionLinks, node) as GoPtr<AssertionLinks>)!.exprType));
  const targetType = Checker_getTypeFromTypeNode(receiver, typeNode);
  if (!Checker_isErrorType(receiver, targetType)) {
    const widenedType = Checker_getWidenedType(receiver, exprType);
    if (!Checker_isTypeComparableTo(receiver, targetType, widenedType)) {
      let errNode = node;
      if ((typeNode!.Flags & NodeFlagsReparsed) !== 0) {
        errNode = typeNode;
      }
      Checker_checkTypeComparableTo(receiver, exprType, targetType, errNode, Conversion_of_type_0_to_type_1_may_be_a_mistake_because_neither_type_sufficiently_overlaps_with_the_other_If_this_was_intentional_convert_the_expression_to_unknown_first);
    }
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.checkNaNEquality","kind":"method","status":"implemented","sigHash":"b00c0bfa7bb79f26330352cb2040868edefdf7e36c98263438fd24e07eae377b","bodyHash":"b53e4176e9e5ebaefa236d598f7b0e05827ab38068187b8d3bc53c7d2328e752"}
 *
 * Go source:
 * func (c *Checker) checkNaNEquality(errorNode *ast.Node, operator ast.Kind, left *ast.Expression, right *ast.Expression) {
 * 	isLeftNaN := c.isGlobalNaN(ast.SkipParentheses(left))
 * 	isRightNaN := c.isGlobalNaN(ast.SkipParentheses(right))
 * 	if isLeftNaN || isRightNaN {
 * 		err := c.error(errorNode, diagnostics.This_condition_will_always_return_0, scanner.TokenToString(core.IfElse(operator == ast.KindEqualsEqualsEqualsToken || operator == ast.KindEqualsEqualsToken, ast.KindFalseKeyword, ast.KindTrueKeyword)))
 * 		if isLeftNaN && isRightNaN {
 * 			return
 * 		}
 * 		var operatorString string
 * 		if operator == ast.KindExclamationEqualsEqualsToken || operator == ast.KindExclamationEqualsToken {
 * 			operatorString = scanner.TokenToString(ast.KindExclamationToken)
 * 		}
 * 		location := left
 * 		if isLeftNaN {
 * 			location = right
 * 		}
 * 		expression := ast.SkipParentheses(location)
 * 		entityName := "..."
 * 		if ast.IsEntityNameExpression(expression) {
 * 			entityName = entityNameToString(expression)
 * 		}
 * 		suggestion := operatorString + "Number.isNaN(" + entityName + ")"
 * 		err.AddRelatedInfo(createDiagnosticForNode(location, diagnostics.Did_you_mean_0, suggestion))
 * 	}
 * }
 */
export function Checker_checkNaNEquality(receiver: GoPtr<Checker>, errorNode: GoPtr<Node>, operator: Kind, left: GoPtr<Expression>, right: GoPtr<Expression>): void {
  const isLeftNaN = Checker_isGlobalNaN(receiver, SkipParentheses(left as GoPtr<Node>) as GoPtr<Expression>);
  const isRightNaN = Checker_isGlobalNaN(receiver, SkipParentheses(right as GoPtr<Node>) as GoPtr<Expression>);
  if (isLeftNaN || isRightNaN) {
    const err = Checker_error(
      receiver,
      errorNode,
      This_condition_will_always_return_0,
      TokenToString(operator === KindEqualsEqualsEqualsToken || operator === KindEqualsEqualsToken ? KindFalseKeyword : KindTrueKeyword),
    );
    if (isLeftNaN && isRightNaN) {
      return;
    }
    let operatorString = "";
    if (operator === KindExclamationEqualsEqualsToken || operator === KindExclamationEqualsToken) {
      operatorString = TokenToString(KindExclamationToken);
    }
    let location = left as GoPtr<Node>;
    if (isLeftNaN) {
      location = right as GoPtr<Node>;
    }
    const expression = SkipParentheses(location);
    let entityName = "...";
    if (IsEntityNameExpression(expression)) {
      entityName = entityNameToString(expression);
    }
    const suggestion = operatorString + "Number.isNaN(" + entityName + ")";
    Diagnostic_AddRelatedInfo(err, createDiagnosticForNode(location, Did_you_mean_0, suggestion));
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.error","kind":"method","status":"implemented","sigHash":"a1b3e7b0921a4a0464969d9cacee61da47b0195b35a5116cc39b62275a55e276","bodyHash":"d0185defd00c938f3571af313af18b28c25422bfe615014e7b42caddd3ce7596"}
 *
 * Go source:
 * func (c *Checker) error(location *ast.Node, message *diagnostics.Message, args ...any) *ast.Diagnostic {
 * 	diagnostic := NewDiagnosticForNode(location, message, args...)
 * 	c.diagnostics.Add(diagnostic)
 * 	return diagnostic
 * }
 */
export function Checker_error(receiver: GoPtr<Checker>, location: GoPtr<Node>, message: GoPtr<Message>, ...args: Array<unknown>): GoPtr<Diagnostic> {
  const diagnostic = NewDiagnosticForNode(location, message, ...args);
  DiagnosticsCollection_Add(receiver!.diagnostics, diagnostic);
  return diagnostic;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.errorSkippedOnNoEmit","kind":"method","status":"implemented","sigHash":"eccf4deda6506c03ac1cd814106663bb77ea66de5f93cb7bf6f7b406f463d2be","bodyHash":"71393a7fc60e9de9b5ec25e754804e405bb4572c4cc09cebfe29abf835d75982"}
 *
 * Go source:
 * func (c *Checker) errorSkippedOnNoEmit(location *ast.Node, message *diagnostics.Message, args ...any) *ast.Diagnostic {
 * 	diagnostic := c.error(location, message, args...)
 * 	diagnostic.SetSkippedOnNoEmit()
 * 	return diagnostic
 * }
 */
export function Checker_errorSkippedOnNoEmit(receiver: GoPtr<Checker>, location: GoPtr<Node>, message: GoPtr<Message>, ...args: Array<unknown>): GoPtr<Diagnostic> {
  const diagnostic = Checker_error(receiver, location, message, ...args);
  Diagnostic_SetSkippedOnNoEmit(diagnostic);
  return diagnostic;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.errorOrSuggestion","kind":"method","status":"implemented","sigHash":"71dbc475f4dde8bddb12c0eece37fdb596119300f9162c2e631a818d5e676fee","bodyHash":"5cba5302220b40779cacbff7a6e2a7698097b7d83001e8623a27a6759468b357"}
 *
 * Go source:
 * func (c *Checker) errorOrSuggestion(isError bool, location *ast.Node, message *diagnostics.Message, args ...any) {
 * 	c.addErrorOrSuggestion(isError, NewDiagnosticForNode(location, message, args...))
 * }
 */
export function Checker_errorOrSuggestion(receiver: GoPtr<Checker>, isError: bool, location: GoPtr<Node>, message: GoPtr<Message>, ...args: Array<unknown>): void {
  Checker_addErrorOrSuggestion(receiver, isError, NewDiagnosticForNode(location, message, ...args));
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.canHaveSyntheticDefault","kind":"method","status":"implemented","sigHash":"80232f30dcc21464113deb4491dc5aea86d8acf7817387f46f61eb14b16d241c","bodyHash":"4e4e0dddf6751d96bf5b6715322c995a9df8bfea22868307c85219ab7a6d0550"}
 *
 * Go source:
 * func (c *Checker) canHaveSyntheticDefault(file *ast.Node, moduleSymbol *ast.Symbol, dontResolveAlias bool, usage *ast.Node) bool {
 * 	var usageMode core.ResolutionMode
 * 	if file != nil {
 * 		usageMode = c.getEmitSyntaxForModuleSpecifierExpression(usage)
 * 	}
 * 	if file != nil && usageMode != core.ModuleKindNone {
 * 		targetMode := c.program.GetImpliedNodeFormatForEmit(file.AsSourceFile())
 * 		if usageMode == core.ModuleKindESNext && targetMode == core.ModuleKindCommonJS && core.ModuleKindNode16 <= c.moduleKind && c.moduleKind <= core.ModuleKindNodeNext {
 * 			// In Node.js, CommonJS modules always have a synthetic default when imported into ESM
 * 			return true
 * 		}
 * 		if usageMode == core.ModuleKindESNext && targetMode == core.ModuleKindESNext {
 * 			// No matter what the `module` setting is, if we're confident that both files
 * 			// are ESM, there cannot be a synthetic default.
 * 			return false
 * 		}
 * 		// For other files (not node16/nodenext with impliedNodeFormat), check if we can determine
 * 		// the module format from project references
 * 		if targetMode == core.ModuleKindNone && file.AsSourceFile().IsDeclarationFile {
 * 			// Try to get the project reference - try both source file mapping and output file mapping
 * 			// since declaration files can be mapped either way depending on how they're resolved
 * 			if c.program.GetRedirectForResolution(file.AsSourceFile()) != nil || c.program.GetProjectReferenceFromOutputDts(file.AsSourceFile().Path()) != nil {
 * 				// This is a declaration file from a project reference, so we can determine
 * 				// its module format from the referenced project's options
 * 				targetModuleKind := c.program.GetEmitModuleFormatOfFile(file.AsSourceFile())
 * 				if usageMode == core.ModuleKindESNext && core.ModuleKindES2015 <= targetModuleKind && targetModuleKind <= core.ModuleKindESNext {
 * 					return false
 * 				}
 * 			}
 * 		}
 * 	}
 * 	// Declaration files (and ambient modules)
 * 	if file == nil || file.AsSourceFile().IsDeclarationFile {
 * 		// Definitely cannot have a synthetic default if they have a syntactic default member specified
 * 		defaultExportSymbol := c.resolveExportByName(moduleSymbol, ast.InternalSymbolNameDefault /*sourceNode* /, nil /*dontResolveAlias* /, true) // Dont resolve alias because we want the immediately exported symbol's declaration
 * 		if defaultExportSymbol != nil && core.Some(defaultExportSymbol.Declarations, isSyntacticDefault) {
 * 			return false
 * 		}
 * 		// It _might_ still be incorrect to assume there is no __esModule marker on the import at runtime, even if there is no `default` member
 * 		// So we check a bit more,
 * 		if c.resolveExportByName(moduleSymbol, "__esModule", nil /*sourceNode* /, dontResolveAlias) != nil {
 * 			// If there is an `__esModule` specified in the declaration (meaning someone explicitly added it or wrote it in their code),
 * 			// it definitely is a module and does not have a synthetic default
 * 			return false
 * 		}
 * 		// There are _many_ declaration files not written with esmodules in mind that still get compiled into a format with __esModule set
 * 		// Meaning there may be no default at runtime - however to be on the permissive side, we allow access to a synthetic default member
 * 		// as there is no marker to indicate if the accompanying JS has `__esModule` or not, or is even native esm
 * 		return true
 * 	}
 * 	// TypeScript files never have a synthetic default (as they are always emitted with an __esModule marker) _unless_ they contain an export= statement
 * 	if !ast.IsInJSFile(file) {
 * 		return hasExportAssignmentSymbol(moduleSymbol)
 * 	}
 * 
 * 	// JS files have a synthetic default if they do not contain ES2015+ module syntax (export = is not valid in js) _and_ do not have an __esModule marker
 * 	return (file.AsSourceFile().ExternalModuleIndicator == nil || file.AsSourceFile().ExternalModuleIndicator == file) && c.resolveExportByName(moduleSymbol, "__esModule", nil /*sourceNode* /, dontResolveAlias) == nil
 * }
 */
export function Checker_canHaveSyntheticDefault(receiver: GoPtr<Checker>, file: GoPtr<Node>, moduleSymbol: GoPtr<Symbol>, dontResolveAlias: bool, usage: GoPtr<Node>): bool {
  const c = receiver!;
  const sourceFile = file === undefined ? undefined : AsSourceFile(file);
  let usageMode = ModuleKindNone;
  if (sourceFile !== undefined) {
    usageMode = Checker_getEmitSyntaxForModuleSpecifierExpression(receiver, usage);
  }
  if (sourceFile !== undefined && usageMode !== ModuleKindNone) {
    const sourceFileName = NewHasFileName(SourceFile_FileName(sourceFile), SourceFile_Path(sourceFile));
    const targetMode = c.program.GetImpliedNodeFormatForEmit(sourceFileName);
    if (usageMode === ModuleKindESNext && targetMode === ModuleKindCommonJS && ModuleKindNode16 <= c.moduleKind && c.moduleKind <= ModuleKindNodeNext) {
      return true;
    }
    if (usageMode === ModuleKindESNext && targetMode === ModuleKindESNext) {
      return false;
    }
    if (targetMode === ModuleKindNone && sourceFile.IsDeclarationFile) {
      if (c.program.GetRedirectForResolution(sourceFileName) !== undefined || c.program.GetProjectReferenceFromOutputDts(SourceFile_Path(sourceFile)) !== undefined) {
        const targetModuleKind = c.program.GetEmitModuleFormatOfFile(sourceFileName);
        if (usageMode === ModuleKindESNext && ModuleKindES2015 <= targetModuleKind && targetModuleKind <= ModuleKindESNext) {
          return false;
        }
      }
    }
  }
  if (sourceFile === undefined || sourceFile.IsDeclarationFile) {
    const defaultExportSymbol = Checker_resolveExportByName(receiver, moduleSymbol, InternalSymbolNameDefault, undefined, true as bool);
    if (defaultExportSymbol !== undefined && Some(defaultExportSymbol!.Declarations, isSyntacticDefault)) {
      return false;
    }
    if (Checker_resolveExportByName(receiver, moduleSymbol, "__esModule", undefined, dontResolveAlias) !== undefined) {
      return false;
    }
    return true;
  }
  if (!IsInJSFile(file)) {
    return hasExportAssignmentSymbol(moduleSymbol);
  }
  return ((sourceFile.ExternalModuleIndicator === undefined || sourceFile.ExternalModuleIndicator === file) &&
    Checker_resolveExportByName(receiver, moduleSymbol, "__esModule", undefined, dontResolveAlias) === undefined) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::CacheHashKey.IsZero","kind":"method","status":"implemented","sigHash":"ac1a5c1faca99b9a97e6772498eab9bc1349ba8c98bf3dacab2b2f77c66c86ea","bodyHash":"90031db923a48be39fb2e01727e39a91e077521e7bdb81cccad6846cbc82bb37"}
 *
 * Go source:
 * func (k CacheHashKey) IsZero() bool {
 * 	return xxh3.Uint128(k) == xxh3.Uint128{}
 * }
 */
export function CacheHashKey_IsZero(receiver: CacheHashKey): bool {
  // Go zero value of CacheHashKey (xxh3.Uint128{}); the string port's zero
  // value is the empty/unset string. Real hashes are always 32 hex chars.
  return receiver === undefined || receiver === "";
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::keyBuilder.writeByte","kind":"method","status":"implemented","sigHash":"fc12495863b0fd20991d4ebc290cc639d805be5af031695c424cf49059909a06","bodyHash":"ebf03d0a97ceb51b4985ad169f26de74ad220a93746b1584fde9148971658cf6"}
 *
 * Go source:
 * func (b *keyBuilder) writeByte(c byte) {
 * 	_, _ = b.h.Write([]byte{c})
 * }
 */
export function keyBuilder_writeByte(receiver: GoPtr<keyBuilder>, c: byte): void {
  receiver!.h.Write([c]);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::keyBuilder.writeString","kind":"method","status":"implemented","sigHash":"95571fcfb2a8b2695b7b921db1bd622beda7b1524e7d968ef4cf63b0ad3ec5ed","bodyHash":"8f6c6e72fd1ec0edb3a6c2274538756757d912411c0b5f4611de32d82b534c1c"}
 *
 * Go source:
 * func (b *keyBuilder) writeString(s string) {
 * 	_, _ = b.h.WriteString(s)
 * }
 */
export function keyBuilder_writeString(receiver: GoPtr<keyBuilder>, s: string): void {
  receiver!.h.WriteString(s);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::keyBuilder.writeInt","kind":"method","status":"implemented","sigHash":"6a27d4019053a9b9464c4ad39c418c4839cd67fe9c32baacce7edcdd9f464b4f","bodyHash":"08f3854fb5ab326842de4bedce29a4504dd8e57bf226152899fe5782217ea994"}
 *
 * Go source:
 * func (b *keyBuilder) writeInt(value int) {
 * 	hashWrite64(&b.h, value)
 * }
 */
export function keyBuilder_writeInt(receiver: GoPtr<keyBuilder>, value: int): void {
  let v = BigInt(globalThis.Math.trunc(value)) & ((1n << 64n) - 1n);
  const bytes: GoSlice<byte> = [];
  for (let index = 0; index < 8; index++) {
    bytes.push(Number(v & 0xffn) as byte);
    v >>= 8n;
  }
  receiver!.h.Write(bytes);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.findMixins","kind":"method","status":"implemented","sigHash":"bdbf82c863f236f77744213ba95ed37ac81771c71d6160dbb69739a2d532f478","bodyHash":"875051043bc97210c4528d673bd99af57d1e2d53aa4e5bbe173654ea2f6d621e"}
 *
 * Go source:
 * func (c *Checker) findMixins(types []*Type) ([]bool, int) {
 * 	mixinFlags := core.Map(types, c.isMixinConstructorType)
 * 	var constructorTypeCount, mixinCount int
 * 	firstMixinIndex := -1
 * 	for i, t := range types {
 * 		if len(c.getSignaturesOfType(t, SignatureKindConstruct)) > 0 {
 * 			constructorTypeCount++
 * 		}
 * 		if mixinFlags[i] {
 * 			if firstMixinIndex < 0 {
 * 				firstMixinIndex = i
 * 			}
 * 			mixinCount++
 * 		}
 * 	}
 * 	if constructorTypeCount > 0 && constructorTypeCount == mixinCount {
 * 		mixinFlags[firstMixinIndex] = false
 * 		mixinCount--
 * 	}
 * 	return mixinFlags, mixinCount
 * }
 */
export function Checker_findMixins(receiver: GoPtr<Checker>, types: GoSlice<GoPtr<Type>>): [GoSlice<bool>, int] {
  const mixinFlags = Map(types, (t: GoPtr<Type>): bool => Checker_isMixinConstructorType(receiver, t));
  let constructorTypeCount = 0;
  let mixinCount = 0;
  let firstMixinIndex = -1;
  for (let i = 0; i < types.length; i++) {
    const t = types[i];
    if (Checker_getSignaturesOfType(receiver, t, SignatureKindConstruct).length > 0) {
      constructorTypeCount++;
    }
    if (mixinFlags[i]) {
      if (firstMixinIndex < 0) {
        firstMixinIndex = i;
      }
      mixinCount++;
    }
  }
  if (constructorTypeCount > 0 && constructorTypeCount === mixinCount) {
    mixinFlags[firstMixinIndex] = false;
    mixinCount--;
  }
  return [mixinFlags, mixinCount];
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.symbolIsValue","kind":"method","status":"implemented","sigHash":"3679edde4f705b718f1763ecab39b4c4b5c48a0ddf616d617f2b9178fdf86661","bodyHash":"3394a62fb49e253e435824e1291c66be6f02e8635202a06c4f5042ff0a0f8bfd"}
 *
 * Go source:
 * func (c *Checker) symbolIsValue(symbol *ast.Symbol) bool {
 * 	return c.symbolIsValueEx(symbol, false /*includeTypeOnlyMembers* /)
 * }
 */
export function Checker_symbolIsValue(receiver: GoPtr<Checker>, symbol_: GoPtr<Symbol>): bool {
  return Checker_symbolIsValueEx(receiver, symbol_, false /*includeTypeOnlyMembers*/);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.symbolIsValueEx","kind":"method","status":"implemented","sigHash":"b03686c80f420fe22dc9b2903a30fcbeff743c2310e91ca6d1f6983624e5ef46","bodyHash":"7462b7d1c3165216c6077c1eeeac583d063ba43f009a0b0a4a09bcf200314267"}
 *
 * Go source:
 * func (c *Checker) symbolIsValueEx(symbol *ast.Symbol, includeTypeOnlyMembers bool) bool {
 * 	return symbol.Flags&ast.SymbolFlagsValue != 0 || symbol.Flags&ast.SymbolFlagsAlias != 0 &&
 * 		c.getSymbolFlagsEx(symbol, !includeTypeOnlyMembers, false /*excludeLocalMeanings* /)&ast.SymbolFlagsValue != 0
 * }
 */
export function Checker_symbolIsValueEx(receiver: GoPtr<Checker>, symbol_: GoPtr<Symbol>, includeTypeOnlyMembers: bool): bool {
  return (symbol_!.Flags & SymbolFlagsValue) !== 0 || ((symbol_!.Flags & SymbolFlagsAlias) !== 0 &&
    (Checker_getSymbolFlagsEx(receiver, symbol_, !includeTypeOnlyMembers, false /*excludeLocalMeanings*/) & SymbolFlagsValue) !== 0);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.evaluateEntity","kind":"method","status":"implemented","sigHash":"793c899a55517825eeaad08d1faf5db58abe6868b30521803c4be00adf565e33","bodyHash":"38d996c3a08392145692111537aa13fe64ce176807e87c7be0825d0037bbf5a9"}
 *
 * Go source:
 * func (c *Checker) evaluateEntity(expr *ast.Node, location *ast.Node) evaluator.Result {
 * 	switch expr.Kind {
 * 	case ast.KindIdentifier, ast.KindPropertyAccessExpression:
 * 		symbol := c.resolveEntityName(expr, ast.SymbolFlagsValue, true /*ignoreErrors* /, false, nil)
 * 		if symbol == nil {
 * 			return evaluator.NewResult(nil, false, false, false)
 * 		}
 * 		if expr.Kind == ast.KindIdentifier {
 * 			if ast.IsInfinityOrNaNString(expr.Text()) && (symbol == c.getGlobalSymbol(expr.Text(), ast.SymbolFlagsValue, nil /*diagnostic* /)) {
 * 				// Technically we resolved a global lib file here, but the decision to treat this as numeric
 * 				// is more predicated on the fact that the single-file resolution *didn't* resolve to a
 * 				// different meaning of `Infinity` or `NaN`. Transpilers handle this no problem.
 * 				return evaluator.NewResult(jsnum.FromString(expr.Text()), false, false, false)
 * 			}
 * 		}
 * 		if symbol.Flags&ast.SymbolFlagsEnumMember != 0 {
 * 			if location != nil {
 * 				return c.evaluateEnumMember(expr, symbol, location)
 * 			}
 * 			return c.getEnumMemberValue(symbol.ValueDeclaration)
 * 		}
 * 		if c.isConstantVariable(symbol) {
 * 			declaration := symbol.ValueDeclaration
 * 			if declaration != nil && ast.IsVariableDeclaration(declaration) && declaration.Type() == nil && declaration.Initializer() != nil &&
 * 				(location == nil || declaration != location && c.isBlockScopedNameDeclaredBeforeUse(declaration, location)) {
 * 				result := c.evaluate(declaration.Initializer(), declaration)
 * 				if location != nil && ast.GetSourceFileOfNode(location) != ast.GetSourceFileOfNode(declaration) {
 * 					return evaluator.NewResult(result.Value, false, true, true)
 * 				}
 * 				return evaluator.NewResult(result.Value, result.IsSyntacticallyString, result.ResolvedOtherFiles, true /*hasExternalReferences* /)
 * 			}
 * 		}
 * 		return evaluator.NewResult(nil, false, false, false)
 * 	case ast.KindElementAccessExpression:
 * 		root := expr.Expression()
 * 		if ast.IsEntityNameExpression(root) && ast.IsStringLiteralLike(expr.AsElementAccessExpression().ArgumentExpression) {
 * 			rootSymbol := c.resolveEntityName(root, ast.SymbolFlagsValue, true /*ignoreErrors* /, false, nil)
 * 			if rootSymbol != nil && rootSymbol.Flags&ast.SymbolFlagsEnum != 0 {
 * 				name := expr.AsElementAccessExpression().ArgumentExpression.Text()
 * 				member := rootSymbol.Exports[name]
 * 				if member != nil {
 * 					if location != nil {
 * 						return c.evaluateEnumMember(expr, member, location)
 * 					}
 * 					return c.getEnumMemberValue(member.ValueDeclaration)
 * 				}
 * 			}
 * 		}
 * 		return evaluator.NewResult(nil, false, false, false)
 * 	}
 * 	panic("Unhandled case in evaluateEntity")
 * }
 */
export function Checker_evaluateEntity(receiver: GoPtr<Checker>, expr: GoPtr<Node>, location: GoPtr<Node>): Result {
  switch (expr!.Kind) {
    case KindIdentifier:
    case KindPropertyAccessExpression: {
      const symbol_ = Checker_resolveEntityName(receiver, expr, SymbolFlagsValue, true as bool, false as bool, undefined);
      if (symbol_ === undefined) {
        return NewResult(undefined, false as bool, false as bool, false as bool);
      }
      if (expr!.Kind === KindIdentifier) {
        if (IsInfinityOrNaNString(Node_Text(expr)) && symbol_ === Checker_getGlobalSymbol(receiver, Node_Text(expr), SymbolFlagsValue, undefined)) {
          return NewResult(FromString(Node_Text(expr)), false as bool, false as bool, false as bool);
        }
      }
      if ((symbol_!.Flags & SymbolFlagsEnumMember) !== 0) {
        if (location !== undefined) {
          return Checker_evaluateEnumMember(receiver, expr, symbol_, location);
        }
        return Checker_getEnumMemberValue(receiver, symbol_!.ValueDeclaration);
      }
      if (Checker_isConstantVariable(receiver, symbol_)) {
        const declaration = symbol_!.ValueDeclaration;
        if (
          declaration !== undefined &&
          IsVariableDeclaration(declaration) &&
          Node_Type(declaration) === undefined &&
          Node_Initializer(declaration) !== undefined &&
          (location === undefined || (declaration !== location && Checker_isBlockScopedNameDeclaredBeforeUse(receiver, declaration, location)))
        ) {
          const result = receiver!.evaluate(Node_Initializer(declaration), declaration);
          if (location !== undefined && GetSourceFileOfNode(location) !== GetSourceFileOfNode(declaration)) {
            return NewResult(result.Value, false as bool, true as bool, true as bool);
          }
          return NewResult(result.Value, result.IsSyntacticallyString, result.ResolvedOtherFiles, true as bool);
        }
      }
      return NewResult(undefined, false as bool, false as bool, false as bool);
    }
    case KindElementAccessExpression: {
      const root = Node_Expression(expr);
      const argumentExpression = AsElementAccessExpression(expr)!.ArgumentExpression;
      if (IsEntityNameExpression(root) && IsStringLiteralLike(argumentExpression)) {
        const rootSymbol = Checker_resolveEntityName(receiver, root, SymbolFlagsValue, true as bool, false as bool, undefined);
        if (rootSymbol !== undefined && (rootSymbol!.Flags & SymbolFlagsEnum) !== 0) {
          const name = Node_Text(argumentExpression);
          const member = rootSymbol!.Exports?.get(name);
          if (member !== undefined) {
            if (location !== undefined) {
              return Checker_evaluateEnumMember(receiver, expr, member, location);
            }
            return Checker_getEnumMemberValue(receiver, member!.ValueDeclaration);
          }
        }
      }
      return NewResult(undefined, false as bool, false as bool, false as bool);
    }
  }
  throw new globalThis.Error("Unhandled case in evaluateEntity");
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.compareProperties","kind":"method","status":"implemented","sigHash":"2b1210c14cc57ff655b13d795825b79d727c16e52325cc535a1fd45dbc33494c","bodyHash":"8a6cbe97379645d2a7e4a142d3acaa56e0511dd3047c4e7bb73e908256e00956"}
 *
 * Go source:
 * func (c *Checker) compareProperties(sourceProp *ast.Symbol, targetProp *ast.Symbol, compareTypes func(source *Type, target *Type) Ternary) Ternary {
 * 	// Two members are considered identical when
 * 	// - they are public properties with identical names, optionality, and types,
 * 	// - they are private or protected properties originating in the same declaration and having identical types
 * 	if sourceProp == targetProp {
 * 		return TernaryTrue
 * 	}
 * 	sourcePropAccessibility := getDeclarationModifierFlagsFromSymbol(sourceProp) & ast.ModifierFlagsNonPublicAccessibilityModifier
 * 	targetPropAccessibility := getDeclarationModifierFlagsFromSymbol(targetProp) & ast.ModifierFlagsNonPublicAccessibilityModifier
 * 	if sourcePropAccessibility != targetPropAccessibility {
 * 		return TernaryFalse
 * 	}
 * 	if sourcePropAccessibility != ast.ModifierFlagsNone {
 * 		if c.getTargetSymbol(sourceProp) != c.getTargetSymbol(targetProp) {
 * 			return TernaryFalse
 * 		}
 * 	} else {
 * 		if (sourceProp.Flags & ast.SymbolFlagsOptional) != (targetProp.Flags & ast.SymbolFlagsOptional) {
 * 			return TernaryFalse
 * 		}
 * 	}
 * 	if c.isReadonlySymbol(sourceProp) != c.isReadonlySymbol(targetProp) {
 * 		return TernaryFalse
 * 	}
 * 	return compareTypes(c.getNonMissingTypeOfSymbol(sourceProp), c.getNonMissingTypeOfSymbol(targetProp))
 * }
 */
export function Checker_compareProperties(receiver: GoPtr<Checker>, sourceProp: GoPtr<Symbol>, targetProp: GoPtr<Symbol>, compareTypes: (source: GoPtr<Type>, target: GoPtr<Type>) => Ternary): Ternary {
  // Two members are considered identical when
  // - they are public properties with identical names, optionality, and types,
  // - they are private or protected properties originating in the same declaration and having identical types
  if (sourceProp === targetProp) {
    return TernaryTrue;
  }
  const sourcePropAccessibility = getDeclarationModifierFlagsFromSymbol(sourceProp) & ModifierFlagsNonPublicAccessibilityModifier;
  const targetPropAccessibility = getDeclarationModifierFlagsFromSymbol(targetProp) & ModifierFlagsNonPublicAccessibilityModifier;
  if (sourcePropAccessibility !== targetPropAccessibility) {
    return TernaryFalse;
  }
  if (sourcePropAccessibility !== ModifierFlagsNone) {
    if (Checker_getTargetSymbol(receiver, sourceProp) !== Checker_getTargetSymbol(receiver, targetProp)) {
      return TernaryFalse;
    }
  } else {
    if ((sourceProp!.Flags & SymbolFlagsOptional) !== (targetProp!.Flags & SymbolFlagsOptional)) {
      return TernaryFalse;
    }
  }
  if (Checker_isReadonlySymbol(receiver, sourceProp) !== Checker_isReadonlySymbol(receiver, targetProp)) {
    return TernaryFalse;
  }
  return compareTypes(Checker_getNonMissingTypeOfSymbol(receiver, sourceProp), Checker_getNonMissingTypeOfSymbol(receiver, targetProp));
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.GetEmitResolver","kind":"method","status":"implemented","sigHash":"d72845b5f723508c7b6d66847c6598449bca7bb43bab7e4837a745464993f86c","bodyHash":"27e58a94ababc2542166185255bb1cc1cb419a356f6744098698b79b994ab63d"}
 *
 * Go source:
 * func (c *Checker) GetEmitResolver() *EmitResolver {
 * 	c.emitResolverOnce.Do(func() {
 * 		c.emitResolver = newEmitResolver(c)
 * 	})
 * 
 * 	return c.emitResolver
 * }
 */
export function Checker_GetEmitResolver(receiver: GoPtr<Checker>): GoPtr<EmitResolver> {
  receiver!.emitResolverOnce.Do((): void => {
    receiver!.emitResolver = newEmitResolver(receiver);
  });

  return receiver!.emitResolver;
}
