import type { bool, int } from "@tsonic/core/types.js";
import type { GoMap, GoPtr, GoSlice } from "../../../go/compat.js";
import { Coalesce, Find, IfElse } from "../../core/core.js";
import type { ModifierList, Node, NodeFactoryCoercible } from "../../ast/spine.js";
import { Node_Clone, NodeFactory_AsNodeFactory, NodeFactory_NewNodeList, Node_AsNode, Node_Modifiers, Node_Name, Node_Pos, Node_SubtreeFacts } from "../../ast/spine.js";
import {
  KindArrayBindingPattern,
  KindBlock,
  KindCaseBlock,
  KindClassDeclaration,
  KindClassExpression,
  KindComputedPropertyName,
  KindConstructor,
  KindEnumDeclaration,
  KindExportDeclaration,
  KindExternalModuleReference,
  KindFunctionDeclaration,
  KindIdentifier,
  KindImportClause,
  KindImportDeclaration,
  KindImportEqualsDeclaration,
  KindModuleBlock,
  KindModuleDeclaration,
  KindNumericLiteral,
  KindObjectBindingPattern,
  KindOverrideKeyword,
  KindPrivateIdentifier,
  KindPrivateKeyword,
  KindProtectedKeyword,
  KindPublicKeyword,
  KindReadonlyKeyword,
  KindEqualsToken,
  KindShorthandPropertyAssignment,
  KindSourceFile,
  KindStringLiteral,
  KindVariableDeclarationList,
  KindVariableStatement,
} from "../../ast/generated/kinds.js";
import { NodeFlagsLet, NodeFlagsNone } from "../../ast/generated/flags.js";
import {
  ModifierFlagsDecorator,
  ModifierFlagsExport,
  ModifierFlagsExportDefault,
  ModifierFlagsTypeScriptModifier,
} from "../../ast/modifierflags.js";
import { IsConstructorDeclaration, IsEnumDeclaration, IsIdentifier, IsModuleDeclaration, IsTryStatement } from "../../ast/generated/predicates.js";
import { ChildIsDecorated, IsBindingPattern, IsEnumConst, IsInstantiatedModule, IsParameterPropertyDeclaration } from "../../ast/utilities.js";
import { Node_Elements, Node_ModifierFlags, Node_ParameterList, Node_Parameters, Node_Text, NodeFactory_UpdateBlock, NodeFactory_UpdateClassDeclaration, NodeFactory_UpdateClassExpression, NodeFactory_UpdateConstructorDeclaration, NodeFactory_UpdateFunctionDeclaration, NodeFactory_UpdateShorthandPropertyAssignment, NodeFactory_UpdateTryStatement } from "../../ast/ast.js";
import { SubtreeContainsIdentifier, SubtreeContainsTypeScript } from "../../ast/subtreefacts.js";
import { AsBlock, AsClassDeclaration, AsClassExpression, AsComputedPropertyName, AsConstructorDeclaration, AsEnumDeclaration, AsEnumMember, AsFunctionDeclaration, AsImportEqualsDeclaration, AsModuleBlock, AsModuleDeclaration, AsParameterDeclaration, AsShorthandPropertyAssignment, AsTryStatement, AsVariableDeclaration, AsVariableDeclarationList, AsVariableStatement } from "../../ast/generated/casts.js";
import { TokenFlagsNone } from "../../ast/tokenflags.js";
import { CompilerOptions_GetEmitModuleKind, CompilerOptions_ShouldPreserveConstEnums, ModuleKindSystem } from "../../core/compileroptions.js";
import type { NodeVisitor as ConcreteNodeVisitor } from "../../ast/visitor.js";
import { NodeVisitor_VisitEachChild, NodeVisitor_VisitModifiers, NodeVisitor_VisitNode, NodeVisitor_VisitNodes, NodeVisitor_VisitSlice } from "../../ast/visitor.js";
import { IsGeneratedIdentifier, IsIdentifierReference, IsLocalName } from "../utilities.js";
import { ConvertVariableDeclarationToAssignmentExpression, FindSuperStatementIndexPath } from "../utilities.js";
import { FlattenDestructuringAssignment, FlattenLevelAll } from "../destructuring.js";
import { ExtractModifiers } from "../modifiervisitor.js";
import type {
  Block,
  ClassDeclaration,
  ClassExpression,
  ConstructorDeclaration,
  EnumDeclaration,
  EnumMember,
  FunctionDeclaration,
  ImportEqualsDeclaration,
  ModuleBlock,
  ModuleDeclaration,
  ParameterDeclaration,
  ShorthandPropertyAssignment,
  TryStatement,
  VariableDeclaration,
  VariableStatement,
} from "../../ast/generated/data.js";
import { EnumDeclaration_as_nodeData, ModuleDeclaration_as_nodeData } from "../../ast/generated/data.js";
import type {
  BlockNode,
  Declaration,
  EnumDeclarationNode,
  Expression,
  IdentifierNode,
  ModuleDeclarationNode,
  Statement,
} from "../../ast/generated/unions.js";
import {
  NewBinaryExpression,
  NewBlock,
  NewCallExpression,
  NewElementAccessExpression,
  NewExpressionStatement,
  NewFunctionExpression,
  NewIdentifier,
  NewNumericLiteral,
  NewObjectLiteralExpression,
  NewParameterDeclaration,
  NewParenthesizedExpression,
  NewPropertyAccessExpression,
  NewPropertyAssignment,
  NewPropertyDeclaration,
  NewStringLiteral,
  NewSyntaxList,
  NewToken,
  NewVariableDeclaration,
  NewVariableDeclarationList,
  NewVariableStatement,
} from "../../ast/generated/factory.js";
import type { ReferenceResolver } from "../../binder/referenceresolver.js";
import type { CompilerOptions } from "../../core/compileroptions.js";
import type { TextRange } from "../../core/text.js";
import { TextRange_WithPos } from "../../core/text.js";
import {
  EmitContext_AddEmitFlags,
  EmitContext_AssignCommentAndSourceMapRanges,
  EmitContext_EndAndMergeVariableEnvironment,
  EmitContext_MostOriginal,
  EmitContext_NewNotEmittedStatement,
  EmitContext_ParseNode,
  EmitContext_SetCommentRange,
  EmitContext_SetEmitFlags,
  EmitContext_SetOriginal,
  EmitContext_SetSourceMapRange,
  EmitContext_StartVariableEnvironment,
  EmitContext_VisitFunctionBody,
  EmitContext_VisitParameters,
} from "../../printer/emitcontext.js";
import {
  EFNoComments,
  EFNoLeadingComments,
  EFNoNestedComments,
  EFNoNestedSourceMaps,
  EFNoSourceMap,
  EFNone,
  EFNoTrailingComments,
  EFStartOnNewLine,
} from "../../printer/emitflags.js";
import type { EmitResolver } from "../../printer/emitresolver.js";
import {
  NodeFactory_CreateExpressionFromEntityName,
  NodeFactory_GetDeclarationNameEx,
  NodeFactory_GetExternalModuleOrNamespaceExportName,
  NodeFactory_GetLocalName,
  NodeFactory_GetLocalNameEx,
  NodeFactory_GetNamespaceMemberName,
  NodeFactory_InlineExpressions,
  NodeFactory_NewAssignmentExpression,
  NodeFactory_NewGeneratedNameForNode,
  NodeFactory_NewLogicalORExpression,
  NodeFactory_NewStringLiteralFromNode,
  NodeFactory_NewThisExpression,
  NodeFactory_NewVoidZeroExpression,
  NodeFactory_SplitStandardPrologue,
} from "../../printer/factory.js";
import type { Number as JsNumber } from "../../jsnum/jsnum.js";
import type { Result } from "../../evaluator/evaluator.js";
import { constantExpression } from "./utilities.js";
import type { TransformOptions } from "../chain.js";
import type { Transformer } from "../transformer.js";
import { Transformer_EmitContext, Transformer_Factory, Transformer_NewTransformer, Transformer_Visitor } from "../transformer.js";
import { Tristate_IsTrue } from "../../core/tristate.js";

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/tstransforms/runtimesyntax.go::type::RuntimeSyntaxTransformer","kind":"type","status":"implemented","sigHash":"60ac09ddc0df66acaac125944f07657585e16fe81b3e057942787c81d8c958b6","bodyHash":"f6da722d67500e59af9792d655cb93c0162bf9294c6412407cbdc162733836ae"}
 *
 * Go source:
 * RuntimeSyntaxTransformer struct {
 * 	transformers.Transformer
 * 	compilerOptions                     *core.CompilerOptions
 * 	parentNode                          *ast.Node
 * 	currentNode                         *ast.Node
 * 	currentSourceFile                   *ast.Node
 * 	currentScope                        *ast.Node // SourceFile | Block | ModuleBlock | CaseBlock
 * 	currentScopeFirstDeclarationsOfName map[string]*ast.Node
 * 	currentEnum                         *ast.EnumDeclarationNode
 * 	currentNamespace                    *ast.ModuleDeclarationNode
 * 	resolver                            binder.ReferenceResolver
 * 	emitResolver                        printer.EmitResolver
 * }
 */
