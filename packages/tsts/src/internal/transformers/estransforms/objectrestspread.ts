import type { bool } from "@tsonic/core/types.js";
import type { GoMap, GoPtr, GoSlice } from "../../../go/compat.js";
import type { Node, NodeList } from "../../ast/spine.js";
import { NodeFactory_NewNodeList, Node_Name, Node_Clone, Node_SubtreeFacts } from "../../ast/spine.js";
import type { TextRange } from "../../core/text.js";
import { AsSourceFile, Node_Parameters, Node_StatementList, Node_Statements, Node_Body, Node_Initializer, Node_Expression, NodeFactory_UpdateBlock, NodeFactory_UpdateBinaryExpression, NodeFactory_UpdateForInOrOfStatement, NodeFactory_UpdateCatchClause, NodeFactory_UpdateVariableDeclaration, NodeFactory_UpdateParameterDeclaration, NodeFactory_UpdateConstructorDeclaration, NodeFactory_UpdateGetAccessorDeclaration, NodeFactory_UpdateSetAccessorDeclaration, NodeFactory_UpdateMethodDeclaration, NodeFactory_UpdateFunctionDeclaration, NodeFactory_UpdateArrowFunction, NodeFactory_UpdateFunctionExpression } from "../../ast/ast.js";
import type { SourceFile } from "../../ast/ast.js";
import type { ArrowFunction, BinaryExpression, CatchClause, ConstructorDeclaration, ForInOrOfStatement, FunctionDeclaration, FunctionExpression, GetAccessorDeclaration, MethodDeclaration, ObjectLiteralExpression, ParameterDeclaration, SetAccessorDeclaration, VariableDeclaration, VariableStatement } from "../../ast/generated/data.js";
import { AsBlock, AsSyntaxList, AsBinaryExpression, AsVariableStatement, AsVariableDeclaration, AsCatchClause, AsParameterDeclaration, AsConstructorDeclaration, AsGetAccessorDeclaration, AsSetAccessorDeclaration, AsMethodDeclaration, AsFunctionDeclaration, AsArrowFunction, AsFunctionExpression, AsObjectLiteralExpression, AsVariableDeclarationList } from "../../ast/generated/casts.js";
import { IsBlock, IsVariableDeclarationList } from "../../ast/generated/predicates.js";
import { IsBindingPattern, IsPrologueDirective, IsDestructuringAssignment, ContainsObjectRestOrSpread, IsAssignmentPattern, SkipParentheses, HasSyntacticModifier } from "../../ast/utilities.js";
import { KindSourceFile, KindObjectLiteralExpression, KindBinaryExpression, KindExpressionStatement, KindParenthesizedExpression, KindForOfStatement, KindVariableStatement, KindVariableDeclaration, KindCatchClause, KindParameter, KindConstructor, KindGetAccessor, KindSetAccessor, KindMethodDeclaration, KindFunctionDeclaration, KindArrowFunction, KindFunctionExpression, KindSpreadAssignment, KindPropertyAssignment, KindCommaToken, KindSyntaxList } from "../../ast/generated/kinds.js";
import { NodeFlagsNone, NodeFlagsLet } from "../../ast/generated/flags.js";
import { NewBlock, NewReturnStatement, NewVariableStatement, NewVariableDeclaration, NewVariableDeclarationList, NewExpressionStatement, NewIfStatement, NewObjectLiteralExpression, NewPropertyAssignment } from "../../ast/generated/factory.js";
import { NodeFactory_NewGeneratedNameForNode, NodeFactory_NewTempVariable, NodeFactory_NewAssignmentExpression, NodeFactory_NewAssignHelper, NodeFactory_NewTypeCheck, NodeFactory_CreateForOfBindingStatement } from "../../printer/factory.js";
import { EmitContext_StartVariableEnvironment, EmitContext_EndVariableEnvironment, EmitContext_EndAndMergeVariableEnvironment, EmitContext_AddEmitHelper, EmitContext_ReadEmitHelpers, EmitContext_AddEmitFlags, EmitContext_EmitFlags } from "../../printer/emitcontext.js";
import { EFCustomPrologue, EFSingleLine, EFNoTrailingSourceMap, EFNoTokenSourceMaps, EFNoComments, EFNoSourceMap, EFStartOnNewLine } from "../../printer/emitflags.js";
import { FlattenDestructuringBinding, FlattenDestructuringAssignment, FlattenLevelObjectRest, FlattenLevelAll } from "../destructuring.js";
import type { CreateAssignmentCallback } from "../destructuring.js";
import { ModifierFlagsExport } from "../../ast/modifierflags.js";
import { CompilerOptions_GetEmitScriptTarget } from "../../core/compileroptions.js";
import type { CompilerOptions } from "../../core/compileroptions.js";
import { SubtreeContainsObjectRestOrSpread, SubtreeContainsESObjectRestOrSpread } from "../../ast/subtreefacts.js";
import type { TransformOptions } from "../chain.js";
import type { Transformer } from "../transformer.js";
import { Transformer_NewTransformer, Transformer_EmitContext, Transformer_Factory, Transformer_Visitor } from "../transformer.js";
import { NodeVisitor_VisitNode, NodeVisitor_VisitEachChild, NodeVisitor_VisitNodes } from "../../ast/visitor.js";
import type { NodeVisitor as ConcreteNodeVisitor } from "../../ast/visitor.js";

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/objectrestspread.go::type::objectRestSpreadTransformer","kind":"type","status":"implemented","sigHash":"bbe05073778a62bda93186b24f160901f4fa35f78b8e08de61bd627c1c896fff","bodyHash":"90b5de35b19b85c86c591b1f38d85961c5b02bbd88058844381230313cabdf4a"}
 *
 * Go source:
 * objectRestSpreadTransformer struct {
 * 	transformers.Transformer
 * 	compilerOptions *core.CompilerOptions
 *
 * 	inExportedVariableStatement bool
 * 	expressionResultIsUnused    bool
 *
 * 	parametersWithPrecedingObjectRestOrSpread map[*ast.Node]struct{}
 * }
 */
