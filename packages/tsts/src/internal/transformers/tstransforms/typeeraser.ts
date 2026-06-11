import type { bool } from "@tsonic/core/types.js";
import type { GoPtr } from "../../../go/compat.js";
import * as slices from "../../../go/slices.js";
import type { NodeFactory } from "../../ast/generated/factory.js";
import { NewBlock, NewPartiallyEmittedExpression } from "../../ast/generated/factory.js";
import type { ArrowFunction, CallExpression, ClassDeclaration, ClassExpression, ConstructorDeclaration, ExportDeclaration, ExportSpecifier, FunctionDeclaration, FunctionExpression, GetAccessorDeclaration, HeritageClause, ImportClause, ImportDeclaration, ImportEqualsDeclaration, ImportSpecifier, JsxOpeningElement, JsxSelfClosingElement, MethodDeclaration, ModuleDeclaration, NamedExports, NamedImports, NewExpression, ParameterDeclaration, ParenthesizedExpression, PropertyDeclaration, SetAccessorDeclaration, TaggedTemplateExpression, VariableDeclaration } from "../../ast/generated/data.js";
import { AsArrowFunction, AsCallExpression, AsClassDeclaration, AsClassExpression, AsConstructorDeclaration, AsExportDeclaration, AsExportSpecifier, AsExpressionWithTypeArguments, AsFunctionDeclaration, AsFunctionExpression, AsGetAccessorDeclaration, AsHeritageClause, AsImportClause, AsImportDeclaration, AsImportEqualsDeclaration, AsImportSpecifier, AsJsxOpeningElement, AsJsxSelfClosingElement, AsMethodDeclaration, AsModuleDeclaration, AsNamedExports, AsNamedImports, AsNewExpression, AsParameterDeclaration, AsParenthesizedExpression, AsPropertyDeclaration, AsSetAccessorDeclaration, AsTaggedTemplateExpression, AsVariableDeclaration } from "../../ast/generated/casts.js";
import {
  KindAbstractKeyword,
  KindAnyKeyword,
  KindArrayType,
  KindArrowFunction,
  KindAsExpression,
  KindBooleanKeyword,
  KindCallExpression,
  KindClassDeclaration,
  KindClassExpression,
  KindConditionalType,
  KindConstKeyword,
  KindConstructor,
  KindConstructorType,
  KindDeclareKeyword,
  KindExportDeclaration,
  KindExportSpecifier,
  KindEnumDeclaration,
  KindExpressionWithTypeArguments,
  KindFunctionDeclaration,
  KindFunctionExpression,
  KindFunctionType,
  KindGetAccessor,
  KindHeritageClause,
  KindImplementsKeyword,
  KindImportClause,
  KindImportDeclaration,
  KindImportEqualsDeclaration,
  KindImportSpecifier,
  KindIndexSignature,
  KindIndexedAccessType,
  KindInterfaceDeclaration,
  KindIntersectionType,
  KindJSTypeAliasDeclaration,
  KindJSImportDeclaration,
  KindJsxOpeningElement,
  KindJsxSelfClosingElement,
  KindLiteralType,
  KindMappedType,
  KindMethodDeclaration,
  KindModuleDeclaration,
  KindNamedExports,
  KindNamedImports,
  KindNamespaceExportDeclaration,
  KindNeverKeyword,
  KindNewExpression,
  KindNonNullExpression,
  KindNumberKeyword,
  KindOptionalType,
  KindOverrideKeyword,
  KindParameter,
  KindParenthesizedExpression,
  KindParenthesizedType,
  KindPrivateKeyword,
  KindPropertyDeclaration,
  KindProtectedKeyword,
  KindPublicKeyword,
  KindReadonlyKeyword,
  KindRestType,
  KindSatisfiesExpression,
  KindSetAccessor,
  KindStringKeyword,
  KindSymbolKeyword,
  KindTaggedTemplateExpression,
  KindThisType,
  KindTypeAssertionExpression,
  KindTupleType,
  KindTypeAliasDeclaration,
  KindTypeKeyword,
  KindTypeLiteral,
  KindTypeOperator,
  KindTypeParameter,
  KindTypePredicate,
  KindTypeQuery,
  KindTypeReference,
  KindUnionType,
  KindUnknownKeyword,
  KindVariableDeclaration,
  KindVoidKeyword,
} from "../../ast/generated/kinds.js";
import type { Node } from "../../ast/spine.js";
import { Node_AsNode, Node_Name, Node_SubtreeFacts, Node_Modifiers, NodeFactory_NewModifierList, NodeFactory_NewNodeList } from "../../ast/spine.js";
import type { ClassElementList, ConciseBody, ElementList, ExportSpecifierList, Expression as Expression_9ab73856, ExpressionWithTypeArgumentsList, FunctionBody, HeritageClauseList, ImportSpecifierList, NamedExportBindings, NamedImportBindings, ParameterList, Statement, TypeList } from "../../ast/generated/unions.js";
import { Node_Decorators, Node_Expression } from "../../ast/ast.js";
import { NodeFactory_UpdateArrowFunction, NodeFactory_UpdateCallExpression, NodeFactory_UpdateClassDeclaration, NodeFactory_UpdateClassExpression, NodeFactory_UpdateConstructorDeclaration, NodeFactory_UpdateExportDeclaration, NodeFactory_UpdateExpressionWithTypeArguments, NodeFactory_UpdateFunctionDeclaration, NodeFactory_UpdateFunctionExpression, NodeFactory_UpdateGetAccessorDeclaration, NodeFactory_UpdateHeritageClause, NodeFactory_UpdateImportClause, NodeFactory_UpdateImportDeclaration, NodeFactory_UpdateJsxOpeningElement, NodeFactory_UpdateJsxSelfClosingElement, NodeFactory_UpdateMethodDeclaration, NodeFactory_UpdateNamedExports, NodeFactory_UpdateNamedImports, NodeFactory_UpdateNewExpression, NodeFactory_UpdateParameterDeclaration, NodeFactory_UpdatePropertyDeclaration, NodeFactory_UpdateSetAccessorDeclaration, NodeFactory_UpdateTaggedTemplateExpression, NodeFactory_UpdateVariableDeclaration } from "../../ast/ast.js";
import { HasDecorators, HasSyntacticModifier, IsAssertionExpression, IsEnumConst, IsInstantiatedModule, IsJSDocTypeAssertion, IsParameterPropertyDeclaration, IsStatement, IsThisParameter, NodeIsMissing, OEKAssertions, OEKExpressionsWithTypeArguments, SkipOuterExpressions } from "../../ast/utilities.js";
import { IsIdentifier, IsSatisfiesExpression } from "../../ast/generated/predicates.js";
import { ModifierFlagsAbstract, ModifierFlagsAmbient, ModifierFlagsParameterPropertyModifier } from "../../ast/modifierflags.js";
import { SubtreeContainsTypeScript } from "../../ast/subtreefacts.js";
import { CompilerOptions_ShouldPreserveConstEnums } from "../../core/compileroptions.js";
import type { CompilerOptions } from "../../core/compileroptions.js";
import { Tristate_IsTrue } from "../../core/tristate.js";
import { EmitContext_NewNotEmittedStatement, EmitContext_SetOriginal, EmitContext_SetTypeNode } from "../../printer/emitcontext.js";
import { NodeVisitor_VisitEachChild, NodeVisitor_VisitModifiers, NodeVisitor_VisitNode, NodeVisitor_VisitNodes, NodeVisitor_VisitSlice } from "../../ast/visitor.js";
import type { NodeVisitor as ConcreteNodeVisitor } from "../../ast/visitor.js";
import type { TransformOptions } from "../chain.js";
import { ExtractModifiers } from "../modifiervisitor.js";
import type { Transformer } from "../transformer.js";
import { Transformer_EmitContext, Transformer_Factory, Transformer_NewTransformer, Transformer_Visitor } from "../transformer.js";
import { getInnermostModuleDeclarationFromDottedModule } from "./runtimesyntax.js";

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/tstransforms/typeeraser.go::type::TypeEraserTransformer","kind":"type","status":"implemented","sigHash":"bdb90c2faa90cf896efb0849699ba9fae98beb7beb98d285e9da5884a17f7648","bodyHash":"058402a91184c90a80f6900dde5f432284290b1838798a9284c5e90ea71e461a"}
 *
 * Go source:
 * TypeEraserTransformer struct {
 * 	transformers.Transformer
 * 	compilerOptions *core.CompilerOptions
 * 	parentNode      *ast.Node
 * 	currentNode     *ast.Node
 * }
 */
