import type { bool } from "@tsonic/core/types.js";
import type { GoPtr } from "../../../go/compat.js";
import type { Node } from "../../ast/spine.js";
import { Node_Modifiers } from "../../ast/spine.js";
import type { SourceFile } from "../../ast/ast.js";
import { AsSourceFile, NodeFactory_UpdateExportDeclaration, NodeFactory_UpdateImportClause, NodeFactory_UpdateImportDeclaration, NodeFactory_UpdateNamedExports, NodeFactory_UpdateNamedImports } from "../../ast/ast.js";
import { IsExternalModule } from "../../ast/utilities.js";
import { IsInJSFile } from "../../ast/utilities.js";
import { IsExternalModuleImportEqualsDeclaration } from "../../ast/utilities.js";
import type { ExportDeclaration, ImportClause, ImportDeclaration, ImportEqualsDeclaration, NamedExports, NamedImports } from "../../ast/generated/data.js";
import { AsExportDeclaration, AsImportClause, AsImportDeclaration, AsImportEqualsDeclaration, AsNamedExports, AsNamedImports } from "../../ast/generated/casts.js";
import {
  KindExportAssignment,
  KindExportDeclaration,
  KindExportSpecifier,
  KindImportClause,
  KindImportDeclaration,
  KindImportEqualsDeclaration,
  KindImportSpecifier,
  KindModuleBlock,
  KindModuleDeclaration,
  KindNamedExports,
  KindNamedImports,
  KindNamespaceImport,
  KindSourceFile,
} from "../../ast/generated/kinds.js";
import { NodeVisitor_VisitEachChild, NodeVisitor_VisitNode, NodeVisitor_VisitNodes } from "../../ast/visitor.js";
import type { NodeVisitor as ConcreteNodeVisitor } from "../../ast/visitor.js";
import type { CompilerOptions } from "../../core/compileroptions.js";
import { Tristate_IsTrue } from "../../core/tristate.js";
import { EmitContext_ParseNode } from "../../printer/emitcontext.js";
import type { EmitResolver } from "../../printer/emitresolver.js";
import type { TransformOptions } from "../chain.js";
import type { Transformer } from "../transformer.js";
import { Transformer_EmitContext, Transformer_Factory, Transformer_NewTransformer, Transformer_Visitor } from "../transformer.js";

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/tstransforms/importelision.go::type::ImportElisionTransformer","kind":"type","status":"implemented","sigHash":"14dbd314bb170c0be6d4a2cff3fc73755b8bdac3dc81bfb877a24bcec60ea804","bodyHash":"8f403613429078b6e07765c1b176cbb4bdb3238c22b9f630d78f4eac74b994f5"}
 *
 * Go source:
 * ImportElisionTransformer struct {
 * 	transformers.Transformer
 * 	compilerOptions   *core.CompilerOptions
 * 	currentSourceFile *ast.SourceFile
 * 	emitResolver      printer.EmitResolver
 * }
 */
