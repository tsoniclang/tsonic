import type { bool } from "@tsonic/core/types.js";
import type { GoPtr, GoSlice } from "../../../go/compat.js";
import type { ModifierList, Node } from "../../ast/spine.js";
import { NodeFactory_NewModifierList, NodeFactory_NewNodeList } from "../../ast/spine.js";
import type { ClassDeclaration, ClassExpression, GetAccessorDeclaration, MethodDeclaration, PropertyDeclaration, SetAccessorDeclaration } from "../../ast/generated/data.js";
import { NewArrowFunction, NewDecorator, NewIdentifier, NewObjectLiteralExpression, NewPropertyAssignment, NewToken } from "../../ast/generated/factory.js";
import { KindBlock, KindCaseBlock, KindClassDeclaration, KindClassExpression, KindDefaultKeyword, KindEqualsGreaterThanToken, KindExportKeyword, KindGetAccessor, KindMethodDeclaration, KindModuleBlock, KindPropertyDeclaration, KindSetAccessor, KindSourceFile } from "../../ast/generated/kinds.js";
import { IsDecorator } from "../../ast/generated/predicates.js";
import { ClassElementOrClassElementParameterIsDecorated, ClassOrConstructorParameterIsDecorated, GetFirstConstructorWithBody, HasDecorators, IsClassLike, IsModifier } from "../../ast/utilities.js";
import { NodeFactory_UpdateClassDeclaration, NodeFactory_UpdateClassExpression, NodeFactory_UpdateGetAccessorDeclaration, NodeFactory_UpdateMethodDeclaration, NodeFactory_UpdatePropertyDeclaration, NodeFactory_UpdateSetAccessorDeclaration } from "../../ast/ast.js";
import { Node_SubtreeFacts } from "../../ast/spine.js";
import { SubtreeContainsDecorators } from "../../ast/subtreefacts.js";
import { Filter } from "../../core/core.js";
import { CompilerOptions_GetEmitScriptTarget, CompilerOptions_GetStrictOptionValue } from "../../core/compileroptions.js";
import { Tristate_IsTrue } from "../../core/tristate.js";
import { EmitContext_AddEmitHelper, EmitContext_ReadEmitHelpers } from "../../printer/emitcontext.js";
import type { EmitResolver } from "../../printer/emitresolver.js";
import { NodeFactory_NewMetadataHelper } from "../../printer/factory.js";
import type { TransformOptions } from "../chain.js";
import type { Transformer } from "../transformer.js";
import { Transformer_EmitContext, Transformer_Factory, Transformer_NewTransformer, Transformer_Visitor } from "../transformer.js";
import { NodeVisitor_VisitEachChild, NodeVisitor_VisitModifiers, NodeVisitor_VisitNode, NodeVisitor_VisitNodes } from "../../ast/visitor.js";
import type { NodeVisitor as ConcreteNodeVisitor } from "../../ast/visitor.js";
import type { metadataSerializer } from "./typeserializer.js";
import { metadataSerializer_SerializeParameterTypesOfNode, metadataSerializer_SerializeReturnTypeOfNode, metadataSerializer_SerializeTypeOfNode, newMetadataSerializer } from "./typeserializer.js";
import { Node_Modifiers } from "../../ast/spine.js";
import { getDecoratorsOfParameters } from "./legacydecorators.js";

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/tstransforms/metadata.go::constGroup::USE_NEW_TYPE_METADATA_FORMAT","kind":"constGroup","status":"implemented","sigHash":"1894d9bf8ed1a1868a2c3b304b8ced2e4c9d440b32fbdb8bb4035c3bb2a8ac7d","bodyHash":"4e17399c6ef1528bc329ec7cd4a6526a1e79de90637dc1a9797d0726418ef13c"}
 *
 * Go source:
 * const USE_NEW_TYPE_METADATA_FORMAT = false
 */
export const USE_NEW_TYPE_METADATA_FORMAT: bool = false;

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/tstransforms/metadata.go::type::MetadataTransformer","kind":"type","status":"implemented","sigHash":"f9d49b88053dd59d91367a47d26bcedaaa2e7a18d5e57a2dc3e300438c166f2b","bodyHash":"0c5fdc783a81d47ec35c75dbf2da31b14f66586d964b063c8ac7ac3ae579e2af"}
 *
 * Go source:
 * MetadataTransformer struct {
 * 	transformers.Transformer
 * 	legacyDecorators bool
 * 	resolver         printer.EmitResolver
 *
 * 	serializer          *metadataSerializer
 * 	strictNullChecks    bool
 * 	parent              *ast.Node
 * 	currentLexicalScope *ast.Node
 * }
 */