export interface RuntimeSyntaxTransformer {
  readonly __tsgoEmbedded0?: Transformer;
  compilerOptions: GoPtr<CompilerOptions>;
  parentNode: GoPtr<Node>;
  currentNode: GoPtr<Node>;
  currentSourceFile: GoPtr<Node>;
  currentScope: GoPtr<Node>;
  currentScopeFirstDeclarationsOfName: GoMap<string, GoPtr<Node>> | undefined;
  currentEnum: GoPtr<EnumDeclarationNode>;
  currentNamespace: GoPtr<ModuleDeclarationNode>;
  resolver: ReferenceResolver;
  emitResolver: EmitResolver;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/tstransforms/runtimesyntax.go::func::NewRuntimeSyntaxTransformer","kind":"func","status":"implemented","sigHash":"1cc789368e0941c7bdb634093c1b3fc90fde2f0bd9c033dc499ccac198be84e7","bodyHash":"98afc92f31284dee500e8df3fe7ae728710dc112b4adc6a09ac77fce38a16b23"}
 *
 * Go source:
 * func NewRuntimeSyntaxTransformer(opt *transformers.TransformOptions) *transformers.Transformer {
 * 	compilerOptions := opt.CompilerOptions
 * 	emitContext := opt.Context
 * 	tx := &RuntimeSyntaxTransformer{compilerOptions: compilerOptions, resolver: opt.Resolver, emitResolver: opt.EmitResolver}
 * 	return tx.NewTransformer(tx.visit, emitContext)
 * }
 */
export function NewRuntimeSyntaxTransformer(opt: GoPtr<TransformOptions>): GoPtr<Transformer> {
  const compilerOptions = opt!.CompilerOptions;
  const emitContext = opt!.Context;
  const tx: RuntimeSyntaxTransformer = {
    __tsgoEmbedded0: { emitContext: undefined, factory: undefined, visitor: undefined },
    compilerOptions: compilerOptions,
    parentNode: undefined,
    currentNode: undefined,
    currentSourceFile: undefined,
    currentScope: undefined,
    currentScopeFirstDeclarationsOfName: undefined,
    currentEnum: undefined,
    currentNamespace: undefined,
    resolver: opt!.Resolver,
    emitResolver: opt!.EmitResolver,
  };
  return Transformer_NewTransformer(tx.__tsgoEmbedded0, (node) => RuntimeSyntaxTransformer_visit(tx, node), emitContext);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/tstransforms/runtimesyntax.go::method::RuntimeSyntaxTransformer.pushNode","kind":"method","status":"implemented","sigHash":"5e974924196196b4d1fc463e6f4eb7c540064d60e8cf4ed6279f50f71d76b4a8","bodyHash":"85fe77f0fb7f109d0f187d37f8bb46451c70b40a5fa8c84d879b2577c8b0b42b"}
 *
 * Go source:
 * func (tx *RuntimeSyntaxTransformer) pushNode(node *ast.Node) (grandparentNode *ast.Node) {
 * 	grandparentNode = tx.parentNode
 * 	tx.parentNode = tx.currentNode
 * 	tx.currentNode = node
 * 	return grandparentNode
 * }
 */
export function RuntimeSyntaxTransformer_pushNode(receiver: GoPtr<RuntimeSyntaxTransformer>, node: GoPtr<Node>): GoPtr<Node> {
  const grandparentNode = receiver!.parentNode;
  receiver!.parentNode = receiver!.currentNode;
  receiver!.currentNode = node;
  return grandparentNode;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/tstransforms/runtimesyntax.go::method::RuntimeSyntaxTransformer.popNode","kind":"method","status":"implemented","sigHash":"27b68af9e3e7df47b4ef3dd00a54a9fc4507c7ab1009d142064fb16b859e4c08","bodyHash":"9921ee0bb107e42ed8cc409435071f1d916c3e9efeff38a7ead02bd88076e658"}
 *
 * Go source:
 * func (tx *RuntimeSyntaxTransformer) popNode(grandparentNode *ast.Node) {
 * 	tx.currentNode = tx.parentNode
 * 	tx.parentNode = grandparentNode
 * }
 */
export function RuntimeSyntaxTransformer_popNode(receiver: GoPtr<RuntimeSyntaxTransformer>, grandparentNode: GoPtr<Node>): void {
  receiver!.currentNode = receiver!.parentNode;
  receiver!.parentNode = grandparentNode;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/tstransforms/runtimesyntax.go::method::RuntimeSyntaxTransformer.pushScope","kind":"method","status":"implemented","sigHash":"4c51990f9cfb83bebbe5076ab7d8fe377d26e87e33cd5ffa4da54a445e01c751","bodyHash":"c0f40dd82bd3674af81ee56f3ab5d11e4a37db9d4570b99840cf97ca89dba1c2"}
 *
 * Go source:
 * func (tx *RuntimeSyntaxTransformer) pushScope(node *ast.Node) (savedCurrentScope *ast.Node, savedCurrentScopeFirstDeclarationsOfName map[string]*ast.Node) {
 * 	savedCurrentScope = tx.currentScope
 * 	savedCurrentScopeFirstDeclarationsOfName = tx.currentScopeFirstDeclarationsOfName
 * 	switch node.Kind {
 * 	case ast.KindSourceFile:
 * 		tx.currentScope = node
 * 		tx.currentSourceFile = node
 * 		tx.currentScopeFirstDeclarationsOfName = nil
 * 	case ast.KindCaseBlock, ast.KindModuleBlock, ast.KindBlock:
 * 		tx.currentScope = node
 * 		tx.currentScopeFirstDeclarationsOfName = nil
 * 	case ast.KindFunctionDeclaration, ast.KindClassDeclaration, ast.KindVariableStatement:
 * 		tx.recordDeclarationInScope(node)
 * 	}
 * 	return savedCurrentScope, savedCurrentScopeFirstDeclarationsOfName
 * }
 */
export function RuntimeSyntaxTransformer_pushScope(receiver: GoPtr<RuntimeSyntaxTransformer>, node: GoPtr<Node>): [GoPtr<Node>, GoMap<string, GoPtr<Node>> | undefined] {
  const savedCurrentScope = receiver!.currentScope;
  const savedCurrentScopeFirstDeclarationsOfName = receiver!.currentScopeFirstDeclarationsOfName;
  switch (node!.Kind) {
    case KindSourceFile:
      receiver!.currentScope = node;
      receiver!.currentSourceFile = node;
      receiver!.currentScopeFirstDeclarationsOfName = undefined;
      break;
    case KindCaseBlock:
    case KindModuleBlock:
    case KindBlock:
      receiver!.currentScope = node;
      receiver!.currentScopeFirstDeclarationsOfName = undefined;
      break;
    case KindFunctionDeclaration:
    case KindClassDeclaration:
    case KindVariableStatement:
      RuntimeSyntaxTransformer_recordDeclarationInScope(receiver, node);
      break;
  }
  return [savedCurrentScope, savedCurrentScopeFirstDeclarationsOfName];
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/tstransforms/runtimesyntax.go::method::RuntimeSyntaxTransformer.popScope","kind":"method","status":"implemented","sigHash":"8acef65760ec0e34a1935f4de96b09744e0fbebe4fb50b6e64b84fd495adc3f4","bodyHash":"1f0e2c72cb9ae839f5a0f5ce973e5ac95c4383358114e38587f7486744c768c9"}
 *
 * Go source:
 * func (tx *RuntimeSyntaxTransformer) popScope(savedCurrentScope *ast.Node, savedCurrentScopeFirstDeclarationsOfName map[string]*ast.Node) {
 * 	if tx.currentScope != savedCurrentScope {
 * 		// only reset the first declaration for a name if we are exiting the scope in which it was declared
 * 		tx.currentScopeFirstDeclarationsOfName = savedCurrentScopeFirstDeclarationsOfName
 * 	}
 *
 * 	tx.currentScope = savedCurrentScope
 * }
 */
export function RuntimeSyntaxTransformer_popScope(receiver: GoPtr<RuntimeSyntaxTransformer>, savedCurrentScope: GoPtr<Node>, savedCurrentScopeFirstDeclarationsOfName: GoMap<string, GoPtr<Node>> | undefined): void {
  if (receiver!.currentScope !== savedCurrentScope) {
    // only reset the first declaration for a name if we are exiting the scope in which it was declared
    receiver!.currentScopeFirstDeclarationsOfName = savedCurrentScopeFirstDeclarationsOfName;
  }

  receiver!.currentScope = savedCurrentScope;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/tstransforms/runtimesyntax.go::method::RuntimeSyntaxTransformer.visit","kind":"method","status":"implemented","sigHash":"4a674213a6d9b575419adde9114929a4f5760db52c1cd1a8e20328590dbfa1d8","bodyHash":"4bf5a2ee3a71b68a84b00dcd53750d03fdc9d885313dbf69828191f8b467362d"}
 *
 * Go source:
 * func (tx *RuntimeSyntaxTransformer) visit(node *ast.Node) *ast.Node {
 * 	grandparentNode := tx.pushNode(node)
 * 	defer tx.popNode(grandparentNode)
 *
 * 	savedCurrentScope, savedCurrentScopeFirstDeclarationsOfName := tx.pushScope(node)
 * 	defer tx.popScope(savedCurrentScope, savedCurrentScopeFirstDeclarationsOfName)
 *
 * 	if node.SubtreeFacts()&ast.SubtreeContainsTypeScript == 0 && (tx.currentNamespace == nil && tx.currentEnum == nil || node.SubtreeFacts()&ast.SubtreeContainsIdentifier == 0) {
 * 		return node
 * 	}
 *
 * 	switch node.Kind {
 * 	// TypeScript parameter property modifiers are elided
 * 	case ast.KindPublicKeyword,
 * 		ast.KindPrivateKeyword,
 * 		ast.KindProtectedKeyword,
 * 		ast.KindReadonlyKeyword,
 * 		ast.KindOverrideKeyword:
 * 		node = nil
 * 	case ast.KindEnumDeclaration:
 * 		node = tx.visitEnumDeclaration(node.AsEnumDeclaration())
 * 	case ast.KindModuleDeclaration:
 * 		node = tx.visitModuleDeclaration(node.AsModuleDeclaration())
 * 	case ast.KindClassDeclaration:
 * 		node = tx.visitClassDeclaration(node.AsClassDeclaration())
 * 	case ast.KindClassExpression:
 * 		node = tx.visitClassExpression(node.AsClassExpression())
 * 	case ast.KindConstructor:
 * 		node = tx.visitConstructorDeclaration(node.AsConstructorDeclaration())
 * 	case ast.KindFunctionDeclaration:
 * 		node = tx.visitFunctionDeclaration(node.AsFunctionDeclaration())
 * 	case ast.KindVariableStatement:
 * 		node = tx.visitVariableStatement(node.AsVariableStatement())
 * 	case ast.KindExportDeclaration, ast.KindImportDeclaration, ast.KindImportClause:
 * 		if tx.currentNamespace != nil && tx.currentScope != nil && tx.currentScope.Kind != ast.KindBlock {
 * 			// do not emit ES6 imports and exports since they are illegal inside a namespace
 * 			node = nil
 * 		} else {
 * 			node = tx.Visitor().VisitEachChild(node)
 * 		}
 * 	case ast.KindImportEqualsDeclaration:
 * 		if tx.currentNamespace != nil && tx.currentScope != nil && tx.currentScope.Kind != ast.KindBlock && node.AsImportEqualsDeclaration().ModuleReference.Kind == ast.KindExternalModuleReference {
 * 			// do not emit ES6 imports and exports since they are illegal inside a namespace
 * 			node = nil
 * 		} else if tx.currentNamespace != nil && tx.currentScope != nil && tx.currentScope.Kind == ast.KindBlock && node.AsImportEqualsDeclaration().ModuleReference.Kind != ast.KindExternalModuleReference {
 * 			// inside a block within a namespace, elide internal import aliases
 * 			node = nil
 * 		} else {
 * 			node = tx.visitImportEqualsDeclaration(node.AsImportEqualsDeclaration())
 * 		}
 * 	case ast.KindIdentifier:
 * 		node = tx.visitIdentifier(node)
 * 	case ast.KindShorthandPropertyAssignment:
 * 		node = tx.visitShorthandPropertyAssignment(node.AsShorthandPropertyAssignment())
 * 	default:
 * 		node = tx.Visitor().VisitEachChild(node)
 * 	}
 * 	return node
 * }
 */
const RuntimeSyntaxTransformer_visitInner = (receiver: GoPtr<RuntimeSyntaxTransformer>, node: GoPtr<Node>): GoPtr<Node> => {
  if (
    (Node_SubtreeFacts(node) & SubtreeContainsTypeScript) === 0 &&
    (receiver!.currentNamespace === undefined && receiver!.currentEnum === undefined || (Node_SubtreeFacts(node) & SubtreeContainsIdentifier) === 0)
  ) {
    return node;
  }
  switch (node!.Kind) {
    // TypeScript parameter property modifiers are elided
    case KindPublicKeyword:
    case KindPrivateKeyword:
    case KindProtectedKeyword:
    case KindReadonlyKeyword:
    case KindOverrideKeyword:
      return undefined;
    case KindEnumDeclaration:
      return RuntimeSyntaxTransformer_visitEnumDeclaration(receiver, AsEnumDeclaration(node));
    case KindModuleDeclaration:
      return RuntimeSyntaxTransformer_visitModuleDeclaration(receiver, AsModuleDeclaration(node));
    case KindClassDeclaration:
      return RuntimeSyntaxTransformer_visitClassDeclaration(receiver, AsClassDeclaration(node));
    case KindClassExpression:
      return RuntimeSyntaxTransformer_visitClassExpression(receiver, AsClassExpression(node));
    case KindConstructor:
      return RuntimeSyntaxTransformer_visitConstructorDeclaration(receiver, AsConstructorDeclaration(node));
    case KindFunctionDeclaration:
      return RuntimeSyntaxTransformer_visitFunctionDeclaration(receiver, AsFunctionDeclaration(node));
    case KindVariableStatement:
      return RuntimeSyntaxTransformer_visitVariableStatement(receiver, AsVariableStatement(node));
    case KindExportDeclaration:
    case KindImportDeclaration:
    case KindImportClause:
      if (receiver!.currentNamespace !== undefined && receiver!.currentScope !== undefined && receiver!.currentScope!.Kind !== KindBlock) {
        // do not emit ES6 imports and exports since they are illegal inside a namespace
        return undefined;
      }
      return NodeVisitor_VisitEachChild((Transformer_Visitor(receiver!.__tsgoEmbedded0) as ConcreteNodeVisitor), node);
    case KindImportEqualsDeclaration: {
      const ied = AsImportEqualsDeclaration(node);
      if (receiver!.currentNamespace !== undefined && receiver!.currentScope !== undefined && receiver!.currentScope!.Kind !== KindBlock && ied!.ModuleReference!.Kind === KindExternalModuleReference) {
        // do not emit ES6 imports and exports since they are illegal inside a namespace
        return undefined;
      }
      if (receiver!.currentNamespace !== undefined && receiver!.currentScope !== undefined && receiver!.currentScope!.Kind === KindBlock && ied!.ModuleReference!.Kind !== KindExternalModuleReference) {
        // inside a block within a namespace, elide internal import aliases
        return undefined;
      }
      return RuntimeSyntaxTransformer_visitImportEqualsDeclaration(receiver, ied);
    }
    case KindIdentifier:
      return RuntimeSyntaxTransformer_visitIdentifier(receiver, node as unknown as GoPtr<IdentifierNode>);
    case KindShorthandPropertyAssignment:
      return RuntimeSyntaxTransformer_visitShorthandPropertyAssignment(receiver, AsShorthandPropertyAssignment(node));
    default:
      return NodeVisitor_VisitEachChild((Transformer_Visitor(receiver!.__tsgoEmbedded0) as ConcreteNodeVisitor), node);
  }
};

export function RuntimeSyntaxTransformer_visit(receiver: GoPtr<RuntimeSyntaxTransformer>, node: GoPtr<Node>): GoPtr<Node> {
  const grandparentNode = RuntimeSyntaxTransformer_pushNode(receiver, node);
  const [savedCurrentScope, savedCurrentScopeFirstDeclarationsOfName] = RuntimeSyntaxTransformer_pushScope(receiver, node);
  const result = RuntimeSyntaxTransformer_visitInner(receiver, node);
  RuntimeSyntaxTransformer_popScope(receiver, savedCurrentScope, savedCurrentScopeFirstDeclarationsOfName);
  RuntimeSyntaxTransformer_popNode(receiver, grandparentNode);
  return result;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/tstransforms/runtimesyntax.go::method::RuntimeSyntaxTransformer.recordDeclarationInScope","kind":"method","status":"implemented","sigHash":"da951f097dc3ba450eab29d7acf761a1bdc115cdfaa8f679a735c878a3b42a12","bodyHash":"6761276a7300ef8df6a478933d1262475d7a2ba50c11044dad7b9ab0fc019325"}
 *
 * Go source:
 * func (tx *RuntimeSyntaxTransformer) recordDeclarationInScope(node *ast.Node) {
 * 	switch node.Kind {
 * 	case ast.KindVariableStatement:
 * 		tx.recordDeclarationInScope(node.AsVariableStatement().DeclarationList)
 * 		return
 * 	case ast.KindVariableDeclarationList:
 * 		for _, decl := range node.AsVariableDeclarationList().Declarations.Nodes {
 * 			tx.recordDeclarationInScope(decl)
 * 		}
 * 		return
 * 	case ast.KindArrayBindingPattern, ast.KindObjectBindingPattern:
 * 		for _, element := range node.Elements() {
 * 			tx.recordDeclarationInScope(element)
 * 		}
 * 		return
 * 	}
 * 	name := node.Name()
 * 	if name != nil {
 * 		if ast.IsIdentifier(name) {
 * 			if tx.currentScopeFirstDeclarationsOfName == nil {
 * 				tx.currentScopeFirstDeclarationsOfName = make(map[string]*ast.Node)
 * 			}
 * 			text := name.Text()
 * 			if _, found := tx.currentScopeFirstDeclarationsOfName[text]; !found {
 * 				tx.currentScopeFirstDeclarationsOfName[text] = node
 * 			}
 * 		} else if ast.IsBindingPattern(name) {
 * 			tx.recordDeclarationInScope(name)
 * 		}
 * 	}
 * }
 */
export function RuntimeSyntaxTransformer_recordDeclarationInScope(receiver: GoPtr<RuntimeSyntaxTransformer>, node: GoPtr<Node>): void {
  switch (node!.Kind) {
    case KindVariableStatement:
      RuntimeSyntaxTransformer_recordDeclarationInScope(receiver, AsVariableStatement(node)!.DeclarationList);
      return;
    case KindVariableDeclarationList:
      for (const decl of AsVariableDeclarationList(node)!.Declarations!.Nodes!) {
        RuntimeSyntaxTransformer_recordDeclarationInScope(receiver, decl);
      }
      return;
    case KindArrayBindingPattern:
    case KindObjectBindingPattern:
      for (const element of Node_Elements(node)!) {
        RuntimeSyntaxTransformer_recordDeclarationInScope(receiver, element);
      }
      return;
  }
  const name = Node_Name(node);
  if (name !== undefined) {
    if (IsIdentifier(name)) {
      if (receiver!.currentScopeFirstDeclarationsOfName === undefined) {
        receiver!.currentScopeFirstDeclarationsOfName = new Map<string, GoPtr<Node>>();
      }
      const text = Node_Text(name);
      if (!receiver!.currentScopeFirstDeclarationsOfName.has(text)) {
        receiver!.currentScopeFirstDeclarationsOfName.set(text, node);
      }
    } else if (IsBindingPattern(name)) {
      RuntimeSyntaxTransformer_recordDeclarationInScope(receiver, name);
    }
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/tstransforms/runtimesyntax.go::method::RuntimeSyntaxTransformer.isFirstDeclarationInScope","kind":"method","status":"implemented","sigHash":"c71c04faa2206e1c77dba1fc7c7f42b0fbc1df8e416a7cac15c12fe99385c916","bodyHash":"7e1b1b24827296d59523e4d5096bba5f48d611094baa7f12434c9c3557291fef"}
 *
 * Go source:
 * func (tx *RuntimeSyntaxTransformer) isFirstDeclarationInScope(node *ast.Node) bool {
 * 	name := node.Name()
 * 	if name != nil && ast.IsIdentifier(name) {
 * 		text := name.Text()
 * 		if firstDeclaration, found := tx.currentScopeFirstDeclarationsOfName[text]; found {
 * 			return firstDeclaration == node
 * 		}
 * 	}
 * 	return false
 * }
 */
export function RuntimeSyntaxTransformer_isFirstDeclarationInScope(receiver: GoPtr<RuntimeSyntaxTransformer>, node: GoPtr<Node>): bool {
  const name = Node_Name(node);
  if (name !== undefined && IsIdentifier(name)) {
    const text = Node_Text(name);
    const firstDeclaration = receiver!.currentScopeFirstDeclarationsOfName?.get(text);
    if (firstDeclaration !== undefined) {
      return (firstDeclaration === node) as bool;
    }
  }
  return false as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/tstransforms/runtimesyntax.go::method::RuntimeSyntaxTransformer.isExportOfNamespace","kind":"method","status":"implemented","sigHash":"6ce2b508848c6caa1a4cef3dd00fabc5b637854714d28997d44820bb4920447e","bodyHash":"d37395fc14f33734d00374d18191df80e5f271b227b81bc7bf428c9d19f401fa"}
 *
 * Go source:
 * func (tx *RuntimeSyntaxTransformer) isExportOfNamespace(node *ast.Node) bool {
 * 	return tx.currentNamespace != nil && (tx.currentScope == nil || tx.currentScope.Kind != ast.KindBlock) && node.ModifierFlags()&ast.ModifierFlagsExport != 0
 * }
 */
export function RuntimeSyntaxTransformer_isExportOfNamespace(receiver: GoPtr<RuntimeSyntaxTransformer>, node: GoPtr<Node>): bool {
  return (
    receiver!.currentNamespace !== undefined &&
    (receiver!.currentScope === undefined || receiver!.currentScope!.Kind !== KindBlock) &&
    (Node_ModifierFlags(node) & ModifierFlagsExport) !== 0
  ) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/tstransforms/runtimesyntax.go::method::RuntimeSyntaxTransformer.getExpressionForPropertyName","kind":"method","status":"implemented","sigHash":"41451935600ecf5749958b1064e1db8ded522d35455a9fa3beb39c499a86b27f","bodyHash":"b1e8c0d193f57ea828653a2f9bdfe9d8ad66ad7b43625a7e7c4fb3ba9a02734a"}
 *
 * Go source:
 * func (tx *RuntimeSyntaxTransformer) getExpressionForPropertyName(member *ast.EnumMember) *ast.Expression {
 * 	name := member.Name()
 * 	switch name.Kind {
 * 	case ast.KindPrivateIdentifier:
 * 		return tx.Factory().NewIdentifier("")
 * 	case ast.KindComputedPropertyName:
 * 		n := name.AsComputedPropertyName()
 * 		// enums don't support computed properties so we always generate the 'expression' part of the name as-is.
 * 		return tx.Visitor().VisitNode(n.Expression)
 * 	case ast.KindIdentifier:
 * 		return tx.Factory().NewStringLiteralFromNode(name)
 * 	case ast.KindStringLiteral: // !!! propagate token flags (will produce new diffs)
 * 		return tx.Factory().NewStringLiteral(name.Text(), ast.TokenFlagsNone)
 * 	case ast.KindNumericLiteral:
 * 		return tx.Factory().NewNumericLiteral(name.Text(), ast.TokenFlagsNone)
 * 	default:
 * 		return name
 * 	}
 * }
 */
export function RuntimeSyntaxTransformer_getExpressionForPropertyName(receiver: GoPtr<RuntimeSyntaxTransformer>, member: GoPtr<EnumMember>): GoPtr<Expression> {
  const name = Node_Name(Node_AsNode(member));
  const astFactory = Transformer_Factory(receiver!.__tsgoEmbedded0)!.__tsgoEmbedded0;
  switch (name!.Kind) {
    case KindPrivateIdentifier:
      return NewIdentifier(astFactory, "");
    case KindComputedPropertyName: {
      const n = AsComputedPropertyName(name);
      // enums don't support computed properties so we always generate the 'expression' part of the name as-is.
      return NodeVisitor_VisitNode((Transformer_Visitor(receiver!.__tsgoEmbedded0) as ConcreteNodeVisitor), n!.Expression);
    }
    case KindIdentifier:
      return NodeFactory_NewStringLiteralFromNode(Transformer_Factory(receiver!.__tsgoEmbedded0), name);
    case KindStringLiteral: // !!! propagate token flags (will produce new diffs)
      return NewStringLiteral(astFactory, Node_Text(name), TokenFlagsNone);
    case KindNumericLiteral:
      return NewNumericLiteral(astFactory, Node_Text(name), TokenFlagsNone);
    default:
      return name;
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/tstransforms/runtimesyntax.go::method::RuntimeSyntaxTransformer.getEnumQualifiedElement","kind":"method","status":"implemented","sigHash":"3d68a47b415e537ce4dccf0309e306798c22280432c56090ecad5aafd7565ebb","bodyHash":"bb955f25a88d1af02b27d71dde2e640c34fa30f7fb45f70bab65a15808f36784"}
 *
 * Go source:
 * func (tx *RuntimeSyntaxTransformer) getEnumQualifiedElement(enum *ast.EnumDeclaration, member *ast.EnumMember) *ast.Expression {
 * 	prop := tx.getNamespaceQualifiedElement(tx.getNamespaceContainerName(enum.AsNode()), tx.getExpressionForPropertyName(member))
 * 	tx.EmitContext().AddEmitFlags(prop, printer.EFNoComments|printer.EFNoNestedComments|printer.EFNoSourceMap|printer.EFNoNestedSourceMaps)
 * 	return prop
 * }
 */
export function RuntimeSyntaxTransformer_getEnumQualifiedElement(receiver: GoPtr<RuntimeSyntaxTransformer>, enum_: GoPtr<EnumDeclaration>, member: GoPtr<EnumMember>): GoPtr<Expression> {
  const prop = RuntimeSyntaxTransformer_getNamespaceQualifiedElement(receiver, RuntimeSyntaxTransformer_getNamespaceContainerName(receiver, EnumDeclaration_as_nodeData(enum_).AsNode()), RuntimeSyntaxTransformer_getExpressionForPropertyName(receiver, member));
  EmitContext_AddEmitFlags(Transformer_EmitContext(receiver!.__tsgoEmbedded0), prop, EFNoComments | EFNoNestedComments | EFNoSourceMap | EFNoNestedSourceMaps);
  return prop;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/tstransforms/runtimesyntax.go::method::RuntimeSyntaxTransformer.getNamespaceContainerName","kind":"method","status":"implemented","sigHash":"478418459bc97c77125611b406fe3f281b88b70f1e001776e5b059bc0064dc93","bodyHash":"29c6100d8e3392aced576c3ec85ae2563a0d712582a4fc60530081b3358ee303"}
 *
 * Go source:
 * func (tx *RuntimeSyntaxTransformer) getNamespaceContainerName(node *ast.Node) *ast.IdentifierNode {
 * 	return tx.Factory().NewGeneratedNameForNode(node)
 * }
 */
export function RuntimeSyntaxTransformer_getNamespaceContainerName(receiver: GoPtr<RuntimeSyntaxTransformer>, node: GoPtr<Node>): GoPtr<IdentifierNode> {
  return NodeFactory_NewGeneratedNameForNode(Transformer_Factory(receiver!.__tsgoEmbedded0), node);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/tstransforms/runtimesyntax.go::method::RuntimeSyntaxTransformer.getNamespaceQualifiedProperty","kind":"method","status":"implemented","sigHash":"8be9f2b71224478f8c4faa5a145cdca6b268e1e5929c214f679c17e179622047","bodyHash":"058fc6e26bfd3ed9154e29f9f83e7194b7eea7a5092151085cce2aa89c111985"}
 *
 * Go source:
 * func (tx *RuntimeSyntaxTransformer) getNamespaceQualifiedProperty(ns *ast.IdentifierNode, name *ast.IdentifierNode) *ast.Expression {
 * 	return tx.Factory().GetNamespaceMemberName(ns, name, printer.NameOptions{AllowSourceMaps: true})
 * }
 */
export function RuntimeSyntaxTransformer_getNamespaceQualifiedProperty(receiver: GoPtr<RuntimeSyntaxTransformer>, ns: GoPtr<IdentifierNode>, name: GoPtr<IdentifierNode>): GoPtr<Expression> {
  return NodeFactory_GetNamespaceMemberName(Transformer_Factory(receiver!.__tsgoEmbedded0), ns, name, { AllowComments: false, AllowSourceMaps: true });
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/tstransforms/runtimesyntax.go::method::RuntimeSyntaxTransformer.getNamespaceQualifiedElement","kind":"method","status":"implemented","sigHash":"9fe8b96265d350072ba317a7024aae00e1ed9bbbfa0709e638f1fe90c3543e29","bodyHash":"4a8576e5e90c6757e27720f73759ee1ea2bc0e4b1aa5f9ea830590812c3336a8"}
 *
 * Go source:
 * func (tx *RuntimeSyntaxTransformer) getNamespaceQualifiedElement(ns *ast.IdentifierNode, expression *ast.Expression) *ast.Expression {
 * 	qualifiedName := tx.EmitContext().Factory.NewElementAccessExpression(ns, nil /*questionDotToken* /, expression, ast.NodeFlagsNone)
 * 	tx.EmitContext().AssignCommentAndSourceMapRanges(qualifiedName, expression)
 * 	return qualifiedName
 * }
 */
export function RuntimeSyntaxTransformer_getNamespaceQualifiedElement(receiver: GoPtr<RuntimeSyntaxTransformer>, ns: GoPtr<IdentifierNode>, expression: GoPtr<Expression>): GoPtr<Expression> {
  const qualifiedName = NewElementAccessExpression(Transformer_EmitContext(receiver!.__tsgoEmbedded0)!.Factory!.__tsgoEmbedded0, ns, undefined /*questionDotToken*/, expression, NodeFlagsNone);
  EmitContext_AssignCommentAndSourceMapRanges(Transformer_EmitContext(receiver!.__tsgoEmbedded0), qualifiedName, expression);
  return qualifiedName;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/tstransforms/runtimesyntax.go::method::RuntimeSyntaxTransformer.getExportQualifiedReferenceToDeclaration","kind":"method","status":"implemented","sigHash":"0dbbde6258f4a8411c79d8d4f8b252a33ac5541f499507cca6e8efe65bf2ed4f","bodyHash":"9ac2d31ccba0d8cebe3d0313265d7bf8fd25979b17d404ededeb0eb8b5d15192"}
 *
 * Go source:
 * func (tx *RuntimeSyntaxTransformer) getExportQualifiedReferenceToDeclaration(node *ast.Declaration) *ast.Expression {
 * 	if tx.isExportOfNamespace(node.AsNode()) {
 * 		return tx.Factory().GetExternalModuleOrNamespaceExportName(tx.getNamespaceContainerName(tx.currentNamespace), node, false /*allowComments* /, true /*allowSourceMaps* /)
 * 	}
 * 	return tx.Factory().GetDeclarationNameEx(node.AsNode(), printer.NameOptions{AllowSourceMaps: true})
 * }
 */
export function RuntimeSyntaxTransformer_getExportQualifiedReferenceToDeclaration(receiver: GoPtr<RuntimeSyntaxTransformer>, node: GoPtr<Declaration>): GoPtr<Expression> {
  if (RuntimeSyntaxTransformer_isExportOfNamespace(receiver, Node_AsNode(node))) {
    return NodeFactory_GetExternalModuleOrNamespaceExportName(Transformer_Factory(receiver!.__tsgoEmbedded0), RuntimeSyntaxTransformer_getNamespaceContainerName(receiver, receiver!.currentNamespace), node, false /*allowComments*/, true /*allowSourceMaps*/);
  }
  return NodeFactory_GetDeclarationNameEx(Transformer_Factory(receiver!.__tsgoEmbedded0), Node_AsNode(node), { AllowComments: false, AllowSourceMaps: true });
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/tstransforms/runtimesyntax.go::method::RuntimeSyntaxTransformer.addVarForDeclaration","kind":"method","status":"implemented","sigHash":"3a3eee91d036cfaab2d3202f1450f3d5e5be1db6e07b2c4e5edd54ef6ddd3315","bodyHash":"ecf23a0b7ad1730318cc41ada6d190c7acbb0220724a6ce620e9c49c092e2a18"}
 *
 * Go source:
 * func (tx *RuntimeSyntaxTransformer) addVarForDeclaration(statements []*ast.Statement, node *ast.Declaration) ([]*ast.Statement, bool) {
 * 	tx.recordDeclarationInScope(node)
 * 	if !tx.isFirstDeclarationInScope(node) {
 * 		return statements, false
 * 	}
 *
 * 	// var name;
 * 	name := tx.Factory().GetLocalNameEx(node, printer.AssignedNameOptions{AllowSourceMaps: true})
 * 	varDecl := tx.Factory().NewVariableDeclaration(name, nil, nil, nil)
 * 	varFlags := core.IfElse(tx.currentScope == tx.currentSourceFile, ast.NodeFlagsNone, ast.NodeFlagsLet)
 * 	varDecls := tx.Factory().NewVariableDeclarationList(tx.Factory().NewNodeList([]*ast.Node{varDecl}), varFlags)
 * 	// Replicate modifierVisitor: strip decorators, TypeScript modifiers, and export when in namespace.
 * 	modifierMask := ^(ast.ModifierFlagsTypeScriptModifier | ast.ModifierFlagsDecorator)
 * 	if tx.currentNamespace != nil {
 * 		modifierMask &^= ast.ModifierFlagsExport
 * 	}
 * 	modifiers := transformers.ExtractModifiers(tx.EmitContext(), node.Modifiers(), modifierMask)
 * 	varStatement := tx.Factory().NewVariableStatement(modifiers, varDecls)
 *
 * 	tx.EmitContext().SetOriginal(varDecl, node)
 * 	// !!! synthetic comments
 * 	tx.EmitContext().SetOriginal(varStatement, node)
 *
 * 	// Adjust the source map emit to match the old emitter.
 * 	if ast.IsEnumDeclaration(node) {
 * 		tx.EmitContext().SetSourceMapRange(varDecls, node.Loc)
 * 	} else {
 * 		tx.EmitContext().SetSourceMapRange(varStatement, node.Loc)
 * 	}
 *
 * 	tx.EmitContext().SetCommentRange(varStatement, node.Loc)
 * 	tx.EmitContext().AddEmitFlags(varStatement, printer.EFNoTrailingComments)
 * 	statements = append(statements, varStatement)
 *
 * 	return statements, true
 * }
 */
export function RuntimeSyntaxTransformer_addVarForDeclaration(receiver: GoPtr<RuntimeSyntaxTransformer>, statements: GoSlice<GoPtr<Statement>>, node: GoPtr<Declaration>): [GoSlice<GoPtr<Statement>>, bool] {
  RuntimeSyntaxTransformer_recordDeclarationInScope(receiver, Node_AsNode(node));
  if (!RuntimeSyntaxTransformer_isFirstDeclarationInScope(receiver, Node_AsNode(node))) {
    return [statements, false];
  }

  // var name;
  const name = NodeFactory_GetLocalNameEx(Transformer_Factory(receiver!.__tsgoEmbedded0), node, { AllowComments: false, AllowSourceMaps: true, IgnoreAssignedName: false });
  const astFactory = Transformer_Factory(receiver!.__tsgoEmbedded0)!.__tsgoEmbedded0;
  const varDecl = NewVariableDeclaration(astFactory, name, undefined, undefined, undefined);
  const varFlags = IfElse(receiver!.currentScope === receiver!.currentSourceFile, NodeFlagsNone, NodeFlagsLet);
  const varDecls = NewVariableDeclarationList(astFactory, NodeFactory_NewNodeList(astFactory, [varDecl]), varFlags);
  // Replicate modifierVisitor: strip decorators, TypeScript modifiers, and export when in namespace.
  const baseMask = ~(ModifierFlagsTypeScriptModifier | ModifierFlagsDecorator);
  const modifierMask = receiver!.currentNamespace !== undefined ? baseMask & ~ModifierFlagsExport : baseMask;
  const modifiers = ExtractModifiers(Transformer_EmitContext(receiver!.__tsgoEmbedded0), Node_Modifiers(Node_AsNode(node)), modifierMask);
  const varStatement = NewVariableStatement(astFactory, modifiers, varDecls);

  EmitContext_SetOriginal(Transformer_EmitContext(receiver!.__tsgoEmbedded0), varDecl, Node_AsNode(node));
  // !!! synthetic comments
  EmitContext_SetOriginal(Transformer_EmitContext(receiver!.__tsgoEmbedded0), varStatement, Node_AsNode(node));

  // Adjust the source map emit to match the old emitter.
  if (IsEnumDeclaration(Node_AsNode(node))) {
    EmitContext_SetSourceMapRange(Transformer_EmitContext(receiver!.__tsgoEmbedded0), varDecls, Node_AsNode(node)!.Loc);
  } else {
    EmitContext_SetSourceMapRange(Transformer_EmitContext(receiver!.__tsgoEmbedded0), varStatement, Node_AsNode(node)!.Loc);
  }

  EmitContext_SetCommentRange(Transformer_EmitContext(receiver!.__tsgoEmbedded0), varStatement, Node_AsNode(node)!.Loc);
  EmitContext_AddEmitFlags(Transformer_EmitContext(receiver!.__tsgoEmbedded0), varStatement, EFNoTrailingComments);

  return [[...statements, varStatement], true];
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/tstransforms/runtimesyntax.go::method::RuntimeSyntaxTransformer.visitEnumDeclaration","kind":"method","status":"implemented","sigHash":"fd11e7f151ea4867cb66fae4d5210c2eaa84fbccc469bf2673d990ee4d083c57","bodyHash":"290f9137965949f757d506fdb5b9c46881c7ddd4b0c860cb5bc2d5c8ee1e5c6a"}
 *
 * Go source:
 * func (tx *RuntimeSyntaxTransformer) visitEnumDeclaration(node *ast.EnumDeclaration) *ast.Node {
 * 	if !tx.shouldEmitEnumDeclaration(node) {
 * 		return tx.EmitContext().NewNotEmittedStatement(node.AsNode())
 * 	}
 *
 * 	statements := []*ast.Statement{}
 * 	statements, varAdded := tx.addVarForDeclaration(statements, node.AsNode())
 * 	emitFlags := printer.EFNone
 * 	if varAdded && (tx.compilerOptions.GetEmitModuleKind() != core.ModuleKindSystem || tx.currentScope != tx.currentSourceFile) {
 * 		emitFlags |= printer.EFNoLeadingComments
 * 	}
 * 	enumArg := tx.Factory().NewLogicalORExpression(...)
 * 	...
 * 	return tx.Factory().NewSyntaxList(append(statements, enumStatement))
 * }
 */
export function RuntimeSyntaxTransformer_visitEnumDeclaration(receiver: GoPtr<RuntimeSyntaxTransformer>, node: GoPtr<EnumDeclaration>): GoPtr<Node> {
  if (!RuntimeSyntaxTransformer_shouldEmitEnumDeclaration(receiver, node)) {
    return EmitContext_NewNotEmittedStatement(Transformer_EmitContext(receiver!.__tsgoEmbedded0), EnumDeclaration_as_nodeData(node).AsNode());
  }

  let statements: GoSlice<GoPtr<Statement>> = [];
  const [statementsAfterVar, varAdded] = RuntimeSyntaxTransformer_addVarForDeclaration(receiver, statements, EnumDeclaration_as_nodeData(node).AsNode() as unknown as GoPtr<Declaration>);
  statements = statementsAfterVar;

  let emitFlags = EFNone;
  if (varAdded && (CompilerOptions_GetEmitModuleKind(receiver!.compilerOptions) !== ModuleKindSystem || receiver!.currentScope !== receiver!.currentSourceFile)) {
    emitFlags = emitFlags | EFNoLeadingComments;
  }

  const astFactory = Transformer_Factory(receiver!.__tsgoEmbedded0)!.__tsgoEmbedded0!;
  const factory = Transformer_Factory(receiver!.__tsgoEmbedded0)!;
  const nodeAsNode = EnumDeclaration_as_nodeData(node).AsNode();

  const enumArg0 = NodeFactory_NewLogicalORExpression(
    factory,
    RuntimeSyntaxTransformer_getExportQualifiedReferenceToDeclaration(receiver, nodeAsNode as unknown as GoPtr<Declaration>),
    NodeFactory_NewAssignmentExpression(
      factory,
      RuntimeSyntaxTransformer_getExportQualifiedReferenceToDeclaration(receiver, nodeAsNode as unknown as GoPtr<Declaration>),
      NewObjectLiteralExpression(astFactory, NodeFactory_NewNodeList(astFactory, []), false),
    ),
  );

  let enumArg = enumArg0;
  if (RuntimeSyntaxTransformer_isExportOfNamespace(receiver, nodeAsNode)) {
    const localName = NodeFactory_GetLocalNameEx(factory, nodeAsNode as unknown as GoPtr<Declaration>, { AllowComments: false, AllowSourceMaps: true, IgnoreAssignedName: false });
    enumArg = NodeFactory_NewAssignmentExpression(factory, localName, enumArg);
  }

  const enumParamName = NodeFactory_NewGeneratedNameForNode(factory, nodeAsNode);
  EmitContext_SetSourceMapRange(Transformer_EmitContext(receiver!.__tsgoEmbedded0), enumParamName, Node_Name(nodeAsNode)!.Loc);

  const enumParam = NewParameterDeclaration(astFactory, undefined, undefined, enumParamName, undefined, undefined, undefined);
  const enumBody = RuntimeSyntaxTransformer_transformEnumBody(receiver, node);
  const enumFunc = NewFunctionExpression(astFactory, undefined, undefined, undefined, undefined, NodeFactory_NewNodeList(astFactory, [enumParam]), undefined, undefined, enumBody);
  const enumCall = NewCallExpression(astFactory, NewParenthesizedExpression(astFactory, enumFunc), undefined, undefined, NodeFactory_NewNodeList(astFactory, [enumArg]), NodeFlagsNone);
  const enumStatement = NewExpressionStatement(astFactory, enumCall);
  EmitContext_SetOriginal(Transformer_EmitContext(receiver!.__tsgoEmbedded0), enumStatement, nodeAsNode);
  EmitContext_AssignCommentAndSourceMapRanges(Transformer_EmitContext(receiver!.__tsgoEmbedded0), enumStatement, nodeAsNode);
  EmitContext_AddEmitFlags(Transformer_EmitContext(receiver!.__tsgoEmbedded0), enumStatement, emitFlags);
  return NewSyntaxList(astFactory, [...statements, enumStatement]);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/tstransforms/runtimesyntax.go::method::RuntimeSyntaxTransformer.transformEnumBody","kind":"method","status":"implemented","sigHash":"9fef6ae9d34c97a4043a9ffd682b3f1a94b4af5227c0ae8d211228ad7644dfd0","bodyHash":"e5fe96ef2e1d4660802ae3666ce18a070cc3af4b68ee9eb78e8112a0e99cf52b"}
 *
 * Go source:
 * func (tx *RuntimeSyntaxTransformer) transformEnumBody(node *ast.EnumDeclaration) *ast.BlockNode {
 * 	savedCurrentEnum := tx.currentEnum
 * 	tx.currentEnum = node.AsNode()
 * 	node = tx.Visitor().VisitEachChild(node.AsNode()).AsEnumDeclaration()
 * 	...
 * 	return tx.Factory().NewBlock(statementList, true /*multiline* /)
 * }
 */
export function RuntimeSyntaxTransformer_transformEnumBody(receiver: GoPtr<RuntimeSyntaxTransformer>, node: GoPtr<EnumDeclaration>): GoPtr<BlockNode> {
  const savedCurrentEnum = receiver!.currentEnum;
  receiver!.currentEnum = Node_AsNode(node) as unknown as GoPtr<EnumDeclarationNode>;

  // visit the children of `node` in advance to capture any references to enum members
  const visitedNode = NodeVisitor_VisitEachChild((Transformer_Visitor(receiver!.__tsgoEmbedded0) as ConcreteNodeVisitor), Node_AsNode(node));
  const visitedEnum = AsEnumDeclaration(visitedNode);

  let statements: GoSlice<GoPtr<Statement>> = [];
  for (let i = 0; i < visitedEnum!.Members!.Nodes!.length; i++) {
    statements = RuntimeSyntaxTransformer_transformEnumMember(receiver, statements, visitedEnum, i);
  }

  const astFactory = Transformer_Factory(receiver!.__tsgoEmbedded0)!.__tsgoEmbedded0!;
  const statementList = NodeFactory_NewNodeList(astFactory, statements);
  statementList!.Loc = visitedEnum!.Members!.Loc;

  receiver!.currentEnum = savedCurrentEnum;
  return NewBlock(astFactory, statementList, true /*multiline*/);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/tstransforms/runtimesyntax.go::method::RuntimeSyntaxTransformer.transformEnumMember","kind":"method","status":"implemented","sigHash":"4fd24669997aaec2c65b694a1c2450f4c2ef8a83b517ca7cef4bcdffae1186a0","bodyHash":"b83e04cc22e0772053ae1e55d8c88b2f578c02c27becaa4d0fb1150b588639d8"}
 *
 * Go source:
 * func (tx *RuntimeSyntaxTransformer) transformEnumMember(statements []*ast.Statement, enum *ast.EnumDeclaration, index int) []*ast.Statement {
 * 	... (depends on getExpressionForPropertyName which is blocked on Node.Text/Visitor)
 * }
 */
export function RuntimeSyntaxTransformer_transformEnumMember(receiver: GoPtr<RuntimeSyntaxTransformer>, statements: GoSlice<GoPtr<Statement>>, enum_: GoPtr<EnumDeclaration>, index: int): GoSlice<GoPtr<Statement>> {
  const memberNode = enum_!.Members!.Nodes![index];
  const member = AsEnumMember(memberNode);

  const savedParent = receiver!.parentNode;
  receiver!.parentNode = receiver!.currentNode;
  receiver!.currentNode = memberNode;

  // E[E["A"] = x] = "A";
  //             ^
  let expression: GoPtr<Node> = member!.Initializer; // NOTE: already visited

  let useExplicitReverseMapping = false;

  const parseNode = EmitContext_ParseNode(Transformer_EmitContext(receiver!.__tsgoEmbedded0), memberNode);
  const result = receiver!.emitResolver.GetEnumMemberValue(parseNode);
  const factory = Transformer_Factory(receiver!.__tsgoEmbedded0)!;
  if (typeof result.Value === "number") {
    const value = result.Value as JsNumber;
    expression = Coalesce(constantExpression(value, factory), expression);
    useExplicitReverseMapping = true;
  } else if (typeof result.Value === "string") {
    const value = result.Value as string;
    expression = Coalesce(constantExpression(value, factory), expression);
  } else {
    if (expression === undefined) {
      expression = NodeFactory_NewVoidZeroExpression(factory);
    }
    useExplicitReverseMapping = !result.IsSyntacticallyString;
  }

  // Define the enum member property:
  //  E[E["A"] = 0] = "A";
  //    ^^^^^^^^--_____
  expression = NodeFactory_NewAssignmentExpression(
    factory,
    RuntimeSyntaxTransformer_getEnumQualifiedElement(receiver, enum_, member),
    expression,
  );

  if (useExplicitReverseMapping) {
    //  E[E["A"] = 0] = "A";
    //  ^^--------------^^^^^
    const astFactory = Transformer_Factory(receiver!.__tsgoEmbedded0)!.__tsgoEmbedded0!;
    expression = NodeFactory_NewAssignmentExpression(
      factory,
      NewElementAccessExpression(
        Transformer_EmitContext(receiver!.__tsgoEmbedded0)!.Factory!.__tsgoEmbedded0,
        RuntimeSyntaxTransformer_getNamespaceContainerName(receiver, Node_AsNode(enum_)),
        undefined /*questionDotToken*/,
        expression,
        NodeFlagsNone,
      ),
      RuntimeSyntaxTransformer_getExpressionForPropertyName(receiver, member),
    );
  }

  const astFactory2 = Transformer_Factory(receiver!.__tsgoEmbedded0)!.__tsgoEmbedded0!;
  const memberStatement = NewExpressionStatement(astFactory2, expression);
  EmitContext_AssignCommentAndSourceMapRanges(Transformer_EmitContext(receiver!.__tsgoEmbedded0), expression, memberNode);
  EmitContext_AssignCommentAndSourceMapRanges(Transformer_EmitContext(receiver!.__tsgoEmbedded0), memberStatement, memberNode);

  receiver!.currentNode = receiver!.parentNode;
  receiver!.parentNode = savedParent;
  return [...statements, memberStatement];
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/tstransforms/runtimesyntax.go::method::RuntimeSyntaxTransformer.visitModuleDeclaration","kind":"method","status":"implemented","sigHash":"41dcfe9d138ac07c2622eebf7c4774501777738dfe9f45eabaf372de70e8228e","bodyHash":"e34226ccf3c5cc637b6f6b2c47d9c253a45efc8c06daef8668980fd35073d59d"}
 *
 * Go source:
 * func (tx *RuntimeSyntaxTransformer) visitModuleDeclaration(node *ast.ModuleDeclaration) *ast.Node {
 * 	... (depends on transformModuleBody which is blocked on Visitor)
 * }
 */
export function RuntimeSyntaxTransformer_visitModuleDeclaration(receiver: GoPtr<RuntimeSyntaxTransformer>, node: GoPtr<ModuleDeclaration>): GoPtr<Node> {
  if (!RuntimeSyntaxTransformer_shouldEmitModuleDeclaration(receiver, node)) {
    return EmitContext_NewNotEmittedStatement(Transformer_EmitContext(receiver!.__tsgoEmbedded0), ModuleDeclaration_as_nodeData(node).AsNode());
  }

  let statements: GoSlice<GoPtr<Statement>> = [];
  const [statementsAfterVar, varAdded] = RuntimeSyntaxTransformer_addVarForDeclaration(receiver, statements, ModuleDeclaration_as_nodeData(node).AsNode() as unknown as GoPtr<Declaration>);
  statements = statementsAfterVar;

  let emitFlags = EFNone;
  if (varAdded && (CompilerOptions_GetEmitModuleKind(receiver!.compilerOptions) !== ModuleKindSystem || receiver!.currentScope !== receiver!.currentSourceFile)) {
    emitFlags = emitFlags | EFNoLeadingComments;
  }

  const astFactory = Transformer_Factory(receiver!.__tsgoEmbedded0)!.__tsgoEmbedded0!;
  const factory = Transformer_Factory(receiver!.__tsgoEmbedded0)!;
  const nodeAsNode = ModuleDeclaration_as_nodeData(node).AsNode();

  //  x || (x = {})
  //  exports.x || (exports.x = {})
  const moduleArg0 = NodeFactory_NewLogicalORExpression(
    factory,
    RuntimeSyntaxTransformer_getExportQualifiedReferenceToDeclaration(receiver, nodeAsNode as unknown as GoPtr<Declaration>),
    NodeFactory_NewAssignmentExpression(
      factory,
      RuntimeSyntaxTransformer_getExportQualifiedReferenceToDeclaration(receiver, nodeAsNode as unknown as GoPtr<Declaration>),
      NewObjectLiteralExpression(astFactory, NodeFactory_NewNodeList(astFactory, []), false),
    ),
  );

  let moduleArg = moduleArg0;
  if (RuntimeSyntaxTransformer_isExportOfNamespace(receiver, nodeAsNode)) {
    const localName = NodeFactory_GetLocalNameEx(factory, nodeAsNode as unknown as GoPtr<Declaration>, { AllowComments: false, AllowSourceMaps: true, IgnoreAssignedName: false });
    moduleArg = NodeFactory_NewAssignmentExpression(factory, localName, moduleArg);
  }

  // (function (name) { ... })(name || (name = {}))
  const moduleParamName = NodeFactory_NewGeneratedNameForNode(factory, nodeAsNode);
  EmitContext_SetSourceMapRange(Transformer_EmitContext(receiver!.__tsgoEmbedded0), moduleParamName, Node_Name(nodeAsNode)!.Loc);

  const moduleParam = NewParameterDeclaration(astFactory, undefined, undefined, moduleParamName, undefined, undefined, undefined);
  const moduleBody = RuntimeSyntaxTransformer_transformModuleBody(receiver, node, RuntimeSyntaxTransformer_getNamespaceContainerName(receiver, nodeAsNode));
  const moduleFunc = NewFunctionExpression(astFactory, undefined, undefined, undefined, undefined, NodeFactory_NewNodeList(astFactory, [moduleParam]), undefined, undefined, moduleBody);
  const moduleCall = NewCallExpression(astFactory, NewParenthesizedExpression(astFactory, moduleFunc), undefined, undefined, NodeFactory_NewNodeList(astFactory, [moduleArg]), NodeFlagsNone);
  const moduleStatement = NewExpressionStatement(astFactory, moduleCall);
  EmitContext_SetOriginal(Transformer_EmitContext(receiver!.__tsgoEmbedded0), moduleStatement, nodeAsNode);
  EmitContext_AssignCommentAndSourceMapRanges(Transformer_EmitContext(receiver!.__tsgoEmbedded0), moduleStatement, nodeAsNode);
  EmitContext_AddEmitFlags(Transformer_EmitContext(receiver!.__tsgoEmbedded0), moduleStatement, emitFlags);
  return NewSyntaxList(astFactory, [...statements, moduleStatement]);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/tstransforms/runtimesyntax.go::method::RuntimeSyntaxTransformer.transformModuleBody","kind":"method","status":"implemented","sigHash":"49dd4d5a8be1fd451738b376bbd3e3d0c5a4e02ea98c7c6c89aa6f32a377bf4c","bodyHash":"80ff4703f8d2ec7ca921c6be9dfc6a05614ab0204b03cf01f73047278eccaaec"}
 *
 * Go source:
 * func (tx *RuntimeSyntaxTransformer) transformModuleBody(node *ast.ModuleDeclaration, namespaceLocalName *ast.IdentifierNode) *ast.BlockNode {
 * 	... (uses tx.Visitor().VisitEachChild / VisitSlice)
 * }
 */
export function RuntimeSyntaxTransformer_transformModuleBody(receiver: GoPtr<RuntimeSyntaxTransformer>, node: GoPtr<ModuleDeclaration>, namespaceLocalName: GoPtr<IdentifierNode>): GoPtr<BlockNode> {
  const savedCurrentNamespace = receiver!.currentNamespace;
  const savedCurrentScope = receiver!.currentScope;
  const savedCurrentScopeFirstDeclarationsOfName = receiver!.currentScopeFirstDeclarationsOfName;

  receiver!.currentNamespace = Node_AsNode(node) as unknown as GoPtr<ModuleDeclarationNode>;
  receiver!.currentScopeFirstDeclarationsOfName = undefined;

  let statements: GoSlice<GoPtr<Statement>> = [];
  EmitContext_StartVariableEnvironment(Transformer_EmitContext(receiver!.__tsgoEmbedded0));

  const visitor = Transformer_Visitor(receiver!.__tsgoEmbedded0) as ConcreteNodeVisitor;
  const astFactory = Transformer_Factory(receiver!.__tsgoEmbedded0)!.__tsgoEmbedded0!;

  let statementsLocation: TextRange = { pos: 0, end: 0 };
  let blockLocation: TextRange = { pos: 0, end: 0 };

  if (node!.Body !== undefined) {
    if (node!.Body!.Kind === KindModuleBlock) {
      // visit the children of `node` in advance to capture any references to namespace members
      const visitedNode = NodeVisitor_VisitEachChild(visitor, Node_AsNode(node));
      const visitedModule = AsModuleDeclaration(visitedNode);
      const body = AsModuleBlock(visitedModule!.Body);
      statements = body!.Statements!.Nodes! as GoSlice<GoPtr<Statement>>;
      statementsLocation = body!.Statements!.Loc;
      blockLocation = body!.Loc;
    } else { // node.Body.Kind == KindModuleDeclaration
      const [visitedStatements] = NodeVisitor_VisitSlice(visitor, [node!.Body]);
      statements = visitedStatements as GoSlice<GoPtr<Statement>>;
      const innermostModule = getInnermostModuleDeclarationFromDottedModule(node);
      const moduleBlock = AsModuleBlock(innermostModule!.Body);
      statementsLocation = TextRange_WithPos(moduleBlock!.Statements!.Loc, -1);
    }
  }

  receiver!.currentNamespace = savedCurrentNamespace;
  receiver!.currentScope = savedCurrentScope;
  receiver!.currentScopeFirstDeclarationsOfName = savedCurrentScopeFirstDeclarationsOfName;

  statements = EmitContext_EndAndMergeVariableEnvironment(Transformer_EmitContext(receiver!.__tsgoEmbedded0), statements);
  const statementList = NodeFactory_NewNodeList(astFactory, statements);
  statementList!.Loc = statementsLocation;
  const block = NewBlock(astFactory, statementList, true /*multiline*/);
  block!.Loc = blockLocation;

  //  namespace hello.hi.world { ... }
  //  should not emit comment on outer namespaces
  if (node!.Body === undefined || node!.Body!.Kind !== KindModuleBlock) {
    EmitContext_AddEmitFlags(Transformer_EmitContext(receiver!.__tsgoEmbedded0), block, EFNoComments);
  }
  return block;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/tstransforms/runtimesyntax.go::method::RuntimeSyntaxTransformer.visitImportEqualsDeclaration","kind":"method","status":"implemented","sigHash":"e362299bbc7fabda2e4503f90ffd3eca5122c7509dd0d47829a0d0f0f175f814","bodyHash":"ee8292060e5ef2fae90c8c8c59c96f5594f4d90f304ac5b88b0f702767438813"}
 *
 * Go source:
 * func (tx *RuntimeSyntaxTransformer) visitImportEqualsDeclaration(node *ast.ImportEqualsDeclaration) *ast.Node {
 * 	... (uses tx.Visitor().VisitEachChild)
 * }
 */
export function RuntimeSyntaxTransformer_visitImportEqualsDeclaration(receiver: GoPtr<RuntimeSyntaxTransformer>, node: GoPtr<ImportEqualsDeclaration>): GoPtr<Node> {
  if (node!.ModuleReference!.Kind === KindExternalModuleReference) {
    return NodeVisitor_VisitEachChild((Transformer_Visitor(receiver!.__tsgoEmbedded0) as ConcreteNodeVisitor), Node_AsNode(node));
  }

  const factory = Transformer_Factory(receiver!.__tsgoEmbedded0)!;
  const astFactory = factory.__tsgoEmbedded0!;
  const moduleReference = NodeFactory_CreateExpressionFromEntityName(factory, node!.ModuleReference);
  EmitContext_SetEmitFlags(Transformer_EmitContext(receiver!.__tsgoEmbedded0), moduleReference, EFNoComments | EFNoNestedComments);
  const nodeAsNode = Node_AsNode(node);

  if (!RuntimeSyntaxTransformer_isExportOfNamespace(receiver, nodeAsNode)) {
    //  export var ${name} = ${moduleReference};
    //  var ${name} = ${moduleReference};
    const varDecl = NewVariableDeclaration(astFactory, node!.name, undefined /*exclamationToken*/, undefined /*type*/, moduleReference);
    EmitContext_SetOriginal(Transformer_EmitContext(receiver!.__tsgoEmbedded0), varDecl, nodeAsNode);
    const varList = NewVariableDeclarationList(astFactory, NodeFactory_NewNodeList(astFactory, [varDecl]), NodeFlagsNone);
    const varModifiers = ExtractModifiers(Transformer_EmitContext(receiver!.__tsgoEmbedded0), Node_Modifiers(nodeAsNode), ModifierFlagsExport);
    const varStatement = NewVariableStatement(astFactory, varModifiers, varList);
    EmitContext_SetOriginal(Transformer_EmitContext(receiver!.__tsgoEmbedded0), varStatement, nodeAsNode);
    EmitContext_AssignCommentAndSourceMapRanges(Transformer_EmitContext(receiver!.__tsgoEmbedded0), varStatement, nodeAsNode);
    return varStatement;
  } else {
    // exports.${name} = ${moduleReference};
    const statement = RuntimeSyntaxTransformer_createExportStatement(receiver, node!.name as unknown as GoPtr<IdentifierNode>, moduleReference, nodeAsNode!.Loc, nodeAsNode!.Loc, nodeAsNode);
    statement!.Loc = nodeAsNode!.Loc;
    return statement;
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/tstransforms/runtimesyntax.go::method::RuntimeSyntaxTransformer.visitVariableStatement","kind":"method","status":"implemented","sigHash":"f9ebe80593846a36ebf6eef57eda6731f1b4a59ed38ba2d27bcecffb256a6130","bodyHash":"afd578072c77f975963dc6f56639024a580ad498c2e773915df691fdcdfaa14b"}
 *
 * Go source:
 * func (tx *RuntimeSyntaxTransformer) visitVariableStatement(node *ast.VariableStatement) *ast.Node {
 * 	... (uses tx.Visitor(), ast.IsBindingPattern, transformers.FlattenDestructuringAssignment)
 * }
 */
export function RuntimeSyntaxTransformer_visitVariableStatement(receiver: GoPtr<RuntimeSyntaxTransformer>, node: GoPtr<VariableStatement>): GoPtr<Node> {
  if (RuntimeSyntaxTransformer_isExportOfNamespace(receiver, Node_AsNode(node))) {
    let expressions: GoSlice<GoPtr<Expression>> = [];
    const declList = AsVariableDeclarationList(node!.DeclarationList);
    for (const declaration of declList!.Declarations!.Nodes!) {
      const v = AsVariableDeclaration(declaration);
      if (v!.Initializer === undefined) {
        continue;
      }
      if (IsBindingPattern(Node_Name(Node_AsNode(v)))) {
        const expression = FlattenDestructuringAssignment(
          receiver!.__tsgoEmbedded0,
          NodeVisitor_VisitNode((Transformer_Visitor(receiver!.__tsgoEmbedded0) as ConcreteNodeVisitor), declaration),
          false, /*needsValue*/
          FlattenLevelAll,
          (exportName: GoPtr<IdentifierNode>, exportValue: GoPtr<Expression>, location: GoPtr<TextRange>) =>
            RuntimeSyntaxTransformer_createNamespaceExportExpression(receiver, exportName, exportValue, location),
        );
        if (expression !== undefined) {
          expressions = [...expressions, expression];
        }
      } else {
        const expression = ConvertVariableDeclarationToAssignmentExpression(Transformer_EmitContext(receiver!.__tsgoEmbedded0), v);
        if (expression !== undefined) {
          expressions = [...expressions, expression];
        }
      }
    }
    if (expressions.length === 0) {
      return undefined;
    }
    const factory = Transformer_Factory(receiver!.__tsgoEmbedded0)!;
    const expression = NodeFactory_InlineExpressions(factory, expressions);
    const astFactory = factory.__tsgoEmbedded0!;
    const statement = NewExpressionStatement(astFactory, expression);
    EmitContext_SetOriginal(Transformer_EmitContext(receiver!.__tsgoEmbedded0), statement, Node_AsNode(node));
    EmitContext_AssignCommentAndSourceMapRanges(Transformer_EmitContext(receiver!.__tsgoEmbedded0), statement, Node_AsNode(node));

    // re-visit as the new node
    const savedCurrent = receiver!.currentNode;
    receiver!.currentNode = statement;
    const result = NodeVisitor_VisitEachChild((Transformer_Visitor(receiver!.__tsgoEmbedded0) as ConcreteNodeVisitor), statement);
    receiver!.currentNode = savedCurrent;
    return result;
  }
  return NodeVisitor_VisitEachChild((Transformer_Visitor(receiver!.__tsgoEmbedded0) as ConcreteNodeVisitor), Node_AsNode(node));
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/tstransforms/runtimesyntax.go::method::RuntimeSyntaxTransformer.createNamespaceExportExpression","kind":"method","status":"implemented","sigHash":"800271c45d40f398b922db380c69904ab928d959a9940bae3259cc6fb3ca42c9","bodyHash":"172254f1b5981ea71c1d4f54c5ebe7a82d41b4182f0c2162caa9443a119b8d66"}
 *
 * Go source:
 * func (tx *RuntimeSyntaxTransformer) createNamespaceExportExpression(exportName *ast.IdentifierNode, exportValue *ast.Expression, location *core.TextRange) *ast.Expression {
 * 	memberName := tx.getNamespaceQualifiedProperty(tx.getNamespaceContainerName(tx.currentNamespace), exportName)
 * 	expression := tx.Factory().NewAssignmentExpression(memberName, exportValue)
 * 	if location != nil {
 * 		expression.Loc = *location
 * 	}
 * 	return expression
 * }
 */
export function RuntimeSyntaxTransformer_createNamespaceExportExpression(receiver: GoPtr<RuntimeSyntaxTransformer>, exportName: GoPtr<IdentifierNode>, exportValue: GoPtr<Expression>, location: GoPtr<TextRange>): GoPtr<Expression> {
  const memberName = RuntimeSyntaxTransformer_getNamespaceQualifiedProperty(receiver, RuntimeSyntaxTransformer_getNamespaceContainerName(receiver, receiver!.currentNamespace), exportName);
  const expression = NodeFactory_NewAssignmentExpression(Transformer_Factory(receiver!.__tsgoEmbedded0), memberName, exportValue);
  if (location !== undefined) {
    expression!.Loc = location;
  }
  return expression;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/tstransforms/runtimesyntax.go::method::RuntimeSyntaxTransformer.visitFunctionDeclaration","kind":"method","status":"implemented","sigHash":"a61907da3eb16cd8b124d8d4d3f3344f75a85082e798eb8fe2458bb9a8357582","bodyHash":"a26cf92cd525abd41b406a0d088469a9e64243c7d24a94c19b4d3c6c7c0e41de"}
 *
 * Go source:
 * func (tx *RuntimeSyntaxTransformer) visitFunctionDeclaration(node *ast.FunctionDeclaration) *ast.Node {
 * 	... (uses tx.Visitor(), tx.Factory().UpdateFunctionDeclaration)
 * }
 */
export function RuntimeSyntaxTransformer_visitFunctionDeclaration(receiver: GoPtr<RuntimeSyntaxTransformer>, node: GoPtr<FunctionDeclaration>): GoPtr<Node> {
  if (RuntimeSyntaxTransformer_isExportOfNamespace(receiver, Node_AsNode(node))) {
    const visitor = Transformer_Visitor(receiver!.__tsgoEmbedded0) as ConcreteNodeVisitor;
    const factory = Transformer_Factory(receiver!.__tsgoEmbedded0)!;
    const updated = NodeFactory_UpdateFunctionDeclaration(
      factory.__tsgoEmbedded0!,
      node,
      NodeVisitor_VisitModifiers(visitor, ExtractModifiers(Transformer_EmitContext(receiver!.__tsgoEmbedded0), Node_Modifiers(Node_AsNode(node)), ~ModifierFlagsExport)),
      node!.AsteriskToken,
      NodeVisitor_VisitNode(visitor, node!.name) as unknown as GoPtr<IdentifierNode>,
      undefined /*typeParameters*/,
      NodeVisitor_VisitNodes(visitor, node!.Parameters),
      undefined /*returnType*/,
      undefined /*fullSignature*/,
      NodeVisitor_VisitNode(visitor, node!.Body),
    );
    const export_ = RuntimeSyntaxTransformer_createExportStatementForDeclaration(receiver, Node_AsNode(node) as unknown as GoPtr<Declaration>);
    if (export_ !== undefined) {
      return NewSyntaxList(factory.__tsgoEmbedded0!, [updated, export_]);
    }
    return updated;
  }
  return NodeVisitor_VisitEachChild((Transformer_Visitor(receiver!.__tsgoEmbedded0) as ConcreteNodeVisitor), Node_AsNode(node));
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/tstransforms/runtimesyntax.go::method::RuntimeSyntaxTransformer.getParameterProperties","kind":"method","status":"implemented","sigHash":"9f55290e5e1fb208e367288c3432369b4c7a5d608d1e2778b8b5feb679f40bfc","bodyHash":"fc07721c009c186d6687e3166187ee396555f452380a445f93c57138bb68ce42"}
 *
 * Go source:
 * func (tx *RuntimeSyntaxTransformer) getParameterProperties(constructor *ast.Node) []*ast.ParameterDeclaration {
 * 	... (uses constructor.Parameters(), ast.IsParameterPropertyDeclaration)
 * }
 */
export function RuntimeSyntaxTransformer_getParameterProperties(receiver: GoPtr<RuntimeSyntaxTransformer>, constructor_: GoPtr<Node>): GoSlice<GoPtr<ParameterDeclaration>> {
  if (constructor_ === undefined) {
    return [];
  }
  return (Node_Parameters(constructor_) ?? [])
    .filter((parameter) => IsParameterPropertyDeclaration(parameter as unknown as GoPtr<Node>, constructor_))
    .map((parameter) => AsParameterDeclaration(parameter as unknown as GoPtr<Node>));
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/tstransforms/runtimesyntax.go::method::RuntimeSyntaxTransformer.visitClassDeclaration","kind":"method","status":"implemented","sigHash":"fa3cb6d45c2c5202e35670a1a37c567b575e6f4b27e87c1204d5b5bea2261779","bodyHash":"4b4292cefe8d581a5a88fc5d59041f30cecdcd6145fe7635d59de000d3bc0f71"}
 *
 * Go source:
 * func (tx *RuntimeSyntaxTransformer) visitClassDeclaration(node *ast.ClassDeclaration) *ast.Node {
 * 	... (uses tx.Visitor(), tx.Factory().UpdateClassDeclaration, getParameterProperties)
 * }
 */
export function RuntimeSyntaxTransformer_visitClassDeclaration(receiver: GoPtr<RuntimeSyntaxTransformer>, node: GoPtr<ClassDeclaration>): GoPtr<Node> {
  const exported = RuntimeSyntaxTransformer_isExportOfNamespace(receiver, Node_AsNode(node));
  const visitor = Transformer_Visitor(receiver!.__tsgoEmbedded0) as ConcreteNodeVisitor;
  const factory = Transformer_Factory(receiver!.__tsgoEmbedded0)!;
  const astFactory = factory.__tsgoEmbedded0!;

  let modifiers: GoPtr<ModifierList>;
  if (exported) {
    modifiers = NodeVisitor_VisitModifiers(visitor, ExtractModifiers(Transformer_EmitContext(receiver!.__tsgoEmbedded0), Node_Modifiers(Node_AsNode(node)), ~ModifierFlagsExportDefault));
  } else {
    modifiers = NodeVisitor_VisitModifiers(visitor, Node_Modifiers(Node_AsNode(node)));
  }

  let name = NodeVisitor_VisitNode(visitor, node!.name) as unknown as GoPtr<IdentifierNode>;
  if (name === undefined && (exported || ChildIsDecorated(Tristate_IsTrue(receiver!.compilerOptions!.ExperimentalDecorators!), Node_AsNode(node), undefined))) {
    name = NodeFactory_NewGeneratedNameForNode(factory, Node_AsNode(node));
  }
  const heritageClauses = NodeVisitor_VisitNodes(visitor, node!.HeritageClauses);
  let members = NodeVisitor_VisitNodes(visitor, node!.Members);
  const parameterProperties = RuntimeSyntaxTransformer_getParameterProperties(receiver, Find(node!.Members!.Nodes!, IsConstructorDeclaration));

  if (parameterProperties.length > 0) {
    let newMembers: GoSlice<GoPtr<Node>> = [];
    for (const parameter of parameterProperties) {
      if (IsIdentifier(Node_Name(Node_AsNode(parameter)))) {
        const parameterProperty = NewPropertyDeclaration(
          astFactory,
          undefined /*modifiers*/,
          Node_Clone(Node_Name(Node_AsNode(parameter))!, { AsNodeFactory: () => astFactory }),
          undefined /*questionOrExclamationToken*/,
          undefined /*type*/,
          undefined /*initializer*/,
        );
        EmitContext_SetOriginal(Transformer_EmitContext(receiver!.__tsgoEmbedded0), parameterProperty, Node_AsNode(parameter));
        newMembers = [...newMembers, parameterProperty];
      }
    }
    if (newMembers.length > 0) {
      newMembers = [...newMembers, ...members!.Nodes!];
      members = NodeFactory_NewNodeList(astFactory, newMembers);
      members!.Loc = node!.Members!.Loc;
    }
  }

  const updated = NodeFactory_UpdateClassDeclaration(factory.__tsgoEmbedded0!, node, modifiers, name, undefined /*typeParameters*/, heritageClauses, members);
  if (exported) {
    const export_ = RuntimeSyntaxTransformer_createExportStatementForDeclaration(receiver, Node_AsNode(node) as unknown as GoPtr<Declaration>);
    if (export_ !== undefined) {
      return NewSyntaxList(astFactory, [updated, export_]);
    }
  }
  return updated;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/tstransforms/runtimesyntax.go::method::RuntimeSyntaxTransformer.visitClassExpression","kind":"method","status":"implemented","sigHash":"c908858ce6c414b479791ee872cae9d2a2c79b4a33581ac5e9a65dd44262c485","bodyHash":"10ce0015c7aba18818809da30c77441c78b61da8ae52636722a6e5b2cd6b7c3c"}
 *
 * Go source:
 * func (tx *RuntimeSyntaxTransformer) visitClassExpression(node *ast.ClassExpression) *ast.Node {
 * 	... (uses tx.Visitor(), tx.Factory().UpdateClassExpression)
 * }
 */
export function RuntimeSyntaxTransformer_visitClassExpression(receiver: GoPtr<RuntimeSyntaxTransformer>, node: GoPtr<ClassExpression>): GoPtr<Node> {
  const visitor = Transformer_Visitor(receiver!.__tsgoEmbedded0) as ConcreteNodeVisitor;
  const factory = Transformer_Factory(receiver!.__tsgoEmbedded0)!;
  const astFactory = factory.__tsgoEmbedded0!;

  const modifiers = NodeVisitor_VisitModifiers(visitor, ExtractModifiers(Transformer_EmitContext(receiver!.__tsgoEmbedded0), Node_Modifiers(Node_AsNode(node)), ~ModifierFlagsExportDefault));
  const name = NodeVisitor_VisitNode(visitor, node!.name) as unknown as GoPtr<IdentifierNode>;
  const heritageClauses = NodeVisitor_VisitNodes(visitor, node!.HeritageClauses);
  let members = NodeVisitor_VisitNodes(visitor, node!.Members);
  const parameterProperties = RuntimeSyntaxTransformer_getParameterProperties(receiver, Find(node!.Members!.Nodes!, IsConstructorDeclaration));

  if (parameterProperties.length > 0) {
    let newMembers: GoSlice<GoPtr<Node>> = [];
    for (const parameter of parameterProperties) {
      if (IsIdentifier(Node_Name(Node_AsNode(parameter)))) {
        const parameterProperty = NewPropertyDeclaration(
          astFactory,
          undefined /*modifiers*/,
          Node_Clone(Node_Name(Node_AsNode(parameter))!, { AsNodeFactory: () => astFactory }),
          undefined /*questionOrExclamationToken*/,
          undefined /*type*/,
          undefined /*initializer*/,
        );
        EmitContext_SetOriginal(Transformer_EmitContext(receiver!.__tsgoEmbedded0), parameterProperty, Node_AsNode(parameter));
        newMembers = [...newMembers, parameterProperty];
      }
    }
    if (newMembers.length > 0) {
      newMembers = [...newMembers, ...members!.Nodes!];
      members = NodeFactory_NewNodeList(astFactory, newMembers);
      members!.Loc = node!.Members!.Loc;
    }
  }

  return NodeFactory_UpdateClassExpression(factory.__tsgoEmbedded0!, node, modifiers, name, undefined /*typeParameters*/, heritageClauses, members);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/tstransforms/runtimesyntax.go::method::RuntimeSyntaxTransformer.visitConstructorDeclaration","kind":"method","status":"implemented","sigHash":"11e29e5207a46b38904dde972d9814cf46f4fe9ecadcc92011735d0e3d84486f","bodyHash":"705c6ad3d56dcb6a00fc5ac834a169ba2dc4881acc102b4bcf802c32b3e7d7d4"}
 *
 * Go source:
 * func (tx *RuntimeSyntaxTransformer) visitConstructorDeclaration(node *ast.ConstructorDeclaration) *ast.Node {
 * 	... (uses tx.Visitor(), tx.Factory().UpdateConstructorDeclaration)
 * }
 */
export function RuntimeSyntaxTransformer_visitConstructorDeclaration(receiver: GoPtr<RuntimeSyntaxTransformer>, node: GoPtr<ConstructorDeclaration>): GoPtr<Node> {
  const visitor = Transformer_Visitor(receiver!.__tsgoEmbedded0) as ConcreteNodeVisitor;
  const factory = Transformer_Factory(receiver!.__tsgoEmbedded0)!;
  const modifiers = NodeVisitor_VisitModifiers(visitor, Node_Modifiers(Node_AsNode(node)));
  const parameters = EmitContext_VisitParameters(Transformer_EmitContext(receiver!.__tsgoEmbedded0), Node_ParameterList(Node_AsNode(node)), visitor as unknown as GoPtr<ConcreteNodeVisitor>);
  const body = RuntimeSyntaxTransformer_visitConstructorBody(receiver, AsBlock(node!.Body), Node_AsNode(node));
  return NodeFactory_UpdateConstructorDeclaration(factory.__tsgoEmbedded0!, node, modifiers, undefined /*typeParameters*/, parameters, undefined /*returnType*/, undefined /*fullSignature*/, body);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/tstransforms/runtimesyntax.go::method::RuntimeSyntaxTransformer.visitConstructorBody","kind":"method","status":"implemented","sigHash":"f26e6927b04c1c762c07d2f92f7aff8a76cbe8fada048242bd6989dc0af8b873","bodyHash":"7ed7b666a1d1b7bccc6e54ee80938aedaedbc2a54457e5f00d553e1013c0abae"}
 *
 * Go source:
 * func (tx *RuntimeSyntaxTransformer) visitConstructorBody(body *ast.Block, constructor *ast.Node) *ast.Node {
 * 	... (uses tx.Visitor(), getParameterProperties)
 * }
 */
export function RuntimeSyntaxTransformer_visitConstructorBody(receiver: GoPtr<RuntimeSyntaxTransformer>, body: GoPtr<Block>, constructor_: GoPtr<Node>): GoPtr<Node> {
  const parameterProperties = RuntimeSyntaxTransformer_getParameterProperties(receiver, constructor_);
  if (parameterProperties.length === 0) {
    return EmitContext_VisitFunctionBody(Transformer_EmitContext(receiver!.__tsgoEmbedded0), Node_AsNode(body), (Transformer_Visitor(receiver!.__tsgoEmbedded0) as ConcreteNodeVisitor) as unknown as GoPtr<ConcreteNodeVisitor>);
  }

  const grandparentOfBody = RuntimeSyntaxTransformer_pushNode(receiver, Node_AsNode(body));
  const [savedCurrentScope, savedCurrentScopeFirstDeclarationsOfName] = RuntimeSyntaxTransformer_pushScope(receiver, Node_AsNode(body));

  EmitContext_StartVariableEnvironment(Transformer_EmitContext(receiver!.__tsgoEmbedded0));
  const factory = Transformer_Factory(receiver!.__tsgoEmbedded0)!;
  const astFactory = factory.__tsgoEmbedded0!;
  const [prologue, rest] = NodeFactory_SplitStandardPrologue(factory, body!.Statements!.Nodes! as GoSlice<GoPtr<Statement>>);
  let statements: GoSlice<GoPtr<Statement>> = [...prologue];

  // Transform parameters into property assignments
  let parameterPropertyAssignments: GoSlice<GoPtr<Statement>> = [];
  for (const parameter of parameterProperties) {
    if (IsIdentifier(Node_Name(Node_AsNode(parameter)))) {
      const innerFactory = factory.__tsgoEmbedded0!;
      const paramName = Node_Name(Node_AsNode(parameter));

      const propertyName = Node_Clone(paramName!, { AsNodeFactory: () => innerFactory }) as unknown as GoPtr<IdentifierNode>;
      propertyName!.Parent = paramName!.Parent;
      EmitContext_AddEmitFlags(Transformer_EmitContext(receiver!.__tsgoEmbedded0), propertyName, EFNoComments | EFNoSourceMap);

      const localName = Node_Clone(paramName!, { AsNodeFactory: () => innerFactory }) as unknown as GoPtr<IdentifierNode>;
      localName!.Parent = paramName!.Parent;
      EmitContext_AddEmitFlags(Transformer_EmitContext(receiver!.__tsgoEmbedded0), localName, EFNoComments);

      const parameterProperty = NewExpressionStatement(
        innerFactory,
        NodeFactory_NewAssignmentExpression(
          factory,
          NewPropertyAccessExpression(
            innerFactory,
            NodeFactory_NewThisExpression(factory),
            undefined /*questionDotToken*/,
            propertyName,
            NodeFlagsNone,
          ),
          localName,
        ),
      );
      EmitContext_SetOriginal(Transformer_EmitContext(receiver!.__tsgoEmbedded0), parameterProperty, Node_AsNode(parameter));
      EmitContext_AddEmitFlags(Transformer_EmitContext(receiver!.__tsgoEmbedded0), parameterProperty, EFStartOnNewLine);
      parameterPropertyAssignments = [...parameterPropertyAssignments, parameterProperty];
    }
  }

  const superPath = FindSuperStatementIndexPath(rest, 0);

  if (superPath.length > 0) {
    statements = [...statements, ...RuntimeSyntaxTransformer_transformConstructorBodyWorker(receiver, rest, superPath, parameterPropertyAssignments)];
  } else {
    statements = [...statements, ...parameterPropertyAssignments];
    const [visitedRest] = NodeVisitor_VisitSlice((Transformer_Visitor(receiver!.__tsgoEmbedded0) as ConcreteNodeVisitor), rest);
    statements = [...statements, ...visitedRest as GoSlice<GoPtr<Statement>>];
  }

  statements = EmitContext_EndAndMergeVariableEnvironment(Transformer_EmitContext(receiver!.__tsgoEmbedded0), statements);
  const statementList = NodeFactory_NewNodeList(astFactory, statements);
  statementList!.Loc = body!.Statements!.Loc;

  RuntimeSyntaxTransformer_popScope(receiver, savedCurrentScope, savedCurrentScopeFirstDeclarationsOfName);
  RuntimeSyntaxTransformer_popNode(receiver, grandparentOfBody);
  const updated = NewBlock(astFactory, statementList, true /*multiline*/);
  EmitContext_SetOriginal(Transformer_EmitContext(receiver!.__tsgoEmbedded0), updated, Node_AsNode(body));
  updated!.Loc = body!.Loc;
  return updated;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/tstransforms/runtimesyntax.go::method::RuntimeSyntaxTransformer.transformConstructorBodyWorker","kind":"method","status":"implemented","sigHash":"2b9c44f7506c3f56880b07642955bb17621b70cf30342bf0308ecb7f05ea8535","bodyHash":"a9fa71fb4aaf48b9ff51c626cc24ce4be2a710dafa5f0580de118dd14916568f"}
 *
 * Go source:
 * func (tx *RuntimeSyntaxTransformer) transformConstructorBodyWorker(statementsIn []*ast.Statement, superPath []int, initializerStatements []*ast.Statement) []*ast.Statement {
 * 	... (uses tx.Visitor(), tx.Factory().UpdateTryStatement, UpdateBlock)
 * }
 */
export function RuntimeSyntaxTransformer_transformConstructorBodyWorker(receiver: GoPtr<RuntimeSyntaxTransformer>, statementsIn: GoSlice<GoPtr<Statement>>, superPath: GoSlice<int>, initializerStatements: GoSlice<GoPtr<Statement>>): GoSlice<GoPtr<Statement>> {
  let statementsOut: GoSlice<GoPtr<Statement>> = [];
  const superStatementIndex = superPath[0]!;
  const superStatement = statementsIn[superStatementIndex];

  const visitor = Transformer_Visitor(receiver!.__tsgoEmbedded0) as ConcreteNodeVisitor;
  const factory = Transformer_Factory(receiver!.__tsgoEmbedded0)!;
  const astFactory = factory.__tsgoEmbedded0!;

  // visit up to the statement containing `super`
  const [visitedBefore] = NodeVisitor_VisitSlice(visitor, statementsIn.slice(0, superStatementIndex) as GoSlice<GoPtr<Node>>);
  statementsOut = [...statementsOut, ...visitedBefore as GoSlice<GoPtr<Statement>>];

  // if the statement containing `super` is a `try` statement, transform the body of the `try` block
  if (IsTryStatement(superStatement as unknown as GoPtr<Node>)) {
    const tryStatement = AsTryStatement(superStatement as unknown as GoPtr<Node>);
    const tryBlock = AsBlock(tryStatement!.TryBlock);

    // keep track of hierarchy as we descend
    const grandparentOfTryStatement = RuntimeSyntaxTransformer_pushNode(receiver, Node_AsNode(tryStatement));
    const grandparentOfTryBlock = RuntimeSyntaxTransformer_pushNode(receiver, Node_AsNode(tryBlock));
    const [savedCurrentScope, savedCurrentScopeFirstDeclarationsOfName] = RuntimeSyntaxTransformer_pushScope(receiver, Node_AsNode(tryBlock));

    // visit the `try` block
    const tryBlockStatements = RuntimeSyntaxTransformer_transformConstructorBodyWorker(
      receiver,
      tryBlock!.Statements!.Nodes! as GoSlice<GoPtr<Statement>>,
      superPath.slice(1),
      initializerStatements,
    );

    // restore hierarchy as we ascend to the `try` statement
    RuntimeSyntaxTransformer_popScope(receiver, savedCurrentScope, savedCurrentScopeFirstDeclarationsOfName);
    RuntimeSyntaxTransformer_popNode(receiver, grandparentOfTryBlock);

    const tryBlockStatementList = NodeFactory_NewNodeList(astFactory, tryBlockStatements);
    tryBlockStatementList!.Loc = tryBlock!.Statements!.Loc;
    statementsOut = [
      ...statementsOut,
      NodeFactory_UpdateTryStatement(
        factory.__tsgoEmbedded0!,
        tryStatement,
        NodeFactory_UpdateBlock(factory.__tsgoEmbedded0!, tryBlock, tryBlockStatementList, tryBlock!.MultiLine!),
        NodeVisitor_VisitNode(visitor, tryStatement!.CatchClause),
        NodeVisitor_VisitNode(visitor, tryStatement!.FinallyBlock),
      ) as unknown as GoPtr<Statement>,
    ];

    // restore hierarchy as we ascend to the parent of the `try` statement
    RuntimeSyntaxTransformer_popNode(receiver, grandparentOfTryStatement);
  } else {
    // visit the statement containing `super`
    const [visitedSuper] = NodeVisitor_VisitSlice(visitor, statementsIn.slice(superStatementIndex, superStatementIndex + 1) as GoSlice<GoPtr<Node>>);
    statementsOut = [...statementsOut, ...visitedSuper as GoSlice<GoPtr<Statement>>];

    // insert the initializer statements
    statementsOut = [...statementsOut, ...initializerStatements];
  }

  // visit the statements after `super`
  const [visitedAfter] = NodeVisitor_VisitSlice(visitor, statementsIn.slice(superStatementIndex + 1) as GoSlice<GoPtr<Node>>);
  statementsOut = [...statementsOut, ...visitedAfter as GoSlice<GoPtr<Statement>>];
  return statementsOut;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/tstransforms/runtimesyntax.go::method::RuntimeSyntaxTransformer.visitShorthandPropertyAssignment","kind":"method","status":"implemented","sigHash":"d347960d42f97b5b4174736b1ca70908851b64faab2702e0fa27d7f5381ef7a3","bodyHash":"4eae69d24d1bc8c996cd9fa0166c8304e0c71c75fbace7f8054382b5acc0fb2f"}
 *
 * Go source:
 * func (tx *RuntimeSyntaxTransformer) visitShorthandPropertyAssignment(node *ast.ShorthandPropertyAssignment) *ast.Node {
 * 	... (uses tx.Visitor(), tx.Factory().UpdateShorthandPropertyAssignment)
 * }
 */
export function RuntimeSyntaxTransformer_visitShorthandPropertyAssignment(receiver: GoPtr<RuntimeSyntaxTransformer>, node: GoPtr<ShorthandPropertyAssignment>): GoPtr<Node> {
  const visitor = Transformer_Visitor(receiver!.__tsgoEmbedded0) as ConcreteNodeVisitor;
  const factory = Transformer_Factory(receiver!.__tsgoEmbedded0)!;
  const astFactory = factory.__tsgoEmbedded0!;
  const name = Node_Name(Node_AsNode(node)) as unknown as GoPtr<IdentifierNode>;
  const exportedOrImportedName = RuntimeSyntaxTransformer_visitExpressionIdentifier(receiver, name);
  if (exportedOrImportedName !== name) {
    let expression = exportedOrImportedName;
    if (node!.ObjectAssignmentInitializer !== undefined) {
      let equalsToken = node!.EqualsToken;
      if (equalsToken === undefined) {
        equalsToken = NewToken(astFactory, KindEqualsToken);
      }
      expression = NewBinaryExpression(
        astFactory,
        undefined /*modifiers*/,
        expression,
        undefined /*typeNode*/,
        equalsToken,
        NodeVisitor_VisitNode(visitor, node!.ObjectAssignmentInitializer),
      );
    }

    const updated = NewPropertyAssignment(astFactory, undefined /*modifiers*/, name, undefined /*postfixToken*/, undefined /*typeNode*/, expression);
    updated!.Loc = node!.Loc;
    EmitContext_SetOriginal(Transformer_EmitContext(receiver!.__tsgoEmbedded0), updated, Node_AsNode(node));
    EmitContext_AssignCommentAndSourceMapRanges(Transformer_EmitContext(receiver!.__tsgoEmbedded0), updated, Node_AsNode(node));
    return updated;
  }
  return NodeFactory_UpdateShorthandPropertyAssignment(
    factory.__tsgoEmbedded0!,
    node,
    undefined /*modifiers*/,
    exportedOrImportedName as unknown as GoPtr<IdentifierNode>,
    undefined /*postfixToken*/,
    undefined /*typeNode*/,
    node!.EqualsToken,
    NodeVisitor_VisitNode(visitor, node!.ObjectAssignmentInitializer),
  );
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/tstransforms/runtimesyntax.go::method::RuntimeSyntaxTransformer.visitIdentifier","kind":"method","status":"implemented","sigHash":"5a994fe05f1934aa19109110509e906d0ac29493c07727cca00028e13edd120f","bodyHash":"5b71c89ac5f4a9a8f6cbf8299f07c2f328e19aa36a789be8c3ba23902fa6f288"}
 *
 * Go source:
 * func (tx *RuntimeSyntaxTransformer) visitIdentifier(node *ast.IdentifierNode) *ast.Node {
 * 	if transformers.IsIdentifierReference(node, tx.parentNode) {
 * 		return tx.visitExpressionIdentifier(node)
 * 	}
 * 	return node
 * }
 */
export function RuntimeSyntaxTransformer_visitIdentifier(receiver: GoPtr<RuntimeSyntaxTransformer>, node: GoPtr<IdentifierNode>): GoPtr<Node> {
  if (IsIdentifierReference(node, receiver!.parentNode)) {
    return RuntimeSyntaxTransformer_visitExpressionIdentifier(receiver, node);
  }
  return node;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/tstransforms/runtimesyntax.go::method::RuntimeSyntaxTransformer.visitExpressionIdentifier","kind":"method","status":"implemented","sigHash":"2346ab7003eb8d9f9a4550a571a43dd901f31971491c4c06be5cefb3d6e0c130","bodyHash":"7d73623a1f61e98e6b179b91759d35e817ec474fdddf8cea5b4a37667436b5b5"}
 *
 * Go source:
 * func (tx *RuntimeSyntaxTransformer) visitExpressionIdentifier(node *ast.IdentifierNode) *ast.Node {
 * 	... (uses transformers.IsGeneratedIdentifier/IsLocalName, resolver.GetReferencedExportContainer)
 * }
 */
export function RuntimeSyntaxTransformer_visitExpressionIdentifier(receiver: GoPtr<RuntimeSyntaxTransformer>, node: GoPtr<IdentifierNode>): GoPtr<Node> {
  if (
    (receiver!.currentEnum !== undefined || receiver!.currentNamespace !== undefined) &&
    !IsGeneratedIdentifier(Transformer_EmitContext(receiver!.__tsgoEmbedded0), node) &&
    !IsLocalName(Transformer_EmitContext(receiver!.__tsgoEmbedded0), node)
  ) {
    const location = EmitContext_MostOriginal(Transformer_EmitContext(receiver!.__tsgoEmbedded0), node as unknown as GoPtr<Node>);
    const container = receiver!.resolver.GetReferencedExportContainer(location as unknown as GoPtr<IdentifierNode>, false /*prefixLocals*/);
    if (container !== undefined && (IsEnumDeclaration(container) || IsModuleDeclaration(container))) {
      const containerName = RuntimeSyntaxTransformer_getNamespaceContainerName(receiver, container);
      const f = Transformer_Factory(receiver!.__tsgoEmbedded0)!.__tsgoEmbedded0!;
      const coercible = { AsNodeFactory: (): typeof f => f };
      const memberName = Node_Clone(node as unknown as GoPtr<Node>, coercible)!;
      EmitContext_SetEmitFlags(Transformer_EmitContext(receiver!.__tsgoEmbedded0), memberName, EFNoComments | EFNoSourceMap);
      const expression = NodeFactory_GetNamespaceMemberName(Transformer_Factory(receiver!.__tsgoEmbedded0), containerName, memberName as unknown as GoPtr<IdentifierNode>, { AllowComments: false, AllowSourceMaps: true });
      EmitContext_AssignCommentAndSourceMapRanges(Transformer_EmitContext(receiver!.__tsgoEmbedded0), expression, node as unknown as GoPtr<Node>);
      return expression;
    }
  }
  return node;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/tstransforms/runtimesyntax.go::method::RuntimeSyntaxTransformer.createExportStatementForDeclaration","kind":"method","status":"implemented","sigHash":"6569b0300c477a1a2ae590ff0896cf2402b90e2e508acdb0346d8e614c58398f","bodyHash":"fce4f9c5a24bd2fca4059ed77a7fb2b3a06fb392e6692eb725c52be4f8f29aba"}
 *
 * Go source:
 * func (tx *RuntimeSyntaxTransformer) createExportStatementForDeclaration(node *ast.Declaration) *ast.Statement {
 * 	exportName := tx.Factory().GetExternalModuleOrNamespaceExportName(tx.getNamespaceContainerName(tx.currentNamespace), node, false /*allowComments* /, true /*allowSourceMaps* /)
 * 	localName := tx.Factory().GetLocalName(node)
 * 	expression := tx.Factory().NewAssignmentExpression(exportName, localName)
 * 	exportAssignmentSourceMapRange := node.Loc
 * 	if node.Name() != nil {
 * 		exportAssignmentSourceMapRange = exportAssignmentSourceMapRange.WithPos(node.Name().Pos())
 * 	}
 * 	tx.EmitContext().SetSourceMapRange(expression, exportAssignmentSourceMapRange)
 *
 * 	statement := tx.Factory().NewExpressionStatement(expression)
 * 	exportStatementSourceMapRange := node.Loc.WithPos(-1)
 * 	tx.EmitContext().SetSourceMapRange(statement, exportStatementSourceMapRange)
 * 	return statement
 * }
 */
export function RuntimeSyntaxTransformer_createExportStatementForDeclaration(receiver: GoPtr<RuntimeSyntaxTransformer>, node: GoPtr<Declaration>): GoPtr<Statement> {
  const exportName = NodeFactory_GetExternalModuleOrNamespaceExportName(Transformer_Factory(receiver!.__tsgoEmbedded0), RuntimeSyntaxTransformer_getNamespaceContainerName(receiver, receiver!.currentNamespace), node, false /*allowComments*/, true /*allowSourceMaps*/);
  const localName = NodeFactory_GetLocalName(Transformer_Factory(receiver!.__tsgoEmbedded0), node);
  const expression = NodeFactory_NewAssignmentExpression(Transformer_Factory(receiver!.__tsgoEmbedded0), exportName, localName);
  const nodeAsNode = Node_AsNode(node);
  const name = Node_Name(nodeAsNode);
  const exportAssignmentSourceMapRange = name !== undefined ? TextRange_WithPos(nodeAsNode!.Loc, Node_Pos(name)) : nodeAsNode!.Loc;
  EmitContext_SetSourceMapRange(Transformer_EmitContext(receiver!.__tsgoEmbedded0), expression, exportAssignmentSourceMapRange);

  const statement = NewExpressionStatement(Transformer_Factory(receiver!.__tsgoEmbedded0)!.__tsgoEmbedded0, expression);
  const exportStatementSourceMapRange = TextRange_WithPos(nodeAsNode!.Loc, -1);
  EmitContext_SetSourceMapRange(Transformer_EmitContext(receiver!.__tsgoEmbedded0), statement, exportStatementSourceMapRange);
  return statement;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/tstransforms/runtimesyntax.go::method::RuntimeSyntaxTransformer.createExportAssignment","kind":"method","status":"implemented","sigHash":"768d5226b7bf2a60b835395f9ae82318822af9c91cf0df55eef04a0fde854e28","bodyHash":"7ba6eca9594aae8883f71a76729e3dad79e0226313c0dcc43e451f29977a2d7e"}
 *
 * Go source:
 * func (tx *RuntimeSyntaxTransformer) createExportAssignment(name *ast.IdentifierNode, expression *ast.Expression, exportAssignmentSourceMapRange core.TextRange, original *ast.Node) *ast.Expression {
 * 	exportName := tx.getNamespaceQualifiedProperty(tx.getNamespaceContainerName(tx.currentNamespace), name)
 * 	exportAssignment := tx.Factory().NewAssignmentExpression(exportName, expression)
 * 	tx.EmitContext().SetOriginal(exportAssignment, original)
 * 	tx.EmitContext().SetSourceMapRange(exportAssignment, exportAssignmentSourceMapRange)
 * 	return exportAssignment
 * }
 */
export function RuntimeSyntaxTransformer_createExportAssignment(receiver: GoPtr<RuntimeSyntaxTransformer>, name: GoPtr<IdentifierNode>, expression: GoPtr<Expression>, exportAssignmentSourceMapRange: TextRange, original: GoPtr<Node>): GoPtr<Expression> {
  const exportName = RuntimeSyntaxTransformer_getNamespaceQualifiedProperty(receiver, RuntimeSyntaxTransformer_getNamespaceContainerName(receiver, receiver!.currentNamespace), name);
  const exportAssignment = NodeFactory_NewAssignmentExpression(Transformer_Factory(receiver!.__tsgoEmbedded0), exportName, expression);
  EmitContext_SetOriginal(Transformer_EmitContext(receiver!.__tsgoEmbedded0), exportAssignment, original);
  EmitContext_SetSourceMapRange(Transformer_EmitContext(receiver!.__tsgoEmbedded0), exportAssignment, exportAssignmentSourceMapRange);
  return exportAssignment;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/tstransforms/runtimesyntax.go::method::RuntimeSyntaxTransformer.createExportStatement","kind":"method","status":"implemented","sigHash":"0635a426ae940b5638fc0ba2c558061baee0372dd54cb0f016b8146e1f78d34a","bodyHash":"c80c8006bd88a32600a2d97123b7c81a4f770c225241da4b380168db10ba0c94"}
 *
 * Go source:
 * func (tx *RuntimeSyntaxTransformer) createExportStatement(name *ast.IdentifierNode, expression *ast.Expression, exportAssignmentSourceMapRange core.TextRange, exportStatementSourceMapRange core.TextRange, original *ast.Node) *ast.Statement {
 * 	exportStatement := tx.Factory().NewExpressionStatement(tx.createExportAssignment(name, expression, exportAssignmentSourceMapRange, original))
 * 	tx.EmitContext().SetOriginal(exportStatement, original)
 * 	tx.EmitContext().SetSourceMapRange(exportStatement, exportStatementSourceMapRange)
 * 	return exportStatement
 * }
 */
export function RuntimeSyntaxTransformer_createExportStatement(receiver: GoPtr<RuntimeSyntaxTransformer>, name: GoPtr<IdentifierNode>, expression: GoPtr<Expression>, exportAssignmentSourceMapRange: TextRange, exportStatementSourceMapRange: TextRange, original: GoPtr<Node>): GoPtr<Statement> {
  const exportStatement = NewExpressionStatement(Transformer_Factory(receiver!.__tsgoEmbedded0)!.__tsgoEmbedded0, RuntimeSyntaxTransformer_createExportAssignment(receiver, name, expression, exportAssignmentSourceMapRange, original));
  EmitContext_SetOriginal(Transformer_EmitContext(receiver!.__tsgoEmbedded0), exportStatement, original);
  EmitContext_SetSourceMapRange(Transformer_EmitContext(receiver!.__tsgoEmbedded0), exportStatement, exportStatementSourceMapRange);
  return exportStatement;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/tstransforms/runtimesyntax.go::method::RuntimeSyntaxTransformer.shouldEmitEnumDeclaration","kind":"method","status":"implemented","sigHash":"f2e278a05e2e53881e8b06d83924b6ffa6b09a33b82987a6b9f906dc2d15e5a1","bodyHash":"54fb4053c2e47f6ae2972e4b16b2035a0665bc61152fd7590aba8c02e8243fa2"}
 *
 * Go source:
 * func (tx *RuntimeSyntaxTransformer) shouldEmitEnumDeclaration(node *ast.EnumDeclaration) bool {
 * 	return !ast.IsEnumConst(node.AsNode()) || tx.compilerOptions.ShouldPreserveConstEnums()
 * }
 */
export function RuntimeSyntaxTransformer_shouldEmitEnumDeclaration(receiver: GoPtr<RuntimeSyntaxTransformer>, node: GoPtr<EnumDeclaration>): bool {
  return (!IsEnumConst(EnumDeclaration_as_nodeData(node).AsNode()) || CompilerOptions_ShouldPreserveConstEnums(receiver!.compilerOptions)) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/tstransforms/runtimesyntax.go::method::RuntimeSyntaxTransformer.shouldEmitModuleDeclaration","kind":"method","status":"implemented","sigHash":"3d54a15b48048facc9354b5188f7518c8d6f75328d44acdda1f8d851572fc6dd","bodyHash":"4773aeaf083f1afcd5461fb448998677bfb05b14735e334ba4a51622e0546ab7"}
 *
 * Go source:
 * func (tx *RuntimeSyntaxTransformer) shouldEmitModuleDeclaration(node *ast.ModuleDeclaration) bool {
 * 	pn := tx.EmitContext().ParseNode(node.AsNode())
 * 	if pn == nil {
 * 		return true
 * 	}
 * 	return ast.IsInstantiatedModule(pn, tx.compilerOptions.ShouldPreserveConstEnums())
 * }
 */
export function RuntimeSyntaxTransformer_shouldEmitModuleDeclaration(receiver: GoPtr<RuntimeSyntaxTransformer>, node: GoPtr<ModuleDeclaration>): bool {
  const pn = EmitContext_ParseNode(Transformer_EmitContext(receiver!.__tsgoEmbedded0), ModuleDeclaration_as_nodeData(node).AsNode());
  if (pn === undefined) {
    // If we can't find a parse tree node, assume the node is instantiated.
    return true as bool;
  }
  return IsInstantiatedModule(pn, CompilerOptions_ShouldPreserveConstEnums(receiver!.compilerOptions)) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/tstransforms/runtimesyntax.go::func::getInnermostModuleDeclarationFromDottedModule","kind":"func","status":"implemented","sigHash":"648742e448f5345dd98e1ed53093cdb0564351808112b98534971556113825ee","bodyHash":"dabc2f44d8b995c676926c3b6dffd9425e20ae3da73995b35d197d29de9976b5"}
 *
 * Go source:
 * func getInnermostModuleDeclarationFromDottedModule(moduleDeclaration *ast.ModuleDeclaration) *ast.ModuleDeclaration {
 * 	for moduleDeclaration.Body != nil && moduleDeclaration.Body.Kind == ast.KindModuleDeclaration {
 * 		moduleDeclaration = moduleDeclaration.Body.AsModuleDeclaration()
 * 	}
 * 	return moduleDeclaration
 * }
 */
export function getInnermostModuleDeclarationFromDottedModule(moduleDeclaration: GoPtr<ModuleDeclaration>): GoPtr<ModuleDeclaration> {
  if (moduleDeclaration!.Body !== undefined && moduleDeclaration!.Body!.Kind === KindModuleDeclaration) {
    return getInnermostModuleDeclarationFromDottedModule(AsModuleDeclaration(moduleDeclaration!.Body));
  }
  return moduleDeclaration;
}
