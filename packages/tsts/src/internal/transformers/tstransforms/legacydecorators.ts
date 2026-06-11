import type { bool, int } from "@tsonic/core/types.js";
import type { GoMap, GoPtr, GoSlice } from "../../../go/compat.js";
import type { ModifierList, Node, NodeList } from "../../ast/spine.js";
import { NodeFactory_NewModifierList, NodeFactory_NewNodeList, Node_ForEachChild, Node_Modifiers, Node_Name, Node_SubtreeFacts } from "../../ast/spine.js";
import type { ClassDeclaration, ClassExpression, ComputedPropertyName, ConstructorDeclaration, GetAccessorDeclaration, Identifier, MethodDeclaration, ParameterDeclaration, PropertyAccessExpression, PropertyDeclaration, SetAccessorDeclaration } from "../../ast/generated/data.js";
import type { AccessorDeclaration, DeclarationName, IdentifierNode } from "../../ast/generated/unions.js";
import { KindClassDeclaration, KindClassExpression, KindConstructor, KindDecorator, KindDefaultKeyword, KindExportKeyword, KindGetAccessor, KindIdentifier, KindMethodDeclaration, KindParameter, KindPropertyDeclaration, KindPropertyAccessExpression, KindSetAccessor, KindSourceFile, KindThisKeyword, KindNullKeyword } from "../../ast/generated/kinds.js";
import { IsComputedPropertyName, IsDecorator, IsIdentifier, IsPrivateIdentifier, IsPropertyAccessExpression, IsPropertyDeclaration, IsClassStaticBlockDeclaration } from "../../ast/generated/predicates.js";
import { SubtreeContainsDecorators, SubtreeContainsPrivateIdentifierInExpression } from "../../ast/subtreefacts.js";
import { NewBlock, NewClassExpression, NewClassStaticBlockDeclaration, NewExpressionStatement, NewIdentifier, NewKeywordExpression, NewPropertyAccessExpression, NewStringLiteral, NewSyntaxList, NewVariableDeclaration, NewVariableDeclarationList, NewVariableStatement } from "../../ast/generated/factory.js";
import { AsComputedPropertyName, AsGetAccessorDeclaration, AsPropertyAccessExpression, AsSetAccessorDeclaration } from "../../ast/generated/casts.js";
import { CanHaveDecorators, ChildIsDecorated, ClassOrConstructorParameterIsDecorated, GetAllAccessorDeclarations, GetFirstConstructorWithBody, HasAccessorModifier, HasDecorators, HasSyntacticModifier, HasStaticModifier, IsStatic, IsThisParameter, NodeOrChildIsDecorated, SkipPartiallyEmittedExpressions } from "../../ast/utilities.js";
import { Node_Body, Node_Decorators, Node_Expression, Node_Members, Node_ParameterList, Node_Parameters, NodeFactory_UpdateClassDeclaration, NodeFactory_UpdateClassExpression, NodeFactory_UpdateComputedPropertyName, NodeFactory_UpdateConstructorDeclaration, NodeFactory_UpdateGetAccessorDeclaration, NodeFactory_UpdateMethodDeclaration, NodeFactory_UpdateParameterDeclaration, NodeFactory_UpdatePropertyAccessExpression, NodeFactory_UpdatePropertyDeclaration, NodeFactory_UpdateSetAccessorDeclaration } from "../../ast/ast.js";
import { ModifierFlagsAbstract, ModifierFlagsAmbient, ModifierFlagsDefault, ModifierFlagsExport } from "../../ast/modifierflags.js";
import { NodeFlagsAmbient, NodeFlagsLet, NodeFlagsNone } from "../../ast/generated/flags.js";
import { TokenFlagsNone } from "../../ast/tokenflags.js";
import { GroupBy, MultiMap_Get } from "../../collections/multimap.js";
import type { ReferenceResolver } from "../../binder/referenceresolver.js";
import { Filter, Some } from "../../core/core.js";
import type { ScriptTarget } from "../../core/compileroptions.js";
import { CompilerOptions_GetEmitScriptTarget } from "../../core/compileroptions.js";
import { ScriptTargetES2022 } from "../../core/compileroptions.js";
import { EmitContext_AddVariableDeclaration, EmitContext_IsCallToHelper, EmitContext_MostOriginal, EmitContext_SetCommentRange, EmitContext_SetEmitFlags, EmitContext_SetOriginal, EmitContext_SetSourceMapRange, EmitContext_AddEmitHelper, EmitContext_ReadEmitHelpers } from "../../printer/emitcontext.js";
import { EFNoComments, EFNoTrailingSourceMap } from "../../printer/emitflags.js";
import type { NodeFactory } from "../../printer/factory.js";
import { NodeFactory_GetDeclarationName, NodeFactory_GetDeclarationNameEx, NodeFactory_GetLocalNameEx, NodeFactory_NewAssignmentExpression, NodeFactory_NewDecorateHelper, NodeFactory_NewExportDefault, NodeFactory_NewExternalModuleExport, NodeFactory_NewGeneratedNameForNode, NodeFactory_NewParamHelper, NodeFactory_NewStringLiteralFromNode, NodeFactory_NewUniqueName, NodeFactory_NewVoidZeroExpression } from "../../printer/factory.js";
import type { AssignedNameOptions, NameOptions } from "../../printer/factory.js";
import { NodeFactory_DeepCloneNode } from "../../ast/deepclone.js";
import type { TransformOptions } from "../chain.js";
import type { Transformer } from "../transformer.js";
import { Transformer_EmitContext, Transformer_Factory, Transformer_NewTransformer, Transformer_Visitor } from "../transformer.js";
import { IsGeneratedIdentifier } from "../utilities.js";
import { IsSimpleInlineableExpression, MoveRangePastModifiers } from "../utilities.js";
import type { NodeVisitor as ConcreteNodeVisitor } from "../../ast/visitor.js";
import { NodeVisitor_VisitEachChild, NodeVisitor_VisitModifiers, NodeVisitor_VisitNode, NodeVisitor_VisitNodes } from "../../ast/visitor.js";

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/tstransforms/legacydecorators.go::type::LegacyDecoratorsTransformer","kind":"type","status":"implemented","sigHash":"3e8b6000d7df99dfb03cbd1021762c270351f393bd09b326bf1c1b0c9648c6e3","bodyHash":"b66f56e4f4d049b0ce7ef446589bacd50681f85953dddb5eda4dd31aa81e8d7f"}
 *
 * Go source:
 * LegacyDecoratorsTransformer struct {
 * 	transformers.Transformer
 * 	languageVersion   core.ScriptTarget
 * 	referenceResolver binder.ReferenceResolver
 * 
 * 	/**
 * 	 * A map that keeps track of aliases created for classes with decorators to avoid issues
 * 	 * with the double-binding behavior of classes.
 * 	 * /
 * 	classAliases     map[*ast.Node]*ast.Node
 * 	enclosingClasses []*ast.ClassDeclaration
 * }
 */
export interface LegacyDecoratorsTransformer {
  readonly __tsgoEmbedded0?: Transformer;
  languageVersion: ScriptTarget;
  referenceResolver: ReferenceResolver;
  classAliases: GoMap<GoPtr<Node>, GoPtr<Node>>;
  enclosingClasses: GoSlice<GoPtr<ClassDeclaration>>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/tstransforms/legacydecorators.go::func::NewLegacyDecoratorsTransformer","kind":"func","status":"implemented","sigHash":"8da740745fd1380673e2cfc500e7a8af286d3fc05feaa5bfffdb903322cd0fe1","bodyHash":"4ea6564d12faf0e6e62f1f2053b4845fcebf5332dd89529281474b90d1da5477"}
 *
 * Go source:
 * func NewLegacyDecoratorsTransformer(opt *transformers.TransformOptions) *transformers.Transformer {
 * 	tx := &LegacyDecoratorsTransformer{languageVersion: opt.CompilerOptions.GetEmitScriptTarget(), referenceResolver: opt.Resolver}
 * 	return tx.NewTransformer(tx.visit, opt.Context)
 * }
 */
export function NewLegacyDecoratorsTransformer(opt: GoPtr<TransformOptions>): GoPtr<Transformer> {
  const tx: LegacyDecoratorsTransformer = {
    __tsgoEmbedded0: { emitContext: undefined, factory: undefined, visitor: undefined },
    languageVersion: CompilerOptions_GetEmitScriptTarget(opt!.CompilerOptions),
    referenceResolver: opt!.Resolver!,
    classAliases: new Map(),
    enclosingClasses: [],
  };
  return Transformer_NewTransformer(tx.__tsgoEmbedded0, (node) => LegacyDecoratorsTransformer_visit(tx, node), opt!.Context);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/tstransforms/legacydecorators.go::method::LegacyDecoratorsTransformer.visit","kind":"method","status":"implemented","sigHash":"1c48a3e9b5758e8584050a7033835dfdd1346b5042b75dac1eed06e5c970b965","bodyHash":"e7049e0f5c26630628d869c133f51f7699c99ae30b03b937a4b4d0af4083b689"}
 *
 * Go source:
 * func (tx *LegacyDecoratorsTransformer) visit(node *ast.Node) *ast.Node {
 * 	// we have to visit all identifiers in classes, just in case they require substitution
 * 	if (node.SubtreeFacts()&ast.SubtreeContainsDecorators) == 0 && len(tx.enclosingClasses) == 0 {
 * 		return node
 * 	}
 *
 * 	switch node.Kind {
 * 	case ast.KindIdentifier:
 * 		return tx.visitIdentifier(node.AsIdentifier())
 * 	case ast.KindPropertyAccessExpression:
 * 		return tx.visitPropertyAccessExpression(node.AsPropertyAccessExpression())
 * 	case ast.KindDecorator:
 * 		// Decorators are elided. They will be emitted as part of `visitClassDeclaration`.
 * 		return nil
 * 	case ast.KindClassDeclaration:
 * 		return tx.visitClassDeclaration(node.AsClassDeclaration())
 * 	case ast.KindClassExpression:
 * 		return tx.visitClassExpression(node.AsClassExpression())
 * 	case ast.KindConstructor:
 * 		return tx.visitConstructorDeclaration(node.AsConstructorDeclaration())
 * 	case ast.KindMethodDeclaration:
 * 		return tx.visitMethodDeclaration(node.AsMethodDeclaration())
 * 	case ast.KindSetAccessor:
 * 		return tx.visitSetAccessorDeclaration(node.AsSetAccessorDeclaration())
 * 	case ast.KindGetAccessor:
 * 		return tx.visitGetAccessorDeclaration(node.AsGetAccessorDeclaration())
 * 	case ast.KindPropertyDeclaration:
 * 		return tx.visitPropertyDeclaration(node.AsPropertyDeclaration())
 * 	case ast.KindParameter:
 * 		return tx.visitParamerDeclaration(node.AsParameterDeclaration())
 * 	case ast.KindSourceFile:
 * 		tx.classAliases = make(map[*ast.Node]*ast.Node)
 * 		tx.enclosingClasses = nil
 * 		result := tx.Visitor().VisitEachChild(node)
 * 		tx.EmitContext().AddEmitHelper(result, tx.EmitContext().ReadEmitHelpers()...)
 * 		tx.classAliases = nil
 * 		tx.enclosingClasses = nil
 * 		return result
 * 	default:
 * 		return tx.Visitor().VisitEachChild(node)
 * 	}
 * }
 */
export function LegacyDecoratorsTransformer_visit(receiver: GoPtr<LegacyDecoratorsTransformer>, node: GoPtr<Node>): GoPtr<Node> {
  if ((Node_SubtreeFacts(node) & SubtreeContainsDecorators) === 0 && receiver!.enclosingClasses.length === 0) {
    return node;
  }
  const visitor = Transformer_Visitor(receiver!.__tsgoEmbedded0) as ConcreteNodeVisitor;
  const emitCtx = Transformer_EmitContext(receiver!.__tsgoEmbedded0);
  switch (node!.Kind) {
    case KindIdentifier:
      return LegacyDecoratorsTransformer_visitIdentifier(receiver, node as unknown as GoPtr<Identifier>);
    case KindPropertyAccessExpression:
      return LegacyDecoratorsTransformer_visitPropertyAccessExpression(receiver, node as unknown as GoPtr<PropertyAccessExpression>);
    case KindDecorator:
      return undefined;
    case KindClassDeclaration:
      return LegacyDecoratorsTransformer_visitClassDeclaration(receiver, node as unknown as GoPtr<ClassDeclaration>);
    case KindClassExpression:
      return LegacyDecoratorsTransformer_visitClassExpression(receiver, node as unknown as GoPtr<ClassExpression>);
    case KindConstructor:
      return LegacyDecoratorsTransformer_visitConstructorDeclaration(receiver, node as unknown as GoPtr<ConstructorDeclaration>);
    case KindMethodDeclaration:
      return LegacyDecoratorsTransformer_visitMethodDeclaration(receiver, node as unknown as GoPtr<MethodDeclaration>);
    case KindSetAccessor:
      return LegacyDecoratorsTransformer_visitSetAccessorDeclaration(receiver, AsSetAccessorDeclaration(node));
    case KindGetAccessor:
      return LegacyDecoratorsTransformer_visitGetAccessorDeclaration(receiver, AsGetAccessorDeclaration(node));
    case KindPropertyDeclaration:
      return LegacyDecoratorsTransformer_visitPropertyDeclaration(receiver, node as unknown as GoPtr<PropertyDeclaration>);
    case KindParameter:
      return LegacyDecoratorsTransformer_visitParamerDeclaration(receiver, node as unknown as GoPtr<ParameterDeclaration>);
    case KindSourceFile: {
      receiver!.classAliases = new Map();
      receiver!.enclosingClasses = [];
      const result = NodeVisitor_VisitEachChild(visitor, node);
      EmitContext_AddEmitHelper(emitCtx, result, ...EmitContext_ReadEmitHelpers(emitCtx));
      receiver!.classAliases = new Map();
      receiver!.enclosingClasses = [];
      return result;
    }
    default:
      return NodeVisitor_VisitEachChild(visitor, node);
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/tstransforms/legacydecorators.go::method::LegacyDecoratorsTransformer.visitIdentifier","kind":"method","status":"implemented","sigHash":"b45f068952418f2e57245112877e6d9026ed25278be6842a94051265e007d4de","bodyHash":"1fc687824909dbf99a73dd8443bd537e1738db59a2dd09554ef669fd5f60ae3e"}
 *
 * Go source:
 * func (tx *LegacyDecoratorsTransformer) visitIdentifier(node *ast.Identifier) *ast.Node {
 * 	// takes the place of `substituteIdentifier` in the strada transform
 * 	for _, d := range tx.enclosingClasses {
 * 		if _, ok := tx.classAliases[d.AsNode()]; ok && tx.referenceResolver.GetReferencedValueDeclaration(tx.EmitContext().MostOriginal(node.AsNode())) == tx.EmitContext().MostOriginal(d.AsNode()) {
 * 			return tx.classAliases[d.AsNode()]
 * 		}
 * 	}
 * 	return node.AsNode()
 * }
 */
export function LegacyDecoratorsTransformer_visitIdentifier(receiver: GoPtr<LegacyDecoratorsTransformer>, node: GoPtr<Identifier>): GoPtr<Node> {
  const emitCtx = Transformer_EmitContext(receiver!.__tsgoEmbedded0);
  for (const d of receiver!.enclosingClasses) {
    const dNode = d as unknown as GoPtr<Node>;
    if (receiver!.classAliases.has(dNode) && receiver!.referenceResolver.GetReferencedValueDeclaration(EmitContext_MostOriginal(emitCtx, node as unknown as GoPtr<Node>) as unknown as GoPtr<IdentifierNode>) === EmitContext_MostOriginal(emitCtx, dNode)) {
      return receiver!.classAliases.get(dNode);
    }
  }
  return node as unknown as GoPtr<Node>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/tstransforms/legacydecorators.go::method::LegacyDecoratorsTransformer.visitPropertyAccessExpression","kind":"method","status":"implemented","sigHash":"ced2c64e3927f23b12eb2ae250950a0c3aabbfe73ab1bfbad5e9bade83e9cb67","bodyHash":"37f18a0cb8884ad8203a10332f547c77facafce4d6b5673f5892de5deb5d9ec2"}
 *
 * Go source:
 * func (tx *LegacyDecoratorsTransformer) visitPropertyAccessExpression(node *ast.PropertyAccessExpression) *ast.Node {
 * 	// Visit the expression but not the name, since property access names should not be substituted.
 * 	// Strada's onSubstituteNode only fires for EmitHint.Expression, which excludes the
 * 	// .name of PropertyAccessExpression.
 * 	expression := tx.Visitor().VisitNode(node.Expression)
 * 	if expression != node.Expression {
 * 		return tx.Factory().UpdatePropertyAccessExpression(node, expression, node.QuestionDotToken, node.Name(), node.Flags)
 * 	}
 * 	return node.AsNode()
 * }
 */
export function LegacyDecoratorsTransformer_visitPropertyAccessExpression(receiver: GoPtr<LegacyDecoratorsTransformer>, node: GoPtr<PropertyAccessExpression>): GoPtr<Node> {
  const visitor = Transformer_Visitor(receiver!.__tsgoEmbedded0) as ConcreteNodeVisitor;
  const nodeAsNode = node as unknown as GoPtr<Node>;
  const expression = NodeVisitor_VisitNode(visitor, Node_Expression(nodeAsNode));
  if (expression !== Node_Expression(nodeAsNode)) {
    return NodeFactory_UpdatePropertyAccessExpression(
      Transformer_Factory(receiver!.__tsgoEmbedded0)!.__tsgoEmbedded0!,
      AsPropertyAccessExpression(nodeAsNode),
      expression as never,
      node!.QuestionDotToken,
      node!.name as never,
      node!.Flags as never,
    );
  }
  return nodeAsNode;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/tstransforms/legacydecorators.go::func::elideNodes","kind":"func","status":"implemented","sigHash":"b077394611a98e9f0b0d0826390b866a9f55c0515b6605265f3850946baf2db1","bodyHash":"943394f2922175019d5c2bf6ce74d004622a7e5ad2fb7c3ef01aa11fadaf29b1"}
 *
 * Go source:
 * func elideNodes(f *printer.NodeFactory, nodes *ast.NodeList) *ast.NodeList {
 * 	if nodes == nil {
 * 		return nil
 * 	}
 * 	if len(nodes.Nodes) == 0 {
 * 		return nodes
 * 	}
 * 	replacement := f.NewNodeList([]*ast.Node{})
 * 	replacement.Loc = nodes.Loc
 * 	return replacement
 * }
 */
export function elideNodes(f: GoPtr<NodeFactory>, nodes: GoPtr<NodeList>): GoPtr<NodeList> {
  if (nodes === undefined) {
    return undefined;
  }
  if (nodes!.Nodes.length === 0) {
    return nodes;
  }
  const replacement = NodeFactory_NewNodeList(f!.__tsgoEmbedded0!, []);
  replacement!.Loc = nodes!.Loc;
  return replacement;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/tstransforms/legacydecorators.go::func::elideModifiers","kind":"func","status":"implemented","sigHash":"c757a3816060a2840ecd75b27ad7512e3c270c1b961edd07032eda5308b47599","bodyHash":"ec61dece868f6b1ba168b1135122c3ad0401d45db6c271e72d515e6c157976bb"}
 *
 * Go source:
 * func elideModifiers(f *printer.NodeFactory, nodes *ast.ModifierList) *ast.ModifierList {
 * 	if nodes == nil {
 * 		return nil
 * 	}
 * 	if len(nodes.Nodes) == 0 {
 * 		return nodes
 * 	}
 * 	replacement := f.NewModifierList([]*ast.Node{})
 * 	replacement.Loc = nodes.Loc
 * 	return replacement
 * }
 */
export function elideModifiers(f: GoPtr<NodeFactory>, nodes: GoPtr<ModifierList>): GoPtr<ModifierList> {
  if (nodes === undefined) {
    return undefined;
  }
  if (nodes!.Nodes.length === 0) {
    return nodes;
  }
  const replacement = NodeFactory_NewModifierList(f!.__tsgoEmbedded0!, []);
  replacement!.Loc = nodes!.Loc;
  return replacement;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/tstransforms/legacydecorators.go::method::LegacyDecoratorsTransformer.finishClassElement","kind":"method","status":"implemented","sigHash":"9f95f5fce996f93b10f1dc05f6f41e1f3f46a091e456891e4faae50938e866f4","bodyHash":"ed6f38ae0ec67ffdac9f3abd7edeca359c66b3c8df0ec459e2daf18120f17420"}
 *
 * Go source:
 * func (tx *LegacyDecoratorsTransformer) finishClassElement(updated *ast.Node, original *ast.Node) *ast.Node {
 * 	if updated != original {
 * 		// While we emit the source map for the node after skipping decorators and modifiers,
 * 		// we need to emit the comments for the original range.
 * 		tx.EmitContext().SetCommentRange(updated, original.Loc)
 * 		tx.EmitContext().SetSourceMapRange(updated, transformers.MoveRangePastModifiers(original))
 * 	}
 * 	return updated
 * }
 */
export function LegacyDecoratorsTransformer_finishClassElement(receiver: GoPtr<LegacyDecoratorsTransformer>, updated: GoPtr<Node>, original: GoPtr<Node>): GoPtr<Node> {
  if (updated !== original) {
    const emitCtx = Transformer_EmitContext(receiver!.__tsgoEmbedded0);
    EmitContext_SetCommentRange(emitCtx, updated, original!.Loc);
    EmitContext_SetSourceMapRange(emitCtx, updated, MoveRangePastModifiers(original));
  }
  return updated;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/tstransforms/legacydecorators.go::method::LegacyDecoratorsTransformer.visitParamerDeclaration","kind":"method","status":"implemented","sigHash":"11d4d14e75a073c45cbcfa686166f77a908e2b65f0b074f7884333ed0e2237e4","bodyHash":"5128ea43bbbdbbf17483be1051dc91943759e6e95064606c68716a55b05af78c"}
 *
 * Go source:
 * func (tx *LegacyDecoratorsTransformer) visitParamerDeclaration(node *ast.ParameterDeclaration) *ast.Node {
 * 	updated := tx.Factory().UpdateParameterDeclaration(
 * 		node,
 * 		elideModifiers(tx.Factory(), node.Modifiers()),
 * 		node.DotDotDotToken,
 * 		tx.Visitor().VisitNode(node.Name()),
 * 		nil,
 * 		nil,
 * 		tx.Visitor().VisitNode(node.Initializer),
 * 	)
 * 	if updated != node.AsNode() {
 * 		// While we emit the source map for the node after skipping decorators and modifiers,
 * 		// we need to emit the comments for the original range.
 * 		tx.EmitContext().SetCommentRange(updated, node.Loc)
 * 		newLoc := transformers.MoveRangePastModifiers(node.AsNode())
 * 		updated.Loc = newLoc
 * 		tx.EmitContext().SetSourceMapRange(updated, newLoc)
 * 		tx.EmitContext().SetEmitFlags(updated.Name(), printer.EFNoTrailingSourceMap)
 * 	}
 * 	return updated
 * }
 */
export function LegacyDecoratorsTransformer_visitParamerDeclaration(receiver: GoPtr<LegacyDecoratorsTransformer>, node: GoPtr<ParameterDeclaration>): GoPtr<Node> {
  const visitor = Transformer_Visitor(receiver!.__tsgoEmbedded0) as ConcreteNodeVisitor;
  const emitCtx = Transformer_EmitContext(receiver!.__tsgoEmbedded0);
  const printerFactory = Transformer_Factory(receiver!.__tsgoEmbedded0);
  const astFactory = printerFactory!.__tsgoEmbedded0!;
  const nodeAsNode = node as unknown as GoPtr<Node>;
  const updated = NodeFactory_UpdateParameterDeclaration(
    astFactory,
    node,
    elideModifiers(printerFactory, Node_Modifiers(nodeAsNode)),
    node!.DotDotDotToken,
    NodeVisitor_VisitNode(visitor, Node_Name(nodeAsNode)) as never,
    undefined,
    undefined,
    NodeVisitor_VisitNode(visitor, node!.Initializer as never) as never,
  );
  if (updated !== nodeAsNode) {
    // While we emit the source map for the node after skipping decorators and modifiers,
    // we need to emit the comments for the original range.
    EmitContext_SetCommentRange(emitCtx, updated, nodeAsNode!.Loc);
    const newLoc = MoveRangePastModifiers(nodeAsNode);
    updated!.Loc = newLoc;
    EmitContext_SetSourceMapRange(emitCtx, updated, newLoc);
    EmitContext_SetEmitFlags(emitCtx, Node_Name(updated), EFNoTrailingSourceMap as never);
  }
  return updated;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/tstransforms/legacydecorators.go::method::LegacyDecoratorsTransformer.visitPropertyNameOfClassElement","kind":"method","status":"implemented","sigHash":"927767a92fe7140c33b5a5842951a84df67cacf549de8fc925df359daaf67442","bodyHash":"c6d7be545acf045fff6dd220f7a3e0aa3bb9d1af4c3f6e69aa8a9996bb9c42ef"}
 *
 * Go source:
 * func (tx *LegacyDecoratorsTransformer) visitPropertyNameOfClassElement(member *ast.Node) *ast.Node {
 * 	name := member.Name()
 * 	if ast.IsComputedPropertyName(name) && ast.HasDecorators(member) {
 * 		expression := tx.Visitor().VisitNode(name.AsComputedPropertyName().Expression)
 * 		innerExpression := ast.SkipPartiallyEmittedExpressions(expression)
 * 		if !transformers.IsSimpleInlineableExpression(innerExpression) {
 * 			generatedName := tx.Factory().NewGeneratedNameForNode(name)
 * 			tx.EmitContext().AddVariableDeclaration(generatedName)
 * 			return tx.Factory().UpdateComputedPropertyName(name.AsComputedPropertyName(), tx.Factory().NewAssignmentExpression(generatedName.AsNode(), expression))
 * 		}
 * 	}
 * 	return tx.Visitor().VisitNode(name)
 * }
 */
export function LegacyDecoratorsTransformer_visitPropertyNameOfClassElement(receiver: GoPtr<LegacyDecoratorsTransformer>, member: GoPtr<Node>): GoPtr<Node> {
  const visitor = Transformer_Visitor(receiver!.__tsgoEmbedded0) as ConcreteNodeVisitor;
  const emitCtx = Transformer_EmitContext(receiver!.__tsgoEmbedded0);
  const printerFactory = Transformer_Factory(receiver!.__tsgoEmbedded0);
  const astFactory = printerFactory!.__tsgoEmbedded0!;
  const name = Node_Name(member);
  if (IsComputedPropertyName(name) && HasDecorators(member)) {
    const cpn = AsComputedPropertyName(name);
    const expression = NodeVisitor_VisitNode(visitor, Node_Expression(name));
    const innerExpression = SkipPartiallyEmittedExpressions(expression as never);
    if (!IsSimpleInlineableExpression(innerExpression as never)) {
      const generatedName = NodeFactory_NewGeneratedNameForNode(printerFactory, name);
      EmitContext_AddVariableDeclaration(emitCtx, generatedName);
      return NodeFactory_UpdateComputedPropertyName(
        astFactory,
        cpn,
        NodeFactory_NewAssignmentExpression(printerFactory, generatedName as unknown as GoPtr<Node>, expression as never) as never,
      );
    }
  }
  return NodeVisitor_VisitNode(visitor, name);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/tstransforms/legacydecorators.go::method::LegacyDecoratorsTransformer.visitPropertyDeclaration","kind":"method","status":"implemented","sigHash":"455d0276a685ef95f28498be857711cd55ede1683956f995d60739a785e91e9a","bodyHash":"fd419ec2d05354e812adbdfc1aaaa9bc1425b9c6b3de12dc199bd6d16788acf7"}
 *
 * Go source:
 * func (tx *LegacyDecoratorsTransformer) visitPropertyDeclaration(node *ast.PropertyDeclaration) *ast.Node {
 * 	if (node.Flags & ast.NodeFlagsAmbient) != 0 {
 * 		return nil
 * 	}
 * 	if ast.HasSyntacticModifier(node.AsNode(), ast.ModifierFlagsAmbient|ast.ModifierFlagsAbstract) {
 * 		return nil
 * 	}
 *
 * 	return tx.finishClassElement(
 * 		tx.Factory().UpdatePropertyDeclaration(
 * 			node,
 * 			tx.Visitor().VisitModifiers(node.Modifiers()),
 * 			tx.visitPropertyNameOfClassElement(node.AsNode()),
 * 			nil,
 * 			nil,
 * 			tx.Visitor().VisitNode(node.Initializer),
 * 		),
 * 		node.AsNode(),
 * 	)
 * }
 */
export function LegacyDecoratorsTransformer_visitPropertyDeclaration(receiver: GoPtr<LegacyDecoratorsTransformer>, node: GoPtr<PropertyDeclaration>): GoPtr<Node> {
  const nodeAsNode = node as unknown as GoPtr<Node>;
  if ((nodeAsNode!.Flags & NodeFlagsAmbient) !== 0) {
    return undefined;
  }
  if (HasSyntacticModifier(nodeAsNode, (ModifierFlagsAmbient | ModifierFlagsAbstract) as never)) {
    return undefined;
  }
  const visitor = Transformer_Visitor(receiver!.__tsgoEmbedded0) as ConcreteNodeVisitor;
  const astFactory = Transformer_Factory(receiver!.__tsgoEmbedded0)!.__tsgoEmbedded0!;
  return LegacyDecoratorsTransformer_finishClassElement(
    receiver,
    NodeFactory_UpdatePropertyDeclaration(
      astFactory,
      node,
      NodeVisitor_VisitModifiers(visitor, Node_Modifiers(nodeAsNode)),
      LegacyDecoratorsTransformer_visitPropertyNameOfClassElement(receiver, nodeAsNode) as never,
      undefined,
      undefined,
      NodeVisitor_VisitNode(visitor, node!.Initializer as never) as never,
    ),
    nodeAsNode,
  );
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/tstransforms/legacydecorators.go::method::LegacyDecoratorsTransformer.visitGetAccessorDeclaration","kind":"method","status":"implemented","sigHash":"9aa5042ed4d0d22e48e2fa228e89ed01dea3010d5a669de2c0c71e3de35d9697","bodyHash":"26caaa8626ae7204bd5d9ebdf3cdb5f62487d520f6852437318859d80e0554c3"}
 *
 * Go source:
 * func (tx *LegacyDecoratorsTransformer) visitGetAccessorDeclaration(node *ast.GetAccessorDeclaration) *ast.Node {
 * 	return tx.finishClassElement(
 * 		tx.Factory().UpdateGetAccessorDeclaration(
 * 			node,
 * 			tx.Visitor().VisitModifiers(node.Modifiers()),
 * 			tx.visitPropertyNameOfClassElement(node.AsNode()),
 * 			nil,
 * 			tx.Visitor().VisitNodes(node.Parameters),
 * 			nil,
 * 			nil,
 * 			tx.Visitor().VisitNode(node.Body),
 * 		),
 * 		node.AsNode(),
 * 	)
 * }
 */
export function LegacyDecoratorsTransformer_visitGetAccessorDeclaration(receiver: GoPtr<LegacyDecoratorsTransformer>, node: GoPtr<GetAccessorDeclaration>): GoPtr<Node> {
  const visitor = Transformer_Visitor(receiver!.__tsgoEmbedded0) as ConcreteNodeVisitor;
  const astFactory = Transformer_Factory(receiver!.__tsgoEmbedded0)!.__tsgoEmbedded0!;
  const nodeAsNode = node as unknown as GoPtr<Node>;
  return LegacyDecoratorsTransformer_finishClassElement(
    receiver,
    NodeFactory_UpdateGetAccessorDeclaration(
      astFactory,
      node,
      NodeVisitor_VisitModifiers(visitor, Node_Modifiers(nodeAsNode)),
      LegacyDecoratorsTransformer_visitPropertyNameOfClassElement(receiver, nodeAsNode) as never,
      undefined,
      NodeVisitor_VisitNodes(visitor, Node_ParameterList(nodeAsNode)) as never,
      undefined,
      undefined,
      NodeVisitor_VisitNode(visitor, Node_Body(nodeAsNode)) as never,
    ),
    nodeAsNode,
  );
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/tstransforms/legacydecorators.go::method::LegacyDecoratorsTransformer.visitSetAccessorDeclaration","kind":"method","status":"implemented","sigHash":"d2291fb4c9be2b6e45e63b4520abe3efe85b61282c6339ccaa877f5e0e400d92","bodyHash":"109116db00f0db05a50d64a824f04f615f1bda8a99632ec366927c4beeb91cca"}
 *
 * Go source:
 * func (tx *LegacyDecoratorsTransformer) visitSetAccessorDeclaration(node *ast.SetAccessorDeclaration) *ast.Node {
 * 	return tx.finishClassElement(
 * 		tx.Factory().UpdateSetAccessorDeclaration(
 * 			node,
 * 			tx.Visitor().VisitModifiers(node.Modifiers()),
 * 			tx.visitPropertyNameOfClassElement(node.AsNode()),
 * 			nil,
 * 			tx.Visitor().VisitNodes(node.Parameters),
 * 			nil,
 * 			nil,
 * 			tx.Visitor().VisitNode(node.Body),
 * 		),
 * 		node.AsNode(),
 * 	)
 * }
 */
export function LegacyDecoratorsTransformer_visitSetAccessorDeclaration(receiver: GoPtr<LegacyDecoratorsTransformer>, node: GoPtr<SetAccessorDeclaration>): GoPtr<Node> {
  const visitor = Transformer_Visitor(receiver!.__tsgoEmbedded0) as ConcreteNodeVisitor;
  const astFactory = Transformer_Factory(receiver!.__tsgoEmbedded0)!.__tsgoEmbedded0!;
  const nodeAsNode = node as unknown as GoPtr<Node>;
  return LegacyDecoratorsTransformer_finishClassElement(
    receiver,
    NodeFactory_UpdateSetAccessorDeclaration(
      astFactory,
      node,
      NodeVisitor_VisitModifiers(visitor, Node_Modifiers(nodeAsNode)),
      LegacyDecoratorsTransformer_visitPropertyNameOfClassElement(receiver, nodeAsNode) as never,
      undefined,
      NodeVisitor_VisitNodes(visitor, Node_ParameterList(nodeAsNode)) as never,
      undefined,
      undefined,
      NodeVisitor_VisitNode(visitor, Node_Body(nodeAsNode)) as never,
    ),
    nodeAsNode,
  );
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/tstransforms/legacydecorators.go::method::LegacyDecoratorsTransformer.visitMethodDeclaration","kind":"method","status":"implemented","sigHash":"4fec2e0af1f22f34d1b000eff4a9750cf07c445739d350a02e42842abff2ec51","bodyHash":"5a04b5a711bf651037483f4c775d3b8323c4d12cab09781c70146f119da7ec40"}
 *
 * Go source:
 * func (tx *LegacyDecoratorsTransformer) visitMethodDeclaration(node *ast.MethodDeclaration) *ast.Node {
 * 	return tx.finishClassElement(
 * 		tx.Factory().UpdateMethodDeclaration(
 * 			node,
 * 			tx.Visitor().VisitModifiers(node.Modifiers()),
 * 			node.AsteriskToken,
 * 			tx.visitPropertyNameOfClassElement(node.AsNode()),
 * 			nil,
 * 			nil,
 * 			tx.Visitor().VisitNodes(node.Parameters),
 * 			nil,
 * 			nil,
 * 			tx.Visitor().VisitNode(node.Body),
 * 		),
 * 		node.AsNode(),
 * 	)
 * }
 */
export function LegacyDecoratorsTransformer_visitMethodDeclaration(receiver: GoPtr<LegacyDecoratorsTransformer>, node: GoPtr<MethodDeclaration>): GoPtr<Node> {
  const visitor = Transformer_Visitor(receiver!.__tsgoEmbedded0) as ConcreteNodeVisitor;
  const astFactory = Transformer_Factory(receiver!.__tsgoEmbedded0)!.__tsgoEmbedded0!;
  const nodeAsNode = node as unknown as GoPtr<Node>;
  return LegacyDecoratorsTransformer_finishClassElement(
    receiver,
    NodeFactory_UpdateMethodDeclaration(
      astFactory,
      node,
      NodeVisitor_VisitModifiers(visitor, Node_Modifiers(nodeAsNode)),
      node!.AsteriskToken,
      LegacyDecoratorsTransformer_visitPropertyNameOfClassElement(receiver, nodeAsNode) as never,
      undefined,
      undefined,
      NodeVisitor_VisitNodes(visitor, Node_ParameterList(nodeAsNode)) as never,
      undefined,
      undefined,
      NodeVisitor_VisitNode(visitor, Node_Body(nodeAsNode)) as never,
    ),
    nodeAsNode,
  );
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/tstransforms/legacydecorators.go::method::LegacyDecoratorsTransformer.visitConstructorDeclaration","kind":"method","status":"implemented","sigHash":"05f81eec9ecd68aba57d2a042e14f43e6769f19b0fc37f523c191ce105e29dc4","bodyHash":"c53af66483edda248d3125d6172d92ca414c22985a62380b7bb52cbdcc11f515"}
 *
 * Go source:
 * func (tx *LegacyDecoratorsTransformer) visitConstructorDeclaration(node *ast.ConstructorDeclaration) *ast.Node {
 * 	return tx.Factory().UpdateConstructorDeclaration(
 * 		node,
 * 		tx.Visitor().VisitModifiers(node.Modifiers()),
 * 		nil,
 * 		tx.Visitor().VisitNodes(node.Parameters),
 * 		nil,
 * 		nil,
 * 		tx.Visitor().VisitNode(node.Body),
 * 	)
 * }
 */
export function LegacyDecoratorsTransformer_visitConstructorDeclaration(receiver: GoPtr<LegacyDecoratorsTransformer>, node: GoPtr<ConstructorDeclaration>): GoPtr<Node> {
  const visitor = Transformer_Visitor(receiver!.__tsgoEmbedded0) as ConcreteNodeVisitor;
  const astFactory = Transformer_Factory(receiver!.__tsgoEmbedded0)!.__tsgoEmbedded0!;
  const nodeAsNode = node as unknown as GoPtr<Node>;
  return NodeFactory_UpdateConstructorDeclaration(
    astFactory,
    node,
    NodeVisitor_VisitModifiers(visitor, Node_Modifiers(nodeAsNode)),
    undefined,
    NodeVisitor_VisitNodes(visitor, Node_ParameterList(nodeAsNode)),
    undefined,
    undefined,
    NodeVisitor_VisitNode(visitor, Node_Body(nodeAsNode)) as never,
  );
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/tstransforms/legacydecorators.go::method::LegacyDecoratorsTransformer.visitClassExpression","kind":"method","status":"implemented","sigHash":"bd4962a140686c14ad08cc14b05ebe8b6e869bcac923d9cc38f6c186e96e6921","bodyHash":"84f494de71741a02c3870394fee195b69d711e691af721e52cb168592d6618a2"}
 *
 * Go source:
 * func (tx *LegacyDecoratorsTransformer) visitClassExpression(node *ast.ClassExpression) *ast.Node {
 * 	// Legacy decorators were not supported on class expressions
 * 	return tx.Factory().UpdateClassExpression(
 * 		node,
 * 		tx.Visitor().VisitModifiers(node.Modifiers()),
 * 		node.Name(),
 * 		nil,
 * 		tx.Visitor().VisitNodes(node.HeritageClauses),
 * 		tx.Visitor().VisitNodes(node.Members),
 * 	)
 * }
 */
export function LegacyDecoratorsTransformer_visitClassExpression(receiver: GoPtr<LegacyDecoratorsTransformer>, node: GoPtr<ClassExpression>): GoPtr<Node> {
  const visitor = Transformer_Visitor(receiver!.__tsgoEmbedded0) as ConcreteNodeVisitor;
  const astFactory = Transformer_Factory(receiver!.__tsgoEmbedded0)!.__tsgoEmbedded0!;
  const nodeAsNode = node as unknown as GoPtr<Node>;
  return NodeFactory_UpdateClassExpression(
    astFactory,
    node,
    NodeVisitor_VisitModifiers(visitor, Node_Modifiers(nodeAsNode)),
    node!.name,
    undefined,
    NodeVisitor_VisitNodes(visitor, node!.HeritageClauses),
    NodeVisitor_VisitNodes(visitor, node!.Members),
  );
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/tstransforms/legacydecorators.go::method::LegacyDecoratorsTransformer.visitClassDeclaration","kind":"method","status":"implemented","sigHash":"6ea95528223e453a184aaf2808ba65740f42e8783f7ff84e4cd5e67470fccb90","bodyHash":"5ce7ad72b626870794ff912d900160eb4d208f1009c6b925969be4f76b76fe0b"}
 *
 * Go source:
 * func (tx *LegacyDecoratorsTransformer) visitClassDeclaration(node *ast.ClassDeclaration) *ast.Node {
 * 	decorated := ast.ClassOrConstructorParameterIsDecorated(true, node.AsNode())
 * 	if !(decorated || ast.ChildIsDecorated(true, node.AsNode(), nil)) {
 * 		return tx.Visitor().VisitEachChild(node.AsNode())
 * 	}
 *
 * 	if decorated {
 * 		return tx.transformClassDeclarationWithClassDecorators(node, node.Name())
 * 	}
 * 	return tx.transformClassDeclarationWithoutClassDecorators(node, node.Name())
 * }
 */
export function LegacyDecoratorsTransformer_visitClassDeclaration(receiver: GoPtr<LegacyDecoratorsTransformer>, node: GoPtr<ClassDeclaration>): GoPtr<Node> {
  const nodeAsNode = node as unknown as GoPtr<Node>;
  const visitor = Transformer_Visitor(receiver!.__tsgoEmbedded0) as ConcreteNodeVisitor;
  const decorated = ClassOrConstructorParameterIsDecorated(true as bool, nodeAsNode);
  if (!(decorated || ChildIsDecorated(true as bool, nodeAsNode, undefined))) {
    return NodeVisitor_VisitEachChild(visitor, nodeAsNode);
  }
  if (decorated) {
    return LegacyDecoratorsTransformer_transformClassDeclarationWithClassDecorators(receiver, node, node!.name as unknown as GoPtr<DeclarationName>);
  }
  return LegacyDecoratorsTransformer_transformClassDeclarationWithoutClassDecorators(receiver, node, node!.name as unknown as GoPtr<DeclarationName>);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/tstransforms/legacydecorators.go::method::LegacyDecoratorsTransformer.transformClassDeclarationWithoutClassDecorators","kind":"method","status":"implemented","sigHash":"5ad776853a6033991794f5eb9095fef9385dbd6f943a7c33c99c2cc43c44b729","bodyHash":"57bb1fc8581514999d145606a2c5de14f21f75de1cfdc447723163c924a6308a"}
 *
 * Go source:
 * func (tx *LegacyDecoratorsTransformer) transformClassDeclarationWithoutClassDecorators(node *ast.ClassDeclaration, name *ast.DeclarationName) *ast.Node {
 * 	//  ${modifiers} class ${name} ${heritageClauses} {
 * 	//      ${members}
 * 	//  }
 * 	modifiers := tx.Visitor().VisitModifiers(node.Modifiers())
 * 	heritageClauses := tx.Visitor().VisitNodes(node.HeritageClauses)
 * 	initialMembers := tx.Visitor().VisitNodes(node.Members)
 * 	members, decorationStatements := tx.transformDecoratorsOfClassElements(node, initialMembers)
 *
 * 	if name == nil && len(decorationStatements) > 0 {
 * 		name = tx.Factory().NewGeneratedNameForNode(node.AsNode())
 * 	}
 *
 * 	updated := tx.Factory().UpdateClassDeclaration(
 * 		node,
 * 		modifiers,
 * 		name,
 * 		nil,
 * 		heritageClauses,
 * 		members,
 * 	)
 *
 * 	if len(decorationStatements) == 0 {
 * 		return updated
 * 	}
 * 	return tx.Factory().NewSyntaxList(append([]*ast.Node{updated}, decorationStatements...))
 * }
 */
export function LegacyDecoratorsTransformer_transformClassDeclarationWithoutClassDecorators(receiver: GoPtr<LegacyDecoratorsTransformer>, node: GoPtr<ClassDeclaration>, name: GoPtr<DeclarationName>): GoPtr<Node> {
  const visitor = Transformer_Visitor(receiver!.__tsgoEmbedded0) as ConcreteNodeVisitor;
  const printerFactory = Transformer_Factory(receiver!.__tsgoEmbedded0);
  const astFactory = printerFactory!.__tsgoEmbedded0!;
  const modifiers = NodeVisitor_VisitModifiers(visitor, Node_Modifiers(node as unknown as GoPtr<Node>));
  const heritageClauses = NodeVisitor_VisitNodes(visitor, node!.HeritageClauses);
  const initialMembers = NodeVisitor_VisitNodes(visitor, node!.Members);
  const [members, decorationStatements] = LegacyDecoratorsTransformer_transformDecoratorsOfClassElements(receiver, node, initialMembers);
  const resolvedName = (name === undefined && decorationStatements.length > 0)
    ? NodeFactory_NewGeneratedNameForNode(printerFactory, node as unknown as GoPtr<Node>) as unknown as GoPtr<DeclarationName>
    : name;
  const updated = NodeFactory_UpdateClassDeclaration(
    astFactory,
    node,
    modifiers,
    resolvedName as unknown as GoPtr<IdentifierNode>,
    undefined,
    heritageClauses,
    members,
  );
  if (decorationStatements.length === 0) {
    return updated;
  }
  return NewSyntaxList(astFactory, [updated, ...decorationStatements]);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/tstransforms/legacydecorators.go::method::LegacyDecoratorsTransformer.popEnclosingClass","kind":"method","status":"implemented","sigHash":"de792b36a116f56097345648c810d2bc2d395098e75d0d3d3e83fdd7cec0102f","bodyHash":"97544990d7b516d6e97ad0c020d3ed7ec313b9118717cde4227b80f349ae7e43"}
 *
 * Go source:
 * func (tx *LegacyDecoratorsTransformer) popEnclosingClass() {
 * 	tx.enclosingClasses = tx.enclosingClasses[:len(tx.enclosingClasses)-1]
 * }
 */
export function LegacyDecoratorsTransformer_popEnclosingClass(receiver: GoPtr<LegacyDecoratorsTransformer>): void {
  receiver!.enclosingClasses = receiver!.enclosingClasses.slice(0, receiver!.enclosingClasses.length - 1);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/tstransforms/legacydecorators.go::method::LegacyDecoratorsTransformer.pushEnclosingClass","kind":"method","status":"implemented","sigHash":"52202d2f5deefff8dc7f0cb517c50b4e3f4073f05fc475c12163382745a3b676","bodyHash":"0da5686449258ad7d22f2363ddd5ae29da22932af2082773d7d6a6e758badca5"}
 *
 * Go source:
 * func (tx *LegacyDecoratorsTransformer) pushEnclosingClass(cls *ast.ClassDeclaration) {
 * 	tx.enclosingClasses = append(tx.enclosingClasses, cls)
 * }
 */
export function LegacyDecoratorsTransformer_pushEnclosingClass(receiver: GoPtr<LegacyDecoratorsTransformer>, cls: GoPtr<ClassDeclaration>): void {
  receiver!.enclosingClasses = [...receiver!.enclosingClasses, cls];
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/tstransforms/legacydecorators.go::method::LegacyDecoratorsTransformer.transformClassDeclarationWithClassDecorators","kind":"method","status":"implemented","sigHash":"321e9372200c04011123ce2dfdcea24a7acb8c7b5c428b5718e66fb5c866058c","bodyHash":"f455adddf1d48e18285e0b32ed7a071a9619233358850943a0730de9392a445e"}
 *
 * Go source:
 * func (tx *LegacyDecoratorsTransformer) transformClassDeclarationWithClassDecorators(node *ast.ClassDeclaration, name *ast.DeclarationName) *ast.Node {
 * 	// When we emit an ES6 class that has a class decorator, we must tailor the
 * 	// emit to certain specific cases.
 * 	//
 * 	// In the simplest case, we emit the class declaration as a let declaration, and
 * 	// evaluate decorators after the close of the class body:
 * 	//
 * 	//  [Example 1]
 * 	//  ---------------------------------------------------------------------
 * 	//  TypeScript                      | Javascript
 * 	//  ---------------------------------------------------------------------
 * 	//  @dec                            | let C = class C {
 * 	//  class C {                       | }
 * 	//  }                               | C = __decorate([dec], C);
 * 	//  ---------------------------------------------------------------------
 * 	//  @dec                            | let C = class C {
 * 	//  export class C {                | }
 * 	//  }                               | C = __decorate([dec], C);
 * 	//                                  | export { C };
 * 	//  ---------------------------------------------------------------------
 * 	//
 * 	// If a class declaration contains a reference to itself *inside* of the class body,
 * 	// this introduces two bindings to the class: One outside of the class body, and one
 * 	// inside of the class body. If we apply decorators as in [Example 1] above, there
 * 	// is the possibility that the decorator `dec` will return a new value for the
 * 	// constructor, which would result in the binding inside of the class no longer
 * 	// pointing to the same reference as the binding outside of the class.
 * 	//
 * 	// As a result, we must instead rewrite all references to the class *inside* of the
 * 	// class body to instead point to a local temporary alias for the class:
 * 	//
 * 	//  [Example 2]
 * 	//  ---------------------------------------------------------------------
 * 	//  TypeScript                      | Javascript
 * 	//  ---------------------------------------------------------------------
 * 	//  @dec                            | let C = C_1 = class C {
 * 	//  class C {                       |   static x() { return C_1.y; }
 * 	//    static x() { return C.y; }    | }
 * 	//    static y = 1;                 | C.y = 1;
 * 	//  }                               | C = C_1 = __decorate([dec], C);
 * 	//                                  | var C_1;
 * 	//  ---------------------------------------------------------------------
 * 	//  @dec                            | let C = class C {
 * 	//  export class C {                |   static x() { return C_1.y; }
 * 	//    static x() { return C.y; }    | }
 * 	//    static y = 1;                 | C.y = 1;
 * 	//  }                               | C = C_1 = __decorate([dec], C);
 * 	//                                  | export { C };
 * 	//                                  | var C_1;
 * 	//  ---------------------------------------------------------------------
 * 	//
 * 	// If a class declaration is the default export of a module, we instead emit
 * 	// the export after the decorated declaration:
 * 	//
 * 	//  [Example 3]
 * 	//  ---------------------------------------------------------------------
 * 	//  TypeScript                      | Javascript
 * 	//  ---------------------------------------------------------------------
 * 	//  @dec                            | let default_1 = class {
 * 	//  export default class {          | }
 * 	//  }                               | default_1 = __decorate([dec], default_1);
 * 	//                                  | export default default_1;
 * 	//  ---------------------------------------------------------------------
 * 	//  @dec                            | let C = class C {
 * 	//  export default class C {        | }
 * 	//  }                               | C = __decorate([dec], C);
 * 	//                                  | export default C;
 * 	//  ---------------------------------------------------------------------
 * 	//
 * 	// If the class declaration is the default export and a reference to itself
 * 	// inside of the class body, we must emit both an alias for the class *and*
 * 	// move the export after the declaration:
 * 	//
 * 	//  [Example 4]
 * 	//  ---------------------------------------------------------------------
 * 	//  TypeScript                      | Javascript
 * 	//  ---------------------------------------------------------------------
 * 	//  @dec                            | let C = class C {
 * 	//  export default class C {        |   static x() { return C_1.y; }
 * 	//    static x() { return C.y; }    | }
 * 	//    static y = 1;                 | C.y = 1;
 * 	//  }                               | C = C_1 = __decorate([dec], C);
 * 	//                                  | export default C;
 * 	//                                  | var C_1;
 * 	//  ---------------------------------------------------------------------
 * 	//
 * 
 * 	isExport := ast.HasSyntacticModifier(node.AsNode(), ast.ModifierFlagsExport)
 * 	isDefault := ast.HasSyntacticModifier(node.AsNode(), ast.ModifierFlagsDefault)
 * 	var modifiers *ast.ModifierList
 * 	if node.Modifiers() != nil && len(node.Modifiers().Nodes) > 0 {
 * 		modifierNodes := core.Filter(node.Modifiers().Nodes, isNotExportOrDefaultOrDecorator)
 * 		if len(modifierNodes) != len(node.Modifiers().Nodes) {
 * 			modifiers = tx.Factory().NewModifierList(modifierNodes)
 * 			modifiers.Loc = node.Modifiers().Loc
 * 		} else {
 * 			modifiers = node.Modifiers()
 * 		}
 * 	}
 * 
 * 	location := transformers.MoveRangePastModifiers(node.AsNode())
 * 	classAlias := tx.getClassAliasIfNeeded(node)
 * 	if classAlias != nil {
 * 		tx.pushEnclosingClass(node)
 * 		defer tx.popEnclosingClass()
 * 	}
 * 
 * 	// When we used to transform to ES5/3 this would be moved inside an IIFE and should reference the name
 * 	// without any block-scoped variable collision handling - but we don't support that anymore, so we always
 * 	// use the local name for the class
 * 	declName := tx.Factory().GetLocalNameEx(node.AsNode(), printer.AssignedNameOptions{AllowComments: false, AllowSourceMaps: true})
 * 
 * 	//  ... = class ${name} ${heritageClauses} {
 * 	//      ${members}
 * 	//  }
 * 	heritageClauses := tx.Visitor().VisitNodes(node.HeritageClauses)
 * 	members := tx.Visitor().VisitNodes(node.Members)
 * 
 * 	members, decorationStatements := tx.transformDecoratorsOfClassElements(node, members)
 * 
 * 	// If we're emitting to ES2022 or later then we need to reassign the class alias before
 * 	// static initializers are evaluated.
 * 	assignClassAliasInStaticBlock := tx.languageVersion >= core.ScriptTargetES2022 && classAlias != nil && members != nil && len(members.Nodes) > 0 && core.Some(members.Nodes, isClassStaticBlockDeclarationOrStaticProperty)
 * 	if assignClassAliasInStaticBlock {
 * 		memberList := []*ast.Node{}
 * 		memberList = append(memberList, tx.Factory().NewClassStaticBlockDeclaration(nil, tx.Factory().NewBlock(
 * 			tx.Factory().NewNodeList([]*ast.Node{tx.Factory().NewExpressionStatement(
 * 				tx.Factory().NewAssignmentExpression(classAlias, tx.Factory().NewKeywordExpression(ast.KindThisKeyword)),
 * 			)}),
 * 			false,
 * 		)))
 * 		memberList = append(memberList, members.Nodes...)
 * 		newList := tx.Factory().NewNodeList(memberList)
 * 		newList.Loc = members.Loc
 * 		members = newList
 * 	}
 * 
 * 	exprName := name
 * 	if name != nil && transformers.IsGeneratedIdentifier(tx.EmitContext(), name) {
 * 		exprName = nil
 * 	}
 * 	classExpression := tx.Factory().NewClassExpression(
 * 		modifiers,
 * 		exprName,
 * 		nil,
 * 		heritageClauses,
 * 		members,
 * 	)
 * 
 * 	tx.EmitContext().SetOriginal(classExpression, node.AsNode())
 * 	classExpression.Loc = location
 * 
 * 	//  let ${name} = ${classExpression} where name is either declaredName if the class doesn't contain self-reference
 * 	//                                         or decoratedClassAlias if the class contain self-reference.
 * 	varInitializer := classExpression
 * 	if classAlias != nil && !assignClassAliasInStaticBlock {
 * 		varInitializer = tx.Factory().NewAssignmentExpression(classAlias, classExpression)
 * 	}
 * 	varDecl := tx.Factory().NewVariableDeclaration(
 * 		declName,
 * 		nil,
 * 		nil,
 * 		varInitializer,
 * 	)
 * 	tx.EmitContext().SetOriginal(varDecl, node.AsNode())
 * 
 * 	varDeclList := tx.Factory().NewVariableDeclarationList(tx.Factory().NewNodeList([]*ast.Node{varDecl}), ast.NodeFlagsLet)
 * 	varStatement := tx.Factory().NewVariableStatement(nil, varDeclList)
 * 	tx.EmitContext().SetOriginal(varStatement, node.AsNode())
 * 	varStatement.Loc = location
 * 	tx.EmitContext().SetCommentRange(varStatement, node.Loc)
 * 
 * 	statements := []*ast.Node{varStatement}
 * 	statements = append(statements, decorationStatements...)
 * 	statements = append(statements, tx.getConstructorDecorationStatement(node))
 * 
 * 	if isExport {
 * 		var exportStatement *ast.Node
 * 		if isDefault {
 * 			exportStatement = tx.Factory().NewExportDefault(declName)
 * 		} else {
 * 			exportStatement = tx.Factory().NewExternalModuleExport(tx.Factory().GetDeclarationName(node.AsNode()))
 * 		}
 * 		statements = append(statements, exportStatement)
 * 	}
 * 
 * 	if len(statements) == 1 {
 * 		return statements[0]
 * 	}
 * 	return tx.Factory().NewSyntaxList(statements)
 * }
 */
export function LegacyDecoratorsTransformer_transformClassDeclarationWithClassDecorators(receiver: GoPtr<LegacyDecoratorsTransformer>, node: GoPtr<ClassDeclaration>, name: GoPtr<DeclarationName>): GoPtr<Node> {
  const nodeAsNode = node as unknown as GoPtr<Node>;
  const visitor = Transformer_Visitor(receiver!.__tsgoEmbedded0) as ConcreteNodeVisitor;
  const printerFactory = Transformer_Factory(receiver!.__tsgoEmbedded0);
  const astFactory = printerFactory!.__tsgoEmbedded0!;
  const emitCtx = Transformer_EmitContext(receiver!.__tsgoEmbedded0);

  const isExport = HasSyntacticModifier(nodeAsNode, ModifierFlagsExport as never);
  const isDefault = HasSyntacticModifier(nodeAsNode, ModifierFlagsDefault as never);

  const nodeModifiers = Node_Modifiers(nodeAsNode);
  const modifiers: GoPtr<ModifierList> = (nodeModifiers !== undefined && nodeModifiers!.Nodes.length > 0)
    ? (() => {
        const modifierNodes = Filter(nodeModifiers!.Nodes, isNotExportOrDefaultOrDecorator);
        if (modifierNodes.length !== nodeModifiers!.Nodes.length) {
          const newMods = NodeFactory_NewModifierList(astFactory, modifierNodes);
          newMods!.Loc = nodeModifiers!.Loc;
          return newMods;
        }
        return nodeModifiers;
      })()
    : nodeModifiers;

  const location = MoveRangePastModifiers(nodeAsNode);
  const classAlias = LegacyDecoratorsTransformer_getClassAliasIfNeeded(receiver, node);
  if (classAlias !== undefined) {
    LegacyDecoratorsTransformer_pushEnclosingClass(receiver, node);
  }

  const declName = NodeFactory_GetLocalNameEx(printerFactory, nodeAsNode as never, { AllowComments: false, AllowSourceMaps: true } as AssignedNameOptions);

  const heritageClauses = NodeVisitor_VisitNodes(visitor, node!.HeritageClauses);
  const visitedMembers = NodeVisitor_VisitNodes(visitor, node!.Members);
  const [members0, decorationStatements] = LegacyDecoratorsTransformer_transformDecoratorsOfClassElements(receiver, node, visitedMembers);

  const assignClassAliasInStaticBlock = receiver!.languageVersion >= ScriptTargetES2022 && classAlias !== undefined && members0 !== undefined && members0!.Nodes.length > 0 && Some(members0!.Nodes, isClassStaticBlockDeclarationOrStaticProperty);

  const members: GoPtr<NodeList> = assignClassAliasInStaticBlock
    ? (() => {
        const memberNodes: GoSlice<GoPtr<Node>> = members0 !== undefined ? [...members0!.Nodes] : [];
        const staticBlockStmt = NodeFactory_NewNodeList(astFactory, [
          NewExpressionStatement(astFactory, NodeFactory_NewAssignmentExpression(printerFactory, classAlias as never, NewKeywordExpression(astFactory, KindThisKeyword) as never) as never),
        ]);
        const staticBlock = NewClassStaticBlockDeclaration(astFactory, undefined, NewBlock(astFactory, staticBlockStmt as never, false as bool) as never);
        const newMemberNodes = [staticBlock, ...memberNodes];
        const newList = NodeFactory_NewNodeList(astFactory, newMemberNodes);
        newList!.Loc = members0!.Loc;
        return newList;
      })()
    : members0;

  const exprName = (name !== undefined && IsGeneratedIdentifier(emitCtx, name as unknown as GoPtr<IdentifierNode>))
    ? undefined
    : name;

  const classExpression = NewClassExpression(
    astFactory,
    modifiers,
    exprName as unknown as GoPtr<IdentifierNode>,
    undefined,
    heritageClauses,
    members as never,
  );
  EmitContext_SetOriginal(emitCtx, classExpression, nodeAsNode);
  classExpression!.Loc = location;

  const varInitializer: GoPtr<Node> = (classAlias !== undefined && !assignClassAliasInStaticBlock)
    ? NodeFactory_NewAssignmentExpression(printerFactory, classAlias as never, classExpression as never) as unknown as GoPtr<Node>
    : classExpression;

  const varDecl = NewVariableDeclaration(astFactory, declName as never, undefined, undefined, varInitializer as never);
  EmitContext_SetOriginal(emitCtx, varDecl, nodeAsNode);

  const varDeclList = NewVariableDeclarationList(astFactory, NodeFactory_NewNodeList(astFactory, [varDecl]) as never, NodeFlagsLet);
  const varStatement = NewVariableStatement(astFactory, undefined, varDeclList as never);
  EmitContext_SetOriginal(emitCtx, varStatement, nodeAsNode);
  varStatement!.Loc = location;
  EmitContext_SetCommentRange(emitCtx, varStatement, nodeAsNode!.Loc);

  const constructorDecorationStmt = LegacyDecoratorsTransformer_getConstructorDecorationStatement(receiver, node);
  const statements: GoSlice<GoPtr<Node>> = [
    varStatement,
    ...decorationStatements,
    ...(constructorDecorationStmt !== undefined ? [constructorDecorationStmt] : []),
  ];

  if (isExport) {
    const exportStatement: GoPtr<Node> = isDefault
      ? NodeFactory_NewExportDefault(printerFactory, declName as never) as unknown as GoPtr<Node>
      : NodeFactory_NewExternalModuleExport(printerFactory, NodeFactory_GetDeclarationName(printerFactory, nodeAsNode as never) as GoPtr<IdentifierNode>) as unknown as GoPtr<Node>;
    statements.push(exportStatement);
  }

  if (classAlias !== undefined) {
    LegacyDecoratorsTransformer_popEnclosingClass(receiver);
  }

  if (statements.length === 1) {
    return statements[0];
  }
  return NewSyntaxList(astFactory, statements);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/tstransforms/legacydecorators.go::method::LegacyDecoratorsTransformer.hasInternalStaticReference","kind":"method","status":"implemented","sigHash":"59771aef622e0faf1b2b183c31346dee795bbe1d637705ce781f674858cd8f46","bodyHash":"76323cbea7637d910542b191c0967338b803bda97576a3d1d332fc43c734b461"}
 *
 * Go source:
 * func (tx *LegacyDecoratorsTransformer) hasInternalStaticReference(node *ast.ClassDeclaration) bool {
 * 	classNode := tx.EmitContext().MostOriginal(node.AsNode())
 * 	var isOrContainsStaticSelfReference func(n *ast.Node) bool
 * 	isOrContainsStaticSelfReference = func(n *ast.Node) bool {
 * 		if ast.IsIdentifier(n) && tx.referenceResolver.GetReferencedValueDeclaration(tx.EmitContext().MostOriginal(n)) == classNode {
 * 			return true
 * 		}
 * 		// For PropertyAccessExpression, only check the expression, not the name.
 * 		// The .Name() is a property access name, not a value reference to the class.
 * 		if ast.IsPropertyAccessExpression(n) {
 * 			return isOrContainsStaticSelfReference(n.Expression())
 * 		}
 * 		return n.ForEachChild(isOrContainsStaticSelfReference)
 * 	}
 * 	for _, member := range node.Members.Nodes {
 * 		if member.ForEachChild(isOrContainsStaticSelfReference) {
 * 			return true
 * 		}
 * 	}
 * 	return false
 * }
 */
export function LegacyDecoratorsTransformer_hasInternalStaticReference(receiver: GoPtr<LegacyDecoratorsTransformer>, node: GoPtr<ClassDeclaration>): bool {
  const emitCtx = Transformer_EmitContext(receiver!.__tsgoEmbedded0);
  const classNode = EmitContext_MostOriginal(emitCtx, node as unknown as GoPtr<Node>);
  const isOrContainsStaticSelfReference = (n: GoPtr<Node>): bool => {
    if (IsIdentifier(n) && receiver!.referenceResolver.GetReferencedValueDeclaration(EmitContext_MostOriginal(emitCtx, n) as unknown as GoPtr<IdentifierNode>) === classNode) {
      return true as bool;
    }
    if (IsPropertyAccessExpression(n)) {
      return isOrContainsStaticSelfReference(Node_Expression(n));
    }
    return Node_ForEachChild(n, isOrContainsStaticSelfReference);
  };
  const members = node!.Members;
  if (members === undefined) {
    return false as bool;
  }
  for (const member of members!.Nodes) {
    if (Node_ForEachChild(member, isOrContainsStaticSelfReference)) {
      return true as bool;
    }
  }
  return false as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/tstransforms/legacydecorators.go::method::LegacyDecoratorsTransformer.getClassAliasIfNeeded","kind":"method","status":"implemented","sigHash":"ab5b4e7e07989080147a2e0dbccf32b4c7eb72ff851f70912002dcb0d9c06823","bodyHash":"5fb802fcebbb555f03eab83119db260f264bec17ac3745e254b8bd4868e98bee"}
 *
 * Go source:
 * func (tx *LegacyDecoratorsTransformer) getClassAliasIfNeeded(node *ast.ClassDeclaration) *ast.Node {
 * 	if !tx.hasInternalStaticReference(node) {
 * 		return nil
 * 	}
 * 	nameText := "default"
 * 	if node.Name() != nil && !transformers.IsGeneratedIdentifier(tx.EmitContext(), node.Name()) {
 * 		nameText = node.Name().Text()
 * 	}
 *
 * 	classAlias := tx.Factory().NewUniqueName(nameText)
 * 	tx.EmitContext().AddVariableDeclaration(classAlias)
 * 	tx.classAliases[node.AsNode()] = classAlias
 *
 * 	return classAlias
 * }
 */
export function LegacyDecoratorsTransformer_getClassAliasIfNeeded(receiver: GoPtr<LegacyDecoratorsTransformer>, node: GoPtr<ClassDeclaration>): GoPtr<Node> {
  if (!LegacyDecoratorsTransformer_hasInternalStaticReference(receiver, node)) {
    return undefined;
  }
  const emitCtx = Transformer_EmitContext(receiver!.__tsgoEmbedded0);
  const printerFactory = Transformer_Factory(receiver!.__tsgoEmbedded0);
  const nodeName = node!.name;
  const nameText: string = (nodeName !== undefined && !IsGeneratedIdentifier(emitCtx, nodeName as unknown as GoPtr<IdentifierNode>))
    ? (nodeName as unknown as GoPtr<Identifier>)!.Text
    : "default";
  const classAlias = NodeFactory_NewUniqueName(printerFactory, nameText);
  EmitContext_AddVariableDeclaration(emitCtx, classAlias);
  receiver!.classAliases.set(node as unknown as GoPtr<Node>, classAlias as unknown as GoPtr<Node>);
  return classAlias as unknown as GoPtr<Node>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/tstransforms/legacydecorators.go::method::LegacyDecoratorsTransformer.getConstructorDecorationStatement","kind":"method","status":"implemented","sigHash":"02451a6860c0590c6008ec72ae90ea889c9e6bda4f00e0404017792d0aec016b","bodyHash":"0a24395551926b6420305c5b5f45023c09c9d97b5da8219fd68ebb8edbe4ac20"}
 *
 * Go source:
 * func (tx *LegacyDecoratorsTransformer) getConstructorDecorationStatement(node *ast.ClassDeclaration) *ast.Node {
 * 	expression := tx.generateConstructorDecorationExpression(node)
 * 	if expression != nil {
 * 		result := tx.Factory().NewExpressionStatement(expression)
 * 		tx.EmitContext().SetOriginal(result, node.AsNode())
 * 		return result
 * 	}
 * 	return nil
 * }
 */
export function LegacyDecoratorsTransformer_getConstructorDecorationStatement(receiver: GoPtr<LegacyDecoratorsTransformer>, node: GoPtr<ClassDeclaration>): GoPtr<Node> {
  const expression = LegacyDecoratorsTransformer_generateConstructorDecorationExpression(receiver, node);
  if (expression !== undefined) {
    const astFactory = Transformer_Factory(receiver!.__tsgoEmbedded0)!.__tsgoEmbedded0!;
    const emitCtx = Transformer_EmitContext(receiver!.__tsgoEmbedded0);
    const result = NewExpressionStatement(astFactory, expression as never);
    EmitContext_SetOriginal(emitCtx, result, node as unknown as GoPtr<Node>);
    return result;
  }
  return undefined;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/tstransforms/legacydecorators.go::method::LegacyDecoratorsTransformer.generateConstructorDecorationExpression","kind":"method","status":"implemented","sigHash":"cf00711fb06a148e0162149523f30a547329eb71088b409ae0d77cf65d94d005","bodyHash":"995677b59b19df2bd3b47b266213b0cad928a973ff4e25618da3fd90085d0a95"}
 *
 * Go source:
 * func (tx *LegacyDecoratorsTransformer) generateConstructorDecorationExpression(node *ast.ClassDeclaration) *ast.Node {
 * 	allDecorators := getAllDecoratorsOfClass(node, true)
 * 	// Decorator expressions are evaluated outside the class body, so references to the
 * 	// class name should use the original binding, not the class alias. In Strada, this is
 * 	// handled by NodeCheckFlags.ConstructorReference which is only set for identifiers
 * 	// inside the class body. Since Corsa lacks per-node flags, we temporarily pop the
 * 	// enclosing class to prevent alias substitution during decorator expression visiting.
 * 	hasAlias := len(tx.enclosingClasses) > 0 && tx.enclosingClasses[len(tx.enclosingClasses)-1] == node
 * 	if hasAlias {
 * 		tx.popEnclosingClass()
 * 	}
 * 	decoratorExpressions := tx.transformAllDecoratorsOfDeclaration(allDecorators)
 * 	if hasAlias {
 * 		tx.pushEnclosingClass(node)
 * 	}
 * 	if len(decoratorExpressions) == 0 {
 * 		return nil
 * 	}
 *
 * 	var classAlias *ast.Node
 * 	if tx.classAliases != nil {
 * 		classAlias, _ = tx.classAliases[node.AsNode()]
 * 	}
 *
 * 	// When we used to transform to ES5/3 this would be moved inside an IIFE and should reference the name
 * 	// without any block-scoped variable collision handling - but we don't support that anymore, so we always
 * 	// use the local name for the class
 * 	localName := tx.Factory().GetDeclarationNameEx(node.AsNode(), printer.NameOptions{AllowComments: false, AllowSourceMaps: true})
 * 	decorate := tx.Factory().NewDecorateHelper(decoratorExpressions, localName, nil, nil)
 * 	assignmentTarget := decorate
 * 	if classAlias != nil {
 * 		assignmentTarget = tx.Factory().NewAssignmentExpression(classAlias, decorate)
 * 	}
 * 	expression := tx.Factory().NewAssignmentExpression(localName, assignmentTarget)
 * 	tx.EmitContext().SetEmitFlags(expression, printer.EFNoComments)
 * 	tx.EmitContext().SetSourceMapRange(expression, transformers.MoveRangePastModifiers(node.AsNode()))
 * 	return expression
 * }
 */
export function LegacyDecoratorsTransformer_generateConstructorDecorationExpression(receiver: GoPtr<LegacyDecoratorsTransformer>, node: GoPtr<ClassDeclaration>): GoPtr<Node> {
  const allDecorators = getAllDecoratorsOfClass(node, true as bool);
  const nodeAsNode = node as unknown as GoPtr<Node>;
  const hasAlias = receiver!.enclosingClasses.length > 0 && receiver!.enclosingClasses[receiver!.enclosingClasses.length - 1] === node;
  if (hasAlias) {
    LegacyDecoratorsTransformer_popEnclosingClass(receiver);
  }
  const decoratorExpressions = LegacyDecoratorsTransformer_transformAllDecoratorsOfDeclaration(receiver, allDecorators);
  if (hasAlias) {
    LegacyDecoratorsTransformer_pushEnclosingClass(receiver, node);
  }
  if (decoratorExpressions.length === 0) {
    return undefined;
  }
  const emitCtx = Transformer_EmitContext(receiver!.__tsgoEmbedded0);
  const printerFactory = Transformer_Factory(receiver!.__tsgoEmbedded0);
  const classAlias: GoPtr<Node> = receiver!.classAliases !== undefined ? receiver!.classAliases.get(nodeAsNode) : undefined;
  const localName = NodeFactory_GetDeclarationNameEx(printerFactory, nodeAsNode as never, { AllowComments: false, AllowSourceMaps: true } as NameOptions);
  const decorate = NodeFactory_NewDecorateHelper(printerFactory, decoratorExpressions, localName as unknown as GoPtr<Node>, undefined, undefined);
  const assignmentTarget: GoPtr<Node> = classAlias !== undefined
    ? NodeFactory_NewAssignmentExpression(printerFactory, classAlias as never, decorate as never) as unknown as GoPtr<Node>
    : decorate as unknown as GoPtr<Node>;
  const expression = NodeFactory_NewAssignmentExpression(printerFactory, localName as never, assignmentTarget as never);
  EmitContext_SetEmitFlags(emitCtx, expression as unknown as GoPtr<Node>, EFNoComments as never);
  EmitContext_SetSourceMapRange(emitCtx, expression as unknown as GoPtr<Node>, MoveRangePastModifiers(nodeAsNode));
  return expression as unknown as GoPtr<Node>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/tstransforms/legacydecorators.go::func::isClassStaticBlockDeclarationOrStaticProperty","kind":"func","status":"implemented","sigHash":"c63644f3cd8fe0fb33bfe9023bd3234253c45f4adc6646d9a1b56d1a5f4a634d","bodyHash":"6229141ccafaf170fba7ff8b6011ed2c457571ff4a68fb03d5689b8c2a4e7b0e"}
 *
 * Go source:
 * func isClassStaticBlockDeclarationOrStaticProperty(node *ast.Node) bool {
 * 	return ast.IsClassStaticBlockDeclaration(node) || (ast.IsPropertyDeclaration(node) && ast.HasStaticModifier(node))
 * }
 */
export function isClassStaticBlockDeclarationOrStaticProperty(node: GoPtr<Node>): bool {
  return (IsClassStaticBlockDeclaration(node) || (IsPropertyDeclaration(node) && HasStaticModifier(node))) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/tstransforms/legacydecorators.go::func::isNotExportOrDefaultOrDecorator","kind":"func","status":"implemented","sigHash":"69bcec0f5926ad6d8fd6f920d1c344dff54764b67290546e2147da5ce0d87d80","bodyHash":"1a70fd5d62e785591951a2b107e35770ebceb16be9f17248d69b4fbf43bdb431"}
 *
 * Go source:
 * func isNotExportOrDefaultOrDecorator(node *ast.Node) bool {
 * 	return !(ast.IsDecorator(node) || node.Kind == ast.KindExportKeyword || node.Kind == ast.KindDefaultKeyword)
 * }
 */
export function isNotExportOrDefaultOrDecorator(node: GoPtr<Node>): bool {
  return (!(IsDecorator(node) || node!.Kind === KindExportKeyword || node!.Kind === KindDefaultKeyword)) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/tstransforms/legacydecorators.go::func::decoratorContainsPrivateIdentifierInExpression","kind":"func","status":"implemented","sigHash":"c992493abd74651347ae6961904c54ee10db607642f71091dfdd7a93c5fcc8a5","bodyHash":"e73b513af36d9e1588317a6728daf2164cf23d999b7baac0446cc1f625807fa8"}
 *
 * Go source:
 * func decoratorContainsPrivateIdentifierInExpression(decorator *ast.Node) bool {
 * 	return (decorator.SubtreeFacts() & ast.SubtreeContainsPrivateIdentifierInExpression) != 0
 * }
 */
export function decoratorContainsPrivateIdentifierInExpression(decorator: GoPtr<Node>): bool {
  return ((Node_SubtreeFacts(decorator) & SubtreeContainsPrivateIdentifierInExpression) !== 0) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/tstransforms/legacydecorators.go::func::parameterDecoratorsContainPrivateIdentifierInExpression","kind":"func","status":"implemented","sigHash":"fd20333494ece93b8d0d4541943ffc949ad32cd497b408e2ff26100712702806","bodyHash":"0dd148b9bde57816b4f54c69859a168471029cb6126f93b2684a2296332fb5e0"}
 *
 * Go source:
 * func parameterDecoratorsContainPrivateIdentifierInExpression(parameterDecorators []*ast.Node) bool {
 * 	return core.Some(parameterDecorators, decoratorContainsPrivateIdentifierInExpression)
 * }
 */
export function parameterDecoratorsContainPrivateIdentifierInExpression(parameterDecorators: GoSlice<GoPtr<Node>>): bool {
  return Some(parameterDecorators, decoratorContainsPrivateIdentifierInExpression);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/tstransforms/legacydecorators.go::func::hasClassElementWithDecoratorContainingPrivateIdentifierInExpression","kind":"func","status":"implemented","sigHash":"2a438e7927455b6ed19b47ced1f9eac80681f3f87d2e755006f350f9b2ac4927","bodyHash":"415ef00574efb8f02a100326f39a2e78fa3d1b1d91409cba516a304827f0cf1b"}
 *
 * Go source:
 * func hasClassElementWithDecoratorContainingPrivateIdentifierInExpression(node *ast.ClassDeclaration) bool {
 * 	if node.Members == nil || len(node.Members.Nodes) == 0 {
 * 		return false
 * 	}
 * 	for _, member := range node.Members.Nodes {
 * 		if !ast.CanHaveDecorators(member) {
 * 			continue
 * 		}
 * 		allDecorators := getAllDecoratorsOfClassElement(member, node, true)
 * 		if allDecorators == nil {
 * 			continue
 * 		}
 * 		if core.Some(allDecorators.decorators, decoratorContainsPrivateIdentifierInExpression) {
 * 			return true
 * 		}
 * 		if core.Some(allDecorators.parameters, parameterDecoratorsContainPrivateIdentifierInExpression) {
 * 			return true
 * 		}
 * 	}
 * 	return false
 * }
 */
export function hasClassElementWithDecoratorContainingPrivateIdentifierInExpression(node: GoPtr<ClassDeclaration>): bool {
  if (node!.Members === undefined || node!.Members!.Nodes.length === 0) {
    return false as bool;
  }
  for (const member of node!.Members!.Nodes) {
    if (!CanHaveDecorators(member)) {
      continue;
    }
    const allDecs = getAllDecoratorsOfClassElement(member, node, true as bool);
    if (allDecs === undefined) {
      continue;
    }
    if (Some(allDecs!.decorators, decoratorContainsPrivateIdentifierInExpression)) {
      return true as bool;
    }
    if (Some(allDecs!.parameters, parameterDecoratorsContainPrivateIdentifierInExpression)) {
      return true as bool;
    }
  }
  return false as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/tstransforms/legacydecorators.go::type::allDecorators","kind":"type","status":"implemented","sigHash":"e3730293c72cf4bf32bc478a5b918cf16fc71e965e1aa3883d1ced8b856bb706","bodyHash":"10c7e23cf71dd315c01d6cc4fcbd7ea2a30c07e8250db341426a432bbab20e65"}
 *
 * Go source:
 * allDecorators struct {
 * 	decorators []*ast.Node
 * 	parameters [][]*ast.Node
 * }
 */
export interface allDecorators {
  decorators: GoSlice<GoPtr<Node>>;
  parameters: GoSlice<GoSlice<GoPtr<Node>>>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/tstransforms/legacydecorators.go::func::getAllDecoratorsOfClass","kind":"func","status":"implemented","sigHash":"7ef0493a6b9e244572fff922444cdbacc645c3b88d1cabc51cc7928345189958","bodyHash":"01a5a24f4f9b0e180ca0d1114ca775ef78305669e6352442c758fb49533295f0"}
 *
 * Go source:
 * func getAllDecoratorsOfClass(node *ast.ClassDeclaration, useLegacyDecorators bool) *allDecorators {
 * 	decorators := node.Decorators()
 * 	var parameters [][]*ast.Node
 * 	if useLegacyDecorators {
 * 		parameters = getDecoratorsOfParameters(ast.GetFirstConstructorWithBody(node.AsNode()))
 * 	}
 * 	if len(decorators) == 0 && len(parameters) == 0 {
 * 		return nil
 * 	}
 * 	return &allDecorators{decorators: decorators, parameters: parameters}
 * }
 */
export function getAllDecoratorsOfClass(node: GoPtr<ClassDeclaration>, useLegacyDecorators: bool): GoPtr<allDecorators> {
  const nodeAsNode = node as unknown as GoPtr<Node>;
  const decorators = Node_Decorators(nodeAsNode) ?? [];
  const parameters: GoSlice<GoSlice<GoPtr<Node>>> = useLegacyDecorators
    ? getDecoratorsOfParameters(GetFirstConstructorWithBody(nodeAsNode))
    : [];
  if (decorators.length === 0 && parameters.length === 0) {
    return undefined;
  }
  return { decorators, parameters };
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/tstransforms/legacydecorators.go::func::getAllDecoratorsOfClassElement","kind":"func","status":"implemented","sigHash":"08d51b815d1c87417d2f251339df6a0a75bee0837260f3f010729e457545f90d","bodyHash":"0102566c5f4986c0a51876f30173c16a3c44b1b210f29b2fef32f816afb33768"}
 *
 * Go source:
 * func getAllDecoratorsOfClassElement(member *ast.Node, parent *ast.ClassDeclaration, useLegacyDecorators bool) *allDecorators {
 * 	switch member.Kind {
 * 	case ast.KindGetAccessor, ast.KindSetAccessor:
 * 		if !useLegacyDecorators {
 * 			return getAllDecoratorsOfMethod(member, false)
 * 		}
 * 		return getAllDecoratorsOfAccessors(member, parent, true)
 * 	case ast.KindMethodDeclaration:
 * 		return getAllDecoratorsOfMethod(member, useLegacyDecorators)
 * 	case ast.KindPropertyDeclaration:
 * 		return getAllDecoratorsOfProperty(member)
 * 	default:
 * 		return nil
 * 	}
 * }
 */
export function getAllDecoratorsOfClassElement(member: GoPtr<Node>, parent: GoPtr<ClassDeclaration>, useLegacyDecorators: bool): GoPtr<allDecorators> {
  switch (member!.Kind) {
    case KindGetAccessor:
    case KindSetAccessor:
      if (!useLegacyDecorators) {
        return getAllDecoratorsOfMethod(member, false as bool);
      }
      return getAllDecoratorsOfAccessors(member, parent, true as bool);
    case KindMethodDeclaration:
      return getAllDecoratorsOfMethod(member, useLegacyDecorators);
    case KindPropertyDeclaration:
      return getAllDecoratorsOfProperty(member);
    default:
      return undefined;
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/tstransforms/legacydecorators.go::func::getAllDecoratorsOfAccessors","kind":"func","status":"implemented","sigHash":"a7fed915fdc095ee8ab959a81b01c1f34df758e4093c524c20750375de92da9a","bodyHash":"1be4a2a3e0e34a5e7c1a161e7b7861a7b61ae6aa831ce0222cfd1c2bfdd5f786"}
 *
 * Go source:
 * func getAllDecoratorsOfAccessors(accessor *ast.Node, parent *ast.ClassDeclaration, useLegacyDecorators bool) *allDecorators {
 * 	if accessor.Body() == nil {
 * 		return nil
 * 	}
 * 	decls := ast.GetAllAccessorDeclarations(parent.Members.Nodes, accessor)
 * 	var firstAccessorWithDecorators *ast.Node
 * 	if ast.HasDecorators(decls.FirstAccessor) {
 * 		firstAccessorWithDecorators = decls.FirstAccessor
 * 	} else if decls.SecondAccessor != nil && ast.HasDecorators(decls.SecondAccessor) {
 * 		firstAccessorWithDecorators = decls.SecondAccessor
 * 	}
 *
 * 	if firstAccessorWithDecorators == nil || accessor != firstAccessorWithDecorators {
 * 		return nil
 * 	}
 *
 * 	decorators := firstAccessorWithDecorators.Decorators()
 * 	var parameters [][]*ast.Node
 * 	if useLegacyDecorators && decls.SetAccessor != nil {
 * 		parameters = getDecoratorsOfParameters(decls.SetAccessor.AsNode())
 * 	}
 *
 * 	if len(decorators) == 0 && len(parameters) == 0 {
 * 		return nil
 * 	}
 *
 * 	return &allDecorators{
 * 		decorators: decorators,
 * 		parameters: parameters,
 * 	}
 * }
 */
export function getAllDecoratorsOfAccessors(accessor: GoPtr<Node>, parent: GoPtr<ClassDeclaration>, useLegacyDecorators: bool): GoPtr<allDecorators> {
  if (Node_Body(accessor) === undefined) {
    return undefined;
  }
  const memberNodes: GoSlice<GoPtr<Node>> = parent!.Members !== undefined ? parent!.Members!.Nodes : [];
  const decls = GetAllAccessorDeclarations(memberNodes, accessor as unknown as GoPtr<AccessorDeclaration>);
  const firstAccessorWithDecorators: GoPtr<Node> = HasDecorators(decls.FirstAccessor as unknown as GoPtr<Node>)
    ? decls.FirstAccessor as unknown as GoPtr<Node>
    : (decls.SecondAccessor !== undefined && HasDecorators(decls.SecondAccessor as unknown as GoPtr<Node>))
      ? decls.SecondAccessor as unknown as GoPtr<Node>
      : undefined;
  if (firstAccessorWithDecorators === undefined || accessor !== firstAccessorWithDecorators) {
    return undefined;
  }
  const decorators = Node_Decorators(firstAccessorWithDecorators) ?? [];
  const parameters: GoSlice<GoSlice<GoPtr<Node>>> = (useLegacyDecorators && decls.SetAccessor !== undefined)
    ? getDecoratorsOfParameters(decls.SetAccessor as unknown as GoPtr<Node>)
    : [];
  if (decorators.length === 0 && parameters.length === 0) {
    return undefined;
  }
  return { decorators, parameters };
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/tstransforms/legacydecorators.go::func::getAllDecoratorsOfProperty","kind":"func","status":"implemented","sigHash":"50332ba45cb7545192d599d96b8e4de121e6ea1e5d3d9a57a0f723236b0172ed","bodyHash":"4a0ef1e022ccfd432192f69680eaed0e6b0f86c32a3f19c4c767fdc7f287ac39"}
 *
 * Go source:
 * func getAllDecoratorsOfProperty(property *ast.Node) *allDecorators {
 * 	decorators := property.Decorators()
 * 	if len(decorators) == 0 {
 * 		return nil
 * 	}
 * 	return &allDecorators{decorators: decorators}
 * }
 */
export function getAllDecoratorsOfProperty(property: GoPtr<Node>): GoPtr<allDecorators> {
  const decorators = Node_Decorators(property) ?? [];
  if (decorators.length === 0) {
    return undefined;
  }
  return { decorators, parameters: [] };
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/tstransforms/legacydecorators.go::func::getAllDecoratorsOfMethod","kind":"func","status":"implemented","sigHash":"f1fd9da19ee105cf9779432eab2cdc06a7df4c1d241e319287082947de05c741","bodyHash":"4e11a6d461bffb383fb1e0b55c1258f5cbff76a295b52bd0373c7f8342e05011"}
 *
 * Go source:
 * func getAllDecoratorsOfMethod(method *ast.Node, useLegacyDecorators bool) *allDecorators {
 * 	if method.Body() == nil {
 * 		return nil
 * 	}
 * 	decorators := method.Decorators()
 * 	var parameters [][]*ast.Node
 * 	if useLegacyDecorators {
 * 		parameters = getDecoratorsOfParameters(method)
 * 	}
 * 	if len(decorators) == 0 && len(parameters) == 0 {
 * 		return nil
 * 	}
 * 	return &allDecorators{decorators: decorators, parameters: parameters}
 * }
 */
export function getAllDecoratorsOfMethod(method: GoPtr<Node>, useLegacyDecorators: bool): GoPtr<allDecorators> {
  if (Node_Body(method) === undefined) {
    return undefined;
  }
  const decorators = Node_Decorators(method) ?? [];
  const parameters: GoSlice<GoSlice<GoPtr<Node>>> = useLegacyDecorators
    ? getDecoratorsOfParameters(method)
    : [];
  if (decorators.length === 0 && parameters.length === 0) {
    return undefined;
  }
  return { decorators, parameters };
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/tstransforms/legacydecorators.go::func::getDecoratorsOfParameters","kind":"func","status":"implemented","sigHash":"01f06d15c4f928e90cbaaf816fe518c7e21b669d12e9621fb409992b32ed9697","bodyHash":"035f21b7feec6f8247916b3efe82c29907c1fd3248daf7fd0e51d75ecdefef8a"}
 *
 * Go source:
 * func getDecoratorsOfParameters(node *ast.Node) [][]*ast.Node {
 * 	var decorators [][]*ast.Node
 * 	if node != nil {
 * 		parameters := node.Parameters()
 * 		firstParameterIsThis := len(parameters) > 0 && ast.IsThisParameter(parameters[0])
 * 		firstParameterOffset := 0
 * 		numParameters := len(parameters)
 * 		if firstParameterIsThis {
 * 			firstParameterOffset = 1
 * 			numParameters = numParameters - 1
 * 		}
 * 		for i := range numParameters {
 * 			p := parameters[i+firstParameterOffset]
 * 			if len(decorators) > 0 || ast.HasDecorators(p) {
 * 				if len(decorators) == 0 {
 * 					decorators = make([][]*ast.Node, numParameters)
 * 				}
 * 				decorators[i] = p.Decorators()
 * 			}
 * 		}
 *
 * 	}
 * 	return decorators
 * }
 */
export function getDecoratorsOfParameters(node: GoPtr<Node>): GoSlice<GoSlice<GoPtr<Node>>> {
  const decorators: GoSlice<GoSlice<GoPtr<Node>>> = [];
  if (node !== undefined) {
    const parameters = Node_Parameters(node) ?? [];
    const firstParameterIsThis = parameters.length > 0 && IsThisParameter(parameters[0] as unknown as GoPtr<Node>);
    const firstParameterOffset: int = firstParameterIsThis ? 1 : 0;
    const numParameters: int = parameters.length - firstParameterOffset;
    for (let i = 0; i < numParameters; i++) {
      const p = parameters[i + firstParameterOffset] as unknown as GoPtr<Node>;
      if (decorators.length > 0 || HasDecorators(p)) {
        if (decorators.length === 0) {
          for (let j = 0; j < numParameters; j++) {
            decorators.push([]);
          }
        }
        decorators[i] = Node_Decorators(p) ?? [];
      }
    }
  }
  return decorators;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/tstransforms/legacydecorators.go::method::LegacyDecoratorsTransformer.transformDecoratorsOfClassElements","kind":"method","status":"implemented","sigHash":"b943d10dcd8434ab48b70eee24a641567c25d44ad66ff6140ba9afc6e4810142","bodyHash":"c71ef6f18e18aa4712d8501bf07975f64a64e88cce09496667c33bed5c1f65e3"}
 *
 * Go source:
 * func (tx *LegacyDecoratorsTransformer) transformDecoratorsOfClassElements(node *ast.ClassDeclaration, members *ast.NodeList) (*ast.NodeList, []*ast.Node) {
 * 	var decorationStatements []*ast.Node
 * 	decorationStatements = append(decorationStatements, tx.getClassElementDecorationStatements(node, false)...)
 * 	decorationStatements = append(decorationStatements, tx.getClassElementDecorationStatements(node, true)...)
 * 	if hasClassElementWithDecoratorContainingPrivateIdentifierInExpression(node) {
 * 		var memberNodes []*ast.Node
 * 		if members != nil && len(members.Nodes) > 0 {
 * 			memberNodes = members.Nodes
 * 		}
 * 		members = tx.Factory().NewNodeList(
 * 			append(
 * 				append([]*ast.Node{}, memberNodes...),
 * 				tx.Factory().NewClassStaticBlockDeclaration(nil, tx.Factory().NewBlock(tx.Factory().NewNodeList(decorationStatements), true)),
 * 			),
 * 		)
 * 		decorationStatements = nil
 * 	}
 *
 * 	return members, decorationStatements
 * }
 */
export function LegacyDecoratorsTransformer_transformDecoratorsOfClassElements(receiver: GoPtr<LegacyDecoratorsTransformer>, node: GoPtr<ClassDeclaration>, members: GoPtr<NodeList>): [GoPtr<NodeList>, GoSlice<GoPtr<Node>>] {
  const astFactory = Transformer_Factory(receiver!.__tsgoEmbedded0)!.__tsgoEmbedded0!;
  const decorationStatements: GoSlice<GoPtr<Node>> = [
    ...LegacyDecoratorsTransformer_getClassElementDecorationStatements(receiver, node, false as bool),
    ...LegacyDecoratorsTransformer_getClassElementDecorationStatements(receiver, node, true as bool),
  ];
  if (hasClassElementWithDecoratorContainingPrivateIdentifierInExpression(node)) {
    const memberNodes: GoSlice<GoPtr<Node>> = (members !== undefined && members!.Nodes.length > 0) ? [...members!.Nodes] : [];
    const stmtList = NodeFactory_NewNodeList(astFactory, decorationStatements);
    const staticBlock = NewClassStaticBlockDeclaration(astFactory, undefined, NewBlock(astFactory, stmtList as never, true as bool) as never);
    const newMembers = NodeFactory_NewNodeList(astFactory, [...memberNodes, staticBlock]);
    return [newMembers, []];
  }
  return [members, decorationStatements];
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/tstransforms/legacydecorators.go::method::LegacyDecoratorsTransformer.getClassElementDecorationStatements","kind":"method","status":"implemented","sigHash":"748d10c709ef99ef611aafae304d31df98a4539b2520d2e4370181309383113d","bodyHash":"bb78b3fffbe87ec737ff55fcda71e72ed3131af78c1c5abd7a1131d44b55303d"}
 *
 * Go source:
 * func (tx *LegacyDecoratorsTransformer) getClassElementDecorationStatements(node *ast.ClassDeclaration, isStatic bool) []*ast.Node {
 * 	exprs := tx.generateClassElementDecorationExpressions(node, isStatic)
 * 	var statements []*ast.Node
 * 	for _, e := range exprs {
 * 		statements = append(statements, tx.Factory().NewExpressionStatement(e))
 * 	}
 * 	return statements
 * }
 */
export function LegacyDecoratorsTransformer_getClassElementDecorationStatements(receiver: GoPtr<LegacyDecoratorsTransformer>, node: GoPtr<ClassDeclaration>, isStatic: bool): GoSlice<GoPtr<Node>> {
  const astFactory = Transformer_Factory(receiver!.__tsgoEmbedded0)!.__tsgoEmbedded0!;
  const exprs = LegacyDecoratorsTransformer_generateClassElementDecorationExpressions(receiver, node, isStatic);
  return exprs.map(e => NewExpressionStatement(astFactory, e as never));
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/tstransforms/legacydecorators.go::func::isDecoratedClassElement","kind":"func","status":"implemented","sigHash":"32849ecd9c6aafb0d6195e2a0b4f056ce00c13ac8e35e6bd160997a7e3a28f1d","bodyHash":"522f101abd5313de3c3b0f34f6eb9a1170b58dd288c9fb60de359a1d8785fbf2"}
 *
 * Go source:
 * func isDecoratedClassElement(member *ast.Node, isStaticElement bool, parent *ast.ClassDeclaration) bool {
 * 	return isStaticElement == ast.IsStatic(member) && ast.NodeOrChildIsDecorated(true, member, parent.AsNode(), nil)
 * }
 */
export function isDecoratedClassElement(member: GoPtr<Node>, isStaticElement: bool, parent: GoPtr<ClassDeclaration>): bool {
  return (isStaticElement === IsStatic(member) && NodeOrChildIsDecorated(true as bool, member, parent as unknown as GoPtr<Node>, undefined)) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/tstransforms/legacydecorators.go::func::getDecoratedClassElements","kind":"func","status":"implemented","sigHash":"8eee5bfefeec5a3a1e091393416e149c9f485593de6b1240f1026784c7058bdd","bodyHash":"8ec4c321f12a5e4d057446b59d871b9040d851a7099313640ffdba136dd46f82"}
 *
 * Go source:
 * func getDecoratedClassElements(node *ast.ClassDeclaration, isStatic bool) []*ast.Node {
 * 	if node.Members == nil || len(node.Members.Nodes) == 0 {
 * 		return nil
 * 	}
 * 	var members []*ast.Node
 * 	for _, member := range node.Members.Nodes {
 * 		if isDecoratedClassElement(member, isStatic, node) {
 * 			members = append(members, member)
 * 		}
 * 	}
 * 	return members
 * }
 */
export function getDecoratedClassElements(node: GoPtr<ClassDeclaration>, isStatic: bool): GoSlice<GoPtr<Node>> {
  if (node!.Members === undefined || node!.Members!.Nodes.length === 0) {
    return [];
  }
  return node!.Members!.Nodes.filter(member => isDecoratedClassElement(member, isStatic, node));
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/tstransforms/legacydecorators.go::method::LegacyDecoratorsTransformer.generateClassElementDecorationExpressions","kind":"method","status":"implemented","sigHash":"a2645c9688536eb5fbcc1d70af44b0828e0b0f4755b1d9c25e4c03c1b53cccae","bodyHash":"f008e6ad9f72f3f64af560bd287e8029330c64e34fc5e7e8fa828028d6e47883"}
 *
 * Go source:
 * func (tx *LegacyDecoratorsTransformer) generateClassElementDecorationExpressions(node *ast.ClassDeclaration, isStatic bool) []*ast.Node {
 * 	members := getDecoratedClassElements(node, isStatic)
 * 	var expressions []*ast.Node
 * 	for _, member := range members {
 * 		expr := tx.generateClassElementDecorationExpression(node, member)
 * 		if expr != nil {
 * 			expressions = append(expressions, expr)
 * 		}
 * 	}
 * 	return expressions
 * }
 */
export function LegacyDecoratorsTransformer_generateClassElementDecorationExpressions(receiver: GoPtr<LegacyDecoratorsTransformer>, node: GoPtr<ClassDeclaration>, isStatic: bool): GoSlice<GoPtr<Node>> {
  const members = getDecoratedClassElements(node, isStatic);
  const expressions: GoSlice<GoPtr<Node>> = [];
  for (const member of members) {
    const expr = LegacyDecoratorsTransformer_generateClassElementDecorationExpression(receiver, node, member);
    if (expr !== undefined) {
      expressions.push(expr);
    }
  }
  return expressions;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/tstransforms/legacydecorators.go::method::LegacyDecoratorsTransformer.generateClassElementDecorationExpression","kind":"method","status":"implemented","sigHash":"afcdb82eac0d899f0d9a1c95e0b132f799f9ed3c2d66c98378e820d97157ecb6","bodyHash":"f9b7a4b0e6c7f9f8fc05244b37438f42b04bcfebfad4df042abe867b09256151"}
 *
 * Go source:
 * func (tx *LegacyDecoratorsTransformer) generateClassElementDecorationExpression(node *ast.ClassDeclaration, member *ast.Node) *ast.Node {
 * 	allDecorators := getAllDecoratorsOfClassElement(member, node, true)
 * 	decoratorExpressions := tx.transformAllDecoratorsOfDeclaration(allDecorators)
 * 	if len(decoratorExpressions) == 0 {
 * 		return nil
 * 	}
 * 
 * 	// Emit the call to __decorate. Given the following:
 * 	//
 * 	//   class C {
 * 	//     @dec method(@dec2 x) {}
 * 	//     @dec get accessor() {}
 * 	//     @dec prop;
 * 	//   }
 * 	//
 * 	// The emit for a method is:
 * 	//
 * 	//   __decorate([
 * 	//       dec,
 * 	//       __param(0, dec2),
 * 	//       __metadata("design:type", Function),
 * 	//       __metadata("design:paramtypes", [Object]),
 * 	//       __metadata("design:returntype", void 0)
 * 	//   ], C.prototype, "method", null);
 * 	//
 * 	// The emit for an accessor is:
 * 	//
 * 	//   __decorate([
 * 	//       dec
 * 	//   ], C.prototype, "accessor", null);
 * 	//
 * 	// The emit for a property is:
 * 	//
 * 	//   __decorate([
 * 	//       dec
 * 	//   ], C.prototype, "prop");
 * 	//
 * 
 * 	prefix := tx.getClassMemberPrefix(node, member)
 * 	memberName := tx.getExpressionForPropertyName(member, member.Flags&ast.NodeFlagsAmbient == 0)
 * 	var descriptor *ast.Node
 * 	if ast.IsPropertyDeclaration(member) && !ast.HasAccessorModifier(member) {
 * 		// We emit `void 0` here to indicate to `__decorate` that it can invoke `Object.defineProperty` directly, but that it
 * 		// should not invoke `Object.getOwnPropertyDescriptor`.
 * 		descriptor = tx.Factory().NewVoidZeroExpression()
 * 	} else {
 * 		// We emit `null` here to indicate to `__decorate` that it can invoke `Object.getOwnPropertyDescriptor` directly.
 * 		// We have this extra argument here so that we can inject an explicit property descriptor at a later date.
 * 		descriptor = tx.Factory().NewKeywordExpression(ast.KindNullKeyword)
 * 	}
 * 
 * 	helper := tx.Factory().NewDecorateHelper(
 * 		decoratorExpressions,
 * 		prefix,
 * 		memberName,
 * 		descriptor,
 * 	)
 * 
 * 	tx.EmitContext().SetEmitFlags(helper, printer.EFNoComments)
 * 	tx.EmitContext().SetSourceMapRange(helper, transformers.MoveRangePastModifiers(member))
 * 	return helper
 * }
 */
export function LegacyDecoratorsTransformer_generateClassElementDecorationExpression(receiver: GoPtr<LegacyDecoratorsTransformer>, node: GoPtr<ClassDeclaration>, member: GoPtr<Node>): GoPtr<Node> {
  const allDecs = getAllDecoratorsOfClassElement(member, node, true as bool);
  const decoratorExpressions = LegacyDecoratorsTransformer_transformAllDecoratorsOfDeclaration(receiver, allDecs);
  if (decoratorExpressions.length === 0) {
    return undefined;
  }
  const emitCtx = Transformer_EmitContext(receiver!.__tsgoEmbedded0);
  const printerFactory = Transformer_Factory(receiver!.__tsgoEmbedded0);
  const prefix = LegacyDecoratorsTransformer_getClassMemberPrefix(receiver, node, member);
  const memberName = LegacyDecoratorsTransformer_getExpressionForPropertyName(receiver, member, ((member!.Flags & NodeFlagsAmbient) === 0) as bool);
  const descriptor: GoPtr<Node> = (IsPropertyDeclaration(member) && !HasAccessorModifier(member))
    ? NodeFactory_NewVoidZeroExpression(printerFactory) as unknown as GoPtr<Node>
    : NewKeywordExpression(printerFactory!.__tsgoEmbedded0!, KindNullKeyword);
  const helper = NodeFactory_NewDecorateHelper(printerFactory, decoratorExpressions, prefix, memberName, descriptor);
  EmitContext_SetEmitFlags(emitCtx, helper as unknown as GoPtr<Node>, EFNoComments as never);
  EmitContext_SetSourceMapRange(emitCtx, helper as unknown as GoPtr<Node>, MoveRangePastModifiers(member));
  return helper as unknown as GoPtr<Node>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/tstransforms/legacydecorators.go::method::LegacyDecoratorsTransformer.isSyntheticMetadataDecorator","kind":"method","status":"implemented","sigHash":"438ba20aeff477f48122456c976b9083a18e535af67705ee0cc655ab7de91706","bodyHash":"604bc7fce462f8d330732c9df9191c20252dd4d1fd2554ac8e8c719fbc1df511"}
 *
 * Go source:
 * func (tx *LegacyDecoratorsTransformer) isSyntheticMetadataDecorator(node *ast.Node) bool {
 * 	return tx.EmitContext().IsCallToHelper(node.Expression(), "__metadata")
 * }
 */
export function LegacyDecoratorsTransformer_isSyntheticMetadataDecorator(receiver: GoPtr<LegacyDecoratorsTransformer>, node: GoPtr<Node>): bool {
  return EmitContext_IsCallToHelper(Transformer_EmitContext(receiver!.__tsgoEmbedded0), Node_Expression(node) as never, "__metadata");
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/tstransforms/legacydecorators.go::method::LegacyDecoratorsTransformer.transformAllDecoratorsOfDeclaration","kind":"method","status":"implemented","sigHash":"c52e0b600ef1259638fa0fa02c8194fa971ee3c24557edc04f3e71a7d7ac2045","bodyHash":"91710ea50354b7e50315d7a74d28c8fa9708e35d7afde64e784c521899ebb308"}
 *
 * Go source:
 * func (tx *LegacyDecoratorsTransformer) transformAllDecoratorsOfDeclaration(allDecorators *allDecorators) []*ast.Node {
 * 	if allDecorators == nil {
 * 		return nil
 * 	}
 *
 * 	// ensure that metadata decorators are last
 * 	mm := collections.GroupBy(allDecorators.decorators, tx.isSyntheticMetadataDecorator)
 * 	metadata := mm.Get(true)
 * 	decorators := mm.Get(false)
 *
 * 	var decoratorExpressions []*ast.Node
 * 	decoratorExpressions = append(decoratorExpressions, tx.transformDecorators(decorators)...)
 * 	decoratorExpressions = append(decoratorExpressions, tx.transformDecoratorsOfParameters(allDecorators.parameters)...)
 * 	decoratorExpressions = append(decoratorExpressions, tx.transformDecorators(metadata)...)
 * 	return decoratorExpressions
 * }
 */
export function LegacyDecoratorsTransformer_transformAllDecoratorsOfDeclaration(receiver: GoPtr<LegacyDecoratorsTransformer>, allDecorators: GoPtr<allDecorators>): GoSlice<GoPtr<Node>> {
  if (allDecorators === undefined) {
    return [];
  }
  const mm = GroupBy(allDecorators!.decorators, (d) => LegacyDecoratorsTransformer_isSyntheticMetadataDecorator(receiver, d));
  const metadata = MultiMap_Get(mm, true as bool);
  const decorators = MultiMap_Get(mm, false as bool);
  return [
    ...LegacyDecoratorsTransformer_transformDecorators(receiver, decorators),
    ...LegacyDecoratorsTransformer_transformDecoratorsOfParameters(receiver, allDecorators!.parameters),
    ...LegacyDecoratorsTransformer_transformDecorators(receiver, metadata),
  ];
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/tstransforms/legacydecorators.go::method::LegacyDecoratorsTransformer.transformDecoratorsOfParameters","kind":"method","status":"implemented","sigHash":"6a9400059103ed41b627bc5f73e277f00df05c0fdcb2798abf6030ce1e98d50a","bodyHash":"6581e5d902e9fa2625ba212a168aec31a1af287bb48952dd86d85b48089482a2"}
 *
 * Go source:
 * func (tx *LegacyDecoratorsTransformer) transformDecoratorsOfParameters(parameters [][]*ast.Node) []*ast.Node {
 * 	var results []*ast.Node
 * 	for i, decorators := range parameters {
 * 		if len(decorators) > 0 {
 * 			for _, decorator := range decorators {
 * 				helper := tx.Factory().NewParamHelper(
 * 					tx.Visitor().VisitNode(decorator.Expression()),
 * 					i,
 * 					decorator.Expression().Loc,
 * 				)
 * 				tx.EmitContext().SetEmitFlags(helper, printer.EFNoComments)
 * 				results = append(results, helper)
 * 			}
 * 		}
 * 	}
 * 	return results
 * }
 */
export function LegacyDecoratorsTransformer_transformDecoratorsOfParameters(receiver: GoPtr<LegacyDecoratorsTransformer>, parameters: GoSlice<GoSlice<GoPtr<Node>>>): GoSlice<GoPtr<Node>> {
  const visitor = Transformer_Visitor(receiver!.__tsgoEmbedded0) as ConcreteNodeVisitor;
  const emitCtx = Transformer_EmitContext(receiver!.__tsgoEmbedded0);
  const printerFactory = Transformer_Factory(receiver!.__tsgoEmbedded0);
  const results: GoSlice<GoPtr<Node>> = [];
  for (let i = 0; i < parameters.length; i++) {
    const decorators = parameters[i];
    if (decorators !== undefined && decorators.length > 0) {
      for (const decorator of decorators) {
        const decoratorExpr = Node_Expression(decorator);
        const helper = NodeFactory_NewParamHelper(
          printerFactory,
          NodeVisitor_VisitNode(visitor, decoratorExpr) as never,
          i,
          decoratorExpr!.Loc,
        );
        EmitContext_SetEmitFlags(emitCtx, helper as unknown as GoPtr<Node>, EFNoComments as never);
        results.push(helper as unknown as GoPtr<Node>);
      }
    }
  }
  return results;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/tstransforms/legacydecorators.go::method::LegacyDecoratorsTransformer.transformDecorators","kind":"method","status":"implemented","sigHash":"a723e488927e39ff33e0cfd39a39457255809b6a005f6fe4f2f79f8ec254a2c1","bodyHash":"5929aa8b59d3f667f7d839c86f6ff5567899850a5fc37d76e860f9c6f7085512"}
 *
 * Go source:
 * func (tx *LegacyDecoratorsTransformer) transformDecorators(decorators []*ast.Node) []*ast.Node {
 * 	var results []*ast.Node
 * 	for _, d := range decorators {
 * 		results = append(results, tx.Visitor().VisitNode(d.Expression()))
 * 	}
 * 	return results
 * }
 */
export function LegacyDecoratorsTransformer_transformDecorators(receiver: GoPtr<LegacyDecoratorsTransformer>, decorators: GoSlice<GoPtr<Node>>): GoSlice<GoPtr<Node>> {
  const visitor = Transformer_Visitor(receiver!.__tsgoEmbedded0) as ConcreteNodeVisitor;
  return decorators.map(d => NodeVisitor_VisitNode(visitor, Node_Expression(d)));
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/tstransforms/legacydecorators.go::method::LegacyDecoratorsTransformer.getClassMemberPrefix","kind":"method","status":"implemented","sigHash":"fc22f616447b13ecb736752d003c18f1db5ad669d7e774941810f08253968d9d","bodyHash":"9fcc0e9b0a5ee7d135eb4b471779c595b7bc37804d2f4c894a49a4901d042804"}
 *
 * Go source:
 * func (tx *LegacyDecoratorsTransformer) getClassMemberPrefix(node *ast.ClassDeclaration, member *ast.Node) *ast.Node {
 * 	if ast.IsStatic(member) {
 * 		return tx.Factory().GetDeclarationName(node.AsNode())
 * 	}
 * 	return tx.getClassPrototype(node)
 * }
 */
export function LegacyDecoratorsTransformer_getClassMemberPrefix(receiver: GoPtr<LegacyDecoratorsTransformer>, node: GoPtr<ClassDeclaration>, member: GoPtr<Node>): GoPtr<Node> {
  if (IsStatic(member)) {
    return NodeFactory_GetDeclarationName(Transformer_Factory(receiver!.__tsgoEmbedded0), node as unknown as GoPtr<Node> as never) as unknown as GoPtr<Node>;
  }
  return LegacyDecoratorsTransformer_getClassPrototype(receiver, node);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/tstransforms/legacydecorators.go::method::LegacyDecoratorsTransformer.getClassPrototype","kind":"method","status":"implemented","sigHash":"79831aa6fe1d9572ab9b50dd5d0e9a99ba28f410bfe2b72693c2baae16d290f7","bodyHash":"a58fbff5df68d55e299c80d8cefd6ab7aa31473d14c9cc6e418d67df4042aa42"}
 *
 * Go source:
 * func (tx *LegacyDecoratorsTransformer) getClassPrototype(node *ast.ClassDeclaration) *ast.Node {
 * 	return tx.Factory().NewPropertyAccessExpression(
 * 		tx.Factory().GetDeclarationName(node.AsNode()),
 * 		nil,
 * 		tx.Factory().NewIdentifier("prototype"),
 * 		ast.NodeFlagsNone,
 * 	)
 * }
 */
export function LegacyDecoratorsTransformer_getClassPrototype(receiver: GoPtr<LegacyDecoratorsTransformer>, node: GoPtr<ClassDeclaration>): GoPtr<Node> {
  const printerFactory = Transformer_Factory(receiver!.__tsgoEmbedded0);
  const astFactory = printerFactory!.__tsgoEmbedded0!;
  const declName = NodeFactory_GetDeclarationName(printerFactory, node as unknown as GoPtr<Node> as never);
  return NewPropertyAccessExpression(
    astFactory,
    declName as unknown as GoPtr<Node> as never,
    undefined,
    NewIdentifier(astFactory, "prototype") as never,
    NodeFlagsNone,
  );
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/tstransforms/legacydecorators.go::method::LegacyDecoratorsTransformer.getExpressionForPropertyName","kind":"method","status":"implemented","sigHash":"70672828eb78e9574ccbacb4e593e6bdca9611fe87a0e328691cc104bfb58181","bodyHash":"71a4186dc7d7a87e21d6d11502445c50d0deb2cf6f3545b87c86da9016f5388c"}
 *
 * Go source:
 * func (tx *LegacyDecoratorsTransformer) getExpressionForPropertyName(member *ast.Node, generateNameForComputedPropertyName bool) *ast.Node {
 * 	name := member.Name()
 * 	if ast.IsPrivateIdentifier(name) {
 * 		return tx.Factory().NewIdentifier("")
 * 	} else if ast.IsComputedPropertyName(name) {
 * 		if generateNameForComputedPropertyName && !transformers.IsSimpleInlineableExpression(name.AsComputedPropertyName().Expression) {
 * 			return tx.Factory().NewGeneratedNameForNode(name)
 * 		}
 * 		return name.AsComputedPropertyName().Expression
 * 	} else if ast.IsIdentifier(name) {
 * 		return tx.Factory().NewStringLiteral(name.Text(), ast.TokenFlagsNone)
 * 	} else {
 * 		return tx.Factory().DeepCloneNode(name)
 * 	}
 * }
 */
export function LegacyDecoratorsTransformer_getExpressionForPropertyName(receiver: GoPtr<LegacyDecoratorsTransformer>, member: GoPtr<Node>, generateNameForComputedPropertyName: bool): GoPtr<Node> {
  const printerFactory = Transformer_Factory(receiver!.__tsgoEmbedded0);
  const astFactory = printerFactory!.__tsgoEmbedded0!;
  const name = Node_Name(member);
  if (IsPrivateIdentifier(name)) {
    return NewIdentifier(astFactory, "");
  } else if (IsComputedPropertyName(name)) {
    const cpnExpr = Node_Expression(name);
    if (generateNameForComputedPropertyName && !IsSimpleInlineableExpression(cpnExpr as never)) {
      return NodeFactory_NewGeneratedNameForNode(printerFactory, name) as unknown as GoPtr<Node>;
    }
    return cpnExpr;
  } else if (IsIdentifier(name)) {
    const identText = (name as unknown as GoPtr<Identifier>)!.Text;
    return NewStringLiteral(astFactory, identText, TokenFlagsNone);
  } else {
    return NodeFactory_DeepCloneNode(astFactory, name);
  }
}
