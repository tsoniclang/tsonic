import type { bool } from "@tsonic/core/types.js";
import type { GoPtr } from "../../../go/compat.js";
import type { Node } from "../../ast/spine.js";
import { NodeFactory_NewNodeList, Node_Name } from "../../ast/spine.js";
import type { BinaryExpression, BindingElement, ClassDeclaration, ClassExpression, ClassStaticBlockDeclaration, ComputedPropertyName, ExportAssignment, ParameterDeclaration, PropertyAssignment, PropertyDeclaration, ShorthandPropertyAssignment, VariableDeclaration } from "../../ast/generated/data.js";
import { AsBindingElement, AsBinaryExpression, AsCallExpression, AsClassDeclaration, AsClassExpression, AsClassStaticBlockDeclaration, AsComputedPropertyName, AsExportAssignment, AsFunctionExpression, AsParameterDeclaration, AsPropertyAssignment, AsPropertyDeclaration, AsShorthandPropertyAssignment, AsVariableDeclaration } from "../../ast/generated/casts.js";
import type { ClassElementList, ClassLikeDeclaration, Expression, HeritageClauseList, IdentifierNode, PropertyName, StringLiteralNode, TypeParameterList } from "../../ast/generated/unions.js";
import {
  KindAmpersandAmpersandEqualsToken,
  KindArrowFunction,
  KindBarBarEqualsToken,
  KindBinaryExpression,
  KindBindingElement,
  KindClassExpression,
  KindEqualsToken,
  KindExportAssignment,
  KindFunctionExpression,
  KindParameter,
  KindPropertyAssignment,
  KindPropertyDeclaration,
  KindQuestionQuestionEqualsToken,
  KindShorthandPropertyAssignment,
  KindVariableDeclaration,
} from "../../ast/generated/kinds.js";
import { IsClassStaticBlockDeclaration, IsClassDeclaration, IsClassExpression, IsComputedPropertyName, IsExpressionStatement, IsFunctionDeclaration, IsIdentifier, IsPrivateIdentifier, IsStringLiteral } from "../../ast/generated/predicates.js";
import { HasSyntacticModifier, IsPropertyNameLiteral, SkipOuterExpressions, OEKAll } from "../../ast/utilities.js";
import { Node_Expression, Node_Initializer, Node_MemberList, Node_Members, Node_Statements, Node_Text, Node_TypeParameterList, NodeFactory_UpdateBinaryExpression, NodeFactory_UpdateBindingElement, NodeFactory_UpdateClassDeclaration, NodeFactory_UpdateClassExpression, NodeFactory_UpdateComputedPropertyName, NodeFactory_UpdateExportAssignment, NodeFactory_UpdateParameterDeclaration, NodeFactory_UpdatePropertyAssignment, NodeFactory_UpdatePropertyDeclaration, NodeFactory_UpdateShorthandPropertyAssignment, NodeFactory_UpdateVariableDeclaration } from "../../ast/ast.js";
import { Node_Modifiers } from "../../ast/spine.js";
import { ModifierFlagsDefault } from "../../ast/modifierflags.js";
import { NewBlock, NewClassStaticBlockDeclaration, NewExpressionStatement, NewStringLiteral } from "../../ast/generated/factory.js";
import { TokenFlagsNone } from "../../ast/tokenflags.js";
import { EmitContext_AddVariableDeclaration, EmitContext_AssignedName, EmitContext_ClassThis, EmitContext_IsCallToHelper, EmitContext_MostOriginal, EmitContext_SetAssignedName, EmitContext_SetClassThis, EmitContext_SetSourceMapRange } from "../../printer/emitcontext.js";
import { NodeFactory_NewAssignmentExpression, NodeFactory_NewGeneratedNameForNode, NodeFactory_NewPropKeyHelper, NodeFactory_NewStringLiteralFromNode, NodeFactory_NewSetFunctionNameHelper, NodeFactory_NewThisExpression, NodeFactory_RestoreOuterExpressions } from "../../printer/factory.js";
import { isClassThisAssignmentBlock } from "./classthis.js";
import type { EmitContext } from "../../printer/emitcontext.js";

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/namedevaluation.go::func::isClassNamedEvaluationHelperBlock","kind":"func","status":"implemented","sigHash":"6237d8463b0ae001fda9291aeee2d73a8fd801211e0a23674e97802ef7b8c569","bodyHash":"62e2f5e07d210a350a4f297648f084ea9d398afaf7219b63b7ae3dc40e41362e"}
 *
 * Go source:
 * func isClassNamedEvaluationHelperBlock(emitContext *printer.EmitContext, node *ast.Node) bool {
 * 	if !ast.IsClassStaticBlockDeclaration(node) || len(node.AsClassStaticBlockDeclaration().Body.Statements()) != 1 {
 * 		return false
 * 	}
 * 
 * 	statement := node.AsClassStaticBlockDeclaration().Body.Statements()[0]
 * 	if ast.IsExpressionStatement(statement) {
 * 		expression := statement.Expression()
 * 		if emitContext.IsCallToHelper(expression, "__setFunctionName") {
 * 			arguments := expression.AsCallExpression().Arguments
 * 			return len(arguments.Nodes) >= 2 &&
 * 				arguments.Nodes[1] == emitContext.AssignedName(node.AsNode())
 * 		}
 * 	}
 * 	return false
 * }
 */
