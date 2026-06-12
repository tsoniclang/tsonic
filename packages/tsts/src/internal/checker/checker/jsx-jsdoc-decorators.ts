import type { bool } from "@tsonic/core/types.js";
import type { GoPtr, GoSlice } from "../../../go/compat.js";
import { Every, Find } from "../../core/core.js";
import type { Node } from "../../ast/spine.js";
import { DiagnosticsCollection_Add, NewDiagnosticChain } from "../../ast/diagnostic.js";
import { Node_Comments, Node_Expression, Node_ModifierNodes } from "../../ast/ast.js";
import { AsDecorator } from "../../ast/generated/casts.js";
import { KindClassDeclaration, KindClassExpression, KindGetAccessor, KindJSDocLink, KindJSDocLinkCode, KindJSDocLinkPlain, KindMethodDeclaration, KindParameter, KindPropertyDeclaration, KindSetAccessor } from "../../ast/generated/kinds.js";
import { IsDecorator, IsParenthesizedExpression } from "../../ast/generated/predicates.js";
import { CanHaveDecorators, HasDecorators, NodeCanBeDecorated } from "../../ast/utilities.js";
import { Node_Name } from "../../ast/spine.js";
import { GetTextOfNode } from "../../scanner/utilities.js";
import { Decorator_function_return_type_0_is_not_assignable_to_type_1, Decorator_function_return_type_is_0_but_is_expected_to_be_void_or_any, X_0_accepts_too_few_arguments_to_be_used_as_a_decorator_here_Did_you_mean_to_call_it_first_and_write_0 } from "../../diagnostics/generated/messages.js";
import type { Signature } from "../types.js";
import { SignatureFlagsNone, SignatureKindCall, SignatureKindConstruct, TypeFlagsAny } from "../types.js";
import { Checker_checkDeprecatedSignature, Checker_getDiagnosticHeadMessageForDecoratorResolution, Checker_invocationErrorDetails, Checker_invocationErrorRecovery, Checker_isErrorType, Checker_resolveErrorCall } from "./diagnostics.js";
import { Checker_checkGrammarDecorator } from "../grammarchecks.js";
import { Checker_checkTypeAssignableTo } from "../relater.js";
import { Checker_error } from "./support.js";
import { Checker_markLinkedReferences } from "./support-queries.js";
import { Checker_checkExpression } from "./syntax-checking.js";
import { Checker_getDecoratorArgumentCount, Checker_getDecoratorCallSignature, Checker_getResolvedSignature, Checker_getReturnTypeOfSignature, Checker_getSignaturesOfType, Checker_isUntypedFunctionCall, Checker_resolveCall, Checker_resolveUntypedCall } from "./signatures.js";
import { Checker_resolveJSDocMemberName } from "./symbols.js";
import { Checker_getApparentType } from "./types.js";
import { CheckModeNormal, ReferenceHintDecorator, signatureHasRestParameter } from "./state.js";
import type { Checker, CheckMode } from "./state.js";

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.checkJSDocComments","kind":"method","status":"implemented","sigHash":"e58b196d503c8592581005e0aae4f2c48e3fff65d2a70e506e53edf7d1d4328e","bodyHash":"ee1f4de7ef19cba84bcce53e6d1c01e94f2bf23d3c2bd11984492beb812f548e"}
 *
 * Go source:
 * func (c *Checker) checkJSDocComments(node *ast.Node) {
 * 	for _, comment := range node.Comments() {
 * 		c.checkJSDocComment(comment)
 * 	}
 * }
 */