export interface TypeEraserTransformer {
  readonly __tsgoEmbedded0?: Transformer;
  compilerOptions: GoPtr<CompilerOptions>;
  parentNode: GoPtr<Node>;
  currentNode: GoPtr<Node>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/tstransforms/typeeraser.go::func::NewTypeEraserTransformer","kind":"func","status":"implemented","sigHash":"53b3e285a69881af65a2487e556bd94560651a4b3806431a557f2e6039edd82f","bodyHash":"fec9e81a116ec6aa1009585bebe43017149a3f9b82bd9e0f6dc0226784ccbb97"}
 *
 * Go source:
 * func NewTypeEraserTransformer(opt *transformers.TransformOptions) *transformers.Transformer {
 * 	compilerOptions := opt.CompilerOptions
 * 	emitContext := opt.Context
 * 	tx := &TypeEraserTransformer{compilerOptions: compilerOptions}
 * 	return tx.NewTransformer(tx.visit, emitContext)
 * }
 */
export function NewTypeEraserTransformer(opt: GoPtr<TransformOptions>): GoPtr<Transformer> {
  const compilerOptions = opt!.CompilerOptions;
  const emitContext = opt!.Context;
  const tx: TypeEraserTransformer = {
    __tsgoEmbedded0: { emitContext: undefined, factory: undefined, visitor: undefined },
    compilerOptions: compilerOptions,
    parentNode: undefined,
    currentNode: undefined,
  };
  return Transformer_NewTransformer(tx.__tsgoEmbedded0, (node) => TypeEraserTransformer_visit(tx, node), emitContext);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/tstransforms/typeeraser.go::method::TypeEraserTransformer.pushNode","kind":"method","status":"implemented","sigHash":"66a52a570cf7e7f0e502f6dc1a0f30aaafd3e746b6a9972728c3d867453002ff","bodyHash":"dbf805bd336232b52ae2022d1b48bbafbbcde618e66432bcdcb6cfd766a6fb2b"}
 *
 * Go source:
 * func (tx *TypeEraserTransformer) pushNode(node *ast.Node) (grandparentNode *ast.Node) {
 * 	grandparentNode = tx.parentNode
 * 	tx.parentNode = tx.currentNode
 * 	tx.currentNode = node
 * 	return grandparentNode
 * }
 */
export function TypeEraserTransformer_pushNode(receiver: GoPtr<TypeEraserTransformer>, node: GoPtr<Node>): GoPtr<Node> {
  const grandparentNode = receiver!.parentNode;
  receiver!.parentNode = receiver!.currentNode;
  receiver!.currentNode = node;
  return grandparentNode;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/tstransforms/typeeraser.go::method::TypeEraserTransformer.popNode","kind":"method","status":"implemented","sigHash":"8a0b52123ec70589eec9709e3fe44cbc0951e4966c6d1f57af1f41746390df9d","bodyHash":"99c5f021d2f47cc4a641b490507f7ba5fe392bf1ab01a8d264a8a30ae82261d7"}
 *
 * Go source:
 * func (tx *TypeEraserTransformer) popNode(grandparentNode *ast.Node) {
 * 	tx.currentNode = tx.parentNode
 * 	tx.parentNode = grandparentNode
 * }
 */
export function TypeEraserTransformer_popNode(receiver: GoPtr<TypeEraserTransformer>, grandparentNode: GoPtr<Node>): void {
  receiver!.currentNode = receiver!.parentNode;
  receiver!.parentNode = grandparentNode;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/tstransforms/typeeraser.go::method::TypeEraserTransformer.elide","kind":"method","status":"implemented","sigHash":"d160929a2fd24ba0cb1d649dbdc7e6c185fddccb9bf4160ff303840cc7244186","bodyHash":"98fabb3a981f958fa0718753a59c97a59d3050270cdfeb79b6d5cad7bf9141a9"}
 *
 * Go source:
 * func (tx *TypeEraserTransformer) elide(node *ast.Statement) *ast.Statement {
 * 	return tx.EmitContext().NewNotEmittedStatement(node.AsNode())
 * }
 */
export function TypeEraserTransformer_elide(receiver: GoPtr<TypeEraserTransformer>, node: GoPtr<Statement>): GoPtr<Statement> {
  return EmitContext_NewNotEmittedStatement(Transformer_EmitContext(receiver!.__tsgoEmbedded0!), Node_AsNode(node));
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/tstransforms/typeeraser.go::method::TypeEraserTransformer.visit","kind":"method","status":"implemented","sigHash":"4f2cad082d0fa0662cb1701ceefd0650600ea695e15609c7856edb96ec19ac05","bodyHash":"60742ffea4bef34ca6cf64df7b04fa2e0deaddfab6ef59f1bf5eccc2db97fc35"}
 *
 * Go source:
 * func (tx *TypeEraserTransformer) visit(node *ast.Node) *ast.Node {
 * 	if node.SubtreeFacts()&ast.SubtreeContainsTypeScript == 0 {
 * 		return node
 * 	}
 * 
 * 	if ast.IsStatement(node) && ast.HasSyntacticModifier(node, ast.ModifierFlagsAmbient) {
 * 		return tx.elide(node)
 * 	}
 * 
 * 	grandparentNode := tx.pushNode(node)
 * 	defer tx.popNode(grandparentNode)
 * 
 * 	switch node.Kind {
 * 	case
 * 		// TypeScript accessibility and readonly modifiers are elided
 * 		ast.KindPublicKeyword,
 * 		ast.KindPrivateKeyword,
 * 		ast.KindProtectedKeyword,
 * 		ast.KindAbstractKeyword,
 * 		ast.KindOverrideKeyword,
 * 		ast.KindConstKeyword,
 * 		ast.KindDeclareKeyword,
 * 		ast.KindReadonlyKeyword,
 * 		// TypeScript type nodes are elided.
 * 		ast.KindArrayType,
 * 		ast.KindTupleType,
 * 		ast.KindOptionalType,
 * 		ast.KindRestType,
 * 		ast.KindTypeLiteral,
 * 		ast.KindTypePredicate,
 * 		ast.KindTypeParameter,
 * 		ast.KindAnyKeyword,
 * 		ast.KindUnknownKeyword,
 * 		ast.KindBooleanKeyword,
 * 		ast.KindStringKeyword,
 * 		ast.KindNumberKeyword,
 * 		ast.KindNeverKeyword,
 * 		ast.KindVoidKeyword,
 * 		ast.KindSymbolKeyword,
 * 		ast.KindConstructorType,
 * 		ast.KindFunctionType,
 * 		ast.KindTypeQuery,
 * 		ast.KindTypeReference,
 * 		ast.KindUnionType,
 * 		ast.KindIntersectionType,
 * 		ast.KindConditionalType,
 * 		ast.KindParenthesizedType,
 * 		ast.KindThisType,
 * 		ast.KindTypeOperator,
 * 		ast.KindIndexedAccessType,
 * 		ast.KindMappedType,
 * 		ast.KindLiteralType,
 * 		// TypeScript index signatures are elided.
 * 		ast.KindIndexSignature:
 * 		return nil
 * 
 * 	case ast.KindJSImportDeclaration:
 * 		// reparsed commonjs are elided
 * 		return nil
 * 	case ast.KindTypeAliasDeclaration,
 * 		ast.KindJSTypeAliasDeclaration,
 * 		ast.KindInterfaceDeclaration:
 * 		// TypeScript type-only declarations are elided.
 * 		return tx.elide(node)
 * 
 * 	case ast.KindNamespaceExportDeclaration:
 * 		// TypeScript namespace export declarations are elided.
 * 		return nil
 * 
 * 	case ast.KindModuleDeclaration:
 * 		if !ast.IsIdentifier(node.Name()) ||
 * 			!ast.IsInstantiatedModule(node, tx.compilerOptions.ShouldPreserveConstEnums()) ||
 * 			getInnermostModuleDeclarationFromDottedModule(node.AsModuleDeclaration()).Body == nil {
 * 			// TypeScript module declarations are elided if they are not instantiated or have no body
 * 			return tx.elide(node)
 * 		}
 * 		return tx.Visitor().VisitEachChild(node)
 * 
 * 	case ast.KindExpressionWithTypeArguments:
 * 		n := node.AsExpressionWithTypeArguments()
 * 		return tx.Factory().UpdateExpressionWithTypeArguments(n, tx.Visitor().VisitNode(n.Expression), nil)
 * 
 * 	case ast.KindPropertyDeclaration:
 * 		if tx.compilerOptions.ExperimentalDecorators.IsTrue() && ast.HasSyntacticModifier(node, ast.ModifierFlagsAmbient|ast.ModifierFlagsAbstract) && ast.HasDecorators(node) {
 * 			// declare/abstract props with decorators must be preserved until the decorator transform can process them and remove them
 * 			n := node.AsPropertyDeclaration()
 * 			return tx.Factory().UpdatePropertyDeclaration(n, tx.Visitor().VisitModifiers(n.Modifiers()), tx.Visitor().VisitNode(n.Name()), nil, nil, tx.Visitor().VisitNode(n.Initializer))
 * 		}
 * 		if ast.HasSyntacticModifier(node, ast.ModifierFlagsAmbient|ast.ModifierFlagsAbstract) {
 * 			// TypeScript `declare` fields are elided
 * 			return nil
 * 		}
 * 		n := node.AsPropertyDeclaration()
 * 		return tx.Factory().UpdatePropertyDeclaration(n, tx.Visitor().VisitModifiers(n.Modifiers()), tx.Visitor().VisitNode(n.Name()), nil, nil, tx.Visitor().VisitNode(n.Initializer))
 * 
 * 	case ast.KindConstructor:
 * 		n := node.AsConstructorDeclaration()
 * 		if ast.NodeIsMissing(n.Body) {
 * 			// TypeScript overloads are elided
 * 			return nil
 * 		}
 * 		return tx.Factory().UpdateConstructorDeclaration(n, nil, nil, tx.Visitor().VisitNodes(n.Parameters), nil, nil, tx.Visitor().VisitNode(n.Body))
 * 
 * 	case ast.KindMethodDeclaration:
 * 		n := node.AsMethodDeclaration()
 * 		if ast.NodeIsMissing(n.Body) {
 * 			// TypeScript overloads are elided
 * 			return nil
 * 		}
 * 		return tx.Factory().UpdateMethodDeclaration(n, tx.Visitor().VisitModifiers(n.Modifiers()), n.AsteriskToken, tx.Visitor().VisitNode(n.Name()), nil, nil, tx.Visitor().VisitNodes(n.Parameters), nil, nil, tx.Visitor().VisitNode(n.Body))
 * 
 * 	case ast.KindGetAccessor:
 * 		n := node.AsGetAccessorDeclaration()
 * 		if ast.NodeIsMissing(n.Body) && ast.HasSyntacticModifier(node, ast.ModifierFlagsAbstract) {
 * 			// Abstract accessors are elided
 * 			return nil
 * 		}
 * 		body := tx.Visitor().VisitNode(n.Body)
 * 		if body == nil {
 * 			body = tx.Factory().NewBlock(tx.Factory().NewNodeList(nil), false)
 * 		}
 * 		return tx.Factory().UpdateGetAccessorDeclaration(n, tx.Visitor().VisitModifiers(n.Modifiers()), tx.Visitor().VisitNode(n.Name()), nil, tx.Visitor().VisitNodes(n.Parameters), nil, nil, body)
 * 
 * 	case ast.KindSetAccessor:
 * 		n := node.AsSetAccessorDeclaration()
 * 		if ast.NodeIsMissing(n.Body) && ast.HasSyntacticModifier(node, ast.ModifierFlagsAbstract) {
 * 			// Abstract accessors are elided
 * 			return nil
 * 		}
 * 		body := tx.Visitor().VisitNode(n.Body)
 * 		if body == nil {
 * 			body = tx.Factory().NewBlock(tx.Factory().NewNodeList(nil), false)
 * 		}
 * 		return tx.Factory().UpdateSetAccessorDeclaration(n, tx.Visitor().VisitModifiers(n.Modifiers()), tx.Visitor().VisitNode(n.Name()), nil, tx.Visitor().VisitNodes(n.Parameters), nil, nil, body)
 * 
 * 	case ast.KindVariableDeclaration:
 * 		n := node.AsVariableDeclaration()
 * 		updated := tx.Factory().UpdateVariableDeclaration(n, tx.Visitor().VisitNode(n.Name()), nil, nil, tx.Visitor().VisitNode(n.Initializer))
 * 		if n.Type != nil {
 * 			tx.EmitContext().SetTypeNode(updated.AsVariableDeclaration().Name(), n.Type)
 * 		}
 * 		return updated
 * 
 * 	case ast.KindHeritageClause:
 * 		n := node.AsHeritageClause()
 * 		if n.Token == ast.KindImplementsKeyword {
 * 			// TypeScript `implements` clauses are elided
 * 			return nil
 * 		}
 * 		return tx.Factory().UpdateHeritageClause(n, n.Token, tx.Visitor().VisitNodes(n.Types))
 * 
 * 	case ast.KindClassDeclaration:
 * 		n := node.AsClassDeclaration()
 * 		return tx.Factory().UpdateClassDeclaration(n, tx.Visitor().VisitModifiers(n.Modifiers()), tx.Visitor().VisitNode(n.Name()), nil, tx.Visitor().VisitNodes(n.HeritageClauses), tx.Visitor().VisitNodes(n.Members))
 * 
 * 	case ast.KindClassExpression:
 * 		n := node.AsClassExpression()
 * 		return tx.Factory().UpdateClassExpression(n, tx.Visitor().VisitModifiers(n.Modifiers()), tx.Visitor().VisitNode(n.Name()), nil, tx.Visitor().VisitNodes(n.HeritageClauses), tx.Visitor().VisitNodes(n.Members))
 * 
 * 	case ast.KindFunctionDeclaration:
 * 		n := node.AsFunctionDeclaration()
 * 		if ast.NodeIsMissing(n.Body) {
 * 			// TypeScript overloads are elided
 * 			return tx.elide(node)
 * 		}
 * 		return tx.Factory().UpdateFunctionDeclaration(n, tx.Visitor().VisitModifiers(n.Modifiers()), n.AsteriskToken, tx.Visitor().VisitNode(n.Name()), nil, tx.Visitor().VisitNodes(n.Parameters), nil, nil, tx.Visitor().VisitNode(n.Body))
 * 
 * 	case ast.KindFunctionExpression:
 * 		n := node.AsFunctionExpression()
 * 		return tx.Factory().UpdateFunctionExpression(n, tx.Visitor().VisitModifiers(n.Modifiers()), n.AsteriskToken, tx.Visitor().VisitNode(n.Name()), nil, tx.Visitor().VisitNodes(n.Parameters), nil, nil, tx.Visitor().VisitNode(n.Body))
 * 
 * 	case ast.KindArrowFunction:
 * 		n := node.AsArrowFunction()
 * 		return tx.Factory().UpdateArrowFunction(n, tx.Visitor().VisitModifiers(n.Modifiers()), nil, tx.Visitor().VisitNodes(n.Parameters), nil, nil, n.EqualsGreaterThanToken, tx.Visitor().VisitNode(n.Body))
 * 
 * 	case ast.KindParameter:
 * 		if ast.IsThisParameter(node) {
 * 			// TypeScript `this` parameters are elided
 * 			return nil
 * 		}
 * 		n := node.AsParameterDeclaration()
 * 		// preserve parameter property modifiers to be handled by the runtime transformer
 * 		var modifiers *ast.ModifierList
 * 		if ast.IsParameterPropertyDeclaration(node, tx.parentNode) {
 * 			modifiers = transformers.ExtractModifiers(tx.EmitContext(), n.Modifiers(), ast.ModifierFlagsParameterPropertyModifier)
 * 		}
 * 		// preserve decorators for the decorator transforms
 * 		if ast.HasDecorators(node) {
 * 			decorators := node.Decorators()
 * 			visited, _ := tx.Visitor().VisitSlice(decorators)
 * 			if modifiers == nil {
 * 				modifiers = tx.Factory().NewModifierList(visited)
 * 			} else {
 * 				modifiers = tx.Factory().NewModifierList(slices.Concat(modifiers.Nodes, visited))
 * 			}
 * 		}
 * 		return tx.Factory().UpdateParameterDeclaration(n, modifiers, n.DotDotDotToken, tx.Visitor().VisitNode(n.Name()), nil, nil, tx.Visitor().VisitNode(n.Initializer))
 * 
 * 	case ast.KindCallExpression:
 * 		n := node.AsCallExpression()
 * 		return tx.Factory().UpdateCallExpression(n, tx.Visitor().VisitNode(n.Expression), n.QuestionDotToken, nil, tx.Visitor().VisitNodes(n.Arguments), n.Flags)
 * 
 * 	case ast.KindNewExpression:
 * 		n := node.AsNewExpression()
 * 		return tx.Factory().UpdateNewExpression(n, tx.Visitor().VisitNode(n.Expression), nil, tx.Visitor().VisitNodes(n.Arguments))
 * 
 * 	case ast.KindTaggedTemplateExpression:
 * 		n := node.AsTaggedTemplateExpression()
 * 		return tx.Factory().UpdateTaggedTemplateExpression(n, tx.Visitor().VisitNode(n.Tag), n.QuestionDotToken, nil, tx.Visitor().VisitNode(n.Template), n.Flags)
 * 
 * 	case ast.KindNonNullExpression, ast.KindTypeAssertionExpression, ast.KindAsExpression, ast.KindSatisfiesExpression:
 * 		partial := tx.Factory().NewPartiallyEmittedExpression(tx.Visitor().VisitNode(node.Expression()))
 * 		tx.EmitContext().SetOriginal(partial, node)
 * 		partial.Loc = node.Loc
 * 		return partial
 * 
 * 	case ast.KindParenthesizedExpression:
 * 		if !ast.IsJSDocTypeAssertion(node) {
 * 			n := node.AsParenthesizedExpression()
 * 			expression := ast.SkipOuterExpressions(n.Expression, ^(ast.OEKAssertions | ast.OEKExpressionsWithTypeArguments))
 * 			if ast.IsAssertionExpression(expression) || ast.IsSatisfiesExpression(expression) {
 * 				partial := tx.Factory().NewPartiallyEmittedExpression(tx.Visitor().VisitNode(n.Expression))
 * 				tx.EmitContext().SetOriginal(partial, node)
 * 				partial.Loc = node.Loc
 * 				return partial
 * 			}
 * 		}
 * 		return tx.Visitor().VisitEachChild(node)
 * 
 * 	case ast.KindJsxSelfClosingElement:
 * 		n := node.AsJsxSelfClosingElement()
 * 		return tx.Factory().UpdateJsxSelfClosingElement(n, tx.Visitor().VisitNode(n.TagName), nil, tx.Visitor().VisitNode(n.Attributes))
 * 
 * 	case ast.KindJsxOpeningElement:
 * 		n := node.AsJsxOpeningElement()
 * 		return tx.Factory().UpdateJsxOpeningElement(n, tx.Visitor().VisitNode(n.TagName), nil, tx.Visitor().VisitNode(n.Attributes))
 * 
 * 	case ast.KindImportEqualsDeclaration:
 * 		n := node.AsImportEqualsDeclaration()
 * 		if n.IsTypeOnly {
 * 			// elide type-only imports
 * 			return nil
 * 		}
 * 		return tx.Visitor().VisitEachChild(node)
 * 
 * 	case ast.KindImportDeclaration:
 * 		n := node.AsImportDeclaration()
 * 		if n.ImportClause == nil {
 * 			// Do not elide a side-effect only import declaration.
 * 			//  import "foo";
 * 			return node
 * 		}
 * 		importClause := tx.Visitor().VisitNode(n.ImportClause)
 * 		if importClause == nil {
 * 			return nil
 * 		}
 * 		return tx.Factory().UpdateImportDeclaration(n, n.Modifiers(), importClause, n.ModuleSpecifier, n.Attributes)
 * 
 * 	case ast.KindImportClause:
 * 		n := node.AsImportClause()
 * 		if n.IsTypeOnly() {
 * 			// Always elide type-only imports
 * 			return nil
 * 		}
 * 		name := n.Name()
 * 		namedBindings := tx.Visitor().VisitNode(n.NamedBindings)
 * 		if name == nil && namedBindings == nil {
 * 			// all import bindings were elided
 * 			return nil
 * 		}
 * 		return tx.Factory().UpdateImportClause(n, n.PhaseModifier, name, namedBindings)
 * 
 * 	case ast.KindNamedImports:
 * 		n := node.AsNamedImports()
 * 		if len(n.Elements.Nodes) == 0 {
 * 			// Do not elide a side-effect only import declaration.
 * 			return node
 * 		}
 * 		elements := tx.Visitor().VisitNodes(n.Elements)
 * 		if !tx.compilerOptions.VerbatimModuleSyntax.IsTrue() && len(elements.Nodes) == 0 {
 * 			// all import specifiers were elided
 * 			return nil
 * 		}
 * 		return tx.Factory().UpdateNamedImports(n, elements)
 * 
 * 	case ast.KindImportSpecifier:
 * 		n := node.AsImportSpecifier()
 * 		if n.IsTypeOnly {
 * 			// elide type-only or unused imports
 * 			return nil
 * 		}
 * 		return node
 * 
 * 	case ast.KindExportDeclaration:
 * 		n := node.AsExportDeclaration()
 * 		if n.IsTypeOnly {
 * 			// elide type-only exports
 * 			return nil
 * 		}
 * 		var exportClause *ast.Node
 * 		if n.ExportClause != nil {
 * 			exportClause = tx.Visitor().VisitNode(n.ExportClause)
 * 			if exportClause == nil {
 * 				// all export bindings were elided
 * 				return nil
 * 			}
 * 		}
 * 		return tx.Factory().UpdateExportDeclaration(n, nil /*modifiers* /, false /*isTypeOnly* /, exportClause, tx.Visitor().VisitNode(n.ModuleSpecifier), tx.Visitor().VisitNode(n.Attributes))
 * 
 * 	case ast.KindNamedExports:
 * 		n := node.AsNamedExports()
 * 		if len(n.Elements.Nodes) == 0 {
 * 			// Do not elide an empty export declaration.
 * 			return node
 * 		}
 * 
 * 		elements := tx.Visitor().VisitNodes(n.Elements)
 * 		if !tx.compilerOptions.VerbatimModuleSyntax.IsTrue() && len(elements.Nodes) == 0 {
 * 			// all export specifiers were elided
 * 			return nil
 * 		}
 * 		return tx.Factory().UpdateNamedExports(n, elements)
 * 
 * 	case ast.KindExportSpecifier:
 * 		n := node.AsExportSpecifier()
 * 		if n.IsTypeOnly {
 * 			// elide unused export
 * 			return nil
 * 		}
 * 		return node
 * 
 * 	case ast.KindEnumDeclaration:
 * 		if ast.IsEnumConst(node) {
 * 			return node
 * 		}
 * 		return tx.Visitor().VisitEachChild(node)
 * 
 * 	default:
 * 		return tx.Visitor().VisitEachChild(node)
 * 	}
 * }
 */
export function TypeEraserTransformer_visit(receiver: GoPtr<TypeEraserTransformer>, node: GoPtr<Node>): GoPtr<Node> {
  const tx = receiver!;
  const visitor = Transformer_Visitor(tx.__tsgoEmbedded0) as ConcreteNodeVisitor;
  const factory = Transformer_Factory(tx.__tsgoEmbedded0)!.__tsgoEmbedded0 as GoPtr<NodeFactory>;
  const emitContext = Transformer_EmitContext(tx.__tsgoEmbedded0);

  if ((Node_SubtreeFacts(node) & SubtreeContainsTypeScript) === 0) {
    return node;
  }

  if (IsStatement(node) && HasSyntacticModifier(node, ModifierFlagsAmbient)) {
    return TypeEraserTransformer_elide(tx, node as GoPtr<Statement>) as GoPtr<Node>;
  }

  const grandparentNode = TypeEraserTransformer_pushNode(tx, node);
  try {
    switch (node!.Kind) {
      case KindPublicKeyword:
      case KindPrivateKeyword:
      case KindProtectedKeyword:
      case KindAbstractKeyword:
      case KindOverrideKeyword:
      case KindConstKeyword:
      case KindDeclareKeyword:
      case KindReadonlyKeyword:
      case KindArrayType:
      case KindTupleType:
      case KindOptionalType:
      case KindRestType:
      case KindTypeLiteral:
      case KindTypePredicate:
      case KindTypeParameter:
      case KindAnyKeyword:
      case KindUnknownKeyword:
      case KindBooleanKeyword:
      case KindStringKeyword:
      case KindNumberKeyword:
      case KindNeverKeyword:
      case KindVoidKeyword:
      case KindSymbolKeyword:
      case KindConstructorType:
      case KindFunctionType:
      case KindTypeQuery:
      case KindTypeReference:
      case KindUnionType:
      case KindIntersectionType:
      case KindConditionalType:
      case KindParenthesizedType:
      case KindThisType:
      case KindTypeOperator:
      case KindIndexedAccessType:
      case KindMappedType:
      case KindLiteralType:
      case KindIndexSignature:
        return undefined;

      case KindJSImportDeclaration:
        return undefined;

      case KindTypeAliasDeclaration:
      case KindJSTypeAliasDeclaration:
      case KindInterfaceDeclaration:
        return TypeEraserTransformer_elide(tx, node as GoPtr<Statement>) as GoPtr<Node>;

      case KindNamespaceExportDeclaration:
        return undefined;

      case KindModuleDeclaration: {
        const moduleDeclaration: GoPtr<ModuleDeclaration> = AsModuleDeclaration(node);
        if (!IsIdentifier(Node_Name(node)) ||
          !IsInstantiatedModule(node, CompilerOptions_ShouldPreserveConstEnums(tx.compilerOptions)) ||
          getInnermostModuleDeclarationFromDottedModule(moduleDeclaration)!.Body === undefined) {
          return TypeEraserTransformer_elide(tx, node as GoPtr<Statement>) as GoPtr<Node>;
        }
        return NodeVisitor_VisitEachChild(visitor, node);
      }

      case KindExpressionWithTypeArguments: {
        const n = AsExpressionWithTypeArguments(node);
        return NodeFactory_UpdateExpressionWithTypeArguments(factory, n, NodeVisitor_VisitNode(visitor, n!.Expression) as GoPtr<Expression_9ab73856>, undefined);
      }

      case KindPropertyDeclaration: {
        const n: GoPtr<PropertyDeclaration> = AsPropertyDeclaration(node);
        if (Tristate_IsTrue(tx.compilerOptions!.ExperimentalDecorators) &&
          HasSyntacticModifier(node, (ModifierFlagsAmbient | ModifierFlagsAbstract) as typeof ModifierFlagsAmbient) &&
          HasDecorators(node)) {
          return NodeFactory_UpdatePropertyDeclaration(factory, n, NodeVisitor_VisitModifiers(visitor, Node_Modifiers(node)), NodeVisitor_VisitNode(visitor, Node_Name(node)), undefined, undefined, NodeVisitor_VisitNode(visitor, n!.Initializer) as GoPtr<Expression_9ab73856>);
        }
        if (HasSyntacticModifier(node, (ModifierFlagsAmbient | ModifierFlagsAbstract) as typeof ModifierFlagsAmbient)) {
          return undefined;
        }
        return NodeFactory_UpdatePropertyDeclaration(factory, n, NodeVisitor_VisitModifiers(visitor, Node_Modifiers(node)), NodeVisitor_VisitNode(visitor, Node_Name(node)), undefined, undefined, NodeVisitor_VisitNode(visitor, n!.Initializer) as GoPtr<Expression_9ab73856>);
      }

      case KindConstructor: {
        const n: GoPtr<ConstructorDeclaration> = AsConstructorDeclaration(node);
        if (NodeIsMissing(n!.Body)) {
          return undefined;
        }
        return NodeFactory_UpdateConstructorDeclaration(factory, n, undefined, undefined, NodeVisitor_VisitNodes(visitor, n!.Parameters) as GoPtr<ParameterList>, undefined, undefined, NodeVisitor_VisitNode(visitor, n!.Body) as GoPtr<FunctionBody>);
      }

      case KindMethodDeclaration: {
        const n: GoPtr<MethodDeclaration> = AsMethodDeclaration(node);
        if (NodeIsMissing(n!.Body)) {
          return undefined;
        }
        return NodeFactory_UpdateMethodDeclaration(factory, n, NodeVisitor_VisitModifiers(visitor, Node_Modifiers(node)), n!.AsteriskToken, NodeVisitor_VisitNode(visitor, Node_Name(node)), undefined, undefined, NodeVisitor_VisitNodes(visitor, n!.Parameters) as GoPtr<ParameterList>, undefined, undefined, NodeVisitor_VisitNode(visitor, n!.Body) as GoPtr<FunctionBody>);
      }

      case KindGetAccessor: {
        const n: GoPtr<GetAccessorDeclaration> = AsGetAccessorDeclaration(node);
        if (NodeIsMissing(n!.Body) && HasSyntacticModifier(node, ModifierFlagsAbstract)) {
          return undefined;
        }
        let body = NodeVisitor_VisitNode(visitor, n!.Body) as GoPtr<FunctionBody>;
        if (body === undefined) {
          body = NewBlock(factory, NodeFactory_NewNodeList(factory, []), false as bool) as GoPtr<FunctionBody>;
        }
        return NodeFactory_UpdateGetAccessorDeclaration(factory, n, NodeVisitor_VisitModifiers(visitor, Node_Modifiers(node)), NodeVisitor_VisitNode(visitor, Node_Name(node)), undefined, NodeVisitor_VisitNodes(visitor, n!.Parameters) as GoPtr<ParameterList>, undefined, undefined, body);
      }

      case KindSetAccessor: {
        const n: GoPtr<SetAccessorDeclaration> = AsSetAccessorDeclaration(node);
        if (NodeIsMissing(n!.Body) && HasSyntacticModifier(node, ModifierFlagsAbstract)) {
          return undefined;
        }
        let body = NodeVisitor_VisitNode(visitor, n!.Body) as GoPtr<FunctionBody>;
        if (body === undefined) {
          body = NewBlock(factory, NodeFactory_NewNodeList(factory, []), false as bool) as GoPtr<FunctionBody>;
        }
        return NodeFactory_UpdateSetAccessorDeclaration(factory, n, NodeVisitor_VisitModifiers(visitor, Node_Modifiers(node)), NodeVisitor_VisitNode(visitor, Node_Name(node)), undefined, NodeVisitor_VisitNodes(visitor, n!.Parameters) as GoPtr<ParameterList>, undefined, undefined, body);
      }

      case KindVariableDeclaration: {
        const n: GoPtr<VariableDeclaration> = AsVariableDeclaration(node);
        const updated = NodeFactory_UpdateVariableDeclaration(factory, n, NodeVisitor_VisitNode(visitor, n!.name), undefined, undefined, NodeVisitor_VisitNode(visitor, n!.Initializer) as GoPtr<Expression_9ab73856>);
        if (n!.Type !== undefined) {
          EmitContext_SetTypeNode(emitContext, AsVariableDeclaration(updated)!.name, n!.Type);
        }
        return updated;
      }

      case KindHeritageClause: {
        const n: GoPtr<HeritageClause> = AsHeritageClause(node);
        if (n!.Token === KindImplementsKeyword) {
          return undefined;
        }
        return NodeFactory_UpdateHeritageClause(factory, n, n!.Token, NodeVisitor_VisitNodes(visitor, n!.Types) as GoPtr<ExpressionWithTypeArgumentsList>);
      }

      case KindClassDeclaration: {
        const n: GoPtr<ClassDeclaration> = AsClassDeclaration(node);
        return NodeFactory_UpdateClassDeclaration(factory, n, NodeVisitor_VisitModifiers(visitor, Node_Modifiers(node)), NodeVisitor_VisitNode(visitor, Node_Name(node)), undefined, NodeVisitor_VisitNodes(visitor, n!.HeritageClauses) as GoPtr<HeritageClauseList>, NodeVisitor_VisitNodes(visitor, n!.Members) as GoPtr<ClassElementList>);
      }

      case KindClassExpression: {
        const n: GoPtr<ClassExpression> = AsClassExpression(node);
        return NodeFactory_UpdateClassExpression(factory, n, NodeVisitor_VisitModifiers(visitor, Node_Modifiers(node)), NodeVisitor_VisitNode(visitor, Node_Name(node)), undefined, NodeVisitor_VisitNodes(visitor, n!.HeritageClauses) as GoPtr<HeritageClauseList>, NodeVisitor_VisitNodes(visitor, n!.Members) as GoPtr<ClassElementList>);
      }

      case KindFunctionDeclaration: {
        const n: GoPtr<FunctionDeclaration> = AsFunctionDeclaration(node);
        if (NodeIsMissing(n!.Body)) {
          return TypeEraserTransformer_elide(tx, node as GoPtr<Statement>) as GoPtr<Node>;
        }
        return NodeFactory_UpdateFunctionDeclaration(factory, n, NodeVisitor_VisitModifiers(visitor, Node_Modifiers(node)), n!.AsteriskToken, NodeVisitor_VisitNode(visitor, Node_Name(node)), undefined, NodeVisitor_VisitNodes(visitor, n!.Parameters) as GoPtr<ParameterList>, undefined, undefined, NodeVisitor_VisitNode(visitor, n!.Body) as GoPtr<FunctionBody>);
      }

      case KindFunctionExpression: {
        const n: GoPtr<FunctionExpression> = AsFunctionExpression(node);
        return NodeFactory_UpdateFunctionExpression(factory, n, NodeVisitor_VisitModifiers(visitor, Node_Modifiers(node)), n!.AsteriskToken, NodeVisitor_VisitNode(visitor, Node_Name(node)), undefined, NodeVisitor_VisitNodes(visitor, n!.Parameters) as GoPtr<ParameterList>, undefined, undefined, NodeVisitor_VisitNode(visitor, n!.Body) as GoPtr<FunctionBody>);
      }

      case KindArrowFunction: {
        const n: GoPtr<ArrowFunction> = AsArrowFunction(node);
        return NodeFactory_UpdateArrowFunction(factory, n, NodeVisitor_VisitModifiers(visitor, Node_Modifiers(node)), undefined, NodeVisitor_VisitNodes(visitor, n!.Parameters) as GoPtr<ParameterList>, undefined, undefined, n!.EqualsGreaterThanToken, NodeVisitor_VisitNode(visitor, n!.Body) as GoPtr<ConciseBody>);
      }

      case KindParameter: {
        if (IsThisParameter(node)) {
          return undefined;
        }
        const n: GoPtr<ParameterDeclaration> = AsParameterDeclaration(node);
        let modifiers = undefined;
        if (IsParameterPropertyDeclaration(node, tx.parentNode)) {
          modifiers = ExtractModifiers(emitContext, Node_Modifiers(node), ModifierFlagsParameterPropertyModifier);
        }
        if (HasDecorators(node)) {
          const decorators = Node_Decorators(node);
          const [visited] = NodeVisitor_VisitSlice(visitor, decorators!);
          if (modifiers === undefined) {
            modifiers = NodeFactory_NewModifierList(factory, visited);
          } else {
            modifiers = NodeFactory_NewModifierList(factory, slices.Concat(modifiers.Nodes, visited));
          }
        }
        return NodeFactory_UpdateParameterDeclaration(factory, n, modifiers, n!.DotDotDotToken, NodeVisitor_VisitNode(visitor, Node_Name(node)), undefined, undefined, NodeVisitor_VisitNode(visitor, n!.Initializer) as GoPtr<Expression_9ab73856>);
      }

      case KindCallExpression: {
        const n: GoPtr<CallExpression> = AsCallExpression(node);
        return NodeFactory_UpdateCallExpression(factory, n, NodeVisitor_VisitNode(visitor, n!.Expression) as GoPtr<Expression_9ab73856>, n!.QuestionDotToken, undefined, NodeVisitor_VisitNodes(visitor, n!.Arguments) as GoPtr<ElementList>, n!.Flags);
      }

      case KindNewExpression: {
        const n: GoPtr<NewExpression> = AsNewExpression(node);
        return NodeFactory_UpdateNewExpression(factory, n, NodeVisitor_VisitNode(visitor, n!.Expression) as GoPtr<Expression_9ab73856>, undefined, NodeVisitor_VisitNodes(visitor, n!.Arguments) as GoPtr<ElementList>);
      }

      case KindTaggedTemplateExpression: {
        const n: GoPtr<TaggedTemplateExpression> = AsTaggedTemplateExpression(node);
        return NodeFactory_UpdateTaggedTemplateExpression(factory, n, NodeVisitor_VisitNode(visitor, n!.Tag) as GoPtr<Expression_9ab73856>, n!.QuestionDotToken, undefined, NodeVisitor_VisitNode(visitor, n!.Template), n!.Flags);
      }

      case KindNonNullExpression:
      case KindTypeAssertionExpression:
      case KindAsExpression:
      case KindSatisfiesExpression: {
        const partial = NewPartiallyEmittedExpression(factory, NodeVisitor_VisitNode(visitor, Node_Expression(node)) as GoPtr<Expression_9ab73856>);
        EmitContext_SetOriginal(emitContext, partial, node);
        partial!.Loc = node!.Loc;
        return partial;
      }

      case KindParenthesizedExpression: {
        if (!IsJSDocTypeAssertion(node)) {
          const n: GoPtr<ParenthesizedExpression> = AsParenthesizedExpression(node);
          const expression = SkipOuterExpressions(n!.Expression, (~(OEKAssertions | OEKExpressionsWithTypeArguments)) as Parameters<typeof SkipOuterExpressions>[1]);
          if (IsAssertionExpression(expression) || IsSatisfiesExpression(expression)) {
            const partial = NewPartiallyEmittedExpression(factory, NodeVisitor_VisitNode(visitor, n!.Expression) as GoPtr<Expression_9ab73856>);
            EmitContext_SetOriginal(emitContext, partial, node);
            partial!.Loc = node!.Loc;
            return partial;
          }
        }
        return NodeVisitor_VisitEachChild(visitor, node);
      }

      case KindJsxSelfClosingElement: {
        const n: GoPtr<JsxSelfClosingElement> = AsJsxSelfClosingElement(node);
        return NodeFactory_UpdateJsxSelfClosingElement(factory, n, NodeVisitor_VisitNode(visitor, n!.TagName), undefined, NodeVisitor_VisitNode(visitor, n!.Attributes));
      }

      case KindJsxOpeningElement: {
        const n: GoPtr<JsxOpeningElement> = AsJsxOpeningElement(node);
        return NodeFactory_UpdateJsxOpeningElement(factory, n, NodeVisitor_VisitNode(visitor, n!.TagName), undefined, NodeVisitor_VisitNode(visitor, n!.Attributes));
      }

      case KindImportEqualsDeclaration: {
        const n: GoPtr<ImportEqualsDeclaration> = AsImportEqualsDeclaration(node);
        if (n!.IsTypeOnly) {
          return undefined;
        }
        return NodeVisitor_VisitEachChild(visitor, node);
      }

      case KindImportDeclaration: {
        const n: GoPtr<ImportDeclaration> = AsImportDeclaration(node);
        if (n!.ImportClause === undefined) {
          return node;
        }
        const importClause = NodeVisitor_VisitNode(visitor, n!.ImportClause);
        if (importClause === undefined) {
          return undefined;
        }
        return NodeFactory_UpdateImportDeclaration(factory, n, Node_Modifiers(node), importClause, n!.ModuleSpecifier, n!.Attributes);
      }

      case KindImportClause: {
        const n: GoPtr<ImportClause> = AsImportClause(node);
        if (n!.PhaseModifier === KindTypeKeyword) {
          return undefined;
        }
        const name = n!.name;
        const namedBindings = NodeVisitor_VisitNode(visitor, n!.NamedBindings) as GoPtr<NamedImportBindings>;
        if (name === undefined && namedBindings === undefined) {
          return undefined;
        }
        return NodeFactory_UpdateImportClause(factory, n, n!.PhaseModifier, name, namedBindings);
      }

      case KindNamedImports: {
        const n: GoPtr<NamedImports> = AsNamedImports(node);
        if (n!.Elements!.Nodes.length === 0) {
          return node;
        }
        const elements = NodeVisitor_VisitNodes(visitor, n!.Elements) as GoPtr<ExportSpecifierList>;
        if (!Tristate_IsTrue(tx.compilerOptions!.VerbatimModuleSyntax) && elements!.Nodes.length === 0) {
          return undefined;
        }
        return NodeFactory_UpdateNamedImports(factory, n, elements);
      }

      case KindImportSpecifier: {
        const n: GoPtr<ImportSpecifier> = AsImportSpecifier(node);
        if (n!.IsTypeOnly) {
          return undefined;
        }
        return node;
      }

      case KindExportDeclaration: {
        const n: GoPtr<ExportDeclaration> = AsExportDeclaration(node);
        if (n!.IsTypeOnly) {
          return undefined;
        }
        let exportClause: GoPtr<Node>;
        if (n!.ExportClause !== undefined) {
          exportClause = NodeVisitor_VisitNode(visitor, n!.ExportClause);
          if (exportClause === undefined) {
            return undefined;
          }
        }
        return NodeFactory_UpdateExportDeclaration(factory, n, undefined, false as bool, exportClause as GoPtr<NamedExportBindings>, NodeVisitor_VisitNode(visitor, n!.ModuleSpecifier) as GoPtr<Expression_9ab73856>, NodeVisitor_VisitNode(visitor, n!.Attributes));
      }

      case KindNamedExports: {
        const n: GoPtr<NamedExports> = AsNamedExports(node);
        if (n!.Elements!.Nodes.length === 0) {
          return node;
        }
        const elements = NodeVisitor_VisitNodes(visitor, n!.Elements) as GoPtr<ImportSpecifierList>;
        if (!Tristate_IsTrue(tx.compilerOptions!.VerbatimModuleSyntax) && elements!.Nodes.length === 0) {
          return undefined;
        }
        return NodeFactory_UpdateNamedExports(factory, n, elements);
      }

      case KindExportSpecifier: {
        const n: GoPtr<ExportSpecifier> = AsExportSpecifier(node);
        if (n!.IsTypeOnly) {
          return undefined;
        }
        return node;
      }

      case KindEnumDeclaration:
        if (IsEnumConst(node)) {
          return node;
        }
        return NodeVisitor_VisitEachChild(visitor, node);

      default:
        return NodeVisitor_VisitEachChild(visitor, node);
    }
  } finally {
    TypeEraserTransformer_popNode(tx, grandparentNode);
  }
}
