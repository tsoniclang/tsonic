import type { bool, int } from "../../../go/scalars.js";
import type { GoPtr, GoSlice, GoMap } from "../../../go/compat.js";
import { recordExtensionOperatorResolution } from "../../../extensions/checker-integration.js";
import type { Context } from "../../../go/context.js";
import { Node_AsNode, Node_Pos, Node_End, Node_Name, Node_BodyData } from "../../ast/spine.js";
import type { Node } from "../../ast/spine.js";
import { Contains as slicesContains } from "../../../go/slices.js";
import {
  AsBinaryExpression, AsSyntheticExpression, AsIfStatement, AsForStatement,
  AsForInOrOfStatement, AsSwitchStatement, AsTryStatement, AsCatchClause,
  AsLabeledStatement, AsCaseOrDefaultClause, AsCaseBlock, AsVariableStatement,
  AsVariableDeclarationList, AsPrefixUnaryExpression, AsPostfixUnaryExpression,
  AsYieldExpression, AsConditionalExpression, AsNumericLiteral, AsBigIntLiteral,
} from "../../ast/generated/casts.js";
import { NewSyntheticExpression } from "../../ast/generated/factory.js";
import type { Expression } from "../../ast/generated/unions.js";
import { NodeFlagsAwaitContext, NodeFlagsOptionalChain, NodeFlagsUnreachable } from "../../ast/generated/flags.js";
import type { NodeFlags } from "../../ast/generated/flags.js";
import { Diagnostic_AddRelatedInfo, Diagnostic_Code, Diagnostic_Loc } from "../../ast/diagnostic.js";
import type { Diagnostic } from "../../ast/diagnostic.js";
import type { NodeId } from "../../ast/ids.js";
import { Node_Locals, SourceFile_Text, SourceFile_Diagnostics, Node_Expression, Node_Statements, Node_Statement, Node_Initializer, Node_Type, Node_Text, Node_Label, Node_Body, Node_TypeParameters, Node_TypeArguments, AsSourceFile } from "../../ast/ast.js";
import type { SourceFile } from "../../ast/ast.js";
import type { Symbol } from "../../ast/symbol.js";
import type { Message } from "../../diagnostics/diagnostics.js";
import type { Relation } from "../relater.js";
import type { Signature, Type, TypeFlags } from "../types.js";
import { SignatureFlagsAbstract, SignatureFlagsNone, SignatureKindCall, SignatureKindConstruct } from "../types.js";
import { Checker_isIteratorResult } from "./support-queries.js";
import {
  CheckModeInferential, CheckModeNormal, InferenceFlagsSkippedGenericFunction, IterationTypeKindReturn, IterationTypeKindYield,
  IterationTypeKindNext, IterationUseForOf, IterationUseForAwaitOf, IterationUseSpread,
  IterationUseYieldStar, IterationUseAsyncYieldStar,
  TypeFactsIsUndefined, TypeFactsTruthy, TypeFactsFalsy, UnusedKindLocal, UnusedKindParameter,
  Checker_getSourceFileLinks, someSignature,
} from "./state.js";
import type { Checker, CheckMode, keyBuilder, FlowLoopInfo, IterationTypes } from "./state.js";
import {
  IsEmptyStatement, IsVariableDeclarationList,
  IsArrowFunction, IsComputedPropertyName,
  IsJsxAttributes, IsJsxSelfClosingElement,
  IsIdentifier, IsArrayLiteralExpression, IsObjectLiteralExpression,
  IsPropertyAccessExpression, IsPrivateIdentifier, IsConstructorDeclaration,
  IsSetAccessorDeclaration, IsBlock, IsParameterDeclaration,
  IsBindingElement, IsClassStaticBlockDeclaration, IsCaseClause, IsDefaultClause, IsParenthesizedExpression,
  IsLabeledStatement, IsConditionalExpression, IsBinaryExpression, IsSourceFile, IsLogicalOrCoalescingAssignmentOperator,
} from "../../ast/generated/predicates.js";
import {
  GetSourceFileOfNode, IsExternalOrCommonJSModule,
  IsFunctionOrModuleBlock, IsInstanceOfExpression, IsAccessExpression, IsClassLike,
  IsBindingPattern, SkipParentheses, SkipOuterExpressions, IsInJSFile,
  OEKParentheses, OEKSatisfies, OEKExcludeJSDocTypeAssertion,
  OEKAssertions, GetCombinedNodeFlags, IsFunctionLike,
  GetNodeId, ForEachReturnStatement, GetClassLikeDeclarationOfSymbol, HasModifier,
  FindAncestor, FindAncestorOrQuit, FindAncestorFalse, FindAncestorTrue, FindAncestorQuit, GetContainingClass, IsCallLikeExpression, IsCallOrNewExpression,
  GetContainingFunction, IsImportCall, IsLogicalBinaryOperator, IsLogicalOrCoalescingBinaryExpression, IsLogicalOrCoalescingBinaryOperator, WalkUpParenthesizedExpressions,
  GetExtendsHeritageClauseElement, GetEnclosingBlockScopeContainer, NodeKindIs, IsStatic,
} from "../../ast/utilities.js";
import type { OuterExpressionKinds } from "../../ast/utilities.js";
import { FunctionFlagsAsync, FunctionFlagsGenerator, FunctionFlagsInvalid, GetFunctionFlags } from "../../ast/functionflags.js";
import { ModifierFlagsAbstract } from "../../ast/modifierflags.js";
import { ScriptTargetES2016, ScriptTargetES2021, CompilerOptions_GetUseDefineForClassFields } from "../../core/compileroptions.js";
import { Checker_checkExternalEmitHelpers } from "../checker.js";
import { LanguageFeatureMinimumTarget, ExternalEmitHelpersForAwaitOfIncludes, ExternalEmitHelpersAsyncDelegatorIncludes, ExternalEmitHelpersClassPrivateFieldIn } from "../types.js";
import { Checker_checkSourceElements, Checker_checkSourceElement, Checker_checkUnusedRenamedBindingElements, Checker_error, Checker_errorOrSuggestion, Checker_reportUnused, Checker_checkNaNEquality, Checker_checkAssertionDeferred, keyBuilder_writeInt, Checker_checkThisBeforeSuper, Checker_checkAssertion } from "./support.js";
import { Checker_checkReflectCollision, Checker_checkWeakMapSetCollision } from "./support.js";
import { Checker_getSuggestedBooleanOperator, Checker_isSideEffectFree, Checker_isContextSensitive, Checker_isConstContext, Checker_getThisContainer } from "./support-queries.js";
import {
  Checker_registerForUnusedIdentifiersCheck, Checker_checkVariableDeclarationList,
  Checker_checkVariableLikeDeclaration, Checker_checkExternalModuleExports,
  Checker_checkForDisallowedESSymbolOperand, Checker_getIndexTypeOrString,
  Checker_checkAccessorDeclaration, Checker_checkUnusedIdentifiers,
  Checker_reportUnusedVariableDeclarations, Checker_isUnreferencedVariableDeclaration,
  Checker_getIndexedAccessType, Checker_getTargetOfAliasLikeExpression, Checker_markSymbolOfAliasDeclarationIfTypeOnly, Checker_needCollisionCheckForIdentifier,
  Checker_getTypeOfSymbol, Checker_getExportSymbolOfValueSymbolIfExported, Checker_getResolvedSymbolOrNil, Checker_isReadonlySymbol, Checker_reportNonexistentProperty,
  Checker_checkIdentifier, Checker_checkPrivateIdentifierExpression, Checker_checkPropertyAccessExpression, Checker_checkQualifiedName, Checker_checkIndexedAccess,
  Checker_checkMetaProperty, Checker_getDeclaredTypeOfSymbol, Checker_getSymbolOfDeclaration, Checker_classDeclarationExtendsNull,
} from "./symbols.js";
import { Checker_checkTruthinessExpression, Checker_checkTestingKnownTruthyCallableOrAwaitableOrEnumMemberType, Checker_checkTruthinessOfType, Checker_extractDefinitelyFalsyTypes, Checker_removeDefinitelyFalsyTypes } from "./flow-narrowing.js";
import { Checker_isCanceled, Checker_isUncheckedJSSuggestion, IsTypeAny, getContainingFunctionOrClassStaticBlock, NewDiagnosticForNode, forEachYieldExpression, isTypeAssertion, expressionResultIsUnused, isLiteralExpressionOfObject, getSuperContainer } from "../utilities.js";
import {
  Checker_checkGrammarStatementInAmbientContext, Checker_grammarErrorOnFirstToken,
  Checker_grammarErrorOnNode, Checker_checkGrammarVariableDeclarationList,
  Checker_checkGrammarBreakOrContinueStatement, Checker_checkGrammarForInOrForOfStatement,
  Checker_checkGrammarYieldExpression, Checker_checkGrammarAwaitOrAwaitUsing,
  Checker_checkGrammarForDisallowedBlockScopedVariableStatement,
  Checker_grammarErrorAtPos, Checker_checkGrammarSourceFile,
  Checker_checkGrammarNumericLiteral, Checker_checkGrammarBigIntLiteral,
} from "../grammarchecks.js";
import {
  Checker_produceDeferredDiagnostics, Checker_hasParseDiagnostics,
  Checker_addErrorOrSuggestion, Checker_addDeferredDiagnostic,
  Checker_isErrorType, Checker_reportOperatorError, Checker_reportOperatorErrorUnless, Checker_IsDeprecatedDeclaration,
  Checker_invocationError, Checker_resolveErrorCall,
} from "./diagnostics.js";
import {
  Checker_checkTypeAssignableToAndOptionallyElaborate,
  Checker_checkTypeAssignableTo,
  Checker_checkTypeComparableTo,
  Checker_isTypeAssignableTo,
  Checker_isTypeSubtypeOf,
  Checker_isTypeRelatedTo, Checker_areTypesComparable, Checker_getThisTypeOfSignature,
} from "../relater.js";
import { Checker_allTypesAssignableToKind, Checker_checkDestructuringAssignment, Checker_checkAssignmentOperator, Checker_isTypeEqualityComparableTo, Checker_isTypeAssignableToKind, Checker_isTypeAssignableToKindEx, Checker_checkSatisfiesExpression } from "./relations.js";
import {
  Checker_checkIteratedTypeOrElementType, Checker_getNonNullableTypeIfNeeded,
  Checker_checkNonNullType, Checker_checkNonNullExpression, Checker_getTypeFromTypeNode,
  Checker_getUnaryResultType, Checker_checkArithmeticOperandType, Checker_bothAreBigIntLike,
  Checker_checkNullishCoalesceOperands, Checker_checkFunctionExpressionOrObjectLiteralMethodDeferred,
  Checker_hasTypeFacts, Checker_getTypeFacts, Checker_checkAwaitedType, Checker_isFunctionType, Checker_isEmptyObjectType, Checker_hasEmptyObjectIntersection,
  Checker_getAwaitedTypeOfPromise, Checker_getRegularTypeOfLiteralType, Checker_getWidenedLiteralLikeTypeForContextualType,
  Checker_instantiateContextualType, Checker_getContextualType, Checker_checkConstEnumAccess,
  Checker_getFreshTypeOfLiteralType, Checker_getNumberLiteralType, Checker_getBigIntLiteralType, Checker_getBaseTypeOfLiteralType, Checker_getBaseTypeOfLiteralTypeForComparison,
  Checker_filterType, Checker_getContextualIterationType, Checker_getYieldedTypeOfYieldExpression,
  Checker_getIterationTypeOfIterable, Checker_getApparentType,
  Checker_getStringLiteralType, Checker_checkTemplateExpression, Checker_checkRegularExpressionLiteral, Checker_checkArrayLiteral,
  Checker_checkObjectLiteral, Checker_checkTaggedTemplateExpression, Checker_checkFunctionExpressionOrObjectLiteralMethod,
  Checker_checkTypeOfExpression, Checker_checkNonNullAssertion, Checker_checkVoidExpression, Checker_checkConditionalExpression, Checker_GetNonNullableType, Checker_getUnionType, Checker_getUnionTypeEx, Checker_maybeTypeOfKind,
  Checker_getBaseTypes,
} from "./types.js";
import { Checker_isReachableFlowNode, Checker_hasMatchingArgument, Checker_getSymbolHasInstanceMethodOfObjectType } from "../flow.js";
import type { FlowNode } from "../../ast/flow.js";
import { Checker_TypeToString } from "../printer.js";
import { Checker_checkClassExpression, Checker_checkClassExpressionDeferred, Checker_checkThisInStaticClassFieldInitializerInDecoratedClass } from "./classes.js";
import {
  Checker_checkTypeParameterDeferred, Checker_resolveUntypedCall,
  Checker_getResolvedSignature, Checker_getSignatureFromDeclaration, Checker_getReturnTypeOfSignature,
  Checker_getReturnTypeFromAnnotation, Checker_unwrapReturnType,
  Checker_isUnwrappedReturnTypeUndefinedVoidOrAny, Checker_isIndirectCall, Checker_instantiateTypeWithSingleGenericCallSignature,
  Checker_checkGeneratorInstantiationAssignabilityToReturnType, Checker_getIterationTypesOfGeneratorFunctionReturnType,
  Checker_getIterationTypeOfGeneratorFunctionReturnType, Checker_tryGetThisTypeAt, Checker_tryGetThisTypeAtEx,
  Checker_getSignaturesOfType, Checker_isUntypedFunctionCall, Checker_isConstructorAccessible, Checker_resolveCall, Checker_typeHasCallOrConstructSignatures,
  Checker_checkImportCallExpression, Checker_checkCallExpression, Checker_checkExpressionWithTypeArguments,
  Checker_isInConstructorArgumentInitializer, Checker_getBaseConstructorTypeOfClass, Checker_getTypeWithThisArgument,
} from "./signatures.js";
import {
  Checker_checkJsxSelfClosingElementDeferred, Checker_checkJsxElementDeferred,
  Checker_checkJsxExpression, Checker_checkJsxElement, Checker_checkJsxSelfClosingElement,
  Checker_checkJsxFragment, Checker_checkJsxAttributes,
} from "../jsx.js";
import { CheckModeTypeOnly, TypeFactsEQUndefinedOrNull, UnionReductionSubtype, createDiagnosticForNode, everyContainedType, hasCommonDomTypeName, isConstEnumObjectType } from "./state.js";
import { Every, FirstOrNil, IfElse, OrElse } from "../../core/core.js";
import { TextRange_Contains } from "../../core/text.js";
import { OrderedSet_Add, OrderedSet_Values, OrderedSet_Clear } from "../../collections/ordered_set.js";
import { Set_Clear } from "../../collections/set.js";
import { LinkStore_Get } from "../../core/linkstore.js";
import {
  KindBlock, KindVariableDeclarationList, KindReturnStatement,
  KindCallExpression, KindNewExpression, KindTaggedTemplateExpression, KindDecorator, KindJsxOpeningElement,
  KindFunctionExpression, KindArrowFunction, KindMethodDeclaration, KindMethodSignature,
  KindGetAccessor, KindSetAccessor, KindPropertyDeclaration, KindPropertySignature, KindConstructor, KindClassStaticBlockDeclaration, KindClassExpression, KindTypeParameter,
  KindJsxSelfClosingElement, KindJsxElement, KindTypeAssertionExpression, KindAsExpression,
  KindVoidExpression, KindBinaryExpression, KindEqualsToken,
  KindNumericLiteral, KindBigIntLiteral, KindMinusToken, KindPlusToken,
  KindTildeToken, KindExclamationToken, KindPlusPlusToken, KindMinusMinusToken,
  KindModuleDeclaration, KindEnumDeclaration,
  KindIdentifier, KindPrivateIdentifier, KindThisKeyword, KindSuperKeyword, KindNullKeyword,
  KindStringLiteral, KindNoSubstitutionTemplateLiteral, KindTrueKeyword, KindFalseKeyword,
  KindTemplateExpression, KindRegularExpressionLiteral, KindArrayLiteralExpression, KindObjectLiteralExpression,
  KindPropertyAccessExpression, KindQualifiedName, KindElementAccessExpression, KindParenthesizedExpression,
  KindTypeOfExpression, KindNonNullExpression, KindExpressionWithTypeArguments, KindSatisfiesExpression,
  KindMetaProperty, KindDeleteExpression, KindAwaitExpression, KindPrefixUnaryExpression,
  KindPostfixUnaryExpression, KindConditionalExpression, KindSpreadElement, KindOmittedExpression,
  KindYieldExpression, KindSyntheticExpression, KindJsxExpression, KindJsxFragment, KindJsxAttributes,
} from "../../ast/generated/kinds.js";
import { KindAmpersandAmpersandEqualsToken, KindAmpersandAmpersandToken, KindAmpersandEqualsToken, KindAmpersandToken, KindAsteriskAsteriskEqualsToken, KindAsteriskAsteriskToken, KindAsteriskEqualsToken, KindAsteriskToken, KindBarBarEqualsToken, KindBarBarToken, KindBarEqualsToken, KindBarToken, KindCaretEqualsToken, KindCaretToken, KindCommaToken, KindEqualsEqualsEqualsToken, KindEqualsEqualsToken, KindExclamationEqualsEqualsToken, KindExclamationEqualsToken, KindGreaterThanEqualsToken, KindGreaterThanGreaterThanEqualsToken, KindGreaterThanGreaterThanGreaterThanEqualsToken, KindGreaterThanGreaterThanGreaterThanToken, KindGreaterThanGreaterThanToken, KindGreaterThanToken, KindInKeyword, KindInstanceOfKeyword, KindLessThanEqualsToken, KindLessThanLessThanEqualsToken, KindLessThanLessThanToken, KindLessThanToken, KindMinusEqualsToken, KindPercentEqualsToken, KindPercentToken, KindPlusEqualsToken, KindQuestionQuestionEqualsToken, KindQuestionQuestionToken, KindSlashEqualsToken, KindSlashToken, KindUnknown } from "../../ast/generated/kinds.js";
import { SkipTrivia, TokenToString } from "../../scanner/scanner.js";
import { GetTextOfNode } from "../../scanner/utilities.js";
import { Tristate_IsTrue, Tristate_IsFalse, TSTrue, TSFalse } from "../../core/tristate.js";
import type { NodeLinks, SourceFileLinks, SymbolNodeLinks, TypeNodeLinks } from "../types.js";
import { NodeCheckFlagsContainsSuperPropertyInStaticInitializer, Type_AsInterfaceType } from "../types.js";
import {
  The_body_of_an_if_statement_cannot_be_the_empty_statement,
  X_with_statements_are_not_allowed_in_an_async_function_block,
  The_with_statement_is_not_supported_All_symbols_in_a_with_block_will_have_type_any,
  Line_break_not_permitted_here,
  All_variables_are_unused,
  Did_you_forget_to_use_await,
  A_return_statement_can_only_be_used_within_a_function_body,
  A_return_statement_cannot_be_used_inside_a_class_static_block,
  Not_all_code_paths_return_a_value,
  Setters_cannot_return_a_value,
  Return_type_of_constructor_signature_must_be_assignable_to_the_instance_type_of_the_class,
  Catch_clause_variable_type_annotation_must_be_any_or_unknown_if_specified,
  Catch_clause_variable_cannot_have_an_initializer,
  Cannot_redeclare_identifier_0_in_catch_clause,
  Unused_label,
  Duplicate_label_0,
  A_default_clause_cannot_appear_more_than_once_in_a_switch_statement,
  Fallthrough_case_in_switch,
  The_left_hand_side_of_a_for_in_statement_cannot_be_a_destructuring_pattern,
  The_left_hand_side_of_a_for_in_statement_must_be_of_type_string_or_any,
  The_left_hand_side_of_a_for_in_statement_must_be_a_variable_or_a_property_access,
  The_left_hand_side_of_a_for_in_statement_may_not_be_an_optional_property_access,
  The_right_hand_side_of_a_for_in_statement_must_be_of_type_any_an_object_type_or_a_type_parameter_but_here_has_type_0,
  The_left_hand_side_of_a_for_of_statement_must_be_a_variable_or_a_property_access,
  The_left_hand_side_of_a_for_of_statement_may_not_be_an_optional_property_access,
  X_for_await_loops_cannot_be_used_inside_a_class_static_block,
  The_return_type_of_an_async_function_must_either_be_a_valid_promise_or_must_not_contain_a_callable_then_member,
  The_operand_of_a_delete_operator_must_be_optional,
  Type_of_await_operand_must_either_be_a_valid_promise_or_must_not_contain_a_callable_then_member,
  X_await_has_no_effect_on_the_type_of_this_expression,
  An_arithmetic_operand_must_be_of_type_any_number_bigint_or_an_enum_type,
  The_operand_of_an_increment_or_decrement_operator_must_be_a_variable_or_a_property_access,
  The_operand_of_an_increment_or_decrement_operator_may_not_be_an_optional_property_access,
  The_right_hand_side_of_an_instanceof_expression_must_be_either_of_type_any_a_class_function_or_other_type_assignable_to_the_Function_interface_type_or_an_object_type_with_a_Symbol_hasInstance_method,
  X_yield_expression_implicitly_results_in_an_any_type_because_its_containing_generator_lacks_a_return_type_annotation,
  X_super_must_be_called_before_accessing_this_in_the_constructor_of_a_derived_class,
  X_super_cannot_be_referenced_in_a_computed_property_name,
  Super_calls_are_not_permitted_outside_constructors_or_in_nested_functions_inside_constructors,
  X_super_can_only_be_referenced_in_members_of_derived_classes_or_object_literal_expressions,
  X_super_property_access_is_permitted_only_in_a_constructor_member_function_or_member_accessor_of_a_derived_class,
  X_super_must_be_called_before_accessing_a_property_of_super_in_the_constructor_of_a_derived_class,
  X_super_can_only_be_referenced_in_a_derived_class,
  X_super_cannot_be_referenced_in_constructor_arguments,
  X_this_cannot_be_referenced_in_a_computed_property_name,
  X_this_cannot_be_referenced_in_a_module_or_namespace_body,
  X_this_cannot_be_referenced_in_current_location,
  The_containing_arrow_function_captures_the_global_value_of_this,
  X_this_implicitly_has_type_any_because_it_does_not_have_a_type_annotation,
  An_outer_value_of_this_is_shadowed_by_this_container,
  The_operand_of_a_delete_operator_must_be_a_property_reference,
  The_operand_of_a_delete_operator_cannot_be_a_private_identifier,
  The_operand_of_a_delete_operator_cannot_be_a_read_only_property,
  The_left_hand_side_of_an_instanceof_expression_must_be_of_type_any_an_object_type_or_a_type_parameter,
  An_object_s_Symbol_hasInstance_method_must_return_a_boolean_value_for_it_to_be_used_on_the_right_hand_side_of_an_instanceof_expression,
  Type_0_may_represent_a_primitive_value_which_is_not_permitted_as_the_right_operand_of_the_in_operator,
  Untyped_function_calls_may_not_accept_type_arguments,
  Cannot_create_an_instance_of_an_abstract_class,
  Only_a_void_function_can_be_called_with_the_new_keyword,
  A_function_that_is_called_with_the_new_keyword_cannot_have_a_this_type_that_is_void,
  The_0_operator_cannot_be_applied_to_type_symbol,
  Operator_0_cannot_be_applied_to_type_1,
} from "../../diagnostics/generated/messages.js";
import { Exponentiation_cannot_be_performed_on_bigint_values_unless_the_target_option_is_set_to_es2016_or_later, JSX_expressions_must_have_one_parent_element, Left_side_of_comma_operator_is_unused_and_has_no_side_effects, The_0_operator_is_not_allowed_for_boolean_types_Consider_using_1_instead, The_left_hand_side_of_an_arithmetic_operation_must_be_of_type_any_number_bigint_or_an_enum_type, The_right_hand_side_of_an_arithmetic_operation_must_be_of_type_any_number_bigint_or_an_enum_type, This_condition_will_always_return_0_since_JavaScript_compares_objects_by_reference_not_value, This_operation_can_be_simplified_This_shift_is_identical_to_0_1_2 } from "../../diagnostics/generated/messages.js";
import { Checker_checkGrammarModifiers } from "../grammarchecks.js";
import {
  ContextFlagsNone, TypeFlagsAnyOrUnknown, TypeFlagsNonPrimitive,
  TypeFlagsInstantiableNonPrimitive, TypeFlagsNever, TypeFlagsPrimitive,
  TypeFlagsESSymbolLike, TypeFlagsBigIntLike, TypeFlagsUnion, TypeFlagsBooleanLike, TypeFlagsNumberLike, TypeFlagsStringLike,
} from "../types.js";
import { SymbolFlagsBlockScopedVariable, SymbolFlagsOptional, SymbolFlagsFunction, SymbolFlagsMethod } from "../../ast/generated/flags.js";
import { IsEnumMember, IsIfStatement } from "../../ast/generated/predicates.js";
import type { SymbolTable } from "../../ast/symbol.js";
import { Checker_getInferenceContext, Checker_maybeTypeOfKindConsideringBaseConstraint } from "./inference.js";
import { FromString } from "../../jsnum/string.js";
import type { Number } from "../../jsnum/jsnum.js";
import { Number_Abs, Number_Remainder } from "../../jsnum/jsnum.js";
import { NewPseudoBigInt, ParsePseudoBigInt } from "../../jsnum/pseudobigint.js";
import { Checker_isSkipDirectInferenceNode } from "../inference.js";

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.checkSourceFile","kind":"method","status":"implemented","sigHash":"73742795303ebe59bb331756ff6743713f7b9c4fbd309e3a8507a615e2dbf18f","bodyHash":"65678dd5c6e1f4ffa700bb65eee57bc088bcc84456cf8a0948d39f486e967a22"}
 *
 * Go source:
 * func (c *Checker) checkSourceFile(ctx context.Context, sourceFile *ast.SourceFile, checkUnused bool) {
 * 	c.ctx = ctx
 * 	links := c.sourceFileLinks.Get(sourceFile)
 * 	if !links.typeChecked {
 * 		c.saveDeferredDiagnostics = true
 * 		if tr := c.tracer; tr != nil {
 * 			defer tr.Push(tracing.PhaseCheck, "checkSourceFile", map[string]any{"path": sourceFile.FileName()}, true)()
 * 		}
 * 		// Grammar checking
 * 		c.checkGrammarSourceFile(sourceFile)
 * 		c.renamedBindingElementsInTypes = nil
 * 		c.checkSourceElements(sourceFile.Statements.Nodes)
 * 		c.checkDeferredNodes(sourceFile)
 * 		if ast.IsExternalOrCommonJSModule(sourceFile) {
 * 			c.checkExternalModuleExports(sourceFile.AsNode())
 * 			c.registerForUnusedIdentifiersCheck(sourceFile.AsNode())
 * 		}
 * 		if !sourceFile.IsDeclarationFile && !c.isCanceled() {
 * 			c.checkUnusedRenamedBindingElements()
 * 		}
 * 		c.saveDeferredDiagnostics = false
 * 		c.produceDeferredDiagnostics()
 * 		c.reportedUnreachableNodes.Clear()
 * 		links.typeChecked = true
 * 	}
 * 	if checkUnused && !links.unusedChecked {
 * 		// The unused identifiers check relies on a full type check having first been performed
 * 		if !sourceFile.IsDeclarationFile && !c.isCanceled() {
 * 			c.checkUnusedIdentifiers(links.identifierCheckNodes)
 * 		}
 * 		links.unusedChecked = true
 * 	}
 * 	if c.isCanceled() {
 * 		c.wasCanceled = true
 * 	}
 * 	c.ctx = nil
 * }
 */