export interface MetadataTransformer {
  readonly __tsgoEmbedded0?: Transformer;
  legacyDecorators: bool;
  resolver: EmitResolver;
  serializer: GoPtr<metadataSerializer>;
  strictNullChecks: bool;
  parent: GoPtr<Node>;
  currentLexicalScope: GoPtr<Node>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/tstransforms/metadata.go::func::NewMetadataTransformer","kind":"func","status":"implemented","sigHash":"ded46d7397187561b63f38a4e609ea34fab1e7a3a80471cef2632d8fa1c5ec5c","bodyHash":"d3593ece354042d55b1942b22d4ebd695185bd5927e229ebf820730aa1487d82"}
 *
 * Go source:
 * func NewMetadataTransformer(opt *transformers.TransformOptions) *transformers.Transformer {
 * 	tx := &MetadataTransformer{
 * 		legacyDecorators: opt.CompilerOptions.ExperimentalDecorators.IsTrue(),
 * 		resolver:         opt.EmitResolver,
 * 		strictNullChecks: opt.CompilerOptions.GetStrictOptionValue(opt.CompilerOptions.StrictNullChecks),
 * 	}
 * 	return tx.NewTransformer(tx.visit, opt.Context)
 * }
 */
export function NewMetadataTransformer(opt: GoPtr<TransformOptions>): GoPtr<Transformer> {
  const tx: MetadataTransformer = {
    __tsgoEmbedded0: { emitContext: undefined, factory: undefined, visitor: undefined },
    legacyDecorators: Tristate_IsTrue(opt!.CompilerOptions!.ExperimentalDecorators) as bool,
    resolver: opt!.EmitResolver,
    serializer: undefined,
    strictNullChecks: CompilerOptions_GetStrictOptionValue(opt!.CompilerOptions, opt!.CompilerOptions!.StrictNullChecks) as bool,
    parent: undefined,
    currentLexicalScope: undefined,
  };
  return Transformer_NewTransformer(tx.__tsgoEmbedded0, (node) => MetadataTransformer_visit(tx, node), opt!.Context);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/tstransforms/metadata.go::method::MetadataTransformer.visit","kind":"method","status":"implemented","sigHash":"6a725d7bfb78b92078fb10e6132a5e66bf179077ef4c6ac427734c98f4df72fe","bodyHash":"5078f8225051e8183e22d1333c86ac4a7f5cba77c89ee89d96756d2d58a9c699"}
 *
 * Go source:
 * func (tx *MetadataTransformer) visit(node *ast.Node) *ast.Node {
 * 	if (node.SubtreeFacts() & ast.SubtreeContainsDecorators) == 0 {
 * 		return node
 * 	}
 *
 * 	switch node.Kind {
 * 	case ast.KindClassDeclaration:
 * 		return tx.visitClassDeclaration(node.AsClassDeclaration())
 * 	case ast.KindClassExpression:
 * 		return tx.visitClassExpression(node.AsClassExpression())
 * 	case ast.KindPropertyDeclaration:
 * 		return tx.visitPropertyDeclaration(node.AsPropertyDeclaration())
 * 	case ast.KindMethodDeclaration:
 * 		return tx.visitMethodDeclaration(node.AsMethodDeclaration())
 * 	case ast.KindSetAccessor:
 * 		return tx.visitSetAccessor(node.AsSetAccessorDeclaration())
 * 	case ast.KindGetAccessor:
 * 		return tx.visitGetAccessor(node.AsGetAccessorDeclaration())
 * 	case ast.KindSourceFile:
 * 		tx.parent = nil
 * 		defer tx.setParent(nil)
 * 		tx.currentLexicalScope = node
 * 		defer tx.setCurrentLexicalScope(nil)
 * 		tx.serializer = newMetadataSerializer(tx.resolver, tx.Factory(), tx.EmitContext(), tx.strictNullChecks)
 * 		updated := tx.Visitor().VisitEachChild(node)
 * 		tx.EmitContext().AddEmitHelper(updated, tx.EmitContext().ReadEmitHelpers()...)
 * 		return updated
 * 	case ast.KindModuleBlock, ast.KindBlock, ast.KindCaseBlock:
 * 		oldScope := tx.currentLexicalScope
 * 		tx.currentLexicalScope = node
 * 		defer tx.setCurrentLexicalScope(oldScope)
 * 		return tx.Visitor().VisitEachChild(node)
 * 	default:
 * 		return tx.Visitor().VisitEachChild(node)
 * 	}
 * }
 */
export function MetadataTransformer_visit(receiver: GoPtr<MetadataTransformer>, node: GoPtr<Node>): GoPtr<Node> {
  if ((Node_SubtreeFacts(node) & SubtreeContainsDecorators) === 0) {
    return node;
  }

  const tx = receiver!;
  const visitor = Transformer_Visitor(tx.__tsgoEmbedded0) as ConcreteNodeVisitor;

  switch (node!.Kind) {
    case KindMethodDeclaration:
      return MetadataTransformer_visitMethodDeclaration(receiver, node as unknown as GoPtr<MethodDeclaration>);
    case KindSetAccessor:
      return MetadataTransformer_visitSetAccessor(receiver, node as unknown as GoPtr<SetAccessorDeclaration>);
    case KindGetAccessor:
      return MetadataTransformer_visitGetAccessor(receiver, node as unknown as GoPtr<GetAccessorDeclaration>);
    case KindPropertyDeclaration:
      return MetadataTransformer_visitPropertyDeclaration(receiver, node as unknown as GoPtr<PropertyDeclaration>);
    case KindSourceFile: {
      const savedParent = tx.parent;
      tx.parent = undefined;
      const savedScope0 = tx.currentLexicalScope;
      tx.currentLexicalScope = node;
      tx.serializer = newMetadataSerializer(tx.resolver, Transformer_Factory(tx.__tsgoEmbedded0), Transformer_EmitContext(tx.__tsgoEmbedded0), tx.strictNullChecks);
      let updated: GoPtr<Node>;
      try {
        updated = NodeVisitor_VisitEachChild(visitor, node);
        EmitContext_AddEmitHelper(Transformer_EmitContext(tx.__tsgoEmbedded0), updated, ...EmitContext_ReadEmitHelpers(Transformer_EmitContext(tx.__tsgoEmbedded0)));
      } finally {
        MetadataTransformer_setCurrentLexicalScope(receiver, savedScope0);
        MetadataTransformer_setParent(receiver, savedParent);
      }
      return updated!;
    }
    case KindModuleBlock:
    case KindBlock:
    case KindCaseBlock: {
      const oldScope = tx.currentLexicalScope;
      tx.currentLexicalScope = node;
      let result: GoPtr<Node>;
      try {
        result = NodeVisitor_VisitEachChild(visitor, node);
      } finally {
        MetadataTransformer_setCurrentLexicalScope(receiver, oldScope);
      }
      return result!;
    }
    case KindClassDeclaration:
      return MetadataTransformer_visitClassDeclaration(receiver, node as unknown as GoPtr<ClassDeclaration>);
    case KindClassExpression:
      return MetadataTransformer_visitClassExpression(receiver, node as unknown as GoPtr<ClassExpression>);
    default:
      return NodeVisitor_VisitEachChild(visitor, node);
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/tstransforms/metadata.go::method::MetadataTransformer.setParent","kind":"method","status":"implemented","sigHash":"9d22518f2eda3506462926e737dabb279c82339ab65a8e42a3a56262468ff4fb","bodyHash":"fd5959f7c287278ee4c3b47083dd9cfe2a698f8c7badd98240c5b3db72457cae"}
 *
 * Go source:
 * func (tx *MetadataTransformer) setParent(node *ast.Node) {
 * 	tx.parent = node
 * }
 */
export function MetadataTransformer_setParent(receiver: GoPtr<MetadataTransformer>, node: GoPtr<Node>): void {
  const tx = receiver!;
  tx.parent = node;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/tstransforms/metadata.go::method::MetadataTransformer.setCurrentLexicalScope","kind":"method","status":"implemented","sigHash":"2bd038f1e3871586ee907962770a9b87c38969f6a115a1b24bef4c3ec18e4052","bodyHash":"c35e8b9054da6ab631cc25621bcc12bd9fdfa46b568847575aa6dfe1edcc07d3"}
 *
 * Go source:
 * func (tx *MetadataTransformer) setCurrentLexicalScope(node *ast.Node) {
 * 	tx.currentLexicalScope = node
 * }
 */
export function MetadataTransformer_setCurrentLexicalScope(receiver: GoPtr<MetadataTransformer>, node: GoPtr<Node>): void {
  const tx = receiver!;
  tx.currentLexicalScope = node;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/tstransforms/metadata.go::method::MetadataTransformer.visitClassExpression","kind":"method","status":"implemented","sigHash":"7e4b84c111b963fb5f8d4d91d149dd25956f736b6be4b924caa6013b785a0a12","bodyHash":"8f925d9ae5c4c5d40e3aed23b792c1a70bd90843d5cb18d6d62d334d4c886274"}
 *
 * Go source:
 * func (tx *MetadataTransformer) visitClassExpression(node *ast.ClassExpression) *ast.Node {
 * 	oldParent := tx.parent
 * 	tx.parent = node.AsNode()
 * 	defer tx.setParent(oldParent)
 *
 * 	if !ast.ClassOrConstructorParameterIsDecorated(tx.legacyDecorators, node.AsNode()) {
 * 		return tx.Visitor().VisitEachChild(node.AsNode())
 * 	}
 * 	modifiers := tx.injectClassTypeMetadata(tx.Visitor().VisitModifiers(node.Modifiers()), node.AsNode())
 * 	return tx.Factory().UpdateClassExpression(
 * 		node,
 * 		modifiers,
 * 		tx.Visitor().VisitNode(node.Name()),
 * 		tx.Visitor().VisitNodes(node.TypeParameters),
 * 		tx.Visitor().VisitNodes(node.HeritageClauses),
 * 		tx.Visitor().VisitNodes(node.Members),
 * 	)
 * }
 */
export function MetadataTransformer_visitClassExpression(receiver: GoPtr<MetadataTransformer>, node: GoPtr<ClassExpression>): GoPtr<Node> {
  const tx = receiver!;
  const oldParent = tx.parent;
  tx.parent = node as unknown as GoPtr<Node>;
  const visitor = Transformer_Visitor(tx.__tsgoEmbedded0) as ConcreteNodeVisitor;
  const astFactory = Transformer_Factory(tx.__tsgoEmbedded0)!.__tsgoEmbedded0!;
  const nodeAsNode = node as unknown as GoPtr<Node>;
  let result: GoPtr<Node>;
  try {
    if (!ClassOrConstructorParameterIsDecorated(tx.legacyDecorators, nodeAsNode)) {
      result = NodeVisitor_VisitEachChild(visitor, nodeAsNode);
    } else {
      const modifiers = MetadataTransformer_injectClassTypeMetadata(receiver, NodeVisitor_VisitModifiers(visitor, Node_Modifiers(nodeAsNode)), nodeAsNode);
      result = NodeFactory_UpdateClassExpression(
        astFactory,
        node,
        modifiers,
        NodeVisitor_VisitNode(visitor, node!.name as unknown as GoPtr<Node>),
        NodeVisitor_VisitNodes(visitor, node!.TypeParameters),
        NodeVisitor_VisitNodes(visitor, node!.HeritageClauses),
        NodeVisitor_VisitNodes(visitor, node!.Members),
      );
    }
  } finally {
    MetadataTransformer_setParent(receiver, oldParent);
  }
  return result!;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/tstransforms/metadata.go::method::MetadataTransformer.visitClassDeclaration","kind":"method","status":"implemented","sigHash":"c7ffec6275286e3dbc7a5f0daeadcde48684520b1906086d1ca1df4c47a33f75","bodyHash":"710300997cb471008e1656bc9b08ecdae915308beebc62679732591ac9f693ad"}
 *
 * Go source:
 * func (tx *MetadataTransformer) visitClassDeclaration(node *ast.ClassDeclaration) *ast.Node {
 * 	oldParent := tx.parent
 * 	tx.parent = node.AsNode()
 * 	defer tx.setParent(oldParent)
 *
 * 	if !ast.ClassOrConstructorParameterIsDecorated(tx.legacyDecorators, node.AsNode()) {
 * 		return tx.Visitor().VisitEachChild(node.AsNode())
 * 	}
 * 	modifiers := tx.injectClassTypeMetadata(tx.Visitor().VisitModifiers(node.Modifiers()), node.AsNode())
 * 	return tx.Factory().UpdateClassDeclaration(
 * 		node,
 * 		modifiers,
 * 		tx.Visitor().VisitNode(node.Name()),
 * 		tx.Visitor().VisitNodes(node.TypeParameters),
 * 		tx.Visitor().VisitNodes(node.HeritageClauses),
 * 		tx.Visitor().VisitNodes(node.Members),
 * 	)
 * }
 */
export function MetadataTransformer_visitClassDeclaration(receiver: GoPtr<MetadataTransformer>, node: GoPtr<ClassDeclaration>): GoPtr<Node> {
  const tx = receiver!;
  const oldParent = tx.parent;
  tx.parent = node as unknown as GoPtr<Node>;
  const visitor = Transformer_Visitor(tx.__tsgoEmbedded0) as ConcreteNodeVisitor;
  const astFactory = Transformer_Factory(tx.__tsgoEmbedded0)!.__tsgoEmbedded0!;
  const nodeAsNode = node as unknown as GoPtr<Node>;
  let result: GoPtr<Node>;
  try {
    if (!ClassOrConstructorParameterIsDecorated(tx.legacyDecorators, nodeAsNode)) {
      result = NodeVisitor_VisitEachChild(visitor, nodeAsNode);
    } else {
      const modifiers = MetadataTransformer_injectClassTypeMetadata(receiver, NodeVisitor_VisitModifiers(visitor, Node_Modifiers(nodeAsNode)), nodeAsNode);
      result = NodeFactory_UpdateClassDeclaration(
        astFactory,
        node,
        modifiers,
        NodeVisitor_VisitNode(visitor, node!.name as unknown as GoPtr<Node>),
        NodeVisitor_VisitNodes(visitor, node!.TypeParameters),
        NodeVisitor_VisitNodes(visitor, node!.HeritageClauses),
        NodeVisitor_VisitNodes(visitor, node!.Members),
      );
    }
  } finally {
    MetadataTransformer_setParent(receiver, oldParent);
  }
  return result!;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/tstransforms/metadata.go::method::MetadataTransformer.visitPropertyDeclaration","kind":"method","status":"implemented","sigHash":"6c409a23d811c0e933edeef15c2e20f1f49a40f6fd609de60a6e6eec11b84bba","bodyHash":"0a572a106f668a6e2710f658ec8301e41560c97c1264d84c26205340917da9ac"}
 *
 * Go source:
 * func (tx *MetadataTransformer) visitPropertyDeclaration(node *ast.PropertyDeclaration) *ast.Node {
 * 	if !ast.HasDecorators(node.AsNode()) {
 * 		return tx.Visitor().VisitEachChild(node.AsNode())
 * 	}
 *
 * 	modifiers := tx.injectClassElementTypeMetadata(tx.Visitor().VisitModifiers(node.Modifiers()), node.AsNode(), tx.parent)
 * 	return tx.Factory().UpdatePropertyDeclaration(
 * 		node,
 * 		modifiers,
 * 		tx.Visitor().VisitNode(node.Name()),
 * 		tx.Visitor().VisitNode(node.PostfixToken),
 * 		tx.Visitor().VisitNode(node.Type),
 * 		tx.Visitor().VisitNode(node.Initializer),
 * 	)
 * }
 */
export function MetadataTransformer_visitPropertyDeclaration(receiver: GoPtr<MetadataTransformer>, node: GoPtr<PropertyDeclaration>): GoPtr<Node> {
  const tx = receiver!;
  const visitor = Transformer_Visitor(tx.__tsgoEmbedded0) as ConcreteNodeVisitor;
  const astFactory = Transformer_Factory(tx.__tsgoEmbedded0)!.__tsgoEmbedded0!;
  const nodeAsNode = node as unknown as GoPtr<Node>;
  if (!HasDecorators(nodeAsNode)) {
    return NodeVisitor_VisitEachChild(visitor, nodeAsNode);
  }

  const modifiers = MetadataTransformer_injectClassElementTypeMetadata(receiver, NodeVisitor_VisitModifiers(visitor, Node_Modifiers(nodeAsNode)), nodeAsNode, tx.parent);
  return NodeFactory_UpdatePropertyDeclaration(
    astFactory,
    node,
    modifiers,
    NodeVisitor_VisitNode(visitor, node!.name as unknown as GoPtr<Node>),
    NodeVisitor_VisitNode(visitor, node!.PostfixToken as unknown as GoPtr<Node>),
    NodeVisitor_VisitNode(visitor, node!.Type as unknown as GoPtr<Node>),
    NodeVisitor_VisitNode(visitor, node!.Initializer as unknown as GoPtr<Node>),
  );
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/tstransforms/metadata.go::method::MetadataTransformer.visitMethodDeclaration","kind":"method","status":"implemented","sigHash":"d647cf2a2af6fbe0399365c96373a7a60385762e0bc7ae359938f525e40bf306","bodyHash":"f8ab9c16c6f7ef1b4e827f01a6118d5335623e1efa40b4d7b1f1524f1a08284c"}
 *
 * Go source:
 * func (tx *MetadataTransformer) visitMethodDeclaration(node *ast.MethodDeclaration) *ast.Node {
 * 	if !ast.HasDecorators(node.AsNode()) && len(getDecoratorsOfParameters(node.AsNode())) == 0 {
 * 		return tx.Visitor().VisitEachChild(node.AsNode())
 * 	}
 *
 * 	modifiers := tx.injectClassElementTypeMetadata(tx.Visitor().VisitModifiers(node.Modifiers()), node.AsNode(), tx.parent)
 * 	return tx.Factory().UpdateMethodDeclaration(
 * 		node,
 * 		modifiers,
 * 		tx.Visitor().VisitNode(node.AsteriskToken),
 * 		tx.Visitor().VisitNode(node.Name()),
 * 		tx.Visitor().VisitNode(node.PostfixToken),
 * 		tx.Visitor().VisitNodes(node.TypeParameters),
 * 		tx.Visitor().VisitNodes(node.Parameters),
 * 		tx.Visitor().VisitNode(node.Type),
 * 		tx.Visitor().VisitNode(node.FullSignature),
 * 		tx.Visitor().VisitNode(node.Body),
 * 	)
 * }
 */
export function MetadataTransformer_visitMethodDeclaration(receiver: GoPtr<MetadataTransformer>, node: GoPtr<MethodDeclaration>): GoPtr<Node> {
  const tx = receiver!;
  const visitor = Transformer_Visitor(tx.__tsgoEmbedded0) as ConcreteNodeVisitor;
  const astFactory = Transformer_Factory(tx.__tsgoEmbedded0)!.__tsgoEmbedded0!;
  const nodeAsNode = node as unknown as GoPtr<Node>;
  if (!HasDecorators(nodeAsNode) && getDecoratorsOfParameters(nodeAsNode).length === 0) {
    return NodeVisitor_VisitEachChild(visitor, nodeAsNode);
  }

  const modifiers = MetadataTransformer_injectClassElementTypeMetadata(receiver, NodeVisitor_VisitModifiers(visitor, Node_Modifiers(nodeAsNode)), nodeAsNode, tx.parent);
  return NodeFactory_UpdateMethodDeclaration(
    astFactory,
    node,
    modifiers,
    NodeVisitor_VisitNode(visitor, node!.AsteriskToken as unknown as GoPtr<Node>),
    NodeVisitor_VisitNode(visitor, node!.name as unknown as GoPtr<Node>),
    NodeVisitor_VisitNode(visitor, node!.PostfixToken as unknown as GoPtr<Node>),
    NodeVisitor_VisitNodes(visitor, node!.TypeParameters),
    NodeVisitor_VisitNodes(visitor, node!.Parameters),
    NodeVisitor_VisitNode(visitor, node!.Type as unknown as GoPtr<Node>),
    NodeVisitor_VisitNode(visitor, node!.FullSignature as unknown as GoPtr<Node>),
    NodeVisitor_VisitNode(visitor, node!.Body as unknown as GoPtr<Node>),
  );
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/tstransforms/metadata.go::method::MetadataTransformer.visitSetAccessor","kind":"method","status":"implemented","sigHash":"382125188ded0fe0bb9529e7636ef67bfd044508dc0ac0a58afbc6bb97a9317f","bodyHash":"fed6a81dd12d56d9f94ee576040502b4bb73b8fc20659a1ccf5b759f2fcdd7a7"}
 *
 * Go source:
 * func (tx *MetadataTransformer) visitSetAccessor(node *ast.SetAccessorDeclaration) *ast.Node {
 * 	if !ast.HasDecorators(node.AsNode()) && len(getDecoratorsOfParameters(node.AsNode())) == 0 {
 * 		return tx.Visitor().VisitEachChild(node.AsNode())
 * 	}
 *
 * 	modifiers := tx.injectClassElementTypeMetadata(tx.Visitor().VisitModifiers(node.Modifiers()), node.AsNode(), tx.parent)
 * 	return tx.Factory().UpdateSetAccessorDeclaration(
 * 		node,
 * 		modifiers,
 * 		tx.Visitor().VisitNode(node.Name()),
 * 		tx.Visitor().VisitNodes(node.TypeParameters),
 * 		tx.Visitor().VisitNodes(node.Parameters),
 * 		tx.Visitor().VisitNode(node.Type),
 * 		tx.Visitor().VisitNode(node.FullSignature),
 * 		tx.Visitor().VisitNode(node.Body),
 * 	)
 * }
 */
export function MetadataTransformer_visitSetAccessor(receiver: GoPtr<MetadataTransformer>, node: GoPtr<SetAccessorDeclaration>): GoPtr<Node> {
  const tx = receiver!;
  const visitor = Transformer_Visitor(tx.__tsgoEmbedded0) as ConcreteNodeVisitor;
  const astFactory = Transformer_Factory(tx.__tsgoEmbedded0)!.__tsgoEmbedded0!;
  const nodeAsNode = node as unknown as GoPtr<Node>;
  if (!HasDecorators(nodeAsNode) && getDecoratorsOfParameters(nodeAsNode).length === 0) {
    return NodeVisitor_VisitEachChild(visitor, nodeAsNode);
  }

  const modifiers = MetadataTransformer_injectClassElementTypeMetadata(receiver, NodeVisitor_VisitModifiers(visitor, Node_Modifiers(nodeAsNode)), nodeAsNode, tx.parent);
  return NodeFactory_UpdateSetAccessorDeclaration(
    astFactory,
    node,
    modifiers,
    NodeVisitor_VisitNode(visitor, node!.name as unknown as GoPtr<Node>),
    NodeVisitor_VisitNodes(visitor, node!.TypeParameters),
    NodeVisitor_VisitNodes(visitor, node!.Parameters),
    NodeVisitor_VisitNode(visitor, node!.Type as unknown as GoPtr<Node>),
    NodeVisitor_VisitNode(visitor, node!.FullSignature as unknown as GoPtr<Node>),
    NodeVisitor_VisitNode(visitor, node!.Body as unknown as GoPtr<Node>),
  );
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/tstransforms/metadata.go::method::MetadataTransformer.visitGetAccessor","kind":"method","status":"implemented","sigHash":"7f918208b108e38fefeaea0bea0b5e936c48952a2500384906ef485e6cea7a99","bodyHash":"8737ec17561ec79903fc58eb16a8fad03079f80e2cbe6f8b5edcccc722574a4e"}
 *
 * Go source:
 * func (tx *MetadataTransformer) visitGetAccessor(node *ast.GetAccessorDeclaration) *ast.Node {
 * 	if !ast.HasDecorators(node.AsNode()) {
 * 		return tx.Visitor().VisitEachChild(node.AsNode())
 * 	}
 *
 * 	modifiers := tx.injectClassElementTypeMetadata(tx.Visitor().VisitModifiers(node.Modifiers()), node.AsNode(), tx.parent)
 * 	return tx.Factory().UpdateGetAccessorDeclaration(
 * 		node,
 * 		modifiers,
 * 		tx.Visitor().VisitNode(node.Name()),
 * 		tx.Visitor().VisitNodes(node.TypeParameters),
 * 		tx.Visitor().VisitNodes(node.Parameters),
 * 		tx.Visitor().VisitNode(node.Type),
 * 		tx.Visitor().VisitNode(node.FullSignature),
 * 		tx.Visitor().VisitNode(node.Body),
 * 	)
 * }
 */
export function MetadataTransformer_visitGetAccessor(receiver: GoPtr<MetadataTransformer>, node: GoPtr<GetAccessorDeclaration>): GoPtr<Node> {
  const tx = receiver!;
  const visitor = Transformer_Visitor(tx.__tsgoEmbedded0) as ConcreteNodeVisitor;
  const astFactory = Transformer_Factory(tx.__tsgoEmbedded0)!.__tsgoEmbedded0!;
  const nodeAsNode = node as unknown as GoPtr<Node>;
  if (!HasDecorators(nodeAsNode)) {
    return NodeVisitor_VisitEachChild(visitor, nodeAsNode);
  }

  const modifiers = MetadataTransformer_injectClassElementTypeMetadata(receiver, NodeVisitor_VisitModifiers(visitor, Node_Modifiers(nodeAsNode)), nodeAsNode, tx.parent);
  return NodeFactory_UpdateGetAccessorDeclaration(
    astFactory,
    node,
    modifiers,
    NodeVisitor_VisitNode(visitor, node!.name as unknown as GoPtr<Node>),
    NodeVisitor_VisitNodes(visitor, node!.TypeParameters),
    NodeVisitor_VisitNodes(visitor, node!.Parameters),
    NodeVisitor_VisitNode(visitor, node!.Type as unknown as GoPtr<Node>),
    NodeVisitor_VisitNode(visitor, node!.FullSignature as unknown as GoPtr<Node>),
    NodeVisitor_VisitNode(visitor, node!.Body as unknown as GoPtr<Node>),
  );
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/tstransforms/metadata.go::method::MetadataTransformer.injectClassTypeMetadata","kind":"method","status":"implemented","sigHash":"c2589e88b72f0183dfc7e49fdf632c95322e40d5524c7055e92d38af54407cfe","bodyHash":"e0c1479c394a3dff006ffb7147d21bac4f48989a5918a6b6ea3c8c4fbdb41de8"}
 *
 * Go source:
 * func (tx *MetadataTransformer) injectClassTypeMetadata(list *ast.ModifierList, node *ast.Node) *ast.ModifierList {
 * 	metadata := tx.getTypeMetadata(node, node)
 * 	if len(metadata) > 0 {
 * 		var originalNodes []*ast.Node
 * 		if list != nil {
 * 			originalNodes = list.Nodes
 * 		}
 * 		if len(originalNodes) == 0 {
 * 			res := tx.Factory().NewModifierList(metadata)
 * 			if list != nil {
 * 				res.Loc = list.Loc
 * 			}
 * 			return res
 * 		}
 * 		var modifiersArray []*ast.Node
 * 		if ast.IsModifier(originalNodes[0]) && (originalNodes[0].Kind == ast.KindDefaultKeyword || originalNodes[0].Kind == ast.KindExportKeyword) {
 * 			modifiersArray = append(modifiersArray, originalNodes[0])
 * 			if len(originalNodes) > 1 && (originalNodes[1].Kind == ast.KindDefaultKeyword || originalNodes[1].Kind == ast.KindExportKeyword) {
 * 				modifiersArray = append(modifiersArray, originalNodes[1])
 * 			}
 * 		}
 * 		restStart := len(modifiersArray)
 * 		decos := core.Filter(originalNodes, ast.IsDecorator)
 * 		modifiersArray = append(modifiersArray, decos...)
 * 		modifiersArray = append(modifiersArray, metadata...)
 * 		otherModifiers := core.Filter(originalNodes[restStart:], ast.IsModifier)
 * 		modifiersArray = append(modifiersArray, otherModifiers...)
 * 		res := tx.Factory().NewModifierList(modifiersArray)
 * 		res.Loc = list.Loc
 * 		return res
 * 	}
 * 	return list
 * }
 */
export function MetadataTransformer_injectClassTypeMetadata(receiver: GoPtr<MetadataTransformer>, list: GoPtr<ModifierList>, node: GoPtr<Node>): GoPtr<ModifierList> {
  const tx = receiver!;
  const factory = Transformer_Factory(tx.__tsgoEmbedded0)!;
  const metadata = MetadataTransformer_getTypeMetadata(receiver, node, node);
  if (metadata.length > 0) {
    let originalNodes: GoSlice<GoPtr<Node>> = [];
    if (list !== undefined) {
      originalNodes = list!.Nodes ?? [];
    }
    if (originalNodes.length === 0) {
      const res = NodeFactory_NewModifierList(factory.__tsgoEmbedded0!, metadata);
      if (list !== undefined) {
        res!.Loc = list!.Loc;
      }
      return res;
    }
    let modifiersArray: GoSlice<GoPtr<Node>> = [];
    if (IsModifier(originalNodes[0]) && (originalNodes[0]!.Kind === KindDefaultKeyword || originalNodes[0]!.Kind === KindExportKeyword)) {
      modifiersArray = [...modifiersArray, originalNodes[0]];
      if (originalNodes.length > 1 && (originalNodes[1]!.Kind === KindDefaultKeyword || originalNodes[1]!.Kind === KindExportKeyword)) {
        modifiersArray = [...modifiersArray, originalNodes[1]];
      }
    }
    const restStart = modifiersArray.length;
    const decos = Filter(originalNodes, IsDecorator);
    modifiersArray = [...modifiersArray, ...decos, ...metadata];
    const otherModifiers = Filter(originalNodes.slice(restStart), IsModifier);
    modifiersArray = [...modifiersArray, ...otherModifiers];
    const res = NodeFactory_NewModifierList(factory.__tsgoEmbedded0!, modifiersArray);
    res!.Loc = list!.Loc;
    return res;
  }
  return list;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/tstransforms/metadata.go::method::MetadataTransformer.injectClassElementTypeMetadata","kind":"method","status":"implemented","sigHash":"19991ff546382a19f8e46712294792407118d309e10333360f96d46eb7fd25ef","bodyHash":"231ab6ab869444bfd4aa6aa3f7e6d25a2af0ad0d4799d73a349e0b42f099f4f8"}
 *
 * Go source:
 * func (tx *MetadataTransformer) injectClassElementTypeMetadata(list *ast.ModifierList, node *ast.Node, container *ast.Node) *ast.ModifierList {
 * 	if !ast.IsClassLike(container) {
 * 		return list
 * 	}
 * 	if !ast.ClassElementOrClassElementParameterIsDecorated(tx.legacyDecorators, node, container) {
 * 		return list
 * 	}
 * 	metadata := tx.getTypeMetadata(node, container)
 * 	if len(metadata) > 0 {
 * 		var originalNodes []*ast.Node
 * 		if list != nil {
 * 			originalNodes = list.Nodes
 * 		}
 * 		if len(originalNodes) == 0 {
 * 			res := tx.Factory().NewModifierList(metadata)
 * 			if list != nil {
 * 				res.Loc = list.Loc
 * 			}
 * 			return res
 * 		}
 * 		var modifiersArray []*ast.Node
 * 		decos := core.Filter(originalNodes, ast.IsDecorator)
 * 		modifiersArray = append(modifiersArray, decos...)
 * 		modifiersArray = append(modifiersArray, metadata...)
 * 		modifiers := core.Filter(originalNodes, ast.IsModifier)
 * 		modifiersArray = append(modifiersArray, modifiers...)
 * 		res := tx.Factory().NewModifierList(modifiersArray)
 * 		res.Loc = list.Loc
 * 		return res
 * 	}
 * 	return list
 * }
 */
export function MetadataTransformer_injectClassElementTypeMetadata(receiver: GoPtr<MetadataTransformer>, list: GoPtr<ModifierList>, node: GoPtr<Node>, container: GoPtr<Node>): GoPtr<ModifierList> {
  const tx = receiver!;
  const factory = Transformer_Factory(tx.__tsgoEmbedded0)!;
  if (!IsClassLike(container)) {
    return list;
  }
  if (!ClassElementOrClassElementParameterIsDecorated(tx.legacyDecorators, node, container)) {
    return list;
  }
  const metadata = MetadataTransformer_getTypeMetadata(receiver, node, container);
  if (metadata.length > 0) {
    let originalNodes: GoSlice<GoPtr<Node>> = [];
    if (list !== undefined) {
      originalNodes = list!.Nodes ?? [];
    }
    if (originalNodes.length === 0) {
      const res = NodeFactory_NewModifierList(factory.__tsgoEmbedded0!, metadata);
      if (list !== undefined) {
        res!.Loc = list!.Loc;
      }
      return res;
    }
    let modifiersArray: GoSlice<GoPtr<Node>> = [];
    const decos = Filter(originalNodes, IsDecorator);
    modifiersArray = [...modifiersArray, ...decos, ...metadata];
    const modifiers = Filter(originalNodes, IsModifier);
    modifiersArray = [...modifiersArray, ...modifiers];
    const res = NodeFactory_NewModifierList(factory.__tsgoEmbedded0!, modifiersArray);
    res!.Loc = list!.Loc;
    return res;
  }
  return list;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/tstransforms/metadata.go::method::MetadataTransformer.getTypeMetadata","kind":"method","status":"implemented","sigHash":"4df51fcdac33a208c396d34d13aee26c908c7435d1e915666b1c348749044032","bodyHash":"9ff5b83829e4cae1dff0138b0929d067e42826f0fcd64afd3b78082884b623ee"}
 *
 * Go source:
 * func (tx *MetadataTransformer) getTypeMetadata(node *ast.Node, container *ast.Node) []*ast.Node {
 * 	// Decorator metadata is not yet supported for ES decorators.
 * 	if !tx.legacyDecorators {
 * 		return nil
 * 	}
 * 	if USE_NEW_TYPE_METADATA_FORMAT {
 * 		return tx.getNewTypeMetadata(node, container)
 * 	}
 * 	return tx.getOldTypeMetadata(node, container)
 * }
 */
export function MetadataTransformer_getTypeMetadata(receiver: GoPtr<MetadataTransformer>, node: GoPtr<Node>, container: GoPtr<Node>): GoSlice<GoPtr<Node>> {
  const tx = receiver!;
  // Decorator metadata is not yet supported for ES decorators.
  if (!tx.legacyDecorators) {
    return [];
  }
  if (USE_NEW_TYPE_METADATA_FORMAT) {
    return MetadataTransformer_getNewTypeMetadata(tx, node, container);
  }
  return MetadataTransformer_getOldTypeMetadata(tx, node, container);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/tstransforms/metadata.go::method::MetadataTransformer.getOldTypeMetadata","kind":"method","status":"implemented","sigHash":"fd69259336c3735edfb929389125202f9ca9b1c53c97964128fe841ede873ad8","bodyHash":"49e0e434212378e5e5082c5562613def519a24b714da6b9609dd301bc0268d56"}
 *
 * Go source:
 * func (tx *MetadataTransformer) getOldTypeMetadata(node *ast.Node, container *ast.Node) []*ast.Node {
 * 	var decorators []*ast.Node
 * 	if tx.shouldAddTypeMetadata(node) {
 * 		typeMetadata := tx.Factory().NewMetadataHelper("design:type", tx.serializer.SerializeTypeOfNode(metadataSerializerContext{currentLexicalScope: tx.currentLexicalScope, currentNameScope: container}, node, container))
 * 		decorators = append(decorators, tx.Factory().NewDecorator(typeMetadata))
 * 	}
 * 	if tx.shouldAddParamTypesMetadata(node) {
 * 		paramTypesMetadata := tx.Factory().NewMetadataHelper("design:paramtypes", tx.serializer.SerializeParameterTypesOfNode(metadataSerializerContext{currentLexicalScope: tx.currentLexicalScope, currentNameScope: container}, node, container))
 * 		decorators = append(decorators, tx.Factory().NewDecorator(paramTypesMetadata))
 * 	}
 * 	if tx.shouldAddReturnTypeMetadata(node) {
 * 		returnTypeMetadata := tx.Factory().NewMetadataHelper("design:returntype", tx.serializer.SerializeReturnTypeOfNode(metadataSerializerContext{currentLexicalScope: tx.currentLexicalScope, currentNameScope: container}, node))
 * 		decorators = append(decorators, tx.Factory().NewDecorator(returnTypeMetadata))
 * 	}
 * 	return decorators
 * }
 */
export function MetadataTransformer_getOldTypeMetadata(receiver: GoPtr<MetadataTransformer>, node: GoPtr<Node>, container: GoPtr<Node>): GoSlice<GoPtr<Node>> {
  const tx = receiver!;
  let decorators: GoSlice<GoPtr<Node>> = [];
  const factory = Transformer_Factory(tx.__tsgoEmbedded0)!;
  if (MetadataTransformer_shouldAddTypeMetadata(tx, node)) {
    const typeMetadata = NodeFactory_NewMetadataHelper(
      factory,
      "design:type",
      metadataSerializer_SerializeTypeOfNode(
        tx.serializer,
        { currentLexicalScope: tx.currentLexicalScope, currentNameScope: container, serializingConditionalTypeBranch: false },
        node,
        container,
      ),
    );
    decorators = [...decorators, NewDecorator(factory.__tsgoEmbedded0, typeMetadata)];
  }
  if (MetadataTransformer_shouldAddParamTypesMetadata(tx, node)) {
    const paramTypesMetadata = NodeFactory_NewMetadataHelper(
      factory,
      "design:paramtypes",
      metadataSerializer_SerializeParameterTypesOfNode(
        tx.serializer,
        { currentLexicalScope: tx.currentLexicalScope, currentNameScope: container, serializingConditionalTypeBranch: false },
        node,
        container,
      ),
    );
    decorators = [...decorators, NewDecorator(factory.__tsgoEmbedded0, paramTypesMetadata)];
  }
  if (MetadataTransformer_shouldAddReturnTypeMetadata(tx, node)) {
    const returnTypeMetadata = NodeFactory_NewMetadataHelper(
      factory,
      "design:returntype",
      metadataSerializer_SerializeReturnTypeOfNode(
        tx.serializer,
        { currentLexicalScope: tx.currentLexicalScope, currentNameScope: container, serializingConditionalTypeBranch: false },
        node,
      ),
    );
    decorators = [...decorators, NewDecorator(factory.__tsgoEmbedded0, returnTypeMetadata)];
  }
  return decorators;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/tstransforms/metadata.go::method::MetadataTransformer.getNewTypeMetadata","kind":"method","status":"implemented","sigHash":"7f1ddab31565ba659f7714542c8a580c1d15074a0fdeb024aeb95f1bc7cc093a","bodyHash":"9351a47d8aacabd8b12ae83f85b1803674fe3eccddd21f5c0eba9cb309f06347"}
 *
 * Go source:
 * func (tx *MetadataTransformer) getNewTypeMetadata(node *ast.Node, container *ast.Node) []*ast.Node {
 * 	var properties []*ast.Node
 * 	if tx.shouldAddTypeMetadata(node) {
 * 		properties = append(properties, tx.Factory().NewPropertyAssignment(
 * 			nil,
 * 			tx.Factory().NewIdentifier("type"),
 * 			nil,
 * 			nil,
 * 			tx.Factory().NewArrowFunction(
 * 				nil,
 * 				nil,
 * 				tx.Factory().NewNodeList([]*ast.Node{}),
 * 				nil,
 * 				nil,
 * 				tx.Factory().NewToken(ast.KindEqualsGreaterThanToken),
 * 				tx.serializer.SerializeTypeOfNode(metadataSerializerContext{currentLexicalScope: tx.currentLexicalScope, currentNameScope: container}, node, container),
 * 			),
 * 		))
 * 	}
 * 	if tx.shouldAddParamTypesMetadata(node) {
 * 		properties = append(properties, tx.Factory().NewPropertyAssignment(
 * 			nil,
 * 			tx.Factory().NewIdentifier("paramTypes"),
 * 			nil,
 * 			nil,
 * 			tx.Factory().NewArrowFunction(
 * 				nil,
 * 				nil,
 * 				tx.Factory().NewNodeList([]*ast.Node{}),
 * 				nil,
 * 				nil,
 * 				tx.Factory().NewToken(ast.KindEqualsGreaterThanToken),
 * 				tx.serializer.SerializeParameterTypesOfNode(metadataSerializerContext{currentLexicalScope: tx.currentLexicalScope, currentNameScope: container}, node, container),
 * 			),
 * 		))
 * 	}
 * 	if tx.shouldAddReturnTypeMetadata(node) {
 * 		properties = append(properties, tx.Factory().NewPropertyAssignment(
 * 			nil,
 * 			tx.Factory().NewIdentifier("returnType"),
 * 			nil,
 * 			nil,
 * 			tx.Factory().NewArrowFunction(
 * 				nil,
 * 				nil,
 * 				tx.Factory().NewNodeList([]*ast.Node{}),
 * 				nil,
 * 				nil,
 * 				tx.Factory().NewToken(ast.KindEqualsGreaterThanToken),
 * 				tx.serializer.SerializeReturnTypeOfNode(metadataSerializerContext{currentLexicalScope: tx.currentLexicalScope, currentNameScope: container}, node),
 * 			),
 * 		))
 * 	}
 * 	if len(properties) > 0 {
 * 		typeInfoMetadata := tx.Factory().NewMetadataHelper("design:typeinfo", tx.Factory().NewObjectLiteralExpression(tx.Factory().NewNodeList(properties), true))
 * 		return []*ast.Node{tx.Factory().NewDecorator(typeInfoMetadata)}
 * 	}
 * 	return nil
 * }
 */
export function MetadataTransformer_getNewTypeMetadata(receiver: GoPtr<MetadataTransformer>, node: GoPtr<Node>, container: GoPtr<Node>): GoSlice<GoPtr<Node>> {
  const tx = receiver!;
  let properties: GoSlice<GoPtr<Node>> = [];
  const factory = Transformer_Factory(tx.__tsgoEmbedded0)!;
  const astFactory = factory.__tsgoEmbedded0;
  if (MetadataTransformer_shouldAddTypeMetadata(tx, node)) {
    properties = [
      ...properties,
      NewPropertyAssignment(
        astFactory,
        undefined,
        NewIdentifier(astFactory, "type"),
        undefined,
        undefined,
        NewArrowFunction(
          astFactory,
          undefined,
          undefined,
          NodeFactory_NewNodeList(astFactory, []),
          undefined,
          undefined,
          NewToken(astFactory, KindEqualsGreaterThanToken),
          metadataSerializer_SerializeTypeOfNode(
            tx.serializer,
            { currentLexicalScope: tx.currentLexicalScope, currentNameScope: container, serializingConditionalTypeBranch: false },
            node,
            container,
          ),
        ),
      ),
    ];
  }
  if (MetadataTransformer_shouldAddParamTypesMetadata(tx, node)) {
    properties = [
      ...properties,
      NewPropertyAssignment(
        astFactory,
        undefined,
        NewIdentifier(astFactory, "paramTypes"),
        undefined,
        undefined,
        NewArrowFunction(
          astFactory,
          undefined,
          undefined,
          NodeFactory_NewNodeList(astFactory, []),
          undefined,
          undefined,
          NewToken(astFactory, KindEqualsGreaterThanToken),
          metadataSerializer_SerializeParameterTypesOfNode(
            tx.serializer,
            { currentLexicalScope: tx.currentLexicalScope, currentNameScope: container, serializingConditionalTypeBranch: false },
            node,
            container,
          ),
        ),
      ),
    ];
  }
  if (MetadataTransformer_shouldAddReturnTypeMetadata(tx, node)) {
    properties = [
      ...properties,
      NewPropertyAssignment(
        astFactory,
        undefined,
        NewIdentifier(astFactory, "returnType"),
        undefined,
        undefined,
        NewArrowFunction(
          astFactory,
          undefined,
          undefined,
          NodeFactory_NewNodeList(astFactory, []),
          undefined,
          undefined,
          NewToken(astFactory, KindEqualsGreaterThanToken),
          metadataSerializer_SerializeReturnTypeOfNode(
            tx.serializer,
            { currentLexicalScope: tx.currentLexicalScope, currentNameScope: container, serializingConditionalTypeBranch: false },
            node,
          ),
        ),
      ),
    ];
  }
  if (properties.length > 0) {
    const typeInfoMetadata = NodeFactory_NewMetadataHelper(
      factory,
      "design:typeinfo",
      NewObjectLiteralExpression(astFactory, NodeFactory_NewNodeList(astFactory, properties), true),
    );
    return [NewDecorator(astFactory, typeInfoMetadata)];
  }
  return [];
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/tstransforms/metadata.go::method::MetadataTransformer.shouldAddTypeMetadata","kind":"method","status":"implemented","sigHash":"7dcf930529e923d1200c01f3b22f42295a37bfd5ef03d704c70d618edb6000d8","bodyHash":"e427b93a559fafa7a07a8d5e8647b6b11bd8fc9ba803cfae186d5f9b2dc4738a"}
 *
 * Go source:
 * func (tx *MetadataTransformer) shouldAddTypeMetadata(node *ast.Node) bool {
 * 	switch node.Kind {
 * 	case ast.KindMethodDeclaration, ast.KindGetAccessor, ast.KindSetAccessor, ast.KindPropertyDeclaration:
 * 		return true
 * 	}
 * 	return false
 * }
 */
export function MetadataTransformer_shouldAddTypeMetadata(receiver: GoPtr<MetadataTransformer>, node: GoPtr<Node>): bool {
  switch (node!.Kind) {
    case KindMethodDeclaration:
    case KindGetAccessor:
    case KindSetAccessor:
    case KindPropertyDeclaration:
      return true;
  }
  return false;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/tstransforms/metadata.go::method::MetadataTransformer.shouldAddReturnTypeMetadata","kind":"method","status":"implemented","sigHash":"f2f653c220ded49041176471e2866ab15f895ea14e9c35f5649d6ca169bc33db","bodyHash":"6658d95a6840701c26b33f1c031f1e0b61b260493460eacbcd9c1df075335f10"}
 *
 * Go source:
 * func (tx *MetadataTransformer) shouldAddReturnTypeMetadata(node *ast.Node) bool {
 * 	return node.Kind == ast.KindMethodDeclaration
 * }
 */
export function MetadataTransformer_shouldAddReturnTypeMetadata(receiver: GoPtr<MetadataTransformer>, node: GoPtr<Node>): bool {
  return node!.Kind === KindMethodDeclaration;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/tstransforms/metadata.go::method::MetadataTransformer.shouldAddParamTypesMetadata","kind":"method","status":"implemented","sigHash":"2c8548a7e392dcc928f8c9a343f1294535aa1a0c7e5fe4db2b3f3d41e1877952","bodyHash":"a85ef58600661a030405c64347ca050b6acfd14489fe5152a2586e1ca866323d"}
 *
 * Go source:
 * func (tx *MetadataTransformer) shouldAddParamTypesMetadata(node *ast.Node) bool {
 * 	switch node.Kind {
 * 	case ast.KindClassDeclaration, ast.KindClassExpression:
 * 		return ast.GetFirstConstructorWithBody(node) != nil
 * 	case ast.KindMethodDeclaration, ast.KindGetAccessor, ast.KindSetAccessor:
 * 		return true
 * 	}
 * 	return false
 * }
 */
export function MetadataTransformer_shouldAddParamTypesMetadata(receiver: GoPtr<MetadataTransformer>, node: GoPtr<Node>): bool {
  switch (node!.Kind) {
    case KindClassDeclaration:
    case KindClassExpression:
      return (GetFirstConstructorWithBody(node) !== undefined) as bool;
    case KindMethodDeclaration:
    case KindGetAccessor:
    case KindSetAccessor:
      return true;
  }
  return false;
}
