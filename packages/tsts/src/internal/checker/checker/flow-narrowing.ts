import type { bool } from "../../../go/scalars.js";
import type { GoPtr, GoSlice } from "../../../go/compat.js";
import type { Node } from "../../ast/spine.js";
import { Node_Name } from "../../ast/spine.js";
import { Node_Body, Node_Elements, Node_Expression, Node_Initializer, Node_ModifierFlags, Node_Parameters, Node_Text, Node_Type } from "../../ast/ast.js";
import type { SignatureDeclaration } from "../../ast/generated/unions.js";
import {
  KindArrowFunction,
  KindArrayLiteralExpression,
  KindBarBarToken,
  KindBigIntLiteral,
  KindCallSignature,
  KindClassExpression,
  KindConditionalExpression,
  KindConstructor,
  KindFalseKeyword,
  KindFunctionDeclaration,
  KindFunctionExpression,
  KindFunctionType,
  KindGetAccessor,
  KindIdentifier,
  KindJSDoc,
  KindJsxElement,
  KindJsxExpression,
  KindJsxSelfClosingElement,
  KindMethodDeclaration,
  KindMethodSignature,
  KindNoSubstitutionTemplateLiteral,
  KindNullKeyword,
  KindNumericLiteral,
  KindObjectLiteralExpression,
  KindParenthesizedExpression,
  KindPropertyAccessExpression,
  KindQuestionQuestionToken,
  KindRegularExpressionLiteral,
  KindSetAccessor,
  KindStringLiteral,
  KindTemplateExpression,
  KindThisKeyword,
  KindTrueKeyword,
  KindUndefinedKeyword,
  KindVoidExpression,
} from "../../ast/generated/kinds.js";
import { CheckFlagsHasNeverType, CheckFlagsNonUniformAndLiteral } from "../../ast/checkflags.js";
import { GetFunctionFlags, FunctionFlagsNormal } from "../../ast/functionflags.js";
import { ModifierFlagsAmbient } from "../../ast/modifierflags.js";
import { IsArrayBindingPattern, IsBinaryExpression, IsBindingElement, IsBlock, IsConditionalTypeNode, IsConstructorDeclaration, IsIdentifier, IsMappedTypeNode, IsModuleBlock, IsObjectBindingPattern, IsParameterDeclaration, IsPropertyAccessExpression, IsPropertyDeclaration, IsSourceFile, IsVariableDeclaration } from "../../ast/generated/predicates.js";
import type { Symbol } from "../../ast/symbol.js";
import type { Diagnostic } from "../../ast/diagnostic.js";
import { NodeFlagsAmbient, NodeFlagsConstant, SymbolFlagsAccessor, SymbolFlagsEnum, SymbolFlagsMethod, SymbolFlagsOptional, SymbolFlagsProperty, SymbolFlagsVariable } from "../../ast/generated/flags.js";
import { AsBinaryExpression, AsConditionalExpression, AsConditionalTypeNode, AsMappedTypeNode, AsTypePredicateNode } from "../../ast/generated/casts.js";
import { FindAncestor, ForEachReturnStatement, GetImmediatelyInvokedFunctionExpression, GetRootDeclaration, GetThisParameter, IsAccessExpression, IsFunctionLike, IsLogicalOrCoalescingBinaryExpression, IsModuleExportsAccessExpression, IsStatement, IsStatic, OEKAll, SkipOuterExpressions, SkipParentheses } from "../../ast/utilities.js";
import {
  TypeFlagsAnyOrUnknown,
  TypeFlagsBigInt,
  TypeFlagsBigIntLiteral,
  TypeFlagsEnumLiteral,
  TypeFlagsNever,
  TypeFlagsNull,
  TypeFlagsNumber,
  TypeFlagsNumberLiteral,
  TypeFlagsString,
  TypeFlagsStringLiteral,
  TypeFlagsTypeParameter,
  TypeFlagsTypeVariable,
  TypeFlagsUnion,
  TypeFlagsUndefined,
  TypeFlagsVoid,
  Type_AsLiteralType,
  Type_AsSubstitutionType,
  TypePredicateKindAssertsThis,
  TypePredicateKindThis,
  SignatureKindCall,
  NodeCheckFlagsInCheckIdentifier,
  type NodeLinks,
} from "../types.js";
import type { Type, TypePredicate } from "../types.js";
import { Checker_getFlowTypeOfReference, Checker_getFlowTypeOfReferenceEx, getFlowNodeOfNode } from "../flow.js";
import { AssignmentKindDefinite, AssignmentKindNone, getAssignmentTargetKind, hasDotDotDotToken } from "../utilities.js";
import { LinkStore_Get, type LinkStore } from "../../core/linkstore.js";
import {
  Checker_getBaseConstraintOrType,
  Checker_getInferenceContext,
  Checker_getImpliedConstraint,
  Checker_getSubstitutionType,
  Checker_isConstraintPosition,
  Checker_isGenericTypeWithUnionConstraint,
  Checker_isNoInferType,
} from "./inference.js";
import { IsTruthy } from "../../evaluator/evaluator.js";
import { Checker_checkTypeAssignableToEx, Checker_getTypeNameForErrorDisplay, Checker_getTypePredicateOfSignature } from "../relater.js";
import { Checker_checkIfExpressionRefinesAnyParameter, Checker_getConstraintOfTypeParameter, Checker_getContextualSignature, Checker_getSignatureFromDeclaration, Checker_getSignaturesOfType, Checker_getTypeParameterFromMappedType } from "./signatures.js";
import { Checker_getSyntheticElementAccess, Checker_getIndexedAccessType, Checker_getResolvedSymbolOrNil, Checker_getSymbolAtLocation, Checker_getTypeOfPropertyInBaseClass, Checker_getTypeOfSymbol, Checker_isAutoTypedProperty, Checker_isPropertyWithoutInitializer, Checker_isSomeSymbolAssigned, Checker_isSymbolUsedInBinaryExpressionChain, Checker_isSymbolUsedInConditionBody } from "./symbols.js";
import { Checker_checkExpression, Checker_checkExpressionEx, Checker_errorAndMaybeSuggestAwait, Checker_functionHasImplicitReturn, Checker_getCombinedNodeFlagsCached } from "./syntax-checking.js";
import {
  Checker_filterType,
  Checker_getActualTypeVariable,
  Checker_getAwaitedTypeOfPromise,
  Checker_getBaseTypeOfLiteralType,
  Checker_getBindingElementTypeFromParentType,
  Checker_getHomomorphicTypeVariable,
  Checker_getIntersectionType,
  Checker_getNumberLiteralType,
  Checker_getOptionalType,
  Checker_getReducedApparentType,
  Checker_getTypeForBindingElementParent,
  Checker_getTypeFromTypeNode,
  Checker_getUnionType,
  Checker_hasContextualTypeWithNoGenericTypes,
  Checker_hasTypeFacts,
  Checker_containsUndefinedType,
  Checker_isArrayOrTupleType,
  Checker_isContextSensitiveFunctionOrObjectLiteralMethod,
  Checker_instantiateType,
  Checker_mapType,
  Checker_removeMissingType,
} from "./types.js";
import {
  CheckModeInferential,
  CheckModeNormal,
  PredicateSemanticsAlways,
  PredicateSemanticsNever,
  PredicateSemanticsSometimes,
  TypeFactsTruthy,
  everyType,
  getNumberLiteralValue,
  getStringLiteralValue,
  isZeroBigInt,
  isTupleType,
  signatureHasRestParameter,
  someType,
} from "./state.js";
import type { Checker, CheckMode, PredicateSemantics } from "./state.js";
import { Checker_getResolvedSymbol } from "./symbols.js";
import { Checker_checkSourceElement, Checker_error } from "./support.js";
import { Checker_symbolToString } from "../printer.js";
import { isTypeAssertion } from "../utilities.js";
import { DiagnosticsCollection_Add, NewDiagnosticChain } from "../../ast/diagnostic.js";
import {
  A_type_predicate_cannot_reference_element_0_in_a_binding_pattern,
  A_type_predicate_cannot_reference_a_rest_parameter,
  A_type_predicate_is_only_allowed_in_return_type_position_for_functions_and_methods,
  A_type_predicate_s_type_must_be_assignable_to_its_parameter_s_type,
  An_expression_of_type_void_cannot_be_tested_for_truthiness,
  Cannot_find_parameter_0,
  This_condition_will_always_return_0,
  This_condition_will_always_return_true_since_this_0_is_always_defined,
  This_condition_will_always_return_true_since_this_function_is_always_defined_Did_you_mean_to_call_it_instead,
  Property_0_is_used_before_being_assigned,
  This_kind_of_expression_is_always_falsy,
  This_kind_of_expression_is_always_truthy,
} from "../../diagnostics/generated/messages.js";
import { Checker_addDiagnostic } from "../checker.js";
import { Checker_addOptionalityEx } from "./support-queries.js";

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.checkTypePredicate","kind":"method","status":"implemented","sigHash":"6da97a8a624e73d4a6eb203ec1af1e20c6662fbe42888fcc923e66c300d1fe8d","bodyHash":"ec6787ccb2faf06f7424909fe154523489d03211c89fd122393ed373e739f365"}
 *
 * Go source:
 * func (c *Checker) checkTypePredicate(node *ast.Node) {
 * 	parent := c.getTypePredicateParent(node)
 * 	if parent == nil {
 * 		// The parent must not be valid.
 * 		c.error(node, diagnostics.A_type_predicate_is_only_allowed_in_return_type_position_for_functions_and_methods)
 * 		return
 * 	}
 * 	signature := c.getSignatureFromDeclaration(parent)
 * 	typePredicate := c.getTypePredicateOfSignature(signature)
 * 	if typePredicate == nil {
 * 		return
 * 	}
 * 	c.checkSourceElement(node.Type())
 * 	parameterName := node.AsTypePredicateNode().ParameterName
 * 	if typePredicate.kind != TypePredicateKindThis && typePredicate.kind != TypePredicateKindAssertsThis {
 * 		if typePredicate.parameterIndex >= 0 {
 * 			if signatureHasRestParameter(signature) && int(typePredicate.parameterIndex) == len(signature.parameters)-1 {
 * 				c.error(parameterName, diagnostics.A_type_predicate_cannot_reference_a_rest_parameter)
 * 			} else {
 * 				if typePredicate.t != nil {
 * 					var diags []*ast.Diagnostic
 * 					if !c.checkTypeAssignableToEx(typePredicate.t, c.getTypeOfSymbol(signature.parameters[typePredicate.parameterIndex]), node.Type(), nil /*headMessage* /, &diags) {
 * 						c.addDiagnostic(ast.NewDiagnosticChain(diags[0], diagnostics.A_type_predicate_s_type_must_be_assignable_to_its_parameter_s_type))
 * 					}
 * 				}
 * 			}
 * 		} else if parameterName != nil {
 * 			hasReportedError := false
 * 			for _, param := range parent.Parameters() {
 * 				name := param.Name()
 * 				if ast.IsBindingPattern(name) && c.checkIfTypePredicateVariableIsDeclaredInBindingPattern(name, parameterName, typePredicate.parameterName) {
 * 					hasReportedError = true
 * 					break
 * 				}
 * 			}
 * 			if !hasReportedError {
 * 				c.error(parameterName, diagnostics.Cannot_find_parameter_0, typePredicate.parameterName)
 * 			}
 * 		}
 * 	}
 * }
 */
export function Checker_checkTypePredicate(receiver: GoPtr<Checker>, node: GoPtr<Node>): void {
  const parent = Checker_getTypePredicateParent(receiver, node);
  if (parent === undefined) {
    Checker_error(receiver, node, A_type_predicate_is_only_allowed_in_return_type_position_for_functions_and_methods);
    return;
  }
  const signature = Checker_getSignatureFromDeclaration(receiver, parent);
  const typePredicate = Checker_getTypePredicateOfSignature(receiver, signature);
  if (typePredicate === undefined) {
    return;
  }
  Checker_checkSourceElement(receiver, Node_Type(node));
  const parameterName = AsTypePredicateNode(node)!.ParameterName;
  if (typePredicate!.kind !== TypePredicateKindThis && typePredicate!.kind !== TypePredicateKindAssertsThis) {
    if (typePredicate!.parameterIndex >= 0) {
      if (signatureHasRestParameter(signature) && typePredicate!.parameterIndex === signature!.parameters.length - 1) {
        Checker_error(receiver, parameterName, A_type_predicate_cannot_reference_a_rest_parameter);
      } else if (typePredicate!.t !== undefined) {
        const diags: GoSlice<GoPtr<Diagnostic>> = [];
        if (!Checker_checkTypeAssignableToEx(receiver, typePredicate!.t, Checker_getTypeOfSymbol(receiver, signature!.parameters[typePredicate!.parameterIndex]), Node_Type(node), undefined, diags)) {
          Checker_addDiagnostic(receiver, NewDiagnosticChain(diags[0], A_type_predicate_s_type_must_be_assignable_to_its_parameter_s_type));
        }
      }
    } else if (parameterName !== undefined) {
      let hasReportedError = false;
      for (const param of Node_Parameters(parent)) {
        const name = Node_Name(param);
        if (name !== undefined && (IsArrayBindingPattern(name) || IsObjectBindingPattern(name)) &&
          Checker_checkIfTypePredicateVariableIsDeclaredInBindingPattern(receiver, name, parameterName, typePredicate!.parameterName)) {
          hasReportedError = true;
          break;
        }
      }
      if (!hasReportedError) {
        Checker_error(receiver, parameterName, Cannot_find_parameter_0, typePredicate!.parameterName);
      }
    }
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getTypePredicateParent","kind":"method","status":"implemented","sigHash":"5d5b47ef4c3a3d51ca7072a8acbc3731fff80ef845b93a50812dfb702beb6cd3","bodyHash":"9e8a1e75b418c00955c001a701658ac96ee1388e001004a72a94f24596170cc5"}
 *
 * Go source:
 * func (c *Checker) getTypePredicateParent(node *ast.Node) *ast.SignatureDeclaration {
 * 	parent := node.Parent
 * 	switch parent.Kind {
 * 	case ast.KindArrowFunction, ast.KindCallSignature, ast.KindFunctionDeclaration, ast.KindFunctionExpression, ast.KindFunctionType,
 * 		ast.KindMethodDeclaration, ast.KindMethodSignature:
 * 		if node == parent.Type() {
 * 			return parent
 * 		}
 * 	}
 * 	return nil
 * }
 */
export function Checker_getTypePredicateParent(receiver: GoPtr<Checker>, node: GoPtr<Node>): GoPtr<SignatureDeclaration> {
  const parent = node!.Parent;
  switch (parent!.Kind) {
    case KindArrowFunction:
    case KindCallSignature:
    case KindFunctionDeclaration:
    case KindFunctionExpression:
    case KindFunctionType:
    case KindMethodDeclaration:
    case KindMethodSignature:
      if (node === Node_Type(parent)) {
        return parent as GoPtr<SignatureDeclaration>;
      }
  }
  return undefined;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.checkIfTypePredicateVariableIsDeclaredInBindingPattern","kind":"method","status":"implemented","sigHash":"3a053da61b0d243ae8c9547ac4b753424b376377356f06f2d1c173b63d23981d","bodyHash":"9ac8552d841ef25ec49f911c9d69a9fe2783049244a6d07f63a41e1a5897f66f"}
 *
 * Go source:
 * func (c *Checker) checkIfTypePredicateVariableIsDeclaredInBindingPattern(pattern *ast.Node, predicateVariableNode *ast.Node, predicateVariableName string) bool {
 * 	for _, element := range pattern.Elements() {
 * 		name := element.Name()
 * 		if name == nil {
 * 			continue
 * 		}
 * 		if ast.IsIdentifier(name) && name.Text() == predicateVariableName {
 * 			c.error(predicateVariableNode, diagnostics.A_type_predicate_cannot_reference_element_0_in_a_binding_pattern, predicateVariableName)
 * 			return true
 * 		}
 * 		if ast.IsArrayBindingPattern(name) || ast.IsObjectBindingPattern(name) {
 * 			if c.checkIfTypePredicateVariableIsDeclaredInBindingPattern(name, predicateVariableNode, predicateVariableName) {
 * 				return true
 * 			}
 * 		}
 * 	}
 * 	return false
 * }
 */
export function Checker_checkIfTypePredicateVariableIsDeclaredInBindingPattern(receiver: GoPtr<Checker>, pattern: GoPtr<Node>, predicateVariableNode: GoPtr<Node>, predicateVariableName: string): bool {
  for (const element of Node_Elements(pattern) ?? []) {
    const name = Node_Name(element);
    if (name === undefined) {
      continue;
    }
    if (IsIdentifier(name) && Node_Text(name) === predicateVariableName) {
      Checker_error(receiver, predicateVariableNode, A_type_predicate_cannot_reference_element_0_in_a_binding_pattern, predicateVariableName);
      return true;
    }
    if (IsArrayBindingPattern(name) || IsObjectBindingPattern(name)) {
      if (Checker_checkIfTypePredicateVariableIsDeclaredInBindingPattern(receiver, name, predicateVariableNode, predicateVariableName)) {
        return true;
      }
    }
  }
  return false;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.checkTestingKnownTruthyCallableOrAwaitableOrEnumMemberType","kind":"method","status":"implemented","sigHash":"f32e8f874ec193984d57dfa4d6941de3f577248eba28ba7bc87bc05db42c849d","bodyHash":"c433da68a0b8b08451c540da563cb3bee121d9dd65f35e1661b51e56e5f11a1c"}
 *
 * Go source:
 * func (c *Checker) checkTestingKnownTruthyCallableOrAwaitableOrEnumMemberType(condExpr *ast.Node, condType *Type, body *ast.Node) {
 * 	if !c.strictNullChecks {
 * 		return
 * 	}
 * 	c.checkTestingKnownTruthyTypes(condExpr, condType, body)
 * }
 */
export function Checker_checkTestingKnownTruthyCallableOrAwaitableOrEnumMemberType(receiver: GoPtr<Checker>, condExpr: GoPtr<Node>, condType: GoPtr<Type>, body: GoPtr<Node>): void {
  if (!receiver!.strictNullChecks) {
    return;
  }
  Checker_checkTestingKnownTruthyTypes(receiver, condExpr, condType, body);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.checkTestingKnownTruthyTypes","kind":"method","status":"implemented","sigHash":"89723afd90d8696f6daafdafede3e44a75f12409f701542fc417d60278056db8","bodyHash":"074c27d724fda68d64b8b253726a57c30ce811238962b2d27edbc425819cfa97"}
 *
 * Go source:
 * func (c *Checker) checkTestingKnownTruthyTypes(condExpr *ast.Node, condType *Type, body *ast.Node) {
 * 	condExpr = ast.SkipParentheses(condExpr)
 * 	c.checkTestingKnownTruthyType(condExpr, condType, body)
 * 	for ast.IsBinaryExpression(condExpr) && (condExpr.AsBinaryExpression().OperatorToken.Kind == ast.KindBarBarToken || condExpr.AsBinaryExpression().OperatorToken.Kind == ast.KindQuestionQuestionToken) {
 * 		condExpr = ast.SkipParentheses(condExpr.AsBinaryExpression().Left)
 * 		c.checkTestingKnownTruthyType(condExpr, condType, body)
 * 	}
 * }
 */
export function Checker_checkTestingKnownTruthyTypes(receiver: GoPtr<Checker>, condExpr: GoPtr<Node>, condType: GoPtr<Type>, body: GoPtr<Node>): void {
  condExpr = SkipParentheses(condExpr);
  Checker_checkTestingKnownTruthyType(receiver, condExpr, condType, body);
  while (
    IsBinaryExpression(condExpr) &&
    (AsBinaryExpression(condExpr)!.OperatorToken!.Kind === KindBarBarToken ||
      AsBinaryExpression(condExpr)!.OperatorToken!.Kind === KindQuestionQuestionToken)
  ) {
    condExpr = SkipParentheses(AsBinaryExpression(condExpr)!.Left);
    Checker_checkTestingKnownTruthyType(receiver, condExpr, condType, body);
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.checkTestingKnownTruthyType","kind":"method","status":"implemented","sigHash":"38a235308478e99e741b74f6c7d68c8ca0cf4a1b3fe0ad2a6659cb46a9bc22a1","bodyHash":"ddcc9ab8890761794f012a6da134ee6bd64dba8da29afefb2b34af086928b2fd"}
 *
 * Go source:
 * func (c *Checker) checkTestingKnownTruthyType(condExpr *ast.Node, condType *Type, body *ast.Node) {
 * 	location := condExpr
 * 	if ast.IsLogicalOrCoalescingBinaryExpression(condExpr) {
 * 		location = ast.SkipParentheses(condExpr.AsBinaryExpression().Right)
 * 	}
 * 	if ast.IsModuleExportsAccessExpression(location) {
 * 		return
 * 	}
 * 	if ast.IsLogicalOrCoalescingBinaryExpression(location) {
 * 		c.checkTestingKnownTruthyTypes(location, condType, body)
 * 		return
 * 	}
 * 	t := condType
 * 	if location != condExpr {
 * 		t = c.checkExpression(location)
 * 	}
 * 	if t.flags&TypeFlagsEnumLiteral != 0 && ast.IsPropertyAccessExpression(location) && core.OrElse(c.getResolvedSymbolOrNil(location.Expression()), c.unknownSymbol).Flags&ast.SymbolFlagsEnum != 0 {
 * 		// EnumLiteral type at condition with known value is always truthy or always falsy, likely an error
 * 		c.error(location, diagnostics.This_condition_will_always_return_0, core.IfElse(evaluator.IsTruthy(t.AsLiteralType().value), "true", "false"))
 * 		return
 * 	}
 * 	isPropertyExpressionCast := ast.IsPropertyAccessExpression(location) && isTypeAssertion(location.Expression())
 * 	if !c.hasTypeFacts(t, TypeFactsTruthy) || isPropertyExpressionCast {
 * 		return
 * 	}
 * 	// While it technically should be invalid for any known-truthy value
 * 	// to be tested, we de-scope to functions and Promises unreferenced in
 * 	// the block as a heuristic to identify the most common bugs. There
 * 	// are too many false positives for values sourced from type
 * 	// definitions without strictNullChecks otherwise.
 * 	callSignatures := c.getSignaturesOfType(t, SignatureKindCall)
 * 	isPromise := c.getAwaitedTypeOfPromise(t) != nil
 * 	if len(callSignatures) == 0 && !isPromise {
 * 		return
 * 	}
 * 	var testedNode *ast.Node
 * 	switch {
 * 	case ast.IsIdentifier(location):
 * 		testedNode = location
 * 	case ast.IsPropertyAccessExpression(location):
 * 		testedNode = location.Name()
 * 	}
 * 	var testedSymbol *ast.Symbol
 * 	if testedNode != nil {
 * 		testedSymbol = c.getSymbolAtLocation(testedNode, false)
 * 	}
 * 	if testedSymbol == nil && !isPromise {
 * 		return
 * 	}
 * 	isUsed := testedSymbol != nil && ast.IsBinaryExpression(condExpr.Parent) && c.isSymbolUsedInBinaryExpressionChain(condExpr.Parent, testedSymbol) ||
 * 		testedSymbol != nil && body != nil && c.isSymbolUsedInConditionBody(condExpr, body, testedNode, testedSymbol)
 * 	if !isUsed {
 * 		if isPromise {
 * 			c.errorAndMaybeSuggestAwait(location, true, diagnostics.This_condition_will_always_return_true_since_this_0_is_always_defined, c.getTypeNameForErrorDisplay(t))
 * 		} else {
 * 			c.error(location, diagnostics.This_condition_will_always_return_true_since_this_function_is_always_defined_Did_you_mean_to_call_it_instead)
 * 		}
 * 	}
 * }
 */
export function Checker_checkTestingKnownTruthyType(receiver: GoPtr<Checker>, condExpr: GoPtr<Node>, condType: GoPtr<Type>, body: GoPtr<Node>): void {
  let location = condExpr;
  if (IsLogicalOrCoalescingBinaryExpression(condExpr)) {
    location = SkipParentheses(AsBinaryExpression(condExpr)!.Right);
  }
  if (IsModuleExportsAccessExpression(location)) {
    return;
  }
  if (IsLogicalOrCoalescingBinaryExpression(location)) {
    Checker_checkTestingKnownTruthyTypes(receiver, location, condType, body);
    return;
  }
  let t = condType;
  if (location !== condExpr) {
    t = Checker_checkExpression(receiver, location);
  }
  if (
    (t!.flags & TypeFlagsEnumLiteral) !== 0 &&
    IsPropertyAccessExpression(location) &&
    ((Checker_getResolvedSymbolOrNil(receiver, Node_Expression(location)) ?? receiver!.unknownSymbol)!.Flags & SymbolFlagsEnum) !== 0
  ) {
    Checker_error(receiver, location, This_condition_will_always_return_0, IsTruthy(Type_AsLiteralType(t)!.value) ? "true" : "false");
    return;
  }
  const isPropertyExpressionCast = IsPropertyAccessExpression(location) && isTypeAssertion(Node_Expression(location));
  if (!Checker_hasTypeFacts(receiver, t, TypeFactsTruthy) || isPropertyExpressionCast) {
    return;
  }
  const callSignatures = Checker_getSignaturesOfType(receiver, t, SignatureKindCall);
  const isPromise = Checker_getAwaitedTypeOfPromise(receiver, t) !== undefined;
  if (callSignatures.length === 0 && !isPromise) {
    return;
  }
  let testedNode: GoPtr<Node>;
  if (IsIdentifier(location)) {
    testedNode = location;
  } else if (IsPropertyAccessExpression(location)) {
    testedNode = Node_Name(location);
  }
  let testedSymbol: GoPtr<Symbol>;
  if (testedNode !== undefined) {
    testedSymbol = Checker_getSymbolAtLocation(receiver, testedNode, false);
  }
  if (testedSymbol === undefined && !isPromise) {
    return;
  }
  const isUsed =
    (testedSymbol !== undefined && IsBinaryExpression(condExpr!.Parent) &&
      Checker_isSymbolUsedInBinaryExpressionChain(receiver, condExpr!.Parent, testedSymbol)) ||
    (testedSymbol !== undefined && body !== undefined && testedNode !== undefined &&
      Checker_isSymbolUsedInConditionBody(receiver, condExpr, body, testedNode, testedSymbol));
  if (!isUsed) {
    if (isPromise) {
      Checker_errorAndMaybeSuggestAwait(receiver, location, true, This_condition_will_always_return_true_since_this_0_is_always_defined, Checker_getTypeNameForErrorDisplay(receiver, t));
    } else {
      Checker_error(receiver, location, This_condition_will_always_return_true_since_this_function_is_always_defined_Did_you_mean_to_call_it_instead);
    }
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.checkTruthinessExpression","kind":"method","status":"implemented","sigHash":"6e25990a1754e2ea8ba458bc7c48fae7fb2e6a7eb41df3c6d20c8c30b90b401e","bodyHash":"1c9d962ca70e1eedd75c1fdf70818c6faf2150c2758f0f48ac5d1407cdbc0c67"}
 *
 * Go source:
 * func (c *Checker) checkTruthinessExpression(node *ast.Node, checkMode CheckMode) *Type {
 * 	return c.checkTruthinessOfType(c.checkExpressionEx(node, checkMode), node)
 * }
 */
export function Checker_checkTruthinessExpression(receiver: GoPtr<Checker>, node: GoPtr<Node>, checkMode: CheckMode): GoPtr<Type> {
  return Checker_checkTruthinessOfType(receiver, Checker_checkExpressionEx(receiver, node, checkMode), node);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getFlowTypeOfAccessExpression","kind":"method","status":"implemented","sigHash":"8594769a41457b2c78a2bec6476615602b76dc1b190dc10c87ead2dff597ceae","bodyHash":"1ee134993689e3d24490ce815928e98aa164f1b7d0677e763ca4bf89a4c88fa4"}
 *
 * Go source:
 * func (c *Checker) getFlowTypeOfAccessExpression(node *ast.Node, prop *ast.Symbol, propType *Type, errorNode *ast.Node, checkMode CheckMode) *Type {
 * 	// Only compute control flow type if this is a property access expression that isn't an
 * 	// assignment target, and the referenced property was declared as a variable, property,
 * 	// accessor, or optional method.
 * 	assignmentKind := getAssignmentTargetKind(node)
 * 	if assignmentKind == AssignmentKindDefinite {
 * 		return c.removeMissingType(propType, prop != nil && prop.Flags&ast.SymbolFlagsOptional != 0)
 * 	}
 * 	if prop != nil && prop.Flags&(ast.SymbolFlagsVariable|ast.SymbolFlagsProperty|ast.SymbolFlagsAccessor) == 0 && !(prop.Flags&ast.SymbolFlagsMethod != 0 && propType.flags&TypeFlagsUnion != 0) {
 * 		return propType
 * 	}
 * 	if propType == c.autoType {
 * 		return c.getFlowTypeOfProperty(node, prop)
 * 	}
 * 	propType = c.getNarrowableTypeForReference(propType, node, checkMode)
 * 	// If strict null checks and strict property initialization checks are enabled, if we have
 * 	// a this.xxx property access, if the property is an instance property without an initializer,
 * 	// and if we are in a constructor of the same class as the property declaration, assume that
 * 	// the property is uninitialized at the top of the control flow.
 * 	assumeUninitialized := false
 * 	if c.strictNullChecks && prop != nil {
 * 		if declaration := prop.ValueDeclaration; declaration != nil {
 * 			if c.strictPropertyInitialization && ast.IsAccessExpression(node) && node.Expression().Kind == ast.KindThisKeyword &&
 * 				c.isPropertyWithoutInitializer(declaration) && !ast.IsStatic(declaration) {
 * 				flowContainer := c.getControlFlowContainer(node)
 * 				if ast.IsConstructorDeclaration(flowContainer) && flowContainer.Parent == declaration.Parent && declaration.Flags&ast.NodeFlagsAmbient == 0 {
 * 					assumeUninitialized = true
 * 				}
 * 			} else if ast.IsBinaryExpression(declaration) && ast.IsPropertyAccessExpression(declaration.AsBinaryExpression().Left) &&
 * 				c.getControlFlowContainer(node) == c.getControlFlowContainer(declaration) {
 * 				assumeUninitialized = true
 * 			}
 * 		}
 * 	}
 * 	flowType := c.getFlowTypeOfReferenceEx(node, propType, c.addOptionalityEx(propType, false /*isProperty* /, assumeUninitialized), nil, nil)
 * 	if assumeUninitialized && !c.containsUndefinedType(propType) && c.containsUndefinedType(flowType) {
 * 		c.error(errorNode, diagnostics.Property_0_is_used_before_being_assigned, c.symbolToString(prop))
 * 		// Return the declared type to reduce follow-on errors
 * 		return propType
 * 	}
 * 	if assignmentKind != AssignmentKindNone {
 * 		return c.getBaseTypeOfLiteralType(flowType)
 * 	}
 * 	return flowType
 * }
 */
export function Checker_getFlowTypeOfAccessExpression(receiver: GoPtr<Checker>, node: GoPtr<Node>, prop: GoPtr<Symbol>, propType: GoPtr<Type>, errorNode: GoPtr<Node>, checkMode: CheckMode): GoPtr<Type> {
  const assignmentKind = getAssignmentTargetKind(node);
  if (assignmentKind === AssignmentKindDefinite) {
    return Checker_removeMissingType(receiver, propType, prop !== undefined && (prop!.Flags & SymbolFlagsOptional) !== 0);
  }
  if (
    prop !== undefined &&
    (prop!.Flags & (SymbolFlagsVariable | SymbolFlagsProperty | SymbolFlagsAccessor)) === 0 &&
    !((prop!.Flags & SymbolFlagsMethod) !== 0 && (propType!.flags & TypeFlagsUnion) !== 0)
  ) {
    return propType;
  }
  if (propType === receiver!.autoType) {
    return Checker_getFlowTypeOfProperty(receiver, node, prop);
  }
  propType = Checker_getNarrowableTypeForReference(receiver, propType, node, checkMode);
  let assumeUninitialized = false;
  if (receiver!.strictNullChecks && prop !== undefined) {
    const declaration = prop!.ValueDeclaration;
    if (declaration !== undefined) {
      if (
        receiver!.strictPropertyInitialization &&
        IsAccessExpression(node) &&
        Node_Expression(node)!.Kind === KindThisKeyword &&
        Checker_isPropertyWithoutInitializer(receiver, declaration) &&
        !IsStatic(declaration)
      ) {
        const flowContainer = Checker_getControlFlowContainer(receiver, node);
        if (IsConstructorDeclaration(flowContainer) && flowContainer!.Parent === declaration!.Parent && (declaration!.Flags & NodeFlagsAmbient) === 0) {
          assumeUninitialized = true;
        }
      } else if (
        IsBinaryExpression(declaration) &&
        IsPropertyAccessExpression(AsBinaryExpression(declaration)!.Left) &&
        Checker_getControlFlowContainer(receiver, node) === Checker_getControlFlowContainer(receiver, declaration)
      ) {
        assumeUninitialized = true;
      }
    }
  }
  const flowType = Checker_getFlowTypeOfReferenceEx(receiver, node, propType, Checker_addOptionalityEx(receiver, propType, false, assumeUninitialized), undefined, undefined);
  if (assumeUninitialized && !Checker_containsUndefinedType(receiver, propType) && Checker_containsUndefinedType(receiver, flowType)) {
    Checker_error(receiver, errorNode, Property_0_is_used_before_being_assigned, Checker_symbolToString(receiver, prop));
    return propType;
  }
  if (assignmentKind !== AssignmentKindNone) {
    return Checker_getBaseTypeOfLiteralType(receiver, flowType);
  }
  return flowType;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getControlFlowContainer","kind":"method","status":"implemented","sigHash":"71ce273dd5b459bacd9e005ef2525b814d7330f10eaf79a4b482933e0171ba37","bodyHash":"b6f1b3ab08cfdc85445a1b718f55ebb4b923298a902d109371d15dc34c3ad7ef"}
 *
 * Go source:
 * func (c *Checker) getControlFlowContainer(node *ast.Node) *ast.Node {
 * 	return ast.FindAncestor(node.Parent, func(node *ast.Node) bool {
 * 		return ast.IsFunctionLike(node) && ast.GetImmediatelyInvokedFunctionExpression(node) == nil || ast.IsModuleBlock(node) || ast.IsSourceFile(node) || ast.IsPropertyDeclaration(node)
 * 	})
 * }
 */
export function Checker_getControlFlowContainer(receiver: GoPtr<Checker>, node: GoPtr<Node>): GoPtr<Node> {
  return FindAncestor(node!.Parent, (n) =>
    (IsFunctionLike(n) && GetImmediatelyInvokedFunctionExpression(n) === undefined) ||
    IsModuleBlock(n) ||
    IsSourceFile(n) ||
    IsPropertyDeclaration(n),
  );
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getFlowTypeOfProperty","kind":"method","status":"implemented","sigHash":"354301e8effd608a771096820e3e03be5adbce7d422ee8f6343307e84505e59a","bodyHash":"95e5fca9080cac1952527065a860d2ef4d7f8f8da1f2bb269f0a4d95d84c8cab"}
 *
 * Go source:
 * func (c *Checker) getFlowTypeOfProperty(reference *ast.Node, prop *ast.Symbol) *Type {
 * 	initialType := c.undefinedType
 * 	if prop != nil && prop.ValueDeclaration != nil && (!c.isAutoTypedProperty(prop) || prop.ValueDeclaration.ModifierFlags()&ast.ModifierFlagsAmbient != 0) {
 * 		if baseType := c.getTypeOfPropertyInBaseClass(prop); baseType != nil {
 * 			initialType = baseType
 * 		}
 * 	}
 * 	return c.getFlowTypeOfReferenceEx(reference, c.autoType, initialType, nil, nil)
 * }
 */
export function Checker_getFlowTypeOfProperty(receiver: GoPtr<Checker>, reference: GoPtr<Node>, prop: GoPtr<Symbol>): GoPtr<Type> {
  let initialType = receiver!.undefinedType;
  if (prop !== undefined && prop!.ValueDeclaration !== undefined && (!Checker_isAutoTypedProperty(receiver, prop) || (Node_ModifierFlags(prop!.ValueDeclaration) & ModifierFlagsAmbient) !== 0)) {
    const baseType = Checker_getTypeOfPropertyInBaseClass(receiver, prop);
    if (baseType !== undefined) {
      initialType = baseType;
    }
  }
  return Checker_getFlowTypeOfReferenceEx(receiver, reference, receiver!.autoType, initialType, undefined, undefined);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.checkTruthinessOfType","kind":"method","status":"implemented","sigHash":"57a888003555306acb8494d386081bf67c32f668cd7fb75925f1a0ef1321290f","bodyHash":"5977167b26e179fcbfbf4c7aa9fbf72187b22be1b5ba0302a4a15058ed03f10b"}
 *
 * Go source:
 * func (c *Checker) checkTruthinessOfType(t *Type, node *ast.Node) *Type {
 * 	if t.flags&TypeFlagsVoid != 0 {
 * 		c.error(node, diagnostics.An_expression_of_type_void_cannot_be_tested_for_truthiness)
 * 		return t
 * 	}
 * 	semantics := c.getSyntacticTruthySemantics(node)
 * 	if semantics != PredicateSemanticsSometimes {
 * 		c.error(node, core.IfElse(semantics == PredicateSemanticsAlways, diagnostics.This_kind_of_expression_is_always_truthy, diagnostics.This_kind_of_expression_is_always_falsy))
 * 	}
 * 	return t
 * }
 */
export function Checker_checkTruthinessOfType(receiver: GoPtr<Checker>, t: GoPtr<Type>, node: GoPtr<Node>): GoPtr<Type> {
  if ((t!.flags & TypeFlagsVoid) !== 0) {
    Checker_error(receiver, node, An_expression_of_type_void_cannot_be_tested_for_truthiness);
    return t;
  }
  const semantics = Checker_getSyntacticTruthySemantics(receiver, node);
  if (semantics !== PredicateSemanticsSometimes) {
    Checker_error(receiver, node, semantics === PredicateSemanticsAlways ? This_kind_of_expression_is_always_truthy : This_kind_of_expression_is_always_falsy);
  }
  return t;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getSyntacticTruthySemantics","kind":"method","status":"implemented","sigHash":"aafd356f28695e827a1259a861021e3831401335c8e3da0a20bae5d51ced09d1","bodyHash":"4ec6b5d3b3de70cd64a3d91386dceb76d96f68cca646025716c9617f7328589a"}
 *
 * Go source:
 * func (c *Checker) getSyntacticTruthySemantics(node *ast.Node) PredicateSemantics {
 * 	node = ast.SkipOuterExpressions(node, ast.OEKAll)
 * 	switch node.Kind {
 * 	case ast.KindNumericLiteral:
 * 		// Allow `while(0)` or `while(1)`
 * 		if node.Text() == "0" || node.Text() == "1" {
 * 			return PredicateSemanticsSometimes
 * 		}
 * 		return PredicateSemanticsAlways
 * 	case ast.KindArrayLiteralExpression, ast.KindArrowFunction, ast.KindBigIntLiteral, ast.KindClassExpression, ast.KindFunctionExpression,
 * 		ast.KindJsxElement, ast.KindJsxSelfClosingElement, ast.KindObjectLiteralExpression, ast.KindRegularExpressionLiteral:
 * 		return PredicateSemanticsAlways
 * 	case ast.KindVoidExpression, ast.KindNullKeyword:
 * 		return PredicateSemanticsNever
 * 	case ast.KindNoSubstitutionTemplateLiteral, ast.KindStringLiteral:
 * 		if node.Text() != "" {
 * 			return PredicateSemanticsAlways
 * 		}
 * 		return PredicateSemanticsNever
 * 	case ast.KindConditionalExpression:
 * 		return c.getSyntacticTruthySemantics(node.AsConditionalExpression().WhenTrue) | c.getSyntacticTruthySemantics(node.AsConditionalExpression().WhenFalse)
 * 	case ast.KindIdentifier:
 * 		if c.getResolvedSymbol(node) == c.undefinedSymbol {
 * 			return PredicateSemanticsNever
 * 		}
 * 	}
 * 	return PredicateSemanticsSometimes
 * }
 */
export function Checker_getSyntacticTruthySemantics(receiver: GoPtr<Checker>, node: GoPtr<Node>): PredicateSemantics {
  node = SkipOuterExpressions(node, OEKAll);
  switch (node!.Kind) {
    case KindNumericLiteral:
      if (Node_Text(node) === "0" || Node_Text(node) === "1") {
        return PredicateSemanticsSometimes;
      }
      return PredicateSemanticsAlways;
    case KindArrayLiteralExpression:
    case KindArrowFunction:
    case KindBigIntLiteral:
    case KindClassExpression:
    case KindFunctionExpression:
    case KindJsxElement:
    case KindJsxSelfClosingElement:
    case KindObjectLiteralExpression:
    case KindRegularExpressionLiteral:
      return PredicateSemanticsAlways;
    case KindVoidExpression:
    case KindNullKeyword:
      return PredicateSemanticsNever;
    case KindNoSubstitutionTemplateLiteral:
    case KindStringLiteral:
      if (Node_Text(node) !== "") {
        return PredicateSemanticsAlways;
      }
      return PredicateSemanticsNever;
    case KindConditionalExpression:
      return (Checker_getSyntacticTruthySemantics(receiver, AsConditionalExpression(node)!.WhenTrue) |
        Checker_getSyntacticTruthySemantics(receiver, AsConditionalExpression(node)!.WhenFalse)) as PredicateSemantics;
    case KindIdentifier:
      if (Checker_getResolvedSymbol(receiver, node) === receiver!.undefinedSymbol) {
        return PredicateSemanticsNever;
      }
  }
  return PredicateSemanticsSometimes;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getNarrowedTypeOfSymbol","kind":"method","status":"implemented","sigHash":"f4c9e392b97bbeb538d53422c8b7eead4cda331c7d3d8f5ae3c1539625803c95","bodyHash":"1d8dbf8db55a016a69f8447dff4cedd089fe457213d909f5c0b77305ab2bea27"}
 *
 * Go source:
 * func (c *Checker) getNarrowedTypeOfSymbol(symbol *ast.Symbol, location *ast.Node) *Type {
 * 	t := c.getTypeOfSymbol(symbol)
 * 	declaration := symbol.ValueDeclaration
 * 	if declaration != nil {
 * 		switch {
 * 		// If we have a non-rest binding element with no initializer declared as a const variable or a const-like
 * 		// parameter (a parameter for which there are no assignments in the function body), and if the parent type
 * 		// for the destructuring is a union type, one or more of the binding elements may represent discriminant
 * 		// properties, and we want the effects of conditional checks on such discriminants to affect the types of
 * 		// other binding elements from the same destructuring. Consider:
 * 		//
 * 		//   type Action =
 * 		//       | { kind: 'A', payload: number }
 * 		//       | { kind: 'B', payload: string };
 * 		//
 * 		//   function f({ kind, payload }: Action) {
 * 		//       if (kind === 'A') {
 * 		//           payload.toFixed();
 * 		//       }
 * 		//       if (kind === 'B') {
 * 		//           payload.toUpperCase();
 * 		//       }
 * 		//   }
 * 		//
 * 		// Above, we want the conditional checks on 'kind' to affect the type of 'payload'. To facilitate this, we use
 * 		// the binding pattern AST instance for '{ kind, payload }' as a pseudo-reference and narrow this reference
 * 		// as if it occurred in the specified location. We then recompute the narrowed binding element type by
 * 		// destructuring from the narrowed parent type.
 * 		case ast.IsBindingElement(declaration) && declaration.Initializer() == nil && !hasDotDotDotToken(declaration) && len(declaration.Parent.Elements()) >= 2:
 * 			parent := declaration.Parent.Parent
 * 			rootDeclaration := ast.GetRootDeclaration(parent)
 * 			if ast.IsVariableDeclaration(rootDeclaration) && c.getCombinedNodeFlagsCached(rootDeclaration)&ast.NodeFlagsConstant != 0 || ast.IsParameterDeclaration(rootDeclaration) {
 * 				links := c.nodeLinks.Get(parent)
 * 				if links.flags&NodeCheckFlagsInCheckIdentifier == 0 {
 * 					links.flags |= NodeCheckFlagsInCheckIdentifier
 * 					parentType := c.getTypeForBindingElementParent(parent, CheckModeNormal)
 * 					var parentTypeConstraint *Type
 * 					if parentType != nil {
 * 						parentTypeConstraint = c.mapType(parentType, c.getBaseConstraintOrType)
 * 					}
 * 					if parentTypeConstraint != nil && parentTypeConstraint.flags&TypeFlagsUnion != 0 && !(ast.IsParameterDeclaration(rootDeclaration) && c.isSomeSymbolAssigned(rootDeclaration)) {
 * 						pattern := declaration.Parent
 * 						narrowedType := c.getFlowTypeOfReferenceEx(pattern, parentTypeConstraint, parentTypeConstraint, nil /*flowContainer* /, getFlowNodeOfNode(location))
 * 						if narrowedType.flags&TypeFlagsNever != 0 {
 * 							t = c.neverType
 * 						} else {
 * 							// Destructurings are validated against the parent type elsewhere. Here we disable tuple bounds
 * 							// checks because the narrowed type may have lower arity than the full parent type. For example,
 * 							// for the declaration [x, y]: [1, 2] | [3], we may have narrowed the parent type to just [3].
 * 							t = c.getBindingElementTypeFromParentType(declaration, narrowedType, true /*noTupleBoundsCheck* /)
 * 						}
 * 					}
 * 					links.flags &^= NodeCheckFlagsInCheckIdentifier
 * 				}
 * 			}
 * 		// If we have a const-like parameter with no type annotation or initializer, and if the parameter is contextually
 * 		// typed by a signature with a single rest parameter of a union of tuple types, one or more of the parameters may
 * 		// represent discriminant tuple elements, and we want the effects of conditional checks on such discriminants to
 * 		// affect the types of other parameters in the same parameter list. Consider:
 * 		//
 * 		//   type Action = [kind: 'A', payload: number] | [kind: 'B', payload: string];
 * 		//
 * 		//   const f: (...args: Action) => void = (kind, payload) => {
 * 		//       if (kind === 'A') {
 * 		//           payload.toFixed();
 * 		//       }
 * 		//       if (kind === 'B') {
 * 		//           payload.toUpperCase();
 * 		//       }
 * 		//   }
 * 		//
 * 		// Above, we want the conditional checks on 'kind' to affect the type of 'payload'. To facilitate this, we use
 * 		// the arrow function AST node for '(kind, payload) => ...' as a pseudo-reference and narrow this reference as
 * 		// if it occurred in the specified location. We then recompute the narrowed parameter type by indexing into the
 * 		// narrowed tuple type.
 * 		case ast.IsParameterDeclaration(declaration) && declaration.Type() == nil && declaration.Initializer() == nil && !hasDotDotDotToken(declaration):
 * 			fn := declaration.Parent
 * 			if len(fn.Parameters()) >= 2 && c.isContextSensitiveFunctionOrObjectLiteralMethod(fn) {
 * 				contextualSignature := c.getContextualSignature(fn)
 * 				if contextualSignature != nil && len(contextualSignature.parameters) == 1 && signatureHasRestParameter(contextualSignature) {
 * 					var mapper *TypeMapper
 * 					context := c.getInferenceContext(fn)
 * 					if context != nil {
 * 						mapper = context.nonFixingMapper
 * 					}
 * 					restType := c.getReducedApparentType(c.instantiateType(c.getTypeOfSymbol(contextualSignature.parameters[0]), mapper))
 * 					if restType.flags&TypeFlagsUnion != 0 && everyType(restType, isTupleType) && !core.Some(fn.Parameters(), c.isSomeSymbolAssigned) {
 * 						narrowedType := c.getFlowTypeOfReferenceEx(fn, restType, restType, nil /*flowContainer* /, getFlowNodeOfNode(location))
 * 						index := slices.Index(fn.Parameters(), declaration) - core.IfElse(ast.GetThisParameter(fn) != nil, 1, 0)
 * 						t = c.getIndexedAccessType(narrowedType, c.getNumberLiteralType(jsnum.Number(index)))
 * 					}
 * 				}
 * 			}
 * 		}
 * 	}
 * 	return t
 * }
 */
export function Checker_getNarrowedTypeOfSymbol(receiver: GoPtr<Checker>, symbol_: GoPtr<Symbol>, location: GoPtr<Node>): GoPtr<Type> {
  let t = Checker_getTypeOfSymbol(receiver, symbol_);
  const declaration = symbol_!.ValueDeclaration;
  if (declaration !== undefined) {
    if (
      IsBindingElement(declaration) &&
      Node_Initializer(declaration) === undefined &&
      !hasDotDotDotToken(declaration) &&
      (Node_Elements(declaration!.Parent) ?? []).length >= 2
    ) {
      const parent = declaration!.Parent!.Parent;
      const rootDeclaration = GetRootDeclaration(parent);
      if (
        // Go: c.getCombinedNodeFlagsCached(rootDeclaration) — const-ness lives on the
        // enclosing VariableDeclarationList, not the declaration node itself.
        (IsVariableDeclaration(rootDeclaration) && (Checker_getCombinedNodeFlagsCached(receiver, rootDeclaration) & NodeFlagsConstant) !== 0) ||
        IsParameterDeclaration(rootDeclaration)
      ) {
        const links = LinkStore_Get<GoPtr<Node>, NodeLinks>(receiver!.nodeLinks as unknown as LinkStore<GoPtr<Node>, NodeLinks>, parent)!;
        if ((links.flags & NodeCheckFlagsInCheckIdentifier) === 0) {
          links.flags |= NodeCheckFlagsInCheckIdentifier;
          const parentType = Checker_getTypeForBindingElementParent(receiver, parent, CheckModeNormal);
          let parentTypeConstraint: GoPtr<Type>;
          if (parentType !== undefined) {
            parentTypeConstraint = Checker_mapType(receiver, parentType, (tt) => Checker_getBaseConstraintOrType(receiver, tt));
          }
          if (
            parentTypeConstraint !== undefined &&
            (parentTypeConstraint!.flags & TypeFlagsUnion) !== 0 &&
            !(IsParameterDeclaration(rootDeclaration) && Checker_isSomeSymbolAssigned(receiver, rootDeclaration))
          ) {
            const pattern = declaration!.Parent;
            const narrowedType = Checker_getFlowTypeOfReferenceEx(receiver, pattern, parentTypeConstraint, parentTypeConstraint, undefined, getFlowNodeOfNode(location));
            if ((narrowedType!.flags & TypeFlagsNever) !== 0) {
              t = receiver!.neverType;
            } else {
              t = Checker_getBindingElementTypeFromParentType(receiver, declaration, narrowedType, true);
            }
          }
          links.flags &= ~NodeCheckFlagsInCheckIdentifier;
        }
      }
    } else if (
      IsParameterDeclaration(declaration) &&
      Node_Type(declaration) === undefined &&
      Node_Initializer(declaration) === undefined &&
      !hasDotDotDotToken(declaration)
    ) {
      const fn = declaration!.Parent;
      if (
        (Node_Parameters(fn) ?? []).length >= 2 &&
        Checker_isContextSensitiveFunctionOrObjectLiteralMethod(receiver, fn)
      ) {
        const contextualSignature = Checker_getContextualSignature(receiver, fn);
        if (contextualSignature !== undefined && contextualSignature!.parameters.length === 1 && signatureHasRestParameter(contextualSignature)) {
          let mapper = undefined;
          const context = Checker_getInferenceContext(receiver, fn);
          if (context !== undefined) {
            mapper = context!.nonFixingMapper;
          }
          const restType = Checker_getReducedApparentType(receiver, Checker_instantiateType(receiver, Checker_getTypeOfSymbol(receiver, contextualSignature!.parameters[0]), mapper));
          if (
            (restType!.flags & TypeFlagsUnion) !== 0 &&
            everyType(restType, isTupleType) &&
            !(Node_Parameters(fn) ?? []).some((param) => Checker_isSomeSymbolAssigned(receiver, param))
          ) {
            const narrowedType = Checker_getFlowTypeOfReferenceEx(receiver, fn, restType, restType, undefined, getFlowNodeOfNode(location));
            const index = (Node_Parameters(fn) ?? []).indexOf(declaration) - (GetThisParameter(fn) !== undefined ? 1 : 0);
            t = Checker_getIndexedAccessType(receiver, narrowedType, Checker_getNumberLiteralType(receiver, index));
          }
        }
      }
    }
  }
  return t;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getFlowTypeOfDestructuring","kind":"method","status":"implemented","sigHash":"58b13441bd433693174fb1238a017b0dbfa96fd7c0198dab8839918635019411","bodyHash":"0d7f67b352d0beb5d1e2d4b6bed7d674ce9bbd77a27912a3d14786538232c7b1"}
 *
 * Go source:
 * func (c *Checker) getFlowTypeOfDestructuring(node *ast.Node, declaredType *Type) *Type {
 * 	reference := c.getSyntheticElementAccess(node)
 * 	if reference != nil {
 * 		return c.getFlowTypeOfReference(reference, declaredType)
 * 	}
 * 	return declaredType
 * }
 */
export function Checker_getFlowTypeOfDestructuring(receiver: GoPtr<Checker>, node: GoPtr<Node>, declaredType: GoPtr<Type>): GoPtr<Type> {
  const reference = Checker_getSyntheticElementAccess(receiver, node);
  if (reference !== undefined) {
    return Checker_getFlowTypeOfReference(receiver, reference, declaredType);
  }
  return declaredType;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getTypePredicateFromBody","kind":"method","status":"implemented","sigHash":"0586cd4bbf72e06d5f659fe96eff5fa7be3dd21743651d6936ac58d2c3020178","bodyHash":"6d902d9eb10f50461609d91f2b6fbd7aa526db9ab71c74df54ee4d9d0c69252e"}
 *
 * Go source:
 * func (c *Checker) getTypePredicateFromBody(fn *ast.Node) *TypePredicate {
 * 	switch fn.Kind {
 * 	case ast.KindConstructor, ast.KindGetAccessor, ast.KindSetAccessor:
 * 		return nil
 * 	}
 * 	functionFlags := ast.GetFunctionFlags(fn)
 * 	if functionFlags != ast.FunctionFlagsNormal {
 * 		return nil
 * 	}
 * 	// Only attempt to infer a type predicate if there's exactly one return.
 * 	var singleReturn *ast.Node
 * 	body := fn.Body()
 * 	if body != nil && !ast.IsBlock(body) {
 * 		// arrow function
 * 		singleReturn = body
 * 	} else {
 * 		bailedEarly := ast.ForEachReturnStatement(body, func(returnStatement *ast.Node) bool {
 * 			if singleReturn != nil || returnStatement.Expression() == nil {
 * 				return true
 * 			}
 * 			singleReturn = returnStatement.Expression()
 * 			return false
 * 		})
 * 		if bailedEarly || singleReturn == nil || c.functionHasImplicitReturn(fn) {
 * 			return nil
 * 		}
 * 	}
 * 	return c.checkIfExpressionRefinesAnyParameter(fn, singleReturn)
 * }
 */
export function Checker_getTypePredicateFromBody(receiver: GoPtr<Checker>, fn: GoPtr<Node>): GoPtr<TypePredicate> {
  switch (fn!.Kind) {
    case KindConstructor:
    case KindGetAccessor:
    case KindSetAccessor:
      return undefined;
  }
  const functionFlags = GetFunctionFlags(fn);
  if (functionFlags !== FunctionFlagsNormal) {
    return undefined;
  }
  let singleReturn: GoPtr<Node>;
  const body = Node_Body(fn);
  if (body !== undefined && !IsBlock(body)) {
    singleReturn = body;
  } else {
    const bailedEarly = ForEachReturnStatement(body, (returnStatement) => {
      if (singleReturn !== undefined || Node_Expression(returnStatement) === undefined) {
        return true;
      }
      singleReturn = Node_Expression(returnStatement);
      return false;
    });
    if (bailedEarly || singleReturn === undefined || Checker_functionHasImplicitReturn(receiver, fn)) {
      return undefined;
    }
  }
  return Checker_checkIfExpressionRefinesAnyParameter(receiver, fn, singleReturn);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.isDiscriminantWithNeverType","kind":"method","status":"implemented","sigHash":"4fd66392a9407397da9e3d70b1261e390723f76767fda4539301bb2555f75e33","bodyHash":"f0bcb402918ffbf982f70518ebd820aa66a36b3d1b4ce0c9a1df1c77283a014d"}
 *
 * Go source:
 * func (c *Checker) isDiscriminantWithNeverType(prop *ast.Symbol) bool {
 * 	// Return true for a synthetic non-optional property with non-uniform types, where at least one is
 * 	// a literal type and none is never, that reduces to never.
 * 	return prop.Flags&ast.SymbolFlagsOptional == 0 && prop.CheckFlags&(ast.CheckFlagsNonUniformAndLiteral|ast.CheckFlagsHasNeverType) == ast.CheckFlagsNonUniformAndLiteral && c.getTypeOfSymbol(prop).flags&TypeFlagsNever != 0
 * }
 */
export function Checker_isDiscriminantWithNeverType(receiver: GoPtr<Checker>, prop: GoPtr<Symbol>): bool {
  return (
    (prop!.Flags & SymbolFlagsOptional) === 0 &&
    (prop!.CheckFlags & (CheckFlagsNonUniformAndLiteral | CheckFlagsHasNeverType)) === CheckFlagsNonUniformAndLiteral &&
    (Checker_getTypeOfSymbol(receiver, prop)!.flags & TypeFlagsNever) !== 0
  );
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getConditionalFlowTypeOfType","kind":"method","status":"implemented","sigHash":"a886f17e04adc427e26659ba06f389ada132ffc40b090f626d0a1573dda00dd4","bodyHash":"6618f21feab1410d8eb729a36d258723a3ae4145aea944476e39f6a7841041cc"}
 *
 * Go source:
 * func (c *Checker) getConditionalFlowTypeOfType(t *Type, node *ast.Node) *Type {
 * 	var constraints []*Type
 * 	covariant := true
 * 	for node != nil && !ast.IsStatement(node) && node.Kind != ast.KindJSDoc {
 * 		parent := node.Parent
 * 		// only consider variance flipped by parameter locations - `keyof` types would usually be considered variance inverting, but
 * 		// often get used in indexed accesses where they behave sortof invariantly, but our checking is lax
 * 		if ast.IsParameterDeclaration(parent) {
 * 			covariant = !covariant
 * 		}
 * 		// Always substitute on type parameters, regardless of variance, since even
 * 		// in contravariant positions, they may rely on substituted constraints to be valid
 * 		if (covariant || t.flags&TypeFlagsTypeVariable != 0) && ast.IsConditionalTypeNode(parent) && node == parent.AsConditionalTypeNode().TrueType {
 * 			constraint := c.getImpliedConstraint(t, parent.AsConditionalTypeNode().CheckType, parent.AsConditionalTypeNode().ExtendsType)
 * 			if constraint != nil {
 * 				constraints = append(constraints, constraint)
 * 			}
 * 		} else if t.flags&TypeFlagsTypeParameter != 0 && ast.IsMappedTypeNode(parent) && parent.AsMappedTypeNode().NameType == nil && node == parent.Type() {
 * 			mappedType := c.getTypeFromTypeNode(parent)
 * 			if c.getTypeParameterFromMappedType(mappedType) == c.getActualTypeVariable(t) {
 * 				typeParameter := c.getHomomorphicTypeVariable(mappedType)
 * 				if typeParameter != nil {
 * 					constraint := c.getConstraintOfTypeParameter(typeParameter)
 * 					if constraint != nil && everyType(constraint, c.isArrayOrTupleType) {
 * 						constraints = append(constraints, c.getUnionType([]*Type{c.numberType, c.numericStringType}))
 * 					}
 * 				}
 * 			}
 * 		}
 * 		node = parent
 * 	}
 * 	if len(constraints) != 0 {
 * 		return c.getSubstitutionType(t, c.getIntersectionType(constraints))
 * 	}
 * 	return t
 * }
 */
export function Checker_getConditionalFlowTypeOfType(receiver: GoPtr<Checker>, t: GoPtr<Type>, node: GoPtr<Node>): GoPtr<Type> {
  const constraints: GoSlice<GoPtr<Type>> = [];
  let covariant = true;
  while (node !== undefined && !IsStatement(node) && node!.Kind !== KindJSDoc) {
    const parent = node!.Parent;
    if (parent === undefined) {
      break;
    }
    if (IsParameterDeclaration(parent)) {
      covariant = !covariant;
    }
    if (
      (covariant || (t!.flags & TypeFlagsTypeVariable) !== 0) &&
      IsConditionalTypeNode(parent) &&
      node === AsConditionalTypeNode(parent)!.TrueType
    ) {
      const conditional = AsConditionalTypeNode(parent)!;
      const constraint = Checker_getImpliedConstraint(receiver, t, conditional.CheckType, conditional.ExtendsType);
      if (constraint !== undefined) {
        constraints.push(constraint);
      }
    } else if (
      (t!.flags & TypeFlagsTypeParameter) !== 0 &&
      IsMappedTypeNode(parent) &&
      AsMappedTypeNode(parent)!.NameType === undefined &&
      node === AsMappedTypeNode(parent)!.Type
    ) {
      const mappedType = Checker_getTypeFromTypeNode(receiver, parent);
      if (Checker_getTypeParameterFromMappedType(receiver, mappedType) === Checker_getActualTypeVariable(receiver, t)) {
        const typeParameter = Checker_getHomomorphicTypeVariable(receiver, mappedType);
        if (typeParameter !== undefined) {
          const constraint = Checker_getConstraintOfTypeParameter(receiver, typeParameter);
          if (constraint !== undefined && everyType(constraint, (tt) => Checker_isArrayOrTupleType(receiver, tt))) {
            constraints.push(Checker_getUnionType(receiver, [receiver!.numberType, receiver!.numericStringType]));
          }
        }
      }
    }
    node = parent;
  }
  if (constraints.length !== 0) {
    return Checker_getSubstitutionType(receiver, t, Checker_getIntersectionType(receiver, constraints));
  }
  return t;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.removeDefinitelyFalsyTypes","kind":"method","status":"implemented","sigHash":"18185bceb221a18ced8d2e52a099ac3e3fbc882ca5b6b83f9032df76626da0e5","bodyHash":"929c812acf2e45554e6c20967ae8236ba123d944d641e27b3548dd76fb7813b9"}
 *
 * Go source:
 * func (c *Checker) removeDefinitelyFalsyTypes(t *Type) *Type {
 * 	return c.filterType(t, func(t *Type) bool { return c.hasTypeFacts(t, TypeFactsTruthy) })
 * }
 */
export function Checker_removeDefinitelyFalsyTypes(receiver: GoPtr<Checker>, t: GoPtr<Type>): GoPtr<Type> {
  return Checker_filterType(receiver, t, (tt) => Checker_hasTypeFacts(receiver, tt, TypeFactsTruthy));
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.extractDefinitelyFalsyTypes","kind":"method","status":"implemented","sigHash":"73395af2e8380f10ef5b0ea840053bc35cbe76e7eebe0a306dbc9a332adb3595","bodyHash":"83c0cfe7acd2ad3ec8d6dce96f28a8d9ebb6f125c83ab3f6d7cf4decc342ed10"}
 *
 * Go source:
 * func (c *Checker) extractDefinitelyFalsyTypes(t *Type) *Type {
 * 	return c.mapType(t, c.getDefinitelyFalsyPartOfType)
 * }
 */
export function Checker_extractDefinitelyFalsyTypes(receiver: GoPtr<Checker>, t: GoPtr<Type>): GoPtr<Type> {
  return Checker_mapType(receiver, t, (tt) => Checker_getDefinitelyFalsyPartOfType(receiver, tt));
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getDefinitelyFalsyPartOfType","kind":"method","status":"implemented","sigHash":"34b0e830798125942707794d1e639960671eca6f992d9c4b3e375578a4880c56","bodyHash":"6941e4dea735ddd47c5894bf84fe1d82bf427efeae596d8bde36bd613a68a773"}
 *
 * Go source:
 * func (c *Checker) getDefinitelyFalsyPartOfType(t *Type) *Type {
 * 	switch {
 * 	case t.flags&TypeFlagsString != 0:
 * 		return c.emptyStringType
 * 	case t.flags&TypeFlagsNumber != 0:
 * 		return c.zeroType
 * 	case t.flags&TypeFlagsBigInt != 0:
 * 		return c.zeroBigIntType
 * 	case t == c.regularFalseType || t == c.falseType ||
 * 		t.flags&(TypeFlagsVoid|TypeFlagsUndefined|TypeFlagsNull|TypeFlagsAnyOrUnknown) != 0 ||
 * 		t.flags&TypeFlagsStringLiteral != 0 && getStringLiteralValue(t) == "" ||
 * 		t.flags&TypeFlagsNumberLiteral != 0 && getNumberLiteralValue(t) == 0 ||
 * 		t.flags&TypeFlagsBigIntLiteral != 0 && isZeroBigInt(t):
 * 		return t
 * 	}
 * 	return c.neverType
 * }
 */
export function Checker_getDefinitelyFalsyPartOfType(receiver: GoPtr<Checker>, t: GoPtr<Type>): GoPtr<Type> {
  if ((t!.flags & TypeFlagsString) !== 0) {
    return receiver!.emptyStringType;
  } else if ((t!.flags & TypeFlagsNumber) !== 0) {
    return receiver!.zeroType;
  } else if ((t!.flags & TypeFlagsBigInt) !== 0) {
    return receiver!.zeroBigIntType;
  } else if (
    t === receiver!.regularFalseType ||
    t === receiver!.falseType ||
    (t!.flags & (TypeFlagsVoid | TypeFlagsUndefined | TypeFlagsNull | TypeFlagsAnyOrUnknown)) !== 0 ||
    ((t!.flags & TypeFlagsStringLiteral) !== 0 && getStringLiteralValue(t) === "") ||
    ((t!.flags & TypeFlagsNumberLiteral) !== 0 && getNumberLiteralValue(t) === 0) ||
    ((t!.flags & TypeFlagsBigIntLiteral) !== 0 && isZeroBigInt(t))
  ) {
    return t;
  }
  return receiver!.neverType;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.isPossiblyDiscriminantValue","kind":"method","status":"implemented","sigHash":"e9a504f885ec16cafbd9323e6d8cdbc4d961da219c9fa4b14a3d2d0bc7317caa","bodyHash":"356c17428bc0d393e00939216b9b692a4ef873c6f6b271fa4158900141fdd22c"}
 *
 * Go source:
 * func (c *Checker) isPossiblyDiscriminantValue(node *ast.Node) bool {
 * 	switch node.Kind {
 * 	case ast.KindStringLiteral, ast.KindNumericLiteral, ast.KindBigIntLiteral, ast.KindNoSubstitutionTemplateLiteral, ast.KindTemplateExpression,
 * 		ast.KindTrueKeyword, ast.KindFalseKeyword, ast.KindNullKeyword, ast.KindIdentifier, ast.KindUndefinedKeyword:
 * 		return true
 * 	case ast.KindPropertyAccessExpression, ast.KindParenthesizedExpression:
 * 		return c.isPossiblyDiscriminantValue(node.Expression())
 * 	case ast.KindJsxExpression:
 * 		return node.Expression() == nil || c.isPossiblyDiscriminantValue(node.Expression())
 * 	}
 * 	return false
 * }
 */
export function Checker_isPossiblyDiscriminantValue(receiver: GoPtr<Checker>, node: GoPtr<Node>): bool {
  switch (node!.Kind) {
    case KindStringLiteral:
    case KindNumericLiteral:
    case KindBigIntLiteral:
    case KindNoSubstitutionTemplateLiteral:
    case KindTemplateExpression:
    case KindTrueKeyword:
    case KindFalseKeyword:
    case KindNullKeyword:
    case KindIdentifier:
    case KindUndefinedKeyword:
      return true;
    case KindPropertyAccessExpression:
    case KindParenthesizedExpression:
      return Checker_isPossiblyDiscriminantValue(receiver, Node_Expression(node));
    case KindJsxExpression: {
      const expression = Node_Expression(node);
      return expression === undefined || Checker_isPossiblyDiscriminantValue(receiver, expression);
    }
  }
  return false;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getNarrowableTypeForReference","kind":"method","status":"implemented","sigHash":"9309a25334e55699058d18b5bd9b59d8c5fcf6282a13ad9066895e7c52b329fd","bodyHash":"5e2cfdbcf85589d87b9aab820874e8f3907a3c388ef0a173b5ac7edb1f01e0a7"}
 *
 * Go source:
 * func (c *Checker) getNarrowableTypeForReference(t *Type, reference *ast.Node, checkMode CheckMode) *Type {
 * 	if c.isNoInferType(t) {
 * 		t = t.AsSubstitutionType().baseType
 * 	}
 * 	// When the type of a reference is or contains an instantiable type with a union type constraint, and
 * 	// when the reference is in a constraint position (where it is known we'll obtain the apparent type) or
 * 	// has a contextual type containing no top-level instantiables (meaning constraints will determine
 * 	// assignability), we substitute constraints for all instantiables in the type of the reference to give
 * 	// control flow analysis an opportunity to narrow it further. For example, for a reference of a type
 * 	// parameter type 'T extends string | undefined' with a contextual type 'string', we substitute
 * 	// 'string | undefined' to give control flow analysis the opportunity to narrow to type 'string'.
 * 	substituteConstraints := checkMode&CheckModeInferential == 0 && someType(t, c.isGenericTypeWithUnionConstraint) && (c.isConstraintPosition(t, reference) || c.hasContextualTypeWithNoGenericTypes(reference, checkMode))
 * 	if substituteConstraints {
 * 		return c.mapType(t, c.getBaseConstraintOrType)
 * 	}
 * 	return t
 * }
 */
export function Checker_getNarrowableTypeForReference(receiver: GoPtr<Checker>, t: GoPtr<Type>, reference: GoPtr<Node>, checkMode: CheckMode): GoPtr<Type> {
  if (Checker_isNoInferType(receiver, t)) {
    t = Type_AsSubstitutionType(t)!.baseType;
  }
  // When the type of a reference is or contains an instantiable type with a union type constraint, and
  // when the reference is in a constraint position (where it is known we'll obtain the apparent type) or
  // has a contextual type containing no top-level instantiables (meaning constraints will determine
  // assignability), we substitute constraints for all instantiables in the type of the reference to give
  // control flow analysis an opportunity to narrow it further. For example, for a reference of a type
  // parameter type 'T extends string | undefined' with a contextual type 'string', we substitute
  // 'string | undefined' to give control flow analysis the opportunity to narrow to type 'string'.
  const substituteConstraints =
    (checkMode & CheckModeInferential) === 0 &&
    someType(t, (tt) => Checker_isGenericTypeWithUnionConstraint(receiver, tt)) &&
    (Checker_isConstraintPosition(receiver, t, reference) ||
      Checker_hasContextualTypeWithNoGenericTypes(receiver, reference, checkMode));
  if (substituteConstraints) {
    return Checker_mapType(receiver, t, (tt) => Checker_getBaseConstraintOrType(receiver, tt));
  }
  return t;
}