export function Checker_checkJSDocComments(receiver: GoPtr<Checker>, node: GoPtr<Node>): void {
  for (const comment of Node_Comments(node) ?? []) {
    Checker_checkJSDocComment(receiver, comment);
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.checkJSDocComment","kind":"method","status":"implemented","sigHash":"36f3030c6225a0075cd0105cf4a055e572b01cdee1840f66518405126906fdcc","bodyHash":"47d97c3b4eca754c4904133281d3676872c04ae48a5e243f4e158f8780328686"}
 *
 * Go source:
 * func (c *Checker) checkJSDocComment(node *ast.Node) {
 * 	// This performs minimal checking of JSDoc nodes to ensure that @link references to entities are recorded
 * 	// for purposes of checking unused identifiers.
 * 	switch node.Kind {
 * 	case ast.KindJSDocLink, ast.KindJSDocLinkCode, ast.KindJSDocLinkPlain:
 * 		c.resolveJSDocMemberName(node.Name())
 * 	}
 * }
 */
export function Checker_checkJSDocComment(receiver: GoPtr<Checker>, node: GoPtr<Node>): void {
  // This performs minimal checking of JSDoc nodes to ensure that @link references to entities are recorded
  // for purposes of checking unused identifiers.
  switch (node!.Kind) {
    case KindJSDocLink:
    case KindJSDocLinkCode:
    case KindJSDocLinkPlain:
      Checker_resolveJSDocMemberName(receiver, Node_Name(node));
      break;
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.checkDecorators","kind":"method","status":"implemented","sigHash":"3e5c8e2fbe4a0b76148106f3264893023071e6c50f819f85ca519741821767df","bodyHash":"f9ffaa06654b4d29673d5809f8faf3238f8da43a0d06256f8e8ace19a23b36c0"}
 *
 * Go source:
 * func (c *Checker) checkDecorators(node *ast.Node) {
 * 	// skip this check for nodes that cannot have decorators. These should have already had an error reported by
 * 	// checkGrammarModifiers.
 * 	if !ast.CanHaveDecorators(node) || !ast.HasDecorators(node) || !ast.NodeCanBeDecorated(c.legacyDecorators, node, node.Parent, node.Parent.Parent) {
 * 		return
 * 	}
 * 	firstDecorator := core.Find(node.ModifierNodes(), ast.IsDecorator)
 * 	if firstDecorator == nil {
 * 		return
 * 	}
 * 	c.markLinkedReferences(node, ReferenceHintDecorator, nil, nil)
 * 	for _, modifier := range node.ModifierNodes() {
 * 		if ast.IsDecorator(modifier) {
 * 			c.checkDecorator(modifier)
 * 		}
 * 	}
 * }
 */
export function Checker_checkDecorators(receiver: GoPtr<Checker>, node: GoPtr<Node>): void {
  // skip this check for nodes that cannot have decorators. These should have already had an error reported by
  // checkGrammarModifiers.
  if (!CanHaveDecorators(node) || !HasDecorators(node) || !NodeCanBeDecorated(receiver!.legacyDecorators, node, node!.Parent, node!.Parent!.Parent)) {
    return;
  }
  const firstDecorator = Find(Node_ModifierNodes(node) ?? [], IsDecorator);
  if (firstDecorator === undefined) {
    return;
  }
  Checker_markLinkedReferences(receiver, node, ReferenceHintDecorator, undefined, undefined);
  for (const modifier of Node_ModifierNodes(node) ?? []) {
    if (IsDecorator(modifier)) {
      Checker_checkDecorator(receiver, modifier);
    }
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.checkDecorator","kind":"method","status":"implemented","sigHash":"2700367e9fee793983d75fc39ab767246cefcc49ebce9856d8f5b8421ae0fe95","bodyHash":"bdc20d00c27a6a387bbf8a741db818c0a6667440d33c4f6c2317fb7ade34f020"}
 *
 * Go source:
 * func (c *Checker) checkDecorator(node *ast.Node) {
 * 	c.checkGrammarDecorator(node.AsDecorator())
 * 	signature := c.getResolvedSignature(node, nil, CheckModeNormal)
 * 	c.checkDeprecatedSignature(signature, node)
 * 	returnType := c.getReturnTypeOfSignature(signature)
 * 	if returnType.flags&TypeFlagsAny != 0 {
 * 		return
 * 	}
 * 	// if we fail to get a signature and return type here, we will have already reported a grammar error in `checkDecorators`.
 * 	decoratorSignature := c.getDecoratorCallSignature(node)
 * 	if decoratorSignature == nil || decoratorSignature.resolvedReturnType == nil {
 * 		return
 * 	}
 * 	var headMessage *diagnostics.Message
 * 	expectedReturnType := decoratorSignature.resolvedReturnType
 * 	switch node.Parent.Kind {
 * 	case ast.KindClassDeclaration, ast.KindClassExpression:
 * 		headMessage = diagnostics.Decorator_function_return_type_0_is_not_assignable_to_type_1
 * 	case ast.KindPropertyDeclaration:
 * 		if !c.legacyDecorators {
 * 			headMessage = diagnostics.Decorator_function_return_type_0_is_not_assignable_to_type_1
 * 			break
 * 		}
 * 		fallthrough
 * 	case ast.KindParameter:
 * 		headMessage = diagnostics.Decorator_function_return_type_is_0_but_is_expected_to_be_void_or_any
 * 	case ast.KindMethodDeclaration, ast.KindGetAccessor, ast.KindSetAccessor:
 * 		headMessage = diagnostics.Decorator_function_return_type_0_is_not_assignable_to_type_1
 * 	default:
 * 		panic("Unhandled case in checkDecorator")
 * 	}
 * 	c.checkTypeAssignableTo(returnType, expectedReturnType, node.Expression(), headMessage)
 * }
 */
export function Checker_checkDecorator(receiver: GoPtr<Checker>, node: GoPtr<Node>): void {
  Checker_checkGrammarDecorator(receiver, AsDecorator(node));
  const signature = Checker_getResolvedSignature(receiver, node, undefined, CheckModeNormal);
  Checker_checkDeprecatedSignature(receiver, signature, node);
  const returnType = Checker_getReturnTypeOfSignature(receiver, signature);
  if ((returnType!.flags & TypeFlagsAny) !== 0) {
    return;
  }
  // if we fail to get a signature and return type here, we will have already reported a grammar error in `checkDecorators`.
  const decoratorSignature = Checker_getDecoratorCallSignature(receiver, node);
  if (decoratorSignature === undefined || decoratorSignature.resolvedReturnType === undefined) {
    return;
  }
  let headMessage;
  const expectedReturnType = decoratorSignature.resolvedReturnType;
  switch (node!.Parent!.Kind) {
    case KindClassDeclaration:
    case KindClassExpression:
      headMessage = Decorator_function_return_type_0_is_not_assignable_to_type_1;
      break;
    case KindPropertyDeclaration:
      if (!receiver!.legacyDecorators) {
        headMessage = Decorator_function_return_type_0_is_not_assignable_to_type_1;
        break;
      }
      headMessage = Decorator_function_return_type_is_0_but_is_expected_to_be_void_or_any;
      break;
    case KindParameter:
      headMessage = Decorator_function_return_type_is_0_but_is_expected_to_be_void_or_any;
      break;
    case KindMethodDeclaration:
    case KindGetAccessor:
    case KindSetAccessor:
      headMessage = Decorator_function_return_type_0_is_not_assignable_to_type_1;
      break;
    default:
      throw new globalThis.Error("Unhandled case in checkDecorator");
  }
  Checker_checkTypeAssignableTo(receiver, returnType, expectedReturnType, Node_Expression(node), headMessage);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.resolveDecorator","kind":"method","status":"implemented","sigHash":"6e07f878a63ec19ec16e3df684224f72330683cda1d3d179ecfef30a41ca29de","bodyHash":"72999c49e45716c8e5e6a92bf5334d3cff132f2c56050e577f48fcf4c28f6412"}
 *
 * Go source:
 * func (c *Checker) resolveDecorator(node *ast.Node, candidatesOutArray *[]*Signature, checkMode CheckMode) *Signature {
 * 	if !ast.CanHaveDecorators(node.Parent) {
 * 		return c.resolveErrorCall(node)
 * 	}
 * 	funcType := c.checkExpression(node.Expression())
 * 	apparentType := c.getApparentType(funcType)
 * 	if c.isErrorType(apparentType) {
 * 		return c.resolveErrorCall(node)
 * 	}
 * 	callSignatures := c.getSignaturesOfType(apparentType, SignatureKindCall)
 * 	numConstructSignatures := len(c.getSignaturesOfType(apparentType, SignatureKindConstruct))
 * 	if c.isUntypedFunctionCall(funcType, apparentType, len(callSignatures), numConstructSignatures) {
 * 		return c.resolveUntypedCall(node)
 * 	}
 * 	if c.isPotentiallyUncalledDecorator(node, callSignatures) && !ast.IsParenthesizedExpression(node.Expression()) {
 * 		nodeStr := scanner.GetTextOfNode(node.Expression())
 * 		c.error(node, diagnostics.X_0_accepts_too_few_arguments_to_be_used_as_a_decorator_here_Did_you_mean_to_call_it_first_and_write_0, nodeStr)
 * 		return c.resolveErrorCall(node)
 * 	}
 * 	headMessage := c.getDiagnosticHeadMessageForDecoratorResolution(node)
 * 	if len(callSignatures) == 0 {
 * 		diag := ast.NewDiagnosticChain(c.invocationErrorDetails(node.Expression(), apparentType, SignatureKindCall), headMessage)
 * 		c.diagnostics.Add(diag)
 * 		c.invocationErrorRecovery(apparentType, SignatureKindCall, diag)
 * 		return c.resolveErrorCall(node)
 * 	}
 * 	return c.resolveCall(node, callSignatures, candidatesOutArray, checkMode, SignatureFlagsNone, headMessage)
 * }
 */
export function Checker_resolveDecorator(receiver: GoPtr<Checker>, node: GoPtr<Node>, candidatesOutArray: GoPtr<GoSlice<GoPtr<Signature>>>, checkMode: CheckMode): GoPtr<Signature> {
  if (!CanHaveDecorators(node!.Parent)) {
    return Checker_resolveErrorCall(receiver, node);
  }
  const funcType = Checker_checkExpression(receiver, Node_Expression(node));
  const apparentType = Checker_getApparentType(receiver, funcType);
  if (Checker_isErrorType(receiver, apparentType)) {
    return Checker_resolveErrorCall(receiver, node);
  }
  const callSignatures = Checker_getSignaturesOfType(receiver, apparentType, SignatureKindCall);
  const numConstructSignatures = Checker_getSignaturesOfType(receiver, apparentType, SignatureKindConstruct).length;
  if (Checker_isUntypedFunctionCall(receiver, funcType, apparentType, callSignatures.length, numConstructSignatures)) {
    return Checker_resolveUntypedCall(receiver, node);
  }
  if (Checker_isPotentiallyUncalledDecorator(receiver, node, callSignatures) && !IsParenthesizedExpression(Node_Expression(node))) {
    const nodeStr = GetTextOfNode(Node_Expression(node));
    Checker_error(receiver, node, X_0_accepts_too_few_arguments_to_be_used_as_a_decorator_here_Did_you_mean_to_call_it_first_and_write_0, nodeStr);
    return Checker_resolveErrorCall(receiver, node);
  }
  const headMessage = Checker_getDiagnosticHeadMessageForDecoratorResolution(receiver, node);
  if (callSignatures.length === 0) {
    const diag = NewDiagnosticChain(Checker_invocationErrorDetails(receiver, Node_Expression(node), apparentType, SignatureKindCall), headMessage);
    DiagnosticsCollection_Add(receiver!.diagnostics, diag);
    Checker_invocationErrorRecovery(receiver, apparentType, SignatureKindCall, diag);
    return Checker_resolveErrorCall(receiver, node);
  }
  return Checker_resolveCall(receiver, node, callSignatures, candidatesOutArray, checkMode, SignatureFlagsNone, headMessage);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.isPotentiallyUncalledDecorator","kind":"method","status":"implemented","sigHash":"d5e6380b617064cef6327cd283cab36e1a19d9aa4cb1c9bad25881686487882d","bodyHash":"7aa58dcc7e561e520b744f5a4ac45d943f9af986ee2efd00793f14f081077183"}
 *
 * Go source:
 * func (c *Checker) isPotentiallyUncalledDecorator(decorator *ast.Node, signatures []*Signature) bool {
 * 	return len(signatures) != 0 && core.Every(signatures, func(sig *Signature) bool {
 * 		return sig.minArgumentCount == 0 && !signatureHasRestParameter(sig) && len(sig.parameters) < c.getDecoratorArgumentCount(decorator, sig)
 * 	})
 * }
 */
export function Checker_isPotentiallyUncalledDecorator(receiver: GoPtr<Checker>, decorator: GoPtr<Node>, signatures: GoSlice<GoPtr<Signature>>): bool {
  return signatures.length !== 0 && Every(signatures, (sig: GoPtr<Signature>): bool => {
    return sig!.minArgumentCount === 0 && !signatureHasRestParameter(sig) && sig!.parameters.length < Checker_getDecoratorArgumentCount(receiver, decorator, sig);
  });
}