export interface ImportElisionTransformer {
  readonly __tsgoEmbedded0?: Transformer;
  compilerOptions: GoPtr<CompilerOptions>;
  currentSourceFile: GoPtr<SourceFile>;
  emitResolver: EmitResolver;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/tstransforms/importelision.go::func::NewImportElisionTransformer","kind":"func","status":"implemented","sigHash":"92c3f33218c099370dac2fc118f028d545e9e07523969a97b2ab2500fb873b83","bodyHash":"0588a42f168a20e0332480dac94c841ad1e42daa9066e9cf426afb55a368e41e"}
 *
 * Go source:
 * func NewImportElisionTransformer(opt *transformers.TransformOptions) *transformers.Transformer {
 * 	compilerOptions := opt.CompilerOptions
 * 	emitContext := opt.Context
 * 	if compilerOptions.VerbatimModuleSyntax.IsTrue() {
 * 		panic("ImportElisionTransformer should not be used with VerbatimModuleSyntax")
 * 	}
 * 	tx := &ImportElisionTransformer{compilerOptions: compilerOptions, emitResolver: opt.EmitResolver}
 * 	return tx.NewTransformer(tx.visit, emitContext)
 * }
 */
export function NewImportElisionTransformer(opt: GoPtr<TransformOptions>): GoPtr<Transformer> {
  const compilerOptions = opt!.CompilerOptions;
  const emitContext = opt!.Context;
  if (Tristate_IsTrue(compilerOptions!.VerbatimModuleSyntax)) {
    throw new globalThis.Error("ImportElisionTransformer should not be used with VerbatimModuleSyntax");
  }
  const tx: ImportElisionTransformer = {
    __tsgoEmbedded0: { emitContext: undefined, factory: undefined, visitor: undefined },
    compilerOptions: compilerOptions,
    currentSourceFile: undefined,
    emitResolver: opt!.EmitResolver!,
  };
  return Transformer_NewTransformer(tx.__tsgoEmbedded0, (node) => ImportElisionTransformer_visit(tx, node), emitContext);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/tstransforms/importelision.go::method::ImportElisionTransformer.visit","kind":"method","status":"implemented","sigHash":"2dada36e00b7a14e377ca3c3ae81c581ce704062b91b828cb85584089cbb20a1","bodyHash":"3192f19d9eca37402d140cfcbae3afcbf32cb595848840ad3d373973e4a64be8"}
 *
 * Go source:
 * func (tx *ImportElisionTransformer) visit(node *ast.Node) *ast.Node {
 * 	switch node.Kind {
 * 	case ast.KindImportEqualsDeclaration:
 * 		if ast.IsExternalModuleImportEqualsDeclaration(node) {
 * 			if !tx.shouldEmitAliasDeclaration(node) {
 * 				return nil
 * 			}
 * 		} else {
 * 			if !tx.shouldEmitImportEqualsDeclaration(node.AsImportEqualsDeclaration()) {
 * 				return nil
 * 			}
 * 		}
 * 		return tx.Visitor().VisitEachChild(node)
 * 	case ast.KindImportDeclaration:
 * 		n := node.AsImportDeclaration()
 * 		// Do not elide a side-effect only import declaration.
 * 		//  import "foo";
 * 		if n.ImportClause != nil {
 * 			importClause := tx.Visitor().VisitNode(n.ImportClause)
 * 			if importClause == nil {
 * 				return nil
 * 			}
 * 			return tx.Factory().UpdateImportDeclaration(n, n.Modifiers(), importClause, n.ModuleSpecifier, tx.Visitor().VisitNode(n.Attributes))
 * 		}
 * 		return tx.Visitor().VisitEachChild(node)
 * 	case ast.KindImportClause:
 * 		n := node.AsImportClause()
 * 		name := core.IfElse(tx.shouldEmitAliasDeclaration(node), n.Name(), nil)
 * 		namedBindings := tx.Visitor().VisitNode(n.NamedBindings)
 * 		if name == nil && namedBindings == nil {
 * 			// all import bindings were elided
 * 			return nil
 * 		}
 * 		return tx.Factory().UpdateImportClause(n, n.PhaseModifier, name, namedBindings)
 * 	case ast.KindNamespaceImport:
 * 		if !tx.shouldEmitAliasDeclaration(node) {
 * 			// elide unused imports
 * 			return nil
 * 		}
 * 		return node
 * 	case ast.KindNamedImports:
 * 		n := node.AsNamedImports()
 * 		elements := tx.Visitor().VisitNodes(n.Elements)
 * 		if len(elements.Nodes) == 0 {
 * 			// all import specifiers were elided
 * 			return nil
 * 		}
 * 		return tx.Factory().UpdateNamedImports(n, elements)
 * 	case ast.KindImportSpecifier:
 * 		if !tx.shouldEmitAliasDeclaration(node) {
 * 			// elide type-only or unused imports
 * 			return nil
 * 		}
 * 		return node
 * 	case ast.KindExportAssignment:
 * 		if !tx.compilerOptions.VerbatimModuleSyntax.IsTrue() && !tx.isValueAliasDeclaration(node) {
 * 			// elide unused import
 * 			return nil
 * 		}
 * 		return tx.Visitor().VisitEachChild(node)
 * 	case ast.KindExportDeclaration:
 * 		n := node.AsExportDeclaration()
 * 		var exportClause *ast.Node
 * 		if n.ExportClause != nil {
 * 			exportClause = tx.Visitor().VisitNode(n.ExportClause)
 * 			if exportClause == nil {
 * 				// all export bindings were elided
 * 				return nil
 * 			}
 * 		}
 * 		return tx.Factory().UpdateExportDeclaration(n, nil /*modifiers* /, false /*isTypeOnly* /, exportClause, tx.Visitor().VisitNode(n.ModuleSpecifier), tx.Visitor().VisitNode(n.Attributes))
 * 	case ast.KindNamedExports:
 * 		n := node.AsNamedExports()
 * 		elements := tx.Visitor().VisitNodes(n.Elements)
 * 		if len(elements.Nodes) == 0 {
 * 			// all export specifiers were elided
 * 			return nil
 * 		}
 * 		return tx.Factory().UpdateNamedExports(n, elements)
 * 	case ast.KindExportSpecifier:
 * 		if !tx.isValueAliasDeclaration(node) {
 * 			// elide unused export
 * 			return nil
 * 		}
 * 		return node
 * 	case ast.KindSourceFile:
 * 		savedCurrentSourceFile := tx.currentSourceFile
 * 		tx.currentSourceFile = node.AsSourceFile()
 * 		node = tx.Visitor().VisitEachChild(node)
 * 		tx.currentSourceFile = savedCurrentSourceFile
 * 		return node
 * 	case ast.KindModuleDeclaration, ast.KindModuleBlock:
 * 		return tx.Visitor().VisitEachChild(node)
 * 	default:
 * 		return node
 * 	}
 * }
 */
export function ImportElisionTransformer_visit(receiver: GoPtr<ImportElisionTransformer>, node: GoPtr<Node>): GoPtr<Node> {
  const tx = receiver!;
  const visitor = Transformer_Visitor(tx.__tsgoEmbedded0) as ConcreteNodeVisitor;
  const factory = Transformer_Factory(tx.__tsgoEmbedded0)!.__tsgoEmbedded0!;
  switch (node!.Kind) {
    case KindImportEqualsDeclaration:
      if (IsExternalModuleImportEqualsDeclaration(node)) {
        if (!ImportElisionTransformer_shouldEmitAliasDeclaration(tx, node)) {
          return undefined;
        }
      } else {
        if (!ImportElisionTransformer_shouldEmitImportEqualsDeclaration(tx, AsImportEqualsDeclaration(node))) {
          return undefined;
        }
      }
      return NodeVisitor_VisitEachChild(visitor, node);
    case KindImportDeclaration: {
      const n: GoPtr<ImportDeclaration> = AsImportDeclaration(node);
      // Do not elide a side-effect only import declaration.
      //  import "foo";
      if (n!.ImportClause !== undefined) {
        const importClause = NodeVisitor_VisitNode(visitor, n!.ImportClause);
        if (importClause === undefined) {
          return undefined;
        }
        return NodeFactory_UpdateImportDeclaration(factory, n, Node_Modifiers(node), importClause, n!.ModuleSpecifier, NodeVisitor_VisitNode(visitor, n!.Attributes));
      }
      return NodeVisitor_VisitEachChild(visitor, node);
    }
    case KindImportClause: {
      const n: GoPtr<ImportClause> = AsImportClause(node);
      const name = ImportElisionTransformer_shouldEmitAliasDeclaration(tx, node) ? n!.name : undefined;
      const namedBindings = NodeVisitor_VisitNode(visitor, n!.NamedBindings);
      if (name === undefined && namedBindings === undefined) {
        // all import bindings were elided
        return undefined;
      }
      return NodeFactory_UpdateImportClause(factory, n, n!.PhaseModifier, name, namedBindings);
    }
    case KindNamespaceImport:
      if (!ImportElisionTransformer_shouldEmitAliasDeclaration(tx, node)) {
        // elide unused imports
        return undefined;
      }
      return node;
    case KindNamedImports: {
      const n: GoPtr<NamedImports> = AsNamedImports(node);
      const elements = NodeVisitor_VisitNodes(visitor, n!.Elements);
      if (elements!.Nodes.length === 0) {
        // all import specifiers were elided
        return undefined;
      }
      return NodeFactory_UpdateNamedImports(factory, n, elements);
    }
    case KindImportSpecifier:
      if (!ImportElisionTransformer_shouldEmitAliasDeclaration(tx, node)) {
        // elide type-only or unused imports
        return undefined;
      }
      return node;
    case KindExportAssignment:
      if (!Tristate_IsTrue(tx.compilerOptions!.VerbatimModuleSyntax) && !ImportElisionTransformer_isValueAliasDeclaration(tx, node)) {
        // elide unused import
        return undefined;
      }
      return NodeVisitor_VisitEachChild(visitor, node);
    case KindExportDeclaration: {
      const n: GoPtr<ExportDeclaration> = AsExportDeclaration(node);
      let exportClause: GoPtr<Node>;
      if (n!.ExportClause !== undefined) {
        exportClause = NodeVisitor_VisitNode(visitor, n!.ExportClause);
        if (exportClause === undefined) {
          // all export bindings were elided
          return undefined;
        }
      }
      return NodeFactory_UpdateExportDeclaration(factory, n, undefined, false, exportClause, NodeVisitor_VisitNode(visitor, n!.ModuleSpecifier), NodeVisitor_VisitNode(visitor, n!.Attributes));
    }
    case KindNamedExports: {
      const n: GoPtr<NamedExports> = AsNamedExports(node);
      const elements = NodeVisitor_VisitNodes(visitor, n!.Elements);
      if (elements!.Nodes.length === 0) {
        // all export specifiers were elided
        return undefined;
      }
      return NodeFactory_UpdateNamedExports(factory, n, elements);
    }
    case KindExportSpecifier:
      if (!ImportElisionTransformer_isValueAliasDeclaration(tx, node)) {
        // elide unused export
        return undefined;
      }
      return node;
    case KindSourceFile: {
      const savedCurrentSourceFile = tx.currentSourceFile;
      tx.currentSourceFile = AsSourceFile(node);
      node = NodeVisitor_VisitEachChild(visitor, node);
      tx.currentSourceFile = savedCurrentSourceFile;
      return node;
    }
    case KindModuleDeclaration:
    case KindModuleBlock:
      return NodeVisitor_VisitEachChild(visitor, node);
    default:
      return node;
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/tstransforms/importelision.go::method::ImportElisionTransformer.shouldEmitAliasDeclaration","kind":"method","status":"implemented","sigHash":"bd112039fa72cc3f82274f00ded7bcb39f9944946787bc9341e97c160bf4a951","bodyHash":"0e4a1a6a031d694f2edaabc074a73eb00bbbdd6c5fae016d15ecd04837ea3f60"}
 *
 * Go source:
 * func (tx *ImportElisionTransformer) shouldEmitAliasDeclaration(node *ast.Node) bool {
 * 	return ast.IsInJSFile(node) || tx.isReferencedAliasDeclaration(node)
 * }
 */
export function ImportElisionTransformer_shouldEmitAliasDeclaration(receiver: GoPtr<ImportElisionTransformer>, node: GoPtr<Node>): bool {
  return (IsInJSFile(node) || ImportElisionTransformer_isReferencedAliasDeclaration(receiver, node)) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/tstransforms/importelision.go::method::ImportElisionTransformer.shouldEmitImportEqualsDeclaration","kind":"method","status":"implemented","sigHash":"07f0dadb5746f49c795d0e5410e14ef3f8ebffaba6af8c82de5fc9504a8dfca7","bodyHash":"a59eeb24bf1d5301beecfd4bde085155bd81eaa1150ff3e879a8a84f6ee80989"}
 *
 * Go source:
 * func (tx *ImportElisionTransformer) shouldEmitImportEqualsDeclaration(node *ast.ImportEqualsDeclaration) bool {
 * 	// preserve old compiler's behavior: emit import declaration (even if we do not consider them referenced) when
 * 	// - current file is not external module
 * 	// - import declaration is top level and target is value imported by entity name
 * 	return tx.shouldEmitAliasDeclaration(node.AsNode()) || (!ast.IsExternalModule(tx.currentSourceFile) && tx.isTopLevelValueImportEqualsWithEntityName(node.AsNode()))
 * }
 */
export function ImportElisionTransformer_shouldEmitImportEqualsDeclaration(receiver: GoPtr<ImportElisionTransformer>, node: GoPtr<ImportEqualsDeclaration>): bool {
  // preserve old compiler's behavior: emit import declaration (even if we do not consider them referenced) when
  // - current file is not external module
  // - import declaration is top level and target is value imported by entity name
  return (ImportElisionTransformer_shouldEmitAliasDeclaration(receiver, node as unknown as GoPtr<Node>) ||
    (!IsExternalModule(receiver!.currentSourceFile) && ImportElisionTransformer_isTopLevelValueImportEqualsWithEntityName(receiver, node as unknown as GoPtr<Node>))) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/tstransforms/importelision.go::method::ImportElisionTransformer.isReferencedAliasDeclaration","kind":"method","status":"implemented","sigHash":"dd870428eccad309d51edc3b866876bb005f2e9e93c81465a2e143208bdeb014","bodyHash":"06661ce7e6b275084fc2d9d4ea08a627b1eeda37eba14af8176b8d9973e0e582"}
 *
 * Go source:
 * func (tx *ImportElisionTransformer) isReferencedAliasDeclaration(node *ast.Node) bool {
 * 	node = tx.EmitContext().ParseNode(node)
 * 	return node == nil || tx.emitResolver.IsReferencedAliasDeclaration(node)
 * }
 */
export function ImportElisionTransformer_isReferencedAliasDeclaration(receiver: GoPtr<ImportElisionTransformer>, node: GoPtr<Node>): bool {
  const parsed = EmitContext_ParseNode(Transformer_EmitContext(receiver!.__tsgoEmbedded0!), node);
  return parsed === undefined || receiver!.emitResolver.IsReferencedAliasDeclaration(parsed);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/tstransforms/importelision.go::method::ImportElisionTransformer.isValueAliasDeclaration","kind":"method","status":"implemented","sigHash":"d3da0a034818baf5657f3bb79c9d6d77609868f1db416c1a55ea44dd28087e5a","bodyHash":"8b02b4c4702861ca028b9dcb09e54a9d3a3983bf39c8174318a6041e547e52de"}
 *
 * Go source:
 * func (tx *ImportElisionTransformer) isValueAliasDeclaration(node *ast.Node) bool {
 * 	node = tx.EmitContext().ParseNode(node)
 * 	return node == nil || tx.emitResolver.IsValueAliasDeclaration(node)
 * }
 */
export function ImportElisionTransformer_isValueAliasDeclaration(receiver: GoPtr<ImportElisionTransformer>, node: GoPtr<Node>): bool {
  const parsed = EmitContext_ParseNode(Transformer_EmitContext(receiver!.__tsgoEmbedded0!), node);
  return parsed === undefined || receiver!.emitResolver.IsValueAliasDeclaration(parsed);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/tstransforms/importelision.go::method::ImportElisionTransformer.isTopLevelValueImportEqualsWithEntityName","kind":"method","status":"implemented","sigHash":"8ea9f02d72f88cbe5632b722230dc26cfff19aa8dfb68cc0eaaed1d6ee2ae5a7","bodyHash":"66fe4d35a19450fe69f118cd4fd40446623d896c938e70b71e6a31afe2ce4142"}
 *
 * Go source:
 * func (tx *ImportElisionTransformer) isTopLevelValueImportEqualsWithEntityName(node *ast.Node) bool {
 * 	node = tx.EmitContext().ParseNode(node)
 * 	return node != nil && tx.emitResolver.IsTopLevelValueImportEqualsWithEntityName(node)
 * }
 */
export function ImportElisionTransformer_isTopLevelValueImportEqualsWithEntityName(receiver: GoPtr<ImportElisionTransformer>, node: GoPtr<Node>): bool {
  const parsed = EmitContext_ParseNode(Transformer_EmitContext(receiver!.__tsgoEmbedded0!), node);
  return parsed !== undefined && receiver!.emitResolver.IsTopLevelValueImportEqualsWithEntityName(parsed);
}