export function isClassNamedEvaluationHelperBlock(emitContext: GoPtr<EmitContext>, node: GoPtr<Node>): bool {
  if (!IsClassStaticBlockDeclaration(node)) {
    return false;
  }
  const csbd = AsClassStaticBlockDeclaration(node);
  const bodyStatements = Node_Statements(csbd!.Body as unknown as GoPtr<Node>);
  if (bodyStatements === undefined || bodyStatements.length !== 1) {
    return false;
  }

  const statement = bodyStatements[0];
  if (IsExpressionStatement(statement)) {
    const expression = Node_Expression(statement);
    if (EmitContext_IsCallToHelper(emitContext, expression, "__setFunctionName")) {
      const callExpr = AsCallExpression(expression);
      const args = callExpr!.Arguments;
      return args!.Nodes.length >= 2 &&
        args!.Nodes[1] === EmitContext_AssignedName(emitContext, node);
    }
  }
  return false;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/namedevaluation.go::func::classHasExplicitlyAssignedName","kind":"func","status":"implemented","sigHash":"5eb0191f9c13b270588fd746d07b37f97cc90eb30f17ee06adb0f61e99cc9642","bodyHash":"7ef0855c78b00276698046b4c09f99ce663834689d05f0157c2bd86c499e25f2"}
 *
 * Go source:
 * func classHasExplicitlyAssignedName(emitContext *printer.EmitContext, node *ast.ClassLikeDeclaration) bool {
 * 	if assignedName := emitContext.AssignedName(node); assignedName != nil {
 * 		for _, member := range node.Members() {
 * 			if isClassNamedEvaluationHelperBlock(emitContext, member) {
 * 				return true
 * 			}
 * 		}
 * 	}
 * 	return false
 * }
 */
export function classHasExplicitlyAssignedName(emitContext: GoPtr<EmitContext>, node: GoPtr<ClassLikeDeclaration>): bool {
  if (EmitContext_AssignedName(emitContext, node as unknown as GoPtr<Node>) !== undefined) {
    for (const member of Node_Members(node as unknown as GoPtr<Node>) ?? []) {
      if (isClassNamedEvaluationHelperBlock(emitContext, member)) {
        return true;
      }
    }
  }
  return false;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/namedevaluation.go::func::classHasDeclaredOrExplicitlyAssignedName","kind":"func","status":"implemented","sigHash":"b6168342e8fcff30827e8e7ee1aeac1d0fa7c47caedb045e6f2ee42a384488ed","bodyHash":"764a9d8831d376a0ef398e9f2b4d14701abd642ed6d61ea2c9471d44a7a73926"}
 *
 * Go source:
 * func classHasDeclaredOrExplicitlyAssignedName(emitContext *printer.EmitContext, node *ast.ClassLikeDeclaration) bool {
 * 	return node.Name() != nil || classHasExplicitlyAssignedName(emitContext, node)
 * }
 */
export function classHasDeclaredOrExplicitlyAssignedName(emitContext: GoPtr<EmitContext>, node: GoPtr<ClassLikeDeclaration>): bool {
  return Node_Name(node as unknown as GoPtr<Node>) !== undefined || classHasExplicitlyAssignedName(emitContext, node);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/namedevaluation.go::func::isProtoSetter","kind":"func","status":"implemented","sigHash":"1941583680736a93397a9144112cc090fa3c62ea6010b6f067c34a12f2dbc807","bodyHash":"12d58de5b966336972181acb509b5ae3cf7ffd3fcaa3295443e8e15678b2de3b"}
 *
 * Go source:
 * func isProtoSetter(node *ast.PropertyName) bool {
 * 	return (ast.IsIdentifier(node) || ast.IsStringLiteral(node)) && node.Text() == "__proto__"
 * }
 */
export function isProtoSetter(node: GoPtr<PropertyName>): bool {
  return (IsIdentifier(node as unknown as GoPtr<Node>) || IsStringLiteral(node as unknown as GoPtr<Node>)) && Node_Text(node as unknown as GoPtr<Node>) === "__proto__";
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/namedevaluation.go::type::anonymousFunctionDefinition","kind":"type","status":"implemented","sigHash":"a06030e4e97b936889eef47204d77e1153123fe98e6da0d2d93be7ca95017de0","bodyHash":"b5cf797ef907817d68922dde0629a4e105e0e4d33f925eb63d5bf679ee48c826"}
 *
 * Go source:
 * anonymousFunctionDefinition = ast.Node
 */
export type anonymousFunctionDefinition = Node;

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/namedevaluation.go::func::isAnonymousFunctionDefinition","kind":"func","status":"implemented","sigHash":"837c166f1b0fe809c982161dd9d4fba0fad539484530366ef517fb80f50a3f75","bodyHash":"6469512651378f6a29f1d7ce40ed4b4a47ac140495c340c3b9f50c94a152b7e9"}
 *
 * Go source:
 * func isAnonymousFunctionDefinition(emitContext *printer.EmitContext, node *ast.Expression, cb func(*anonymousFunctionDefinition) bool) bool {
 * 	node = ast.SkipOuterExpressions(node, ast.OEKAll)
 * 	switch node.Kind {
 * 	case ast.KindClassExpression:
 * 		if classHasDeclaredOrExplicitlyAssignedName(emitContext, node) {
 * 			return false
 * 		}
 * 		break
 * 	case ast.KindFunctionExpression:
 * 		if node.AsFunctionExpression().Name() != nil {
 * 			return false
 * 		}
 * 		break
 * 	case ast.KindArrowFunction:
 * 		break
 * 	default:
 * 		return false
 * 	}
 * 	if cb != nil {
 * 		return cb(node)
 * 	}
 * 	return true
 * }
 */
export function isAnonymousFunctionDefinition(emitContext: GoPtr<EmitContext>, node: GoPtr<Expression>, cb: (arg0: GoPtr<anonymousFunctionDefinition>) => bool): bool {
  const skipped = SkipOuterExpressions(node, OEKAll);
  switch (skipped!.Kind) {
    case KindClassExpression:
      if (classHasDeclaredOrExplicitlyAssignedName(emitContext, skipped)) {
        return false;
      }
      break;
    case KindFunctionExpression:
      if (Node_Name(AsFunctionExpression(skipped) as unknown as GoPtr<Node>) !== undefined) {
        return false;
      }
      break;
    case KindArrowFunction:
      break;
    default:
      return false;
  }
  if (cb !== undefined) {
    return cb(skipped);
  }
  return true;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/namedevaluation.go::func::isNamedEvaluationSource","kind":"func","status":"implemented","sigHash":"cffa1b4211162a98ff1b87afb6940aa52e9e5fd5d907d1f923e19f3761ac3501","bodyHash":"e4919ba9450f51ea904f0c2de3639df98c7242ea2711c7e02e3b559b9f2ef06b"}
 *
 * Go source:
 * func isNamedEvaluationSource(node *ast.Node) bool {
 * 	switch node.Kind {
 * 	case ast.KindPropertyAssignment:
 * 		return !isProtoSetter(node.AsPropertyAssignment().Name())
 * 	case ast.KindShorthandPropertyAssignment:
 * 		return node.AsShorthandPropertyAssignment().ObjectAssignmentInitializer != nil
 * 	case ast.KindVariableDeclaration:
 * 		return ast.IsIdentifier(node.AsVariableDeclaration().Name()) && node.Initializer() != nil
 * 	case ast.KindParameter:
 * 		return ast.IsIdentifier(node.AsParameterDeclaration().Name()) && node.Initializer() != nil && node.AsParameterDeclaration().DotDotDotToken == nil
 * 	case ast.KindBindingElement:
 * 		return ast.IsIdentifier(node.AsBindingElement().Name()) && node.Initializer() != nil && node.AsBindingElement().DotDotDotToken == nil
 * 	case ast.KindPropertyDeclaration:
 * 		return node.Initializer() != nil
 * 	case ast.KindBinaryExpression:
 * 		switch node.AsBinaryExpression().OperatorToken.Kind {
 * 		case ast.KindEqualsToken, ast.KindAmpersandAmpersandEqualsToken, ast.KindBarBarEqualsToken, ast.KindQuestionQuestionEqualsToken:
 * 			return ast.IsIdentifier(node.AsBinaryExpression().Left)
 * 		}
 * 		break
 * 	case ast.KindExportAssignment:
 * 		return true
 * 	}
 * 	return false
 * }
 */
export function isNamedEvaluationSource(node: GoPtr<Node>): bool {
  switch (node!.Kind) {
    case KindPropertyAssignment:
      return !isProtoSetter(AsPropertyAssignment(node)!.name);
    case KindShorthandPropertyAssignment:
      return AsShorthandPropertyAssignment(node)!.ObjectAssignmentInitializer !== undefined;
    case KindVariableDeclaration:
      return IsIdentifier(AsVariableDeclaration(node)!.name as unknown as GoPtr<Node>) && Node_Initializer(node) !== undefined;
    case KindParameter:
      return IsIdentifier(AsParameterDeclaration(node)!.name as unknown as GoPtr<Node>) && Node_Initializer(node) !== undefined && AsParameterDeclaration(node)!.DotDotDotToken === undefined;
    case KindBindingElement:
      return IsIdentifier(AsBindingElement(node)!.name as unknown as GoPtr<Node>) && Node_Initializer(node) !== undefined && AsBindingElement(node)!.DotDotDotToken === undefined;
    case KindPropertyDeclaration:
      return Node_Initializer(node) !== undefined;
    case KindBinaryExpression: {
      const operatorKind = AsBinaryExpression(node)!.OperatorToken!.Kind;
      switch (operatorKind) {
        case KindEqualsToken:
        case KindAmpersandAmpersandEqualsToken:
        case KindBarBarEqualsToken:
        case KindQuestionQuestionEqualsToken:
          return IsIdentifier(AsBinaryExpression(node)!.Left as unknown as GoPtr<Node>);
      }
      break;
    }
    case KindExportAssignment:
      return true;
  }
  return false;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/namedevaluation.go::func::isNamedEvaluation","kind":"func","status":"implemented","sigHash":"c1b0e9007fae51c9bab3cb0b3b5a8ae8cdb3aafc811d57d419069e6890a396fa","bodyHash":"1b9a87034890eb02ed74ffdc0186856a9b68e1fd95c11a17e8e9cf942ecf59af"}
 *
 * Go source:
 * func isNamedEvaluation(emitContext *printer.EmitContext, node *ast.Node) bool {
 * 	return isNamedEvaluationAnd(emitContext, node, nil)
 * }
 */
export function isNamedEvaluation(emitContext: GoPtr<EmitContext>, node: GoPtr<Node>): bool {
  return isNamedEvaluationAnd(emitContext, node, undefined as unknown as (arg0: GoPtr<anonymousFunctionDefinition>) => bool);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/namedevaluation.go::func::isNamedEvaluationAnd","kind":"func","status":"implemented","sigHash":"5cc7c91b9e6c5a560d4cb2edf14f7ee220f9d9c506e85f9b0b312b46c1d6a79c","bodyHash":"564eaed3c6f04fd384940eb9846a1e3abddd2989e4be6fee8ee32a0cf28639b2"}
 *
 * Go source:
 * func isNamedEvaluationAnd(emitContext *printer.EmitContext, node *ast.Node, cb func(*anonymousFunctionDefinition) bool) bool {
 * 	if !isNamedEvaluationSource(node) {
 * 		return false
 * 	}
 * 	switch node.Kind {
 * 	case ast.KindShorthandPropertyAssignment:
 * 		return isAnonymousFunctionDefinition(emitContext, node.AsShorthandPropertyAssignment().ObjectAssignmentInitializer, cb)
 * 	case ast.KindPropertyAssignment, ast.KindVariableDeclaration, ast.KindParameter, ast.KindBindingElement, ast.KindPropertyDeclaration:
 * 		return isAnonymousFunctionDefinition(emitContext, node.Initializer(), cb)
 * 	case ast.KindBinaryExpression:
 * 		return isAnonymousFunctionDefinition(emitContext, node.AsBinaryExpression().Right, cb)
 * 	case ast.KindExportAssignment:
 * 		return isAnonymousFunctionDefinition(emitContext, node.Expression(), cb)
 * 	default:
 * 		debug.Fail("Unhandled case in isNamedEvaluation")
 * 		return false
 * 	}
 * }
 */
export function isNamedEvaluationAnd(emitContext: GoPtr<EmitContext>, node: GoPtr<Node>, cb: (arg0: GoPtr<anonymousFunctionDefinition>) => bool): bool {
  if (!isNamedEvaluationSource(node)) {
    return false;
  }
  switch (node!.Kind) {
    case KindShorthandPropertyAssignment:
      return isAnonymousFunctionDefinition(emitContext, AsShorthandPropertyAssignment(node)!.ObjectAssignmentInitializer, cb);
    case KindPropertyAssignment:
    case KindVariableDeclaration:
    case KindParameter:
    case KindBindingElement:
    case KindPropertyDeclaration:
      return isAnonymousFunctionDefinition(emitContext, Node_Initializer(node), cb);
    case KindBinaryExpression:
      return isAnonymousFunctionDefinition(emitContext, AsBinaryExpression(node)!.Right, cb);
    case KindExportAssignment:
      return isAnonymousFunctionDefinition(emitContext, Node_Expression(node), cb);
    default:
      throw new globalThis.Error("Unhandled case in isNamedEvaluation");
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/namedevaluation.go::func::getAssignedNameOfIdentifier","kind":"func","status":"implemented","sigHash":"3b1b68a8baab172bab7ce4ae3e5c9642dbab06120e9cca69a5af92dc89bd82a6","bodyHash":"02cf63a626012ab995c8c460104bfb908d1988d1cbdf84860829f9d58f404755"}
 *
 * Go source:
 * func getAssignedNameOfIdentifier(emitContext *printer.EmitContext, name *ast.IdentifierNode, expression *ast.Node /*WrappedExpression<AnonymousFunctionDefinition>* /) *ast.StringLiteralNode {
 * 	original := emitContext.MostOriginal(ast.SkipOuterExpressions(expression, ast.OEKAll))
 * 	if (ast.IsClassDeclaration(original) || ast.IsFunctionDeclaration(original)) &&
 * 		original.Name() == nil && ast.HasSyntacticModifier(original, ast.ModifierFlagsDefault) {
 * 		return emitContext.Factory.NewStringLiteral("default", ast.TokenFlagsNone)
 * 	}
 * 	return emitContext.Factory.NewStringLiteralFromNode(name)
 * }
 */
export function getAssignedNameOfIdentifier(emitContext: GoPtr<EmitContext>, name: GoPtr<IdentifierNode>, expression: GoPtr<Node>): GoPtr<StringLiteralNode> {
  const original = EmitContext_MostOriginal(emitContext, SkipOuterExpressions(expression, OEKAll) as unknown as GoPtr<Node>);
  if ((IsClassDeclaration(original) || IsFunctionDeclaration(original)) &&
    Node_Name(original) === undefined && HasSyntacticModifier(original, ModifierFlagsDefault)) {
    return NewStringLiteral(emitContext!.Factory!.__tsgoEmbedded0!, "default", TokenFlagsNone) as unknown as GoPtr<StringLiteralNode>;
  }
  return NodeFactory_NewStringLiteralFromNode(emitContext!.Factory, name as unknown as GoPtr<Node>) as unknown as GoPtr<StringLiteralNode>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/namedevaluation.go::func::getAssignedNameOfPropertyName","kind":"func","status":"implemented","sigHash":"137767135a816cbb95f56242de3b7867806340b64a06929c971e19b8800cb54a","bodyHash":"cece49563fe947ca1eda3fa274a40cdfae5f80d823bd05598d19a4a7304678c0"}
 *
 * Go source:
 * func getAssignedNameOfPropertyName(emitContext *printer.EmitContext, name *ast.PropertyName, assignedNameText string) (assignedName *ast.Expression, updatedName *ast.PropertyName) {
 * 	factory := emitContext.Factory
 * 	if len(assignedNameText) > 0 {
 * 		assignedName := factory.NewStringLiteral(assignedNameText, ast.TokenFlagsNone)
 * 		return assignedName, name
 * 	}
 *
 * 	if ast.IsPropertyNameLiteral(name) || ast.IsPrivateIdentifier(name) {
 * 		assignedName := factory.NewStringLiteralFromNode(name)
 * 		return assignedName, name
 * 	}
 *
 * 	expression := name.Expression()
 * 	if ast.IsPropertyNameLiteral(expression) && !ast.IsIdentifier(expression) {
 * 		assignedName := factory.NewStringLiteralFromNode(expression)
 * 		return assignedName, name
 * 	}
 *
 * 	debug.Assert(ast.IsComputedPropertyName(name), "Expected computed property name")
 *
 * 	assignedName = factory.NewGeneratedNameForNode(name)
 * 	emitContext.AddVariableDeclaration(assignedName)
 *
 * 	key := factory.NewPropKeyHelper(expression)
 * 	assignment := factory.NewAssignmentExpression(assignedName, key)
 * 	updatedName = factory.UpdateComputedPropertyName(name.AsComputedPropertyName(), assignment)
 * 	return assignedName, updatedName
 * }
 */
export function getAssignedNameOfPropertyName(emitContext: GoPtr<EmitContext>, name: GoPtr<PropertyName>, assignedNameText: string): [GoPtr<Expression>, GoPtr<PropertyName>] {
  const factory = emitContext!.Factory;
  if (assignedNameText.length > 0) {
    const assignedName = NewStringLiteral(factory!.__tsgoEmbedded0!, assignedNameText, TokenFlagsNone) as unknown as GoPtr<Expression>;
    return [assignedName, name];
  }
  if (IsPropertyNameLiteral(name as unknown as GoPtr<Node>) || IsPrivateIdentifier(name as unknown as GoPtr<Node>)) {
    const assignedName = NodeFactory_NewStringLiteralFromNode(factory, name as unknown as GoPtr<Node>) as unknown as GoPtr<Expression>;
    return [assignedName, name];
  }
  const expression = Node_Expression(name as unknown as GoPtr<Node>);
  if (expression !== undefined && IsPropertyNameLiteral(expression) && !IsIdentifier(expression)) {
    const assignedName = NodeFactory_NewStringLiteralFromNode(factory, expression) as unknown as GoPtr<Expression>;
    return [assignedName, name];
  }
  // Must be a computed property name
  const assignedName = NodeFactory_NewGeneratedNameForNode(factory, name as unknown as GoPtr<Node>) as unknown as GoPtr<Expression>;
  EmitContext_AddVariableDeclaration(emitContext, assignedName as unknown as GoPtr<IdentifierNode>);
  const key = NodeFactory_NewPropKeyHelper(factory, expression as unknown as GoPtr<Expression>);
  const assignment = NodeFactory_NewAssignmentExpression(factory, assignedName, key);
  const updatedName = NodeFactory_UpdateComputedPropertyName(factory!.__tsgoEmbedded0!, AsComputedPropertyName(name as unknown as GoPtr<Node>)!, assignment as unknown as GoPtr<never>) as unknown as GoPtr<PropertyName>;
  return [assignedName, updatedName];
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/namedevaluation.go::func::createClassNamedEvaluationHelperBlock","kind":"func","status":"implemented","sigHash":"9feb917f7e94207e1242d09e3e3892104c1f7da3ade6fed43210d85ce6ae2b88","bodyHash":"4eeba07e82f041eb281dba4835d7c80c0654ad3026ed3ea8872b83e8debe5567"}
 *
 * Go source:
 * func createClassNamedEvaluationHelperBlock(emitContext *printer.EmitContext, assignedName *ast.Expression, thisExpression *ast.Expression) *ast.Node {
 * 	// produces:
 * 	//
 * 	//  static { __setFunctionName(this, "C"); }
 * 	//
 * 
 * 	if thisExpression == nil {
 * 		thisExpression = emitContext.Factory.NewThisExpression()
 * 	}
 * 
 * 	factory := emitContext.Factory
 * 	expression := factory.NewSetFunctionNameHelper(thisExpression, assignedName, "" /*prefix* /)
 * 	statement := factory.NewExpressionStatement(expression)
 * 	body := factory.NewBlock(factory.NewNodeList([]*ast.Statement{statement}), false /*multiLine* /)
 * 	block := factory.NewClassStaticBlockDeclaration(nil /*modifiers* /, body)
 * 
 * 	// We use `emitNode.assignedName` to indicate this is a NamedEvaluation helper block
 * 	// and to stash the expression used to resolve the assigned name.
 * 	emitContext.SetAssignedName(block, assignedName)
 * 	return block.AsNode()
 * }
 */
export function createClassNamedEvaluationHelperBlock(emitContext: GoPtr<EmitContext>, assignedName: GoPtr<Expression>, thisExpression: GoPtr<Expression>): GoPtr<Node> {
  const factory = emitContext!.Factory;
  const astFactory = factory!.__tsgoEmbedded0!;

  const actualThisExpression = thisExpression !== undefined ? thisExpression : NodeFactory_NewThisExpression(factory);
  const expression = NodeFactory_NewSetFunctionNameHelper(factory, actualThisExpression, assignedName, "");
  const statement = NewExpressionStatement(astFactory, expression);
  const body = NewBlock(astFactory, NodeFactory_NewNodeList(astFactory, [statement]), false);
  const block = NewClassStaticBlockDeclaration(astFactory, undefined, body);

  EmitContext_SetAssignedName(emitContext, block, assignedName);
  return block;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/namedevaluation.go::func::injectClassNamedEvaluationHelperBlockIfMissing","kind":"func","status":"implemented","sigHash":"c2280e4d7d8329c8b920350fc323776c6159bfa0673a9643a109d66e7ef29006","bodyHash":"0235789f14ada301491bc8e1c53ad3579e52372112ca1a7fb1843ed2474f4e7b"}
 *
 * Go source:
 * func injectClassNamedEvaluationHelperBlockIfMissing(
 * 	emitContext *printer.EmitContext,
 * 	node *ast.ClassLikeDeclaration,
 * 	assignedName *ast.Expression,
 * 	thisExpression *ast.Expression,
 * ) *ast.ClassLikeDeclaration {
 * 	// given:
 * 	//
 * 	//  let C = class {
 * 	//  };
 * 	//
 * 	// produces:
 * 	//
 * 	//  let C = class {
 * 	//      static { __setFunctionName(this, "C"); }
 * 	//  };
 * 
 * 	// NOTE: If the class has a `_classThis` assignment block, this helper will be injected after that block.
 * 
 * 	if classHasExplicitlyAssignedName(emitContext, node) {
 * 		return node
 * 	}
 * 
 * 	factory := emitContext.Factory
 * 	namedEvaluationBlock := createClassNamedEvaluationHelperBlock(emitContext, assignedName, thisExpression)
 * 	if node.Name() != nil {
 * 		emitContext.SetSourceMapRange(namedEvaluationBlock.Body().Statements()[0], node.Name().Loc)
 * 	}
 * 
 * 	insertionIndex := slices.IndexFunc(node.Members(), func(n *ast.Node) bool {
 * 		return isClassThisAssignmentBlock(emitContext, n)
 * 	}) + 1
 * 	leading := slices.Clone(node.Members()[:insertionIndex])
 * 	trailing := slices.Clone(node.Members()[insertionIndex:])
 * 
 * 	var members []*ast.ClassElement
 * 	members = append(members, leading...)
 * 	members = append(members, namedEvaluationBlock)
 * 	members = append(members, trailing...)
 * 	membersList := factory.NewNodeList(members)
 * 	membersList.Loc = node.MemberList().Loc
 * 
 * 	oldNode := node
 * 	if ast.IsClassDeclaration(node) {
 * 		node = factory.UpdateClassDeclaration(
 * 			node.AsClassDeclaration(),
 * 			node.Modifiers(),
 * 			node.Name(),
 * 			node.TypeParameterList(),
 * 			node.AsClassDeclaration().HeritageClauses,
 * 			membersList,
 * 		)
 * 	} else {
 * 		node = factory.UpdateClassExpression(
 * 			node.AsClassExpression(),
 * 			node.Modifiers(),
 * 			node.Name(),
 * 			node.TypeParameterList(),
 * 			node.AsClassExpression().HeritageClauses,
 * 			membersList,
 * 		)
 * 	}
 * 
 * 	emitContext.SetAssignedName(node, assignedName)
 * 
 * 	// Transfer ClassThis from old to new node, since UpdateClassExpression creates
 * 	// a new node that won't have ClassThis set on it.
 * 	if ct := emitContext.ClassThis(oldNode); ct != nil {
 * 		emitContext.SetClassThis(node, ct)
 * 	}
 * 
 * 	return node
 * }
 */
export function injectClassNamedEvaluationHelperBlockIfMissing(emitContext: GoPtr<EmitContext>, node: GoPtr<ClassLikeDeclaration>, assignedName: GoPtr<Expression>, thisExpression: GoPtr<Expression>): GoPtr<ClassLikeDeclaration> {
  if (classHasExplicitlyAssignedName(emitContext, node)) {
    return node;
  }
  const factory = emitContext!.Factory;
  const astFactory = factory!.__tsgoEmbedded0!;
  const namedEvaluationBlock = createClassNamedEvaluationHelperBlock(emitContext, assignedName, thisExpression);
  const nodeName = (node as unknown as { name?: GoPtr<IdentifierNode> }).name;
  if (nodeName !== undefined) {
    const csbd = AsClassStaticBlockDeclaration(namedEvaluationBlock)!;
    const bodyStmts = Node_Statements(csbd.Body as unknown as GoPtr<Node>);
    if (bodyStmts !== undefined && bodyStmts.length > 0) {
      EmitContext_SetSourceMapRange(emitContext, bodyStmts[0], nodeName!.Loc);
    }
  }
  // Find insertionIndex: index after last isClassThisAssignmentBlock (or 0 if none)
  const members = Node_Members(node as unknown as GoPtr<Node>) ?? [];
  let insertionIndex = 0;
  for (let i = 0; i < members.length; i++) {
    if (isClassThisAssignmentBlock(emitContext, members[i])) {
      insertionIndex = i + 1;
    }
  }
  const leading = members.slice(0, insertionIndex) as unknown as GoPtr<Node>[];
  const trailing = members.slice(insertionIndex) as unknown as GoPtr<Node>[];
  const newMembers: GoPtr<Node>[] = [...leading, namedEvaluationBlock, ...trailing];
  const membersList = NodeFactory_NewNodeList(astFactory, newMembers);
  membersList!.Loc = Node_MemberList(node as unknown as GoPtr<Node>)!.Loc;
  const oldNode = node;
  let updatedNode: GoPtr<ClassLikeDeclaration>;
  if (IsClassDeclaration(node as unknown as GoPtr<Node>)) {
    updatedNode = NodeFactory_UpdateClassDeclaration(
      astFactory,
      AsClassDeclaration(node as unknown as GoPtr<Node>)!,
      Node_Modifiers(node as unknown as GoPtr<Node>) as unknown as GoPtr<never>,
      (node as unknown as { name?: GoPtr<IdentifierNode> }).name,
      Node_TypeParameterList(node as unknown as GoPtr<Node>) as unknown as GoPtr<TypeParameterList>,
      (node as unknown as { HeritageClauses?: GoPtr<HeritageClauseList> }).HeritageClauses,
      membersList as unknown as GoPtr<ClassElementList>,
    ) as unknown as GoPtr<ClassLikeDeclaration>;
  } else {
    updatedNode = NodeFactory_UpdateClassExpression(
      astFactory,
      AsClassExpression(node as unknown as GoPtr<Node>)!,
      Node_Modifiers(node as unknown as GoPtr<Node>) as unknown as GoPtr<never>,
      (node as unknown as { name?: GoPtr<IdentifierNode> }).name,
      Node_TypeParameterList(node as unknown as GoPtr<Node>) as unknown as GoPtr<TypeParameterList>,
      (node as unknown as { HeritageClauses?: GoPtr<HeritageClauseList> }).HeritageClauses,
      membersList as unknown as GoPtr<ClassElementList>,
    ) as unknown as GoPtr<ClassLikeDeclaration>;
  }
  EmitContext_SetAssignedName(emitContext, updatedNode as unknown as GoPtr<Node>, assignedName);
  // Transfer ClassThis from old to new node
  const ct = EmitContext_ClassThis(emitContext, oldNode as unknown as GoPtr<Node>);
  if (ct !== undefined) {
    EmitContext_SetClassThis(emitContext, updatedNode as unknown as GoPtr<Node>, ct);
  }
  return updatedNode;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/namedevaluation.go::func::finishTransformNamedEvaluation","kind":"func","status":"implemented","sigHash":"dc6c9d465c871d9938d2ba4dc82eb87a2d7f3b606d658bde4f2bd66d50ccf459","bodyHash":"8dc02bbedcfba1bff65bdfb8941f2d0b10b645d35708bab20a7ce15c57f8b624"}
 *
 * Go source:
 * func finishTransformNamedEvaluation(
 * 	emitContext *printer.EmitContext,
 * 	expression *ast.Node, // WrappedExpression<AnonymousFunctionDefinition>,
 * 	assignedName *ast.Expression,
 * 	ignoreEmptyStringLiteral bool,
 * ) *ast.Expression {
 * 	if ignoreEmptyStringLiteral && ast.IsStringLiteral(assignedName) && len(assignedName.Text()) == 0 {
 * 		return expression
 * 	}
 * 
 * 	factory := emitContext.Factory
 * 	innerExpression := ast.SkipOuterExpressions(expression, ast.OEKAll)
 * 
 * 	var updatedExpression *ast.Expression
 * 	if ast.IsClassExpression(innerExpression) {
 * 		updatedExpression = injectClassNamedEvaluationHelperBlockIfMissing(emitContext, innerExpression, assignedName, nil /*thisExpression* /)
 * 	} else {
 * 		updatedExpression = factory.NewSetFunctionNameHelper(innerExpression, assignedName, "" /*prefix* /)
 * 	}
 * 
 * 	return factory.RestoreOuterExpressions(expression, updatedExpression, ast.OEKAll)
 * }
 */
export function finishTransformNamedEvaluation(emitContext: GoPtr<EmitContext>, expression: GoPtr<Node>, assignedName: GoPtr<Expression>, ignoreEmptyStringLiteral: bool): GoPtr<Expression> {
  if (ignoreEmptyStringLiteral && IsStringLiteral(assignedName as unknown as GoPtr<Node>) && Node_Text(assignedName as unknown as GoPtr<Node>).length === 0) {
    return expression as unknown as GoPtr<Expression>;
  }
  const factory = emitContext!.Factory;
  const innerExpression = SkipOuterExpressions(expression, OEKAll);
  let updatedExpression: GoPtr<Expression>;
  if (IsClassExpression(innerExpression as unknown as GoPtr<Node>)) {
    updatedExpression = injectClassNamedEvaluationHelperBlockIfMissing(emitContext, innerExpression, assignedName, undefined) as unknown as GoPtr<Expression>;
  } else {
    updatedExpression = NodeFactory_NewSetFunctionNameHelper(factory, innerExpression as unknown as GoPtr<Expression>, assignedName, "");
  }
  return NodeFactory_RestoreOuterExpressions(factory, expression as unknown as GoPtr<Expression>, updatedExpression, OEKAll);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/namedevaluation.go::func::transformNamedEvaluationOfPropertyAssignment","kind":"func","status":"implemented","sigHash":"e4a106ff9860c8f747e47bb708f1ff64a8c92fb696a51210eadb9372f1149789","bodyHash":"6fd1b0e1a5c415cdd2e4f174bea1fad7ae1c9e0e82ab1f6ca2d5dc33b3d9e2db"}
 *
 * Go source:
 * func transformNamedEvaluationOfPropertyAssignment(context *printer.EmitContext, node *ast.PropertyAssignment /*NamedEvaluation & PropertyAssignment* /, ignoreEmptyStringLiteral bool, assignedNameText string) *ast.Expression {
 * 	// 13.2.5.5 RS: PropertyDefinitionEvaluation
 * 	//   PropertyAssignment : PropertyName `:` AssignmentExpression
 * 	//     ...
 * 	//     5. If IsAnonymousFunctionDefinition(|AssignmentExpression|) is *true* and _isProtoSetter_ is *false*, then
 * 	//        a. Let _popValue_ be ? NamedEvaluation of |AssignmentExpression| with argument _propKey_.
 * 	//     ...
 * 
 * 	factory := context.Factory
 * 	assignedName, name := getAssignedNameOfPropertyName(context, node.Name(), assignedNameText)
 * 	initializer := finishTransformNamedEvaluation(context, node.Initializer, assignedName, ignoreEmptyStringLiteral)
 * 	return factory.UpdatePropertyAssignment(node, nil /*modifiers* /, name, nil /*postfixToken* /, nil /*typeNode* /, initializer)
 * }
 */
export function transformNamedEvaluationOfPropertyAssignment(context: GoPtr<EmitContext>, node: GoPtr<PropertyAssignment>, ignoreEmptyStringLiteral: bool, assignedNameText: string): GoPtr<Expression> {
  const factory = context!.Factory;
  const [assignedName, name] = getAssignedNameOfPropertyName(context, node!.name, assignedNameText);
  const initializer = finishTransformNamedEvaluation(context, node!.Initializer as unknown as GoPtr<Node>, assignedName, ignoreEmptyStringLiteral);
  return NodeFactory_UpdatePropertyAssignment(
    factory!.__tsgoEmbedded0!,
    node,
    undefined, // modifiers
    name,
    undefined, // postfixToken
    undefined, // typeNode
    initializer as unknown as GoPtr<never>,
  ) as unknown as GoPtr<Expression>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/namedevaluation.go::func::transformNamedEvaluationOfShorthandAssignmentProperty","kind":"func","status":"implemented","sigHash":"a514e52d703c6d2bc1eb069e9b4801fa4cbdaceb49a3a60dae5e292787543994","bodyHash":"168cb052d5ef7ad1fa2a3fa888020ffa66a089f189757739d6e382a10767a0c7"}
 *
 * Go source:
 * func transformNamedEvaluationOfShorthandAssignmentProperty(emitContext *printer.EmitContext, node *ast.ShorthandPropertyAssignment /*NamedEvaluation & ShorthandPropertyAssignment* /, ignoreEmptyStringLiteral bool, assignedNameText string) *ast.Expression {
 * 	// 13.15.5.3 RS: PropertyDestructuringAssignmentEvaluation
 * 	//   AssignmentProperty : IdentifierReference Initializer?
 * 	//     ...
 * 	//     4. If |Initializer?| is present and _v_ is *undefined*, then
 * 	//        a. If IsAnonymousFunctionDefinition(|Initializer|) is *true*, then
 * 	//           i. Set _v_ to ? NamedEvaluation of |Initializer| with argument _P_.
 * 	//     ...
 * 
 * 	factory := emitContext.Factory
 * 	var assignedName *ast.Expression
 * 	if len(assignedNameText) > 0 {
 * 		assignedName = factory.NewStringLiteral(assignedNameText, ast.TokenFlagsNone)
 * 	} else {
 * 		assignedName = getAssignedNameOfIdentifier(emitContext, node.Name(), node.ObjectAssignmentInitializer)
 * 	}
 * 	objectAssignmentInitializer := finishTransformNamedEvaluation(emitContext, node.ObjectAssignmentInitializer, assignedName, ignoreEmptyStringLiteral)
 * 	return factory.UpdateShorthandPropertyAssignment(
 * 		node,
 * 		nil, /*modifiers* /
 * 		node.Name(),
 * 		nil, /*postfixToken* /
 * 		nil, /*typeNode* /
 * 		node.EqualsToken,
 * 		objectAssignmentInitializer,
 * 	)
 * }
 */
export function transformNamedEvaluationOfShorthandAssignmentProperty(emitContext: GoPtr<EmitContext>, node: GoPtr<ShorthandPropertyAssignment>, ignoreEmptyStringLiteral: bool, assignedNameText: string): GoPtr<Expression> {
  const factory = emitContext!.Factory;
  let assignedName: GoPtr<Expression>;
  if (assignedNameText.length > 0) {
    assignedName = NewStringLiteral(factory!.__tsgoEmbedded0!, assignedNameText, TokenFlagsNone) as unknown as GoPtr<Expression>;
  } else {
    assignedName = getAssignedNameOfIdentifier(emitContext, node!.name as unknown as GoPtr<IdentifierNode>, node!.ObjectAssignmentInitializer as unknown as GoPtr<Node>) as unknown as GoPtr<Expression>;
  }
  const objectAssignmentInitializer = finishTransformNamedEvaluation(emitContext, node!.ObjectAssignmentInitializer as unknown as GoPtr<Node>, assignedName, ignoreEmptyStringLiteral);
  return NodeFactory_UpdateShorthandPropertyAssignment(
    factory!.__tsgoEmbedded0!,
    node,
    undefined, // modifiers
    node!.name as unknown as GoPtr<PropertyName>,
    undefined, // postfixToken
    undefined, // typeNode
    node!.EqualsToken,
    objectAssignmentInitializer as unknown as GoPtr<never>,
  ) as unknown as GoPtr<Expression>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/namedevaluation.go::func::transformNamedEvaluationOfVariableDeclaration","kind":"func","status":"implemented","sigHash":"1319f8ece9972c6db3ea36a71dc60d96f4d30f4750c8e2d7999ae08b22178713","bodyHash":"1d3313daa742c2467ae97e44a1ce101345b05ae492b1515e980d92a22a329898"}
 *
 * Go source:
 * func transformNamedEvaluationOfVariableDeclaration(emitContext *printer.EmitContext, node *ast.VariableDeclaration /*NamedEvaluation & VariableDeclaration* /, ignoreEmptyStringLiteral bool, assignedNameText string) *ast.Expression {
 * 	// 14.3.1.2 RS: Evaluation
 * 	//   LexicalBinding : BindingIdentifier Initializer
 * 	//     ...
 * 	//     3. If IsAnonymousFunctionDefinition(|Initializer|) is *true*, then
 * 	//        a. Let _value_ be ? NamedEvaluation of |Initializer| with argument _bindingId_.
 * 	//     ...
 * 	//
 * 	// 14.3.2.1 RS: Evaluation
 * 	//   VariableDeclaration : BindingIdentifier Initializer
 * 	//     ...
 * 	//     3. If IsAnonymousFunctionDefinition(|Initializer|) is *true*, then
 * 	//        a. Let _value_ be ? NamedEvaluation of |Initializer| with argument _bindingId_.
 * 	//     ...
 * 
 * 	factory := emitContext.Factory
 * 	var assignedName *ast.Expression
 * 	if len(assignedNameText) > 0 {
 * 		assignedName = factory.NewStringLiteral(assignedNameText, ast.TokenFlagsNone)
 * 	} else {
 * 		assignedName = getAssignedNameOfIdentifier(emitContext, node.Name(), node.Initializer)
 * 	}
 * 	initializer := finishTransformNamedEvaluation(emitContext, node.Initializer, assignedName, ignoreEmptyStringLiteral)
 * 	return factory.UpdateVariableDeclaration(
 * 		node,
 * 		node.Name(),
 * 		nil, /*exclamationToken* /
 * 		nil, /*typeNode* /
 * 		initializer,
 * 	)
 * }
 */
export function transformNamedEvaluationOfVariableDeclaration(emitContext: GoPtr<EmitContext>, node: GoPtr<VariableDeclaration>, ignoreEmptyStringLiteral: bool, assignedNameText: string): GoPtr<Expression> {
  const factory = emitContext!.Factory;
  let assignedName: GoPtr<Expression>;
  if (assignedNameText.length > 0) {
    assignedName = NewStringLiteral(factory!.__tsgoEmbedded0!, assignedNameText, TokenFlagsNone) as unknown as GoPtr<Expression>;
  } else {
    assignedName = getAssignedNameOfIdentifier(emitContext, node!.name as unknown as GoPtr<IdentifierNode>, node!.Initializer as unknown as GoPtr<Node>) as unknown as GoPtr<Expression>;
  }
  const initializer = finishTransformNamedEvaluation(emitContext, node!.Initializer as unknown as GoPtr<Node>, assignedName, ignoreEmptyStringLiteral);
  return NodeFactory_UpdateVariableDeclaration(
    factory!.__tsgoEmbedded0!,
    node,
    node!.name,
    undefined, // exclamationToken
    undefined, // typeNode
    initializer as unknown as GoPtr<never>,
  ) as unknown as GoPtr<Expression>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/namedevaluation.go::func::transformNamedEvaluationOfParameterDeclaration","kind":"func","status":"implemented","sigHash":"a541201ba2897aaeef753471e5be3d915569b4ab1846dda74a8f3cee3ce11442","bodyHash":"64c0c0c12628b2a1e4f9ce6f2f12f0422ef5fe5cb5d6a443f3039c92a1c3ce0b"}
 *
 * Go source:
 * func transformNamedEvaluationOfParameterDeclaration(emitContext *printer.EmitContext, node *ast.ParameterDeclaration /*NamedEvaluation & ParameterDeclaration* /, ignoreEmptyStringLiteral bool, assignedNameText string) *ast.Expression {
 * 	// 8.6.3 RS: IteratorBindingInitialization
 * 	//   SingleNameBinding : BindingIdentifier Initializer?
 * 	//     ...
 * 	//     5. If |Initializer| is present and _v_ is *undefined*, then
 * 	//        a. If IsAnonymousFunctionDefinition(|Initializer|) is *true*, then
 * 	//           i. Set _v_ to ? NamedEvaluation of |Initializer| with argument _bindingId_.
 * 	//     ...
 * 	//
 * 	// 14.3.3.3 RS: KeyedBindingInitialization
 * 	//   SingleNameBinding : BindingIdentifier Initializer?
 * 	//     ...
 * 	//     4. If |Initializer| is present and _v_ is *undefined*, then
 * 	//        a. If IsAnonymousFunctionDefinition(|Initializer|) is *true*, then
 * 	//           i. Set _v_ to ? NamedEvaluation of |Initializer| with argument _bindingId_.
 * 	//     ...
 * 
 * 	factory := emitContext.Factory
 * 	var assignedName *ast.Expression
 * 	if len(assignedNameText) > 0 {
 * 		assignedName = factory.NewStringLiteral(assignedNameText, ast.TokenFlagsNone)
 * 	} else {
 * 		assignedName = getAssignedNameOfIdentifier(emitContext, node.Name(), node.Initializer)
 * 	}
 * 	initializer := finishTransformNamedEvaluation(emitContext, node.Initializer, assignedName, ignoreEmptyStringLiteral)
 * 	return factory.UpdateParameterDeclaration(
 * 		node,
 * 		nil, /*modifiers* /
 * 		node.DotDotDotToken,
 * 		node.Name(),
 * 		nil, /*questionToken* /
 * 		nil, /*typeNode* /
 * 		initializer,
 * 	)
 * }
 */
export function transformNamedEvaluationOfParameterDeclaration(emitContext: GoPtr<EmitContext>, node: GoPtr<ParameterDeclaration>, ignoreEmptyStringLiteral: bool, assignedNameText: string): GoPtr<Expression> {
  const factory = emitContext!.Factory;
  let assignedName: GoPtr<Expression>;
  if (assignedNameText.length > 0) {
    assignedName = NewStringLiteral(factory!.__tsgoEmbedded0!, assignedNameText, TokenFlagsNone) as unknown as GoPtr<Expression>;
  } else {
    assignedName = getAssignedNameOfIdentifier(emitContext, node!.name as unknown as GoPtr<IdentifierNode>, node!.Initializer as unknown as GoPtr<Node>) as unknown as GoPtr<Expression>;
  }
  const initializer = finishTransformNamedEvaluation(emitContext, node!.Initializer as unknown as GoPtr<Node>, assignedName, ignoreEmptyStringLiteral);
  return NodeFactory_UpdateParameterDeclaration(
    factory!.__tsgoEmbedded0!,
    node,
    undefined, // modifiers
    node!.DotDotDotToken,
    node!.name,
    undefined, // questionToken
    undefined, // typeNode
    initializer as unknown as GoPtr<never>,
  ) as unknown as GoPtr<Expression>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/namedevaluation.go::func::transformNamedEvaluationOfBindingElement","kind":"func","status":"implemented","sigHash":"0f3f5cd58d544785b718556069aa103e2a0c7c331c5ba0e8979865252ef5e95b","bodyHash":"0a3013d02938384750b54a1312020ff822d0aceb1e59831d44759f965ccbbfed"}
 *
 * Go source:
 * func transformNamedEvaluationOfBindingElement(emitContext *printer.EmitContext, node *ast.BindingElement /*NamedEvaluation & BindingElement* /, ignoreEmptyStringLiteral bool, assignedNameText string) *ast.Expression {
 * 	// 8.6.3 RS: IteratorBindingInitialization
 * 	//   SingleNameBinding : BindingIdentifier Initializer?
 * 	//     ...
 * 	//     5. If |Initializer| is present and _v_ is *undefined*, then
 * 	//        a. If IsAnonymousFunctionDefinition(|Initializer|) is *true*, then
 * 	//           i. Set _v_ to ? NamedEvaluation of |Initializer| with argument _bindingId_.
 * 	//     ...
 * 	//
 * 	// 14.3.3.3 RS: KeyedBindingInitialization
 * 	//   SingleNameBinding : BindingIdentifier Initializer?
 * 	//     ...
 * 	//     4. If |Initializer| is present and _v_ is *undefined*, then
 * 	//        a. If IsAnonymousFunctionDefinition(|Initializer|) is *true*, then
 * 	//           i. Set _v_ to ? NamedEvaluation of |Initializer| with argument _bindingId_.
 * 	//     ...
 * 
 * 	factory := emitContext.Factory
 * 	var assignedName *ast.Expression
 * 	if len(assignedNameText) > 0 {
 * 		assignedName = factory.NewStringLiteral(assignedNameText, ast.TokenFlagsNone)
 * 	} else {
 * 		assignedName = getAssignedNameOfIdentifier(emitContext, node.Name(), node.Initializer)
 * 	}
 * 	initializer := finishTransformNamedEvaluation(emitContext, node.Initializer, assignedName, ignoreEmptyStringLiteral)
 * 	return factory.UpdateBindingElement(
 * 		node,
 * 		node.DotDotDotToken,
 * 		node.PropertyName,
 * 		node.Name(),
 * 		initializer,
 * 	)
 * }
 */
export function transformNamedEvaluationOfBindingElement(emitContext: GoPtr<EmitContext>, node: GoPtr<BindingElement>, ignoreEmptyStringLiteral: bool, assignedNameText: string): GoPtr<Expression> {
  const factory = emitContext!.Factory;
  let assignedName: GoPtr<Expression>;
  if (assignedNameText.length > 0) {
    assignedName = NewStringLiteral(factory!.__tsgoEmbedded0!, assignedNameText, TokenFlagsNone) as unknown as GoPtr<Expression>;
  } else {
    assignedName = getAssignedNameOfIdentifier(emitContext, node!.name as unknown as GoPtr<IdentifierNode>, node!.Initializer as unknown as GoPtr<Node>) as unknown as GoPtr<Expression>;
  }
  const initializer = finishTransformNamedEvaluation(emitContext, node!.Initializer as unknown as GoPtr<Node>, assignedName, ignoreEmptyStringLiteral);
  return NodeFactory_UpdateBindingElement(
    factory!.__tsgoEmbedded0!,
    node,
    node!.DotDotDotToken,
    node!.PropertyName,
    node!.name,
    initializer as unknown as GoPtr<never>,
  ) as unknown as GoPtr<Expression>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/namedevaluation.go::func::transformNamedEvaluationOfPropertyDeclaration","kind":"func","status":"implemented","sigHash":"ccb2710ac7806bda769e48ed95509bf8343c6c8743a3b4f014755b0662ad4bcb","bodyHash":"00fd34d1599b23be009ea7d4ec19dcb33428d4f2b37ca6636cbfed34deea4ea2"}
 *
 * Go source:
 * func transformNamedEvaluationOfPropertyDeclaration(emitContext *printer.EmitContext, node *ast.PropertyDeclaration /*NamedEvaluation & PropertyDeclaration* /, ignoreEmptyStringLiteral bool, assignedNameText string) *ast.Expression {
 * 	// 10.2.1.3 RS: EvaluateBody
 * 	//   Initializer : `=` AssignmentExpression
 * 	//     ...
 * 	//     3. If IsAnonymousFunctionDefinition(|AssignmentExpression|) is *true*, then
 * 	//        a. Let _value_ be ? NamedEvaluation of |Initializer| with argument _functionObject_.[[ClassFieldInitializerName]].
 * 	//     ...
 * 
 * 	factory := emitContext.Factory
 * 	assignedName, name := getAssignedNameOfPropertyName(emitContext, node.Name(), assignedNameText)
 * 	initializer := finishTransformNamedEvaluation(emitContext, node.Initializer, assignedName, ignoreEmptyStringLiteral)
 * 	return factory.UpdatePropertyDeclaration(
 * 		node,
 * 		node.Modifiers(),
 * 		name,
 * 		nil, /*postfixToken* /
 * 		nil, /*typeNode* /
 * 		initializer,
 * 	)
 * }
 */
export function transformNamedEvaluationOfPropertyDeclaration(emitContext: GoPtr<EmitContext>, node: GoPtr<PropertyDeclaration>, ignoreEmptyStringLiteral: bool, assignedNameText: string): GoPtr<Expression> {
  const factory = emitContext!.Factory;
  const [assignedName, name] = getAssignedNameOfPropertyName(emitContext, node!.name as unknown as GoPtr<PropertyName>, assignedNameText);
  const initializer = finishTransformNamedEvaluation(emitContext, node!.Initializer as unknown as GoPtr<Node>, assignedName, ignoreEmptyStringLiteral);
  return NodeFactory_UpdatePropertyDeclaration(
    factory!.__tsgoEmbedded0!,
    node,
    Node_Modifiers(node as unknown as GoPtr<Node>) as unknown as GoPtr<never>,
    name,
    undefined, // postfixToken
    undefined, // typeNode
    initializer as unknown as GoPtr<never>,
  ) as unknown as GoPtr<Expression>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/namedevaluation.go::func::transformNamedEvaluationOfAssignmentExpression","kind":"func","status":"implemented","sigHash":"5836781cf2bc2f5c33b8752b79a0c34746f49ba4a2bf55b200cbbb954cd5a0c7","bodyHash":"be825a2a404450e3e22871c3d2d8d0d52e3fa70071a3e93846805919fcbd4038"}
 *
 * Go source:
 * func transformNamedEvaluationOfAssignmentExpression(emitContext *printer.EmitContext, node *ast.BinaryExpression /*NamedEvaluation & BinaryExpression* /, ignoreEmptyStringLiteral bool, assignedNameText string) *ast.Expression {
 * 	// 13.15.2 RS: Evaluation
 * 	//   AssignmentExpression : LeftHandSideExpression `=` AssignmentExpression
 * 	//     1. If |LeftHandSideExpression| is neither an |ObjectLiteral| nor an |ArrayLiteral|, then
 * 	//        a. Let _lref_ be ? Evaluation of |LeftHandSideExpression|.
 * 	//        b. If IsAnonymousFunctionDefinition(|AssignmentExpression|) and IsIdentifierRef of |LeftHandSideExpression| are both *true*, then
 * 	//           i. Let _rval_ be ? NamedEvaluation of |AssignmentExpression| with argument _lref_.[[ReferencedName]].
 * 	//     ...
 * 	//
 * 	//   AssignmentExpression : LeftHandSideExpression `&&=` AssignmentExpression
 * 	//     ...
 * 	//     5. If IsAnonymousFunctionDefinition(|AssignmentExpression|) is *true* and IsIdentifierRef of |LeftHandSideExpression| is *true*, then
 * 	//        a. Let _rval_ be ? NamedEvaluation of |AssignmentExpression| with argument _lref_.[[ReferencedName]].
 * 	//     ...
 * 	//
 * 	//   AssignmentExpression : LeftHandSideExpression `||=` AssignmentExpression
 * 	//     ...
 * 	//     5. If IsAnonymousFunctionDefinition(|AssignmentExpression|) is *true* and IsIdentifierRef of |LeftHandSideExpression| is *true*, then
 * 	//        a. Let _rval_ be ? NamedEvaluation of |AssignmentExpression| with argument _lref_.[[ReferencedName]].
 * 	//     ...
 * 	//
 * 	//   AssignmentExpression : LeftHandSideExpression `??=` AssignmentExpression
 * 	//     ...
 * 	//     4. If IsAnonymousFunctionDefinition(|AssignmentExpression|) is *true* and IsIdentifierRef of |LeftHandSideExpression| is *true*, then
 * 	//        a. Let _rval_ be ? NamedEvaluation of |AssignmentExpression| with argument _lref_.[[ReferencedName]].
 * 	//     ...
 * 
 * 	factory := emitContext.Factory
 * 	var assignedName *ast.Expression
 * 	if len(assignedNameText) > 0 {
 * 		assignedName = factory.NewStringLiteral(assignedNameText, ast.TokenFlagsNone)
 * 	} else {
 * 		assignedName = getAssignedNameOfIdentifier(emitContext, node.Left, node.Right)
 * 	}
 * 	right := finishTransformNamedEvaluation(emitContext, node.Right, assignedName, ignoreEmptyStringLiteral)
 * 	return factory.UpdateBinaryExpression(
 * 		node,
 * 		nil, /*modifiers* /
 * 		node.Left,
 * 		nil, /*typeNode* /
 * 		node.OperatorToken,
 * 		right,
 * 	)
 * }
 */
export function transformNamedEvaluationOfAssignmentExpression(emitContext: GoPtr<EmitContext>, node: GoPtr<BinaryExpression>, ignoreEmptyStringLiteral: bool, assignedNameText: string): GoPtr<Expression> {
  const factory = emitContext!.Factory;
  let assignedName: GoPtr<Expression>;
  if (assignedNameText.length > 0) {
    assignedName = NewStringLiteral(factory!.__tsgoEmbedded0!, assignedNameText, TokenFlagsNone) as unknown as GoPtr<Expression>;
  } else {
    assignedName = getAssignedNameOfIdentifier(emitContext, node!.Left as unknown as GoPtr<IdentifierNode>, node!.Right as unknown as GoPtr<Node>) as unknown as GoPtr<Expression>;
  }
  const right = finishTransformNamedEvaluation(emitContext, node!.Right as unknown as GoPtr<Node>, assignedName, ignoreEmptyStringLiteral);
  return NodeFactory_UpdateBinaryExpression(
    factory!.__tsgoEmbedded0!,
    node,
    undefined, // modifiers
    node!.Left as unknown as GoPtr<never>,
    undefined, // typeNode
    node!.OperatorToken,
    right as unknown as GoPtr<never>,
  ) as unknown as GoPtr<Expression>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/namedevaluation.go::func::transformNamedEvaluationOfExportAssignment","kind":"func","status":"implemented","sigHash":"8cd5158cc5fd6aa78feb49e410a8da221081bd17a67eaff0058dfc1ffe81bb4e","bodyHash":"9cbac9ccb1735aaecdf3f3ab235be35aaf321f56c0091873c7671d62460bad5c"}
 *
 * Go source:
 * func transformNamedEvaluationOfExportAssignment(emitContext *printer.EmitContext, node *ast.ExportAssignment /*NamedEvaluation & ExportAssignment* /, ignoreEmptyStringLiteral bool, assignedNameText string) *ast.Expression {
 * 	// 16.2.3.7 RS: Evaluation
 * 	//   ExportDeclaration : `export` `default` AssignmentExpression `;`
 * 	//     1. If IsAnonymousFunctionDefinition(|AssignmentExpression|) is *true*, then
 * 	//        a. Let _value_ be ? NamedEvaluation of |AssignmentExpression| with argument `"default"`.
 * 	//     ...
 * 
 * 	// NOTE: Since emit for `export =` translates to `module.exports = ...`, the assigned name of the class or function
 * 	// is `""`.
 * 
 * 	factory := emitContext.Factory
 * 	var assignedName *ast.Expression
 * 	if len(assignedNameText) > 0 {
 * 		assignedName = factory.NewStringLiteral(assignedNameText, ast.TokenFlagsNone)
 * 	} else if node.IsExportEquals {
 * 		assignedName = factory.NewStringLiteral("", ast.TokenFlagsNone)
 * 	} else {
 * 		assignedName = factory.NewStringLiteral("default", ast.TokenFlagsNone)
 * 	}
 * 	expression := finishTransformNamedEvaluation(emitContext, node.Expression, assignedName, ignoreEmptyStringLiteral)
 * 	return factory.UpdateExportAssignment(
 * 		node,
 * 		nil, /*modifiers* /
 * 		node.IsExportEquals,
 * 		nil, /*typeNode* /
 * 		expression,
 * 	)
 * }
 */
export function transformNamedEvaluationOfExportAssignment(emitContext: GoPtr<EmitContext>, node: GoPtr<ExportAssignment>, ignoreEmptyStringLiteral: bool, assignedNameText: string): GoPtr<Expression> {
  const factory = emitContext!.Factory;
  let assignedName: GoPtr<Expression>;
  if (assignedNameText.length > 0) {
    assignedName = NewStringLiteral(factory!.__tsgoEmbedded0!, assignedNameText, TokenFlagsNone) as unknown as GoPtr<Expression>;
  } else if (node!.IsExportEquals) {
    assignedName = NewStringLiteral(factory!.__tsgoEmbedded0!, "", TokenFlagsNone) as unknown as GoPtr<Expression>;
  } else {
    assignedName = NewStringLiteral(factory!.__tsgoEmbedded0!, "default", TokenFlagsNone) as unknown as GoPtr<Expression>;
  }
  const expression = finishTransformNamedEvaluation(emitContext, node!.Expression as unknown as GoPtr<Node>, assignedName, ignoreEmptyStringLiteral);
  return NodeFactory_UpdateExportAssignment(
    factory!.__tsgoEmbedded0!,
    node,
    undefined, // modifiers
    node!.IsExportEquals,
    undefined, // typeNode
    expression as unknown as GoPtr<never>,
  ) as unknown as GoPtr<Expression>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/namedevaluation.go::func::transformNamedEvaluation","kind":"func","status":"implemented","sigHash":"340c5fdfb8aaff13a9e4e5e652ece444fa019271bd60bc7a41a1b890d1a1b2ea","bodyHash":"def92be0282ed57cafb739c99a5a2ecd82d39d60d3137298f200dd421946c5fe"}
 *
 * Go source:
 * func transformNamedEvaluation(context *printer.EmitContext, node *ast.Node /*NamedEvaluation* /, ignoreEmptyStringLiteral bool, assignedName string) *ast.Expression {
 * 	switch node.Kind {
 * 	case ast.KindPropertyAssignment:
 * 		return transformNamedEvaluationOfPropertyAssignment(context, node.AsPropertyAssignment(), ignoreEmptyStringLiteral, assignedName)
 * 	case ast.KindShorthandPropertyAssignment:
 * 		return transformNamedEvaluationOfShorthandAssignmentProperty(context, node.AsShorthandPropertyAssignment(), ignoreEmptyStringLiteral, assignedName)
 * 	case ast.KindVariableDeclaration:
 * 		return transformNamedEvaluationOfVariableDeclaration(context, node.AsVariableDeclaration(), ignoreEmptyStringLiteral, assignedName)
 * 	case ast.KindParameter:
 * 		return transformNamedEvaluationOfParameterDeclaration(context, node.AsParameterDeclaration(), ignoreEmptyStringLiteral, assignedName)
 * 	case ast.KindBindingElement:
 * 		return transformNamedEvaluationOfBindingElement(context, node.AsBindingElement(), ignoreEmptyStringLiteral, assignedName)
 * 	case ast.KindPropertyDeclaration:
 * 		return transformNamedEvaluationOfPropertyDeclaration(context, node.AsPropertyDeclaration(), ignoreEmptyStringLiteral, assignedName)
 * 	case ast.KindBinaryExpression:
 * 		return transformNamedEvaluationOfAssignmentExpression(context, node.AsBinaryExpression(), ignoreEmptyStringLiteral, assignedName)
 * 	case ast.KindExportAssignment:
 * 		return transformNamedEvaluationOfExportAssignment(context, node.AsExportAssignment(), ignoreEmptyStringLiteral, assignedName)
 * 	default:
 * 		debug.Fail("Unhandled case in transformNamedEvaluation")
 * 		return node
 * 	}
 * }
 */
export function transformNamedEvaluation(context: GoPtr<EmitContext>, node: GoPtr<Node>, ignoreEmptyStringLiteral: bool, assignedName: string): GoPtr<Expression> {
  switch (node!.Kind) {
    case KindPropertyAssignment:
      return transformNamedEvaluationOfPropertyAssignment(context, AsPropertyAssignment(node)!, ignoreEmptyStringLiteral, assignedName);
    case KindShorthandPropertyAssignment:
      return transformNamedEvaluationOfShorthandAssignmentProperty(context, AsShorthandPropertyAssignment(node)!, ignoreEmptyStringLiteral, assignedName);
    case KindVariableDeclaration:
      return transformNamedEvaluationOfVariableDeclaration(context, AsVariableDeclaration(node)!, ignoreEmptyStringLiteral, assignedName);
    case KindParameter:
      return transformNamedEvaluationOfParameterDeclaration(context, AsParameterDeclaration(node)!, ignoreEmptyStringLiteral, assignedName);
    case KindBindingElement:
      return transformNamedEvaluationOfBindingElement(context, AsBindingElement(node)!, ignoreEmptyStringLiteral, assignedName);
    case KindPropertyDeclaration:
      return transformNamedEvaluationOfPropertyDeclaration(context, AsPropertyDeclaration(node)!, ignoreEmptyStringLiteral, assignedName);
    case KindBinaryExpression:
      return transformNamedEvaluationOfAssignmentExpression(context, AsBinaryExpression(node)!, ignoreEmptyStringLiteral, assignedName);
    case KindExportAssignment:
      return transformNamedEvaluationOfExportAssignment(context, AsExportAssignment(node)!, ignoreEmptyStringLiteral, assignedName);
    default:
      throw new globalThis.Error("Unhandled case in transformNamedEvaluation");
  }
}