export interface objectRestSpreadTransformer {
  readonly __tsgoEmbedded0?: Transformer;
  compilerOptions: GoPtr<CompilerOptions>;
  inExportedVariableStatement: bool;
  expressionResultIsUnused: bool;
  parametersWithPrecedingObjectRestOrSpread: GoMap<GoPtr<Node>, { readonly __tsgoEmpty?: never }>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/objectrestspread.go::method::objectRestSpreadTransformer.visit","kind":"method","status":"implemented","sigHash":"517e37e65a5ecb1af73e2e271f78b6eda94dc219ba3b596f9fcb63dc1080c3fe","bodyHash":"0a1c0192e7f4a59f6cd69f4948d573b09d3be5a5c6763435605ff257c2f9bc23"}
 *
 * Go source:
 * func (ch *objectRestSpreadTransformer) visit(node *ast.Node) *ast.Node {
 * 	if node.SubtreeFacts()&ast.SubtreeContainsESObjectRestOrSpread == 0 && ch.parametersWithPrecedingObjectRestOrSpread == nil {
 * 		return node
 * 	}
 * 	// Save the expressionResultIsUnused flag set by the parent for this node,
 * 	// then reset to false for children (the default). Specific cases below override as needed.
 * 	expressionResultIsUnused := ch.expressionResultIsUnused
 * 	ch.expressionResultIsUnused = false
 * 	defer func() { ch.expressionResultIsUnused = expressionResultIsUnused }()
 * 	switch node.Kind {
 * 	case ast.KindSourceFile:
 * 		return ch.visitSourceFile(node.AsSourceFile())
 * 	case ast.KindObjectLiteralExpression:
 * 		return ch.visitObjectLiteralExpression(node.AsObjectLiteralExpression())
 * 	case ast.KindBinaryExpression:
 * 		return ch.visitBinaryExpression(node.AsBinaryExpression(), expressionResultIsUnused)
 * 	case ast.KindExpressionStatement:
 * 		ch.expressionResultIsUnused = true
 * 		return ch.Visitor().VisitEachChild(node)
 * 	case ast.KindParenthesizedExpression:
 * 		ch.expressionResultIsUnused = expressionResultIsUnused
 * 		return ch.Visitor().VisitEachChild(node)
 * 	case ast.KindForOfStatement:
 * 		return ch.visitForOftatement(node.AsForInOrOfStatement())
 * 	case ast.KindVariableStatement:
 * 		return ch.visitVariableStatement(node.AsVariableStatement())
 * 	case ast.KindVariableDeclaration:
 * 		return ch.visitVariableDeclaration(node.AsVariableDeclaration())
 * 	case ast.KindCatchClause:
 * 		return ch.visitCatchClause(node.AsCatchClause())
 * 	case ast.KindParameter:
 * 		return ch.visitParameter(node.AsParameterDeclaration())
 * 	case ast.KindConstructor:
 * 		return ch.visitContructorDeclaration(node.AsConstructorDeclaration())
 * 	case ast.KindGetAccessor:
 * 		return ch.visitGetAccessorDeclaration(node.AsGetAccessorDeclaration())
 * 	case ast.KindSetAccessor:
 * 		return ch.visitSetAccessorDeclaration(node.AsSetAccessorDeclaration())
 * 	case ast.KindMethodDeclaration:
 * 		return ch.visitMethodDeclaration(node.AsMethodDeclaration())
 * 	case ast.KindFunctionDeclaration:
 * 		return ch.visitFunctionDeclaration(node.AsFunctionDeclaration())
 * 	case ast.KindArrowFunction:
 * 		return ch.visitArrowFunction(node.AsArrowFunction())
 * 	case ast.KindFunctionExpression:
 * 		return ch.visitFunctionExpression(node.AsFunctionExpression())
 * 	default:
 * 		return ch.Visitor().VisitEachChild(node)
 * 	}
 * }
 */
export function objectRestSpreadTransformer_visit(receiver: GoPtr<objectRestSpreadTransformer>, node: GoPtr<Node>): GoPtr<Node> {
  if ((Node_SubtreeFacts(node) & SubtreeContainsESObjectRestOrSpread) === 0 && receiver!.parametersWithPrecedingObjectRestOrSpread === undefined) {
    return node;
  }
  const expressionResultIsUnused = receiver!.expressionResultIsUnused;
  receiver!.expressionResultIsUnused = false;
  try {
    const visitor = Transformer_Visitor(receiver!.__tsgoEmbedded0!) as ConcreteNodeVisitor;
    switch (node!.Kind) {
      case KindSourceFile:
        return objectRestSpreadTransformer_visitSourceFile(receiver, AsSourceFile(node));
      case KindObjectLiteralExpression:
        return objectRestSpreadTransformer_visitObjectLiteralExpression(receiver, AsObjectLiteralExpression(node));
      case KindBinaryExpression:
        return objectRestSpreadTransformer_visitBinaryExpression(receiver, AsBinaryExpression(node), expressionResultIsUnused);
      case KindExpressionStatement:
        receiver!.expressionResultIsUnused = true;
        return NodeVisitor_VisitEachChild(visitor, node);
      case KindParenthesizedExpression:
        receiver!.expressionResultIsUnused = expressionResultIsUnused;
        return NodeVisitor_VisitEachChild(visitor, node);
      case KindForOfStatement:
        return objectRestSpreadTransformer_visitForOftatement(receiver, node as unknown as GoPtr<ForInOrOfStatement>);
      case KindVariableStatement:
        return objectRestSpreadTransformer_visitVariableStatement(receiver, AsVariableStatement(node));
      case KindVariableDeclaration:
        return objectRestSpreadTransformer_visitVariableDeclaration(receiver, AsVariableDeclaration(node));
      case KindCatchClause:
        return objectRestSpreadTransformer_visitCatchClause(receiver, AsCatchClause(node));
      case KindParameter:
        return objectRestSpreadTransformer_visitParameter(receiver, AsParameterDeclaration(node));
      case KindConstructor:
        return objectRestSpreadTransformer_visitContructorDeclaration(receiver, AsConstructorDeclaration(node));
      case KindGetAccessor:
        return objectRestSpreadTransformer_visitGetAccessorDeclaration(receiver, AsGetAccessorDeclaration(node));
      case KindSetAccessor:
        return objectRestSpreadTransformer_visitSetAccessorDeclaration(receiver, AsSetAccessorDeclaration(node));
      case KindMethodDeclaration:
        return objectRestSpreadTransformer_visitMethodDeclaration(receiver, AsMethodDeclaration(node));
      case KindFunctionDeclaration:
        return objectRestSpreadTransformer_visitFunctionDeclaration(receiver, AsFunctionDeclaration(node));
      case KindArrowFunction:
        return objectRestSpreadTransformer_visitArrowFunction(receiver, AsArrowFunction(node));
      case KindFunctionExpression:
        return objectRestSpreadTransformer_visitFunctionExpression(receiver, AsFunctionExpression(node));
      default:
        return NodeVisitor_VisitEachChild(visitor, node);
    }
  } finally {
    receiver!.expressionResultIsUnused = expressionResultIsUnused;
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/objectrestspread.go::method::objectRestSpreadTransformer.visitSourceFile","kind":"method","status":"implemented","sigHash":"3ad9564380d2783b079072fbb26edd9cbf1c0f38b44a690af069acacd1955348","bodyHash":"1789b0792c6edfc2a5f1b326201cc8657cdccb0ca80ed264343bab9afced2b01"}
 *
 * Go source:
 * func (ch *objectRestSpreadTransformer) visitSourceFile(node *ast.SourceFile) *ast.Node {
 * 	visited := ch.Visitor().VisitEachChild(node.AsNode())
 * 	ch.EmitContext().AddEmitHelper(visited.AsNode(), ch.EmitContext().ReadEmitHelpers()...)
 * 	return visited
 * }
 */
export function objectRestSpreadTransformer_visitSourceFile(receiver: GoPtr<objectRestSpreadTransformer>, node: GoPtr<SourceFile>): GoPtr<Node> {
  const visitor = Transformer_Visitor(receiver!.__tsgoEmbedded0!) as ConcreteNodeVisitor;
  const emitContext = Transformer_EmitContext(receiver!.__tsgoEmbedded0!);
  const visited = NodeVisitor_VisitEachChild(visitor, node as unknown as GoPtr<Node>);
  EmitContext_AddEmitHelper(emitContext, visited, ...EmitContext_ReadEmitHelpers(emitContext));
  return visited;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/objectrestspread.go::method::objectRestSpreadTransformer.visitParameter","kind":"method","status":"implemented","sigHash":"0de9b319b3c0018f13263dd60451f34e8c08e6848281c70dcbeef9d1dfe44827","bodyHash":"194073c78e3bfa018db1f76e5f3ff99e5add27c2f530c6df9bdee1c60a129952"}
 *
 * Go source:
 * func (ch *objectRestSpreadTransformer) visitParameter(node *ast.ParameterDeclaration) *ast.Node {
 * 	if ch.parametersWithPrecedingObjectRestOrSpread != nil {
 * 		if _, ok := ch.parametersWithPrecedingObjectRestOrSpread[node.AsNode()]; ok {
 * 			name := node.Name()
 * 			if ast.IsBindingPattern(name) {
 * 				name = ch.Factory().NewGeneratedNameForNode(node.AsNode())
 * 			}
 * 			return ch.Factory().UpdateParameterDeclaration(
 * 				node,
 * 				nil,
 * 				node.DotDotDotToken,
 * 				name,
 * 				nil,
 * 				nil,
 * 				nil,
 * 			)
 * 		}
 * 	}
 * 	if node.SubtreeFacts()&ast.SubtreeContainsObjectRestOrSpread != 0 {
 * 		// Binding patterns are converted into a generated name and are
 * 		// evaluated inside the function body.
 * 		return ch.Factory().UpdateParameterDeclaration(
 * 			node,
 * 			nil,
 * 			node.DotDotDotToken,
 * 			ch.Factory().NewGeneratedNameForNode(node.AsNode()),
 * 			nil,
 * 			nil,
 * 			ch.Visitor().VisitNode(node.Initializer),
 * 		)
 * 	}
 * 	return ch.Visitor().VisitEachChild(node.AsNode())
 * }
 */
export function objectRestSpreadTransformer_visitParameter(receiver: GoPtr<objectRestSpreadTransformer>, node: GoPtr<ParameterDeclaration>): GoPtr<Node> {
  const printerFactory = Transformer_Factory(receiver!.__tsgoEmbedded0!);
  const astFactory = printerFactory!.__tsgoEmbedded0!;
  const visitor = Transformer_Visitor(receiver!.__tsgoEmbedded0!) as ConcreteNodeVisitor;
  const nodeAsNode = node as unknown as GoPtr<Node>;
  if (receiver!.parametersWithPrecedingObjectRestOrSpread !== undefined) {
    if (receiver!.parametersWithPrecedingObjectRestOrSpread.has(nodeAsNode)) {
      let name = Node_Name(nodeAsNode);
      if (IsBindingPattern(name as unknown as GoPtr<Node>)) {
        name = NodeFactory_NewGeneratedNameForNode(printerFactory, nodeAsNode) as unknown as typeof name;
      }
      return NodeFactory_UpdateParameterDeclaration(
        astFactory,
        node,
        undefined,
        node!.DotDotDotToken,
        name as unknown as GoPtr<never>,
        undefined,
        undefined,
        undefined,
      );
    }
  }
  if ((Node_SubtreeFacts(nodeAsNode) & SubtreeContainsObjectRestOrSpread) !== 0) {
    return NodeFactory_UpdateParameterDeclaration(
      astFactory,
      node,
      undefined,
      node!.DotDotDotToken,
      NodeFactory_NewGeneratedNameForNode(printerFactory, nodeAsNode) as unknown as GoPtr<never>,
      undefined,
      undefined,
      NodeVisitor_VisitNode(visitor, Node_Initializer(nodeAsNode)) as unknown as GoPtr<never>,
    );
  }
  return NodeVisitor_VisitEachChild(visitor, nodeAsNode);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/objectrestspread.go::method::objectRestSpreadTransformer.collectParametersWithPrecedingObjectRestOrSpread","kind":"method","status":"implemented","sigHash":"0a5da916bcc5432b50def7216ef06d8c73ee8653aa211f3544ec6143e5c7af9e","bodyHash":"2261f4cefedda8bb72e85f802bbb7e86c24e71b8c39cc836fc403775d6337114"}
 *
 * Go source:
 * func (ch *objectRestSpreadTransformer) collectParametersWithPrecedingObjectRestOrSpread(node *ast.Node) map[*ast.Node]struct{} {
 * 	var result map[*ast.Node]struct{}
 * 	for _, parameter := range node.Parameters() {
 * 		if result != nil {
 * 			result[parameter] = struct{}{}
 * 		} else if parameter.SubtreeFacts()&ast.SubtreeContainsObjectRestOrSpread != 0 {
 * 			result = make(map[*ast.Node]struct{})
 * 		}
 * 	}
 * 	return result
 * }
 */
export function objectRestSpreadTransformer_collectParametersWithPrecedingObjectRestOrSpread(receiver: GoPtr<objectRestSpreadTransformer>, node: GoPtr<Node>): GoMap<GoPtr<Node>, { readonly __tsgoEmpty?: never }> {
  let result: GoMap<GoPtr<Node>, { readonly __tsgoEmpty?: never }> = undefined as unknown as GoMap<GoPtr<Node>, { readonly __tsgoEmpty?: never }>;
  for (const parameter of Node_Parameters(node) ?? []) {
    const paramNode = parameter as unknown as GoPtr<Node>;
    if (result !== undefined) {
      result.set(paramNode, {});
    } else if ((Node_SubtreeFacts(paramNode) & SubtreeContainsObjectRestOrSpread) !== 0) {
      result = new Map<GoPtr<Node>, { readonly __tsgoEmpty?: never }>();
    }
  }
  return result;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/objectrestspread.go::type::oldParamScope","kind":"type","status":"implemented","sigHash":"9b4c34839620e59d8cc882160f7d7cac4ece220cfc51b56f63bf2a50cb6a75d8","bodyHash":"4136d1eac74cc0ec38c279f6295c4e910ac899d1ce6721e2ef7b90e6e3bbe21e"}
 *
 * Go source:
 * oldParamScope map[*ast.Node]struct{}
 */
export type oldParamScope = GoMap<GoPtr<Node>, { readonly __tsgoEmpty?: never }>;

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/objectrestspread.go::method::objectRestSpreadTransformer.enterParameterListContext","kind":"method","status":"implemented","sigHash":"c5aa4db999a23612c13ee2bba9da70de79b4e6e67a2c214a0b7d17711a6bb75c","bodyHash":"f57eb7571a9acad994bea403a35fd235e0190b07f097a5400b7ae17bd938e509"}
 *
 * Go source:
 * func (ch *objectRestSpreadTransformer) enterParameterListContext(node *ast.Node) oldParamScope {
 * 	old := ch.parametersWithPrecedingObjectRestOrSpread
 * 	ch.parametersWithPrecedingObjectRestOrSpread = ch.collectParametersWithPrecedingObjectRestOrSpread(node)
 * 	return oldParamScope(old)
 * }
 */
export function objectRestSpreadTransformer_enterParameterListContext(receiver: GoPtr<objectRestSpreadTransformer>, node: GoPtr<Node>): oldParamScope {
  const old = receiver!.parametersWithPrecedingObjectRestOrSpread;
  receiver!.parametersWithPrecedingObjectRestOrSpread = objectRestSpreadTransformer_collectParametersWithPrecedingObjectRestOrSpread(receiver, node);
  return old;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/objectrestspread.go::method::objectRestSpreadTransformer.exitParameterListContext","kind":"method","status":"implemented","sigHash":"c779dba462e37b40a75b57892483ab220bd8bf842d93d5539eab4d3e6f266bf3","bodyHash":"3c259d32c56b14445acdc28aacbf4ed8f420a0ea37b50a93d8a9f28010522726"}
 *
 * Go source:
 * func (ch *objectRestSpreadTransformer) exitParameterListContext(scope oldParamScope) {
 * 	ch.parametersWithPrecedingObjectRestOrSpread = map[*ast.Node]struct{}(scope)
 * }
 */
export function objectRestSpreadTransformer_exitParameterListContext(receiver: GoPtr<objectRestSpreadTransformer>, scope: oldParamScope): void {
  receiver!.parametersWithPrecedingObjectRestOrSpread = scope;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/objectrestspread.go::method::objectRestSpreadTransformer.visitContructorDeclaration","kind":"method","status":"implemented","sigHash":"f7326fbe1578bf0036aef32da45312eef0eac83ccaac54d7e70d52d3b8f48aa9","bodyHash":"bd14a364e3bd94c2137c1c967c72e7ef51aa35da4ff9eb1cc91febf898ab2ec8"}
 *
 * Go source:
 * func (ch *objectRestSpreadTransformer) visitContructorDeclaration(node *ast.ConstructorDeclaration) *ast.Node {
 * 	old := ch.enterParameterListContext(node.AsNode())
 * 	defer ch.exitParameterListContext(old)
 * 	return ch.Factory().UpdateConstructorDeclaration(
 * 		node,
 * 		node.Modifiers(),
 * 		nil,
 * 		ch.Visitor().VisitNodes(node.Parameters),
 * 		nil,
 * 		nil,
 * 		ch.transformFunctionBody(node.AsNode()),
 * 	)
 * }
 */
export function objectRestSpreadTransformer_visitContructorDeclaration(receiver: GoPtr<objectRestSpreadTransformer>, node: GoPtr<ConstructorDeclaration>): GoPtr<Node> {
  const nodeAsNode = node as unknown as GoPtr<Node>;
  const old = objectRestSpreadTransformer_enterParameterListContext(receiver, nodeAsNode);
  try {
    const astFactory = Transformer_Factory(receiver!.__tsgoEmbedded0!)!.__tsgoEmbedded0!;
    const visitor = Transformer_Visitor(receiver!.__tsgoEmbedded0!) as ConcreteNodeVisitor;
    return NodeFactory_UpdateConstructorDeclaration(
      astFactory,
      node,
      node!.modifiers,
      undefined,
      NodeVisitor_VisitNodes(visitor, node!.Parameters) as unknown as GoPtr<never>,
      undefined,
      undefined,
      objectRestSpreadTransformer_transformFunctionBody(receiver, nodeAsNode) as unknown as GoPtr<never>,
    );
  } finally {
    objectRestSpreadTransformer_exitParameterListContext(receiver, old);
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/objectrestspread.go::method::objectRestSpreadTransformer.visitGetAccessorDeclaration","kind":"method","status":"implemented","sigHash":"50b453ba1b772a9eb01199658f3b6575a3d3150b003f01a6a998a0b2b9b736f2","bodyHash":"f301f651100141111a7f33608d32e934170d3a88b17e462b527999f855e311ad"}
 *
 * Go source:
 * func (ch *objectRestSpreadTransformer) visitGetAccessorDeclaration(node *ast.GetAccessorDeclaration) *ast.Node {
 * 	old := ch.enterParameterListContext(node.AsNode())
 * 	defer ch.exitParameterListContext(old)
 * 	return ch.Factory().UpdateGetAccessorDeclaration(
 * 		node,
 * 		node.Modifiers(),
 * 		ch.Visitor().VisitNode(node.Name()),
 * 		nil,
 * 		ch.Visitor().VisitNodes(node.Parameters),
 * 		nil,
 * 		nil,
 * 		ch.transformFunctionBody(node.AsNode()),
 * 	)
 * }
 */
export function objectRestSpreadTransformer_visitGetAccessorDeclaration(receiver: GoPtr<objectRestSpreadTransformer>, node: GoPtr<GetAccessorDeclaration>): GoPtr<Node> {
  const nodeAsNode = node as unknown as GoPtr<Node>;
  const old = objectRestSpreadTransformer_enterParameterListContext(receiver, nodeAsNode);
  try {
    const astFactory = Transformer_Factory(receiver!.__tsgoEmbedded0!)!.__tsgoEmbedded0!;
    const visitor = Transformer_Visitor(receiver!.__tsgoEmbedded0!) as ConcreteNodeVisitor;
    return NodeFactory_UpdateGetAccessorDeclaration(
      astFactory,
      node,
      node!.modifiers,
      NodeVisitor_VisitNode(visitor, Node_Name(nodeAsNode)) as unknown as GoPtr<never>,
      undefined,
      NodeVisitor_VisitNodes(visitor, node!.Parameters) as unknown as GoPtr<never>,
      undefined,
      undefined,
      objectRestSpreadTransformer_transformFunctionBody(receiver, nodeAsNode) as unknown as GoPtr<never>,
    );
  } finally {
    objectRestSpreadTransformer_exitParameterListContext(receiver, old);
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/objectrestspread.go::method::objectRestSpreadTransformer.visitSetAccessorDeclaration","kind":"method","status":"implemented","sigHash":"36dd975ef28fc63e653f20fd47e830a1461abaa4aa5be4c4b286e00aa640ac86","bodyHash":"3a7cbc8888e5854f91024f993878f94449ed1a325dad25f41873fb889f7f67db"}
 *
 * Go source:
 * func (ch *objectRestSpreadTransformer) visitSetAccessorDeclaration(node *ast.SetAccessorDeclaration) *ast.Node {
 * 	old := ch.enterParameterListContext(node.AsNode())
 * 	defer ch.exitParameterListContext(old)
 * 	return ch.Factory().UpdateSetAccessorDeclaration(
 * 		node,
 * 		node.Modifiers(),
 * 		ch.Visitor().VisitNode(node.Name()),
 * 		nil,
 * 		ch.Visitor().VisitNodes(node.Parameters),
 * 		nil,
 * 		nil,
 * 		ch.transformFunctionBody(node.AsNode()),
 * 	)
 * }
 */
export function objectRestSpreadTransformer_visitSetAccessorDeclaration(receiver: GoPtr<objectRestSpreadTransformer>, node: GoPtr<SetAccessorDeclaration>): GoPtr<Node> {
  const nodeAsNode = node as unknown as GoPtr<Node>;
  const old = objectRestSpreadTransformer_enterParameterListContext(receiver, nodeAsNode);
  try {
    const astFactory = Transformer_Factory(receiver!.__tsgoEmbedded0!)!.__tsgoEmbedded0!;
    const visitor = Transformer_Visitor(receiver!.__tsgoEmbedded0!) as ConcreteNodeVisitor;
    return NodeFactory_UpdateSetAccessorDeclaration(
      astFactory,
      node,
      node!.modifiers,
      NodeVisitor_VisitNode(visitor, Node_Name(nodeAsNode)) as unknown as GoPtr<never>,
      undefined,
      NodeVisitor_VisitNodes(visitor, node!.Parameters) as unknown as GoPtr<never>,
      undefined,
      undefined,
      objectRestSpreadTransformer_transformFunctionBody(receiver, nodeAsNode) as unknown as GoPtr<never>,
    );
  } finally {
    objectRestSpreadTransformer_exitParameterListContext(receiver, old);
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/objectrestspread.go::method::objectRestSpreadTransformer.visitMethodDeclaration","kind":"method","status":"implemented","sigHash":"d2f93649e7853f552266945cf565df6ff249ef9153a347f017a9904da1e7c1b9","bodyHash":"cb9647996f586ec476282ebb8815f03468c15120d61cd5d87decf5204084e1d5"}
 *
 * Go source:
 * func (ch *objectRestSpreadTransformer) visitMethodDeclaration(node *ast.MethodDeclaration) *ast.Node {
 * 	old := ch.enterParameterListContext(node.AsNode())
 * 	defer ch.exitParameterListContext(old)
 * 	return ch.Factory().UpdateMethodDeclaration(
 * 		node,
 * 		node.Modifiers(),
 * 		node.AsteriskToken,
 * 		ch.Visitor().VisitNode(node.Name()),
 * 		node.PostfixToken,
 * 		nil,
 * 		ch.Visitor().VisitNodes(node.Parameters),
 * 		nil,
 * 		nil,
 * 		ch.transformFunctionBody(node.AsNode()),
 * 	)
 * }
 */
export function objectRestSpreadTransformer_visitMethodDeclaration(receiver: GoPtr<objectRestSpreadTransformer>, node: GoPtr<MethodDeclaration>): GoPtr<Node> {
  const nodeAsNode = node as unknown as GoPtr<Node>;
  const old = objectRestSpreadTransformer_enterParameterListContext(receiver, nodeAsNode);
  try {
    const astFactory = Transformer_Factory(receiver!.__tsgoEmbedded0!)!.__tsgoEmbedded0!;
    const visitor = Transformer_Visitor(receiver!.__tsgoEmbedded0!) as ConcreteNodeVisitor;
    return NodeFactory_UpdateMethodDeclaration(
      astFactory,
      node,
      node!.modifiers,
      node!.AsteriskToken,
      NodeVisitor_VisitNode(visitor, Node_Name(nodeAsNode)) as unknown as GoPtr<never>,
      node!.PostfixToken,
      undefined,
      NodeVisitor_VisitNodes(visitor, node!.Parameters) as unknown as GoPtr<never>,
      undefined,
      undefined,
      objectRestSpreadTransformer_transformFunctionBody(receiver, nodeAsNode) as unknown as GoPtr<never>,
    );
  } finally {
    objectRestSpreadTransformer_exitParameterListContext(receiver, old);
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/objectrestspread.go::method::objectRestSpreadTransformer.visitFunctionDeclaration","kind":"method","status":"implemented","sigHash":"82b3b42b9979ce20cb9d3a254149e0679572768125cc728808cec910b32b182d","bodyHash":"0d97e3fb7a275f794e8acf55a6ddfd38bf65c94e5f989a00c6263ed0ef0215d1"}
 *
 * Go source:
 * func (ch *objectRestSpreadTransformer) visitFunctionDeclaration(node *ast.FunctionDeclaration) *ast.Node {
 * 	old := ch.enterParameterListContext(node.AsNode())
 * 	defer ch.exitParameterListContext(old)
 * 	return ch.Factory().UpdateFunctionDeclaration(
 * 		node,
 * 		node.Modifiers(),
 * 		node.AsteriskToken,
 * 		ch.Visitor().VisitNode(node.Name()),
 * 		nil,
 * 		ch.Visitor().VisitNodes(node.Parameters),
 * 		nil,
 * 		nil,
 * 		ch.transformFunctionBody(node.AsNode()),
 * 	)
 * }
 */
export function objectRestSpreadTransformer_visitFunctionDeclaration(receiver: GoPtr<objectRestSpreadTransformer>, node: GoPtr<FunctionDeclaration>): GoPtr<Node> {
  const nodeAsNode = node as unknown as GoPtr<Node>;
  const old = objectRestSpreadTransformer_enterParameterListContext(receiver, nodeAsNode);
  try {
    const astFactory = Transformer_Factory(receiver!.__tsgoEmbedded0!)!.__tsgoEmbedded0!;
    const visitor = Transformer_Visitor(receiver!.__tsgoEmbedded0!) as ConcreteNodeVisitor;
    return NodeFactory_UpdateFunctionDeclaration(
      astFactory,
      node,
      node!.modifiers,
      node!.AsteriskToken,
      NodeVisitor_VisitNode(visitor, Node_Name(nodeAsNode)) as unknown as GoPtr<never>,
      undefined,
      NodeVisitor_VisitNodes(visitor, node!.Parameters) as unknown as GoPtr<never>,
      undefined,
      undefined,
      objectRestSpreadTransformer_transformFunctionBody(receiver, nodeAsNode) as unknown as GoPtr<never>,
    );
  } finally {
    objectRestSpreadTransformer_exitParameterListContext(receiver, old);
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/objectrestspread.go::method::objectRestSpreadTransformer.visitArrowFunction","kind":"method","status":"implemented","sigHash":"f8b7ea736d398bedf6484bd5a9a495f0924f5a2dd55bb10bb792d3a426ca231f","bodyHash":"863a83e2f8b21cc9cdca8340d53a634e0257756d28431983f287c74378b5905c"}
 *
 * Go source:
 * func (ch *objectRestSpreadTransformer) visitArrowFunction(node *ast.ArrowFunction) *ast.Node {
 * 	old := ch.enterParameterListContext(node.AsNode())
 * 	defer ch.exitParameterListContext(old)
 * 	return ch.Factory().UpdateArrowFunction(
 * 		node,
 * 		node.Modifiers(),
 * 		nil,
 * 		ch.Visitor().VisitNodes(node.Parameters),
 * 		nil,
 * 		nil,
 * 		node.EqualsGreaterThanToken,
 * 		ch.transformFunctionBody(node.AsNode()),
 * 	)
 * }
 */
export function objectRestSpreadTransformer_visitArrowFunction(receiver: GoPtr<objectRestSpreadTransformer>, node: GoPtr<ArrowFunction>): GoPtr<Node> {
  const nodeAsNode = node as unknown as GoPtr<Node>;
  const old = objectRestSpreadTransformer_enterParameterListContext(receiver, nodeAsNode);
  try {
    const astFactory = Transformer_Factory(receiver!.__tsgoEmbedded0!)!.__tsgoEmbedded0!;
    const visitor = Transformer_Visitor(receiver!.__tsgoEmbedded0!) as ConcreteNodeVisitor;
    return NodeFactory_UpdateArrowFunction(
      astFactory,
      node,
      node!.modifiers,
      undefined,
      NodeVisitor_VisitNodes(visitor, node!.Parameters) as unknown as GoPtr<never>,
      undefined,
      undefined,
      node!.EqualsGreaterThanToken,
      objectRestSpreadTransformer_transformFunctionBody(receiver, nodeAsNode) as unknown as GoPtr<never>,
    );
  } finally {
    objectRestSpreadTransformer_exitParameterListContext(receiver, old);
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/objectrestspread.go::method::objectRestSpreadTransformer.visitFunctionExpression","kind":"method","status":"implemented","sigHash":"763aa3a367c0c047f961ea7426d986a9e720d9c4ab731631e22e3d92c7200ae1","bodyHash":"6bcb5ed375194154cd36cb26765b457f7394d52ca893b784b95fb938b82736bf"}
 *
 * Go source:
 * func (ch *objectRestSpreadTransformer) visitFunctionExpression(node *ast.FunctionExpression) *ast.Node {
 * 	old := ch.enterParameterListContext(node.AsNode())
 * 	defer ch.exitParameterListContext(old)
 * 	return ch.Factory().UpdateFunctionExpression(
 * 		node,
 * 		node.Modifiers(),
 * 		node.AsteriskToken,
 * 		ch.Visitor().VisitNode(node.Name()),
 * 		nil,
 * 		ch.Visitor().VisitNodes(node.Parameters),
 * 		nil,
 * 		nil,
 * 		ch.transformFunctionBody(node.AsNode()),
 * 	)
 * }
 */
export function objectRestSpreadTransformer_visitFunctionExpression(receiver: GoPtr<objectRestSpreadTransformer>, node: GoPtr<FunctionExpression>): GoPtr<Node> {
  const nodeAsNode = node as unknown as GoPtr<Node>;
  const old = objectRestSpreadTransformer_enterParameterListContext(receiver, nodeAsNode);
  try {
    const astFactory = Transformer_Factory(receiver!.__tsgoEmbedded0!)!.__tsgoEmbedded0!;
    const visitor = Transformer_Visitor(receiver!.__tsgoEmbedded0!) as ConcreteNodeVisitor;
    return NodeFactory_UpdateFunctionExpression(
      astFactory,
      node,
      node!.modifiers,
      node!.AsteriskToken,
      NodeVisitor_VisitNode(visitor, Node_Name(nodeAsNode)) as unknown as GoPtr<never>,
      undefined,
      NodeVisitor_VisitNodes(visitor, node!.Parameters) as unknown as GoPtr<never>,
      undefined,
      undefined,
      objectRestSpreadTransformer_transformFunctionBody(receiver, nodeAsNode) as unknown as GoPtr<never>,
    );
  } finally {
    objectRestSpreadTransformer_exitParameterListContext(receiver, old);
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/objectrestspread.go::method::objectRestSpreadTransformer.transformFunctionBody","kind":"method","status":"implemented","sigHash":"ab9b9ea6776df0ea9bf3bcdd7692ed3eee111bd2a6c5584d2ae123f37c42bdbc","bodyHash":"bf28ba28d153cfd38d0ec5e9cd7227a5b17f2c3e74e32d125166f749fed16830"}
 *
 * Go source:
 * func (ch *objectRestSpreadTransformer) transformFunctionBody(node *ast.Node) *ast.Node {
 * 	// EmitContext().VisitFunctionBody is not used here because this transformer needs to inject
 * 	// object rest assignments between visiting the body and merging the variable environment.
 * 	ch.EmitContext().StartVariableEnvironment()
 * 	body := ch.Visitor().VisitNode(node.Body())
 * 	extras := ch.EmitContext().EndVariableEnvironment()
 * 	ch.EmitContext().StartVariableEnvironment()
 * 	newStatements := ch.collectObjectRestAssignments(node)
 * 	extras = ch.EmitContext().EndAndMergeVariableEnvironment(extras)
 * 	if len(newStatements) == 0 && len(extras) == 0 {
 * 		return body
 * 	}
 *
 * 	if body == nil {
 * 		body = ch.Factory().NewBlock(ch.Factory().NewNodeList([]*ast.Node{}), true)
 * 	}
 * 	var prefix []*ast.Node
 * 	var suffix []*ast.Node
 * 	if ast.IsBlock(body) {
 * 		custom := false
 * 		for i, statement := range body.Statements() {
 * 			if !custom && ast.IsPrologueDirective(statement) {
 * 				prefix = append(prefix, statement)
 * 			} else if ch.EmitContext().EmitFlags(statement)&printer.EFCustomPrologue != 0 {
 * 				custom = true
 * 				prefix = append(prefix, statement)
 * 			} else {
 * 				suffix = body.Statements()[i:]
 * 				break
 * 			}
 * 		}
 * 	} else {
 * 		ret := ch.Factory().NewReturnStatement(body)
 * 		ret.Loc = body.Loc
 * 		list := ch.Factory().NewNodeList([]*ast.Node{})
 * 		list.Loc = body.Loc
 * 		body = ch.Factory().NewBlock(list, true)
 * 		suffix = append(suffix, ret)
 * 	}
 *
 * 	newStatementList := ch.Factory().NewNodeList(append(append(append(prefix, extras...), newStatements...), suffix...))
 * 	newStatementList.Loc = body.StatementList().Loc
 * 	return ch.Factory().UpdateBlock(body.AsBlock(), newStatementList, body.AsBlock().MultiLine)
 * }
 */
export function objectRestSpreadTransformer_transformFunctionBody(receiver: GoPtr<objectRestSpreadTransformer>, node: GoPtr<Node>): GoPtr<Node> {
  const emitContext = Transformer_EmitContext(receiver!.__tsgoEmbedded0!);
  const astFactory = Transformer_Factory(receiver!.__tsgoEmbedded0!)!.__tsgoEmbedded0!;
  const visitor = Transformer_Visitor(receiver!.__tsgoEmbedded0!) as ConcreteNodeVisitor;
  EmitContext_StartVariableEnvironment(emitContext);
  let body = NodeVisitor_VisitNode(visitor, Node_Body(node));
  let extras = EmitContext_EndVariableEnvironment(emitContext) as unknown as GoSlice<GoPtr<Node>>;
  EmitContext_StartVariableEnvironment(emitContext);
  const newStatements = objectRestSpreadTransformer_collectObjectRestAssignments(receiver, node);
  extras = EmitContext_EndAndMergeVariableEnvironment(emitContext, extras as unknown as GoPtr<never>[]) as unknown as GoSlice<GoPtr<Node>>;
  if (newStatements.length === 0 && extras.length === 0) {
    return body;
  }

  if (body === undefined) {
    body = NewBlock(astFactory, NodeFactory_NewNodeList(astFactory, []) as unknown as GoPtr<never>, true);
  }
  let prefix: GoSlice<GoPtr<Node>> = [];
  let suffix: GoSlice<GoPtr<Node>> = [];
  if (IsBlock(body)) {
    let custom = false;
    const bodyStmts = Node_Statements(body) ?? [];
    for (let i = 0; i < bodyStmts.length; i++) {
      const statement = bodyStmts[i];
      if (!custom && IsPrologueDirective(statement)) {
        prefix = [...prefix, statement];
      } else if ((EmitContext_EmitFlags(emitContext, statement) & EFCustomPrologue) !== 0) {
        custom = true;
        prefix = [...prefix, statement];
      } else {
        suffix = bodyStmts.slice(i);
        break;
      }
    }
  } else {
    const ret = NewReturnStatement(astFactory, body as unknown as GoPtr<never>);
    (ret as unknown as { Loc: TextRange })!.Loc = body!.Loc;
    const list = NodeFactory_NewNodeList(astFactory, []);
    list!.Loc = body!.Loc;
    body = NewBlock(astFactory, list as unknown as GoPtr<never>, true);
    suffix = [...suffix, ret];
  }

  const combined: GoSlice<GoPtr<Node>> = [...prefix, ...extras, ...newStatements, ...suffix];
  const newStatementList = NodeFactory_NewNodeList(astFactory, combined);
  newStatementList!.Loc = Node_StatementList(body)!.Loc;
  return NodeFactory_UpdateBlock(astFactory, AsBlock(body)!, newStatementList as unknown as GoPtr<never>, AsBlock(body)!.MultiLine);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/objectrestspread.go::method::objectRestSpreadTransformer.collectObjectRestAssignments","kind":"method","status":"implemented","sigHash":"9e4ffea39eea074002c804f032309dd9d292a08b5aa358b9c67ba292ddd5c2bb","bodyHash":"83ecc400e79a64bc8fbaa5538abcf6245ef579fb62c4d4a0d310a435316337e4"}
 *
 * Go source:
 * func (ch *objectRestSpreadTransformer) collectObjectRestAssignments(node *ast.Node) []*ast.Node {
 * 	containsPrecedingObjectRestOrSpread := false
 * 	var results []*ast.Node
 * 	for _, parameter := range node.Parameters() {
 * 		if containsPrecedingObjectRestOrSpread {
 * 			if ast.IsBindingPattern(parameter.Name()) {
 * 				if len(parameter.Name().Elements()) > 0 {
 * 					declarations := transformers.FlattenDestructuringBinding(
 * 						&ch.Transformer,
 * 						parameter, ch.Factory().NewGeneratedNameForNode(parameter),
 * 						transformers.FlattenLevelAll, false, false,
 * 					)
 * 					if declarations != nil {
 * 						declarationList := ch.Factory().NewVariableDeclarationList(ch.Factory().NewNodeList([]*ast.Node{}), ast.NodeFlagsNone)
 * 						decls := []*ast.Node{declarations}
 * 						if declarations.Kind == ast.KindSyntaxList {
 * 							decls = declarations.AsSyntaxList().Children
 * 						}
 * 						declarationList.AsVariableDeclarationList().Declarations.Nodes = append(declarationList.AsVariableDeclarationList().Declarations.Nodes, decls...)
 * 						statement := ch.Factory().NewVariableStatement(nil, declarationList)
 * 						ch.EmitContext().AddEmitFlags(statement, printer.EFCustomPrologue)
 * 						results = append(results, statement)
 * 					}
 * 				} else if parameter.Initializer() != nil {
 * 					name := ch.Factory().NewGeneratedNameForNode(parameter)
 * 					initializer := ch.Visitor().VisitNode(parameter.Initializer())
 * 					assignment := ch.Factory().NewAssignmentExpression(name, initializer)
 * 					statement := ch.Factory().NewExpressionStatement(assignment)
 * 					ch.EmitContext().AddEmitFlags(statement, printer.EFCustomPrologue)
 * 					results = append(results, statement)
 * 				}
 * 			} else if parameter.Initializer() != nil {
 * 				name := parameter.Name().Clone(ch.Factory())
 * 				name.Loc = parameter.Name().Loc
 * 				ch.EmitContext().AddEmitFlags(name, printer.EFNoSourceMap)
 * 				initializer := ch.Visitor().VisitNode(parameter.Initializer())
 * 				ch.EmitContext().AddEmitFlags(initializer, printer.EFNoSourceMap|printer.EFNoComments)
 * 				assignment := ch.Factory().NewAssignmentExpression(name, initializer)
 * 				assignment.Loc = parameter.Loc
 * 				ch.EmitContext().AddEmitFlags(assignment, printer.EFNoComments)
 * 				block := ch.Factory().NewBlock(ch.Factory().NewNodeList([]*ast.Node{ch.Factory().NewExpressionStatement(assignment)}), false)
 * 				block.Loc = parameter.Loc
 * 				ch.EmitContext().AddEmitFlags(block, printer.EFSingleLine|printer.EFNoTrailingSourceMap|printer.EFNoTokenSourceMaps|printer.EFNoComments)
 * 				typeCheck := ch.Factory().NewTypeCheck(name.Clone(ch.Factory()), "undefined")
 * 				statement := ch.Factory().NewIfStatement(typeCheck, block, nil)
 * 				statement.Loc = parameter.Loc
 * 				ch.EmitContext().AddEmitFlags(statement, printer.EFNoTokenSourceMaps|printer.EFNoTrailingSourceMap|printer.EFCustomPrologue|printer.EFNoComments|printer.EFStartOnNewLine)
 * 				results = append(results, statement)
 * 			}
 * 		} else if parameter.SubtreeFacts()&ast.SubtreeContainsObjectRestOrSpread != 0 {
 * 			containsPrecedingObjectRestOrSpread = true
 * 			declarations := transformers.FlattenDestructuringBinding(
 * 				&ch.Transformer,
 * 				parameter, ch.Factory().NewGeneratedNameForNode(parameter),
 * 				transformers.FlattenLevelObjectRest, false, true,
 * 			)
 * 			if declarations != nil {
 * 				declarationList := ch.Factory().NewVariableDeclarationList(ch.Factory().NewNodeList([]*ast.Node{}), ast.NodeFlagsNone)
 * 				decls := []*ast.Node{declarations}
 * 				if declarations.Kind == ast.KindSyntaxList {
 * 					decls = declarations.AsSyntaxList().Children
 * 				}
 * 				declarationList.AsVariableDeclarationList().Declarations.Nodes = append(declarationList.AsVariableDeclarationList().Declarations.Nodes, decls...)
 * 				statement := ch.Factory().NewVariableStatement(nil, declarationList)
 * 				ch.EmitContext().AddEmitFlags(statement, printer.EFCustomPrologue)
 * 				results = append(results, statement)
 * 			}
 * 		}
 * 	}
 *
 * 	return results
 * }
 */
export function objectRestSpreadTransformer_collectObjectRestAssignments(receiver: GoPtr<objectRestSpreadTransformer>, node: GoPtr<Node>): GoSlice<GoPtr<Node>> {
  const printerFactory = Transformer_Factory(receiver!.__tsgoEmbedded0!);
  const astFactory = printerFactory!.__tsgoEmbedded0!;
  const emitContext = Transformer_EmitContext(receiver!.__tsgoEmbedded0!);
  const visitor = Transformer_Visitor(receiver!.__tsgoEmbedded0!) as ConcreteNodeVisitor;
  let containsPrecedingObjectRestOrSpread = false;
  let results: GoSlice<GoPtr<Node>> = [];
  for (const parameter of Node_Parameters(node) ?? []) {
    const paramNode = parameter as unknown as GoPtr<Node>;
    if (containsPrecedingObjectRestOrSpread) {
      const paramNameNode = Node_Name(paramNode) as unknown as GoPtr<Node>;
      if (IsBindingPattern(paramNameNode)) {
        const elements = (paramNameNode as unknown as { data: { Elements?: GoSlice<GoPtr<Node>> } })!.data?.Elements ?? [];
        if (elements.length > 0) {
          const declarations = FlattenDestructuringBinding(
            receiver!.__tsgoEmbedded0!,
            paramNode, NodeFactory_NewGeneratedNameForNode(printerFactory, paramNode),
            FlattenLevelAll, false, false,
          );
          if (declarations !== undefined) {
            const declarationList = NewVariableDeclarationList(astFactory, NodeFactory_NewNodeList(astFactory, []) as unknown as GoPtr<never>, NodeFlagsNone);
            let decls: GoSlice<GoPtr<Node>> = [declarations];
            if (declarations!.Kind === KindSyntaxList) {
              decls = AsSyntaxList(declarations)!.Children as unknown as GoSlice<GoPtr<Node>>;
            }
            const dl = AsVariableDeclarationList(declarationList)!;
            dl.Declarations!.Nodes = [...(dl.Declarations!.Nodes ?? []), ...decls] as GoSlice<GoPtr<Node>>;
            const statement = NewVariableStatement(astFactory, undefined, declarationList as unknown as GoPtr<never>);
            EmitContext_AddEmitFlags(emitContext, statement, EFCustomPrologue);
            results = [...results, statement];
          }
        } else if (Node_Initializer(paramNode) !== undefined) {
          const name = NodeFactory_NewGeneratedNameForNode(printerFactory, paramNode);
          const initializer = NodeVisitor_VisitNode(visitor, Node_Initializer(paramNode));
          const assignment = NodeFactory_NewAssignmentExpression(printerFactory, name as unknown as GoPtr<never>, initializer as unknown as GoPtr<never>);
          const statement = NewExpressionStatement(astFactory, assignment as unknown as GoPtr<never>);
          EmitContext_AddEmitFlags(emitContext, statement, EFCustomPrologue);
          results = [...results, statement];
        }
      } else if (Node_Initializer(paramNode) !== undefined) {
        const cloneCoercible = { AsNodeFactory: () => astFactory };
        const name = Node_Clone(paramNameNode, cloneCoercible);
        (name as unknown as { Loc: TextRange })!.Loc = (paramNameNode as unknown as { Loc: TextRange })!.Loc;
        EmitContext_AddEmitFlags(emitContext, name, EFNoSourceMap);

        const initializer = NodeVisitor_VisitNode(visitor, Node_Initializer(paramNode));
        EmitContext_AddEmitFlags(emitContext, initializer, EFNoSourceMap | EFNoComments);

        const assignment = NodeFactory_NewAssignmentExpression(printerFactory, name as unknown as GoPtr<never>, initializer as unknown as GoPtr<never>);
        (assignment as unknown as { Loc: TextRange })!.Loc = paramNode!.Loc;
        EmitContext_AddEmitFlags(emitContext, assignment, EFNoComments);

        const block = NewBlock(astFactory, NodeFactory_NewNodeList(astFactory, [NewExpressionStatement(astFactory, assignment as unknown as GoPtr<never>)]) as unknown as GoPtr<never>, false);
        (block as unknown as { Loc: TextRange })!.Loc = paramNode!.Loc;
        EmitContext_AddEmitFlags(emitContext, block, EFSingleLine | EFNoTrailingSourceMap | EFNoTokenSourceMaps | EFNoComments);

        const typeCheck = NodeFactory_NewTypeCheck(printerFactory, Node_Clone(name, cloneCoercible), "undefined");
        const statement = NewIfStatement(astFactory, typeCheck as unknown as GoPtr<never>, block as unknown as GoPtr<never>, undefined);
        (statement as unknown as { Loc: TextRange })!.Loc = paramNode!.Loc;
        EmitContext_AddEmitFlags(emitContext, statement, EFNoTokenSourceMaps | EFNoTrailingSourceMap | EFCustomPrologue | EFNoComments | EFStartOnNewLine);
        results = [...results, statement];
      }
    } else if ((Node_SubtreeFacts(paramNode) & SubtreeContainsObjectRestOrSpread) !== 0) {
      containsPrecedingObjectRestOrSpread = true;
      const declarations = FlattenDestructuringBinding(
        receiver!.__tsgoEmbedded0!,
        paramNode, NodeFactory_NewGeneratedNameForNode(printerFactory, paramNode),
        FlattenLevelObjectRest, false, true,
      );
      if (declarations !== undefined) {
        const declarationList = NewVariableDeclarationList(astFactory, NodeFactory_NewNodeList(astFactory, []) as unknown as GoPtr<never>, NodeFlagsNone);
        let decls: GoSlice<GoPtr<Node>> = [declarations];
        if (declarations!.Kind === KindSyntaxList) {
          decls = AsSyntaxList(declarations)!.Children as unknown as GoSlice<GoPtr<Node>>;
        }
        const dl = AsVariableDeclarationList(declarationList)!;
        dl.Declarations!.Nodes = [...(dl.Declarations!.Nodes ?? []), ...decls] as GoSlice<GoPtr<Node>>;
        const statement = NewVariableStatement(astFactory, undefined, declarationList as unknown as GoPtr<never>);
        EmitContext_AddEmitFlags(emitContext, statement, EFCustomPrologue);
        results = [...results, statement];
      }
    }
  }

  return results;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/objectrestspread.go::method::objectRestSpreadTransformer.visitCatchClause","kind":"method","status":"implemented","sigHash":"ca6e5c954dc01197dade0bedc2ba2d2e351adc50747fc04f3fc23d0660176052","bodyHash":"4056810b64edbd8037f8b3b09c23beab7004aab801be350283da5e0d0282943f"}
 *
 * Go source:
 * func (ch *objectRestSpreadTransformer) visitCatchClause(node *ast.CatchClause) *ast.Node {
 * 	if node.VariableDeclaration != nil && ast.IsBindingPattern(node.VariableDeclaration.Name()) && node.VariableDeclaration.Name().SubtreeFacts()&ast.SubtreeContainsObjectRestOrSpread != 0 {
 * 		name := ch.Factory().NewGeneratedNameForNode(node.VariableDeclaration.Name())
 * 		updatedDecl := ch.Factory().UpdateVariableDeclaration(node.VariableDeclaration.AsVariableDeclaration(), node.VariableDeclaration.Name(), nil, nil, name)
 * 		visitedBindings := transformers.FlattenDestructuringBinding(
 * 			&ch.Transformer,
 * 			updatedDecl, nil,
 * 			transformers.FlattenLevelObjectRest, false, false,
 * 		)
 * 		block := ch.Visitor().VisitNode(node.Block)
 * 		if visitedBindings != nil {
 * 			var decls []*ast.Node
 * 			if visitedBindings.Kind == ast.KindSyntaxList {
 * 				decls = visitedBindings.AsSyntaxList().Children
 * 			} else {
 * 				decls = []*ast.Node{visitedBindings}
 * 			}
 * 			newStatement := ch.Factory().NewVariableStatement(nil, ch.Factory().NewVariableDeclarationList(ch.Factory().NewNodeList(decls), ast.NodeFlagsNone))
 * 			statements := []*ast.Node{newStatement}
 * 			statements = append(statements, block.Statements()...)
 * 			statementList := ch.Factory().NewNodeList(statements)
 * 			statementList.Loc = block.StatementList().Loc
 *
 * 			block = ch.Factory().UpdateBlock(block.AsBlock(), statementList, block.AsBlock().MultiLine)
 * 		}
 * 		return ch.Factory().UpdateCatchClause(
 * 			node,
 * 			ch.Factory().UpdateVariableDeclaration(node.VariableDeclaration.AsVariableDeclaration(), name, nil, nil, nil),
 * 			block,
 * 		)
 * 	}
 * 	return ch.Visitor().VisitEachChild(node.AsNode())
 * }
 */
export function objectRestSpreadTransformer_visitCatchClause(receiver: GoPtr<objectRestSpreadTransformer>, node: GoPtr<CatchClause>): GoPtr<Node> {
  const printerFactory = Transformer_Factory(receiver!.__tsgoEmbedded0!);
  const astFactory = printerFactory!.__tsgoEmbedded0!;
  const visitor = Transformer_Visitor(receiver!.__tsgoEmbedded0!) as ConcreteNodeVisitor;
  const nodeAsNode = node as unknown as GoPtr<Node>;
  const varDecl = node!.VariableDeclaration;
  if (varDecl !== undefined) {
    const varDeclNode = varDecl as unknown as GoPtr<Node>;
    const varDeclNameNode = Node_Name(varDeclNode) as unknown as GoPtr<Node>;
    if (IsBindingPattern(varDeclNameNode) && (Node_SubtreeFacts(varDeclNameNode) & SubtreeContainsObjectRestOrSpread) !== 0) {
      const name = NodeFactory_NewGeneratedNameForNode(printerFactory, varDeclNameNode);
      const updatedDecl = NodeFactory_UpdateVariableDeclaration(astFactory, AsVariableDeclaration(varDeclNode)!, varDeclNameNode as unknown as GoPtr<never>, undefined, undefined, name as unknown as GoPtr<never>);
      const visitedBindings = FlattenDestructuringBinding(
        receiver!.__tsgoEmbedded0!,
        updatedDecl, undefined,
        FlattenLevelObjectRest, false, false,
      );
      let block = NodeVisitor_VisitNode(visitor, node!.Block as unknown as GoPtr<Node>);
      if (visitedBindings !== undefined) {
        let decls: GoSlice<GoPtr<Node>>;
        if (visitedBindings!.Kind === KindSyntaxList) {
          decls = AsSyntaxList(visitedBindings)!.Children as unknown as GoSlice<GoPtr<Node>>;
        } else {
          decls = [visitedBindings];
        }
        const newStatement = NewVariableStatement(astFactory, undefined, NewVariableDeclarationList(astFactory, NodeFactory_NewNodeList(astFactory, decls) as unknown as GoPtr<never>, NodeFlagsNone) as unknown as GoPtr<never>);
        const statements: GoSlice<GoPtr<Node>> = [newStatement, ...(Node_Statements(block) ?? [])];
        const statementList = NodeFactory_NewNodeList(astFactory, statements);
        statementList!.Loc = Node_StatementList(block)!.Loc;
        block = NodeFactory_UpdateBlock(astFactory, AsBlock(block)!, statementList as unknown as GoPtr<never>, AsBlock(block)!.MultiLine);
      }
      return NodeFactory_UpdateCatchClause(
        astFactory,
        node,
        NodeFactory_UpdateVariableDeclaration(astFactory, AsVariableDeclaration(varDeclNode)!, name as unknown as GoPtr<never>, undefined, undefined, undefined) as unknown as GoPtr<never>,
        block as unknown as GoPtr<never>,
      );
    }
  }
  return NodeVisitor_VisitEachChild(visitor, nodeAsNode);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/objectrestspread.go::method::objectRestSpreadTransformer.visitVariableStatement","kind":"method","status":"implemented","sigHash":"7cf9fdd623d1ea37267cd890e9281ac9b65ef922e9636879be1e463c37f65b67","bodyHash":"3f2870d86ff820bb7d639847ab030f19d231dec3bfa5b065ba4a604edd784c61"}
 *
 * Go source:
 * func (ch *objectRestSpreadTransformer) visitVariableStatement(node *ast.VariableStatement) *ast.Node {
 * 	if ast.HasSyntacticModifier(node.AsNode(), ast.ModifierFlagsExport) {
 * 		oldInExportedVariableStatement := ch.inExportedVariableStatement
 * 		ch.inExportedVariableStatement = true
 * 		result := ch.Visitor().VisitEachChild(node.AsNode())
 * 		ch.inExportedVariableStatement = oldInExportedVariableStatement
 * 		return result
 * 	}
 * 	return ch.Visitor().VisitEachChild(node.AsNode())
 * }
 */
export function objectRestSpreadTransformer_visitVariableStatement(receiver: GoPtr<objectRestSpreadTransformer>, node: GoPtr<VariableStatement>): GoPtr<Node> {
  const visitor = Transformer_Visitor(receiver!.__tsgoEmbedded0!) as ConcreteNodeVisitor;
  const nodeAsNode = node as unknown as GoPtr<Node>;
  if (HasSyntacticModifier(nodeAsNode, ModifierFlagsExport)) {
    const oldInExportedVariableStatement = receiver!.inExportedVariableStatement;
    receiver!.inExportedVariableStatement = true;
    const result = NodeVisitor_VisitEachChild(visitor, nodeAsNode);
    receiver!.inExportedVariableStatement = oldInExportedVariableStatement;
    return result;
  }
  return NodeVisitor_VisitEachChild(visitor, nodeAsNode);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/objectrestspread.go::method::objectRestSpreadTransformer.visitVariableDeclaration","kind":"method","status":"implemented","sigHash":"0db5ef4f2568297df820428878da79df030d75764170607b5c2fb6a320c8759c","bodyHash":"48145c138c2e242c61678188b8f77c5347b342cfaf818e3021b6303c8e7d9a50"}
 *
 * Go source:
 * func (ch *objectRestSpreadTransformer) visitVariableDeclaration(node *ast.VariableDeclaration) *ast.Node {
 * 	if ch.inExportedVariableStatement {
 * 		ch.inExportedVariableStatement = false
 * 		result := ch.visitVariableDeclarationWorker(node, true)
 * 		ch.inExportedVariableStatement = true
 * 		return result
 * 	}
 * 	return ch.visitVariableDeclarationWorker(node, false)
 * }
 */
export function objectRestSpreadTransformer_visitVariableDeclaration(receiver: GoPtr<objectRestSpreadTransformer>, node: GoPtr<VariableDeclaration>): GoPtr<Node> {
  if (receiver!.inExportedVariableStatement) {
    receiver!.inExportedVariableStatement = false;
    const result = objectRestSpreadTransformer_visitVariableDeclarationWorker(receiver, node, true);
    receiver!.inExportedVariableStatement = true;
    return result;
  }
  return objectRestSpreadTransformer_visitVariableDeclarationWorker(receiver, node, false);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/objectrestspread.go::method::objectRestSpreadTransformer.visitVariableDeclarationWorker","kind":"method","status":"implemented","sigHash":"db4d0812e0611b36ffb235095141916ce1a9e1428a402626e955b2af994faf12","bodyHash":"3bf323b8e1130c9ca6cef8f3558216a1b95c2323f26267e44dd821aafe2c82ec"}
 *
 * Go source:
 * func (ch *objectRestSpreadTransformer) visitVariableDeclarationWorker(node *ast.VariableDeclaration, exported bool) *ast.Node {
 * 	// If we are here it is because the name contains a binding pattern with a rest somewhere in it.
 * 	if ast.IsBindingPattern(node.Name()) && node.SubtreeFacts()&ast.SubtreeContainsObjectRestOrSpread != 0 {
 * 		return transformers.FlattenDestructuringBinding(
 * 			&ch.Transformer,
 * 			node.AsNode(), nil,
 * 			transformers.FlattenLevelObjectRest, exported, false,
 * 		)
 * 	}
 * 	return ch.Visitor().VisitEachChild(node.AsNode())
 * }
 */
export function objectRestSpreadTransformer_visitVariableDeclarationWorker(receiver: GoPtr<objectRestSpreadTransformer>, node: GoPtr<VariableDeclaration>, exported: bool): GoPtr<Node> {
  const visitor = Transformer_Visitor(receiver!.__tsgoEmbedded0!) as ConcreteNodeVisitor;
  const nodeAsNode = node as unknown as GoPtr<Node>;
  if (IsBindingPattern(Node_Name(nodeAsNode) as unknown as GoPtr<Node>) && (Node_SubtreeFacts(nodeAsNode) & SubtreeContainsObjectRestOrSpread) !== 0) {
    return FlattenDestructuringBinding(
      receiver!.__tsgoEmbedded0!,
      nodeAsNode, undefined,
      FlattenLevelObjectRest, exported, false,
    );
  }
  return NodeVisitor_VisitEachChild(visitor, nodeAsNode);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/objectrestspread.go::method::objectRestSpreadTransformer.visitForOftatement","kind":"method","status":"implemented","sigHash":"c50ad20482775ec52fe48e5dda365d7603c2c2b74e1c3a239ea13b3821ca8b8b","bodyHash":"7c3661e094ca2f9316500f8736c81de0a214a57780c1e8cea8cba57a3544ec79"}
 *
 * Go source:
 * func (ch *objectRestSpreadTransformer) visitForOftatement(node *ast.ForInOrOfStatement) *ast.Node {
 * 	if node.Initializer.SubtreeFacts()&ast.SubtreeContainsObjectRestOrSpread != 0 || (ast.IsAssignmentPattern(node.Initializer) && ast.ContainsObjectRestOrSpread(node.Initializer)) {
 * 		initializerWithoutParens := ast.SkipParentheses(node.Initializer)
 * 		if ast.IsVariableDeclarationList(initializerWithoutParens) || ast.IsAssignmentPattern(initializerWithoutParens) {
 * 			var bodyLocation core.TextRange
 * 			var statementsLocation core.TextRange
 * 			temp := ch.Factory().NewTempVariable()
 * 			res := ch.Visitor().VisitNode(ch.Factory().CreateForOfBindingStatement(initializerWithoutParens, temp))
 * 			statements := make([]*ast.Node, 0, 1)
 * 			if res != nil {
 * 				statements = append(statements, res)
 * 			}
 * 			if ast.IsBlock(node.Statement) {
 * 				for _, statement := range node.Statement.Statements() {
 * 					visited := ch.Visitor().VisitEachChild(statement)
 * 					if visited != nil {
 * 						statements = append(statements, visited)
 * 					}
 * 				}
 * 				bodyLocation = node.Statement.Loc
 * 				statementsLocation = node.Statement.StatementList().Loc
 * 			} else if node.Statement != nil {
 * 				statements = append(statements, ch.Visitor().VisitEachChild(node.Statement))
 * 				bodyLocation = node.Statement.Loc
 * 				statementsLocation = node.Statement.Loc
 * 			}
 *
 * 			list := ch.Factory().NewVariableDeclarationList(
 * 				ch.Factory().NewNodeList([]*ast.Node{ch.Factory().NewVariableDeclaration(temp, nil, nil, nil)}),
 * 				ast.NodeFlagsLet,
 * 			)
 * 			list.Loc = node.Initializer.Loc
 *
 * 			expr := ch.Visitor().VisitEachChild(node.Expression)
 *
 * 			statementsList := ch.Factory().NewNodeList(statements)
 * 			statementsList.Loc = statementsLocation
 *
 * 			block := ch.Factory().NewBlock(statementsList, true)
 * 			block.Loc = bodyLocation
 *
 * 			return ch.Factory().UpdateForInOrOfStatement(
 * 				node,
 * 				node.AwaitModifier,
 * 				list,
 * 				expr,
 * 				block,
 * 			)
 * 		}
 * 	}
 * 	return ch.Visitor().VisitEachChild(node.AsNode())
 * }
 */
export function objectRestSpreadTransformer_visitForOftatement(receiver: GoPtr<objectRestSpreadTransformer>, node: GoPtr<ForInOrOfStatement>): GoPtr<Node> {
  const printerFactory = Transformer_Factory(receiver!.__tsgoEmbedded0!);
  const astFactory = printerFactory!.__tsgoEmbedded0!;
  const visitor = Transformer_Visitor(receiver!.__tsgoEmbedded0!) as ConcreteNodeVisitor;
  const nodeAsNode = node as unknown as GoPtr<Node>;
  const initializer = node!.Initializer as unknown as GoPtr<Node>;
  if ((Node_SubtreeFacts(initializer) & SubtreeContainsObjectRestOrSpread) !== 0 || (IsAssignmentPattern(initializer) && ContainsObjectRestOrSpread(initializer))) {
    const initializerWithoutParens = SkipParentheses(initializer as unknown as GoPtr<never>) as unknown as GoPtr<Node>;
    if (IsVariableDeclarationList(initializerWithoutParens) || IsAssignmentPattern(initializerWithoutParens)) {
      let bodyLoc = nodeAsNode!.Loc;
      let statementsLoc = nodeAsNode!.Loc;
      const temp = NodeFactory_NewTempVariable(printerFactory);
      const bindingStmt = NodeFactory_CreateForOfBindingStatement(printerFactory, initializerWithoutParens, temp as unknown as GoPtr<Node>);
      const res = NodeVisitor_VisitNode(visitor, bindingStmt);
      let statements: GoSlice<GoPtr<Node>> = [];
      if (res !== undefined) {
        statements = [...statements, res];
      }
      const stmtNode = node!.Statement as unknown as GoPtr<Node>;
      if (IsBlock(stmtNode)) {
        for (const statement of Node_Statements(stmtNode) ?? []) {
          const visited = NodeVisitor_VisitEachChild(visitor, statement);
          if (visited !== undefined) {
            statements = [...statements, visited];
          }
        }
        bodyLoc = stmtNode!.Loc;
        statementsLoc = Node_StatementList(stmtNode)!.Loc;
      } else if (stmtNode !== undefined) {
        statements = [...statements, NodeVisitor_VisitEachChild(visitor, stmtNode)!];
        bodyLoc = stmtNode!.Loc;
        statementsLoc = stmtNode!.Loc;
      }

      const list = NewVariableDeclarationList(
        astFactory,
        NodeFactory_NewNodeList(astFactory, [NewVariableDeclaration(astFactory, temp as unknown as GoPtr<never>, undefined, undefined, undefined)]) as unknown as GoPtr<never>,
        NodeFlagsLet,
      );
      (list as unknown as { Loc: TextRange })!.Loc = initializer!.Loc;

      const expr = NodeVisitor_VisitEachChild(visitor, node!.Expression as unknown as GoPtr<Node>);

      const statementsList = NodeFactory_NewNodeList(astFactory, statements);
      statementsList!.Loc = statementsLoc;

      const block = NewBlock(astFactory, statementsList as unknown as GoPtr<never>, true);
      (block as unknown as { Loc: TextRange })!.Loc = bodyLoc;

      return NodeFactory_UpdateForInOrOfStatement(
        astFactory,
        node,
        node!.AwaitModifier,
        list as unknown as GoPtr<never>,
        expr as unknown as GoPtr<never>,
        block as unknown as GoPtr<never>,
      );
    }
  }
  return NodeVisitor_VisitEachChild(visitor, nodeAsNode);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/objectrestspread.go::method::objectRestSpreadTransformer.visitBinaryExpression","kind":"method","status":"implemented","sigHash":"6cab8a634a14955cce5cc80c003b4069ed2295ef1b505c343e3e2e470b728c99","bodyHash":"2196d06c57a84e7ac934e7eac62e93350317949a0ff61bd5043f7fdf30cf56cc"}
 *
 * Go source:
 * func (ch *objectRestSpreadTransformer) visitBinaryExpression(node *ast.BinaryExpression, expressionResultIsUnused bool) *ast.Node {
 * 	if ast.IsDestructuringAssignment(node.AsNode()) && ast.ContainsObjectRestOrSpread(node.Left) {
 * 		return transformers.FlattenDestructuringAssignment(
 * 			&ch.Transformer,
 * 			node.AsNode(), !expressionResultIsUnused,
 * 			transformers.FlattenLevelObjectRest, nil,
 * 		)
 * 	}
 * 	if node.OperatorToken.Kind == ast.KindCommaToken {
 * 		ch.expressionResultIsUnused = true
 * 		left := ch.Visitor().VisitNode(node.Left)
 * 		ch.expressionResultIsUnused = expressionResultIsUnused
 * 		right := ch.Visitor().VisitNode(node.Right)
 * 		return ch.Factory().UpdateBinaryExpression(node, nil, left, nil, node.OperatorToken, right)
 * 	}
 * 	return ch.Visitor().VisitEachChild(node.AsNode())
 * }
 */
export function objectRestSpreadTransformer_visitBinaryExpression(receiver: GoPtr<objectRestSpreadTransformer>, node: GoPtr<BinaryExpression>, expressionResultIsUnused: bool): GoPtr<Node> {
  const astFactory = Transformer_Factory(receiver!.__tsgoEmbedded0!)!.__tsgoEmbedded0!;
  const visitor = Transformer_Visitor(receiver!.__tsgoEmbedded0!) as ConcreteNodeVisitor;
  const nodeAsNode = node as unknown as GoPtr<Node>;
  if (IsDestructuringAssignment(nodeAsNode) && ContainsObjectRestOrSpread(node!.Left as unknown as GoPtr<Node>)) {
    return FlattenDestructuringAssignment(
      receiver!.__tsgoEmbedded0!,
      nodeAsNode, !expressionResultIsUnused,
      FlattenLevelObjectRest, undefined as unknown as CreateAssignmentCallback,
    ) as unknown as GoPtr<Node>;
  }
  if (node!.OperatorToken!.Kind === KindCommaToken) {
    receiver!.expressionResultIsUnused = true;
    const left = NodeVisitor_VisitNode(visitor, node!.Left as unknown as GoPtr<Node>);
    receiver!.expressionResultIsUnused = expressionResultIsUnused;
    const right = NodeVisitor_VisitNode(visitor, node!.Right as unknown as GoPtr<Node>);
    return NodeFactory_UpdateBinaryExpression(astFactory, node, undefined, left as unknown as GoPtr<never>, undefined, node!.OperatorToken, right as unknown as GoPtr<never>);
  }
  return NodeVisitor_VisitEachChild(visitor, nodeAsNode);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/objectrestspread.go::method::objectRestSpreadTransformer.visitObjectLiteralExpression","kind":"method","status":"implemented","sigHash":"c2d165e0069df8f5ad6a97f342cd59c2cfe2b41240b5f19417fc00b95f900cb4","bodyHash":"791c1b4c71e8dfafe15599cb4d5f55d2d21186ca6131da06a2ffa58998586828"}
 *
 * Go source:
 * func (ch *objectRestSpreadTransformer) visitObjectLiteralExpression(node *ast.ObjectLiteralExpression) *ast.Node {
 * 	if (node.SubtreeFacts() & ast.SubtreeContainsObjectRestOrSpread) == 0 {
 * 		return ch.Visitor().VisitEachChild(node.AsNode())
 * 	}
 * 	objects := ch.chunkObjectLiteralElements(node.Properties)
 * 	if len(objects) > 0 && objects[0].Kind != ast.KindObjectLiteralExpression {
 * 		objects = append([]*ast.Node{ch.Factory().NewObjectLiteralExpression(ch.Factory().NewNodeList(nil), false)}, objects...)
 * 	}
 * 	expression := objects[0]
 * 	if len(objects) > 1 {
 * 		for i, obj := range objects {
 * 			if i == 0 {
 * 				continue
 * 			}
 * 			expression = ch.Factory().NewAssignHelper([]*ast.Node{expression, obj}, ch.compilerOptions.GetEmitScriptTarget())
 * 		}
 * 		return expression
 * 	}
 * 	return ch.Factory().NewAssignHelper(objects, ch.compilerOptions.GetEmitScriptTarget())
 * }
 */
export function objectRestSpreadTransformer_visitObjectLiteralExpression(receiver: GoPtr<objectRestSpreadTransformer>, node: GoPtr<ObjectLiteralExpression>): GoPtr<Node> {
  const printerFactory = Transformer_Factory(receiver!.__tsgoEmbedded0!);
  const astFactory = printerFactory!.__tsgoEmbedded0!;
  const visitor = Transformer_Visitor(receiver!.__tsgoEmbedded0!) as ConcreteNodeVisitor;
  const nodeAsNode = node as unknown as GoPtr<Node>;
  if ((Node_SubtreeFacts(nodeAsNode) & SubtreeContainsObjectRestOrSpread) === 0) {
    return NodeVisitor_VisitEachChild(visitor, nodeAsNode);
  }
  let objects = objectRestSpreadTransformer_chunkObjectLiteralElements(receiver, node!.Properties);
  if (objects.length > 0 && objects[0]!.Kind !== KindObjectLiteralExpression) {
    objects = [NewObjectLiteralExpression(astFactory, NodeFactory_NewNodeList(astFactory, undefined as unknown as GoSlice<GoPtr<Node>>) as unknown as GoPtr<never>, false), ...objects];
  }
  let expression = objects[0];
  if (objects.length > 1) {
    for (let i = 0; i < objects.length; i++) {
      if (i === 0) {
        continue;
      }
      expression = NodeFactory_NewAssignHelper(printerFactory, [expression, objects[i]] as unknown as GoPtr<never>[], CompilerOptions_GetEmitScriptTarget(receiver!.compilerOptions)) as unknown as GoPtr<Node>;
    }
    return expression;
  }
  return NodeFactory_NewAssignHelper(printerFactory, objects as unknown as GoPtr<never>[], CompilerOptions_GetEmitScriptTarget(receiver!.compilerOptions)) as unknown as GoPtr<Node>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/objectrestspread.go::method::objectRestSpreadTransformer.chunkObjectLiteralElements","kind":"method","status":"implemented","sigHash":"14947bb2a31c8a38f4300a21a1c3a1f0ea3020abd7777fedf62f5fd1ac71bea3","bodyHash":"007ca13a18f7c34c16fc53d60005ac97a4252d9476d6e8f475cbfca2e0a43538"}
 *
 * Go source:
 * func (ch *objectRestSpreadTransformer) chunkObjectLiteralElements(list *ast.NodeList) []*ast.Node {
 * 	if list == nil || len(list.Nodes) == 0 {
 * 		return nil
 * 	}
 * 	elements := list.Nodes
 * 	var chunkObject []*ast.Node
 * 	objects := make([]*ast.Node, 0, 1)
 * 	for _, e := range elements {
 * 		if e.Kind == ast.KindSpreadAssignment {
 * 			if len(chunkObject) > 0 {
 * 				objects = append(objects, ch.Factory().NewObjectLiteralExpression(ch.Factory().NewNodeList(chunkObject), false))
 * 				chunkObject = nil
 * 			}
 * 			target := e.Expression()
 * 			objects = append(objects, ch.Visitor().VisitNode(target))
 * 		} else {
 * 			var elem *ast.Node
 * 			if e.Kind == ast.KindPropertyAssignment {
 * 				elem = ch.Factory().NewPropertyAssignment(nil, e.Name(), nil, nil, ch.Visitor().VisitNode(e.Initializer()))
 * 			} else {
 * 				elem = ch.Visitor().VisitNode(e)
 * 			}
 * 			chunkObject = append(chunkObject, elem)
 * 		}
 * 	}
 * 	if len(chunkObject) > 0 {
 * 		objects = append(objects, ch.Factory().NewObjectLiteralExpression(ch.Factory().NewNodeList(chunkObject), false))
 * 	}
 * 	return objects
 * }
 */
export function objectRestSpreadTransformer_chunkObjectLiteralElements(receiver: GoPtr<objectRestSpreadTransformer>, list: GoPtr<NodeList>): GoSlice<GoPtr<Node>> {
  const astFactory = Transformer_Factory(receiver!.__tsgoEmbedded0!)!.__tsgoEmbedded0!;
  const visitor = Transformer_Visitor(receiver!.__tsgoEmbedded0!) as ConcreteNodeVisitor;
  if (list === undefined || list!.Nodes.length === 0) {
    return [];
  }
  const elements = list!.Nodes as unknown as GoSlice<GoPtr<Node>>;
  let chunkObject: GoSlice<GoPtr<Node>> = [];
  let objects: GoSlice<GoPtr<Node>> = [];
  for (const e of elements) {
    if (e!.Kind === KindSpreadAssignment) {
      if (chunkObject.length > 0) {
        objects = [...objects, NewObjectLiteralExpression(astFactory, NodeFactory_NewNodeList(astFactory, chunkObject) as unknown as GoPtr<never>, false)];
        chunkObject = [];
      }
      const target = Node_Expression(e);
      objects = [...objects, NodeVisitor_VisitNode(visitor, target)!];
    } else {
      let elem: GoPtr<Node>;
      if (e!.Kind === KindPropertyAssignment) {
        elem = NewPropertyAssignment(astFactory, undefined, Node_Name(e) as unknown as GoPtr<never>, undefined, undefined, NodeVisitor_VisitNode(visitor, Node_Initializer(e)) as unknown as GoPtr<never>);
      } else {
        elem = NodeVisitor_VisitNode(visitor, e)!;
      }
      chunkObject = [...chunkObject, elem];
    }
  }
  if (chunkObject.length > 0) {
    objects = [...objects, NewObjectLiteralExpression(astFactory, NodeFactory_NewNodeList(astFactory, chunkObject) as unknown as GoPtr<never>, false)];
  }
  return objects;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/objectrestspread.go::func::newObjectRestSpreadTransformer","kind":"func","status":"implemented","sigHash":"74be8eb7e2ec7f4bad0ca2d45f1bc72c822b0e59f135184c58ff75f817bb5e3d","bodyHash":"14fb65a58c82276e2b6074a54110c77dd9668ca6cfa9929d0d35772d802fd16e"}
 *
 * Go source:
 * func newObjectRestSpreadTransformer(opts *transformers.TransformOptions) *transformers.Transformer {
 * 	tx := &objectRestSpreadTransformer{compilerOptions: opts.CompilerOptions}
 * 	return tx.NewTransformer(tx.visit, opts.Context)
 * }
 */
export function newObjectRestSpreadTransformer(opts: GoPtr<TransformOptions>): GoPtr<Transformer> {
  const embedded: Transformer = { emitContext: undefined, factory: undefined, visitor: undefined };
  const tx: objectRestSpreadTransformer = {
    __tsgoEmbedded0: embedded,
    compilerOptions: opts!.CompilerOptions,
    inExportedVariableStatement: false,
    expressionResultIsUnused: false,
    parametersWithPrecedingObjectRestOrSpread: undefined as unknown as GoMap<GoPtr<Node>, { readonly __tsgoEmpty?: never }>,
  };
  return Transformer_NewTransformer(embedded, (node) => objectRestSpreadTransformer_visit(tx, node), opts!.Context);
}