export function Checker_checkSourceFile(receiver: GoPtr<Checker>, ctx: Context, sourceFile: GoPtr<SourceFile>, checkUnused: bool): void {
  receiver!.ctx = ctx;
  const links = Checker_getSourceFileLinks(receiver, sourceFile);
  if (!links!.typeChecked) {
    receiver!.saveDeferredDiagnostics = true as bool;
    Checker_checkGrammarSourceFile(receiver, sourceFile);
    receiver!.renamedBindingElementsInTypes = [];
    Checker_checkSourceElements(receiver, sourceFile!.Statements!.Nodes);
    Checker_checkDeferredNodes(receiver, sourceFile);
    if (IsExternalOrCommonJSModule(sourceFile)) {
      Checker_checkExternalModuleExports(receiver, Node_AsNode(sourceFile));
      Checker_registerForUnusedIdentifiersCheck(receiver, Node_AsNode(sourceFile));
    }
    if (!sourceFile!.IsDeclarationFile && !Checker_isCanceled(receiver)) {
      Checker_checkUnusedRenamedBindingElements(receiver);
    }
    receiver!.saveDeferredDiagnostics = false as bool;
    Checker_produceDeferredDiagnostics(receiver);
    Set_Clear(receiver!.reportedUnreachableNodes);
    links!.typeChecked = true as bool;
  }
  if (checkUnused && !links!.unusedChecked) {
    if (!sourceFile!.IsDeclarationFile && !Checker_isCanceled(receiver)) {
      Checker_checkUnusedIdentifiers(receiver, links!.identifierCheckNodes);
    }
    links!.unusedChecked = true as bool;
  }
  if (Checker_isCanceled(receiver)) {
    receiver!.wasCanceled = true as bool;
  }
  receiver!.ctx = undefined as unknown as Context;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.checkNodeDeferred","kind":"method","status":"implemented","sigHash":"dd24ddc76cd890663f688034865c3792ce440b337f9b21837ac6ba89397bd81a","bodyHash":"c61cd05ebecf032a4938ba4219e2942cef12d9476e2ed12423451a4fd37708d8"}
 *
 * Go source:
 * func (c *Checker) checkNodeDeferred(node *ast.Node) {
 * 	enclosingFile := ast.GetSourceFileOfNode(node)
 * 	links := c.sourceFileLinks.Get(enclosingFile)
 * 	if !links.typeChecked {
 * 		links.deferredNodes.Add(node)
 * 	}
 * }
 */
export function Checker_checkNodeDeferred(receiver: GoPtr<Checker>, node: GoPtr<Node>): void {
  const enclosingFile = GetSourceFileOfNode(node);
  const links = Checker_getSourceFileLinks(receiver, enclosingFile);
  if (!links!.typeChecked) {
    OrderedSet_Add(links!.deferredNodes, node);
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.checkDeferredNodes","kind":"method","status":"implemented","sigHash":"b8a8f2c3a1980cba3303db8b53923b44b95eb4c6ac6f1c9323564492cca89c1f","bodyHash":"6c212875e586e5b7fc4231e54aab97b69a924644e3b20c77831c14392fedf5e5"}
 *
 * Go source:
 * func (c *Checker) checkDeferredNodes(context *ast.SourceFile) {
 * 	links := c.sourceFileLinks.Get(context)
 * 	for node := range links.deferredNodes.Values() {
 * 		if c.isCanceled() {
 * 			break
 * 		}
 * 		c.checkDeferredNode(node)
 * 	}
 * 	links.deferredNodes.Clear()
 * }
 */
export function Checker_checkDeferredNodes(receiver: GoPtr<Checker>, context: GoPtr<SourceFile>): void {
  const links = Checker_getSourceFileLinks(receiver, context);
  OrderedSet_Values(links!.deferredNodes)((node) => {
    if (Checker_isCanceled(receiver)) {
      return false as bool;
    }
    Checker_checkDeferredNode(receiver, node);
    return true as bool;
  });
  OrderedSet_Clear(links!.deferredNodes);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.checkDeferredNode","kind":"method","status":"implemented","sigHash":"bc06016023de682ee6fef7407e135a73d5179cc204dbd7fe374d4c32c4e74b62","bodyHash":"802d5ba159427fe21caed9b578af3bf74a7c69eac21a5a0b5afc84fa13985196"}
 *
 * Go source:
 * func (c *Checker) checkDeferredNode(node *ast.Node) {
 * 	if tr := c.tracer; tr != nil {
 * 		defer tr.Push(tracing.PhaseCheck, "checkDeferredNode", map[string]any{"kind": node.Kind, "pos": node.Pos(), "end": node.End(), "path": ast.GetSourceFileOfNode(node).FileName()}, false)()
 * 	}
 * 	saveCurrentNode := c.currentNode
 * 	c.currentNode = node
 * 	c.instantiationCount = 0
 * 	switch node.Kind {
 * 	case ast.KindCallExpression, ast.KindNewExpression, ast.KindTaggedTemplateExpression, ast.KindDecorator, ast.KindJsxOpeningElement:
 * 		// These node kinds are deferred checked when overload resolution fails. To save on work,
 * 		// we ensure the arguments are checked just once in a deferred way.
 * 		c.resolveUntypedCall(node)
 * 	case ast.KindFunctionExpression, ast.KindArrowFunction, ast.KindMethodDeclaration, ast.KindMethodSignature:
 * 		c.checkFunctionExpressionOrObjectLiteralMethodDeferred(node)
 * 	case ast.KindGetAccessor, ast.KindSetAccessor:
 * 		c.checkAccessorDeclaration(node)
 * 	case ast.KindClassExpression:
 * 		c.checkClassExpressionDeferred(node)
 * 	case ast.KindTypeParameter:
 * 		c.checkTypeParameterDeferred(node)
 * 	case ast.KindJsxSelfClosingElement:
 * 		c.checkJsxSelfClosingElementDeferred(node)
 * 	case ast.KindJsxElement:
 * 		c.checkJsxElementDeferred(node)
 * 	case ast.KindTypeAssertionExpression, ast.KindAsExpression:
 * 		c.checkAssertionDeferred(node)
 * 	case ast.KindVoidExpression:
 * 		c.checkExpression(node.Expression())
 * 	case ast.KindBinaryExpression:
 * 		if ast.IsInstanceOfExpression(node) {
 * 			c.resolveUntypedCall(node)
 * 		}
 * 	}
 * 	c.currentNode = saveCurrentNode
 * }
 */
export function Checker_checkDeferredNode(receiver: GoPtr<Checker>, node: GoPtr<Node>): void {
  const saveCurrentNode = receiver!.currentNode;
  receiver!.currentNode = node;
  receiver!.instantiationCount = 0;
  switch (node!.Kind) {
    case KindCallExpression:
    case KindNewExpression:
    case KindTaggedTemplateExpression:
    case KindDecorator:
    case KindJsxOpeningElement:
      Checker_resolveUntypedCall(receiver, node);
      break;
    case KindFunctionExpression:
    case KindArrowFunction:
    case KindMethodDeclaration:
    case KindMethodSignature:
      Checker_checkFunctionExpressionOrObjectLiteralMethodDeferred(receiver, node);
      break;
    case KindGetAccessor:
    case KindSetAccessor:
      Checker_checkAccessorDeclaration(receiver, node);
      break;
    case KindClassExpression:
      Checker_checkClassExpressionDeferred(receiver, node);
      break;
    case KindTypeParameter:
      Checker_checkTypeParameterDeferred(receiver, node);
      break;
    case KindJsxSelfClosingElement:
      Checker_checkJsxSelfClosingElementDeferred(receiver, node);
      break;
    case KindJsxElement:
      Checker_checkJsxElementDeferred(receiver, node);
      break;
    case KindTypeAssertionExpression:
    case KindAsExpression:
      Checker_checkAssertionDeferred(receiver, node);
      break;
    case KindVoidExpression:
      Checker_checkExpression(receiver, Node_Expression(node));
      break;
    case KindBinaryExpression:
      if (IsInstanceOfExpression(node)) {
        Checker_resolveUntypedCall(receiver, node);
      }
      break;
  }
  receiver!.currentNode = saveCurrentNode;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.checkBlock","kind":"method","status":"implemented","sigHash":"664b36b67e43b14c83a4e5537ca889ea976ada96a48bd3d60665c9847841985a","bodyHash":"bce7586e8cad479d29699f043418609c7043b30f4d00f9605b328b0b388dda08"}
 *
 * Go source:
 * func (c *Checker) checkBlock(node *ast.Node) {
 * 	// Grammar checking for SyntaxKind.Block
 * 	if node.Kind == ast.KindBlock {
 * 		c.checkGrammarStatementInAmbientContext(node)
 * 	}
 * 	if ast.IsFunctionOrModuleBlock(node) {
 * 		saveFlowAnalysisDisabled := c.flowAnalysisDisabled
 * 		c.checkSourceElements(node.Statements())
 * 		c.flowAnalysisDisabled = saveFlowAnalysisDisabled
 * 	} else {
 * 		c.checkSourceElements(node.Statements())
 * 	}
 * 	if len(node.Locals()) != 0 {
 * 		c.registerForUnusedIdentifiersCheck(node)
 * 	}
 * }
 */
export function Checker_checkBlock(receiver: GoPtr<Checker>, node: GoPtr<Node>): void {
  if (node!.Kind === KindBlock) {
    Checker_checkGrammarStatementInAmbientContext(receiver, node);
  }
  if (IsFunctionOrModuleBlock(node)) {
    const saveFlowAnalysisDisabled = receiver!.flowAnalysisDisabled;
    Checker_checkSourceElements(receiver, Node_Statements(node) || []);
    receiver!.flowAnalysisDisabled = saveFlowAnalysisDisabled;
  } else {
    Checker_checkSourceElements(receiver, Node_Statements(node) || []);
  }
  if ((Node_Locals(node)?.size ?? 0) !== 0) {
    Checker_registerForUnusedIdentifiersCheck(receiver, node);
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.checkIfStatement","kind":"method","status":"implemented","sigHash":"860485f58123df8a447de9fad7da393bae7c9d353b4f1ff51df8212ee7710d75","bodyHash":"9f35dfff85203b791401bc85734676d758ec166f73fbbd469bc27dd8c82fbb05"}
 *
 * Go source:
 * func (c *Checker) checkIfStatement(node *ast.Node) {
 * 	c.checkGrammarStatementInAmbientContext(node)
 * 	t := c.checkTruthinessExpression(node.Expression(), CheckModeNormal)
 * 	data := node.AsIfStatement()
 * 	c.checkTestingKnownTruthyCallableOrAwaitableOrEnumMemberType(node.Expression(), t, data.ThenStatement)
 * 	c.checkSourceElement(data.ThenStatement)
 * 	if ast.IsEmptyStatement(data.ThenStatement) {
 * 		c.error(data.ThenStatement, diagnostics.The_body_of_an_if_statement_cannot_be_the_empty_statement)
 * 	}
 * 	c.checkSourceElement(data.ElseStatement)
 * }
 */
export function Checker_checkIfStatement(receiver: GoPtr<Checker>, node: GoPtr<Node>): void {
  Checker_checkGrammarStatementInAmbientContext(receiver, node);
  const t = Checker_checkTruthinessExpression(receiver, Node_Expression(node), CheckModeNormal);
  const data = AsIfStatement(node);
  Checker_checkTestingKnownTruthyCallableOrAwaitableOrEnumMemberType(receiver, Node_Expression(node), t, data!.ThenStatement);
  Checker_checkSourceElement(receiver, data!.ThenStatement);
  if (IsEmptyStatement(data!.ThenStatement)) {
    Checker_error(receiver, data!.ThenStatement, The_body_of_an_if_statement_cannot_be_the_empty_statement);
  }
  Checker_checkSourceElement(receiver, data!.ElseStatement);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.checkDoStatement","kind":"method","status":"implemented","sigHash":"617c1cddbf79c3179fc590c1691e5560e107b668bb50cfd2b88394ed9e7102c6","bodyHash":"418fc693c3c4a5586a74cb23fb2fa27e5c125abc72ec61bbf785342c14e2d1de"}
 *
 * Go source:
 * func (c *Checker) checkDoStatement(node *ast.Node) {
 * 	c.checkGrammarStatementInAmbientContext(node)
 * 	c.checkSourceElement(node.Statement())
 * 	c.checkTruthinessExpression(node.Expression(), CheckModeNormal)
 * }
 */
export function Checker_checkDoStatement(receiver: GoPtr<Checker>, node: GoPtr<Node>): void {
  Checker_checkGrammarStatementInAmbientContext(receiver, node);
  Checker_checkSourceElement(receiver, Node_Statement(node));
  Checker_checkTruthinessExpression(receiver, Node_Expression(node), CheckModeNormal);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.checkWhileStatement","kind":"method","status":"implemented","sigHash":"f2bc19def073e7d624259f0325bebc73e79c4fc86b8fe7a13e9acebe375f9305","bodyHash":"95c41dc1856fecacc977142e97e81b436df3ab70d267afec920240ccd347d5f1"}
 *
 * Go source:
 * func (c *Checker) checkWhileStatement(node *ast.Node) {
 * 	c.checkGrammarStatementInAmbientContext(node)
 * 	c.checkTruthinessExpression(node.Expression(), CheckModeNormal)
 * 	c.checkSourceElement(node.Statement())
 * }
 */
export function Checker_checkWhileStatement(receiver: GoPtr<Checker>, node: GoPtr<Node>): void {
  Checker_checkGrammarStatementInAmbientContext(receiver, node);
  Checker_checkTruthinessExpression(receiver, Node_Expression(node), CheckModeNormal);
  Checker_checkSourceElement(receiver, Node_Statement(node));
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.checkForStatement","kind":"method","status":"implemented","sigHash":"d06a273c32bf66aafbb78aa1c434f8fcd0e3bc3e0cecec48b0faf7d92c49fdb1","bodyHash":"fa3858f188f95e9683af1a7280c9c23ab55e910fb192cab71f9ab005a139e298"}
 *
 * Go source:
 * func (c *Checker) checkForStatement(node *ast.Node) {
 * 	if !c.checkGrammarStatementInAmbientContext(node) {
 * 		if init := node.Initializer(); init != nil && init.Kind == ast.KindVariableDeclarationList {
 * 			c.checkGrammarVariableDeclarationList(init.AsVariableDeclarationList())
 * 		}
 * 	}
 * 	data := node.AsForStatement()
 * 	if data.Initializer != nil {
 * 		if ast.IsVariableDeclarationList(data.Initializer) {
 * 			c.checkVariableDeclarationList(data.Initializer)
 * 		} else {
 * 			c.checkExpression(data.Initializer)
 * 		}
 * 	}
 * 	if data.Condition != nil {
 * 		c.checkTruthinessExpression(data.Condition, CheckModeNormal)
 * 	}
 * 	if data.Incrementor != nil {
 * 		c.checkExpression(data.Incrementor)
 * 	}
 * 	c.checkSourceElement(data.Statement)
 * 	if node.Locals() != nil {
 * 		c.registerForUnusedIdentifiersCheck(node)
 * 	}
 * }
 */
export function Checker_checkForStatement(receiver: GoPtr<Checker>, node: GoPtr<Node>): void {
  if (!Checker_checkGrammarStatementInAmbientContext(receiver, node)) {
    const init = Node_Initializer(node);
    if (init !== undefined && init!.Kind === KindVariableDeclarationList) {
      Checker_checkGrammarVariableDeclarationList(receiver, AsVariableDeclarationList(init));
    }
  }
  const data = AsForStatement(node);
  if (data!.Initializer !== undefined) {
    if (IsVariableDeclarationList(data!.Initializer)) {
      Checker_checkVariableDeclarationList(receiver, data!.Initializer);
    } else {
      Checker_checkExpression(receiver, data!.Initializer);
    }
  }
  if (data!.Condition !== undefined) {
    Checker_checkTruthinessExpression(receiver, data!.Condition, CheckModeNormal);
  }
  if (data!.Incrementor !== undefined) {
    Checker_checkExpression(receiver, data!.Incrementor);
  }
  Checker_checkSourceElement(receiver, data!.Statement);
  if ((Node_Locals(node)?.size ?? 0) !== 0) {
    Checker_registerForUnusedIdentifiersCheck(receiver, node);
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.checkForInStatement","kind":"method","status":"implemented","sigHash":"1036d4dbf8b354145c0c0f92c80d29e05c2b482399bc67dce4e9ceaa19178e59","bodyHash":"519095d2acdf211f9d06a09c73c2cb2a7432e446dc023031d85188a83b4ce9a8"}
 *
 * Go source:
 * func (c *Checker) checkForInStatement(node *ast.Node) {
 * 	data := node.AsForInOrOfStatement()
 * 	c.checkGrammarForInOrForOfStatement(data)
 * 	rightType := c.getNonNullableTypeIfNeeded(c.checkExpression(data.Expression))
 * 	// TypeScript 1.0 spec (April 2014): 5.4
 * 	// In a 'for-in' statement of the form
 * 	// for (let VarDecl in Expr) Statement
 * 	//   VarDecl must be a variable declaration without a type annotation that declares a variable of type Any,
 * 	//   and Expr must be an expression of type Any, an object type, or a type parameter type.
 * 	if ast.IsVariableDeclarationList(data.Initializer) {
 * 		declarations := data.Initializer.AsVariableDeclarationList().Declarations.Nodes
 * 		if len(declarations) != 0 && ast.IsBindingPattern(declarations[0].Name()) {
 * 			c.error(declarations[0].Name(), diagnostics.The_left_hand_side_of_a_for_in_statement_cannot_be_a_destructuring_pattern)
 * 		}
 * 		c.checkVariableDeclarationList(data.Initializer)
 * 	} else {
 * 		// In a 'for-in' statement of the form
 * 		// for (Var in Expr) Statement
 * 		//   Var must be an expression classified as a reference of type Any or the String primitive type,
 * 		//   and Expr must be an expression of type Any, an object type, or a type parameter type.
 * 		varExpr := data.Initializer
 * 		leftType := c.checkExpression(varExpr)
 * 		if ast.IsArrayLiteralExpression(varExpr) || ast.IsObjectLiteralExpression(varExpr) {
 * 			c.error(varExpr, diagnostics.The_left_hand_side_of_a_for_in_statement_cannot_be_a_destructuring_pattern)
 * 		} else if !c.isTypeAssignableTo(c.getIndexTypeOrString(rightType), leftType) {
 * 			c.error(varExpr, diagnostics.The_left_hand_side_of_a_for_in_statement_must_be_of_type_string_or_any)
 * 		} else {
 * 			// run check only former check succeeded to avoid cascading errors
 * 			c.checkReferenceExpression(varExpr, diagnostics.The_left_hand_side_of_a_for_in_statement_must_be_a_variable_or_a_property_access, diagnostics.The_left_hand_side_of_a_for_in_statement_may_not_be_an_optional_property_access)
 * 		}
 * 	}
 * 	// unknownType is returned i.e. if node.expression is identifier whose name cannot be resolved
 * 	// in this case error about missing name is already reported - do not report extra one
 * 	if rightType == c.neverType || !c.isTypeAssignableToKind(rightType, TypeFlagsNonPrimitive|TypeFlagsInstantiableNonPrimitive) {
 * 		c.error(data.Expression, diagnostics.The_right_hand_side_of_a_for_in_statement_must_be_of_type_any_an_object_type_or_a_type_parameter_but_here_has_type_0, c.TypeToString(rightType))
 * 	}
 * 	c.checkSourceElement(data.Statement)
 * 	if node.Locals() != nil {
 * 		c.registerForUnusedIdentifiersCheck(node)
 * 	}
 * }
 */
export function Checker_checkForInStatement(receiver: GoPtr<Checker>, node: GoPtr<Node>): void {
  const data = AsForInOrOfStatement(node);
  Checker_checkGrammarForInOrForOfStatement(receiver, data);
  const rightType = Checker_getNonNullableTypeIfNeeded(receiver, Checker_checkExpression(receiver, data!.Expression));
  if (IsVariableDeclarationList(data!.Initializer)) {
    const declarations = AsVariableDeclarationList(data!.Initializer)!.Declarations!.Nodes;
    if (declarations.length !== 0 && IsBindingPattern(Node_Name(declarations[0]))) {
      Checker_error(receiver, Node_Name(declarations[0]), The_left_hand_side_of_a_for_in_statement_cannot_be_a_destructuring_pattern);
    }
    Checker_checkVariableDeclarationList(receiver, data!.Initializer);
  } else {
    const varExpr = data!.Initializer;
    const leftType = Checker_checkExpression(receiver, varExpr);
    if (IsArrayLiteralExpression(varExpr) || IsObjectLiteralExpression(varExpr)) {
      Checker_error(receiver, varExpr, The_left_hand_side_of_a_for_in_statement_cannot_be_a_destructuring_pattern);
    } else if (!Checker_isTypeAssignableTo(receiver, Checker_getIndexTypeOrString(receiver, rightType), leftType)) {
      Checker_error(receiver, varExpr, The_left_hand_side_of_a_for_in_statement_must_be_of_type_string_or_any);
    } else {
      Checker_checkReferenceExpression(receiver, varExpr, The_left_hand_side_of_a_for_in_statement_must_be_a_variable_or_a_property_access, The_left_hand_side_of_a_for_in_statement_may_not_be_an_optional_property_access);
    }
  }
  if (rightType === receiver!.neverType || !Checker_isTypeAssignableToKind(receiver, rightType, (TypeFlagsNonPrimitive | TypeFlagsInstantiableNonPrimitive) as int)) {
    Checker_error(receiver, data!.Expression, The_right_hand_side_of_a_for_in_statement_must_be_of_type_any_an_object_type_or_a_type_parameter_but_here_has_type_0, Checker_TypeToString(receiver, rightType));
  }
  Checker_checkSourceElement(receiver, data!.Statement);
  if ((Node_Locals(node)?.size ?? 0) !== 0) {
    Checker_registerForUnusedIdentifiersCheck(receiver, node);
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.checkForOfStatement","kind":"method","status":"implemented","sigHash":"e566e597fa7d439638d7e79f7f6a58beadd26a29858a11cc0387de04ffb22181","bodyHash":"f6328f542ab5a70b49442a84232412dc6cab6f7c4c95af06a08d922482124273"}
 *
 * Go source:
 * func (c *Checker) checkForOfStatement(node *ast.Node) {
 * 	data := node.AsForInOrOfStatement()
 * 	c.checkGrammarForInOrForOfStatement(data)
 * 	container := getContainingFunctionOrClassStaticBlock(node)
 * 	if data.AwaitModifier != nil {
 * 		if container != nil && ast.IsClassStaticBlockDeclaration(container) {
 * 			c.grammarErrorOnNode(data.AwaitModifier, diagnostics.X_for_await_loops_cannot_be_used_inside_a_class_static_block)
 * 		} else {
 * 			functionFlags := ast.GetFunctionFlags(container)
 * 			if functionFlags&(ast.FunctionFlagsInvalid|ast.FunctionFlagsAsync) == ast.FunctionFlagsAsync && c.languageVersion < LanguageFeatureMinimumTarget.ForAwaitOf {
 * 				// for..await..of in an async function or async generator function prior to ESNext requires the __asyncValues helper
 * 				c.checkExternalEmitHelpers(node, ExternalEmitHelpersForAwaitOfIncludes)
 * 			}
 * 		}
 * 	} // Check the LHS and RHS
 * 	// If the LHS is a declaration, just check it as a variable declaration, which will in turn check the RHS
 * 	// via checkRightHandSideOfForOf.
 * 	// If the LHS is an expression, check the LHS, as a destructuring assignment or as a reference.
 * 	// Then check that the RHS is assignable to it.
 * 	if ast.IsVariableDeclarationList(data.Initializer) {
 * 		c.checkVariableDeclarationList(data.Initializer)
 * 	} else {
 * 		varExpr := data.Initializer
 * 		iteratedType := c.checkRightHandSideOfForOf(node)
 * 		// There may be a destructuring assignment on the left side
 * 		if ast.IsArrayLiteralExpression(varExpr) || ast.IsObjectLiteralExpression(varExpr) {
 * 			// iteratedType may be undefined. In this case, we still want to check the structure of
 * 			// varExpr, in particular making sure it's a valid LeftHandSideExpression. But we'd like
 * 			// to short circuit the type relation checking as much as possible, so we pass the unknownType.
 * 			c.checkDestructuringAssignment(varExpr, core.OrElse(iteratedType, c.errorType), CheckModeNormal, false)
 * 		} else {
 * 			leftType := c.checkExpression(varExpr)
 * 			c.checkReferenceExpression(varExpr, diagnostics.The_left_hand_side_of_a_for_of_statement_must_be_a_variable_or_a_property_access, diagnostics.The_left_hand_side_of_a_for_of_statement_may_not_be_an_optional_property_access)
 * 			// iteratedType will be undefined if the rightType was missing properties/signatures
 * 			// required to get its iteratedType (like [Symbol.iterator] or next). This may be
 * 			// because we accessed properties from anyType, or it may have led to an error inside
 * 			// getElementTypeOfIterable.
 * 			if iteratedType != nil {
 * 				c.checkTypeAssignableToAndOptionallyElaborate(iteratedType, leftType, varExpr, data.Expression, nil, nil)
 * 			}
 * 		}
 * 	}
 * 	c.checkSourceElement(data.Statement)
 * 	if node.Locals() != nil {
 * 		c.registerForUnusedIdentifiersCheck(node)
 * 	}
 * }
 */
export function Checker_checkForOfStatement(receiver: GoPtr<Checker>, node: GoPtr<Node>): void {
  const data = AsForInOrOfStatement(node);
  Checker_checkGrammarForInOrForOfStatement(receiver, data);
  const container = getContainingFunctionOrClassStaticBlock(node);
  if (data!.AwaitModifier !== undefined) {
    if (container !== undefined && IsClassStaticBlockDeclaration(container)) {
      Checker_grammarErrorOnNode(receiver, data!.AwaitModifier, X_for_await_loops_cannot_be_used_inside_a_class_static_block);
    } else {
      const functionFlags = GetFunctionFlags(container);
      if ((functionFlags & (FunctionFlagsInvalid | FunctionFlagsAsync)) === FunctionFlagsAsync && receiver!.languageVersion < LanguageFeatureMinimumTarget.ForAwaitOf) {
        // for..await..of in an async function or async generator function prior to ESNext requires the __asyncValues helper
        Checker_checkExternalEmitHelpers(receiver, node, ExternalEmitHelpersForAwaitOfIncludes);
      }
    }
  }
  if (IsVariableDeclarationList(data!.Initializer)) {
    Checker_checkVariableDeclarationList(receiver, data!.Initializer);
  } else {
    const varExpr = data!.Initializer;
    const iteratedType = Checker_checkRightHandSideOfForOf(receiver, node);
    if (IsArrayLiteralExpression(varExpr) || IsObjectLiteralExpression(varExpr)) {
      Checker_checkDestructuringAssignment(receiver, varExpr, OrElse(iteratedType, receiver!.errorType), CheckModeNormal, false as bool);
    } else {
      const leftType = Checker_checkExpression(receiver, varExpr);
      Checker_checkReferenceExpression(receiver, varExpr, The_left_hand_side_of_a_for_of_statement_must_be_a_variable_or_a_property_access, The_left_hand_side_of_a_for_of_statement_may_not_be_an_optional_property_access);
      if (iteratedType !== undefined) {
        Checker_checkTypeAssignableToAndOptionallyElaborate(receiver, iteratedType, leftType, varExpr, data!.Expression, undefined, undefined);
      }
    }
  }
  Checker_checkSourceElement(receiver, data!.Statement);
  if ((Node_Locals(node)?.size ?? 0) !== 0) {
    Checker_registerForUnusedIdentifiersCheck(receiver, node);
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.checkBreakOrContinueStatement","kind":"method","status":"implemented","sigHash":"18ae020f6f8a4bc83142debc1dff1195fc91ffb8f149bfa959d4cd34f87a4fab","bodyHash":"2aa1ff55ff6fa949444deae2f77449d40a63772ea45679252ae385708172a09f"}
 *
 * Go source:
 * func (c *Checker) checkBreakOrContinueStatement(node *ast.Node) {
 * 	if !c.checkGrammarStatementInAmbientContext(node) {
 * 		c.checkGrammarBreakOrContinueStatement(node)
 * 	}
 * }
 */
export function Checker_checkBreakOrContinueStatement(receiver: GoPtr<Checker>, node: GoPtr<Node>): void {
  if (!Checker_checkGrammarStatementInAmbientContext(receiver, node)) {
    Checker_checkGrammarBreakOrContinueStatement(receiver, node);
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.checkReturnStatement","kind":"method","status":"implemented","sigHash":"6eac8451dc0538a339a110289333e4412a0c4679550607a377d79f689c3c1b02","bodyHash":"601ce919746dd61ad0afc23b7a050951c6c33b7decc5595d3cac5163f991a655"}
 *
 * Go source:
 * func (c *Checker) checkReturnStatement(node *ast.Node) {
 * 	if c.checkGrammarStatementInAmbientContext(node) {
 * 		return
 * 	}
 * 	container := getContainingFunctionOrClassStaticBlock(node)
 * 	if container != nil && ast.IsClassStaticBlockDeclaration(container) {
 * 		c.grammarErrorOnFirstToken(node, diagnostics.A_return_statement_cannot_be_used_inside_a_class_static_block)
 * 		return
 * 	}
 * 	if container == nil {
 * 		c.grammarErrorOnFirstToken(node, diagnostics.A_return_statement_can_only_be_used_within_a_function_body)
 * 		return
 * 	}
 * 	signature := c.getSignatureFromDeclaration(container)
 * 	returnType := c.getReturnTypeOfSignature(signature)
 * 	functionFlags := ast.GetFunctionFlags(container)
 * 	exprNode := node.Expression()
 * 	if c.strictNullChecks || exprNode != nil || returnType.flags&TypeFlagsNever != 0 {
 * 		exprType := c.undefinedType
 * 		if exprNode != nil {
 * 			exprType = c.checkExpressionCached(exprNode)
 * 		}
 * 		if ast.IsSetAccessorDeclaration(container) {
 * 			if exprNode != nil {
 * 				c.error(node, diagnostics.Setters_cannot_return_a_value)
 * 			}
 * 		} else if ast.IsConstructorDeclaration(container) {
 * 			if exprNode != nil && !c.checkTypeAssignableToAndOptionallyElaborate(exprType, returnType, node, exprNode, nil, nil) {
 * 				c.error(node, diagnostics.Return_type_of_constructor_signature_must_be_assignable_to_the_instance_type_of_the_class)
 * 			}
 * 		} else if c.getReturnTypeFromAnnotation(container) != nil {
 * 			unwrappedReturnType := core.OrElse(c.unwrapReturnType(returnType, functionFlags), returnType)
 * 			c.checkReturnExpression(container, unwrappedReturnType, node, node.Expression(), exprType, false)
 * 		}
 * 	} else if !ast.IsConstructorDeclaration(container) && c.compilerOptions.NoImplicitReturns.IsTrue() && !c.isUnwrappedReturnTypeUndefinedVoidOrAny(container, returnType) {
 * 		// The function has a return type, but the return statement doesn't have an expression.
 * 		c.error(node, diagnostics.Not_all_code_paths_return_a_value)
 * 	}
 * }
 */
export function Checker_checkReturnStatement(receiver: GoPtr<Checker>, node: GoPtr<Node>): void {
  if (Checker_checkGrammarStatementInAmbientContext(receiver, node)) {
    return;
  }
  const container = getContainingFunctionOrClassStaticBlock(node);
  if (container !== undefined && IsClassStaticBlockDeclaration(container)) {
    Checker_grammarErrorOnFirstToken(receiver, node, A_return_statement_cannot_be_used_inside_a_class_static_block);
    return;
  }
  if (container === undefined) {
    Checker_grammarErrorOnFirstToken(receiver, node, A_return_statement_can_only_be_used_within_a_function_body);
    return;
  }
  const signature = Checker_getSignatureFromDeclaration(receiver, container);
  const returnType = Checker_getReturnTypeOfSignature(receiver, signature);
  const functionFlags = GetFunctionFlags(container);
  const exprNode = Node_Expression(node);
  if (receiver!.strictNullChecks || exprNode !== undefined || (returnType!.flags & TypeFlagsNever) !== 0) {
    let exprType = receiver!.undefinedType;
    if (exprNode !== undefined) {
      exprType = Checker_checkExpressionCached(receiver, exprNode);
    }
    if (IsSetAccessorDeclaration(container)) {
      if (exprNode !== undefined) {
        Checker_error(receiver, node, Setters_cannot_return_a_value);
      }
    } else if (IsConstructorDeclaration(container)) {
      if (exprNode !== undefined && !Checker_checkTypeAssignableToAndOptionallyElaborate(receiver, exprType, returnType, node, exprNode, undefined, undefined)) {
        Checker_error(receiver, node, Return_type_of_constructor_signature_must_be_assignable_to_the_instance_type_of_the_class);
      }
    } else if (Checker_getReturnTypeFromAnnotation(receiver, container) !== undefined) {
      const unwrappedReturnType = OrElse(Checker_unwrapReturnType(receiver, returnType, functionFlags), returnType);
      Checker_checkReturnExpression(receiver, container, unwrappedReturnType, node, Node_Expression(node), exprType, false as bool);
    }
  } else if (!IsConstructorDeclaration(container) && Tristate_IsTrue(receiver!.compilerOptions!.NoImplicitReturns) && !Checker_isUnwrappedReturnTypeUndefinedVoidOrAny(receiver, container, returnType)) {
    Checker_error(receiver, node, Not_all_code_paths_return_a_value);
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.checkReturnExpression","kind":"method","status":"implemented","sigHash":"99ca7a7b46a44d4ea22df1befad0471725ffc7ebecdc7fdd593a682b434d33ff","bodyHash":"813772ada4a28518f937fbe5fd0d7b7be03cec3360322c7525d2b7422373ad00"}
 *
 * Go source:
 * func (c *Checker) checkReturnExpression(container *ast.Node, unwrappedReturnType *Type, node *ast.Node, expr *ast.Node, exprType *Type, inConditionalExpression bool) {
 * 	unwrappedExprType := exprType
 * 	functionFlags := ast.GetFunctionFlags(container)
 * 	if expr != nil {
 * 		unwrappedExpr := ast.SkipParentheses(expr)
 * 		if ast.IsConditionalExpression(unwrappedExpr) {
 * 			whenTrue := unwrappedExpr.AsConditionalExpression().WhenTrue
 * 			whenFalse := unwrappedExpr.AsConditionalExpression().WhenFalse
 * 			c.checkReturnExpression(container, unwrappedReturnType, node, whenTrue, c.checkExpression(whenTrue), true /*inConditionalExpression* /)
 * 			c.checkReturnExpression(container, unwrappedReturnType, node, whenFalse, c.checkExpression(whenFalse), true /*inConditionalExpression* /)
 * 			return
 * 		}
 * 	}
 * 	inReturnStatement := node.Kind == ast.KindReturnStatement
 * 	if functionFlags&ast.FunctionFlagsAsync != 0 {
 * 		unwrappedExprType = c.checkAwaitedType(exprType, false /*withAlias* /, node, diagnostics.The_return_type_of_an_async_function_must_either_be_a_valid_promise_or_must_not_contain_a_callable_then_member)
 * 	}
 * 	effectiveExpr := expr // The effective expression for diagnostics purposes.
 * 	if expr != nil {
 * 		effectiveExpr = c.getEffectiveCheckNode(expr)
 * 	}
 * 	errorNode := core.IfElse(inReturnStatement && !inConditionalExpression, node, effectiveExpr)
 * 	c.checkTypeAssignableToAndOptionallyElaborate(unwrappedExprType, unwrappedReturnType, errorNode, effectiveExpr, nil, nil)
 * }
 */
export function Checker_checkReturnExpression(receiver: GoPtr<Checker>, container: GoPtr<Node>, unwrappedReturnType: GoPtr<Type>, node: GoPtr<Node>, expr: GoPtr<Node>, exprType: GoPtr<Type>, inConditionalExpression: bool): void {
  let unwrappedExprType = exprType;
  const functionFlags = GetFunctionFlags(container);
  if (expr !== undefined) {
    const unwrappedExpr = SkipParentheses(expr);
    if (IsConditionalExpression(unwrappedExpr)) {
      const whenTrue = AsConditionalExpression(unwrappedExpr)!.WhenTrue;
      const whenFalse = AsConditionalExpression(unwrappedExpr)!.WhenFalse;
      Checker_checkReturnExpression(receiver, container, unwrappedReturnType, node, whenTrue, Checker_checkExpression(receiver, whenTrue), true as bool);
      Checker_checkReturnExpression(receiver, container, unwrappedReturnType, node, whenFalse, Checker_checkExpression(receiver, whenFalse), true as bool);
      return;
    }
  }
  const inReturnStatement = node!.Kind === KindReturnStatement;
  if ((functionFlags & FunctionFlagsAsync) !== 0) {
    unwrappedExprType = Checker_checkAwaitedType(receiver, exprType, false as bool, node, The_return_type_of_an_async_function_must_either_be_a_valid_promise_or_must_not_contain_a_callable_then_member);
  }
  let effectiveExpr = expr;
  if (expr !== undefined) {
    effectiveExpr = Checker_getEffectiveCheckNode(receiver, expr);
  }
  const errorNode = IfElse(inReturnStatement && !inConditionalExpression, node, effectiveExpr);
  Checker_checkTypeAssignableToAndOptionallyElaborate(receiver, unwrappedExprType, unwrappedReturnType, errorNode, effectiveExpr, undefined, undefined);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.checkWithStatement","kind":"method","status":"implemented","sigHash":"bc0772e15fd1f73af833af38a5127401149b5f095afd5ca424104adff3c5b163","bodyHash":"d70f37ebb0dbc63b98dfdadc6564e2a4b5997b17022e0888f0158fd0b8c1d2e3"}
 *
 * Go source:
 * func (c *Checker) checkWithStatement(node *ast.Node) {
 * 	if !c.checkGrammarStatementInAmbientContext(node) {
 * 		if node.Flags&ast.NodeFlagsAwaitContext != 0 {
 * 			c.grammarErrorOnFirstToken(node, diagnostics.X_with_statements_are_not_allowed_in_an_async_function_block)
 * 		}
 * 	}
 * 	c.checkExpression(node.Expression())
 * 	sourceFile := ast.GetSourceFileOfNode(node)
 * 	if !c.hasParseDiagnostics(sourceFile) {
 * 		start := scanner.SkipTrivia(sourceFile.Text(), node.Pos())
 * 		end := node.Statement().Pos()
 * 		c.grammarErrorAtPos(sourceFile.AsNode(), start, end-start, diagnostics.The_with_statement_is_not_supported_All_symbols_in_a_with_block_will_have_type_any)
 * 	}
 * }
 */
export function Checker_checkWithStatement(receiver: GoPtr<Checker>, node: GoPtr<Node>): void {
  if (!Checker_checkGrammarStatementInAmbientContext(receiver, node)) {
    if ((node!.Flags & NodeFlagsAwaitContext) !== 0) {
      Checker_grammarErrorOnFirstToken(receiver, node, X_with_statements_are_not_allowed_in_an_async_function_block);
    }
  }
  Checker_checkExpression(receiver, Node_Expression(node));
  const sourceFile = GetSourceFileOfNode(node);
  if (!Checker_hasParseDiagnostics(receiver, sourceFile)) {
    const start = SkipTrivia(SourceFile_Text(sourceFile), Node_Pos(node));
    const end = Node_Pos(Node_Statement(node));
    Checker_grammarErrorAtPos(receiver, Node_AsNode(sourceFile), start, end - start, The_with_statement_is_not_supported_All_symbols_in_a_with_block_will_have_type_any);
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.checkSwitchStatement","kind":"method","status":"implemented","sigHash":"a9b6cf76957a56642cd9d9f577735a9e07520cff9cf568a99b7ec4c5afcfd2b4","bodyHash":"3c33d64b0998d97a51442cd4bbabe50c628023a42ce7c12410985c9569eed29b"}
 *
 * Go source:
 * func (c *Checker) checkSwitchStatement(node *ast.Node) {
 * 	// Grammar checking
 * 	c.checkGrammarStatementInAmbientContext(node)
 * 	var firstDefaultClause *ast.Node
 * 	hasDuplicateDefaultClause := false
 * 	expressionType := c.checkExpression(node.Expression())
 * 	caseBlock := node.AsSwitchStatement().CaseBlock
 * 	for _, clause := range caseBlock.AsCaseBlock().Clauses.Nodes {
 * 		// Grammar check for duplicate default clauses, skip if we already report duplicate default clause
 * 		if ast.IsDefaultClause(clause) && !hasDuplicateDefaultClause {
 * 			if firstDefaultClause == nil {
 * 				firstDefaultClause = clause
 * 			} else {
 * 				c.grammarErrorOnNode(clause, diagnostics.A_default_clause_cannot_appear_more_than_once_in_a_switch_statement)
 * 				hasDuplicateDefaultClause = true
 * 			}
 * 		}
 * 		if ast.IsCaseClause(clause) {
 * 			caseType := c.checkExpression(clause.Expression())
 * 			if !c.isTypeEqualityComparableTo(expressionType, caseType) {
 * 				// expressionType is not comparable to caseType, try the reversed check and report errors if it fails
 * 				c.checkTypeComparableTo(caseType, expressionType, clause.Expression(), nil /*headMessage* /)
 * 			}
 * 		}
 * 		c.checkSourceElements(clause.Statements())
 * 		if c.compilerOptions.NoFallthroughCasesInSwitch.IsTrue() {
 * 			if flowNode := clause.AsCaseOrDefaultClause().FallthroughFlowNode; flowNode != nil && c.isReachableFlowNode(flowNode) {
 * 				c.error(clause, diagnostics.Fallthrough_case_in_switch)
 * 			}
 * 		}
 * 	}
 * 	if caseBlock.Locals() != nil {
 * 		c.registerForUnusedIdentifiersCheck(caseBlock)
 * 	}
 * }
 */
export function Checker_checkSwitchStatement(receiver: GoPtr<Checker>, node: GoPtr<Node>): void {
  Checker_checkGrammarStatementInAmbientContext(receiver, node);
  let firstDefaultClause: GoPtr<Node> = undefined;
  let hasDuplicateDefaultClause = false as bool;
  const expressionType = Checker_checkExpression(receiver, Node_Expression(node));
  const caseBlock = AsSwitchStatement(node)!.CaseBlock;
  for (const clause of AsCaseBlock(caseBlock)!.Clauses!.Nodes) {
    if (IsDefaultClause(clause) && !hasDuplicateDefaultClause) {
      if (firstDefaultClause === undefined) {
        firstDefaultClause = clause;
      } else {
        Checker_grammarErrorOnNode(receiver, clause, A_default_clause_cannot_appear_more_than_once_in_a_switch_statement);
        hasDuplicateDefaultClause = true as bool;
      }
    }
    if (IsCaseClause(clause)) {
      const caseType = Checker_checkExpression(receiver, Node_Expression(clause));
      if (!Checker_isTypeEqualityComparableTo(receiver, expressionType, caseType)) {
        Checker_checkTypeComparableTo(receiver, caseType, expressionType, Node_Expression(clause), undefined);
      }
    }
    Checker_checkSourceElements(receiver, Node_Statements(clause) || []);
    if (Tristate_IsTrue(receiver!.compilerOptions!.NoFallthroughCasesInSwitch)) {
      const flowNode = (AsCaseOrDefaultClause(clause) as unknown as { FallthroughFlowNode?: GoPtr<FlowNode> }).FallthroughFlowNode;
      if (flowNode !== undefined && Checker_isReachableFlowNode(receiver, flowNode)) {
        Checker_error(receiver, clause, Fallthrough_case_in_switch);
      }
    }
  }
  if ((Node_Locals(caseBlock)?.size ?? 0) !== 0) {
    Checker_registerForUnusedIdentifiersCheck(receiver, caseBlock);
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.checkLabeledStatement","kind":"method","status":"implemented","sigHash":"c6f846a645bde68026bfc9fc5b366aafdfb11e9d575397a5cc91ccecf545c243","bodyHash":"b6151930a63e05c7924ffcf9fdbc5baf19ef674a94d05b2ccdf127afca7281bd"}
 *
 * Go source:
 * func (c *Checker) checkLabeledStatement(node *ast.Node) {
 * 	labeledStatement := node.AsLabeledStatement()
 * 	labelNode := labeledStatement.Label
 * 	labelText := labelNode.Text()
 * 	if !c.checkGrammarStatementInAmbientContext(node) {
 * 		for current := node.Parent; current != nil && !ast.IsFunctionLike(current); current = current.Parent {
 * 			if ast.IsLabeledStatement(current) && current.Label().Text() == labelText {
 * 				c.grammarErrorOnNode(labelNode, diagnostics.Duplicate_label_0, labelText)
 * 				break
 * 			}
 * 		}
 * 	}
 * 	if labelNode.Flags&ast.NodeFlagsUnreachable != 0 && c.compilerOptions.AllowUnusedLabels != core.TSTrue {
 * 		c.errorOrSuggestion(c.compilerOptions.AllowUnusedLabels == core.TSFalse, labelNode, diagnostics.Unused_label)
 * 	}
 * 	c.checkSourceElement(labeledStatement.Statement)
 * }
 */
export function Checker_checkLabeledStatement(receiver: GoPtr<Checker>, node: GoPtr<Node>): void {
  const labeledStatement = AsLabeledStatement(node);
  const labelNode = labeledStatement!.Label;
  const labelText = Node_Text(labelNode);
  if (!Checker_checkGrammarStatementInAmbientContext(receiver, node)) {
    let current = node!.Parent;
    while (current !== undefined && !IsFunctionLike(current)) {
      if (IsLabeledStatement(current) && Node_Text(Node_Label(current)) === labelText) {
        Checker_grammarErrorOnNode(receiver, labelNode, Duplicate_label_0, labelText);
        break;
      }
      current = current!.Parent;
    }
  }
  if ((labelNode!.Flags & NodeFlagsUnreachable) !== 0 && receiver!.compilerOptions!.AllowUnusedLabels !== TSTrue) {
    Checker_errorOrSuggestion(receiver, receiver!.compilerOptions!.AllowUnusedLabels === TSFalse, labelNode, Unused_label);
  }
  Checker_checkSourceElement(receiver, labeledStatement!.Statement);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.checkThrowStatement","kind":"method","status":"implemented","sigHash":"ab9fd447ae1cb45abf1361374eb0a95afcf97b7cb043e02e5b31fe157f52aade","bodyHash":"dbbcabf840a9fc52bb7a8e0b70a8eac801be3f2a5794ae85646a259a69ce092f"}
 *
 * Go source:
 * func (c *Checker) checkThrowStatement(node *ast.Node) {
 * 	throwExpr := node.Expression()
 * 	if !c.checkGrammarStatementInAmbientContext(node) {
 * 		if ast.IsIdentifier(throwExpr) && len(throwExpr.Text()) == 0 {
 * 			c.grammarErrorAtPos(node, throwExpr.Pos(), 0 /*length* /, diagnostics.Line_break_not_permitted_here)
 * 		}
 * 	}
 * 	c.checkExpression(throwExpr)
 * }
 */
export function Checker_checkThrowStatement(receiver: GoPtr<Checker>, node: GoPtr<Node>): void {
  const throwExpr = Node_Expression(node);
  if (!Checker_checkGrammarStatementInAmbientContext(receiver, node)) {
    if (IsIdentifier(throwExpr) && Node_Text(throwExpr).length === 0) {
      Checker_grammarErrorAtPos(receiver, node, Node_Pos(throwExpr), 0, Line_break_not_permitted_here);
    }
  }
  Checker_checkExpression(receiver, throwExpr);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.checkTryStatement","kind":"method","status":"implemented","sigHash":"b08cf12db79f974ca311eeab4ea1486558e73b8ca4ec934a87ddfa5b765ec640","bodyHash":"0d3d7922b4f10cb8050b506715d29bb55776a889f8640e2af587f27294c445ec"}
 *
 * Go source:
 * func (c *Checker) checkTryStatement(node *ast.Node) {
 * 	c.checkGrammarStatementInAmbientContext(node)
 * 	data := node.AsTryStatement()
 * 	c.checkBlock(data.TryBlock)
 * 	if data.CatchClause != nil {
 * 		c.checkCatchClause(data.CatchClause)
 * 	}
 * 	if data.FinallyBlock != nil {
 * 		c.checkBlock(data.FinallyBlock)
 * 	}
 * }
 */
export function Checker_checkTryStatement(receiver: GoPtr<Checker>, node: GoPtr<Node>): void {
  Checker_checkGrammarStatementInAmbientContext(receiver, node);
  const data = AsTryStatement(node);
  Checker_checkBlock(receiver, data!.TryBlock);
  if (data!.CatchClause !== undefined) {
    Checker_checkCatchClause(receiver, data!.CatchClause);
  }
  if (data!.FinallyBlock !== undefined) {
    Checker_checkBlock(receiver, data!.FinallyBlock);
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.checkCatchClause","kind":"method","status":"implemented","sigHash":"c8ecfed7401dd3b03f50a2f777785b61b46c5fdce57af038e1ed25823235b441","bodyHash":"7e2948aec76dde2f49c862cf2b08d6da5551908290d1f852485ac417d29bfc76"}
 *
 * Go source:
 * func (c *Checker) checkCatchClause(node *ast.Node) {
 * 	declaration := node.AsCatchClause().VariableDeclaration
 * 	if declaration != nil {
 * 		c.checkVariableLikeDeclaration(declaration)
 * 		typeNode := declaration.Type()
 * 		if typeNode != nil {
 * 			t := c.getTypeFromTypeNode(typeNode)
 * 			if t != nil && t.flags&TypeFlagsAnyOrUnknown == 0 {
 * 				c.grammarErrorOnFirstToken(typeNode, diagnostics.Catch_clause_variable_type_annotation_must_be_any_or_unknown_if_specified)
 * 			}
 * 		} else if declaration.Initializer() != nil {
 * 			c.grammarErrorOnFirstToken(declaration.Initializer(), diagnostics.Catch_clause_variable_cannot_have_an_initializer)
 * 		} else {
 * 			blockLocals := node.AsCatchClause().Block.Locals()
 * 			if blockLocals != nil {
 * 				for caughtName := range node.Locals() {
 * 					if blockLocal := blockLocals[caughtName]; blockLocal != nil && blockLocal.ValueDeclaration != nil && blockLocal.Flags&ast.SymbolFlagsBlockScopedVariable != 0 {
 * 						c.grammarErrorOnNode(blockLocal.ValueDeclaration, diagnostics.Cannot_redeclare_identifier_0_in_catch_clause, caughtName)
 * 					}
 * 				}
 * 			}
 * 		}
 * 	}
 * 	c.checkBlock(node.AsCatchClause().Block)
 * }
 */
export function Checker_checkCatchClause(receiver: GoPtr<Checker>, node: GoPtr<Node>): void {
  const declaration = AsCatchClause(node)!.VariableDeclaration;
  if (declaration !== undefined) {
    Checker_checkVariableLikeDeclaration(receiver, declaration);
    const typeNode = Node_Type(declaration);
    if (typeNode !== undefined) {
      const t = Checker_getTypeFromTypeNode(receiver, typeNode);
      if (t !== undefined && (t!.flags & TypeFlagsAnyOrUnknown) === 0) {
        Checker_grammarErrorOnFirstToken(receiver, typeNode, Catch_clause_variable_type_annotation_must_be_any_or_unknown_if_specified);
      }
    } else if (Node_Initializer(declaration) !== undefined) {
      Checker_grammarErrorOnFirstToken(receiver, Node_Initializer(declaration), Catch_clause_variable_cannot_have_an_initializer);
    } else {
      const blockLocals = Node_Locals(AsCatchClause(node)!.Block);
      if ((blockLocals?.size ?? 0) !== 0) {
        for (const [caughtName] of Node_Locals(node) ?? []) {
          const blockLocal = blockLocals.get(caughtName);
          if (blockLocal !== undefined && blockLocal!.ValueDeclaration !== undefined && (blockLocal!.Flags & SymbolFlagsBlockScopedVariable) !== 0) {
            Checker_grammarErrorOnNode(receiver, blockLocal!.ValueDeclaration, Cannot_redeclare_identifier_0_in_catch_clause, caughtName);
          }
        }
      }
    }
  }
  Checker_checkBlock(receiver, AsCatchClause(node)!.Block);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.checkVariableStatement","kind":"method","status":"implemented","sigHash":"2df5af5c441c2a78d7c80fa600cf6f5e30a13a08267704408c4d4cccad4194bc","bodyHash":"307747fc4610c4bd2640200eda77e455d48ad5a6d4cccae2122f4bccbc8ea242"}
 *
 * Go source:
 * func (c *Checker) checkVariableStatement(node *ast.Node) {
 * 	varStatement := node.AsVariableStatement()
 * 	declarationList := varStatement.DeclarationList
 * 	if !c.checkGrammarModifiers(node) && !c.checkGrammarVariableDeclarationList(declarationList.AsVariableDeclarationList()) {
 * 		c.checkGrammarForDisallowedBlockScopedVariableStatement(varStatement)
 * 	}
 * 	c.checkVariableDeclarationList(declarationList)
 * }
 */
export function Checker_checkVariableStatement(receiver: GoPtr<Checker>, node: GoPtr<Node>): void {
  const varStatement = AsVariableStatement(node);
  const declarationList = varStatement!.DeclarationList;
  if (!Checker_checkGrammarModifiers(receiver, node) && !Checker_checkGrammarVariableDeclarationList(receiver, AsVariableDeclarationList(declarationList))) {
    Checker_checkGrammarForDisallowedBlockScopedVariableStatement(receiver, varStatement);
  }
  Checker_checkVariableDeclarationList(receiver, declarationList);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.isYieldIteratorResult","kind":"method","status":"implemented","sigHash":"c8d3142eec66fe29bb9332f82f2142ee4531c10059181a628fa5245ff10387a2","bodyHash":"e705e9f01aba6996b30687c65d92ea73cd05335dd90a3da94c6345e1976cf855"}
 *
 * Go source:
 * func (c *Checker) isYieldIteratorResult(t *Type) bool {
 * 	return c.isIteratorResult(t, IterationTypeKindYield)
 * }
 */
export function Checker_isYieldIteratorResult(receiver: GoPtr<Checker>, t: GoPtr<Type>): bool {
  return Checker_isIteratorResult(receiver, t, IterationTypeKindYield);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.isReturnIteratorResult","kind":"method","status":"implemented","sigHash":"6a72f0741a67c74b41794212a946345435c5f2a162f1d033b7498b9b44ade3bb","bodyHash":"de1545fc40af542ea10581f436f91c5513d82a1e771faea28cb4a13e0eba0a70"}
 *
 * Go source:
 * func (c *Checker) isReturnIteratorResult(t *Type) bool {
 * 	return c.isIteratorResult(t, IterationTypeKindReturn)
 * }
 */
export function Checker_isReturnIteratorResult(receiver: GoPtr<Checker>, t: GoPtr<Type>): bool {
  return Checker_isIteratorResult(receiver, t, IterationTypeKindReturn);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.reportUnusedVariable","kind":"method","status":"implemented","sigHash":"db6e01ee20b8379139760ea43268cacbed598ab54eb2c44be81ff0c8c7b66695","bodyHash":"3881f387b7298dbf60f71e43ef3441bfc3c664721672fba3d5f6e0babf2a5366"}
 *
 * Go source:
 * func (c *Checker) reportUnusedVariable(location *ast.Node, diagnostic *ast.Diagnostic) {
 * 	for ast.IsBindingElement(location) || ast.IsBindingPattern(location) {
 * 		location = location.Parent
 * 	}
 * 	c.reportUnused(location, core.IfElse(ast.IsParameterDeclaration(location), UnusedKindParameter, UnusedKindLocal), diagnostic)
 * }
 */
export function Checker_reportUnusedVariable(receiver: GoPtr<Checker>, location: GoPtr<Node>, diagnostic: GoPtr<Diagnostic>): void {
  let loc = location;
  while (IsBindingElement(loc) || IsBindingPattern(loc)) {
    loc = loc!.Parent;
  }
  Checker_reportUnused(receiver, loc, IfElse(IsParameterDeclaration(loc), UnusedKindParameter, UnusedKindLocal), diagnostic);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.reportUnusedVariables","kind":"method","status":"implemented","sigHash":"0d20e272694186b01eb97b201a80fe462d5f03246657079f0046851a9de2dd4f","bodyHash":"2b787dc7933626444da112df26e08210317b0a073aebcc8a82ab2edc03bbe7be"}
 *
 * Go source:
 * func (c *Checker) reportUnusedVariables(node *ast.Node) {
 * 	declarations := node.AsVariableDeclarationList().Declarations.Nodes
 * 	if len(declarations) > 1 && core.Every(declarations, c.isUnreferencedVariableDeclaration) {
 * 		c.reportUnusedVariable(node, NewDiagnosticForNode(node, diagnostics.All_variables_are_unused))
 * 	} else {
 * 		c.reportUnusedVariableDeclarations(declarations)
 * 	}
 * }
 */
export function Checker_reportUnusedVariables(receiver: GoPtr<Checker>, node: GoPtr<Node>): void {
  const declarations = AsVariableDeclarationList(node)!.Declarations!.Nodes;
  if (declarations.length > 1 && Every(declarations, (d) => Checker_isUnreferencedVariableDeclaration(receiver, d))) {
    Checker_reportUnusedVariable(receiver, node, NewDiagnosticForNode(node, All_variables_are_unused));
  } else {
    Checker_reportUnusedVariableDeclarations(receiver, declarations);
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.checkExpressionStatement","kind":"method","status":"implemented","sigHash":"21a4c68b9090ecdc18f67cdfcab5268ed1d290a31e505dc14bf81a92e47d57f9","bodyHash":"4178473b05d55e28de82aa7230a97573be728ffca7bf6322f081561e82cd554e"}
 *
 * Go source:
 * func (c *Checker) checkExpressionStatement(node *ast.Node) {
 * 	// Grammar checking
 * 	c.checkGrammarStatementInAmbientContext(node)
 * 	c.checkExpression(node.Expression())
 * }
 */
export function Checker_checkExpressionStatement(receiver: GoPtr<Checker>, node: GoPtr<Node>): void {
  Checker_checkGrammarStatementInAmbientContext(receiver, node);
  Checker_checkExpression(receiver, Node_Expression(node));
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getContextNode","kind":"method","status":"implemented","sigHash":"9d44152eb7cb05a9a7ec8de3c7e3f9276f0220a5c81995104271801203ef5d9b","bodyHash":"6e108989f2c95405c9fe2470b32df2545458bcfc214ba2e4dc0ad74d6f42aa5d"}
 *
 * Go source:
 * func (c *Checker) getContextNode(node *ast.Node) *ast.Node {
 * 	if ast.IsJsxAttributes(node) && !ast.IsJsxSelfClosingElement(node.Parent) {
 * 		// Needs to be the root JsxElement, so it encompasses the attributes _and_ the children (which are essentially part of the attributes)
 * 		return node.Parent.Parent
 * 	}
 * 	return node
 * }
 */
export function Checker_getContextNode(receiver: GoPtr<Checker>, node: GoPtr<Node>): GoPtr<Node> {
  if (IsJsxAttributes(node) && !IsJsxSelfClosingElement(node!.Parent)) {
    return node!.Parent!.Parent;
  }
  return node;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.checkExpressionCached","kind":"method","status":"implemented","sigHash":"797df407b316029940f1899bc42f31be4103b4fb2067a0be0762bc92a51972cf","bodyHash":"87949771134685ae631e1d6bce0cb5938f82db66468dbb695595336aaa886a99"}
 *
 * Go source:
 * func (c *Checker) checkExpressionCached(node *ast.Node) *Type {
 * 	return c.checkExpressionCachedEx(node, CheckModeNormal)
 * }
 */
export function Checker_checkExpressionCached(receiver: GoPtr<Checker>, node: GoPtr<Node>): GoPtr<Type> {
  return Checker_checkExpressionCachedEx(receiver, node, CheckModeNormal);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.checkExpressionCachedEx","kind":"method","status":"implemented","sigHash":"55526f03bb11723c8b24b03eca25a08f6eaabe3473f31db484c2f99768cc033a","bodyHash":"2db17af4190acec66ec5403894cae77267dac64595d06754330aab296a028ffa"}
 *
 * Go source:
 * func (c *Checker) checkExpressionCachedEx(node *ast.Node, checkMode CheckMode) *Type {
 * 	if checkMode != CheckModeNormal {
 * 		return c.checkExpressionEx(node, checkMode)
 * 	}
 * 	links := c.typeNodeLinks.Get(node)
 * 	if links.resolvedType == nil {
 * 		// When computing a type that we're going to cache, we need to ignore any ongoing control flow
 * 		// analysis because variables may have transient types in indeterminable states. Moving flowLoopStart
 * 		// to the top of the stack ensures all transient types are computed from a known point.
 * 		saveFlowLoopStack := c.flowLoopStack
 * 		saveFlowTypeCache := c.flowTypeCache
 * 		c.flowLoopStack = nil
 * 		c.flowTypeCache = nil
 * 		links.resolvedType = c.checkExpressionEx(node, checkMode)
 * 		c.flowTypeCache = saveFlowTypeCache
 * 		c.flowLoopStack = saveFlowLoopStack
 * 	}
 * 	return links.resolvedType
 * }
 */
export function Checker_checkExpressionCachedEx(receiver: GoPtr<Checker>, node: GoPtr<Node>, checkMode: CheckMode): GoPtr<Type> {
  if (checkMode !== CheckModeNormal) {
    return Checker_checkExpressionEx(receiver, node, checkMode);
  }
  const links = LinkStore_Get(receiver!.typeNodeLinks, node) as GoPtr<TypeNodeLinks>;
  if (links!.resolvedType === undefined) {
    const saveFlowLoopStack = receiver!.flowLoopStack;
    const saveFlowTypeCache = receiver!.flowTypeCache;
    receiver!.flowLoopStack = [];
    receiver!.flowTypeCache = undefined as unknown as GoMap<GoPtr<Node>, GoPtr<Type>>;
    links!.resolvedType = Checker_checkExpressionEx(receiver, node, checkMode);
    receiver!.flowTypeCache = saveFlowTypeCache;
    receiver!.flowLoopStack = saveFlowLoopStack;
  }
  return links!.resolvedType;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.checkExpression","kind":"method","status":"implemented","sigHash":"81797b5ec5b389fb4a11ed9f62c1106215c42900c68fda78073336b7347e6f13","bodyHash":"f9f2b95f80850b076e2f3a582c0450caf13257c06da75229897848d3bc834e05"}
 *
 * Go source:
 * func (c *Checker) checkExpression(node *ast.Node) *Type {
 * 	return c.checkExpressionEx(node, CheckModeNormal)
 * }
 */
export function Checker_checkExpression(receiver: GoPtr<Checker>, node: GoPtr<Node>): GoPtr<Type> {
  return Checker_checkExpressionEx(receiver, node, CheckModeNormal);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.checkExpressionEx","kind":"method","status":"implemented","sigHash":"31bd9e3fc117abfabc0575cde0857843657e3214d7e55490b82e7e0476269dc5","bodyHash":"6d15ed64bbe48c3b4af70c5311044f49e9dd3fe52bf5c7d9312b1bdca9e97804"}
 *
 * Go source:
 * func (c *Checker) checkExpressionEx(node *ast.Node, checkMode CheckMode) *Type {
 * 	if tr := c.tracer; tr != nil {
 * 		defer tr.Push(tracing.PhaseCheck, "checkExpression", map[string]any{"kind": node.Kind, "pos": node.Pos(), "end": node.End(), "path": ast.GetSourceFileOfNode(node).FileName()}, false)()
 * 	}
 * 	saveCurrentNode := c.currentNode
 * 	c.currentNode = node
 * 	c.instantiationCount = 0
 * 	uninstantiatedType := c.checkExpressionWorker(node, checkMode)
 * 	t := c.instantiateTypeWithSingleGenericCallSignature(node, uninstantiatedType, checkMode)
 * 	if isConstEnumObjectType(t) {
 * 		c.checkConstEnumAccess(node, t)
 * 	}
 * 	c.currentNode = saveCurrentNode
 * 	return t
 * }
 */
export function Checker_checkExpressionEx(receiver: GoPtr<Checker>, node: GoPtr<Node>, checkMode: CheckMode): GoPtr<Type> {
  const saveCurrentNode = receiver!.currentNode;
  receiver!.currentNode = node;
  receiver!.instantiationCount = 0;
  const uninstantiatedType = Checker_checkExpressionWorker(receiver, node, checkMode);
  const t = Checker_instantiateTypeWithSingleGenericCallSignature(receiver, node, uninstantiatedType, checkMode);
  if (isConstEnumObjectType(t)) {
    Checker_checkConstEnumAccess(receiver, node, t);
  }
  receiver!.currentNode = saveCurrentNode;
  return t;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.checkExpressionWorker","kind":"method","status":"implemented","sigHash":"105e7d5c8b4b0e027ee058f1999a2a659be48c67035fc2a5a6cc8e13226f5d89","bodyHash":"0280ce1cabe9f198511c120f1c05b45fde64c7983c5ffb54e82de7958bbbf710"}
 *
 * Go source:
 * func (c *Checker) checkExpressionWorker(node *ast.Node, checkMode CheckMode) *Type {
 * 	switch node.Kind {
 * 	case ast.KindIdentifier:
 * 		return c.checkIdentifier(node, checkMode)
 * 	case ast.KindPrivateIdentifier:
 * 		return c.checkPrivateIdentifierExpression(node)
 * 	case ast.KindThisKeyword:
 * 		return c.checkThisExpression(node)
 * 	case ast.KindSuperKeyword:
 * 		return c.checkSuperExpression(node)
 * 	case ast.KindNullKeyword:
 * 		return c.nullWideningType
 * 	case ast.KindStringLiteral, ast.KindNoSubstitutionTemplateLiteral:
 * 		if c.isSkipDirectInferenceNode(node) {
 * 			return c.blockedStringType
 * 		}
 * 		return c.getFreshTypeOfLiteralType(c.getStringLiteralType(node.Text()))
 * 	case ast.KindNumericLiteral:
 * 		c.checkGrammarNumericLiteral(node.AsNumericLiteral())
 * 		return c.getFreshTypeOfLiteralType(c.getNumberLiteralType(jsnum.FromString(node.Text())))
 * 	case ast.KindBigIntLiteral:
 * 		c.checkGrammarBigIntLiteral(node.AsBigIntLiteral())
 * 		return c.getFreshTypeOfLiteralType(c.getBigIntLiteralType(jsnum.NewPseudoBigInt(jsnum.ParsePseudoBigInt(node.Text()), false /*negative* /)))
 * 	case ast.KindTrueKeyword:
 * 		return c.trueType
 * 	case ast.KindFalseKeyword:
 * 		return c.falseType
 * 	case ast.KindTemplateExpression:
 * 		return c.checkTemplateExpression(node)
 * 	case ast.KindRegularExpressionLiteral:
 * 		return c.checkRegularExpressionLiteral(node)
 * 	case ast.KindArrayLiteralExpression:
 * 		return c.checkArrayLiteral(node, checkMode)
 * 	case ast.KindObjectLiteralExpression:
 * 		return c.checkObjectLiteral(node, checkMode)
 * 	case ast.KindPropertyAccessExpression:
 * 		return c.checkPropertyAccessExpression(node, checkMode, false /*writeOnly* /)
 * 	case ast.KindQualifiedName:
 * 		return c.checkQualifiedName(node, checkMode)
 * 	case ast.KindElementAccessExpression:
 * 		return c.checkIndexedAccess(node, checkMode)
 * 	case ast.KindCallExpression:
 * 		if ast.IsImportCall(node) {
 * 			return c.checkImportCallExpression(node)
 * 		}
 * 		return c.checkCallExpression(node, checkMode)
 * 	case ast.KindNewExpression:
 * 		return c.checkCallExpression(node, checkMode)
 * 	case ast.KindTaggedTemplateExpression:
 * 		return c.checkTaggedTemplateExpression(node)
 * 	case ast.KindParenthesizedExpression:
 * 		return c.checkParenthesizedExpression(node, checkMode)
 * 	case ast.KindClassExpression:
 * 		return c.checkClassExpression(node)
 * 	case ast.KindFunctionExpression, ast.KindArrowFunction:
 * 		return c.checkFunctionExpressionOrObjectLiteralMethod(node, checkMode)
 * 	case ast.KindTypeAssertionExpression, ast.KindAsExpression:
 * 		return c.checkAssertion(node, checkMode)
 * 	case ast.KindTypeOfExpression:
 * 		return c.checkTypeOfExpression(node)
 * 	case ast.KindNonNullExpression:
 * 		return c.checkNonNullAssertion(node)
 * 	case ast.KindExpressionWithTypeArguments:
 * 		return c.checkExpressionWithTypeArguments(node)
 * 	case ast.KindSatisfiesExpression:
 * 		return c.checkSatisfiesExpression(node)
 * 	case ast.KindMetaProperty:
 * 		return c.checkMetaProperty(node)
 * 	case ast.KindDeleteExpression:
 * 		return c.checkDeleteExpression(node)
 * 	case ast.KindVoidExpression:
 * 		return c.checkVoidExpression(node)
 * 	case ast.KindAwaitExpression:
 * 		return c.checkAwaitExpression(node)
 * 	case ast.KindPrefixUnaryExpression:
 * 		return c.checkPrefixUnaryExpression(node)
 * 	case ast.KindPostfixUnaryExpression:
 * 		return c.checkPostfixUnaryExpression(node)
 * 	case ast.KindBinaryExpression:
 * 		return c.checkBinaryExpression(node, checkMode)
 * 	case ast.KindConditionalExpression:
 * 		return c.checkConditionalExpression(node, checkMode)
 * 	case ast.KindSpreadElement:
 * 		return c.checkSpreadExpression(node, checkMode)
 * 	case ast.KindOmittedExpression:
 * 		return c.undefinedWideningType
 * 	case ast.KindYieldExpression:
 * 		return c.checkYieldExpression(node)
 * 	case ast.KindSyntheticExpression:
 * 		return c.checkSyntheticExpression(node)
 * 	case ast.KindJsxExpression:
 * 		return c.checkJsxExpression(node, checkMode)
 * 	case ast.KindJsxElement:
 * 		return c.checkJsxElement(node, checkMode)
 * 	case ast.KindJsxSelfClosingElement:
 * 		return c.checkJsxSelfClosingElement(node, checkMode)
 * 	case ast.KindJsxFragment:
 * 		return c.checkJsxFragment(node)
 * 	case ast.KindJsxAttributes:
 * 		return c.checkJsxAttributes(node, checkMode)
 * 	case ast.KindJsxOpeningElement:
 * 		panic("Should never directly check a JsxOpeningElement")
 * 	}
 * 	return c.errorType
 * }
 */
export function Checker_checkExpressionWorker(receiver: GoPtr<Checker>, node: GoPtr<Node>, checkMode: CheckMode): GoPtr<Type> {
  switch (node!.Kind) {
    case KindIdentifier:
      return Checker_checkIdentifier(receiver, node, checkMode);
    case KindPrivateIdentifier:
      return Checker_checkPrivateIdentifierExpression(receiver, node);
    case KindThisKeyword:
      return Checker_checkThisExpression(receiver, node);
    case KindSuperKeyword:
      return Checker_checkSuperExpression(receiver, node);
    case KindNullKeyword:
      return receiver!.nullWideningType;
    case KindStringLiteral:
    case KindNoSubstitutionTemplateLiteral:
      if (Checker_isSkipDirectInferenceNode(receiver, node)) {
        return receiver!.blockedStringType;
      }
      return Checker_getFreshTypeOfLiteralType(receiver, Checker_getStringLiteralType(receiver, Node_Text(node)));
    case KindNumericLiteral:
      Checker_checkGrammarNumericLiteral(receiver, AsNumericLiteral(node));
      return Checker_getFreshTypeOfLiteralType(receiver, Checker_getNumberLiteralType(receiver, FromString(Node_Text(node))));
    case KindBigIntLiteral:
      Checker_checkGrammarBigIntLiteral(receiver, AsBigIntLiteral(node));
      return Checker_getFreshTypeOfLiteralType(receiver, Checker_getBigIntLiteralType(receiver, NewPseudoBigInt(ParsePseudoBigInt(Node_Text(node)), false)));
    case KindTrueKeyword:
      return receiver!.trueType;
    case KindFalseKeyword:
      return receiver!.falseType;
    case KindTemplateExpression:
      return Checker_checkTemplateExpression(receiver, node);
    case KindRegularExpressionLiteral:
      return Checker_checkRegularExpressionLiteral(receiver, node);
    case KindArrayLiteralExpression:
      return Checker_checkArrayLiteral(receiver, node, checkMode);
    case KindObjectLiteralExpression:
      return Checker_checkObjectLiteral(receiver, node, checkMode);
    case KindPropertyAccessExpression:
      return Checker_checkPropertyAccessExpression(receiver, node, checkMode, false);
    case KindQualifiedName:
      return Checker_checkQualifiedName(receiver, node, checkMode);
    case KindElementAccessExpression:
      return Checker_checkIndexedAccess(receiver, node, checkMode);
    case KindCallExpression:
      if (IsImportCall(node)) {
        return Checker_checkImportCallExpression(receiver, node);
      }
      return Checker_checkCallExpression(receiver, node, checkMode);
    case KindNewExpression:
      return Checker_checkCallExpression(receiver, node, checkMode);
    case KindTaggedTemplateExpression:
      return Checker_checkTaggedTemplateExpression(receiver, node);
    case KindParenthesizedExpression:
      return Checker_checkParenthesizedExpression(receiver, node, checkMode);
    case KindClassExpression:
      return Checker_checkClassExpression(receiver, node);
    case KindFunctionExpression:
    case KindArrowFunction:
      return Checker_checkFunctionExpressionOrObjectLiteralMethod(receiver, node, checkMode);
    case KindTypeAssertionExpression:
    case KindAsExpression:
      return Checker_checkAssertion(receiver, node, checkMode);
    case KindTypeOfExpression:
      return Checker_checkTypeOfExpression(receiver, node);
    case KindNonNullExpression:
      return Checker_checkNonNullAssertion(receiver, node);
    case KindExpressionWithTypeArguments:
      return Checker_checkExpressionWithTypeArguments(receiver, node);
    case KindSatisfiesExpression:
      return Checker_checkSatisfiesExpression(receiver, node);
    case KindMetaProperty:
      return Checker_checkMetaProperty(receiver, node);
    case KindDeleteExpression:
      return Checker_checkDeleteExpression(receiver, node);
    case KindVoidExpression:
      return Checker_checkVoidExpression(receiver, node);
    case KindAwaitExpression:
      return Checker_checkAwaitExpression(receiver, node);
    case KindPrefixUnaryExpression:
      return Checker_checkPrefixUnaryExpression(receiver, node);
    case KindPostfixUnaryExpression:
      return Checker_checkPostfixUnaryExpression(receiver, node);
    case KindBinaryExpression:
      return Checker_checkBinaryExpression(receiver, node, checkMode);
    case KindConditionalExpression:
      return Checker_checkConditionalExpression(receiver, node, checkMode);
    case KindSpreadElement:
      return Checker_checkSpreadExpression(receiver, node, checkMode);
    case KindOmittedExpression:
      return receiver!.undefinedWideningType;
    case KindYieldExpression:
      return Checker_checkYieldExpression(receiver, node);
    case KindSyntheticExpression:
      return Checker_checkSyntheticExpression(receiver, node);
    case KindJsxExpression:
      return Checker_checkJsxExpression(receiver, node, checkMode);
    case KindJsxElement:
      return Checker_checkJsxElement(receiver, node, checkMode);
    case KindJsxSelfClosingElement:
      return Checker_checkJsxSelfClosingElement(receiver, node, checkMode);
    case KindJsxFragment:
      return Checker_checkJsxFragment(receiver, node);
    case KindJsxAttributes:
      return Checker_checkJsxAttributes(receiver, node, checkMode);
    case KindJsxOpeningElement:
      throw new globalThis.Error("Should never directly check a JsxOpeningElement");
  }
  return receiver!.errorType;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.checkSuperExpression","kind":"method","status":"implemented","sigHash":"65bd320b6b8676297abcbb01cf03081d0f8d20232e3918f43c2072b71f78e5b1","bodyHash":"ff50f6c944e24f91f30f50f36a09de18bbf865b56291f95b6cd207dde6dab859"}
 *
 * Go source:
 * func (c *Checker) checkSuperExpression(node *ast.Node) *Type {
 * 	isCallExpression := ast.IsCallExpression(node.Parent) && node.Parent.Expression() == node
 * 	immediateContainer := getSuperContainer(node, true /*stopOnFunctions* /)
 * 	container := immediateContainer
 * 
 * 	// adjust the container reference in case if super is used inside arrow functions with arbitrarily deep nesting
 * 	if !isCallExpression {
 * 		for container != nil && ast.IsArrowFunction(container) {
 * 			container = getSuperContainer(container, true /*stopOnFunctions* /)
 * 		}
 * 	}
 * 
 * 	isLegalUsageOfSuperExpression := func() bool {
 * 		if isCallExpression {
 * 			// TS 1.0 SPEC (April 2014): 4.8.1
 * 			// Super calls are only permitted in constructors of derived classes
 * 			return ast.IsConstructorDeclaration(container)
 * 		}
 * 		// TS 1.0 SPEC (April 2014)
 * 		// 'super' property access is allowed
 * 		// - In a constructor, instance member function, instance member accessor, or instance member variable initializer where this references a derived class instance
 * 		// - In a static member function or static member accessor
 * 
 * 		// topmost container must be something that is directly nested in the class declaration\object literal expression
 * 		if ast.IsClassLike(container.Parent) || ast.IsObjectLiteralExpression(container.Parent) {
 * 			if ast.IsStatic(container) {
 * 				return ast.NodeKindIs(container, ast.KindMethodDeclaration, ast.KindMethodSignature, ast.KindGetAccessor, ast.KindSetAccessor, ast.KindPropertyDeclaration, ast.KindClassStaticBlockDeclaration)
 * 			}
 * 			return ast.NodeKindIs(container, ast.KindMethodDeclaration, ast.KindMethodSignature, ast.KindGetAccessor, ast.KindSetAccessor, ast.KindPropertyDeclaration, ast.KindPropertySignature, ast.KindConstructor)
 * 		}
 * 		return false
 * 	}
 * 
 * 	if container == nil || !isLegalUsageOfSuperExpression() {
 * 		// issue more specific error if super is used in computed property name
 * 		// class A { foo() { return "1" }}
 * 		// class B {
 * 		//     [super.foo()]() {}
 * 		// }
 * 		current := ast.FindAncestorOrQuit(node, func(n *ast.Node) ast.FindAncestorResult {
 * 			if n == container {
 * 				return ast.FindAncestorQuit
 * 			}
 * 			if ast.IsComputedPropertyName(n) {
 * 				return ast.FindAncestorTrue
 * 			}
 * 			return ast.FindAncestorFalse
 * 		})
 * 		switch {
 * 		case current != nil && ast.IsComputedPropertyName(current):
 * 			c.error(node, diagnostics.X_super_cannot_be_referenced_in_a_computed_property_name)
 * 		case isCallExpression:
 * 			c.error(node, diagnostics.Super_calls_are_not_permitted_outside_constructors_or_in_nested_functions_inside_constructors)
 * 		case container == nil || container.Parent == nil || !(ast.IsClassLike(container.Parent) || ast.IsObjectLiteralExpression(container.Parent)):
 * 			c.error(node, diagnostics.X_super_can_only_be_referenced_in_members_of_derived_classes_or_object_literal_expressions)
 * 		default:
 * 			c.error(node, diagnostics.X_super_property_access_is_permitted_only_in_a_constructor_member_function_or_member_accessor_of_a_derived_class)
 * 		}
 * 		return c.errorType
 * 	}
 * 	if !isCallExpression && ast.IsConstructorDeclaration(immediateContainer) {
 * 		c.checkThisBeforeSuper(node, container, diagnostics.X_super_must_be_called_before_accessing_a_property_of_super_in_the_constructor_of_a_derived_class)
 * 	}
 * 	if container.Parent.Kind == ast.KindObjectLiteralExpression {
 * 		// for object literal assume that type of 'super' is 'any'
 * 		return c.anyType
 * 	}
 * 	// at this point the only legal case for parent is ClassLikeDeclaration
 * 	classLikeDeclaration := container.Parent
 * 	if ast.GetExtendsHeritageClauseElement(classLikeDeclaration) == nil {
 * 		c.error(node, diagnostics.X_super_can_only_be_referenced_in_a_derived_class)
 * 		return c.errorType
 * 	}
 * 	if c.classDeclarationExtendsNull(classLikeDeclaration) {
 * 		if isCallExpression {
 * 			return c.errorType
 * 		}
 * 		return c.nullWideningType
 * 	}
 * 	classType := c.getDeclaredTypeOfSymbol(c.getSymbolOfDeclaration(classLikeDeclaration))
 * 	var baseClassType *Type
 * 	if classType != nil {
 * 		baseClassType = core.FirstOrNil(c.getBaseTypes(classType))
 * 	}
 * 	if baseClassType == nil {
 * 		return c.errorType
 * 	}
 * 	if ast.IsConstructorDeclaration(container) && c.isInConstructorArgumentInitializer(node, container) {
 * 		// issue custom error message for super property access in constructor arguments (to be aligned with old compiler)
 * 		c.error(node, diagnostics.X_super_cannot_be_referenced_in_constructor_arguments)
 * 		return c.errorType
 * 	}
 * 	if ast.IsStatic(container) || isCallExpression {
 * 		if !isCallExpression &&
 * 			c.languageVersion <= core.ScriptTargetES2021 &&
 * 			(ast.IsPropertyDeclaration(container) || ast.IsClassStaticBlockDeclaration(container)) {
 * 			// for `super.x` or `super[x]` in a static initializer, mark all enclosing
 * 			// block scope containers so that we can report potential collisions with
 * 			// `Reflect`.
 * 			for current := ast.GetEnclosingBlockScopeContainer(node.Parent); current != nil; current = ast.GetEnclosingBlockScopeContainer(current) {
 * 				if !ast.IsSourceFile(current) || ast.IsExternalOrCommonJSModule(current.AsSourceFile()) {
 * 					c.nodeLinks.Get(current).flags |= NodeCheckFlagsContainsSuperPropertyInStaticInitializer
 * 				}
 * 			}
 * 		}
 * 		return c.getBaseConstructorTypeOfClass(classType)
 * 	}
 * 	return c.getTypeWithThisArgument(baseClassType, classType.AsInterfaceType().thisType, false)
 * }
 */
export function Checker_checkSuperExpression(receiver: GoPtr<Checker>, node: GoPtr<Node>): GoPtr<Type> {
  const isCallExpression = node!.Parent !== undefined && node!.Parent!.Kind === KindCallExpression && Node_Expression(node!.Parent) === node;
  const immediateContainer = getSuperContainer(node, true);
  let container = immediateContainer;

  if (!isCallExpression) {
    while (container !== undefined && IsArrowFunction(container)) {
      container = getSuperContainer(container, true);
    }
  }

  const isLegalUsageOfSuperExpression = (): bool => {
    if (isCallExpression) {
      return IsConstructorDeclaration(container);
    }
    if (container !== undefined && container!.Parent !== undefined && (IsClassLike(container!.Parent) || IsObjectLiteralExpression(container!.Parent))) {
      if (IsStatic(container)) {
        return NodeKindIs(container, KindMethodDeclaration, KindMethodSignature, KindGetAccessor, KindSetAccessor, KindPropertyDeclaration, KindClassStaticBlockDeclaration);
      }
      return NodeKindIs(container, KindMethodDeclaration, KindMethodSignature, KindGetAccessor, KindSetAccessor, KindPropertyDeclaration, KindPropertySignature, KindConstructor);
    }
    return false;
  };

  if (container === undefined || !isLegalUsageOfSuperExpression()) {
    const current = FindAncestorOrQuit(node, (n: GoPtr<Node>) => {
      if (n === container) {
        return FindAncestorQuit;
      }
      if (IsComputedPropertyName(n)) {
        return FindAncestorTrue;
      }
      return FindAncestorFalse;
    });
    if (current !== undefined && IsComputedPropertyName(current)) {
      Checker_error(receiver, node, X_super_cannot_be_referenced_in_a_computed_property_name);
    } else if (isCallExpression) {
      Checker_error(receiver, node, Super_calls_are_not_permitted_outside_constructors_or_in_nested_functions_inside_constructors);
    } else if (container === undefined || container!.Parent === undefined || !(IsClassLike(container!.Parent) || IsObjectLiteralExpression(container!.Parent))) {
      Checker_error(receiver, node, X_super_can_only_be_referenced_in_members_of_derived_classes_or_object_literal_expressions);
    } else {
      Checker_error(receiver, node, X_super_property_access_is_permitted_only_in_a_constructor_member_function_or_member_accessor_of_a_derived_class);
    }
    return receiver!.errorType;
  }
  if (!isCallExpression && IsConstructorDeclaration(immediateContainer)) {
    Checker_checkThisBeforeSuper(receiver, node, container, X_super_must_be_called_before_accessing_a_property_of_super_in_the_constructor_of_a_derived_class);
  }
  if (container!.Parent!.Kind === KindObjectLiteralExpression) {
    return receiver!.anyType;
  }
  const classLikeDeclaration = container!.Parent;
  if (GetExtendsHeritageClauseElement(classLikeDeclaration) === undefined) {
    Checker_error(receiver, node, X_super_can_only_be_referenced_in_a_derived_class);
    return receiver!.errorType;
  }
  if (Checker_classDeclarationExtendsNull(receiver, classLikeDeclaration)) {
    if (isCallExpression) {
      return receiver!.errorType;
    }
    return receiver!.nullWideningType;
  }
  const classType = Checker_getDeclaredTypeOfSymbol(receiver, Checker_getSymbolOfDeclaration(receiver, classLikeDeclaration));
  let baseClassType: GoPtr<Type>;
  if (classType !== undefined) {
    baseClassType = FirstOrNil(Checker_getBaseTypes(receiver, classType));
  }
  if (baseClassType === undefined) {
    return receiver!.errorType;
  }
  if (IsConstructorDeclaration(container) && Checker_isInConstructorArgumentInitializer(receiver, node, container)) {
    Checker_error(receiver, node, X_super_cannot_be_referenced_in_constructor_arguments);
    return receiver!.errorType;
  }
  if (IsStatic(container) || isCallExpression) {
    if (
      !isCallExpression &&
      receiver!.languageVersion <= ScriptTargetES2021 &&
      (NodeKindIs(container, KindPropertyDeclaration) || IsClassStaticBlockDeclaration(container))
    ) {
      for (let current = GetEnclosingBlockScopeContainer(node!.Parent); current !== undefined; current = GetEnclosingBlockScopeContainer(current)) {
        if (!IsSourceFile(current) || IsExternalOrCommonJSModule(AsSourceFile(current))) {
          (LinkStore_Get(receiver!.nodeLinks, current) as GoPtr<NodeLinks>)!.flags |= NodeCheckFlagsContainsSuperPropertyInStaticInitializer;
        }
      }
    }
    return Checker_getBaseConstructorTypeOfClass(receiver, classType);
  }
  return Checker_getTypeWithThisArgument(receiver, baseClassType, Type_AsInterfaceType(classType)!.thisType, false);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.resolveNewExpression","kind":"method","status":"implemented","sigHash":"8a47b2162d02435b75fbb4d861b25b846ff133aa869ee2a9e738af5f20205d9a","bodyHash":"0e05b7e72d36969eda35ffbf98747ffe602a0b10f76086fffb618f8aa47850e4"}
 *
 * Go source:
 * func (c *Checker) resolveNewExpression(node *ast.Node, candidatesOutArray *[]*Signature, checkMode CheckMode) *Signature {
 * 	expressionType := c.checkNonNullExpression(node.Expression())
 * 	if expressionType == c.silentNeverType {
 * 		return c.silentNeverSignature
 * 	}
 * 	// If expressionType's apparent type(section 3.8.1) is an object type with one or
 * 	// more construct signatures, the expression is processed in the same manner as a
 * 	// function call, but using the construct signatures as the initial set of candidate
 * 	// signatures for overload resolution. The result type of the function call becomes
 * 	// the result type of the operation.
 * 	expressionType = c.getApparentType(expressionType)
 * 	if c.isErrorType(expressionType) {
 * 		// Another error has already been reported
 * 		return c.resolveErrorCall(node)
 * 	}
 * 	// TS 1.0 spec: 4.11
 * 	// If expressionType is of type Any, Args can be any argument
 * 	// list and the result of the operation is of type Any.
 * 	if IsTypeAny(expressionType) {
 * 		if len(node.TypeArguments()) != 0 {
 * 			c.error(node, diagnostics.Untyped_function_calls_may_not_accept_type_arguments)
 * 		}
 * 		return c.resolveUntypedCall(node)
 * 	}
 * 	// Technically, this signatures list may be incomplete. We are taking the apparent type,
 * 	// but we are not including construct signatures that may have been added to the Object or
 * 	// Function interface, since they have none by default. This is a bit of a leap of faith
 * 	// that the user will not add any.
 * 	constructSignatures := c.getSignaturesOfType(expressionType, SignatureKindConstruct)
 * 	if len(constructSignatures) != 0 {
 * 		if !c.isConstructorAccessible(node, constructSignatures[0]) {
 * 			return c.resolveErrorCall(node)
 * 		}
 * 		// If the expression is a class of abstract type, or an abstract construct signature,
 * 		// then it cannot be instantiated.
 * 		// In the case of a merged class-module or class-interface declaration,
 * 		// only the class declaration node will have the Abstract flag set.
 * 		if someSignature(constructSignatures, func(sig *Signature) bool {
 * 			return sig.flags&SignatureFlagsAbstract != 0
 * 		}) {
 * 			c.error(node, diagnostics.Cannot_create_an_instance_of_an_abstract_class)
 * 			return c.resolveErrorCall(node)
 * 		}
 * 		if expressionType.symbol != nil {
 * 			valueDecl := ast.GetClassLikeDeclarationOfSymbol(expressionType.symbol)
 * 			if valueDecl != nil && ast.HasModifier(valueDecl, ast.ModifierFlagsAbstract) {
 * 				c.error(node, diagnostics.Cannot_create_an_instance_of_an_abstract_class)
 * 				return c.resolveErrorCall(node)
 * 			}
 * 		}
 * 		return c.resolveCall(node, constructSignatures, candidatesOutArray, checkMode, SignatureFlagsNone, nil)
 * 	}
 * 	// If expressionType's apparent type is an object type with no construct signatures but
 * 	// one or more call signatures, the expression is processed as a function call. A compile-time
 * 	// error occurs if the result of the function call is not Void. The type of the result of the
 * 	// operation is Any. It is an error to have a Void this type.
 * 	callSignatures := c.getSignaturesOfType(expressionType, SignatureKindCall)
 * 	if len(callSignatures) != 0 {
 * 		signature := c.resolveCall(node, callSignatures, candidatesOutArray, checkMode, SignatureFlagsNone, nil)
 * 		if !c.noImplicitAny {
 * 			if signature.declaration != nil && c.getReturnTypeOfSignature(signature) != c.voidType {
 * 				c.error(node, diagnostics.Only_a_void_function_can_be_called_with_the_new_keyword)
 * 			}
 * 			if c.getThisTypeOfSignature(signature) == c.voidType {
 * 				c.error(node, diagnostics.A_function_that_is_called_with_the_new_keyword_cannot_have_a_this_type_that_is_void)
 * 			}
 * 		}
 * 		return signature
 * 	}
 * 	c.invocationError(node.Expression(), expressionType, SignatureKindConstruct, nil)
 * 	return c.resolveErrorCall(node)
 * }
 */
export function Checker_resolveNewExpression(receiver: GoPtr<Checker>, node: GoPtr<Node>, candidatesOutArray: GoPtr<GoSlice<GoPtr<Signature>>>, checkMode: CheckMode): GoPtr<Signature> {
  let expressionType = Checker_checkNonNullExpression(receiver, Node_Expression(node));
  if (expressionType === receiver!.silentNeverType) {
    return receiver!.silentNeverSignature;
  }
  expressionType = Checker_getApparentType(receiver, expressionType);
  if (Checker_isErrorType(receiver, expressionType)) {
    return Checker_resolveErrorCall(receiver, node);
  }
  if (IsTypeAny(expressionType)) {
    if ((Node_TypeArguments(node) ?? []).length !== 0) {
      Checker_error(receiver, node, Untyped_function_calls_may_not_accept_type_arguments);
    }
    return Checker_resolveUntypedCall(receiver, node);
  }
  const constructSignatures = Checker_getSignaturesOfType(receiver, expressionType, SignatureKindConstruct);
  if (constructSignatures.length !== 0) {
    if (!Checker_isConstructorAccessible(receiver, node, constructSignatures[0])) {
      return Checker_resolveErrorCall(receiver, node);
    }
    if (someSignature(constructSignatures, (signature) => (signature!.flags & SignatureFlagsAbstract) !== 0)) {
      Checker_error(receiver, node, Cannot_create_an_instance_of_an_abstract_class);
      return Checker_resolveErrorCall(receiver, node);
    }
    if (expressionType!["symbol"] !== undefined) {
      const valueDeclaration = GetClassLikeDeclarationOfSymbol(expressionType!["symbol"]);
      if (valueDeclaration !== undefined && HasModifier(valueDeclaration, ModifierFlagsAbstract)) {
        Checker_error(receiver, node, Cannot_create_an_instance_of_an_abstract_class);
        return Checker_resolveErrorCall(receiver, node);
      }
    }
    return Checker_resolveCall(receiver, node, constructSignatures, candidatesOutArray, checkMode, SignatureFlagsNone, undefined);
  }
  const callSignatures = Checker_getSignaturesOfType(receiver, expressionType, SignatureKindCall);
  if (callSignatures.length !== 0) {
    const signature = Checker_resolveCall(receiver, node, callSignatures, candidatesOutArray, checkMode, SignatureFlagsNone, undefined);
    if (!receiver!.noImplicitAny) {
      if (signature!.declaration !== undefined && Checker_getReturnTypeOfSignature(receiver, signature) !== receiver!.voidType) {
        Checker_error(receiver, node, Only_a_void_function_can_be_called_with_the_new_keyword);
      }
      if (Checker_getThisTypeOfSignature(receiver, signature) === receiver!.voidType) {
        Checker_error(receiver, node, A_function_that_is_called_with_the_new_keyword_cannot_have_a_this_type_that_is_void);
      }
    }
    return signature;
  }
  Checker_invocationError(receiver, Node_Expression(node), expressionType, SignatureKindConstruct, undefined);
  return Checker_resolveErrorCall(receiver, node);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.resolveInstanceofExpression","kind":"method","status":"implemented","sigHash":"2d8f498ac5bffc3bf268aafddf73dca51418ef3592e08a635521fde73a6011a6","bodyHash":"b9fc552852c48b36d318f94bc4427992fe15a5a0abdfe2c866ee0a2fc7201f99"}
 *
 * Go source:
 * func (c *Checker) resolveInstanceofExpression(node *ast.Node, candidatesOutArray *[]*Signature, checkMode CheckMode) *Signature {
 * 	// if rightType is an object type with a custom `[Symbol.hasInstance]` method, then it is potentially
 * 	// valid on the right-hand side of the `instanceof` operator. This allows normal `object` types to
 * 	// participate in `instanceof`, as per Step 2 of https://tc39.es/ecma262/#sec-instanceofoperator.
 * 	right := node.AsBinaryExpression().Right
 * 	rightType := c.checkExpression(right)
 * 	if !IsTypeAny(rightType) {
 * 		hasInstanceMethodType := c.getSymbolHasInstanceMethodOfObjectType(rightType)
 * 		if hasInstanceMethodType != nil {
 * 			apparentType := c.getApparentType(hasInstanceMethodType)
 * 			if c.isErrorType(apparentType) {
 * 				return c.resolveErrorCall(node)
 * 			}
 * 			callSignatures := c.getSignaturesOfType(apparentType, SignatureKindCall)
 * 			constructSignatures := c.getSignaturesOfType(apparentType, SignatureKindConstruct)
 * 			if c.isUntypedFunctionCall(hasInstanceMethodType, apparentType, len(callSignatures), len(constructSignatures)) {
 * 				return c.resolveUntypedCall(node)
 * 			}
 * 			if len(callSignatures) != 0 {
 * 				return c.resolveCall(node, callSignatures, candidatesOutArray, checkMode, SignatureFlagsNone, nil)
 * 			}
 * 		} else if !(c.typeHasCallOrConstructSignatures(rightType) || c.isTypeSubtypeOf(rightType, c.globalFunctionType)) {
 * 			c.error(right, diagnostics.The_right_hand_side_of_an_instanceof_expression_must_be_either_of_type_any_a_class_function_or_other_type_assignable_to_the_Function_interface_type_or_an_object_type_with_a_Symbol_hasInstance_method)
 * 			return c.resolveErrorCall(node)
 * 		}
 * 	}
 * 	// fall back to a default signature
 * 	return c.anySignature
 * }
 */
export function Checker_resolveInstanceofExpression(receiver: GoPtr<Checker>, node: GoPtr<Node>, candidatesOutArray: GoPtr<GoSlice<GoPtr<Signature>>>, checkMode: CheckMode): GoPtr<Signature> {
  const right = AsBinaryExpression(node)!.Right;
  const rightType = Checker_checkExpression(receiver, right);
  if (!IsTypeAny(rightType)) {
    const hasInstanceMethodType = Checker_getSymbolHasInstanceMethodOfObjectType(receiver, rightType);
    if (hasInstanceMethodType !== undefined) {
      const apparentType = Checker_getApparentType(receiver, hasInstanceMethodType);
      if (Checker_isErrorType(receiver, apparentType)) {
        return Checker_resolveErrorCall(receiver, node);
      }
      const callSignatures = Checker_getSignaturesOfType(receiver, apparentType, SignatureKindCall);
      const constructSignatures = Checker_getSignaturesOfType(receiver, apparentType, SignatureKindConstruct);
      if (Checker_isUntypedFunctionCall(receiver, hasInstanceMethodType, apparentType, callSignatures.length, constructSignatures.length)) {
        return Checker_resolveUntypedCall(receiver, node);
      }
      if (callSignatures.length !== 0) {
        return Checker_resolveCall(receiver, node, callSignatures, candidatesOutArray, checkMode, SignatureFlagsNone, undefined);
      }
    } else if (!(Checker_typeHasCallOrConstructSignatures(receiver, rightType) || Checker_isTypeSubtypeOf(receiver, rightType, receiver!.globalFunctionType))) {
      Checker_error(
        receiver,
        right,
        The_right_hand_side_of_an_instanceof_expression_must_be_either_of_type_any_a_class_function_or_other_type_assignable_to_the_Function_interface_type_or_an_object_type_with_a_Symbol_hasInstance_method,
      );
      return Checker_resolveErrorCall(receiver, node);
    }
  }
  return receiver!.anySignature;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.maybeAddMissingAwaitInfo","kind":"method","status":"implemented","sigHash":"5c185b032aee21d09ef6cf6494672d7d9cfdfd65786a9a5084217ab23d5361a6","bodyHash":"2aec0c8c7e9c90ad0d84c1196f5e9eb9b14f4673eab4bf51b3e13cc71b2de9af"}
 *
 * Go source:
 * func (c *Checker) maybeAddMissingAwaitInfo(errorNode *ast.Node, source *Type, target *Type, relation *Relation, reportErrors bool, diagnosticOutput *[]*ast.Diagnostic) {
 * 	if errorNode != nil && reportErrors && diagnosticOutput != nil && len(*diagnosticOutput) != 0 {
 * 		// Bail if target is Promise-like---something else is wrong
 * 		if c.getAwaitedTypeOfPromise(target) != nil {
 * 			return
 * 		}
 * 		awaitedTypeOfSource := c.getAwaitedTypeOfPromise(source)
 * 		if awaitedTypeOfSource != nil && c.isTypeRelatedTo(awaitedTypeOfSource, target, relation) {
 * 			(*diagnosticOutput)[0].AddRelatedInfo(NewDiagnosticForNode(errorNode, diagnostics.Did_you_forget_to_use_await))
 * 		}
 * 	}
 * }
 */
export function Checker_maybeAddMissingAwaitInfo(receiver: GoPtr<Checker>, errorNode: GoPtr<Node>, source: GoPtr<Type>, target: GoPtr<Type>, relation: GoPtr<Relation>, reportErrors: bool, diagnosticOutput: GoPtr<GoSlice<GoPtr<Diagnostic>>>): void {
  if (errorNode !== undefined && reportErrors && diagnosticOutput !== undefined && diagnosticOutput.length !== 0) {
    if (Checker_getAwaitedTypeOfPromise(receiver, target) !== undefined) {
      return;
    }
    const awaitedTypeOfSource = Checker_getAwaitedTypeOfPromise(receiver, source);
    if (awaitedTypeOfSource !== undefined && Checker_isTypeRelatedTo(receiver, awaitedTypeOfSource, target, relation)) {
      Diagnostic_AddRelatedInfo(diagnosticOutput[0], NewDiagnosticForNode(errorNode, Did_you_forget_to_use_await));
    }
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getEffectiveCheckNode","kind":"method","status":"implemented","sigHash":"ef899aac6cb64571d3faac0a01c272c4a916cb8108ada5d17804cf32c5f90aba","bodyHash":"0295e2de9030adb25ae86f517f1109b0e2bc586c3e28d0fcb62dbf7eee6b3cc6"}
 *
 * Go source:
 * func (c *Checker) getEffectiveCheckNode(argument *ast.Node) *ast.Node {
 * 	flags := core.IfElse(
 * 		ast.IsInJSFile(argument),
 * 		ast.OEKParentheses|ast.OEKSatisfies|ast.OEKExcludeJSDocTypeAssertion,
 * 		ast.OEKParentheses|ast.OEKSatisfies,
 * 	)
 * 	return ast.SkipOuterExpressions(argument, flags)
 * }
 */
export function Checker_getEffectiveCheckNode(receiver: GoPtr<Checker>, argument: GoPtr<Node>): GoPtr<Node> {
  const flags = IfElse(
    IsInJSFile(argument),
    (OEKParentheses | OEKSatisfies | OEKExcludeJSDocTypeAssertion) as OuterExpressionKinds,
    (OEKParentheses | OEKSatisfies) as OuterExpressionKinds,
  );
  return SkipOuterExpressions(argument as GoPtr<Expression>, flags) as GoPtr<Node>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.isGenericFunctionReturningFunction","kind":"method","status":"implemented","sigHash":"94646c88f0c73adf7aa7e7c0dca2ef8814c8292a3a7f5dfe11766da8315b629c","bodyHash":"a4b99dd56e6e615a3f54010bad5ba3c415adcfe321b06443534024c41cca405d"}
 *
 * Go source:
 * func (c *Checker) isGenericFunctionReturningFunction(signature *Signature) bool {
 * 	return len(signature.typeParameters) != 0 && c.isFunctionType(c.getReturnTypeOfSignature(signature))
 * }
 */
export function Checker_isGenericFunctionReturningFunction(receiver: GoPtr<Checker>, signature: GoPtr<Signature>): bool {
  return signature!.typeParameters.length !== 0 && Checker_isFunctionType(receiver, Checker_getReturnTypeOfSignature(receiver, signature));
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.skippedGenericFunction","kind":"method","status":"implemented","sigHash":"08ffca68b5910381e028d20a5541c284d5a49ba670f28a424a0341cf1c7e8fe0","bodyHash":"6804d6b3996488af843e4902a5a0de1df26d87530380fc2702ab165fb0f4dbfa"}
 *
 * Go source:
 * func (c *Checker) skippedGenericFunction(node *ast.Node, checkMode CheckMode) {
 * 	if checkMode&CheckModeInferential != 0 {
 * 		// We have skipped a generic function during inferential typing. Obtain the inference context and
 * 		// indicate this has occurred such that we know a second pass of inference is be needed.
 * 		context := c.getInferenceContext(node)
 * 		context.flags |= InferenceFlagsSkippedGenericFunction
 * 	}
 * }
 */
export function Checker_skippedGenericFunction(receiver: GoPtr<Checker>, node: GoPtr<Node>, checkMode: CheckMode): void {
  if ((checkMode & CheckModeInferential) !== 0) {
    const context = Checker_getInferenceContext(receiver, node);
    context!.flags |= InferenceFlagsSkippedGenericFunction;
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.checkParenthesizedExpression","kind":"method","status":"implemented","sigHash":"b3dc6afe3288d6ce46e7e171cb71433faded9b32746681e95c56855ee898209d","bodyHash":"c9998282a3f719e45baec70504ce623789ee9fe082ea1565649ef00ef48041a4"}
 *
 * Go source:
 * func (c *Checker) checkParenthesizedExpression(node *ast.Node, checkMode CheckMode) *Type {
 * 	return c.checkExpressionEx(node.Expression(), checkMode)
 * }
 */
export function Checker_checkParenthesizedExpression(receiver: GoPtr<Checker>, node: GoPtr<Node>, checkMode: CheckMode): GoPtr<Type> {
  return Checker_checkExpressionEx(receiver, Node_Expression(node), checkMode);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.recordPotentialCollisionWithWeakMapSetInGeneratedCode","kind":"method","status":"implemented","sigHash":"1154d0bf7d51adb62a370a8dd265fdcc7a9e5e5c11efad20cec05c7e37b61d75","bodyHash":"7cd041912e0368eb6936231abe554c95242a2c6178acb9cdee2fc6af9e8d2b73"}
 *
 * Go source:
 * func (c *Checker) recordPotentialCollisionWithWeakMapSetInGeneratedCode(node *ast.Node, name *ast.Node) {
 * 	if c.languageVersion <= core.ScriptTargetES2021 &&
 * 		(c.needCollisionCheckForIdentifier(node, name, "WeakMap") || c.needCollisionCheckForIdentifier(node, name, "WeakSet")) {
 * 		c.addDeferredDiagnostic(func() {
 * 			c.checkWeakMapSetCollision(node)
 * 		})
 * 	}
 * }
 */
export function Checker_recordPotentialCollisionWithWeakMapSetInGeneratedCode(receiver: GoPtr<Checker>, node: GoPtr<Node>, name: GoPtr<Node>): void {
  if (receiver!.languageVersion <= ScriptTargetES2021 &&
    (Checker_needCollisionCheckForIdentifier(receiver, node, name, "WeakMap") || Checker_needCollisionCheckForIdentifier(receiver, node, name, "WeakSet"))) {
    Checker_addDeferredDiagnostic(receiver, () => {
      Checker_checkWeakMapSetCollision(receiver, node);
    });
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.recordPotentialCollisionWithReflectInGeneratedCode","kind":"method","status":"implemented","sigHash":"f41693570e4825824017166532bd8285e5326824dd1bbadd7cb3927b4a7bf018","bodyHash":"69d65883e689bae4725b279aef16c9c0b76dbae328dabfe4604357922968b6e2"}
 *
 * Go source:
 * func (c *Checker) recordPotentialCollisionWithReflectInGeneratedCode(node *ast.Node, name *ast.Node) {
 * 	if name != nil && c.languageVersion <= core.ScriptTargetES2021 && c.needCollisionCheckForIdentifier(node, name, "Reflect") {
 * 		c.addDeferredDiagnostic(func() {
 * 			c.checkReflectCollision(node)
 * 		})
 * 	}
 * }
 */
export function Checker_recordPotentialCollisionWithReflectInGeneratedCode(receiver: GoPtr<Checker>, node: GoPtr<Node>, name: GoPtr<Node>): void {
  if (name !== undefined && receiver!.languageVersion <= ScriptTargetES2021 && Checker_needCollisionCheckForIdentifier(receiver, node, name, "Reflect")) {
    Checker_addDeferredDiagnostic(receiver, () => {
      Checker_checkReflectCollision(receiver, node);
    });
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.checkDeleteExpression","kind":"method","status":"implemented","sigHash":"c883fdc30813916390edbc644a1f0bf3e3dea3fd69025b6b49b409a3fa3cd90c","bodyHash":"efe589ce180b24c486d75aae964c2116554c22b7f4bb5a956106730f116695f7"}
 *
 * Go source:
 * func (c *Checker) checkDeleteExpression(node *ast.Node) *Type {
 * 	c.checkExpression(node.Expression())
 * 	expr := ast.SkipParentheses(node.Expression())
 * 	if !ast.IsAccessExpression(expr) {
 * 		c.error(expr, diagnostics.The_operand_of_a_delete_operator_must_be_a_property_reference)
 * 		return c.booleanType
 * 	}
 * 	if ast.IsPropertyAccessExpression(expr) && ast.IsPrivateIdentifier(expr.Name()) {
 * 		c.error(expr, diagnostics.The_operand_of_a_delete_operator_cannot_be_a_private_identifier)
 * 	}
 * 	symbol := c.getExportSymbolOfValueSymbolIfExported(c.getResolvedSymbolOrNil(expr))
 * 	if symbol != nil {
 * 		if c.isReadonlySymbol(symbol) {
 * 			c.error(expr, diagnostics.The_operand_of_a_delete_operator_cannot_be_a_read_only_property)
 * 		} else {
 * 			c.checkDeleteExpressionMustBeOptional(expr, symbol)
 * 		}
 * 	}
 * 	return c.booleanType
 * }
 */
export function Checker_checkDeleteExpression(receiver: GoPtr<Checker>, node: GoPtr<Node>): GoPtr<Type> {
  Checker_checkExpression(receiver, Node_Expression(node) as GoPtr<Node>);
  const expr = SkipParentheses(Node_Expression(node) as GoPtr<Node>);
  if (!IsAccessExpression(expr)) {
    Checker_error(receiver, expr, The_operand_of_a_delete_operator_must_be_a_property_reference);
    return receiver!.booleanType;
  }
  if (IsPropertyAccessExpression(expr) && IsPrivateIdentifier(Node_Name(expr))) {
    Checker_error(receiver, expr, The_operand_of_a_delete_operator_cannot_be_a_private_identifier);
  }
  const symbol_ = Checker_getExportSymbolOfValueSymbolIfExported(receiver, Checker_getResolvedSymbolOrNil(receiver, expr));
  if (symbol_ !== undefined) {
    if (Checker_isReadonlySymbol(receiver, symbol_)) {
      Checker_error(receiver, expr, The_operand_of_a_delete_operator_cannot_be_a_read_only_property);
    } else {
      Checker_checkDeleteExpressionMustBeOptional(receiver, expr, symbol_);
    }
  }
  return receiver!.booleanType;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.checkDeleteExpressionMustBeOptional","kind":"method","status":"implemented","sigHash":"cdda74b57ed3ceeee5d0dc10fbf04424f62f492c8596b6fd56757f86b3cf211d","bodyHash":"0433ccc486f2f43c25bc5a727a7799a4eed3a734fa28777325d094228d29753a"}
 *
 * Go source:
 * func (c *Checker) checkDeleteExpressionMustBeOptional(expr *ast.Node, symbol *ast.Symbol) {
 * 	t := c.getTypeOfSymbol(symbol)
 * 	if c.strictNullChecks && t.flags&(TypeFlagsAnyOrUnknown|TypeFlagsNever) == 0 {
 * 		var isOptional bool
 * 		if c.exactOptionalPropertyTypes {
 * 			isOptional = symbol.Flags&ast.SymbolFlagsOptional != 0
 * 		} else {
 * 			isOptional = c.hasTypeFacts(t, TypeFactsIsUndefined)
 * 		}
 * 		if !isOptional {
 * 			c.error(expr, diagnostics.The_operand_of_a_delete_operator_must_be_optional)
 * 		}
 * 	}
 * }
 */
export function Checker_checkDeleteExpressionMustBeOptional(receiver: GoPtr<Checker>, expr: GoPtr<Node>, symbol_: GoPtr<Symbol>): void {
  const t = Checker_getTypeOfSymbol(receiver, symbol_);
  if (receiver!.strictNullChecks && (t!.flags & (TypeFlagsAnyOrUnknown | TypeFlagsNever)) === 0) {
    let isOptional: bool;
    if (receiver!.exactOptionalPropertyTypes) {
      isOptional = (symbol_!.Flags & SymbolFlagsOptional) !== 0;
    } else {
      isOptional = Checker_hasTypeFacts(receiver, t, TypeFactsIsUndefined);
    }
    if (!isOptional) {
      Checker_error(receiver, expr, The_operand_of_a_delete_operator_must_be_optional);
    }
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.checkAwaitExpression","kind":"method","status":"implemented","sigHash":"17c30161bbc79fc1ed85b35725b04d8b86a6498644a0387c2cf8fe827d0d0ed4","bodyHash":"243489682abfb5dc8b2a3c612e70e01b165a21685452573736e9b80c2a9d5c32"}
 *
 * Go source:
 * func (c *Checker) checkAwaitExpression(node *ast.Node) *Type {
 * 	c.checkGrammarAwaitOrAwaitUsing(node)
 * 	operandType := c.checkExpression(node.Expression())
 * 	awaitedType := c.checkAwaitedType(operandType, true /*withAlias* /, node, diagnostics.Type_of_await_operand_must_either_be_a_valid_promise_or_must_not_contain_a_callable_then_member)
 * 	if awaitedType == operandType && !c.isErrorType(awaitedType) && operandType.flags&TypeFlagsAnyOrUnknown == 0 {
 * 		c.addErrorOrSuggestion(false, createDiagnosticForNode(node, diagnostics.X_await_has_no_effect_on_the_type_of_this_expression))
 * 	}
 * 	return awaitedType
 * }
 */
export function Checker_checkAwaitExpression(receiver: GoPtr<Checker>, node: GoPtr<Node>): GoPtr<Type> {
  Checker_checkGrammarAwaitOrAwaitUsing(receiver, node);
  const operandType = Checker_checkExpression(receiver, Node_Expression(node));
  const awaitedType = Checker_checkAwaitedType(receiver, operandType, true, node, Type_of_await_operand_must_either_be_a_valid_promise_or_must_not_contain_a_callable_then_member);
  if (awaitedType === operandType && !Checker_isErrorType(receiver, awaitedType) && (operandType!.flags & TypeFlagsAnyOrUnknown) === 0) {
    Checker_addErrorOrSuggestion(receiver, false, createDiagnosticForNode(node, X_await_has_no_effect_on_the_type_of_this_expression));
  }
  return awaitedType;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.checkPrefixUnaryExpression","kind":"method","status":"implemented","sigHash":"c610d53b7cece49af9ecbed7367a4ec98979f304bdc5698b85a78a39c58ffbc8","bodyHash":"3d8c2bbc4244b7670327f86361bb2d4913b1fde76eeee15d327eaad7d468dca7"}
 *
 * Go source:
 * func (c *Checker) checkPrefixUnaryExpression(node *ast.Node) *Type {
 * 	expr := node.AsPrefixUnaryExpression()
 * 	operandType := c.checkExpression(expr.Operand)
 * 	if operandType == c.silentNeverType {
 * 		return c.silentNeverType
 * 	}
 * 	switch expr.Operand.Kind {
 * 	case ast.KindNumericLiteral:
 * 		switch expr.Operator {
 * 		case ast.KindMinusToken:
 * 			return c.getFreshTypeOfLiteralType(c.getNumberLiteralType(-jsnum.FromString(expr.Operand.Text())))
 * 		case ast.KindPlusToken:
 * 			return c.getFreshTypeOfLiteralType(c.getNumberLiteralType(+jsnum.FromString(expr.Operand.Text())))
 * 		}
 * 	case ast.KindBigIntLiteral:
 * 		if expr.Operator == ast.KindMinusToken {
 * 			return c.getFreshTypeOfLiteralType(c.getBigIntLiteralType(jsnum.NewPseudoBigInt(jsnum.ParsePseudoBigInt(expr.Operand.Text()), true /*negative* /)))
 * 		}
 * 	}
 * 	switch expr.Operator {
 * 	case ast.KindPlusToken, ast.KindMinusToken, ast.KindTildeToken:
 * 		c.checkNonNullType(operandType, expr.Operand)
 * 		if c.maybeTypeOfKindConsideringBaseConstraint(operandType, TypeFlagsESSymbolLike) {
 * 			c.error(expr.Operand, diagnostics.The_0_operator_cannot_be_applied_to_type_symbol, scanner.TokenToString(expr.Operator))
 * 		}
 * 		if expr.Operator == ast.KindPlusToken {
 * 			if c.maybeTypeOfKindConsideringBaseConstraint(operandType, TypeFlagsBigIntLike) {
 * 				c.error(expr.Operand, diagnostics.Operator_0_cannot_be_applied_to_type_1, scanner.TokenToString(expr.Operator), c.TypeToString(c.getBaseTypeOfLiteralType(operandType)))
 * 			}
 * 			return c.numberType
 * 		}
 * 		return c.getUnaryResultType(operandType)
 * 	case ast.KindExclamationToken:
 * 		c.checkTruthinessOfType(operandType, expr.Operand)
 * 		facts := c.getTypeFacts(operandType, TypeFactsTruthy|TypeFactsFalsy)
 * 		switch {
 * 		case facts == TypeFactsTruthy:
 * 			return c.falseType
 * 		case facts == TypeFactsFalsy:
 * 			return c.trueType
 * 		default:
 * 			return c.booleanType
 * 		}
 * 	case ast.KindPlusPlusToken, ast.KindMinusMinusToken:
 * 		ok := c.checkArithmeticOperandType(expr.Operand, c.checkNonNullType(operandType, expr.Operand), diagnostics.An_arithmetic_operand_must_be_of_type_any_number_bigint_or_an_enum_type, false)
 * 		if ok {
 * 			// run check only if former checks succeeded to avoid reporting cascading errors
 * 			c.checkReferenceExpression(expr.Operand, diagnostics.The_operand_of_an_increment_or_decrement_operator_must_be_a_variable_or_a_property_access, diagnostics.The_operand_of_an_increment_or_decrement_operator_may_not_be_an_optional_property_access)
 * 		}
 * 		return c.getUnaryResultType(operandType)
 * 	}
 * 	return c.errorType
 * }
 */
export function Checker_checkPrefixUnaryExpression(receiver: GoPtr<Checker>, node: GoPtr<Node>): GoPtr<Type> {
  const expr = AsPrefixUnaryExpression(node)!;
  const operandType = Checker_checkExpression(receiver, expr.Operand);
  if (operandType === receiver!.silentNeverType) {
    return receiver!.silentNeverType;
  }
  switch (expr.Operand!.Kind) {
    case KindNumericLiteral:
      switch (expr.Operator) {
        case KindMinusToken:
          return Checker_getFreshTypeOfLiteralType(receiver, Checker_getNumberLiteralType(receiver, -FromString(Node_Text(expr.Operand)) as Number));
        case KindPlusToken:
          return Checker_getFreshTypeOfLiteralType(receiver, Checker_getNumberLiteralType(receiver, +FromString(Node_Text(expr.Operand)) as Number));
      }
      break;
    case KindBigIntLiteral:
      if (expr.Operator === KindMinusToken) {
        return Checker_getFreshTypeOfLiteralType(receiver, Checker_getBigIntLiteralType(receiver, NewPseudoBigInt(ParsePseudoBigInt(Node_Text(expr.Operand)), true)));
      }
      break;
  }
  switch (expr.Operator) {
    case KindPlusToken:
    case KindMinusToken:
    case KindTildeToken:
      Checker_checkNonNullType(receiver, operandType, expr.Operand);
      if (Checker_maybeTypeOfKindConsideringBaseConstraint(receiver, operandType, TypeFlagsESSymbolLike)) {
        Checker_error(receiver, expr.Operand, The_0_operator_cannot_be_applied_to_type_symbol, TokenToString(expr.Operator));
      }
      if (expr.Operator === KindPlusToken) {
        if (Checker_maybeTypeOfKindConsideringBaseConstraint(receiver, operandType, TypeFlagsBigIntLike)) {
          Checker_error(receiver, expr.Operand, Operator_0_cannot_be_applied_to_type_1, TokenToString(expr.Operator), Checker_TypeToString(receiver, Checker_getBaseTypeOfLiteralType(receiver, operandType)));
        }
        return receiver!.numberType;
      }
      return Checker_getUnaryResultType(receiver, operandType);
    case KindExclamationToken: {
      Checker_checkTruthinessOfType(receiver, operandType, expr.Operand);
      const facts = Checker_getTypeFacts(receiver, operandType, TypeFactsTruthy | TypeFactsFalsy);
      switch (facts) {
        case TypeFactsTruthy:
          return receiver!.falseType;
        case TypeFactsFalsy:
          return receiver!.trueType;
        default:
          return receiver!.booleanType;
      }
    }
    case KindPlusPlusToken:
    case KindMinusMinusToken: {
      const ok = Checker_checkArithmeticOperandType(
        receiver,
        expr.Operand,
        Checker_checkNonNullType(receiver, operandType, expr.Operand),
        An_arithmetic_operand_must_be_of_type_any_number_bigint_or_an_enum_type,
        false,
      );
      if (ok) {
        Checker_checkReferenceExpression(
          receiver,
          expr.Operand,
          The_operand_of_an_increment_or_decrement_operator_must_be_a_variable_or_a_property_access,
          The_operand_of_an_increment_or_decrement_operator_may_not_be_an_optional_property_access,
        );
      }
      return Checker_getUnaryResultType(receiver, operandType);
    }
  }
  return receiver!.errorType;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.checkPostfixUnaryExpression","kind":"method","status":"implemented","sigHash":"dba67508ee9c8a5bcaa20ee59c4a3f3c5130a2ecd6afbf976d8dd27550468ce4","bodyHash":"7e953c640d76eb0ce4baddcaf974503dba2fed9cf9cde297c24a3ac9abf02029"}
 *
 * Go source:
 * func (c *Checker) checkPostfixUnaryExpression(node *ast.Node) *Type {
 * 	expr := node.AsPostfixUnaryExpression()
 * 	operandType := c.checkExpression(expr.Operand)
 * 	if operandType == c.silentNeverType {
 * 		return c.silentNeverType
 * 	}
 * 	ok := c.checkArithmeticOperandType(expr.Operand, c.checkNonNullType(operandType, expr.Operand), diagnostics.An_arithmetic_operand_must_be_of_type_any_number_bigint_or_an_enum_type, false)
 * 	if ok {
 * 		// run check only if former checks succeeded to avoid reporting cascading errors
 * 		c.checkReferenceExpression(expr.Operand, diagnostics.The_operand_of_an_increment_or_decrement_operator_must_be_a_variable_or_a_property_access, diagnostics.The_operand_of_an_increment_or_decrement_operator_may_not_be_an_optional_property_access)
 * 	}
 * 	return c.getUnaryResultType(operandType)
 * }
 */
export function Checker_checkPostfixUnaryExpression(receiver: GoPtr<Checker>, node: GoPtr<Node>): GoPtr<Type> {
  const expr = AsPostfixUnaryExpression(node)!;
  const operandType = Checker_checkExpression(receiver, expr.Operand);
  if (operandType === receiver!.silentNeverType) {
    return receiver!.silentNeverType;
  }
  const ok = Checker_checkArithmeticOperandType(
    receiver,
    expr.Operand,
    Checker_checkNonNullType(receiver, operandType, expr.Operand),
    An_arithmetic_operand_must_be_of_type_any_number_bigint_or_an_enum_type,
    false,
  );
  if (ok) {
    Checker_checkReferenceExpression(
      receiver,
      expr.Operand,
      The_operand_of_an_increment_or_decrement_operator_must_be_a_variable_or_a_property_access,
      The_operand_of_an_increment_or_decrement_operator_may_not_be_an_optional_property_access,
    );
  }
  return Checker_getUnaryResultType(receiver, operandType);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.checkSpreadExpression","kind":"method","status":"implemented","sigHash":"ea28f33c4c792dc8dc6ee3b45dc136c7ec32e335a19f40f31ea1a6e8637cd34a","bodyHash":"935a89ed85ee2fbfbe72eaedd4ac99375f1814c02818ead10b1c7ba5ce928969"}
 *
 * Go source:
 * func (c *Checker) checkSpreadExpression(node *ast.Node, checkMode CheckMode) *Type {
 * 	arrayOrIterableType := c.checkExpressionEx(node.Expression(), checkMode)
 * 	return c.checkIteratedTypeOrElementType(IterationUseSpread, arrayOrIterableType, c.undefinedType, node.Expression())
 * }
 */
export function Checker_checkSpreadExpression(receiver: GoPtr<Checker>, node: GoPtr<Node>, checkMode: CheckMode): GoPtr<Type> {
  const arrayOrIterableType = Checker_checkExpressionEx(receiver, Node_Expression(node), checkMode);
  return Checker_checkIteratedTypeOrElementType(receiver, IterationUseSpread, arrayOrIterableType, receiver!.undefinedType, Node_Expression(node));
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.checkYieldExpression","kind":"method","status":"implemented","sigHash":"ca5351ce5b1396a25f75d6b3f3665519cc09ba0f1c550fec2775a1fa0cd8b7e8","bodyHash":"f74258dfa6dabc87032d5f3162d9e7cdb7e79fffda3d5920dc3f9b8f2711db4d"}
 *
 * Go source:
 * func (c *Checker) checkYieldExpression(node *ast.Node) *Type {
 * 	c.checkGrammarYieldExpression(node)
 * 	fn := ast.GetContainingFunction(node)
 * 	if fn == nil {
 * 		return c.anyType
 * 	}
 * 	functionFlags := ast.GetFunctionFlags(fn)
 * 	if functionFlags&ast.FunctionFlagsGenerator == 0 {
 * 		// If the user's code is syntactically correct, the func should always have a star. After all, we are in a yield context.
 * 		return c.anyType
 * 	}
 * 	isAsync := (functionFlags & ast.FunctionFlagsAsync) != 0
 * 	if node.AsYieldExpression().AsteriskToken != nil {
 * 		// Async generator functions prior to ES2018 require the __await, __asyncDelegator,
 * 		// and __asyncValues helpers
 * 		if isAsync && c.languageVersion < LanguageFeatureMinimumTarget.AsyncGenerators {
 * 			c.checkExternalEmitHelpers(node, ExternalEmitHelpersAsyncDelegatorIncludes)
 * 		}
 * 	}
 * 	// There is no point in doing an assignability check if the function
 * 	// has no explicit return type because the return type is directly computed
 * 	// from the yield expressions.
 * 	returnType := c.getReturnTypeFromAnnotation(fn)
 * 	if returnType != nil && returnType.flags&TypeFlagsUnion != 0 {
 * 		returnType = c.filterType(returnType, func(t *Type) bool {
 * 			return c.checkGeneratorInstantiationAssignabilityToReturnType(t, functionFlags, nil /*errorNode* /)
 * 		})
 * 	}
 * 	var iterationTypes IterationTypes
 * 	if returnType != nil {
 * 		iterationTypes = c.getIterationTypesOfGeneratorFunctionReturnType(returnType, isAsync)
 * 	}
 * 	signatureYieldType := core.OrElse(iterationTypes.yieldType, c.anyType)
 * 	signatureNextType := core.OrElse(iterationTypes.nextType, c.anyType)
 * 	var yieldExpressionType *Type
 * 	if node.Expression() != nil {
 * 		yieldExpressionType = c.checkExpression(node.Expression())
 * 	} else {
 * 		yieldExpressionType = c.undefinedWideningType
 * 	}
 * 	yieldedType := c.getYieldedTypeOfYieldExpression(node, yieldExpressionType, signatureNextType, isAsync)
 * 	if returnType != nil && yieldedType != nil {
 * 		c.checkTypeAssignableToAndOptionallyElaborate(yieldedType, signatureYieldType, core.OrElse(node.Expression(), node), node.Expression(), nil, nil)
 * 	}
 * 	if node.AsYieldExpression().AsteriskToken != nil {
 * 		use := core.IfElse(isAsync, IterationUseAsyncYieldStar, IterationUseYieldStar)
 * 		return core.OrElse(c.getIterationTypeOfIterable(use, IterationTypeKindReturn, yieldExpressionType, node.Expression()), c.anyType)
 * 	}
 * 	if returnType != nil {
 * 		return core.OrElse(c.getIterationTypeOfGeneratorFunctionReturnType(IterationTypeKindNext, returnType, isAsync), c.anyType)
 * 	}
 * 	t := c.getContextualIterationType(IterationTypeKindNext, fn)
 * 	if t == nil {
 * 		t = c.anyType
 * 		if c.noImplicitAny && !expressionResultIsUnused(node) {
 * 			contextualType := c.getContextualType(node, ContextFlagsNone)
 * 			if contextualType == nil || IsTypeAny(contextualType) {
 * 				c.error(node, diagnostics.X_yield_expression_implicitly_results_in_an_any_type_because_its_containing_generator_lacks_a_return_type_annotation)
 * 			}
 * 		}
 * 	}
 * 	return t
 * }
 */
export function Checker_checkYieldExpression(receiver: GoPtr<Checker>, node: GoPtr<Node>): GoPtr<Type> {
  Checker_checkGrammarYieldExpression(receiver, node);
  const fn = GetContainingFunction(node);
  if (fn === undefined) {
    return receiver!.anyType;
  }
  const functionFlags = GetFunctionFlags(fn);
  if ((functionFlags & FunctionFlagsGenerator) === 0) {
    return receiver!.anyType;
  }
  const isAsync = (functionFlags & FunctionFlagsAsync) !== 0;
  if (AsYieldExpression(node)!.AsteriskToken !== undefined) {
    // Async generator functions prior to ES2018 require the __await, __asyncDelegator,
    // and __asyncValues helpers
    if (isAsync && receiver!.languageVersion < LanguageFeatureMinimumTarget.AsyncGenerators) {
      Checker_checkExternalEmitHelpers(receiver, node, ExternalEmitHelpersAsyncDelegatorIncludes);
    }
  }
  let returnType = Checker_getReturnTypeFromAnnotation(receiver, fn);
  if (returnType !== undefined && (returnType!.flags & TypeFlagsUnion) !== 0) {
    returnType = Checker_filterType(
      receiver,
      returnType,
      (t) => Checker_checkGeneratorInstantiationAssignabilityToReturnType(receiver, t, functionFlags, undefined),
    );
  }
  let iterationTypes: IterationTypes = { yieldType: undefined, returnType: undefined, nextType: undefined };
  if (returnType !== undefined) {
    iterationTypes = Checker_getIterationTypesOfGeneratorFunctionReturnType(receiver, returnType, isAsync);
  }
  const signatureYieldType = OrElse(iterationTypes.yieldType, receiver!.anyType);
  const signatureNextType = OrElse(iterationTypes.nextType, receiver!.anyType);
  const yieldExpr = AsYieldExpression(node)!;
  const expression = Node_Expression(node);
  const yieldExpressionType = expression !== undefined ? Checker_checkExpression(receiver, expression) : receiver!.undefinedWideningType;
  const yieldedType = Checker_getYieldedTypeOfYieldExpression(receiver, node, yieldExpressionType, signatureNextType, isAsync);
  if (returnType !== undefined && yieldedType !== undefined) {
    Checker_checkTypeAssignableToAndOptionallyElaborate(receiver, yieldedType, signatureYieldType, OrElse(expression, node), expression, undefined, undefined);
  }
  if (yieldExpr.AsteriskToken !== undefined) {
    const use = IfElse(isAsync, IterationUseAsyncYieldStar, IterationUseYieldStar);
    return OrElse(Checker_getIterationTypeOfIterable(receiver, use, IterationTypeKindReturn, yieldExpressionType, expression), receiver!.anyType);
  }
  if (returnType !== undefined) {
    return OrElse(Checker_getIterationTypeOfGeneratorFunctionReturnType(receiver, IterationTypeKindNext, returnType, isAsync), receiver!.anyType);
  }
  let t = Checker_getContextualIterationType(receiver, IterationTypeKindNext, fn);
  if (t === undefined) {
    t = receiver!.anyType;
    if (receiver!.noImplicitAny && !expressionResultIsUnused(node)) {
      const contextualType = Checker_getContextualType(receiver, node, ContextFlagsNone);
      if (contextualType === undefined || IsTypeAny(contextualType)) {
        Checker_error(receiver, node, X_yield_expression_implicitly_results_in_an_any_type_because_its_containing_generator_lacks_a_return_type_annotation);
      }
    }
  }
  return t;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.checkSyntheticExpression","kind":"method","status":"implemented","sigHash":"7cbd4943e113fa60511df02fbbbe56f90581c06a697b669465101d2e6262f5ee","bodyHash":"5609af72ff2c44b3fd37768ca83202104f6c7b6a08a172956a651de91d5b5fd2"}
 *
 * Go source:
 * func (c *Checker) checkSyntheticExpression(node *ast.Node) *Type {
 * 	t := node.AsSyntheticExpression().Type.(*Type)
 * 	if node.AsSyntheticExpression().IsSpread {
 * 		return c.getIndexedAccessType(t, c.numberType)
 * 	}
 * 	return t
 * }
 */
export function Checker_checkSyntheticExpression(receiver: GoPtr<Checker>, node: GoPtr<Node>): GoPtr<Type> {
  const synth = AsSyntheticExpression(node);
  const t = synth!.Type as GoPtr<Type>;
  if (synth!.IsSpread) {
    return Checker_getIndexedAccessType(receiver, t, receiver!.numberType);
  }
  return t;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.containerSeemsToBeEmptyDomElement","kind":"method","status":"implemented","sigHash":"371efe70a947606aad0e287268fe581c63f87fce5fea53ab33358a79010d12d2","bodyHash":"8dbbfbf6ddbcb82e6cd210c56db23b26d0108a98e9883ff1238383f531101026"}
 *
 * Go source:
 * func (c *Checker) containerSeemsToBeEmptyDomElement(containingType *Type) bool {
 * 	return !slices.Contains(c.compilerOptions.Lib, "lib.dom.d.ts") && everyContainedType(containingType, hasCommonDomTypeName) && c.isEmptyObjectType(containingType)
 * }
 */
export function Checker_containerSeemsToBeEmptyDomElement(receiver: GoPtr<Checker>, containingType: GoPtr<Type>): bool {
  return !slicesContains(receiver!.compilerOptions!.Lib ?? [], "lib.dom.d.ts") && everyContainedType(containingType, hasCommonDomTypeName) && Checker_isEmptyObjectType(receiver, containingType);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.isUncalledFunctionReference","kind":"method","status":"implemented","sigHash":"08a8a91f7de94c1105b16241ca03d7f9ebbc8c5d11c3928199a7001121c7d7d2","bodyHash":"a8cabe6f2fa938cc6ef6447c5e0faadf4f320cc7ec187fc441315ddd2e47aee7"}
 *
 * Go source:
 * func (c *Checker) isUncalledFunctionReference(node *ast.Node, symbol *ast.Symbol) bool {
 * 	if symbol.Flags&(ast.SymbolFlagsFunction|ast.SymbolFlagsMethod) != 0 {
 * 		parent := ast.FindAncestor(node.Parent, func(n *ast.Node) bool { return !ast.IsAccessExpression(n) })
 * 		if parent == nil {
 * 			parent = node.Parent
 * 		}
 * 		if ast.IsCallLikeExpression(parent) {
 * 			return ast.IsCallOrNewExpression(parent) && ast.IsIdentifier(node) && c.hasMatchingArgument(parent, node)
 * 		}
 * 		return core.Every(symbol.Declarations, func(d *ast.Node) bool {
 * 			return !ast.IsFunctionLike(d) || c.IsDeprecatedDeclaration(d)
 * 		})
 * 	}
 * 	return true
 * }
 */
export function Checker_isUncalledFunctionReference(receiver: GoPtr<Checker>, node: GoPtr<Node>, symbol_: GoPtr<Symbol>): bool {
  if ((symbol_!.Flags & (SymbolFlagsFunction | SymbolFlagsMethod)) !== 0) {
    let parent = FindAncestor(node!.Parent, (n: GoPtr<Node>) => !IsAccessExpression(n));
    if (parent === undefined) {
      parent = node!.Parent;
    }
    if (IsCallLikeExpression(parent)) {
      return (IsCallOrNewExpression(parent) && IsIdentifier(node) && Checker_hasMatchingArgument(receiver, parent, node)) as bool;
    }
    return Every(symbol_!.Declarations, (declaration) => (!IsFunctionLike(declaration) || Checker_IsDeprecatedDeclaration(receiver, declaration)) as bool);
  }
  return true as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.checkThisExpression","kind":"method","status":"implemented","sigHash":"fbbd7d3b92217e0f7761f809cb1d35d6c147a6c1cb730bb675193e7b44df70d0","bodyHash":"121bfe3098fc6bae6924cabe11d0ef228558c094bb0261650e6909bf1e6c55b1"}
 *
 * Go source:
 * func (c *Checker) checkThisExpression(node *ast.Node) *Type {
 * 	// Stop at the first arrow function so that we can
 * 	// tell whether 'this' needs to be captured.
 * 	container := ast.GetThisContainer(node, true /*includeArrowFunctions* /, true /*includeClassComputedPropertyName* /)
 * 	capturedByArrowFunction := false
 * 	thisInComputedPropertyName := false
 * 	if ast.IsConstructorDeclaration(container) {
 * 		c.checkThisBeforeSuper(node, container, diagnostics.X_super_must_be_called_before_accessing_this_in_the_constructor_of_a_derived_class)
 * 	}
 * 	for {
 * 		// Now skip arrow functions to get the "real" owner of 'this'.
 * 		if ast.IsArrowFunction(container) {
 * 			container = ast.GetThisContainer(container, false /*includeArrowFunctions* /, !thisInComputedPropertyName)
 * 			capturedByArrowFunction = true
 * 		}
 * 		if ast.IsComputedPropertyName(container) {
 * 			container = ast.GetThisContainer(container, !capturedByArrowFunction, false /*includeClassComputedPropertyName* /)
 * 			thisInComputedPropertyName = true
 * 			continue
 * 		}
 * 		break
 * 	}
 * 	c.checkThisInStaticClassFieldInitializerInDecoratedClass(node, container)
 * 	if thisInComputedPropertyName {
 * 		c.error(node, diagnostics.X_this_cannot_be_referenced_in_a_computed_property_name)
 * 	} else {
 * 		switch container.Kind {
 * 		case ast.KindModuleDeclaration:
 * 			c.error(node, diagnostics.X_this_cannot_be_referenced_in_a_module_or_namespace_body)
 * 			// do not return here so in case if lexical this is captured - it will be reflected in flags on NodeLinks
 * 		case ast.KindEnumDeclaration:
 * 			c.error(node, diagnostics.X_this_cannot_be_referenced_in_current_location)
 * 			// do not return here so in case if lexical this is captured - it will be reflected in flags on NodeLinks
 * 		}
 * 	}
 * 	t := c.tryGetThisTypeAtEx(node, true /*includeGlobalThis* /, container)
 * 	if c.noImplicitThis {
 * 		globalThisType := c.getTypeOfSymbol(c.globalThisSymbol)
 * 		if t == globalThisType && capturedByArrowFunction {
 * 			c.error(node, diagnostics.The_containing_arrow_function_captures_the_global_value_of_this)
 * 		} else if t == nil {
 * 			// With noImplicitThis, functions may not reference 'this' if it has type 'any'
 * 			diag := c.error(node, diagnostics.X_this_implicitly_has_type_any_because_it_does_not_have_a_type_annotation)
 * 			if !ast.IsSourceFile(container) {
 * 				outsideThis := c.tryGetThisTypeAt(container)
 * 				if outsideThis != nil && outsideThis != globalThisType {
 * 					diag.AddRelatedInfo(createDiagnosticForNode(container, diagnostics.An_outer_value_of_this_is_shadowed_by_this_container))
 * 				}
 * 			}
 * 		}
 * 	}
 * 	if t == nil {
 * 		return c.anyType
 * 	}
 * 	return t
 * }
 */
export function Checker_checkThisExpression(receiver: GoPtr<Checker>, node: GoPtr<Node>): GoPtr<Type> {
  let container = Checker_getThisContainer(receiver, node, true /*includeArrowFunctions*/, true /*includeClassComputedPropertyName*/);
  let capturedByArrowFunction = false;
  let thisInComputedPropertyName = false;
  if (IsConstructorDeclaration(container)) {
    Checker_checkThisBeforeSuper(receiver, node, container, X_super_must_be_called_before_accessing_this_in_the_constructor_of_a_derived_class);
  }
  for (;;) {
    if (IsArrowFunction(container)) {
      container = Checker_getThisContainer(receiver, container, false /*includeArrowFunctions*/, !thisInComputedPropertyName);
      capturedByArrowFunction = true;
    }
    if (IsComputedPropertyName(container)) {
      container = Checker_getThisContainer(receiver, container, !capturedByArrowFunction, false /*includeClassComputedPropertyName*/);
      thisInComputedPropertyName = true;
      continue;
    }
    break;
  }
  Checker_checkThisInStaticClassFieldInitializerInDecoratedClass(receiver, node, container);
  if (thisInComputedPropertyName) {
    Checker_error(receiver, node, X_this_cannot_be_referenced_in_a_computed_property_name);
  } else {
    switch (container!.Kind) {
      case KindModuleDeclaration:
        Checker_error(receiver, node, X_this_cannot_be_referenced_in_a_module_or_namespace_body);
        break;
      case KindEnumDeclaration:
        Checker_error(receiver, node, X_this_cannot_be_referenced_in_current_location);
        break;
    }
  }
  const t = Checker_tryGetThisTypeAtEx(receiver, node, true /*includeGlobalThis*/, container);
  if (receiver!.noImplicitThis) {
    const globalThisType = Checker_getTypeOfSymbol(receiver, receiver!.globalThisSymbol);
    if (t === globalThisType && capturedByArrowFunction) {
      Checker_error(receiver, node, The_containing_arrow_function_captures_the_global_value_of_this);
    } else if (t === undefined) {
      const diag = Checker_error(receiver, node, X_this_implicitly_has_type_any_because_it_does_not_have_a_type_annotation);
      if (!IsSourceFile(container)) {
        const outsideThis = Checker_tryGetThisTypeAt(receiver, container);
        if (outsideThis !== undefined && outsideThis !== globalThisType) {
          Diagnostic_AddRelatedInfo(diag, createDiagnosticForNode(container, An_outer_value_of_this_is_shadowed_by_this_container));
        }
      }
    }
  }
  if (t === undefined) {
    return receiver!.anyType;
  }
  return t;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.checkBinaryExpression","kind":"method","status":"implemented","sigHash":"7789a2bf27bb77f18361e12bbc4e9dd02304e6f162df1c874f94945d2d4b1bcf","bodyHash":"9faf599e69844635f35db6e35e11439ef3ffa75966c09b3c8e952309b3251d42"}
 * @tsgo-override {"category":"extension-host","allow":["body"],"reason":"After normal TS-Go binary expression checking, extension-enabled programs may record provider-selected target operator facts for consumers; no-extension programs and unowned operators remain on the exact TS-Go path."}
 *
 * Go source:
 * func (c *Checker) checkBinaryExpression(node *ast.Node, checkMode CheckMode) *Type {
 * 	binary := node.AsBinaryExpression()
 * 	return c.checkBinaryLikeExpression(binary.Left, binary.OperatorToken, binary.Right, checkMode, node)
 * }
 */
export function Checker_checkBinaryExpression(receiver: GoPtr<Checker>, node: GoPtr<Node>, checkMode: CheckMode): GoPtr<Type> {
  const binary = AsBinaryExpression(node);
  if (isIterativelyCheckableNonLogicalBinaryExpression(node)) {
    const result = Checker_checkNonLogicalBinaryExpressionIterative(receiver, node, checkMode);
    recordExtensionOperatorResolution(receiver, node, binary!.OperatorToken, binary!.Left, binary!.Right);
    return result;
  }
  const result = Checker_checkBinaryLikeExpression(receiver, binary!.Left, binary!.OperatorToken, binary!.Right, checkMode, node);
  recordExtensionOperatorResolution(receiver, node, binary!.OperatorToken, binary!.Left, binary!.Right);
  return result;
}

function Checker_checkNonLogicalBinaryExpressionIterative(receiver: GoPtr<Checker>, node: GoPtr<Node>, checkMode: CheckMode): GoPtr<Type> {
  const binaryChain: GoPtr<Node>[] = [];
  let leftEdge: GoPtr<Node> = node;
  while (isIterativelyCheckableNonLogicalBinaryExpression(leftEdge)) {
    binaryChain.push(leftEdge);
    leftEdge = AsBinaryExpression(leftEdge)!.Left;
  }
  let leftType = Checker_checkExpressionEx(receiver, leftEdge, checkMode);
  for (let index = binaryChain.length - 1; index >= 0; index--) {
    const current = binaryChain[index];
    const binary = AsBinaryExpression(current);
    const rightType = Checker_checkExpressionEx(receiver, binary!.Right, checkMode);
    if (index === 0) {
      return Checker_checkBinaryLikeExpressionWithTypes(receiver, binary!.Left, binary!.OperatorToken, binary!.Right, checkMode, current, leftType, rightType);
    }
    const saveCurrentNode = receiver!.currentNode;
    receiver!.currentNode = current;
    receiver!.instantiationCount = 0;
    const uninstantiatedType = Checker_checkBinaryLikeExpressionWithTypes(receiver, binary!.Left, binary!.OperatorToken, binary!.Right, checkMode, current, leftType, rightType);
    leftType = Checker_instantiateTypeWithSingleGenericCallSignature(receiver, current, uninstantiatedType, checkMode);
    if (isConstEnumObjectType(leftType)) {
      Checker_checkConstEnumAccess(receiver, current, leftType);
    }
    receiver!.currentNode = saveCurrentNode;
  }
  return leftType;
}

function isIterativelyCheckableNonLogicalBinaryExpression(node: GoPtr<Node>): bool {
  if (node === undefined || node.Kind !== KindBinaryExpression) {
    return false as bool;
  }
  const binary = AsBinaryExpression(node);
  const operator = binary!.OperatorToken!.Kind;
  return (
    !(operator === KindEqualsToken && (binary!.Left!.Kind === KindObjectLiteralExpression || binary!.Left!.Kind === KindArrayLiteralExpression)) &&
    !IsLogicalOrCoalescingBinaryOperator(operator) &&
    !IsLogicalOrCoalescingAssignmentOperator(operator)
  ) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.checkBinaryLikeExpression","kind":"method","status":"implemented","sigHash":"058951d0c451f4334faaa90f108eb88c838ea7af7a55bddace4da2ff77570115","bodyHash":"35a4d3d98cecf55f83774842062fdfe4dbc8bb5d764df060a73c2c94e942e66b"}
 *
 * Go source:
 * func (c *Checker) checkBinaryLikeExpression(left *ast.Node, operatorToken *ast.Node, right *ast.Node, checkMode CheckMode, errorNode *ast.Node) *Type {
 * 	operator := operatorToken.Kind
 * 	if operator == ast.KindEqualsToken && (left.Kind == ast.KindObjectLiteralExpression || left.Kind == ast.KindArrayLiteralExpression) {
 * 		return c.checkDestructuringAssignment(left, c.checkExpressionEx(right, checkMode), checkMode, right.Kind == ast.KindThisKeyword)
 * 	}
 * 	leftType := c.checkExpressionEx(left, checkMode)
 * 	rightType := c.checkExpressionEx(right, checkMode)
 * 	if ast.IsLogicalOrCoalescingBinaryOperator(operator) {
 * 		parent := left.Parent.Parent
 * 		for ast.IsParenthesizedExpression(parent) || ast.IsLogicalOrCoalescingBinaryExpression(parent) {
 * 			parent = parent.Parent
 * 		}
 * 		if operator == ast.KindAmpersandAmpersandToken || ast.IsIfStatement(parent) {
 * 			var body *ast.Node
 * 			if ast.IsIfStatement(parent) {
 * 				body = parent.AsIfStatement().ThenStatement
 * 			}
 * 			c.checkTestingKnownTruthyCallableOrAwaitableOrEnumMemberType(left, leftType, body)
 * 		}
 * 		if ast.IsLogicalBinaryOperator(operator) {
 * 			c.checkTruthinessOfType(leftType, left)
 * 		}
 * 	}
 * 	switch operator {
 * 	case ast.KindAsteriskToken, ast.KindAsteriskAsteriskToken, ast.KindAsteriskEqualsToken, ast.KindAsteriskAsteriskEqualsToken,
 * 		ast.KindSlashToken, ast.KindSlashEqualsToken, ast.KindPercentToken, ast.KindPercentEqualsToken, ast.KindMinusToken,
 * 		ast.KindMinusEqualsToken, ast.KindLessThanLessThanToken, ast.KindLessThanLessThanEqualsToken, ast.KindGreaterThanGreaterThanToken,
 * 		ast.KindGreaterThanGreaterThanEqualsToken, ast.KindGreaterThanGreaterThanGreaterThanToken, ast.KindGreaterThanGreaterThanGreaterThanEqualsToken,
 * 		ast.KindBarToken, ast.KindBarEqualsToken, ast.KindCaretToken, ast.KindCaretEqualsToken, ast.KindAmpersandToken, ast.KindAmpersandEqualsToken:
 * 		if leftType == c.silentNeverType || rightType == c.silentNeverType {
 * 			return c.silentNeverType
 * 		}
 * 		leftType = c.checkNonNullType(leftType, left)
 * 		rightType = c.checkNonNullType(rightType, right)
 * 		// if a user tries to apply a bitwise operator to 2 boolean operands
 * 		// try and return them a helpful suggestion
 * 		if leftType.flags&TypeFlagsBooleanLike != 0 && rightType.flags&TypeFlagsBooleanLike != 0 {
 * 			suggestedOperator := c.getSuggestedBooleanOperator(operator)
 * 			if suggestedOperator != ast.KindUnknown {
 * 				c.error(operatorToken, diagnostics.The_0_operator_is_not_allowed_for_boolean_types_Consider_using_1_instead, scanner.TokenToString(operatorToken.Kind), scanner.TokenToString(suggestedOperator))
 * 				return c.numberType
 * 			}
 * 		}
 * 		// otherwise just check each operand separately and report errors as normal
 * 		leftOk := c.checkArithmeticOperandType(left, leftType, diagnostics.The_left_hand_side_of_an_arithmetic_operation_must_be_of_type_any_number_bigint_or_an_enum_type, true /*isAwaitValid* /)
 * 		rightOk := c.checkArithmeticOperandType(right, rightType, diagnostics.The_right_hand_side_of_an_arithmetic_operation_must_be_of_type_any_number_bigint_or_an_enum_type, true /*isAwaitValid* /)
 * 		var resultType *Type
 * 		// If both are any or unknown, allow operation; assume it will resolve to number
 * 		if c.isTypeAssignableToKind(leftType, TypeFlagsAnyOrUnknown) && c.isTypeAssignableToKind(rightType, TypeFlagsAnyOrUnknown) || !c.maybeTypeOfKind(leftType, TypeFlagsBigIntLike) && !c.maybeTypeOfKind(rightType, TypeFlagsBigIntLike) {
 * 			resultType = c.numberType
 * 		} else if c.bothAreBigIntLike(leftType, rightType) {
 * 			switch operator {
 * 			case ast.KindGreaterThanGreaterThanGreaterThanToken, ast.KindGreaterThanGreaterThanGreaterThanEqualsToken:
 * 				c.reportOperatorError(leftType, operator, rightType, errorNode, nil)
 * 			case ast.KindAsteriskAsteriskToken, ast.KindAsteriskAsteriskEqualsToken:
 * 				if c.languageVersion < core.ScriptTargetES2016 {
 * 					c.error(errorNode, diagnostics.Exponentiation_cannot_be_performed_on_bigint_values_unless_the_target_option_is_set_to_es2016_or_later)
 * 				}
 * 			}
 * 			resultType = c.bigintType
 * 		} else {
 * 			c.reportOperatorError(leftType, operator, rightType, errorNode, c.bothAreBigIntLike)
 * 			resultType = c.errorType
 * 		}
 * 		if leftOk && rightOk {
 * 			c.checkAssignmentOperator(left, operator, right, leftType, resultType)
 * 			switch operator {
 * 			case ast.KindLessThanLessThanToken, ast.KindLessThanLessThanEqualsToken, ast.KindGreaterThanGreaterThanToken,
 * 				ast.KindGreaterThanGreaterThanEqualsToken, ast.KindGreaterThanGreaterThanGreaterThanToken,
 * 				ast.KindGreaterThanGreaterThanGreaterThanEqualsToken:
 * 				rhsEval := c.evaluate(right, right)
 * 				if numValue, ok := rhsEval.Value.(jsnum.Number); ok && numValue.Abs() >= 32 {
 * 					// Elevate from suggestion to error within an enum member
 * 					c.errorOrSuggestion(ast.IsEnumMember(ast.WalkUpParenthesizedExpressions(right.Parent.Parent)), errorNode, diagnostics.This_operation_can_be_simplified_This_shift_is_identical_to_0_1_2, scanner.GetTextOfNode(left), scanner.TokenToString(operator), numValue.Remainder(32))
 * 				}
 * 			}
 * 		}
 * 		return resultType
 * 	case ast.KindPlusToken, ast.KindPlusEqualsToken:
 * 		if leftType == c.silentNeverType || rightType == c.silentNeverType {
 * 			return c.silentNeverType
 * 		}
 * 		if !c.isTypeAssignableToKind(leftType, TypeFlagsStringLike) && !c.isTypeAssignableToKind(rightType, TypeFlagsStringLike) {
 * 			leftType = c.checkNonNullType(leftType, left)
 * 			rightType = c.checkNonNullType(rightType, right)
 * 		}
 * 		var resultType *Type
 * 		if c.isTypeAssignableToKindEx(leftType, TypeFlagsNumberLike, true /*strict* /) && c.isTypeAssignableToKindEx(rightType, TypeFlagsNumberLike, true /*strict* /) {
 * 			// Operands of an enum type are treated as having the primitive type Number.
 * 			// If both operands are of the Number primitive type, the result is of the Number primitive type.
 * 			resultType = c.numberType
 * 		} else if c.isTypeAssignableToKindEx(leftType, TypeFlagsBigIntLike, true /*strict* /) && c.isTypeAssignableToKindEx(rightType, TypeFlagsBigIntLike, true /*strict* /) {
 * 			// If both operands are of the BigInt primitive type, the result is of the BigInt primitive type.
 * 			resultType = c.bigintType
 * 		} else if c.isTypeAssignableToKindEx(leftType, TypeFlagsStringLike, true /*strict* /) || c.isTypeAssignableToKindEx(rightType, TypeFlagsStringLike, true /*strict* /) {
 * 			// If one or both operands are of the String primitive type, the result is of the String primitive type.
 * 			resultType = c.stringType
 * 		} else if IsTypeAny(leftType) || IsTypeAny(rightType) {
 * 			// Otherwise, the result is of type Any.
 * 			// NOTE: unknown type here denotes error type. Old compiler treated this case as any type so do we.
 * 			if c.isErrorType(leftType) || c.isErrorType(rightType) {
 * 				resultType = c.errorType
 * 			} else {
 * 				resultType = c.anyType
 * 			}
 * 		}
 * 		// Symbols are not allowed at all in arithmetic expressions
 * 		if resultType != nil && !c.checkForDisallowedESSymbolOperand(left, right, leftType, rightType, operator) {
 * 			return resultType
 * 		}
 * 		if resultType == nil {
 * 			// Types that have a reasonably good chance of being a valid operand type.
 * 			// If both types have an awaited type of one of these, we'll assume the user
 * 			// might be missing an await without doing an exhaustive check that inserting
 * 			// await(s) will actually be a completely valid binary expression.
 * 			closeEnoughKind := TypeFlagsNumberLike | TypeFlagsBigIntLike | TypeFlagsStringLike | TypeFlagsAnyOrUnknown
 * 			c.reportOperatorError(leftType, operator, rightType, errorNode, func(left *Type, right *Type) bool {
 * 				return c.isTypeAssignableToKind(left, closeEnoughKind) && c.isTypeAssignableToKind(right, closeEnoughKind)
 * 			})
 * 			return c.anyType
 * 		}
 * 		if operator == ast.KindPlusEqualsToken {
 * 			c.checkAssignmentOperator(left, operator, right, leftType, resultType)
 * 		}
 * 		return resultType
 * 	case ast.KindLessThanToken, ast.KindGreaterThanToken, ast.KindLessThanEqualsToken, ast.KindGreaterThanEqualsToken:
 * 		if c.checkForDisallowedESSymbolOperand(left, right, leftType, rightType, operator) {
 * 			leftType = c.getBaseTypeOfLiteralTypeForComparison(c.checkNonNullType(leftType, left))
 * 			rightType = c.getBaseTypeOfLiteralTypeForComparison(c.checkNonNullType(rightType, right))
 * 			c.reportOperatorErrorUnless(leftType, operator, rightType, errorNode, func(left *Type, right *Type) bool {
 * 				if IsTypeAny(left) || IsTypeAny(right) {
 * 					return true
 * 				}
 * 				leftAssignableToNumber := c.isTypeAssignableTo(left, c.numberOrBigIntType)
 * 				rightAssignableToNumber := c.isTypeAssignableTo(right, c.numberOrBigIntType)
 * 				return leftAssignableToNumber && rightAssignableToNumber || !leftAssignableToNumber && !rightAssignableToNumber && c.areTypesComparable(left, right)
 * 			})
 * 		}
 * 		return c.booleanType
 * 	case ast.KindEqualsEqualsToken, ast.KindExclamationEqualsToken, ast.KindEqualsEqualsEqualsToken, ast.KindExclamationEqualsEqualsToken:
 * 		// We suppress errors in CheckMode.TypeOnly (meaning the invocation came from getTypeOfExpression). During
 * 		// control flow analysis it is possible for operands to temporarily have narrower types, and those narrower
 * 		// types may cause the operands to not be comparable. We don't want such errors reported (see #46475).
 * 		if checkMode&CheckModeTypeOnly == 0 {
 * 			if (isLiteralExpressionOfObject(left) || isLiteralExpressionOfObject(right)) &&
 * 				// only report for === and !== in JS, not == or !=
 * 				(!ast.IsInJSFile(left) || (operator == ast.KindEqualsEqualsEqualsToken || operator == ast.KindExclamationEqualsEqualsToken)) {
 * 				eqType := operator == ast.KindEqualsEqualsToken || operator == ast.KindEqualsEqualsEqualsToken
 * 				c.error(errorNode, diagnostics.This_condition_will_always_return_0_since_JavaScript_compares_objects_by_reference_not_value, core.IfElse(eqType, "false", "true"))
 * 			}
 * 			c.checkNaNEquality(errorNode, operator, left, right)
 * 			c.reportOperatorErrorUnless(leftType, operator, rightType, errorNode, func(left *Type, right *Type) bool {
 * 				return c.isTypeEqualityComparableTo(left, right) || c.isTypeEqualityComparableTo(right, left)
 * 			})
 * 		}
 * 		return c.booleanType
 * 	case ast.KindInstanceOfKeyword:
 * 		return c.checkInstanceOfExpression(left, right, leftType, rightType, checkMode)
 * 	case ast.KindInKeyword:
 * 		return c.checkInExpression(left, right, leftType, rightType)
 * 	case ast.KindAmpersandAmpersandToken, ast.KindAmpersandAmpersandEqualsToken:
 * 		resultType := leftType
 * 		if c.hasTypeFacts(leftType, TypeFactsTruthy) {
 * 			t := leftType
 * 			if !c.strictNullChecks {
 * 				t = c.getBaseTypeOfLiteralType(rightType)
 * 			}
 * 			resultType = c.getUnionType([]*Type{c.extractDefinitelyFalsyTypes(t), rightType})
 * 		}
 * 		if operator == ast.KindAmpersandAmpersandEqualsToken {
 * 			c.checkAssignmentOperator(left, operator, right, leftType, rightType)
 * 		}
 * 		return resultType
 * 	case ast.KindBarBarToken, ast.KindBarBarEqualsToken:
 * 		resultType := leftType
 * 		if c.hasTypeFacts(leftType, TypeFactsFalsy) {
 * 			resultType = c.getUnionTypeEx([]*Type{c.GetNonNullableType(c.removeDefinitelyFalsyTypes(leftType)), rightType}, UnionReductionSubtype, nil, nil)
 * 		}
 * 		if operator == ast.KindBarBarEqualsToken {
 * 			c.checkAssignmentOperator(left, operator, right, leftType, rightType)
 * 		}
 * 		return resultType
 * 	case ast.KindQuestionQuestionToken, ast.KindQuestionQuestionEqualsToken:
 * 		if operator == ast.KindQuestionQuestionToken {
 * 			c.checkNullishCoalesceOperands(left, right)
 * 		}
 * 		resultType := leftType
 * 		if c.hasTypeFacts(leftType, TypeFactsEQUndefinedOrNull) {
 * 			resultType = c.getUnionTypeEx([]*Type{c.GetNonNullableType(leftType), rightType}, UnionReductionSubtype, nil, nil)
 * 		}
 * 		if operator == ast.KindQuestionQuestionEqualsToken {
 * 			c.checkAssignmentOperator(left, operator, right, leftType, rightType)
 * 		}
 * 		return resultType
 * 	case ast.KindEqualsToken:
 * 		c.checkAssignmentOperator(left, operator, right, leftType, rightType)
 * 		return rightType
 * 	case ast.KindCommaToken:
 * 		if !c.compilerOptions.AllowUnreachableCode.IsTrue() && c.isSideEffectFree(left) && !c.isIndirectCall(left.Parent) {
 * 			sf := ast.GetSourceFileOfNode(left)
 * 			start := scanner.SkipTrivia(sf.Text(), left.Pos())
 * 			isInDiag2657 := core.Some(sf.Diagnostics(), func(d *ast.Diagnostic) bool {
 * 				if d.Code() != diagnostics.JSX_expressions_must_have_one_parent_element.Code() {
 * 					return false
 * 				}
 * 				return d.Loc().Contains(start)
 * 			})
 * 			if !isInDiag2657 {
 * 				c.error(left, diagnostics.Left_side_of_comma_operator_is_unused_and_has_no_side_effects)
 * 			}
 * 		}
 * 		return rightType
 * 	}
 * 	panic("Unhandled case in checkBinaryLikeExpression")
 * }
 */
export function Checker_checkBinaryLikeExpression(receiver: GoPtr<Checker>, left: GoPtr<Node>, operatorToken: GoPtr<Node>, right: GoPtr<Node>, checkMode: CheckMode, errorNode: GoPtr<Node>): GoPtr<Type> {
  const operator = operatorToken!.Kind;
  if (operator === KindEqualsToken && (left!.Kind === KindObjectLiteralExpression || left!.Kind === KindArrayLiteralExpression)) {
    return Checker_checkDestructuringAssignment(receiver, left, Checker_checkExpressionEx(receiver, right, checkMode), checkMode, right!.Kind === KindThisKeyword);
  }
  const leftType = Checker_checkExpressionEx(receiver, left, checkMode);
  const rightType = Checker_checkExpressionEx(receiver, right, checkMode);
  return Checker_checkBinaryLikeExpressionWithTypes(receiver, left, operatorToken, right, checkMode, errorNode, leftType, rightType);
}

function Checker_checkBinaryLikeExpressionWithTypes(receiver: GoPtr<Checker>, left: GoPtr<Node>, operatorToken: GoPtr<Node>, right: GoPtr<Node>, checkMode: CheckMode, errorNode: GoPtr<Node>, initialLeftType: GoPtr<Type>, initialRightType: GoPtr<Type>): GoPtr<Type> {
  const operator = operatorToken!.Kind;
  let leftType = initialLeftType;
  let rightType = initialRightType;
  if (IsLogicalOrCoalescingBinaryOperator(operator)) {
    let parent = left!.Parent!.Parent;
    while (IsParenthesizedExpression(parent) || IsLogicalOrCoalescingBinaryExpression(parent)) {
      parent = parent!.Parent;
    }
    if (operator === KindAmpersandAmpersandToken || IsIfStatement(parent)) {
      let body: GoPtr<Node>;
      if (IsIfStatement(parent)) {
        body = AsIfStatement(parent)!.ThenStatement;
      }
      Checker_checkTestingKnownTruthyCallableOrAwaitableOrEnumMemberType(receiver, left, leftType, body);
    }
    if (IsLogicalBinaryOperator(operator)) {
      Checker_checkTruthinessOfType(receiver, leftType, left);
    }
  }
  switch (operator) {
    case KindAsteriskToken:
    case KindAsteriskAsteriskToken:
    case KindAsteriskEqualsToken:
    case KindAsteriskAsteriskEqualsToken:
    case KindSlashToken:
    case KindSlashEqualsToken:
    case KindPercentToken:
    case KindPercentEqualsToken:
    case KindMinusToken:
    case KindMinusEqualsToken:
    case KindLessThanLessThanToken:
    case KindLessThanLessThanEqualsToken:
    case KindGreaterThanGreaterThanToken:
    case KindGreaterThanGreaterThanEqualsToken:
    case KindGreaterThanGreaterThanGreaterThanToken:
    case KindGreaterThanGreaterThanGreaterThanEqualsToken:
    case KindBarToken:
    case KindBarEqualsToken:
    case KindCaretToken:
    case KindCaretEqualsToken:
    case KindAmpersandToken:
    case KindAmpersandEqualsToken: {
      if (leftType === receiver!.silentNeverType || rightType === receiver!.silentNeverType) {
        return receiver!.silentNeverType;
      }
      leftType = Checker_checkNonNullType(receiver, leftType, left);
      rightType = Checker_checkNonNullType(receiver, rightType, right);
      if ((leftType!.flags & TypeFlagsBooleanLike) !== 0 && (rightType!.flags & TypeFlagsBooleanLike) !== 0) {
        const suggestedOperator = Checker_getSuggestedBooleanOperator(receiver, operator);
        if (suggestedOperator !== KindUnknown) {
          Checker_error(receiver, operatorToken, The_0_operator_is_not_allowed_for_boolean_types_Consider_using_1_instead, TokenToString(operatorToken!.Kind), TokenToString(suggestedOperator));
          return receiver!.numberType;
        }
      }
      const leftOk = Checker_checkArithmeticOperandType(receiver, left, leftType, The_left_hand_side_of_an_arithmetic_operation_must_be_of_type_any_number_bigint_or_an_enum_type, true as bool);
      const rightOk = Checker_checkArithmeticOperandType(receiver, right, rightType, The_right_hand_side_of_an_arithmetic_operation_must_be_of_type_any_number_bigint_or_an_enum_type, true as bool);
      let resultType: GoPtr<Type>;
      if (
        (Checker_isTypeAssignableToKind(receiver, leftType, TypeFlagsAnyOrUnknown) && Checker_isTypeAssignableToKind(receiver, rightType, TypeFlagsAnyOrUnknown)) ||
        (!Checker_maybeTypeOfKind(receiver, leftType, TypeFlagsBigIntLike) && !Checker_maybeTypeOfKind(receiver, rightType, TypeFlagsBigIntLike))
      ) {
        resultType = receiver!.numberType;
      } else if (Checker_bothAreBigIntLike(receiver, leftType, rightType)) {
        switch (operator) {
          case KindGreaterThanGreaterThanGreaterThanToken:
          case KindGreaterThanGreaterThanGreaterThanEqualsToken:
            Checker_reportOperatorError(receiver, leftType, operator, rightType, errorNode, undefined);
            break;
          case KindAsteriskAsteriskToken:
          case KindAsteriskAsteriskEqualsToken:
            if (receiver!.languageVersion < ScriptTargetES2016) {
              Checker_error(receiver, errorNode, Exponentiation_cannot_be_performed_on_bigint_values_unless_the_target_option_is_set_to_es2016_or_later);
            }
            break;
        }
        resultType = receiver!.bigintType;
      } else {
        Checker_reportOperatorError(receiver, leftType, operator, rightType, errorNode, (leftOperand, rightOperand) => Checker_bothAreBigIntLike(receiver, leftOperand, rightOperand));
        resultType = receiver!.errorType;
      }
      if (leftOk && rightOk) {
        Checker_checkAssignmentOperator(receiver, left, operator, right, leftType, resultType);
        switch (operator) {
          case KindLessThanLessThanToken:
          case KindLessThanLessThanEqualsToken:
          case KindGreaterThanGreaterThanToken:
          case KindGreaterThanGreaterThanEqualsToken:
          case KindGreaterThanGreaterThanGreaterThanToken:
          case KindGreaterThanGreaterThanGreaterThanEqualsToken: {
            const rhsEval = receiver!.evaluate(right, right);
            if (typeof rhsEval.Value === "number") {
              const numValue = rhsEval.Value as Number;
              if (Number_Abs(numValue) >= (32 as Number)) {
                Checker_errorOrSuggestion(
                  receiver,
                  IsEnumMember(WalkUpParenthesizedExpressions(right!.Parent!.Parent as GoPtr<Expression>)),
                  errorNode,
                  This_operation_can_be_simplified_This_shift_is_identical_to_0_1_2,
                  GetTextOfNode(left),
                  TokenToString(operator),
                  Number_Remainder(numValue, 32 as Number),
                );
              }
            }
            break;
          }
        }
      }
      return resultType;
    }
    case KindPlusToken:
    case KindPlusEqualsToken: {
      if (leftType === receiver!.silentNeverType || rightType === receiver!.silentNeverType) {
        return receiver!.silentNeverType;
      }
      if (!Checker_isTypeAssignableToKind(receiver, leftType, TypeFlagsStringLike) && !Checker_isTypeAssignableToKind(receiver, rightType, TypeFlagsStringLike)) {
        leftType = Checker_checkNonNullType(receiver, leftType, left);
        rightType = Checker_checkNonNullType(receiver, rightType, right);
      }
      let resultType: GoPtr<Type>;
      if (Checker_isTypeAssignableToKindEx(receiver, leftType, TypeFlagsNumberLike, true as bool) && Checker_isTypeAssignableToKindEx(receiver, rightType, TypeFlagsNumberLike, true as bool)) {
        resultType = receiver!.numberType;
      } else if (Checker_isTypeAssignableToKindEx(receiver, leftType, TypeFlagsBigIntLike, true as bool) && Checker_isTypeAssignableToKindEx(receiver, rightType, TypeFlagsBigIntLike, true as bool)) {
        resultType = receiver!.bigintType;
      } else if (Checker_isTypeAssignableToKindEx(receiver, leftType, TypeFlagsStringLike, true as bool) || Checker_isTypeAssignableToKindEx(receiver, rightType, TypeFlagsStringLike, true as bool)) {
        resultType = receiver!.stringType;
      } else if (IsTypeAny(leftType) || IsTypeAny(rightType)) {
        if (Checker_isErrorType(receiver, leftType) || Checker_isErrorType(receiver, rightType)) {
          resultType = receiver!.errorType;
        } else {
          resultType = receiver!.anyType;
        }
      }
      if (resultType !== undefined && !Checker_checkForDisallowedESSymbolOperand(receiver, left, right, leftType, rightType, operator)) {
        return resultType;
      }
      if (resultType === undefined) {
        const closeEnoughKind = (TypeFlagsNumberLike | TypeFlagsBigIntLike | TypeFlagsStringLike | TypeFlagsAnyOrUnknown) as TypeFlags;
        Checker_reportOperatorError(
          receiver,
          leftType,
          operator,
          rightType,
          errorNode,
          (leftOperand, rightOperand) => Checker_isTypeAssignableToKind(receiver, leftOperand, closeEnoughKind) && Checker_isTypeAssignableToKind(receiver, rightOperand, closeEnoughKind),
        );
        return receiver!.anyType;
      }
      if (operator === KindPlusEqualsToken) {
        Checker_checkAssignmentOperator(receiver, left, operator, right, leftType, resultType);
      }
      return resultType;
    }
    case KindLessThanToken:
    case KindGreaterThanToken:
    case KindLessThanEqualsToken:
    case KindGreaterThanEqualsToken:
      if (Checker_checkForDisallowedESSymbolOperand(receiver, left, right, leftType, rightType, operator)) {
        leftType = Checker_getBaseTypeOfLiteralTypeForComparison(receiver, Checker_checkNonNullType(receiver, leftType, left));
        rightType = Checker_getBaseTypeOfLiteralTypeForComparison(receiver, Checker_checkNonNullType(receiver, rightType, right));
        Checker_reportOperatorErrorUnless(receiver, leftType, operator, rightType, errorNode, (leftOperand, rightOperand) => {
          if (IsTypeAny(leftOperand) || IsTypeAny(rightOperand)) {
            return true;
          }
          const leftAssignableToNumber = Checker_isTypeAssignableTo(receiver, leftOperand, receiver!.numberOrBigIntType);
          const rightAssignableToNumber = Checker_isTypeAssignableTo(receiver, rightOperand, receiver!.numberOrBigIntType);
          return (leftAssignableToNumber && rightAssignableToNumber) || (!leftAssignableToNumber && !rightAssignableToNumber && Checker_areTypesComparable(receiver, leftOperand, rightOperand));
        });
      }
      return receiver!.booleanType;
    case KindEqualsEqualsToken:
    case KindExclamationEqualsToken:
    case KindEqualsEqualsEqualsToken:
    case KindExclamationEqualsEqualsToken:
      if ((checkMode & CheckModeTypeOnly) === 0) {
        if (
          (isLiteralExpressionOfObject(left) || isLiteralExpressionOfObject(right)) &&
          (!IsInJSFile(left) || (operator === KindEqualsEqualsEqualsToken || operator === KindExclamationEqualsEqualsToken))
        ) {
          const eqType = operator === KindEqualsEqualsToken || operator === KindEqualsEqualsEqualsToken;
          Checker_error(receiver, errorNode, This_condition_will_always_return_0_since_JavaScript_compares_objects_by_reference_not_value, IfElse(eqType, "false", "true"));
        }
        Checker_checkNaNEquality(receiver, errorNode, operator, left as GoPtr<Expression>, right as GoPtr<Expression>);
        Checker_reportOperatorErrorUnless(receiver, leftType, operator, rightType, errorNode, (leftOperand, rightOperand) => Checker_isTypeEqualityComparableTo(receiver, leftOperand, rightOperand) || Checker_isTypeEqualityComparableTo(receiver, rightOperand, leftOperand));
      }
      return receiver!.booleanType;
    case KindInstanceOfKeyword:
      return Checker_checkInstanceOfExpression(receiver, left as GoPtr<Expression>, right as GoPtr<Expression>, leftType, rightType, checkMode);
    case KindInKeyword:
      return Checker_checkInExpression(receiver, left as GoPtr<Expression>, right as GoPtr<Expression>, leftType, rightType);
    case KindAmpersandAmpersandToken:
    case KindAmpersandAmpersandEqualsToken: {
      let resultType = leftType;
      if (Checker_hasTypeFacts(receiver, leftType, TypeFactsTruthy)) {
        let t = leftType;
        if (!receiver!.strictNullChecks) {
          t = Checker_getBaseTypeOfLiteralType(receiver, rightType);
        }
        resultType = Checker_getUnionType(receiver, [Checker_extractDefinitelyFalsyTypes(receiver, t), rightType]);
      }
      if (operator === KindAmpersandAmpersandEqualsToken) {
        Checker_checkAssignmentOperator(receiver, left, operator, right, leftType, rightType);
      }
      return resultType;
    }
    case KindBarBarToken:
    case KindBarBarEqualsToken: {
      let resultType = leftType;
      if (Checker_hasTypeFacts(receiver, leftType, TypeFactsFalsy)) {
        resultType = Checker_getUnionTypeEx(receiver, [Checker_GetNonNullableType(receiver, Checker_removeDefinitelyFalsyTypes(receiver, leftType)), rightType], UnionReductionSubtype, undefined, undefined);
      }
      if (operator === KindBarBarEqualsToken) {
        Checker_checkAssignmentOperator(receiver, left, operator, right, leftType, rightType);
      }
      return resultType;
    }
    case KindQuestionQuestionToken:
    case KindQuestionQuestionEqualsToken: {
      if (operator === KindQuestionQuestionToken) {
        Checker_checkNullishCoalesceOperands(receiver, left, right);
      }
      let resultType = leftType;
      if (Checker_hasTypeFacts(receiver, leftType, TypeFactsEQUndefinedOrNull)) {
        resultType = Checker_getUnionTypeEx(receiver, [Checker_GetNonNullableType(receiver, leftType), rightType], UnionReductionSubtype, undefined, undefined);
      }
      if (operator === KindQuestionQuestionEqualsToken) {
        Checker_checkAssignmentOperator(receiver, left, operator, right, leftType, rightType);
      }
      return resultType;
    }
    case KindEqualsToken:
      Checker_checkAssignmentOperator(receiver, left, operator, right, leftType, rightType);
      return rightType;
    case KindCommaToken:
      if (!Tristate_IsTrue(receiver!.compilerOptions!.AllowUnreachableCode!) && Checker_isSideEffectFree(receiver, left) && !Checker_isIndirectCall(receiver, left!.Parent)) {
        const sf = GetSourceFileOfNode(left);
        const start = SkipTrivia(SourceFile_Text(sf), Node_Pos(left));
        const isInDiag2657 = SourceFile_Diagnostics(sf).some((d) => {
          if (Diagnostic_Code(d) !== JSX_expressions_must_have_one_parent_element.code) {
            return false;
          }
          return TextRange_Contains(Diagnostic_Loc(d), start);
        });
        if (!isInDiag2657) {
          Checker_error(receiver, left, Left_side_of_comma_operator_is_unused_and_has_no_side_effects);
        }
      }
      return rightType;
  }
  throw new globalThis.Error("Unhandled case in checkBinaryLikeExpression");
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.checkInstanceOfExpression","kind":"method","status":"implemented","sigHash":"aa4ac7420ed6affa958c2ecf41be0af56ba4ccb583c10ad569aea29d509fe364","bodyHash":"ded0f107f67dacf1066c484f46c213b6e9d968988051fce3ec11daeba41d4a93"}
 *
 * Go source:
 * func (c *Checker) checkInstanceOfExpression(left *ast.Expression, right *ast.Expression, leftType *Type, rightType *Type, checkMode CheckMode) *Type {
 * 	if leftType == c.silentNeverType || rightType == c.silentNeverType {
 * 		return c.silentNeverType
 * 	}
 * 	// TypeScript 1.0 spec (April 2014): 4.15.4
 * 	// The instanceof operator requires the left operand to be of type Any, an object type, or a type parameter type,
 * 	// and the right operand to be of type Any, a subtype of the 'Function' interface type, or have a call or construct signature.
 * 	// The result is always of the Boolean primitive type.
 * 	// NOTE: do not raise error if leftType is unknown as related error was already reported
 * 	if !IsTypeAny(leftType) && c.allTypesAssignableToKind(leftType, TypeFlagsPrimitive) {
 * 		c.error(left, diagnostics.The_left_hand_side_of_an_instanceof_expression_must_be_of_type_any_an_object_type_or_a_type_parameter)
 * 	}
 * 	signature := c.getResolvedSignature(left.Parent, nil /*candidatesOutArray* /, checkMode)
 * 	if signature == c.resolvingSignature {
 * 		// CheckMode.SkipGenericFunctions is enabled and this is a call to a generic function that
 * 		// returns a function type. We defer checking and return silentNeverType.
 * 		return c.silentNeverType
 * 	}
 * 	// If rightType has a `[Symbol.hasInstance]` method that is not `(value: unknown) => boolean`, we
 * 	// must check the expression as if it were a call to `right[Symbol.hasInstance](left)`. The call to
 * 	// `getResolvedSignature`, below, will check that leftType is assignable to the type of the first
 * 	// parameter.
 * 	returnType := c.getReturnTypeOfSignature(signature)
 * 	// We also verify that the return type of the `[Symbol.hasInstance]` method is assignable to
 * 	// `boolean`. According to the spec, the runtime will actually perform `ToBoolean` on the result,
 * 	// but this is more type-safe.
 * 	c.checkTypeAssignableTo(returnType, c.booleanType, right, diagnostics.An_object_s_Symbol_hasInstance_method_must_return_a_boolean_value_for_it_to_be_used_on_the_right_hand_side_of_an_instanceof_expression)
 * 	return c.booleanType
 * }
 */
export function Checker_checkInstanceOfExpression(receiver: GoPtr<Checker>, left: GoPtr<Expression>, right: GoPtr<Expression>, leftType: GoPtr<Type>, rightType: GoPtr<Type>, checkMode: CheckMode): GoPtr<Type> {
  if (leftType === receiver!.silentNeverType || rightType === receiver!.silentNeverType) {
    return receiver!.silentNeverType;
  }
  if (!IsTypeAny(leftType) && Checker_allTypesAssignableToKind(receiver, leftType, TypeFlagsPrimitive)) {
    Checker_error(receiver, left as unknown as GoPtr<Node>, The_left_hand_side_of_an_instanceof_expression_must_be_of_type_any_an_object_type_or_a_type_parameter);
  }
  const signature = Checker_getResolvedSignature(receiver, (left as unknown as GoPtr<Node>)!.Parent, undefined, checkMode);
  if (signature === receiver!.resolvingSignature) {
    return receiver!.silentNeverType;
  }
  const returnType = Checker_getReturnTypeOfSignature(receiver, signature);
  Checker_checkTypeAssignableTo(
    receiver,
    returnType,
    receiver!.booleanType,
    right as unknown as GoPtr<Node>,
    An_object_s_Symbol_hasInstance_method_must_return_a_boolean_value_for_it_to_be_used_on_the_right_hand_side_of_an_instanceof_expression,
  );
  return receiver!.booleanType;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.checkInExpression","kind":"method","status":"implemented","sigHash":"67490d91e8813d5f282efb3b653e098348f6422749ee9862664626ce9054f7f1","bodyHash":"1dc7797a0a0ef2f53bf50a1cf9e22f76700574a0a4589e5f37456a5b4ab532e3"}
 *
 * Go source:
 * func (c *Checker) checkInExpression(left *ast.Expression, right *ast.Expression, leftType *Type, rightType *Type) *Type {
 * 	if leftType == c.silentNeverType || rightType == c.silentNeverType {
 * 		return c.silentNeverType
 * 	}
 * 	if ast.IsPrivateIdentifier(left) {
 * 		if c.languageVersion < LanguageFeatureMinimumTarget.PrivateNamesAndClassStaticBlocks ||
 * 			c.languageVersion < LanguageFeatureMinimumTarget.ClassAndClassElementDecorators ||
 * 			!c.compilerOptions.GetUseDefineForClassFields() {
 * 			c.checkExternalEmitHelpers(left, ExternalEmitHelpersClassPrivateFieldIn)
 * 		}
 * 		// Unlike in 'checkPrivateIdentifierExpression' we now have access to the RHS type
 * 		// which provides us with the opportunity to emit more detailed errors
 * 		if c.symbolNodeLinks.Get(left).resolvedSymbol == nil && ast.GetContainingClass(left) != nil {
 * 			isUncheckedJS := c.isUncheckedJSSuggestion(left, rightType.symbol, true /*excludeClasses* /)
 * 			c.reportNonexistentProperty(left, rightType, isUncheckedJS)
 * 		}
 * 	} else {
 * 		// The type of the left operand must be assignable to string, number, or symbol.
 * 		c.checkTypeAssignableTo(c.checkNonNullType(leftType, left), c.stringNumberSymbolType, left, nil)
 * 	}
 * 	// The type of the right operand must be assignable to 'object'.
 * 	if c.checkTypeAssignableTo(c.checkNonNullType(rightType, right), c.nonPrimitiveType, right, nil) {
 * 		// The {} type is assignable to the object type, yet {} might represent a primitive type. Here we
 * 		// detect and error on {} that results from narrowing the unknown type, as well as intersections
 * 		// that include {} (we know that the other types in such intersections are assignable to object
 * 		// since we already checked for that).
 * 		if c.hasEmptyObjectIntersection(rightType) {
 * 			c.error(right, diagnostics.Type_0_may_represent_a_primitive_value_which_is_not_permitted_as_the_right_operand_of_the_in_operator, c.TypeToString(rightType))
 * 		}
 * 	}
 * 	// The result is always of the Boolean primitive type.
 * 	return c.booleanType
 * }
 */
export function Checker_checkInExpression(receiver: GoPtr<Checker>, left: GoPtr<Expression>, right: GoPtr<Expression>, leftType: GoPtr<Type>, rightType: GoPtr<Type>): GoPtr<Type> {
  if (leftType === receiver!.silentNeverType || rightType === receiver!.silentNeverType) {
    return receiver!.silentNeverType;
  }
  if (IsPrivateIdentifier(left as unknown as GoPtr<Node>)) {
    if (
      receiver!.languageVersion < LanguageFeatureMinimumTarget.PrivateNamesAndClassStaticBlocks ||
      receiver!.languageVersion < LanguageFeatureMinimumTarget.ClassAndClassElementDecorators ||
      !CompilerOptions_GetUseDefineForClassFields(receiver!.compilerOptions)
    ) {
      Checker_checkExternalEmitHelpers(receiver, left, ExternalEmitHelpersClassPrivateFieldIn);
    }
    const links = LinkStore_Get(receiver!.symbolNodeLinks, left as unknown as GoPtr<Node>) as GoPtr<SymbolNodeLinks>;
    if (links!.resolvedSymbol === undefined && GetContainingClass(left as unknown as GoPtr<Node>) !== undefined) {
      const isUncheckedJS = Checker_isUncheckedJSSuggestion(receiver, left as unknown as GoPtr<Node>, rightType!.symbol, true);
      Checker_reportNonexistentProperty(receiver, left as unknown as GoPtr<Node>, rightType, isUncheckedJS);
    }
  } else {
    Checker_checkTypeAssignableTo(receiver, Checker_checkNonNullType(receiver, leftType, left as unknown as GoPtr<Node>), receiver!.stringNumberSymbolType, left as unknown as GoPtr<Node>, undefined);
  }
  if (Checker_checkTypeAssignableTo(receiver, Checker_checkNonNullType(receiver, rightType, right as unknown as GoPtr<Node>), receiver!.nonPrimitiveType, right as unknown as GoPtr<Node>, undefined)) {
    if (Checker_hasEmptyObjectIntersection(receiver, rightType)) {
      Checker_error(receiver, right as unknown as GoPtr<Node>, Type_0_may_represent_a_primitive_value_which_is_not_permitted_as_the_right_operand_of_the_in_operator, Checker_TypeToString(receiver, rightType));
    }
  }
  return receiver!.booleanType;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.checkReferenceExpression","kind":"method","status":"implemented","sigHash":"7c391ffeb5a6258d8abaaacd39fc691840c4368da4777e9183f5517e353dfe7e","bodyHash":"e6926fdf89144a28add138cd4508e5e916133d36d7f546ca402979a8f7c20c51"}
 *
 * Go source:
 * func (c *Checker) checkReferenceExpression(expr *ast.Node, invalidReferenceMessage *diagnostics.Message, invalidOptionalChainMessage *diagnostics.Message) bool {
 * 	// References are combinations of identifiers, parentheses, and property accesses.
 * 	node := ast.SkipOuterExpressions(expr, ast.OEKAssertions|ast.OEKParentheses)
 * 	if node.Kind != ast.KindIdentifier && !ast.IsAccessExpression(node) {
 * 		c.error(expr, invalidReferenceMessage)
 * 		return false
 * 	}
 * 	if node.Flags&ast.NodeFlagsOptionalChain != 0 {
 * 		c.error(expr, invalidOptionalChainMessage)
 * 		return false
 * 	}
 * 	return true
 * }
 */
export function Checker_checkReferenceExpression(receiver: GoPtr<Checker>, expr: GoPtr<Node>, invalidReferenceMessage: GoPtr<Message>, invalidOptionalChainMessage: GoPtr<Message>): bool {
  const node = SkipOuterExpressions(expr as GoPtr<Expression>, (OEKAssertions | OEKParentheses) as OuterExpressionKinds) as GoPtr<Node>;
  if (!IsIdentifier(node) && !IsAccessExpression(node)) {
    Checker_error(receiver, expr, invalidReferenceMessage);
    return false as bool;
  }
  if ((node!.Flags & NodeFlagsOptionalChain) !== 0) {
    Checker_error(receiver, expr, invalidOptionalChainMessage);
    return false as bool;
  }
  return true as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.checkExpressionForMutableLocation","kind":"method","status":"implemented","sigHash":"5ab211d59ca5aa49a44fd1cd91603434ccb0b5dd082b156554d682831bd1c328","bodyHash":"7adf4830c0b6a169d6ded7ea16349c9d67f07c0ab523524404aed344f45cc965"}
 *
 * Go source:
 * func (c *Checker) checkExpressionForMutableLocation(node *ast.Node, checkMode CheckMode) *Type {
 * 	t := c.checkExpressionEx(node, checkMode)
 * 	switch {
 * 	case c.isConstContext(node):
 * 		return c.getRegularTypeOfLiteralType(t)
 * 	case isTypeAssertion(node):
 * 		return t
 * 	default:
 * 		return c.getWidenedLiteralLikeTypeForContextualType(t, c.instantiateContextualType(c.getContextualType(node, ContextFlagsNone), node, ContextFlagsNone))
 * 	}
 * }
 */
export function Checker_checkExpressionForMutableLocation(receiver: GoPtr<Checker>, node: GoPtr<Node>, checkMode: CheckMode): GoPtr<Type> {
  const t = Checker_checkExpressionEx(receiver, node, checkMode);
  if (Checker_isConstContext(receiver, node)) {
    return Checker_getRegularTypeOfLiteralType(receiver, t);
  }
  if (isTypeAssertion(node)) {
    return t;
  }
  return Checker_getWidenedLiteralLikeTypeForContextualType(
    receiver,
    t,
    Checker_instantiateContextualType(receiver, Checker_getContextualType(receiver, node, ContextFlagsNone), node, ContextFlagsNone),
  );
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.errorAndMaybeSuggestAwait","kind":"method","status":"implemented","sigHash":"6006054ac6e08d807cd230eb8b86930e62163e6ee64f4ea29ec9a23070a0c4a1","bodyHash":"468586d5ca3e1cabaeccecca682809a2cecd4ec775f732c89079dff25fc21d9d"}
 *
 * Go source:
 * func (c *Checker) errorAndMaybeSuggestAwait(location *ast.Node, maybeMissingAwait bool, message *diagnostics.Message, args ...any) *ast.Diagnostic {
 * 	diagnostic := c.error(location, message, args...)
 * 	if maybeMissingAwait {
 * 		diagnostic.AddRelatedInfo(createDiagnosticForNode(location, diagnostics.Did_you_forget_to_use_await))
 * 	}
 * 	return diagnostic
 * }
 */
export function Checker_errorAndMaybeSuggestAwait(receiver: GoPtr<Checker>, location: GoPtr<Node>, maybeMissingAwait: bool, message: GoPtr<Message>, ...args: Array<unknown>): GoPtr<Diagnostic> {
  const diagnostic = Checker_error(receiver, location, message, ...args);
  if (maybeMissingAwait) {
    Diagnostic_AddRelatedInfo(diagnostic, createDiagnosticForNode(location, Did_you_forget_to_use_await));
  }
  return diagnostic;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getTargetOfBinaryExpression","kind":"method","status":"implemented","sigHash":"0cb217e14c391a4307d10d566e761c78e1d3f97196406d399da90553db35a05d","bodyHash":"36bfce0e0e69d970feda69bbb9d94ae460eb311553a405e9d8a7388982c88cd7"}
 *
 * Go source:
 * func (c *Checker) getTargetOfBinaryExpression(node *ast.Node) *ast.Symbol {
 * 	resolved := c.getTargetOfAliasLikeExpression(node.AsBinaryExpression().Right)
 * 	c.markSymbolOfAliasDeclarationIfTypeOnly(node, nil)
 * 	return resolved
 * }
 */
export function Checker_getTargetOfBinaryExpression(receiver: GoPtr<Checker>, node: GoPtr<Node>): GoPtr<Symbol> {
  const resolved = Checker_getTargetOfAliasLikeExpression(receiver, AsBinaryExpression(node)!.Right);
  Checker_markSymbolOfAliasDeclarationIfTypeOnly(receiver, node, undefined);
  return resolved;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getTargetOfAccessExpression","kind":"method","status":"implemented","sigHash":"8900c65ec3436098b8b7c265d8ad933bf9d4360ba6774ffa575f1662ee550131","bodyHash":"386266d2099e0b623af9d9b9b241d4eb63f9c3ef010cb904c74810833ab0bc25"}
 *
 * Go source:
 * func (c *Checker) getTargetOfAccessExpression(node *ast.Node) *ast.Symbol {
 * 	if ast.IsBinaryExpression(node.Parent) {
 * 		expr := node.Parent.AsBinaryExpression()
 * 		if expr.Left == node && expr.OperatorToken.Kind == ast.KindEqualsToken {
 * 			return c.getTargetOfAliasLikeExpression(expr.Right)
 * 		}
 * 	}
 * 	return nil
 * }
 */
export function Checker_getTargetOfAccessExpression(receiver: GoPtr<Checker>, node: GoPtr<Node>): GoPtr<Symbol> {
  if (IsBinaryExpression(node!.Parent)) {
    const expr = AsBinaryExpression(node!.Parent);
    if (expr!.Left === node && expr!.OperatorToken!.Kind === KindEqualsToken) {
      return Checker_getTargetOfAliasLikeExpression(receiver, expr!.Right);
    }
  }
  return undefined;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::keyBuilder.writeNodeId","kind":"method","status":"implemented","sigHash":"c0cb923cca4a69efd3893a320648d1180c5da04ebcba7f28a32c11bbec05c35f","bodyHash":"baede69fb5525a0915d48ccfc7cb9ab8ecb9df7c08fd5d5ae6a6f3a1c35da675"}
 *
 * Go source:
 * func (b *keyBuilder) writeNodeId(id ast.NodeId) {
 * 	hashWrite64(&b.h, id)
 * }
 */
export function keyBuilder_writeNodeId(receiver: GoPtr<keyBuilder>, id: NodeId): void {
  keyBuilder_writeInt(receiver, id as unknown as int);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::keyBuilder.writeNode","kind":"method","status":"implemented","sigHash":"edd7b6215c913669037aafebd700d0830cab192e1b875fbc81a556a00d4d27af","bodyHash":"c3a2e36ebeda30c63374ae9ea55db557e7e7630887d45b58952be23c34b3732e"}
 *
 * Go source:
 * func (b *keyBuilder) writeNode(node *ast.Node) {
 * 	if node != nil {
 * 		b.writeNodeId(ast.GetNodeId(node))
 * 	}
 * }
 */
export function keyBuilder_writeNode(receiver: GoPtr<keyBuilder>, node: GoPtr<Node>): void {
  if (node !== undefined) {
    keyBuilder_writeNodeId(receiver, GetNodeId(node));
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.checkRightHandSideOfForOf","kind":"method","status":"implemented","sigHash":"8f637629abb9bf55eaefc556e625a4b954704968fe8ecb31d25cd20e0826efea","bodyHash":"11f693ac4c38b91e7e3354961c906131c2d080dc4c2794be4908a41c6ef3c94f"}
 *
 * Go source:
 * func (c *Checker) checkRightHandSideOfForOf(statement *ast.Node) *Type {
 * 	use := core.IfElse(statement.AsForInOrOfStatement().AwaitModifier != nil, IterationUseForAwaitOf, IterationUseForOf)
 * 	return c.checkIteratedTypeOrElementType(use, c.checkNonNullExpression(statement.Expression()), c.undefinedType, statement.Expression())
 * }
 */
export function Checker_checkRightHandSideOfForOf(receiver: GoPtr<Checker>, statement: GoPtr<Node>): GoPtr<Type> {
  const use = IfElse(AsForInOrOfStatement(statement)!.AwaitModifier !== undefined, IterationUseForAwaitOf, IterationUseForOf);
  return Checker_checkIteratedTypeOrElementType(receiver, use, Checker_checkNonNullExpression(receiver, Node_Expression(statement)), receiver!.undefinedType, Node_Expression(statement));
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getCombinedNodeFlagsCached","kind":"method","status":"implemented","sigHash":"6e0f8babf8a548b470b3aeccea0de8d5192f0c7988d0e886f7d1e939f6091dd5","bodyHash":"196fd65918de5902e70a802ba9d2f4e9b0885daf3e1ad7a3d86b58174bfa42c2"}
 *
 * Go source:
 * func (c *Checker) getCombinedNodeFlagsCached(node *ast.Node) ast.NodeFlags {
 * 	// we hold onto the last node and result to speed up repeated lookups against the same node.
 * 	if c.lastGetCombinedNodeFlagsNode == node {
 * 		return c.lastGetCombinedNodeFlagsResult
 * 	}
 * 	c.lastGetCombinedNodeFlagsNode = node
 * 	c.lastGetCombinedNodeFlagsResult = ast.GetCombinedNodeFlags(node)
 * 	return c.lastGetCombinedNodeFlagsResult
 * }
 */
export function Checker_getCombinedNodeFlagsCached(receiver: GoPtr<Checker>, node: GoPtr<Node>): NodeFlags {
  if (receiver!.lastGetCombinedNodeFlagsNode === node) {
    return receiver!.lastGetCombinedNodeFlagsResult;
  }
  receiver!.lastGetCombinedNodeFlagsNode = node;
  receiver!.lastGetCombinedNodeFlagsResult = GetCombinedNodeFlags(node);
  return receiver!.lastGetCombinedNodeFlagsResult;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.functionHasImplicitReturn","kind":"method","status":"implemented","sigHash":"95e0923b49be139ed7b595fb828b41caba456a45b858c4457a8ce9c606075dfb","bodyHash":"e81dd3ec59d0f16f97f115d8a5d7fed3de22e4ae82ca84caef2ff1eb123bf4e5"}
 *
 * Go source:
 * func (c *Checker) functionHasImplicitReturn(fn *ast.Node) bool {
 * 	endFlowNode := fn.BodyData().EndFlowNode
 * 	return endFlowNode != nil && c.isReachableFlowNode(endFlowNode)
 * }
 */
export function Checker_functionHasImplicitReturn(receiver: GoPtr<Checker>, fn: GoPtr<Node>): bool {
  const endFlowNode = (Node_BodyData(fn) as unknown as { EndFlowNode: GoPtr<FlowNode> }).EndFlowNode;
  return endFlowNode !== undefined && Checker_isReachableFlowNode(receiver, endFlowNode);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.createSyntheticExpression","kind":"method","status":"implemented","sigHash":"498d8adf5c09fc185a554b330e587522c3396f24a5253ee0014fdb01d568c88e","bodyHash":"6d298c87aee2ce6a79cfd63613d951be14408a0db356f8f9286bac2021173b0a"}
 *
 * Go source:
 * func (c *Checker) createSyntheticExpression(parent *ast.Node, t *Type, isSpread bool, tupleNameSource *ast.Node) *ast.Node {
 * 	result := c.factory.NewSyntheticExpression(t, isSpread, tupleNameSource)
 * 	result.Loc = parent.Loc
 * 	result.Parent = parent
 * 	return result
 * }
 */
export function Checker_createSyntheticExpression(receiver: GoPtr<Checker>, parent: GoPtr<Node>, t: GoPtr<Type>, isSpread: bool, tupleNameSource: GoPtr<Node>): GoPtr<Node> {
  const result = NewSyntheticExpression(receiver!.factory, t, isSpread, tupleNameSource);
  result!.Loc = parent!.Loc;
  result!.Parent = parent;
  return result;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.findContextualNode","kind":"method","status":"implemented","sigHash":"d9adfd2b36982eef1d5ebde5bb713a30eba60be48369832c8c2d57b8c2d3665c","bodyHash":"85c92711e73de7520fff3b19ee28ce9c378c0e8a4e03ccf2ec59ce120516bdba"}
 *
 * Go source:
 * func (c *Checker) findContextualNode(node *ast.Node, includeCaches bool) int {
 * 	for i, info := range c.contextualInfos {
 * 		if node == info.node && (includeCaches || !info.isCache) {
 * 			return i
 * 		}
 * 	}
 * 	return -1
 * }
 */
export function Checker_findContextualNode(receiver: GoPtr<Checker>, node: GoPtr<Node>, includeCaches: bool): int {
  for (let i = 0; i < receiver!.contextualInfos.length; i++) {
    const info = receiver!.contextualInfos[i]!;
    if (node === info.node && (includeCaches || !info.isCache)) {
      return i;
    }
  }
  return -1;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.hasContextSensitiveReturnExpression","kind":"method","status":"implemented","sigHash":"e780b821073388e6df48be3c74e2e26bf649cb1f85b28247b9046c2e34d3114f","bodyHash":"e76b31fd306a0c6f7d635a0112527a5d874ac9a9789462413ea0730c24d7b881"}
 *
 * Go source:
 * func (c *Checker) hasContextSensitiveReturnExpression(node *ast.Node) bool {
 * 	if node.TypeParameters() != nil || node.Type() != nil {
 * 		return false
 * 	}
 * 	body := node.Body()
 * 	if body == nil {
 * 		return false
 * 	}
 * 	if !ast.IsBlock(body) {
 * 		return c.isContextSensitive(body)
 * 	}
 * 	return ast.ForEachReturnStatement(body, func(statement *ast.Node) bool {
 * 		return statement.Expression() != nil && c.isContextSensitive(statement.Expression())
 * 	})
 * }
 */
export function Checker_hasContextSensitiveReturnExpression(receiver: GoPtr<Checker>, node: GoPtr<Node>): bool {
  if (Node_TypeParameters(node) !== undefined || Node_Type(node) !== undefined) {
    return false;
  }
  const body = Node_Body(node);
  if (body === undefined) {
    return false;
  }
  if (!IsBlock(body)) {
    return Checker_isContextSensitive(receiver, body);
  }
  return ForEachReturnStatement(body, (statement: GoPtr<Node>) => Node_Expression(statement) !== undefined && Checker_isContextSensitive(receiver, Node_Expression(statement)));
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.hasContextSensitiveYieldExpression","kind":"method","status":"implemented","sigHash":"e4fda5b194a4a9df590fd102de48e3e1423b69765a05e3e773b4ff0f40545881","bodyHash":"a10175883ca2bcbf8e3aeea1396993a640cc04c575379d8fca2c7b03f3bd9630"}
 *
 * Go source:
 * func (c *Checker) hasContextSensitiveYieldExpression(node *ast.Node) bool {
 * 	return ast.GetFunctionFlags(node)&ast.FunctionFlagsGenerator != 0 && node.Body() != nil && forEachYieldExpression(node.Body(), c.isContextSensitive)
 * }
 */
export function Checker_hasContextSensitiveYieldExpression(receiver: GoPtr<Checker>, node: GoPtr<Node>): bool {
  const body = Node_Body(node);
  return (GetFunctionFlags(node) & FunctionFlagsGenerator) !== 0 && body !== undefined && forEachYieldExpression(body, (expr: GoPtr<Node>) => Checker_isContextSensitive(receiver, expr));
}
